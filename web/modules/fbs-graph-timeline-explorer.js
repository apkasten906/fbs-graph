// --- Helper functions for timeline explorer ---
import { DEFAULT_GRAPHQL_ENDPOINT } from './config.js';
import { setConferenceMap } from './conference-map.js';

function computePairs(games) {
  // Groups games by a unique key for each home/away pair (order-independent)
  const map = new Map();
  for (const game of games) {
    if (!game.home || !game.away) continue;
    const key = [game.home.id, game.away.id].sort().join('-');
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(game);
  }
  return map;
}

function shortestPathByInverseLeverage(pairs, teams, srcId, dstId) {
  // Dijkstra's algorithm for shortest path by inverse average leverage
  const adj = new Map();
  for (const [key, games] of pairs) {
    if (!games.length) continue;
    const first = games[0];
    const a = first.home?.id;
    const b = first.away?.id;
    if (!a || !b) continue;
    const sum = games.reduce((s, g) => s + (g.leverage || 0), 0);
    const avg = sum / games.length;
    const weight = 1 / Math.max(1e-6, avg);
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a).push({ to: b, key, weight, avg, games });
    adj.get(b).push({ to: a, key, weight, avg, games });
  }
  const dist = new Map();
  const prev = new Map();
  const prevEdge = new Map();
  for (const team of teams) {
    dist.set(team.id, Infinity);
  }
  const unvisited = new Set(teams.map(t => t.id));
  dist.set(srcId, 0);
  while (unvisited.size) {
    let current = null;
    let best = Infinity;
    for (const id of unvisited) {
      const d = dist.get(id);
      if (d < best) {
        best = d;
        current = id;
      }
    }
    if (current === null || best === Infinity) break;
    unvisited.delete(current);
    if (current === dstId) break;
    const edges = adj.get(current) || [];
    for (const edge of edges) {
      if (!unvisited.has(edge.to)) continue;
      const alt = dist.get(current) + edge.weight;
      if (alt < dist.get(edge.to)) {
        dist.set(edge.to, alt);
        prev.set(edge.to, current);
        prevEdge.set(edge.to, edge.key);
      }
    }
  }
  if (!prev.has(dstId)) return null;
  const nodes = [];
  const edges = [];
  let cur = dstId;
  while (cur !== srcId) {
    nodes.push(cur);
    edges.push(prevEdge.get(cur));
    cur = prev.get(cur);
  }
  nodes.push(srcId);
  nodes.reverse();
  edges.reverse();
  return { nodes, edges };
}
import { CONFERENCE_COLORS as COLORS, getConferenceColor } from './conference-colors.js';

const SEGMENT_COLORS = ['#60a5fa', '#f97316', '#a855f7', '#22c55e', '#facc15', '#f43f5e'];

const QUERY = `
  query Graph($season: Int!) {
    teams(season: $season) {
      id
      name
      shortName
      conference { id shortName name }
    }
    games(season: $season) {
      id
      type
      leverage
      date
      week
      home { id name shortName conference { id shortName } }
      away { id name shortName conference { id shortName } }
      homePoints
      awayPoints
      result
    }
  }
`;

const CONFERENCES_QUERY = `
  query { conferences { id name shortName } }
`;

const state = {
  loading: false,
  error: null,
  graph: { teams: [], games: [] },
  conferenceMeta: [],
  filteredGames: [],
  filteredPairs: new Map(),
  connection: null,
  connectionGames: [],
  connectionSegments: [],
};

function POST(url, body) {
  return fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });
}

function byName(a, b) {
  return a.name.localeCompare(b.name);
}

function applyConferenceLegend() {
  const container = document.getElementById('legend');
  container.replaceChildren();
  const seen = new Set();
  for (const team of state.graph.teams) {
    const conf = team.conference?.id || 'other';
    if (!seen.has(conf)) seen.add(conf);
  }
  const entries = Array.from(seen)
    .map(id => {
      const meta = state.conferenceMeta.find(c => c.id === id);
      return {
        id,
        color: getConferenceColor(id),
        label: meta ? `${meta.name} (${meta.shortName})` : id.toUpperCase(),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
  for (const entry of entries) {
    const dot = document.createElement('div');
    dot.className = 'legend-dot';
    dot.style.background = entry.color;
    const label = document.createElement('div');
    label.textContent = entry.label;
    container.appendChild(dot);
    container.appendChild(label);
  }
}

function buildSelectors() {
  const srcSel = document.getElementById('srcSel');
  const dstSel = document.getElementById('dstSel');
  const opts = state.graph.teams.slice().sort(byName);
  srcSel.replaceChildren();
  dstSel.replaceChildren();
  for (const team of opts) {
    const o1 = document.createElement('option');
    o1.value = team.id;
    o1.textContent = team.name;
    srcSel.appendChild(o1);
    const o2 = document.createElement('option');
    o2.value = team.id;
    o2.textContent = team.name;
    dstSel.appendChild(o2);
  }
  // Restore last selection from localStorage if available, else use OSU/Georgia
  const lastSrc = localStorage.getItem('fbsgraph_srcSel');
  const lastDst = localStorage.getItem('fbsgraph_dstSel');
  const osuId = opts.find(t => t.name.toLowerCase().includes('ohio state'))?.id || opts[0]?.id;
  const ugaId =
    opts.find(t => t.name.toLowerCase().includes('georgia'))?.id || opts[1]?.id || opts[0]?.id;
  srcSel.value = lastSrc && opts.some(t => t.id === lastSrc) ? lastSrc : osuId;
  dstSel.value = lastDst && opts.some(t => t.id === lastDst) ? lastDst : ugaId;
}

function computeWeekKey(game) {
  if (typeof game.week === 'number' && !Number.isNaN(game.week)) return game.week;
  if (!game.date) return null;
  const date = new Date(game.date);
  if (Number.isNaN(date.getTime())) return null;
  const oneDay = 1000 * 60 * 60 * 24;
  const seasonStart = new Date(date.getFullYear(), 7, 20); // mid-August anchor
  const diff = Math.max(0, date - seasonStart);
  return 1 + Math.floor(diff / (7 * oneDay));
}

function formatWeekLabel(week) {
  if (week === null) return 'Unscheduled';
  return `Week ${week}`;
}

function formatDate(dateStr) {
  if (!dateStr) return 'TBD';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return 'TBD';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatType(type) {
  if (!type || type === 'ALL') return 'All';
  return type.replace('_', ' ');
}

function updateStatus(message) {
  document.getElementById('status').textContent = message;
}

function updateTimelineSummary() {
  const summary = document.getElementById('timelineSummary');
  const games = state.connection ? state.connectionGames : state.filteredGames;
  if (!games.length) {
    summary.textContent = '';
    return;
  }
  const uniqueWeeks = new Set(games.map(computeWeekKey).map(v => v ?? 'unknown'));
  const avgLev =
    games.reduce((sum, g) => sum + (typeof g.leverage === 'number' ? g.leverage : 0), 0) /
    games.length;
  summary.textContent = `${games.length} games · ${uniqueWeeks.size} weeks · avg leverage ${avgLev.toFixed(
    3
  )}`;
}

function renderTimeline() {
  const grid = document.getElementById('weekGrid');
  grid.replaceChildren();
  const games = state.connection ? state.connectionGames : state.filteredGames;
  if (!games.length) {
    document.getElementById('timelineEmpty').hidden = false;
    return;
  } else {
    document.getElementById('timelineEmpty').hidden = true;
  }

  // Group games by week
  const gamesByWeek = new Map();
  for (const game of games) {
    const week = computeWeekKey(game) ?? 'unknown';
    if (!gamesByWeek.has(week)) gamesByWeek.set(week, []);
    gamesByWeek.get(week).push(game);
  }
  // Sort weeks
  const sortedWeeks = Array.from(gamesByWeek.keys()).sort((a, b) => {
    if (a === 'unknown') return 1;
    if (b === 'unknown') return -1;
    return a - b;
  });

  // Create columns for each week
  for (const week of sortedWeeks) {
    const column = document.createElement('div');
    column.className = 'week-column';
    const label = document.createElement('div');
    label.className = 'week-label';
    label.textContent = formatWeekLabel(week === 'unknown' ? null : week);
    column.appendChild(label);
    const gamesForWeek = gamesByWeek.get(week);
    for (const game of gamesForWeek.sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      if (da !== db) return da - db;
      return a.id.localeCompare(b.id);
    })) {
      const card = document.createElement('div');
      card.className = 'game-card';
      card.dataset.gameId = game.id;
      if (game.__segmentColor) {
        card.dataset.segmentColor = 'true';
        card.style.setProperty('--segment-color', game.__segmentColor);
        card.style.borderColor = `${game.__segmentColor}44`;
      }
      const meta = document.createElement('div');
      meta.className = 'game-meta';
      const date = document.createElement('span');
      date.className = 'game-date';
      date.textContent = formatDate(game.date);
      const leverage = document.createElement('span');
      leverage.textContent = `Leverage ${Number(game.leverage || 0).toFixed(3)}`;
      meta.appendChild(date);
      meta.appendChild(leverage);

      const teams = document.createElement('div');
      teams.className = 'team-row';
      const home = document.createElement('div');
      home.textContent = game.home?.name || 'Home';
      const label = document.createElement('span');
      label.textContent = 'vs';
      const away = document.createElement('div');
      away.textContent = game.away?.name || 'Away';
      teams.appendChild(home);
      teams.appendChild(label);
      teams.appendChild(away);

      // Game result (score and winner) if played
      let result = '';
      let resultEl = null;
      const played = typeof game.homePoints === 'number' && typeof game.awayPoints === 'number';
      if (played) {
        const homeScore = game.homePoints;
        const awayScore = game.awayPoints;
        let winner = '';
        if (game.result === 'HOME_WIN') winner = `🏠`;
        else if (game.result === 'AWAY_WIN') winner = `✈️`;
        else if (game.result === 'TIE') winner = '🤝';
        else if (game.result === 'CANCELLED' || game.result === 'NO_CONTEST') winner = '🚫';
        resultEl = document.createElement('span');
        resultEl.className = 'game-result';
        resultEl.textContent = `${homeScore} - ${awayScore} ${winner}`;
        result = 'created';
      }

      const type = document.createElement('div');
      type.className = 'game-meta';
      const typeSpan = document.createElement('span');
      typeSpan.textContent = formatType(game.type);
      const confSpan = document.createElement('span');
      confSpan.textContent = `${game.home?.conference?.shortName || ''} · ${game.away?.conference?.shortName || ''}`;
      type.appendChild(typeSpan);
      type.appendChild(confSpan);

      card.appendChild(meta);
      card.appendChild(teams);
      if (result === 'created' && resultEl) {
        const resultDiv = document.createElement('div');
        resultDiv.appendChild(resultEl);
        card.appendChild(resultDiv);
      }
      card.appendChild(type);
      column.appendChild(card);
    }
    grid.appendChild(column);
  }
}

function renderPathInfo() {
  const box = document.getElementById('pathInfo');
  if (!state.connection) {
    box.replaceChildren(document.createTextNode('No connection selected.'));
    return;
  }
  const teamsById = new Map(state.graph.teams.map(team => [team.id, team]));
  box.replaceChildren();
  const header = document.createElement('div');
  header.className = 'small muted';
  header.textContent = 'Shortest chain by inverse leverage:';
  box.appendChild(header);
  state.connection.nodes.forEach((id, idx) => {
    const team = teamsById.get(id);
    const row = document.createElement('div');
    row.textContent = team ? team.name : id;
    box.appendChild(row);
    if (idx < state.connection.edges.length) {
      const seg = state.connectionSegments[idx];
      const avg = seg.games.reduce((s, g) => s + (g.leverage || 0), 0) / seg.games.length;
      const stat = document.createElement('div');
      stat.className = 'status';
      stat.style.margin = '6px 0 8px 8px';
      stat.style.color = seg.color;
      stat.textContent = `↳ ${seg.games.length} game${seg.games.length === 1 ? '' : 's'} · avg leverage ${avg.toFixed(
        3
      )}`;
      box.appendChild(stat);
    }
  });
}

function renderConnectionLegend() {
  const legend = document.getElementById('connectionLegend');
  legend.replaceChildren();
  if (!state.connection) return;
  state.connectionSegments.forEach(segment => {
    const fromTeam = state.graph.teams.find(t => t.id === segment.from);
    const toTeam = state.graph.teams.find(t => t.id === segment.to);
    const item = document.createElement('span');
    const dot = document.createElement('span');
    dot.className = 'connection-dot';
    dot.style.background = segment.color;
    const label = document.createElement('span');
    label.textContent = `${fromTeam?.shortName || fromTeam?.name || segment.from} → ${
      toTeam?.shortName || toTeam?.name || segment.to
    }`;
    item.appendChild(dot);
    item.appendChild(label);
    legend.appendChild(item);
  });
}

function renderConnectionGraph() {
  const section = document.getElementById('connectionSection');
  if (!state.connection) {
    section.classList.remove('active');
    document.getElementById('connectionSvg').replaceChildren();
    return;
  }
  section.classList.add('active');
  const svg = document.getElementById('connectionSvg');
  svg.replaceChildren();
  const teams = Array.from(new Set(state.connection.nodes));
  const weeks = Array.from(
    new Set(state.connectionGames.map(g => computeWeekKey(g) ?? 'unknown'))
  ).sort((a, b) => {
    if (a === 'unknown') return 1;
    if (b === 'unknown') return -1;
    return a - b;
  });
  const columnWidth = 180;
  const rowHeight = 56;
  const margin = { top: 28, right: 60, bottom: 48, left: 140 };
  const width = margin.left + margin.right + Math.max(0, weeks.length - 1) * columnWidth;
  const height = margin.top + margin.bottom + Math.max(0, teams.length - 1) * rowHeight;
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);

  const yForTeam = new Map();
  teams.forEach((teamId, idx) => {
    yForTeam.set(teamId, margin.top + idx * rowHeight);
  });
  const xForWeek = new Map();
  weeks.forEach((wk, idx) => {
    xForWeek.set(wk, margin.left + idx * columnWidth);
  });

  const svgNS = 'http://www.w3.org/2000/svg';
  const bg = document.createElementNS(svgNS, 'rect');
  bg.setAttribute('x', 0);
  bg.setAttribute('y', 0);
  bg.setAttribute('width', width);
  bg.setAttribute('height', height);
  bg.setAttribute('fill', 'rgba(15,23,42,0.18)');
  svg.appendChild(bg);

  weeks.forEach(wk => {
    const x = xForWeek.get(wk);
    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('x1', x);
    line.setAttribute('x2', x);
    line.setAttribute('y1', margin.top - 16);
    line.setAttribute('y2', height - margin.bottom + 12);
    line.setAttribute('stroke', 'rgba(148,163,184,0.22)');
    line.setAttribute('stroke-dasharray', '4 6');
    svg.appendChild(line);
    const label = document.createElementNS(svgNS, 'text');
    label.setAttribute('x', x);
    label.setAttribute('y', height - margin.bottom + 32);
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('fill', 'rgba(226,232,240,0.78)');
    label.setAttribute('font-size', '12');
    label.textContent = wk === 'unknown' ? 'TBD' : `Week ${wk}`;
    svg.appendChild(label);
  });

  teams.forEach(teamId => {
    const y = yForTeam.get(teamId);
    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('x1', margin.left - 12);
    line.setAttribute('x2', width - margin.right + 12);
    line.setAttribute('y1', y);
    line.setAttribute('y2', y);
    line.setAttribute('stroke', 'rgba(148,163,184,0.16)');
    svg.appendChild(line);
    const label = document.createElementNS(svgNS, 'text');
    label.setAttribute('x', margin.left - 24);
    label.setAttribute('y', y + 4);
    label.setAttribute('text-anchor', 'end');
    label.setAttribute('fill', 'rgba(226,232,240,0.8)');
    label.setAttribute('font-size', '13');
    const team = state.graph.teams.find(t => t.id === teamId);
    label.textContent = team?.shortName || team?.name || teamId;
    svg.appendChild(label);
  });

  const pointsByTeam = new Map();
  state.connectionGames.forEach(game => {
    const wk = computeWeekKey(game) ?? 'unknown';
    const x = xForWeek.get(wk);
    const homeY = yForTeam.get(game.home.id);
    const awayY = yForTeam.get(game.away.id);
    if (x === undefined || homeY === undefined || awayY === undefined) return;
    if (!pointsByTeam.has(game.home.id)) pointsByTeam.set(game.home.id, []);
    if (!pointsByTeam.has(game.away.id)) pointsByTeam.set(game.away.id, []);
    pointsByTeam.get(game.home.id).push({ x, y: homeY, leverage: game.leverage });
    pointsByTeam.get(game.away.id).push({ x, y: awayY, leverage: game.leverage });
    const vert = document.createElementNS(svgNS, 'line');
    vert.setAttribute('x1', x);
    vert.setAttribute('x2', x);
    vert.setAttribute('y1', homeY);
    vert.setAttribute('y2', awayY);
    vert.setAttribute('stroke', game.__segmentColor || '#38bdf8');
    vert.setAttribute('stroke-width', Math.max(2, (game.leverage || 0) * 2 + 1));
    vert.setAttribute('stroke-linecap', 'round');
    svg.appendChild(vert);
    const dotHome = document.createElementNS(svgNS, 'circle');
    dotHome.setAttribute('cx', x);
    dotHome.setAttribute('cy', homeY);
    dotHome.setAttribute('r', 6);
    dotHome.setAttribute('fill', game.__segmentColor || '#38bdf8');
    svg.appendChild(dotHome);
    const dotAway = document.createElementNS(svgNS, 'circle');
    dotAway.setAttribute('cx', x);
    dotAway.setAttribute('cy', awayY);
    dotAway.setAttribute('r', 6);
    dotAway.setAttribute('fill', game.__segmentColor || '#38bdf8');
    svg.appendChild(dotAway);
  });

  pointsByTeam.forEach(points => {
    const sorted = points
      .slice()
      .sort((a, b) => a.x - b.x)
      .filter((pt, idx, arr) => idx === 0 || pt.x !== arr[idx - 1].x || pt.y !== arr[idx - 1].y);
    if (sorted.length < 2) return;
    const path = document.createElementNS(svgNS, 'path');
    const d = sorted.map((pt, idx) => `${idx === 0 ? 'M' : 'L'}${pt.x} ${pt.y}`).join(' ');
    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'rgba(96, 165, 250, 0.4)');
    path.setAttribute('stroke-width', 2);
    path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path);
  });
}

function applyFilters({ recomputePath = true } = {}) {
  const minLev = Number(document.getElementById('lev').value) || 0;
  const typeFilter = document.getElementById('typeFilter').value;
  const levLabel = document.getElementById('levVal');
  levLabel.textContent = `≥ ${minLev.toFixed(2)}`;
  const filtered = state.graph.games.filter(game => {
    const lev = typeof game.leverage === 'number' ? game.leverage : 0;
    if (lev < minLev) return false;
    if (typeFilter !== 'ALL' && game.type !== typeFilter) return false;
    return true;
  });
  state.filteredGames = filtered;
  state.filteredPairs = computePairs(filtered);
  if (recomputePath && state.connection) {
    const src = document.getElementById('srcSel').value;
    const dst = document.getElementById('dstSel').value;
    activatePath(src, dst);
  } else {
    renderTimeline();
    renderConnectionGraph();
    renderPathInfo();
    renderConnectionLegend();
    updateTimelineSummary();
  }
}

async function load() {
  try {
    state.loading = true;
    state.error = null;
    updateStatus('Loading data…');
    const season = Number(document.getElementById('season').value);

    console.log(
      '[Timeline Explorer] Starting load, staticDataAdapter available:',
      !!window.staticDataAdapter
    );

    // Use static data adapter if available, otherwise fall back to GraphQL
    if (window.staticDataAdapter) {
      console.log('[Timeline Explorer] Using static data adapter');
      const [conferences, result] = await Promise.all([
        window.staticDataAdapter.getConferences(),
        window.staticDataAdapter.queryGraph(season),
      ]);
      console.log('[Timeline Explorer] Data loaded:', {
        conferences: conferences?.length,
        teams: result.data?.teams?.length,
        games: result.data?.games?.length,
      });
      state.conferenceMeta = conferences ?? [];
      setConferenceMap(conferences ?? []);
      state.graph = result.data || { teams: [], games: [] };
    } else {
      console.log('[Timeline Explorer] Static data adapter not available, using GraphQL');
      // Fallback to GraphQL if static data not available
      const endpoint =
        document.getElementById('endpoint')?.value?.trim() || DEFAULT_GRAPHQL_ENDPOINT;
      const [confRes, mainRes] = await Promise.all([
        POST(endpoint, { query: CONFERENCES_QUERY }),
        POST(endpoint, { query: QUERY, variables: { season } }),
      ]);
      if (confRes.errors) throw new Error(confRes.errors[0]?.message || 'Conference query failed');
      if (mainRes.errors) throw new Error(mainRes.errors[0]?.message || 'Graph query failed');
      state.conferenceMeta = confRes.data?.conferences ?? [];
      setConferenceMap(confRes.data?.conferences ?? []);
      state.graph = mainRes.data || { teams: [], games: [] };
    }
    buildSelectors();
    applyConferenceLegend();
    applyFilters({ recomputePath: false });
    // Auto-activate last or default connection
    const srcSel = document.getElementById('srcSel');
    const dstSel = document.getElementById('dstSel');
    if (srcSel.value && dstSel.value) {
      activatePath(srcSel.value, dstSel.value);
    } else {
      state.connection = null;
      state.connectionGames = [];
      state.connectionSegments = [];
      renderTimeline();
      renderPathInfo();
      renderConnectionLegend();
      renderConnectionGraph();
    }
    updateStatus(
      `Loaded ${state.graph.teams.length} teams and ${state.graph.games.length} games for ${season}.`
    );
  } catch (error) {
    console.error(error);
    state.error = error instanceof Error ? error.message : String(error);
    updateStatus(`Error: ${state.error}`);
    document.getElementById('weekGrid').replaceChildren();
    document.getElementById('timelineEmpty').hidden = false;
    state.connection = null;
    renderConnectionGraph();
    renderPathInfo();
  } finally {
    state.loading = false;
  }
}

function activatePath(src, dst) {
  const result = shortestPathByInverseLeverage(state.filteredPairs, state.graph.teams, src, dst);
  if (!result) {
    state.connection = null;
    state.connectionGames = [];
    state.connectionSegments = [];
    renderTimeline();
    renderPathInfo();
    renderConnectionLegend();
    renderConnectionGraph();
    const typeFilter = document.getElementById('typeFilter').value;
    if (typeFilter === 'CONFERENCE') {
      const pi = document.getElementById('pathInfo');
      pi.replaceChildren();
      const span = document.createElement('span');
      span.className = 'status';
      span.textContent = 'No Conference Connections Found / Available.';
      pi.appendChild(span);
    } else {
      const pi = document.getElementById('pathInfo');
      pi.replaceChildren();
      const span = document.createElement('span');
      span.className = 'status';
      span.textContent = 'No path found with current filters.';
      pi.appendChild(span);
    }
    return;
  }
  const segments = [];
  const games = [];
  result.edges.forEach((edgeKey, idx) => {
    const rawGames = state.filteredPairs.get(edgeKey) || [];
    const color = SEGMENT_COLORS[idx % SEGMENT_COLORS.length];
    const from = result.nodes[idx];
    const to = result.nodes[idx + 1];
    const enriched = rawGames
      .slice()
      .sort((a, b) => {
        const da = a.date ? new Date(a.date).getTime() : 0;
        const db = b.date ? new Date(b.date).getTime() : 0;
        return da - db;
      })
      .map(game => ({ ...game, __segmentColor: color }));
    segments.push({ key: edgeKey, from, to, color, games: enriched });
    games.push(...enriched);
  });
  state.connection = result;
  state.connectionGames = games;
  state.connectionSegments = segments;
  renderTimeline();
  renderPathInfo();
  renderConnectionLegend();
  renderConnectionGraph();
}

document.getElementById('loadBtn').addEventListener('click', () => load());
document.getElementById('lev').addEventListener('input', () => applyFilters());
document.getElementById('typeFilter').addEventListener('change', () => applyFilters());
function persistSelection() {
  const src = document.getElementById('srcSel').value;
  const dst = document.getElementById('dstSel').value;
  localStorage.setItem('fbsgraph_srcSel', src);
  localStorage.setItem('fbsgraph_dstSel', dst);
}

document.getElementById('srcSel').addEventListener('change', persistSelection);
document.getElementById('dstSel').addEventListener('change', persistSelection);
document.getElementById('pathBtn').addEventListener('click', () => {
  const src = document.getElementById('srcSel').value;
  const dst = document.getElementById('dstSel').value;
  persistSelection();
  activatePath(src, dst);
});
document.getElementById('clearPathBtn').addEventListener('click', () => {
  state.connection = null;
  state.connectionGames = [];
  state.connectionSegments = [];
  applyFilters({ recomputePath: false });
});

load();
