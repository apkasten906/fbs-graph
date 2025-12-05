/**
 * Path Finding Algorithms for Graph Visualization
 *
 * Refactored + corrected version (no nested functions):
 * - Proper A→B comparison-graph construction (“Option A”)
 * - Hop-adjacent edge filtering to ensure a layered DAG
 * - All helpers are top-level (no functions defined inside other functions)
 * - Compatible with Sugiyama layered layout and existing imports
 */

/* ------------------------------------------------------------------------- */
/*  UTIL: canonical edge key                                                 */
/* ------------------------------------------------------------------------- */
export function edgeKey(a, b) {
  return a < b ? `${a}__${b}` : `${b}__${a}`;
}

/* ------------------------------------------------------------------------- */
/*  BUILD ADJACENCY LIST (FOR SHORTEST PATH / DFS ENUMERATION)               */
/* ------------------------------------------------------------------------- */
/**
 * Build an adjacency list from pairGames, filtered by type and leverage.
 * Each entry: id -> [{ to, k, w, avg, games }, ...]
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

    const avgLev = filtered.reduce((s, x) => s + (x.leverage || 0), 0) / filtered.length;
    const w = 1 / Math.max(1e-6, avgLev); // inverse leverage weight

    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);

    adj.get(a).push({ to: b, k, w, avg: avgLev, games: filtered });
    adj.get(b).push({ to: a, k, w, avg: avgLev, games: filtered });
  }

  return adj;
}

/* ------------------------------------------------------------------------- */
/*  DIJKSTRA SHORTEST PATH                                                   */
/* ------------------------------------------------------------------------- */
/**
 * Find shortest path by inverse leverage (higher leverage = shorter distance).
 * Returns { nodes: string[], edges: string[] } or null.
 */
export function shortestPathByInverseLeverage(srcId, dstId, pairGames, teams, typeFilter, minLev) {
  const adj = buildAdjacencyList(pairGames, typeFilter, minLev);

  const dist = new Map();
  const prev = new Map();
  const prevEdge = new Map();

  const allIds = teams.map(t => t.id);
  const Q = new Set(allIds);

  for (const id of allIds) dist.set(id, Infinity);
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

    if (!u || best === Infinity) break;
    Q.delete(u);
    if (u === dstId) break;

    const neighbors = adj.get(u) || [];
    for (const e of neighbors) {
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

  const pathIds = [];
  const edges = [];
  let cur = dstId;

  while (cur !== srcId) {
    pathIds.push(cur);
    edges.push(prevEdge.get(cur));
    cur = prev.get(cur);
  }
  pathIds.push(srcId);

  return {
    nodes: pathIds.reverse(),
    edges: edges.reverse(),
  };
}

/* ------------------------------------------------------------------------- */
/*  PUBLIC: FIND NODES WITHIN DEGREES (“OPTION A” COMPARISON GRAPH)          */
/* ------------------------------------------------------------------------- */
/**
 * Build comparison graph: all nodes/edges on ANY A→B path of length <= maxDegrees,
 * with edges restricted to hop-adjacent layers (layered DAG).
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
  const destination = startNodes[1];

  const nodeLabels = buildNodeLabelsFromTeams(teams);
  const adj = buildAdjacencyList(pairGames, typeFilter, minLev);

  if (!adj.has(source) || !adj.has(destination)) {
    return emptyResult(source, destination, nodeLabels);
  }

  // 1) Enumerate all simple A→B paths up to maxDegrees
  const { validNodes, validEdges } = enumeratePathsWithinDegrees(
    adj,
    source,
    destination,
    maxDegrees
  );

  if (!validNodes.size) {
    return emptyResult(source, destination, nodeLabels);
  }

  // 2) Keep only schedule edges that exist in pairGames
  const scheduleEdges = Array.from(validEdges).filter(k => pairGames.has(k));

  // 3) Build filtered adjacency for hop computation
  const filteredAdj = buildFilteredAdjacencyFromEdges(validNodes, scheduleEdges);

  // 4) Compute hop degrees from source (for nodesByDegree metadata)
  const nodesByDegree = bfsComputeDegrees(source, filteredAdj, maxDegrees);
  // 5) Return comparison graph
  return {
    nodes: Array.from(validNodes),
    edges: scheduleEdges, // Return ALL edges from enumerated paths
    nodesByDegree,
    source,
    destination,
    shortestPathNodes: shortestPath?.nodes || [],
    nodeLabels,
  };
}

/* ------------------------------------------------------------------------- */
/*  HELPERS (TOP-LEVEL, NO NESTING)                                          */
/* ------------------------------------------------------------------------- */

/**
 * Build a map from team.id to team.name.
 */
function buildNodeLabelsFromTeams(teams) {
  return Object.fromEntries(teams.map(t => [t.id, t.name]));
}

/**
 * Enumerate all simple paths from source to destination with length <= maxDegrees.
 * Returns { validNodes: Set<string>, validEdges: Set<string> }.
 * Implemented iteratively (no nested dfs function).
 */
function enumeratePathsWithinDegrees(adj, source, destination, maxDegrees) {
  const validNodes = new Set();
  const validEdges = new Set();

  // Stack entries: { current, depth, path }
  const stack = [{ current: source, depth: 0, path: [source] }];

  while (stack.length > 0) {
    const frame = stack.pop();
    const { current, depth, path } = frame;

    if (depth > maxDegrees) continue;

    if (current === destination) {
      // Mark all nodes and edges on this path
      for (let i = 0; i < path.length; i++) {
        validNodes.add(path[i]);
      }
      for (let i = 0; i < path.length - 1; i++) {
        const a = path[i];
        const b = path[i + 1];
        validEdges.add(`${a}__${b}`);
        validEdges.add(`${b}__${a}`);
      }
      continue;
    }

    const neighbors = adj.get(current) || [];
    for (const e of neighbors) {
      const n = e.to;
      if (path.includes(n)) continue; // avoid cycles
      const nextPath = path.concat(n);
      stack.push({
        current: n,
        depth: depth + 1,
        path: nextPath,
      });
    }
  }

  return { validNodes, validEdges };
}

/**
 * Build adjacency from a set of nodes and a list of edges (keys "a__b").
 */
function buildFilteredAdjacencyFromEdges(validNodes, edges) {
  const filteredAdj = new Map();
  for (const id of validNodes) filteredAdj.set(id, []);

  for (const k of edges) {
    const [a, b] = k.split('__');
    if (filteredAdj.has(a)) filteredAdj.get(a).push(b);
    if (filteredAdj.has(b)) filteredAdj.get(b).push(a);
  }

  return filteredAdj;
}

/**
 * BFS to compute hop-based degrees (distance from source) in the filtered subgraph.
 */
function bfsComputeDegrees(source, adj, maxDegrees) {
  const dist = new Map();
  if (!adj.has(source)) return dist;

  dist.set(source, 0);
  const queue = [source];

  while (queue.length > 0) {
    const cur = queue.shift();
    const d = dist.get(cur);

    const neighbors = adj.get(cur) || [];
    for (const nxt of neighbors) {
      if (!dist.has(nxt)) {
        const nd = d + 1;
        if (nd <= maxDegrees + 1) {
          dist.set(nxt, nd);
          queue.push(nxt);
        }
      }
    }
  }

  return dist;
}

/**
 * Build an empty comparison result object.
 */
function emptyResult(source, destination, nodeLabels) {
  return {
    nodes: [],
    edges: [],
    nodesByDegree: new Map(),
    source,
    destination,
    shortestPathNodes: [],
    nodeLabels,
  };
}
