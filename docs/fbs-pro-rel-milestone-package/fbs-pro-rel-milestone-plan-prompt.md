# Plan Prompt: Milestone — Static Pro/Rel Scenario Explorer for FBS Graph

## Context

We are extending the `fbs-graph` application with a new milestone focused on a promotion/relegation model for FBS college football.

The existing repository already supports a static GitHub Pages deployment. The current static pipeline generates JSON files under `web/data`, and `build-pages` copies the web assets into `dist`. The new milestone should build on that approach rather than introducing a server-side runtime dependency.

The user’s expectation is that we modify and extend the scripts currently used to pull and generate static data so that:

1. Static data can support multiple seasons, not only the current season.
2. The graph visualizations can use multi-year data.
3. A new pro/rel scoring model can be generated from static inputs.
4. The public GitHub Pages app can host an interactive scenario explorer without a backend.

## Milestone Name

**Milestone: Pro/Rel Static Scenario Explorer**

## Product Goal

Create a static, GitHub Pages-compatible feature that lets users explore a proposed multi-tier FBS promotion/relegation league structure using adjustable weighting assumptions.

The feature should support:

- All current FBS / FBS-transition teams in the dataset.
- Multi-year results inputs, initially focused on the last five completed seasons.
- Static JSON outputs for GitHub Pages.
- Scenario presets such as Balanced Launch, Pure Merit, Power Structure, Media Reality, and Open Pyramid.
- Dynamic browser-side recalculation of scores and tier assignments.
- Integration with existing FBS Graph visualizations where practical.

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
Tier 3: regional leagues
Tier 4: regional/development leagues
```

The model is intentionally configurable. The default is not “the truth”; it is the launch scenario.

## Design Principles

1. **Static-first**: the public app must run on GitHub Pages with static JSON/CSV assets.
2. **No exposed API secrets**: CFBD API access remains build-time/local/CI only.
3. **Transparent model**: every team’s score should be explainable by component.
4. **Scenario-driven**: readers should be able to compare assumptions rather than accept one ranking as final.
5. **Multi-year support**: graph and scoring features should not be locked to `new Date().getFullYear()`.
6. **Separation of concerns**: raw data, derived data, scenario weights, tier rules, and UI rendering should remain separate.
7. **Testable calculations**: scoring and tier assignment should be implemented in small, deterministic functions with unit tests.
8. **Readable code**: prefer explicit, self-documenting names over abbreviations.

## Proposed Data Contract

Add or generate these static files under a pro/rel data directory such as:

```text
web/data/pro-rel/
  teams-fbs.json
  seasons.json
  ap-results-2021-2025.json
  schedule-strength.json
  head-to-head-graph-strength.json
  program-factors.json
  scenario-presets.json
  tier-rules.json
  model-output-balanced.json
  metadata.json
```

The exact file names may change during implementation, but the domain boundaries should remain:

| File | Purpose |
|---|---|
| `teams-fbs.json` | Team metadata and stable team ids. |
| `seasons.json` | Supported seasons and default analysis window. |
| `ap-results-2021-2025.json` | Poll/ranking-derived multi-year results data. |
| `schedule-strength.json` | Schedule survival / conference pressure proxy. |
| `head-to-head-graph-strength.json` | Derived H2H / common opponent / graph strength scores. |
| `program-factors.json` | Roster/NIL and brand/media proxy inputs. |
| `scenario-presets.json` | Named weight presets. |
| `tier-rules.json` | Tier sizes, regionalization rules, and manual override hooks. |
| `model-output-*.json` | Precomputed scenario outputs, if we choose to generate them. |
| `metadata.json` | Generated timestamp, seasons included, model version. |

## Suggested Implementation Sequence

### Step 1 — Inspect and stabilize current static generation

Review:

- `scripts/generate-static-data.ts`
- `scripts/build-pages.ts`
- `scripts/setup.ps1`
- existing `web/data` consumers
- existing graph visualizer scripts

Identify all places where current-season assumptions are hardcoded, especially `const seasons = [currentYear]`.

### Step 2 — Add configurable season ranges

Add support for generating static files for multiple seasons.

Preferred behavior:

```bash
npm run generate:static -- --seasons=2021,2022,2023,2024,2025,2026
```

or via environment variable:

```bash
STATIC_SEASONS=2021,2022,2023,2024,2025,2026 npm run generate:static
```

Acceptance expectation:

- Existing one-season behavior still works.
- Multi-season generation produces `games-YYYY.json`, `essential-matchups-YYYY.json`, and `conference-connectivity-YYYY.json` for each requested season.
- Metadata lists every generated season.

### Step 3 — Create pro/rel domain model

Add TypeScript types for:

- `ProRelTeamInput`
- `ProRelComponentScores`
- `ProRelScenarioWeights`
- `ProRelScenarioPreset`
- `ProRelTierRule`
- `ProRelTierAssignment`
- `ProRelModelOutput`

Keep these separate from GraphQL server-only concerns.

### Step 4 — Generate static pro/rel input files

Create one or more scripts to transform existing CSV/JSON sources into pro/rel inputs.

Possible script names:

```text
scripts/generate-pro-rel-data.ts
scripts/compute-pro-rel-scores.ts
scripts/generate-pro-rel-static-data.ts
```

The scripts should produce static files under `web/data/pro-rel`.

### Step 5 — Implement scoring engine

Create deterministic scoring functions.

Possible location:

```text
src/lib/proRelScoring.ts
```

or a browser-safe module under:

```text
web/pro-rel/pro-rel-scoring.js
```

Preferred approach: implement pure TypeScript in `src/lib`, compile/build/test it, and use the generated output in the web layer.

Core functions:

- `calculateTotalScore(componentScores, weights)`
- `normalizeScenarioWeights(weights)`
- `rankTeamsByScenario(teamInputs, scenario)`
- `assignTiers(rankedTeams, tierRules)`
- `buildTeamExplanation(team, scenario, tierAssignment)`

### Step 6 — Add scenario presets

Initial presets:

| Scenario | Results | Schedule | H2H/Graph | Roster/NIL | Brand/Media |
|---|---:|---:|---:|---:|---:|
| Balanced Launch | 35 | 25 | 20 | 10 | 10 |
| Pure Merit | 55 | 10 | 25 | 5 | 5 |
| Power Structure | 25 | 35 | 15 | 15 | 10 |
| Media Reality | 25 | 20 | 15 | 15 | 25 |
| Open Pyramid | 45 | 10 | 30 | 10 | 5 |

The UI should allow users to start from a preset and then adjust sliders.

### Step 7 — Build the Pro/Rel Explorer page

Add a static page such as:

```text
web/pro-rel-explorer.html
web/pro-rel-explorer.js
web/pro-rel-explorer.css
```

Minimum viable page:

- Scenario dropdown
- Five weight sliders
- Top 50 table
- Full tier table
- Team explanation panel
- Button/link to reset to selected preset
- Shareable URL using query string or hash parameters

### Step 8 — Integrate with existing graph visualization

Add optional graph overlays:

- Node color by projected tier
- Node size by total score
- Border/shape by conference or region
- Filter by tier
- Scenario selector that updates the graph
- Multi-year graph controls using the new multi-season static files

This can be done after the table-based explorer works.

### Step 9 — Test and document

Add tests for:

- Weight normalization
- Score calculation
- Rank ordering
- Tier assignment
- Scenario presets
- Multi-season static generation behavior
- Metadata output

Update README/docs:

- How to generate pro/rel data
- How to run the explorer locally
- How GitHub Pages deployment uses the generated static files
- How to update model inputs from CSV/Google Sheets exports

## First Vertical Slice

Build this first:

1. Add configurable season list to static generation.
2. Add pro/rel static data directory.
3. Add scenario presets and tier rules JSON.
4. Add a small static sample input file for 10–20 teams.
5. Implement scoring and tier assignment in testable pure functions.
6. Build a basic table-only Pro/Rel Explorer page.
7. Confirm it runs through `npm run build:pages` and on the static web server.

After that, expand to all FBS teams and graph integration.

## Acceptance Criteria for the Milestone

The milestone is complete when:

1. The app can generate static data for multiple seasons.
2. The app has a static pro/rel data directory with scenario presets and tier rules.
3. The app can calculate pro/rel scores from component inputs and adjustable weights.
4. The browser UI can display at least the top 50 teams and full tier assignments.
5. Users can switch scenarios without a backend call.
6. Users can adjust weights and immediately see recalculated results.
7. The selected scenario/weights can be encoded in a shareable URL.
8. The GitHub Pages build still works without requiring a GraphQL server.
9. Tests cover the scoring and tier assignment logic.
10. Documentation explains how to update the source data and regenerate the static model.

## Non-Goals for This Milestone

- User accounts
- Server-side persistence
- Live Google Sheets API integration in the browser
- Real-time CFBD API calls from the public site
- Perfect final model inputs for roster/NIL or brand/media
- Full automated head-to-head graph-strength sophistication on day one

## Guidance to the Coding Agent

Do not overbuild. Start with the smallest usable static-data path and table UI. Keep the calculations deterministic and visible. Favor one successful end-to-end vertical slice over a large partially finished architecture.

Preserve the existing GitHub Pages deployment model. Do not introduce a runtime server requirement for the public feature.

