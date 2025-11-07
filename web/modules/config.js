// Conference map: id → { shortName, name }
// Note: import assertions can cause parser issues in some ESLint/parser versions.
// Use a plain import here to keep tooling happy.
import conferencesData from '../../src/data/conferences.json';

export const conferenceMap = Object.fromEntries(
  conferencesData.map(c => [c.id, { shortName: c.shortName, name: c.name }])
);
/**
 * Configuration and constants for the FBS Timeline App
 */

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

// Default GraphQL endpoint used when static adapter is not available or when
// users haven't overridden the endpoint in the UI. Centralized here so the
// same value is used across module and non-module pages (visualizer/timeline).
export const GRAPHQL_ENDPOINT = 'http://localhost:4100/graphql';
