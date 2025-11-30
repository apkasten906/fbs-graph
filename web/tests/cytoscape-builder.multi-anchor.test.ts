import { describe, it, expect } from 'vitest';

// @ts-ignore
import { calculateDegreePositions } from '../modules/cytoscape-builder.js';

// Helper to create edge keys in the same format used by the module
function edgeKey(a: string, b: string) {
  return a < b ? `${a}__${b}` : `${b}__${a}`;
}

describe('calculateDegreePositions - multi-anchor bridging', () => {
  it('places a bridging node near the average X of two anchors and is deterministic', () => {
    const width = 800;
    const height = 600;

    const pathFilter = {
      nodesByDegree: new Map([
        ['minnesota', 0],
        ['usc', 2],
        ['notre-dame', 0],
      ]),
      source: 'minnesota',
      destination: 'notre-dame',
      nodes: ['minnesota', 'usc', 'notre-dame'],
      edges: [edgeKey('minnesota', 'usc'), edgeKey('notre-dame', 'usc')],
      shortestPathNodes: ['minnesota', 'notre-dame'],
      nodeLabels: { minnesota: 'Minnesota', usc: 'USC', 'notre-dame': 'Notre Dame' },
    } as any;

    const p1 = calculateDegreePositions(pathFilter, width, height);
    const p2 = calculateDegreePositions(pathFilter, width, height);

    // Anchors should be at 50 and width-50
    const expectedLeft = 50;
    const expectedRight = width - 50;
    const expectedMid = (expectedLeft + expectedRight) / 2;

    // USC should be near the midpoint (allow jitter up to 13px from layout jitter)
    expect(Math.abs(p1['usc'].x - expectedMid)).toBeLessThanOrEqual(13);

    // Deterministic: second run should match exactly
    expect(p1).toEqual(p2);
  });
});
