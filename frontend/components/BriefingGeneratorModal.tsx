"use client";

import React, { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  FileText,
  Sparkles,
  Copy,
  Check,
  Printer,
  X,
  RefreshCw,
  ShieldCheck,
  Download,
  AlertTriangle
} from "lucide-react";
import { MarkdownContent } from "./MarkdownContent";

interface BriefingGeneratorModalProps {
  apiBaseUrl: string;
  isOpen: boolean;
  onClose: () => void;
  defaultEntityName?: string;
}

export const BriefingGeneratorModal: React.FC<BriefingGeneratorModalProps> = ({
  apiBaseUrl,
  isOpen,
  onClose,
  defaultEntityName = "",
}) => {
  const [entityName, setEntityName] = useState<string>(defaultEntityName);
  const [briefingMarkdown, setBriefingMarkdown] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  React.useEffect(() => {
    if (defaultEntityName) {
      setEntityName(defaultEntityName);
    }
  }, [defaultEntityName, isOpen]);

  const generateBriefing = async () => {
    if (!entityName.trim()) {
      toast.error("Enter Subject Name", {
        description: "Please specify a target suspect or entity name for the briefing dossier.",
      });
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${apiBaseUrl}/api/v1/intelligence/generate-briefing`, {
        entity_name: entityName.trim(),
      });

      if (res.data?.briefing_markdown) {
        setBriefingMarkdown(res.data.briefing_markdown);
        toast.success("Intelligence Dossier Generated", {
          description: `Comprehensive briefing synthesized for ${entityName}.`,
        });
      }
    } catch (err: any) {
      toast.error("Briefing Generation Failed", {
        description: err.response?.data?.detail || "Could not synthesize intelligence briefing.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!briefingMarkdown) return;
    navigator.clipboard.writeText(briefingMarkdown);
    setCopied(true);
    toast.success("Copied to Clipboard", {
      description: "Full intelligence briefing dossier copied.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>MHA Intelligence Dossier - ${entityName}</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; padding: 40px; color: #1e293b; }
              h1 { color: #0f172a; border-bottom: 2px solid #0284c7; padding-bottom: 8px; font-size: 20px; }
              h2, h3 { color: #1e293b; margin-top: 24px; font-size: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
              ul { padding-left: 20px; }
              li { margin-bottom: 8px; }
              code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
              .header-meta { font-size: 12px; color: #64748b; margin-bottom: 20px; }
            </style>
          </head>
          <body>
            <div class="header-meta">NATIONAL CRIME INTELLIGENCE GRID • MINISTRY OF HOME AFFAIRS</div>
            <pre style="white-space: pre-wrap; font-family: inherit;">${briefingMarkdown}</pre>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Clean Light Header */}
        <div className="p-5 px-6 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-900 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">Intelligence Briefing Generator</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-800">
                  MHA DIRECTIVE // DOSSIER
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Automated synthesis of graph topology, evasion alerts, and FIR citations</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Input Bar */}
        <div className="p-4 px-6 bg-slate-50/80 border-b border-slate-100 flex items-center gap-3">
          <div className="flex-1">
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Target Subject Name / Canonical Identity</label>
            <input
              type="text"
              value={entityName}
              onChange={(e) => setEntityName(e.target.value)}
              placeholder="e.g. Jagrati Sibal, Kala, Sanchit Bhatia"
              className="w-full text-xs font-semibold px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-all"
            />
          </div>

          <div className="pt-5">
            <button
              onClick={generateBriefing}
              disabled={loading}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-900 hover:bg-slate-800 text-white transition-all cursor-pointer flex items-center gap-2 shadow-xs disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Synthesizing Dossier...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  Generate Dossier
                </>
              )}
            </button>
          </div>
        </div>

        {/* Briefing Preview Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 font-sans">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-500">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-900" />
              <div className="text-center">
                <p className="text-xs font-bold text-slate-800">Synthesizing Verified Multi-Source Intelligence...</p>
                <p className="text-[11px] text-slate-500 mt-1">Cross-referencing Neo4j Graph, Evasion Alerts, and FIR Document Paragraphs</p>
              </div>
            </div>
          ) : !briefingMarkdown ? (
            <div className="flex flex-col items-center justify-center h-64 text-center p-6 rounded-2xl border border-dashed border-slate-200 text-slate-500 bg-white">
              <FileText className="w-10 h-10 text-slate-300 mb-2" />
              <h4 className="text-xs font-bold text-slate-700">No Briefing Generated Yet</h4>
              <p className="text-[11px] text-slate-500 mt-1 max-w-md">
                Click &quot;Generate Dossier&quot; above to produce an intelligence briefing for <strong className="text-slate-700">{entityName || "the selected subject"}</strong> with paragraph-level FIR citations.
              </p>
            </div>
          ) : (
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs text-xs text-slate-800 leading-relaxed">
              <MarkdownContent content={briefingMarkdown} />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {briefingMarkdown && (
          <div className="p-4 px-6 bg-white border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[11px] text-emerald-700 font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Grounded in verified graph relationships & FIR incident paragraphs
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy Dossier
                  </>
                )}
              </button>

              <button
                onClick={handlePrint}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 text-white transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                Print / PDF Export
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
