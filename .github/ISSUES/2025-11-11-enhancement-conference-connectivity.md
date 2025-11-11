---
title: 'Enhancement: Conference connectivity metrics (avg/normalized/weighted/density)'
labels: enhancement
assignees: []
---

## Summary

The timeline explorer should surface two related things:

- Head-to-head matchups that most influence team rankings (high-leverage games).
- How conferences and schedules connect (a conference connectivity graph).

This issue captures a proposed enhancement to the `conference-connectivity-<season>.json` output produced by `scripts/generate-static-data.ts` so the UI can show both per-game importance and global connectivity in a comparable way.

## Proposed new metrics

For each inter-conference pair (A, B) compute and store:

- edges (number): raw count of games between the two conferences.
- totalLeverage (number): sum of per-game leverage values (include only numeric leverage).
- avgLeverage (number): totalLeverage / edges (0 when edges === 0).
- normalizedConnectivity (number): totalLeverage / sqrt(sizeA \* sizeB)
  - Reduces bias from very large conferences by dividing by the geometric mean of conference sizes.
- weightedConnectivity (number): sum_i (lev_i \* avgTeamStrength_i)
  - avgTeamStrength_i = (strength(home) + strength(away)) / 2
  - strength(...) is a per-team normalized rating (0..1) derived from normalized Elo / SP+ / combined metric.
- density (number): edges / (sizeA \* sizeB) // schedule intensity between the two conferences
- representativeGames (array): top N game objects or IDs for quick UI drilldown (e.g. top 3 by leverage)

## Rationale

- avgLeverage answers "how influential is a typical head-to-head game between these conferences?"
- totalLeverage shows absolute influence when many matchups exist.
- normalizedConnectivity adjusts for conference sizes so comparisons are fairer across mismatched conference sizes.
- weightedConnectivity favors matchups between stronger teams, which are often more important to ranking changes.
- density indicates how connected the schedules are (a small conference pair with a few high-impact games vs. a large conference pair with many low-impact games).

## Implementation notes

- Only include games that have numeric leverage (skip POSTSEASON; computeLeverageForGame already skips those).
- Compute a `teamStrengthMap` for the season using existing normalized ratings (e.g., use `buildNormalizedElo` and/or `buildNormalizedSpPlus`), then min-max normalize to 0..1 if necessary.
- Representative games should be the top N by leverage for that conference pair; include minimal fields (game id, path, home/away teams, date, leverage).
- Round numeric outputs to 4 decimal places for readability.
- If edges === 0, set averages and normalized metrics to 0 and do not divide by zero.

## Files to update

- `scripts/generate-static-data.ts` — compute the new metrics and write them to `web/data/conference-connectivity-<season>.json`.
- `web/modules/static-data-adapter.js` — ensure `getConferenceConnectivity` loads the new fields and the UI can read them.
- Optionally: update docs (e.g., `docs/DATABASE_FIELDS.md` or `SOLUTION_OVERVIEW.md`) to describe new fields.

## Follow-ups

- Decide whether to use Elo, SP+, or combined strength. Default proposal: average of normalized Elo and normalized SP+.
- Decide representativeGames N (default 3).

## Notes

This issue is a tracking ticket to revisit the connectivity metric later; the current generator will continue to output `averageLeverage` and `edges`. The proposed enhancements will improve comparability and drill-down UX later.

Created-by: automated note from development session (feat/publish-on-github)
Date: 2025-11-11
