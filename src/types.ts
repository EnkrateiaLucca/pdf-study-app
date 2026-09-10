export type GeminiModelId =
  | "gemini-3.5-flash-lite"
  | "gemini-3.8-flash"
  | "gemini-3.6-flash"
  | "gemini-3.5-flash"
  | "gemini-flash-lite-latest";

export interface ModelOption {
  id: GeminiModelId;
  name: string;
  tag: string;
  badgeColor: string;
  description: string;
  isRecommended?: boolean;
}

export interface ChatMessage {
  id?: string;
  role: "user" | "model";
  content: string;
  figureBase64?: string; // Optional image data for user messages
  figurePage?: number;
  citedPages?: number[]; // Extracted page references for model messages
  modelUsed?: GeminiModelId;
  fellBack?: boolean;
  originalModel?: GeminiModelId;
  isError?: boolean;
  timestamp?: number;
}

export interface DocumentInfo {
  fileUri: string;
  mimeType: string;
  fileName?: string;
  pageCount?: number;
}

