# Task Plan — Rev 66 (attempt 2): Othello checkGameEnd missing render() after double-pass game end

## Goal
Fix Othello's `checkGameEnd()` so it calls `render()` after `_finalizeResult(winner)` when a double-pass game end occurs during AI turn, matching the other two game-end paths in `commitMove`.

## Root Cause
`checkGameEnd()` (line 314-321) calls `_finalizeResult(winner)` (which calls `showResult()`) then `return`s — but never calls `this.render()`. The other two game-end paths in `commitMove` (line 163-166 board full, line 181-184 double pass during human move) both call `this.render()` after `_finalizeResult`. The `checkGameEnd` path is called from `BoardGameApp.scheduleAIMove` when the AI returns null (no legal moves). After double pass in `checkGameEnd`, the status bar stays stale — `renderStatus()` is never called to show "Game End".

## Baseline
- Commit: da22baf (HEAD on master)
- Working tree: clean (stale 61-grok-execution-plan.md deleted)
- Gates at baseline: check (0, 141 modules), test (0, 60 files, 1429 tests), build (0, 168 files)

## Scope
- `src/games/othello/OthelloApp.js` — add `this.render()` call at line 321 before `return`
- `src/games/othello/OthelloApp.test.js` — add regression test for `checkGameEnd` calling render after double-pass game end

## Steps
1. Add `this.render()` call before `return` at line 321 in `checkGameEnd()`
2. Add regression test: `checkGameEnd` with `passCount >= 2` — calls `_finalizeResult` and `render`, status shows 'gameEnd'
3. Run focused tests: `npx vitest run src/games/othello/OthelloApp.test.js`
4. Run gates: `npm run check`, `npm test`, `npm run build`

## Verification
- `npx vitest run src/games/othello/OthelloApp.test.js` — must show all tests pass, +1 new test
- `npm run check` — exit 0, 141 modules
- `npm test` — exit 0, 60 files, 1430 tests (was 1429, +1)
- `npm run build` — exit 0, 168 files

## Risks
- Low risk: `render()` is idempotent — it calls `renderBoard()`, `renderStatus()`, `renderMoveList()` (all already used in sibling paths).
- The fix matches the exact pattern in `commitMove` lines 163-166 and 181-184.

## Stop Conditions
- If `render()` causes an error in `checkGameEnd` context → revert and investigate.
- If tests fail → investigate before stopping.

## Evidence

### Date: 2026-07-14 (UTC+8: 04:39)
### Baseline
- Commit: da22baf (HEAD on master)
- Working tree: clean (stale 61-grok-execution-plan.md deleted per master instruction)

### Diff Summary
- `src/games/othello/OthelloApp.js`: Added `this.render()` and `this.renderMoveList()` calls in `checkGameEnd()` after `_finalizeResult(winner)` at the double-pass game-end path (line 320-322). Previously this path returned without rendering, leaving the status bar stale. +2 lines.
- `src/games/othello/OthelloApp.test.js`: Added 1 regression test verifying `checkGameEnd()` with double pass calls `render()` → `renderStatus()` shows 'gameEnd'. +13 lines.

### Gate Results
- Focused: `npx vitest run src/games/othello/OthelloApp.test.js` — 64 tests pass (was 63, +1)
- Full check: `npm run check` exit 0, 141 modules
- Full test: `npm test` exit 0, 60 files, 1430 tests (was 1429, +1)
- Full build: `npm run build` exit 0, 168 files

### Stale Artifact Cleanup
- Deleted `ai/task-plans/61-grok-execution-plan.md` per master instruction (rev-61 Shogi plan, no longer relevant)
- `git status` confirms clean working tree after deletion
