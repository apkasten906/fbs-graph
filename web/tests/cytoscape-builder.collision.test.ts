import { describe, it, expect } from 'vitest';

// @ts-ignore
import { calculateDegreePositions, MIN_Y } from '../modules/cytoscape-builder.js';

function edgeKey(a: string, b: string) {
  return a < b ? `${a}__${b}` : `${b}__${a}`;
}

describe('calculateDegreePositions - collision avoidance', () => {
  it('ensures nodes within X_THRESHOLD are at least MIN_Y apart vertically', () => {
    const width = 800;
    const height = 600;

    // Create a path with many nodes at degree 2 that will project to the same X
    const nodes = ['a', 'b', 'c', 'd', 'e', 'f'];
    const nodesByDegree = new Map();
    nodesByDegree.set('src', 0);
    nodesByDegree.set('dst', 0);
    nodes.forEach(n => nodesByDegree.set(n, 2));

    const edges = [
      edgeKey('src', 'a'),
      edgeKey('src', 'b'),
      edgeKey('src', 'c'),
      edgeKey('src', 'd'),
      edgeKey('src', 'e'),
      edgeKey('src', 'f'),
      edgeKey('src', 'dst'),
    ];

    const pathFilter = {
      nodesByDegree,
      source: 'src',
      destination: 'dst',
      nodes: ['src', 'dst', ...nodes],
      edges,
      shortestPathNodes: ['src', 'dst'],
      nodeLabels: {},
    } as any;

    const positions = calculateDegreePositions(pathFilter, width, height);

    // Check vertical separation between consecutive nodes sorted by y
    const ys = nodes.map(n => positions[n].y).sort((a, b) => a - b);
    for (let i = 1; i < ys.length; i++) {
      expect(Math.abs(ys[i] - ys[i - 1])).toBeGreaterThanOrEqual(MIN_Y - 0.0001);
    }
  });
});
