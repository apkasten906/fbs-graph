import { describe, it, expect, beforeEach, vi } from 'vitest';

// @ts-ignore - importing JS module from TS test
import {
  GRAPH_QUERY,
  CONFERENCES_QUERY,
  graphqlPost,
  loadGraphData,
  loadConferences,
  loadAllData,
} from '../modules/graph-data.js';

describe('graph-data', () => {
  let mockFetch: any;
  let mockStaticAdapter: any;

  beforeEach(() => {
    // Reset mocks
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    mockStaticAdapter = {
      queryGraph: vi.fn(),
      getConferences: vi.fn(),
    };
  });

  describe('Query constants', () => {
    it('should export GRAPH_QUERY', () => {
      expect(GRAPH_QUERY).toBeDefined();
      expect(GRAPH_QUERY).toContain('query Graph');
      expect(GRAPH_QUERY).toContain('teams');
      expect(GRAPH_QUERY).toContain('games');
    });

    it('should export CONFERENCES_QUERY', () => {
      expect(CONFERENCES_QUERY).toBeDefined();
      expect(CONFERENCES_QUERY).toContain('conferences');
    });
  });

  describe('graphqlPost', () => {
    it('should make POST request with correct headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { teams: [] } }),
      });

      await graphqlPost('http://test.com/graphql', { query: 'test query' });

      expect(mockFetch).toHaveBeenCalledWith('http://test.com/graphql', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: 'test query' }),
      });
    });

    it('should return parsed JSON response', async () => {
      const mockResponse = { data: { teams: [{ id: 'team1' }] } };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await graphqlPost('http://test.com/graphql', { query: 'test' });

      expect(result).toEqual(mockResponse);
    });
  });

  describe('loadGraphData', () => {
    const mockTeams = [
      { id: 'ohio-state', name: 'Ohio State', conference: { id: 'b1g' } },
      { id: 'michigan', name: 'Michigan', conference: { id: 'b1g' } },
    ];

    const mockGames = [
      {
        id: 'g1',
        home: { id: 'ohio-state', name: 'Ohio State' },
        away: { id: 'michigan', name: 'Michigan' },
        type: 'CONFERENCE',
        leverage: 0.85,
      },
    ];

    it('should load data from static adapter when available', async () => {
      mockStaticAdapter.queryGraph.mockResolvedValueOnce({
        data: { teams: mockTeams, games: mockGames },
      });

      const result = await loadGraphData(2025, { staticAdapter: mockStaticAdapter });

      expect(mockStaticAdapter.queryGraph).toHaveBeenCalledWith(2025);
      expect(result).toEqual({
        teams: mockTeams,
        games: mockGames,
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should fallback to GraphQL when static adapter fails', async () => {
      mockStaticAdapter.queryGraph.mockRejectedValueOnce(new Error('Adapter failed'));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { teams: mockTeams, games: mockGames } }),
      });

      const result = await loadGraphData(2025, {
        staticAdapter: mockStaticAdapter,
        graphqlEndpoint: 'http://test.com/graphql',
      });

      expect(mockStaticAdapter.queryGraph).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalled();
      expect(result).toEqual({
        teams: mockTeams,
        games: mockGames,
      });
    });

    it('should use GraphQL when no static adapter provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { teams: mockTeams, games: mockGames } }),
      });

      const result = await loadGraphData(2025, {
        graphqlEndpoint: 'http://test.com/graphql',
      });

      expect(mockFetch).toHaveBeenCalled();
      expect(result).toEqual({
        teams: mockTeams,
        games: mockGames,
      });
    });

    it('should throw error when no data source available', async () => {
      await expect(loadGraphData(2025, {})).rejects.toThrow(
        'No GraphQL endpoint provided and static adapter unavailable'
      );
    });

    it('should throw error on GraphQL errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ errors: [{ message: 'Query failed' }] }),
      });

      await expect(
        loadGraphData(2025, { graphqlEndpoint: 'http://test.com/graphql' })
      ).rejects.toThrow('Query failed');
    });

    it('should throw error when GraphQL response missing data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: null }),
      });

      await expect(
        loadGraphData(2025, { graphqlEndpoint: 'http://test.com/graphql' })
      ).rejects.toThrow('GraphQL response missing data');
    });

    it('should handle empty teams and games arrays', async () => {
      mockStaticAdapter.queryGraph.mockResolvedValueOnce({
        data: { teams: [], games: [] },
      });

      const result = await loadGraphData(2025, { staticAdapter: mockStaticAdapter });

      expect(result).toEqual({
        teams: [],
        games: [],
      });
    });
  });

  describe('loadConferences', () => {
    const mockConferences = [
      { id: 'b1g', name: 'Big Ten', shortName: 'B1G' },
      { id: 'sec', name: 'Southeastern Conference', shortName: 'SEC' },
    ];

    it('should load conferences from static adapter when available', async () => {
      mockStaticAdapter.getConferences.mockResolvedValueOnce(mockConferences);

      const result = await loadConferences({ staticAdapter: mockStaticAdapter });

      expect(mockStaticAdapter.getConferences).toHaveBeenCalled();
      expect(result).toEqual(mockConferences);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should fallback to GraphQL when static adapter fails', async () => {
      mockStaticAdapter.getConferences.mockRejectedValueOnce(new Error('Adapter failed'));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { conferences: mockConferences } }),
      });

      const result = await loadConferences({
        staticAdapter: mockStaticAdapter,
        graphqlEndpoint: 'http://test.com/graphql',
      });

      expect(mockStaticAdapter.getConferences).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalled();
      expect(result).toEqual(mockConferences);
    });

    it('should use GraphQL when no static adapter provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { conferences: mockConferences } }),
      });

      const result = await loadConferences({
        graphqlEndpoint: 'http://test.com/graphql',
      });

      expect(mockFetch).toHaveBeenCalled();
      expect(result).toEqual(mockConferences);
    });

    it('should throw error when no data source available', async () => {
      await expect(loadConferences({})).rejects.toThrow(
        'No GraphQL endpoint provided and static adapter unavailable'
      );
    });

    it('should throw error on GraphQL errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ errors: [{ message: 'Conference query failed' }] }),
      });

      await expect(loadConferences({ graphqlEndpoint: 'http://test.com/graphql' })).rejects.toThrow(
        'Conference query failed'
      );
    });
  });

  describe('loadAllData', () => {
    const mockConferences = [{ id: 'b1g', name: 'Big Ten', shortName: 'B1G' }];

    const mockTeams = [{ id: 'ohio-state', name: 'Ohio State', conference: { id: 'b1g' } }];

    const mockGames = [
      {
        id: 'g1',
        home: { id: 'ohio-state', name: 'Ohio State' },
        away: { id: 'michigan', name: 'Michigan' },
        type: 'CONFERENCE',
      },
    ];

    it('should load both conferences and graph data from static adapter', async () => {
      mockStaticAdapter.getConferences.mockResolvedValueOnce(mockConferences);
      mockStaticAdapter.queryGraph.mockResolvedValueOnce({
        data: { teams: mockTeams, games: mockGames },
      });

      const result = await loadAllData(2025, { staticAdapter: mockStaticAdapter });

      expect(result).toEqual({
        conferences: mockConferences,
        graphData: {
          teams: mockTeams,
          games: mockGames,
        },
      });
    });

    it('should load both from GraphQL when no static adapter', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { conferences: mockConferences } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { teams: mockTeams, games: mockGames } }),
        });

      const result = await loadAllData(2025, {
        graphqlEndpoint: 'http://test.com/graphql',
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        conferences: mockConferences,
        graphData: {
          teams: mockTeams,
          games: mockGames,
        },
      });
    });

    it('should handle mixed sources (conferences from adapter, graph from GraphQL)', async () => {
      mockStaticAdapter.getConferences.mockResolvedValueOnce(mockConferences);
      mockStaticAdapter.queryGraph.mockRejectedValueOnce(new Error('Graph failed'));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { teams: mockTeams, games: mockGames } }),
      });

      const result = await loadAllData(2025, {
        staticAdapter: mockStaticAdapter,
        graphqlEndpoint: 'http://test.com/graphql',
      });

      expect(result).toEqual({
        conferences: mockConferences,
        graphData: {
          teams: mockTeams,
          games: mockGames,
        },
      });
    });

    it('should throw error if either load fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ errors: [{ message: 'Failed' }] }),
      });

      await expect(
        loadAllData(2025, { graphqlEndpoint: 'http://test.com/graphql' })
      ).rejects.toThrow();
    });
  });
});
