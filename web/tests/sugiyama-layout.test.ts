/**
 * Unit tests for Sugiyama layout algorithm
 *
 * Tests each phase independently with the Ohio State → Miami example
 */

import { describe, it, expect } from 'vitest';
import {
  assignNodesToLayers,
  calculateBarycenter,
  orderNodesInLayer,
  assignYCoordinates,
  computeSugiyamaLayout,
  convertPositionsToObject,
} from '../modules/sugiyama-layout.js';

// Test data: Ohio State vs Miami with 2 parallel 3-hop paths
const testPathFilter = {
  nodes: ['ohio-state', 'purdue', 'notre-dame', 'miami', 'texas', 'florida'],
  edges: [
    'ohio-state__purdue',
    'notre-dame__purdue',
    'miami__notre-dame',
    'ohio-state__texas',
    'florida__texas',
    'florida__miami',
  ],
  source: 'ohio-state',
  destination: 'miami',
  shortestPathNodes: ['ohio-state', 'purdue', 'notre-dame', 'miami'],
  nodeLabels: {
    'ohio-state': 'Ohio State',
    purdue: 'Purdue',
    'notre-dame': 'Notre Dame',
    miami: 'Miami',
    texas: 'Texas',
    florida: 'Florida',
  },
};

describe('Sugiyama Layout - Phase 1: Layer Assignment', () => {
  it('should assign nodes to correct layers based on distance from source', () => {
    const layers = assignNodesToLayers(testPathFilter);

    // Source always at layer 0
    expect(layers.get(0)!).toEqual(['ohio-state']);

    // Layer 1: Direct connections from source
    // Note: Some nodes may be moved to fractional layers (1.5) if they are bridge nodes
    const layer1 = layers.get(1) || [];
    const layer1_5 = layers.get(1.5) || [];
    const allLayer1ish = [...layer1, ...layer1_5];

    expect(allLayer1ish).toContain('purdue');
    expect(allLayer1ish).toContain('texas');
    expect(allLayer1ish.length).toBeGreaterThanOrEqual(2);

    // Layer 2: Second hop from source
    // Notre Dame and Florida may be at 2 or 2.5 depending on bridge detection
    const layer2 = layers.get(2) || [];
    const layer2_5 = layers.get(2.5) || [];
    const allLayer2ish = [...layer2, ...layer2_5];

    expect(allLayer2ish).toContain('notre-dame');
    expect(allLayer2ish).toContain('florida');

    // Destination at layer 3 (or potentially 3.5)
    const layer3 = layers.get(3) || [];
    const layer3_5 = layers.get(3.5) || [];
    expect([...layer3, ...layer3_5]).toContain('miami');
  });

  it('should NOT detect bridge nodes when all nodes are on weighted shortest path or do not provide shorter hops', () => {
    const layers = assignNodesToLayers(testPathFilter);

    // Bridge detection criteria:
    // 1. Node is NOT on weighted shortest path (ohio-state, purdue, notre-dame, miami)
    // 2. Node connects DIRECTLY to destination
    // 3. Hop count via this node is LESS than weighted path hops (3)
    //
    // In this graph:
    // - purdue: ON weighted path → not a bridge
    // - texas: NOT on path, but doesn't connect to miami → not a bridge
    // - florida: NOT on path, DOES connect to miami, but at 2 hops (same as weighted path ohio-state→purdue→notre-dame) → not a bridge
    //
    // Therefore, NO bridge nodes should be detected
    const fractionalLayers = Array.from(layers.keys()).filter(key => key % 1 !== 0);
    expect(fractionalLayers.length).toBe(0);
  });

  it('should handle single-node layers', () => {
    const layers = assignNodesToLayers(testPathFilter);

    const layer0 = layers.get(0) || [];
    expect(layer0).toHaveLength(1);
    expect(layer0).toContain('ohio-state');
  });
});

describe('Sugiyama Layout - Phase 2: Barycenter Calculation', () => {
  it('should calculate barycenter as average of neighbor Y positions', () => {
    const positions = new Map([
      ['ohio-state', { x: 50, y: 300 }],
      ['purdue', { x: 270, y: 250 }], // Y = 250
      ['texas', { x: 270, y: 350 }], // Y = 350
    ]);

    // Notre Dame connects to Purdue (Y=250)
    const notreDameBarycenter = calculateBarycenter('notre-dame', testPathFilter.edges, positions);
    expect(notreDameBarycenter).toBe(250);

    // Florida connects to Texas (Y=350)
    const floridaBarycenter = calculateBarycenter('florida', testPathFilter.edges, positions);
    expect(floridaBarycenter).toBe(350);
  });

  it('should return null when node has no positioned neighbors', () => {
    const positions = new Map([['ohio-state', { x: 50, y: 300 }]]);

    // Use a node that doesn't connect to ohio-state
    const barycenter = calculateBarycenter('miami', testPathFilter.edges, positions);
    expect(barycenter).toBeNull();
  });
});

describe('Sugiyama Layout - Phase 3: Node Ordering', () => {
  it('should order nodes by barycenter to minimize crossings', () => {
    // Set up: Purdue above (Y=250), Texas below (Y=350)
    const positions = new Map([
      ['ohio-state', { x: 50, y: 300 }],
      ['purdue', { x: 270, y: 250 }],
      ['texas', { x: 270, y: 350 }],
    ]);

    const layer2Nodes = ['notre-dame', 'florida'];
    const ordered = orderNodesInLayer(
      layer2Nodes,
      testPathFilter.edges,
      positions,
      testPathFilter.nodeLabels,
      300
    );

    // Notre Dame connects to Purdue (Y=250) → barycenter = 250
    // Florida connects to Texas (Y=350) → barycenter = 350
    // Notre Dame should come first (lower barycenter = higher on screen)
    expect(ordered).toEqual(['notre-dame', 'florida']);
  });

  it('should use alphabetical order as tie-breaker when barycenters are equal', () => {
    const positions = new Map([
      ['ohio-state', { x: 50, y: 300 }],
      ['purdue', { x: 270, y: 300 }],
      ['texas', { x: 270, y: 300 }],
    ]);

    const layer2Nodes = ['texas', 'purdue']; // Reversed alphabetically
    const ordered = orderNodesInLayer(
      layer2Nodes,
      testPathFilter.edges,
      positions,
      testPathFilter.nodeLabels,
      300
    );

    expect(ordered).toEqual(['purdue', 'texas']); // Alphabetical: P before T
  });
});

describe('Sugiyama Layout - Phase 4: Y-Coordinate Assignment', () => {
  it('should center single node at centerY', () => {
    const yCoords = assignYCoordinates(['ohio-state'], 300, 90);

    expect(yCoords.get('ohio-state')!).toBe(300);
  });

  it('should distribute two nodes symmetrically around centerY', () => {
    const yCoords = assignYCoordinates(['purdue', 'texas'], 300, 90);

    expect(yCoords.get('purdue')!).toBe(255); // 300 - 45
    expect(yCoords.get('texas')!).toBe(345); // 300 + 45
  });

  it('should space nodes evenly with correct vertical spacing', () => {
    const nodes = ['a', 'b', 'c'];
    const yCoords = assignYCoordinates(nodes, 300, 100);

    expect(yCoords.get('a')!).toBe(200); // 300 - 100
    expect(yCoords.get('b')!).toBe(300); // 300
    expect(yCoords.get('c')!).toBe(400); // 300 + 100
  });
});

describe('Sugiyama Layout - Full Integration', () => {
  it('should produce correct layout for Ohio State → Miami example', () => {
    const positions = computeSugiyamaLayout(testPathFilter, 800, 600, 220, 90);

    // Check all nodes are positioned
    expect(positions.size).toBe(6);

    // Layer 0: Ohio State at leftmost position
    expect(positions.get('ohio-state')!.x).toBe(50);
    expect(positions.get('ohio-state')!.y).toBe(300);

    // Layer 1 (or 1.5 if bridge detected): Purdue and Texas
    // With bridge detection threshold >1, nodes may be at fractional layers
    const purduePos = positions.get('purdue')!;
    const texasPos = positions.get('texas')!;

    // All nodes in same layer should have same X coordinate
    expect(purduePos.x).toBe(texasPos.x); // Same layer, same X
    expect(purduePos.x).toBeGreaterThan(50); // To the right of Ohio State

    // Verify nodes are vertically separated
    const purdueY = purduePos.y;
    const texasY = texasPos.y;
    expect(Math.abs(purdueY - texasY)).toBeGreaterThanOrEqual(60); // At least 60px apart

    // Layer 2: Notre Dame and Florida
    const notreDamePos = positions.get('notre-dame')!;
    const floridaPos = positions.get('florida')!;

    // All nodes in same layer should have same X coordinate
    expect(notreDamePos.x).toBe(floridaPos.x); // Same layer, same X
    expect(notreDamePos.x).toBeGreaterThan(purduePos.x); // To the right of previous layer
    
    // Verify they maintain vertical separation
    const notreDameY = notreDamePos.y;
    const floridaY = floridaPos.y;
    expect(Math.abs(notreDameY - floridaY)).toBeGreaterThanOrEqual(60); // At least 60px apart

    // Layer 3: Miami at rightmost position
    const miamiPos = positions.get('miami')!;
    expect(miamiPos.x).toBeGreaterThan(notreDamePos.x); // To the right of previous layer
    expect(miamiPos.y).toBe(300); // Single node, centered vertically
  });

  it('should prevent edge crossings between parallel paths', () => {
    const positions = computeSugiyamaLayout(testPathFilter, 800, 600, 220, 90);

    // Top path: Ohio State → Purdue → Notre Dame → Miami
    // Bottom path: Ohio State → Texas → Florida → Miami
    // With horizontal alignment, nodes align with their single neighbors
    // Verify adequate vertical separation between parallel paths
    const notreDameY = positions.get('notre-dame')!.y;
    const floridaY = positions.get('florida')!.y;

    expect(Math.abs(notreDameY - floridaY)).toBeGreaterThanOrEqual(80);
  });
});

describe('Sugiyama Layout - Utilities', () => {
  it('should convert Map positions to object format', () => {
    const positionsMap = new Map([
      ['ohio-state', { x: 50, y: 300 }],
      ['miami', { x: 710, y: 300 }],
    ]);

    const obj = convertPositionsToObject(positionsMap);

    expect(obj).toEqual({
      'ohio-state': { x: 50, y: 300 },
      miami: { x: 710, y: 300 },
    });
  });
});
