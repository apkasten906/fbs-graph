/**
 * Sugiyama Test Helper Library
 *
 * Authoritative test utilities based on:
 * - Sugiyama, Tagawa, Toda (1981)
 * - Brandes & Köpf (2002)
 * - Gansner et al. (Graphviz)
 * - Eiglsperger et al. (OGDF)
 *
 * These helpers verify structural invariants required by the four-step
 * Sugiyama layered drawing framework:
 *   1) DAG / Layer assignment
 *   2) Crossing minimization (median/barycenter)
 *   3) Brandes–Köpf conflict handling
 *   4) Horizontal coordinate validity
 *
 * All functions are deterministic and suitable for Vitest or Jest.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Edge {
  source: string;
  target: string;
}

export type Layering = Map<string, number>; // node → layer index
export type Order = Map<string, number>;    // node → index within layer (after median pass)
export type LayerMap = Map<number, string[]>; // layer → ordered nodes

export interface Conflict {
  type: 'TYPE1' | 'TYPE2';
  nodes: string[];
  message: string;
}

// ---------------------------------------------------------------------------
// Basic checks
// ---------------------------------------------------------------------------

/**
 * Check if graph is a DAG (no directed cycle).
 */
export function isDag(nodes: string[], edges: Edge[]): boolean {
  const incoming = new Map<string, number>();
  const adj = new Map<string, string[]>();

  nodes.forEach(n => {
    incoming.set(n, 0);
    adj.set(n, []);
  });

  for (const e of edges) {
    adj.get(e.source)!.push(e.target);
    incoming.set(e.target, (incoming.get(e.target) ?? 0) + 1);
  }

  const q = [...nodes.filter(n => incoming.get(n) === 0)];

  let visited = 0;
  while (q.length > 0) {
    const n = q.shift()!;
    visited++;
    for (const nxt of adj.get(n)!) {
      incoming.set(nxt, incoming.get(nxt)! - 1);
      if (incoming.get(nxt) === 0) q.push(nxt);
    }
  }

  return visited === nodes.length;
}

/**
 * Node must only have edges to nodes in next layer.
 */
export function edgesAreHopAdjacent(edges: Edge[], layer: Layering): boolean {
  return edges.every(e => {
    const d = Math.abs(layer.get(e.source)! - layer.get(e.target)!);
    return d === 1;
  });
}

/**
 * Ensure nodes grouped by layer produce contiguous integer layers starting at 0.
 */
export function isValidLayering(layer: Layering, nodes: string[]): boolean {
  const layers = Array.from(new Set(nodes.map(n => layer.get(n)!))).sort();
  if (layers[0] !== 0) return false;
  for (let i = 1; i < layers.length; i++) {
    if (layers[i] !== layers[i - 1] + 1) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Layer reconstruction from Order
// ---------------------------------------------------------------------------

/**
 * Convert Order + Layering into a layer→nodes map, sorted by order index.
 */
export function buildLayerMap(layering: Layering, order: Order): LayerMap {
  const map: LayerMap = new Map();
  for (const [node, layer] of layering.entries()) {
    if (!map.has(layer)) map.set(layer, []);
    map.get(layer)!.push(node);
  }

  for (const l of map.keys()) {
    map.get(l)!.sort((a, b) => order.get(a)! - order.get(b)!);
  }

  return map;
}

// ---------------------------------------------------------------------------
// Crossing count
// ---------------------------------------------------------------------------

/**
 * Count the number of edge crossings between two adjacent layers.
 * Based on standard bipartite crossing detection.
 */
export function countCrossingsBetweenLayers(
  upper: string[],
  lower: string[],
  edges: Edge[]
): number {
  // Map node → index within its layer
  const posUpper = new Map(upper.map((n, i) => [n, i]));
  const posLower = new Map(lower.map((n, i) => [n, i]));

  // Collect edges connecting these layers
  const layerEdges: Array<[number, number]> = [];
  for (const e of edges) {
    if (posUpper.has(e.source) && posLower.has(e.target)) {
      layerEdges.push([posUpper.get(e.source)!, posLower.get(e.target)!]);
    }
    if (posUpper.has(e.target) && posLower.has(e.source)) {
      // allow reversed orientation (if graph reversed earlier)
      layerEdges.push([posUpper.get(e.target)!, posLower.get(e.source)!]);
    }
  }

  // Standard inversion count
  let crossings = 0;
  for (let i = 0; i < layerEdges.length; i++) {
    for (let j = i + 1; j < layerEdges.length; j++) {
      const [a1, b1] = layerEdges[i];
      const [a2, b2] = layerEdges[j];
      if ((a1 < a2 && b1 > b2) || (a1 > a2 && b1 < b2)) {
        crossings++;
      }
    }
  }

  return crossings;
}

/**
 * Count total crossings across entire layered graph.
 */
export function countTotalCrossings(
  layerMap: LayerMap,
  edges: Edge[]
): number {
  const layers = [...layerMap.keys()].sort((a, b) => a - b);
  let total = 0;

  for (let i = 0; i < layers.length - 1; i++) {
    const upper = layerMap.get(layers[i])!;
    const lower = layerMap.get(layers[i + 1])!;
    total += countCrossingsBetweenLayers(upper, lower, edges);
  }

  return total;
}

// ---------------------------------------------------------------------------
// Brandes–Köpf Type-1 Conflict Detection
// ---------------------------------------------------------------------------

/**
 * A Type-1 conflict occurs when an edge with span > 1 (long edge)
 * overlaps the "block" of a shorter edge.
 *
 * Formal definition: If (u→v) is an edge with layer(v) > layer(u)+1, then
 * for any edge (x→y) with layer(x)=layer(u)+1 and layer(y)=layer(v),
 * the horizontal order must not place x,y inside the interval covered
 * by the long edge.
 */
export function detectType1Conflicts(
  layerMap: LayerMap,
  layering: Layering,
  order: Order,
  edges: Edge[]
): Conflict[] {
  const conflicts: Conflict[] = [];

  for (const e of edges) {
    const lu = layering.get(e.source)!;
    const lv = layering.get(e.target)!;

    // Only consider "long" edges
    if (lv - lu <= 1) continue;

    const upper = layerMap.get(lu)!;
    const lower = layerMap.get(lv)!;

    const uPos = order.get(e.source)!;
    const vPos = order.get(e.target)!;

    // Any node in intermediate layer that falls between these positions is a conflict
    for (let layer = lu + 1; layer < lv; layer++) {
      const midLayer = layerMap.get(layer)!;
      for (const node of midLayer) {
        const pos = order.get(node)!;
        // node lies in forbidden interval
        if (pos > Math.min(uPos, vPos) && pos < Math.max(uPos, vPos)) {
          conflicts.push({
            type: 'TYPE1',
            nodes: [e.source, e.target, node],
            message: `Type-1 conflict: node ${node} lies inside span of long edge ${e.source}→${e.target}`
          });
        }
      }
    }
  }

  return conflicts;
}

// ---------------------------------------------------------------------------
// Brandes–Köpf Type-2 Conflict Detection
// ---------------------------------------------------------------------------

/**
 * Dummy nodes exist on edges that span multiple layers.
 * Two edges that diverge then reconverge must not cross when projected.
 *
 * Formal definition: Type-2 conflicts occur when dummy nodes of two
 * different long edges are placed in incompatible order within a layer.
 */
export function detectType2Conflicts(
  layerMap: LayerMap,
  order: Order,
  edges: Edge[]
): Conflict[] {
  const conflicts: Conflict[] = [];

  // Examine each layer's local ordering
  for (const [layer, nodes] of layerMap.entries()) {
    // Long edges that have dummy nodes in this layer
    const dummyPairs: string[][] = [];

    for (const e of edges) {
      // If edge spans more than one layer, treat intermediate nodes as dummies
      // Approximated: treat nodes in this layer that connect upward and downward
      // as dummy candidates.

      const up = edges.filter(ed => ed.target === e.source).length > 0;
      const down = edges.filter(ed => ed.source === e.target).length > 0;
      if (up && down && nodes.includes(e.source)) {
        dummyPairs.push([e.source, e.target]);
      }
    }

    // Check for inverted ordering in same layer
    for (let i = 0; i < dummyPairs.length; i++) {
      for (let j = i + 1; j < dummyPairs.length; j++) {
        const [a1] = dummyPairs[i];
        const [a2] = dummyPairs[j];

        if (order.get(a1)! > order.get(a2)!) {
          conflicts.push({
            type: 'TYPE2',
            nodes: [a1, a2],
            message: `Type-2 conflict: dummy ordering inverted in layer ${layer}`
          });
        }
      }
    }
  }

  return conflicts;
}

// ---------------------------------------------------------------------------
// Median / Barycenter computations (for testing layer ordering)
// ---------------------------------------------------------------------------

export function computeMedianOfNeighbors(
  node: string,
  neighbors: string[],
  order: Order
): number {
  if (neighbors.length === 0) return order.get(node) ?? 0;

  const sorted = neighbors.map(n => order.get(n)!).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted[mid];
}

export function computeBarycenterOfNeighbors(
  node: string,
  neighbors: string[],
  order: Order
): number {
  if (neighbors.length === 0) return order.get(node) ?? 0;

  const sum = neighbors.reduce((acc, n) => acc + order.get(n)!, 0);
  return sum / neighbors.length;
}

// ---------------------------------------------------------------------------
// Utility: Pretty-print layers
// ---------------------------------------------------------------------------

export function debugLayerMap(layerMap: LayerMap): string {
  let out = '';
  for (const [layer, nodes] of [...layerMap.entries()].sort((a, b) => a[0] - b[0])) {
    out += `Layer ${layer}: ${nodes.join(', ')}\n`;
  }
  return out;
}
