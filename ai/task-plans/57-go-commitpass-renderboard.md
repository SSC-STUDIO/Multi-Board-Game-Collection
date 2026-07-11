# Task Plan

## Goal

Fix Go `commitPass()` to call `this.renderBoard()` after updating `lastMove` and `koPoint`, so the 3D renderer clears stale last-move and ko highlights after a pass. Currently `handleMove()`, `handleUndo()`, `handleHint()`, and `finishByScoring()` all call `renderBoard()`, but `commitPass()` omits it, leaving the previous stone's last-move highlight visible on the board after a pass.

## Baseline

- Repository: Multi-Board-Game-Collection, branch master, commit 9fde54e (clean tree).
- Previous fixes (rev 54-55) added `clearAITimer()` to undo in Chess/Go/Xiangqi and `renderStatus()` to Othello undo.
- `GoApp.commitPass()` (line 298-323) increments `consecutivePasses`, sets `koPoint = null`, pushes a pass move to `moveHistory`, sets `state.lastMove`, plays sound, then either calls `finishByScoring()` (which calls `renderBoard()`) or calls `renderStatus()` + `maybeScheduleAI()` but NOT `renderBoard()`.
- `GoApp.handleMove()` (line 284) calls `this.renderBoard()` after every stone placement.
- `renderBoard()` (line 423) calls `render3DIfActive()` which syncs the 3D board, calls `highlightLastMove()`, `highlightKo()`, and `highlightHint()`.
- No existing test verifies that `commitPass()` triggers `renderBoard()`.
- All 1415 tests pass (exit 0), check exit 0, build exit 0.

## Scope

- `src/games/go/GoApp.js` — add `this.renderBoard()` call in `commitPass()` after state update, before the double-pass check.
- `src/games/go/GoApp.test.js` — add a focused test verifying `commitPass()` calls `renderBoard()` and that `lastMove` is the pass move with null coords.

## Steps

1. In `GoApp.commitPass()`, after `this.sound.play('uiTap')` and before the `consecutivePasses >= 2` check, add `this.renderBoard();` to sync the 3D renderer with the updated `lastMove` (now a pass with null coords) and cleared `koPoint`.
2. Add a regression test in `GoApp.test.js` that:
   - Starts a game, places a stone (so lastMove highlight is on a real position).
   - Calls `commitPass()`.
   - Asserts `renderBoard()` was called (spy on `renderBoard`).
   - Asserts `state.lastMove.pass` is `true` and `state.lastMove.row` is `null`.
3. Run focused tests: `npx vitest run src/games/go/GoApp.test.js`.
4. Run configured gate: `npm run check && npm test && npm run build`.
5. Update this plan with actual evidence.

## Verification

- Focused: `npx vitest run src/games/go/GoApp.test.js` — expect all pass (including new test).
- Gate: `npm run check` exit 0, `npm test` exit 0 (1415+ tests), `npm run build` exit 0.
- Inspect `git diff --stat` to confirm only GoApp.js and GoApp.test.js changed.

## Risks

- `renderBoard()` calls `render3DIfActive()` which is a no-op if `viewMode !== '3d'` or `renderer3d` is null. Since Go is 3D-only, this always runs, but it's idempotent and safe.
- Adding `renderBoard()` before the `consecutivePasses >= 2` check means `finishByScoring()` will call `renderBoard()` again — double render on the pass that triggers scoring. This is a minor redundant call but not a correctness issue (idempotent render). Acceptable trade-off for code clarity.

## Stop Conditions

- If `renderBoard()` has side effects that break pass behavior, stop and report.
- If tests fail after adding `renderBoard()`, revert the source change and report the failure.

## Evidence

### Commands and Exit Codes

1. `npx vitest run src/games/go/GoApp.test.js` — exit 0, 27 tests passed (1 file)
2. `npm run check` — exit 0, 141 modules checked
3. `npm test` — exit 0, 60 files, 1416 tests passed (was 1415, +1 new test)
4. `npm run build` — exit 0, 168 files, 491ms

### Diff

- `src/games/go/GoApp.js`: +1 line (`this.renderBoard();` in `commitPass()`)
- `src/games/go/GoApp.test.js`: +11 lines (new test `should call renderBoard after commitPass to sync 3D highlights`)

### Findings

- `commitPass()` previously omitted `renderBoard()` while every other state-mutating path (`handleMove`, `handleUndo`, `handleHint`, `finishByScoring`) called it.
- After the fix, `renderBoard()` runs before the double-pass check. If `finishByScoring()` triggers, it calls `renderBoard()` again — a harmless idempotent re-render.
- The new test spies on `renderBoard`, calls `commitPass()`, and asserts both that the spy was called and that `lastMove` is a pass with null coords.
- No baseline failures. All 1416 tests pass.
