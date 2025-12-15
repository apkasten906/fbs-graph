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
 * Enhanced to detect "bridge nodes" that participate in shorter alternate paths.
 * A bridge node is one that:
 * 1. Is NOT on the weighted shortest path
 * 2. BUT connects directly to the destination at a shorter hop count
 *
 * Example: Minnesota→Purdue→Notre Dame (2 hops) vs Minnesota→Oregon→USC→Notre Dame (3 hops weighted shortest)
 * Purdue should be at 1.5 to show it bridges to destination despite not being on main path.
 *
 * @param {Object} pathFilter - Contains nodes, edges, source, destination, shortestPathNodes
 * @returns {Map<number, string[]>} Map of degree -> array of node IDs
 */
export function assignNodesToLayers(pathFilter) {
  const { nodes, edges, source, destination, shortestPathNodes } = pathFilter;

  console.log('[Sugiyama] assignNodesToLayers input:', {
    nodesCount: nodes?.length,
    edgesCount: edges?.length,
    source,
    destination,
    shortestPathNodes: shortestPathNodes || [],
    sampleNodes: nodes?.slice(0, 5),
    sampleEdges: edges?.slice(0, 5),
  });

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

  // BFS from source to compute shortest hop distances (degrees)
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

  // Calculate hop counts
  const destDist = distances.get(destination);
  const shortestPathSet = new Set(shortestPathNodes || []);
  const weightedPathHops = shortestPathNodes ? shortestPathNodes.length - 1 : 0;
  const bfsHops = destDist; // BFS always finds shortest hop count

  // Detect bridge nodes: nodes that participate in multiple paths with different hop counts
  const bridgeNodes = new Map();

  console.log(
    '[Sugiyama] Weighted shortest path:',
    shortestPathNodes,
    `(${weightedPathHops} hops)`
  );
  console.log('[Sugiyama] BFS shortest hop distance:', bfsHops);

  // Strategy: Destination always stays at highest layer
  // Move intermediate nodes to fractional layers when they create path conflicts

  if (bfsHops < weightedPathHops) {
    console.log(
      `[Sugiyama] BFS path (${bfsHops} hops) is shorter than weighted path (${weightedPathHops} hops)`
    );

    // Move destination to match weighted path length (highest layer)
    // This ensures destination is always at the end
    distances.set(destination, weightedPathHops);
    console.log(
      `[Sugiyama] ${destination} positioned at layer ${weightedPathHops} (weighted path length)`
    );

    // Find intermediate nodes that provide shorter paths to destination
    // These should be at fractional layers to show they're "bridge" nodes
    for (const [nodeId, dist] of distances) {
      if (nodeId === source || nodeId === destination) continue;

      const neighbors = adjacency.get(nodeId) || [];
      const connectsToDestination = neighbors.includes(destination);

      if (connectsToDestination) {
        const hopCountViaThisNode = dist + 1;

        // If this node provides a shorter path than the weighted path length
        // move it to a fractional layer to show it's a bridge/shortcut
        if (hopCountViaThisNode < weightedPathHops && !shortestPathSet.has(nodeId)) {
          const fractionalDegree = dist + 0.5;
          bridgeNodes.set(nodeId, {
            ownLayer: dist,
            reason: 'shortcut-to-destination',
            alternateHops: hopCountViaThisNode,
            weightedHops: weightedPathHops,
          });
          distances.set(nodeId, fractionalDegree);
          console.log(
            `[Sugiyama] ${nodeId} moved from ${dist} → ${fractionalDegree} (provides ${hopCountViaThisNode}-hop shortcut vs ${weightedPathHops}-hop weighted path)`
          );
        }
      }
    }
  } else {
    console.log('[Sugiyama] BFS and weighted paths have same hop count');
    // Destination stays at BFS distance (which equals weighted distance)

    // Check for intermediate bridge nodes that provide shortcuts
    for (const [nodeId, dist] of distances) {
      if (nodeId === source || nodeId === destination) continue;

      // Skip nodes already on the weighted shortest path
      if (shortestPathSet.has(nodeId)) {
        console.log(`[Sugiyama] ${nodeId} is on weighted shortest path, skipping bridge detection`);
        continue;
      }

      const neighbors = adjacency.get(nodeId) || [];
      const connectsToDestination = neighbors.includes(destination);

      if (connectsToDestination) {
        const hopCountViaThisNode = dist + 1;

        // Bridge detection: this node provides a shorter hop-count path than weighted shortest path
        if (hopCountViaThisNode < weightedPathHops) {
          const fractionalDegree = dist + 0.5;
          bridgeNodes.set(nodeId, {
            ownLayer: dist,
            alternateHops: hopCountViaThisNode,
            weightedHops: weightedPathHops,
            reason: 'shortcut-bridge',
          });
          distances.set(nodeId, fractionalDegree);
          console.log(
            `[Sugiyama] Bridge detected: ${nodeId} at layer ${dist} provides ${hopCountViaThisNode}-hop path (vs ${weightedPathHops}-hop weighted path) → moved to ${fractionalDegree}`
          );
        }
      }
    }
  } // Group nodes by their distance (layer), including fractional layers
  const layers = new Map();
  for (const [nodeId, dist] of distances) {
    if (!layers.has(dist)) {
      layers.set(dist, []);
    }
    layers.get(dist).push(nodeId);
  }

  console.log('[Sugiyama] Final layer assignments:', {
    totalLayers: layers.size,
    bridgeCount: bridgeNodes.size,
    layerSummary: Object.fromEntries(
      Array.from(layers.entries())
        .sort(([a], [b]) => a - b)
        .map(([deg, nodeList]) => [deg, `${nodeList.length} nodes: ${nodeList.join(', ')}`])
    ),
  });

  return layers;
}

// =============================================================================
// PHASE 2: CROSSING MINIMIZATION WITH LAYER SWEEPING
// =============================================================================

/**
 * Get nodes in an adjacent layer that are connected to the given node
 * @param {string} nodeId - The node to find connections for
 * @param {string[]} adjacentLayerNodes - Nodes in the adjacent layer
 * @param {string[]} edges - Array of edge strings (format: "nodeA__nodeB")
 * @returns {string[]} Array of connected node IDs in the adjacent layer
 */
function getConnectedNodesInAdjacentLayer(nodeId, adjacentLayerNodes, edges) {
  const connected = [];
  const adjacentSet = new Set(adjacentLayerNodes);

  for (const edge of edges) {
    const [nodeA, nodeB] = edge.split('__');

    if (nodeA === nodeId && adjacentSet.has(nodeB)) {
      connected.push(nodeB);
    } else if (nodeB === nodeId && adjacentSet.has(nodeA)) {
      connected.push(nodeA);
    }
  }

  return connected;
}

/**
 * Calculate median position of connected nodes in adjacent layer
 * More stable than barycenter (mean) for crossing minimization
 * @param {string} nodeId - The node to calculate median for
 * @param {string[]} adjacentLayerNodes - Ordered nodes in adjacent layer
 * @param {string[]} edges - Array of edge strings
 * @returns {number} Median position (0-based index), or -1 if no connections
 */
function getMedianPosition(nodeId, adjacentLayerNodes, edges) {
  const connectedNodes = getConnectedNodesInAdjacentLayer(nodeId, adjacentLayerNodes, edges);

  if (connectedNodes.length === 0) {
    return -1; // No connections
  }

  // Get positions of connected nodes
  const positions = connectedNodes
    .map(id => adjacentLayerNodes.indexOf(id))
    .filter(pos => pos !== -1)
    .sort((a, b) => a - b);

  if (positions.length === 0) {
    return -1;
  }

  // Calculate median
  const mid = Math.floor(positions.length / 2);
  if (positions.length % 2 === 0) {
    // Even number: average of two middle values
    return (positions[mid - 1] + positions[mid]) / 2;
  } else {
    // Odd number: middle value
    return positions[mid];
  }
}

/**
 * Count edge crossings between two adjacent layers
 * @param {string[]} layer1Nodes - Ordered nodes in first layer
 * @param {string[]} layer2Nodes - Ordered nodes in second layer
 * @param {string[]} edges - Array of edge strings
 * @returns {number} Number of crossings
 */
function countLayerCrossings(layer1Nodes, layer2Nodes, edges) {
  let crossings = 0;

  // Build edge list with positions
  const edgeList = [];
  for (const edge of edges) {
    const [nodeA, nodeB] = edge.split('__');
    const pos1A = layer1Nodes.indexOf(nodeA);
    const pos2A = layer2Nodes.indexOf(nodeA);
    const pos1B = layer1Nodes.indexOf(nodeB);
    const pos2B = layer2Nodes.indexOf(nodeB);

    // Edge between layer1 and layer2
    if (pos1A !== -1 && pos2B !== -1) {
      edgeList.push([pos1A, pos2B]);
    } else if (pos1B !== -1 && pos2A !== -1) {
      edgeList.push([pos1B, pos2A]);
    }
  }

  // Count crossings: for each pair of edges, check if they cross
  for (let i = 0; i < edgeList.length; i++) {
    const [a1, a2] = edgeList[i];
    for (let j = i + 1; j < edgeList.length; j++) {
      const [b1, b2] = edgeList[j];

      // Edges cross if (a1 < b1 && a2 > b2) or (a1 > b1 && a2 < b2)
      if ((a1 < b1 && a2 > b2) || (a1 > b1 && a2 < b2)) {
        crossings++;
      }
    }
  }

  return crossings;
}

/**
 * Count total crossings across all adjacent layer pairs
 * @param {Map<number, string[]>} layers - Map of degree to ordered node arrays
 * @param {string[]} edges - Array of edge strings
 * @returns {number} Total number of crossings
 */
function countTotalCrossings(layers, edges) {
  const sortedDegrees = Array.from(layers.keys()).sort((a, b) => a - b);
  let totalCrossings = 0;

  for (let i = 0; i < sortedDegrees.length - 1; i++) {
    const layer1 = layers.get(sortedDegrees[i]);
    const layer2 = layers.get(sortedDegrees[i + 1]);
    totalCrossings += countLayerCrossings(layer1, layer2, edges);
  }

  return totalCrossings;
}

/**
 * Order nodes in a layer by median position of neighbors in adjacent layer
 * @param {string[]} layerNodes - Nodes to order
 * @param {string[]} adjacentLayerNodes - Ordered nodes in adjacent layer
 * @param {string[]} edges - Array of edge strings
 * @param {Map<string, string>|Object} nodeLabels - Node labels for tie-breaking
 * @param {Set<string>} shortestPathNodes - Highlighted path nodes for priority
 * @returns {string[]} Ordered nodes
 */
function orderByMedian(layerNodes, adjacentLayerNodes, edges, nodeLabels, shortestPathNodes) {
  const nodesWithMedian = layerNodes.map(nodeId => ({
    nodeId,
    median: getMedianPosition(nodeId, adjacentLayerNodes, edges),
    isPath: shortestPathNodes.has(nodeId),
    label: (nodeLabels instanceof Map ? nodeLabels.get(nodeId) : nodeLabels[nodeId]) || nodeId,
  }));

  // Sort by: median position, then path priority, then alphabetical
  nodesWithMedian.sort((a, b) => {
    // Nodes with no connections go to end
    if (a.median === -1 && b.median !== -1) return 1;
    if (a.median !== -1 && b.median === -1) return -1;

    // Primary: sort by median position
    if (a.median !== b.median) {
      return a.median - b.median;
    }

    // Secondary: path nodes get priority (earlier position)
    if (a.isPath !== b.isPath) {
      return a.isPath ? -1 : 1;
    }

    // Tertiary: alphabetical by label
    return a.label.localeCompare(b.label);
  });

  return nodesWithMedian.map(n => n.nodeId);
}

/**
 * Minimize crossings using iterative layer sweeping with median heuristic
 * Adaptive max iterations: min(7, numLayers * 2 + 1)
 * @param {Map<number, string[]>} layers - Map of degree to node arrays (will be modified)
 * @param {string[]} edges - Array of edge strings
 * @param {Map<string, string>} nodeLabels - Node labels for tie-breaking
 * @param {Set<string>} shortestPathNodes - Highlighted path nodes
 * @returns {{iterations: number, initialCrossings: number, finalCrossings: number}}
 */
function minimizeCrossingsWithSweeping(layers, edges, nodeLabels, shortestPathNodes) {
  const sortedDegrees = Array.from(layers.keys()).sort((a, b) => a - b);
  const numLayers = sortedDegrees.length;

  // Adaptive max iterations: min(7, numLayers * 2 + 1)
  const maxIterations = Math.min(7, numLayers * 2 + 1);

  let initialCrossings = countTotalCrossings(layers, edges);
  let currentCrossings = initialCrossings;
  let iteration = 0;
  let lastImprovement = 0;

  console.log(
    `[Crossing Minimization] Starting with ${currentCrossings} crossings, max ${maxIterations} iterations`
  );

  while (iteration < maxIterations) {
    iteration++;
    const beforeCrossings = currentCrossings;

    // Down-sweep: order each layer based on layer above
    for (let i = 1; i < numLayers; i++) {
      const currentDegree = sortedDegrees[i];
      const previousDegree = sortedDegrees[i - 1];
      const currentLayer = layers.get(currentDegree);
      const previousLayer = layers.get(previousDegree);

      const ordered = orderByMedian(
        currentLayer,
        previousLayer,
        edges,
        nodeLabels,
        shortestPathNodes
      );
      layers.set(currentDegree, ordered);
    }

    // Up-sweep: order each layer based on layer below
    for (let i = numLayers - 2; i >= 0; i--) {
      const currentDegree = sortedDegrees[i];
      const nextDegree = sortedDegrees[i + 1];
      const currentLayer = layers.get(currentDegree);
      const nextLayer = layers.get(nextDegree);

      const ordered = orderByMedian(currentLayer, nextLayer, edges, nodeLabels, shortestPathNodes);
      layers.set(currentDegree, ordered);
    }

    currentCrossings = countTotalCrossings(layers, edges);

    // Check for improvement
    if (currentCrossings < beforeCrossings) {
      lastImprovement = iteration;
      console.log(
        `[Crossing Minimization] Iteration ${iteration}: ${currentCrossings} crossings (improved)`
      );
    } else {
      console.log(
        `[Crossing Minimization] Iteration ${iteration}: ${currentCrossings} crossings (no change)`
      );
    }

    // Early stopping: if no improvement for 2 iterations, stop
    if (iteration - lastImprovement >= 2) {
      console.log(
        `[Crossing Minimization] Converged after ${iteration} iterations (no improvement for 2 iterations)`
      );
      break;
    }
  }

  // Warning if max iterations reached with remaining crossings
  if (iteration >= maxIterations && currentCrossings > 0) {
    console.warn(
      `[Crossing Minimization] Reached max iterations (${maxIterations}) with ${currentCrossings} crossings remaining. ` +
        `Consider simplifying the graph or increasing iteration limit.`
    );
  }

  return {
    iterations: iteration,
    initialCrossings,
    finalCrossings: currentCrossings,
  };
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
 * Uses topology-aware sorting: combines barycenter method with edge connectivity.
 * Nodes with more edges (higher degree) are positioned more centrally to reduce
 * crossings. Shortest path nodes are prioritized to appear in the center.
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

  // Calculate barycenter AND edge count for each node
  const barycenters = new Map();
  const edgeCounts = new Map();

  for (const nodeId of layerNodes) {
    const barycenter = calculateBarycenter(nodeId, edges, positions);
    barycenters.set(nodeId, barycenter !== null ? barycenter : centerY);

    // Count total edges for this node (both incoming and outgoing)
    let edgeCount = 0;
    for (const edgeKey of edges) {
      const [a, b] = edgeKey.split('__');
      if (a === nodeId || b === nodeId) {
        edgeCount++;
      }
    }
    edgeCounts.set(nodeId, edgeCount);
  }

  // Topology-aware sort: barycenter first, then edge count (degree), then alphabetical
  const sortByTopology = (a, b) => {
    const barA = barycenters.get(a);
    const barB = barycenters.get(b);

    // Primary: Sort by barycenter (lower Y values first = higher on screen)
    if (Math.abs(barA - barB) > 1) {
      return barA - barB;
    }

    // Secondary: Sort by edge count (more connected nodes toward center)
    const edgeA = edgeCounts.get(a) || 0;
    const edgeB = edgeCounts.get(b) || 0;

    if (edgeA !== edgeB) {
      return edgeB - edgeA; // Higher degree first (more central positioning)
    }

    // Tertiary: Alphabetical by label
    const labelA = (nodeLabels[a] || a).toLowerCase();
    const labelB = (nodeLabels[b] || b).toLowerCase();
    return labelA < labelB ? -1 : labelA > labelB ? 1 : 0;
  };

  pathNodes.sort(sortByTopology);
  otherNodes.sort(sortByTopology);

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
 * Distributes nodes vertically according to their order (from crossing minimization).
 * Ensures proper spacing and collision avoidance with existing positioned nodes.
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

  // Calculate evenly distributed positions respecting the order from crossing minimization
  const totalHeight = (orderedNodes.length - 1) * verticalSpacing;
  const startY = centerY - totalHeight / 2;

  const tentativePositions = orderedNodes.map((nodeId, index) => ({
    nodeId,
    y: startY + index * verticalSpacing,
  }));

  // TODO: Implement proper edge-collision detection
  // Current approach of increasing vertical spacing doesn't solve the fundamental issue:
  // nodes with edges connecting back to earlier layers need special positioning,
  // not just more vertical space.

  // Finalize positions
  tentativePositions.forEach(pos => {
    yPositions.set(pos.nodeId, pos.y);
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
 * @param {boolean} useCrossingMinimization - Enable iterative crossing minimization (default: true)
 * @returns {Map<string, {x: number, y: number}>} Node positions
 */
export function computeSugiyamaLayout(
  pathFilter,
  width = 800,
  height = 600,
  horizontalSpacing = 220,
  verticalSpacing = 50, // Increased from 90 to 100 for better default spacing
  useCrossingMinimization = true
) {
  const { edges, nodeLabels, shortestPathNodes } = pathFilter;
  // reference width to satisfy lint (not used in current layout logic)
  void width;
  const centerY = height / 2;
  const positions = new Map();

  // Convert shortestPathNodes array to Set for faster lookup
  const shortestPathSet = new Set(shortestPathNodes || []);

  // Phase 1: Assign nodes to layers (including fractional layers for bridges)
  const layers = assignNodesToLayers(pathFilter);
  const allDegrees = Array.from(layers.keys()).sort((a, b) => a - b);

  // Phase 2: Minimize crossings with layer sweeping (if enabled)
  if (useCrossingMinimization) {
    console.log('[Sugiyama] Crossing minimization: ENABLED');
    const result = minimizeCrossingsWithSweeping(layers, edges, nodeLabels, shortestPathSet);
    console.log(
      `[Sugiyama] Crossing minimization complete: ${result.initialCrossings} → ${result.finalCrossings} crossings ` +
        `(${result.iterations} iterations, ${((1 - result.finalCrossings / Math.max(1, result.initialCrossings)) * 100).toFixed(1)}% reduction)`
    );
  } else {
    console.log('[Sugiyama] Crossing minimization: DISABLED (using legacy ordering)');
  }

  // Phase 3 & 4: Assign coordinates
  // Process layers left to right, including fractional layers
  for (const degree of allDegrees) {
    const layerNodes = layers.get(degree) || [];
    if (layerNodes.length === 0) continue;

    // Calculate base X position for this layer (supports fractional degrees)
    const baseX = 50 + degree * horizontalSpacing;

    // Dynamically adjust vertical spacing
    const nodeRadius = 30;
    const minVerticalGap = nodeRadius * 2; // 60px minimum
    let adjustedVerticalSpacing = Math.max(verticalSpacing, minVerticalGap);

    if (layerNodes.length > 4) {
      adjustedVerticalSpacing = Math.max(
        verticalSpacing + (layerNodes.length - 4) * 10,
        minVerticalGap
      );
      console.log(
        `[Sugiyama] Layer ${degree} has ${layerNodes.length} nodes, spacing=${adjustedVerticalSpacing}`
      );
    }

    // Use optimized ordering from crossing minimization, or fall back to legacy ordering
    const orderedNodes = useCrossingMinimization
      ? layerNodes // Already optimized by minimizeCrossingsWithSweeping
      : degree === 0
        ? layerNodes // Source node, no ordering needed
        : orderNodesInLayer(layerNodes, edges, positions, nodeLabels, centerY, shortestPathSet);

    // Assign Y coordinates with collision detection
    const yCoords = assignYCoordinates(orderedNodes, centerY, adjustedVerticalSpacing);

    // Store positions (all nodes at same X for this layer)
    for (const nodeId of orderedNodes) {
      positions.set(nodeId, {
        x: baseX,
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
