# FBS GraphQL Graph (Schedules as a Graph)

This project models FBS teams and schedules as a graph and exposes it via GraphQL (Apollo Server v4).

## Quick start

```bash
pnpm i   # or npm i / yarn
pnpm dev # starts GraphQL on http://localhost:4000/graphql
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
