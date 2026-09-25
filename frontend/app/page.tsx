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
  Bot,
  Maximize,
  Minimize
} from "lucide-react";
import { DataIngestionPanel } from "@/components/DataIngestionPanel";
import { NetworkGraphPanel } from "@/components/NetworkGraphPanel";
import { IntelligenceAlertsPanel } from "@/components/IntelligenceAlertsPanel";
import { CopilotChat } from "@/components/CopilotChat";
import { GATLinkPredictionPanel } from "@/components/GATLinkPredictionPanel";
import { GeoIntelligenceModal } from "@/components/GeoIntelligenceModal";
import { BriefingGeneratorModal } from "@/components/BriefingGeneratorModal";
import { AuthLoginModal } from "@/components/AuthLoginModal";

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

  // V2 Feature Modals
  const [showGATModal, setShowGATModal] = useState<boolean>(false);
  const [showGeoModal, setShowGeoModal] = useState<boolean>(false);
  const [showBriefingModal, setShowBriefingModal] = useState<boolean>(false);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [briefingSubject, setBriefingSubject] = useState<string>("Jagrati Sibal");
  const [currentRole, setCurrentRole] = useState<string>("Supervisor");
  const [currentUsername, setCurrentUsername] = useState<string>("supervisor");

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
  const [isAppFullscreen, setIsAppFullscreen] = useState<boolean>(false);

  // App-level fullscreen toggle
  const toggleAppFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsAppFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsAppFullscreen(false);
      }
    } catch (err) {
      console.warn("App fullscreen toggle error:", err);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsAppFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

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
    <div className="h-screen max-h-screen flex flex-col bg-[#f5f7fa] text-slate-900 font-sans overflow-hidden select-none">
      {/* 🇮🇳 National Tricolor Accent Bar (Subtle 3px Institutional Stripe) */}
      <div className="w-full tricolor-bar shrink-0" />

      {/* Institutional Intelligence Header Banner */}
      <header className="px-3 sm:px-4 pt-2 pb-1.5 shrink-0">
        <div className="max-w-[1920px] mx-auto rounded-xl bg-slate-950/95 backdrop-blur-md text-white px-4 py-2.5 shadow-md flex flex-wrap items-center justify-between gap-3 border border-slate-800/80">
          {/* Left: Institutional Emblem & National Title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-800 border border-blue-400/40 flex items-center justify-center text-white shadow-xs shrink-0">
              <Shield className="w-5 h-5 text-white" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black tracking-widest uppercase bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded border border-amber-400/30 leading-none">
                  SIH 2026 • MINISTRY OF HOME AFFAIRS
                </span>
              </div>
              <h1 className="text-base sm:text-lg font-black tracking-tight text-white font-sans uppercase mt-0.5 leading-tight">
                National Crime Intelligence Grid
              </h1>
              <p className="text-[11px] text-slate-400 font-medium leading-none hidden sm:block">
                AI Criminal Network &amp; Anti-Money Laundering Intelligence System
              </p>
            </div>
          </div>

          {/* Right: Action Controls & Navigation Group */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Evidence Intake Modal Button */}
            <button
              onClick={() => setShowIngestionModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold shadow-sm shadow-blue-500/20 transition-all cursor-pointer"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Evidence Intake</span>
            </button>

            {/* Financial & Evasion Alerts Modal Button */}
            <button
              onClick={() => setShowAlertsModal(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer ${
                activeAlertCount > 0
                  ? "bg-rose-600 hover:bg-rose-500 text-white animate-pulse"
                  : "bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700"
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              <span>Alerts ({activeAlertCount})</span>
            </button>

            {/* GAT AI Link Prediction Button */}
            <button
              onClick={() => setShowGATModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-200 text-xs font-bold border border-purple-500/40 shadow-xs transition-all cursor-pointer"
              title="Graph Attention Network Link Predictions"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-300" />
              <span>GAT Links</span>
            </button>

            {/* Geo-Intelligence GIS Map Button */}
            <button
              onClick={() => setShowGeoModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-200 text-xs font-bold border border-emerald-500/40 shadow-xs transition-all cursor-pointer"
              title="Geospatial Hubs & BTS Tower Triangulation"
            >
              <MapPin className="w-3.5 h-3.5 text-emerald-300" />
              <span>GIS Map</span>
            </button>

            {/* Officer Briefing Generator Button */}
            <button
              onClick={() => setShowBriefingModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-200 text-xs font-bold border border-indigo-500/40 shadow-xs transition-all cursor-pointer"
              title="Generate Officer Intelligence Dossier"
            >
              <FileCheck2 className="w-3.5 h-3.5 text-indigo-300" />
              <span>Briefing</span>
            </button>

            {/* RBAC Role Switcher Badge Button */}
            <button
              onClick={() => setShowAuthModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700/80 transition-all cursor-pointer shadow-xs"
              title="Click to Switch Demo RBAC Role (Investigator / Supervisor / Admin)"
            >
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span>{currentRole}</span>
            </button>

            {/* Reset / Purge Database */}
            <button
              onClick={handlePurgeDatabase}
              disabled={isPurging}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-rose-600/80 text-rose-300 hover:text-white border border-slate-700 transition-all cursor-pointer disabled:opacity-50"
              title="Purge session database"
            >
              {isPurging ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-300" />
              ) : (
                <RotateCcw className="w-3.5 h-3.5" />
              )}
            </button>

            {/* System Status Pill */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px]">
              {backendStatus === "online" ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-emerald-400 font-extrabold font-mono">ONLINE</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span className="text-rose-400 font-extrabold font-mono">OFFLINE</span>
                </>
              )}
            </div>

            {/* Fullscreen App Toggle */}
            <button
              onClick={toggleAppFullscreen}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-white border border-slate-700 text-xs font-bold transition-all cursor-pointer shadow-xs"
              title={isAppFullscreen ? "Exit App Fullscreen (ESC)" : "Expand App to Full Screen"}
            >
              {isAppFullscreen ? (
                <>
                  <Minimize className="w-3.5 h-3.5 text-amber-300" />
                  <span className="hidden sm:inline">Exit Fullscreen</span>
                </>
              ) : (
                <>
                  <Maximize className="w-3.5 h-3.5 text-blue-300" />
                  <span className="hidden sm:inline">Full Screen</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main 3-Column Content Layout (Single-Screen Viewport Constrained) */}
      <main className="flex-1 min-h-0 max-w-[1920px] w-full mx-auto px-3 sm:px-4 py-1.5 grid grid-cols-12 gap-3 overflow-hidden">
        {/* ========================================================================= */}
        {/* LEFT COLUMN: NETWORK ENTITIES + INTELLIGENCE INSIGHTS (Span 3) */}
        {/* ========================================================================= */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-2.5 h-full min-h-0 overflow-hidden">
          {/* 1. NETWORK ENTITIES (Clean Compact Card) */}
          <div className="rounded-xl bg-white border border-slate-200 p-3 shadow-xs space-y-2 shrink-0">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
                  <Network className="w-3 h-3" />
                </div>
                <h2 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                  Network Entities
                </h2>
              </div>
              <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">
                {graphStats.totalNodes} TOTAL
              </span>
            </div>

            <div className="grid grid-cols-1 gap-1.5 text-xs font-medium">
              {/* Persons Row */}
              <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-slate-50/80 border border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 shrink-0">
                    <Users className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 block leading-tight text-xs">Persons</span>
                    <span className="text-[9px] text-slate-500 leading-none block">Suspects &amp; Associates</span>
                  </div>
                </div>
                <span className="text-xs font-extrabold text-slate-900 font-mono">
                  {graphStats.persons || 0}
                </span>
              </div>

              {/* Telecom IDs Row */}
              <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-slate-50/80 border border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
                    <Phone className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 block leading-tight text-xs">Telecom IDs</span>
                    <span className="text-[9px] text-slate-500 leading-none block">CDR Phone Lines</span>
                  </div>
                </div>
                <span className="text-xs font-extrabold text-slate-900 font-mono">
                  {graphStats.phones || 0}
                </span>
              </div>

              {/* Financial Accounts Row */}
              <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-slate-50/80 border border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 shrink-0">
                    <CreditCard className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 block leading-tight text-xs">Financial Accounts</span>
                    <span className="text-[9px] text-slate-500 leading-none block">Bank Accounts &amp; Mules</span>
                  </div>
                </div>
                <span className="text-xs font-extrabold text-slate-900 font-mono">
                  {graphStats.accounts || 0}
                </span>
              </div>

              {/* Vehicles & Locations in 2-column micro row */}
              <div className="grid grid-cols-2 gap-1.5">
                <div className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-slate-50/80 border border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
                      <Car className="w-3 h-3" />
                    </div>
                    <span className="font-bold text-slate-800 text-[10px]">Vehicles</span>
                  </div>
                  <span className="text-xs font-extrabold text-slate-900 font-mono">
                    {graphStats.vehicles || 0}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-slate-50/80 border border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-700 shrink-0">
                      <MapPin className="w-3 h-3" />
                    </div>
                    <span className="font-bold text-slate-800 text-[10px]">Locations</span>
                  </div>
                  <span className="text-xs font-extrabold text-slate-900 font-mono">
                    {graphStats.locations || 0}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. INTELLIGENCE INSIGHTS (Clean Structured Card with Scroll if needed) */}
          <div className="flex-1 min-h-0 rounded-xl bg-white border border-slate-200 p-3 shadow-xs flex flex-col justify-between overflow-hidden">
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between text-slate-900 font-black text-xs mb-2 border-b border-slate-100 pb-1.5 shrink-0">
                <div className="flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                  <span className="uppercase tracking-wide">Intelligence Insights</span>
                </div>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                  graphStats.totalNodes > 0
                    ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                    : "bg-slate-100 border-slate-200 text-slate-600"
                }`}>
                  {graphStats.totalNodes > 0 ? "LIVE AUDIT" : "STANDBY"}
                </span>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2 text-xs text-slate-700 leading-relaxed font-medium">
                {graphStats.totalNodes === 0 ? (
                  <ul className="space-y-2 text-[11px] text-slate-600 leading-relaxed font-medium">
                    <li className="flex items-start gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                      <span>Awaiting evidence intake: No active syndicate entities loaded.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                      <span>Upload CDR logs to map telecom frequency and call routes.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                      <span>Upload Bank CSV to detect mule accounts &amp; smurfing structuring.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                      <span>Upload FIR text to extract suspect aliases &amp; cross-links.</span>
                    </li>
                  </ul>
                ) : (
                  <ul className="space-y-2 text-[11px] text-slate-700 leading-relaxed font-medium">
                    <li className="flex items-start gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0 mt-1" />
                      <span>
                        <strong>{graphStats.totalCommunities} network communities detected</strong> via Louvain clustering.
                      </span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0 mt-1" />
                      <span>
                        High-centrality coordinator: <strong className="text-slate-900">{graphStats.keySuspectName}</strong> links telecom &amp; financial assets.
                      </span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-600 shrink-0 mt-1" />
                      <span>
                        {activeAlertCount > 0
                          ? `Cross-community relationship & ${activeAlertCount} transaction series flagged for review.`
                          : "Cross-community bridging links identified between coordinators."}
                      </span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0 mt-1" />
                      <span>
                        Cross-region activity detected across synthetic operational zones.
                      </span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-600 shrink-0 mt-1" />
                      <span>
                        Multi-modal entity resolution resolved alias variants into canonical nodes.
                      </span>
                    </li>
                  </ul>
                )}
              </div>
            </div>

            <div className="mt-2 pt-1.5 border-t border-slate-100 text-[9px] text-slate-500 leading-tight shrink-0">
              <span>* AI intelligence leads require manual human corroboration.</span>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* CENTER COLUMN: Central Criminal Network Graph Canvas (Span 6) */}
        {/* ========================================================================= */}
        <div className="col-span-12 lg:col-span-6 flex flex-col h-full min-h-0">
          <NetworkGraphPanel
            apiBaseUrl={API_BASE_URL}
            refreshTrigger={graphRefreshTrigger}
            onRefreshLiveGraph={fetchGraphStats}
            onOpenBriefing={(target) => {
              setBriefingSubject(target);
              setShowBriefingModal(true);
            }}
          />
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: Legend + AI INVESTIGATION ANALYSIS (Span 3) */}
        {/* ========================================================================= */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-2.5 h-full min-h-0 overflow-hidden">
          {/* 1. Legend Card (Clean Compact) */}
          <div className="rounded-xl bg-white border border-slate-200 p-3 shadow-xs space-y-1.5 shrink-0">
            <h3 className="text-xs font-black text-slate-900 tracking-wide uppercase border-b border-slate-100 pb-1">
              Visual Legend
            </h3>

            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-slate-700 font-medium">
              {/* Person (Key Suspect) */}
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full bg-rose-600 flex items-center justify-center text-white shrink-0">
                  <Users className="w-2.5 h-2.5" />
                </div>
                <span className="font-bold text-slate-900 text-[10px]">Key Suspect</span>
              </div>

              {/* Person */}
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full bg-blue-700 flex items-center justify-center text-white shrink-0">
                  <Users className="w-2.5 h-2.5" />
                </div>
                <span className="text-[10px]">Associate</span>
              </div>

              {/* Phone Number */}
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full bg-emerald-600 flex items-center justify-center text-white shrink-0">
                  <Phone className="w-2.5 h-2.5" />
                </div>
                <span className="text-[10px]">Phone Line</span>
              </div>

              {/* Bank Account */}
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full bg-sky-600 flex items-center justify-center text-white shrink-0">
                  <CreditCard className="w-2.5 h-2.5" />
                </div>
                <span className="text-[10px]">Bank A/C</span>
              </div>

              {/* Location */}
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full bg-purple-600 flex items-center justify-center text-white shrink-0">
                  <MapPin className="w-2.5 h-2.5" />
                </div>
                <span className="text-[10px]">Cell Site</span>
              </div>

              {/* Vehicle */}
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full bg-amber-600 flex items-center justify-center text-white shrink-0">
                  <Car className="w-2.5 h-2.5" />
                </div>
                <span className="text-[10px]">Vehicle</span>
              </div>
            </div>

            <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
              <div className="flex items-center gap-1">
                <span className="w-3.5 h-0.5 bg-slate-600 inline-block" />
                <span>Verified Link</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-3.5 h-0.5 border-b-2 border-dashed border-rose-500 inline-block" />
                <span className="text-rose-700 font-bold">Predicted Link</span>
              </div>
            </div>
          </div>

          {/* 2. AI INVESTIGATION ANALYSIS (5 Structured Sections) */}
          <div className="flex-1 min-h-0 rounded-xl bg-white border border-slate-200 p-3 shadow-xs flex flex-col justify-between overflow-hidden">
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 shrink-0">
                <div className="flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5 text-blue-700" />
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                    AI Investigation Analysis
                  </h3>
                </div>
                <span className="text-[9px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-full border border-blue-200">
                  {graphStats.totalNodes > 0 ? "ACTIVE" : "STANDBY"}
                </span>
              </div>

              {/* 5 Structured Sub-Sections with smooth scroll */}
              <div className="flex-1 min-h-0 overflow-y-auto pr-1 mt-2 space-y-2 text-xs">
                {/* 1. Network Summary */}
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500 block">
                    1. Network Summary
                  </span>
                  <p className="text-slate-700 font-medium text-[11px] leading-snug mt-0.5">
                    {graphStats.totalNodes > 0
                      ? `${graphStats.totalNodes} entities connected across ${graphStats.totalCommunities} detected communities.`
                      : "No active syndicate topology in session."}
                  </p>
                </div>

                {/* 2. Key Entities */}
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500 block">
                    2. Key Entities
                  </span>
                  <p className="text-slate-700 font-medium text-[11px] leading-snug mt-0.5">
                    {graphStats.totalNodes > 0
                      ? `"${graphStats.keySuspectName}" shows high centrality across telecom and financial links.`
                      : "Centrality calculations execute on ingestion."}
                  </p>
                </div>

                {/* 3. Suspicious Connections */}
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500 block">
                    3. Suspicious Connections
                  </span>
                  <p className="text-slate-700 font-medium text-[11px] leading-snug mt-0.5">
                    {activeAlertCount > 0
                      ? `A cross-community link & ${activeAlertCount} transaction series flagged for human verification.`
                      : "Cross-community relationship flagged for human verification."}
                  </p>
                </div>

                {/* 4. Geographic Spread */}
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500 block">
                    4. Geographic Spread
                  </span>
                  <p className="text-slate-700 font-medium text-[11px] leading-snug mt-0.5">
                    {graphStats.locations > 0
                      ? `Activity appears across ${graphStats.locations} synthetic geographic zones.`
                      : "Activity mapped across synthetic reference zones."}
                  </p>
                </div>

                {/* 5. Evidence Confidence */}
                <div className="p-2 rounded-lg bg-blue-50/60 border border-blue-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-blue-900">
                      5. Evidence Confidence
                    </span>
                    <span className="text-[10px] font-extrabold text-blue-700 font-mono">
                      {graphStats.totalNodes > 0 ? "0.89 (89.4%)" : "0.00"}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-600 h-full rounded-full transition-all duration-500"
                      style={{ width: graphStats.totalNodes > 0 ? "89.4%" : "0%" }}
                    />
                  </div>
                  <p className="text-[9px] text-slate-600 mt-1 leading-tight font-medium">
                    Status: <strong>Requires human verification</strong> • Lead only.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-2 pt-1.5 border-t border-slate-100 text-[10px] text-slate-500 flex items-center justify-between font-medium shrink-0">
              <span>National Intelligence Grid</span>
              <span className="font-bold text-blue-700 font-mono">
                {graphStats.totalNodes > 0 ? "AUDIT READY" : "STANDBY"}
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* Official SIH 2026 Institutional Footer */}
      <footer className="border-t border-slate-200 bg-white px-4 py-1.5 text-[10px] text-slate-500 flex flex-wrap items-center justify-between gap-2 shadow-2xs shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="text-slate-800 font-bold">SIH 2026 • MINISTRY OF HOME AFFAIRS</span>
          <span className="text-slate-300">|</span>
          <span className="text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-[9px]">
            SYNTHETIC DEMO DATA
          </span>
          <span className="text-slate-300">|</span>
          <span>NEO4J GRAPH DATABASE</span>
          <span className="text-slate-300">|</span>
          <span>CYTOSCAPE HYBRID ENGINE</span>
        </div>
        <div>
          <span suppressHydrationWarning className="font-mono text-[9px] text-slate-600 font-medium">
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
                  <p className="text-xs text-slate-500 font-medium">Demo-configurable structuring evasion analysis (FIU / AML decision support)</p>
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

      {/* GAT Link Prediction Modal */}
      <GATLinkPredictionPanel
        apiBaseUrl={API_BASE_URL}
        isOpen={showGATModal}
        onClose={() => setShowGATModal(false)}
        onLinkConfirmed={() => {
          setGraphRefreshTrigger((prev) => (prev <= 0 ? 1 : prev + 1));
          fetchGraphStats();
        }}
      />

      {/* Geo-Intelligence GIS Map Modal */}
      <GeoIntelligenceModal
        apiBaseUrl={API_BASE_URL}
        isOpen={showGeoModal}
        onClose={() => setShowGeoModal(false)}
        onSelectEntity={(name) => {
          setBriefingSubject(name);
          setShowGeoModal(false);
          setShowBriefingModal(true);
        }}
      />

      {/* Officer Intelligence Briefing Generator Modal */}
      <BriefingGeneratorModal
        apiBaseUrl={API_BASE_URL}
        isOpen={showBriefingModal}
        onClose={() => setShowBriefingModal(false)}
        defaultEntityName={briefingSubject}
      />

      {/* RBAC Demo Role Login Modal */}
      <AuthLoginModal
        apiBaseUrl={API_BASE_URL}
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        currentRole={currentRole}
        currentUsername={currentUsername}
        onLoginSuccess={(token, user) => {
          setCurrentRole(user.role);
          setCurrentUsername(user.username);
          setGraphRefreshTrigger((prev) => (prev <= 0 ? 1 : prev + 1));
          fetchGraphStats();
        }}
      />

      {/* Floating AI Investigator Copilot */}
      <CopilotChat />
    </div>
  );
}
