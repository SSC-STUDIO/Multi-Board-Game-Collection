# Task Plan

## Goal
Unblock rev 62 by adding src/games/shogi/ShogiApp.test.js to the verify-hermes.ps1 diff-check allowlist.

## Baseline
- Branch: master at 44a7438
- ShogiApp.js diff (render+renderMoveList before gameOver gate) and ShogiApp.test.js diff (regression test) are correct and pass npm test (1419 pass)
- verify-hermes.ps1 fails only on: FAIL: unexpected changed file: src/games/shogi/ShogiApp.test.js

## Scope
- scripts/verify-hermes.ps1 line 38: add "src/games/shogi/ShogiApp.test.js" to $allowed array

## Steps
1. Read scripts/verify-hermes.ps1 line 38 to confirm current $allowed array
2. Edit line 38: add "src/games/shogi/ShogiApp.test.js" after the existing "src/games/shogi/ShogiApp.js" entry
3. Run verify-hermes.ps1 and confirm PASS
4. Stage ONLY these files: src/games/shogi/ShogiApp.js, src/games/shogi/ShogiApp.test.js, ai/task-plans/62-shogi-final-move-missing-from-move-list.md, scripts/verify-hermes.ps1
5. Commit with message: fix(shogi): ensure renderMoveList called on game-end commitMove
6. Push to origin master

## Verification
- verify-hermes.ps1: exit 0, ALL CHECKS PASSED

## Risks
- Minimal: allowlist expansion is backward-compatible and matches the pattern of all other game test files already listed

## Stop Conditions
- If verify-hermes.ps1 still fails after the allowlist fix
- If any git push fails

## Evidence
- Diff: ShogiApp.js +1/-5 lines (reorder render+renderMoveList before gameOver gate)
- Diff: ShogiApp.test.js +10 lines (spy-based regression test)
- Diff: verify-hermes.ps1 +1 entry in allowlist
- npm test: exit 0, 1419 tests, 60 files
- npm run check: exit 0, 141 modules
- npm run build: exit 0, 168 files

## Master Report
Rev 62 Shogi final-move-missing defect is correctly implemented with a focused regression test. All tests pass (1419). The only gate failure is verify-hermes.ps1 allowlist missing src/games/shogi/ShogiApp.test.js — a pre-existing oversight since all other game test files are already listed. Worker must add this one entry to the allowlist, re-verify, then stage+commit+push the 4 files (ShogiApp.js, ShogiApp.test.js, plan, verify-hermes.ps1). Do not stage ai/task-plans/61-grok-execution-plan.md.
