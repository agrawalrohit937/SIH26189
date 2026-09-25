"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  Copy,
  Check,
  Clock,
  Banknote,
  FileSpreadsheet,
  Building,
  ShieldCheck,
  TrendingDown
} from "lucide-react";

interface Transaction {
  amount: number;
  date: string;
  remarks?: string;
}

interface SmurfingAlertItem {
  sender_name: string;
  sender_account: string;
  receiver_name: string;
  receiver_account: string;
  transaction_count: number;
  span_days: number;
  total_evaded_amount: number;
  transactions: Transaction[];
  alert_type?: string;
  alert_description?: string;
}

interface IntelligenceAlertsPanelProps {
  apiBaseUrl: string;
  refreshTrigger?: number;
  onAlertsLoaded?: (count: number) => void;
  hideHeader?: boolean;
}

export const IntelligenceAlertsPanel: React.FC<IntelligenceAlertsPanelProps> = ({
  apiBaseUrl,
  refreshTrigger = 0,
  onAlertsLoaded,
  hideHeader = false,
}) => {
  const [alerts, setAlerts] = useState<SmurfingAlertItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const isInitialMount = useRef(true);

  const fetchAlerts = useCallback(async (isSilent = false) => {
    setLoading(true);
    try {
      const response = await axios.get(`${apiBaseUrl}/api/v1/intelligence/smurfing-alerts`);
      const fetchedAlerts: SmurfingAlertItem[] = response.data?.alerts || [];
      setAlerts(fetchedAlerts);
      if (onAlertsLoaded) onAlertsLoaded(fetchedAlerts.length);
      if (!isSilent && fetchedAlerts.length > 0) {
        toast.info("Alerts Refreshed", {
          description: `Identified ${fetchedAlerts.length} high-priority structuring pattern(s).`,
        });
      }
    } catch (err: any) {
      console.warn("Could not fetch alerts:", err);
      setAlerts([]);
      if (onAlertsLoaded) onAlertsLoaded(0);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, onAlertsLoaded]);

  // Handle parent refresh/purge triggers
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (refreshTrigger > 0) {
      fetchAlerts(true);
    } else if (refreshTrigger === -1) {
      setAlerts([]);
      if (onAlertsLoaded) onAlertsLoaded(0);
    }
  }, [refreshTrigger, fetchAlerts, onAlertsLoaded]);

  const handleCopyAlert = (alert: SmurfingAlertItem, index: number) => {
    const text = `[MHA FINANCIAL FRAUD DOSSIER - CONFIDENTIAL]\nSender: ${alert.sender_name} (${alert.sender_account})\nReceiver: ${alert.receiver_name} (${alert.receiver_account})\nTotal Evaded: ₹${alert.total_evaded_amount.toLocaleString()}\nTransactions: ${alert.transaction_count} x structured transfers\nWindow: ${alert.span_days} days\nAnalysis Rule: Structuring Evasion Flag [Reporting Threshold Evasion: ₹49,000–₹49,999]`;
    navigator.clipboard.writeText(text);
    setCopiedId(`alert-${index}`);
    toast.success("Dossier Copied", {
      description: "Financial intelligence report copied to clipboard.",
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex flex-col h-full font-sans space-y-3">
      {/* Optional Top Header */}
      {!hideHeader && (
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Financial Intelligence Alerts
              </h2>
              <p className="text-[10px] text-slate-500">Demo-configurable structuring evasion detection</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              alerts.length > 0
                ? "bg-rose-100 border-rose-300 text-rose-800"
                : "bg-slate-100 border-slate-200 text-slate-600"
            }`}>
              {alerts.length} FLAGGED
            </span>
            <button
              onClick={() => fetchAlerts(false)}
              disabled={loading}
              className="p-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
              title="Scan Financial Trail"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-rose-600" : "text-slate-600"}`} />
            </button>
          </div>
        </div>
      )}

      {/* Threshold Information HUD */}
      <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 flex items-start gap-2.5 text-xs shadow-2xs">
        <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <div className="text-[11px] text-amber-950 leading-relaxed">
          <span className="font-bold text-amber-900">Pattern Detection: </span>
          <span className="text-amber-800">
            Traverses repeated micro-transfers in the range <strong className="text-amber-950 font-bold">₹49,000–₹49,999</strong> within short windows to identify structured financial evasion.
          </span>
        </div>
      </div>

      {/* Alerts Scrollable List */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-0.5">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin text-amber-600" />
            <span className="text-xs font-bold">SCANNING FINANCIAL LEDGERS...</span>
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center p-5 rounded-xl border border-dashed border-slate-300 text-slate-500 bg-slate-50/50">
            <ShieldCheck className="w-9 h-9 text-slate-400 mb-2" />
            <p className="text-xs font-bold text-slate-800">No structuring violations flagged.</p>
            <p className="text-[11px] text-slate-500 mt-1 max-w-xs font-normal">
              Process Bank Transactions CSV in the evidence hub to detect automated smurfing evasion patterns.
            </p>
          </div>
        ) : (
          alerts.map((alert, idx) => {
            const isCopied = copiedId === `alert-${idx}`;
            return (
              <div
                key={`alert-${idx}`}
                className="relative rounded-xl border border-rose-200 bg-white p-3.5 shadow-xs transition-all hover:border-rose-300"
              >
                {/* Header with threat badge */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700">
                    <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
                    <span>SMURFING PATTERN DETECTED</span>
                  </div>

                  <button
                    onClick={() => handleCopyAlert(alert, idx)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 hover:text-slate-900 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors cursor-pointer shadow-2xs"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700 font-bold">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-500" />
                        <span>Copy Dossier</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Amount Metrics Card */}
                <div className="mt-2.5 grid grid-cols-2 gap-2.5 bg-rose-50/50 rounded-lg p-2.5 border border-rose-100">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Total Evaded Value</span>
                    <span className="text-base font-extrabold text-rose-700 font-mono">
                      ₹{alert.total_evaded_amount.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Velocity Window</span>
                    <span className="text-xs font-bold text-slate-900 mt-0.5 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      {alert.transaction_count} txns in {alert.span_days} days
                    </span>
                  </div>
                </div>

                {/* Sender -> Receiver Flow */}
                <div className="mt-2.5 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900 block">{alert.sender_name}</span>
                    <span className="text-[10px] text-slate-500 font-mono">({alert.sender_account})</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-rose-600 shrink-0 mx-2" />
                  <div className="text-right">
                    <span className="font-bold text-slate-900 block">{alert.receiver_name}</span>
                    <span className="text-[10px] text-slate-500 font-mono">({alert.receiver_account})</span>
                  </div>
                </div>

                {/* Micro transactions list */}
                <div className="mt-2.5 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-slate-500 uppercase font-bold">
                    <span>Structured Micro-Transactions</span>
                    <span className="text-rose-700 font-bold font-mono">~₹49,500 / tx</span>
                  </div>
                  {alert.transactions.map((tx, txIdx) => (
                    <div
                      key={`tx-${txIdx}`}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-slate-50 border border-slate-200/80 text-[10px]"
                    >
                      <div className="flex items-center gap-1.5 text-slate-700 font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        <span>{tx.date}</span>
                        {tx.remarks && <span className="text-slate-500 font-sans">[{tx.remarks}]</span>}
                      </div>
                      <span className="font-bold text-rose-700 font-mono">
                        ₹{tx.amount.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Info */}
      <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
        <span>FIU-IND Heuristic Metric</span>
        <span className="text-rose-700 font-bold text-[10px]">SECTION 12 FLAGGED</span>
      </div>
    </div>
  );
};
