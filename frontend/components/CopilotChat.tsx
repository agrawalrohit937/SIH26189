"use client";

import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  Bot,
  Send,
  X,
  Minimize2,
  Maximize2,
  Trash2,
  Loader2,
  User,
  Zap,
  Sparkles,
  MessageSquare,
  ShieldAlert,
  ChevronRight
} from "lucide-react";

interface ChatMessage {
  id: string;
  sender: "ai" | "user";
  text: string;
  timestamp: string;
}

const SAMPLE_QUESTIONS = [
  "Summarize key suspect entities & roles",
  "Explain detected smurfing evasion patterns",
  "List linked bank accounts and money mules",
  "Show high-frequency telecom call connections",
];

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const CopilotChat: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [inputMessage, setInputMessage] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [mounted, setMounted] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "msg-welcome",
      sender: "ai",
      text: "National Crime Intelligence Copilot online. You can query case entities, CDR telecom frequencies, bank structuring evasion, or suspect alias resolutions.",
      timestamp: "",
    },
  ]);

  useEffect(() => {
    setMounted(true);
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === "msg-welcome"
          ? { ...msg, timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }
          : msg
      )
    );
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, isMinimized, messages, isThinking]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isThinking) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage("");
    setIsThinking(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/v1/chat`, {
        message: text,
      });

      const replyText =
        response.data?.reply ||
        "Intelligence report received with empty payload. Please verify case parameters.";

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: "ai",
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      console.error("Failed to query Copilot Chat API:", err);
      const errorMsg =
        err.response?.data?.detail ||
        err.message ||
        "Failed to connect to MHA Copilot server.";

      toast.error("Copilot Advisory", {
        description: errorMsg,
      });

      const errorAiMsg: ChatMessage = {
        id: `ai-err-${Date.now()}`,
        sender: "ai",
        text: `[SYSTEM NOTICE: MHA Copilot Offline]\n${errorMsg}\n\nPlease ensure the FastAPI backend is running and GROQ_API_KEY is configured in backend environment variables.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, errorAiMsg]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: `msg-reset-${Date.now()}`,
        sender: "ai",
        text: "Briefing history cleared. Ready for new investigative queries.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-none font-sans">
      {/* Floating Chat Window */}
      {isOpen && (
        <div
          className={`pointer-events-auto mb-3 w-[360px] sm:w-[400px] rounded-2xl bg-white border border-slate-200 shadow-2xl flex flex-col transition-all duration-300 overflow-hidden ${
            isMinimized ? "h-[56px]" : "h-[520px]"
          }`}
        >
          {/* Modern Institutional Window Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#0a2540] via-[#0f3460] to-[#0a2540] text-white border-b border-[#1e3a66]/50">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-white/15 border border-white/25 flex items-center justify-center text-white shadow-inner shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-black uppercase tracking-wide text-white">
                    AI Investigator Co-Pilot
                  </h3>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <p className="text-[10px] text-blue-200 font-medium">National Crime Intelligence Assistant</p>
              </div>
            </div>

            <div className="flex items-center gap-1 text-blue-200">
              <button
                onClick={handleClearHistory}
                className="p-1 hover:text-white hover:bg-white/15 rounded-lg transition-colors cursor-pointer"
                title="Clear Chat History"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1 hover:text-white hover:bg-white/15 rounded-lg transition-colors cursor-pointer"
                title={isMinimized ? "Expand" : "Minimize"}
              >
                {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:text-rose-300 hover:bg-rose-900/40 rounded-lg transition-colors cursor-pointer font-bold"
                title="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Chat Body */}
          {!isMinimized && (
            <>
              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs bg-[#f8fafc]">
                {mounted &&
                  messages.map((msg) => {
                    const isAi = msg.sender === "ai";
                    return (
                      <div
                        key={msg.id}
                        className={`flex items-start gap-2.5 ${
                          isAi ? "justify-start" : "justify-end"
                        }`}
                      >
                        {isAi && (
                          <div className="w-6 h-6 rounded-lg bg-[#0a2540] border border-blue-900/40 flex items-center justify-center text-amber-300 shrink-0 mt-0.5 shadow-2xs">
                            <Bot className="w-3.5 h-3.5" />
                          </div>
                        )}

                        <div
                          className={`max-w-[85%] rounded-2xl p-3 shadow-2xs ${
                            isAi
                              ? "bg-white border border-slate-200/90 text-slate-800 rounded-tl-sm"
                              : "bg-blue-600 border border-blue-700 text-white font-medium rounded-tr-sm"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 text-[10px] mb-1 opacity-75 font-semibold">
                            <span>{isAi ? "AI COPILOT" : "OFFICER"}</span>
                            <span suppressHydrationWarning className="font-mono text-[9px] font-normal">{msg.timestamp}</span>
                          </div>
                          <p className="leading-relaxed text-[11px] whitespace-pre-wrap">{msg.text}</p>
                        </div>

                        {!isAi && (
                          <div className="w-6 h-6 rounded-lg bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 shrink-0 mt-0.5 shadow-2xs">
                            <User className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>
                    );
                  })}

                {/* Live Analyzing Indicator */}
                {isThinking && (
                  <div className="flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded-lg bg-[#0a2540] border border-blue-900/40 flex items-center justify-center text-amber-300 shrink-0 mt-0.5 shadow-2xs">
                      <Sparkles className="w-3.5 h-3.5 animate-spin" />
                    </div>
                    <div className="rounded-2xl p-3 bg-white border border-slate-200 text-slate-700 flex items-center gap-2 shadow-2xs rounded-tl-sm">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                      <span className="text-[11px] font-semibold text-slate-600">
                        Analyzing active case evidence...
                      </span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick Inquiry Chips */}
              <div className="px-3 py-2 border-t border-slate-200 bg-white overflow-x-auto flex items-center gap-1.5 text-[10px]">
                <span className="text-slate-500 shrink-0 flex items-center gap-0.5 font-bold">
                  <Zap className="w-3 h-3 text-amber-500" />
                  Quick:
                </span>
                {SAMPLE_QUESTIONS.map((chip, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendMessage(chip)}
                    disabled={isThinking}
                    className="shrink-0 px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-slate-700 hover:text-blue-700 font-medium transition-colors cursor-pointer disabled:opacity-40"
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* Input Bar */}
              <div className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Ask about FIR suspects, CDR logs, structuring..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isThinking}
                  className="flex-1 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 outline-none transition-all disabled:opacity-60 font-medium"
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={!inputMessage.trim() || isThinking}
                  className="p-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:opacity-40 disabled:pointer-events-none text-white font-bold transition-all cursor-pointer shadow-xs shrink-0"
                  title="Send Query (Enter)"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Modern Compact Floating Widget Button (Standard Website Style) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`pointer-events-auto relative w-12 h-12 rounded-full bg-gradient-to-tr from-[#0a2540] to-[#1e40af] text-white shadow-lg hover:shadow-xl hover:scale-108 active:scale-95 transition-all duration-200 cursor-pointer flex items-center justify-center border border-blue-400/40 group ${
          isOpen ? "ring-3 ring-blue-500/50 bg-[#0a2540]" : ""
        }`}
        title={isOpen ? "Close AI Copilot" : "Open AI Investigator's Co-Pilot"}
      >
        {isOpen ? (
          <X className="w-5 h-5 text-white transition-transform duration-200" />
        ) : (
          <>
            <MessageSquare className="w-5 h-5 text-white group-hover:scale-110 transition-transform duration-200" />
            <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-white" />
            </span>
          </>
        )}
      </button>
    </div>
  );
};
