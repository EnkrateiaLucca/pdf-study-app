import { ModelOption } from "../types";

export const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: "gemini-3.5-flash-lite",
    name: "Gemini 3.5 Flash Lite",
    tag: "High Availability",
    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    description: "Fastest response time & highest reliability. Best for bypassing peak demand spikes.",
    isRecommended: true,
  },
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    tag: "Latest Model",
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
    description: "Most capable Flash version. May occasionally experience high demand spikes.",
  },
  {
    id: "gemini-3.6-flash",
    name: "Gemini 3.6 Flash",
    tag: "Stable Flash",
    badgeColor: "bg-violet-50 text-violet-700 border-violet-200",
    description: "Proven high-throughput model with sharp document reasoning.",
  },
  {
    id: "gemini-3.5-flash",
    name: "Gemini 3.5 Flash",
    tag: "Balanced",
    badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
    description: "Reliable multimodal Flash for general questions and diagrams.",
  },
  {
    id: "gemini-flash-lite-latest",
    name: "Gemini Flash Lite Latest",
    tag: "Ultra Fast",
    badgeColor: "bg-teal-50 text-teal-700 border-teal-200",
    description: "Instantaneous responses for fast iterative reading.",
  },
];

export const DEFAULT_MODEL_ID = "gemini-3.5-flash-lite";
