# Copilot Processing

## User Request
Create a devcontainer configuration for the `fbs-graph` repository.

## Action Plan

| # | Task | Status |
|---|------|--------|
| 1 | Read project structure and identify Node version, ports, env vars | COMPLETE |
| 2 | Create `.devcontainer/Dockerfile` | COMPLETE |
| 3 | Create `.devcontainer/devcontainer.json` | COMPLETE |

## Summary

Created `.devcontainer/Dockerfile` and `.devcontainer/devcontainer.json`. See below for details.

- Base image: `mcr.microsoft.com/devcontainers/javascript-node:20-bookworm` (matches `@types/node ^20`)
- PowerShell installed for the `scripts/*.ps1` scripts
- Ports 4100 (GraphQL) and 4173 (web server) forwarded
- VS Code extensions: ESLint, Prettier, TypeScript Nightly, Vitest Explorer, GraphQL, PowerShell
- Runs as non-root `node` user
- `.env` is part of the workspace mount — create it before or after opening the container


## User Request
Create GitHub issues for the repository `apkasten906/fbs-graph` for each of the 15 stories in `docs/fbs-pro-rel-milestone-package/fbs-pro-rel-milestone-stories.md`. User will create the milestone and assign it manually.

## Action Plan

### Phase A: Create GitHub Issues for all 15 stories

| # | Story | Title | Status |
|---|-------|-------|--------|
| 1 | PR-001 | Support configurable multi-season static data generation | COMPLETE — #44 |
| 2 | PR-002 | Define the static pro/rel data contract | COMPLETE — #45 |
| 3 | PR-003 | Add scenario presets for competing value systems | COMPLETE — #46 |
| 4 | PR-004 | Implement deterministic pro/rel scoring functions | COMPLETE — #47 |
| 5 | PR-005 | Assign teams to tiers using configurable tier rules | COMPLETE — #48 |
| 6 | PR-006 | Create a table-first Pro/Rel Explorer page | COMPLETE — #49 |
| 7 | PR-007 | Add adjustable weight sliders | COMPLETE — #50 |
| 8 | PR-008 | Add team explanation panel | COMPLETE — #51 |
| 9 | PR-009 | Add shareable scenario URLs | COMPLETE — #52 |
| 10 | PR-010 | Generate pro/rel model output for all teams | COMPLETE — #53 |
| 11 | PR-011 | Add graph overlay for projected tiers | COMPLETE — #54 |
| 12 | PR-012 | Add multi-year graph controls | COMPLETE — #55 |
| 13 | PR-013 | Document the pro/rel data update workflow | COMPLETE — #56 |
| 14 | PR-014 | Add regression tests for scoring and tier assignment | COMPLETE — #57 |
| 15 | PR-015 | Add build/deployment validation for the static explorer | COMPLETE — #58 |

## Summary

All 15 GitHub issues were created successfully in `apkasten906/fbs-graph` (issues #44–#58). Each issue contains the full user story, acceptance criteria (Gherkin scenarios), implementation notes, and test notes from the stories file. Labels applied: `enhancement` for most stories, `documentation` for PR-013, and `testing` for PR-014.

Next step: Create the milestone in GitHub and assign all 15 issues to it.
