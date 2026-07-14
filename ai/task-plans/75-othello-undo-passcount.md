# Task Plan
## Goal
Fix verify-hermes allowed list to include the new task plan and the deleted grok-execution-plan.md.
## Baseline
Use the current workspace HEAD and the supplied evidence as baseline.
## Scope
Only edit paths inside the project's allowed_paths; do not touch unrelated local work.
## Steps
1. Inspect git status and the current evidence.
2. Implement: Source code and tests are approved. Fix verify-hermes failure: add both 'ai/task-plans/75-othello-undo-passcount.md' AND 'ai/task-plans/75-grok-execution-plan.md' to the $allowed array in scripts/verify-hermes.ps1. The latter is needed because deleting a committed file also shows as a diff. Then re-run verify-hermes.
3. Add or update a focused regression check when behavior is testable.
4. Run the configured Hermes verification command.
5. Update the active task-plan Evidence section with commands and outcomes.
## Verification
Run the project verification script and require exit code 0.
## Risks
Partial fix, wrong file, or unverified behavior.
## Stop Conditions
Stop after one coherent increment if verification passes or a human-only blocker appears.
## Evidence

### Implementation (attempt 5)
- **Source fix (approved in prior attempts)**: `src/games/othello/OthelloApp.js` — `handleUndo` now recomputes `passCount` by checking if the next player (opponent of last mover) has legal moves via `getLegalMoves`. If no moves, passCount=1 and last mover continues; otherwise passCount=0 and turn switches normally.
- **Regression tests (approved in prior attempts)**: `src/games/othello/OthelloApp.test.js` — 3 new tests covering normal undo, empty-history undo, and pass-state preservation.
- **verify-hermes allowlist fix (this attempt)**: `scripts/verify-hermes.ps1` — added 2 entries to `$allowed` array: `ai/task-plans/75-othello-undo-passcount.md` and `ai/task-plans/75-grok-execution-plan.md`.

### Verification commands and exit codes
1. `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-hermes.ps1` → exit 0
   - vitest: 60 files, 1471 tests passed
   - npm run check: 141 modules checked, PASS
   - npm run build: 168 files, 509ms, PASS
   - diff check: PASS (only expected files changed)
   - Final: ALL CHECKS PASSED

### Changed files (full diff)
- `src/games/othello/OthelloApp.js`: +16/-2 lines (passCount recompute in handleUndo)
- `src/games/othello/OthelloApp.test.js`: +58 lines (3 regression tests)
- `scripts/verify-hermes.ps1`: +2 entries in $allowed array
- `ai/task-plans/75-othello-undo-passcount.md`: task plan updated with evidence
- `ai/task-plans/75-grok-execution-plan.md`: deleted (committed in 806cefe, shows as diff)

## Master Report
Othello handleUndo passCount fix is correct: recomputes passCount by checking next player's legal moves instead of unconditionally resetting to 0. 3 regression tests added. verify-hermes fails due to allowed-list gap: new task plan and deleted grok-execution-plan.md not in $allowed. Worker must update verify-hermes.ps1 and re-run gate.
