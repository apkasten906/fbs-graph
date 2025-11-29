/**
 * Type definitions for graph-data module
 */

/**
 * Team data structure
 */
export type Team = {
  id: string;
  name: string;
  shortName?: string;
  conference?: {
    id: string;
    shortName?: string;
  };
};

/**
 * Game data structure
 */
export type Game = {
  id: string;
  type: string;
  leverage?: number;
  date?: string;
  home: {
    id: string;
    name: string;
    conference?: {
      id: string;
      shortName?: string;
    };
  };
  away: {
    id: string;
    name: string;
    conference?: {
      id: string;
      shortName?: string;
    };
  };
};

/**
 * Conference metadata structure
 */
export type Conference = {
  id: string;
  name: string;
  shortName: string;
};

/**
 * Graph data structure (teams and games)
 */
export type GraphData = {
  teams: Team[];
  games: Game[];
};

/**
 * Options for data loading functions
 */
export type LoadOptions = {
  staticAdapter?: any;
  graphqlEndpoint?: string;
};

/**
 * GraphQL query for fetching team and game data
 */
export const GRAPH_QUERY: string;

/**
 * GraphQL query for fetching conference metadata
 */
export const CONFERENCES_QUERY: string;

/**
 * Helper function to make GraphQL POST requests
 *
 * @param url - GraphQL endpoint URL
 * @param body - Request body containing query and variables
 * @returns GraphQL response
 */
export function graphqlPost(url: string, body: object): Promise<any>;

/**
 * Load graph data (teams and games) for a season
 * Tries static data adapter first, falls back to GraphQL if unavailable
 *
 * @param season - Season year (e.g., 2025)
 * @param options - Optional configuration
 * @returns Graph data with teams and games
 * @throws Error if data loading fails
 */
export function loadGraphData(season: number, options?: LoadOptions): Promise<GraphData>;

/**
 * Load conference metadata
 * Tries static data adapter first, falls back to GraphQL if unavailable
 *
 * @param options - Optional configuration
 * @returns Array of conference objects
 * @throws Error if data loading fails
 */
export function loadConferences(options?: LoadOptions): Promise<Conference[]>;

/**
 * Load all data needed for the visualizer
 * Convenience function that loads both conferences and graph data
 *
 * @param season - Season year (e.g., 2025)
 * @param options - Optional configuration
 * @returns All visualizer data (conferences and graph data)
 * @throws Error if data loading fails
 */
export function loadAllData(
  season: number,
  options?: LoadOptions
): Promise<{
  conferences: Conference[];
  graphData: GraphData;
}>;
