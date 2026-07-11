# Task Plan

## Goal

Fix Othello status bar stale-after-move defect: `OthelloApp.render()` does not call `renderStatus()`, so after every `commitMove()` and `checkGameEnd()` pass, the status bar (whose turn, game-state text) retains stale information. Add `this.renderStatus()` to `render()` matching the pattern in Chess and Xiangqi.

## Baseline

- Branch: `master` at `0a51088`
- Working tree: clean (no unstaged/untracked files)
- Test count: 1417 passing (60 files), 0 failing
- Previous fixes: rev 58 (Othello clearPendingAI in handleUndo), rev 57 (Go renderBoard after commitPass), rev 56 (AI timer + renderStatus across all games)

## Scope

- `src/games/othello/OthelloApp.js` — add `this.renderStatus()` at end of `render()` method
- `src/games/othello/OthelloApp.test.js` — add regression test verifying `render()` calls `renderStatus()`
- `ai/task-plans/60-othello-render-status-after-move.md` — this plan document

Out of scope: other games, other Othello methods, non-visual changes.

## Steps

1. Create this plan document (pre-edit).
2. Read OthelloApp.render() at line 97 to confirm current code.
3. Add `this.renderStatus();` as the last statement of `render()` before the closing brace, matching Chess/Xiangqi pattern.
4. Write a regression test in OthelloApp.test.js that:
   - Starts a game
   - Verifies that calling `render()` calls `renderStatus()`
   - Alternatively: verifies that after a move, `renderStatus()` was called (spy-based)
5. Run focused Othello tests.
6. Run full gate (check, test, build).
7. Update plan with evidence.
8. Stop for master review.

## Verification

- Focused: `npx vitest run src/games/othello/OthelloApp.test.js` — exit 0, all tests pass
- Gate: `npm run check` — exit 0, 141 modules
- Gate: `npm test` — exit 0, 60 files, tests pass
- Gate: `npm run build` — exit 0

## Risks

- Adding `renderStatus()` to `render()` means `handleUndo()` (line 374-376) will call it twice: once via `render()` and once directly at line 376. This is harmless — `renderStatus()` is a pure DOM update (sets `textContent`) with no side effects.
- All other `render()` call sites (lines 93, 163, 182, 193, 323, 394, 456) will now correctly update the status bar. This is the desired behavior.
- No rule, scoring, or save-schema changes.

## Stop Conditions

- If the focused test or gate fails with a regression, stop and report.
- If `renderStatus()` has side effects that make the double-call problematic, stop and use targeted calls instead.

## Evidence

### Commands and Exit Codes

1. `npx vitest run src/games/othello/OthelloApp.test.js` — exit 0, 60 tests passed (1 file, was 59)
2. `npm run check` — exit 0, 141 modules checked
3. `npm test` — exit 0, 60 files, 1418 tests passed (was 1417, +1 new regression test)
4. `npm run build` — exit 0, 168 files, 303ms

### Source Change

- `src/games/othello/OthelloApp.js`: Added `this.renderStatus();` as the last statement in `render()` method (after board DOM rebuild, before closing brace). This ensures the status bar (whose turn, game-state text) updates every time `render()` is called — matching the Chess/Xiangqi pattern where `render()` bundles `renderBoard() + renderStatus() + renderGameCoach()`.

### Regression Test

- `src/games/othello/OthelloApp.test.js`: Added test "should be called by render() so status bar updates after every move" inside the `renderStatus` describe block. Sets `currentPlayer = 'white'`, calls `render()`, asserts `status.textContent` contains "White".

### Diff Check

- Diff is 2 files, +8 lines. Differs from all previous submissions (rev 56: undo guards, rev 57: Go renderBoard, rev 58: Othello clearPendingAI).
- The renderStatus() call at handleUndo line 376 now fires twice (once via render(), once directly). This is harmless — renderStatus() is a pure DOM textContent set with no side effects.

### Deviations

None. All steps executed as planned.
