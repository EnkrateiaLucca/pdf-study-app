/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import PdfViewer from "./components/PdfViewer";
import Chat from "./components/Chat";
import { ChatMessage, DocumentInfo, GeminiModelId } from "./types";

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [documentInfo, setDocumentInfo] = useState<DocumentInfo | null>(null);
  const [selectedFigure, setSelectedFigure] = useState<string | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [targetPage, setTargetPage] = useState<number | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [quotedText, setQuotedText] = useState<string | null>(null);

  const [selectedModel, setSelectedModel] = useState<GeminiModelId>("gemini-3.5-flash-lite");
  const [autoFallback, setAutoFallback] = useState<boolean>(true);

  const handleFileLoaded = async (file: File) => {
    setIsLoadingFile(true);
    setFileName(file.name);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload file to backend");
      }

      const data = await response.json();
      setDocumentInfo({
        fileUri: data.fileUri,
        mimeType: data.mimeType,
        fileName: file.name,
      });
      
      setMessages([
        {
          role: "model",
          content: `I've analyzed **${file.name}**! You can ask questions, summarize specific sections, or click **"Select Figure"** to ask about diagrams and formulas. 

All my responses will cite the exact pages (e.g. **[Page 1]**) — you can click any citation to jump directly to that page in the PDF!`,
        }
      ]);
    } catch (error) {
      console.error(error);
      alert("Failed to process document");
    } finally {
      setIsLoadingFile(false);
    }
  };

  const handleNavigateToPage = (pageNum: number) => {
    setTargetPage(pageNum);
  };

  const handleQuoteText = (text: string, pageNum: number) => {
    setQuotedText(`[Page ${pageNum}] "${text}"`);
  };

  const executeChatRequest = async (
    chatHistory: ChatMessage[],
    modelOverride?: GeminiModelId
  ) => {
    setIsChatLoading(true);
    const modelToUse = modelOverride || selectedModel;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: chatHistory,
          documentUri: documentInfo?.fileUri,
          documentMimeType: documentInfo?.mimeType,
          model: modelToUse,
          autoFallback,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMsg =
          data.error ||
          "Sorry, I encountered an error answering your question. Please try switching models.";
        setMessages([
          ...chatHistory,
          {
            role: "model",
            content: errorMsg,
            isError: true,
            originalModel: modelToUse,
          },
        ]);
        return;
      }

      setMessages([
        ...chatHistory,
        {
          role: "model",
          content: data.text,
          modelUsed: data.usedModel,
          fellBack: data.fellBack,
          originalModel: data.originalModel,
        },
      ]);
    } catch (error: any) {
      console.error(error);
      setMessages([
        ...chatHistory,
        {
          role: "model",
          content: error.message || "Failed to communicate with the server.",
          isError: true,
          originalModel: modelToUse,
        },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleSendMessage = async (content: string, figureBase64?: string) => {
    const newUserMsg: ChatMessage = { role: "user", content, figureBase64 };
    const newMessages = [...messages, newUserMsg];
    setMessages(newMessages);
    setSelectedFigure(null);
    await executeChatRequest(newMessages);
  };

  const handleRetryWithModel = async (targetModel?: GeminiModelId) => {
    const lastUserIndex = messages.map((m) => m.role).lastIndexOf("user");
    if (lastUserIndex === -1) return;

    if (targetModel) {
      setSelectedModel(targetModel);
    }

    const trimmedHistory = messages.slice(0, lastUserIndex + 1);
    setMessages(trimmedHistory);
    await executeChatRequest(trimmedHistory, targetModel || selectedModel);
  };

  return (
    <div className="flex h-screen w-full bg-slate-100 overflow-hidden font-sans">
      <div className="w-1/3 min-w-[420px] max-w-[540px] h-full shadow-xl z-10 flex flex-col relative border-r border-slate-200">
        <Chat 
          messages={messages} 
          onSendMessage={handleSendMessage} 
          isLoading={isChatLoading} 
          selectedFigure={selectedFigure}
          onClearFigure={() => setSelectedFigure(null)}
          onNavigateToPage={handleNavigateToPage}
          documentName={fileName}
          quotedText={quotedText}
          onClearQuotedText={() => setQuotedText(null)}
          selectedModel={selectedModel}
          onSelectModel={setSelectedModel}
          autoFallback={autoFallback}
          onToggleAutoFallback={setAutoFallback}
          onRetryWithModel={handleRetryWithModel}
        />
      </div>
      <div className="flex-1 h-full relative">
        <PdfViewer 
          onFileLoaded={handleFileLoaded} 
          onSelectionMade={(base64, pageNum) => {
            setSelectedFigure(base64);
          }}
          onQuoteText={handleQuoteText}
          isLoadingFile={isLoadingFile}
          targetPage={targetPage}
          onTargetPageHandled={() => setTargetPage(null)}
          fileName={fileName}
        />
      </div>
    </div>
  );
}
