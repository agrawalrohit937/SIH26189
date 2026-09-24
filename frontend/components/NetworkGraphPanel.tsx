"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
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
  ArrowRightLeft,
  Network,
  Radio,
} from "lucide-react";
import cytoscape, { Core, ElementDefinition } from "cytoscape";
import fcose from "cytoscape-fcose";

// Register fCoSE layout plugin safely on client
if (typeof window !== "undefined") {
  try {
    cytoscape.use(fcose);
  } catch (e) {
    // Already registered
  }
}

interface NetworkGraphPanelProps {
  apiBaseUrl: string;
  refreshTrigger?: number;
  onRefreshLiveGraph?: () => void;
}

// Step 3: Transform raw elements into compound graph elements grouped by cluster
function buildCompoundElements(
  rawNodes: ElementDefinition[],
  rawEdges: ElementDefinition[]
): ElementDefinition[] {
  if (!rawNodes || rawNodes.length === 0) return [];

  const clusterIds = Array.from(
    new Set(rawNodes.map((n) => String(n.data.cluster || "unclustered")))
  );

  // Parent compound containers
  const clusterParents: ElementDefinition[] = clusterIds.map((clusterId) => ({
    data: {
      id: `cluster-${clusterId}`,
      label:
        clusterId === "unclustered"
          ? "Unassigned Entities"
          : `Cell ${clusterId} (Syndicate Cluster)`,
      isClusterParent: true,
      cluster: clusterId,
    },
  }));

  // Child nodes assigned to parent compound containers
  const childNodes: ElementDefinition[] = rawNodes.map((n) => ({
    ...n,
    data: {
      ...n.data,
      parent: `cluster-${String(n.data.cluster || "unclustered")}`,
    },
  }));

  // Edges annotated with cross-cluster flag for distinct bridge styling
  const nodeClusterMap = new Map<string, string>();
  rawNodes.forEach((n) => {
    if (n.data?.id) {
      nodeClusterMap.set(String(n.data.id), String(n.data.cluster || "unclustered"));
    }
  });

  const edgesWithCrossFlag: ElementDefinition[] = rawEdges.map((e) => {
    const sCluster = nodeClusterMap.get(String(e.data.source));
    const tCluster = nodeClusterMap.get(String(e.data.target));
    const isCross = Boolean(sCluster && tCluster && sCluster !== tCluster);
    return {
      ...e,
      data: {
        ...e.data,
        crossCluster: String(isCross),
        isCross: isCross,
      },
    };
  });

  return [...clusterParents, ...childNodes, ...edgesWithCrossFlag];
}

export const NetworkGraphPanel: React.FC<NetworkGraphPanelProps> = ({
  apiBaseUrl,
  refreshTrigger = 0,
  onRefreshLiveGraph,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);
  const [elements, setElements] = useState<ElementDefinition[]>([]);
  const [isLoadingGraph, setIsLoadingGraph] = useState<boolean>(false);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [layoutName, setLayoutName] = useState<string>("fcose");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const isInitialMount = useRef(true);

  // Authoritative Law Enforcement Stylesheet (Compound Cells, Cluster Palettes & Bridge Styles)
  const cytoscapeStylesheet: any[] = useMemo(
    () => [
      // Base Node Style (Non-parent nodes)
      {
        selector: "node:not([?isClusterParent])",
        style: {
          label: "", // hidden by default to avoid visual clutter
          color: "#f8fafc",
          "font-size": "10px",
          "font-weight": "600",
          "font-family": "system-ui, -apple-system, sans-serif",
          "text-valign": "bottom",
          "text-halign": "center",
          "text-margin-y": 5,
          "text-background-opacity": 0.95,
          "text-background-color": "#020617",
          "text-background-padding": "2.5px",
          "text-background-shape": "roundrectangle",
          "text-border-opacity": 0.85,
          "text-border-width": 1,
          "text-border-color": "#334155",
          "border-width": 2,
          "border-color": "#475569",
          "background-color": "#1e293b",
        },
      },
      // Show node labels only on hover or selection
      {
        selector: "node:not([?isClusterParent]):selected, node:not([?isClusterParent]).hovered",
        style: {
          label: "data(label)",
          "z-index": 999,
        },
      },
      // Selected Child Node
      {
        selector: "node:not([?isClusterParent]):selected",
        style: {
          "border-color": "#f59e0b",
          "border-width": 3.5,
          "background-color": "#d97706",
        },
      },
      // Step 4: Compound Cluster Parent Box Styling
      {
        selector: "node[?isClusterParent]",
        style: {
          "background-opacity": 0.07,
          "background-color": "#3b82f6",
          "border-width": 1.5,
          "border-style": "dashed",
          "border-color": "#60a5fa",
          label: "data(label)",
          "text-valign": "top",
          "text-halign": "center",
          "font-size": "11px",
          "font-weight": "700",
          color: "#93c5fd",
          padding: 24,
          "text-background-opacity": 0,
          "border-opacity": 0.75,
          "events": "no", // allow clicks to pass to child elements
        },
      },
      // Person Node Shape (shape: ellipse)
      {
        selector: "node[type='Person']:not([?isClusterParent])",
        style: {
          shape: "ellipse",
          width: 36,
          height: 36,
        },
      },
      // PhoneNumber Node Shape (shape: round-rectangle)
      {
        selector: "node[type='PhoneNumber']:not([?isClusterParent])",
        style: {
          shape: "round-rectangle",
          width: 32,
          height: 32,
        },
      },
      // BankAccount Node Shape (shape: diamond)
      {
        selector: "node[type='BankAccount']:not([?isClusterParent])",
        style: {
          shape: "diamond",
          width: 34,
          height: 34,
        },
      },
      // Step 4: Cluster Color Mapping (Palette: 0:Blue, 1:Emerald, 2:Amber, 3:Rose, 4:Purple, 5:Pink, unclustered:Gray)
      {
        selector: 'node[cluster = "0"]:not([?isClusterParent])',
        style: { "background-color": "#2563eb", "border-color": "#93c5fd" },
      },
      {
        selector: 'node[cluster = "1"]:not([?isClusterParent])',
        style: { "background-color": "#059669", "border-color": "#6ee7b7" },
      },
      {
        selector: 'node[cluster = "2"]:not([?isClusterParent])',
        style: { "background-color": "#d97706", "border-color": "#fde68a" },
      },
      {
        selector: 'node[cluster = "3"]:not([?isClusterParent])',
        style: { "background-color": "#dc2626", "border-color": "#fca5a5" },
      },
      {
        selector: 'node[cluster = "4"]:not([?isClusterParent])',
        style: { "background-color": "#7c3aed", "border-color": "#c4b5fd" },
      },
      {
        selector: 'node[cluster = "5"]:not([?isClusterParent])',
        style: { "background-color": "#db2777", "border-color": "#fbcfe8" },
      },
      {
        selector: 'node[cluster = "unclustered"]:not([?isClusterParent])',
        style: { "background-color": "#4b5563", "border-color": "#9ca3af" },
      },
      // Base Edge Style (Clean, directional arrows)
      {
        selector: "edge",
        style: {
          label: "",
          "font-size": "8.5px",
          "font-weight": "500",
          "font-family": "system-ui, -apple-system, sans-serif",
          color: "#cbd5e1",
          "text-background-opacity": 0.9,
          "text-background-color": "#020617",
          "text-background-padding": "1.5px",
          "text-background-shape": "roundrectangle",
          "text-border-opacity": 0.7,
          "text-border-width": 1,
          "text-border-color": "#334155",
          "text-rotation": "autorotate",
          "curve-style": "bezier",
          "target-arrow-shape": "triangle",
          "arrow-scale": 0.85,
          width: 1.5,
          "line-color": "#475569",
          "target-arrow-color": "#475569",
          "line-style": "dashed",
        },
      },
      // Step 4: Cross-Cluster Bridge Edge Styling (Prominent orange dashed line)
      {
        selector: 'edge[crossCluster = "true"]',
        style: {
          "line-color": "#f97316",
          "target-arrow-color": "#f97316",
          "line-style": "dashed",
          width: 2.2,
          "z-index": 20,
          label: "inter-cell bridge",
          "font-size": "8px",
          color: "#fdba74",
          "text-rotation": "autorotate",
        },
      },
      // Intra-Cluster Edge Styling (Muted)
      {
        selector: 'edge[crossCluster = "false"]',
        style: {
          "line-color": "#475569",
          "target-arrow-color": "#475569",
          width: 1.2,
          opacity: 0.65,
        },
      },
      // Edge on hover/select shows label
      {
        selector: "edge:selected, edge.hovered",
        style: {
          label: "data(label)",
          "z-index": 999,
          width: 3,
          "line-color": "#f59e0b",
          "target-arrow-color": "#f59e0b",
          color: "#ffffff",
        },
      },
    ],
    []
  );

  // Step 4: Compound-Aware fCoSE Layout Configuration
  const layoutConfig = useMemo(
    () => ({
      name: layoutName === "fcose" || layoutName === "cose" ? "fcose" : layoutName,
      quality: "proof",
      animate: true,
      animationDuration: 600,
      padding: 35,
      fit: true,
      nodeRepulsion: () => 6500,
      idealEdgeLength: (edge: any) => (edge.data("isCross") ? 220 : 70),
      nodeSeparation: 80,
      packComponents: true,
      nestingFactor: 0.08,
      tile: false,
    }),
    [layoutName]
  );

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

  // Safe Graph Mutator (Processes compound nodes & executes layout)
  const updateGraph = useCallback(
    (newElements: ElementDefinition[]) => {
      let cy = cyRef.current;
      if (!containerRef.current) return;

      if (!cy || cy.destroyed()) {
        cy = cytoscape({
          container: containerRef.current,
          elements: [],
          style: cytoscapeStylesheet,
          layout: layoutConfig as any,
        });
        cyRef.current = cy;

        cy.on("mouseover", "node:not([?isClusterParent]), edge", (evt) => {
          evt.target.addClass("hovered");
        });
        cy.on("mouseout", "node:not([?isClusterParent]), edge", (evt) => {
          evt.target.removeClass("hovered");
        });

        cy.on("tap", "node:not([?isClusterParent])", (evt) => {
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
      }

      try {
        cy.stop();
        cy.elements().remove();

        const rawNodes = newElements.filter((el) => !el.data.source);
        const rawEdges = newElements.filter((el) => el.data.source);

        // Build Compound Hierarchy
        const compoundElements = buildCompoundElements(rawNodes, rawEdges);

        if (compoundElements.length > 0) {
          cy.add(compoundElements);
          cy.resize();
          const layout = cy.layout(layoutConfig as any);
          layout.run();
          cy.fit(undefined, 35);
        }
      } catch (err) {
        console.error("Error updating compound cytoscape graph:", err);
      }
    },
    [layoutConfig, cytoscapeStylesheet]
  );

  // Initialize Cytoscape on mount
  useEffect(() => {
    if (!containerRef.current) return;

    if (cyRef.current && !cyRef.current.destroyed()) {
      try {
        cyRef.current.stop();
        cyRef.current.destroy();
      } catch (e) {
        // ignore
      }
      cyRef.current = null;
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements: [],
      style: cytoscapeStylesheet,
      layout: layoutConfig as any,
    });

    cyRef.current = cy;

    cy.on("mouseover", "node:not([?isClusterParent]), edge", (evt) => {
      evt.target.addClass("hovered");
    });
    cy.on("mouseout", "node:not([?isClusterParent]), edge", (evt) => {
      evt.target.removeClass("hovered");
    });

    cy.on("tap", "node:not([?isClusterParent])", (evt) => {
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

    return () => {
      if (cy && !cy.destroyed()) {
        try {
          cy.stop();
          cy.destroy();
        } catch (e) {
          // ignore
        }
      }
      cyRef.current = null;
    };
  }, [cytoscapeStylesheet]);

  // Fetch Live Graph Topology from Neo4j
  const fetchLiveGraph = useCallback(
    async (isSilent = false) => {
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
            description:
              err.response?.data?.detail || err.message || "Failed to load graph records.",
          });
        }
      } finally {
        setIsLoadingGraph(false);
      }
    },
    [apiBaseUrl, onRefreshLiveGraph]
  );

  // Initial Auto-Sync on Dashboard Mount
  useEffect(() => {
    fetchLiveGraph(true);
  }, [fetchLiveGraph]);

  // Push filtered elements whenever data or filters change
  useEffect(() => {
    updateGraph(filteredElements);
  }, [filteredElements, updateGraph]);

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
      if (cyRef.current && !cyRef.current.destroyed()) {
        cyRef.current.stop();
        cyRef.current.elements().remove();
      }
      setSelectedItem(null);
    }
  }, [refreshTrigger, fetchLiveGraph]);

  const handleZoomIn = () => {
    if (cyRef.current && !cyRef.current.destroyed()) {
      cyRef.current.zoom(cyRef.current.zoom() * 1.25);
    }
  };

  const handleZoomOut = () => {
    if (cyRef.current && !cyRef.current.destroyed()) {
      cyRef.current.zoom(cyRef.current.zoom() * 0.8);
    }
  };

  const handleFit = () => {
    if (cyRef.current && !cyRef.current.destroyed()) {
      cyRef.current.fit(undefined, 35);
    }
  };

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
    <div className="flex flex-col h-full bg-[#0c1427]/90 border border-slate-800/80 rounded-xl p-3.5 shadow-sm relative overflow-hidden font-sans">
      {/* Top Header (Step 5: Split ambiguous entities into clean Nodes · Relationships label) */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4 text-blue-400" />
          <h2 className="text-xs font-bold tracking-wide text-white uppercase">
            Criminal Syndicate Network Topology
          </h2>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-emerald-400">
            {stats.totalNodes > 0
              ? `${stats.totalNodes} NODES · ${stats.totalEdges} RELATIONSHIPS`
              : "AWAITING INTAKE"}
          </span>
        </div>

        {/* Controls Toolbar */}
        <div className="flex items-center gap-2">
          {/* Layout Selector */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-md px-1.5 py-0.5 text-xs text-slate-300">
            <Layers className="w-3 h-3 text-slate-400 mr-1" />
            <select
              value={layoutName}
              onChange={(e) => setLayoutName(e.target.value)}
              className="bg-transparent text-[11px] text-slate-200 outline-none cursor-pointer"
            >
              <option value="fcose" className="bg-slate-900">Compound Force-Directed (fCoSE)</option>
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
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-800 active:scale-95 text-xs font-medium text-slate-200 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            title="Fetch and sync live graph from Neo4j"
          >
            <RefreshCw className={`w-3 h-3 ${isLoadingGraph ? "animate-spin text-blue-400" : ""}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Filter / Search HUD Bar */}
      <div className="flex items-center justify-between gap-2 py-1.5 px-2.5 mt-2 rounded-lg bg-[#080d1a] border border-slate-800/80 text-xs">
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
                ? "bg-slate-700 text-white font-semibold"
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

      {/* Main Enterprise Canvas Area */}
      <div className="relative flex-1 mt-2 rounded-lg border border-slate-800 bg-[#080d1a] overflow-hidden enterprise-grid">
        {/* Permanent Cytoscape Canvas Container */}
        <div
          ref={containerRef}
          className="w-full h-full absolute inset-0 z-0"
          style={{ width: "100%", height: "100%" }}
        />

        {/* Loading Overlay */}
        {isLoadingGraph && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#080d1a]/80 backdrop-blur-xs text-slate-400 gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            <span className="text-xs text-slate-300 font-medium">QUERYING NEO4J GRAPH TOPOLOGY...</span>
          </div>
        )}

        {/* Empty State Overlay */}
        {!isLoadingGraph && elements.length === 0 && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-slate-400 gap-3 text-center p-6 bg-[#080d1a]">
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
        )}

        {/* Floating Zoom & Fit Controls */}
        {elements.length > 0 && (
          <div className="absolute top-2.5 right-2.5 flex flex-col gap-1 p-1 rounded-md bg-slate-900 border border-slate-700 shadow-md z-10">
            <button
              onClick={handleZoomIn}
              className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleFit}
              className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Fit to Screen"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Floating Formal Legend with Cluster Color Badges */}
        {elements.length > 0 && (
          <div className="absolute bottom-2.5 left-2.5 p-2 rounded-lg bg-slate-900/95 border border-slate-700 shadow-lg text-[10px] text-slate-300 z-10 space-y-1.5">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-1 font-semibold text-slate-200">
              <span>Entity Shapes:</span>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block" />
                <span className="text-slate-400 font-normal">Person</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-slate-400 inline-block" />
                <span className="text-slate-400 font-normal">Phone</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-slate-400 inline-block rotate-45" />
                <span className="text-slate-400 font-normal">Account</span>
              </div>
            </div>
            <div className="flex items-center gap-2 font-medium">
              <span className="text-slate-400 font-semibold">Syndicate Cells:</span>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                <span>Cell 0</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                <span>Cell 1</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                <span>Cell 2</span>
              </div>
              <div className="flex items-center gap-1 ml-1 pl-1 border-l border-slate-800">
                <span className="w-3 h-0.5 bg-orange-500 inline-block" />
                <span className="text-orange-300">Inter-Cell Bridge</span>
              </div>
            </div>
          </div>
        )}

        {/* Floating Entity Inspector */}
        {selectedItem && (
          <div className="absolute top-2.5 left-2.5 max-w-[260px] w-full p-3 rounded-lg bg-slate-900 border border-slate-700 shadow-xl z-20">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <div className="flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] font-bold text-slate-200 uppercase">
                  {selectedItem.type === "node" ? "Entity Dossier" : "Relationship Dossier"}
                </span>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-slate-400 hover:text-white text-xs px-1 cursor-pointer"
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
              {selectedItem.data.cluster !== undefined && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Syndicate Cell:</span>
                  <span className="text-blue-400 font-bold">
                    {selectedItem.data.cluster === "unclustered"
                      ? "Unassigned"
                      : `Cell ${selectedItem.data.cluster}`}
                  </span>
                </div>
              )}
              {selectedItem.data.type && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Class:</span>
                  <span className="text-slate-300">{selectedItem.data.type}</span>
                </div>
              )}
              {selectedItem.data.aliases && selectedItem.data.aliases.length > 0 && (
                <div className="flex flex-col gap-0.5 pt-1 border-t border-slate-800">
                  <span className="text-slate-400">Resolved Aliases:</span>
                  <span className="text-amber-300 font-mono text-[10px] break-words">
                    {Array.isArray(selectedItem.data.aliases)
                      ? selectedItem.data.aliases.join(", ")
                      : selectedItem.data.aliases}
                  </span>
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
