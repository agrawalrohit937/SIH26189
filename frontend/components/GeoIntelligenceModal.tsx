"use client";

import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  MapPin,
  Radio,
  Building2,
  Shield,
  RefreshCw,
  X,
  Navigation,
  Globe2,
  Users
} from "lucide-react";

interface GeoEntity {
  name: string;
  role: string;
  cluster: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  tower_id?: string;
}

interface GeoClusterHub {
  city: string;
  state: string;
  lat: number;
  lng: number;
  jurisdiction: string;
  entities_count: number;
}

interface GeoIntelligenceModalProps {
  apiBaseUrl: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectEntity?: (name: string) => void;
}

export const GeoIntelligenceModal: React.FC<GeoIntelligenceModalProps> = ({
  apiBaseUrl,
  isOpen,
  onClose,
  onSelectEntity,
}) => {
  const [geoData, setGeoData] = useState<{
    total_locations: number;
    locations: any[];
  } | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedHub, setSelectedHub] = useState<string>("All");

  const fetchGeoData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${apiBaseUrl}/api/v1/intelligence/geo`);
      setGeoData(res.data);
    } catch (err: any) {
      toast.error("Geo-Intelligence Error", {
        description: err.response?.data?.detail || "Could not fetch geospatial overlay.",
      });
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    if (isOpen) {
      fetchGeoData();
    }
  }, [isOpen, fetchGeoData]);

  if (!isOpen) return null;

  const locations = geoData?.locations || [];
  const uniqueHubs = Array.from(new Set(locations.map((l: any) => l.city))).filter(Boolean);
  const filteredLocations = selectedHub === "All"
    ? locations
    : locations.filter((l: any) => l.city === selectedHub);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Clean Light Header */}
        <div className="p-5 px-6 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-800 shrink-0">
              <Globe2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">Geospatial & Telecom Tower Intelligence</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-50 border border-teal-200 text-teal-800">
                  NATGRID // GIS LAYER
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Regional jurisdiction cluster hubs & BTS cell tower triangulations</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchGeoData}
              disabled={loading}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all cursor-pointer disabled:opacity-50"
              title="Refresh Geo Map"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Hub Filter Bar */}
        <div className="p-4 px-6 bg-slate-50/80 border-b border-slate-100 flex items-center gap-2 overflow-x-auto">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide shrink-0">Jurisdiction Filter:</span>
          <button
            onClick={() => setSelectedHub("All")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedHub === "All"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
            }`}
          >
            All India ({locations.length})
          </button>
          {uniqueHubs.map((hub: any) => (
            <button
              key={hub}
              onClick={() => setSelectedHub(hub)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                selectedHub === hub
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
            >
              <MapPin className="w-3.5 h-3.5 text-teal-600" />
              {hub}
            </button>
          ))}
        </div>

        {/* Visual Map HUD & Entities Grid */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-100/50">
          {/* Simulated Tactical India Map Grid */}
          <div className="relative h-64 w-full rounded-xl bg-slate-900 border border-slate-800 p-4 overflow-hidden flex flex-col justify-between shadow-inner">
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px]" />

            <div className="relative z-10 flex items-center justify-between text-xs text-slate-400">
              <span className="font-mono text-[10px] text-teal-400">GRID: LEA_GEO_OVERLAY // COORD SYSTEM: WGS84</span>
              <span className="font-mono text-[10px] text-slate-400">{filteredLocations.length} PINPOINTS ACTIVE</span>
            </div>

            {/* Tactical Hub Pins */}
            <div className="relative z-10 grid grid-cols-3 gap-3">
              {[
                { city: "New Delhi (HQ)", lat: "28.6139° N", lng: "77.2090° E", color: "border-amber-400 text-amber-300 bg-amber-950/60" },
                { city: "Mumbai Police Zone", lat: "19.0760° N", lng: "72.8777° E", color: "border-blue-400 text-blue-300 bg-blue-950/60" },
                { city: "Kolkata CID Hub", lat: "22.5726° N", lng: "88.3639° E", color: "border-emerald-400 text-emerald-300 bg-emerald-950/60" },
                { city: "Hyderabad Cyber Cell", lat: "17.3850° N", lng: "78.4867° E", color: "border-purple-400 text-purple-300 bg-purple-950/60" },
                { city: "Ahmedabad Crime Branch", lat: "23.0225° N", lng: "72.5714° E", color: "border-rose-400 text-rose-300 bg-rose-950/60" },
                { city: "Bengaluru CCB Hub", lat: "12.9716° N", lng: "77.5946° E", color: "border-teal-400 text-teal-300 bg-teal-950/60" },
              ].map((hub) => (
                <div key={hub.city} className={`p-2 rounded-lg border text-[11px] backdrop-blur-xs flex items-center gap-2 ${hub.color}`}>
                  <Radio className="w-3.5 h-3.5 shrink-0 animate-pulse" />
                  <div>
                    <div className="font-bold">{hub.city}</div>
                    <div className="text-[9px] font-mono opacity-80">{hub.lat}, {hub.lng}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="relative z-10 text-[10px] text-slate-400 font-mono flex items-center justify-between border-t border-slate-800/80 pt-2">
              <span>BTS TOWER COVERAGE: 99.4%</span>
              <span>GEO-FENCE STATUS: ARMED</span>
            </div>
          </div>

          {/* Locations & Suspect List */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              Triangulated Suspects & Tower Attachments ({filteredLocations.length})
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredLocations.map((loc: any, idx: number) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-slate-200 bg-white hover:border-teal-300 transition-all shadow-2xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
                        <Users className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900">{loc.name || loc.label || `Entity #${idx+1}`}</div>
                        <div className="text-[10px] text-slate-500">{loc.role || "Syndicate Operative"} • Cell #{loc.cluster || "0"}</div>
                      </div>
                    </div>

                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-800">
                      {loc.city || "NCR"}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Radio className="w-3 h-3 text-teal-600" />
                      <span className="font-mono text-[10px]">{loc.tower_location || loc.tower_id || `BTS-${loc.city?.toUpperCase() || "NCR"}-0${(idx%8)+1}`}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {loc.lat ? `${Number(loc.lat).toFixed(4)}° N, ${Number(loc.lng).toFixed(4)}° E` : "Triangulated"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
