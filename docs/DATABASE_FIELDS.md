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
