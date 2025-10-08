import { createApolloServer } from '../src/server.js';

interface Options {
  season: number;
  limit?: number;
  gameLimit?: number;
  leverageThreshold?: number;
}

function printHelp(): void {
  console.log(`Usage: pnpm preview:playoff -- [options]

Options:
  --season=<year>              Season to evaluate (default: 2025)
  --limit=<teams>              Maximum number of contenders to return
  --gameLimit=<games>          Maximum number of remaining high leverage games
  --leverageThreshold=<value>  Minimum leverage index required for remaining games

Examples:
  pnpm preview:playoff -- --season=2025
  pnpm preview:playoff -- --season=2025 --limit=5 --gameLimit=6
`);
}

function parseArgs(argv: string[]): Options {
  const options: Options = { season: 2025 };
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }

    const [key, rawValue] = arg.split('=');
    if (!rawValue) continue;

    switch (key) {
      case '--season': {
        const parsed = Number.parseInt(rawValue, 10);
        if (Number.isNaN(parsed)) {
          console.warn(`Ignoring invalid season: "${rawValue}"`);
        } else {
          options.season = parsed;
        }
        break;
      }
      case '--limit': {
        const parsed = Number.parseInt(rawValue, 10);
        if (Number.isNaN(parsed)) {
          console.warn(`Ignoring invalid limit: "${rawValue}"`);
        } else {
          options.limit = parsed;
        }
        break;
      }
      case '--gameLimit': {
        const parsed = Number.parseInt(rawValue, 10);
        if (Number.isNaN(parsed)) {
          console.warn(`Ignoring invalid gameLimit: "${rawValue}"`);
        } else {
          options.gameLimit = parsed;
        }
        break;
      }
      case '--leverageThreshold': {
        const parsed = Number.parseFloat(rawValue);
        if (Number.isNaN(parsed)) {
          console.warn(`Ignoring invalid leverageThreshold: "${rawValue}"`);
        } else {
          options.leverageThreshold = parsed;
        }
        break;
      }
      default:
        console.warn(`Unrecognized option: "${key}". Run with --help to see supported flags.`);
        break;
    }
  }
  return options;
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
  variables: options,
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
