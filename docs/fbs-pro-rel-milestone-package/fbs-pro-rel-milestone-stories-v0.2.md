# Stories: Milestone — Pro/Rel Static Scenario Explorer v0.2

## Milestone Summary

Build a static, GitHub Pages-compatible promotion/relegation scenario explorer for the FBS Graph application.

This milestone extends the existing static data generation pipeline so the app can support:

1. Multi-season graph data, initially a 2021–2025 analysis window.
2. A transparent pro/rel scoring model for all FBS / FBS-transition teams.
3. Scenario presets and user-adjustable weights.
4. Table-first exploration before graph overlays.
5. GitHub Pages deployment without a runtime GraphQL server.

Default scoring model:

```text
Total Score =
  FiveYearResultsScore * 0.35
+ ScheduleSurvivalScore * 0.25
+ HeadToHeadGraphScore * 0.20
+ RosterNilScore * 0.10
+ BrandMediaScore * 0.10
```

Default launch structure:

```text
Tier 1: 20 national teams
Tier 2: 24 national teams
Tier 3: 72 regional teams, target 18 per region
Tier 4: all remaining teams, regional/development leagues
```

## Design Principles

- Static-first: public GitHub Pages deployment must work without a runtime backend.
- Explicit contract: generated JSON must have stable ids, versioning, score ranges, and provenance fields.
- Transparent scoring: every component score is normalized to a 0–100 scale before use.
- No hidden null behavior: missing source data becomes a warning and an explicit fallback score before browser output is written.
- Table before graph: prove the model in a simple explorer before layering onto the existing graph visualizer.
- Stable team ids: pro/rel team ids must match the existing graph visualizer team ids exactly; no fuzzy matching in the UI.
- Shareable assumptions: custom weights can temporarily total something other than 100, but scoring normalizes them at calculation time.

---

# Vertical Slices

## Slice 1 — Static data foundation and complete model output

Goal: produce validated pro/rel output for all teams before building the browser explorer.

Stories:

1. PR-001 — Support configurable multi-season static data generation
2. PR-002 — Define the static pro/rel data contract
3. PR-003 — Validate and document model inputs
4. PR-004 — Add scenario presets for competing value systems
5. PR-005 — Implement deterministic pro/rel scoring functions
6. PR-006 — Assign teams to tiers using configurable tier rules
7. PR-007 — Generate pro/rel model output for all teams

## Slice 2 — Table-first browser explorer

Goal: load the generated model output in the browser and make assumptions visible.

Stories:

8. PR-008 — Create a table-first Pro/Rel Explorer page
9. PR-009 — Add adjustable weight sliders with predictable normalization
10. PR-010 — Add team explanation panel
11. PR-011 — Add shareable scenario URLs
12. PR-012 — Add browser load and fallback handling

## Slice 3 — Graph integration and multi-year graph controls

Goal: reuse the generated model output as an overlay on existing graph views.

Stories:

13. PR-013 — Add graph overlay for projected tiers
14. PR-014 — Add multi-year graph controls

## Slice 4 — Documentation, tests, and deployment hardening

Goal: make the milestone maintainable and safe to deploy.

Stories:

15. PR-015 — Document the pro/rel data update workflow
16. PR-016 — Add regression tests for scoring and tier assignment
17. PR-017 — Add build/deployment validation for the static explorer

---

# Data Contract v0.2

All browser-facing pro/rel files live under:

```text
web/data/pro-rel/
```

## Required generated files

```text
web/data/pro-rel/
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

Optional files may be added later:

```text
web/data/pro-rel/
  source-ap-results.json
  source-schedule-strength.json
  source-head-to-head-graph-strength.json
  source-program-factors.json
  data-warnings.json
```

## Score scale and null behavior

All component scores exposed to the browser must be normalized numbers on a 0–100 scale.

Required component keys:

```text
fiveYearResults
scheduleSurvival
headToHeadGraph
rosterNil
brandMedia
```

Rules:

- Component scores are required and non-null in `team-inputs.json` and model output files.
- Raw missing data may exist only in source/intermediate files.
- If a source value is missing, the generation script must either:
  - derive a documented fallback score, or
  - fail when strict validation is enabled.
- Any fallback score must create a warning in `metadata.dataWarnings` or `data-warnings.json`.
- Total scores are also normalized to a 0–100 scale.
- Output totals should be rounded to two decimal places for display, while internal calculations may retain more precision.

## Required metadata shape

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

## Required team input shape

```json
{
  "teamId": "wisconsin",
  "teamName": "Wisconsin",
  "shortName": "Wisconsin",
  "conferenceId": "big-ten",
  "conferenceName": "Big Ten",
  "subdivisionStatus": "FBS",
  "regionKey": "midwest-great-lakes",
  "regionName": "Midwest / Great Lakes",
  "componentScores": {
    "fiveYearResults": 1.27,
    "scheduleSurvival": 95,
    "headToHeadGraph": 33.25,
    "rosterNil": 84,
    "brandMedia": 87
  },
  "componentSources": {
    "fiveYearResults": {
      "sourceType": "computed",
      "sourceName": "final AP poll / ranking input",
      "sourceSeasons": [2021, 2022, 2023, 2024, 2025],
      "confidence": "medium",
      "lastUpdated": "2026-05-22"
    },
    "scheduleSurvival": {
      "sourceType": "proxy",
      "sourceName": "conference schedule pressure proxy",
      "sourceSeasons": [2021, 2022, 2023, 2024, 2025],
      "confidence": "medium",
      "lastUpdated": "2026-05-22"
    },
    "headToHeadGraph": {
      "sourceType": "computed",
      "sourceName": "head-to-head and graph-strength proxy",
      "sourceSeasons": [2021, 2022, 2023, 2024, 2025],
      "confidence": "low",
      "lastUpdated": "2026-05-22"
    },
    "rosterNil": {
      "sourceType": "manual",
      "sourceName": "curated roster/NIL proxy",
      "sourceSeasons": [2025],
      "confidence": "low",
      "lastUpdated": "2026-05-22"
    },
    "brandMedia": {
      "sourceType": "manual",
      "sourceName": "curated brand/media proxy",
      "sourceSeasons": [2025],
      "confidence": "low",
      "lastUpdated": "2026-05-22"
    }
  }
}
```

Note: the concrete values above are examples. Acceptance tests should use fixtures, not real-team assumptions.

## Required scenario preset shape

```json
{
  "scenarioId": "balanced-launch",
  "scenarioName": "Balanced Launch",
  "description": "Balances recent results, schedule pressure, graph strength, roster sustainability, and media reality.",
  "weights": {
    "fiveYearResults": 35,
    "scheduleSurvival": 25,
    "headToHeadGraph": 20,
    "rosterNil": 10,
    "brandMedia": 10
  }
}
```

Preset weights must sum to 100. Custom user weights may temporarily sum to another value in the UI.

## Required model output shape

```json
{
  "modelVersion": "0.1.0",
  "scenarioId": "balanced-launch",
  "generatedAt": "2026-05-22T00:00:00.000Z",
  "sourceSeasons": [2021, 2022, 2023, 2024, 2025],
  "teams": [
    {
      "rank": 1,
      "teamId": "georgia",
      "teamName": "Georgia",
      "conferenceId": "sec",
      "conferenceName": "SEC",
      "regionKey": "south-southeast",
      "componentScores": {
        "fiveYearResults": 90.25,
        "scheduleSurvival": 95,
        "headToHeadGraph": 86.68,
        "rosterNil": 100,
        "brandMedia": 98
      },
      "weightsUsed": {
        "fiveYearResults": 35,
        "scheduleSurvival": 25,
        "headToHeadGraph": 20,
        "rosterNil": 10,
        "brandMedia": 10
      },
      "normalizedWeightsUsed": {
        "fiveYearResults": 0.35,
        "scheduleSurvival": 0.25,
        "headToHeadGraph": 0.2,
        "rosterNil": 0.1,
        "brandMedia": 0.1
      },
      "totalScore": 92.47,
      "tier": 1,
      "tierName": "National Premier League",
      "regionName": null,
      "assignmentReason": "rank-cutoff",
      "manualOverride": null
    }
  ]
}
```

---

# Stories

## Story PR-001 — Support configurable multi-season static data generation

### User Story

As a site maintainer, I want the static data generation scripts to support multiple seasons, so that the graph and pro/rel model can use a five-year history rather than only the current year.

### Context

The existing static generation flow already produces season-specific files. This story makes the season list configurable and prevents regressions for current GitHub Pages consumers.

### Acceptance Criteria

```gherkin
Scenario: Generate static files for one season by default
  Given no explicit season range is provided
  When I run the static data generation script
  Then the script generates static files for the configured default season
  And existing GitHub Pages pages continue to load their expected data files
```

```gherkin
Scenario: Generate static files for an explicit multi-season range
  Given I provide a season list such as 2021,2022,2023,2024,2025
  When I run the static data generation script
  Then the script generates games-2021.json through games-2025.json
  And the script generates essential-matchups-2021.json through essential-matchups-2025.json
  And the script generates conference-connectivity-2021.json through conference-connectivity-2025.json
  And metadata lists all generated seasons
```

```gherkin
Scenario: Default-season aliases are emitted for browser compatibility
  Given a default season is configured
  When static data generation completes
  Then games-default.json points to the default season's game payload
  And essential-matchups-default.json points to the default season's essential matchup payload
  And conference-connectivity-default.json points to the default season's conference connectivity payload
```

```gherkin
Scenario: Missing data is handled clearly
  Given one requested season has no available game data
  When the script runs without strict missing-data mode
  Then the script logs a warning for that season
  And continues generating available seasons
  And metadata.dataWarnings includes the missing season warning
```

```gherkin
Scenario: Missing data can fail CI when required
  Given strict missing-data mode is enabled
  And one requested season has no available game data
  When the script runs
  Then the script fails with a clear error message
```

### Implementation Notes

- Add a season-list parser using CLI arguments and/or an environment variable such as `STATIC_SEASONS`.
- Keep the default behavior compatible with the existing Pages deployment.
- Do not remove existing season-specific output filenames.
- Add `sourceSeasons`, `generatedSeasons`, `defaultSeason`, and `dataWarnings` to metadata.

### Test Notes

- Unit-test the season parser.
- Test generation metadata for single-season and multi-season runs.
- Verify default aliases are generated and valid JSON.

---

## Story PR-002 — Define the static pro/rel data contract

### User Story

As a developer, I want a precise static data contract for the pro/rel model, so that generated data, browser UI, and tests all use the same shape.

### Acceptance Criteria

```gherkin
Scenario: Required pro/rel files exist
  Given the pro/rel generation process has completed
  When I inspect web/data/pro-rel
  Then I see metadata.json, team-inputs.json, scenario-presets.json, tier-rules.json, and at least one model-output file
```

```gherkin
Scenario: Team ids match existing graph ids
  Given a team exists in team-inputs.json
  When I look up the same team in the existing graph team data
  Then the teamId values match exactly
  And no browser-side fuzzy matching is required
```

```gherkin
Scenario: Component scores are normalized and complete
  Given a team exists in team-inputs.json
  When the data contract validator checks the team
  Then all five required component score keys are present
  And each score is a number between 0 and 100 inclusive
  And none of the browser-facing component scores are null
```

```gherkin
Scenario: Metadata includes versioning and warnings
  Given metadata.json is generated
  When I inspect the file
  Then it includes modelVersion, generatedAt, sourceSeasons, generatedSeasons, defaultScenarioId, teamCount, and dataWarnings
```

```gherkin
Scenario: Manual/proxy inputs include provenance
  Given a team has rosterNil or brandMedia scores
  When I inspect componentSources
  Then each manual or proxy score has sourceType, sourceName, confidence, sourceSeasons, and lastUpdated
```

### Implementation Notes

- Use TypeScript interfaces plus Zod or equivalent validation.
- Keep raw source values separate from normalized browser-facing scores.
- Treat `teamId` as the join key for graph overlays.
- Do not allow the browser UI to guess missing ids or scores.

### Test Notes

- Validate sample and generated JSON against the schema.
- Add tests for missing required fields and out-of-range scores.

---

## Story PR-003 — Validate and document model inputs

### User Story

As the model owner, I want model inputs validated and documented, so that subjective inputs such as roster/NIL and brand/media can be defended publicly.

### Acceptance Criteria

```gherkin
Scenario: Manual input provenance is required
  Given program-factors or equivalent manual input data exists
  When the validation script runs
  Then every manual score includes source type, source name, confidence, last updated date, and notes or rationale
```

```gherkin
Scenario: Missing manual input is surfaced
  Given a team lacks a rosterNil or brandMedia value
  When validation runs in warning mode
  Then the script applies the configured fallback
  And records a warning naming the teamId and missing field
```

```gherkin
Scenario: Strict validation can fail CI
  Given strict validation mode is enabled
  And a required manual/proxy field is missing
  When validation runs
  Then the script fails with a clear error message
```

```gherkin
Scenario: Input documentation explains update rules
  Given I open the pro/rel model documentation
  When I read the input provenance section
  Then I understand which fields are computed, which are manual/proxy, and how they should be updated
```

### Implementation Notes

- Add a validation script such as `scripts/validate-pro-rel-data.ts`.
- Keep soft inputs visibly separate from computed inputs.
- Prefer explicit confidence levels: `high`, `medium`, `low`.

### Test Notes

- Use fixtures with missing and invalid manual input fields.
- Test both warning mode and strict mode.

---

## Story PR-004 — Add scenario presets for competing value systems

### User Story

As a reader, I want to compare multiple weighting scenarios, so that I can see how different assumptions change the tier structure.

### Acceptance Criteria

```gherkin
Scenario: Balanced Launch preset is available
  Given scenario presets are loaded
  When I inspect Balanced Launch
  Then the weights are fiveYearResults 35, scheduleSurvival 25, headToHeadGraph 20, rosterNil 10, and brandMedia 10
```

```gherkin
Scenario: Multiple named presets are available
  Given the pro/rel explorer loads
  When I open the scenario selector
  Then I can select Balanced Launch, Pure Merit, Power Structure, Media Reality, and Open Pyramid
```

```gherkin
Scenario: Preset weights always sum to 100
  Given scenario presets are loaded
  When the system validates the presets
  Then every preset has all five required weight keys
  And every preset has a total weight of 100
```

### Initial Presets

| Scenario | fiveYearResults | scheduleSurvival | headToHeadGraph | rosterNil | brandMedia |
|---|---:|---:|---:|---:|---:|
| Balanced Launch | 35 | 25 | 20 | 10 | 10 |
| Pure Merit | 55 | 10 | 25 | 5 | 5 |
| Power Structure | 25 | 35 | 15 | 15 | 10 |
| Media Reality | 25 | 20 | 15 | 15 | 25 |
| Open Pyramid | 45 | 10 | 30 | 10 | 5 |

### Implementation Notes

- Store presets in `scenario-presets.json`.
- The UI may have a minimal fallback, but generated data should be the normal source of truth.

### Test Notes

- Test that every scenario contains all five required weight categories.
- Test that preset weights sum to 100.

---

## Story PR-005 — Implement deterministic pro/rel scoring functions

### User Story

As a developer, I want deterministic scoring functions, so that ranking and tier assignment can be tested and explained.

### Acceptance Criteria

```gherkin
Scenario: Calculate a team total score
  Given a team has component scores on a 0-100 scale
  And a scenario has weights
  When the scoring function runs
  Then the output total score equals the weighted sum of the component scores using normalized weights
```

```gherkin
Scenario: Normalize preset weights expressed as percentages
  Given scenario weights are 35, 25, 20, 10, and 10
  When the scoring function calculates totals
  Then the weights are treated as 0.35, 0.25, 0.20, 0.10, and 0.10
```

```gherkin
Scenario: Normalize custom weights that do not sum to 100
  Given custom weights are 40, 40, 20, 10, and 10
  When the scoring function calculates totals
  Then the weights are normalized by their actual sum
  And the UI can still display the unnormalized total of 120
```

```gherkin
Scenario: Reject all-zero custom weights
  Given custom weights total 0
  When the scoring function validates the weights
  Then it rejects the custom weights
  And falls back to the selected preset or default scenario
```

```gherkin
Scenario: Stable tie-breaker is used
  Given two teams have the same calculated total score
  When the ranking function sorts them
  Then higher fiveYearResults breaks the tie
  And higher scheduleSurvival is the next tie-breaker
  And alphabetical teamName is the final tie-breaker
```

### Implementation Notes

Suggested functions:

```text
calculateTotalScore(componentScores, weights)
normalizeScenarioWeights(weights)
rankTeamsByScenario(teamInputs, scenario)
```

### Test Notes

- Use simple fixtures with obvious expected results.
- Test custom weights that sum below, equal to, and above 100.

---

## Story PR-006 — Assign teams to tiers using configurable tier rules

### User Story

As a model author, I want tier sizes and regionalization rules to be configurable, so that the launch structure can evolve without rewriting UI code.

### Acceptance Criteria

```gherkin
Scenario: Assign top teams to Tier 1 and Tier 2
  Given ranked teams and tier rules with Tier 1 size 20 and Tier 2 size 24
  When tier assignment runs
  Then the top 20 teams are assigned to Tier 1
  And the next 24 teams are assigned to Tier 2
```

```gherkin
Scenario: Assign Tier 3 by regional target sizes
  Given ranked teams remain after Tier 1 and Tier 2 assignment
  And tier rules define Tier 3 target size 72 with four region targets of 18
  When regional assignment runs
  Then the top remaining teams within each region are assigned to Tier 3 until that region target is filled
  And all other remaining teams are assigned to Tier 4 in their region
```

```gherkin
Scenario: Region shortages are handled predictably
  Given a region has fewer remaining teams than its Tier 3 target
  When Tier 3 assignment runs
  Then the unused Tier 3 slots are allocated to the highest-scoring remaining teams across other regions
  And metadata records that regional balancing required overflow allocation
```

```gherkin
Scenario: Manual override hooks are supported
  Given tier rules contain a manual override for a team
  When tier assignment runs
  Then the override is applied
  And the output includes assignmentReason manual-override
  And the override reason is included in the team output
```

```gherkin
Scenario: Every team receives exactly one assignment
  Given all eligible teams are ranked
  When tier assignment completes
  Then every eligible team appears exactly once in the assignment output
```

### Required default tier rules

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

### Implementation Notes

- Store rules in `tier-rules.json`.
- Tier 4 absorbs extra teams if the FBS universe expands.
- Keep manual overrides rare and always documented.

### Test Notes

- Test Tier 1 and Tier 2 cutoffs.
- Test regional Tier 3 target filling.
- Test manual override behavior.
- Test all-teams-exactly-once invariant.

---

## Story PR-007 — Generate pro/rel model output for all teams

### User Story

As a model author, I want the static pipeline to produce complete pro/rel output before the UI is built, so that the explorer can load one stable artifact per scenario.

### Acceptance Criteria

```gherkin
Scenario: All eligible teams are included
  Given the pro/rel generation script runs
  When the model output is generated
  Then every eligible FBS/FBS-transition team appears exactly once
  And the teamCount in metadata matches the number of output teams
```

```gherkin
Scenario: Output includes component and total scores
  Given a generated model output file exists
  When I inspect a team record
  Then it includes component scores, weights used, normalized weights used, total score, rank, projected tier, and assignment reason
```

```gherkin
Scenario: One output file is generated per preset
  Given five scenario presets exist
  When pro/rel static output generation runs
  Then one model-output file is generated for each preset
```

```gherkin
Scenario: Output metadata is clear
  Given model output is generated
  When I inspect the output
  Then I can see modelVersion, generatedAt, sourceSeasons, and scenarioId
```

```gherkin
Scenario: Generated JSON is copied into Pages distribution
  Given the Pages build runs after model output generation
  When I inspect dist/data/pro-rel
  Then all generated pro/rel JSON files are present
```

### Implementation Notes

- This story must be completed before the table-first explorer depends on generated model output.
- Start with manually curated `program-factors.json` if necessary.
- Keep soft inputs separate from hard computed results.

### Test Notes

- Test for duplicate team ids.
- Test for missing component scores.
- Test that all output rows have a projected tier.
- Test that model output can be JSON-parsed from `web/data/pro-rel`.

---

## Story PR-008 — Create a table-first Pro/Rel Explorer page

### User Story

As a reader, I want a browser page where I can choose a scenario and view team rankings, so that I can understand the model before using the graph view.

### Acceptance Criteria

```gherkin
Scenario: Load the Pro/Rel Explorer page
  Given the site has been built for GitHub Pages
  When I open the pro/rel explorer page
  Then the page loads without a backend server
  And the page loads static pro/rel JSON files
```

```gherkin
Scenario: View the top 50 ranking table
  Given the model output has loaded
  When the default scenario is selected
  Then I see a top 50 table
  And each row shows rank, team, conference, total score, component scores, and projected tier
```

```gherkin
Scenario: View full tier assignments
  Given the model output has loaded
  When I scroll to the tier section
  Then I see all teams grouped by tier and region
```

```gherkin
Scenario: Change scenario preset
  Given the Balanced Launch scenario is selected
  When I select Pure Merit
  Then the rankings and tier assignments update in the browser
  And no backend request is required
```

### Implementation Notes

Suggested files:

```text
web/pro-rel-explorer.html
web/pro-rel-explorer.js
web/pro-rel-explorer.css
```

Start with tables before graph integration.

### Test Notes

- Add DOM-level tests if the current test setup supports jsdom.
- Test browser-safe data loading and scenario switching as pure functions where possible.

---

## Story PR-009 — Add adjustable weight sliders with predictable normalization

### User Story

As a reader, I want to adjust model weights myself, so that I can test whether the tier structure reflects my view of fairness.

### Acceptance Criteria

```gherkin
Scenario: Adjust one weight
  Given a scenario is loaded
  When I increase the schedule survival weight
  Then the displayed raw weight total updates
  And rankings recalculate using normalized weights
```

```gherkin
Scenario: Raw slider totals may differ from 100
  Given I adjust sliders so the raw total is 120
  When the rankings recalculate
  Then the UI visibly shows Total weight: 120
  And scoring uses each weight divided by 120
```

```gherkin
Scenario: All-zero slider state is rejected
  Given all slider values are set to 0
  When recalculation is requested
  Then the UI shows a friendly validation message
  And the model falls back to the selected preset weights
```

```gherkin
Scenario: Reset to preset
  Given I have modified the weights manually
  When I click reset for the selected preset
  Then the weights return to the preset values
  And the rankings recalculate
```

### Implementation Notes

- Chosen behavior: allow temporary non-100 totals, show the raw total, normalize only during scoring.
- This makes custom scenarios easier to share and easier to reason about.

### Test Notes

- Test recalculation after weight changes.
- Test raw-total display.
- Test all-zero fallback.
- Test reset behavior.

---

## Story PR-010 — Add team explanation panel

### User Story

As a reader, I want to understand why a selected team is assigned to a particular tier, so that the model feels transparent rather than arbitrary.

### Acceptance Criteria

```gherkin
Scenario: Select a team from the ranking table
  Given a selected team exists in the ranking table
  When I select that team
  Then I see the selected team's component scores
  And I see a short rule-based explanation of the tier assignment
```

```gherkin
Scenario: Explanation updates with scenario
  Given a team explanation is visible
  When I change the selected scenario
  Then the explanation updates to reflect the new score and tier
```

```gherkin
Scenario: Manual override is explained
  Given a selected team has a manual tier override
  When I view that team's explanation
  Then the explanation includes the override reason
```

```gherkin
Scenario: Missing explanation data falls back gracefully
  Given a selected team is missing optional explanation metadata
  When I view the explanation panel
  Then the panel still shows the component score breakdown
  And it displays a friendly note that detailed rationale is unavailable
```

### Implementation Notes

- Keep explanation generation rule-based at first.
- Avoid AI-generated text in the browser.
- Acceptance criteria must not depend on a real team's exact model state.

### Test Notes

- Test explanation output using fixtures for strong, weak, and override cases.

---

## Story PR-011 — Add shareable scenario URLs

### User Story

As a reader or blogger, I want to share a scenario URL, so that others can see the same weight settings and ranking view.

### Acceptance Criteria

```gherkin
Scenario: Scenario is encoded in URL
  Given I select a scenario preset
  When the URL updates
  Then the selected scenario is represented in the query string or hash
```

```gherkin
Scenario: Custom weights are encoded in URL
  Given I modify the weights manually
  When the URL updates
  Then the custom raw weights are represented in the query string or hash
```

```gherkin
Scenario: Shared URL restores state
  Given I open a URL with valid scenario and weight parameters
  When the page loads
  Then the UI restores those settings
  And the ranking table reflects them
```

```gherkin
Scenario: Invalid URL weights fall back predictably
  Given I open a URL with missing, non-numeric, negative, or all-zero weights
  When the page loads
  Then the URL parser rejects the invalid weights
  And the UI falls back to the default scenario
  And a non-blocking warning is shown
```

### Implementation Notes

Example URL shape:

```text
/pro-rel-explorer.html#scenario=balanced-launch&fiveYearResults=35&scheduleSurvival=25&headToHeadGraph=20&rosterNil=10&brandMedia=10
```

### Test Notes

- Test URL serialization and parsing as pure functions.
- Test invalid/missing weight behavior.

---

## Story PR-012 — Add browser load and fallback handling

### User Story

As a reader, I want the explorer to fail gracefully if static data is missing or malformed, so that a broken data file does not produce a blank page.

### Acceptance Criteria

```gherkin
Scenario: Required JSON fails to load
  Given the pro/rel explorer page is opened
  And a required pro/rel JSON file cannot be loaded
  When the page handles the failed request
  Then the UI shows a friendly error message
  And the browser console includes the missing file path
```

```gherkin
Scenario: Required JSON is malformed
  Given a required pro/rel JSON file contains invalid JSON
  When the page attempts to parse it
  Then the UI shows a friendly error message
  And no partial or misleading ranking table is displayed
```

```gherkin
Scenario: Optional warning data is missing
  Given optional data-warnings.json is missing
  When the page loads
  Then the page still renders model output
  And no blocking error is shown
```

### Implementation Notes

- Keep user-facing errors concise.
- Log technical details to console for debugging.
- Do not silently render stale fallback data without labeling it.

### Test Notes

- Test fetch error handling with mocks.
- Test malformed JSON behavior.

---

## Story PR-013 — Add graph overlay for projected tiers

### User Story

As a user of FBS Graph, I want to visualize projected tiers on the existing graph, so that I can see how promotion/relegation structure maps onto the schedule network.

### Acceptance Criteria

```gherkin
Scenario: Graph nodes are colored by projected tier
  Given the graph visualizer has loaded
  And pro/rel model data is available
  When I enable the pro/rel overlay
  Then team nodes are colored by projected tier
```

```gherkin
Scenario: Graph overlay uses exact team ids
  Given pro/rel model data is loaded
  When the overlay maps tier data to graph nodes
  Then it joins using exact teamId values
  And it does not use fuzzy team-name matching
```

```gherkin
Scenario: Node size can reflect total score
  Given the pro/rel overlay is enabled
  When I choose score-based sizing
  Then higher-scoring teams render larger than lower-scoring teams
```

```gherkin
Scenario: Tier filter hides unrelated teams
  Given the pro/rel overlay is enabled
  When I select Tier 1 only
  Then only Tier 1 teams and relevant edges are shown
```

### Implementation Notes

- This story follows the table-first explorer.
- Reuse existing graph filtering patterns where possible.
- Avoid destabilizing the current graph layout unless necessary.

### Test Notes

- Test mapping from team id to tier metadata.
- Test filter functions independently from rendering.

---

## Story PR-014 — Add multi-year graph controls

### User Story

As a graph user, I want to select a season or multi-season window, so that I can compare how team connections and leverage evolve over time.

### Acceptance Criteria

```gherkin
Scenario: Select a single season
  Given multi-season static files are available
  When I choose the 2024 season
  Then the graph loads 2024 game data
```

```gherkin
Scenario: Select a multi-season range
  Given multi-season static files are available
  When I choose 2021 through 2025
  Then the graph combines games from those seasons
  And duplicate edges are aggregated clearly
```

```gherkin
Scenario: Metadata drives available seasons
  Given metadata lists supported seasons
  When the graph page loads
  Then the season selector is populated from metadata
```

```gherkin
Scenario: Aggregated edges expose clear summary data
  Given the graph combines multiple seasons
  When duplicate edges are aggregated
  Then the edge exposes gameCount, averageLeverage, firstSeason, and mostRecentSeason
```

### Implementation Notes

- This is closely related to PR-001.
- Start with a season selector before implementing rolling windows.
- Aggregated multi-year edges should expose count, average leverage, and most recent season.

### Test Notes

- Test aggregation of repeated edges across seasons.
- Test missing season behavior.

---

## Story PR-015 — Document the pro/rel data update workflow

### User Story

As the project owner, I want documentation for updating the pro/rel model, so that I can maintain the feature from Google Sheet/CSV exports without relying on memory.

### Acceptance Criteria

```gherkin
Scenario: Documentation explains source data updates
  Given I open the project documentation
  When I read the pro/rel model guide
  Then I understand which CSV/JSON files must be updated
  And I understand how to regenerate static output
```

```gherkin
Scenario: Documentation explains subjective inputs
  Given I open the pro/rel model guide
  When I read the roster/NIL and brand/media sections
  Then I understand that these are manual/proxy inputs
  And I understand how provenance and confidence should be recorded
```

```gherkin
Scenario: Documentation explains scenario presets
  Given I open the pro/rel model guide
  When I read the scenario section
  Then I understand what each preset represents
```

```gherkin
Scenario: Documentation explains GitHub Pages deployment
  Given I open the pro/rel model guide
  When I read the deployment section
  Then I understand why no backend server is required for the public explorer
```

### Suggested Documentation File

```text
docs/PRO_REL_MODEL.md
```

### Implementation Notes

- Include the model formula.
- Include data provenance notes.
- Include known limitations and subjective inputs.

### Test Notes

- Documentation-only story; no automated tests required unless using a docs link checker.

---

## Story PR-016 — Add regression tests for scoring and tier assignment

### User Story

As a maintainer, I want regression tests around the scoring model, so that future changes do not silently alter rankings or tier assignments.

### Acceptance Criteria

```gherkin
Scenario: Known fixture produces expected ranking
  Given a small fixture of teams and scores
  When the Balanced Launch scenario is applied
  Then the ranking order matches the expected fixture output
```

```gherkin
Scenario: Known fixture produces expected tiers
  Given a small fixture and tier rules
  When tier assignment runs
  Then each team receives the expected tier
```

```gherkin
Scenario: Scenario changes alter results predictably
  Given a fixture where one team has high schedule score and another has high results score
  When I switch from Pure Merit to Power Structure
  Then the relative order changes as expected
```

```gherkin
Scenario: Contract validation rejects invalid data
  Given a fixture with missing component scores or mismatched team ids
  When the validator runs
  Then validation fails with clear messages
```

### Implementation Notes

- Use small fixtures, not the full dataset, for unit tests.
- Add one snapshot or golden-output test only after the data contract stabilizes.

### Test Notes

- Run through `npm run test:run`.
- Include tests in CI if current workflow supports it.

---

## Story PR-017 — Add build/deployment validation for the static explorer

### User Story

As the site owner, I want the GitHub Pages build to catch broken static explorer assets, so that the public site does not deploy with missing JSON or broken links.

### Acceptance Criteria

```gherkin
Scenario: Build fails when required pro/rel data files are missing
  Given the pro/rel explorer is included in the web build
  And a required pro/rel data file is missing
  When the build validation runs
  Then the build fails with a clear message
```

```gherkin
Scenario: Build succeeds with complete static data
  Given all required static files exist
  When I run the Pages build
  Then the dist folder includes the explorer page and all required pro/rel data files
```

```gherkin
Scenario: Deployment remains backend-free
  Given the site is deployed to GitHub Pages
  When the pro/rel explorer loads
  Then it does not require the GraphQL server
```

```gherkin
Scenario: Current graph pages still load
  Given the Pages build completes
  When existing graph visualizer pages load
  Then they can still read their expected static data files
```

### Implementation Notes

- Add a lightweight validation script if needed.
- Validate file existence, JSON parseability, and required schema fields.
- Validate that `build-pages` copies generated JSON into `dist`.
- Do not require full model perfection for build success; validate structural readiness.

### Test Notes

- Can be tested with a script run before or during `build:pages`.
- Consider adding the validation step to the Pages workflow after static generation and before upload.

---

# Recommended Story Order

1. PR-001 — Support configurable multi-season static data generation
2. PR-002 — Define the static pro/rel data contract
3. PR-003 — Validate and document model inputs
4. PR-004 — Add scenario presets for competing value systems
5. PR-005 — Implement deterministic pro/rel scoring functions
6. PR-006 — Assign teams to tiers using configurable tier rules
7. PR-007 — Generate pro/rel model output for all teams
8. PR-008 — Create a table-first Pro/Rel Explorer page
9. PR-009 — Add adjustable weight sliders with predictable normalization
10. PR-010 — Add team explanation panel
11. PR-011 — Add shareable scenario URLs
12. PR-012 — Add browser load and fallback handling
13. PR-014 — Add multi-year graph controls
14. PR-013 — Add graph overlay for projected tiers
15. PR-015 — Document the pro/rel data update workflow
16. PR-016 — Add regression tests for scoring and tier assignment
17. PR-017 — Add build/deployment validation for the static explorer

## Suggested first vertical slice

First implementation pass:

```text
PR-001 → PR-002 → PR-003 → PR-004 → PR-005 → PR-006 → PR-007
```

This yields a complete static-data and model-output foundation:

```text
multi-season static data
→ explicit data contract
→ validated inputs/provenance
→ scenario presets
→ scoring
→ tier assignment
→ complete model output for all teams
```

Only after PR-007 should the browser explorer depend on generated model output.
