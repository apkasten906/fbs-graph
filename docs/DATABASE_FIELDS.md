# Database Field Documentation

This document describes the fields for each main database entity (JSON file) in the FBS Graph solution.

---

## teams.json

- `id`: Unique team identifier (string)
- `name`: Full team name (string)
- `shortName`: Abbreviated team name (string)
- `conferenceId`: Conference ID (string, links to conferences.json)

---

## conferences.json

- `id`: Unique conference identifier (string)
- `name`: Full conference name (string)
- `shortName`: Abbreviated conference name (string)
- `division`: Division (e.g., "FBS")

---

## games.json

- `id`: Unique game identifier (string)
- `season`: Year of season (number)
- `week`: Week number (number)
- `phase`: Season phase (e.g., "REGULAR")
- `date`: ISO date string
- `type`: Game type (e.g., "CONFERENCE", "NON_CONFERENCE")
- `homeTeamId`: Home team ID (string, links to teams.json)
- `awayTeamId`: Away team ID (string, links to teams.json)
- `result`: Game result (string, e.g., "TBD")
- `homePoints`: Home team points (number or null)
- `awayPoints`: Away team points (number or null)

---

## polls.json

- `teamSeasonId`: Team-season identifier (string, links to teamSeasons.json)
- `poll`: Poll name (string, e.g., "AP")
- `week`: Week number (number)
- `rank`: Team rank (number)
- `date`: ISO date string

---

## teamSeasons.json

- `id`: Unique team-season identifier (string)
- `teamId`: Team ID (string, links to teams.json)
- `season`: Year of season (number)
- `coach`: Coach name (string)
- `spPlus`: SP+ rating (number)
- `returningProduction`: Fraction of returning production (number)
- `record`: Object with:
  - `wins`: Number of wins (number)
  - `losses`: Number of losses (number)
  - `ties`: Number of ties (number)
  - `confWins`: Conference wins (number)
  - `confLosses`: Conference losses (number)

---
