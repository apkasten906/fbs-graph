// @ts-nocheck - Debug test to understand actual Minnesota-Notre Dame path
import { describe, it, expect } from 'vitest';
import { shortestPathByInverseLeverage, edgeKey } from '../modules/graph-path-finder.js';

describe("Debug: Minnesota → Notre Dame Path Analysis", () => {
  const MINNESOTA = "minnesota";
  const NOTRE_DAME = "notre-dame";
  const PURDUE = "purdue";
  const OREGON = "oregon";
  const USC = "usc";
  const NORTHWESTERN = "northwestern";
  const MICHIGAN_STATE = "michigan-state";
  const OHIO_STATE = "ohio-state";
  const IOWA = "iowa";
  const NEBRASKA = "nebraska";
  const CALIFORNIA = "california";
  const STANFORD = "stanford";
  const BOSTON_COLLEGE = "boston-college";
  const RUTGERS = "rutgers";

  const teams = [
    { id: MINNESOTA, name: "Minnesota" },
    { id: NOTRE_DAME, name: "Notre Dame" },
    { id: PURDUE, name: "Purdue" },
    { id: OREGON, name: "Oregon" },
    { id: USC, name: "USC" },
    { id: NORTHWESTERN, name: "Northwestern" },
    { id: MICHIGAN_STATE, name: "Michigan State" },
    { id: OHIO_STATE, name: "Ohio State" },
    { id: IOWA, name: "Iowa" },
    { id: NEBRASKA, name: "Nebraska" },
    { id: CALIFORNIA, name: "California" },
    { id: STANFORD, name: "Stanford" },
    { id: BOSTON_COLLEGE, name: "Boston College" },
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

  it("shows why Oregon-USC path is preferred over Purdue with equal leverage", () => {
    // Test 1: All edges have equal leverage
    const equalLeverageEdges = [
      [MINNESOTA, PURDUE, 0.5],
      [PURDUE, NOTRE_DAME, 0.5],
      [MINNESOTA, OREGON, 0.5],
      [OREGON, USC, 0.5],
      [USC, NOTRE_DAME, 0.5],
    ];

    const pairGames1 = makePairGames(equalLeverageEdges);
    const result1 = shortestPathByInverseLeverage(MINNESOTA, NOTRE_DAME, pairGames1, teams, "ALL", 0);
    
    console.log("Equal leverage paths:");
    console.log("  Result:", result1?.nodes);
    console.log("  Expected: Either [minnesota, purdue, notre-dame] or [minnesota, oregon, usc, notre-dame]");
    
    // With equal leverage, both 2-hop and 3-hop paths are possible
    // The algorithm will choose based on iteration order
  });

  it("shows Purdue path preferred when it has higher leverage", () => {
    // Test 2: Purdue path has higher leverage (lower inverse weight)
    const purdueHigherEdges = [
      [MINNESOTA, PURDUE, 0.95],      // High leverage
      [PURDUE, NOTRE_DAME, 0.95],     // High leverage
      [MINNESOTA, OREGON, 0.5],       // Lower leverage
      [OREGON, USC, 0.5],             // Lower leverage
      [USC, NOTRE_DAME, 0.5],         // Lower leverage
    ];

    const pairGames2 = makePairGames(purdueHigherEdges);
    const result2 = shortestPathByInverseLeverage(MINNESOTA, NOTRE_DAME, pairGames2, teams, "ALL", 0);
    
    console.log("\nPurdue path has higher leverage:");
    console.log("  Result:", result2?.nodes);
    console.log("  Path weights:");
    console.log("    Purdue: (1-0.95) + (1-0.95) = 0.1");
    console.log("    Oregon-USC: (1-0.5) + (1-0.5) + (1-0.5) = 1.5");
    
    expect(result2?.nodes).toEqual([MINNESOTA, PURDUE, NOTRE_DAME]);
  });

  it("shows Oregon-USC path preferred when it has higher cumulative leverage", () => {
    // Test 3: Oregon-USC path has higher leverage per hop
    const oregonHigherEdges = [
      [MINNESOTA, PURDUE, 0.5],       // Lower leverage
      [PURDUE, NOTRE_DAME, 0.5],      // Lower leverage
      [MINNESOTA, OREGON, 0.9],       // High leverage
      [OREGON, USC, 0.9],             // High leverage
      [USC, NOTRE_DAME, 0.9],         // High leverage
    ];

    const pairGames3 = makePairGames(oregonHigherEdges);
    const result3 = shortestPathByInverseLeverage(MINNESOTA, NOTRE_DAME, pairGames3, teams, "ALL", 0);
    
    console.log("\nOregon-USC path has higher leverage:");
    console.log("  Result:", result3?.nodes);
    console.log("  Path weights:");
    console.log("    Purdue: (1-0.5) + (1-0.5) = 1.0");
    console.log("    Oregon-USC: (1-0.9) + (1-0.9) + (1-0.9) = 0.3");
    
    expect(result3?.nodes).toEqual([MINNESOTA, OREGON, USC, NOTRE_DAME]);
  });

  it("reproduces the actual browser behavior from user data", () => {
    // Test 4: Use the actual edges from user's screenshot
    // Based on visible edges in the graph visualization
    const actualEdges = [
      // Minnesota connections (visible in graph)
      [MINNESOTA, NORTHWESTERN, 0.6],
      [NORTHWESTERN, USC, 0.7],
      [MINNESOTA, OREGON, 0.65],         // Visible green edge
      [OREGON, USC, 0.75],               // Visible green edge
      [MINNESOTA, MICHIGAN_STATE, 0.7],  // Higher leverage than expected!
      [MICHIGAN_STATE, USC, 0.7],
      [MINNESOTA, IOWA, 0.6],
      [IOWA, USC, 0.7],
      [MINNESOTA, NEBRASKA, 0.6],
      [NEBRASKA, USC, 0.7],
      [MINNESOTA, PURDUE, 0.45],         // Lower leverage
      [PURDUE, USC, 0.75],
      [MINNESOTA, OHIO_STATE, 0.6],
      [MINNESOTA, RUTGERS, 0.5],
      [MINNESOTA, CALIFORNIA, 0.5],
      [CALIFORNIA, STANFORD, 0.6],
      [BOSTON_COLLEGE, CALIFORNIA, 0.5],
      [BOSTON_COLLEGE, MICHIGAN_STATE, 0.5],
      
      // Notre Dame connections (visible in graph)
      [NOTRE_DAME, PURDUE, 0.35],        // Lower leverage
      [USC, NOTRE_DAME, 0.8],            // High leverage yellow edge
      [CALIFORNIA, STANFORD, 0.6],
      [STANFORD, NOTRE_DAME, 0.6],       // Visible yellow edge
      [BOSTON_COLLEGE, NOTRE_DAME, 0.6], // Visible red edge
      [MICHIGAN_STATE, NOTRE_DAME, 0.75], // HIGHEST LEVERAGE - THIS IS THE KEY!
    ];

    const pairGames4 = makePairGames(actualEdges);
    const result4 = shortestPathByInverseLeverage(MINNESOTA, NOTRE_DAME, pairGames4, teams, "ALL", 0);
    
    console.log("\nActual browser data scenario:");
    console.log("  Result:", result4?.nodes);
    console.log("  Path weights (inverse leverage = 1 - leverage):");
    console.log("    Michigan State: (1-0.7) + (1-0.75) = 0.55");
    console.log("    Purdue: (1-0.45) + (1-0.35) = 1.2");
    console.log("    Oregon-USC: (1-0.65) + (1-0.75) + (1-0.8) = 0.8");
    console.log("  Michigan State path wins because 0.55 < 0.8 < 1.2");
    
    // The Michigan State path should be chosen (actual behavior)
    expect(result4?.nodes).toEqual([MINNESOTA, MICHIGAN_STATE, NOTRE_DAME]);
  });
});
