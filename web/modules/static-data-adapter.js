/**
 * Static Data Adapter for GitHub Pages
 * Loads pre-generated JSON files instead of making GraphQL API calls
 */

export class StaticDataAdapter {
  constructor(basePath = './web/data') {
    this.basePath = basePath;
    this.cache = new Map();
    // Single source of truth for default season used when callers omit a season
    this.defaultSeason = new Date().getFullYear();
  }

  /**
   * Load and cache a JSON file from the configured basePath.
   * @param {string} filename - JSON file name relative to basePath (e.g. 'teams.json')
   * @returns {Promise<any>} parsed JSON
   * @throws {Error} when fetch fails, response is not ok, or JSON parsing fails
   */
  async loadJSON(filename) {
    if (this.cache.has(filename)) {
      console.log(`[StaticDataAdapter] Loaded ${filename} from cache`);
      return this.cache.get(filename);
    }

    const url = `${this.basePath}/${filename}`;
    console.log(`[StaticDataAdapter] Fetching ${url}`);

    try {
      const response = await fetch(url);

      if (!response.ok) {
        console.error(
          `[StaticDataAdapter] Failed to load ${filename}: ${response.status} ${response.statusText}`
        );
        throw new Error(`Failed to load ${filename}: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(
        `[StaticDataAdapter] Successfully loaded ${filename}, ${JSON.stringify(data).length} bytes`
      );
      this.cache.set(filename, data);
      return data;
    } catch (error) {
      // Network errors, CORS issues, or JSON parsing failures
      if (error instanceof Error && error.message.startsWith('Failed to load')) {
        // Re-throw our own errors with context preserved
        throw error;
      }
      // Wrap network/parsing errors with additional context
      console.error(`[StaticDataAdapter] Error loading ${filename}:`, error);
      throw new Error(
        `Failed to load ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Gets metadata about the static data set.
   * @returns {Promise<object>} Metadata object with generation timestamp and other info
   */
  async getMetadata() {
    return this.loadJSON('metadata.json');
  }

  /**
   * Gets all conferences.
   * @returns {Promise<Array>} Array of all FBS conferences
   */
  async getConferences() {
    return this.loadJSON('conferences.json');
  }

  /**
   * Gets all teams.
   * @returns {Promise<Array>} Array of all FBS teams
   */
  async getTeams() {
    return this.loadJSON('teams.json');
  }

  /**
   * Gets all games for a specific season.
   * @param {number} season - Year of the season (e.g., 2025)
   * @returns {Promise<Array>} Array of games with enriched data (teams, conferences, leverage scores)
   */
  async getGames(season) {
    const s = this._validatedSeason(season);
    return this.loadJSON(`games-${s}.json`);
  }

  /**
   * Gets essential (high-leverage non-conference) matchups for a season.
   * @param {number} season - Year of the season
   * @returns {Promise<Array>} Array of top non-conference games sorted by leverage
   */
  async getEssentialMatchups(season) {
    const s = this._validatedSeason(season);
    return this.loadJSON(`essential-matchups-${s}.json`);
  }

  /**
   * Gets conference connectivity data for a season.
   * @param {number} season - Year of the season
   * @returns {Promise<object>} Conference connectivity graph data
   */
  async getConferenceConnectivity(season) {
    const s = this._validatedSeason(season);
    return this.loadJSON(`conference-connectivity-${s}.json`);
  }

  /**
   * Validate season parameter, fallback to defaultSeason and warn when invalid.
   * @param {any} season
   * @returns {number} validated season
   */
  _validatedSeason(season) {
    // Treat null/undefined uniformly: coerce early to short-circuit and
    // return the default season. This avoids subtle differences between
    // `null` and `undefined` further down in the logic.
    if (season == null) return this.defaultSeason;

    if (typeof season === 'number' && Number.isFinite(season) && season > 1900 && season < 3000)
      return season;

    const parsed = Number(season);
    if (Number.isFinite(parsed) && parsed > 1900 && parsed < 3000) return parsed;
    console.warn(
      `[StaticDataAdapter] Invalid season '${season}' supplied; falling back to ${this.defaultSeason}`
    );
    return this.defaultSeason;
  }

  /**
   * Execute a GraphQL-like query string against the static data store.
   * This keeps compatibility with the timeline explorer which issues GraphQL queries.
   * @param {string} query - GraphQL query string (partial matching is used)
   * @param {object} [variables] - optional variables object, e.g. { season }
   * @returns {Promise<object>} GraphQL-like response object { data: { ... } }
   */

  /**
   * Simulates GraphQL query for teams by filtering based on parameters.
   * @param {object} [options={}] - Filter options
   * @param {string} [options.conferenceId] - Filter by conference ID
   * @returns {Promise<Array>} Filtered array of teams
   * @throws {TypeError} When options is not an object or conferenceId is invalid
   */
  async queryTeams(options = {}) {
    // Normalize options: treat null/undefined as an empty options object.
    // This matches the function signature `options = {}` and prevents callers
    // who pass `null` from causing a runtime TypeError when we access
    // properties like `options.conferenceId` below.
    if (options == null) {
      options = {};
    } else if (typeof options !== 'object') {
      throw new TypeError(
        `queryTeams() expects options to be an object, received: ${typeof options}`
      );
    }

    const teams = await this.getTeams();
    let filtered = teams;

    // Treat null/undefined conferenceId as "no filter"
    if (options.conferenceId != null) {
      // Validate conferenceId is a non-empty string
      if (typeof options.conferenceId !== 'string' || options.conferenceId.trim() === '') {
        console.warn(
          `[StaticDataAdapter] Invalid conferenceId '${options.conferenceId}' in queryTeams; ignoring filter`
        );
      } else {
        filtered = filtered.filter(t => t.conferenceId === options.conferenceId);
      }
    }

    // Teams are already filtered by season in the JSON (no additional filter needed)

    return filtered;
  }

  /**
   * Simulates GraphQL query for games with filtering.
   * @param {object} [options={}] - Filter options
   * @param {number} [options.season] - Season year
   * @param {number} [options.week] - Week number
   * @param {string} [options.teamId] - Filter to games involving this team
   * @param {string} [options.conferenceId] - Filter to games involving this conference
   * @param {string} [options.type] - Game type (e.g., 'CONFERENCE', 'NON_CONFERENCE')
   * @param {boolean} [options.playedOnly] - If true, exclude games with result 'TBD'
   * @returns {Promise<Array>} Filtered array of games
   */
  async queryGames(options = {}) {
    const { season, week, teamId, conferenceId, type, playedOnly } = options;

    // Delegate season validation to getGames to keep a single source of truth
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
   * Simulates GraphQL essentialMatchups query.
   * @param {object} [options={}] - Query options
   * @param {number} [options.season] - Season year
   * @param {number} [options.week] - Filter to specific week
   * @param {number} [options.limit=50] - Maximum number of matchups to return
   * @param {boolean} [options.includeConferenceGames=true] - Whether to include conference games
   * @returns {Promise<Array>} Array of high-leverage matchups
   */
  async queryEssentialMatchups(options = {}) {
    const { season, week, limit = 50, includeConferenceGames = true } = options;

    // Let getEssentialMatchups handle season validation
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
   * Simulates the full GraphQL query structure used by the timeline explorer.
   * @param {number} season - Season year
   * @returns {Promise<object>} GraphQL-like response with teams, games, and conferences
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
        teams,
        games: games.map(g => ({
          ...g,
          home: g.homeTeam,
          away: g.awayTeam,
          homeConference: g.homeConference,
          awayConference: g.awayConference,
          isConferenceGame: g.homeConference?.id === g.awayConference?.id,
        })),
        conferences,
      },
    };
  }

  /**
   * Legacy compatibility method - converts static data query to GraphQL-like response.
   * @param {string} query - GraphQL query string
   * @param {object} [variables] - Query variables (e.g., { season: 2025 })
   * @returns {Promise<object>} GraphQL-like response object
   * @throws {Error} When query type is not recognized
   */
  async executeQuery(query, variables) {
    // Normalize and validate variables parameter. Treat null/undefined as {}
    // to keep behavior predictable and avoid runtime TypeErrors when callers
    // accidentally pass a non-object (e.g. a string). If a non-object is
    // provided, throw a clear TypeError so the problem is surfaced to the
    // caller instead of causing obscure runtime failures.
    if (variables == null) {
      variables = {};
    } else if (typeof variables !== 'object') {
      throw new TypeError(
        `executeQuery() expects variables to be an object when provided, received: ${typeof variables}`
      );
    }

    const season = this._validatedSeason(variables.season);

    // Accept both inline queries and variables-based queries. Use more
    // precise checks for GraphQL fields to avoid false positives. We look
    // for the function-like usages `teams(` and `games(` which are much
    // less likely to collide with unrelated text.
    const qstr = typeof query === 'string' ? query : String(query);
    // Simple allowlist for supported query types to avoid executing arbitrary
    // user-controlled GraphQL strings. We only support two patterns currently:
    // - Graph queries that request teams(...) and games(...)
    // - essentialMatchups queries
    const allowedQueryPatterns = [/\bteams\s*\(/i, /\bgames\s*\(/i, /\bessentialMatchups\b/i];
    const isAllowedQueryString = q => allowedQueryPatterns.some(r => r.test(q));

    const looksLikeGraphQuery = /\bteams\s*\(/i.test(qstr) && /\bgames\s*\(/i.test(qstr);

    // Consider a variables object present if any of the known variables are non-null/defined
    // (we compute this first so callers that pass an empty `{}` do not bypass
    // the allowlist check accidentally).
    // `variables` is normalized to an object earlier in this function, so
    // checking its truthiness is redundant. Consider the variables present
    // if any of the known fields are non-null/defined.
    const hasSeasonVariable =
      variables.season != null ||
      variables.owner != null ||
      variables.pr != null ||
      variables.name != null;

    // If the caller provided a free-form query string that doesn't match our
    // allowlist, refuse to execute it. This prevents future accidental
    // usage where a user-controlled string could be used to induce unsafe
    // behavior. Require a meaningful variables object (hasSeasonVariable)
    // rather than relying on the truthiness of `variables` (an empty object
    // is truthy and would previously bypass this check).
    if (!isAllowedQueryString(qstr) && !hasSeasonVariable) {
      throw new Error('Refusing to execute unsupported or potentially unsafe query string.');
    }

    if (looksLikeGraphQuery || hasSeasonVariable) {
      return this.queryGraph(season);
    }

    // For essential matchups query
    if (qstr.includes('essentialMatchups')) {
      const matchups = await this.queryEssentialMatchups(variables);
      return {
        data: {
          essentialMatchups: matchups,
        },
      };
    }

    // Provide helpful context to aid debugging in CI/production
    const snippet = (() => {
      if (typeof query === 'string') {
        return query.length > 200 ? query.slice(0, 200) + '...' : query;
      }
      return String(query);
    })();
    throw new Error(
      `Unsupported query type. Expected queries containing 'teams(season:)' and 'games(season:)' for graph queries, or 'essentialMatchups' for matchup queries. Received: ${snippet}`
    );
  }
}

// Create a global instance
export const staticData = new StaticDataAdapter('./web/data');
