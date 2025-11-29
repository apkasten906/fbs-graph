# Database Field Documentation

This document describes the fields for each main database entity (JSON file) in the FBS Graph solution. All field types and relationships are based on the current canonical data files. Use this as the source of truth for onboarding, development, and data integration.

---

## teams.json

- `id` (string): Unique team identifier (e.g., "alabama").
- `name` (string): Full team name (e.g., "Alabama").
- `shortName` (string): Abbreviated team name (e.g., "ALA").
- `conferenceId` (string): Conference ID (links to `conferences.json`).

---

## conferences.json

- `id` (string): Unique conference identifier (e.g., "sec").
- `name` (string): Full conference name (e.g., "SEC").
- `shortName` (string): Abbreviated conference name (e.g., "SEC").
- `division` (string): Division (e.g., "FBS").

---

## games.json

- `id` (string): Unique game identifier (e.g., ESPN game id).
- `season` (number): Year of season (e.g., 2025).
- `week` (number): Week number within the season.
- `phase` (string): Season phase (e.g., "REGULAR").
- `date` (string): ISO 8601 date/time (UTC) of game kickoff.
- `type` (string): Game type (e.g., "CONFERENCE", "NON_CONFERENCE").
- `homeTeamId` (string): Home team ID (links to `teams.json`).
- `awayTeamId` (string): Away team ID (links to `teams.json`).
- `result` (string): Game result ("HOME_WIN", "AWAY_WIN", "TIE", or "TBD").
- `homePoints` (number|null): Home team points (null if not played).
- `awayPoints` (number|null): Away team points (null if not played).

---

## polls.json

- `teamSeasonId` (string): Team-season identifier (format: `<teamId>-<season>`, links to `teamSeasons.json`).
- `poll` (string): Poll name (e.g., "AP").
- `week` (number): Week number for the poll.
- `rank` (number): Team rank in the poll.
- `date` (string): ISO 8601 date/time of poll release.

### Polls, sources, and canonicalization

- **Supported poll types:** `AP`, `COACHES`, `CFP` (official CFP committee), plus computed rating types like `ELO` and `SP_PLUS` which are produced by rating scripts.
- **Fetch tooling:** Use `npm run fetch:rankings` to fetch poll snapshots (AP/CFP/COACHES). Use `npm run fetch:all-ranks` to run both ranking snapshots and computed ratings (ELO/SP+).
- **CSV history vs canonical JSON:** The repository keeps an append-only `csv/polls.csv` as the raw snapshot history. Two helpers exist:
  - `scripts/merge-polls-csv.ts` — optional helper that normalizes and deduplicates `csv/polls.csv` into a canonical set and writes `src/data/polls.json` (atomic overwrite).
  - `scripts/import-from-csv.ts` — the primary import that reads `csv/polls.csv` and deduplicates rows by `(poll, teamSeasonId)`, keeping the latest row by date/week when duplicates exist; this produces the canonical `src/data/polls.json` used at runtime.

When adding new poll snapshots, prefer appending to `csv/polls.csv` and then running the import or merge step to refresh `src/data/polls.json`.

---

## teamSeasons.json

- `id` (string): Unique team-season identifier (format: `<teamId>-<season>`).
- `teamId` (string): Team ID (links to `teams.json`).
- `season` (number): Year of season.
- `coach` (string|null): Coach name (may be null if unknown).
- `spPlus` (number): SP+ rating (may be negative).
- `returningProduction` (number): Fraction of returning production (0–1).
- `record` (object):
  - `wins` (number): Number of wins.
  - `losses` (number): Number of losses.
  - `ties` (number): Number of ties.
  - `confWins` (number): Conference wins.
  - `confLosses` (number): Conference losses.

---
