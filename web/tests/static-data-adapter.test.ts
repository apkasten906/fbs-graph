import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
// @ts-ignore - JS module
import { StaticDataAdapter } from '../modules/static-data-adapter.js';

describe('Static Data Adapter', () => {
  let adapter: StaticDataAdapter;

  beforeAll(() => {
    // Mock fetch for testing
    global.fetch = async (url: string | URL | Request) => {
      const urlStr = url.toString();

      if (urlStr.includes('metadata.json')) {
        return {
          ok: true,
          json: async () => ({
            generatedAt: '2025-11-06T00:00:00.000Z',
            seasons: [2025],
            currentSeason: 2025,
            totalTeams: 136,
            totalConferences: 34,
          }),
        } as Response;
      }

      if (urlStr.includes('conferences.json')) {
        return {
          ok: true,
          json: async () => [
            { id: 'sec', name: 'SEC', shortName: 'SEC', division: 'FBS' },
            { id: 'b1g', name: 'Big Ten', shortName: 'B1G', division: 'FBS' },
          ],
        } as Response;
      }

      if (urlStr.includes('teams.json')) {
        return {
          ok: true,
          json: async () => [
            { id: 'alabama', name: 'Alabama', shortName: 'ALA', conferenceId: 'sec' },
            { id: 'ohio-state', name: 'Ohio State', shortName: 'OSU', conferenceId: 'b1g' },
          ],
        } as Response;
      }

      return {
        ok: false,
        statusText: 'Not Found',
      } as Response;
    };
  });

  beforeEach(() => {
    adapter = new StaticDataAdapter('data');
  });

  describe('constructor', () => {
    it('should initialize with default basePath', () => {
      const defaultAdapter = new StaticDataAdapter();
      expect(defaultAdapter).toBeDefined();
    });

    it('should initialize with custom basePath', () => {
      const customAdapter = new StaticDataAdapter('/custom/path');
      expect(customAdapter).toBeDefined();
    });
  });

  describe('getMetadata', () => {
    it('should fetch and return metadata', async () => {
      const metadata = await adapter.getMetadata();
      expect(metadata).toBeDefined();
      expect(metadata.currentSeason).toBe(2025);
      expect(metadata.totalTeams).toBe(136);
    });
  });

  describe('getConferences', () => {
    it('should fetch and return conferences', async () => {
      const conferences = await adapter.getConferences();
      expect(conferences).toHaveLength(2);
      expect(conferences[0].id).toBe('sec');
      expect(conferences[1].id).toBe('b1g');
    });
  });

  describe('getTeams', () => {
    it('should fetch and return teams', async () => {
      const teams = await adapter.getTeams();
      expect(teams).toHaveLength(2);
      expect(teams[0].name).toBe('Alabama');
      expect(teams[1].name).toBe('Ohio State');
    });
  });

  describe('caching', () => {
    it('should cache loaded data', async () => {
      const first = await adapter.getConferences();
      const second = await adapter.getConferences();

      // Both calls should return the same cached data
      expect(first).toBe(second);
    });
  });

  describe('queryTeams', () => {
    it('should filter teams by conferenceId', async () => {
      const secTeams = await adapter.queryTeams({ conferenceId: 'sec' });
      expect(secTeams).toHaveLength(1);
      expect(secTeams[0].id).toBe('alabama');
    });

    it('should return all teams when no filter is provided', async () => {
      const allTeams = await adapter.queryTeams();
      expect(allTeams).toHaveLength(2);
    });
  });

  describe('error handling', () => {
    it('should throw error for failed fetch', async () => {
      const badAdapter = new StaticDataAdapter('bad-path');
      await expect(badAdapter.getGames(2025)).rejects.toThrow();
    });
  });
});
