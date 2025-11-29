/**
 * Graph Data Management Module
 *
 * Handles data loading from static JSON files or GraphQL API.
 * Provides a unified interface for loading teams and games data.
 */

/**
 * GraphQL query for fetching team and game data
 */
export const GRAPH_QUERY = `
query Graph($season: Int!) {
  teams(season: $season) {
    id name shortName conference { id shortName }
  }
  games(season: $season) {
    id type leverage date
    home { id name conference { id shortName } }
    away { id name conference { id shortName } }
  }
}`;

/**
 * GraphQL query for fetching conference metadata
 */
export const CONFERENCES_QUERY = `
query { conferences { id name shortName } }
`;

/**
 * Helper function to make GraphQL POST requests
 * @param {string} url - GraphQL endpoint URL
 * @param {object} body - Request body containing query and variables
 * @returns {Promise<object>} GraphQL response
 */
export function graphqlPost(url, body) {
  return fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => r.json());
}

/**
 * Load graph data (teams and games) for a season
 * Tries static data adapter first, falls back to GraphQL if unavailable
 *
 * @param {number} season - Season year (e.g., 2025)
 * @param {object} [options] - Optional configuration
 * @param {object} [options.staticAdapter] - Static data adapter instance (window.staticDataAdapter)
 * @param {string} [options.graphqlEndpoint] - GraphQL endpoint URL (fallback if no static adapter)
 * @returns {Promise<{teams: Array, games: Array}>} Graph data
 * @throws {Error} If data loading fails
 */
export async function loadGraphData(season, options = {}) {
  const { staticAdapter, graphqlEndpoint } = options;

  // Try static data adapter first
  if (staticAdapter) {
    try {
      const result = await staticAdapter.queryGraph(season);
      if (!result || !result.data) {
        throw new Error('Static adapter returned invalid data');
      }
      return {
        teams: result.data.teams || [],
        games: result.data.games || [],
      };
    } catch (error) {
      console.warn('[graph-data] Static adapter failed, trying GraphQL fallback:', error);
      // Fall through to GraphQL
    }
  }

  // Fallback to GraphQL
  if (!graphqlEndpoint) {
    throw new Error('No GraphQL endpoint provided and static adapter unavailable');
  }

  const response = await graphqlPost(graphqlEndpoint, {
    query: GRAPH_QUERY,
    variables: { season },
  });

  if (response.errors) {
    const errorMsg = response.errors[0]?.message || 'GraphQL query failed';
    throw new Error(errorMsg);
  }

  if (!response.data) {
    throw new Error('GraphQL response missing data');
  }

  return {
    teams: response.data.teams || [],
    games: response.data.games || [],
  };
}

/**
 * Load conference metadata
 * Tries static data adapter first, falls back to GraphQL if unavailable
 *
 * @param {object} [options] - Optional configuration
 * @param {object} [options.staticAdapter] - Static data adapter instance (window.staticDataAdapter)
 * @param {string} [options.graphqlEndpoint] - GraphQL endpoint URL (fallback if no static adapter)
 * @returns {Promise<Array>} Array of conference objects with id, name, shortName
 * @throws {Error} If data loading fails
 */
export async function loadConferences(options = {}) {
  const { staticAdapter, graphqlEndpoint } = options;

  // Try static data adapter first
  if (staticAdapter) {
    try {
      const conferences = await staticAdapter.getConferences();
      if (Array.isArray(conferences)) {
        return conferences;
      }
      console.warn('[graph-data] Static adapter returned invalid conference data');
      // Fall through to GraphQL
    } catch (error) {
      console.warn(
        '[graph-data] Static adapter failed loading conferences, trying GraphQL fallback:',
        error
      );
      // Fall through to GraphQL
    }
  }

  // Fallback to GraphQL
  if (!graphqlEndpoint) {
    throw new Error('No GraphQL endpoint provided and static adapter unavailable');
  }

  const response = await graphqlPost(graphqlEndpoint, {
    query: CONFERENCES_QUERY,
  });

  if (response.errors) {
    const errorMsg = response.errors[0]?.message || 'Conference query failed';
    throw new Error(errorMsg);
  }

  if (!response.data || !response.data.conferences) {
    throw new Error('GraphQL response missing conference data');
  }

  return response.data.conferences;
}

/**
 * Load all data needed for the visualizer
 * Convenience function that loads both conferences and graph data
 *
 * @param {number} season - Season year (e.g., 2025)
 * @param {object} [options] - Optional configuration
 * @param {object} [options.staticAdapter] - Static data adapter instance (window.staticDataAdapter)
 * @param {string} [options.graphqlEndpoint] - GraphQL endpoint URL (fallback if no static adapter)
 * @returns {Promise<{conferences: Array, graphData: {teams: Array, games: Array}}>} All visualizer data
 * @throws {Error} If data loading fails
 */
export async function loadAllData(season, options = {}) {
  const [conferences, graphData] = await Promise.all([
    loadConferences(options),
    loadGraphData(season, options),
  ]);

  return {
    conferences,
    graphData,
  };
}
