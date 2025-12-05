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
    // Test 4: Based on actual CSV data and screenshot
    // CSV shows Minnesota->Purdue->Notre Dame is the ONLY 2-hop path
    // Screenshot shows "Shortest path (3 hops): Minnesota -> Oregon -> USC -> Notre Dame"
    // This means Purdue edges have lower leverage than the Oregon-USC route
    const actualEdges = [
      // 2-hop path (low leverage - not chosen)
      [MINNESOTA, PURDUE, 0.35],
      [PURDUE, NOTRE_DAME, 0.30],
      
      // 3-hop weighted shortest path (high leverage - chosen by algorithm)
      [MINNESOTA, OREGON, 0.75],
      [OREGON, USC, 0.85],
      [USC, NOTRE_DAME, 0.80],
      
      // Other Minnesota connections visible in screenshot
      [MINNESOTA, NORTHWESTERN, 0.6],
      [NORTHWESTERN, USC, 0.7],
      [MINNESOTA, IOWA, 0.65],
      [IOWA, USC, 0.7],
      [MINNESOTA, NEBRASKA, 0.65],
      [NEBRASKA, USC, 0.7],
      [MINNESOTA, MICHIGAN_STATE, 0.65],
      [MICHIGAN_STATE, USC, 0.7],
      [MICHIGAN_STATE, BOSTON_COLLEGE, 0.5],
      [MINNESOTA, OHIO_STATE, 0.7],
      [OHIO_STATE, PURDUE, 0.65],
      [MINNESOTA, RUTGERS, 0.5],
      [RUTGERS, PURDUE, 0.55],
      [MINNESOTA, CALIFORNIA, 0.5],
      [CALIFORNIA, STANFORD, 0.6],
      
      // Notre Dame connections
      [PURDUE, USC, 0.7],
      [STANFORD, NOTRE_DAME, 0.6],
      [BOSTON_COLLEGE, NOTRE_DAME, 0.6],
    ];

    const pairGames4 = makePairGames(actualEdges);
    const result4 = shortestPathByInverseLeverage(MINNESOTA, NOTRE_DAME, pairGames4, teams, "ALL", 0);
    
    console.log("\nActual browser data scenario:");
    console.log("  Result:", result4?.nodes);
    console.log("  Path weights (inverse leverage = 1 - leverage):");
    console.log("    Oregon-USC: (1-0.75) + (1-0.85) + (1-0.80) = 0.60");
    console.log("    Purdue (2 hops): (1-0.35) + (1-0.30) = 1.35");
    console.log("  Oregon-USC path wins because 0.60 < 1.35");
    console.log("  High-leverage 3-hop path beats low-leverage 2-hop path!");
    
    // The Oregon-USC path should be chosen (matches screenshot)
    expect(result4?.nodes).toEqual([MINNESOTA, OREGON, USC, NOTRE_DAME]);
  });
});
