"use client";

import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  Sparkles,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Network,
  ArrowRight,
  ShieldAlert,
  BrainCircuit,
  Info
} from "lucide-react";

interface PredictedLink {
  link_id: string;
  source_id: string;
  source_name: string;
  source_type: string;
  source_cluster: string;
  target_id: string;
  target_name: string;
  target_type: string;
  target_cluster: string;
  confidence_score: number;
  suggested_relationship: string;
  justification: string;
  requires_human_verification: boolean;
  status: string;
}

interface GATLinkPredictionPanelProps {
  apiBaseUrl: string;
  isOpen: boolean;
  onClose: () => void;
  onLinkConfirmed?: (link: PredictedLink) => void;
}

export const GATLinkPredictionPanel: React.FC<GATLinkPredictionPanelProps> = ({
  apiBaseUrl,
  isOpen,
  onClose,
  onLinkConfirmed,
}) => {
  const [predictions, setPredictions] = useState<PredictedLink[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchPredictions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${apiBaseUrl}/api/v1/intelligence/predicted-links?confidence_threshold=0.50&top_k=8`);
      if (res.data?.predicted_links) {
        setPredictions(res.data.predicted_links);
      }
    } catch (err: any) {
      toast.error("GAT Model Offline", {
        description: err.response?.data?.detail || "Could not compute GAT link predictions.",
      });
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    if (isOpen) {
      fetchPredictions();
    }
  }, [isOpen, fetchPredictions]);

  const handleFeedback = async (linkId: string, decision: "confirm" | "reject") => {
    setActionLoading(linkId);
    try {
      await axios.post(`${apiBaseUrl}/api/v1/intelligence/feedback`, {
        predicted_link_id: linkId,
        decision,
      });

      if (decision === "confirm") {
        toast.success("Relationship Confirmed", {
          description: `Link added to active intelligence graph and confirmed for active learning.`,
        });
        const matched = predictions.find((p) => p.link_id === linkId);
        if (matched && onLinkConfirmed) onLinkConfirmed(matched);
      } else {
        toast.info("Link Rejected", {
          description: `False positive recorded. Active learning will filter and re-rank future predictions.`,
        });
      }

      setPredictions((prev) => prev.filter((p) => p.link_id !== linkId));
    } catch (err: any) {
      toast.error("Feedback Failed", {
        description: err.response?.data?.detail || "Could not record investigator feedback.",
      });
    } finally {
      setActionLoading(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-blue-900 to-indigo-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-amber-300">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold tracking-wide">GAT Graph Attention Link Prediction</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-200">
                  AI Link Discovery
                </span>
              </div>
              <p className="text-xs text-blue-200">2-Layer Graph Attention Network link prediction with active learning</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchPredictions}
              disabled={loading}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer disabled:opacity-50"
              title="Re-run GAT Model"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer text-xs font-bold px-2.5"
            >
              Close
            </button>
          </div>
        </div>

        {/* Info Banner */}
        <div className="p-3 bg-blue-50/80 border-b border-blue-100 flex items-start gap-2.5 text-xs text-blue-900">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed">
            The 2-Layer GAT calculates multi-hop attention embeddings across communication and financial topologies to predict unobserved criminal associations. Confirmed or rejected links feed into active learning loss weights to refine candidate ranking.
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-500">
              <RefreshCw className="w-7 h-7 animate-spin text-blue-600" />
              <span className="text-xs font-bold tracking-wide">COMPUTING GAT ATTENTION WEIGHTS...</span>
            </div>
          ) : predictions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center p-6 rounded-xl border border-dashed border-slate-300 text-slate-500 bg-slate-50">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
              <h4 className="text-xs font-bold text-slate-700">No Unverified Predictions Pending</h4>
              <p className="text-[11px] text-slate-500 mt-1 max-w-sm">
                All high-confidence link predictions have been reviewed or the network topology has no candidate pairs exceeding the 0.50 threshold.
              </p>
            </div>
          ) : (
            predictions.map((pred) => (
              <div
                key={pred.link_id}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-blue-200 transition-all shadow-2xs space-y-2.5"
              >
                {/* Node Pair and Score */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md border border-blue-200">
                      {pred.source_name}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-md border border-indigo-200">
                      {pred.target_name}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                      pred.confidence_score >= 0.85
                        ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                        : pred.confidence_score >= 0.70
                        ? "bg-blue-100 text-blue-800 border-blue-300"
                        : "bg-amber-100 text-amber-800 border-amber-300"
                    }`}>
                      Confidence: {(pred.confidence_score * 100).toFixed(1)}%
                    </span>
                    {pred.requires_human_verification && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-700">
                        Review Req.
                      </span>
                    )}
                  </div>
                </div>

                {/* Plain-Language Attention Justification */}
                <div className="text-[11px] text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200 leading-relaxed">
                  <span className="font-semibold text-slate-900">GAT Attention Rationale: </span>
                  {pred.justification}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-slate-400">
                    ID: <code className="text-slate-600">{pred.link_id}</code>
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleFeedback(pred.link_id, "reject")}
                      disabled={actionLoading === pred.link_id}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Reject (False Positive)
                    </button>
                    <button
                      onClick={() => handleFeedback(pred.link_id, "confirm")}
                      disabled={actionLoading === pred.link_id}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Confirm & Ingest Edge
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
