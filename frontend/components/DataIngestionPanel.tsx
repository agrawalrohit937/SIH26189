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
  Check,
  Sparkles,
  ArrowUpRight,
  FileUp
} from "lucide-react";

interface DataIngestionPanelProps {
  apiBaseUrl: string;
  onDataIngested?: () => void;
  hideHeader?: boolean;
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
  hideHeader = false,
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

  const [masterLoading, setMasterLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [logs, setLogs] = useState<IngestLog[]>([]);

  useEffect(() => {
    setMounted(true);
    setLogs([
      {
        id: "log-init",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        type: "system",
        status: "success",
        message: "CCTNS/NATGRID Pipeline initialized. Ready for evidence intake.",
      },
    ]);
  }, []);

  const addLog = (
    type: "bank" | "cdr" | "fir" | "system",
    status: "success" | "error" | "pending",
    message: string
  ) => {
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
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

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // --- Process Bank Transactions ---
  const handleProcessBank = async () => {
    if (!bankFile) {
      toast.warning("No Banking Ledger Selected", {
        description: "Please browse or drag & drop a bank transaction CSV file first.",
      });
      return;
    }

    setBankLoading(true);
    addLog("bank", "pending", `Ingesting banking ledger (${bankFile.name})...`);

    try {
      const formData = new FormData();
      formData.append("bank_file", bankFile);
      const response = await axios.post(`${apiBaseUrl}/api/v1/ingest/csv`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const recs = response.data?.data?.bank_ingestion?.records_ingested || 0;
      setBankUploaded(true);
      toast.success("Financial Records Ingested", {
        description: `Successfully mapped ${recs} banking transactions to graph.`,
      });
      addLog("bank", "success", `Mapped ${recs} transaction records into Neo4j.`);
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
    if (!cdrFile) {
      toast.warning("No CDR Logs Selected", {
        description: "Please browse or drag & drop a telecom CDR CSV file first.",
      });
      return;
    }

    setCdrLoading(true);
    addLog("cdr", "pending", `Ingesting telecom CDR logs (${cdrFile.name})...`);

    try {
      const formData = new FormData();
      formData.append("cdr_file", cdrFile);
      const response = await axios.post(`${apiBaseUrl}/api/v1/ingest/csv`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const recs = response.data?.data?.cdr_ingestion?.records_ingested || 0;
      setCdrUploaded(true);
      toast.success("Telecom Records Ingested", {
        description: `Successfully mapped ${recs} CDR call records to graph.`,
      });
      addLog("cdr", "success", `Mapped ${recs} CDR call records into Neo4j.`);
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
    if (!firFile) {
      toast.warning("No FIR / Case Docket Selected", {
        description: "Please browse or drag & drop an FIR text, PDF, or image document first.",
      });
      return;
    }

    setFirLoading(true);
    addLog("fir", "pending", `Extracting entities from (${firFile.name})...`);

    try {
      const formData = new FormData();
      formData.append("file", firFile);
      const response = await axios.post(`${apiBaseUrl}/api/v1/ingest/fir`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const suspects = response.data?.data?.fir_extraction?.total_persons_extracted || 0;
      setFirUploaded(true);
      toast.success("FIR Case Intelligence Ingested", {
        description: `Extracted ${suspects} entities & linked phone numbers into graph.`,
      });
      addLog("fir", "success", `Extracted ${suspects} suspects & associates from FIR.`);
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

  // --- Master Ingest All ---
  const handleIngestAll = async () => {
    if (!bankFile && !cdrFile && !firFile) {
      toast.warning("No Evidence Files Staged", {
        description: "Please select or drop at least one Banking CSV, CDR CSV, or FIR Case Docket to ingest.",
      });
      return;
    }

    setMasterLoading(true);
    addLog("system", "pending", "Initiating batch multi-source evidence intake...");

    try {
      // 1. Ingest CSVs (CDR & Bank together if present)
      if (cdrFile || bankFile) {
        const csvFormData = new FormData();
        if (cdrFile) csvFormData.append("cdr_file", cdrFile);
        if (bankFile) csvFormData.append("bank_file", bankFile);

        await axios.post(`${apiBaseUrl}/api/v1/ingest/csv`, csvFormData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        if (cdrFile) setCdrUploaded(true);
        if (bankFile) setBankUploaded(true);
      }

      // 2. Ingest FIR
      if (firFile) {
        const firFormData = new FormData();
        firFormData.append("file", firFile);
        await axios.post(`${apiBaseUrl}/api/v1/ingest/fir`, firFormData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setFirUploaded(true);
      }

      toast.success("Batch Evidence Ingestion Complete", {
        description: "All uploaded files parsed, entity resolution resolved, and network graph updated.",
      });
      addLog("system", "success", "All uploaded evidence successfully committed into Neo4j.");
      if (onDataIngested) onDataIngested();
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || err.message || "Batch ingestion failed.";
      toast.error("Batch Ingestion Failed", { description: errorMsg });
      addLog("system", "error", errorMsg);
    } finally {
      setMasterLoading(false);
    }
  };

  const stagedCount = (bankFile ? 1 : 0) + (cdrFile ? 1 : 0) + (firFile ? 1 : 0);

  return (
    <div className="flex flex-col h-full font-sans space-y-3.5">
      {/* Optional Inner Header if not inside modal */}
      {!hideHeader && (
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <FolderOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Evidence Ingestion Hub
              </h2>
              <p className="text-[10px] text-slate-500">Structured &amp; Unstructured Ingestion Pipeline</p>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700">
            CCTNS // NATGRID
          </span>
        </div>
      )}

      {/* Master 1-Click Action Bar */}
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 border border-blue-200/80 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div>
          <span className="text-xs font-bold text-blue-950 block">
            {stagedCount > 0 ? `${stagedCount} Evidence File(s) Staged` : "Ready for Evidence Intake"}
          </span>
          <p className="text-[11px] text-blue-800">
            Ingests transactions, call records, and extracts FIR intelligence directly into Neo4j.
          </p>
        </div>

        <button
          onClick={handleIngestAll}
          disabled={masterLoading || bankLoading || cdrLoading || firLoading}
          className="flex items-center gap-2 py-2 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-95 text-white text-xs font-extrabold shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {masterLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>Ingesting Evidence...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>{stagedCount > 0 ? `Ingest ${stagedCount} Staged File(s)` : "Upload & Ingest Evidence"}</span>
            </>
          )}
        </button>
      </div>

      {/* 3 Evidence Cards */}
      <div className="space-y-3">
        {/* ========================================================================= */}
        {/* CARD 1: Financial Ledger (Bank Transactions CSV) */}
        {/* ========================================================================= */}
        <div
          className={`rounded-xl border transition-all p-3.5 ${
            bankUploaded
              ? "border-emerald-300 bg-emerald-50/40"
              : bankFile
              ? "border-blue-300 bg-blue-50/30"
              : "border-slate-200 bg-white hover:border-slate-300 shadow-2xs"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 block">
                  1. Financial Ledger (CSV / XLSX)
                </span>
                <span className="text-[10px] text-slate-500">Bank transactions, mule accounts &amp; transfer amounts</span>
              </div>
            </div>

            {bankFile ? (
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                {formatFileSize(bankFile.size)}
              </span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                No file staged
              </span>
            )}
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
              className={`p-3 rounded-lg border-2 border-dashed text-center cursor-pointer transition-colors ${
                bankDragging
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-200 hover:border-blue-400 bg-slate-50/60 hover:bg-blue-50/30"
              }`}
            >
              <FileUp className="w-5 h-5 text-slate-400 mx-auto mb-1" />
              <p className="text-xs text-slate-700 font-semibold">
                Drop bank CSV here, or <span className="text-blue-600 underline font-bold">browse</span>
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Supports standard CCTNS &amp; Core Banking CSV schemas</p>
            </div>
          ) : (
            <div className="space-y-2 mt-1">
              <div className="flex items-center justify-between text-xs bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                <div className="flex items-center gap-2 truncate">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-slate-900 font-bold truncate max-w-[280px]" title={bankFile?.name || "Bank_Transactions.csv"}>
                    {bankFile ? bankFile.name : "Bank_Transactions.csv (Default Sample)"}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setBankFile(null);
                    setBankUploaded(false);
                    if (bankInputRef.current) bankInputRef.current.value = "";
                  }}
                  className="text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 cursor-pointer transition-colors"
                  title="Remove / Choose Different File"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                {bankUploaded ? (
                  <div className="w-full flex items-center justify-between py-1.5 px-3 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold">
                    <span className="flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-700" />
                      Committed into Neo4j Graph
                    </span>
                    <button
                      onClick={() => {
                        setBankUploaded(false);
                        bankInputRef.current?.click();
                      }}
                      className="text-emerald-700 hover:underline cursor-pointer text-[11px]"
                    >
                      Re-upload
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleProcessBank}
                    disabled={bankLoading}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    {bankLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Ingesting Ledger...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Process Financial Ledger</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* CARD 2: Telecom CDR Records (CDR_Logs.csv) */}
        {/* ========================================================================= */}
        <div
          className={`rounded-xl border transition-all p-3.5 ${
            cdrUploaded
              ? "border-emerald-300 bg-emerald-50/40"
              : cdrFile
              ? "border-blue-300 bg-blue-50/30"
              : "border-slate-200 bg-white hover:border-slate-300 shadow-2xs"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
                <PhoneCall className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 block">
                  2. Telecom CDR Records (CSV)
                </span>
                <span className="text-[10px] text-slate-500">Call detail records, call durations &amp; cell tower locations</span>
              </div>
            </div>

            {cdrFile ? (
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                {formatFileSize(cdrFile.size)}
              </span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                No file staged
              </span>
            )}
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
              className={`p-3 rounded-lg border-2 border-dashed text-center cursor-pointer transition-colors ${
                cdrDragging
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-200 hover:border-blue-400 bg-slate-50/60 hover:bg-blue-50/30"
              }`}
            >
              <FileUp className="w-5 h-5 text-slate-400 mx-auto mb-1" />
              <p className="text-xs text-slate-700 font-semibold">
                Drop telecom CDR logs here, or <span className="text-blue-600 underline font-bold">browse</span>
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Caller/receiver MSISDNs, durations &amp; BTS cell IDs</p>
            </div>
          ) : (
            <div className="space-y-2 mt-1">
              <div className="flex items-center justify-between text-xs bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                <div className="flex items-center gap-2 truncate">
                  <PhoneCall className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="text-slate-900 font-bold truncate max-w-[280px]" title={cdrFile?.name || "CDR_Logs.csv"}>
                    {cdrFile ? cdrFile.name : "CDR Logs CSV"}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setCdrFile(null);
                    setCdrUploaded(false);
                    if (cdrInputRef.current) cdrInputRef.current.value = "";
                  }}
                  className="text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 cursor-pointer transition-colors"
                  title="Remove / Choose Different File"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                {cdrUploaded ? (
                  <div className="w-full flex items-center justify-between py-1.5 px-3 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold">
                    <span className="flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-700" />
                      Committed into Neo4j Graph
                    </span>
                    <button
                      onClick={() => {
                        setCdrUploaded(false);
                        cdrInputRef.current?.click();
                      }}
                      className="text-emerald-700 hover:underline cursor-pointer text-[11px]"
                    >
                      Re-upload
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleProcessCdr}
                    disabled={cdrLoading}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    {cdrLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Ingesting CDR Records...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Process Telecom CDR</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* CARD 3: Case Files / FIR (TXT or PDF) */}
        {/* ========================================================================= */}
        <div
          className={`rounded-xl border transition-all p-3.5 ${
            firUploaded
              ? "border-emerald-300 bg-emerald-50/40"
              : firFile
              ? "border-blue-300 bg-blue-50/30"
              : "border-slate-200 bg-white hover:border-slate-300 shadow-2xs"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 block">
                  3. Case Docket / FIR (PDF / TXT / Scanned Image)
                </span>
                <span className="text-[10px] text-slate-500">Unstructured narrative for NLP entity &amp; suspect extraction</span>
              </div>
            </div>

            {firFile ? (
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                {formatFileSize(firFile.size)}
              </span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                No file staged
              </span>
            )}
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
              className={`p-3 rounded-lg border-2 border-dashed text-center cursor-pointer transition-colors ${
                firDragging
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-200 hover:border-blue-400 bg-slate-50/60 hover:bg-blue-50/30"
              }`}
            >
              <FileUp className="w-5 h-5 text-slate-400 mx-auto mb-1" />
              <p className="text-xs text-slate-700 font-semibold">
                Drop FIR text file here, or <span className="text-blue-600 underline font-bold">browse</span>
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Extracts suspects, aliases, phone links &amp; syndicate roles</p>
            </div>
          ) : (
            <div className="space-y-2 mt-1">
              <div className="flex items-center justify-between text-xs bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                <div className="flex items-center gap-2 truncate">
                  <FileText className="w-4 h-4 text-purple-600 shrink-0" />
                  <span className="text-slate-900 font-bold truncate max-w-[280px]" title={firFile?.name || "FIR Docket"}>
                    {firFile ? firFile.name : "FIR Docket Document"}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setFirFile(null);
                    setFirUploaded(false);
                    if (firInputRef.current) firInputRef.current.value = "";
                  }}
                  className="text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 cursor-pointer transition-colors"
                  title="Remove / Choose Different File"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                {firUploaded ? (
                  <div className="w-full flex items-center justify-between py-1.5 px-3 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold">
                    <span className="flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-700" />
                      Committed into Neo4j Graph
                    </span>
                    <button
                      onClick={() => {
                        setFirUploaded(false);
                        firInputRef.current?.click();
                      }}
                      className="text-emerald-700 hover:underline cursor-pointer text-[11px]"
                    >
                      Re-upload
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleProcessFir}
                    disabled={firLoading}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    {firLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Extracting Intelligence...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Extract FIR Intelligence</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Real-time Ingestion Audit Log */}
      <div className="pt-2 border-t border-slate-200">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1.5">
          <span className="flex items-center gap-1.5 text-slate-800">
            <Activity className="w-3.5 h-3.5 text-blue-600" />
            Ingestion Activity Log
          </span>
          <span className="text-[10px] font-mono text-slate-400 font-normal">{logs.length} logged events</span>
        </div>

        <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1 font-mono text-[10px]">
          {mounted &&
            logs.map((log) => {
              const isSuccess = log.status === "success";
              const isError = log.status === "error";

              return (
                <div
                  key={log.id}
                  className="p-2 rounded-lg bg-slate-50 border border-slate-200 flex items-start gap-2 text-slate-800 shadow-2xs"
                >
                  <div className="mt-0.5 shrink-0">
                    {isSuccess ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    ) : isError ? (
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                    ) : (
                      <Loader2 className="w-3.5 h-3.5 text-amber-600 animate-spin" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 font-sans">
                    <div className="flex items-center justify-between text-[9px] text-slate-500 font-mono">
                      <span className="font-bold text-slate-900 uppercase">[{log.type}]</span>
                      <span suppressHydrationWarning>{log.timestamp}</span>
                    </div>
                    <p className="text-slate-800 truncate mt-0.5 font-medium">{log.message}</p>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};
