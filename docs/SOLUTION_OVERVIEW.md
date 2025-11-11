# FBS Schedule Graph: Solution Overview

## Project Purpose

FBS Schedule Graph is a modern, modular tool for exploring the playoff leverage and impact of every FBS college football game. It provides:

- A robust data pipeline for ingesting and normalizing schedule, team, and ranking data
- Dynamic leverage calculations and graph-based pathfinding between programs
- An interactive, modular web UI for visualizing leverage chains and filtering by conference, tier, or team
- A secure, local static server for serving the web UI and data

## Solution Architecture

### 1. Data Pipeline

- **CSV Ingestion**: Full FBS data is provided as CSVs in `csv/` (schedules, teams, conferences, polls, etc.)
- **Automated Setup**: `npm run setup` (or PowerShell script) ingests CSVs and generates normalized JSON fixtures in `src/data/`
- **Test Data**: JSON files are used for quick tests and onboarding; CSVs provide the full dataset

### 2. Leverage Calculation & Graph Model

- **Centralized Logic**: All leverage and pathfinding logic is in `src/lib/score.ts` and related modules
- **Dynamic Conference Data**: Conferences and teams are loaded dynamically, supporting future expansion
- **Graph Algorithms**: Teams and games are modeled as a graph for shortest-path and impact analysis

### 3. Modular Web Frontend

- **ES Modules**: UI logic is split into focused modules under `web/modules/` for maintainability
- **Interactive Timeline**: Users can select teams, filter by conference or leverage tier, and trace leverage chains
- **Modern UX**: Responsive design, clear filtering, and dynamic path summaries

### 4. Static Server

- **`web/serve-web.ts`**: Secure, local static server with correct MIME types and safe routing
- **Project Root Serving**: Serves both `/web/` and root-level assets for a seamless local experience

## Data Flow

1. **Ingest**: Run the setup script to import CSVs and generate normalized JSON in `src/data/`
2. **Process**: Leverage logic processes the data and builds the graph model
3. **Serve**: The static server serves the web UI and data files for local exploration
4. **Explore**: Use the web UI to select teams, filter by conference, and trace leverage paths

## Getting Started

1. **Install dependencies**: `npm install`
2. **Run setup**: `npm run setup` (imports CSVs, builds JSON)
3. **Start server**: `npm run web:serve`
4. **Open**: Visit `http://localhost:4173/web/index.html` in your browser

## Leverage Formula

```text
leverage = rankWeight(home) * rankWeight(away) * bridgeBoost * timingBoost
```

- `rankWeight(team)`: Based on AP rank or SP+ percentile
- `bridgeBoost`: Higher for non-conference/inter-division games
- `timingBoost`: Increases for late season and playoffs

## Project Structure

- `src/`: Main source code, leverage logic, and data
- `web/`: Static assets, modular frontend, and static server
- `scripts/`: Data ingestion and utility scripts
- `csv/`: Full FBS CSV data
- `docs/`: Documentation

## How to Extend

- Add new data sources by updating the CSVs and ingestion scripts
- Extend leverage logic in `src/lib/score.ts`
- Add new UI modules in `web/modules/`

## FAQ

**Q: What is "leverage"?**
A: A metric estimating the impact of a game on playoff selection, blending team quality, conference structure, and schedule timing.

**Q: Can I use my own data?**
A: Yes! Replace the CSVs in `csv/` and rerun the setup script.

**Q: Is this production-ready?**
A: This is a research and exploration tool, not a production system. Contributions and improvements are welcome!

## License

MIT License

---

For more details, see the README and source files.
