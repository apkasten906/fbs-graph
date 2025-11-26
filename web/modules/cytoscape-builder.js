/**
 * Cytoscape Graph Builder Module
 *
 * Handles construction of Cytoscape graph elements from game and team data.
 * Provides functions for building nodes, edges, and calculating layouts.
 */

/**
 * Conference color mapping for nodes
 */
export const COLORS = {
  acc: '#00539F',
  'big-ten': '#CC0000',
  'big-12': '#003594',
  sec: '#0033A0',
  pac: '#8C1515',
  'mountain-west': '#003366',
  'american-athletic': '#003087',
  'sun-belt': '#003366',
  'conference-usa': '#003087',
  mac: '#CC0000',
  independent: '#666666',
  other: '#444444',
};

/**
 * Degree-based color scheme for edges in comparison view
 */
export const DEGREE_COLORS = [
  '#00FF00', // 0: Bright Green (direct connection)
  '#FFFF00', // 1: Bright Yellow (1 hop)
  '#FFA500', // 2: Orange (2 hops)
  '#FF6B35', // 3: Orange-Red (3 hops)
  '#FF4500', // 4: Red-Orange (4 hops)
  '#DC143C', // 5: Crimson (5 hops)
  '#8B0000', // 6: Dark Red (6 hops)
];

/**
 * Creates a consistent edge key from two team IDs
 * @param {string} a - First team ID
 * @param {string} b - Second team ID
 * @returns {string} Alphabetically sorted key "a__b"
 */
export function createEdgeKey(a, b) {
  return a < b ? `${a}__${b}` : `${b}__${a}`;
}

/**
 * Builds graph elements (nodes and edges) from team and game data
 *
 * @param {Object} params - Build parameters
 * @param {Array} params.teams - Array of team objects with id, name, conference
 * @param {Array} params.games - Array of game objects with home, away, type, leverage
 * @param {Map} params.teamIndex - Map of team ID to team object (will be populated)
 * @param {Map} params.pairGames - Map of edge key to game array (will be populated)
 * @param {string} params.typeFilter - Game type filter: 'ALL', 'CONFERENCE', 'NON_CONFERENCE'
 * @param {number} params.minLeverage - Minimum leverage threshold
 * @param {Object|null} params.pathFilter - Optional path filter with nodes, edges, nodesByDegree
 * @returns {Array} Array of Cytoscape elements (nodes and edges)
 */
export function buildGraphElements({
  teams,
  games,
  teamIndex,
  pairGames,
  typeFilter,
  minLeverage,
  pathFilter = null,
}) {
  const els = [];
  teamIndex.clear();
  teams.forEach(t => teamIndex.set(t.id, t));

  // Filter teams to show (all or just path nodes)
  const teamsToShow = pathFilter
    ? teams.filter(t => pathFilter.nodes.includes(t.id))
    : teams;

  // Build nodes
  for (const t of teamsToShow) {
    const conf = (t.conference && t.conference.id) || 'other';
    els.push({
      group: 'nodes',
      data: { id: t.id, label: t.name, conf },
      classes: conf,
    });
  }

  // Build edges with aggregation by pair
  pairGames.clear();
  const edges = new Map();

  for (const g of games) {
    if (typeFilter !== 'ALL' && g.type !== typeFilter) continue;
    const lev = typeof g.leverage === 'number' ? g.leverage : 0;
    if (lev < minLeverage) continue;

    const a = g.home.id;
    const b = g.away.id;
    if (!teamIndex.has(a) || !teamIndex.has(b)) continue;

    const k = createEdgeKey(a, b);
    const arr = pairGames.get(k) || [];
    arr.push(g);
    pairGames.set(k, arr);
  }

  // Process edges
  for (const [k, list] of pairGames) {
    // Skip edge if pathFilter is active and edge is not in path
    if (pathFilter && !pathFilter.edges.includes(k)) continue;

    const a = list[0].home.id;
    const b = list[0].away.id;
    const sumLev = list.reduce((s, x) => s + (x.leverage || 0), 0);
    const avgLev = sumLev / list.length;
    const w = Math.max(1, Math.log2(1 + sumLev * 4));

    // Calculate edge color based on degree of separation in comparison path
    let edgeColor = '#4562aa'; // Default blue
    if (pathFilter && pathFilter.nodesByDegree && pathFilter.source && pathFilter.destination) {
      const degreeA = pathFilter.nodesByDegree.get(a) || 0;
      const degreeB = pathFilter.nodesByDegree.get(b) || 0;
      const edgeDegree = Math.max(degreeA, degreeB);
      edgeColor = DEGREE_COLORS[Math.min(edgeDegree, DEGREE_COLORS.length - 1)];
    }

    edges.set(k, { a, b, count: list.length, sumLev, avgLev, weight: w, edgeColor });
  }

  // Convert edges to Cytoscape format
  for (const [k, e] of edges) {
    els.push({
      group: 'edges',
      data: {
        id: 'e_' + k,
        source: e.a,
        target: e.b,
        label: `${e.count}`,
        weight: e.weight,
        avgLev: e.avgLev,
        edgeColor: e.edgeColor,
      },
    });
  }

  return els;
}

/**
 * Calculate node positions based on degree of separation from source
 *
 * @param {Object} pathFilter - Path filter with nodesByDegree, source, destination
 * @param {number} width - Canvas width (default: 800)
 * @param {number} height - Canvas height (default: 600)
 * @returns {Object} Map of nodeId to {x, y} position
 */
export function calculateDegreePositions(pathFilter, width = 800, height = 600) {
  const positions = {};
  const nodesByDegree = pathFilter.nodesByDegree;
  const source = pathFilter.source;
  const destination = pathFilter.destination;
  const maxDegree = Math.max(...nodesByDegree.values());

  // Group nodes by their degree
  const degreeGroups = new Map();
  for (const [nodeId, degree] of nodesByDegree) {
    if (!degreeGroups.has(degree)) {
      degreeGroups.set(degree, []);
    }
    degreeGroups.get(degree).push(nodeId);
  }

  const centerY = height / 2;

  // Special handling for source and destination to be on same horizontal plane
  const sourceX = 50;
  const destX = width - 50;

  positions[source] = { x: sourceX, y: centerY };
  positions[destination] = { x: destX, y: centerY };

  // Position intermediate nodes (degrees 1 to maxDegree)
  const horizontalSpacing =
    maxDegree > 0 ? (destX - sourceX) / (maxDegree + 1) : (destX - sourceX) / 2;

  for (let degree = 1; degree <= maxDegree; degree++) {
    const nodesAtDegree = (degreeGroups.get(degree) || []).filter(
      id => id !== source && id !== destination
    );
    if (nodesAtDegree.length === 0) continue;

    const x = sourceX + horizontalSpacing * degree;

    // Distribute nodes vertically, avoiding the center line where source/dest are positioned
    const topY = centerY * 0.4; // Top boundary
    const bottomY = centerY * 1.6; // Bottom boundary

    nodesAtDegree.forEach((nodeId, index) => {
      // Distribute evenly, but skip the center area
      const fraction = (index + 1) / (nodesAtDegree.length + 1);
      let y;
      if (fraction < 0.5) {
        // Top half
        y = topY + fraction * 2 * (centerY - topY - 50);
      } else {
        // Bottom half
        y = centerY + 50 + (fraction - 0.5) * 2 * (bottomY - centerY - 50);
      }
      positions[nodeId] = { x, y };
    });
  }

  return positions;
}

/**
 * Create Cytoscape style configuration
 *
 * @returns {Array} Cytoscape style array
 */
export function createCytoscapeStyle() {
  return [
    {
      selector: 'node',
      style: {
        'background-color': ele => COLORS[ele.data('conf')] || COLORS.other,
        label: 'data(label)',
        color: '#cfe1ff',
        'font-size': '9px',
        'text-outline-color': '#0b1020',
        'text-outline-width': 2,
        width: 'mapData(deg, 0, 24, 8, 34)',
        height: 'mapData(deg, 0, 24, 8, 34)',
      },
    },
    {
      selector: 'edge',
      style: {
        'line-color': ele => ele.data('edgeColor') || '#4562aa',
        width: ele => Math.max(1.5, ele.data('weight') || 1.5),
        opacity: 0.7,
        'curve-style': 'haystack',
      },
    },
    { selector: 'edge:selected', style: { 'line-color': '#fff', opacity: 1 } },
    {
      selector: '.highlight',
      style: { 'line-color': '#fff', 'background-color': '#fff', opacity: 1 },
    },
  ];
}

/**
 * Create layout configuration for Cytoscape
 *
 * @param {Object|null} pathFilter - Optional path filter for preset layout
 * @param {number} width - Canvas width for preset layout
 * @param {number} height - Canvas height for preset layout
 * @returns {Object} Cytoscape layout configuration
 */
export function createLayoutConfig(pathFilter = null, width = 800, height = 600) {
  if (pathFilter) {
    // Preset layout with calculated positions
    return {
      name: 'preset',
      positions: calculateDegreePositions(pathFilter, width, height),
      fit: true,
      padding: 50,
      avoidOverlap: true,
      nodeDimensionsIncludeLabels: true,
    };
  } else {
    // COSE (force-directed) layout
    return {
      name: 'cose',
      idealEdgeLength: edge => {
        const avgLev = edge.data('avgLev') || 0.1;
        // Higher leverage = shorter edge (inverse relationship)
        return Math.max(50, Math.min(300, 150 / Math.max(0.1, avgLev)));
      },
      nodeOverlap: 20,
      nodeRepulsion: 8000,
      fit: true,
    };
  }
}
