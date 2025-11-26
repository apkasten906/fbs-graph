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

  // Special case: degree 0 means direct matchup only
  if (maxDegrees === 0) {
    const directKey = edgeKey(source, dest);
    if (pairGames.has(directKey)) {
      return {
        nodes: [source, dest],
        edges: [directKey],
        nodesByDegree: new Map([
          [source, 0],
          [dest, 0],
        ]),
        source,
        destination: dest,
      };
    }
    return {
      nodes: [],
      edges: [],
      nodesByDegree: new Map(),
      source,
      destination: dest,
    };
  }

  // Build valid paths layer by layer
  const nodesByDegree = new Map();
  const validEdges = new Set();
  const validNodes = new Set([source, dest]);

  nodesByDegree.set(source, 0);
  nodesByDegree.set(dest, 0);

  // If we have a shortest path, ensure all its nodes and edges are included
  if (shortestPath && shortestPath.nodes && shortestPath.edges) {
    for (let i = 0; i < shortestPath.nodes.length; i++) {
      const nodeId = shortestPath.nodes[i];
      validNodes.add(nodeId);

      // Assign degree based on distance from source
      if (!nodesByDegree.has(nodeId)) {
        nodesByDegree.set(nodeId, i);
      }
    }

    for (const edgeKey of shortestPath.edges) {
      validEdges.add(edgeKey);
    }
  }

  // Find direct connection if it exists
  const directKey = edgeKey(source, dest);
  if (pairGames.has(directKey)) {
    validEdges.add(directKey);
  }

  // Layer 1: Find common opponents (teams that played both source and dest)
  const sourceNeighbors = new Set((adj.get(source) || []).map(e => e.to));
  const destNeighbors = new Set((adj.get(dest) || []).map(e => e.to));

  for (const node of sourceNeighbors) {
    if (destNeighbors.has(node)) {
      // This is a common opponent
      validNodes.add(node);
      nodesByDegree.set(node, 1);
      validEdges.add(edgeKey(source, node));
      validEdges.add(edgeKey(dest, node));
    }
  }

  // Layer 2 and beyond: Find teams that bridge between layer 1 teams and source/dest
  if (maxDegrees >= 2) {
    const degree1Teams = Array.from(validNodes).filter(n => nodesByDegree.get(n) === 1);

    for (const team1 of degree1Teams) {
      const neighbors = (adj.get(team1) || []).map(e => e.to);

      for (const neighbor of neighbors) {
        if (validNodes.has(neighbor)) continue; // Already included

        const neighborNeighbors = new Set((adj.get(neighbor) || []).map(e => e.to));

        if (neighborNeighbors.has(source) || neighborNeighbors.has(dest)) {
          validNodes.add(neighbor);
          nodesByDegree.set(neighbor, 2);
          validEdges.add(edgeKey(team1, neighbor));

          if (neighborNeighbors.has(source)) {
            validEdges.add(edgeKey(neighbor, source));
          }
          if (neighborNeighbors.has(dest)) {
            validEdges.add(edgeKey(neighbor, dest));
          }
        }
      }
    }
  }

  return {
    nodes: Array.from(validNodes),
    edges: Array.from(validEdges),
    nodesByDegree,
    source,
    destination: dest,
  };
}
