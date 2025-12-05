// web/modules/layout/sugiyama-degree-layout.js
//
// Deterministic Sugiyama-style degree layout for FBS Graph Visualizer.
// This module contains NO Cytoscape code. It only computes coordinates.
//
// Usage:
//
// import { computeSugiyamaDegreeLayout } from './layout/sugiyama-degree-layout';
//
// const positions = computeSugiyamaDegreeLayout(pathFilter, width, height);
//

export function computeSugiyamaDegreeLayout(pathFilter, width = 800, height = 600) {
  if (!pathFilter || !pathFilter.nodes || !pathFilter.edges) {
    return {};
  }

  const { nodes, edges, source, destination, nodeLabels = {} } = pathFilter;
  const positions = {};

  // ---- Build adjacency from existing edge keys "a__b"
  const adjacency = new Map();
  for (const id of nodes) adjacency.set(id, new Set());

  for (const edgeKey of edges) {
    const parts = edgeKey.split('__');
    if (parts.length !== 2) continue;
    const [a, b] = parts;
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    if (!adjacency.has(b)) adjacency.set(b, new Set());
    adjacency.get(a).add(b);
    adjacency.get(b).add(a);
  }

  // ---- BFS helper
  function bfs(startId) {
    const dist = {};
    if (!startId || !adjacency.has(startId)) return dist;

    const q = [startId];
    dist[startId] = 0;
    let head = 0;

    while (head < q.length) {
      const cur = q[head++];
      const base = dist[cur];
      for (const n of adjacency.get(cur)) {
        if (dist[n] == null) {
          dist[n] = base + 1;
          q.push(n);
        }
      }
    }
    return dist;
  }

  // ---- Degree (distance from A)
  const distanceFromA = bfs(source);
  const distanceToZ = bfs(destination);

  const nodeDegrees = {};
  let maxDegree = 0;
  for (const id of nodes) {
    const d = distanceFromA[id];
    if (typeof d === 'number') {
      nodeDegrees[id] = d;
      if (d > maxDegree) maxDegree = d;
    }
  }

  // Nothing reachable?
  if (maxDegree === 0) {
    const cy = height / 2;
    return {
      [source]: { x: 50, y: cy },
      [destination]: { x: width - 50, y: cy },
    };
  }

  const centerY = height / 2;
  const leftX = 50;
  const rightX = width - 50;
  const spanX = rightX - leftX;

  // ---- Group by (integer) degree
  const degreeGroups = new Map();
  for (const id of nodes) {
    const deg = nodeDegrees[id];
    if (deg == null) continue;
    if (!degreeGroups.has(deg)) degreeGroups.set(deg, []);
    degreeGroups.get(deg).push(id);
  }

  // ---- Fan-out (neighbors with higher degree)
  function countFanOut(id) {
    const neighbors = adjacency.get(id) || new Set();
    const deg = nodeDegrees[id];
    let count = 0;
    for (const n of neighbors) {
      const nd = nodeDegrees[n];
      if (typeof nd === 'number' && nd > deg) count++;
    }
    return count;
  }

  // ---- Barycenter (average neighbor degree)
  const barycenter = {};
  for (const id of nodes) {
    const neigh = adjacency.get(id) || new Set();
    let sum = 0,
      count = 0;
    for (const n of neigh) {
      const nd = nodeDegrees[n];
      if (nd != null) {
        sum += nd;
        count++;
      }
    }
    barycenter[id] = count ? sum / count : nodeDegrees[id] || 0;
  }

  // ---- Sort function for each degree layer
  function sortBucket(ids) {
    return ids.slice().sort((a, b) => {
      const ba = barycenter[a] ?? 0;
      const bb = barycenter[b] ?? 0;
      if (ba !== bb) return bb - ba; // higher barycenter = more central

      const da = distanceToZ[a] ?? Number.MAX_SAFE_INTEGER;
      const db = distanceToZ[b] ?? Number.MAX_SAFE_INTEGER;
      if (da !== db) return da - db; // closer to Z = more central

      const fa = countFanOut(a);
      const fb = countFanOut(b);
      if (fa !== fb) return fb - fa; // more outgoing edges = more central

      const la = (nodeLabels[a] || a).toLowerCase();
      const lb = (nodeLabels[b] || b).toLowerCase();
      return la.localeCompare(lb);
    });
  }

  const verticalSpacing = Math.max(40, Math.min(80, height * 0.12));

  // ---- Assign X/Y for each degree bucket
  for (let d = 0; d <= maxDegree; d++) {
    const group = degreeGroups.get(d);
    if (!group || !group.length) continue;

    const sorted = sortBucket(group);
    const x = leftX + (d / maxDegree) * spanX;

    sorted.forEach((id, idx) => {
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

  // ---- Force A and Z to centerline left/right
  if (source) positions[source] = { x: leftX, y: centerY };
  if (destination) positions[destination] = { x: rightX, y: centerY };

  // ---- Collision pass (push nodes apart vertically)
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
          const direction = b.y >= a.y ? 1 : -1;
          b.y = a.y + direction * minY;
        }
      }
    }
  }

  for (const entry of nodeEntries) {
    positions[entry.id] = { x: entry.x, y: entry.y };
  }

  return positions;
}
