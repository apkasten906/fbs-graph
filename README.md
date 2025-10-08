# FBS Schedule Graph: GraphQL + Interactive Web Visualizer

This project models FBS college football teams and schedules as a graph, exposing rich data and analytics via a GraphQL API and interactive web UI.

## 🚀 Getting Started

### 1. Install dependencies

```bash
npm install   # or pnpm install / yarn install
```

### 2. Import and prepare all data (one step)

```bash
npm run setup
# This script fetches conferences, teams, schedules, polls, Elo, SP+ ratings, and builds all required data files.
# Requires a valid CFBD_KEY (see below).
```

> **Note:** The setup script uses PowerShell. On macOS/Linux, run the equivalent commands in your shell or adapt as needed.

### 3. Start the backend GraphQL server

```bash or ps
npm run dev
# Starts Apollo Server at http://localhost:4100/
```

Open the Apollo Sandbox link from the console to explore the API, or use the sample queries below.

### 4. Start the static web server (for the interactive UI)

```bash or ps
npm run web:serve
# Serves the web/ directory at http://localhost:4173
```

From the main page, choose either [Matchup Timeline](http://localhost:4173/web/matchup-timeline.html)
or [FBS Graph Visualizer](http://localhost:4173/web/fbs-graph-visualizer.html).

> **Tip:** Opening HTML files directly from disk will not work due to browser security restrictions—always use the static server.

---

## 🗝️ Environment Variables

- `CFBD_KEY`: Required for data import scripts. Get a free API key from [CollegeFootballData.com](https://collegefootballdata.com/).
- You can set this in a `.env` file or export it in your shell before running `npm run setup`. See an example file here: `.env.example`

---

## 🏗️ Project Structure

- `scripts/` — Data ingestion, transformation, and setup scripts (see `setup.ps1` for the full pipeline)
- `src/` — Core backend logic, GraphQL schema, and data models
- `web/` — Static web UI (HTML, JS, CSS modules)
- `csv/` — Raw and processed CSV data (imported by scripts)
- `package.json` — All available scripts and dependencies

---

## 🧑‍💻 Example GraphQL Queries

**Essential matchups:**

```graphql
query {
  essentialMatchups(season: 2025, limit: 20) {
    id
    date
    home {
      name
      conference {
        shortName
      }
    }
    away {
      name
      conference {
        shortName
      }
    }
    type
    leverage
  }
}
```

**Playoff preview:**

```graphql
query {
  playoffPreview(season: 2025, gameLimit: 8) {
    generatedAt
    remainingHighLeverageGames {
      id
      date
      leverage
      home {
        name
      }
      away {
        name
      }
    }
    contenders {
      team {
        name
      }
      rank
      resumeScore
      leverageIndex
    }
  }
}
```

---

## 🖥️ Web UI Features

- Interactive timeline and graph visualizations of the FBS schedule
- Dynamic conference/legend data from backend
- Shortest path and leverage chain explorer
- Modern, responsive design (see `web/common-theme.css`)

---

## 🧩 Useful Scripts

- `npm run setup` — One-step data import and preparation
- `npm run dev` — Start backend GraphQL server
- `npm run web:serve` — Start static web server
- `npm run fetch:all` — Fetch all data (conferences, teams, schedules, polls, ratings)
- `npm run import:csv` — Import/transform CSV data
- `npm run preview:playoff` — Run playoff preview query from CLI

---

## 🛠️ Troubleshooting

- **Web UI not loading data?** Make sure you are using the static server (`npm run web:serve`) and not opening files directly.
- **Missing data?** Ensure you have set `CFBD_KEY` and run `npm run setup`.
- **Port conflicts?** Change the `PORT` environment variable for the backend or web server as needed.

---

## 📚 Further Reading

- See `docs/SOLUTION_OVERVIEW.md` for architecture and data flow
- See `scripts/setup.ps1` for the full data pipeline
- Explore `src/lib/score.ts` for leverage computation details

---

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

## Tests

Install dependencies and execute the Vitest suite to confirm the dynamic timeline continues to populate matchups when filters change:

```bash
npm install
npm test -- --run
```

## Data

Small, illustrative fixtures are included in JSON. Replace with full 136-team data when ready:

**Data options:**

- CSV files in `csv/` provide the full, up-to-date FBS data (recommended for real analysis and the web UI/backend). Run setup script to refresh the data.
- JSON files in `src/data/` are small, illustrative fixtures for testing or quick demos.

**Key files:**

- `csv/conferences.csv`, `csv/teams.csv`, `csv/team_seasons.csv`, `csv/polls.csv`, `csv/schedules_2025.csv` (full data, auto-generated by setup)
- `src/data/conferences.json`, `src/data/teams.json`, `src/data/teamSeasons.json`, `src/data/polls.json`, `src/data/games.json` (limited sample data)

## Visualize leverage timelines in the browser

Want to explore the projected impact chains without wiring up a frontend framework? The repo ships a static HTML experience at `web/matchup-timeline.html` that loads the schedule JSON and renders the shortest 1/leverage path between any two programs.

1. Start the static server:
   ```bash
   npm run web:serve
   ```
   The helper serves the `web/` directory at [http://localhost:4173](http://localhost:4173) with the correct MIME types so the page can request JSON and modules.
2. Open [High-Impact Matchup Timeline](http://localhost:4173/web/matchup-timeline.html) in your browser.
3. Pick a conference scope (individual conference, Power 4, or all FBS) and select any two teams to see the chain of matchups that most influence their playoff odds.

Opening the file directly from disk will display instructions that remind you to launch the static server—modern browsers block `fetch()` calls from the file system for security reasons, so serving over HTTP is required.

## Leverage formula (simplified)

```
leverage = rankWeight(home) * rankWeight(away) * bridgeBoost * timingBoost
```

- `rankWeight(team)`: from AP rank if present (1/rank scaled), else SP+ percentile.
- `bridgeBoost`: 1.2 for non-conference, 1.1 for inter-division, else 1.0.
- `timingBoost`: 1.0 early season → 1.15 late season (Week 12+), bowls/playoffs 1.25.

You can adjust in `src/lib/score.ts`.
