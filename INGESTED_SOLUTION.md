**Project Summary**

- **Name:**: `fbs-graph` — A static/GraphQL-based dataset and web visualizer for FBS graphs.
- **Purpose:**: Hold canonical data, scripts to generate/transform it, and small web visualization pages.

**Repository Structure**

- **Root files:**: `package.json`, `tsconfig.json`, `README.md`, `LICENSE`, `PRE_DEPLOYMENT_CHECKLIST.md`.
- **Source:**: `src/` — GraphQL schema and TS entry (`index.ts`, `schema.graphql`) and `data/` JSON assets.
- **Library:**: `lib/` — core helpers and tests (e.g., `dataLoader.ts`, `score.ts`).
- **Types:**: `types/` and top-level `types/index.ts` — shared TypeScript types.
- **Web UI:**: `web/` — static HTML, JS, CSS, and `serve-web.ts` for local serving. Contains `modules/` with UI logic and test files.
- **Scripts:**: `scripts/` — data ingest, fetch, generation and helper scripts (e.g., `fetch-cfbd-*`, `generate-static-data.ts`, `serve-web.ts`).
- **Scripts:**: `scripts/` — data ingest, fetch, generation and helper scripts (e.g., `fetch-cfbd-*`, `generate-static-data.ts`, `serve-web.ts`).
  - Note: Poll/ranking tooling was consolidated. Use `npm run fetch:rankings` to fetch poll snapshots (AP/CFP/COACHES) and `npm run fetch:all-ranks` to run rankings + ratings (ELO/SP+). A helper `scripts/merge-polls-csv.ts` exists to normalize/dedupe `csv/polls.csv` into canonical `src/data/polls.json`, while `scripts/import-from-csv.ts` performs deduplication when importing.
- **Docs:**: `docs/` — documentation files like `DATABASE_FIELDS.md`, `SOLUTION_OVERVIEW.md`, `GITHUB_PAGES_DEPLOYMENT.md`.
- **CSV:**: `csv/` — source CSVs used by import scripts (e.g., `teams.csv`, `polls.csv`).

**Key Scripts & Tasks**

- **NPM scripts & tasks:**: See `package.json` for full scripts. In the workspace there are two run tasks defined:
  - **Run web server (task):**: label `Run web server` -> `npm run web:serve`
  - **Run audit-data script (task):**: label `Run audit-data script` -> `npx tsx .\scripts\audit-data.ts`
- **Notable scripts in `scripts/`:**: `generate-static-data.ts`, `fetch-cfbd-teams-to-csv.ts`, `fetch-cfbd-schedules-to-csv.ts`, `import-from-csv.ts`, `serve-web.ts`.

**How To Run (PowerShell, Windows)**

- **Install dependencies:**

```powershell
npm install
```

- **Run the web server (dev/preview):**

```powershell
# via npm script (task configured in workspace)
npm run web:serve

# or use the workspace task in VS Code: `Run web server`
```

- **Run audit / data script:**

```powershell
npx tsx .\scripts\audit-data.ts
# or run the workspace task `Run audit-data script`
```

- **Build / tests:**

```powershell
# Run TypeScript build (if configured) or run individual scripts
npm run build
# Run unit tests (vitest)
npm test
```

**Important Files to Review**

- **`src/index.ts`**: entry point for GraphQL server or static generation.
- **`src/schema.graphql`**: GraphQL schema for the domain model.
- **`web/`**: example visualizers and static pages you can open locally.
- **`docs/SOLUTION_OVERVIEW.md`**: high-level description of goals and approach.

**Security & DevOps Notes**

- Secrets: None are checked in — scripts read environment variables where needed. Avoid hardcoding credentials.
- CI/CD: See `.github/workflows` guidance in docs (if present) and `GITHUB_PAGES_DEPLOYMENT.md` for publishing the `web/` output.

**Next Steps & Suggestions**

- **Add pointer in `README.md`:** Add a short link that points to `INGESTED_SOLUTION.md` for quick onboarding.
- **Run the web server and audit script** to validate local setup.
- **Optional:** Create a `docs/DEVELOPER_ONBOARDING.md` with local environment tips (Node version, recommended editor settings, VS Code tasks).
 - **Optional:** Create a `docs/DEVELOPER_ONBOARDING.md` with local environment tips (Node version, recommended editor settings, VS Code tasks). 

**Contact / Ownership**

- **Repository:**: `apkasten906/fbs-graph` (current branch: `dev`).
- **Maintainers:**: See `README.md` for contact and contribution guidelines.

-- End of ingest summary --
