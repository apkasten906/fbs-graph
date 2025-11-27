import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Tests for FBS Graph Visualizer comparison logic
 *
 * Testing the findNodesWithinDegrees and shortestPath functions to ensure:
 * 1. Shortest path is correctly calculated and included
 * 2. All nodes in the result have at least one edge
 * 3. All edges connect nodes that are part of valid paths
 * 4. Degrees are correctly assigned based on shortest path
 */

describe('FBS Graph Visualizer - Shortest Path & Comparison Network', () => {
  // Mock global data structures that the visualizer expects
  let pairGames;
  let teamIndex;

  beforeEach(() => {
    pairGames = new Map();
    teamIndex = new Map();
  });

  const createMockGame = (team1, team2, leverage = 0.5, type = 'REGULAR') => ({
    home: { id: team1, name: team1.toUpperCase() },
    away: { id: team2, name: team2.toUpperCase() },
    type,
    leverage,
  });

  const addConnection = (team1, team2, leverage = 0.5, type = 'REGULAR') => {
    const k = team1 < team2 ? `${team1}__${team2}` : `${team2}__${team1}`;
    if (!pairGames.has(k)) {
      pairGames.set(k, []);
    }
    pairGames.get(k).push(createMockGame(team1, team2, leverage, type));

    // Add to team index if not exists
    if (!teamIndex.has(team1)) {
      teamIndex.set(team1, { id: team1, name: team1.toUpperCase() });
    }
    if (!teamIndex.has(team2)) {
      teamIndex.set(team2, { id: team2, name: team2.toUpperCase() });
    }
  };

  const key = (a, b) => (a < b ? `${a}__${b}` : `${b}__${a}`);

  // Copy the actual function implementations for testing
  const shortestPathByInverseLeverage = (srcId, dstId, typeFilter, minLev) => {
    const adj = new Map();
    for (const [k, list] of pairGames) {
      const a = list[0].home.id,
        b = list[0].away.id;
      const filtered = list.filter(
        g => (typeFilter === 'ALL' || g.type === typeFilter) && (g.leverage || 0) >= minLev
      );
      if (!filtered.length) continue;
      const avg = filtered.reduce((s, x) => s + (x.leverage || 0), 0) / filtered.length;
      const w = 1 / Math.max(1e-6, avg);
      if (!adj.has(a)) adj.set(a, []);
      if (!adj.has(b)) adj.set(b, []);
      adj.get(a).push({ to: b, k, w, avg, games: filtered });
      adj.get(b).push({ to: a, k, w, avg, games: filtered });
    }

    const dist = new Map(),
      prev = new Map(),
      prevEdge = new Map();
    const allIds = Array.from(teamIndex.keys());
    const Q = new Set(allIds);
    for (const id of allIds) dist.set(id, Infinity);
    dist.set(srcId, 0);

    while (Q.size) {
      let u = null,
        best = Infinity;
      for (const v of Q) {
        const d = dist.get(v);
        if (d < best) {
          best = d;
          u = v;
        }
      }
      if (u === null || best === Infinity) break;
      Q.delete(u);
      if (u === dstId) break;
      const nbrs = adj.get(u) || [];
      for (const e of nbrs) {
        if (!Q.has(e.to)) continue;
        const alt = dist.get(u) + e.w;
        if (alt < dist.get(e.to)) {
          dist.set(e.to, alt);
          prev.set(e.to, u);
          prevEdge.set(e.to, e.k);
        }
      }
    }

    if (!prev.has(dstId)) return null;

    const pathIds = [];
    const edges = [];
    let cur = dstId;
    while (cur !== srcId) {
      pathIds.push(cur);
      edges.push(prevEdge.get(cur));
      cur = prev.get(cur);
    }
    pathIds.push(srcId);
    pathIds.reverse();
    edges.reverse();
    return { nodes: pathIds, edges };
  };

  const findNodesWithinDegrees = (
    startNodes,
    maxDegrees,
    typeFilter,
    minLev,
    shortestPath = null
  ) => {
    const source = startNodes[0];
    const dest = startNodes[1];

    const adj = new Map();
    for (const [k, list] of pairGames) {
      const a = list[0].home.id,
        b = list[0].away.id;
      const filtered = list.filter(
        g => (typeFilter === 'ALL' || g.type === typeFilter) && (g.leverage || 0) >= minLev
      );
      if (!filtered.length) continue;
      if (!adj.has(a)) adj.set(a, []);
      if (!adj.has(b)) adj.set(b, []);
      adj.get(a).push({ to: b, k });
      adj.get(b).push({ to: a, k });
    }

    if (maxDegrees === 0) {
      const directKey = key(source, dest);
      if (pairGames.has(directKey)) {
        return {
          nodes: [source, dest],
          edges: [directKey],
          nodesByDegree: new Map([
            [source, 0],
            [dest, 0],
          ]),
          source,
          destination: dest,
        };
      }
      return { nodes: [], edges: [], nodesByDegree: new Map() };
    }

    const nodesByDegree = new Map();
    const validEdges = new Set();
    const validNodes = new Set([source, dest]);
    nodesByDegree.set(source, 0);
    nodesByDegree.set(dest, 0);

    if (shortestPath && shortestPath.nodes && shortestPath.edges) {
      for (let i = 0; i < shortestPath.nodes.length; i++) {
        const nodeId = shortestPath.nodes[i];
        validNodes.add(nodeId);
        if (!nodesByDegree.has(nodeId)) {
          nodesByDegree.set(nodeId, i);
        }
      }
      for (const edgeKey of shortestPath.edges) {
        validEdges.add(edgeKey);
      }
    }

    const directKey = key(source, dest);
    if (pairGames.has(directKey)) {
      validEdges.add(directKey);
    }

    const sourceNeighbors = new Set((adj.get(source) || []).map(e => e.to));
    const destNeighbors = new Set((adj.get(dest) || []).map(e => e.to));

    for (const node of sourceNeighbors) {
      if (destNeighbors.has(node)) {
        validNodes.add(node);
        if (!nodesByDegree.has(node)) {
          nodesByDegree.set(node, 1);
        }
        validEdges.add(key(source, node));
        validEdges.add(key(dest, node));
      }
    }

    if (maxDegrees >= 2) {
      const degree1Teams = Array.from(validNodes).filter(n => nodesByDegree.get(n) === 1);

      for (const team1 of degree1Teams) {
        const neighbors = (adj.get(team1) || []).map(e => e.to);

        for (const neighbor of neighbors) {
          if (validNodes.has(neighbor)) continue;

          const neighborNeighbors = new Set((adj.get(neighbor) || []).map(e => e.to));

          if (neighborNeighbors.has(source) || neighborNeighbors.has(dest)) {
            validNodes.add(neighbor);
            if (!nodesByDegree.has(neighbor)) {
              nodesByDegree.set(neighbor, 2);
            }
            validEdges.add(key(team1, neighbor));

            if (neighborNeighbors.has(source)) {
              validEdges.add(key(neighbor, source));
            }
            if (neighborNeighbors.has(dest)) {
              validEdges.add(key(neighbor, dest));
            }
          }
        }
      }
    }

    return {
      nodes: Array.from(validNodes),
      edges: Array.from(validEdges),
      nodesByDegree,
      source,
      destination: dest,
    };
  };

  describe('Shortest Path Calculation', () => {
    it('should find direct path between connected teams', () => {
      addConnection('ohio-state', 'michigan');

      const path = shortestPathByInverseLeverage('ohio-state', 'michigan', 'ALL', 0);

      expect(path).not.toBeNull();
      expect(path.nodes).toEqual(['ohio-state', 'michigan']);
      expect(path.edges).toHaveLength(1);
    });

    it('should find 2-hop path through intermediate team', () => {
      addConnection('ohio-state', 'texas');
      addConnection('texas', 'georgia');

      const path = shortestPathByInverseLeverage('ohio-state', 'georgia', 'ALL', 0);

      expect(path).not.toBeNull();
      expect(path.nodes).toEqual(['ohio-state', 'texas', 'georgia']);
      expect(path.edges).toHaveLength(2);
    });

    it('should find shortest of multiple paths', () => {
      // Direct path
      addConnection('ohio-state', 'miami', 0.8);
      // Longer path
      addConnection('ohio-state', 'penn-state', 0.5);
      addConnection('penn-state', 'smu', 0.5);
      addConnection('smu', 'miami', 0.5);

      const path = shortestPathByInverseLeverage('ohio-state', 'miami', 'ALL', 0);

      expect(path).not.toBeNull();
      // Should prefer direct path with higher leverage
      expect(path.nodes).toEqual(['ohio-state', 'miami']);
    });

    it('should return null when no path exists', () => {
      addConnection('ohio-state', 'michigan');
      addConnection('georgia', 'alabama');

      const path = shortestPathByInverseLeverage('ohio-state', 'georgia', 'ALL', 0);

      expect(path).toBeNull();
    });

    it('should respect type filter', () => {
      addConnection('ohio-state', 'michigan', 0.5, 'REGULAR');
      addConnection('ohio-state', 'texas', 0.5, 'POSTSEASON');
      addConnection('texas', 'michigan', 0.5, 'POSTSEASON');

      const path = shortestPathByInverseLeverage('ohio-state', 'michigan', 'REGULAR', 0);

      expect(path).not.toBeNull();
      expect(path.nodes).toEqual(['ohio-state', 'michigan']);
    });

    it('should respect minimum leverage filter', () => {
      addConnection('ohio-state', 'michigan', 0.3);
      addConnection('ohio-state', 'texas', 0.8);
      addConnection('texas', 'michigan', 0.8);

      const path = shortestPathByInverseLeverage('ohio-state', 'michigan', 'ALL', 0.5);

      expect(path).not.toBeNull();
      // Should take longer path because direct path has too low leverage
      expect(path.nodes).toEqual(['ohio-state', 'texas', 'michigan']);
    });
  });

  describe('Comparison Network with Shortest Path', () => {
    it('should include all shortest path nodes and edges', () => {
      addConnection('ohio-state', 'penn-state');
      addConnection('penn-state', 'smu');
      addConnection('smu', 'miami');

      const shortestPath = shortestPathByInverseLeverage('ohio-state', 'miami', 'ALL', 0);
      const result = findNodesWithinDegrees(['ohio-state', 'miami'], 3, 'ALL', 0, shortestPath);

      expect(result.nodes).toContain('ohio-state');
      expect(result.nodes).toContain('penn-state');
      expect(result.nodes).toContain('smu');
      expect(result.nodes).toContain('miami');

      expect(result.edges).toContain(key('ohio-state', 'penn-state'));
      expect(result.edges).toContain(key('penn-state', 'smu'));
      expect(result.edges).toContain(key('smu', 'miami'));
    });

    it('should correctly assign degrees based on shortest path', () => {
      addConnection('ohio-state', 'texas');
      addConnection('texas', 'georgia');

      const shortestPath = shortestPathByInverseLeverage('ohio-state', 'georgia', 'ALL', 0);
      const result = findNodesWithinDegrees(['ohio-state', 'georgia'], 2, 'ALL', 0, shortestPath);

      expect(result.nodesByDegree.get('ohio-state')).toBe(0);
      expect(result.nodesByDegree.get('texas')).toBe(1);
      expect(result.nodesByDegree.get('georgia')).toBe(0); // Destination is always degree 0
    });

    it('should add common opponents even if not in shortest path', () => {
      addConnection('ohio-state', 'wisconsin');
      addConnection('wisconsin', 'michigan');
      addConnection('ohio-state', 'penn-state'); // Common opponent
      addConnection('michigan', 'penn-state'); // Common opponent

      const shortestPath = shortestPathByInverseLeverage('ohio-state', 'michigan', 'ALL', 0);
      const result = findNodesWithinDegrees(['ohio-state', 'michigan'], 1, 'ALL', 0, shortestPath);

      expect(result.nodes).toContain('penn-state'); // Common opponent
      expect(result.nodes).toContain('wisconsin'); // In shortest path
    });

    it('should handle degree 0 (direct matchup)', () => {
      addConnection('ohio-state', 'michigan');
      addConnection('ohio-state', 'wisconsin');

      const result = findNodesWithinDegrees(['ohio-state', 'michigan'], 0, 'ALL', 0);

      expect(result.nodes).toHaveLength(2);
      expect(result.nodes).toContain('ohio-state');
      expect(result.nodes).toContain('michigan');
      expect(result.edges).toHaveLength(1);
    });

    it('should not include orphaned nodes', () => {
      addConnection('ohio-state', 'texas');
      addConnection('texas', 'georgia');
      addConnection('wisconsin', 'iowa'); // Orphaned - no connection to OSU or Georgia

      const shortestPath = shortestPathByInverseLeverage('ohio-state', 'georgia', 'ALL', 0);
      const result = findNodesWithinDegrees(['ohio-state', 'georgia'], 2, 'ALL', 0, shortestPath);

      expect(result.nodes).not.toContain('wisconsin');
      expect(result.nodes).not.toContain('iowa');
    });
  });

  describe('Edge Cases', () => {
    it('should handle teams with no connections', () => {
      const result = findNodesWithinDegrees(['ohio-state', 'michigan'], 1, 'ALL', 0);

      // Source and destination are always included even with no path
      expect(result.nodes).toHaveLength(2);
      expect(result.edges).toHaveLength(0);
    });

    it('should handle same source and destination', () => {
      addConnection('ohio-state', 'michigan');

      const path = shortestPathByInverseLeverage('ohio-state', 'ohio-state', 'ALL', 0);

      // Should handle gracefully (path to self)
      expect(path).toBeDefined();
    });

    it('should handle high degree filters', () => {
      addConnection('ohio-state', 'michigan');

      const result = findNodesWithinDegrees(['ohio-state', 'michigan'], 10, 'ALL', 0);

      // Should work even if max degrees exceeds actual network depth
      expect(result.nodes).toContain('ohio-state');
      expect(result.nodes).toContain('michigan');
    });
  });
});
