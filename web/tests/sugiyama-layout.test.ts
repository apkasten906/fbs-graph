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

    expect(layers.get(0)).toEqual(['ohio-state']);
    expect(layers.get(1)).toContain('purdue');
    expect(layers.get(1)).toContain('texas');
    expect(layers.get(1)).toHaveLength(2);
    expect(layers.get(2)).toContain('notre-dame');
    expect(layers.get(2)).toContain('florida');
    expect(layers.get(2)).toHaveLength(2);
    expect(layers.get(3)).toEqual(['miami']);
  });

  it('should handle single-node layers', () => {
    const layers = assignNodesToLayers(testPathFilter);

    expect(layers.get(0)).toHaveLength(1);
    expect(layers.get(3)).toHaveLength(1);
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

    expect(yCoords.get('ohio-state')).toBe(300);
  });

  it('should distribute two nodes symmetrically around centerY', () => {
    const yCoords = assignYCoordinates(['purdue', 'texas'], 300, 90);

    expect(yCoords.get('purdue')).toBe(255); // 300 - 45
    expect(yCoords.get('texas')).toBe(345); // 300 + 45
  });

  it('should space nodes evenly with correct vertical spacing', () => {
    const nodes = ['a', 'b', 'c'];
    const yCoords = assignYCoordinates(nodes, 300, 100);

    expect(yCoords.get('a')).toBe(200); // 300 - 100
    expect(yCoords.get('b')).toBe(300); // 300
    expect(yCoords.get('c')).toBe(400); // 300 + 100
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

    // Layer 1: Purdue and Texas
    expect(positions.get('purdue')!.x).toBe(270);
    expect(positions.get('texas')!.x).toBe(270);
    // Purdue should be above Texas (or equal if alphabetical)
    expect(positions.get('purdue')!.y).toBeLessThanOrEqual(positions.get('texas')!.y);

    // Layer 2: Notre Dame and Florida
    expect(positions.get('notre-dame')!.x).toBe(490);
    expect(positions.get('florida')!.x).toBe(490);
    // Notre Dame should be above Florida (connects to Purdue which is above)
    expect(positions.get('notre-dame')!.y).toBeLessThan(positions.get('florida')!.y);

    // Layer 3: Miami at rightmost position
    expect(positions.get('miami')!.x).toBe(710);
    expect(positions.get('miami')!.y).toBe(300);
  });

  it('should prevent edge crossings between parallel paths', () => {
    const positions = computeSugiyamaLayout(testPathFilter, 800, 600, 220, 90);

    // Top path: Ohio State → Purdue → Notre Dame → Miami
    // Bottom path: Ohio State → Texas → Florida → Miami
    // Notre Dame must be above Florida for no crossing
    const notreDameY = positions.get('notre-dame')!.y;
    const floridaY = positions.get('florida')!.y;

    expect(notreDameY).toBeLessThan(floridaY);
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
