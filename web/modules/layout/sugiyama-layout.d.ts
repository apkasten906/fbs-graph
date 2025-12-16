export interface PathFilter {
  nodes: string[];
  edges: string[];
  source: string;
  destination: string;
  shortestPathNodes?: string[];
  nodeLabels?: Record<string, string>;
}

export function assignNodesToLayers(pathFilter: PathFilter): Map<number, string[]>;

export function calculateBarycenter(
  nodeId: string,
  edges: string[],
  positions: Map<string, { x: number; y: number }>
): number | null;

export function orderNodesInLayer(
  layerNodes: string[],
  edges: string[],
  positions: Map<string, { x: number; y: number }>,
  nodeLabels: Record<string, string>,
  centerY: number,
  shortestPathSet?: Set<string>
): string[];

export function assignYCoordinates(
  orderedNodes: string[],
  centerY: number,
  verticalSpacing: number
): Map<string, number>;

export function computeSugiyamaLayout(
  pathFilter: PathFilter,
  width?: number,
  height?: number,
  horizontalSpacing?: number,
  verticalSpacing?: number,
  useCrossingMinimization?: boolean
): Map<string, { x: number; y: number }>;

export function convertPositionsToObject(
  positionsMap: Map<string, { x: number; y: number }>
): Record<string, { x: number; y: number }>;
