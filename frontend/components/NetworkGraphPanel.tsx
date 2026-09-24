"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Users,
  Phone,
  CreditCard,
  Layers,
  Search,
  Info,
  Loader2,
  Network,
  Radio,
  Copy,
  Check,
  MapPin,
  Car,
  Route,
  Focus,
  ShieldAlert,
  Sparkles,
  Eye,
  SlidersHorizontal
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

// Data URI SVGs for sharp crisp node icons
const SVG_ICONS = {
  person: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="white"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`,
  phone: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="white"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>`,
  bank: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="white"><path d="M4 10v7h3v-7H4zm6 0v7h3v-7h-3zM2 22h19v-3H2v3zm14-12v7h3v-7h-3zm-4.5-9L2 6v2h19V6l-9.5-5z"/></svg>`,
  location: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`,
  vehicle: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="white"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.85 7h10.29l1.04 3H5.81l1.04-3zM19 17H5v-4.66l.12-.34h13.77l.11.34V17z"/><circle cx="7.5" cy="14.5" r="1.5"/><circle cx="16.5" cy="14.5" r="1.5"/></svg>`
};

const CLUSTER_METADATA: Record<string, { label: string; bgColor: string; borderColor: string; textColor: string }> = {
  "0": { label: "📁 Group A: Core Coordinators & Transport", bgColor: "#fef9c3", borderColor: "#facc15", textColor: "#854d0e" },
  "1": { label: "📁 Group B: Financial Mules & Structuring", bgColor: "#e0f2fe", borderColor: "#7dd3fc", textColor: "#0369a1" },
  "2": { label: "📁 Group C: Operations & Telecom Cell", bgColor: "#dcfce7", borderColor: "#86efac", textColor: "#15803d" },
  "3": { label: "📁 Group D: Regional Hawala Channel", bgColor: "#ffe4e6", borderColor: "#fda4af", textColor: "#be123c" },
  "unclustered": { label: "📁 Unassigned Network Cell", bgColor: "#f1f5f9", borderColor: "#cbd5e1", textColor: "#334155" },
};

interface NetworkGraphPanelProps {
  apiBaseUrl: string;
  refreshTrigger?: number;
  onRefreshLiveGraph?: () => void;
}

// Transform raw elements into compound graph elements grouped by cluster
function buildCompoundElements(
  rawNodes: ElementDefinition[],
  rawEdges: ElementDefinition[]
): ElementDefinition[] {
  if (!rawNodes || rawNodes.length === 0) return [];

  const clusterIds = Array.from(
    new Set(rawNodes.map((n) => String(n.data.cluster || "0")))
  );

  // Parent compound containers (Pastel cloud containers with generous padding)
  const clusterParents: ElementDefinition[] = clusterIds.map((clusterId) => {
    const meta = CLUSTER_METADATA[clusterId] || {
      label: `📁 Group ${String.fromCharCode(65 + (parseInt(clusterId) || 0))}: Syndicate Cell ${clusterId}`,
      bgColor: "#f3e8ff",
      borderColor: "#d8b4fe",
      textColor: "#6b21a8",
    };
    return {
      data: {
        id: `cluster-${clusterId}`,
        label: meta.label,
        isClusterParent: true,
        cluster: clusterId,
      },
    };
  });

  // Child nodes assigned to parent compound containers with clean, readable 2-tier labels
  const childNodes: ElementDefinition[] = rawNodes.map((n) => {
    const isKey = Boolean(n.data.isKeySuspect);
    let roleTag = "";
    if (n.data.type === "Person") {
      roleTag = isKey ? "★ KEY SUSPECT" : "PERSON";
    } else if (n.data.type === "PhoneNumber") {
      roleTag = "PHONE";
    } else if (n.data.type === "BankAccount") {
      roleTag = "BANK A/C";
    } else if (n.data.type === "Vehicle") {
      roleTag = "VEHICLE";
    } else if (n.data.type === "Location") {
      roleTag = "LOCATION";
    }

    const primaryLabel = String(n.data.label || n.data.name || n.data.id);
    const formattedDisplay = roleTag ? `${primaryLabel}\n[${roleTag}]` : primaryLabel;

    return {
      ...n,
      data: {
        ...n.data,
        displayLabel: formattedDisplay,
        parent: `cluster-${String(n.data.cluster || "0")}`,
      },
    };
  });

  // Edges annotated with cross-cluster flag for distinct bridge styling
  const nodeClusterMap = new Map<string, string>();
  rawNodes.forEach((n) => {
    if (n.data?.id) {
      nodeClusterMap.set(String(n.data.id), String(n.data.cluster || "0"));
    }
  });

  const edgesWithCrossFlag: ElementDefinition[] = rawEdges.map((e) => {
    const sCluster = nodeClusterMap.get(String(e.data.source));
    const tCluster = nodeClusterMap.get(String(e.data.target));
    const isCross = Boolean(sCluster && tCluster && sCluster !== tCluster);
    const isSmurf = Boolean(e.data.isSmurfing);
    return {
      ...e,
      data: {
        ...e.data,
        crossCluster: String(isCross || isSmurf),
        isCross: isCross || isSmurf,
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
  const panelRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);

  const [elements, setElements] = useState<ElementDefinition[]>([]);
  const [isLoadingGraph, setIsLoadingGraph] = useState<boolean>(false);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [layoutName, setLayoutName] = useState<string>("fcose");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [copiedText, setCopiedText] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Path tracing state (Specialty 1)
  const [pathTraceMode, setPathTraceMode] = useState(false);
  const [pathStartNode, setPathStartNode] = useState<string | null>(null);

  const isInitialMount = useRef(true);

  // Authoritative, High-Legibility Graph Stylesheet
  const cytoscapeStylesheet: any[] = useMemo(
    () => [
      // Base Node (Circle with white icon inside, large clean 2-tier badge below)
      {
        selector: "node:not([?isClusterParent])",
        style: {
          shape: "ellipse",
          width: 48,
          height: 48,
          "background-color": "#2563eb",
          "border-width": 3,
          "border-color": "#ffffff",
          "background-fit": "none",
          "background-clip": "node",
          "background-width": "55%",
          "background-height": "55%",
          "background-position-x": "50%",
          "background-position-y": "50%",
          "background-image": SVG_ICONS.person,
          // 2-tier label styling with clean white badge
          label: "data(displayLabel)",
          color: "#0f172a",
          "font-size": "11px",
          "font-weight": "800",
          "font-family": "system-ui, -apple-system, sans-serif",
          "text-valign": "bottom",
          "text-halign": "center",
          "text-margin-y": 10,
          "text-wrap": "wrap",
          "text-max-width": "140px",
          "text-background-opacity": 0.98,
          "text-background-color": "#ffffff",
          "text-background-padding": "5px",
          "text-background-shape": "roundrectangle",
          "text-border-opacity": 0.9,
          "text-border-width": 1.5,
          "text-border-color": "#cbd5e1",
          "shadow-blur": 10,
          "shadow-color": "rgba(0, 0, 0, 0.12)",
          "shadow-opacity": 0.8,
          transition: "opacity 0.25s ease-in-out, border-width 0.2s ease-in-out",
        },
      },
      // Key Suspect Person Node (BOLD RED, Glowing Ring)
      {
        selector: "node[type='Person'][?isKeySuspect]:not([?isClusterParent])",
        style: {
          width: 58,
          height: 58,
          "background-color": "#dc2626",
          "border-color": "#fef08a",
          "border-width": 4.5,
          "background-image": SVG_ICONS.person,
          "shadow-blur": 18,
          "shadow-color": "rgba(220, 38, 38, 0.45)",
          "text-border-color": "#fca5a5",
          "text-border-width": 2,
        },
      },
      // Standard Person Node (Royal Navy)
      {
        selector: "node[type='Person'][!isKeySuspect]:not([?isClusterParent])",
        style: {
          width: 48,
          height: 48,
          "background-color": "#1e40af",
          "border-color": "#ffffff",
          "background-image": SVG_ICONS.person,
          "text-border-color": "#93c5fd",
        },
      },
      // PhoneNumber Node (EMERALD GREEN circle with Phone Icon)
      {
        selector: "node[type='PhoneNumber']:not([?isClusterParent])",
        style: {
          width: 46,
          height: 46,
          "background-color": "#059669",
          "border-color": "#ffffff",
          "background-image": SVG_ICONS.phone,
          "text-border-color": "#86efac",
        },
      },
      // BankAccount Node (SLATE / CYAN BLUE circle with Bank Icon)
      {
        selector: "node[type='BankAccount']:not([?isClusterParent])",
        style: {
          width: 46,
          height: 46,
          "background-color": "#0284c7",
          "border-color": "#ffffff",
          "background-image": SVG_ICONS.bank,
          "text-border-color": "#7dd3fc",
        },
      },
      // Location / Tower Node (PURPLE circle with Map Pin Icon)
      {
        selector: "node[type='Location']:not([?isClusterParent])",
        style: {
          width: 46,
          height: 46,
          "background-color": "#7c3aed",
          "border-color": "#ffffff",
          "background-image": SVG_ICONS.location,
          "text-border-color": "#d8b4fe",
        },
      },
      // Vehicle Node (AMBER circle with Car Icon)
      {
        selector: "node[type='Vehicle']:not([?isClusterParent])",
        style: {
          width: 46,
          height: 46,
          "background-color": "#d97706",
          "border-color": "#ffffff",
          "background-image": SVG_ICONS.vehicle,
          "text-border-color": "#fde047",
        },
      },
      // Hover & Selected Node State (Investigative Focus Glow)
      {
        selector: "node:not([?isClusterParent]):selected, node:not([?isClusterParent]).hovered",
        style: {
          "border-color": "#ea580c",
          "border-width": 5,
          "text-background-color": "#0f172a",
          "text-border-color": "#ea580c",
          color: "#ffffff",
          "font-size": "12px",
          "z-index": 9999,
          "shadow-blur": 22,
          "shadow-color": "rgba(234, 88, 12, 0.6)",
        },
      },
      // Dimmed state for non-focused elements
      {
        selector: ".dimmed",
        style: {
          opacity: 0.15,
          "z-index": 1,
        },
      },
      // Highlighted path elements
      {
        selector: ".path-highlighted",
        style: {
          "border-color": "#eab308",
          "border-width": 6,
          "line-color": "#eab308",
          "target-arrow-color": "#eab308",
          width: 4.5,
          "z-index": 999,
          opacity: 1,
        },
      },
      // Compound Group / Community Parent Containers (Spacious Pastel Cloud Box)
      {
        selector: "node[?isClusterParent]",
        style: {
          "background-opacity": 0.35,
          "background-color": "#fef9c3",
          "border-width": 2,
          "border-style": "dashed",
          "border-color": "#facc15",
          label: "data(label)",
          "text-valign": "top",
          "text-halign": "center",
          "font-size": "12px",
          "font-weight": "800",
          color: "#854d0e",
          padding: 60,
          "text-background-opacity": 0.98,
          "text-background-color": "#ffffff",
          "text-background-padding": "6px",
          "text-background-shape": "roundrectangle",
          "text-border-width": 1.5,
          "text-border-color": "#facc15",
          "border-opacity": 0.9,
          events: "no",
        },
      },
      {
        selector: 'node[?isClusterParent][cluster = "0"]',
        style: {
          "background-color": "#fef9c3",
          "border-color": "#facc15",
          color: "#854d0e",
          "text-border-color": "#facc15",
        },
      },
      {
        selector: 'node[?isClusterParent][cluster = "1"]',
        style: {
          "background-color": "#e0f2fe",
          "border-color": "#7dd3fc",
          color: "#0369a1",
          "text-border-color": "#7dd3fc",
        },
      },
      {
        selector: 'node[?isClusterParent][cluster = "2"]',
        style: {
          "background-color": "#dcfce7",
          "border-color": "#86efac",
          color: "#15803d",
          "text-border-color": "#86efac",
        },
      },
      {
        selector: 'node[?isClusterParent][cluster = "3"]',
        style: {
          "background-color": "#ffe4e6",
          "border-color": "#fda4af",
          color: "#be123c",
          "text-border-color": "#fda4af",
        },
      },
      // Base Edge Style (Clean directional arrow with readable label)
      {
        selector: "edge",
        style: {
          label: "data(label)",
          "font-size": "10px",
          "font-weight": "700",
          "font-family": "system-ui, -apple-system, sans-serif",
          color: "#1e293b",
          "text-background-opacity": 0.96,
          "text-background-color": "#ffffff",
          "text-background-padding": "3px",
          "text-background-shape": "roundrectangle",
          "text-border-opacity": 0.9,
          "text-border-width": 1,
          "text-border-color": "#cbd5e1",
          "text-rotation": "autorotate",
          "curve-style": "bezier",
          "target-arrow-shape": "triangle",
          "arrow-scale": 1.1,
          width: 2.2,
          "line-color": "#64748b",
          "target-arrow-color": "#64748b",
          "line-style": "solid",
          transition: "opacity 0.25s ease-in-out",
        },
      },
      // Predicted / Potential Link / Smurfing Structuring (Crimson Red Dashed Arrow)
      {
        selector: 'edge[crossCluster = "true"], edge[?isSmurfing]',
        style: {
          "line-color": "#dc2626",
          "target-arrow-color": "#dc2626",
          "line-style": "dashed",
          width: 2.8,
          "z-index": 20,
          color: "#991b1b",
          "text-border-color": "#fca5a5",
          "text-rotation": "autorotate",
        },
      },
      // Hover & Selected Edge
      {
        selector: "edge:selected, edge.hovered",
        style: {
          label: "data(label)",
          "z-index": 9999,
          width: 4,
          "line-color": "#ea580c",
          "target-arrow-color": "#ea580c",
          color: "#ffffff",
          "text-background-color": "#0f172a",
          "text-border-color": "#ea580c",
          "font-weight": "800",
        },
      },
    ],
    []
  );

  // Layout Configuration with ample spacing
  const layoutConfig = useMemo(() => {
    if (layoutName === "concentric") {
      return {
        name: "concentric",
        animate: true,
        animationDuration: 600,
        padding: 70,
        concentric: (node: any) => {
          if (node.data("isKeySuspect")) return 4;
          if (node.data("type") === "Person") return 3;
          if (node.data("type") === "PhoneNumber") return 2;
          return 1;
        },
        levelWidth: () => 1,
        nodeDimensionsIncludeLabels: true,
      };
    }
    if (layoutName === "breadthfirst") {
      return {
        name: "breadthfirst",
        directed: true,
        animate: true,
        animationDuration: 600,
        padding: 70,
        spacingFactor: 1.8,
        nodeDimensionsIncludeLabels: true,
      };
    }
    if (layoutName === "circle") {
      return {
        name: "circle",
        animate: true,
        animationDuration: 600,
        padding: 80,
        spacingFactor: 1.6,
        nodeDimensionsIncludeLabels: true,
      };
    }
    if (layoutName === "grid") {
      return {
        name: "grid",
        animate: true,
        animationDuration: 600,
        padding: 80,
        nodeDimensionsIncludeLabels: true,
      };
    }

    // Default: fCoSE force-directed organic with wide spacing
    return {
      name: "fcose",
      quality: "proof",
      animate: true,
      animationDuration: 600,
      padding: 70,
      fit: true,
      nodeRepulsion: (node: any) => (node.data("isKeySuspect") ? 60000 : 35000),
      idealEdgeLength: (edge: any) => (edge.data("isCross") ? 380 : 200),
      nodeSeparation: 180,
      packComponents: true,
      nestingFactor: 0.1,
      gravity: 0.15,
      gravityRangeCompound: 2.2,
      tile: false,
    };
  }, [layoutName]);

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
          (el.data.label && String(el.data.label).toLowerCase().includes(q)) ||
          (el.data.sublabel && String(el.data.sublabel).toLowerCase().includes(q)) ||
          (el.data.role && String(el.data.role).toLowerCase().includes(q)) ||
          (el.data.id && String(el.data.id).toLowerCase().includes(q))
      );
    }

    return result;
  }, [elements, filterType, searchQuery]);

  // Safe Graph Mutator
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
          wheelSensitivity: 0.35,
        });
        cyRef.current = cy;

        const cyInst = cy;

        // Hover events
        cyInst.on("mouseover", "node:not([?isClusterParent]), edge", (evt) => {
          evt.target.addClass("hovered");
        });
        cyInst.on("mouseout", "node:not([?isClusterParent]), edge", (evt) => {
          evt.target.removeClass("hovered");
        });

        // Click on node: Trigger 1-Hop Focus Highlighting
        cyInst.on("tap", "node:not([?isClusterParent])", (evt) => {
          const node = evt.target;
          setSelectedItem({
            type: "node",
            data: node.data(),
          });

          // Focus Highlighting: Dim unrelated nodes
          evt.cy.elements().removeClass("dimmed path-highlighted");
          const neighborhood = node.neighborhood().add(node);
          evt.cy.elements().not(neighborhood).addClass("dimmed");
        });

        // Click on edge
        cyInst.on("tap", "edge", (evt) => {
          setSelectedItem({
            type: "edge",
            data: evt.target.data(),
          });
        });

        // Tap on background: Reset Focus
        cyInst.on("tap", (evt) => {
          if (evt.target === evt.cy) {
            setSelectedItem(null);
            evt.cy.elements().removeClass("dimmed path-highlighted");
          }
        });
      }

      const activeCy = cy;
      if (!activeCy) return;

      try {
        activeCy.stop();
        activeCy.elements().remove();

        const rawNodes = newElements.filter((el) => !el.data.source);
        const rawEdges = newElements.filter((el) => el.data.source);

        const compoundElements = buildCompoundElements(rawNodes, rawEdges);

        if (compoundElements.length > 0) {
          activeCy.add(compoundElements);
          activeCy.resize();
          const layout = activeCy.layout(layoutConfig as any);
          layout.run();
          activeCy.fit(undefined, 60);
        }
      } catch (err) {
        console.error("Error updating cytoscape graph:", err);
      }
    },
    [layoutConfig, cytoscapeStylesheet]
  );

  // Initialize Cytoscape container
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
      wheelSensitivity: 0.35,
    });

    cyRef.current = cy;

    cy.on("mouseover", "node:not([?isClusterParent]), edge", (evt) => {
      evt.target.addClass("hovered");
    });
    cy.on("mouseout", "node:not([?isClusterParent]), edge", (evt) => {
      evt.target.removeClass("hovered");
    });

    cy.on("tap", "node:not([?isClusterParent])", (evt) => {
      const node = evt.target;
      setSelectedItem({
        type: "node",
        data: node.data(),
      });

      // Highlight neighborhood
      cy.elements().removeClass("dimmed path-highlighted");
      const neighborhood = node.neighborhood().add(node);
      cy.elements().not(neighborhood).addClass("dimmed");
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
        cy.elements().removeClass("dimmed path-highlighted");
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
  }, [cytoscapeStylesheet, layoutConfig]);

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

  // Push filtered elements whenever data or filters change
  useEffect(() => {
    updateGraph(filteredElements);
  }, [filteredElements, updateGraph]);

  // When parent triggers a refresh (e.g. after file ingestion or purge)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (refreshTrigger > 0) {
      fetchLiveGraph(false);
    } else if (refreshTrigger === -1) {
      setElements([]);
      if (cyRef.current && !cyRef.current.destroyed()) {
        cyRef.current.stop();
        cyRef.current.elements().remove();
      }
      setSelectedItem(null);
    }
  }, [refreshTrigger, fetchLiveGraph]);

  // Handle Fullscreen Toggle
  const handleToggleFullscreen = () => {
    setIsFullscreen((prev) => {
      const nextState = !prev;
      setTimeout(() => {
        if (cyRef.current && !cyRef.current.destroyed()) {
          cyRef.current.resize();
          cyRef.current.fit(undefined, 60);
        }
      }, 200);
      return nextState;
    });
  };

  // Keyboard ESC listener for fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
        setTimeout(() => {
          if (cyRef.current && !cyRef.current.destroyed()) {
            cyRef.current.resize();
            cyRef.current.fit(undefined, 50);
          }
        }, 200);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  const handleZoomIn = () => {
    if (cyRef.current && !cyRef.current.destroyed()) {
      cyRef.current.zoom(cyRef.current.zoom() * 1.3);
    }
  };

  const handleZoomOut = () => {
    if (cyRef.current && !cyRef.current.destroyed()) {
      cyRef.current.zoom(cyRef.current.zoom() / 1.3);
    }
  };

  const handleFit = () => {
    if (cyRef.current && !cyRef.current.destroyed()) {
      cyRef.current.fit(undefined, 60);
    }
  };

  const handleResetFocus = () => {
    if (cyRef.current && !cyRef.current.destroyed()) {
      cyRef.current.elements().removeClass("dimmed path-highlighted");
      setSelectedItem(null);
      cyRef.current.fit(undefined, 60);
    }
  };

  const handleCopyInspector = () => {
    if (!selectedItem) return;
    navigator.clipboard.writeText(JSON.stringify(selectedItem.data, null, 2));
    setCopiedText(true);
    toast.success("Details Copied to Clipboard");
    setTimeout(() => setCopiedText(false), 2000);
  };

  // Dynamic statistics for entity counts
  const stats = useMemo(() => {
    const nodes = elements.filter((el) => !el.data.source);
    const edges = elements.filter((el) => el.data.source);
    const persons = nodes.filter((n) => n.data.type === "Person").length;
    const phones = nodes.filter((n) => n.data.type === "PhoneNumber").length;
    const accounts = nodes.filter((n) => n.data.type === "BankAccount").length;
    const keySuspectNode = nodes.find((n) => n.data.isKeySuspect) || nodes.find((n) => n.data.type === "Person");
    const keySuspectName = keySuspectNode ? String(keySuspectNode.data.name || keySuspectNode.data.label) : "None";
    
    const clusterSet = new Set(nodes.map((n) => n.data.cluster).filter(Boolean));
    const totalCommunities = clusterSet.size;

    return {
      persons,
      phones,
      accounts,
      totalNodes: nodes.length,
      totalEdges: edges.length,
      keySuspectName,
      totalCommunities
    };
  }, [elements]);

  return (
    <div
      ref={panelRef}
      className={`flex flex-col bg-white border border-slate-200 rounded-2xl p-4 shadow-sm relative font-sans transition-all duration-300 ${
        isFullscreen
          ? "fixed inset-0 z-[100] w-screen h-screen rounded-none p-5 bg-[#f5f7fa]"
          : "h-full"
      }`}
    >
      {/* Top Filter & Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-slate-200">
        {/* Search Input */}
        <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search suspects, phone lines, accounts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none text-xs text-slate-800 placeholder:text-slate-400 w-full font-medium"
          />
        </div>

        {/* Quick Filter Badges */}
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <button
            onClick={() => setFilterType("ALL")}
            className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
              filterType === "ALL"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100"
            }`}
          >
            All ({stats.totalNodes})
          </button>
          <button
            onClick={() => setFilterType("Person")}
            className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
              filterType === "Person"
                ? "bg-blue-700 text-white shadow-xs"
                : "bg-blue-50 border border-blue-200 text-blue-800 hover:bg-blue-100"
            }`}
          >
            Persons ({stats.persons})
          </button>
          <button
            onClick={() => setFilterType("PhoneNumber")}
            className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
              filterType === "PhoneNumber"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100"
            }`}
          >
            Phones ({stats.phones})
          </button>
          <button
            onClick={() => setFilterType("BankAccount")}
            className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
              filterType === "BankAccount"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-blue-50 border border-blue-200 text-blue-800 hover:bg-blue-100"
            }`}
          >
            Accounts ({stats.accounts})
          </button>
        </div>

        {/* Layout Switcher & Action Controls */}
        <div className="flex items-center gap-2">
          {/* Layout Selector */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs text-slate-700 shadow-2xs">
            <Layers className="w-3.5 h-3.5 text-slate-500 mr-1.5" />
            <select
              value={layoutName}
              onChange={(e) => setLayoutName(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
            >
              <option value="fcose">Force-Directed (Spacious)</option>
              <option value="concentric">Concentric Hierarchy (Key Orbit)</option>
              <option value="circle">Circular Cell Cluster</option>
              <option value="breadthfirst">Top-Down Directed Flow</option>
              <option value="grid">Structured Matrix</option>
            </select>
          </div>

          {/* Sync Button */}
          <button
            onClick={() => fetchLiveGraph(false)}
            disabled={isLoadingGraph}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white active:scale-95 text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
            title="Fetch and sync live graph from Neo4j"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingGraph ? "animate-spin" : ""}`} />
            <span>Sync</span>
          </button>

          {/* Fullscreen Toggle Button */}
          <button
            onClick={handleToggleFullscreen}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-xs ${
              isFullscreen
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
            title={isFullscreen ? "Exit Fullscreen (ESC)" : "Expand Graph Fullscreen"}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-amber-300" />
                <span>Exit Fullscreen</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-blue-600" />
                <span>Fullscreen</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Canvas Area (Centerpiece of the Screen) */}
      <div className="relative flex-1 mt-3 rounded-xl border border-slate-200 bg-[#fafcff] overflow-hidden enterprise-grid-light shadow-xs">
        {/* Subtle India Map Silhouette & Geographic Intelligence Watermark */}
        <div className="absolute inset-0 pointer-events-none z-0 flex items-center justify-center overflow-hidden opacity-[0.055] select-none">
          <svg
            viewBox="0 0 600 700"
            className="w-full h-full max-w-[620px] max-h-[680px] text-slate-900"
            fill="currentColor"
          >
            {/* Stylized National Grid Outline of India */}
            <path
              d="M 285 45 C 290 55, 305 60, 310 75 C 315 90, 330 95, 335 110 C 340 125, 360 135, 370 150 C 385 165, 410 170, 420 185 C 430 200, 445 205, 455 220 C 465 240, 480 250, 470 270 C 460 285, 435 290, 430 305 C 420 325, 400 340, 395 360 C 390 380, 385 400, 375 420 C 365 440, 350 460, 340 480 C 330 500, 320 520, 310 540 C 300 560, 290 580, 285 600 C 280 610, 275 620, 270 610 C 265 590, 255 565, 245 540 C 235 515, 220 490, 210 465 C 200 440, 190 415, 185 390 C 180 365, 175 340, 170 315 C 165 290, 155 270, 150 250 C 145 230, 150 210, 160 195 C 175 180, 195 170, 210 155 C 225 140, 240 120, 250 100 C 260 80, 275 60, 285 45 Z"
              stroke="#0f172a"
              strokeWidth="2"
              fillOpacity="0.8"
            />
          </svg>
        </div>

        {/* Geographic Reference Radar Grid & Regional Markers (Synthetic Context) */}
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden select-none">
          {/* Delhi NCR Node */}
          <div className="absolute top-[28%] left-[45%] flex items-center gap-1.5 opacity-35">
            <span className="w-2 h-2 rounded-full bg-blue-600 ring-4 ring-blue-500/20" />
            <span className="text-[10px] font-bold tracking-wider text-slate-600 uppercase font-mono">
              DELHI NCR
            </span>
          </div>

          {/* Mumbai Node */}
          <div className="absolute top-[52%] left-[34%] flex items-center gap-1.5 opacity-35">
            <span className="w-2 h-2 rounded-full bg-blue-600 ring-4 ring-blue-500/20" />
            <span className="text-[10px] font-bold tracking-wider text-slate-600 uppercase font-mono">
              MUMBAI
            </span>
          </div>

          {/* Lucknow / Bareilly Node */}
          <div className="absolute top-[33%] left-[53%] flex items-center gap-1.5 opacity-35">
            <span className="w-2 h-2 rounded-full bg-blue-600 ring-4 ring-blue-500/20" />
            <span className="text-[10px] font-bold tracking-wider text-slate-600 uppercase font-mono">
              LUCKNOW • BAREILLY
            </span>
          </div>

          {/* Hyderabad Node */}
          <div className="absolute top-[58%] left-[46%] flex items-center gap-1.5 opacity-35">
            <span className="w-2 h-2 rounded-full bg-blue-600 ring-4 ring-blue-500/20" />
            <span className="text-[10px] font-bold tracking-wider text-slate-600 uppercase font-mono">
              HYDERABAD
            </span>
          </div>

          {/* Bengaluru Node */}
          <div className="absolute top-[70%] left-[44%] flex items-center gap-1.5 opacity-35">
            <span className="w-2 h-2 rounded-full bg-blue-600 ring-4 ring-blue-500/20" />
            <span className="text-[10px] font-bold tracking-wider text-slate-600 uppercase font-mono">
              BENGALURU
            </span>
          </div>

          {/* Grid Latitude / Longitude lines watermark */}
          <div className="absolute bottom-2.5 left-3 text-[9px] font-mono text-slate-400 opacity-60">
            GEO-INT REFERENCE GRID // 78°00'E 22°00'N • SYNTHETIC TOPOLOGY
          </div>
        </div>

        {/* Permanent Cytoscape Canvas */}
        <div
          ref={containerRef}
          className="w-full h-full absolute inset-0 z-0"
          style={{ width: "100%", height: "100%" }}
        />

        {/* Loading Overlay */}
        {isLoadingGraph && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/85 backdrop-blur-xs text-slate-700 gap-2.5">
            <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
            <span className="text-xs text-slate-900 font-extrabold tracking-wide uppercase">
              Computing Dynamic Syndicate Topology &amp; Modularity...
            </span>
          </div>
        )}

        {/* Empty State Overlay */}
        {!isLoadingGraph && elements.length === 0 && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-slate-600 gap-3 text-center p-6 bg-slate-50/95">
            <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-blue-600 shadow-md">
              <Radio className="w-7 h-7 animate-pulse text-blue-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Awaiting Evidence Ingestion
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Upload CDR logs, Bank transactions CSV, or FIR case dossiers to generate the interactive criminal syndicate graph.
              </p>
            </div>
            <button
              onClick={() => fetchLiveGraph(false)}
              className="mt-1 flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Load Active Database Graph</span>
            </button>
          </div>
        )}

        {/* Floating Zoom & Layout Floating Controls */}
        {elements.length > 0 && (
          <div className="absolute top-3 right-3 flex flex-col gap-1 p-1 rounded-xl bg-white/95 backdrop-blur-md border border-slate-200 shadow-lg z-10">
            <button
              onClick={handleZoomIn}
              className="p-1.5 rounded-lg text-slate-700 hover:text-slate-950 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-1.5 rounded-lg text-slate-700 hover:text-slate-950 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleFit}
              className="p-1.5 rounded-lg text-slate-700 hover:text-slate-950 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Fit to Screen"
            >
              <Focus className="w-4 h-4" />
            </button>
            <button
              onClick={handleResetFocus}
              className="p-1.5 rounded-lg text-slate-700 hover:text-slate-950 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Reset Focus / Show All Nodes"
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Floating Entity Dossier Inspector */}
        {selectedItem && (
          <div className="absolute top-3 left-3 max-w-[310px] w-full p-4 rounded-2xl bg-white/98 backdrop-blur-md border border-slate-200 shadow-2xl z-20 font-sans animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700">
                  <Info className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-black text-slate-900 uppercase tracking-wide">
                  {selectedItem.type === "node" ? "Entity Dossier" : "Relationship Dossier"}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleCopyInspector}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
                  title="Copy Details JSON"
                >
                  {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => {
                    setSelectedItem(null);
                    if (cyRef.current && !cyRef.current.destroyed()) {
                      cyRef.current.elements().removeClass("dimmed");
                    }
                  }}
                  className="text-slate-400 hover:text-slate-800 text-sm px-1.5 py-0.5 rounded-md hover:bg-slate-100 cursor-pointer font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500 font-medium">Identifier:</span>
                <span className="text-slate-900 font-bold truncate max-w-[170px]">
                  {selectedItem.data.label || selectedItem.data.id}
                </span>
              </div>
              {selectedItem.data.cluster !== undefined && (
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500 font-medium">Syndicate Group:</span>
                  <span className="text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded-md text-[11px]">
                    {selectedItem.data.cluster === "unclustered"
                      ? "Unassigned"
                      : `Group ${String.fromCharCode(65 + (parseInt(selectedItem.data.cluster) || 0))}`}
                  </span>
                </div>
              )}
              {selectedItem.data.type && (
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500 font-medium">Entity Type:</span>
                  <span className="text-slate-800 font-semibold">{selectedItem.data.type}</span>
                </div>
              )}
              {selectedItem.data.isKeySuspect && (
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500 font-medium">Threat Level:</span>
                  <span className="text-white font-bold bg-rose-600 px-2 py-0.5 rounded text-[10px] uppercase tracking-wide">
                    KEY SUSPECT / LEAD
                  </span>
                </div>
              )}
              {selectedItem.data.aliases && selectedItem.data.aliases.length > 0 && (
                <div className="flex flex-col gap-1 py-1 border-b border-slate-50">
                  <span className="text-slate-500 font-medium">Resolved Aliases:</span>
                  <span className="text-amber-900 font-mono text-[11px] bg-amber-50 p-1.5 rounded-md border border-amber-200/60 break-words">
                    {Array.isArray(selectedItem.data.aliases)
                      ? selectedItem.data.aliases.join(", ")
                      : selectedItem.data.aliases}
                  </span>
                </div>
              )}
              {selectedItem.data.role && (
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500 font-medium">Assigned Role:</span>
                  <span className="text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded text-[11px]">
                    {selectedItem.data.role}
                  </span>
                </div>
              )}
              {selectedItem.data.degree !== undefined && (
                <div className="flex justify-between py-1">
                  <span className="text-slate-500 font-medium">Degree Centrality:</span>
                  <span className="text-slate-900 font-bold font-mono">
                    {selectedItem.data.degree} connections
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
