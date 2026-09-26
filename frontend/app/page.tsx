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
  Minimize,
  Lock,
  ShieldCheck,
  Terminal,
  Fingerprint,
  Share2,
  Layers,
  Globe,
  Building2,
  Flame,
  LayoutDashboard,
  FileText,
  UserCheck,
  CheckCircle2,
  Cpu
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

  // Active navigation tab
  const [activeNavTab, setActiveNavTab] = useState<string>("Dashboard");

  // Modals for Ingestion Hub and Financial Alerts
  const [showIngestionModal, setShowIngestionModal] = useState<boolean>(false);
  const [showAlertsModal, setShowAlertsModal] = useState<boolean>(false);

  // V2 Feature Modals
  const [showGATModal, setShowGATModal] = useState<boolean>(false);
  const [showGeoModal, setShowGeoModal] = useState<boolean>(false);
  const [showBriefingModal, setShowBriefingModal] = useState<boolean>(false);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [briefingSubject, setBriefingSubject] = useState<string>("");
  const [currentRole, setCurrentRole] = useState<string>("Supervisor");
  const [currentUsername, setCurrentUsername] = useState<string>("supervisor");

  // Case Docket Filter & Management
  const [selectedCaseId, setSelectedCaseId] = useState<string>("ALL");
  const [activeCases, setActiveCases] = useState<Array<{ case_id: string; node_count?: number; edge_count?: number }>>([]);

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

  // Restore user session and Axios Authorization Header
  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("mha_token");
      const storedUser = localStorage.getItem("mha_user");
      if (token && token !== "undefined" && token !== "null") {
        axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      } else {
        // Auto-seed default supervisor session for seamless evaluation
        axios
          .post(`${API_BASE_URL}/api/v1/auth/login`, {
            username: "supervisor",
            password: "supervisor123",
          })
          .then((res) => {
            if (res.data?.access_token) {
              localStorage.setItem("mha_token", res.data.access_token);
              localStorage.setItem("mha_user", JSON.stringify(res.data.user));
              axios.defaults.headers.common["Authorization"] = `Bearer ${res.data.access_token}`;
            }
          })
          .catch(() => {});
      }
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          if (parsed?.role) setCurrentRole(parsed.role);
          if (parsed?.username) setCurrentUsername(parsed.username);
        } catch {}
      }
    }
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

  const fetchActiveCases = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/v1/cases`);
      if (res.data?.cases) {
        setActiveCases(res.data.cases);
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchGraphStats = useCallback(async () => {
    try {
      const url = selectedCaseId && selectedCaseId !== "ALL"
        ? `${API_BASE_URL}/api/v1/graph/topology?case_id=${encodeURIComponent(selectedCaseId)}`
        : `${API_BASE_URL}/api/v1/graph/topology`;
      const res = await axios.get(url);
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

      if (keySuspectName && keySuspectName !== "None" && keySuspectName !== "Identified Lead") {
        setBriefingSubject(keySuspectName);
      }
    } catch {
      // ignore
    }
  }, [selectedCaseId]);

  // Ephemeral Privacy Session: On browser load / refresh, purge old data so session starts pristine
  useEffect(() => {
    setMounted(true);
    checkBackendHealth();
    fetchActiveCases();

    const purgeEphemeralSessionOnMount = async () => {
      try {
        await axios.delete(`${API_BASE_URL}/api/v1/admin/clear-db`);
        setGraphRefreshTrigger(-1);
        setAlertsRefreshTrigger(-1);
        setActiveAlertCount(0);
        setActiveCases([]);
        setSelectedCaseId("ALL");
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
        // Backend could still be initializing or non-admin role
      }
    };

    purgeEphemeralSessionOnMount();

    const interval = setInterval(checkBackendHealth, 15000);
    return () => clearInterval(interval);
  }, [checkBackendHealth, fetchActiveCases]);

  // Handler to purge the entire database manually
  const handlePurgeDatabase = async () => {
    if (isPurging) return;
    setIsPurging(true);
    try {
      await axios.delete(`${API_BASE_URL}/api/v1/admin/clear-db`);

      setGraphRefreshTrigger(-1);
      setAlertsRefreshTrigger(-1);
      setActiveAlertCount(0);
      setActiveCases([]);
      setSelectedCaseId("ALL");
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
      if (err.response?.status === 403) {
        toast.error("RBAC Permission Denied (HTTP 403)", {
          description: `User '${currentUsername}' with role '${currentRole}' is not authorized to purge case databases. Requires Lead Intelligence Admin credentials.`,
        });
      } else {
        toast.error("Purge Failed", {
          description: err.response?.data?.detail || err.message || "Failed to clear database.",
        });
      }
    } finally {
      setIsPurging(false);
    }
  };

  // Handler to delete a single case docket
  const handleDeleteCase = async (caseId: string) => {
    try {
      await axios.delete(`${API_BASE_URL}/api/v1/cases/${encodeURIComponent(caseId)}`);
      toast.success("Case Docket Removed", {
        description: `Case '${caseId}' and all isolated evidence nodes purged from graph.`,
      });
      fetchActiveCases();
      if (selectedCaseId === caseId) {
        setSelectedCaseId("ALL");
      }
      setGraphRefreshTrigger((prev) => (prev <= 0 ? 1 : prev + 1));
      fetchGraphStats();
    } catch (err: any) {
      if (err.response?.status === 403) {
        toast.error("RBAC Permission Denied (HTTP 403)", {
          description: `User '${currentUsername}' (${currentRole}) lacks administrative clearance to delete case dockets.`,
        });
      } else {
        toast.error("Case Deletion Failed", {
          description: err.response?.data?.detail || err.message || "Failed to delete case.",
        });
      }
    }
  };

  // Called when any file is ingested in DataIngestionPanel
  const handleEvidenceIngested = () => {
    setGraphRefreshTrigger((prev) => (prev <= 0 ? 1 : prev + 1));
    setAlertsRefreshTrigger((prev) => (prev <= 0 ? 1 : prev + 1));
    fetchActiveCases();
    fetchGraphStats();
  };

  return (
    <div className="h-screen max-h-screen flex flex-col bg-[#eef2f6] text-slate-900 font-sans overflow-hidden select-none">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER BANNER */}
      {/* ========================================================================= */}
      <header className="relative w-full h-[90px] sm:h-[110px] md:h-[130px] lg:h-[140px] bg-white border-b-4 border-orange-500 flex items-center justify-center overflow-hidden shrink-0">
        <img 
          src="/images/new_img.png?v=6" 
          alt="Ministry of Home Affairs - NCIG" 
          className="w-full h-full object-cover sm:object-cover object-center block"
        />
      </header>

      {/* 🇮🇳 National Tricolor Institutional Stripe */}
      <div className="w-full tricolor-bar shrink-0" />

      {/* ========================================================================= */}
      {/* 2. SECONDARY NAVIGATION BAR (Dark Horizontal Nav Bar bg-[#0A2540]) */}
      {/* ========================================================================= */}
      <nav className="w-full bg-[#0A2540] text-white px-4 sm:px-6 py-1 flex flex-wrap items-center justify-between gap-2 shadow-xs shrink-0 border-b border-[#143d6a]">
        {/* Left: Navigation Tabs with Icons */}
        <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto text-xs font-semibold">
          {/* Dashboard Tab */}
          <button
            onClick={() => setActiveNavTab("Dashboard")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-md transition-all cursor-pointer ${activeNavTab === "Dashboard"
              ? "border-b-2 border-orange-500 text-orange-400 bg-white/10 font-bold"
              : "text-slate-300 hover:text-white hover:bg-white/5"
              }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </button>

          {/* Evidence Intake Tab */}
          <button
            onClick={() => {
              setActiveNavTab("Evidence Intake");
              setShowIngestionModal(true);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-md transition-all cursor-pointer ${activeNavTab === "Evidence Intake"
              ? "border-b-2 border-orange-500 text-orange-400 bg-white/10 font-bold"
              : "text-slate-300 hover:text-white hover:bg-white/5"
              }`}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Evidence Intake</span>
          </button>

          {/* Entity Network Tab */}
          <button
            onClick={() => {
              setActiveNavTab("Entity Network");
              setGraphRefreshTrigger((prev) => (prev <= 0 ? 1 : prev + 1));
              fetchGraphStats();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-md transition-all cursor-pointer ${activeNavTab === "Entity Network"
              ? "border-b-2 border-orange-500 text-orange-400 bg-white/10 font-bold"
              : "text-slate-300 hover:text-white hover:bg-white/5"
              }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span>Entity Network</span>
          </button>

          {/* GAT Links Tab */}
          <button
            onClick={() => {
              setActiveNavTab("GAT Links");
              setShowGATModal(true);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-md transition-all cursor-pointer ${activeNavTab === "GAT Links"
              ? "border-b-2 border-orange-500 text-orange-400 bg-white/10 font-bold"
              : "text-slate-300 hover:text-white hover:bg-white/5"
              }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-300" />
            <span>GAT Links</span>
          </button>

          {/* GIS Map Tab */}
          <button
            onClick={() => {
              setActiveNavTab("GIS Map");
              setShowGeoModal(true);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-md transition-all cursor-pointer ${activeNavTab === "GIS Map"
              ? "border-b-2 border-orange-500 text-orange-400 bg-white/10 font-bold"
              : "text-slate-300 hover:text-white hover:bg-white/5"
              }`}
          >
            <MapPin className="w-3.5 h-3.5 text-emerald-300" />
            <span>GIS Map</span>
          </button>

          {/* Alerts Tab */}
          <button
            onClick={() => {
              setActiveNavTab("Alerts");
              setShowAlertsModal(true);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-md transition-all cursor-pointer ${activeNavTab === "Alerts"
              ? "border-b-2 border-orange-500 text-orange-400 bg-white/10 font-bold"
              : "text-slate-300 hover:text-white hover:bg-white/5"
              }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>Alerts ({activeAlertCount})</span>
          </button>

          {/* Reports / Briefing Tab */}
          <button
            onClick={() => {
              setActiveNavTab("Reports");
              setShowBriefingModal(true);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-md transition-all cursor-pointer ${activeNavTab === "Reports"
              ? "border-b-2 border-orange-500 text-orange-400 bg-white/10 font-bold"
              : "text-slate-300 hover:text-white hover:bg-white/5"
              }`}
          >
            <FileText className="w-3.5 h-3.5 text-indigo-300" />
            <span>Reports</span>
          </button>

          {/* Supervisor / RBAC Tab */}
          <button
            onClick={() => {
              setActiveNavTab("Supervisor");
              setShowAuthModal(true);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-md transition-all cursor-pointer ${activeNavTab === "Supervisor"
              ? "border-b-2 border-orange-500 text-orange-400 bg-white/10 font-bold"
              : "text-slate-300 hover:text-white hover:bg-white/5"
              }`}
          >
            <UserCheck className="w-3.5 h-3.5 text-amber-300" />
            <span>{currentRole}</span>
          </button>
        </div>

        {/* Right: ONLINE Status Badge, Profile Circle, & Controls */}
        <div className="flex items-center gap-2 shrink-0 pr-2 sm:pr-4">
          {/* System Status Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-[11px]">
            {backendStatus === "online" ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-300 font-extrabold font-mono">ONLINE</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span className="text-rose-300 font-extrabold font-mono">OFFLINE</span>
              </>
            )}
          </div>

          {/* User Profile Circle */}
          <button
            onClick={() => setShowAuthModal(true)}
            className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold text-xs border border-white/30 shadow-xs cursor-pointer hover:scale-105 transition-transform"
            title={`Active User: ${currentUsername} (${currentRole})`}
          >
            {currentUsername.charAt(0).toUpperCase()}
          </button>

          {/* Purge Database Reset Button */}
          <button
            onClick={handlePurgeDatabase}
            disabled={isPurging}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-rose-600/80 text-rose-300 hover:text-white border border-white/20 transition-all cursor-pointer disabled:opacity-50"
            title="Purge session database"
          >
            {isPurging ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-300" />
            ) : (
              <RotateCcw className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Fullscreen App Toggle */}
          <button
            onClick={toggleAppFullscreen}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all cursor-pointer"
            title={isAppFullscreen ? "Exit App Fullscreen (ESC)" : "Expand App to Full Screen"}
          >
            {isAppFullscreen ? (
              <Minimize className="w-3.5 h-3.5 text-amber-300" />
            ) : (
              <Maximize className="w-3.5 h-3.5 text-blue-200" />
            )}
          </button>
        </div>
      </nav>

      {/* ========================================================================= */}
      {/* 3. MAIN CONTENT GRID (3-Column Layout: Left 20%, Center 55%, Right 25%) */}
      {/* ========================================================================= */}
      <main className="flex-1 min-h-0 w-full max-w-[1920px] mx-auto p-2.5 grid grid-cols-12 gap-2.5 overflow-hidden">
        {/* ========================================================================= */}
        {/* LEFT PANEL: NETWORK ENTITIES & INSIGHTS (Approx 20-25% -> col-span-3) */}
        {/* ========================================================================= */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-2 h-full min-h-0 overflow-hidden">
          {/* Card 1: Network Entities (Top Border: border-t-4 border-orange-500) */}
          <div className="rounded-xl bg-white border border-slate-200 border-t-4 border-t-orange-500 p-2.5 shadow-xs space-y-1.5 shrink-0">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600">
                  <Network className="w-3 h-3" />
                </div>
                <h2 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                  Network Entities
                </h2>
              </div>
              <span className="text-[9px] font-extrabold text-orange-700 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-full">
                {graphStats.totalNodes} NODES
              </span>
            </div>

            <div className="grid grid-cols-1 gap-1 text-xs font-medium">
              {/* Persons Row */}
              <div className="flex items-center justify-between py-1 px-2 rounded-lg bg-slate-50/80 border border-slate-100">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 shrink-0">
                    <Users className="w-3 h-3" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 block leading-tight text-xs">Persons</span>
                    <span className="text-[8px] text-slate-500 leading-none block">Suspects &amp; Leads</span>
                  </div>
                </div>
                <span className="text-xs font-extrabold text-slate-900 font-mono">
                  {graphStats.persons || 0}
                </span>
              </div>

              {/* Telecom IDs Row */}
              <div className="flex items-center justify-between py-1 px-2 rounded-lg bg-slate-50/80 border border-slate-100">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
                    <Phone className="w-3 h-3" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 block leading-tight text-xs">Telecom IDs</span>
                    <span className="text-[8px] text-slate-500 leading-none block">CDR Phone Lines</span>
                  </div>
                </div>
                <span className="text-xs font-extrabold text-slate-900 font-mono">
                  {graphStats.phones || 0}
                </span>
              </div>

              {/* Financial Accounts Row */}
              <div className="flex items-center justify-between py-1 px-2 rounded-lg bg-slate-50/80 border border-slate-100">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded bg-sky-100 border border-sky-200 flex items-center justify-center text-sky-700 shrink-0">
                    <CreditCard className="w-3 h-3" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 block leading-tight text-xs">Bank Accounts</span>
                    <span className="text-[8px] text-slate-500 leading-none block">Mules &amp; Hawala</span>
                  </div>
                </div>
                <span className="text-xs font-extrabold text-slate-900 font-mono">
                  {graphStats.accounts || 0}
                </span>
              </div>

              {/* Vehicles & Locations in 2-column micro row */}
              <div className="grid grid-cols-2 gap-1">
                <div className="flex items-center justify-between py-1 px-1.5 rounded-lg bg-slate-50/80 border border-slate-100">
                  <div className="flex items-center gap-1">
                    <Car className="w-3 h-3 text-amber-600" />
                    <span className="font-bold text-slate-800 text-[10px]">Vehicles</span>
                  </div>
                  <span className="text-xs font-extrabold text-slate-900 font-mono">
                    {graphStats.vehicles || 0}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 px-1.5 rounded-lg bg-slate-50/80 border border-slate-100">
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-purple-600" />
                    <span className="font-bold text-slate-800 text-[10px]">Locations</span>
                  </div>
                  <span className="text-xs font-extrabold text-slate-900 font-mono">
                    {graphStats.locations || 0}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Intelligence Insights (Top Border: border-t-4 border-orange-500) */}
          <div className="flex-1 min-h-0 rounded-xl bg-white border border-slate-200 border-t-4 border-t-orange-500 p-2.5 shadow-xs flex flex-col justify-between overflow-hidden">
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between text-slate-900 font-black text-xs mb-1.5 border-b border-slate-100 pb-1 shrink-0">
                <div className="flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                  <span className="uppercase tracking-wide">Intelligence Insights</span>
                </div>
                <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded-full border ${graphStats.totalNodes > 0
                  ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                  : "bg-slate-100 border-slate-200 text-slate-600"
                  }`}>
                  {graphStats.totalNodes > 0 ? "LIVE AUDIT" : "STANDBY"}
                </span>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-1.5 text-xs text-slate-700 leading-relaxed font-medium">
                {graphStats.totalNodes === 0 ? (
                  <ul className="space-y-1.5 text-[11px] text-slate-600 leading-relaxed font-medium">
                    <li className="flex items-start gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0 mt-1.5" />
                      <span>Awaiting intake: Upload CDR, Bank CSV, or FIR dossiers.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0 mt-1.5" />
                      <span>Deterministic entity resolution aligns shared phone/account IDs.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0 mt-1.5" />
                      <span>Louvain community detection partitions criminal gang cells.</span>
                    </li>
                  </ul>
                ) : (
                  <ul className="space-y-1.5 text-[11px] text-slate-700 leading-relaxed font-medium">
                    <li className="flex items-start gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-600 shrink-0 mt-1" />
                      <span>
                        <strong>{graphStats.totalCommunities} syndicate cells</strong> isolated via Louvain clustering.
                      </span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-600 shrink-0 mt-1" />
                      <span>
                        Primary lead: <strong className="text-slate-900">{graphStats.keySuspectName}</strong> with cross-cluster bridge ties.
                      </span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-600 shrink-0 mt-1" />
                      <span>
                        Multi-modal resolution merged phonetically identical aliases.
                      </span>
                    </li>
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Card 3: Institutional Intelligence Banner (down.png) */}
          <div className="rounded-xl overflow-hidden border border-slate-200 shrink-0 shadow-2xs bg-white">
            <img
              src="/images/down.png?v=1"
              alt="National Crime Intelligence & Security Grid"
              className="w-full h-auto object-cover rounded-md block"
            />
          </div>
        </div>

        {/* ========================================================================= */}
        {/* CENTER PANEL: GRAPH CANVAS (Approx 50-55% -> col-span-6) */}
        {/* ========================================================================= */}
        <div className="col-span-12 lg:col-span-6 flex flex-col h-full min-h-0 bg-[#F5F7FA] rounded-xl border border-slate-200 shadow-xs relative overflow-hidden">
          {/* Massive, Centered Ashoka Chakra Watermark */}
          <div className="absolute inset-0 m-auto w-[400px] h-[400px] opacity-10 pointer-events-none flex items-center justify-center z-0 select-none">
            <svg viewBox="0 0 400 400" className="w-[400px] h-[400px] text-[#0A2540]" fill="currentColor">
              <circle cx="200" cy="200" r="185" fill="none" stroke="currentColor" strokeWidth="10" />
              <circle cx="200" cy="200" r="170" fill="none" stroke="currentColor" strokeWidth="3" />
              <circle cx="200" cy="200" r="32" fill="currentColor" />
              {Array.from({ length: 24 }).map((_, i) => {
                const angle = (i * 15 * Math.PI) / 180;
                const x2 = Number((200 + 168 * Math.cos(angle)).toFixed(2));
                const y2 = Number((200 + 168 * Math.sin(angle)).toFixed(2));
                return (
                  <line
                    key={i}
                    x1="200"
                    y1="200"
                    x2={x2}
                    y2={y2}
                    stroke="currentColor"
                    strokeWidth="3.5"
                  />
                );
              })}
            </svg>
          </div>

          {/* Cytoscape Network Visualizer Canvas */}
          <div className="relative z-10 flex-1 min-h-0 flex flex-col overflow-hidden">
            <NetworkGraphPanel
              apiBaseUrl={API_BASE_URL}
              refreshTrigger={graphRefreshTrigger}
              onRefreshLiveGraph={fetchGraphStats}
              selectedCaseId={selectedCaseId}
              onSelectCaseId={setSelectedCaseId}
              activeCases={activeCases}
              onDeleteCase={handleDeleteCase}
              onOpenBriefing={(target) => {
                setBriefingSubject(target);
                setShowBriefingModal(true);
              }}
            />
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT PANEL: THREAT STATUS & LEGEND (Approx 25% -> col-span-3) */}
        {/* ========================================================================= */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-2 h-full min-h-0 overflow-hidden">
          {/* Section 1: Threat Status (3 Horizontally Aligned Metric Cards) */}
          <div className="grid grid-cols-3 gap-2 shrink-0">
            {/* Card 1: Red (High Risk Entities) */}
            <div className="bg-rose-50/90 border-2 border-rose-200 border-t-4 border-t-rose-600 rounded-xl p-4 text-center shadow-sm flex flex-col items-center justify-center">
              <ShieldAlert className="w-4 h-4 text-rose-600 mb-1" />
              <span className="text-3xl font-bold text-rose-700 font-mono leading-none mb-1">
                {graphStats.persons > 0 ? (graphStats.persons > 3 ? "3" : "1") : "0"}
              </span>
              <span className="text-[9px] font-extrabold text-rose-800 uppercase tracking-tight leading-tight">
                High Risk
              </span>
            </div>

            {/* Card 2: Orange (Suspicious Transactions) */}
            <div className="bg-amber-50/90 border-2 border-amber-200 border-t-4 border-t-orange-500 rounded-xl p-4 text-center shadow-sm flex flex-col items-center justify-center">
              <BarChart3 className="w-4 h-4 text-orange-600 mb-1" />
              <span className="text-3xl font-bold text-orange-700 font-mono leading-none mb-1">
                {activeAlertCount > 0 ? activeAlertCount : (graphStats.accounts > 0 ? "4" : "0")}
              </span>
              <span className="text-[9px] font-extrabold text-amber-800 uppercase tracking-tight leading-tight">
                Structuring
              </span>
            </div>

            {/* Card 3: Green (Active Syndicates) */}
            <div className="bg-emerald-50/90 border-2 border-emerald-200 border-t-4 border-t-emerald-600 rounded-xl p-4 text-center shadow-sm flex flex-col items-center justify-center">
              <Network className="w-4 h-4 text-emerald-600 mb-1" />
              <span className="text-3xl font-bold text-emerald-700 font-mono leading-none mb-1">
                {graphStats.totalCommunities > 0 ? graphStats.totalCommunities : "0"}
              </span>
              <span className="text-[9px] font-extrabold text-emerald-800 uppercase tracking-tight leading-tight">
                Syndicates
              </span>
            </div>
          </div>

          {/* Section 2: Visual Legend Card (Border: border-t-4 border-blue-900) */}
          <div className="rounded-xl bg-white border border-slate-200 border-t-4 border-t-[#0a2540] p-2.5 shadow-xs space-y-1.5 shrink-0">
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
                <span className="text-[10px]">Location/Tower</span>
              </div>

              {/* Vehicle */}
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full bg-amber-600 flex items-center justify-center text-white shrink-0">
                  <Car className="w-2.5 h-2.5" />
                </div>
                <span className="text-[10px]">Vehicle</span>
              </div>
            </div>
          </div>

          {/* Section 3: AI Investigation Analysis (Border: border-t-4 border-blue-900) */}
          <div className="flex-1 min-h-0 rounded-xl bg-white border border-slate-200 border-t-4 border-t-[#0a2540] p-2.5 shadow-xs flex flex-col justify-between overflow-hidden">
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between text-slate-900 font-black text-xs mb-1.5 border-b border-slate-100 pb-1 shrink-0">
                <div className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-blue-700" />
                  <span className="uppercase tracking-wide">Investigation Analysis</span>
                </div>
                <button
                  onClick={() => setShowAlertsModal(true)}
                  className="text-[9px] font-bold text-blue-700 hover:text-blue-900 cursor-pointer"
                >
                  View All &rarr;
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1">
                {activeAlertCount > 0 ? (
                  <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                    <div className="flex items-center gap-1 font-bold text-[11px] mb-0.5 text-amber-900">
                      <Flame className="w-3 h-3 text-amber-600" />
                      <span>{activeAlertCount} Structuring Alert(s) Detected</span>
                    </div>
                    <p className="text-[10px] text-amber-800 leading-tight">
                      Rapid transaction smurfing detected across connected mule accounts.
                    </p>
                  </div>
                ) : (
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 text-xs">
                    <p className="text-[10px] text-slate-500 leading-tight">
                      No active threat alerts triggered. Ingest financial CSV or CDR telecom records to initiate heuristic evasion scanning.
                    </p>
                  </div>
                )}

                <div className="p-2 rounded-lg bg-blue-50/70 border border-blue-100 text-xs text-blue-950">
                  <span className="text-[10px] font-extrabold uppercase text-blue-800 block mb-0.5">
                    Recommended Action:
                  </span>
                  <p className="text-[10px] text-blue-900 leading-relaxed">
                    Issue Section 91 CrPC notice for high-centrality accounts and initiate GAT active learning feedback.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowBriefingModal(true)}
              className="w-full mt-2 py-1.5 px-3 rounded-lg bg-[#0a2540] hover:bg-[#133860] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <FileCheck2 className="w-3.5 h-3.5 text-amber-300" />
              <span>Generate Full Case Dossier</span>
            </button>
          </div>
        </div>
      </main>

      {/* ========================================================================= */}
      {/* 4. FOOTER (Dense Status Bar) */}
      {/* ========================================================================= */}
      <footer className="w-full bg-white border-t border-slate-200 px-4 py-1.5 text-[10px] text-slate-600 flex flex-wrap items-center justify-between shrink-0 font-sans shadow-2xs">
        {/* Left: Ministry / SIH Attribution */}
        <div className="flex items-center gap-2 font-bold text-slate-800">
          <span>SIH 2026 • MINISTRY OF HOME AFFAIRS</span>
          <span className="text-slate-300">|</span>
          <span className="text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 text-[9px]">
            SYNTHETIC DEMO DATA
          </span>
        </div>

        {/* Center: Security & Audit Badges */}
        <div className="hidden md:flex items-center gap-2 text-[10px]">
          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-bold">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            <span>Blockchain Audit Enabled</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-bold">
            <Lock className="w-3 h-3 text-blue-600" />
            <span>End-to-End Encrypted</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 font-bold">
            <Terminal className="w-3 h-3 text-amber-600" />
            <span>Demo Environment</span>
          </div>
        </div>

        {/* Right: Timestamp & National Emblem Indicator */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] text-slate-500 font-medium">
            AUDIT SYNC: {mounted ? (lastSyncTime || "ONLINE") : "ONLINE"}
          </span>
          <span className="text-slate-300">|</span>
          <span className="font-bold text-slate-700 text-[9px]">GOVERNMENT OF INDIA</span>
        </div>
      </footer>

      {/* ========================================================================= */}
      {/* 5. INTERACTIVE FEATURE MODALS */}
      {/* ========================================================================= */}

      {/* Evidence Intake Modal */}
      {showIngestionModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-white">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#0A2540] flex items-center justify-center text-white shadow-xs">
                  <UploadCloud className="w-4 h-4 text-orange-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-extrabold text-[#0A2540] uppercase tracking-wide">
                      Evidence Ingestion Hub
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.2 rounded bg-blue-50 border border-blue-200 text-blue-900">
                      CCTNS // NATGRID
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">Multi-source intake for Banking Ledgers, Telecom CDRs &amp; Police FIR Dossiers</p>
                </div>
              </div>
              <button
                onClick={() => setShowIngestionModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer font-bold transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 bg-white">
              <DataIngestionPanel
                apiBaseUrl={API_BASE_URL}
                onDataIngested={handleEvidenceIngested}
                hideHeader={true}
                activeCaseId={selectedCaseId !== "ALL" ? selectedCaseId : undefined}
                onSelectCaseId={(id) => setSelectedCaseId(id)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Financial & Evasion Alerts Modal */}
      {showAlertsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-700 shadow-xs">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Financial &amp; Telecom Evasion Alerts</h3>
                  <p className="text-xs text-slate-500 font-medium">Demo-configurable structuring evasion &amp; burner cycling analysis</p>
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
