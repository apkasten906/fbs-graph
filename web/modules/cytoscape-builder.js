/**
 * Cytoscape Graph Builder Module
 *
 * Handles construction of Cytoscape graph elements from game and team data.
 * Provides functions for building nodes, edges, and calculating layouts.
 */

import { CONFERENCE_COLORS, getConferenceColor } from './conference-colors.js';

// Backwards-compatible export used by other modules/tests
export const COLORS = CONFERENCE_COLORS;

// Layout constants (exported for tests and UI knobs)
export const BASE_SPACING = 36; // default vertical spacing step for stacked nodes
export const X_BUCKET = 8; // px tolerance to group nodes sharing same horizontal projection
export const MIN_Y = 28; // minimum vertical separation during collision sweep
export const X_THRESHOLD = 120; // horizontal threshold to consider collisions
export const JITTER_STEP = 12; // horizontal jitter magnitude used for visual separation
export const JITTER_CYCLE = 3; // jitter pattern cycle length
export const DEGREE_MIN_STEP = BASE_SPACING; // min vertical step for degree stacking
export const DEGREE_MAX_STEP = 80; // max vertical step for degree stacking
export const DEGREE_HEIGHT_FRAC = 0.12; // fraction of height used to compute max step
export const SIDE_MARGIN = 50; // left/right margin for source/destination
export const MID_NUDGE_MIN = 60; // min nudge when computing fallback midX
export const PATH_NUDGE_FRAC = 0.1; // fraction used for fallback mid nudge
export const TOP_Y_FACTOR = 0.4;
export const BOTTOM_Y_FACTOR = 1.6;
export const CENTER_OFFSET_Y = 50;

// Lightweight conditional logger. Enable by adding `?layoutDebug=1` to the URL
// or by setting `localStorage.setItem('fbs_layout_debug','1')` in the console.
function L(...args) {
  try {
    if (typeof window === 'undefined') return;
    if (window.FBS_LAYOUT_DEBUG === undefined) {
      const params = new URLSearchParams(window.location.search);
      const enabled =
        params.get('layoutDebug') === '1' ||
        (window.localStorage && window.localStorage.getItem('fbs_layout_debug') === '1');
      window.FBS_LAYOUT_DEBUG = !!enabled;
    }
    if (window.FBS_LAYOUT_DEBUG && console && console.debug) {
      console.debug(...args);
    }
  } catch (e) {
    // ignore
  }
}

// Midpoint fraction used for degree-1 node placement between source and anchor.
// Default is 0.5 (halfway). Can be overridden with URL `?midFrac=0.4` or
// by setting `localStorage.setItem('fbs_mid_frac','0.4')`.
const MIDPOINT_FRACTION = (() => {
  try {
    if (typeof window === 'undefined') return 0.5;
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('midFrac');
    const fromStorage = window.localStorage && window.localStorage.getItem('fbs_mid_frac');
    const raw = fromUrl || fromStorage || '0.5';
    const v = parseFloat(raw);
    return Number.isFinite(v) && v > 0 && v < 1 ? v : 0.5;
  } catch (e) {
    return 0.5;
  }
})();

/**
 * Degree-based color scheme for edges in comparison view
 */
export const DEGREE_COLORS = [
  '#00FF00', // 0: Bright Green (direct connection)
  '#FFFF00', // 1: Bright Yellow (1 hop)
  '#FFA500', // 2: Orange (2 hops)
  '#FF6B35', // 3: Orange-Red (3 hops)
  '#FF4500', // 4: Red-Orange (4 hops)
  '#DC143C', // 5: Crimson (5 hops)
  '#8B0000', // 6: Dark Red (6 hops)
];

/**
 * Creates a consistent edge key from two team IDs
 * @param {string} a - First team ID
 * @param {string} b - Second team ID
 * @returns {string} Alphabetically sorted key "a__b"
 */
export function createEdgeKey(a, b) {
  return a < b ? `${a}__${b}` : `${b}__${a}`;
}

// Build adjacency map from an array of edge keys ("a__b")
export function buildAdjacencyFromEdges(edgeKeys = []) {
  const adj = new Map();
  for (const k of edgeKeys) {
    const parts = k.split('__');
    if (parts.length !== 2) continue;
    const [a, b] = parts;
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a).add(b);
    adj.get(b).add(a);
  }
  return adj;
}

// Compute shortest-path distances from each anchor using BFS (unweighted)
export function computeAnchorDistances(adjacency, anchorNodes) {
  // adjacency: Map nodeId -> Set(neighborId)
  // returns: distances[nodeId] = { anchorId: distance, ... }
  const distances = Object.create(null);
  for (const anchor of anchorNodes) {
    // BFS from anchor
    const q = [anchor];
    const dist = new Map();
    dist.set(anchor, 0);
    while (q.length) {
      const u = q.shift();
      const d = dist.get(u);
      const neighbors = adjacency.get(u) || new Set();
      for (const v of neighbors) {
        if (!dist.has(v)) {
          dist.set(v, d + 1);
          q.push(v);
        }
      }
    }
    for (const [nodeId, d] of dist) {
      if (!distances[nodeId]) distances[nodeId] = Object.create(null);
      distances[nodeId][anchor] = d;
    }
  }
  return distances;
}

// Deterministic ranking for nodes sharing same xGroup: higher degree => earlier, tie by id
export function deterministicRankForX(nodes, nodesByDegree, xBucket = X_BUCKET) {
  // nodes: array of { id, x }
  const groups = new Map();
  for (const n of nodes) {
    const g = Math.round(n.x / xBucket);
    const arr = groups.get(g) || [];
    arr.push(n);
    groups.set(g, arr);
  }
  const ranks = Object.create(null);
  for (const [g, arr] of groups) {
    arr.sort((a, b) => {
      const da = nodesByDegree.get(a.id) || 0;
      const db = nodesByDegree.get(b.id) || 0;
      if (da !== db) return db - da; // higher degree first
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    for (let i = 0; i < arr.length; i++) ranks[arr[i].id] = i;
  }
  return ranks;
}

/**
 * Builds graph elements (nodes and edges) from team and game data
 *
 * @param {Object} params - Build parameters
 * @param {Array} params.teams - Array of team objects with id, name, conference
 * @param {Array} params.games - Array of game objects with home, away, type, leverage
 * @param {Map} params.teamIndex - Map of team ID to team object (will be populated)
 * @param {Map} params.pairGames - Map of edge key to game array (will be populated)
 * @param {string} params.typeFilter - Game type filter: 'ALL', 'CONFERENCE', 'NON_CONFERENCE'
 * @param {number} params.minLeverage - Minimum leverage threshold
 * @param {Object|null} params.pathFilter - Optional path filter with nodes, edges, nodesByDegree
 * @returns {Array} Array of Cytoscape elements (nodes and edges)
 */
export function buildGraphElements({
  teams,
  games,
  teamIndex,
  pairGames,
  typeFilter,
  minLeverage,
  pathFilter = null,
}) {
  const els = [];
  teamIndex.clear();
  teams.forEach(t => teamIndex.set(t.id, t));

  // Filter teams to show (all or just path nodes)
  const teamsToShow = pathFilter ? teams.filter(t => pathFilter.nodes.includes(t.id)) : teams;

  // Build nodes
  for (const t of teamsToShow) {
    const conf = (t.conference && t.conference.id) || 'other';
    els.push({
      group: 'nodes',
      data: { id: t.id, label: t.name, conf },
      classes: conf,
    });
  }

  // Build edges with aggregation by pair
  pairGames.clear();
  const edges = new Map();

  for (const g of games) {
    if (typeFilter !== 'ALL' && g.type !== typeFilter) continue;
    const lev = typeof g.leverage === 'number' ? g.leverage : 0;
    if (lev < minLeverage) continue;

    const a = g.home.id;
    const b = g.away.id;
    if (!teamIndex.has(a) || !teamIndex.has(b)) continue;

    const k = createEdgeKey(a, b);
    const arr = pairGames.get(k) || [];
    arr.push(g);
    pairGames.set(k, arr);
  }

  // Process edges
  for (const [k, list] of pairGames) {
    // Skip edge if pathFilter is active and edge is not in path
    if (pathFilter && !pathFilter.edges.includes(k)) continue;

    const a = list[0].home.id;
    const b = list[0].away.id;
    const sumLev = list.reduce((s, x) => s + (x.leverage || 0), 0);
    const avgLev = sumLev / list.length;
    const w = Math.max(1, Math.log2(1 + sumLev * 4));

    // Calculate edge color based on degree of separation in comparison path
    let edgeColor = '#4562aa'; // Default blue
    if (pathFilter && pathFilter.nodesByDegree && pathFilter.source && pathFilter.destination) {
      const degreeA = pathFilter.nodesByDegree.get(a) || 0;
      const degreeB = pathFilter.nodesByDegree.get(b) || 0;
      const edgeDegree = Math.max(degreeA, degreeB);
      edgeColor = DEGREE_COLORS[Math.min(edgeDegree, DEGREE_COLORS.length - 1)];
    }

    edges.set(k, { a, b, count: list.length, sumLev, avgLev, weight: w, edgeColor });
  }

  // Convert edges to Cytoscape format
  for (const [k, e] of edges) {
    els.push({
      group: 'edges',
      data: {
        id: 'e_' + k,
        source: e.a,
        target: e.b,
        label: `${e.count}`,
        weight: e.weight,
        avgLev: e.avgLev,
        edgeColor: e.edgeColor,
      },
    });
  }

  return els;
}

/**
 * Calculate node positions based on degree of separation from source
 *
 * @param {Object} pathFilter - Path filter with nodesByDegree, source, destination
 * @param {number} width - Canvas width (default: 800)
 * @param {number} height - Canvas height (default: 600)
 * @returns {Object} Map of nodeId to {x, y} position
 */
export function calculateDegreePositions(pathFilter, width = 800, height = 600) {
  const positions = {};
  const nodesByDegree = pathFilter.nodesByDegree;
  const source = pathFilter.source;
  const destination = pathFilter.destination;
  const maxDegree = Math.max(...nodesByDegree.values());

  // Group nodes by their degree
  const degreeGroups = new Map();
  for (const [nodeId, degree] of nodesByDegree) {
    if (!degreeGroups.has(degree)) {
      degreeGroups.set(degree, []);
    }
    degreeGroups.get(degree).push(nodeId);
  }

  const centerY = height / 2;

  // Use module-level layout constants (can be overridden/exported for tests)
  // Special handling for source and destination to be on same horizontal plane
  const sourceX = SIDE_MARGIN;
  const destX = width - SIDE_MARGIN;

  positions[source] = { x: sourceX, y: centerY };
  positions[destination] = { x: destX, y: centerY };

  // Position intermediate nodes (degrees 1 to maxDegree)
  const horizontalSpacing =
    maxDegree > 0 ? (destX - sourceX) / (maxDegree + 1) : (destX - sourceX) / 2;

  // Helpful lookups from pathFilter
  const shortestPathNodes = pathFilter.shortestPathNodes || [];
  const nodeLabels = pathFilter.nodeLabels || {}; // id -> name

  // Place shortest-path nodes on the exact center line to form a straight horizontal chain
  // Place shortest-path nodes on the exact center line to form a straight horizontal chain
  const pathIndex = new Map();
  let pathSpacing = null;
  if (shortestPathNodes && shortestPathNodes.length > 0) {
    const count = shortestPathNodes.length;
    pathSpacing = count > 1 ? (destX - sourceX) / (count - 1) : (destX - sourceX) / 2;
    for (let i = 0; i < shortestPathNodes.length; i++) {
      const nid = shortestPathNodes[i];
      const x = sourceX + pathSpacing * i;
      positions[nid] = { x, y: centerY };
      pathIndex.set(nid, i);
    }
  }

  // Helper to build alphabetically-sorted array of node ids
  function sortByLabel(ids) {
    return ids.slice().sort((a, b) => {
      const A = (nodeLabels[a] || a).toLowerCase();
      const B = (nodeLabels[b] || b).toLowerCase();
      if (A < B) return -1;
      if (A > B) return 1;
      return 0;
    });
  }

  // (direct connection detection removed — layout anchors to shortest-path nodes)

  for (let degree = 1; degree <= maxDegree; degree++) {
    let nodesAtDegree = (degreeGroups.get(degree) || []).filter(
      id => id !== source && id !== destination && !positions[id]
    );
    if (nodesAtDegree.length === 0) continue;

    // Sort alphabetically for deterministic placement
    nodesAtDegree = sortByLabel(nodesAtDegree);

    // If degree 1 and we have a shortest-path anchor (first path node after source),
    // place these 1° nodes centered between source and that anchor and split above/below.
    if (degree === 1 && shortestPathNodes && shortestPathNodes.length > 1) {
      const firstPathNode = shortestPathNodes[1];
      // Prefer using the already-calculated position for the first path node (more robust)
      const anchorPos = positions[firstPathNode];
      let midX = null;

      // Debug: log key values used to compute midpoint for degree-1 nodes
      L('[layout] degree=1 firstPathNode:', firstPathNode);
      L('[layout] positions[source]:', positions[source]);
      L('[layout] positions[firstPathNode]:', anchorPos);
      L('[layout] pathIndex.size, pathSpacing:', pathIndex.size, pathSpacing);

      // 1) Use the actual positioned anchor if available and not equal to source.x
      if (anchorPos && typeof anchorPos.x === 'number' && anchorPos.x !== positions[source].x) {
        midX = (positions[source].x + anchorPos.x) / 2;
        L('[layout] using positioned anchor for midX', {
          midX,
          source: positions[source].x,
          anchor: anchorPos.x,
        });

        // 2) Compute baseX from pathIndex but avoid index 0 (source)
      } else if (pathIndex.size > 0 && pathSpacing !== null) {
        const anchorIdx = pathIndex.get(firstPathNode);
        let safeIdx = typeof anchorIdx === 'number' ? anchorIdx : null;
        if (safeIdx === 0) safeIdx = 1; // nudge to first path step if somehow 0
        if (safeIdx !== null && safeIdx >= 0) {
          const baseX = sourceX + pathSpacing * safeIdx;
          midX = (sourceX + baseX) / 2;
          L('[layout] using computed anchorIdx for midX', { midX, safeIdx, baseX });
        }

        // 3) Fallback: use half the first path spacing to the right of source
      } else if (pathSpacing !== null) {
        midX = sourceX + pathSpacing / 2;
        L('[layout] fallback midX using pathSpacing/2', { midX, pathSpacing });

        // 4) Ultimate fallback: nudge right from source
      } else {
        midX = positions[source].x + Math.max(MID_NUDGE_MIN, (destX - sourceX) * PATH_NUDGE_FRAC);
        L('[layout] ultimate fallback midX', { midX });
      }

      if (midX !== null) {
        const half = Math.ceil(nodesAtDegree.length / 2);
        const upper = nodesAtDegree.slice(0, half);
        const lower = nodesAtDegree.slice(half);
        const stepY = Math.max(
          DEGREE_MIN_STEP,
          Math.min(DEGREE_MAX_STEP, height * DEGREE_HEIGHT_FRAC)
        );
        upper.forEach((nid, idx) => {
          positions[nid] = { x: midX, y: centerY - (idx + 1) * stepY };
        });
        lower.forEach((nid, idx) => {
          positions[nid] = { x: midX, y: centerY + (idx + 1) * stepY };
        });
        continue;
      }
    }

    // Placement helpers
    const topY = centerY * TOP_Y_FACTOR;
    const bottomY = centerY * BOTTOM_Y_FACTOR;
    const stepY = Math.max(BASE_SPACING, Math.min(DEGREE_MAX_STEP, height * DEGREE_HEIGHT_FRAC));

    // We'll compute provisional positions for nodesAtDegree using multi-anchor weighting
    // where possible, then deterministically rank and assign perpendicular offsets.
    const adjacency = buildAdjacencyFromEdges(pathFilter.edges || []);
    const anchorNodes = (shortestPathNodes && shortestPathNodes.length > 0)
      ? shortestPathNodes
      : [source, destination];
    const anchorPositions = {};
    for (const a of anchorNodes) {
      if (positions[a]) anchorPositions[a] = positions[a];
    }
    const distances = computeAnchorDistances(adjacency, anchorNodes);

    // Build provisional candidate positions
    const candidates = nodesAtDegree.map((nodeId, index) => {
      if (positions[nodeId]) return null;
      // Determine connected anchors (direct edge to anchor)
      const connectedAnchors = [];
      for (const a of anchorNodes) {
        const eKey = nodeId < a ? `${nodeId}__${a}` : `${a}__${nodeId}`;
        if ((pathFilter.edges || []).includes(eKey)) connectedAnchors.push(a);
      }

      // Fallback: use nearest anchors by distance if none directly connected
      if (connectedAnchors.length === 0 && distances[nodeId]) {
        const ds = Object.entries(distances[nodeId]).filter(([k]) => anchorPositions[k]);
        ds.sort(([, d1], [, d2]) => d1 - d2);
        for (let i = 0; i < Math.min(2, ds.length); i++) connectedAnchors.push(ds[i][0]);
      }

      // If only one connected anchor and this is a deeper-degree node,
      // include the source as a soft anchor so nodes don't sit exactly on the anchor.
      if (connectedAnchors.length === 1 && degree > 1 && !connectedAnchors.includes(source)) {
        connectedAnchors.push(source);
      }

      // Compute weighted average x/yBase using inverse-distance weights
      let x;
      let yBase = centerY;
      if (connectedAnchors.length > 0) {
        const anchorXs = connectedAnchors.map(a => anchorPositions[a].x);
        const anchorYs = connectedAnchors.map(a => anchorPositions[a].y);
        const ws = connectedAnchors.map(a => {
          const d = (distances[nodeId] && distances[nodeId][a]) || 0;
          return 1 / (1 + d);
        });
        const sw = ws.reduce((s, v) => s + v, 0) || 1;
        x = anchorXs.reduce((s, v, i) => s + v * ws[i], 0) / sw;
        yBase = anchorYs.reduce((s, v, i) => s + v * ws[i], 0) / sw;
      } else {
        // fallback to degree-based x positioning
        x = sourceX + horizontalSpacing * degree;
      }

      return { id: nodeId, x, yBase, index };
    }).filter(Boolean);

    // Compute deterministic ranks for groups of similar x
    const ranks = deterministicRankForX(candidates.map(c => ({ id: c.id, x: c.x })), nodesByDegree, X_BUCKET);

    // Assign final positions using perpendicular offset based on rank
    for (const c of candidates) {
      const idx = c.index;
      const rank = ranks[c.id] || 0;
      const side = rank % 2 === 0 ? 1 : -1;
      const offset = side * Math.ceil((rank + 1) / 2) * BASE_SPACING;
      const y = c.yBase + offset;
      positions[c.id] = { x: c.x, y };
    }
    
  }

  // Deterministic collision-avoidance sweep
  function applyCollisionSweep(positionsMap, xThreshold, minY, nodesByDegreeMap) {
    const items = Object.keys(positionsMap).map(id => {
      const p = positionsMap[id];
      return { id, x: p.x, y: p.y, rank: nodesByDegreeMap.get(id) || 0 };
    });

    // Compute coarse x-grouping to respect small horizontal jitter (uses X_BUCKET)
    items.forEach(it => (it.xGroup = Math.round(it.x / X_BUCKET)));

    // Sort by xGroup then x then rank then id for deterministic ordering
    items.sort((a, b) => {
      if (a.xGroup !== b.xGroup) return a.xGroup - b.xGroup;
      if (a.x !== b.x) return a.x - b.x;
      if (a.rank !== b.rank) return a.rank - b.rank;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

    for (let i = 0; i < items.length; i++) {
      const a = items[i];
      for (let j = i + 1; j < items.length; j++) {
        const b = items[j];
        // Stop inner loop once horizontal separation is large enough
        if (Math.abs(b.x - a.x) >= xThreshold) break;
        if (Math.abs(b.y - a.y) < minY) {
          const sign = b.rank >= a.rank ? 1 : -1;
          b.y = a.y + sign * minY;
        }
      }
    }

    // Write back adjusted positions
    for (const it of items) {
      positionsMap[it.id] = { x: it.x, y: it.y };
    }
  }

  applyCollisionSweep(positions, X_THRESHOLD, MIN_Y, nodesByDegree);

  return positions;
}

/**
 * Create Cytoscape style configuration
 *
 * @returns {Array} Cytoscape style array
 */
export function createCytoscapeStyle() {
  return [
    {
      selector: 'node',
      style: {
        'background-color': ele => getConferenceColor(ele.data('conf')),
        label: 'data(label)',
        color: '#cfe1ff',
        'font-size': '20px',
        'text-outline-color': '#0b1020',
        'text-outline-width': 2,
        width: 'mapData(deg, 0, 24, 12, 40)',
        height: 'mapData(deg, 0, 24, 12, 40)',
      },
    },
    {
      selector: 'edge',
      style: {
        'line-color': ele => ele.data('edgeColor') || '#4562aa',
        width: ele => Math.max(1.5, ele.data('weight') || 1.5),
        opacity: 0.7,
        'curve-style': 'haystack',
      },
    },
    { selector: 'edge:selected', style: { 'line-color': '#fff', opacity: 1 } },
    {
      selector: '.highlight',
      style: { 'line-color': '#fff', 'background-color': '#fff', opacity: 1 },
    },
  ];
}

/**
 * Create layout configuration for Cytoscape
 *
 * @param {Object|null} pathFilter - Optional path filter for preset layout
 * @param {number} width - Canvas width for preset layout
 * @param {number} height - Canvas height for preset layout
 * @returns {Object} Cytoscape layout configuration
 */
export function createLayoutConfig(pathFilter = null, width = 800, height = 600) {
  if (pathFilter) {
    // Preset layout with calculated positions
    return {
      name: 'preset',
      positions: calculateDegreePositions(pathFilter, width, height),
      fit: true,
      padding: 50,
      avoidOverlap: true,
      nodeDimensionsIncludeLabels: true,
    };
  } else {
    // COSE (force-directed) layout
    return {
      name: 'cose',
      idealEdgeLength: edge => {
        const avgLev = edge.data('avgLev') || 0.1;
        // Higher leverage = shorter edge (inverse relationship)
        return Math.max(30, Math.min(150, 80 / Math.max(0.1, avgLev)));
      },
      nodeOverlap: 20,
      nodeRepulsion: 4000,
      fit: true,
    };
  }
}
