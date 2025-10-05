# FBS GraphQL Graph (Schedules as a Graph)

This project models FBS teams and schedules as a graph and exposes it via GraphQL (Apollo Server v4).

## Quick start

```bash
pnpm i   # or npm i / yarn
pnpm dev # starts GraphQL on http://localhost:4100/
```

Open Apollo Sandbox in the console output and try:

```graphql
query {
  essentialMatchups(season: 2025, limit: 20) {
    id
    date
    home { id name conference { shortName } }
    away { id name conference { shortName } }
    type
    leverage
  }
}
```

To preview the playoff picture with updated data from the Sandbox:

```graphql
query {
  playoffPreview(season: 2025, gameLimit: 8) {
    generatedAt
    remainingHighLeverageGames {
      id
      date
      leverage
      home { name }
      away { name }
    }
    contenders {
      team { name }
      rank
      leverageIndex
      resumeScore
    }
  }
}
```

### Run everything inside Codex

Need a walkthrough that works directly inside the Codex workspace? Follow these steps:

1. **Install dependencies** – `pnpm install`. The Codex image already includes Node 20 and pnpm, so the install should only hydrate the local `node_modules/` directory.
2. **Compile and type-check** – `pnpm build`. This confirms the data files and resolvers line up with the schema before you start the server.
3. **Start the GraphQL dev server** – `pnpm dev`. Codex forwards port 4100 automatically; watch the terminal output for the Apollo Sandbox link.
4. **Explore the API** – open the printed Sandbox URL in the Codex preview panel and run the sample `playoffPreview` query (see below) to inspect the projected bracket.
5. **Prefer the terminal?** Skip the browser and run `pnpm preview:playoff -- --season=2025 --gameLimit=6 --limit=8` to execute the same query via the CLI helper.

### Preview the playoff picture from the CLI

If you want to exercise the `playoffPreview` resolver without opening a browser, use the helper script:

```bash
pnpm preview:playoff
```

Pass optional arguments to tailor the request (remember the extra `--` so `pnpm` forwards them):

```bash
pnpm preview:playoff -- --season=2025 --gameLimit=6 --limit=8 --leverageThreshold=0.8
```

Need a refresher on the available flags? Ask for help straight from the script:

```bash
pnpm preview:playoff -- --help
```

The script prints a JSON payload that highlights what the resolver considers the most consequential games and teams. A trimmed sample response looks like this:

```json
{
  "generatedAt": "2025-10-05T12:00:00.000Z",
  "season": 2025,
  "leverageThreshold": 0.75,
  "remainingHighLeverageGames": [
    {
      "id": "2025-11-22-OSU-MICH",
      "date": "2025-11-22",
      "leverage": 0.92,
      "home": { "name": "Michigan" },
      "away": { "name": "Ohio State" }
    }
  ],
  "contenders": [
    {
      "team": { "name": "Georgia" },
      "rank": 1,
      "resumeScore": 92.4,
      "leverageIndex": 0.88,
      "nextGame": { "id": "2025-11-29-UGA-ALA", "date": "2025-11-29" }
    }
  ]
}
```

The script spins up an in-memory Apollo Server instance, executes the query, and prints the JSON response so you can inspect the upcoming high-leverage games and the current contender stack.

### Why run `pnpm build`?

The build process transpiles the TypeScript server into `dist/` and performs a full type check along the way. That surfaces schema or data inconsistencies immediately instead of at runtime. Now that the `tsconfig` scopes only the server code, `pnpm build` completes cleanly again and provides quick confidence that the GraphQL changes can be deployed safely.

### Scripts
- `pnpm score` recomputes leverage scores from polls and ratings.
- Edit JSON in `src/data/` to add all teams/games. A CSV importer stub lives in `scripts/compute-leverage.ts`.

## Data
Small, illustrative fixtures are included. Replace with full 136-team data when ready:
- `conferences.json`
- `teams.json`
- `teamSeasons.json`
- `polls.json`
- `games.json`

## Leverage formula (simplified)
```
leverage = rankWeight(home) * rankWeight(away) * bridgeBoost * timingBoost
```
- `rankWeight(team)`: from AP rank if present (1/rank scaled), else SP+ percentile.
- `bridgeBoost`: 1.2 for non-conference, 1.1 for inter-division, else 1.0.
- `timingBoost`: 1.0 early season → 1.15 late season (Week 12+), bowls/playoffs 1.25.

You can adjust in `src/lib/score.ts`.
