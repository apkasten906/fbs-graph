# FBS Pro/Rel Milestone Package v0.2

This package updates the original milestone stories and plan prompt after Codex review.

## What changed from v0.1

- Moved full all-team model output before the table-first explorer.
- Added a precise data contract with score scale, required fields, null behavior, versioning, and provenance.
- Added a missing story for validating and documenting model inputs.
- Defined Tier 3 vs. Tier 4 assignment rules explicitly.
- Chose slider behavior: raw totals may differ from 100; scoring normalizes during calculation.
- Added backward-compatible multi-season output naming and default aliases.
- Removed fixed real-team dependency from explanation acceptance criteria.
- Added browser JSON load/fallback handling.
- Added URL parser fallback behavior for invalid weights.
- Added build validation that all generated JSON files land in `dist`.
- Added exact team-id join requirements for graph overlays.

## Included files

- `fbs-pro-rel-milestone-plan-prompt-v0.2.md`
- `fbs-pro-rel-milestone-stories-v0.2.md`
- `fbs-pro-rel-milestone-readme-v0.2.md`

## Recommended first implementation slice

```text
PR-001 → PR-002 → PR-003 → PR-004 → PR-005 → PR-006 → PR-007
```

This produces a complete static-data and model-output foundation before any browser explorer work begins.
