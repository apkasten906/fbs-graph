import { describe, it, expect, beforeEach } from 'vitest';
import {
  shortestPathByInverseLeverage,
  findNodesWithinDegrees,
  buildAdjacencyList,
  edgeKey,
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - JS module without full type definitions
} from '../modules/graph-path-finder.js';

type Game = {
  id: string;
  home: { id: string };
  away: { id: string };
  type: string;
  leverage: number;
};

type Team = {
  id: string;
  name: string;
};

describe('Path Finder - Graph Algorithms', () => {
  let mockGames: Game[];
  let mockPairGames: Map<string, Game[]>;
  let mockTeams: Team[];

  beforeEach(() => {
    // Set up mock data for a simple graph:
    // OSU - Michigan (direct)
    // OSU - Purdue - Notre Dame - Miami (path)
    // OSU - Illinois - Purdue (alternative path)
    
    mockTeams = [
      { id: 'ohio-state', name: 'Ohio State' },
      { id: 'michigan', name: 'Michigan' },
      { id: 'purdue', name: 'Purdue' },
      { id: 'notre-dame', name: 'Notre Dame' },
      { id: 'miami', name: 'Miami' },
      { id: 'illinois', name: 'Illinois' },
    ];

    mockGames = [
      { id: 'g1', home: { id: 'ohio-state' }, away: { id: 'michigan' }, type: 'CONFERENCE', leverage: 0.8 },
      { id: 'g2', home: { id: 'ohio-state' }, away: { id: 'purdue' }, type: 'CONFERENCE', leverage: 0.9 },
      { id: 'g3', home: { id: 'purdue' }, away: { id: 'notre-dame' }, type: 'NON_CONFERENCE', leverage: 0.7 },
      { id: 'g4', home: { id: 'notre-dame' }, away: { id: 'miami' }, type: 'NON_CONFERENCE', leverage: 0.85 },
      { id: 'g5', home: { id: 'ohio-state' }, away: { id: 'illinois' }, type: 'CONFERENCE', leverage: 0.75 },
      { id: 'g6', home: { id: 'illinois' }, away: { id: 'purdue' }, type: 'CONFERENCE', leverage: 0.65 },
    ];

    mockPairGames = new Map();
    for (const g of mockGames) {
      const k = edgeKey(g.home.id, g.away.id);
      if (!mockPairGames.has(k)) {
        mockPairGames.set(k, []);
      }
      mockPairGames.get(k)!.push(g);
    }
  });

  describe('edgeKey', () => {
    it('should create consistent keys regardless of order', () => {
      expect(edgeKey('teamA', 'teamB')).toBe(edgeKey('teamB', 'teamA'));
    });

    it('should create alphabetically sorted keys', () => {
      expect(edgeKey('zebra', 'apple')).toBe('apple__zebra');
    });
  });

  describe('buildAdjacencyList', () => {
    it('should build bidirectional adjacency list from games', () => {
      const adj = buildAdjacencyList(mockPairGames, 'ALL', 0);

      expect(adj.has('ohio-state')).toBe(true);
      expect(adj.has('michigan')).toBe(true);
      
      // OSU should have edges to Michigan, Purdue, Illinois
      const osuNeighbors = adj.get('ohio-state');
      expect(osuNeighbors).toBeDefined();
      expect(osuNeighbors!.length).toBe(3);
      expect(osuNeighbors!.map((n: any) => n.to)).toContain('michigan');
      expect(osuNeighbors!.map((n: any) => n.to)).toContain('purdue');
      expect(osuNeighbors!.map((n: any) => n.to)).toContain('illinois');
    });

    it('should filter by game type', () => {
      const adj = buildAdjacencyList(mockPairGames, 'CONFERENCE', 0);

      // Notre Dame - Miami edge should be excluded (NON_CONFERENCE)
      // Since all Notre Dame games are NON_CONFERENCE, it won't be in adj at all
      expect(adj.has('notre-dame')).toBe(false);
      // But Purdue should still have edges (OSU and Illinois are CONFERENCE)
      expect(adj.has('purdue')).toBe(true);
      const purdueNeighbors = adj.get('purdue');
      expect(purdueNeighbors).toBeDefined();
      expect(purdueNeighbors!.map((n: any) => n.to)).toContain('ohio-state');
      expect(purdueNeighbors!.map((n: any) => n.to)).toContain('illinois');
      expect(purdueNeighbors!.map((n: any) => n.to)).not.toContain('notre-dame'); // NON_CONFERENCE edge excluded
    });

    it('should filter by minimum leverage', () => {
      const adj = buildAdjacencyList(mockPairGames, 'ALL', 0.7);
      
      // Illinois-Purdue edge should be excluded (leverage 0.65 < 0.7)
      const illinoisNeighbors = adj.get('illinois');
      expect(illinoisNeighbors).toBeDefined();
      expect(illinoisNeighbors!.map((n: any) => n.to)).not.toContain('purdue');
    });
  });

  describe('shortestPathByInverseLeverage', () => {
    it('should find direct path when teams are connected', () => {
      const path = shortestPathByInverseLeverage('ohio-state', 'michigan', mockPairGames, mockTeams, 'ALL', 0);

      expect(path).not.toBeNull();
      if (!path) return;
      expect(path.nodes).toEqual(['ohio-state', 'michigan']);
      expect(path.edges).toHaveLength(1);
      expect(path.edges[0]).toBe(edgeKey('ohio-state', 'michigan'));
    });
    it('should find multi-hop path when needed', () => {
      const path = shortestPathByInverseLeverage('ohio-state', 'miami', mockPairGames, mockTeams, 'ALL', 0);

      expect(path).not.toBeNull();
      if (!path) return;
      expect(path.nodes[0]).toBe('ohio-state');
      expect(path.nodes[path.nodes.length - 1]).toBe('miami');
      // Path should be OSU -> Purdue -> Notre Dame -> Miami (3 hops)
      expect(path.nodes.length).toBe(4);
    });
    it('should prefer high-leverage paths', () => {
      const path = shortestPathByInverseLeverage('ohio-state', 'purdue', mockPairGames, mockTeams, 'ALL', 0);

      expect(path).not.toBeNull();
      if (!path) return;
      // Should prefer direct OSU-Purdue (0.9) over OSU-Illinois-Purdue (0.75, 0.65)
      expect(path.nodes).toEqual(['ohio-state', 'purdue']);
    });

    it('should return null when no path exists', () => {
      // Add disconnected team
      mockTeams.push({ id: 'disconnected', name: 'Disconnected' });

      const path = shortestPathByInverseLeverage('ohio-state', 'disconnected', mockPairGames, mockTeams, 'ALL', 0);

      expect(path).toBeNull();
    });

    it('should respect type filter', () => {
      const path = shortestPathByInverseLeverage('ohio-state', 'miami', mockPairGames, mockTeams, 'CONFERENCE', 0);

      // Can't reach Miami with CONFERENCE only (needs NON_CONFERENCE edges)
      expect(path).toBeNull();
    });

    it('should respect minimum leverage filter', () => {
      const path = shortestPathByInverseLeverage('ohio-state', 'purdue', mockPairGames, mockTeams, 'ALL', 0.95);

      // No edges have leverage >= 0.95
      expect(path).toBeNull();
    });
  });

  describe('findNodesWithinDegrees', () => {
    it('should find direct matchup at degree 0', () => {
      const result = findNodesWithinDegrees(
        ['ohio-state', 'michigan'],
        0,
        mockPairGames,
        mockTeams,
        'ALL',
        0
      );

      expect(result.nodes).toHaveLength(2);
      expect(result.nodes).toContain('ohio-state');
      expect(result.nodes).toContain('michigan');
      expect(result.edges).toHaveLength(1);
    });

    it('should find common opponents at degree 1', () => {
      const result = findNodesWithinDegrees(
        ['ohio-state', 'purdue'],
        1,
        mockPairGames,
        mockTeams,
        'ALL',
        0
      );

      // Should include OSU, Purdue, and Illinois (common opponent)
      expect(result.nodes).toContain('ohio-state');
      expect(result.nodes).toContain('purdue');
      expect(result.nodes).toContain('illinois');
      
      // Should have degree assignments
      expect(result.nodesByDegree.get('ohio-state')).toBe(0);
    });

    it('should include shortest path nodes when provided', () => {
      const shortestPath = shortestPathByInverseLeverage('ohio-state', 'miami', mockPairGames, mockTeams, 'ALL', 0);
      
      expect(shortestPath).not.toBeNull();
      if (!shortestPath) return;
      
      const result = findNodesWithinDegrees(
        ['ohio-state', 'miami'],
        1,
        mockPairGames,
        mockTeams,
        'ALL',
        0,
        shortestPath
      );
      expect(result.nodes).toContain('ohio-state');
      expect(result.nodes).toContain('purdue');
      expect(result.nodes).toContain('notre-dame');
      expect(result.nodes).toContain('miami');
    });

    it('should assign correct degrees based on distance from source', () => {
      const shortestPath = shortestPathByInverseLeverage('ohio-state', 'miami', mockPairGames, mockTeams, 'ALL', 0);
      
      expect(shortestPath).not.toBeNull();
      if (!shortestPath) return;
      
      const result = findNodesWithinDegrees(
        ['ohio-state', 'miami'],
        3,
        mockPairGames,
        mockTeams,
        'ALL',
        0,
        shortestPath
      );

      expect(result.nodesByDegree.get('ohio-state')).toBe(0);
      expect(result.nodesByDegree.get('purdue')).toBe(1);
      expect(result.nodesByDegree.get('notre-dame')).toBe(2);
      expect(result.nodesByDegree.get('miami')).toBe(0); // Destination is always 0
    });

    it('should return source and destination properties', () => {
      const result = findNodesWithinDegrees(
        ['ohio-state', 'michigan'],
        1,
        mockPairGames,
        mockTeams,
        'ALL',
        0
      );

      expect(result.source).toBe('ohio-state');
      expect(result.destination).toBe('michigan');
    });
  });
});
