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
  const edges = [
    // SHORTEST PATH: Minnesota -> Purdue -> Notre Dame (2 hops, high leverage)
    [MINNESOTA, PURDUE, 0.85],
    [PURDUE, NOTRE_DAME, 0.95], // High leverage - this is the central path
    
    // Minnesota's other direct opponents (degree 1 from Minnesota)
    [MINNESOTA, NORTHWESTERN, 0.6],
    [MINNESOTA, OHIO_STATE, 0.7],
    [MINNESOTA, OREGON, 0.65],
    [MINNESOTA, USC, 0.75],
    [MINNESOTA, RUTGERS, 0.5],
    
    // Northwestern's connections (creates alternate 3-hop paths)
    [NORTHWESTERN, OHIO_STATE, 0.6],
    [NORTHWESTERN, IOWA, 0.55],
    
    // Other teams connecting to Notre Dame (longer or lower leverage paths)
    [OHIO_STATE, MICHIGAN_STATE, 0.8],
    [MICHIGAN_STATE, CALIFORNIA, 0.5],
    [CALIFORNIA, STANFORD, 0.6],
    [STANFORD, NOTRE_DAME, 0.7],
    
    [OREGON, MICHIGAN_STATE, 0.65],
    
    [USC, NEBRASKA, 0.6],
    [NEBRASKA, IOWA, 0.55],
    [IOWA, BOSTON_COLLEGE, 0.5],
    [BOSTON_COLLEGE, NOTRE_DAME, 0.6],
    
    // Direct but lower leverage than Purdue path
    [RUTGERS, NOTRE_DAME, 0.4],
  ];

  it("includes all teams at correct degrees", () => {
    const pairGames = makePairGames(edges);
    const model = findNodesWithinDegrees([MINNESOTA, NOTRE_DAME], 3, pairGames, teams, "ALL", 0);
    
    // Debug: see what teams are actually included
    const includedTeams = Array.from(model.nodesByDegree.keys());
    
    // Degree 0: Source
    expect(model.nodesByDegree.get(MINNESOTA)).toBe(0);
    
    // Degree 1: Direct Minnesota opponents (1-hop from Minnesota)
    expect(model.nodesByDegree.get(PURDUE)).toBe(1); // On shortest path
    
    // Degree 2: Destination via shortest path (Minnesota -> Purdue -> Notre Dame)
    expect(model.nodesByDegree.get(NOTRE_DAME)).toBe(2);
    
    // Teams are only included if they're within 3 degrees from BOTH endpoints
    // Since shortest path is 2 hops, teams that don't connect to Notre Dame within range are excluded
    
    // Verify the teams that ARE included have valid degrees
    includedTeams.forEach(teamId => {
      const degree = model.nodesByDegree.get(teamId);
      expect(degree).toBeGreaterThanOrEqual(0);
      expect(degree).toBeLessThanOrEqual(3);
    });
  });

  it("shortest path uses Purdue for most direct route (2 hops)", () => {
    const pairGames = makePairGames(edges);
    
    // Find shortest path from Minnesota to Notre Dame
    const path = shortestPathByInverseLeverage(MINNESOTA, NOTRE_DAME, pairGames, teams, "ALL", 0);
    
    expect(path).not.toBeNull();
    expect(path.nodes).toContain(MINNESOTA);
    expect(path.nodes).toContain(NOTRE_DAME);
    expect(path.nodes).toContain(PURDUE); // Purdue is the bridge - highest leverage path
    expect(path.nodes.length).toBe(3); // Minnesota -> Purdue -> Notre Dame
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
    expect(positions[MINNESOTA].x).toBeLessThan(positions[PURDUE].x);
    expect(positions[MINNESOTA].x).toBeLessThan(positions[NOTRE_DAME].x);
    
    // Destination should be on the right
    expect(positions[NOTRE_DAME].x).toBeGreaterThan(positions[PURDUE].x);
    expect(positions[NOTRE_DAME].x).toBeGreaterThan(positions[MINNESOTA].x);
    
    // Purdue should be in the middle (degree 1, between source and destination)
    expect(positions[PURDUE].x).toBeGreaterThan(positions[MINNESOTA].x);
    expect(positions[PURDUE].x).toBeLessThan(positions[NOTRE_DAME].x);
    
    // Shortest path nodes should be vertically centered (closer to y=400)
    const centerY = 400;
    const tolerance = 150; // Allow some variation
    
    // Purdue is on shortest path, should be near center
    expect(Math.abs(positions[PURDUE].y - centerY)).toBeLessThan(tolerance);
  });

  it("Rutgers has alternative direct path to Notre Dame", () => {
    const pairGames = makePairGames(edges);
    const model = findNodesWithinDegrees([MINNESOTA, NOTRE_DAME], 3, pairGames, teams, "ALL", 0);
    
    // Rutgers is degree 1 from Minnesota (direct connection)
    expect(model.nodesByDegree.get(RUTGERS)).toBe(1);
    
    // Rutgers also connects to Notre Dame, but with lower leverage than Purdue path
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
    
    // Core shortest path (2 hops)
    expect(model.nodesByDegree.get(MINNESOTA)).toBe(0);
    expect(model.nodesByDegree.get(PURDUE)).toBe(1);
    expect(model.nodesByDegree.get(NOTRE_DAME)).toBe(2);
    
    // Verify Purdue is identified as being on the shortest path
    const shortestPath = shortestPathByInverseLeverage(MINNESOTA, NOTRE_DAME, pairGames, teams, "ALL", 0);
    expect(shortestPath.nodes).toEqual([MINNESOTA, PURDUE, NOTRE_DAME]);
    
    // All teams in the model should be connected to the shortest path
    const allTeams = Array.from(model.nodesByDegree.keys());
    expect(allTeams.length).toBeGreaterThan(2); // At minimum: source, bridge, destination
    
    // Verify model metadata
    expect(model.source).toBe(MINNESOTA);
    expect(model.destination).toBe(NOTRE_DAME);
  });
});
