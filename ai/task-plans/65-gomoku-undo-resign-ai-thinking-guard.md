# Task Plan — Rev 65: Fix Gomoku undo/resign missing aiThinking guard

## Goal
Fix Gomoku's `GameController.undo()` and `GameController.resign()` so they reject actions during AI thinking, matching the guard pattern used by all other games (Chess, Go, Othello, Xiangqi, Junqi).

## Baseline
- Commit: dfa26df (Rev 64, Junqi renderStatus fix)
- Branch: master, clean working tree
- All gates pass: `npm run check` (0), `npm test` (0, 60 files, 1423 tests), `npm run build` (0)
- `GameController.undo()` at line 368: only checks `moveHistory.length === 0`, no `aiThinking`/`gameOver` guard
- `GameController.resign()` at line 539: only checks `gameOver`, no `aiThinking` guard
- All other games guard with `if (this.state.aiThinking || this.state.gameOver) return;` at the top of their undo/resign methods

## Scope
- `src/app/controllers/GameController.js` — Add `aiThinking` guard to `undo()` and `resign()`
- `src/app/controllers/GameController.test.js` — Add regression tests for undo/resign during AI thinking
- `scripts/verify-hermes.ps1` — Add changed files to allowlist
- `ai/task-plans/65-gomoku-undo-resign-ai-thinking-guard.md` — This plan

## Root Cause
Gomoku's `GameController` was written without the `aiThinking` guard that all other games have. This allows:
1. Undo during AI thinking — race condition: AI move could land while undo is replaying state
2. Resign during AI thinking — resigns against a board where AI hasn't placed yet, producing incorrect result

## Steps
1. Add `aiThinking` guard to `undo()`: play error sound + show message, then return
2. Add `aiThinking` guard to `resign()`: play error sound + show message, then return
3. Add test: `undo()` during aiThinking shows error and does not modify state
4. Add test: `resign()` during aiThinking shows error and does not set gameOver
5. Update verify-hermes.ps1 allowlist
6. Run focused tests, then full gate

## Verification
- Focused: `npx vitest run src/app/controllers/GameController.test.js`
- Full gate: `npm run check && npm test && npm run build`

## Risks
- Low risk: adding a guard only prevents actions that should never have been allowed
- Existing tests don't set `aiThinking = true`, so they won't be affected

## Stop Conditions
- If existing tests fail after adding the guard
- If the guard pattern doesn't match the project's established convention

## Evidence

### Date: 2026-07-14 (UTC+8: 03:14)
### Diff Summary
- `src/app/controllers/GameController.js`: Added `aiThinking` guard to `undo()` and `resign()`. Added explicit `gameOver` guard to `undo()` (previously only checked `moveHistory.length`). Both guards play error sound + show message and return early.
- `src/app/controllers/GameController.test.js`: +3 regression tests: undo during aiThinking, undo during gameOver, resign during aiThinking. All verify error sound, message key, and state unchanged.
- `scripts/verify-hermes.ps1`: Added GameController.js, GameController.test.js, and plan file to allowlist.

### Root Cause
Gomoku's `GameController` was written without the `aiThinking` guard that all other games (Chess, Go, Othello, Xiangqi, Junqi) have at the top of their undo/resign methods. `undo()` also lacked a `gameOver` guard — undoing a winning move was possible. This allows race conditions (AI move landing during undo replay) and incorrect game endings (resign during AI turn).

### Fix
Added `if (this.app.state.aiThinking)` guard to both `undo()` and `resign()`, returning early with error sound + message. Added explicit `if (this.app.state.gameOver)` guard to `undo()` matching the pattern used by all other games.

### Verification Results
- `npx vitest run src/app/controllers/GameController.test.js`: exit 0, 62 tests (was 59, +3 new)
- `npm run check`: exit 0, 141 modules
- `npm test`: exit 0, 60 files, 1426 tests (+3 new)
- `npm run build`: exit 0, 168 files

### Baseline Failures
None.

### Remaining Risks
None. The new guards only prevent actions that should never have been allowed. Existing tests don't set `aiThinking = true` so they are unaffected.
