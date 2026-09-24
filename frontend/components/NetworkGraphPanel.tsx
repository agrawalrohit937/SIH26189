"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import axios from "axios";
import { toast } from "sonner";
import {
  Share2,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Users,
  Phone,
  CreditCard,
  Layers,
  Search,
  Info,
  Loader2,
  Database,
  ArrowRightLeft,
  Network,
  Radio,
  FileSpreadsheet
} from "lucide-react";
import cytoscape, { Core, ElementDefinition } from "cytoscape";

const CytoscapeComponent = dynamic(() => import("react-cytoscapejs"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
      <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
      <span className="text-xs font-medium tracking-wide text-slate-400">
        RENDERING CRIMINAL NETWORK TOPOLOGY...
      </span>
    </div>
  ),
});

interface NetworkGraphPanelProps {
  apiBaseUrl: string;
  refreshTrigger?: number;
  onRefreshLiveGraph?: () => void;
}

export const NetworkGraphPanel: React.FC<NetworkGraphPanelProps> = ({
  apiBaseUrl,
  refreshTrigger = 0,
  onRefreshLiveGraph,
}) => {
  const cyRef = useRef<Core | null>(null);
  const [elements, setElements] = useState<ElementDefinition[]>([]);
  const [isLoadingGraph, setIsLoadingGraph] = useState<boolean>(false);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [layoutName, setLayoutName] = useState<string>("cose");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [mounted, setMounted] = useState<boolean>(false);
  const isInitialMount = useRef(true);

  // Authoritative Law Enforcement Stylesheet (Clean, Formal, No-Glow)
  const cytoscapeStylesheet: any[] = useMemo(
    () => [
      // Base Node Style
      {
        selector: "node",
        style: {
          label: "data(label)",
          color: "#f8fafc",
          "font-size": "10px",
          "font-weight": "500",
          "font-family": "system-ui, -apple-system, sans-serif",
          "text-valign": "bottom",
          "text-halign": "center",
          "text-margin-y": 5,
          "text-background-opacity": 0.95,
          "text-background-color": "#0f172a",
          "text-background-padding": "2px",
          "text-background-shape": "roundrectangle",
          "text-border-opacity": 0.9,
          "text-border-width": 1,
          "text-border-color": "#334155",
          "border-width": 2,
          "border-color": "#475569",
          "background-color": "#1e293b",
        },
      },
      // Person Node Style (Authoritative Blue #1d4ed8, shape: ellipse)
      {
        selector: "node[type='Person']",
        style: {
          shape: "ellipse",
          width: 48,
          height: 48,
          "background-color": "#1d4ed8",
          "border-color": "#93c5fd",
          "border-width": 2,
        },
      },
      // PhoneNumber Node Style (Emerald Green #047857, shape: round-rectangle)
      {
        selector: "node[type='PhoneNumber']",
        style: {
          shape: "round-rectangle",
          width: 42,
          height: 42,
          "background-color": "#047857",
          "border-color": "#6ee7b7",
          "border-width": 2,
        },
      },
      // BankAccount Node Style (Purple/Indigo #6d28d9, shape: diamond)
      {
        selector: "node[type='BankAccount']",
        style: {
          shape: "diamond",
          width: 46,
          height: 46,
          "background-color": "#6d28d9",
          "border-color": "#c4b5fd",
          "border-width": 2,
        },
      },
      // Selected Node
      {
        selector: "node:selected",
        style: {
          "border-color": "#f59e0b",
          "border-width": 3.5,
          "background-color": "#d97706",
        },
      },
      // Base Edge Style (Dashed gray, clean directional arrows)
      {
        selector: "edge",
        style: {
          label: "data(label)",
          "font-size": "9px",
          "font-weight": "500",
          "font-family": "system-ui, -apple-system, sans-serif",
          color: "#cbd5e1",
          "text-background-opacity": 0.95,
          "text-background-color": "#0f172a",
          "text-background-padding": "2px",
          "text-background-shape": "roundrectangle",
          "text-border-opacity": 0.8,
          "text-border-width": 1,
          "text-border-color": "#334155",
          "text-rotation": "autorotate",
          "curve-style": "bezier",
          "target-arrow-shape": "triangle",
          "arrow-scale": 1,
          width: 1.8,
          "line-color": "#64748b",
          "target-arrow-color": "#64748b",
          "line-style": "dashed",
        },
      },
      // Specific CALLED Edge Style (Steel Blue)
      {
        selector: "edge[type='CALLED']",
        style: {
          "line-color": "#38bdf8",
          "target-arrow-color": "#38bdf8",
          "line-style": "dashed",
          width: 2,
          color: "#bae6fd",
        },
      },
      // Specific TRANSFERRED_TO / TRANSFERRED Edge Style (Official Red)
      {
        selector: "edge[type='TRANSFERRED_TO'], edge[type='TRANSFERRED']",
        style: {
          "line-color": "#e11d48",
          "target-arrow-color": "#e11d48",
          "line-style": "dashed",
          width: 2.5,
          color: "#fecdd3",
          "font-weight": "600",
        },
      },
      // Ownership Edges
      {
        selector: "edge[type='OWNS_PHONE'], edge[type='OWNS_ACCOUNT']",
        style: {
          "line-color": "#475569",
          "target-arrow-color": "#475569",
          "line-style": "dotted",
          width: 1.5,
          color: "#94a3b8",
        },
      },
      // Directs / Dispatches Edges
      {
        selector: "edge[type='DIRECTS'], edge[type='DISPATCHES'], edge[type='ASSOCIATED_WITH']",
        style: {
          "line-color": "#d97706",
          "target-arrow-color": "#d97706",
          "line-style": "dashed",
          width: 2,
          color: "#fde68a",
        },
      },
      // Selected Edge
      {
        selector: "edge:selected",
        style: {
          "line-color": "#f59e0b",
          "target-arrow-color": "#f59e0b",
          width: 3.5,
          color: "#ffffff",
        },
      },
    ],
    []
  );

  // Layout Configuration
  const layoutConfig = useMemo(
    () => ({
      name: layoutName,
      animate: true,
      animationDuration: 450,
      padding: 40,
      fit: true,
      nodeDimensionsIncludeLabels: true,
      ...(layoutName === "cose"
        ? {
            nodeRepulsion: () => 7000,
            idealEdgeLength: () => 110,
            edgeElasticity: () => 100,
          }
        : {}),
    }),
    [layoutName]
  );

  // Fetch Live Graph Topology from Neo4j
  const fetchLiveGraph = useCallback(async (isSilent = false) => {
    setIsLoadingGraph(true);
    try {
      const response = await axios.get(`${apiBaseUrl}/api/v1/graph/topology`);
      const data = response.data;
      
      let rawNodes: ElementDefinition[] = [];
      let rawEdges: ElementDefinition[] = [];

      if (data?.elements) {
        if (Array.isArray(data.elements)) {
          rawNodes = data.elements.filter((el: any) => !el.data?.source);
          rawEdges = data.elements.filter((el: any) => el.data?.source);
        } else {
          rawNodes = data.elements.nodes || [];
          rawEdges = data.elements.edges || [];
        }
      }

      const combinedElements = [...rawNodes, ...rawEdges];
      setElements(combinedElements);

      if (cyRef.current) {
        cyRef.current.elements().remove();
        if (combinedElements.length > 0) {
          cyRef.current.add(combinedElements);
          const layout = cyRef.current.layout(layoutConfig as any);
          layout.run();
          cyRef.current.fit(undefined, 30);
        }
      }

      if (!isSilent) {
        if (combinedElements.length > 0) {
          toast.success("Graph Synchronized", {
            description: `Loaded ${rawNodes.length} entities & ${rawEdges.length} relationships from Neo4j.`,
          });
        }
      }

      if (onRefreshLiveGraph) onRefreshLiveGraph();
    } catch (err: any) {
      console.error("Failed to fetch live graph topology:", err);
      if (!isSilent) {
        toast.error("Database Query Failed", {
          description: err.response?.data?.detail || err.message || "Failed to load graph records.",
        });
      }
    } finally {
      setIsLoadingGraph(false);
    }
  }, [apiBaseUrl, layoutConfig, onRefreshLiveGraph]);

  // Initial Mount: DO NOT fetch automatically so demo starts clean
  useEffect(() => {
    setMounted(true);
  }, []);

  // When parent triggers a refresh (e.g. after file ingestion)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (refreshTrigger > 0) {
      fetchLiveGraph(false);
    } else if (refreshTrigger === -1) {
      // Purge / Reset triggered
      setElements([]);
      if (cyRef.current) {
        cyRef.current.elements().remove();
      }
      setSelectedItem(null);
    }
  }, [refreshTrigger, fetchLiveGraph]);

  const handleZoomIn = () => {
    if (cyRef.current) cyRef.current.zoom(cyRef.current.zoom() * 1.25);
  };

  const handleZoomOut = () => {
    if (cyRef.current) cyRef.current.zoom(cyRef.current.zoom() * 0.8);
  };

  const handleFit = () => {
    if (cyRef.current) cyRef.current.fit(undefined, 30);
  };

  // Filter elements
  const filteredElements = useMemo(() => {
    if (filterType === "ALL" && !searchQuery.trim()) return elements;

    let result = elements;
    if (filterType !== "ALL") {
      const allowedNodeIds = new Set<string>();
      result = elements.filter((el) => {
        if (!el.data.source) {
          const matches = el.data.type === filterType;
          if (matches && el.data.id) allowedNodeIds.add(el.data.id);
          return matches;
        }
        return false;
      });
      const edges = elements.filter(
        (el) =>
          el.data.source &&
          el.data.target &&
          allowedNodeIds.has(el.data.source) &&
          allowedNodeIds.has(el.data.target)
      );
      result = [...result, ...edges];
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (el) =>
          (el.data.label && el.data.label.toLowerCase().includes(q)) ||
          (el.data.sublabel && el.data.sublabel.toLowerCase().includes(q)) ||
          (el.data.role && el.data.role.toLowerCase().includes(q))
      );
    }

    return result;
  }, [elements, filterType, searchQuery]);

  // Dynamic statistics
  const stats = useMemo(() => {
    const nodes = elements.filter((el) => !el.data.source);
    const edges = elements.filter((el) => el.data.source);
    const persons = nodes.filter((n) => n.data.type === "Person").length;
    const phones = nodes.filter((n) => n.data.type === "PhoneNumber").length;
    const accounts = nodes.filter((n) => n.data.type === "BankAccount").length;
    return { persons, phones, accounts, totalNodes: nodes.length, totalEdges: edges.length };
  }, [elements]);

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-700/80 rounded-xl p-3.5 shadow-sm relative overflow-hidden">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4 text-amber-500" />
          <h2 className="text-xs font-bold tracking-wide text-slate-100 uppercase">
            Criminal Syndicate Network Topology
          </h2>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-emerald-400">
            {elements.length > 0 ? `${elements.length} ENTITIES` : "AWAITING INTAKE"}
          </span>
        </div>

        {/* Controls Toolbar */}
        <div className="flex items-center gap-2">
          {/* Layout Selector */}
          <div className="flex items-center bg-slate-950 border border-slate-700 rounded-md px-1.5 py-0.5 text-xs text-slate-300">
            <Layers className="w-3 h-3 text-slate-400 mr-1" />
            <select
              value={layoutName}
              onChange={(e) => setLayoutName(e.target.value)}
              className="bg-transparent text-[11px] text-slate-200 outline-none cursor-pointer"
            >
              <option value="cose" className="bg-slate-900">Force-Directed (CoSE)</option>
              <option value="breadthfirst" className="bg-slate-900">Hierarchical Flow</option>
              <option value="concentric" className="bg-slate-900">Concentric Threat</option>
              <option value="circle" className="bg-slate-900">Circular Ring</option>
              <option value="grid" className="bg-slate-900">Grid View</option>
            </select>
          </div>

          {/* Sync / Refresh Button */}
          <button
            onClick={() => fetchLiveGraph(false)}
            disabled={isLoadingGraph}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 active:scale-95 text-xs font-medium text-slate-200 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            title="Fetch and sync live graph from Neo4j"
          >
            <RefreshCw className={`w-3 h-3 ${isLoadingGraph ? "animate-spin" : ""}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Filter / Search HUD Bar */}
      <div className="flex items-center justify-between gap-2 py-1.5 px-2.5 mt-2 rounded-lg bg-slate-950 border border-slate-800 text-xs">
        {/* Search Input */}
        <div className="flex items-center gap-1.5 flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Filter entities (e.g. Vikram, 98765...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none text-xs text-slate-200 placeholder:text-slate-500 w-full"
          />
        </div>

        {/* Quick Filter Badges */}
        <div className="flex items-center gap-1 text-[11px] font-medium">
          <button
            onClick={() => setFilterType("ALL")}
            className={`px-2 py-0.5 rounded transition-colors ${
              filterType === "ALL"
                ? "bg-amber-600 text-slate-950 font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            ALL ({stats.totalNodes})
          </button>
          <button
            onClick={() => setFilterType("Person")}
            className={`px-2 py-0.5 rounded transition-colors ${
              filterType === "Person"
                ? "bg-blue-600 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            PERSONS ({stats.persons})
          </button>
          <button
            onClick={() => setFilterType("PhoneNumber")}
            className={`px-2 py-0.5 rounded transition-colors ${
              filterType === "PhoneNumber"
                ? "bg-emerald-600 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            PHONES ({stats.phones})
          </button>
          <button
            onClick={() => setFilterType("BankAccount")}
            className={`px-2 py-0.5 rounded transition-colors ${
              filterType === "BankAccount"
                ? "bg-purple-600 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            ACCOUNTS ({stats.accounts})
          </button>
        </div>
      </div>

      {/* Main Enterprise Canvas */}
      <div className="relative flex-1 mt-2 rounded-lg border border-slate-800 bg-[#080d1a] overflow-hidden enterprise-grid">
        {isLoadingGraph ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            <span className="text-xs text-slate-300 font-medium">QUERYING NEO4J GRAPH TOPOLOGY...</span>
          </div>
        ) : elements.length === 0 ? (
          /* Clean Empty State Placeholder on Initial Mount */
          <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3 text-center p-6">
            <div className="w-14 h-14 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-amber-500 shadow-inner">
              <Radio className="w-7 h-7 animate-pulse text-amber-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-200">
                Awaiting Evidence Ingestion
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Please upload case files (CDR Logs, Bank Transactions, or FIR) in the left panel to generate the intelligence graph.
              </p>
            </div>
            <button
              onClick={() => fetchLiveGraph(false)}
              className="mt-1 flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
              <span>Sync Existing Database Records</span>
            </button>
          </div>
        ) : mounted ? (
          <CytoscapeComponent
            elements={filteredElements}
            stylesheet={cytoscapeStylesheet}
            layout={layoutConfig as any}
            style={{ width: "100%", height: "100%" }}
            cy={(cy: Core) => {
              cyRef.current = cy;
              cy.on("tap", "node", (evt) => {
                setSelectedItem({
                  type: "node",
                  data: evt.target.data(),
                });
              });
              cy.on("tap", "edge", (evt) => {
                setSelectedItem({
                  type: "edge",
                  data: evt.target.data(),
                });
              });
              cy.on("tap", (evt) => {
                if (evt.target === cy) {
                  setSelectedItem(null);
                }
              });
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-slate-500 text-xs font-medium">
            Initializing visualizer...
          </div>
        )}

        {/* Floating Zoom & Fit Controls */}
        {elements.length > 0 && (
          <div className="absolute top-2.5 right-2.5 flex flex-col gap-1 p-1 rounded-md bg-slate-900 border border-slate-700 shadow-md z-10">
            <button
              onClick={handleZoomIn}
              className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleFit}
              className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              title="Fit to Screen"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Floating Formal Legend */}
        {elements.length > 0 && (
          <div className="absolute bottom-2.5 left-2.5 p-2 rounded-lg bg-slate-900/95 border border-slate-700 shadow-lg text-[10px] text-slate-300 z-10 space-y-1">
            <div className="grid grid-cols-3 gap-x-3 gap-y-1 font-medium">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 border border-blue-400 inline-block" />
                <span>Person</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600 border border-emerald-400 inline-block" />
                <span>Phone</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rotate-45 bg-purple-600 border border-purple-400 inline-block" />
                <span>Account</span>
              </div>
            </div>
          </div>
        )}

        {/* Floating Entity Inspector */}
        {selectedItem && (
          <div className="absolute top-2.5 left-2.5 max-w-[250px] w-full p-3 rounded-lg bg-slate-900 border border-slate-700 shadow-xl z-20">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <div className="flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] font-bold text-slate-200 uppercase">
                  {selectedItem.type === "node" ? "Entity Dossier" : "Relationship Dossier"}
                </span>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-slate-400 hover:text-white text-xs px-1"
              >
                ✕
              </button>
            </div>

            <div className="mt-2 space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-400">Identifier:</span>
                <span className="text-slate-100 font-semibold truncate max-w-[130px]">
                  {selectedItem.data.label || selectedItem.data.id}
                </span>
              </div>
              {selectedItem.data.type && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Class:</span>
                  <span className="text-slate-300">{selectedItem.data.type}</span>
                </div>
              )}
              {selectedItem.data.role && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Suspect Role:</span>
                  <span className="text-rose-400 font-bold">{selectedItem.data.role}</span>
                </div>
              )}
              {selectedItem.data.carrier && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Telecom:</span>
                  <span className="text-emerald-400 font-medium">{selectedItem.data.carrier}</span>
                </div>
              )}
              {selectedItem.data.bank_name && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Bank:</span>
                  <span className="text-purple-400 font-medium">{selectedItem.data.bank_name}</span>
                </div>
              )}
              {selectedItem.data.duration && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Call Duration:</span>
                  <span className="text-slate-200 font-mono">{selectedItem.data.duration}s</span>
                </div>
              )}
              {selectedItem.data.amount && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Amount:</span>
                  <span className="text-rose-400 font-bold">₹{Number(selectedItem.data.amount).toLocaleString()}</span>
                </div>
              )}
              {selectedItem.data.timestamp && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Timestamp:</span>
                  <span className="text-slate-400 font-mono text-[10px]">{selectedItem.data.timestamp}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Network Bottom Summary */}
      <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3 text-blue-400" />
            <span>{stats.persons} Persons</span>
          </span>
          <span className="flex items-center gap-1">
            <Phone className="w-3 h-3 text-emerald-400" />
            <span>{stats.phones} Phones</span>
          </span>
          <span className="flex items-center gap-1">
            <CreditCard className="w-3 h-3 text-purple-400" />
            <span>{stats.accounts} Accounts</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-300 font-medium">
          <ArrowRightLeft className="w-3 h-3 text-amber-500" />
          <span>{stats.totalEdges} Linked Edges</span>
        </div>
      </div>
    </div>
  );
};
