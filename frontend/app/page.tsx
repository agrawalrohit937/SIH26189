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
  Loader2
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

  // Triggers for syncing or wiping child panels
  const [graphRefreshTrigger, setGraphRefreshTrigger] = useState<number>(0);
  const [alertsRefreshTrigger, setAlertsRefreshTrigger] = useState<number>(0);

  useEffect(() => {
    setMounted(true);
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

  useEffect(() => {
    checkBackendHealth();
    const interval = setInterval(checkBackendHealth, 15000);
    return () => clearInterval(interval);
  }, [checkBackendHealth]);

  // Handler to purge the entire database for presentations
  const handlePurgeDatabase = async () => {
    if (isPurging) return;
    setIsPurging(true);
    try {
      await axios.delete(`${API_BASE_URL}/api/v1/admin/clear-db`);
      
      // Wipe frontend graph & alerts states
      setGraphRefreshTrigger(-1);
      setAlertsRefreshTrigger(-1);
      setActiveAlertCount(0);

      toast.success("System Purged", {
        description: "Neo4j database cleared. All nodes, relationships, and alerts reset for new case demo.",
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
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#070d18] text-slate-100 selection:bg-[#FF9933] selection:text-slate-950 font-sans">
      {/* 🇮🇳 Prominent National Tricolor Accent Bar (Saffron, White, Green) */}
      <div className="w-full tricolor-bar shrink-0" />

      {/* Official Government Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#0c1427]/95 backdrop-blur-md px-4 sm:px-6 py-2.5">
        <div className="max-w-[1920px] mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* MHA Emblem & Title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-700/80 flex items-center justify-center text-[#FF9933] shadow-sm">
              <Scale className="w-5 h-5" />
            </div>

            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-sm font-bold tracking-wide text-white uppercase font-sans">
                  MINISTRY OF HOME AFFAIRS // CRIMINAL NETWORK ANALYSIS SYSTEM
                </h1>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#FF9933]/15 border border-[#FF9933]/40 text-[#FF9933] tracking-wide">
                  CONFIDENTIAL // LEA ONLY
                </span>
              </div>
              <p className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                <span className="text-slate-300 font-medium">CASE: FIR-992/2024 (Hawala &amp; Structuring Syndicate)</span>
                <span className="text-slate-600">•</span>
                <span className="text-emerald-400 flex items-center gap-1 font-medium">
                  <FileCheck2 className="w-3 h-3 text-emerald-400" />
                  BSA 2023 &amp; DPDPA Compliant / Official Law Enforcement Portal
                </span>
              </p>
            </div>
          </div>

          {/* Actions: Purge Database + Connectivity Status */}
          <div className="flex items-center gap-2.5 text-xs">
            {/* Purge / Reset Database Action Button (Muted Secondary Utility) */}
            <button
              onClick={handlePurgeDatabase}
              disabled={isPurging}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-900/90 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-900/60 text-slate-400 hover:text-rose-300 text-[11px] font-medium transition-all cursor-pointer disabled:opacity-50"
              title="Wipe all Neo4j nodes and reset dashboard for fresh ingestion demo"
            >
              {isPurging ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
              ) : (
                <Trash2 className="w-3.5 h-3.5 text-slate-400 group-hover:text-rose-400" />
              )}
              <span>Purge Database</span>
            </button>

            {/* Target Badge */}
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-900 border border-slate-800 text-[11px] text-slate-300">
              <Crosshair className="w-3.5 h-3.5 text-[#FF9933]" />
              <span className="text-slate-400">Target:</span>
              <strong className="text-white">Vikram (Director)</strong>
            </div>

            {/* Backend Connectivity Status */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-900 border border-slate-800 text-[11px]">
              {backendStatus === "online" ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-medium tracking-wide">SECURE LINK ACTIVE</span>
                </>
              ) : backendStatus === "checking" ? (
                <>
                  <Activity className="w-3.5 h-3.5 text-[#FF9933] animate-spin" />
                  <span className="text-[#FF9933]">CONNECTING...</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-rose-400" />
                  <span className="text-rose-400 font-medium">SERVER OFFLINE</span>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main 3-Panel Grid Dashboard */}
      <main className="flex-1 max-w-[1920px] w-full mx-auto p-3 sm:p-4 grid grid-cols-12 gap-3.5 min-h-[calc(100vh-78px)]">
        {/* LEFT PANEL - EVIDENCE INGESTION (Span 3) */}
        <div className="col-span-12 lg:col-span-3 flex flex-col h-[580px] lg:h-auto">
          <DataIngestionPanel
            apiBaseUrl={API_BASE_URL}
            onDataIngested={handleEvidenceIngested}
          />
        </div>

        {/* CENTER PANEL - CRIMINAL NETWORK TOPOLOGY (Span 6) */}
        <div className="col-span-12 lg:col-span-6 flex flex-col h-[650px] lg:h-auto">
          <NetworkGraphPanel
            apiBaseUrl={API_BASE_URL}
            refreshTrigger={graphRefreshTrigger}
          />
        </div>

        {/* RIGHT PANEL - INTELLIGENCE & ALERTS (Span 3) */}
        <div className="col-span-12 lg:col-span-3 flex flex-col h-[580px] lg:h-auto">
          <IntelligenceAlertsPanel
            apiBaseUrl={API_BASE_URL}
            refreshTrigger={alertsRefreshTrigger}
            onAlertsLoaded={(count) => setActiveAlertCount(count)}
          />
        </div>
      </main>

      {/* Official Government Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/90 px-4 py-2 text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="text-slate-300 font-medium">GOVERNMENT OF INDIA // LAW ENFORCEMENT INTELLIGENCE GRID</span>
          <span className="text-slate-700">|</span>
          <span>CYTOSCAPE GRAPH 3.30</span>
          <span className="text-slate-700">|</span>
          <span>NEO4J ENTERPRISE ENGINE</span>
        </div>
        <div>
          <span suppressHydrationWarning className="font-mono text-[10px]">
            LAST AUDIT SYNC: {mounted ? (lastSyncTime || "INITIALIZING") : "INITIALIZING"}
          </span>
        </div>
      </footer>

      {/* MHA Intelligence Copilot */}
      <CopilotChat />
    </div>
  );
}
