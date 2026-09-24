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
  MessageSquareCode,
  ShieldCheck
} from "lucide-react";

interface ChatMessage {
  id: string;
  sender: "ai" | "user";
  text: string;
  timestamp: string;
}

const SAMPLE_QUESTIONS = [
  "Summarize Vikram's syndicate role",
  "Explain ₹49,500 smurfing pattern",
  "List linked bank accounts and mules",
  "What is the total evaded amount?",
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
      text: "MHA Crime Intelligence System Active. You can query case entities, CDR telecom records, money mule networks, or bank structuring evasion patterns.",
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
      inputRef.current?.focus();
    }
  }, [isOpen, isMinimized, messages, isThinking]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isThinking) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: "user",
      text,
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
        text: "Briefing history cleared. Ready for investigative queries.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end pointer-events-none">
      {/* Floating Chat Window - Anchored above the FAB */}
      {isOpen && (
        <div
          className={`pointer-events-auto mb-3 w-[360px] sm:w-[420px] rounded-xl bg-slate-900 border border-slate-700 shadow-2xl flex flex-col transition-all duration-300 overflow-hidden ${
            isMinimized ? "h-[54px]" : "h-[530px]"
          }`}
        >
          {/* Window Header */}
          <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#080e1b] border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wide">
                    MHA Intelligence Copilot
                  </h3>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                </div>
                <p className="text-[10px] text-slate-400">Official Crime &amp; Structuring Analyst AI</p>
              </div>
            </div>

            <div className="flex items-center gap-0.5 text-slate-400">
              <button
                onClick={handleClearHistory}
                className="p-1 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                title="Clear Chat"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                title={isMinimized ? "Expand" : "Minimize"}
              >
                {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors cursor-pointer"
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
              <div className="flex-1 overflow-y-auto p-3.5 space-y-3 text-xs bg-[#080d1a]">
                {mounted &&
                  messages.map((msg) => {
                    const isAi = msg.sender === "ai";
                    return (
                      <div
                        key={msg.id}
                        className={`flex items-start gap-2 ${
                          isAi ? "justify-start" : "justify-end"
                        }`}
                      >
                        {isAi && (
                          <div className="w-6 h-6 rounded bg-blue-950 border border-blue-800/80 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
                            <Bot className="w-3 h-3" />
                          </div>
                        )}

                        <div
                          className={`max-w-[85%] rounded-lg p-2.5 shadow-sm ${
                            isAi
                              ? "bg-[#0f172a] border border-slate-800 text-slate-200"
                              : "bg-blue-600/90 border border-blue-500/80 text-white"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 text-[10px] mb-1 opacity-70">
                            <span className="font-semibold">{isAi ? "MHA COPILOT" : "INVESTIGATING OFFICER"}</span>
                            <span suppressHydrationWarning className="font-mono text-[9px]">{msg.timestamp}</span>
                          </div>
                          <p className="leading-relaxed text-[11px] whitespace-pre-wrap">{msg.text}</p>
                        </div>

                        {!isAi && (
                          <div className="w-6 h-6 rounded bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0 mt-0.5">
                            <User className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                    );
                  })}

                {/* Live Analyzing Indicator */}
                {isThinking && (
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded bg-blue-950 border border-blue-800/80 flex items-center justify-center text-blue-400 shrink-0">
                      <Bot className="w-3 h-3" />
                    </div>
                    <div className="rounded-lg p-2.5 bg-[#0f172a] border border-slate-800 text-slate-300 flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                      <span className="text-[11px]">Querying MHA cyber intelligence...</span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick Inquiry Chips */}
              <div className="px-2.5 py-1.5 border-t border-slate-800 bg-slate-950 overflow-x-auto flex items-center gap-1.5 text-[10px] no-scrollbar">
                <span className="text-slate-400 shrink-0 flex items-center gap-0.5 font-medium">
                  <Zap className="w-3 h-3 text-amber-500" />
                  Query:
                </span>
                {SAMPLE_QUESTIONS.map((chip, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendMessage(chip)}
                    disabled={isThinking}
                    className="shrink-0 px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-40"
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* Input Bar */}
              <div className="p-2.5 bg-[#080e1b] border-t border-slate-800 flex items-center gap-1.5">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Ask about FIR suspects, CDR logs, transactions..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isThinking}
                  className="flex-1 bg-slate-900 border border-slate-700/80 focus:border-blue-500 rounded-md px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 outline-none transition-colors disabled:opacity-60"
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={!inputMessage.trim() || isThinking}
                  className="p-1.5 rounded-md bg-blue-600 hover:bg-blue-500 active:scale-95 disabled:opacity-40 disabled:pointer-events-none text-white font-semibold transition-all cursor-pointer shadow-sm"
                  title="Send (Enter)"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Official Government FAB Button - Pill styled "Ask MHA Copilot" */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`pointer-events-auto relative flex items-center gap-2 px-4 py-2 rounded-full bg-[#0c1427] hover:bg-slate-800 text-slate-100 border border-slate-700/90 shadow-xl hover:border-slate-600 hover:scale-[1.02] active:scale-95 transition-all duration-200 cursor-pointer ${
          isOpen ? "ring-2 ring-blue-500/60 bg-slate-800" : ""
        }`}
        title="Ask MHA Intelligence Copilot"
      >
        <div className="w-5 h-5 rounded-full bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
          <Bot className="w-3.5 h-3.5" />
        </div>
        <span className="text-xs font-semibold tracking-wide text-slate-100">
          Ask MHA Copilot
        </span>
        {!isOpen && (
          <span className="relative flex h-2 w-2 ml-0.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
        )}
      </button>
    </div>
  );
};
