"use client";

import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  UploadCloud,
  FileSpreadsheet,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Activity,
  Server,
  ShieldCheck,
  X,
  FileCheck2,
  FolderOpen,
  PhoneCall,
  CreditCard,
  RotateCcw,
  Building,
  Check
} from "lucide-react";

interface DataIngestionPanelProps {
  apiBaseUrl: string;
  onDataIngested?: () => void;
}

interface IngestLog {
  id: string;
  timestamp: string;
  type: "bank" | "cdr" | "fir" | "system";
  status: "success" | "error" | "pending";
  message: string;
}

export const DataIngestionPanel: React.FC<DataIngestionPanelProps> = ({
  apiBaseUrl,
  onDataIngested,
}) => {
  // --- Zone 1: Financial Records (Bank_Transactions.csv) ---
  const [bankFile, setBankFile] = useState<File | null>(null);
  const [bankDragging, setBankDragging] = useState(false);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankUploaded, setBankUploaded] = useState(false);
  const bankInputRef = useRef<HTMLInputElement | null>(null);

  // --- Zone 2: Telecom Records (CDR_Logs.csv) ---
  const [cdrFile, setCdrFile] = useState<File | null>(null);
  const [cdrDragging, setCdrDragging] = useState(false);
  const [cdrLoading, setCdrLoading] = useState(false);
  const [cdrUploaded, setCdrUploaded] = useState(false);
  const cdrInputRef = useRef<HTMLInputElement | null>(null);

  // --- Zone 3: Case Files / FIR (TXT or PDF) ---
  const [firFile, setFirFile] = useState<File | null>(null);
  const [firDragging, setFirDragging] = useState(false);
  const [firLoading, setFirLoading] = useState(false);
  const [firUploaded, setFirUploaded] = useState(false);
  const firInputRef = useRef<HTMLInputElement | null>(null);

  const [mounted, setMounted] = useState(false);
  const [logs, setLogs] = useState<IngestLog[]>([]);

  useEffect(() => {
    setMounted(true);
    setLogs([
      {
        id: "log-init",
        timestamp: new Date().toLocaleTimeString(),
        type: "system",
        status: "success",
        message: "CCTNS/NATGRID Ingestion Pipeline ready. Awaiting digital evidence intake.",
      },
    ]);
  }, []);

  const addLog = (
    type: "bank" | "cdr" | "fir" | "system",
    status: "success" | "error" | "pending",
    message: string
  ) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [
      {
        id: `log-${Date.now()}-${Math.random()}`,
        timestamp: time,
        type,
        status,
        message,
      },
      ...prev.slice(0, 19),
    ]);
  };

  // --- Process Bank Transactions ---
  const handleProcessBank = async () => {
    setBankLoading(true);
    addLog(
      "bank",
      "pending",
      `Ingesting banking transactions: ${bankFile ? bankFile.name : "Bank_Transactions.csv"}...`
    );
    try {
      const response = await axios.post(`${apiBaseUrl}/api/v1/ingest/csv`);
      const message =
        response.data?.data?.bank_ingestion?.message ||
        "Bank transaction records & accounts mapped to Neo4j graph.";

      setBankUploaded(true);
      toast.success("Financial Records Ingested", {
        description: "Banking ledger records, accounts, and transfer edges mapped successfully.",
      });
      addLog("bank", "success", "Banking transactions successfully committed to graph database.");
      if (onDataIngested) onDataIngested();
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.detail || err.message || "Failed to process bank transactions.";
      toast.error("Financial Ingestion Failed", { description: errorMsg });
      addLog("bank", "error", errorMsg);
    } finally {
      setBankLoading(false);
    }
  };

  // --- Process CDR Logs ---
  const handleProcessCdr = async () => {
    setCdrLoading(true);
    addLog(
      "cdr",
      "pending",
      `Ingesting telecom CDR logs: ${cdrFile ? cdrFile.name : "CDR_Logs.csv"}...`
    );
    try {
      const response = await axios.post(`${apiBaseUrl}/api/v1/ingest/csv`);
      const message =
        response.data?.data?.cdr_ingestion?.message ||
        "CDR telecom records & MSISDN call edges mapped to Neo4j graph.";

      setCdrUploaded(true);
      toast.success("Telecom Records Ingested", {
        description: "Call detail records, tower pings, and [:CALLED] relationships verified.",
      });
      addLog("cdr", "success", "CDR telecom records successfully committed to graph database.");
      if (onDataIngested) onDataIngested();
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.detail || err.message || "Failed to process CDR logs.";
      toast.error("Telecom Ingestion Failed", { description: errorMsg });
      addLog("cdr", "error", errorMsg);
    } finally {
      setCdrLoading(false);
    }
  };

  // --- Process FIR Case File ---
  const handleProcessFir = async () => {
    setFirLoading(true);
    addLog(
      "fir",
      "pending",
      `Running AI extraction on: ${firFile ? firFile.name : "FIR_Case_992.txt"}...`
    );
    try {
      const response = await axios.post(`${apiBaseUrl}/api/v1/ingest/fir`);
      const message =
        response.data?.message || "FIR processed: suspects, aliases, & phone links merged.";

      setFirUploaded(true);
      toast.success("FIR Case Intelligence Ingested", {
        description: "Suspects, aliases, and phone associations extracted and mapped to graph.",
      });
      addLog("fir", "success", message);
      if (onDataIngested) onDataIngested();
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.detail || err.message || "Failed to extract FIR intelligence.";
      toast.error("FIR Extraction Error", { description: errorMsg });
      addLog("fir", "error", errorMsg);
    } finally {
      setFirLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0c1427]/90 border border-slate-800/80 rounded-xl p-3.5 shadow-sm relative overflow-hidden font-sans">
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-blue-400" />
          <h2 className="text-xs font-bold tracking-wide text-white uppercase">
            Evidence Ingestion Hub
          </h2>
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
          CCTNS // NATGRID
        </span>
      </div>

      {/* 3 Distinct Evidence Cards */}
      <div className="mt-3 flex-1 overflow-y-auto space-y-3 pr-0.5">
        {/* ========================================================================= */}
        {/* CARD 1: Financial Records (Bank_Transactions.csv) */}
        {/* ========================================================================= */}
        <div
          className={`rounded-lg border transition-all p-3 ${
            bankUploaded
              ? "border-emerald-700/80 bg-emerald-950/20"
              : "border-slate-700 bg-slate-950/70 hover:border-slate-600"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <CreditCard className={`w-3.5 h-3.5 ${bankUploaded ? "text-emerald-400" : "text-amber-500"}`} />
              <span className="text-xs font-semibold text-slate-200">
                1. Financial Records
              </span>
            </div>
            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700 text-slate-300">
              Bank_Transactions.csv
            </span>
          </div>

          <input
            ref={bankInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                setBankFile(e.target.files[0]);
                setBankUploaded(false);
              }
            }}
          />

          {!bankFile && !bankUploaded ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setBankDragging(true);
              }}
              onDragLeave={() => setBankDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setBankDragging(false);
                if (e.dataTransfer.files?.[0]) {
                  setBankFile(e.dataTransfer.files[0]);
                  setBankUploaded(false);
                }
              }}
              onClick={() => bankInputRef.current?.click()}
              className={`p-2.5 rounded border border-dashed text-center cursor-pointer transition-colors ${
                bankDragging
                  ? "border-amber-500 bg-slate-800"
                  : "border-slate-700 bg-slate-900/50 hover:bg-slate-800/40"
              }`}
            >
              <p className="text-[11px] text-slate-300">
                Drag &amp; drop bank ledger or <span className="text-amber-400 underline font-medium">browse</span>
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] bg-slate-900/90 p-1.5 rounded border border-slate-800">
                <span className="text-slate-200 truncate font-mono max-w-[180px]">
                  {bankFile ? bankFile.name : "Bank_Transactions.csv"}
                </span>
                <button
                  onClick={() => {
                    setBankFile(null);
                    setBankUploaded(false);
                  }}
                  className="text-slate-400 hover:text-rose-400 p-0.5"
                  title="Remove / Re-upload"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>

              {bankUploaded ? (
                <button
                  disabled
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-emerald-700 text-white text-xs font-semibold shadow-sm cursor-default"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Successfully Ingested</span>
                </button>
              ) : (
                <button
                  onClick={handleProcessBank}
                  disabled={bankLoading}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  {bankLoading ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Ingesting Ledger...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Process Financial Records</span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* CARD 2: Telecom Records (CDR_Logs.csv) */}
        {/* ========================================================================= */}
        <div
          className={`rounded-lg border transition-all p-3 ${
            cdrUploaded
              ? "border-emerald-700/80 bg-emerald-950/20"
              : "border-slate-700 bg-slate-950/70 hover:border-slate-600"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <PhoneCall className={`w-3.5 h-3.5 ${cdrUploaded ? "text-emerald-400" : "text-amber-500"}`} />
              <span className="text-xs font-semibold text-slate-200">
                2. Telecom Records
              </span>
            </div>
            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700 text-slate-300">
              CDR_Logs.csv
            </span>
          </div>

          <input
            ref={cdrInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                setCdrFile(e.target.files[0]);
                setCdrUploaded(false);
              }
            }}
          />

          {!cdrFile && !cdrUploaded ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setCdrDragging(true);
              }}
              onDragLeave={() => setCdrDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setCdrDragging(false);
                if (e.dataTransfer.files?.[0]) {
                  setCdrFile(e.dataTransfer.files[0]);
                  setCdrUploaded(false);
                }
              }}
              onClick={() => cdrInputRef.current?.click()}
              className={`p-2.5 rounded border border-dashed text-center cursor-pointer transition-colors ${
                cdrDragging
                  ? "border-amber-500 bg-slate-800"
                  : "border-slate-700 bg-slate-900/50 hover:bg-slate-800/40"
              }`}
            >
              <p className="text-[11px] text-slate-300">
                Drag &amp; drop CDR logs or <span className="text-amber-400 underline font-medium">browse</span>
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] bg-slate-900/90 p-1.5 rounded border border-slate-800">
                <span className="text-slate-200 truncate font-mono max-w-[180px]">
                  {cdrFile ? cdrFile.name : "CDR_Logs.csv"}
                </span>
                <button
                  onClick={() => {
                    setCdrFile(null);
                    setCdrUploaded(false);
                  }}
                  className="text-slate-400 hover:text-rose-400 p-0.5"
                  title="Remove / Re-upload"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>

              {cdrUploaded ? (
                <button
                  disabled
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-emerald-700 text-white text-xs font-semibold shadow-sm cursor-default"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Successfully Ingested</span>
                </button>
              ) : (
                <button
                  onClick={handleProcessCdr}
                  disabled={cdrLoading}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  {cdrLoading ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Ingesting Telecom Logs...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Process Telecom CDR</span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* CARD 3: Case Files / FIR (TXT or PDF) */}
        {/* ========================================================================= */}
        <div
          className={`rounded-lg border transition-all p-3 ${
            firUploaded
              ? "border-emerald-700/80 bg-emerald-950/20"
              : "border-slate-700 bg-slate-950/70 hover:border-slate-600"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <FileText className={`w-3.5 h-3.5 ${firUploaded ? "text-emerald-400" : "text-amber-500"}`} />
              <span className="text-xs font-semibold text-slate-200">
                3. Case Docket / FIR
              </span>
            </div>
            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700 text-slate-300">
              TXT / PDF
            </span>
          </div>

          <input
            ref={firInputRef}
            type="file"
            accept=".txt,.pdf"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                setFirFile(e.target.files[0]);
                setFirUploaded(false);
              }
            }}
          />

          {!firFile && !firUploaded ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setFirDragging(true);
              }}
              onDragLeave={() => setFirDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setFirDragging(false);
                if (e.dataTransfer.files?.[0]) {
                  setFirFile(e.dataTransfer.files[0]);
                  setFirUploaded(false);
                }
              }}
              onClick={() => firInputRef.current?.click()}
              className={`p-2.5 rounded border border-dashed text-center cursor-pointer transition-colors ${
                firDragging
                  ? "border-amber-500 bg-slate-800"
                  : "border-slate-700 bg-slate-900/50 hover:bg-slate-800/40"
              }`}
            >
              <p className="text-[11px] text-slate-300">
                Drag &amp; drop FIR text or <span className="text-amber-400 underline font-medium">browse</span>
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] bg-slate-900/90 p-1.5 rounded border border-slate-800">
                <span className="text-slate-200 truncate font-mono max-w-[180px]">
                  {firFile ? firFile.name : "FIR_Case_992.txt"}
                </span>
                <button
                  onClick={() => {
                    setFirFile(null);
                    setFirUploaded(false);
                  }}
                  className="text-slate-400 hover:text-rose-400 p-0.5"
                  title="Remove / Re-upload"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>

              {firUploaded ? (
                <button
                  disabled
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-emerald-700 text-white text-xs font-semibold shadow-sm cursor-default"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Successfully Ingested</span>
                </button>
              ) : (
                <button
                  onClick={handleProcessFir}
                  disabled={firLoading}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  {firLoading ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Extracting FIR Intel...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Extract &amp; Map FIR Intel</span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Real-time Activity Stream */}
      <div className="mt-2.5 pt-2 border-t border-slate-800">
        <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium mb-1">
          <span className="flex items-center gap-1 text-slate-300">
            <Activity className="w-3 h-3 text-amber-500" />
            Ingestion Activity Log
          </span>
          <span className="text-slate-500 font-mono">{logs.length} events</span>
        </div>

        <div className="max-h-24 overflow-y-auto space-y-1 pr-1 font-mono text-[9px]">
          {mounted &&
            logs.map((log) => {
              const isSuccess = log.status === "success";
              const isError = log.status === "error";

              return (
                <div
                  key={log.id}
                  className="p-1 rounded bg-slate-950 border border-slate-800/80 flex items-start gap-1 text-slate-300"
                >
                  <div className="mt-0.5 shrink-0">
                    {isSuccess ? (
                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                    ) : isError ? (
                      <AlertCircle className="w-2.5 h-2.5 text-rose-500" />
                    ) : (
                      <Loader2 className="w-2.5 h-2.5 text-amber-500 animate-spin" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-[8px] text-slate-400">
                      <span className="font-semibold text-slate-300">[{log.type.toUpperCase()}]</span>
                      <span suppressHydrationWarning>{log.timestamp}</span>
                    </div>
                    <p className="text-slate-300 truncate mt-0.5 font-sans">{log.message}</p>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};
