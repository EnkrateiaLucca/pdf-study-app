import React, { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { TextLayer } from "pdfjs-dist";

interface PdfPageProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  pageNum: number;
  scale: number;
  isSelectionActive: boolean;
  isHighlighted: boolean;
  onFigureCropped: (base64Image: string, pageNum: number) => void;
  onTextSelected?: (selectedText: string, pageNum: number) => void;
}

export default function PdfPage({
  pdfDoc,
  pageNum,
  scale,
  isSelectionActive,
  isHighlighted,
  onFigureCropped,
  onTextSelected,
}: PdfPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);

  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number }>({
    width: 600,
    height: 800,
  });
  const [isRendered, setIsRendered] = useState(false);

  // Selection rectangle state for figure cropping
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [endPoint, setEndPoint] = useState<{ x: number; y: number } | null>(null);

  // Render Page Canvas & TextLayer
  useEffect(() => {
    let isCancelled = false;
    let renderTask: any = null;

    const render = async () => {
      try {
        const page = await pdfDoc.getPage(pageNum);
        if (isCancelled) return;

        const viewport = page.getViewport({ scale });
        setPageDimensions({ width: viewport.width, height: viewport.height });

        const canvas = canvasRef.current;
        const textLayerDiv = textLayerRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
        ctx.scale(dpr, dpr);

        renderTask = page.render({
          canvas: canvas,
          canvasContext: ctx,
          viewport: viewport,
        });

        await renderTask.promise;
        if (isCancelled) return;

        // Render TextLayer for real selectable text
        if (textLayerDiv) {
          textLayerDiv.innerHTML = "";
          textLayerDiv.style.width = `${Math.floor(viewport.width)}px`;
          textLayerDiv.style.height = `${Math.floor(viewport.height)}px`;
          textLayerDiv.style.setProperty("--scale-factor", `${scale}`);
          textLayerDiv.style.setProperty("--total-scale-factor", `${scale}`);

          const textContent = await page.getTextContent();
          if (isCancelled) return;

          const textLayer = new TextLayer({
            textContentSource: textContent,
            container: textLayerDiv,
            viewport: viewport,
          });

          await textLayer.render();
        }

        setIsRendered(true);
      } catch (err: any) {
        if (err?.name !== "RenderingCancelledException") {
          console.error(`Error rendering page ${pageNum}:`, err);
        }
      }
    };

    render();

    return () => {
      isCancelled = true;
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdfDoc, pageNum, scale]);

  // Handle text selection detection
  const handleMouseUpText = () => {
    if (isSelectionActive) return;
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      const text = selection.toString().trim();
      if (onTextSelected) {
        onTextSelected(text, pageNum);
      }
    }
  };

  // Figure crop drawing logic
  const getContainerCoords = (e: React.MouseEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(e.clientX - rect.left, rect.width)),
      y: Math.max(0, Math.min(e.clientY - rect.top, rect.height)),
    };
  };

  const handleMouseDownCrop = (e: React.MouseEvent) => {
    if (!isSelectionActive) return;
    e.preventDefault();
    const coords = getContainerCoords(e);
    setIsDrawing(true);
    setStartPoint(coords);
    setEndPoint(coords);
  };

  const handleMouseMoveCrop = (e: React.MouseEvent) => {
    if (!isDrawing || !isSelectionActive) return;
    setEndPoint(getContainerCoords(e));
  };

  const handleMouseUpCrop = () => {
    if (!isDrawing || !isSelectionActive || !startPoint || !endPoint || !canvasRef.current) {
      setIsDrawing(false);
      return;
    }

    setIsDrawing(false);

    const x = Math.min(startPoint.x, endPoint.x);
    const y = Math.min(startPoint.y, endPoint.y);
    const width = Math.abs(startPoint.x - endPoint.x);
    const height = Math.abs(startPoint.y - endPoint.y);

    if (width < 10 || height < 10) {
      setStartPoint(null);
      setEndPoint(null);
      return;
    }

    // Crop from high-res canvas
    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = width * dpr;
    cropCanvas.height = height * dpr;
    const cropCtx = cropCanvas.getContext("2d");

    if (cropCtx) {
      cropCtx.drawImage(
        canvas,
        x * dpr,
        y * dpr,
        width * dpr,
        height * dpr,
        0,
        0,
        width * dpr,
        height * dpr
      );

      const base64 = cropCanvas.toDataURL("image/png");
      onFigureCropped(base64, pageNum);
    }

    setStartPoint(null);
    setEndPoint(null);
  };

  // Crop overlay box
  const cropBox =
    startPoint && endPoint
      ? {
          x: Math.min(startPoint.x, endPoint.x),
          y: Math.min(startPoint.y, endPoint.y),
          width: Math.abs(startPoint.x - endPoint.x),
          height: Math.abs(startPoint.y - endPoint.y),
        }
      : null;

  return (
    <div
      id={`pdf-page-${pageNum}`}
      ref={containerRef}
      onMouseUp={handleMouseUpText}
      onMouseDown={isSelectionActive ? handleMouseDownCrop : undefined}
      onMouseMove={isSelectionActive ? handleMouseMoveCrop : undefined}
      className={`relative mx-auto my-4 bg-white rounded-md transition-all duration-300 select-text ${
        isHighlighted
          ? "ring-4 ring-blue-500 shadow-2xl scale-[1.01]"
          : "shadow-md hover:shadow-lg border border-slate-200"
      } ${isSelectionActive ? "cursor-crosshair select-none" : "cursor-default"}`}
      style={{
        width: `${pageDimensions.width}px`,
        height: `${pageDimensions.height}px`,
      }}
    >
      {/* Canvas Layer */}
      <canvas
        ref={canvasRef}
        className="block rounded-md pointer-events-none"
        style={{
          width: `${pageDimensions.width}px`,
          height: `${pageDimensions.height}px`,
        }}
      />

      {/* Selectable Text Layer */}
      <div
        ref={textLayerRef}
        className={`textLayer absolute inset-0 ${isSelectionActive ? "pointer-events-none opacity-0" : "pointer-events-auto"}`}
        style={{
          width: `${pageDimensions.width}px`,
          height: `${pageDimensions.height}px`,
        }}
      />

      {/* Figure Crop Drag Overlay */}
      {isSelectionActive && (
        <div
          className="absolute inset-0 z-30"
          onMouseUp={handleMouseUpCrop}
          onMouseLeave={handleMouseUpCrop}
        >
          {cropBox && (
            <div
              className="absolute border-2 border-amber-500 bg-amber-500/20 pointer-events-none rounded-xs shadow-xs"
              style={{
                left: `${cropBox.x}px`,
                top: `${cropBox.y}px`,
                width: `${cropBox.width}px`,
                height: `${cropBox.height}px`,
              }}
            >
              <span className="absolute -top-6 left-0 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase bg-amber-500 text-white rounded shadow">
                Figure from Page {pageNum}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Page Number Label in corner */}
      <div className="absolute -bottom-3 right-3 px-2 py-0.5 bg-slate-800/85 backdrop-blur-xs text-white text-[10px] font-medium tracking-wide rounded-full shadow pointer-events-none z-20">
        Page {pageNum}
      </div>
    </div>
  );
}
