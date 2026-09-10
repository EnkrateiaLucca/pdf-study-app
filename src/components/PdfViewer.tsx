import React, { useEffect, useRef, useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import {
  ChevronLeft,
  ChevronRight,
  Upload,
  ZoomIn,
  ZoomOut,
  Crop,
  Layers,
  FileText,
  Sparkles,
  Check,
  Maximize2,
  MousePointer,
  RotateCcw,
} from "lucide-react";
import PdfPage from "./PdfPage";

// Set worker url
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

interface PdfViewerProps {
  onFileLoaded: (file: File) => void;
  onSelectionMade: (base64Image: string, pageNum: number) => void;
  onQuoteText?: (text: string, pageNum: number) => void;
  isLoadingFile: boolean;
  targetPage?: number | null;
  onTargetPageHandled?: () => void;
  fileName?: string;
}

export default function PdfViewer({
  onFileLoaded,
  onSelectionMade,
  onQuoteText,
  isLoadingFile,
  targetPage,
  onTargetPageHandled,
  fileName,
}: PdfViewerProps) {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [viewMode, setViewMode] = useState<"continuous" | "single">("continuous");
  const [isSelectionActive, setIsSelectionActive] = useState(false);
  const [highlightedPage, setHighlightedPage] = useState<number | null>(null);
  
  // Floating text selection bar state
  const [floatingText, setFloatingText] = useState<{ text: string; pageNum: number; x: number; y: number } | null>(null);
  const [copiedText, setCopiedText] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Load PDF from File
  const loadPdf = async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) } as any);
      const pdf = await loadingTask.promise;
      setPdfDoc(pdf);
      setPageCount(pdf.numPages);
      setCurrentPage(1);
      setIsSelectionActive(false);
      setHighlightedPage(null);
    } catch (err) {
      console.error("Error loading PDF:", err);
      alert("Failed to render PDF document.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      onFileLoaded(file);
      loadPdf(file);
    }
  };

  // Navigate to Target Page from Chat Citations
  useEffect(() => {
    if (targetPage && targetPage >= 1 && targetPage <= pageCount) {
      setCurrentPage(targetPage);
      setHighlightedPage(targetPage);

      // Scroll smoothly to target page element
      const element = document.getElementById(`pdf-page-${targetPage}`);
      if (element && containerRef.current) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      // Auto-clear highlight after 3 seconds
      const timer = setTimeout(() => {
        setHighlightedPage(null);
      }, 3000);

      if (onTargetPageHandled) {
        onTargetPageHandled();
      }

      return () => clearTimeout(timer);
    }
  }, [targetPage, pageCount, onTargetPageHandled]);

  // Track current page during scrolling in continuous mode
  const handleScroll = useCallback(() => {
    if (viewMode !== "continuous" || !containerRef.current || pageCount === 0) return;

    const containerTop = containerRef.current.scrollTop;
    const containerMid = containerTop + containerRef.current.clientHeight / 3;

    for (let i = 1; i <= pageCount; i++) {
      const el = document.getElementById(`pdf-page-${i}`);
      if (el) {
        const offsetTop = el.offsetTop - containerRef.current.offsetTop;
        const offsetBottom = offsetTop + el.clientHeight;
        if (containerMid >= offsetTop && containerMid <= offsetBottom) {
          setCurrentPage(i);
          break;
        }
      }
    }
  }, [viewMode, pageCount]);

  // Handle Figure crop selection
  const handleFigureCropped = (base64: string, pageNum: number) => {
    onSelectionMade(base64, pageNum);
    setIsSelectionActive(false);
  };

  // Handle Text Selection
  const handleTextSelected = (text: string, pageNum: number) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();

    if (containerRect) {
      setFloatingText({
        text,
        pageNum,
        x: Math.max(10, rect.left - containerRect.left + rect.width / 2 - 100),
        y: Math.max(10, rect.top - containerRect.top - 45),
      });
    }
  };

  // Dismiss floating selection on click outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (!window.getSelection()?.toString()) {
        setFloatingText(null);
      }
    };
    document.addEventListener("selectionchange", handleClickOutside);
    return () => document.removeEventListener("selectionchange", handleClickOutside);
  }, []);

  const handleAskAboutText = () => {
    if (floatingText && onQuoteText) {
      onQuoteText(floatingText.text, floatingText.pageNum);
      setFloatingText(null);
      window.getSelection()?.removeAllRanges();
    }
  };

  const handleCopyText = () => {
    if (floatingText) {
      navigator.clipboard.writeText(floatingText.text);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    }
  };

  const jumpToPage = (page: number) => {
    const safePage = Math.max(1, Math.min(pageCount, page));
    setCurrentPage(safePage);
    const el = document.getElementById(`pdf-page-${safePage}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-100/80 border-l border-slate-200 select-none">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-white border-b border-slate-200 shadow-2xs z-20">
        {/* Left: Upload or Document info */}
        <div className="flex items-center gap-2">
          {!pdfDoc ? (
            <label className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer transition-colors shadow-sm text-sm font-medium">
              <Upload className="w-4 h-4 mr-2" />
              {isLoadingFile ? "Uploading to AI..." : "Upload PDF to Study"}
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleFileChange}
                disabled={isLoadingFile}
              />
            </label>
          ) : (
            <div className="flex items-center gap-2">
              <label
                className="flex items-center px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer transition-colors"
                title="Upload different PDF"
              >
                <Upload className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                Change
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={isLoadingFile}
                />
              </label>
              {fileName && (
                <span className="text-xs font-medium text-slate-600 truncate max-w-[160px] flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  {fileName}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Center: Pagination & Jump */}
        {pdfDoc && (
          <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
            <button
              onClick={() => jumpToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="p-1 rounded hover:bg-white text-slate-600 disabled:opacity-30 transition-colors"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1 text-xs font-medium text-slate-700 px-1">
              <span>Page</span>
              <input
                type="number"
                min={1}
                max={pageCount}
                value={currentPage}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val)) jumpToPage(val);
                }}
                className="w-10 text-center py-0.5 px-1 bg-white border border-slate-300 rounded font-semibold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-slate-400">/ {pageCount}</span>
            </div>
            <button
              onClick={() => jumpToPage(currentPage + 1)}
              disabled={currentPage >= pageCount}
              className="p-1 rounded hover:bg-white text-slate-600 disabled:opacity-30 transition-colors"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Right: Zoom, View Modes & Figure Selection Tool */}
        {pdfDoc && (
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
              <button
                onClick={() => setViewMode("continuous")}
                className={`px-2 py-1 rounded-md transition-all font-medium flex items-center gap-1 ${
                  viewMode === "continuous"
                    ? "bg-white text-slate-800 shadow-2xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Continuous Document Scroll"
              >
                <Layers className="w-3.5 h-3.5" />
                Scroll
              </button>
              <button
                onClick={() => setViewMode("single")}
                className={`px-2 py-1 rounded-md transition-all font-medium flex items-center gap-1 ${
                  viewMode === "single"
                    ? "bg-white text-slate-800 shadow-2xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Single Page View"
              >
                <FileText className="w-3.5 h-3.5" />
                Page
              </button>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-slate-100 px-1 py-0.5 rounded-lg border border-slate-200">
              <button
                onClick={() => setScale((s) => Math.max(0.6, s - 0.15))}
                className="p-1 rounded hover:bg-white text-slate-600 transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-mono text-slate-600 w-9 text-center font-medium">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={() => setScale((s) => Math.min(2.5, s + 0.15))}
                className="p-1 rounded hover:bg-white text-slate-600 transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setScale(1.15)}
                className="p-1 rounded hover:bg-white text-slate-500 hover:text-slate-700 transition-colors"
                title="Reset Zoom"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>

            {/* Figure Selection Action */}
            <button
              onClick={() => setIsSelectionActive(!isSelectionActive)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all shadow-xs cursor-pointer ${
                isSelectionActive
                  ? "bg-amber-500 text-white hover:bg-amber-600 ring-2 ring-amber-300 animate-pulse"
                  : "bg-slate-800 hover:bg-slate-700 text-white"
              }`}
              title={isSelectionActive ? "Click to cancel selection mode" : "Select & crop a figure from the document"}
            >
              <Crop className="w-3.5 h-3.5" />
              {isSelectionActive ? "Cancel Crop" : "Select Figure"}
            </button>
          </div>
        )}
      </div>

      {/* Mode Instruction Banner */}
      {isSelectionActive && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-xs text-amber-800 z-10 shadow-xs animate-fadeIn">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600 animate-spin" />
            <span>
              <strong>Figure Selection Active:</strong> Click and drag a box around any diagram, chart, or section on the document.
            </span>
          </div>
          <button
            onClick={() => setIsSelectionActive(false)}
            className="text-amber-700 underline font-medium hover:text-amber-900"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Main Document Viewer Container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto p-6 bg-slate-200/60 relative scroll-smooth flex justify-center"
      >
        {/* Floating Text Selection Bar */}
        {floatingText && (
          <div
            className="absolute z-50 bg-slate-900 text-white rounded-lg shadow-xl px-3 py-1.5 flex items-center gap-2 text-xs border border-slate-700 animate-fadeIn"
            style={{
              left: `${floatingText.x}px`,
              top: `${floatingText.y}px`,
            }}
          >
            <span className="text-slate-300 truncate max-w-[150px] italic">
              "{floatingText.text.slice(0, 30)}..."
            </span>
            <div className="h-3 w-px bg-slate-700" />
            <button
              onClick={handleAskAboutText}
              className="flex items-center gap-1 text-blue-300 hover:text-white font-medium hover:underline cursor-pointer"
            >
              <Sparkles className="w-3 h-3 text-blue-400" />
              Ask AI
            </button>
            <button
              onClick={handleCopyText}
              className="flex items-center gap-1 text-slate-300 hover:text-white cursor-pointer ml-1"
            >
              {copiedText ? <Check className="w-3 h-3 text-emerald-400" /> : <MousePointer className="w-3 h-3" />}
              {copiedText ? "Copied" : "Copy"}
            </button>
          </div>
        )}

        {pdfDoc ? (
          <div className="flex flex-col items-center gap-6 pb-16">
            {viewMode === "continuous" ? (
              // Continuous multi-page scroll flow
              Array.from({ length: pageCount }, (_, i) => i + 1).map((pageNum) => (
                <PdfPage
                  key={pageNum}
                  pdfDoc={pdfDoc}
                  pageNum={pageNum}
                  scale={scale}
                  isSelectionActive={isSelectionActive}
                  isHighlighted={highlightedPage === pageNum}
                  onFigureCropped={handleFigureCropped}
                  onTextSelected={handleTextSelected}
                />
              ))
            ) : (
              // Single page mode
              <PdfPage
                key={currentPage}
                pdfDoc={pdfDoc}
                pageNum={currentPage}
                scale={scale}
                isSelectionActive={isSelectionActive}
                isHighlighted={highlightedPage === currentPage}
                onFigureCropped={handleFigureCropped}
                onTextSelected={handleTextSelected}
              />
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center max-w-sm mx-auto p-6 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-white shadow-sm border border-slate-200 flex items-center justify-center text-blue-600">
              <FileText className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-700 mb-1">
                Ready to Study Your PDF
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Upload any paper, textbook chapter, or article. You'll be able to read with selectable text, select figures to ask questions, and click citations to jump between pages.
              </p>
            </div>
            <label className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer transition-colors shadow-sm text-sm font-medium">
              <Upload className="w-4 h-4 mr-2" />
              Upload PDF
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleFileChange}
                disabled={isLoadingFile}
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
