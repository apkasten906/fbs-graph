/**
 * Graph algorithms and path finding for the FBS Timeline App
 */

export function findShortestPath(adjacency, start, end) {
  if (!adjacency.has(start) || !adjacency.has(end)) return null;

  const dist = new Map([[start, 0]]);
  const prev = new Map();
  const queue = [{ node: start, distance: 0 }];

  while (queue.length) {
    queue.sort((a, b) => a.distance - b.distance);
    const current = queue.shift();
    if (!current) break;
    if (current.node === end) break;

    const neighbors = adjacency.get(current.node) ?? [];
    for (const edge of neighbors) {
      const nextDistance = current.distance + edge.weight;
      if (nextDistance < (dist.get(edge.to) ?? Number.POSITIVE_INFINITY)) {
        dist.set(edge.to, nextDistance);
        prev.set(edge.to, { node: current.node, edge });
        queue.push({ node: edge.to, distance: nextDistance });
      }
    }
  }

  if (!dist.has(end)) return null;

  const nodes = [];
  const edges = [];
  let cursor = end;

  while (cursor !== undefined) {
    nodes.push(cursor);
    const prevEntry = prev.get(cursor);
    if (!prevEntry) break;
    edges.push({
      from: prevEntry.node,
      to: cursor,
      key: prevEntry.edge.key,
      weight: prevEntry.edge.weight,
      bestGame: prevEntry.edge.best,
    });
    cursor = prevEntry.node;
  }

  nodes.reverse();
  edges.reverse();

  return { nodes, edges, distance: dist.get(end) ?? null };
}
