/**
 * Type definitions for graph-ui.js
 */

export type EdgeData = {
  id: string;
  [key: string]: any;
};

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

export type ConferenceMeta = {
  id: string;
  name: string;
  shortName: string;
};

export type BuildSelectorsOptions = {
  defaultSrc?: string;
  defaultDst?: string;
  autoTrigger?: boolean;
  triggerButtonId?: string;
};

/**
 * Display games for a clicked edge in the info panel
 */
export function showEdgeGames(
  edgeData: EdgeData,
  pairGames: Map<string, Game[]>,
  containerId?: string
): void;

/**
 * Build conference legend showing all conferences in the data
 */
export function buildLegend(
  teams: Team[],
  conferenceMeta: ConferenceMeta[],
  colors: { [key: string]: string },
  containerId?: string
): void;

/**
 * Build team selector dropdowns with default selections
 */
export function buildSelectors(
  teams: Team[],
  srcSelectorId?: string,
  dstSelectorId?: string,
  options?: BuildSelectorsOptions
): void;
