import { describe, it, expect, beforeEach } from 'vitest';

// @ts-ignore - importing JS module from TS test
import {
  COLORS,
  DEGREE_COLORS,
  createEdgeKey,
  buildGraphElements,
  calculateDegreePositions,
  createCytoscapeStyle,
  createLayoutConfig,
} from '../modules/cytoscape-builder.js';

// Type definitions for test data
type Team = { id: string; name: string; conference?: { id: string } };
type Game = {
  id: string;
  home: { id: string; name: string };
  away: { id: string; name: string };
  type: string;
  leverage?: number;
  date?: string;
};

describe('cytoscape-builder', () => {
  let mockTeams: Team[];
  let mockGames: Game[];
  let teamIndex: Map<string, Team>;
  let pairGames: Map<string, Game[]>;

  beforeEach(() => {
    // Setup mock data
    mockTeams = [
      { id: 'ohio-state', name: 'Ohio State', conference: { id: 'b1g' } },
      { id: 'michigan', name: 'Michigan', conference: { id: 'b1g' } },
      { id: 'georgia', name: 'Georgia', conference: { id: 'sec' } },
      { id: 'alabama', name: 'Alabama', conference: { id: 'sec' } },
      { id: 'notre-dame', name: 'Notre Dame' }, // Independent, no conference
    ];

    mockGames = [
      {
        id: 'g1',
        home: { id: 'ohio-state', name: 'Ohio State' },
        away: { id: 'michigan', name: 'Michigan' },
        type: 'CONFERENCE',
        leverage: 0.85,
      },
      {
        id: 'g2',
        home: { id: 'georgia', name: 'Georgia' },
        away: { id: 'alabama', name: 'Alabama' },
        type: 'CONFERENCE',
        leverage: 0.92,
      },
      {
        id: 'g3',
        home: { id: 'ohio-state', name: 'Ohio State' },
        away: { id: 'notre-dame', name: 'Notre Dame' },
        type: 'NON_CONFERENCE',
        leverage: 0.65,
      },
      {
        id: 'g4',
        home: { id: 'michigan', name: 'Michigan' },
        away: { id: 'alabama', name: 'Alabama' },
        type: 'NON_CONFERENCE',
        leverage: 0.78,
      },
    ];

    teamIndex = new Map();
    pairGames = new Map();
  });

  describe('COLORS constant', () => {
    it('should have conference color mappings', () => {
      expect(COLORS.b1g).toBe('#CC0000');
      expect(COLORS.sec).toBe('#0033A0');
      expect(COLORS.acc).toBe('#00539F');
      expect(COLORS.b12).toBe('#003594');
      expect(COLORS.mwc).toBe('#003366');
      expect(COLORS.other).toBe('#444444');
    });
  });

  describe('DEGREE_COLORS constant', () => {
    it('should have 7 degree colors', () => {
      expect(DEGREE_COLORS.length).toBe(7);
      expect(DEGREE_COLORS[0]).toBe('#00FF00'); // Direct connection - green
      expect(DEGREE_COLORS[1]).toBe('#FFFF00'); // 1 hop - yellow
    });
  });

  describe('createEdgeKey', () => {
    it('should create consistent alphabetically sorted keys', () => {
      expect(createEdgeKey('ohio-state', 'michigan')).toBe('michigan__ohio-state');
      expect(createEdgeKey('michigan', 'ohio-state')).toBe('michigan__ohio-state');
    });

    it('should handle identical IDs', () => {
      expect(createEdgeKey('ohio-state', 'ohio-state')).toBe('ohio-state__ohio-state');
    });
  });

  describe('buildGraphElements', () => {
    it('should build nodes and edges from team and game data', () => {
      const elements = buildGraphElements({
        teams: mockTeams,
        games: mockGames,
        teamIndex,
        pairGames,
        typeFilter: 'ALL',
        minLeverage: 0,
        pathFilter: null,
      });

      // Should have 5 nodes
      const nodes = elements.filter((e: any) => e.group === 'nodes');
      expect(nodes.length).toBe(5);

      // Should have 4 edges (one per game)
      const edges = elements.filter((e: any) => e.group === 'edges');
      expect(edges.length).toBe(4);

      // Verify teamIndex was populated
      expect(teamIndex.size).toBe(5);
      expect(teamIndex.get('ohio-state')?.name).toBe('Ohio State');
    });

    it('should respect typeFilter for CONFERENCE games only', () => {
      const elements = buildGraphElements({
        teams: mockTeams,
        games: mockGames,
        teamIndex,
        pairGames,
        typeFilter: 'CONFERENCE',
        minLeverage: 0,
        pathFilter: null,
      });

      const edges = elements.filter((e: any) => e.group === 'edges');
      // Only 2 conference games
      expect(edges.length).toBe(2);

      // Verify pairGames has only CONFERENCE games
      expect(pairGames.size).toBe(2);
    });

    it('should respect minLeverage threshold', () => {
      const elements = buildGraphElements({
        teams: mockTeams,
        games: mockGames,
        teamIndex,
        pairGames,
        typeFilter: 'ALL',
        minLeverage: 0.8,
        pathFilter: null,
      });

      const edges = elements.filter((e: any) => e.group === 'edges');
      // Only games with leverage >= 0.8: g1 (0.85) and g2 (0.92)
      expect(edges.length).toBe(2);
    });

    it('should filter nodes when pathFilter is provided', () => {
      const pathFilter = {
        nodes: ['ohio-state', 'michigan'],
        edges: [],
        nodesByDegree: new Map(),
        source: 'ohio-state',
        destination: 'michigan',
      };

      const elements = buildGraphElements({
        teams: mockTeams,
        games: mockGames,
        teamIndex,
        pairGames,
        typeFilter: 'ALL',
        minLeverage: 0,
        pathFilter,
      });

      const nodes = elements.filter((e: any) => e.group === 'nodes');
      // Only 2 nodes in path
      expect(nodes.length).toBe(2);
      expect(nodes.every((n: any) => pathFilter.nodes.includes(n.data.id))).toBe(true);
    });

    it('should filter edges when pathFilter is provided', () => {
      const edgeKey = createEdgeKey('ohio-state', 'michigan');
      const pathFilter = {
        nodes: ['ohio-state', 'michigan'],
        edges: [edgeKey],
        nodesByDegree: new Map(),
        source: 'ohio-state',
        destination: 'michigan',
      };

      const elements = buildGraphElements({
        teams: mockTeams,
        games: mockGames,
        teamIndex,
        pairGames,
        typeFilter: 'ALL',
        minLeverage: 0,
        pathFilter,
      });

      const edges = elements.filter((e: any) => e.group === 'edges');
      // Only 1 edge in path
      expect(edges.length).toBe(1);
      expect(edges[0].data.id).toBe('e_' + edgeKey);
    });

    it('should assign conference classes to nodes', () => {
      const elements = buildGraphElements({
        teams: mockTeams,
        games: mockGames,
        teamIndex,
        pairGames,
        typeFilter: 'ALL',
        minLeverage: 0,
        pathFilter: null,
      });

      const nodes = elements.filter((e: any) => e.group === 'nodes');
      const osuNode = nodes.find((n: any) => n.data.id === 'ohio-state');
      expect(osuNode).toBeDefined();
      expect(osuNode?.classes).toBe('b1g');
      expect(osuNode?.data.conf).toBe('b1g');

      const ndNode = nodes.find((n: any) => n.data.id === 'notre-dame');
      expect(ndNode).toBeDefined();
      expect(ndNode?.classes).toBe('other');
      expect(ndNode?.data.conf).toBe('other');
    });

    it('should color edges based on degree when pathFilter has nodesByDegree', () => {
      const nodesByDegree = new Map([
        ['ohio-state', 0],
        ['michigan', 0],
      ]);

      const pathFilter = {
        nodes: ['ohio-state', 'michigan'],
        edges: [createEdgeKey('ohio-state', 'michigan')],
        nodesByDegree,
        source: 'ohio-state',
        destination: 'michigan',
      };

      const elements = buildGraphElements({
        teams: mockTeams,
        games: mockGames,
        teamIndex,
        pairGames,
        typeFilter: 'ALL',
        minLeverage: 0,
        pathFilter,
      });

      const edges = elements.filter((e: any) => e.group === 'edges');
      // Direct connection (degree 0) should be green
      expect(edges[0].data.edgeColor).toBe(DEGREE_COLORS[0]);
    });

    it('should populate pairGames Map correctly', () => {
      buildGraphElements({
        teams: mockTeams,
        games: mockGames,
        teamIndex,
        pairGames,
        typeFilter: 'ALL',
        minLeverage: 0,
        pathFilter: null,
      });

      const osuMichKey = createEdgeKey('ohio-state', 'michigan');
      expect(pairGames.has(osuMichKey)).toBe(true);
      expect(pairGames.get(osuMichKey)?.length).toBe(1);
      expect(pairGames.get(osuMichKey)?.[0].id).toBe('g1');
    });
  });

  describe('calculateDegreePositions', () => {
    it('should position source on left and destination on right', () => {
      const pathFilter = {
        nodesByDegree: new Map([
          ['ohio-state', 0],
          ['michigan', 0],
        ]),
        source: 'ohio-state',
        destination: 'michigan',
        nodes: ['ohio-state', 'michigan'],
        edges: [],
      };

      const positions = calculateDegreePositions(pathFilter, 800, 600);

      expect(positions['ohio-state'].x).toBe(50); // Left edge
      expect(positions['michigan'].x).toBe(750); // Right edge (800 - 50)
      expect(positions['ohio-state'].y).toBe(300); // Center Y
      expect(positions['michigan'].y).toBe(300); // Center Y
    });

    it('should position intermediate nodes between source and destination', () => {
      const pathFilter = {
        nodesByDegree: new Map([
          ['ohio-state', 0],
          ['alabama', 1],
          ['michigan', 0],
        ]),
        source: 'ohio-state',
        destination: 'michigan',
        nodes: ['ohio-state', 'alabama', 'michigan'],
        edges: [],
      };

      const positions = calculateDegreePositions(pathFilter, 800, 600);

      // Alabama at degree 1 should be between source and destination
      expect(positions['alabama'].x).toBeGreaterThan(positions['ohio-state'].x);
      expect(positions['alabama'].x).toBeLessThan(positions['michigan'].x);
    });

    it('should handle multiple nodes at same degree', () => {
      const pathFilter = {
        nodesByDegree: new Map([
          ['ohio-state', 0],
          ['alabama', 1],
          ['georgia', 1],
          ['michigan', 0],
        ]),
        source: 'ohio-state',
        destination: 'michigan',
        nodes: ['ohio-state', 'alabama', 'georgia', 'michigan'],
        edges: [],
      };

      const positions = calculateDegreePositions(pathFilter, 800, 600);

      // Both degree-1 nodes should have same X but different Y
      expect(positions['alabama'].x).toBe(positions['georgia'].x);
      expect(positions['alabama'].y).not.toBe(positions['georgia'].y);
    });

    it('should use custom width and height parameters', () => {
      const pathFilter = {
        nodesByDegree: new Map([
          ['ohio-state', 0],
          ['michigan', 0],
        ]),
        source: 'ohio-state',
        destination: 'michigan',
        nodes: ['ohio-state', 'michigan'],
        edges: [],
      };

      const positions = calculateDegreePositions(pathFilter, 1000, 800);

      expect(positions['ohio-state'].x).toBe(50);
      expect(positions['michigan'].x).toBe(950); // 1000 - 50
      expect(positions['ohio-state'].y).toBe(400); // 800 / 2
    });
  });

  describe('createCytoscapeStyle', () => {
    it('should return valid Cytoscape style array', () => {
      const style = createCytoscapeStyle();

      expect(Array.isArray(style)).toBe(true);
      expect(style.length).toBeGreaterThan(0);

      // Should have node selector
      const nodeStyle = style.find((s: any) => s.selector === 'node');
      expect(nodeStyle).toBeDefined();
      expect(nodeStyle.style['background-color']).toBeDefined();

      // Should have edge selector
      const edgeStyle = style.find((s: any) => s.selector === 'edge');
      expect(edgeStyle).toBeDefined();
      expect(edgeStyle.style['line-color']).toBeDefined();
    });
  });

  describe('createLayoutConfig', () => {
    it('should return COSE layout when no pathFilter provided', () => {
      const config = createLayoutConfig(null);

      expect(config.name).toBe('cose');
      expect(config.idealEdgeLength).toBeDefined();
      expect(config.nodeOverlap).toBe(20);
      expect(config.nodeRepulsion).toBe(4000);
    });

    it('should return preset layout when pathFilter provided', () => {
      const pathFilter = {
        nodesByDegree: new Map([
          ['ohio-state', 0],
          ['michigan', 0],
        ]),
        source: 'ohio-state',
        destination: 'michigan',
        nodes: [],
        edges: [],
      };

      const config = createLayoutConfig(pathFilter, 800, 600);

      expect(config.name).toBe('preset');
      expect(config.positions).toBeDefined();
      expect(config.fit).toBe(true);
      expect(config.padding).toBe(50);
    });

    it('should use custom dimensions for preset layout', () => {
      const pathFilter = {
        nodesByDegree: new Map([
          ['ohio-state', 0],
          ['michigan', 0],
        ]),
        source: 'ohio-state',
        destination: 'michigan',
        nodes: [],
        edges: [],
      };

      const config = createLayoutConfig(pathFilter, 1200, 900);

      expect(config.positions).toBeDefined();
      expect(typeof config.positions).toBe('object');
      const positions = config.positions as { [nodeId: string]: { x: number; y: number } };
      expect(positions['ohio-state'].x).toBe(50);
      expect(positions['michigan'].x).toBe(1150); // 1200 - 50
    });
  });
});
