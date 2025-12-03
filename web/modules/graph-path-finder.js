/**
 * Path Finding Algorithms for Graph Visualization
 *
 * This module provides reusable graph algorithms for finding paths
 * between teams based on game connections and leverage scores.
 *
 * Note: This is separate from path-finder.js which is used by the timeline explorer.
 * This module uses inverse-leverage weighting for Cytoscape visualization.
 */

/**
 * Create a consistent edge key from two team IDs
 * @param {string} a - First team ID
 * @param {string} b - Second team ID
 * @returns {string} Consistent key regardless of order (alphabetically sorted)
 */
export function edgeKey(a, b) {
  return a < b ? `${a}__${b}` : `${b}__${a}`;
}

/**
 * Build an adjacency list from game pair data
 * @param {Map<string, Array>} pairGames - Map of edge keys to game arrays
 * @param {string} typeFilter - 'ALL', 'CONFERENCE', or 'NON_CONFERENCE'
 * @param {number} minLev - Minimum leverage threshold
 * @returns {Map<string, Array>} Adjacency list with weighted edges
 */
export function buildAdjacencyList(pairGames, typeFilter, minLev) {
  const adj = new Map();

  for (const [k, list] of pairGames) {
    const a = list[0].home.id;
    const b = list[0].away.id;

    const filtered = list.filter(
      g => (typeFilter === 'ALL' || g.type === typeFilter) && (g.leverage || 0) >= minLev
    );

    if (!filtered.length) continue;

    const avg = filtered.reduce((s, x) => s + (x.leverage || 0), 0) / filtered.length;
    const w = 1 / Math.max(1e-6, avg); // Weight = inverse of average leverage

    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);

    adj.get(a).push({ to: b, k, w, avg, games: filtered });
    adj.get(b).push({ to: a, k, w, avg, games: filtered });
  }

  return adj;
}

/**
 * Find shortest path between two teams using Dijkstra's algorithm
 * Path weight is based on inverse leverage (higher leverage = shorter distance)
 *
 * @param {string} srcId - Source team ID
 * @param {string} dstId - Destination team ID
 * @param {Map<string, Array>} pairGames - Map of edge keys to game arrays
 * @param {Array} teams - Array of all team objects
 * @param {string} typeFilter - 'ALL', 'CONFERENCE', or 'NON_CONFERENCE'
 * @param {number} minLev - Minimum leverage threshold
 * @returns {{nodes: string[], edges: string[]} | null} Path or null if none exists
 */
export function shortestPathByInverseLeverage(srcId, dstId, pairGames, teams, typeFilter, minLev) {
  const adj = buildAdjacencyList(pairGames, typeFilter, minLev);

  // Dijkstra's algorithm
  const dist = new Map();
  const prev = new Map();
  const prevEdge = new Map();

  const allIds = Array.from(teams, t => t.id);
  const Q = new Set(allIds);

  for (const id of allIds) {
    dist.set(id, Infinity);
  }
  dist.set(srcId, 0);

  while (Q.size) {
    let u = null;
    let best = Infinity;

    for (const v of Q) {
      const d = dist.get(v);
      if (d < best) {
        best = d;
        u = v;
      }
    }

    if (u === null || best === Infinity) break;
    Q.delete(u);

    if (u === dstId) break;

    const nbrs = adj.get(u) || [];
    for (const e of nbrs) {
      if (!Q.has(e.to)) continue;

      const alt = dist.get(u) + e.w;
      if (alt < dist.get(e.to)) {
        dist.set(e.to, alt);
        prev.set(e.to, u);
        prevEdge.set(e.to, e.k);
      }
    }
  }

  if (!prev.has(dstId)) return null;

  // Rebuild path
  const pathIds = [];
  const edges = [];
  let cur = dstId;

  while (cur !== srcId) {
    pathIds.push(cur);
    edges.push(prevEdge.get(cur));
    cur = prev.get(cur);
  }
  pathIds.push(srcId);
  pathIds.reverse();
  edges.reverse();

  return { nodes: pathIds, edges };
}

/**
 * Find all nodes within N degrees of separation from two teams
 *
 * @param {string[]} startNodes - Array of exactly 2 team IDs [source, destination]
 * @param {number} maxDegrees - Maximum degrees of separation to include
 * @param {Map<string, Array>} pairGames - Map of edge keys to game arrays
 * @param {Array} teams - Array of all team objects
 * @param {string} typeFilter - 'ALL', 'CONFERENCE', or 'NON_CONFERENCE'
 * @param {number} minLev - Minimum leverage threshold
 * @param {{nodes: string[], edges: string[]} | null} shortestPath - Optional shortest path to ensure inclusion
 * @returns {{nodes: string[], edges: string[], nodesByDegree: Map, source: string, destination: string}}
 */
export function findNodesWithinDegrees(
  startNodes,
  maxDegrees,
  pairGames,
  teams,
  typeFilter,
  minLev,
  shortestPath = null
) {
  const source = startNodes[0];
  const dest = startNodes[1];

  const adj = buildAdjacencyList(pairGames, typeFilter, minLev);

  // Strategy: maxDegrees represents the maximum path length (hops) between source and dest
  // First check if the shortest path is within the degree limit
  const nodesByDegree = new Map();
  const validEdges = new Set();
  const validNodes = new Set();

  // Step 1: Run BFS from source to compute distance_from_source
  const distFromSource = new Map();
  const queueSource = [source];
  distFromSource.set(source, 0);
  let idx = 0;

  while (idx < queueSource.length) {
    const curr = queueSource[idx++];
    const dist = distFromSource.get(curr);
    const neighbors = (adj.get(curr) || []).map(e => e.to);

    for (const neighbor of neighbors) {
      if (!distFromSource.has(neighbor)) {
        distFromSource.set(neighbor, dist + 1);
        queueSource.push(neighbor);
      }
    }
  }

  // Step 2: Run BFS from dest to compute distance_to_target
  const distToTarget = new Map();
  const queueDest = [dest];
  distToTarget.set(dest, 0);
  idx = 0;

  while (idx < queueDest.length) {
    const curr = queueDest[idx++];
    const dist = distToTarget.get(curr);
    const neighbors = (adj.get(curr) || []).map(e => e.to);

    for (const neighbor of neighbors) {
      if (!distToTarget.has(neighbor)) {
        distToTarget.set(neighbor, dist + 1);
        queueDest.push(neighbor);
      }
    }
  }

  // Step 3: Compute shortest path length
  const shortestPathLength = distFromSource.get(dest);

  if (shortestPathLength === undefined) {
    // No path exists
    return {
      nodes: [],
      edges: [],
      nodesByDegree: new Map(),
      source,
      destination: dest,
      shortestPathNodes: [],
      nodeLabels: Object.fromEntries(teams.map(t => [t.id, t.name])),
    };
  }

  // Check if shortest path exceeds maxDegrees
  if (shortestPathLength > maxDegrees) {
    // Path is too long for the degree filter
    return {
      nodes: [],
      edges: [],
      nodesByDegree: new Map(),
      source,
      destination: dest,
      shortestPathNodes: [],
      nodeLabels: Object.fromEntries(teams.map(t => [t.id, t.name])),
    };
  }

  // Step 4: Include only nodes that lie on paths of length <= maxDegrees
  // A node is on such a path if: distance_from_source + distance_to_target <= maxDegrees
  const allReachableNodes = new Set([...distFromSource.keys()].filter(n => distToTarget.has(n)));

  for (const node of allReachableNodes) {
    const dfs = distFromSource.get(node);
    const dtt = distToTarget.get(node);
    const pathLengthThroughNode = dfs + dtt;

    // Only include nodes that are on paths of length <= maxDegrees
    if (pathLengthThroughNode <= maxDegrees) {
      validNodes.add(node);
      // Use layer_offset for rendering purposes (distance from shortest path)
      const layerOffset = pathLengthThroughNode - shortestPathLength;
      nodesByDegree.set(node, layerOffset);
    }
  }

  // Step 5: Add all edges between valid nodes
  for (const node of validNodes) {
    const neighbors = (adj.get(node) || []).map(e => e.to);

    for (const neighbor of neighbors) {
      if (validNodes.has(neighbor)) {
        validEdges.add(edgeKey(node, neighbor));
      }
    }
  }

  return {
    nodes: Array.from(validNodes),
    edges: Array.from(validEdges),
    nodesByDegree,
    source,
    destination: dest,
    // expose which nodes came from the provided shortestPath (if any)
    shortestPathNodes: shortestPath && shortestPath.nodes ? shortestPath.nodes : [],
    // provide id->name lookup so layout can sort alphabetically
    nodeLabels: Object.fromEntries(teams.map(t => [t.id, t.name])),
  };
}
