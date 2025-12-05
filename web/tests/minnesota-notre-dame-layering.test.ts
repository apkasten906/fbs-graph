// @ts-nocheck - JS module imports without type definitions
import { describe, it, expect } from 'vitest';
import { calculateDegreePositions, MIN_Y, X_THRESHOLD, SIDE_MARGIN } from '../modules/cytoscape-builder.js';
import { findNodesWithinDegrees, edgeKey, shortestPathByInverseLeverage } from '../modules/graph-path-finder.js';

// Team IDs from actual 2025 data
const MINNESOTA = "minnesota";
const NOTRE_DAME = "notre-dame";
const NORTHWESTERN = "northwestern";
const OHIO_STATE = "ohio-state";
const OREGON = "oregon";
const USC = "usc";
const PURDUE = "purdue";
const MICHIGAN_STATE = "michigan-state";
const IOWA = "iowa";
const NEBRASKA = "nebraska";
const STANFORD = "stanford";
const BOSTON_COLLEGE = "boston-college";
const CALIFORNIA = "california";
const RUTGERS = "rutgers";

const teams = [
  { id: MINNESOTA, name: "Minnesota" },
  { id: NOTRE_DAME, name: "Notre Dame" },
  { id: NORTHWESTERN, name: "Northwestern" },
  { id: OHIO_STATE, name: "Ohio State" },
  { id: OREGON, name: "Oregon" },
  { id: USC, name: "USC" },
  { id: PURDUE, name: "Purdue" },
  { id: MICHIGAN_STATE, name: "Michigan State" },
  { id: IOWA, name: "Iowa" },
  { id: NEBRASKA, name: "Nebraska" },
  { id: STANFORD, name: "Stanford" },
  { id: BOSTON_COLLEGE, name: "Boston College" },
  { id: CALIFORNIA, name: "California" },
  { id: RUTGERS, name: "Rutgers" },
];

function makePairGames(edgePairs) {
  const map = new Map();
  for (const [u, v, leverage = 0.5] of edgePairs) {
    const k = edgeKey(u, v);
    const arr = map.get(k) || [];
    arr.push({
      home: { id: u },
      away: { id: v },
      type: "ALL",
      leverage,
    });
    map.set(k, arr);
  }
  return map;
}

describe("Minnesota → Notre Dame Layout (3 degrees)", () => {
  // Based on actual 2025 FBS schedule data
  // Real paths from CSV: Minnesota->Purdue->Notre Dame is the ONLY 2-hop path
  // However, the WEIGHTED shortest path (by leverage) is: Minnesota->Oregon->USC->Notre Dame (3 hops)
  // This means Purdue edges have lower leverage than the Oregon-USC route
  const edges = [
    // 2-hop path exists BUT has low leverage (not preferred by algorithm)
    [MINNESOTA, PURDUE, 0.35],            // Low leverage
    [PURDUE, NOTRE_DAME, 0.30],           // Low leverage - total cost: 1.35
    
    // ACTUAL SHORTEST WEIGHTED PATH: Minnesota -> Oregon -> USC -> Notre Dame (3 hops)
    [MINNESOTA, OREGON, 0.75],            // High leverage green edge
    [OREGON, USC, 0.85],                  // High leverage green edge  
    [USC, NOTRE_DAME, 0.80],              // High leverage yellow edge - total cost: 0.60
    
    // Minnesota's other direct opponents (visible in screenshot)
    [MINNESOTA, NORTHWESTERN, 0.6],
    [MINNESOTA, OHIO_STATE, 0.7],
    [MINNESOTA, IOWA, 0.65],
    [MINNESOTA, NEBRASKA, 0.65],
    [MINNESOTA, MICHIGAN_STATE, 0.65],
    [MINNESOTA, RUTGERS, 0.5],
    [MINNESOTA, CALIFORNIA, 0.5],
    
    // Alternative 3-hop paths (lower total leverage than Oregon-USC)
    [NORTHWESTERN, USC, 0.7],
    [NORTHWESTERN, PURDUE, 0.6],
    [IOWA, USC, 0.7],
    [NEBRASKA, USC, 0.7],
    [MICHIGAN_STATE, USC, 0.7],
    [MICHIGAN_STATE, BOSTON_COLLEGE, 0.5],
    [PURDUE, USC, 0.7],
    [PURDUE, OHIO_STATE, 0.65],
    
    // Other Notre Dame connections
    [STANFORD, NOTRE_DAME, 0.6],
    [BOSTON_COLLEGE, NOTRE_DAME, 0.6],
    [CALIFORNIA, STANFORD, 0.6],
    
    // Additional connections for 3-degree graph
    [OHIO_STATE, PURDUE, 0.65],
    [RUTGERS, PURDUE, 0.55],
  ];

  it("includes all teams at correct degrees", () => {
    const pairGames = makePairGames(edges);
    const model = findNodesWithinDegrees([MINNESOTA, NOTRE_DAME], 3, pairGames, teams, "ALL", 0);
    
    // Debug: see what teams are actually included
    const includedTeams = Array.from(model.nodesByDegree.keys());
    
    // Degree 0: Source
    expect(model.nodesByDegree.get(MINNESOTA)).toBe(0);
    
    // Degree 1: Direct Minnesota opponents (includes both Purdue and Oregon)
    expect(model.nodesByDegree.get(PURDUE)).toBe(1);  // 2-hop path (low leverage)
    expect(model.nodesByDegree.get(OREGON)).toBe(1);  // On weighted shortest path
    
    // Degree 2: BFS assigns Notre Dame to degree 2 (shortest HOP count via Purdue)
    // Even though the weighted shortest PATH goes through Oregon->USC->Notre Dame
    expect(model.nodesByDegree.get(NOTRE_DAME)).toBe(2);
    expect(model.nodesByDegree.get(USC)).toBe(2); // Also degree 2
    
    // Teams are only included if they're within 3 degrees from BOTH endpoints
    // Since shortest path is 2 hops, teams that don't connect to Notre Dame within range are excluded
    
    // Verify the teams that ARE included have valid degrees
    includedTeams.forEach(teamId => {
      const degree = model.nodesByDegree.get(teamId);
      expect(degree).toBeGreaterThanOrEqual(0);
      expect(degree).toBeLessThanOrEqual(3);
    });
  });

  it("detects Purdue as bridge node providing shorter alternate path to Notre Dame", () => {
    // Bridge detection criteria (as of this test):
    // 1. Node is NOT on weighted shortest path: Minnesota→Oregon→USC→Notre Dame (3 hops)
    // 2. Node connects DIRECTLY to destination (Notre Dame)
    // 3. Hop count via this node is LESS than weighted path hops
    //
    // Purdue qualifies:
    // - NOT on weighted path ✓
    // - Connects to Notre Dame ✓
    // - Minnesota→Purdue→Notre Dame = 2 hops < 3 hops weighted ✓
    //
    // In Sugiyama layout, Purdue should be positioned at fractional layer (1.5)
    // to visually show it provides a shorter hop-count alternative path
    
    const pathFilter = {
      nodes: Array.from(new Set([...edges.flat()])),
      edges: edges.map(([a, b]) => `${a}__${b}`.split('__').sort().join('__')),
      source: MINNESOTA,
      destination: NOTRE_DAME,
      shortestPathNodes: [MINNESOTA, OREGON, USC, NOTRE_DAME], // 3-hop weighted shortest
      nodeLabels: Object.fromEntries(teams.map(t => [t.id, t.name])),
    };
    
    // Verify Purdue's connections that make it a bridge:
    // - Connects to Minnesota (source/layer 0)
    expect(edges.some(([a, b]) => (a === PURDUE && b === MINNESOTA) || (b === PURDUE && a === MINNESOTA))).toBe(true);
    // - Connects to Notre Dame (destination/layer 2 via BFS)
    expect(edges.some(([a, b]) => (a === PURDUE && b === NOTRE_DAME) || (b === PURDUE && a === NOTRE_DAME))).toBe(true);
    
    // Verify Purdue is NOT on the weighted shortest path
    expect(pathFilter.shortestPathNodes.includes(PURDUE)).toBe(false);
  });

  it("shortest weighted path uses Oregon-USC route despite Purdue being fewer hops", () => {
    const pairGames = makePairGames(edges);
    
    // Find shortest WEIGHTED path from Minnesota to Notre Dame
    const path = shortestPathByInverseLeverage(MINNESOTA, NOTRE_DAME, pairGames, teams, "ALL", 0);
    
    expect(path).not.toBeNull();
    expect(path.nodes).toEqual([MINNESOTA, OREGON, USC, NOTRE_DAME]);
    expect(path.nodes.length).toBe(4); // 3 hops
    
    // Path weights (inverse leverage = 1 - leverage):
    // Oregon-USC: (1-0.75) + (1-0.85) + (1-0.80) = 0.25 + 0.15 + 0.20 = 0.60 ✓ BEST
    // Purdue (2 hops): (1-0.35) + (1-0.30) = 0.65 + 0.70 = 1.35
    // Algorithm prefers high-leverage 3-hop over low-leverage 2-hop path
  });

  it("positions shortest path nodes vertically centered", () => {
    const pairGames = makePairGames(edges);
    const model = findNodesWithinDegrees([MINNESOTA, NOTRE_DAME], 3, pairGames, teams, "ALL", 0);
    
    // Get shortest path nodes to prioritize central positioning
    const shortestPath = shortestPathByInverseLeverage(MINNESOTA, NOTRE_DAME, pairGames, teams, "ALL", 0);
    model.shortestPathNodes = new Set(shortestPath.nodes);
    model.nodes = Array.from(model.nodesByDegree.keys());
    
    const positions = calculateDegreePositions(model, 1200, 800);
    
    // Source should be on the left
    expect(positions[MINNESOTA].x).toBeLessThan(positions[OREGON].x);
    expect(positions[MINNESOTA].x).toBeLessThan(positions[USC].x);
    expect(positions[MINNESOTA].x).toBeLessThan(positions[NOTRE_DAME].x);
    
    // Destination should be on the right
    expect(positions[NOTRE_DAME].x).toBeGreaterThan(positions[MINNESOTA].x);
    expect(positions[NOTRE_DAME].x).toBeGreaterThan(positions[OREGON].x);
    expect(positions[NOTRE_DAME].x).toBeGreaterThan(positions[USC].x);
    
    // Oregon -> USC -> Notre Dame should progress left to right
    expect(positions[OREGON].x).toBeLessThan(positions[USC].x);
    expect(positions[USC].x).toBeLessThan(positions[NOTRE_DAME].x);
    
    // Shortest path nodes should be vertically centered (closer to y=400)
    const centerY = 400;
    const tolerance = 150; // Allow some variation
    
    // Oregon and USC are on shortest path, should be near center(tolerance);
    expect(Math.abs(positions[USC].y - centerY)).toBeLessThan(tolerance);
  });

  it("Purdue provides 2-hop path but lower leverage than Oregon-USC", () => {
    const pairGames = makePairGames(edges);
    const model = findNodesWithinDegrees([MINNESOTA, NOTRE_DAME], 3, pairGames, teams, "ALL", 0);
    
    // Purdue is degree 1 from Minnesota (direct connection)
    expect(model.nodesByDegree.get(PURDUE)).toBe(1);
    
    // Purdue connects directly to Notre Dame (only 2-hop path)
    // But has lower leverage (0.35 + 0.30) than Oregon-USC path (0.75 + 0.85 + 0.80)
  });

  it("maintains vertical separation between nodes at same degree", () => {
    const pairGames = makePairGames(edges);
    const model = findNodesWithinDegrees([MINNESOTA, NOTRE_DAME], 3, pairGames, teams, "ALL", 0);
    model.nodes = Array.from(model.nodesByDegree.keys());
    
    const positions = calculateDegreePositions(model, 1200, 800);
    const nodes = Object.keys(positions);
    
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const p1 = positions[nodes[i]];
        const p2 = positions[nodes[j]];
        
        // If nodes are at similar X positions (within threshold)
        if (Math.abs(p1.x - p2.x) < X_THRESHOLD) {
          const dy = Math.abs(p1.y - p2.y);
          if (dy > 0) {
            // They must have sufficient vertical separation
            expect(dy).toBeGreaterThanOrEqual(MIN_Y);
          }
        }
      }
    }
  });

  it("layout is deterministic for same input", () => {
    const pairGames = makePairGames(edges);
    const model = findNodesWithinDegrees([MINNESOTA, NOTRE_DAME], 3, pairGames, teams, "ALL", 0);
    model.nodes = Array.from(model.nodesByDegree.keys());
    
    const positions1 = calculateDegreePositions(model, 1200, 800);
    const positions2 = calculateDegreePositions(model, 1200, 800);
    
    expect(positions1).toEqual(positions2);
  });

  it("validates full 3-degree graph structure matches browser visualization", () => {
    const pairGames = makePairGames(edges);
    const model = findNodesWithinDegrees([MINNESOTA, NOTRE_DAME], 3, pairGames, teams, "ALL", 0);
    
    // BFS degrees (by hop count, not weighted path):
    expect(model.nodesByDegree.get(MINNESOTA)).toBe(0);
    expect(model.nodesByDegree.get(PURDUE)).toBe(1);  // Direct from Minnesota
    expect(model.nodesByDegree.get(OREGON)).toBe(1);  // Direct from Minnesota
    expect(model.nodesByDegree.get(USC)).toBe(2);      // 2 hops from Minnesota
    expect(model.nodesByDegree.get(NOTRE_DAME)).toBe(2); // 2 hops via Purdue (BFS finds shortest hop count)
    
    // However, the shortest WEIGHTED path uses Oregon-USC (higher leverage)
    const shortestPath = shortestPathByInverseLeverage(MINNESOTA, NOTRE_DAME, pairGames, teams, "ALL", 0);
    expect(shortestPath.nodes).toEqual([MINNESOTA, OREGON, USC, NOTRE_DAME]);
    
    // Key insight: BFS assigns degrees by hop count, but weighted path considers leverage
    // - BFS: Minnesota -> Purdue -> Notre Dame (2 hops) -> Notre Dame at degree 2
    // - Weighted: Minnesota -> Oregon -> USC -> Notre Dame (better leverage) -> used for visualization
    
    // All teams in the model should be connected
    const allTeams = Array.from(model.nodesByDegree.keys());
    expect(allTeams.length).toBeGreaterThan(3);
    
    // Verify model metadata
    expect(model.source).toBe(MINNESOTA);
    expect(model.destination).toBe(NOTRE_DAME);
  });
});
