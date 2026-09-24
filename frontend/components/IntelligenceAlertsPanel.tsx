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
  ShieldCheck
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
}

export const IntelligenceAlertsPanel: React.FC<IntelligenceAlertsPanelProps> = ({
  apiBaseUrl,
  refreshTrigger = 0,
  onAlertsLoaded,
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
    const text = `[MHA FINANCIAL FRAUD DOSSIER - CONFIDENTIAL]\nSender: ${alert.sender_name} (${alert.sender_account})\nReceiver: ${alert.receiver_name} (${alert.receiver_account})\nTotal Evaded: ₹${alert.total_evaded_amount.toLocaleString()}\nTransactions: ${alert.transaction_count} x ₹49,500 structuring\nWindow: ${alert.span_days} days\nCompliance Rule: PMLA Section 12 Violation`;
    navigator.clipboard.writeText(text);
    setCopiedId(`alert-${index}`);
    toast.success("Dossier Copied", {
      description: "Financial intelligence report copied to clipboard.",
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-700/80 rounded-xl p-3.5 shadow-sm relative overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-500" />
          <h2 className="text-xs font-bold tracking-wide text-slate-100 uppercase">
            Financial Intelligence Alerts
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
            alerts.length > 0
              ? "bg-rose-950 border-rose-800 text-rose-300"
              : "bg-slate-800 border-slate-700 text-slate-400"
          }`}>
            {alerts.length} FLAGGED
          </span>
          <button
            onClick={() => fetchAlerts(false)}
            disabled={loading}
            className="p-1 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer disabled:opacity-50"
            title="Scan Financial Trail"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin text-amber-500" : ""}`} />
          </button>
        </div>
      </div>

      {/* Threshold Information HUD */}
      <div className="mt-2.5 p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-start gap-2">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
        <div className="text-[11px] text-slate-300">
          <span className="text-amber-400 font-semibold">PMLA §12 Rule: </span>
          <span className="text-slate-400">
            Traverses transfers in range <strong className="text-slate-200">₹49,000–₹49,999</strong> evading mandatory ₹50,000 CTR reporting.
          </span>
        </div>
      </div>

      {/* Alerts Scrollable List */}
      <div className="mt-3 flex-1 overflow-y-auto space-y-3 pr-0.5">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin text-amber-500" />
            <span className="text-xs font-medium">SCANNING FINANCIAL LEDGERS...</span>
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center p-4 rounded-lg border border-dashed border-slate-800 text-slate-400">
            <ShieldCheck className="w-8 h-8 text-slate-500 mb-2" />
            <p className="text-xs font-medium text-slate-300">No structuring violations flagged.</p>
            <p className="text-[10px] text-slate-500 mt-1 max-w-xs">
              Process Bank Transactions CSV in the evidence panel to detect smurfing evasion patterns.
            </p>
          </div>
        ) : (
          alerts.map((alert, idx) => {
            const isCopied = copiedId === `alert-${idx}`;
            return (
              <div
                key={`alert-${idx}`}
                className="relative rounded-lg border border-rose-900/60 bg-slate-950 p-3 shadow-sm transition-all hover:border-rose-700"
              >
                {/* Header with threat badge */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    <span>SMURFING PATTERN DETECTED</span>
                  </div>

                  <button
                    onClick={() => handleCopyAlert(alert, idx)}
                    className="flex items-center gap-1 text-[10px] text-slate-300 hover:text-white px-2 py-0.5 rounded bg-slate-900 border border-slate-700 hover:border-slate-500 transition-colors cursor-pointer"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400 font-medium">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy Dossier</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Amount Metrics Card */}
                <div className="mt-2.5 grid grid-cols-2 gap-2 bg-slate-900 rounded-md p-2 border border-slate-800">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-medium block">Total Evaded Value</span>
                    <span className="text-sm font-bold text-rose-400 font-mono">
                      ₹{alert.total_evaded_amount.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-medium block">Velocity Window</span>
                    <span className="text-xs font-semibold text-slate-200 mt-0.5 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-500" />
                      {alert.transaction_count} txns in {alert.span_days} days
                    </span>
                  </div>
                </div>

                {/* Sender -> Receiver Flow */}
                <div className="mt-2 p-2 rounded bg-slate-900 border border-slate-800 text-xs flex items-center justify-between text-slate-200">
                  <div>
                    <span className="font-semibold text-slate-100">{alert.sender_name}</span>
                    <span className="text-[10px] text-slate-400 block font-mono">({alert.sender_account})</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-rose-400 shrink-0 mx-1" />
                  <div className="text-right">
                    <span className="font-semibold text-slate-100">{alert.receiver_name}</span>
                    <span className="text-[10px] text-slate-400 block font-mono">({alert.receiver_account})</span>
                  </div>
                </div>

                {/* Micro transactions list (₹49,500 each) */}
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase font-medium">
                    <span>Structured Micro-Transactions</span>
                    <span className="text-rose-400 font-bold font-mono">₹49,500 / tx</span>
                  </div>
                  {alert.transactions.map((tx, txIdx) => (
                    <div
                      key={`tx-${txIdx}`}
                      className="flex items-center justify-between px-2 py-1 rounded bg-slate-900 border border-slate-800/80 text-[10px]"
                    >
                      <div className="flex items-center gap-1.5 text-slate-400 font-mono">
                        <span className="w-1 h-1 rounded-full bg-rose-500" />
                        <span>{tx.date}</span>
                        {tx.remarks && <span className="text-slate-500">[{tx.remarks}]</span>}
                      </div>
                      <span className="font-bold text-rose-400 font-mono">
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
      <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
        <span>FIU-IND Heuristic Metric</span>
        <span className="text-rose-400 font-semibold text-[10px]">SECTION 12 FLAGGED</span>
      </div>
    </div>
  );
};
