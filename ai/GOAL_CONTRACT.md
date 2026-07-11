# Multi Board Game Collection Goal Contract

## Outcome
Improve game-rule correctness, deterministic state transitions, AI behavior, save compatibility, and desktop/mobile integrity across all included games.

## Priority order
1. Fix rule, move-legality, scoring, undo/redo, replay, save/load, and turn-state defects before visual polish.
2. Protect Electron preload boundaries, browser storage migrations, Capacitor behavior, and offline assets.
3. Add focused regression tests per game instead of broad shared changes that risk cross-game regressions.

## Execution loop
1. Establish the baseline from code, tests, task notes, and repository status.
2. Choose the smallest high-value defect inside the allowed boundary.
3. State the invariant and how it will be verified.
4. Implement the minimum coherent change and focused tests.
5. Run verification, inspect status and diff, then submit structured evidence.

## Completion contract
Report changed files, root cause, invariant restored, commands and exit codes, artifacts, baseline failures, unresolved risks, and next action. Stop after one reviewable improvement; the master decides whether the same Session continues.
