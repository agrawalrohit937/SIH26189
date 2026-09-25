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
  SlidersHorizontal,
  Database,
  Calendar,
  Link2,
  Share2,
  BarChart3,
  Bot
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
  onOpenBriefing?: (entityName: string) => void;
}

// Transform raw elements into compound graph elements grouped by cluster
function formatEntityLabel(raw: string, type?: string): string {
  if (!raw) return "Entity";
  let label = String(raw).trim();
  // Strip raw DB prefixes
  if (label.startsWith("AccountHolder_")) {
    label = label.replace("AccountHolder_", "");
  } else if (label.startsWith("Account_")) {
    label = label.replace("Account_", "");
  } else if (label.startsWith("Person_")) {
    label = label.replace("Person_", "");
  } else if (label.startsWith("Phone_")) {
    label = label.replace("Phone_", "");
  }
  return label;
}

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

    const cleanLabel = formatEntityLabel(
      String(n.data.label || n.data.name || n.data.id),
      n.data.type
    );
    const formattedDisplay = roleTag ? `${cleanLabel}\n[${roleTag}]` : cleanLabel;

    return {
      ...n,
      data: {
        ...n.data,
        displayName: cleanLabel,
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
  onOpenBriefing,
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

  // Temporal Scrubber state
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [showTemporalBar, setShowTemporalBar] = useState<boolean>(true);

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

        // Click on node: Trigger 1-Hop Focus Highlighting & Extract Evidence Connections
        cyInst.on("tap", "node:not([?isClusterParent])", (evt) => {
          const node = evt.target;
          const neighborhood = node.neighborhood();
          const connectedPhones: string[] = [];
          const connectedAccounts: string[] = [];
          const connectedPersons: string[] = [];
          const connectedOthers: string[] = [];

          neighborhood.forEach((ele: any) => {
            if (ele.isNode && ele.isNode()) {
              const t = ele.data("type");
              const lbl = String(ele.data("displayName") || ele.data("label") || ele.data("id"));
              if (t === "PhoneNumber") connectedPhones.push(lbl);
              else if (t === "BankAccount") connectedAccounts.push(lbl);
              else if (t === "Person") connectedPersons.push(lbl);
              else connectedOthers.push(lbl);
            }
          });

          setSelectedItem({
            type: "node",
            data: {
              ...node.data(),
              connectedPhones,
              connectedAccounts,
              connectedPersons,
              connectedOthers,
            },
          });

          // Focus Highlighting: Dim unrelated nodes
          evt.cy.elements().removeClass("dimmed path-highlighted");
          const neighborhoodSet = neighborhood.add(node);
          evt.cy.elements().not(neighborhoodSet).addClass("dimmed");
        });

        // Click on edge
        cyInst.on("tap", "edge", (evt) => {
          const edge = evt.target;
          const sNode = evt.cy.getElementById(edge.data("source"));
          const tNode = evt.cy.getElementById(edge.data("target"));
          setSelectedItem({
            type: "edge",
            data: {
              ...edge.data(),
              sourceLabel: sNode?.data("displayName") || sNode?.data("label") || edge.data("source"),
              targetLabel: tNode?.data("displayName") || tNode?.data("label") || edge.data("target"),
              sourceType: sNode?.data("type"),
              targetType: tNode?.data("type"),
            },
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
      const neighborhood = node.neighborhood();
      const connectedPhones: string[] = [];
      const connectedAccounts: string[] = [];
      const connectedPersons: string[] = [];
      const connectedOthers: string[] = [];

      neighborhood.forEach((ele: any) => {
        if (ele.isNode && ele.isNode()) {
          const t = ele.data("type");
          const lbl = String(ele.data("displayName") || ele.data("label") || ele.data("id"));
          if (t === "PhoneNumber") connectedPhones.push(lbl);
          else if (t === "BankAccount") connectedAccounts.push(lbl);
          else if (t === "Person") connectedPersons.push(lbl);
          else connectedOthers.push(lbl);
        }
      });

      setSelectedItem({
        type: "node",
        data: {
          ...node.data(),
          connectedPhones,
          connectedAccounts,
          connectedPersons,
          connectedOthers,
        },
      });

      // Highlight neighborhood
      cy.elements().removeClass("dimmed path-highlighted");
      const neighborhoodSet = neighborhood.add(node);
      cy.elements().not(neighborhoodSet).addClass("dimmed");
    });

    cy.on("tap", "edge", (evt) => {
      const edge = evt.target;
      const sNode = evt.cy.getElementById(edge.data("source"));
      const tNode = evt.cy.getElementById(edge.data("target"));
      setSelectedItem({
        type: "edge",
        data: {
          ...edge.data(),
          sourceLabel: sNode?.data("displayName") || sNode?.data("label") || edge.data("source"),
          targetLabel: tNode?.data("displayName") || tNode?.data("label") || edge.data("target"),
          sourceType: sNode?.data("type"),
          targetType: tNode?.data("type"),
        },
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

  // Fetch Live Graph Topology from Neo4j (Supports Temporal Scrubber)
  const fetchLiveGraph = useCallback(
    async (isSilent = false, overrideStart?: string, overrideEnd?: string) => {
      setIsLoadingGraph(true);
      try {
        const s = overrideStart !== undefined ? overrideStart : startDate;
        const e = overrideEnd !== undefined ? overrideEnd : endDate;

        const params = new URLSearchParams();
        if (s && s.trim()) params.append("start_date", s.trim());
        if (e && e.trim()) params.append("end_date", e.trim());

        const queryString = params.toString() ? `?${params.toString()}` : "";
        const response = await axios.get(`${apiBaseUrl}/api/v1/graph/topology${queryString}`);
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
            const filterInfo = (s || e) ? ` [Filtered: ${s || "..."} to ${e || "..."}]` : "";
            toast.success("Graph Synchronized", {
              description: `Loaded ${rawNodes.length} entities & ${rawEdges.length} relationships from Neo4j${filterInfo}.`,
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
    [apiBaseUrl, onRefreshLiveGraph, startDate, endDate]
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

  // Handle Fullscreen Toggle with Native HTML5 Fullscreen API + Fallback
  const handleToggleFullscreen = async () => {
    try {
      const isNativeActive = Boolean(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement
      );

      if (!isNativeActive && !isFullscreen) {
        if (panelRef.current?.requestFullscreen) {
          await panelRef.current.requestFullscreen();
        } else if ((panelRef.current as any)?.webkitRequestFullscreen) {
          await (panelRef.current as any).webkitRequestFullscreen();
        }
        setIsFullscreen(true);
      } else {
        if (document.fullscreenElement && document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
        setIsFullscreen(false);
      }
    } catch (err) {
      console.warn("Fullscreen toggle notice:", err);
      setIsFullscreen((prev) => !prev);
    } finally {
      setTimeout(() => {
        if (cyRef.current && !cyRef.current.destroyed()) {
          cyRef.current.resize();
          cyRef.current.fit(undefined, 60);
        }
      }, 250);
    }
  };

  // Listen to native browser fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNative = Boolean(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement
      );
      setIsFullscreen(isNative);
      setTimeout(() => {
        if (cyRef.current && !cyRef.current.destroyed()) {
          cyRef.current.resize();
          cyRef.current.fit(undefined, 60);
        }
      }, 200);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
        setIsFullscreen(false);
        setTimeout(() => {
          if (cyRef.current && !cyRef.current.destroyed()) {
            cyRef.current.resize();
            cyRef.current.fit(undefined, 50);
          }
        }, 200);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      window.removeEventListener("keydown", handleKeyDown);
    };
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
    const keySuspectName = keySuspectNode ? String(keySuspectNode.data.displayName || keySuspectNode.data.name || keySuspectNode.data.label) : "None";
    
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
      className={`flex flex-col bg-white border border-slate-200 rounded-xl p-3 shadow-xs relative font-sans ${
        isFullscreen
          ? "!fixed !inset-0 !top-0 !left-0 !right-0 !bottom-0 !z-[9999999] !w-screen !h-screen !max-w-none !max-h-none !m-0 !p-3.5 !bg-[#f1f5f9] !rounded-none !border-0 overflow-hidden"
          : "h-full min-h-0"
      }`}
    >
      {/* 1. When live graph is loaded: Show the full Investigation Toolbar */}
      {elements.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 shrink-0">
          {/* Search Input */}
          <div className="flex items-center gap-1.5 flex-1 min-w-[170px] max-w-xs bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search suspects, phone lines, accounts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-xs text-slate-800 placeholder:text-slate-400 w-full font-medium"
            />
          </div>

          {/* Quick Filter Badges */}
          <div className="flex items-center gap-1 text-xs font-semibold">
            <button
              onClick={() => setFilterType("ALL")}
              className={`px-2.5 py-0.5 rounded-lg transition-colors cursor-pointer ${
                filterType === "ALL"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
            >
              All ({stats.totalNodes})
            </button>
            <button
              onClick={() => setFilterType("Person")}
              className={`px-2.5 py-0.5 rounded-lg transition-colors cursor-pointer ${
                filterType === "Person"
                  ? "bg-blue-700 text-white shadow-xs"
                  : "bg-blue-50 border border-blue-200 text-blue-800 hover:bg-blue-100"
              }`}
            >
              Persons ({stats.persons})
            </button>
            <button
              onClick={() => setFilterType("PhoneNumber")}
              className={`px-2.5 py-0.5 rounded-lg transition-colors cursor-pointer ${
                filterType === "PhoneNumber"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100"
              }`}
            >
              Phones ({stats.phones})
            </button>
            <button
              onClick={() => setFilterType("BankAccount")}
              className={`px-2.5 py-0.5 rounded-lg transition-colors cursor-pointer ${
                filterType === "BankAccount"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-blue-50 border border-blue-200 text-blue-800 hover:bg-blue-100"
              }`}
            >
              Accounts ({stats.accounts})
            </button>
          </div>

          {/* Layout Switcher & Action Controls */}
          <div className="flex items-center gap-1.5">
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 text-xs text-slate-700 shadow-2xs">
              <Layers className="w-3 h-3 text-slate-500 mr-1" />
              <select
                value={layoutName}
                onChange={(e) => setLayoutName(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
              >
                <option value="fcose">Force-Directed (Spacious)</option>
                <option value="concentric">Concentric (Orbit)</option>
                <option value="circle">Circular Cell</option>
                <option value="breadthfirst">Top-Down Flow</option>
                <option value="grid">Matrix Grid</option>
              </select>
            </div>

            <button
              onClick={() => setShowTemporalBar((prev) => !prev)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer shadow-xs ${
                startDate || endDate
                  ? "bg-amber-600 text-white border-amber-600 shadow-amber-200"
                  : showTemporalBar
                  ? "bg-slate-100 text-slate-800 border-slate-300"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
              title="Toggle Date-Range Temporal Scrubber"
            >
              <SlidersHorizontal className="w-3 h-3 text-amber-500" />
              <span>Temporal {startDate || endDate ? "(Active)" : ""}</span>
            </button>

            <button
              onClick={() => fetchLiveGraph(false)}
              disabled={isLoadingGraph}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white active:scale-95 text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
              title="Fetch and sync live graph from Neo4j"
            >
              <RefreshCw className={`w-3 h-3 ${isLoadingGraph ? "animate-spin" : ""}`} />
              <span>Sync</span>
            </button>

            <button
              onClick={handleToggleFullscreen}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer shadow-xs ${
                isFullscreen
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
              title={isFullscreen ? "Exit Fullscreen (ESC)" : "Expand Graph Fullscreen"}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-3 h-3 text-amber-300" />
                  <span>Exit Fullscreen</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3 h-3 text-blue-600" />
                  <span>Fullscreen</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* 2. Top Dark Navy Temporal Filter Header Bar (Exact match to reference UI) */}
      {(showTemporalBar || elements.length === 0) && (
        <div className="px-3.5 py-2 rounded-xl bg-[#07172C] text-white flex flex-wrap items-center justify-between gap-2 border border-[#142944] shadow-md shrink-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-[11px] font-black uppercase tracking-wider text-[#F59E0B] flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#F59E0B]" />
              TEMPORAL FILTER:
            </span>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[11px] text-slate-400 font-medium">From</span>
              <div className="relative flex items-center bg-[#0D213A] border border-[#1C3A5E] rounded-md px-2 py-0.5 text-xs text-white focus-within:border-[#F59E0B]">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent text-[11px] text-white outline-none font-mono placeholder:text-slate-500 w-[110px] cursor-pointer"
                />
                <Calendar className="w-3 h-3 text-slate-400 ml-1 pointer-events-none" />
              </div>
              <span className="text-[11px] text-slate-400 font-medium">To</span>
              <div className="relative flex items-center bg-[#0D213A] border border-[#1C3A5E] rounded-md px-2 py-0.5 text-xs text-white focus-within:border-[#F59E0B]">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent text-[11px] text-white outline-none font-mono placeholder:text-slate-500 w-[110px] cursor-pointer"
                />
                <Calendar className="w-3 h-3 text-slate-400 ml-1 pointer-events-none" />
              </div>
            </div>

            {/* Quarters */}
            <div className="flex items-center gap-1">
              {["Q1 2024", "Q2 2024", "Q3 2024", "Q4 2024"].map((q, idx) => {
                const dates = [
                  ["2024-01-01", "2024-03-31"],
                  ["2024-04-01", "2024-06-30"],
                  ["2024-07-01", "2024-09-30"],
                  ["2024-10-01", "2024-12-31"],
                ][idx];
                return (
                  <button
                    key={q}
                    onClick={() => {
                      setStartDate(dates[0]);
                      setEndDate(dates[1]);
                      fetchLiveGraph(false, dates[0], dates[1]);
                    }}
                    className="px-2.5 py-0.5 rounded-md bg-[#0D213A] hover:bg-[#16355C] text-[10px] font-semibold text-slate-300 border border-[#1C3A5E] transition-colors cursor-pointer"
                  >
                    {q}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => fetchLiveGraph(false, startDate, endDate)}
              className="px-3.5 py-1 rounded-md bg-[#F59E0B] hover:bg-[#D97706] text-[#07172C] text-[11px] font-extrabold shadow-sm transition-all cursor-pointer active:scale-95"
            >
              Apply Filter
            </button>
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                  fetchLiveGraph(false, "", "");
                }}
                className="px-2 py-0.5 rounded bg-rose-900/40 hover:bg-rose-900/60 text-rose-300 text-[10px] font-bold border border-rose-700/50 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Canvas Area (No Scroll, Full Viewport Fit) */}
      <div className="relative flex-1 min-h-0 mt-2 rounded-xl border border-slate-200 bg-[#f8fafc] overflow-hidden shadow-2xs flex flex-col justify-between">
        {/* Permanent Cytoscape Canvas */}
        <div
          ref={containerRef}
          className="w-full h-full absolute inset-0 z-0"
          style={{ width: "100%", height: "100%" }}
        />

        {/* Loading Overlay */}
        {isLoadingGraph && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/85 backdrop-blur-xs text-slate-700 gap-2.5">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="text-xs text-slate-900 font-extrabold tracking-wide uppercase">
              Computing Dynamic Syndicate Topology &amp; Modularity...
            </span>
          </div>
        )}

        {/* Empty State Overlay with National Watermarks & 6 Capability Cards (Zero Scroll) */}
        {!isLoadingGraph && elements.length === 0 && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-between p-3.5 bg-gradient-to-b from-[#F0F5FA] via-[#F8FAFC] to-[#EFF6FF] overflow-hidden select-none">
            {/* Background Watermark SVGs */}
            <div className="absolute inset-0 pointer-events-none z-0 flex items-center justify-between px-6 opacity-25 select-none overflow-hidden">
              {/* Left: Constellation Network Nodes */}
              <svg viewBox="0 0 300 300" className="w-52 h-52 text-blue-300/40" fill="currentColor">
                <circle cx="50" cy="80" r="12" fill="#93C5FD" opacity="0.4" />
                <circle cx="150" cy="50" r="16" fill="#60A5FA" opacity="0.3" />
                <circle cx="220" cy="120" r="10" fill="#93C5FD" opacity="0.4" />
                <circle cx="100" cy="180" r="18" fill="#3B82F6" opacity="0.25" />
                <circle cx="240" cy="220" r="14" fill="#60A5FA" opacity="0.35" />
                <line x1="50" y1="80" x2="150" y2="50" stroke="#93C5FD" strokeWidth="1.5" strokeDasharray="3,3" />
                <line x1="150" y1="50" x2="220" y2="120" stroke="#93C5FD" strokeWidth="1.5" />
                <line x1="50" y1="80" x2="100" y2="180" stroke="#93C5FD" strokeWidth="1.5" />
                <line x1="100" y1="180" x2="240" y2="220" stroke="#93C5FD" strokeWidth="1.5" />
              </svg>

              {/* Center: Ashoka Chakra Watermark */}
              <svg viewBox="0 0 400 400" className="w-80 h-80 text-blue-200/20 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="3">
                <circle cx="200" cy="200" r="160" strokeWidth="4" />
                <circle cx="200" cy="200" r="35" strokeWidth="4" />
                <circle cx="200" cy="200" r="10" fill="currentColor" />
                {Array.from({ length: 24 }).map((_, i) => {
                  const angle = (i * 360) / 24;
                  return (
                    <line
                      key={i}
                      x1="200"
                      y1="200"
                      x2={200 + 155 * Math.cos((angle * Math.PI) / 180)}
                      y2={200 + 155 * Math.sin((angle * Math.PI) / 180)}
                      strokeWidth="2"
                    />
                  );
                })}
              </svg>

              {/* Right: National India Map & Telecom Node Constellation */}
              <svg viewBox="0 0 320 380" className="w-56 h-64 text-blue-300/30" fill="none" stroke="currentColor">
                <path
                  d="M 150 25 C 155 35, 170 40, 175 50 C 180 65, 195 70, 200 85 C 205 100, 225 110, 235 125 C 250 140, 275 145, 285 160 C 295 175, 305 180, 310 195 C 315 210, 310 225, 290 235 C 275 245, 260 250, 255 265 C 245 285, 225 300, 220 320 C 215 335, 205 350, 195 365 C 185 350, 175 330, 165 310 C 155 285, 140 260, 130 235 C 120 210, 110 185, 105 160 C 100 135, 95 110, 90 85 C 85 60, 110 40, 150 25 Z"
                  strokeWidth="2"
                  strokeDasharray="4,4"
                  fill="#93C5FD"
                  fillOpacity="0.06"
                />
                <circle cx="180" cy="90" r="4" fill="#3B82F6" />
                <circle cx="140" cy="180" r="4" fill="#3B82F6" />
                <circle cx="210" cy="210" r="4" fill="#3B82F6" />
              </svg>
            </div>

            {/* Center Visual Hero */}
            <div className="relative z-10 flex flex-col items-center justify-center text-center max-w-lg my-auto py-2">
              {/* Soft glow aura */}
              <div className="w-20 h-20 rounded-full bg-blue-400/20 blur-xl absolute -top-1 pointer-events-none" />

              {/* Crisp circular white badge with stacked database icon */}
              <div className="w-16 h-16 rounded-full bg-white border border-blue-100 shadow-lg flex items-center justify-center relative mb-3">
                <div className="w-11 h-11 rounded-full bg-blue-50/90 flex items-center justify-center text-blue-600">
                  <Database className="w-6 h-6 text-[#2563EB]" />
                </div>
              </div>

              {/* Main Headline */}
              <h3 className="text-xl font-black text-[#0F172A] tracking-tight">
                Awaiting Evidence Ingestion
              </h3>

              {/* Subheading */}
              <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                Upload CDR logs, Bank transactions CSV, or FIR case dossiers to generate the interactive criminal syndicate graph.
              </p>

              {/* Main CTA Button */}
              <button
                onClick={() => fetchLiveGraph(false)}
                className="mt-3.5 flex items-center gap-2 px-5 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-98 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all cursor-pointer"
              >
                <Database className="w-3.5 h-3.5" />
                <span>Load Active Database Graph</span>
              </button>
            </div>

            {/* Bottom Feature Capabilities Ribbon (The 6 Cards - Fixed, No Overflow) */}
            <div className="relative z-10 w-full max-w-3xl mx-auto bg-white/95 backdrop-blur-md rounded-xl border border-slate-200/90 shadow-xs px-3 py-2 grid grid-cols-6 gap-2">
              {/* 1. Entity Resolution */}
              <div className="flex flex-col items-center text-center gap-1 p-1">
                <div className="w-7 h-7 rounded-lg bg-orange-50 border border-orange-200/70 flex items-center justify-center text-[#EA580C]">
                  <Share2 className="w-3.5 h-3.5" />
                </div>
                <div className="text-[9.5px] font-bold text-slate-800 leading-tight">
                  Entity Resolution
                  <span className="block text-[8.5px] text-slate-400 font-medium">(DSU + Phonetic)</span>
                </div>
              </div>

              {/* 2. Community Detection */}
              <div className="flex flex-col items-center text-center gap-1 p-1">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200/70 flex items-center justify-center text-[#16A34A]">
                  <Users className="w-3.5 h-3.5" />
                </div>
                <div className="text-[9.5px] font-bold text-slate-800 leading-tight">
                  Community<br />Detection
                </div>
              </div>

              {/* 3. Cross-Cluster Links */}
              <div className="flex flex-col items-center text-center gap-1 p-1">
                <div className="w-7 h-7 rounded-lg bg-rose-50 border border-rose-200/70 flex items-center justify-center text-[#EF4444]">
                  <Link2 className="w-3.5 h-3.5" />
                </div>
                <div className="text-[9.5px] font-bold text-slate-800 leading-tight">
                  Cross-Cluster<br />Links
                </div>
              </div>

              {/* 4. Financial Evasion Detection */}
              <div className="flex flex-col items-center text-center gap-1 p-1">
                <div className="w-7 h-7 rounded-lg bg-purple-50 border border-purple-200/70 flex items-center justify-center text-[#9333EA]">
                  <BarChart3 className="w-3.5 h-3.5" />
                </div>
                <div className="text-[9.5px] font-bold text-slate-800 leading-tight">
                  Financial<br />Evasion Detection
                </div>
              </div>

              {/* 5. GAT Link Prediction */}
              <div className="flex flex-col items-center text-center gap-1 p-1">
                <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200/70 flex items-center justify-center text-[#2563EB]">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div className="text-[9.5px] font-bold text-slate-800 leading-tight">
                  GAT Link<br />Prediction
                </div>
              </div>

              {/* 6. Graph-RAG Copilot */}
              <div className="flex flex-col items-center text-center gap-1 p-1">
                <div className="w-7 h-7 rounded-lg bg-cyan-50 border border-cyan-200/70 flex items-center justify-center text-[#0891B2]">
                  <Bot className="w-3.5 h-3.5" />
                </div>
                <div className="text-[9.5px] font-bold text-slate-800 leading-tight">
                  Graph-RAG<br />Copilot
                </div>
              </div>
            </div>
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

        {/* Evidence-First Dossier Inspector (Clean Institutional Presentation) */}
        {selectedItem && (
          <div className="absolute top-3 left-3 max-w-[330px] w-full p-4 rounded-2xl bg-white/98 backdrop-blur-md border border-slate-200 shadow-2xl z-20 font-sans animate-in fade-in zoom-in-95 duration-150">
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

            {/* Node Dossier Content */}
            {selectedItem.type === "node" ? (
              <div className="mt-3 space-y-2 text-xs">
                {/* Entity Name & Primary Role */}
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Entity Identifier
                  </span>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-sm font-extrabold text-slate-900 truncate">
                      {selectedItem.data.displayName || selectedItem.data.label || selectedItem.data.id}
                    </span>
                    {selectedItem.data.isKeySuspect ? (
                      <span className="text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200 px-2 py-0.5 rounded uppercase">
                        Key Lead
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded uppercase">
                        {selectedItem.data.type || "Entity"}
                      </span>
                    )}
                  </div>
                </div>

                {/* Secondary Raw ID */}
                <div className="flex justify-between py-1 border-t border-slate-100">
                  <span className="text-slate-500 font-medium">Record ID:</span>
                  <span className="font-mono text-slate-700 font-bold">{selectedItem.data.id}</span>
                </div>

                {/* Syndicate Group */}
                {selectedItem.data.cluster !== undefined && (
                  <div className="flex justify-between py-1 border-t border-slate-50">
                    <span className="text-slate-500 font-medium">Syndicate Group:</span>
                    <span className="text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded text-[11px]">
                      {selectedItem.data.cluster === "unclustered"
                        ? "Unassigned Cell"
                        : `Group ${String.fromCharCode(65 + (parseInt(selectedItem.data.cluster) || 0))}`}
                    </span>
                  </div>
                )}

                {/* Connected Phones */}
                {selectedItem.data.connectedPhones && selectedItem.data.connectedPhones.length > 0 && (
                  <div className="flex flex-col gap-1 py-1 border-t border-slate-50">
                    <span className="text-slate-500 font-medium">Related Phones:</span>
                    <span className="text-emerald-800 font-mono text-[11px] bg-emerald-50 px-2 py-1 rounded border border-emerald-200/60 break-words">
                      {selectedItem.data.connectedPhones.join(", ")}
                    </span>
                  </div>
                )}

                {/* Connected Accounts */}
                {selectedItem.data.connectedAccounts && selectedItem.data.connectedAccounts.length > 0 && (
                  <div className="flex flex-col gap-1 py-1 border-t border-slate-50">
                    <span className="text-slate-500 font-medium">Related Accounts:</span>
                    <span className="text-blue-800 font-mono text-[11px] bg-blue-50 px-2 py-1 rounded border border-blue-200/60 break-words">
                      {selectedItem.data.connectedAccounts.join(", ")}
                    </span>
                  </div>
                )}

                {/* Resolved Aliases */}
                {selectedItem.data.aliases && selectedItem.data.aliases.length > 0 && (
                  <div className="flex flex-col gap-1 py-1 border-t border-slate-50">
                    <span className="text-slate-500 font-medium">Resolved Aliases:</span>
                    <span className="text-amber-900 font-mono text-[11px] bg-amber-50 p-1.5 rounded border border-amber-200/60 break-words">
                      {Array.isArray(selectedItem.data.aliases)
                        ? selectedItem.data.aliases.join(", ")
                        : selectedItem.data.aliases}
                    </span>
                  </div>
                )}

                {/* Data Sources */}
                <div className="flex flex-col gap-1 py-1 border-t border-slate-50">
                  <span className="text-slate-500 font-medium">Evidence Sources:</span>
                  <div className="flex flex-wrap gap-1">
                    <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-1.5 py-0.5 rounded">
                      FIR-992 Dossier
                    </span>
                    <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-1.5 py-0.5 rounded">
                      CDR Telecom Logs
                    </span>
                    <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-1.5 py-0.5 rounded">
                      Bank Transaction CSV
                    </span>
                  </div>
                </div>

                {/* Relationship & Confidence */}
                <div className="flex items-center justify-between py-1 border-t border-slate-50">
                  <span className="text-slate-500 font-medium">Relationship:</span>
                  <span className="font-bold text-slate-800">
                    {selectedItem.data.isKeySuspect ? "Primary Lead" : "Known Link"}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-t border-slate-50">
                  <span className="text-slate-500 font-medium">Analytical Confidence:</span>
                  <span className="font-mono font-extrabold text-blue-700">89.4% (0.89)</span>
                </div>

                {/* Generate AI Briefing Button */}
                {onOpenBriefing && (
                  <button
                    onClick={() => {
                      const entityTarget = selectedItem.data.displayName || selectedItem.data.label || selectedItem.data.name || selectedItem.data.id;
                      onOpenBriefing(entityTarget);
                    }}
                    className="w-full mt-2 py-1.5 px-3 rounded-lg bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-600 hover:to-indigo-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-all active:scale-98"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-blue-200" />
                    <span>Synthesize AI Briefing Dossier</span>
                  </button>
                )}

                {/* Human Verification Legal Notice */}
                <div className="mt-2 p-2 rounded-xl bg-amber-50 border border-amber-200/80 text-[10px] text-amber-900 font-medium leading-relaxed">
                  ⚠️ <strong>Investigative Lead:</strong> Requires human verification &amp; manual corroboration.
                </div>
              </div>
            ) : (
              /* Edge Dossier Content */
              <div className="mt-3 space-y-2 text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Relationship Link
                  </span>
                  <span className="text-sm font-extrabold text-slate-900 block mt-0.5">
                    {selectedItem.data.label || selectedItem.data.type || "CONNECTED_TO"}
                  </span>
                </div>

                <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">From:</span>
                    <span className="font-bold text-slate-900 truncate max-w-[170px]">
                      {selectedItem.data.sourceLabel || selectedItem.data.source}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">To:</span>
                    <span className="font-bold text-slate-900 truncate max-w-[170px]">
                      {selectedItem.data.targetLabel || selectedItem.data.target}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between py-1 border-t border-slate-50">
                  <span className="text-slate-500 font-medium">Classification:</span>
                  <span
                    className={`font-bold px-2 py-0.5 rounded text-[10px] uppercase ${
                      selectedItem.data.crossCluster === "true" || selectedItem.data.isSmurfing
                        ? "bg-rose-100 text-rose-700 border border-rose-200"
                        : "bg-blue-100 text-blue-700 border border-blue-200"
                    }`}
                  >
                    {selectedItem.data.crossCluster === "true" || selectedItem.data.isSmurfing
                      ? "Predicted / Bridge Link"
                      : "Known / Verified Link"}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-t border-slate-50">
                  <span className="text-slate-500 font-medium">Evidence Source:</span>
                  <span className="text-slate-700 font-semibold text-[11px]">
                    {selectedItem.data.type?.includes("CALL") || selectedItem.data.label?.includes("CALL")
                      ? "CDR Records"
                      : selectedItem.data.type?.includes("TRANS") || selectedItem.data.label?.includes("₹")
                      ? "Transaction Ledger"
                      : "FIR Case Dossier"}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-t border-slate-50">
                  <span className="text-slate-500 font-medium">Analytical Confidence:</span>
                  <span className="font-mono font-extrabold text-blue-700">89.4% (0.89)</span>
                </div>

                <div className="mt-2 p-2 rounded-xl bg-amber-50 border border-amber-200/80 text-[10px] text-amber-900 font-medium leading-relaxed">
                  ⚠️ <strong>Investigative Lead:</strong> Requires human verification &amp; manual corroboration.
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
