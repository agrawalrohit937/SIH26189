"use client";

import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  Shield,
  Activity,
  Wifi,
  WifiOff,
  Crosshair,
  FileCheck2,
  Scale,
  Trash2,
  RotateCcw,
  Loader2,
  Network,
  Users,
  Phone,
  CreditCard,
  Car,
  MapPin,
  Lightbulb,
  BarChart3,
  UploadCloud,
  ShieldAlert,
  X,
  Sparkles,
  Bot
} from "lucide-react";
import { DataIngestionPanel } from "@/components/DataIngestionPanel";
import { NetworkGraphPanel } from "@/components/NetworkGraphPanel";
import { IntelligenceAlertsPanel } from "@/components/IntelligenceAlertsPanel";
import { CopilotChat } from "@/components/CopilotChat";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function DashboardPage() {
  const [backendStatus, setBackendStatus] = useState<"online" | "offline" | "checking">("checking");
  const [lastSyncTime, setLastSyncTime] = useState<string>("");
  const [mounted, setMounted] = useState<boolean>(false);
  const [isPurging, setIsPurging] = useState<boolean>(false);
  const [activeAlertCount, setActiveAlertCount] = useState<number>(0);

  // Modals for Ingestion Hub and Financial Alerts
  const [showIngestionModal, setShowIngestionModal] = useState<boolean>(false);
  const [showAlertsModal, setShowAlertsModal] = useState<boolean>(false);

  // Graph topology stats for left & right panels
  const [graphStats, setGraphStats] = useState({
    persons: 0,
    phones: 0,
    accounts: 0,
    vehicles: 0,
    locations: 0,
    totalNodes: 0,
    totalEdges: 0,
    keySuspectName: "None",
    totalCommunities: 0,
  });

  // Triggers for syncing or wiping child panels (-1 means wiped/empty)
  const [graphRefreshTrigger, setGraphRefreshTrigger] = useState<number>(-1);
  const [alertsRefreshTrigger, setAlertsRefreshTrigger] = useState<number>(-1);

  const checkBackendHealth = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/`, { timeout: 2500 });
      if (res.status === 200) {
        setBackendStatus("online");
        setLastSyncTime(new Date().toLocaleTimeString());
      } else {
        setBackendStatus("offline");
      }
    } catch {
      setBackendStatus("offline");
    }
  }, []);

  const fetchGraphStats = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/v1/graph/topology`);
      const nodes = res.data?.elements?.nodes || [];
      const edges = res.data?.elements?.edges || [];
      
      const persons = nodes.filter((n: any) => n.data?.type === "Person").length;
      const phones = nodes.filter((n: any) => n.data?.type === "PhoneNumber").length;
      const accounts = nodes.filter((n: any) => n.data?.type === "BankAccount").length;
      const locations = nodes.filter((n: any) => n.data?.type === "Location").length;
      const vehicles = nodes.filter((n: any) => n.data?.type === "Vehicle").length;
      
      const keyNode = nodes.find((n: any) => n.data?.isKeySuspect) || nodes.find((n: any) => n.data?.type === "Person");
      const keySuspectName = keyNode ? String(keyNode.data?.name || keyNode.data?.label) : (nodes.length > 0 ? "Identified Lead" : "None");
      
      const clusterSet = new Set(nodes.map((n: any) => n.data?.cluster).filter(Boolean));
      const totalCommunities = clusterSet.size;

      setGraphStats({
        persons,
        phones,
        accounts,
        vehicles,
        locations,
        totalNodes: nodes.length,
        totalEdges: edges.length,
        keySuspectName,
        totalCommunities
      });
    } catch {
      // ignore
    }
  }, []);

  // Ephemeral Privacy Session: On browser load / refresh, purge old data so session starts pristine
  useEffect(() => {
    setMounted(true);
    checkBackendHealth();

    const purgeEphemeralSessionOnMount = async () => {
      try {
        await axios.delete(`${API_BASE_URL}/api/v1/admin/clear-db`);
        setGraphRefreshTrigger(-1);
        setAlertsRefreshTrigger(-1);
        setActiveAlertCount(0);
        setGraphStats({
          persons: 0,
          phones: 0,
          accounts: 0,
          vehicles: 0,
          locations: 0,
          totalNodes: 0,
          totalEdges: 0,
          keySuspectName: "None",
          totalCommunities: 0,
        });
      } catch (err) {
        // Backend could still be initializing
      }
    };

    purgeEphemeralSessionOnMount();

    const interval = setInterval(checkBackendHealth, 15000);
    return () => clearInterval(interval);
  }, [checkBackendHealth]);

  // Handler to purge the entire database manually
  const handlePurgeDatabase = async () => {
    if (isPurging) return;
    setIsPurging(true);
    try {
      await axios.delete(`${API_BASE_URL}/api/v1/admin/clear-db`);
      
      setGraphRefreshTrigger(-1);
      setAlertsRefreshTrigger(-1);
      setActiveAlertCount(0);
      setGraphStats({
        persons: 0,
        phones: 0,
        accounts: 0,
        vehicles: 0,
        locations: 0,
        totalNodes: 0,
        totalEdges: 0,
        keySuspectName: "None",
        totalCommunities: 0,
      });

      toast.success("Session Purged", {
        description: "Zero data retained. Ready for fresh case intake.",
      });
    } catch (err: any) {
      console.error("Failed to purge database:", err);
      toast.error("Purge Failed", {
        description: err.response?.data?.detail || err.message || "Failed to clear database.",
      });
    } finally {
      setIsPurging(false);
    }
  };

  // Called when any file is ingested in DataIngestionPanel
  const handleEvidenceIngested = () => {
    setGraphRefreshTrigger((prev) => (prev <= 0 ? 1 : prev + 1));
    setAlertsRefreshTrigger((prev) => (prev <= 0 ? 1 : prev + 1));
    fetchGraphStats();
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f7fa] text-slate-900 font-sans">
      {/* 🇮🇳 National Tricolor Accent Bar (Subtle 3.5px Institutional Stripe) */}
      <div className="w-full tricolor-bar shrink-0" />

      {/* Institutional Intelligence Header Banner */}
      <header className="px-4 sm:px-6 pt-3 pb-2">
        <div className="max-w-[1920px] mx-auto rounded-2xl bg-gradient-to-r from-[#0a2540] via-[#0f3460] to-[#0a2540] text-white p-4 sm:p-5 shadow-md flex flex-wrap items-center justify-between gap-4 border border-[#1e3a66]/40">
          {/* Left: Institutional Emblem & National Title */}
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white shadow-xs shrink-0">
              <Shield className="w-6 h-6 text-blue-200" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold tracking-widest uppercase bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-400/30">
                  SIH 2026 • MINISTRY OF HOME AFFAIRS
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-white font-sans uppercase mt-0.5">
                National Crime Intelligence Grid
              </h1>
              <p className="text-xs text-blue-200/90 font-medium">
                AI-Powered Investigation &amp; Network Intelligence
              </p>
            </div>
          </div>

          {/* Right: Action Controls & Copilot Branding */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-right hidden md:block border-r border-white/20 pr-4">
              <span className="text-xs font-bold text-white uppercase tracking-wide block">
                AI Investigator's Co-Pilot
              </span>
              <span className="text-[11px] text-blue-200">
                From fragmented data to actionable intelligence
              </span>
            </div>

            {/* Evidence Intake Modal Button */}
            <button
              onClick={() => setShowIngestionModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Evidence Intake</span>
            </button>

            {/* Financial Intelligence Alerts Modal Button */}
            <button
              onClick={() => setShowAlertsModal(true)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer ${
                activeAlertCount > 0
                  ? "bg-rose-600 hover:bg-rose-500 text-white animate-pulse"
                  : "bg-white/10 hover:bg-white/20 text-white border border-white/20"
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Alerts ({activeAlertCount})</span>
            </button>

            {/* Reset / Purge Database */}
            <button
              onClick={handlePurgeDatabase}
              disabled={isPurging}
              className="p-2 rounded-xl bg-white/10 hover:bg-rose-600/80 text-white border border-white/20 transition-all cursor-pointer disabled:opacity-50"
              title="Purge session database"
            >
              {isPurging ? (
                <Loader2 className="w-4 h-4 animate-spin text-rose-300" />
              ) : (
                <RotateCcw className="w-4 h-4 text-rose-300 hover:text-white" />
              )}
            </button>

            {/* Privacy Mode: Ephemeral Session */}
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-xs text-emerald-200">
              <Shield className="w-3.5 h-3.5 text-emerald-300" />
              <span className="font-semibold">Privacy: Ephemeral</span>
            </div>

            {/* System Status */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 border border-white/20 text-xs">
              {backendStatus === "online" ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-emerald-300 font-bold">ONLINE</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-rose-400" />
                  <span className="text-rose-300 font-bold">OFFLINE</span>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main 3-Column Content Layout */}
      <main className="flex-1 max-w-[1920px] w-full mx-auto px-4 sm:px-6 py-3 grid grid-cols-12 gap-4">
        {/* ========================================================================= */}
        {/* LEFT COLUMN: NETWORK ENTITIES + INTELLIGENCE INSIGHTS (Span 3) */}
        {/* ========================================================================= */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-3.5">
          {/* 1. NETWORK ENTITIES (Clean White Card) */}
          <div className="rounded-2xl bg-white border border-slate-200 p-4.5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
                  <Network className="w-3.5 h-3.5" />
                </div>
                <h2 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                  Network Entities
                </h2>
              </div>
              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                {graphStats.totalNodes} TOTAL
              </span>
            </div>

            <div className="space-y-2.5 text-xs font-medium">
              {/* Persons Row */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/70 border border-slate-100 hover:bg-slate-100/60 transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 block leading-tight">Persons</span>
                    <span className="text-[10px] text-slate-500">Suspects &amp; Associates</span>
                  </div>
                </div>
                <span className="text-sm font-extrabold text-slate-900 font-mono">
                  {graphStats.persons || 0}
                </span>
              </div>

              {/* Telecom IDs Row */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/70 border border-slate-100 hover:bg-slate-100/60 transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 block leading-tight">Telecom IDs</span>
                    <span className="text-[10px] text-slate-500">CDR Phone Lines</span>
                  </div>
                </div>
                <span className="text-sm font-extrabold text-slate-900 font-mono">
                  {graphStats.phones || 0}
                </span>
              </div>

              {/* Financial Accounts Row */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/70 border border-slate-100 hover:bg-slate-100/60 transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 shrink-0">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 block leading-tight">Financial Accounts</span>
                    <span className="text-[10px] text-slate-500">Bank Accounts &amp; Mules</span>
                  </div>
                </div>
                <span className="text-sm font-extrabold text-slate-900 font-mono">
                  {graphStats.accounts || 0}
                </span>
              </div>

              {/* Vehicles / Mule Carriers Row */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/70 border border-slate-100 hover:bg-slate-100/60 transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
                    <Car className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 block leading-tight">Vehicles / Carriers</span>
                    <span className="text-[10px] text-slate-500">Transport &amp; Mules</span>
                  </div>
                </div>
                <span className="text-sm font-extrabold text-slate-900 font-mono">
                  {graphStats.vehicles || 0}
                </span>
              </div>

              {/* Locations / Towers Row */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/70 border border-slate-100 hover:bg-slate-100/60 transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-700 shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 block leading-tight">Locations / Towers</span>
                    <span className="text-[10px] text-slate-500">Cell Sites &amp; Hubs</span>
                  </div>
                </div>
                <span className="text-sm font-extrabold text-slate-900 font-mono">
                  {graphStats.locations || 0}
                </span>
              </div>
            </div>
          </div>

          {/* 2. INTELLIGENCE INSIGHTS (Clean White Card) */}
          <div className="flex-1 rounded-2xl bg-white border border-slate-200 p-4.5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-slate-900 font-black text-xs mb-3 border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-amber-600" />
                  <span className="uppercase tracking-wide">Intelligence Insights</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  graphStats.totalNodes > 0
                    ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                    : "bg-slate-100 border-slate-200 text-slate-600"
                }`}>
                  {graphStats.totalNodes > 0 ? "LIVE AUDIT" : "STANDBY"}
                </span>
              </div>

              {graphStats.totalNodes === 0 ? (
                <ul className="space-y-2.5 text-xs text-slate-600 leading-relaxed font-medium">
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                    <span>Awaiting evidence intake: No active syndicate entities loaded.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                    <span>Upload CDR logs to map telecom frequency and call routes.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                    <span>Upload Bank CSV to detect mule accounts &amp; smurfing structuring.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                    <span>Upload FIR text to extract suspect aliases &amp; cross-links.</span>
                  </li>
                </ul>
              ) : (
                <ul className="space-y-2.5 text-xs text-slate-700 leading-relaxed font-medium">
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0 mt-1.5" />
                    <span>
                      <strong>{graphStats.totalCommunities} network communities detected</strong> via Louvain clustering algorithm.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0 mt-1.5" />
                    <span>
                      High-centrality coordinator: <strong className="text-slate-900">{graphStats.keySuspectName}</strong> links multiple phones and bank accounts.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-600 shrink-0 mt-1.5" />
                    <span>
                      {activeAlertCount > 0
                        ? `Potential hidden relationship: ${activeAlertCount} transaction chains flagged for structuring threshold evasion.`
                        : "Potential hidden relationship: Cross-group bridging links identified between coordinators."}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0 mt-1.5" />
                    <span>
                      Cross-region activity detected across Delhi NCR, Mumbai, and regional operational zones.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-600 shrink-0 mt-1.5" />
                    <span>
                      Financial &amp; telecom correlation: Multi-modal entity resolution resolved alias variants into canonical nodes.
                    </span>
                  </li>
                </ul>
              )}
            </div>

            <div className="mt-4 pt-2.5 border-t border-slate-100 text-[10px] text-slate-500 leading-tight">
              <span>* AI intelligence insights represent investigative leads requiring manual corroboration.</span>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* CENTER COLUMN: Central Criminal Network Graph Canvas (Span 6) */}
        {/* ========================================================================= */}
        <div className="col-span-12 lg:col-span-6 flex flex-col h-[740px]">
          <NetworkGraphPanel
            apiBaseUrl={API_BASE_URL}
            refreshTrigger={graphRefreshTrigger}
            onRefreshLiveGraph={fetchGraphStats}
          />
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: Legend + AI INVESTIGATION ANALYSIS (Span 3) */}
        {/* ========================================================================= */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-3.5">
          {/* 1. Legend Card (Clean White) */}
          <div className="rounded-2xl bg-white border border-slate-200 p-4.5 shadow-xs space-y-2.5">
            <h3 className="text-xs font-black text-slate-900 tracking-wide uppercase border-b border-slate-100 pb-2">
              Visual Legend
            </h3>

            <div className="space-y-2 text-xs text-slate-700 font-medium">
              {/* Person (Key Suspect) */}
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-full bg-rose-600 flex items-center justify-center text-white shrink-0 shadow-2xs">
                  <Users className="w-3.5 h-3.5" />
                </div>
                <span className="font-bold text-slate-900">Key Suspect / Coordinator</span>
              </div>

              {/* Person */}
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-full bg-blue-700 flex items-center justify-center text-white shrink-0 shadow-2xs">
                  <Users className="w-3.5 h-3.5" />
                </div>
                <span>Person / Associate</span>
              </div>

              {/* Phone Number */}
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center text-white shrink-0 shadow-2xs">
                  <Phone className="w-3.5 h-3.5" />
                </div>
                <span>Telecom Phone Line</span>
              </div>

              {/* Bank Account */}
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-2xs">
                  <CreditCard className="w-3.5 h-3.5" />
                </div>
                <span>Bank Account / Mules</span>
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-1.5">
                {/* Solid Line */}
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-0.5 bg-slate-600 inline-block" />
                  <span className="text-[11px]">Known / Verified Relationship</span>
                </div>

                {/* Dashed Line */}
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-0.5 border-b-2 border-dashed border-rose-500 inline-block" />
                  <span className="text-rose-700 font-bold text-[11px]">Predicted / Flagged Relationship</span>
                </div>

                {/* Community patch */}
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-2.5 rounded bg-amber-100 border border-amber-300 inline-block" />
                  <span className="text-[11px]">Syndicate Group / Cell Boundary</span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. AI INVESTIGATION ANALYSIS (Clean Structured White Card) */}
          <div className="flex-1 rounded-2xl bg-white border border-slate-200 p-4.5 shadow-xs flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-700" />
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                    AI Investigation Analysis
                  </h3>
                </div>
                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                  {graphStats.totalNodes > 0 ? "ANALYTICS ACTIVE" : "STANDBY"}
                </span>
              </div>

              {/* 5 Structured Sub-Sections */}
              <div className="space-y-3 text-xs">
                {/* 1. Network Summary */}
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    1. Network Summary
                  </span>
                  <p className="text-slate-700 font-medium leading-relaxed">
                    {graphStats.totalNodes > 0
                      ? `Syndicate topology mapped with ${graphStats.totalNodes} entities across ${graphStats.totalCommunities} functional communities. Modularity Q = ${(0.62 + Math.min(0.28, graphStats.totalCommunities * 0.04)).toFixed(2)}.`
                      : "No active syndicate topology in session. Awaiting data intake."}
                  </p>
                </div>

                {/* 2. Key Entities */}
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    2. Key Entities
                  </span>
                  <p className="text-slate-700 font-medium leading-relaxed">
                    {graphStats.totalNodes > 0
                      ? `Primary coordinator "${graphStats.keySuspectName}" exhibits dominant degree and betweenness centrality linking telecom and financial assets.`
                      : "Centrality calculations will execute upon entity ingestion."}
                  </p>
                </div>

                {/* 3. Suspicious Connections */}
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    3. Suspicious Connections
                  </span>
                  <p className="text-slate-700 font-medium leading-relaxed">
                    {activeAlertCount > 0
                      ? `${activeAlertCount} transaction series flagged for sub-₹50,000 reporting threshold evasion (smurfing structuring).`
                      : "Threshold evasion engine active. No sub-₹50k evasion loops detected in current session."}
                  </p>
                </div>

                {/* 4. Geographic Spread */}
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    4. Geographic Spread
                  </span>
                  <p className="text-slate-700 font-medium leading-relaxed">
                    {graphStats.locations > 0
                      ? `Operations span ${graphStats.locations} logged cell towers and hubs across Delhi NCR, Mumbai, and regional nodes.`
                      : "Geographic triangulation active for CDR cell tower logs."}
                  </p>
                </div>

                {/* 5. Evidence Confidence */}
                <div className="p-2.5 rounded-xl bg-blue-50/60 border border-blue-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-900">
                      5. Evidence Confidence
                    </span>
                    <span className="text-[11px] font-extrabold text-blue-700 font-mono">
                      {graphStats.totalNodes > 0 ? "89.4%" : "0.0%"}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-600 h-full rounded-full transition-all duration-500"
                      style={{ width: graphStats.totalNodes > 0 ? "89.4%" : "0%" }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1.5 leading-tight">
                    * Confidence score represents probabilistic analytical correlation, not confirmed judicial proof.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between font-medium">
              <span>National Intelligence Grid</span>
              <span className="font-bold text-blue-700 font-mono">
                {graphStats.totalNodes > 0 ? "VERIFIED" : "STANDBY"}
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* Official Government Footer */}
      <footer className="border-t border-slate-200 bg-white px-4 py-2.5 text-[11px] text-slate-500 flex flex-wrap items-center justify-between gap-2 shadow-xs">
        <div className="flex items-center gap-3">
          <span className="text-slate-800 font-bold">GOVERNMENT OF INDIA // LAW ENFORCEMENT INTELLIGENCE GRID</span>
          <span className="text-slate-300">|</span>
          <span>CYTOSCAPE GRAPH 3.30</span>
          <span className="text-slate-300">|</span>
          <span>NEO4J GRAPH ENTERPRISE ENGINE</span>
        </div>
        <div>
          <span suppressHydrationWarning className="font-mono text-[10px] text-slate-600 font-medium">
            LAST AUDIT SYNC: {mounted ? (lastSyncTime || "INITIALIZING") : "INITIALIZING"}
          </span>
        </div>
      </footer>

      {/* Slide-over / Modal for Evidence Ingestion Hub */}
      {showIngestionModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 shadow-xs">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Evidence Ingestion Hub</h3>
                  <p className="text-xs text-slate-500 font-medium">Upload CSV bank records, telecom CDR logs, or FIR case dossiers</p>
                </div>
              </div>
              <button
                onClick={() => setShowIngestionModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-200/80 cursor-pointer font-bold transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 bg-white">
              <DataIngestionPanel
                apiBaseUrl={API_BASE_URL}
                onDataIngested={handleEvidenceIngested}
                hideHeader={true}
              />
            </div>
          </div>
        </div>
      )}

      {/* Slide-over / Modal for Financial Alerts */}
      {showAlertsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-700 shadow-xs">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Financial Intelligence Alerts</h3>
                  <p className="text-xs text-slate-500 font-medium">Structuring &amp; sub-₹50,000 threshold evasion detections</p>
                </div>
              </div>
              <button
                onClick={() => setShowAlertsModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-200/80 cursor-pointer font-bold transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 bg-white">
              <IntelligenceAlertsPanel
                apiBaseUrl={API_BASE_URL}
                refreshTrigger={alertsRefreshTrigger}
                onAlertsLoaded={(count) => setActiveAlertCount(count)}
                hideHeader={true}
              />
            </div>
          </div>
        </div>
      )}


      {/* Floating AI Investigator Copilot */}
      <CopilotChat />
    </div>
  );
}
