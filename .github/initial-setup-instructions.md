# .instructions.md — Automate FBS GraphQL Setup (for ChatGPT 4.1)

These are explicit, copy-pasteable steps ChatGPT 4.1 can execute or guide you through to run the FBS Schedule Graph (GraphQL) project and compute leverage scores.

## 1) Unpack and enter the project
```powershell
Expand-Archive -Path .\fbs-graph-graphql.zip -DestinationPath . -Force
Set-Location .\fbs-graph-graphql
```

## 2) Install dependencies
Preferred (pnpm):
```powershell
corepack enable
pnpm install
```
Alternative (npm):
```powershell
npm install
```

## 3) Start the GraphQL server
```powershell
pnpm dev
# or: npm run dev
```
Open the Apollo Sandbox link shown in the terminal.

## 4) Run the example query
Paste this into Apollo Sandbox:
```graphql
query TopEssential {
  essentialMatchups(season: 2025, limit: 10) {
    id
    date
    type
    leverage
    home { id name conference { shortName } }
    away { id name conference { shortName } }
  }
}
```

## 5) Edit data
Data lives in `src/data/*.json`.  
Replace or append full schedules and teams as needed.

## 6) Recompute leverage scores
```powershell
pnpm score
```
Writes `games.scored.<season>.json` with calculated leverage.

## 7) Adjust leverage formula
Edit `src/lib/score.ts` to modify:
- Rank weight mapping
- SP+ percentile fallback
- Bridge and timing boosts

Re-run `pnpm score` after edits.

## 8) Useful queries
Conference connectivity:
```graphql
query Conn {
  conferenceConnectivity(season: 2025) {
    a { shortName } b { shortName }
    edges averageLeverage
  }
}
```

Team neighbors:
```graphql
query Neighbors {
  team(id: "uga") {
    name
    neighbors(season: 2025) { id name }
    degree(season: 2025)
  }
}
```

Games by conference:
```graphql
query ConfGames {
  games(season: 2025, conferenceId: "sec") {
    id type date leverage
    home { name } away { name }
  }
}
```
