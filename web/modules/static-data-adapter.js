/**
 * Static Data Adapter for GitHub Pages
 * Loads pre-generated JSON files instead of making GraphQL API calls
 */

export class StaticDataAdapter {
  constructor(basePath = 'data') {
    this.basePath = basePath;
    this.cache = new Map();
  }

  async loadJSON(filename) {
    if (this.cache.has(filename)) {
      console.log(`[StaticDataAdapter] Loaded ${filename} from cache`);
      return this.cache.get(filename);
    }
    const url = `${this.basePath}/${filename}`;
    console.log(`[StaticDataAdapter] Fetching ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      console.error(
        `[StaticDataAdapter] Failed to load ${filename}: ${response.status} ${response.statusText}`
      );
      throw new Error(`Failed to load ${filename}: ${response.statusText}`);
    }
    const data = await response.json();
    console.log(
      `[StaticDataAdapter] Successfully loaded ${filename}, ${JSON.stringify(data).length} bytes`
    );
    this.cache.set(filename, data);
    return data;
  }

  async getMetadata() {
    return this.loadJSON('metadata.json');
  }

  async getConferences() {
    return this.loadJSON('conferences.json');
  }

  async getTeams() {
    return this.loadJSON('teams.json');
  }

  async getGames(season) {
    return this.loadJSON(`games-${season}.json`);
  }

  async getEssentialMatchups(season) {
    return this.loadJSON(`essential-matchups-${season}.json`);
  }

  async getConferenceConnectivity(season) {
    return this.loadJSON(`conference-connectivity-${season}.json`);
  }

  /**
   * Simulates GraphQL query for teams by filtering based on parameters
   */
  async queryTeams(options = {}) {
    const teams = await this.getTeams();
    let filtered = teams;

    if (options.conferenceId) {
      filtered = filtered.filter(t => t.conferenceId === options.conferenceId);
    }

    // Teams are already filtered by season in the JSON (no additional filter needed)

    return filtered;
  }

  /**
   * Simulates GraphQL query for games with filtering
   */
  async queryGames(options = {}) {
    const {
      season = new Date().getFullYear(),
      week,
      teamId,
      conferenceId,
      type,
      playedOnly,
    } = options;

    let games = await this.getGames(season);

    if (week !== undefined) {
      games = games.filter(g => g.week === week);
    }

    if (teamId) {
      games = games.filter(g => g.homeTeamId === teamId || g.awayTeamId === teamId);
    }

    if (conferenceId) {
      games = games.filter(
        g => g.homeConference?.id === conferenceId || g.awayConference?.id === conferenceId
      );
    }

    if (type) {
      games = games.filter(g => g.type === type);
    }

    if (playedOnly) {
      games = games.filter(g => g.result !== 'TBD');
    }

    return games;
  }

  /**
   * Simulates GraphQL essentialMatchups query
   */
  async queryEssentialMatchups(options = {}) {
    const {
      season = new Date().getFullYear(),
      week,
      limit = 50,
      includeConferenceGames = true,
    } = options;

    let matchups = await this.getEssentialMatchups(season);

    if (week !== undefined) {
      matchups = matchups.filter(m => m.week === week);
    }

    if (!includeConferenceGames) {
      matchups = matchups.filter(m => m.type !== 'CONFERENCE');
    }

    return matchups.slice(0, limit);
  }

  /**
   * Simulates the full GraphQL query structure used by the timeline explorer
   */
  async queryGraph(season) {
    const [teams, games, conferences] = await Promise.all([
      this.getTeams(),
      this.getGames(season),
      this.getConferences(),
    ]);

    // Transform to match GraphQL response structure
    return {
      data: {
        teams: teams,
        games: games.map(g => ({
          ...g,
          home: g.homeTeam,
          away: g.awayTeam,
          homeConference: g.homeConference,
          awayConference: g.awayConference,
          isConferenceGame: g.homeConference?.id === g.awayConference?.id,
        })),
        conferences: conferences,
      },
    };
  }

  /**
   * Legacy compatibility method - converts static data query to GraphQL-like response
   */
  async executeQuery(query, variables) {
    const season = variables?.season || new Date().getFullYear();

    // For the timeline explorer query
    if (query.includes('teams(season:') && query.includes('games(season:')) {
      return this.queryGraph(season);
    }

    // For essential matchups query
    if (query.includes('essentialMatchups')) {
      const matchups = await this.queryEssentialMatchups(variables);
      return {
        data: {
          essentialMatchups: matchups,
        },
      };
    }

    throw new Error('Unsupported query type');
  }
}

// Create a global instance
export const staticData = new StaticDataAdapter('./data');
