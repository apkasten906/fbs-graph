/**
 * Main Timeline App - Refactored modular version
 * FBS Schedule Graph - Leverage Timeline Explorer
 */
import { palette, conferenceScopes } from './modules/config.js';
import { defaultLoadData, prepareSeasonModel } from './modules/data-processor.js';
import { findShortestPath } from './modules/path-finder.js';
import { createUIRenderer } from './modules/ui-renderer.js';

function createTimelineApp(options = {}) {
  const win = options.window ?? window;
  const doc = options.document ?? win.document;
  const location = options.location ?? win.location;
  const pathSummary = options.pathSummary ?? doc.getElementById('pathSummary');
  const filters = options.filters ?? doc.getElementById('filters');
  const timeline = options.timeline ?? doc.getElementById('timeline');
  const fetchImpl =
    options.fetch ?? (typeof win.fetch === 'function' ? win.fetch.bind(win) : null);
  const dataBase = options.dataBase ?? '../src/data';
  const season = options.season ?? 2025;
  const loadData = options.loadData ?? (() => defaultLoadData(fetchImpl, dataBase));

  const state = {
    loading: true,
    error: null,
    season,
    scope: 'power4',
    activeTier: 'all',
    startTeam: null,
    endTeam: null,
    data: null,
    path: null,
    segments: [],
    summary: null,
  };

  // Create UI renderer
  const renderer = createUIRenderer(doc);

  // Initial render
  renderer.renderSummary(state, pathSummary);
  renderer.renderFilters(state, filters, getTeamsForScope, applyState);
  renderer.renderTimeline(state, timeline);

  const runningFromFile = location?.protocol === 'file:';
  const ready = runningFromFile ? Promise.resolve(false) : init();

  if (runningFromFile) {
    renderer.renderFileModeNotice(location);
  }

  async function init() {
    try {
      const raw = await loadData();
      state.data = prepareSeasonModel(raw, state.season);
      const available = getTeamsForScope('power4');
      const defaultStart =
        available.find(team => team.id === 'alabama')?.id ?? available[0]?.id ?? null;
      let defaultEnd =
        available.find(team => team.id === 'clemson' && team.id !== defaultStart)?.id ??
        chooseFallbackTeam(available, defaultStart);
      if (defaultEnd === defaultStart) {
        defaultEnd = chooseFallbackTeam(available, defaultStart);
      }
      Object.assign(state, { loading: false, startTeam: defaultStart, endTeam: defaultEnd });
      updatePath();
    } catch (error) {
      state.loading = false;
      state.error = error instanceof Error ? error.message : String(error);
    }
    renderer.renderSummary(state, pathSummary);
    renderer.renderFilters(state, filters, getTeamsForScope, applyState);
    renderer.renderTimeline(state, timeline);
    return !state.error;
  }

  function getTeamsForScope(scopeId = state.scope) {
    if (!state.data) return [];
    const scope = conferenceScopes.find(item => item.id === scopeId);
    const filterFn = scope?.filter ?? (() => true);
    return state.data.teams
      .filter(filterFn)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function applyState(patch) {
    Object.assign(state, patch);
    if (!state.loading && state.data) {
      updatePath();
    }
    renderer.renderSummary(state, pathSummary);
    renderer.renderFilters(state, filters, getTeamsForScope, applyState);
    renderer.renderTimeline(state, timeline);
  }

  function updatePath() {
    if (!state.data) return;
    if (!state.startTeam || !state.endTeam) {
      clearPath();
      return;
    }
    if (state.startTeam === state.endTeam) {
      clearPath();
      return;
    }
    
    const result = findShortestPath(state.data.adjacency, state.startTeam, state.endTeam);
    if (!result) {
      clearPath();
      return;
    }
    
    state.path = result;
    const segments = result.edges.map((edge, index) => {
      const entry = state.data.edgesByPair.get(edge.key);
      const fromTeam = state.data.teamMap.get(edge.from);
      const toTeam = state.data.teamMap.get(edge.to);
      const color = palette[index % palette.length];
      return {
        id: edge.key,
        from: fromTeam,
        to: toTeam,
        color,
        label: `${fromTeam?.name ?? edge.from} ↔ ${toTeam?.name ?? edge.to}`,
        games: entry ? entry.games : [],
      };
    });
    
    state.segments = segments;
    const programs = result.nodes
      .map(id => state.data.teamMap.get(id))
      .filter(Boolean);
    const bestGames = segments.map(seg => seg.games[0]).filter(Boolean);
    const totalLev = bestGames.reduce((acc, game) => acc + (game.leverage ?? 0), 0);
    const avgLev = bestGames.length ? totalLev / bestGames.length : 0;
    const conferences = Array.from(
      new Set(programs.map(p => p.conference?.shortName).filter(Boolean))
    );
    
    state.summary = {
      programs,
      hops: segments.length,
      averageLeverage: Number(avgLev.toFixed(3)),
      totalDistance: Number((result.distance ?? 0).toFixed(3)),
      conferences,
    };
  }

  function clearPath() {
    state.path = null;
    state.segments = [];
    state.summary = null;
  }

  function chooseFallbackTeam(list, excludeId) {
    if (!list.length) return null;
    const fallback = list.find(team => team.id !== excludeId);
    return (fallback ?? list[0]).id;
  }

  return {
    state,
    applyState,
    updatePath,
    ready,
    init,
  };
}

export default createTimelineApp;