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
export const MIN_Y = 36; // minimum vertical separation during collision sweep
export const X_THRESHOLD = 180; // horizontal threshold to consider collisions
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

// New layout constants for strict layering (per plan-dijkstra-layout.prompt.md)
export const HORIZONTAL_SPACING = 220; // x-spacing per hop in shortest path
export const VERTICAL_SPACING = 90; // y-spacing per layer_offset band
export const LAMBDA = 0.2; // multi-anchor refinement weight (0.1-0.25)

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
  '#FF4500', // 3: Red-Orange (3 hops) -- tuned to be more red per UX request
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

/**
 * Breadth-First Search from a start node on an adjacency Map.
 * Deterministic: iterates neighbors in sorted order.
 * @param {string} start - start node id
 * @param {Map<string,Set<string>>} adjacency - adjacency map
 * @returns {Map<string,number>} distances (node -> hops) for reachable nodes
 */
export function bfsFrom(start, adjacency) {
  const dist = new Map();
  if (!adjacency || !adjacency.has(start)) return dist;
  const q = [start];
  dist.set(start, 0);
  while (q.length) {
    const u = q.shift();
    const d = dist.get(u);
    const neighbors = Array.from(adjacency.get(u) || []).sort();
    for (const v of neighbors) {
      if (!dist.has(v)) {
        dist.set(v, d + 1);
        q.push(v);
      }
    }
  }
  return dist;
}

/**
 * Compute layer offsets for nodes given BFS distances from source and target.
 * layer_offset = (distFromSource + distToTarget) - shortestPathLength
 * Nodes not reachable from either side will get Infinity.
 * @param {Map<string,number>} sourceDist
 * @param {Map<string,number>} targetDist
 * @param {number} shortestPathLength
 * @returns {Map<string,number>} node -> layer_offset
 */
export function computeLayerOffset(sourceDist, targetDist, shortestPathLength) {
  const nodes = new Set();
  if (sourceDist) for (const k of sourceDist.keys()) nodes.add(k);
  if (targetDist) for (const k of targetDist.keys()) nodes.add(k);
  const offsets = new Map();
  for (const n of nodes) {
    const ds = sourceDist && sourceDist.has(n) ? sourceDist.get(n) : Infinity;
    const dt = targetDist && targetDist.has(n) ? targetDist.get(n) : Infinity;
    const off =
      Number.isFinite(ds) && Number.isFinite(dt)
        ? ds + dt - (Number.isFinite(shortestPathLength) ? shortestPathLength : 0)
        : Infinity;
    offsets.set(n, off);
  }
  return offsets;
}

/**
 * Return one shortest path (array of node ids) between source and target using BFS.
 * Deterministic: neighbors are visited in sorted order so the returned path is reproducible.
 * @param {string} source
 * @param {string} target
 * @param {Map<string,Set<string>>} adjacency
 * @returns {Array<string>} path nodes from source to target (inclusive) or [] if no path
 */
export function getShortestPath(source, target, adjacency) {
  if (!adjacency || !adjacency.has(source) || !adjacency.has(target)) return [];
  const q = [source];
  const prev = new Map();
  const seen = new Set([source]);
  let found = false;
  while (q.length) {
    const u = q.shift();
    if (u === target) {
      found = true;
      break;
    }
    const neighbors = Array.from(adjacency.get(u) || []).sort();
    for (const v of neighbors) {
      if (!seen.has(v)) {
        seen.add(v);
        prev.set(v, u);
        q.push(v);
        if (v === target) {
          found = true;
          break;
        }
      }
    }
    if (found) break;
  }
  if (!found) return [];
  const path = [];
  let cur = target;
  while (cur !== undefined) {
    path.push(cur);
    if (cur === source) break;
    cur = prev.get(cur);
  }
  return path.reverse();
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
  for (const arr of groups.values()) {
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

  // Compute layer offsets for edge coloring (if pathFilter with edges provided)
  let layerOffsets = null;
  if (
    pathFilter &&
    pathFilter.edges &&
    pathFilter.edges.length > 0 &&
    pathFilter.source &&
    pathFilter.destination
  ) {
    const adjacency = buildAdjacencyFromEdges(pathFilter.edges);
    const distFromSource = bfsFrom(pathFilter.source, adjacency);
    const distToTarget = bfsFrom(pathFilter.destination, adjacency);
    const shortestPathLength = distFromSource.get(pathFilter.destination) || Infinity;
    if (Number.isFinite(shortestPathLength)) {
      layerOffsets = computeLayerOffset(distFromSource, distToTarget, shortestPathLength);
    }
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

    // Calculate edge color based on hop distance from source team
    let edgeColor = '#4562aa'; // Default blue
    if (pathFilter && pathFilter.source) {
      const adjacency = buildAdjacencyFromEdges(pathFilter.edges);
      const distFromSource = bfsFrom(pathFilter.source, adjacency);
      
      // Get hop distances for both endpoints
      const distA = distFromSource.get(a) || 0;
      const distB = distFromSource.get(b) || 0;
      
      // Edge color is based on the maximum hop distance of its endpoints
      // This means edges closer to the source are brighter (green), farther are darker (red)
      const maxHopDist = Math.max(distA, distB);
      edgeColor = DEGREE_COLORS[Math.min(maxHopDist, DEGREE_COLORS.length - 1)];
    }

    edges.set(k, { a, b, count: list.length, sumLev, avgLev, weight: w, edgeColor });
  }

  // Convert edges to Cytoscape format
  for (const [k, e] of edges) {
    // Format label to show count and average leverage
    const label = e.avgLev > 0 ? `${e.count} (lev: ${e.avgLev.toFixed(2)})` : `${e.count}`;
    
    els.push({
      group: 'edges',
      data: {
        id: 'e_' + k,
        source: e.a,
        target: e.b,
        label: label,
        weight: e.weight,
        avgLev: e.avgLev,
        edgeColor: e.edgeColor,
      },
    });
  }

  return els;
}

/**
 * Calculate node positions using strict shortest-path layering.
 * Implements plan from plan-dijkstra-layout.prompt.md.
 *
 * @param {Object} pathFilter - Path filter with nodesByDegree, source, destination, edges
 * @param {number} width - Canvas width (default: 800)
 * @param {number} height - Canvas height (default: 600)
 * @returns {Object} Map of nodeId to {x, y} position
 */
export function calculateDegreePositions(pathFilter, width = 800, height = 600) {
  const positions = {};
  const source = pathFilter.source;
  const destination = pathFilter.destination;
  const nodesByDegree = pathFilter.nodesByDegree || new Map();
  const nodeLabels = pathFilter.nodeLabels || {};
  const shortestPathNodes = pathFilter.shortestPathNodes || [];

  const centerY = height / 2;
  const adjacency = buildAdjacencyFromEdges(pathFilter.edges || []);

  // Use fallback for backward compatibility when:
  // 1. No edges provided, OR
  // 2. Edges are empty and shortestPathNodes are provided, OR
  // 3. BFS fails to find a path but shortestPathNodes are provided
  const hasEdges = pathFilter.edges && pathFilter.edges.length > 0;
  if (!hasEdges) {
    return calculateDegreePositionsFallback(pathFilter, width, height);
  }

  // Phase 1: Compute BFS distances from source and target
  const distFromSource = bfsFrom(source, adjacency);
  const distToTarget = bfsFrom(destination, adjacency);
  const shortestPathLength = distFromSource.get(destination) || Infinity;

  if (!Number.isFinite(shortestPathLength)) {
    // No path exists; use fallback if shortestPathNodes provided, else minimal layout
    if (shortestPathNodes.length > 0) {
      return calculateDegreePositionsFallback(pathFilter, width, height);
    }
    positions[source] = { x: SIDE_MARGIN, y: centerY };
    positions[destination] = { x: width - SIDE_MARGIN, y: centerY };
    return positions;
  }

  // Phase 2: Compute layer_offset for each node
  const layerOffsets = computeLayerOffset(distFromSource, distToTarget, shortestPathLength);

  // Extract shortest-path nodes (layer_offset == 0)
  const pathNodes = [];
  for (const [nid, off] of layerOffsets) {
    if (off === 0) pathNodes.push(nid);
  }
  
  // Group path nodes by distance from source (to identify parallel paths at same x-position)
  const nodesByDistance = new Map();
  for (const nid of pathNodes) {
    const dist = distFromSource.get(nid) || 0;
    if (!nodesByDistance.has(dist)) nodesByDistance.set(dist, []);
    nodesByDistance.get(dist).push(nid);
  }
  
  const pathNodeSet = new Set(pathNodes);

  // Phase 3: Assign axial positions with leverage-weighted spacing
  // Build edge leverage map for path edges
  const edgeLeverageMap = new Map();
  if (pathFilter.edges) {
    for (const edgeKey of pathFilter.edges) {
      edgeLeverageMap.set(edgeKey, 1); // default weight
    }
  }

  // If we have access to pairGames, use actual leverage for path edges
  if (pathFilter.pairGames && pathFilter.pairGames instanceof Map) {
    for (let i = 0; i < pathNodes.length - 1; i++) {
      const a = pathNodes[i];
      const b = pathNodes[i + 1];
      const key = a < b ? `${a}__${b}` : `${b}__${a}`;
      const games = pathFilter.pairGames.get(key) || [];
      const totalLev = games.reduce((sum, g) => sum + (g.leverage || 0), 0);
      const avgLev = games.length > 0 ? totalLev / games.length : 0;
      // Higher leverage = shorter distance (inverse relationship)
      // Weight range: [0.5, 2.0] where high leverage gets 0.5x spacing
      const weight = avgLev > 0 ? Math.max(0.5, Math.min(2.0, 1 / (1 + avgLev))) : 1.0;
      edgeLeverageMap.set(key, weight);
    }
  }

  // Position path nodes with leverage-weighted spacing and symmetric vertical layout
  const sortedDistances = Array.from(nodesByDistance.keys()).sort((a, b) => a - b);
  
  L(`[Layout] Positioning ${pathNodes.length} path nodes across ${sortedDistances.length} distance levels`);
  
  for (let distIdx = 0; distIdx < sortedDistances.length; distIdx++) {
    const dist = sortedDistances[distIdx];
    const nodesAtDist = nodesByDistance.get(dist);
    
    L(`[Layout] Distance ${dist}: ${nodesAtDist.length} nodes`);
    
    // Calculate x position for this distance level
    let xPos = dist * HORIZONTAL_SPACING;
    
    // Position nodes at this distance symmetrically around centerY
    if (nodesAtDist.length === 1) {
      positions[nodesAtDist[0]] = { x: xPos, y: centerY };
      L(`[Layout]   ${nodesAtDist[0]}: x=${xPos}, y=${centerY} (single node)`);
    } else {
      // Multiple nodes at same distance = parallel paths
      // Sort to minimize edge crossings by grouping connected paths together
      // Strategy: nodes that connect to the same neighbors should be close together
      
      // For nodes at this distance, find which nodes at previous/next distance they connect to
      const prevDist = dist - 1;
      const nextDist = dist + 1;
      const prevNodes = nodesByDistance.get(prevDist) || [];
      const nextNodes = nodesByDistance.get(nextDist) || [];
      
      // Score each node by which path it belongs to
      const pathScores = new Map();
      for (const nid of nodesAtDist) {
        const neighbors = Array.from(adjacency.get(nid) || []);
        let score = 0;
        
        // Check connections to previous distance level
        for (let i = 0; i < prevNodes.length; i++) {
          if (neighbors.includes(prevNodes[i])) {
            score += i * 100; // Weight by position at previous level
          }
        }
        
        // Check connections to next distance level  
        for (let i = 0; i < nextNodes.length; i++) {
          if (neighbors.includes(nextNodes[i])) {
            score += i * 100; // Weight by position at next level
          }
        }
        
        // Tie-breaker: alphabetical
        score += (nodeLabels[nid] || nid).toLowerCase().charCodeAt(0) / 1000;
        pathScores.set(nid, score);
      }
      
      // Sort by path score to keep related nodes together
      nodesAtDist.sort((a, b) => {
        return pathScores.get(a) - pathScores.get(b);
      });
      
      // Spread them symmetrically around centerY
      const spacing = VERTICAL_SPACING;
      const totalHeight = (nodesAtDist.length - 1) * spacing;
      const startY = centerY - totalHeight / 2;
      
      nodesAtDist.forEach((nid, idx) => {
        const y = startY + idx * spacing;
        positions[nid] = { x: xPos, y: y };
        L(`[Layout]   ${nid}: x=${xPos}, y=${y} (${idx + 1}/${nodesAtDist.length})`);
      });
    }
  }

  // Position non-path nodes based on layer_offset and connected path nodes
  for (const [nid, off] of layerOffsets) {
    if (off === 0) continue; // already positioned

    // Find which path node(s) this node connects to
    const neighbors = Array.from(adjacency.get(nid) || []);
    const connectedPathNodes = neighbors.filter(n => pathNodeSet.has(n));

    let baseX;
    if (connectedPathNodes.length > 0) {
      // Position based on average x of connected path nodes
      const avgX =
        connectedPathNodes.reduce((sum, pn) => sum + positions[pn].x, 0) /
        connectedPathNodes.length;
      baseX = avgX;
    } else {
      // Fallback: use BFS distance
      const dS = distFromSource.get(nid) || 0;
      baseX = dS * HORIZONTAL_SPACING;
    }

    const baseY = centerY + off * VERTICAL_SPACING;
    positions[nid] = { x: baseX, y: baseY };
  }

  // Phase 4: Light multi-anchor refinement for smoother positioning
  // Only apply to nodes with multiple path connections
  for (const [nid, off] of layerOffsets) {
    if (off === 0) continue; // skip path nodes
    const pos = positions[nid];
    if (!pos) continue;

    const neighbors = Array.from(adjacency.get(nid) || []);
    const connectedPathNodes = neighbors.filter(n => pathNodeSet.has(n));

    // Only refine if node connects to 2+ path nodes (for smoothing)
    if (connectedPathNodes.length >= 2) {
      const anchorXs = connectedPathNodes.map(a => positions[a].x);
      const avgX = anchorXs.reduce((s, v) => s + v, 0) / anchorXs.length;
      const xAdjust = avgX - pos.x;
      pos.x = pos.x + LAMBDA * xAdjust; // apply small lambda adjustment
    }
  }

  // Phase 5: Per-layer stacking with perpendicular offset for nodes at same x
  const layerGroups = new Map();
  for (const [nid, off] of layerOffsets) {
    if (!layerGroups.has(off)) layerGroups.set(off, []);
    layerGroups.get(off).push(nid);
  }

  for (const [off, nodes] of layerGroups) {
    if (off === 0) continue; // path nodes stay on centerY

    // Group nodes by x-position to handle overlaps
    const byX = new Map();
    for (const nid of nodes) {
      const x = Math.round(positions[nid].x);
      if (!byX.has(x)) byX.set(x, []);
      byX.get(x).push(nid);
    }

    // For each x-group, apply radial spacing
    for (const nodesAtX of byX.values()) {
      // Sort by degree desc, then by id/label
      nodesAtX.sort((a, b) => {
        const da = nodesByDegree.get(a) || 0;
        const db = nodesByDegree.get(b) || 0;
        if (da !== db) return db - da;
        const la = (nodeLabels[a] || a).toLowerCase();
        const lb = (nodeLabels[b] || b).toLowerCase();
        return la < lb ? -1 : la > lb ? 1 : 0;
      });

      // Apply alternating above/below with first node above
      nodesAtX.forEach((nid, idx) => {
        const rank = idx;
        // First node above (negative y), then alternate
        const side = rank % 2 === 0 ? -1 : 1;
        // Increase spacing: rank 0→1×spacing, rank 1→1×spacing (other side), rank 2→2×spacing, etc
        const spacingMultiplier = Math.floor(rank / 2) + 1;
        // Use MIN_Y * 2 for more aggressive spacing to avoid overlaps
        const yOff = side * spacingMultiplier * MIN_Y * 2.0;
        positions[nid].y += yOff;
      });
    }
  }

  // Phase 6: Collision sweep (deterministic, respects fixed path nodes)
  // Run multiple passes to ensure all overlaps are resolved
  applyCollisionSweep(positions, X_THRESHOLD, MIN_Y, nodesByDegree, pathNodeSet);
  applyCollisionSweep(positions, X_THRESHOLD, MIN_Y, nodesByDegree, pathNodeSet);
  applyCollisionSweep(positions, X_THRESHOLD, MIN_Y, nodesByDegree, pathNodeSet);

  // Re-center single path nodes on exact centerY, but preserve symmetric positioning
  // for nodes that were spread vertically (multiple nodes at same distance)
  for (const nid of pathNodes) {
    if (positions[nid]) {
      const dist = distFromSource.get(nid) || 0;
      const nodesAtDist = nodesByDistance.get(dist);
      // Only re-center if this was the only node at this distance
      if (nodesAtDist && nodesAtDist.length === 1) {
        positions[nid].y = centerY;
      }
      // Otherwise keep the symmetric y-position that was set earlier
    }
  }

  return positions;
}

/**
 * Fallback positioning for tests that don't provide edges.
 * Uses shortestPathNodes for the straight line and places degree-based nodes around it.
 */
function calculateDegreePositionsFallback(pathFilter, width, height) {
  const positions = {};
  const nodesByDegree = pathFilter.nodesByDegree || new Map();
  const source = pathFilter.source;
  const destination = pathFilter.destination;
  const shortestPathNodes = pathFilter.shortestPathNodes || [];
  const nodeLabels = pathFilter.nodeLabels || {};
  const centerY = height / 2;
  const sourceX = SIDE_MARGIN;
  const destX = width - SIDE_MARGIN;

  positions[source] = { x: sourceX, y: centerY };
  positions[destination] = { x: destX, y: centerY };

  // Place shortest-path nodes on center line
  if (shortestPathNodes.length > 0) {
    const count = shortestPathNodes.length;
    const pathSpacing = count > 1 ? (destX - sourceX) / (count - 1) : (destX - sourceX) / 2;
    for (let i = 0; i < shortestPathNodes.length; i++) {
      const nid = shortestPathNodes[i];
      const x = sourceX + pathSpacing * i;
      positions[nid] = { x, y: centerY };
    }
  }

  // Group nodes by degree
  const degreeGroups = new Map();
  for (const [nodeId, degree] of nodesByDegree) {
    if (!degreeGroups.has(degree)) degreeGroups.set(degree, []);
    degreeGroups.get(degree).push(nodeId);
  }

  const maxDegree = nodesByDegree.size > 0 ? Math.max(...nodesByDegree.values()) : 0;

  function sortByLabel(ids) {
    return ids.slice().sort((a, b) => {
      const A = (nodeLabels[a] || a).toLowerCase();
      const B = (nodeLabels[b] || b).toLowerCase();
      return A < B ? -1 : A > B ? 1 : 0;
    });
  }

  for (let degree = 1; degree <= maxDegree; degree++) {
    let nodesAtDegree = (degreeGroups.get(degree) || []).filter(
      id => id !== source && id !== destination && !positions[id]
    );
    if (nodesAtDegree.length === 0) continue;
    nodesAtDegree = sortByLabel(nodesAtDegree);

    // Place degree-1 nodes between source and first path node if available
    if (degree === 1 && shortestPathNodes.length > 1) {
      const firstPathNode = shortestPathNodes[1];
      const anchorPos = positions[firstPathNode];
      if (anchorPos && typeof anchorPos.x === 'number' && anchorPos.x !== positions[source].x) {
        // Use MIDPOINT_FRACTION (configurable via URL/localStorage) instead of a hardcoded 0.5
        const midX = positions[source].x + (anchorPos.x - positions[source].x) * MIDPOINT_FRACTION;
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

    // Default: place nodes at degree-based x spacing
    const horizontalSpacing =
      maxDegree > 0 ? (destX - sourceX) / (maxDegree + 1) : (destX - sourceX) / 2;
    const x = sourceX + horizontalSpacing * degree;
    const stepY = Math.max(BASE_SPACING, Math.min(DEGREE_MAX_STEP, height * DEGREE_HEIGHT_FRAC));
    const half = Math.ceil(nodesAtDegree.length / 2);
    const upper = nodesAtDegree.slice(0, half);
    const lower = nodesAtDegree.slice(half);
    upper.forEach((nid, idx) => {
      positions[nid] = { x, y: centerY - (idx + 1) * stepY };
    });
    lower.forEach((nid, idx) => {
      positions[nid] = { x, y: centerY + (idx + 1) * stepY };
    });
  }

  return positions;
}

/**
 * Deterministic collision-avoidance sweep helper.
 * Moves non-fixed nodes to enforce minimum vertical separation.
 */
function applyCollisionSweep(
  positionsMap,
  xThreshold,
  minY,
  nodesByDegreeMap,
  fixedIds = new Set()
) {
  const items = Object.keys(positionsMap).map(id => {
    const p = positionsMap[id];
    return { id, x: p.x, y: p.y, rank: nodesByDegreeMap.get(id) || 0 };
  });

  // Sort by x position first, then by rank (higher degree first), then by id
  items.sort((a, b) => {
    if (Math.abs(a.x - b.x) > 1) return a.x - b.x;
    if (a.rank !== b.rank) return b.rank - a.rank; // higher rank first
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  for (let i = 0; i < items.length; i++) {
    const a = items[i];
    if (fixedIds.has(a.id)) continue; // never move fixed nodes

    for (let j = i + 1; j < items.length; j++) {
      const b = items[j];
      const dx = Math.abs(b.x - a.x);
      if (dx >= xThreshold) break;

      const dy = Math.abs(b.y - a.y);
      if (dy < minY) {
        if (fixedIds.has(b.id)) {
          // b is fixed, move a away from b
          const sign = a.y < b.y ? -1 : 1;
          a.y = b.y + sign * minY;
        } else {
          // neither fixed, or only a is fixed - move b
          const sign = b.y < a.y ? -1 : 1;
          b.y = a.y + sign * minY;
        }
      }
    }
  }

  for (const it of items) {
    positionsMap[it.id] = { x: it.x, y: it.y };
  }
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
