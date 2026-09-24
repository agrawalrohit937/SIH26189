"use client";

import React from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";

export interface ToastMessage {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
  timestamp: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none">
      {toasts.map((toast) => {
        const isSuccess = toast.type === "success";
        const isError = toast.type === "error";
        const isWarning = toast.type === "warning";

        const borderClass = isSuccess
          ? "border-emerald-500/40 bg-emerald-950/80 text-emerald-200"
          : isError
          ? "border-rose-500/40 bg-rose-950/80 text-rose-200"
          : isWarning
          ? "border-amber-500/40 bg-amber-950/80 text-amber-200"
          : "border-cyan-500/40 bg-cyan-950/80 text-cyan-200";

        const icon = isSuccess ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        ) : isError ? (
          <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
        ) : isWarning ? (
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        ) : (
          <Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
        );

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border backdrop-blur-md shadow-2xl transition-all duration-300 animate-in slide-in-from-bottom-3 ${borderClass}`}
          >
            {icon}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-semibold text-sm text-white tracking-wide">
                  {toast.title}
                </h4>
                <span className="text-[10px] text-slate-400">{toast.timestamp}</span>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed break-words">
                {toast.message}
              </p>
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="text-slate-400 hover:text-white transition-colors p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
