// ChatGPT 5.1
// web/modules/layout/sugiyama-degree-layout.js
//
// Sugiyama-style layered layout for FBS comparison graphs.
//
// Assumes pathFilter already contains only nodes & edges that lie on
// some A→B path with hop-count <= degree slider (“Option A” semantics).

export function computeSugiyamaDegreeLayout(pathFilter, width = 800, height = 600) {
  if (!pathFilter || !pathFilter.nodes || !pathFilter.edges) {
    return {};
  }

  const { nodes, edges, source, destination, nodeLabels = {} } = pathFilter;

  // ---------------------------------------------------------------------------
  // Build adjacency
  // ---------------------------------------------------------------------------
  const adjacency = new Map();
  for (const id of nodes) adjacency.set(id, new Set());

  for (const edgeKey of edges) {
    const [a, b] = edgeKey.split('__');
    if (!a || !b) continue;
    if (adjacency.has(a)) adjacency.get(a).add(b);
    if (adjacency.has(b)) adjacency.get(b).add(a);
  }

  // ---------------------------------------------------------------------------
  // BFS helper (optionally restricted to a node set)
  // ---------------------------------------------------------------------------
  function bfs(startId, allowed = null) {
    const dist = {};
    if (!startId || !adjacency.has(startId)) return dist;

    const queue = [startId];
    dist[startId] = 0;
    let head = 0;

    while (head < queue.length) {
      const cur = queue[head++];
      const base = dist[cur];
      const neigh = adjacency.get(cur) || new Set();

      for (const n of neigh) {
        if (allowed && !allowed.has(n)) continue;
        if (dist[n] != null) continue;
        dist[n] = base + 1;
        queue.push(n);
      }
    }
    return dist;
  }

  // ---------------------------------------------------------------------------
  // Restrict to nodes reachable from BOTH source and destination
  // (safety: in theory pathFilter already did this, but this keeps layout robust)
  // ---------------------------------------------------------------------------
  const distFromAAll = bfs(source);
  const distToZAll = bfs(destination);

  const validNodes = new Set(
    nodes.filter(id => distFromAAll[id] != null && distToZAll[id] != null)
  );

  if (!validNodes.size) {
    const cy = height / 2;
    const positions = {};
    if (source) positions[source] = { x: 50, y: cy };
    if (destination) positions[destination] = { x: width - 50, y: cy };
    pathFilter.edgeHopDegree = {};
    return positions;
  }

  // Rebuild adjacency restricted to validNodes
  const filteredAdj = new Map();
  for (const id of validNodes) filteredAdj.set(id, new Set());
  for (const edgeKey of edges) {
    const [a, b] = edgeKey.split('__');
    if (validNodes.has(a) && validNodes.has(b)) {
      filteredAdj.get(a).add(b);
      filteredAdj.get(b).add(a);
    }
  }
  adjacency.clear();
  for (const [id, neigh] of filteredAdj) adjacency.set(id, neigh);

  // Distances on restricted graph
  const distanceFromA = bfs(source, validNodes);
  const distanceToZ = bfs(destination, validNodes);

  // ---------------------------------------------------------------------------
  // Layers: degree = hop distance from source
  // ---------------------------------------------------------------------------
  const nodeDegrees = {};
  let maxDegree = 0;
  for (const id of validNodes) {
    const d = distanceFromA[id];
    if (typeof d === 'number') {
      nodeDegrees[id] = d;
      if (d > maxDegree) maxDegree = d;
    }
  }

  if (maxDegree === 0) {
    const cy = height / 2;
    const positions = {};
    if (source) positions[source] = { x: 50, y: cy };
    if (destination) positions[destination] = { x: width - 50, y: cy };
    pathFilter.edgeHopDegree = {};
    return positions;
  }

  const degreeGroups = new Map();
  for (const id of validNodes) {
    const d = nodeDegrees[id];
    if (!degreeGroups.has(d)) degreeGroups.set(d, []);
    degreeGroups.get(d).push(id);
  }

  const centerY = height / 2;
  const leftX = 50;
  const rightX = width - 50;
  const spanX = rightX - leftX;
  const verticalSpacing = Math.max(40, Math.min(80, height * 0.12));

  // ---------------------------------------------------------------------------
  // Precompute "ideal" Y per layer (alphabetical order), used when we don’t
  // yet have concrete positions for neighbors (child side of the median).
  // ---------------------------------------------------------------------------
  const idealY = {};
  for (let d = 0; d <= maxDegree; d++) {
    const group = degreeGroups.get(d);
    if (!group || !group.length) continue;
    const sorted = group.slice().sort((a, b) => {
      const la = (nodeLabels[a] || a).toLowerCase();
      const lb = (nodeLabels[b] || b).toLowerCase();
      return la.localeCompare(lb);
    });
    const n = sorted.length;
    for (let i = 0; i < n; i++) {
      const offsetIndex = i - (n - 1) / 2;
      idealY[sorted[i]] = centerY + offsetIndex * verticalSpacing;
    }
  }

  // ---------------------------------------------------------------------------
  // Fan-out and barycenter (parents + children)
  // ---------------------------------------------------------------------------
  function countFanOut(id) {
    const neighbors = adjacency.get(id) || new Set();
    const deg = nodeDegrees[id];
    let count = 0;
    for (const n of neighbors) {
      const nd = nodeDegrees[n];
      if (typeof nd === 'number' && nd !== deg) count++;
    }
    return count;
  }

  const barycenter = {};
  for (const id of validNodes) {
    const neigh = adjacency.get(id) || new Set();
    let sum = 0;
    let count = 0;
    for (const n of neigh) {
      const nd = nodeDegrees[n];
      if (nd != null) {
        sum += nd;
        count++;
      }
    }
    barycenter[id] = count ? sum / count : nodeDegrees[id] || 0;
  }

  function median(arr) {
    const a = arr.slice().sort((x, y) => x - y);
    return a[Math.floor(a.length / 2)];
  }

  // Combined Sugiyama median: parents (prev layer) + children (next layer)
  // Parent weight 2, child weight 1.
  function combinedMedianY(id, positions) {
    const deg = nodeDegrees[id];
    const neigh = adjacency.get(id) || new Set();
    const parentYs = [];
    const childYs = [];

    for (const n of neigh) {
      const nd = nodeDegrees[n];
      const pos = positions[n];

      if (nd === deg - 1) {
        // parent
        if (pos && typeof pos.y === 'number') {
          parentYs.push(pos.y);
        } else if (idealY[n] != null) {
          parentYs.push(idealY[n]);
        }
      } else if (nd === deg + 1) {
        // child
        if (pos && typeof pos.y === 'number') {
          childYs.push(pos.y);
        } else if (idealY[n] != null) {
          childYs.push(idealY[n]);
        }
      }
    }

    const parentMed = parentYs.length ? median(parentYs) : centerY;
    const childMed = childYs.length ? median(childYs) : centerY;
    return (parentMed * 2 + childMed * 1) / 3;
  }

  // ---------------------------------------------------------------------------
  // Sort nodes within a single layer using current positions
  // ---------------------------------------------------------------------------
  function sortLayerNodes(ids, positions) {
    return ids.slice().sort((a, b) => {
      // 1. Closer to destination first (center bias)
      const da = distanceToZ[a] ?? Number.MAX_SAFE_INTEGER;
      const db = distanceToZ[b] ?? Number.MAX_SAFE_INTEGER;
      if (da !== db) return da - db;

      // 2. Combined median (parents + children)
      const ma = combinedMedianY(a, positions);
      const mb = combinedMedianY(b, positions);
      if (ma !== mb) return ma - mb;

      // 3. Barycenter
      const ba = barycenter[a] ?? 0;
      const bb = barycenter[b] ?? 0;
      if (ba !== bb) return bb - ba;

      // 4. Fan-out (nodes with more cross-layer edges more central)
      const fa = countFanOut(a);
      const fb = countFanOut(b);
      if (fa !== fb) return fb - fa;

      // 5. Deterministic tie-breaker: label
      const la = (nodeLabels[a] || a).toLowerCase();
      const lb = (nodeLabels[b] || b).toLowerCase();
      return la.localeCompare(lb);
    });
  }

  // Assign positions for a given sorted layer
  function assignPositions(sortedIds, degree, positions) {
    const x = leftX + (degree / maxDegree) * spanX;
    sortedIds.forEach((id, idx) => {
      let y;
      if (idx === 0) {
        y = centerY;
      } else {
        const k = Math.ceil(idx / 2);
        const side = idx % 2 === 1 ? -1 : 1; // odd → above, even → below
        y = centerY + side * k * verticalSpacing;
      }
      positions[id] = { x, y };
    });
  }

  const positions = {};

  // ---------------------------------------------------------------------------
  // Top-down sweep: each layer sees parents in degree-1
  // ---------------------------------------------------------------------------
  for (let d = 0; d <= maxDegree; d++) {
    const group = degreeGroups.get(d);
    if (!group || !group.length) continue;
    const sorted = sortLayerNodes(group, positions);
    assignPositions(sorted, d, positions);
  }

  // ---------------------------------------------------------------------------
  // Bottom-up sweep: refine order from destination side (children in degree+1)
  // ---------------------------------------------------------------------------
  for (let d = maxDegree; d >= 0; d--) {
    const group = degreeGroups.get(d);
    if (!group || !group.length) continue;
    const sorted = sortLayerNodes(group, positions);
    assignPositions(sorted, d, positions);
  }

  // Pin endpoints
  if (source && positions[source]) {
    positions[source].x = leftX;
    positions[source].y = centerY;
  }
  if (destination && positions[destination]) {
    positions[destination].x = rightX;
    positions[destination].y = centerY;
  }

  // ---------------------------------------------------------------------------
  // Light collision resolution
  // ---------------------------------------------------------------------------
  const nodeEntries = Object.entries(positions).map(([id, pos]) => ({
    id,
    x: pos.x,
    y: pos.y,
  }));

  const xThreshold = 80;
  const minY = 40;

  for (let pass = 0; pass < 2; pass++) {
    nodeEntries.sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
    for (let i = 0; i < nodeEntries.length; i++) {
      const a = nodeEntries[i];
      for (let j = i + 1; j < nodeEntries.length; j++) {
        const b = nodeEntries[j];
        if (Math.abs(b.x - a.x) > xThreshold) break;
        if (Math.abs(b.y - a.y) < minY) {
          const dir = b.y >= a.y ? 1 : -1;
          b.y = a.y + dir * minY;
        }
      }
    }
  }

  for (const e of nodeEntries) {
    positions[e.id] = { x: e.x, y: e.y };
  }

  // ---------------------------------------------------------------------------
  // Edge hop-degree for coloring: min distanceFromA of its endpoints
  // ---------------------------------------------------------------------------
  const edgeHopDegree = {};
  for (const edgeKey of edges) {
    const [a, b] = edgeKey.split('__');
    const da = distanceFromA[a] ?? Number.MAX_SAFE_INTEGER;
    const db = distanceFromA[b] ?? Number.MAX_SAFE_INTEGER;
    edgeHopDegree[edgeKey] = Math.min(da, db);
  }
  pathFilter.edgeHopDegree = edgeHopDegree;

  return positions;
}
