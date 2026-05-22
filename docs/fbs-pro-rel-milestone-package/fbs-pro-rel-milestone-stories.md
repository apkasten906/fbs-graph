# Stories: Milestone — Pro/Rel Static Scenario Explorer

## Milestone Summary

Build a static, GitHub Pages-compatible promotion/relegation scenario explorer for the FBS Graph application.

The milestone extends the existing static data generation pipeline so that the app can support multi-year graph data and a configurable scoring model for assigning FBS teams into a tiered promotion/relegation structure.

Default scoring model:

```text
Total Score =
  FiveYearResultsScore * 0.35
+ ScheduleSurvivalScore * 0.25
+ HeadToHeadGraphScore * 0.20
+ RosterNilScore * 0.10
+ BrandMediaScore * 0.10
```

Default structure:

```text
Tier 1: 20 national teams
Tier 2: 24 national teams
Tier 3: regional leagues
Tier 4: regional/development leagues
```

---

## Story PR-001 — Support configurable multi-season static data generation

### User Story

As a site maintainer, I want the static data generation scripts to support multiple seasons, so that the graph and pro/rel model can use a five-year history rather than only the current year.

### Context

The existing static generation script currently assumes the current year for some outputs. The pro/rel model requires data across multiple seasons, initially 2021–2025, with room to include 2026 once available.

### Acceptance Criteria

```gherkin
Scenario: Generate static files for one season by default
  Given no explicit season range is provided
  When I run the static data generation script
  Then the script generates static files for the current default season
  And existing GitHub Pages behavior remains compatible
```

```gherkin
Scenario: Generate static files for an explicit multi-season range
  Given I provide a season list such as 2021,2022,2023,2024,2025
  When I run the static data generation script
  Then the script generates games files for each requested season
  And the script generates essential matchup files for each requested season
  And the script generates conference connectivity files for each requested season
  And metadata lists all generated seasons
```

```gherkin
Scenario: Missing data is handled clearly
  Given one requested season has no available game data
  When the script runs without fail-on-missing-data mode
  Then the script logs a warning for that season
  And continues generating available seasons
```

```gherkin
Scenario: Missing data can fail CI when required
  Given fail-on-missing-data mode is enabled
  And one requested season has no available game data
  When the script runs
  Then the script fails with a clear error message
```

### Implementation Notes

- Add a season-list parser using CLI arguments or an environment variable such as `STATIC_SEASONS`.
- Avoid hardcoding `new Date().getFullYear()` as the only generated season.
- Keep the existing one-season behavior working.
- Update metadata to include `seasons`, `defaultSeason`, and `generatedSeasonCount`.

### Test Notes

- Unit-test the season parser.
- Add a script-level test or fixture test for multi-season metadata output.

---

## Story PR-002 — Define the static pro/rel data contract

### User Story

As a developer, I want a clear static data contract for the pro/rel model, so that generated data, browser UI, and tests all use the same shape.

### Acceptance Criteria

```gherkin
Scenario: Pro/rel input files are generated or available
  Given the static data generation process has completed
  When I inspect the pro/rel data directory
  Then I see team inputs, scenario presets, tier rules, and metadata
```

```gherkin
Scenario: Team inputs expose component scores
  Given a team is included in the pro/rel model
  When the browser loads the team input data
  Then the team has stable id, display name, conference, region, and component scores
```

```gherkin
Scenario: Scenario presets are data-driven
  Given scenario presets exist as static data
  When the UI loads the presets
  Then the UI can render the preset names and weights without hardcoded values
```

### Proposed Files

```text
web/data/pro-rel/
  teams-fbs.json
  seasons.json
  program-factors.json
  scenario-presets.json
  tier-rules.json
  metadata.json
```

### Implementation Notes

- Keep the contract small at first.
- Make source/provenance explicit where values are manually maintained.
- Include `modelVersion` in metadata.

### Test Notes

- Validate JSON shape with TypeScript types or Zod schemas.
- Include tests for missing required fields.

---

## Story PR-003 — Add scenario presets for competing value systems

### User Story

As a reader, I want to compare multiple weighting scenarios, so that I can see how different assumptions change the tier structure.

### Acceptance Criteria

```gherkin
Scenario: Balanced Launch preset is available
  Given the pro/rel explorer loads
  When I open the scenario selector
  Then I can select Balanced Launch
  And the weights are Results 35, Schedule 25, H2H/Graph 20, Roster/NIL 10, Brand/Media 10
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
  Then every preset has a total weight of 100
```

### Initial Presets

| Scenario | Results | Schedule | H2H/Graph | Roster/NIL | Brand/Media |
|---|---:|---:|---:|---:|---:|
| Balanced Launch | 35 | 25 | 20 | 10 | 10 |
| Pure Merit | 55 | 10 | 25 | 5 | 5 |
| Power Structure | 25 | 35 | 15 | 15 | 10 |
| Media Reality | 25 | 20 | 15 | 15 | 25 |
| Open Pyramid | 45 | 10 | 30 | 10 | 5 |

### Implementation Notes

- Store presets in `scenario-presets.json`.
- Do not hardcode preset weights in UI JavaScript except as fallback sample data.

### Test Notes

- Test that every scenario contains all five required weight categories.
- Test that every scenario weight set sums to 100.

---

## Story PR-004 — Implement deterministic pro/rel scoring functions

### User Story

As a developer, I want deterministic scoring functions, so that ranking and tier assignment can be tested and explained.

### Acceptance Criteria

```gherkin
Scenario: Calculate a team total score
  Given a team has component scores
  And a scenario has weights
  When the scoring function runs
  Then the output total score equals the weighted sum of the component scores
```

```gherkin
Scenario: Normalize weights expressed as percentages
  Given scenario weights are provided as 35, 25, 20, 10, and 10
  When the scoring function calculates totals
  Then the weights are treated as 0.35, 0.25, 0.20, 0.10, and 0.10
```

```gherkin
Scenario: Sort teams by total score
  Given multiple teams have calculated total scores
  When the ranking function runs
  Then teams are sorted from highest score to lowest score
```

```gherkin
Scenario: Stable tie-breaker is used
  Given two teams have the same calculated total score
  When the ranking function sorts them
  Then a deterministic tie-breaker is used
  And repeated runs produce the same order
```

### Implementation Notes

Suggested functions:

```text
calculateTotalScore(componentScores, weights)
normalizeScenarioWeights(weights)
rankTeamsByScenario(teamInputs, scenario)
buildTeamExplanation(team, scenario, tierAssignment)
```

Tie-breaker suggestion:

1. Higher five-year results score
2. Higher schedule survival score
3. Alphabetical by team name

### Test Notes

- Put tests near the scoring module.
- Use simple fixtures with obvious expected results.

---

## Story PR-005 — Assign teams to tiers using configurable tier rules

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
Scenario: Remaining teams are assigned to regional tiers
  Given teams remain after Tier 1 and Tier 2 assignment
  When regional assignment runs
  Then each remaining team is assigned to a Tier 3 or Tier 4 region
```

```gherkin
Scenario: Manual override hooks are supported
  Given tier rules contain a manual override for a team
  When tier assignment runs
  Then the override is applied
  And the output explains that the team was manually adjusted
```

### Implementation Notes

- Store rules in `tier-rules.json`.
- Include support for manual overrides but do not overuse them.
- Keep Tier 3/Tier 4 regionalization explainable.

### Test Notes

- Test Tier 1 and Tier 2 cutoffs.
- Test manual override behavior.
- Test that every team receives exactly one tier assignment.

---

## Story PR-006 — Create a table-first Pro/Rel Explorer page

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
  Given the model data has loaded
  When the default scenario is selected
  Then I see a top 50 table
  And each row shows rank, team, conference, total score, component scores, and projected tier
```

```gherkin
Scenario: View full tier assignments
  Given the model data has loaded
  When I scroll to the tier section
  Then I see all teams grouped by tier and region
```

```gherkin
Scenario: Change scenario preset
  Given the Balanced Launch scenario is selected
  When I select Pure Merit
  Then the rankings and tier assignments recalculate in the browser
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

- Add DOM-level tests if existing test setup supports jsdom.
- At minimum, test the browser-safe calculation functions.

---

## Story PR-007 — Add adjustable weight sliders

### User Story

As a reader, I want to adjust the model weights myself, so that I can test whether the tier structure reflects my view of fairness.

### Acceptance Criteria

```gherkin
Scenario: Adjust one weight
  Given a scenario is loaded
  When I increase the schedule survival weight
  Then the rankings recalculate
  And the displayed total score updates
```

```gherkin
Scenario: Weights remain valid
  Given I adjust the sliders
  When the total weight does not equal 100
  Then the UI either normalizes weights or clearly shows the current total
```

```gherkin
Scenario: Reset to preset
  Given I have modified the weights manually
  When I click reset for the selected preset
  Then the weights return to the preset values
  And the rankings recalculate
```

### Implementation Notes

- Decide whether sliders auto-normalize or allow temporary totals other than 100.
- For clarity, show the total weight sum.
- Prefer simple browser-side state management.

### Test Notes

- Test recalculation after weight changes.
- Test reset behavior.

---

## Story PR-008 — Add team explanation panel

### User Story

As a reader, I want to understand why a team is assigned to a particular tier, so that the model feels transparent rather than arbitrary.

### Acceptance Criteria

```gherkin
Scenario: Select a team from the ranking table
  Given the top 50 table is visible
  When I select Wisconsin
  Then I see Wisconsin’s component scores
  And I see a short explanation of the tier assignment
```

```gherkin
Scenario: Explanation updates with scenario
  Given a team explanation is visible
  When I change the selected scenario
  Then the explanation updates to reflect the new score and tier
```

```gherkin
Scenario: Manual override is explained
  Given a team has a manual tier override
  When I view that team’s explanation
  Then the explanation includes the override reason
```

### Example Explanation

```text
Wisconsin projects to Tier 2 because its recent AP results are weak, but its Big Ten schedule survival, roster baseline, and brand/media scores keep it above the regional Tier 3 threshold.
```

### Implementation Notes

- Keep explanation generation rule-based at first.
- Avoid AI-generated text in the browser.

### Test Notes

- Test explanation output for strong, weak, and override cases.

---

## Story PR-009 — Add shareable scenario URLs

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
  Then the custom weights are represented in the query string or hash
```

```gherkin
Scenario: Shared URL restores state
  Given I open a URL with scenario and weight parameters
  When the page loads
  Then the UI restores those settings
  And the ranking table reflects them
```

### Implementation Notes

Example URL shape:

```text
/pro-rel-explorer.html#scenario=balanced&results=35&schedule=25&graph=20&roster=10&brand=10
```

### Test Notes

- Test URL serialization and parsing as pure functions.

---

## Story PR-010 — Generate pro/rel model output for all teams

### User Story

As a model author, I want the static pipeline to produce pro/rel output for every FBS team, so that the explorer covers the full Division I-A/FBS universe.

### Acceptance Criteria

```gherkin
Scenario: All eligible teams are included
  Given the pro/rel generation script runs
  When the model output is generated
  Then every eligible FBS/FBS-transition team appears exactly once
```

```gherkin
Scenario: Output includes component and total scores
  Given a generated model output file exists
  When I inspect a team record
  Then it includes component scores, total score, rank, and projected tier
```

```gherkin
Scenario: Output metadata is clear
  Given model output is generated
  When I inspect metadata
  Then I can see model version, generated timestamp, included seasons, and selected scenario
```

### Implementation Notes

- Start with a manually curated `program-factors.json` if necessary.
- Keep soft inputs, such as roster/NIL and brand/media, visibly separate from hard results data.

### Test Notes

- Test for duplicate team ids.
- Test for missing component scores.
- Test that all output rows have a projected tier.

---

## Story PR-011 — Add graph overlay for projected tiers

### User Story

As a user of FBS Graph, I want to visualize projected tiers on the existing graph, so that I can see how promotion/relegation structure maps onto the current schedule network.

### Acceptance Criteria

```gherkin
Scenario: Graph nodes are colored by projected tier
  Given the graph visualizer has loaded
  And pro/rel model data is available
  When I enable the pro/rel overlay
  Then team nodes are colored by projected tier
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

- This story should follow the table-first explorer.
- Reuse existing graph filtering patterns where possible.
- Avoid destabilizing the current graph layout unless necessary.

### Test Notes

- Test mapping from team id to tier metadata.
- Test filter functions independently from rendering.

---

## Story PR-012 — Add multi-year graph controls

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

### Implementation Notes

- This is closely related to PR-001.
- Start with season selector before implementing rolling windows.
- Aggregated multi-year edges should expose count, average leverage, and most recent season.

### Test Notes

- Test aggregation of repeated edges across seasons.
- Test missing season behavior.

---

## Story PR-013 — Document the pro/rel data update workflow

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
- Include limitations and known subjective inputs.

### Test Notes

- Documentation-only story; no automated tests required unless using a docs link checker.

---

## Story PR-014 — Add regression tests for scoring and tier assignment

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

### Implementation Notes

- Use small fixtures, not the full dataset, for unit tests.
- Add one snapshot or golden-output test only after the data contract stabilizes.

### Test Notes

- Run through `npm run test:run`.
- Include tests in CI if current workflow supports it.

---

## Story PR-015 — Add build/deployment validation for the static explorer

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
  Then the dist folder includes the explorer page and pro/rel data files
```

```gherkin
Scenario: Deployment remains backend-free
  Given the site is deployed to GitHub Pages
  When the pro/rel explorer loads
  Then it does not require the GraphQL server
```

### Implementation Notes

- Add a lightweight validation script if needed.
- Validate file existence and JSON parseability.
- Do not require full model perfection for build success; validate structural readiness.

### Test Notes

- Can be tested with a small script run before `build:pages`.

---

## Recommended Story Order

1. PR-001 — Support configurable multi-season static data generation
2. PR-002 — Define the static pro/rel data contract
3. PR-003 — Add scenario presets
4. PR-004 — Implement deterministic pro/rel scoring functions
5. PR-005 — Assign teams to tiers using configurable tier rules
6. PR-006 — Create a table-first Pro/Rel Explorer page
7. PR-007 — Add adjustable weight sliders
8. PR-008 — Add team explanation panel
9. PR-009 — Add shareable scenario URLs
10. PR-010 — Generate pro/rel model output for all teams
11. PR-012 — Add multi-year graph controls
12. PR-011 — Add graph overlay for projected tiers
13. PR-013 — Document the pro/rel data update workflow
14. PR-014 — Add regression tests for scoring and tier assignment
15. PR-015 — Add build/deployment validation for the static explorer

## Suggested First Sprint Cut

For the first implementation pass, focus on stories PR-001 through PR-006. That gives us a complete vertical slice:

```text
multi-season static data → pro/rel data contract → scenario presets → scoring → tier assignment → table UI
```

The graph overlay and advanced multi-year graph controls can follow once the model output is stable.
