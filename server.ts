import express from "express";
import path from "path";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import fs from "fs";

const upload = multer({ dest: "uploads/" });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  // Initialize Gemini client
  // Using process.env.GEMINI_API_KEY as required by the guidelines
  let ai: GoogleGenAI;
  try {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  } catch (e) {
    console.error("Failed to initialize GoogleGenAI:", e);
  }

  // API route to upload file to Gemini
  app.post("/api/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      if (!ai) {
        return res.status(500).json({ error: "Gemini client not initialized. Check API key." });
      }

      const uploadResult = await ai.files.upload({
        file: req.file.path,
        config: {
          mimeType: req.file.mimetype,
        }
      });

      // Cleanup local file after upload
      fs.unlinkSync(req.file.path);

      res.json({
        fileUri: uploadResult.uri,
        mimeType: uploadResult.mimeType,
        name: uploadResult.name,
      });
    } catch (error: any) {
      console.error("Upload error:", error);
      res.status(500).json({ error: error.message || "Failed to upload file" });
    }
  });

  // API route for chat
  app.post("/api/chat", async (req, res) => {
    try {
      if (!ai) {
        return res.status(500).json({ error: "Gemini client not initialized. Check API key." });
      }

      const {
        messages,
        documentUri,
        documentMimeType,
        selectedFigureBase64,
        model: requestedModel,
        autoFallback = true,
      } = req.body;

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Invalid messages format" });
      }

      // Validated model or default to gemini-3.5-flash-lite
      const VALID_MODELS = [
        "gemini-3.5-flash-lite",
        "gemini-3.8-flash",
        "gemini-3.6-flash",
        "gemini-3.5-flash",
        "gemini-flash-lite-latest",
      ];

      const chosenModel = VALID_MODELS.includes(requestedModel)
        ? requestedModel
        : "gemini-3.5-flash-lite";

      // Convert chat history to Gemini format, including the document in the first user message
      const formattedContents: any[] = [];

      let hasAttachedDocument = false;

      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        const parts: any[] = [];

        // Attach document to the first user message
        if (!hasAttachedDocument && msg.role === "user" && documentUri) {
          parts.push({
            fileData: {
              fileUri: documentUri,
              mimeType: documentMimeType,
            },
          });
          hasAttachedDocument = true;
        }

        // If this message has a selected figure, include it
        if (msg.role === "user" && msg.figureBase64) {
          // base64 comes as data:image/png;base64,...
          const match = msg.figureBase64.match(/^data:(image\/\w+);base64,(.+)$/);
          if (match) {
            parts.push({
              inlineData: {
                mimeType: match[1],
                data: match[2],
              },
            });
          }
        }

        parts.push({ text: msg.content });

        formattedContents.push({
          role: msg.role,
          parts,
        });
      }

      const systemInstruction = `You are an expert academic paper tutor and study assistant.
Your job is to help students read, understand, and study academic papers, textbooks, and technical documents.

CRITICAL INSTRUCTIONS FOR CITATIONS AND GROUNDING:
1. ALWAYS ground your answers in the uploaded document.
2. ALWAYS cite the exact page number where information, evidence, formulas, or concepts come from using the format: [Page X] or [Page X: Section/Topic] (for example: [Page 1], [Page 3: Architecture], [Page 4: Equation 2]).
3. The user interface automatically turns all [Page X] citations into interactive clickable buttons that jump directly to that page in the PDF reader. Therefore, be precise and include [Page X] citations whenever discussing specific claims, methods, results, or sections.
4. When the user provides a selected figure/diagram/chart:
   - Carefully examine the visual details in the figure.
   - Explain what the figure depicts and its technical significance.
   - Relate the figure seamlessly to the rest of the paper (e.g. how it supports the claims on [Page 4] or ties into the experiments on [Page 6]).
5. Format your answers with clear markdown headings, bullet points, and bold terms so the user can easily study and review them later.`;

      const executeGenerate = async (modelToUse: string) => {
        return await ai.models.generateContent({
          model: modelToUse,
          contents: formattedContents,
          config: {
            systemInstruction,
          },
        });
      };

      let response: any = null;
      let usedModel = chosenModel;
      let fellBack = false;
      let lastError: any = null;

      // Try chosen model
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          response = await executeGenerate(chosenModel);
          break;
        } catch (err: any) {
          lastError = err;
          const errMsg = err?.message || String(err);
          console.warn(`[${chosenModel}] attempt ${attempt + 1} failed:`, errMsg);

          const isHighDemand =
            errMsg.includes("503") ||
            errMsg.includes("high demand") ||
            errMsg.includes("UNAVAILABLE") ||
            errMsg.includes("RESOURCE_EXHAUSTED");

          if (isHighDemand) {
            // High demand on chosen model
            break;
          }

          if (attempt < 1) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
      }

      // If chosen model failed due to high demand (or other error) and autoFallback is allowed
      if (!response && autoFallback && chosenModel !== "gemini-3.5-flash-lite") {
        console.log(`Auto-falling back from ${chosenModel} to gemini-3.5-flash-lite to bypass high demand...`);
        try {
          response = await executeGenerate("gemini-3.5-flash-lite");
          usedModel = "gemini-3.5-flash-lite";
          fellBack = true;
        } catch (fallbackErr: any) {
          console.error("Fallback to gemini-3.5-flash-lite also failed:", fallbackErr);
        }
      }

      if (!response) {
        const errorMsg = lastError?.message || "Failed to generate response";
        const isHighDemand =
          errorMsg.includes("503") ||
          errorMsg.includes("high demand") ||
          errorMsg.includes("UNAVAILABLE");

        return res.status(isHighDemand ? 503 : 500).json({
          error: isHighDemand
            ? `The model "${chosenModel}" is currently experiencing high demand (503). You can switch to Gemini 3.5 Flash Lite or another model to bypass this.`
            : errorMsg,
          isHighDemand,
          model: chosenModel,
        });
      }

      res.json({
        text: response.text,
        usedModel,
        originalModel: chosenModel,
        fellBack,
      });
    } catch (error: any) {
      console.error("Chat error:", error);
      res.status(500).json({ error: error.message || "Failed to generate response" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
