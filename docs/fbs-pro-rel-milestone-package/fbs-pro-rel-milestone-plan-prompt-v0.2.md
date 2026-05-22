# Plan Prompt: Milestone — Static Pro/Rel Scenario Explorer v0.2 for FBS Graph

## Context

We are extending the `fbs-graph` application with a promotion/relegation model for FBS college football.

The repository already supports a static GitHub Pages deployment. The current public deployment should remain static-first: no runtime GraphQL server and no exposed CFBD API key in browser code.

The milestone should modify and extend the existing static data generation approach so that:

1. Static data can support multiple seasons, not only the current/default season.
2. Existing GitHub Pages consumers remain backward-compatible.
3. The graph visualizations can use single-season or multi-year windows.
4. A pro/rel scoring model can be generated from static inputs.
5. Complete model output is generated before the browser explorer depends on it.
6. The public GitHub Pages app can host an interactive scenario explorer without a backend.

## Milestone Name

**Milestone: Pro/Rel Static Scenario Explorer**

## Product Goal

Create a static, GitHub Pages-compatible feature that lets users explore a proposed multi-tier FBS promotion/relegation league structure using transparent, adjustable weighting assumptions.

The feature should support:

- All current FBS / FBS-transition teams in the dataset.
- Multi-year results inputs, initially focused on the last five completed seasons.
- Static JSON outputs under `web/data/pro-rel`.
- Scenario presets such as Balanced Launch, Pure Merit, Power Structure, Media Reality, and Open Pyramid.
- Dynamic browser-side recalculation of scores and tier assignments.
- A table-first explorer before graph integration.
- Optional graph overlays once model output is stable.

## Current Working Model

Default scoring model:

```text
Total Score =
  FiveYearResultsScore * 0.35
+ ScheduleSurvivalScore * 0.25
+ HeadToHeadGraphScore * 0.20
+ RosterNilScore * 0.10
+ BrandMediaScore * 0.10
```

Default tier structure:

```text
Tier 1: 20 national teams
Tier 2: 24 national teams
Tier 3: 72 regional teams, target 18 per region
Tier 4: all remaining teams, regional/development leagues
```

The model is intentionally configurable. The default is the launch scenario, not an assertion of final truth.

## Design Principles

1. **Static-first**: the public app must run on GitHub Pages with static JSON/CSV assets.
2. **No exposed API secrets**: CFBD API access remains build-time/local/CI only.
3. **Transparent model**: every team’s score must be explainable by component.
4. **Explicit data contract**: generated JSON must define stable ids, score ranges, null behavior, metadata, and provenance.
5. **Scenario-driven**: readers should be able to compare assumptions rather than accept one ranking as final.
6. **Multi-year support**: graph and scoring features must not be locked to `new Date().getFullYear()`.
7. **Separation of concerns**: raw data, normalized inputs, scenario weights, tier rules, model output, and UI rendering should remain separate.
8. **Testable calculations**: scoring and tier assignment should be small, deterministic functions with unit tests.
9. **Readable code**: prefer explicit, self-documenting names over abbreviations.
10. **No fuzzy joins**: pro/rel outputs must use team ids that exactly match the graph visualizer team ids.

## Required Data Contract

Add or generate these static files under:

```text
web/data/pro-rel/
```

Required files:

```text
metadata.json
team-inputs.json
scenario-presets.json
tier-rules.json
model-output-balanced.json
model-output-pure-merit.json
model-output-power-structure.json
model-output-media-reality.json
model-output-open-pyramid.json
```

Optional source/debug files may be added later:

```text
source-ap-results.json
source-schedule-strength.json
source-head-to-head-graph-strength.json
source-program-factors.json
data-warnings.json
```

### Score scale

All browser-facing component scores must be normalized numbers from 0 to 100 inclusive.

Required component score keys:

```text
fiveYearResults
scheduleSurvival
headToHeadGraph
rosterNil
brandMedia
```

Rules:

- Browser-facing component scores are required and non-null.
- Raw missing data may exist only in source/intermediate files.
- Missing data must become either a documented fallback score with a warning or a strict validation failure.
- Total scores are normalized to a 0–100 scale.
- Display totals should be rounded to two decimals.

### Required metadata fields

```json
{
  "modelVersion": "0.1.0",
  "generatedAt": "2026-05-22T00:00:00.000Z",
  "sourceSeasons": [2021, 2022, 2023, 2024, 2025],
  "generatedSeasons": [2021, 2022, 2023, 2024, 2025],
  "defaultSeason": 2025,
  "defaultScenarioId": "balanced-launch",
  "teamCount": 138,
  "dataWarnings": []
}
```

### Required provenance behavior

Manual or proxy inputs, especially `rosterNil` and `brandMedia`, must include:

- `sourceType`: `computed`, `manual`, or `proxy`
- `sourceName`
- `sourceSeasons`
- `confidence`: `high`, `medium`, or `low`
- `lastUpdated`
- optional `notes`

## Scenario Presets

Initial presets:

| Scenario | fiveYearResults | scheduleSurvival | headToHeadGraph | rosterNil | brandMedia |
|---|---:|---:|---:|---:|---:|
| Balanced Launch | 35 | 25 | 20 | 10 | 10 |
| Pure Merit | 55 | 10 | 25 | 5 | 5 |
| Power Structure | 25 | 35 | 15 | 15 | 10 |
| Media Reality | 25 | 20 | 15 | 15 | 25 |
| Open Pyramid | 45 | 10 | 30 | 10 | 5 |

Preset weights must sum to 100.

Custom user weights may temporarily total something other than 100. The UI should show the raw total, while scoring normalizes by the actual total. All-zero custom weights are invalid and should fall back to the selected preset or default scenario.

## Tier Rules

Default tier rules:

```json
{
  "tierOneSize": 20,
  "tierTwoSize": 24,
  "tierThreeTotalSize": 72,
  "tierThreeRegionTargets": {
    "east-atlantic": 18,
    "midwest-great-lakes": 18,
    "south-southeast": 18,
    "west-mountain-plains": 18
  },
  "tierFourBehavior": "all-remaining-by-region",
  "manualOverrides": []
}
```

Tier assignment rules:

1. Rank all eligible teams by scenario total score.
2. Top 20 become Tier 1.
3. Next 24 become Tier 2.
4. Remaining teams are grouped by region.
5. Tier 3 fills up to its regional targets, normally 18 per region.
6. Tier 4 contains all remaining teams by region.
7. Manual overrides are allowed only when explicitly documented in output.
8. Every team must appear exactly once.

## Implementation Sequence

### Slice 1 — Static data foundation and complete model output

Do this before building the browser explorer.

1. Inspect `scripts/generate-static-data.ts`, `scripts/build-pages.ts`, existing web data consumers, and existing graph visualizer scripts.
2. Add configurable season generation via CLI flag and/or environment variable, for example:

```bash
STATIC_SEASONS=2021,2022,2023,2024,2025 npm run generate:static
```

3. Generate per-season files:

```text
games-YYYY.json
essential-matchups-YYYY.json
conference-connectivity-YYYY.json
```

4. Generate default aliases for browser compatibility:

```text
games-default.json
essential-matchups-default.json
conference-connectivity-default.json
```

5. Add `web/data/pro-rel` and its required JSON files.
6. Add data validation for team ids, required component scores, score ranges, source provenance, and metadata.
7. Implement scoring and tier assignment as pure functions.
8. Generate one complete model-output file per preset.

### Slice 2 — Table-first browser explorer

Only after complete model output exists:

1. Add `web/pro-rel-explorer.html`.
2. Add `web/pro-rel-explorer.js`.
3. Add `web/pro-rel-explorer.css`.
4. Load generated model output and scenario presets.
5. Render top 50 table.
6. Render full tier table.
7. Add scenario selector.
8. Add adjustable sliders.
9. Show raw custom-weight total.
10. Normalize custom weights during scoring only.
11. Add team explanation panel.
12. Add shareable URL state.
13. Add friendly JSON load/parse error handling.

### Slice 3 — Graph integration and multi-year controls

After the table explorer is stable:

1. Add pro/rel overlay to existing graph visualizer.
2. Join by exact `teamId`, not fuzzy team names.
3. Color nodes by projected tier.
4. Optionally size nodes by total score.
5. Filter by tier.
6. Add season and multi-season window controls.
7. Aggregate multi-year edges with `gameCount`, `averageLeverage`, `firstSeason`, and `mostRecentSeason`.

### Slice 4 — Documentation, tests, and deployment hardening

1. Add `docs/PRO_REL_MODEL.md`.
2. Document Google Sheet/CSV update workflow.
3. Document subjective/proxy inputs and provenance rules.
4. Add regression tests for scoring and tier assignment.
5. Add contract validation tests for generated JSON.
6. Validate that all generated JSON files are copied into `dist` by `build-pages`.
7. Verify existing graph pages still load.
8. Verify the public explorer does not require a GraphQL server.

## Acceptance Criteria for the Milestone

The milestone is complete when:

1. The app can generate static data for multiple seasons.
2. Static generation preserves current GitHub Pages behavior.
3. The app has a validated static pro/rel data directory.
4. All browser-facing component scores are complete numbers from 0 to 100.
5. Metadata includes `sourceSeasons`, `generatedAt`, `modelVersion`, and `dataWarnings`.
6. The app can generate one complete model-output file for each preset.
7. The browser UI can display the top 50 teams and full tier assignments.
8. Users can switch scenarios without a backend call.
9. Users can adjust weights and see recalculated results.
10. The UI shows raw custom-weight totals and normalizes only during scoring.
11. Selected scenario/weights can be encoded in a shareable URL.
12. Invalid URL weights fall back predictably.
13. The UI shows a friendly error if required pro/rel JSON fails to load.
14. Graph overlays use exact team ids.
15. The GitHub Pages build includes all required pro/rel JSON files.
16. Tests cover scoring, tier assignment, validation, and URL parsing.
17. Documentation explains how to update source data and regenerate the static model.

## Non-Goals for This Milestone

- User accounts
- Server-side persistence
- Live Google Sheets API integration in the browser
- Real-time CFBD API calls from the public site
- Perfect final model inputs for roster/NIL or brand/media
- Full automated head-to-head graph-strength sophistication on day one
- Replacing existing graph visualizer behavior before the table explorer works

## Guidance to the Coding Agent

Do not overbuild. Complete the static model-output path first, then build the table-first UI. Keep calculations deterministic and visible. Favor one successful end-to-end vertical slice over a large partially finished architecture.

Preserve the existing GitHub Pages deployment model. Do not introduce a runtime server requirement for the public feature.

Be especially careful about sequencing: the table explorer should not depend on an output artifact that has not yet been generated. The correct order is data contract → validated inputs → scoring → tier assignment → full model output → explorer.
