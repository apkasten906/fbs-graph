/**
 * Cytoscape Graph Builder Module
 *
 * Handles construction of Cytoscape graph elements from game and team data.
 * Provides functions for building nodes, edges, and calculating layouts.
 */

import { CONFERENCE_COLORS, getConferenceColor } from './conference-colors.js';
import { computeSugiyamaDegreeLayout } from './sugiyama-degree-layout.js';

// Backwards-compatible export used by other modules/tests
export const COLORS = CONFERENCE_COLORS;

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
  '#00FF00', // 1: Bright Green (1 hop)
  '#FFFF00', // 2: Bright Yellow (2 hops)
  '#FFA500', // 3: Orange (3 hops)
  '#FF6B35', // 4: Orange-Red (4 hops)
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
      edgeColor = DEGREE_COLORS[Math.min(edgeDegree, DEGREE_COLORS.length - 1) - 1]; // -1 for 0-based index
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

  // Special handling for source and destination to be on same horizontal plane
  const sourceX = 50;
  const destX = width - 50;

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
        midX = positions[source].x + Math.max(60, (destX - sourceX) * 0.1);
        L('[layout] ultimate fallback midX', { midX });
      }

      if (midX !== null) {
        const half = Math.ceil(nodesAtDegree.length / 2);
        const upper = nodesAtDegree.slice(0, half);
        const lower = nodesAtDegree.slice(half);
        const stepY = Math.max(36, Math.min(80, height * 0.12));
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
    const topY = centerY * 0.4;
    const bottomY = centerY * 1.6;
    const stepY = Math.max(36, Math.min(80, height * 0.12));

    nodesAtDegree.forEach((nodeId, index) => {
      // If this node is already positioned (e.g., on the shortest path), skip
      if (positions[nodeId]) return;

      // Try to find shortest-path node(s) this node connects to and anchor to them
      // Collect all matching anchors rather than stopping at the first match so
      // nodes that bridge multiple path nodes (e.g., USC connecting to Purdue and Notre Dame)
      // can be centered between those anchors instead of being biased to one.
      let anchorIdx = null;
      const anchorIdxs = [];
      if (pathIndex.size > 0) {
        for (const [pn, idx] of pathIndex) {
          const edgeKey = nodeId < pn ? `${nodeId}__${pn}` : `${pn}__${nodeId}`;
          if ((pathFilter.edges || []).includes(edgeKey)) {
            anchorIdxs.push(idx);
          }
        }
        if (anchorIdxs.length === 1) anchorIdx = anchorIdxs[0];
      }

      // Avoid anchoring to the source (index 0) where possible; prefer the first path step
      if (anchorIdx === 0) {
        if (pathIndex.size > 1) {
          L('[layout] remapping anchorIdx 0 -> 1 to avoid anchoring to source', { nodeId });
          anchorIdx = 1;
        } else {
          // no other path node to anchor to
          anchorIdx = null;
        }
      }

      if ((anchorIdx !== null || anchorIdxs.length > 1) && pathSpacing !== null) {
        const baseX = sourceX + pathSpacing * anchorIdx;
        const jitter = ((index % 3) - 1) * 12;
        // If this is a degree-1 node, place it between the source and the anchor baseX
        // using a configurable fraction (MIDPOINT_FRACTION) for tuning.
        const isDegreeOne = degree === 1;
        const anchorId = shortestPathNodes ? shortestPathNodes[anchorIdx] : null;
        const prevAnchorId =
          shortestPathNodes && anchorIdx > 0 ? shortestPathNodes[anchorIdx - 1] : null;
        const anchorX = anchorId && positions[anchorId] ? positions[anchorId].x : baseX;
        const prevX = prevAnchorId && positions[prevAnchorId] ? positions[prevAnchorId].x : null;
        let x;
        // If the node connects to multiple path anchors, compute the average anchor x
        // and use that as the placement to visually center the bridging node.
        if (anchorIdxs.length > 1) {
          const anchorXs = anchorIdxs
            .map(i => shortestPathNodes && shortestPathNodes[i] && positions[shortestPathNodes[i]])
            .filter(Boolean)
            .map(p => p.x);
          const avgAnchorX = anchorXs.length
            ? anchorXs.reduce((a, b) => a + b, 0) / anchorXs.length
            : baseX;
          x = avgAnchorX + jitter;
        } else if (isDegreeOne) {
          x = sourceX + (baseX - sourceX) * MIDPOINT_FRACTION + jitter;
        } else if (prevX !== null) {
          // Pull higher-degree nodes toward their anchor but keep them between the two
          // neighboring path nodes so they do not stack on the anchor's x.
          const pull = Math.min(0.9, degree / (degree + 1));
          x = prevX + (anchorX - prevX) * pull + jitter;
        } else {
          x = anchorX + jitter;
        }
        L('[layout] anchoring node to path', {
          nodeId,
          anchorIdx,
          baseX,
          jitter,
          x,
          isDegreeOne,
          anchorId,
          prevAnchorId,
        });
        const above = index % 2 === 0;
        const offsetIdx = Math.floor(index / 2) + 1;
        const y = above ? centerY - offsetIdx * stepY : centerY + offsetIdx * stepY;
        positions[nodeId] = { x, y };
        return;
      }

      // Fallback to degree-based x positioning
      const x = sourceX + horizontalSpacing * degree;
      const fraction = (index + 1) / (nodesAtDegree.length + 1);
      let y;
      if (fraction < 0.5) {
        y = topY + fraction * 2 * (centerY - topY - 50);
      } else {
        y = centerY + 50 + (fraction - 0.5) * 2 * (bottomY - centerY - 50);
      }
      positions[nodeId] = { x, y };
    });
  }

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
      positions: computeSugiyamaDegreeLayout(pathFilter, width, height),
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
