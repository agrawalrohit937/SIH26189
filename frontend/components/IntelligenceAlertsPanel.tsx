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
  TrendingDown,
  PhoneCall,
  Radio,
  Flame
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

interface EvasionAlertItem {
  alert_id?: string;
  person_name: string;
  subject?: string;
  cluster?: string;
  phone_count: number;
  temporal_window_days?: number;
  phone_numbers: string[];
  evasion_pattern?: string;
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
  const [activeTab, setActiveTab] = useState<"financial" | "telecom">("financial");
  const [smurfingAlerts, setSmurfingAlerts] = useState<SmurfingAlertItem[]>([]);
  const [evasionAlerts, setEvasionAlerts] = useState<EvasionAlertItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const isInitialMount = useRef(true);

  const fetchAlerts = useCallback(async (isSilent = false) => {
    setLoading(true);
    try {
      const [smurfRes, evasionRes] = await Promise.allSettled([
        axios.get(`${apiBaseUrl}/api/v1/alerts/financial`),
        axios.get(`${apiBaseUrl}/api/v1/alerts/evasion?min_phones=4&max_window_days=30`),
      ]);

      const fetchedSmurfing: SmurfingAlertItem[] = smurfRes.status === "fulfilled" ? smurfRes.value.data?.alerts || [] : [];
      const fetchedEvasion: EvasionAlertItem[] = evasionRes.status === "fulfilled" ? evasionRes.value.data?.alerts || [] : [];

      setSmurfingAlerts(fetchedSmurfing);
      setEvasionAlerts(fetchedEvasion);

      const totalAlerts = fetchedSmurfing.length + fetchedEvasion.length;
      if (onAlertsLoaded) onAlertsLoaded(totalAlerts);

      if (!isSilent && totalAlerts > 0) {
        toast.info("Intelligence Alerts Refreshed", {
          description: `Identified ${fetchedSmurfing.length} financial and ${fetchedEvasion.length} telecom evasion patterns.`,
        });
      }
    } catch (err: any) {
      console.warn("Could not fetch alerts:", err);
      setSmurfingAlerts([]);
      setEvasionAlerts([]);
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
      setSmurfingAlerts([]);
      setEvasionAlerts([]);
      if (onAlertsLoaded) onAlertsLoaded(0);
    }
  }, [refreshTrigger, fetchAlerts, onAlertsLoaded]);

  const handleCopyAlert = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Dossier Copied", {
      description: "Intelligence alert report copied to clipboard.",
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const totalCount = smurfingAlerts.length + evasionAlerts.length;

  return (
    <div className="flex flex-col h-full font-sans space-y-3">
      {/* Top Header */}
      {!hideHeader && (
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Intelligence Alerts & Evasion HUD
              </h2>
              <p className="text-[10px] text-slate-500">Structuring evasion & burner SIM cycling</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              totalCount > 0
                ? "bg-rose-100 border-rose-300 text-rose-800"
                : "bg-slate-100 border-slate-200 text-slate-600"
            }`}>
              {totalCount} FLAGGED
            </span>
            <button
              onClick={() => fetchAlerts(false)}
              disabled={loading}
              className="p-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
              title="Scan Intelligence Trail"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-rose-600" : "text-slate-600"}`} />
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs">
        <button
          onClick={() => setActiveTab("financial")}
          className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === "financial"
              ? "bg-white text-amber-900 shadow-2xs border border-amber-200"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Banknote className="w-3.5 h-3.5 text-amber-600" />
          <span>Financial Structuring ({smurfingAlerts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("telecom")}
          className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === "telecom"
              ? "bg-white text-purple-900 shadow-2xs border border-purple-200"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Radio className="w-3.5 h-3.5 text-purple-600" />
          <span>Burner SIM Evasion ({evasionAlerts.length})</span>
        </button>
      </div>

      {/* Threshold HUD Banner */}
      {activeTab === "financial" ? (
        <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200 flex items-start gap-2 text-xs shadow-2xs">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-[11px] text-amber-950 leading-relaxed">
            <span className="font-bold text-amber-900">Pattern Detection: </span>
            <span className="text-amber-800">
              Traverses repeated micro-transfers in the range <strong className="text-amber-950 font-bold">₹49,000–₹49,999</strong> within short windows to identify structured financial evasion.
            </span>
          </div>
        </div>
      ) : (
        <div className="p-2.5 rounded-xl bg-purple-50/80 border border-purple-200 flex items-start gap-2 text-xs shadow-2xs">
          <Flame className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
          <div className="text-[11px] text-purple-950 leading-relaxed">
            <span className="font-bold text-purple-900">OpSec Detection: </span>
            <span className="text-purple-800">
              Flags criminal operatives rotating <strong className="text-purple-950 font-bold">≥4 distinct phone numbers</strong> within a compressed temporal window (≤30 days).
            </span>
          </div>
        </div>
      )}

      {/* Alerts Scrollable List */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-0.5">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin text-amber-600" />
            <span className="text-xs font-bold">SCANNING INTELLIGENCE LEDGERS...</span>
          </div>
        ) : activeTab === "financial" ? (
          /* Financial Structuring Alerts */
          smurfingAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-44 text-center p-5 rounded-xl border border-dashed border-slate-300 text-slate-500 bg-slate-50/50">
              <ShieldCheck className="w-8 h-8 text-slate-400 mb-1.5" />
              <h3 className="text-xs font-bold text-slate-700">Financial Ledger Clear</h3>
              <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                No structured micro-transfers detected. Ingest new bank transaction records to trigger detection.
              </p>
            </div>
          ) : (
            smurfingAlerts.map((alert, idx) => {
              const alertKey = `smurf-${idx}`;
              return (
                <div
                  key={alertKey}
                  className="p-3 rounded-xl border border-amber-200 bg-white hover:border-amber-400 transition-all shadow-2xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                      <span className="text-amber-900">{alert.sender_name}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-amber-900">{alert.receiver_name}</span>
                    </div>

                    <button
                      onClick={() =>
                        handleCopyAlert(
                          `[MHA FINANCIAL FRAUD DOSSIER]\nSender: ${alert.sender_name} (${alert.sender_account})\nReceiver: ${alert.receiver_name} (${alert.receiver_account})\nTotal Evaded: ₹${alert.total_evaded_amount.toLocaleString()}\nTransactions: ${alert.transaction_count}\nWindow: ${alert.span_days} days`,
                          alertKey
                        )
                      }
                      className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
                      title="Copy Alert Dossier"
                    >
                      {copiedId === alertKey ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] bg-amber-50/50 p-2 rounded-lg border border-amber-100">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Total Structured Sum</span>
                      <span className="font-bold text-amber-950">₹{alert.total_evaded_amount.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Velocity Window</span>
                      <span className="font-bold text-slate-800">{alert.transaction_count} txns in {alert.span_days} days</span>
                    </div>
                  </div>

                  <div className="text-[10px] font-mono text-slate-500 flex items-center justify-between">
                    <span>Acc: <code>{alert.sender_account}</code></span>
                    <span>Beneficiary: <code>{alert.receiver_account}</code></span>
                  </div>
                </div>
              );
            })
          )
        ) : (
          /* Telecom Burner SIM Evasion Alerts */
          evasionAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-44 text-center p-5 rounded-xl border border-dashed border-slate-300 text-slate-500 bg-slate-50/50">
              <ShieldCheck className="w-8 h-8 text-slate-400 mb-1.5" />
              <h3 className="text-xs font-bold text-slate-700">Telecom Topology Clear</h3>
              <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                No rapid burner SIM cycling detected. Ingest multi-device CDR logs to analyze telecom velocity.
              </p>
            </div>
          ) : (
            evasionAlerts.map((alert, idx) => {
              const alertKey = `evasion-${idx}`;
              const sName = alert.person_name || alert.subject || `Suspect #${idx+1}`;
              return (
                <div
                  key={alertKey}
                  className="p-3 rounded-xl border border-purple-200 bg-white hover:border-purple-400 transition-all shadow-2xs space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700">
                        <Flame className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-purple-950">{sName}</div>
                        <div className="text-[10px] text-slate-500">Syndicate Cell #{alert.cluster || "3"} • High OpSec Vector</div>
                      </div>
                    </div>

                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 border border-purple-300 text-purple-800">
                      {alert.phone_count} Burner Numbers
                    </span>
                  </div>

                  <div className="text-[11px] text-purple-900 bg-purple-50/60 p-2 rounded-lg border border-purple-100 leading-relaxed">
                    <span className="font-semibold text-purple-950">Evasion Pattern: </span>
                    Subject activated {alert.phone_count} distinct SIM cards within a compressed {alert.temporal_window_days || 8}-day window.
                  </div>

                  <div className="text-[10px] text-slate-600 space-y-1">
                    <span className="font-semibold text-slate-500 block">Linked Burner Numbers:</span>
                    <div className="flex flex-wrap gap-1">
                      {(alert.phone_numbers || []).map((ph, pIdx) => (
                        <span key={pIdx} className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px] text-slate-700">
                          {ph}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })
          )
        )}
      </div>
    </div>
  );
};
