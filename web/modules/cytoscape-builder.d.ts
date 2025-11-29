/**
 * Type definitions for cytoscape-builder.js
 */

export type Team = {
  id: string;
  name: string;
  conference?: { id: string };
};

export type Game = {
  id: string;
  home: { id: string; name: string };
  away: { id: string; name: string };
  type: string;
  leverage?: number;
  date?: string;
};

export type PathFilter = {
  nodes: string[];
  edges: string[];
  nodesByDegree: Map<string, number>;
  source: string;
  destination: string;
};

export type BuildGraphElementsParams = {
  teams: Team[];
  games: Game[];
  teamIndex: Map<string, Team>;
  pairGames: Map<string, Game[]>;
  typeFilter: string;
  minLeverage: number;
  pathFilter: PathFilter | null;
};

export type CytoscapeElement = {
  group: 'nodes' | 'edges';
  data: any;
  classes?: string;
};

export type Position = { x: number; y: number };

export type LayoutConfig = {
  name: string;
  positions?: { [nodeId: string]: Position } | ((node: any) => Position);
  fit?: boolean;
  padding?: number;
  avoidOverlap?: boolean;
  nodeDimensionsIncludeLabels?: boolean;
  idealEdgeLength?: number | ((edge: any) => number);
  nodeOverlap?: number;
  nodeRepulsion?: number;
};

/**
 * Conference color mapping for nodes
 */
export const COLORS: { [key: string]: string };

/**
 * Degree-based color scheme for edges in comparison view
 */
export const DEGREE_COLORS: string[];

/**
 * Creates a consistent edge key from two team IDs
 */
export function createEdgeKey(a: string, b: string): string;

/**
 * Builds graph elements (nodes and edges) from team and game data
 */
export function buildGraphElements(params: BuildGraphElementsParams): CytoscapeElement[];

/**
 * Calculate node positions based on degree of separation from source
 */
export function calculateDegreePositions(
  pathFilter: PathFilter,
  width?: number,
  height?: number
): { [nodeId: string]: Position };

/**
 * Create Cytoscape style configuration
 */
export function createCytoscapeStyle(): any[];

/**
 * Create layout configuration for Cytoscape
 */
export function createLayoutConfig(
  pathFilter?: PathFilter | null,
  width?: number,
  height?: number
): LayoutConfig;
