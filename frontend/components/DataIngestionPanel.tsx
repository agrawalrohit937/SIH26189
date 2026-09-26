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
  ShieldCheck,
  X,
  PhoneCall,
  CreditCard,
  Check,
  Sparkles,
  FileUp,
  Database,
  Play,
  Hash,
  Plus,
  ChevronDown,
  ChevronUp,
  FileSignature,
  FileCheck
} from "lucide-react";

interface DataIngestionPanelProps {
  apiBaseUrl: string;
  onDataIngested?: () => void;
  hideHeader?: boolean;
  activeCaseId?: string;
  onSelectCaseId?: (caseId: string) => void;
}

interface IngestLog {
  id: string;
  timestamp: string;
  type: "bank" | "cdr" | "fir" | "system";
  status: "success" | "error" | "pending";
  message: string;
}

interface CaseItem {
  case_id: string;
  node_count: number;
  edge_count: number;
}

export const DataIngestionPanel: React.FC<DataIngestionPanelProps> = ({
  apiBaseUrl,
  onDataIngested,
  hideHeader = false,
  activeCaseId,
  onSelectCaseId,
}) => {
  const [activeTab, setActiveTab] = useState<"files" | "text" | "demo">("files");

  // Files
  const [bankFile, setBankFile] = useState<File | null>(null);
  const [bankUploaded, setBankUploaded] = useState(false);
  const [bankStats, setBankStats] = useState<number | null>(null);
  const bankInputRef = useRef<HTMLInputElement | null>(null);

  const [cdrFile, setCdrFile] = useState<File | null>(null);
  const [cdrUploaded, setCdrUploaded] = useState(false);
  const [cdrStats, setCdrStats] = useState<number | null>(null);
  const cdrInputRef = useRef<HTMLInputElement | null>(null);

  const [firFile, setFirFile] = useState<File | null>(null);
  const [firUploaded, setFirUploaded] = useState(false);
  const [firStats, setFirStats] = useState<number | null>(null);
  const firInputRef = useRef<HTMLInputElement | null>(null);

  // Direct Text
  const [firText, setFirText] = useState<string>("");
  const [firTextLoading, setFirTextLoading] = useState(false);

  // States
  const [masterLoading, setMasterLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [targetCaseId, setTargetCaseId] = useState<string>(activeCaseId || "FIR-992/2026");
  const [existingCases, setExistingCases] = useState<CaseItem[]>([]);
  const [logs, setLogs] = useState<IngestLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [currentStep, setCurrentStep] = useState<string | null>(null);

  useEffect(() => {
    fetchCases();
    setLogs([
      {
        id: "log-init",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        type: "system",
        status: "success",
        message: "Pipeline initialized. Ready for evidence intake.",
      },
    ]);
  }, []);

  useEffect(() => {
    if (activeCaseId) {
      setTargetCaseId(activeCaseId);
    }
  }, [activeCaseId]);

  const fetchCases = async () => {
    try {
      const res = await axios.get(`${apiBaseUrl}/api/v1/cases`);
      if (res.data?.cases) {
        setExistingCases(res.data.cases);
      }
    } catch {
      // ignore
    }
  };

  const addLog = (type: "bank" | "cdr" | "fir" | "system", status: "success" | "error" | "pending", message: string) => {
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setLogs((prev) => [
      { id: `log-${Date.now()}-${Math.random()}`, timestamp: time, type, status, message },
      ...prev.slice(0, 19),
    ]);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleGenerateNewCase = () => {
    const randomDocket = `FIR-${Math.floor(100 + Math.random() * 900)}/2026`;
    setTargetCaseId(randomDocket);
    if (onSelectCaseId) onSelectCaseId(randomDocket);
    toast.info(`Target Docket: ${randomDocket}`);
  };

  // Process All Staged Files
  const handleIngestAll = async () => {
    if (!bankFile && !cdrFile && !firFile) {
      toast.warning("Please stage at least one file to ingest.");
      return;
    }

    setMasterLoading(true);
    setCurrentStep("Ingesting evidence into Neo4j graph...");
    addLog("system", "pending", `Processing evidence for '${targetCaseId}'...`);

    const token = typeof window !== "undefined" ? localStorage.getItem("mha_token") : null;
    const authHeaders: Record<string, string> = { "Content-Type": "multipart/form-data" };
    if (token && token !== "undefined" && token !== "null") {
      authHeaders["Authorization"] = `Bearer ${token}`;
    }

    try {
      if (cdrFile || bankFile) {
        const csvFormData = new FormData();
        if (cdrFile) csvFormData.append("cdr_file", cdrFile);
        if (bankFile) csvFormData.append("bank_file", bankFile);
        csvFormData.append("case_id", targetCaseId || "FIR-992/2026");

        const csvRes = await axios.post(`${apiBaseUrl}/api/v1/ingest/csv`, csvFormData, {
          headers: authHeaders,
        });
        if (cdrFile) {
          setCdrUploaded(true);
          setCdrStats(csvRes.data?.data?.cdr_ingestion?.records_ingested || 0);
        }
        if (bankFile) {
          setBankUploaded(true);
          setBankStats(csvRes.data?.data?.bank_ingestion?.records_ingested || 0);
        }
      }

      if (firFile) {
        const firFormData = new FormData();
        firFormData.append("file", firFile);
        firFormData.append("case_id", targetCaseId || "FIR-992/2026");
        const firRes = await axios.post(`${apiBaseUrl}/api/v1/ingest/fir`, firFormData, {
          headers: authHeaders,
        });
        setFirUploaded(true);
        setFirStats(firRes.data?.data?.fir_extraction?.total_persons_extracted || 0);
      }

      toast.success("Evidence Ingested Successfully", {
        description: `Linked to Case '${targetCaseId}'.`,
      });
      addLog("system", "success", `Committed files into Case '${targetCaseId}'.`);
      fetchCases();
      if (onDataIngested) onDataIngested();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || "Ingestion failed.";
      toast.error("Ingestion Failed", { description: msg });
      addLog("system", "error", msg);
    } finally {
      setMasterLoading(false);
      setCurrentStep(null);
    }
  };

  // Direct Text Process
  const handleProcessDirectText = async () => {
    if (!firText.trim()) {
      toast.warning("Please paste or type the FIR narrative.");
      return;
    }

    setFirTextLoading(true);
    setCurrentStep("Extracting entities with Neural NLP...");
    addLog("fir", "pending", `Parsing narrative for '${targetCaseId}'...`);

    const token = typeof window !== "undefined" ? localStorage.getItem("mha_token") : null;
    const authHeaders: Record<string, string> = { "Content-Type": "multipart/form-data" };
    if (token && token !== "undefined" && token !== "null") {
      authHeaders["Authorization"] = `Bearer ${token}`;
    }

    try {
      const formData = new FormData();
      formData.append("text", firText);
      formData.append("case_id", targetCaseId || "FIR-992/2026");
      const res = await axios.post(`${apiBaseUrl}/api/v1/ingest/fir`, formData, {
        headers: authHeaders,
      });

      const suspects = res.data?.data?.fir_extraction?.total_persons_extracted || 0;
      toast.success("Narrative Processed", {
        description: `Extracted ${suspects} suspects & mapped to graph.`,
      });
      addLog("fir", "success", `Extracted ${suspects} entities into '${targetCaseId}'.`);
      fetchCases();
      if (onDataIngested) onDataIngested();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || "Parsing failed.";
      toast.error("Extraction Failed", { description: msg });
      addLog("fir", "error", msg);
    } finally {
      setFirTextLoading(false);
      setCurrentStep(null);
    }
  };

  // 1-Click Demo Intake
  const handleLoadDemoData = async () => {
    setDemoLoading(true);
    setCurrentStep("Loading verified syndicate scenario...");
    addLog("system", "pending", `Loading demonstration dataset for '${targetCaseId}'...`);

    const token = typeof window !== "undefined" ? localStorage.getItem("mha_token") : null;
    const authHeaders: Record<string, string> = {};
    if (token && token !== "undefined" && token !== "null") {
      authHeaders["Authorization"] = `Bearer ${token}`;
    }

    try {
      await axios.post(
        `${apiBaseUrl}/api/v1/ingest/csv?cdr_file_path=CDR_Logs.csv&bank_file_path=Bank_Transactions.csv`,
        new FormData(),
        { params: { case_id: targetCaseId || "FIR-992/2026" }, headers: authHeaders }
      );
      setBankUploaded(true);
      setCdrUploaded(true);

      await axios.post(
        `${apiBaseUrl}/api/v1/ingest/fir?file_path=FIR_Case_992.txt`,
        new FormData(),
        { params: { case_id: targetCaseId || "FIR-992/2026" }, headers: authHeaders }
      );
      setFirUploaded(true);

      toast.success("Demo Dataset Ingested", {
        description: `Synthetic network loaded under '${targetCaseId}'.`,
      });
      addLog("system", "success", `Loaded demo network into Case '${targetCaseId}'.`);
      fetchCases();
      if (onDataIngested) onDataIngested();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || "Failed to load demo.";
      toast.error("Demo Load Error", { description: msg });
      addLog("system", "error", msg);
    } finally {
      setDemoLoading(false);
      setCurrentStep(null);
    }
  };

  const stagedCount = (bankFile ? 1 : 0) + (cdrFile ? 1 : 0) + (firFile ? 1 : 0);
  const isAnyLoading = masterLoading || firTextLoading || demoLoading;

  const sampleNarrative = `FIRST INFORMATION REPORT (FIR NO: 992/2026)
Police Station: Cyber Crime Cell, Special Task Force, New Delhi
Date & Time: 14-FEB-2026 10:30 IST

Complainant states that an organized criminal network led by Vikram Malhotra (alias Vicky Hawala, operating phone +91 98101 23456) has orchestrated large-scale banking fraud. Primary associates identified include Suresh Verma (+91 98202 34567) and Ramesh Sharma (+91 98303 45678). Suspect accounts at HDFC and ICICI have recorded systematic smurfing transactions exceeding INR 15 Lakhs. Vehicle DL-01-AB-1234 was identified during field surveillance.`;

  return (
    <div className="flex flex-col space-y-4 font-sans text-slate-800">
      {/* ========================================================================= */}
      {/* 1. TOP BAR: CASE DOCKET & MODE TABS */}
      {/* ========================================================================= */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
        {/* Case Docket Picker */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Case Docket:</span>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={targetCaseId}
              onChange={(e) => {
                setTargetCaseId(e.target.value);
                if (onSelectCaseId) onSelectCaseId(e.target.value);
              }}
              placeholder="FIR-992/2026"
              className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-hidden focus:border-blue-600 w-36"
            />
            {existingCases.length > 0 && (
              <select
                value={targetCaseId}
                onChange={(e) => {
                  setTargetCaseId(e.target.value);
                  if (onSelectCaseId) onSelectCaseId(e.target.value);
                }}
                className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 cursor-pointer focus:outline-hidden"
              >
                {existingCases.map((c) => (
                  <option key={c.case_id} value={c.case_id}>
                    {c.case_id}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={handleGenerateNewCase}
              className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
            >
              + New
            </button>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="flex items-center p-0.5 bg-slate-100 rounded-lg text-xs font-medium">
          <button
            onClick={() => setActiveTab("files")}
            className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
              activeTab === "files" ? "bg-white text-slate-900 font-bold shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            File Upload {stagedCount > 0 && `(${stagedCount})`}
          </button>
          <button
            onClick={() => setActiveTab("text")}
            className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
              activeTab === "text" ? "bg-white text-slate-900 font-bold shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Text Paste
          </button>
          <button
            onClick={() => setActiveTab("demo")}
            className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
              activeTab === "demo" ? "bg-white text-slate-900 font-bold shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            ⚡ Quick Demo
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. TAB 1: CLEAN FILE UPLOAD (3 Clear Cards) */}
      {/* ========================================================================= */}
      {activeTab === "files" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* CARD 1: BANKING */}
            <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50 hover:bg-slate-50 transition-colors flex flex-col justify-between min-h-[140px]">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-md bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                    <CreditCard className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Bank Transactions</span>
                    <span className="text-[10px] text-slate-500">CSV Ledger</span>
                  </div>
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
                    onClick={() => bankInputRef.current?.click()}
                    className="py-3 px-2 rounded-lg border border-dashed border-slate-300 hover:border-slate-400 bg-white text-center cursor-pointer transition-colors"
                  >
                    <UploadCloud className="w-4 h-4 text-slate-400 mx-auto mb-1" />
                    <span className="text-xs text-slate-600 font-medium block">Choose .CSV file</span>
                  </div>
                ) : (
                  <div className="p-2 bg-white border border-slate-200 rounded-lg flex items-center justify-between">
                    <div className="truncate pr-1">
                      <span className="text-xs font-bold text-slate-800 truncate block">
                        {bankFile ? bankFile.name : "Bank_Transactions.csv"}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {bankFile ? formatSize(bankFile.size) : "Default Sample"}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setBankFile(null);
                        setBankUploaded(false);
                      }}
                      className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {bankUploaded && (
                <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1 mt-2">
                  <Check className="w-3 h-3" /> {bankStats ? `${bankStats} transactions mapped` : "Saved"}
                </span>
              )}
            </div>

            {/* CARD 2: TELECOM CDR */}
            <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50 hover:bg-slate-50 transition-colors flex flex-col justify-between min-h-[140px]">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-md bg-blue-100 text-blue-800 flex items-center justify-center shrink-0">
                    <PhoneCall className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Telecom CDR Logs</span>
                    <span className="text-[10px] text-slate-500">CSV Call Records</span>
                  </div>
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
                    onClick={() => cdrInputRef.current?.click()}
                    className="py-3 px-2 rounded-lg border border-dashed border-slate-300 hover:border-slate-400 bg-white text-center cursor-pointer transition-colors"
                  >
                    <UploadCloud className="w-4 h-4 text-slate-400 mx-auto mb-1" />
                    <span className="text-xs text-slate-600 font-medium block">Choose .CSV file</span>
                  </div>
                ) : (
                  <div className="p-2 bg-white border border-slate-200 rounded-lg flex items-center justify-between">
                    <div className="truncate pr-1">
                      <span className="text-xs font-bold text-slate-800 truncate block">
                        {cdrFile ? cdrFile.name : "CDR_Logs.csv"}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {cdrFile ? formatSize(cdrFile.size) : "Default Sample"}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setCdrFile(null);
                        setCdrUploaded(false);
                      }}
                      className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {cdrUploaded && (
                <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1 mt-2">
                  <Check className="w-3 h-3" /> {cdrStats ? `${cdrStats} calls mapped` : "Saved"}
                </span>
              )}
            </div>

            {/* CARD 3: FIR DOSSIER */}
            <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50 hover:bg-slate-50 transition-colors flex flex-col justify-between min-h-[140px]">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-md bg-purple-100 text-purple-800 flex items-center justify-center shrink-0">
                    <FileText className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">FIR Police Dossier</span>
                    <span className="text-[10px] text-slate-500">PDF or TXT Narrative</span>
                  </div>
                </div>

                <input
                  ref={firInputRef}
                  type="file"
                  accept=".txt,.pdf,.png,.jpg"
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
                    onClick={() => firInputRef.current?.click()}
                    className="py-3 px-2 rounded-lg border border-dashed border-slate-300 hover:border-slate-400 bg-white text-center cursor-pointer transition-colors"
                  >
                    <UploadCloud className="w-4 h-4 text-slate-400 mx-auto mb-1" />
                    <span className="text-xs text-slate-600 font-medium block">Choose PDF / TXT</span>
                  </div>
                ) : (
                  <div className="p-2 bg-white border border-slate-200 rounded-lg flex items-center justify-between">
                    <div className="truncate pr-1">
                      <span className="text-xs font-bold text-slate-800 truncate block">
                        {firFile ? firFile.name : "FIR_Case_992.txt"}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {firFile ? formatSize(firFile.size) : "Default Sample"}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setFirFile(null);
                        setFirUploaded(false);
                      }}
                      className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {firUploaded && (
                <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1 mt-2">
                  <Check className="w-3 h-3" /> {firStats ? `${firStats} suspects identified` : "Saved"}
                </span>
              )}
            </div>
          </div>

          {/* Single Clear Primary Action */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-500">
              {stagedCount > 0 ? `${stagedCount} file(s) staged for intake` : "Select files above to stage"}
            </span>

            <button
              onClick={handleIngestAll}
              disabled={isAnyLoading || stagedCount === 0}
              className="flex items-center gap-2 py-2 px-5 rounded-lg bg-[#0A2540] hover:bg-[#143d6a] active:scale-95 text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {masterLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-400" />
                  <span>Processing Intake...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-orange-400" />
                  <span>Ingest Staged Evidence</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. TAB 2: CLEAN TEXT PASTE */}
      {/* ========================================================================= */}
      {activeTab === "text" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700">FIR Statement / Police Diary</span>
            <button
              type="button"
              onClick={() => setFirText(sampleNarrative)}
              className="text-blue-700 hover:underline font-medium cursor-pointer"
            >
              Insert Sample FIR
            </button>
          </div>

          <textarea
            rows={6}
            value={firText}
            onChange={(e) => setFirText(e.target.value)}
            placeholder="Paste FIR narrative, witness statement, or suspect notes..."
            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-800 font-mono leading-relaxed focus:outline-hidden focus:border-blue-600 focus:bg-white"
          />

          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-mono">{firText.length} characters</span>
            <button
              onClick={handleProcessDirectText}
              disabled={isAnyLoading || !firText.trim()}
              className="flex items-center gap-1.5 py-2 px-4 rounded-lg bg-[#0A2540] hover:bg-[#143d6a] text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              {firTextLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-400" />
                  <span>Extracting...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                  <span>Extract &amp; Map Entities</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. TAB 3: CLEAN 1-CLICK DEMO */}
      {/* ========================================================================= */}
      {activeTab === "demo" && (
        <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-3">
          <div>
            <span className="text-xs font-bold text-slate-900 block">Demonstration Dataset</span>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
              Instantly loads synthetic Banking ledgers (25+ transactions), Telecom CDR logs (40+ calls), and FIR-992 case dossier into the Neo4j graph for analysis.
            </p>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-200">
            <span className="text-xs text-slate-500 font-mono">
              Target: <strong className="text-slate-800">{targetCaseId}</strong>
            </span>

            <button
              onClick={handleLoadDemoData}
              disabled={isAnyLoading}
              className="flex items-center gap-1.5 py-2 px-4 rounded-lg bg-[#0A2540] hover:bg-[#143d6a] text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {demoLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-400" />
                  <span>Loading Dataset...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-orange-400 fill-current" />
                  <span>Load Demo Network</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Active Pipeline Spinner Banner */}
      {currentStep && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 flex items-center gap-2 text-xs text-blue-900">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-700 shrink-0" />
          <span className="font-medium truncate">{currentStep}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. COLLAPSIBLE ACTIVITY LOG (Clean & Uncluttered) */}
      {/* ========================================================================= */}
      <div className="pt-2 border-t border-slate-100">
        <button
          onClick={() => setShowLogs(!showLogs)}
          className="flex items-center justify-between w-full text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-1.5">
            <Activity className="w-3 h-3 text-slate-400" />
            Activity Log ({logs.length})
          </span>
          {showLogs ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {showLogs && (
          <div className="max-h-24 overflow-y-auto space-y-1 mt-2 text-[10px] font-mono pr-1">
            {logs.map((log) => (
              <div key={log.id} className="flex items-center justify-between py-1 px-2 rounded bg-slate-50 text-slate-600">
                <span className="truncate flex-1">{log.message}</span>
                <span className="text-slate-400 ml-2 shrink-0">{log.timestamp}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
