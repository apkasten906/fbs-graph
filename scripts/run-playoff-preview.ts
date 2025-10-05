import { createApolloServer } from '../src/server.js';

interface Options {
  season: number;
  limit?: number;
  gameLimit?: number;
  leverageThreshold?: number;
}

function parseArgs(argv: string[]): Options {
  const defaults: Options = { season: 2025 };
  for (const arg of argv) {
    const [key, value] = arg.split('=');
    if (!value) continue;
    switch (key) {
      case '--season':
        defaults.season = Number.parseInt(value, 10);
        break;
      case '--limit':
        defaults.limit = Number.parseInt(value, 10);
        break;
      case '--gameLimit':
        defaults.gameLimit = Number.parseInt(value, 10);
        break;
      case '--leverageThreshold':
        defaults.leverageThreshold = Number.parseFloat(value);
        break;
      default:
        break;
    }
  }
  return defaults;
}

const options = parseArgs(process.argv.slice(2));

const server = createApolloServer();
await server.start();

const result = await server.executeOperation({
  query: `#graphql
    query PlayoffPreview($season: Int!, $limit: Int, $gameLimit: Int, $leverageThreshold: Float) {
      playoffPreview(season: $season, limit: $limit, gameLimit: $gameLimit, leverageThreshold: $leverageThreshold) {
        generatedAt
        season
        leverageThreshold
        remainingHighLeverageGames {
          id
          date
          leverage
          home { name }
          away { name }
        }
        contenders {
          team { name conference { shortName } }
          rank
          resumeScore
          leverageIndex
          nextGame { id date }
        }
      }
    }
  `,
  variables: options
});

await server.stop();

if (result.body.kind !== 'single') {
  throw new Error('Expected a single GraphQL response body');
}

if (result.body.singleResult.errors?.length) {
  console.error('GraphQL errors:\n', result.body.singleResult.errors);
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(result.body.singleResult.data?.playoffPreview, null, 2));
}
