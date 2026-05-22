# FBS Graph — Pro/Rel Milestone Package

This package contains two Markdown files for the proposed **Pro/Rel Static Scenario Explorer** milestone.

## Files

| File | Purpose |
|---|---|
| `fbs-pro-rel-milestone-plan-prompt.md` | A plan prompt for Copilot/Codex/agent-mode implementation. |
| `fbs-pro-rel-milestone-stories.md` | BDD-style stories and acceptance criteria for the milestone. |

## Milestone Intent

The goal is to extend the current FBS Graph static data pipeline so that:

1. GitHub Pages remains the deployment target.
2. Static data generation supports multiple seasons.
3. A pro/rel scoring model can be generated from static inputs.
4. Users can compare scenarios and adjust weights in the browser.
5. Graph visualizations can eventually use multi-year windows and tier overlays.

## Recommended First Implementation Slice

Start with:

1. Multi-season static data generation.
2. Static pro/rel data contract.
3. Scenario presets.
4. Deterministic scoring functions.
5. Tier assignment.
6. Table-first Pro/Rel Explorer page.

Then add graph overlays and advanced multi-year graph controls.
