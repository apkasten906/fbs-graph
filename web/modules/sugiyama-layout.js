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
 * Phase 4: Assign Y-coordinates to nodes in a layer with horizontal edge alignment
 *
 * Distributes nodes vertically, attempting to align connected nodes at the same Y
 * coordinate to create horizontal edges. Falls back to barycenter-based positioning
 * when horizontal alignment isn't possible.
 *
 * @param {string[]} orderedNodes - Nodes in display order (top to bottom)
 * @param {number} centerY - Center Y coordinate
 * @param {number} verticalSpacing - Space between nodes
 * @param {number} x - X coordinate of this layer
 * @param {Map<string, {x: number, y: number}>} existingPositions - Already positioned nodes
 * @param {string[]} edges - All edges for horizontal alignment
 * @returns {Map<string, number>} Map of node ID to Y coordinate
 */
export function assignYCoordinates(
  orderedNodes,
  centerY,
  verticalSpacing,
  x = null,
  existingPositions = null,
  edges = []
) {
  const yPositions = new Map();

  if (orderedNodes.length === 1) {
    yPositions.set(orderedNodes[0], centerY);
    return yPositions;
  }

  // Try to align nodes horizontally with their neighbors in previous layers
  const tentativePositions = [];
  const aligned = new Set();

  // First pass: align nodes that have a single neighbor in the previous layer
  for (const nodeId of orderedNodes) {
    if (existingPositions) {
      const neighbors = [];
      for (const edgeKey of edges) {
        const [a, b] = edgeKey.split('__');
        if (a === nodeId && existingPositions.has(b)) {
          neighbors.push(existingPositions.get(b));
        } else if (b === nodeId && existingPositions.has(a)) {
          neighbors.push(existingPositions.get(a));
        }
      }

      // If this node has exactly one neighbor, try to align horizontally
      if (neighbors.length === 1) {
        const targetY = neighbors[0].y;
        // Check if this Y position is already taken in this layer
        const alreadyUsed = tentativePositions.some(
          p => Math.abs(p.y - targetY) < verticalSpacing * 0.5
        );

        if (!alreadyUsed) {
          tentativePositions.push({
            nodeId,
            y: targetY,
            aligned: true,
          });
          aligned.add(nodeId);
          continue;
        }
      }
    }
  }

  // Second pass: distribute remaining nodes evenly, avoiding aligned positions
  const unalignedNodes = orderedNodes.filter(n => !aligned.has(n));
  if (unalignedNodes.length > 0) {
    let totalHeight = (orderedNodes.length - 1) * verticalSpacing;
    let startY = centerY - totalHeight / 2;

    unalignedNodes.forEach((nodeId, index) => {
      // Find a Y position that doesn't collide with aligned nodes
      let y = startY + index * verticalSpacing;

      tentativePositions.push({
        nodeId,
        y,
        aligned: false,
      });
    });
  }

  // Sort all positions by Y to maintain order
  tentativePositions.sort((a, b) => a.y - b.y);

  // Sort all positions by Y to maintain order
  tentativePositions.sort((a, b) => a.y - b.y);

  // Collision detection and spacing adjustment
  if (x !== null && existingPositions && existingPositions.size > 0) {
    const nodeRadius = 30;
    const minDistance = nodeRadius * 2.5;

    let hasCollision = true;
    let iterations = 0;
    const maxIterations = 20;

    while (hasCollision && iterations < maxIterations) {
      hasCollision = false;
      iterations++;

      // Check collisions between nodes in this layer
      for (let i = 0; i < tentativePositions.length - 1; i++) {
        const current = tentativePositions[i];
        const next = tentativePositions[i + 1];

        if (Math.abs(current.y - next.y) < verticalSpacing * 0.8) {
          hasCollision = true;
          // Push nodes apart while maintaining alignment for aligned nodes
          if (!current.aligned && !next.aligned) {
            const mid = (current.y + next.y) / 2;
            current.y = mid - verticalSpacing / 2;
            next.y = mid + verticalSpacing / 2;
          } else if (!current.aligned) {
            current.y = next.y - verticalSpacing;
          } else if (!next.aligned) {
            next.y = current.y + verticalSpacing;
          } else {
            // Both aligned - increase spacing globally
            verticalSpacing += 15;
            break;
          }
        }
      }

      // Check collisions with existing positioned nodes
      for (const tentative of tentativePositions) {
        if (tentative.aligned) continue; // Don't move aligned nodes

        for (const [existingNodeId, existingPos] of existingPositions) {
          if (tentative.nodeId === existingNodeId) continue;

          const dx = x - existingPos.x;
          const dy = tentative.y - existingPos.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < minDistance) {
            console.log(
              `[Collision] ${tentative.nodeId} at (${x}, ${tentative.y.toFixed(0)}) collides with ${existingNodeId} at (${existingPos.x.toFixed(0)}, ${existingPos.y.toFixed(0)}), distance=${distance.toFixed(1)} < ${minDistance}`
            );
            hasCollision = true;
            // Move non-aligned node to avoid collision
            tentative.y += verticalSpacing;
            break;
          }
        }
        if (hasCollision) break;
      }
    }

    if (iterations > 1) {
      console.log(
        `[Collision] Resolved after ${iterations} iterations, final spacing=${verticalSpacing}`
      );
    }
  }

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
 * @returns {Map<string, {x: number, y: number}>} Node positions
 */
export function computeSugiyamaLayout(
  pathFilter,
  width = 800,
  height = 600,
  horizontalSpacing = 220,
  verticalSpacing = 100 // Increased from 90 to 100 for better default spacing
) {
  const { source, destination, edges, nodeLabels, shortestPathNodes } = pathFilter;
  const centerY = height / 2;
  const positions = new Map();

  // Convert shortestPathNodes array to Set for faster lookup
  const shortestPathSet = new Set(shortestPathNodes || []);

  // Phase 1: Assign nodes to layers (including fractional layers for bridges)
  const layers = assignNodesToLayers(pathFilter);
  const allDegrees = Array.from(layers.keys()).sort((a, b) => a - b);
  const maxDegree = allDegrees[allDegrees.length - 1];

  // Process layers left to right, including fractional layers
  for (const degree of allDegrees) {
    const layerNodes = layers.get(degree) || [];
    if (layerNodes.length === 0) continue;

    // Calculate X position for this layer (supports fractional degrees)
    const x = 50 + degree * horizontalSpacing;

    // Dynamically adjust vertical spacing based on number of nodes in this layer
    // More nodes = need more space to prevent overlaps
    let adjustedVerticalSpacing = verticalSpacing;
    if (layerNodes.length > 4) {
      // For layers with many nodes, increase spacing significantly
      adjustedVerticalSpacing = verticalSpacing + (layerNodes.length - 4) * 10;
      console.log(
        `[Sugiyama] Layer ${degree} has ${layerNodes.length} nodes, increasing spacing from ${verticalSpacing} to ${adjustedVerticalSpacing}`
      );
    }

    // Order nodes in this layer to minimize crossings
    const orderedNodes =
      degree === 0
        ? layerNodes // Source node, no ordering needed
        : orderNodesInLayer(layerNodes, edges, positions, nodeLabels, centerY, shortestPathSet);

    // Assign Y coordinates with horizontal edge alignment and collision detection
    const yCoords = assignYCoordinates(
      orderedNodes,
      centerY,
      adjustedVerticalSpacing,
      x,
      positions,
      edges // Pass edges for horizontal alignment
    );

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
