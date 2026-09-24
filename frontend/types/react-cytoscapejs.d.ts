declare module 'react-cytoscapejs' {
  import { Component, CSSProperties } from 'react';
  import cytoscape, { Core, ElementDefinition, LayoutOptions, Stylesheet } from 'cytoscape';

  export interface CytoscapeComponentProps {
    id?: string;
    cy?: (cy: Core) => void;
    style?: CSSProperties;
    elements: ElementDefinition[];
    layout?: LayoutOptions;
    stylesheet?: Stylesheet[] | any;
    className?: string;
    zoom?: number;
    pan?: { x: number; y: number };
    minZoom?: number;
    maxZoom?: number;
    wheelSensitivity?: number;
    boxSelectionEnabled?: boolean;
    autounselectify?: boolean;
    autoungrabify?: boolean;
    userZoomingEnabled?: boolean;
    userPanningEnabled?: boolean;
  }

  export default class CytoscapeComponent extends Component<CytoscapeComponentProps> {}
}
