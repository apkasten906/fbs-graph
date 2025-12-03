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

    // With the new layering algorithm:
    // - Minnesota: dist_from_source=0, layer_offset=0 (path node)
    // - Notre Dame: dist_from_source=2, layer_offset=0 (path node)
    // - USC: dist_from_source=1, dist_to_target=1, layer_offset=0 (also on path!)
    // So USC should be at x = 1 * HORIZONTAL_SPACING = 220
    // (Note: HORIZONTAL_SPACING from cytoscape-builder.js is 220)
    expect(p1['usc'].x).toBe(220);

    // Deterministic: second run should match exactly
    expect(p1).toEqual(p2);
  });
});
