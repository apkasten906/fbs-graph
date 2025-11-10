/**
 * Configuration and constants for the FBS Timeline App
 */

/**
 * Default GraphQL endpoint URL for local development.
 * Used as fallback when static data adapter is not available or when
 * users haven't overridden the endpoint in the UI.
 */
export const DEFAULT_GRAPHQL_ENDPOINT = 'http://localhost:4100/graphql';

/**
 * Conference map: id → { shortName, name }
 * Private store populated by setConferenceMap() during data initialization.
 */
let conferenceMap = {};

/**
 * Populates the conference map from loaded data.
 * Should be called once during application initialization after loading
 * conference data from the static data adapter or GraphQL response.
 *
 * @param {Array<{id: string, shortName: string, name: string}>} conferences - Array of conference objects
 */
export function setConferenceMap(conferences) {
  conferenceMap = {};
  for (const conf of conferences) {
    conferenceMap[conf.id] = {
      shortName: conf.shortName,
      name: conf.name,
    };
  }
}

/**
 * Retrieves the current conference map.
 * @returns {Object} Conference map (id → { shortName, name })
 */
export function getConferenceMap() {
  return conferenceMap;
}

export const tierLabels = {
  critical: 'Critical leverage',
  high: 'High leverage',
  notable: 'Notable leverage',
  watch: 'Watchlist leverage',
};

export const tierColor = {
  critical: 'var(--red)',
  high: 'var(--gold)',
  notable: 'var(--indigo)',
  watch: 'var(--emerald)',
};

export const palette = [
  'var(--gold)',
  'var(--accent)',
  'var(--indigo)',
  'var(--emerald)',
  'var(--red)',
  'var(--slate)',
];

export const power4Set = new Set(['sec', 'b1g', 'b12', 'acc']);

export const conferenceScopes = [
  { id: 'all', label: 'All FBS', filter: () => true },
  { id: 'power4', label: 'Power 4', filter: team => power4Set.has(team.conferenceId) },
  { id: 'sec', label: 'SEC', filter: team => team.conferenceId === 'sec' },
  { id: 'b1g', label: 'Big Ten', filter: team => team.conferenceId === 'b1g' },
  { id: 'b12', label: 'Big 12', filter: team => team.conferenceId === 'b12' },
  { id: 'acc', label: 'ACC', filter: team => team.conferenceId === 'acc' },
  { id: 'ind', label: 'Independents', filter: team => team.conferenceId === 'ind' },
];

export function determineTier(value) {
  if (value >= 1.25) return 'critical';
  if (value >= 1.05) return 'high';
  if (value >= 0.85) return 'notable';
  return 'watch';
}
