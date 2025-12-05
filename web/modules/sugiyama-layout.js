/**
 * Sugiyama Hierarchical Graph Layout Algorithm
 *
 * Implements a layered graph layout that minimizes edge crossings
 * by organizing nodes into horizontal layers based on their distance
 * from a source node, then ordering nodes within each layer to
 * minimize crossings between adjacent layers.
 *
 * References:
 * - Sugiyama et al. "Methods for Visual Understanding of Hierarchical System Structures" (1981)
 * - Hierarchical Graph Drawing: https://en.wikipedia.org/wiki/Layered_graph_drawing
 */

/**
 * Phase 1: Assign nodes to layers based on distance from source
 *
 * @param {Object} pathFilter - Contains nodes, edges, source, destination
 * @returns {Map<number, string[]>} Map of degree -> array of node IDs
 */
export function assignNodesToLayers(pathFilter) {
  const { nodes, edges, source } = pathFilter;

  // Build adjacency list from edges
  const adjacency = new Map();
  for (const nodeId of nodes) {
    adjacency.set(nodeId, []);
  }

  for (const edgeKey of edges) {
    const [a, b] = edgeKey.split('__');
    if (adjacency.has(a)) adjacency.get(a).push(b);
    if (adjacency.has(b)) adjacency.get(b).push(a);
  }

  // BFS from source to compute distances (degrees)
  const distances = new Map();
  distances.set(source, 0);
  const queue = [source];

  while (queue.length > 0) {
    const current = queue.shift();
    const currentDist = distances.get(current);

    for (const neighbor of adjacency.get(current) || []) {
      if (!distances.has(neighbor)) {
        distances.set(neighbor, currentDist + 1);
        queue.push(neighbor);
      }
    }
  }

  // Group nodes by their distance (layer)
  const layers = new Map();
  for (const [nodeId, dist] of distances) {
    if (!layers.has(dist)) {
      layers.set(dist, []);
    }
    layers.get(dist).push(nodeId);
  }

  return layers;
}

/**
 * Phase 2: Calculate barycenter for a node based on neighbor positions
 *
 * The barycenter is the average Y-coordinate of a node's neighbors in
 * an adjacent layer. This is used for ordering nodes to minimize crossings.
 *
 * @param {string} nodeId - Node to calculate barycenter for
 * @param {string[]} edges - Array of edge keys
 * @param {Map<string, {x: number, y: number}>} positions - Already-positioned nodes
 * @returns {number} Barycenter value (average Y of neighbors)
 */
export function calculateBarycenter(nodeId, edges, positions) {
  const neighborYs = [];

  for (const edgeKey of edges) {
    const [a, b] = edgeKey.split('__');
    let neighborId = null;

    if (a === nodeId && positions.has(b)) neighborId = b;
    else if (b === nodeId && positions.has(a)) neighborId = a;

    if (neighborId) {
      const pos = positions.get(neighborId);
      neighborYs.push(pos.y);
    }
  }

  if (neighborYs.length === 0) return null;

  return neighborYs.reduce((sum, y) => sum + y, 0) / neighborYs.length;
}

/**
 * Phase 3: Order nodes within a layer to minimize crossings
 *
 * Uses the barycenter method: nodes are sorted by the average Y-coordinate
 * of their neighbors in the previous layer. Shortest path nodes are prioritized
 * to appear in the center.
 *
 * @param {string[]} layerNodes - Nodes in this layer
 * @param {string[]} edges - All edges
 * @param {Map<string, {x: number, y: number}>} positions - Positions of previous layers
 * @param {Object} nodeLabels - Map of node ID to display name
 * @param {number} centerY - Center Y coordinate for tie-breaking
 * @param {Set<string>} shortestPathNodes - Set of nodes on the shortest path
 * @returns {string[]} Ordered array of node IDs
 */
export function orderNodesInLayer(
  layerNodes,
  edges,
  positions,
  nodeLabels,
  centerY,
  shortestPathNodes = new Set()
) {
  // Separate shortest path nodes from others
  const pathNodes = [];
  const otherNodes = [];

  for (const nodeId of layerNodes) {
    if (shortestPathNodes.has(nodeId)) {
      pathNodes.push(nodeId);
    } else {
      otherNodes.push(nodeId);
    }
  }

  // Calculate barycenter for each node
  const barycenters = new Map();

  for (const nodeId of layerNodes) {
    const barycenter = calculateBarycenter(nodeId, edges, positions);
    barycenters.set(nodeId, barycenter !== null ? barycenter : centerY);
  }

  // Sort both groups by barycenter
  const sortByBarycenter = (a, b) => {
    const barA = barycenters.get(a);
    const barB = barycenters.get(b);

    // Sort by barycenter (lower Y values first = higher on screen)
    if (Math.abs(barA - barB) > 1) {
      return barA - barB;
    }

    // Tie-breaker: alphabetical by label
    const labelA = (nodeLabels[a] || a).toLowerCase();
    const labelB = (nodeLabels[b] || b).toLowerCase();
    return labelA < labelB ? -1 : labelA > labelB ? 1 : 0;
  };

  pathNodes.sort(sortByBarycenter);
  otherNodes.sort(sortByBarycenter);

  // Interleave: place path nodes in the center, others around them
  if (pathNodes.length === 0) {
    return otherNodes;
  }

  if (otherNodes.length === 0) {
    return pathNodes;
  }

  // Place shortest path nodes in the center positions
  const result = [];
  const totalNodes = layerNodes.length;
  const pathStartIndex = Math.floor((totalNodes - pathNodes.length) / 2);

  let otherIndex = 0;
  for (let i = 0; i < totalNodes; i++) {
    if (i >= pathStartIndex && i < pathStartIndex + pathNodes.length) {
      // Insert path node
      result.push(pathNodes[i - pathStartIndex]);
    } else {
      // Insert other node
      if (otherIndex < otherNodes.length) {
        result.push(otherNodes[otherIndex]);
        otherIndex++;
      }
    }
  }

  return result;
}

/**
 * Phase 4: Assign Y-coordinates to nodes in a layer
 *
 * Distributes nodes vertically around a center line with equal spacing.
 *
 * @param {string[]} orderedNodes - Nodes in display order (top to bottom)
 * @param {number} centerY - Center Y coordinate
 * @param {number} verticalSpacing - Space between nodes
 * @returns {Map<string, number>} Map of node ID to Y coordinate
 */
export function assignYCoordinates(orderedNodes, centerY, verticalSpacing) {
  const yPositions = new Map();

  if (orderedNodes.length === 1) {
    yPositions.set(orderedNodes[0], centerY);
    return yPositions;
  }

  // Distribute nodes symmetrically around centerY
  const totalHeight = (orderedNodes.length - 1) * verticalSpacing;
  const startY = centerY - totalHeight / 2;

  orderedNodes.forEach((nodeId, index) => {
    yPositions.set(nodeId, startY + index * verticalSpacing);
  });

  return yPositions;
}

/**
 * Main Sugiyama layout algorithm
 *
 * @param {Object} pathFilter - Contains nodes, edges, source, destination, nodeLabels, shortestPathNodes
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {number} horizontalSpacing - Space between layers (default: 220)
 * @param {number} verticalSpacing - Space between nodes in a layer (default: 90)
 * @returns {Map<string, {x: number, y: number}>} Node positions
 */
export function computeSugiyamaLayout(
  pathFilter,
  width = 800,
  height = 600,
  horizontalSpacing = 220,
  verticalSpacing = 90
) {
  const { source, destination, edges, nodeLabels, shortestPathNodes } = pathFilter;
  const centerY = height / 2;
  const positions = new Map();

  // Convert shortestPathNodes array to Set for faster lookup
  const shortestPathSet = new Set(shortestPathNodes || []);

  // Phase 1: Assign nodes to layers
  const layers = assignNodesToLayers(pathFilter);
  const maxDegree = Math.max(...layers.keys());

  // Process layers left to right
  for (let degree = 0; degree <= maxDegree; degree++) {
    const layerNodes = layers.get(degree) || [];
    if (layerNodes.length === 0) continue;

    // Calculate X position for this layer
    const x = 50 + degree * horizontalSpacing;

    // Order nodes in this layer to minimize crossings
    const orderedNodes =
      degree === 0
        ? layerNodes // Source node, no ordering needed
        : orderNodesInLayer(layerNodes, edges, positions, nodeLabels, centerY, shortestPathSet);

    // Assign Y coordinates
    const yCoords = assignYCoordinates(orderedNodes, centerY, verticalSpacing);

    // Store positions
    for (const nodeId of orderedNodes) {
      positions.set(nodeId, {
        x: x,
        y: yCoords.get(nodeId),
      });
    }
  }

  return positions;
}

/**
 * Convert Map-based positions to object format for Cytoscape
 *
 * @param {Map<string, {x: number, y: number}>} positionsMap
 * @returns {Object} Object with nodeId keys and {x, y} values
 */
export function convertPositionsToObject(positionsMap) {
  const result = {};
  for (const [nodeId, pos] of positionsMap) {
    result[nodeId] = pos;
  }
  return result;
}
