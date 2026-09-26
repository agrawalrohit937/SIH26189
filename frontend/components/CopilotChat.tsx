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
  Copy,
  Check,
  Expand,
  Shrink,
  ShieldAlert,
  ChevronRight
} from "lucide-react";
import { MarkdownContent } from "./MarkdownContent";

interface ChatMessage {
  id: string;
  sender: "ai" | "user";
  text: string;
  timestamp: string;
}

const SAMPLE_QUESTIONS = [
  "Show all entities connected to Rohit Verma",
  "What accounts are connected to this person?",
  "Which relationships are predicted rather than verified?",
  "Show transactions associated with ACC-1001",
  "What evidence supports this relationship?",
  "Show the geographic spread of this network",
];

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const CopilotChat: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputMessage, setInputMessage] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "msg-welcome",
      sender: "ai",
      text: "**National Crime Intelligence Copilot Online**\n\nI am grounded in your active **Neo4j Knowledge Graph**, **FIR Case Dossiers**, and **Financial / Telecom Records**.\n\nYou can query suspect alias linkages, syndicate modularity, cross-cluster bridge links, or money trails.",
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
        text: `### [SYSTEM NOTICE: MHA Copilot Offline]\n\n${errorMsg}\n\n*Please ensure the FastAPI backend is running and GROQ_API_KEY is configured in backend environment variables.*`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, errorAiMsg]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Briefing copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
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
        text: "### Briefing Session Reset\n\nInvestigative history cleared. Ready for new queries.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-none font-sans">
      {/* Floating Chat Window */}
      {isOpen && (
        <div
          className={`pointer-events-auto mb-3 rounded-2xl bg-white border border-slate-300 shadow-2xl flex flex-col transition-all duration-300 overflow-hidden ${
            isMinimized
              ? "h-[56px] w-[340px]"
              : isExpanded
              ? "h-[640px] w-[95vw] sm:w-[680px] max-w-[720px]"
              : "h-[540px] w-[95vw] sm:w-[480px] max-w-[500px]"
          }`}
        >
          {/* Clean Light Window Header */}
          <div className="flex items-center justify-between px-4 py-3.5 bg-white text-slate-900 border-b border-slate-100 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-900 shadow-xs shrink-0">
                <Bot className="w-4 h-4 text-blue-800" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-slate-900 tracking-tight">
                    AI Investigator Copilot
                  </h3>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <p className="text-[10px] text-slate-500 font-medium">National Crime Intelligence Assistant (MHA)</p>
              </div>
            </div>

            <div className="flex items-center gap-1 text-slate-400">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                title={isExpanded ? "Standard Width" : "Expand Table View"}
              >
                {isExpanded ? <Shrink className="w-3.5 h-3.5 text-blue-700" /> : <Expand className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={handleClearHistory}
                className="p-1.5 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                title="Clear Chat History"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1.5 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                title={isMinimized ? "Expand" : "Minimize"}
              >
                {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer ml-0.5"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Chat Body */}
          {!isMinimized && (
            <>
              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs bg-[#F8FAFC]">
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
                          <div className="w-7 h-7 rounded-xl bg-[#0A2540] border border-blue-900/50 flex items-center justify-center text-amber-300 shrink-0 mt-0.5 shadow-xs">
                            <Bot className="w-4 h-4" />
                          </div>
                        )}

                        <div
                          className={`rounded-2xl p-3.5 shadow-xs transition-all ${
                            isAi
                              ? "bg-white border border-slate-200/90 text-slate-800 rounded-tl-xs w-full max-w-[92%]"
                              : "bg-blue-600 border border-blue-700 text-white font-medium rounded-tr-xs max-w-[85%]"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 text-[10px] mb-1.5 opacity-80 font-bold border-b border-slate-100 pb-1">
                            <span className={isAi ? "text-blue-900 flex items-center gap-1" : "text-blue-100"}>
                              {isAi ? (
                                <>
                                  <Sparkles className="w-3 h-3 text-amber-500" />
                                  AI COPILOT VERIFIED REPORT
                                </>
                              ) : (
                                "INVESTIGATING OFFICER"
                              )}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span suppressHydrationWarning className="font-mono text-[9.5px] font-normal opacity-75">
                                {msg.timestamp}
                              </span>
                              {isAi && (
                                <button
                                  onClick={() => handleCopyMessage(msg.id, msg.text)}
                                  className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                                  title="Copy Report Markdown"
                                >
                                  {copiedId === msg.id ? (
                                    <Check className="w-3 h-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>

                          {isAi ? (
                            <MarkdownContent content={msg.text} isAi={true} />
                          ) : (
                            <p className="leading-relaxed text-[11.5px] whitespace-pre-wrap">{msg.text}</p>
                          )}
                        </div>

                        {!isAi && (
                          <div className="w-7 h-7 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 shrink-0 mt-0.5 shadow-xs">
                            <User className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                    );
                  })}

                {/* Live Analyzing Indicator */}
                {isThinking && (
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-xl bg-[#0A2540] border border-blue-900/50 flex items-center justify-center text-amber-300 shrink-0 mt-0.5 shadow-xs">
                      <Sparkles className="w-4 h-4 animate-spin" />
                    </div>
                    <div className="rounded-2xl p-3 bg-white border border-slate-200 text-slate-700 flex items-center gap-2.5 shadow-xs rounded-tl-xs">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      <div className="text-[11px]">
                        <span className="font-extrabold text-slate-800">Synthesizing Verified Investigation Dossier...</span>
                        <span className="block text-[9.5px] text-slate-400 font-medium">Querying Neo4j Graph + Ingested FIR Paraphrases</span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick Inquiry Chips */}
              <div className="px-3 py-2 border-t border-slate-200 bg-white overflow-x-auto flex items-center gap-1.5 text-[10.5px]">
                <span className="text-slate-500 shrink-0 flex items-center gap-0.5 font-extrabold">
                  <Zap className="w-3 h-3 text-amber-500" />
                  Quick:
                </span>
                {SAMPLE_QUESTIONS.map((chip, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendMessage(chip)}
                    disabled={isThinking}
                    className="shrink-0 px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-slate-700 hover:text-blue-700 font-semibold transition-colors cursor-pointer disabled:opacity-40"
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
                  className="flex-1 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 outline-none transition-all disabled:opacity-60 font-medium"
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={!inputMessage.trim() || isThinking}
                  className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:opacity-40 disabled:pointer-events-none text-white font-bold transition-all cursor-pointer shadow-xs shrink-0"
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
