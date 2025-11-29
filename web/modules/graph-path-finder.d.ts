/**
 * Type definitions for graph-path-finder module
 */

export type Game = {
  id: string;
  home: { id: string };
  away: { id: string };
  type: string;
  leverage?: number;
};

export type Team = {
  id: string;
  name: string;
};

export type PathResult = {
  nodes: string[];
  edges: string[];
} | null;

export type NodesWithinDegreesResult = {
  nodes: string[];
  edges: string[];
  nodesByDegree: Map<string, number>;
  source: string;
  destination: string;
};

export type AdjacencyNode = {
  to: string;
  k: string;
  w: number;
  avg: number;
  games: Game[];
};

/**
 * Create a consistent edge key from two team IDs
 */
export function edgeKey(a: string, b: string): string;

/**
 * Build an adjacency list from game pair data
 */
export function buildAdjacencyList(
  pairGames: Map<string, Game[]>,
  typeFilter: string,
  minLev: number
): Map<string, AdjacencyNode[]>;

/**
 * Find shortest path between two teams using Dijkstra's algorithm
 */
export function shortestPathByInverseLeverage(
  srcId: string,
  dstId: string,
  pairGames: Map<string, Game[]>,
  teams: Team[],
  typeFilter: string,
  minLev: number
): PathResult;

/**
 * Find all nodes within N degrees of separation from two teams
 */
export function findNodesWithinDegrees(
  startNodes: string[],
  maxDegrees: number,
  pairGames: Map<string, Game[]>,
  teams: Team[],
  typeFilter: string,
  minLev: number,
  shortestPath?: PathResult
): NodesWithinDegreesResult;
