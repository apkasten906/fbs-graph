# FBS Graph Solution Overview

## Purpose

This project models NCAA FBS football teams and schedules as a graph, exposing the data via a GraphQL API (Apollo Server v4). It enables advanced queries, analytics, and leverage scoring for matchups.

## Main Features

- **GraphQL API**: Query teams, games, conferences, polls, and computed leverage scores.
- **Data Model**: JSON fixtures for teams, games, conferences, polls, and team seasons.
- **Leverage Scoring**: Calculates matchup importance using rank, timing, and bridge boosts.
- **Scripts**: Import data from CSV, recompute leverage scores, and manage fixtures.

## Architecture

- **Apollo Server v4**: Serves the GraphQL API.
- **TypeScript**: Strictly typed codebase for reliability.
- **Data Layer**: JSON files in `src/data/` for all core entities.
- **Business Logic**: Leverage formula and scoring in `src/lib/score.ts`.
- **CSV Import**: Scripts in `scripts/` for bulk data import.

## Quick Start

1. Install dependencies: `pnpm i` (or `npm i`/`yarn`)
2. Start dev server: `pnpm dev` (GraphQL at http://localhost:4100/graphql)
3. Try example queries in Apollo Sandbox (see `example.graphql`)

## Data Files

- `conferences.json`, `teams.json`, `teamSeasons.json`, `polls.json`, `games.json` (in `src/data/`)
- Replace sample data with full 136-team fixtures for production use.

## Leverage Formula

```text
leverage = rankWeight(home) * rankWeight(away) * bridgeBoost * timingBoost
```

- `rankWeight(team)`: Based on AP rank or SP+ percentile.
- `bridgeBoost`: Higher for non-conference/inter-division games.
- `timingBoost`: Increases for late season and playoffs.

## Scripts

- `score`: Recomputes leverage scores.
- `import:csv`: Imports teams/games from CSV files.

## Project Structure

- `src/`: Main source code and schema
- `scripts/`: Utility scripts
- `csv/`: Example CSV data
- `docs/`: Documentation

## How to Extend

- Add new teams/games to JSON or via CSV import.
- Adjust leverage formula in `src/lib/score.ts`.
- Expand GraphQL schema for new queries.

## License

MIT License

---

For more details, see the README and source files.
