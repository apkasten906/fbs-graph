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
 * Enumerate all simple A->Z paths up to maxDegrees and build a stable comparison model.
 */
export function findNodesWithinDegrees(startNodes, maxDegrees, pairGames, teams, typeFilter, minLev) {
  const source = startNodes[0];
  const dest = startNodes[1];

  const adj = buildAdjacencyList(pairGames, typeFilter, minLev);

  const shortest = shortestPathByInverseLeverage(source, dest, pairGames, teams, typeFilter, minLev);
  if (!shortest || !shortest.nodes || shortest.nodes.length === 0) {
    return emptyModel(source, dest, maxDegrees, teams);
  }

  const paths = [];
  const stack = [[source, [source]]];
  while (stack.length) {
    const [node, path] = stack.pop();
    const hops = path.length - 1;
    if (hops > maxDegrees) continue;
    if (node === dest) {
      paths.push({ nodes: path.slice(), edges: pathToEdges(path), length: hops });
      continue;
    }
    const neighbors = (adj.get(node) || [])
      .map(e => e.to)
      .filter(n => !path.includes(n));
    for (const n of neighbors) {
      stack.push([n, path.concat(n)]);
    }
  }

  if (paths.length === 0) {
    return emptyModel(source, dest, maxDegrees, teams);
  }

  const nodeDepths = new Map();
  const edges = new Set();
  const edgeMaxPath = new Map();

  for (const p of paths) {
    p.edges.forEach(k => {
      edges.add(k);
      const prev = edgeMaxPath.get(k) || 0;
      edgeMaxPath.set(k, Math.max(prev, p.length));
    });
    p.nodes.forEach((nid, idx) => {
      const set = nodeDepths.get(nid) || new Set();
      set.add(idx);
      nodeDepths.set(nid, set);
    });
  }

  const degreeByNode = new Map();
  for (const [nid, depths] of nodeDepths) {
    const minDepth = Math.min(...depths);
    const hasMultiLayer = depths.size > 1;
    const deg = hasMultiLayer ? minDepth + 0.5 : minDepth;
    degreeByNode.set(nid, deg);
  }

  const distToZ = bfsDistance(dest, edges);

  const fanOut = new Map();
  for (const k of edges) {
    const [a, b] = k.split('__');
    const da = degreeByNode.get(a) ?? Infinity;
    const db = degreeByNode.get(b) ?? Infinity;
    if (da < db) fanOut.set(a, (fanOut.get(a) || 0) + 1);
    else if (db < da) fanOut.set(b, (fanOut.get(b) || 0) + 1);
  }

  return {
    nodes: Array.from(nodeDepths.keys()),
    edges: Array.from(edges),
    degreeByNode,
    distToZ,
    edgeMaxPath,
    fanOut,
    paths,
    source,
    destination: dest,
    maxDegree: maxDegrees,
    shortestPath: shortest,
    nodeLabels: Object.fromEntries(teams.map(t => [t.id, t.name])),
  };
}

function pathToEdges(nodes) {
  const keys = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    keys.push(edgeKey(nodes[i], nodes[i + 1]));
  }
  return keys;
}

function bfsDistance(start, edgeList) {
  const adj = new Map();
  for (const k of edgeList) {
    const [a, b] = k.split('__');
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a).add(b);
    adj.get(b).add(a);
  }
  const dist = new Map();
  const q = [start];
  dist.set(start, 0);
  while (q.length) {
    const u = q.shift();
    const d = dist.get(u);
    for (const v of adj.get(u) || []) {
      if (!dist.has(v)) {
        dist.set(v, d + 1);
        q.push(v);
      }
    }
  }
  return dist;
}

function emptyModel(source, dest, maxDegrees, teams) {
  return {
    nodes: [],
    edges: [],
    degreeByNode: new Map(),
    distToZ: new Map(),
    edgeMaxPath: new Map(),
    fanOut: new Map(),
    paths: [],
    source,
    destination: dest,
    maxDegree: maxDegrees,
    shortestPath: null,
    nodeLabels: Object.fromEntries(teams.map(t => [t.id, t.name])),
  };
}
