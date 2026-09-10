import React, { useState, useRef, useEffect } from "react";
import {
  ChevronDown,
  Cpu,
  Sparkles,
  Zap,
  ShieldCheck,
  Check,
  AlertTriangle,
  Info,
} from "lucide-react";
import { GeminiModelId, ModelOption } from "../types";
import { AVAILABLE_MODELS } from "../constants/models";
import { motion, AnimatePresence } from "motion/react";

interface ModelSelectorProps {
  selectedModel: GeminiModelId;
  onSelectModel: (model: GeminiModelId) => void;
  autoFallback: boolean;
  onToggleAutoFallback: (enabled: boolean) => void;
  disabled?: boolean;
}

export default function ModelSelector({
  selectedModel,
  onSelectModel,
  autoFallback,
  onToggleAutoFallback,
  disabled = false,
}: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentModel =
    AVAILABLE_MODELS.find((m) => m.id === selectedModel) || AVAILABLE_MODELS[0];

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Selected Model Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50/80 hover:bg-slate-100/80 text-xs font-medium text-slate-700 transition-all hover:border-slate-300 disabled:opacity-50 cursor-pointer shadow-2xs"
        title="Change Gemini AI model to bypass busy traffic"
      >
        <div className="flex items-center gap-1.5">
          <Cpu className="w-3.5 h-3.5 text-blue-600" />
          <span className="font-semibold text-slate-800">{currentModel.name}</span>
          <span
            className={`px-1.5 py-0.2 text-[10px] font-medium rounded border ${currentModel.badgeColor}`}
          >
            {currentModel.tag}
          </span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full mt-1.5 w-84 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden"
          >
            <div className="p-3 bg-slate-50 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" /> Choose Gemini Model
                </span>
                <span className="text-[10px] text-slate-500 font-medium">Bypass 503 Demand</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                If a model experiences high demand or temporary 503 errors, switch to
                <strong className="text-emerald-700 font-semibold"> Gemini 3.5 Flash Lite </strong>
                for uninterrupted throughput.
              </p>
            </div>

            <div className="p-1.5 max-h-72 overflow-y-auto space-y-1">
              {AVAILABLE_MODELS.map((model) => {
                const isSelected = model.id === selectedModel;
                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => {
                      onSelectModel(model.id);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left p-2 rounded-lg transition-all flex items-start justify-between gap-2 cursor-pointer ${
                      isSelected
                        ? "bg-blue-50/70 border border-blue-200/80"
                        : "hover:bg-slate-50 border border-transparent"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-xs font-semibold ${
                            isSelected ? "text-blue-900" : "text-slate-800"
                          }`}
                        >
                          {model.name}
                        </span>
                        <span
                          className={`px-1.5 py-0.2 text-[10px] font-medium rounded border ${model.badgeColor}`}
                        >
                          {model.tag}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                        {model.description}
                      </p>
                    </div>

                    {isSelected && (
                      <Check className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Auto-Fallback toggle */}
            <div className="p-2.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <div className="text-[11px] font-semibold text-slate-700">
                    Auto-bypass 503 spikes
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Falls back to Flash Lite if busy
                  </div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoFallback}
                  onChange={(e) => onToggleAutoFallback(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
