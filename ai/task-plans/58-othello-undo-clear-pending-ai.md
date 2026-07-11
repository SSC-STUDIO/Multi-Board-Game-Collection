# Task Plan

## Goal

Fix Othello `handleUndo()` to call `this.clearPendingAI()` before reconstructing state, so a pending AI timer (scheduled but not yet fired) is cancelled before the board state is rewound. Without this, undo proceeds while a timer is pending; when the timer fires, the AI commits a move on the post-undo board state, corrupting the game.

## Baseline

- Repository: Multi-Board-Game-Collection, branch master, commit 7d51b33 (clean tree).
- Previous fixes (rev 54) added `clearAITimer()` to Chess/Go/Xiangqi `handleUndo()` — Othello was missed because it uses the `clearPendingAI()` wrapper (which calls `clearAITimer()` internally).
- `OthelloApp.handleUndo()` (line 355) guards `if (this.state.aiThinking || this.state.gameOver) return;` but does NOT call `this.clearPendingAI()` before replaying the board. If a timer is pending (aiThinking is still false), the timer survives undo and fires on stale state.
- `OthelloApp.handleResign()` (line 380) CALLS `this.clearPendingAI()` — same class, correct pattern.
- `OthelloApp.enterSetup()` (line 77) and `dispose()` (line 464) also call `clearPendingAI()`.
- `ChessApp.handleUndo()` (line ~230), `GoApp.handleUndo()` (line ~325), and `XiangqiApp.handleUndo()` (line ~276) all call `this.clearAITimer()` as their first action.
- Othello undo tests (lines 451, 461, 712) test move history removal, PvE fallback, and hintMove clearing — but NONE test that `clearPendingAI` is called during undo.
- All 1416 tests pass (exit 0), check exit 0, build exit 0.

## Scope

- `src/games/othello/OthelloApp.js` — add `this.clearPendingAI();` at the start of `handleUndo()`, after the guard and before `this.state.hintMove = null;`.
- `src/games/othello/OthelloApp.test.js` — add a regression test verifying `clearPendingAI()` is called during `handleUndo()`.

## Steps

1. In `OthelloApp.handleUndo()`, after the existing guard `if (this.state.aiThinking || this.state.gameOver) return;` and before `this.state.hintMove = null;`, add `this.clearPendingAI();` to cancel any pending AI timer.
2. Add a regression test in `OthelloApp.test.js` that:
   - Starts a game.
   - Spies on `clearPendingAI`.
   - Pushes a move so undo has work to do.
   - Calls `handleUndo()`.
   - Asserts the spy was called.
3. Run focused tests: `npx vitest run src/games/othello/OthelloApp.test.js`.
4. Run configured gate: `npm run check && npm test && npm run build`.
5. Update this plan with actual evidence.

## Verification

- Focused: `npx vitest run src/games/othello/OthelloApp.test.js` — expect all pass (including new test).
- Gate: `npm run check` exit 0, `npm test` exit 0 (1416+ tests), `npm run build` exit 0.
- Inspect `git diff --stat` to confirm only OthelloApp.js and OthelloApp.test.js changed.

## Risks

- `clearPendingAI()` calls `clearAITimer()` which checks `this.aiTimer !== null` before clearing — safe no-op if no timer is pending.
- Othello's `clearPendingAI()` also sets `this.state.aiThinking = false` via `setAIThinking(false)` if state exists. Since the guard already returned if `aiThinking` is true, this path only triggers when aiThinking is false — calling setAIThinking(false) is idempotent.
- No side effects that would break undo logic — `clearPendingAI` only cancels timers and resets the AI thinking flag.

## Stop Conditions

- If `clearPendingAI()` has side effects that break the undo replay, stop and report.
- If tests fail after adding the call, revert the source change and report the failure.

## Evidence

### Commands and Exit Codes

1. `npx vitest run src/games/othello/OthelloApp.test.js` — exit 0, 59 tests passed (1 file)
2. `npm run check` — exit 0, 141 modules checked
3. `npm test` — exit 0, 60 files, 1417 tests passed (was 1416, +1 new test)
4. `npm run build` — exit 0, 168 files, 341ms

### Diff

- `src/games/othello/OthelloApp.js`: +1 line (`this.clearPendingAI();` in `handleUndo()`)
- `src/games/othello/OthelloApp.test.js`: +8 lines (new test `handleUndo should call clearPendingAI to cancel pending AI timer`)

### Findings

- `OthelloApp.handleUndo()` at line 358 guarded against `aiThinking` but did NOT cancel a pending AI timer before replaying the board. The `aiThinking` guard only blocks when AI is actively thinking — a scheduled-but-not-yet-fired timer has `aiThinking = false`, so it survives undo.
- Othello was the only game missing the timer cancellation in `handleUndo()`. Chess, Go, and Xiangqi all call `this.clearAITimer()` in their handleUndo (added in rev 54). Shogi calls `this.clearPendingAI()`.
- `OthelloApp.handleResign()` (line 380), `enterSetup()` (line 77), and `dispose()` (line 464) all already call `clearPendingAI()` — `handleUndo()` was the only state-mutating method that omitted it.
- The new test spies on `clearPendingAI`, calls `handleUndo()`, and asserts the spy was called. Test passes.
- No baseline failures. All 1417 tests pass.

