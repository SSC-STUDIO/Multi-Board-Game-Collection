# Task Plan

## Goal
Fix Renju forbidden-move rules: a move that creates exactly five-in-a-row in any direction should be a WIN, not a forbidden overline, even if it simultaneously creates six+ (overline) in another direction. Currently `getForbiddenReason` checks `hasOverline` before checking for an exact five, causing false-positive overline forbiddance on winning moves.

## Baseline
- HEAD: 0bd88ec (fix(shogi): apply drop restrictions in hasAnyLegalMove escape search)
- Working tree: clean
- Tests: 60 files, 1459 tests pass (npm test exit 0)
- The bug: `getForbiddenReason` at `src/games/gomoku/rules.js:229` returns `forbiddenOverline` when any direction has count > 5, without first checking if another direction has count === 5 (which is a win and overrides the overline prohibition).

## Scope
- `src/games/gomoku/rules.js` — modify `getForbiddenReason` to check for exact-five win before overline
- `src/games/gomoku/rules.test.js` — add regression tests for the five-vs-overline edge case
- `scripts/verify-hermes.ps1` — add new task plan to allowed files

## Steps
1. In `getForbiddenReason`, after placing the hypothetical stone, check if `checkWin(copy, size, row, col, color)` returns true (exact five-in-a-row exists). If so, return '' (not forbidden — it's a winning move).
2. Add regression tests:
   - "does NOT forbid overline when five-in-a-row also exists" — a move that creates 5 horizontally and 6+ vertically should not be forbidden.
   - "still forbids overline when no five-in-a-row exists" — a move that creates 6+ but no exact 5 should still be forbidden.
3. Run focused tests then full gate.

## Verification
- Focused: `npx vitest run src/games/gomoku/rules.test.js`
- Full gate: `npm run check`, `npm test`, `npm run build`
- verify-hermes.ps1: ALL CHECKS PASSED

## Risks
- **Low risk**: The fix only adds an early-return check before the overline check. Existing overline forbidden tests still pass because those positions don't have an exact five.
- **Rollback-safe**: If the early return is wrong, removing it restores old behavior.

## Stop Conditions
- If any existing forbidden-move test breaks, investigate before proceeding.
- If the full gate fails, do not commit.

## Evidence
- HEAD: 0bd88ec, clean working tree at start.
- Root cause: `getForbiddenReason` checked `hasOverline` (count > 5) before checking for an exact five-in-a-row (count === 5). A move that simultaneously creates a five and an overline was incorrectly rejected as forbidden.
- Fix: Added an early-return check — if any direction has exactly 5 connected stones, the move is a win, not forbidden. The overline check now only triggers when no exact five exists.
- Focused tests: `npx vitest run src/games/gomoku/rules.test.js` → 35 tests passed (including 2 new regression tests).
- Full gate: `npm run check` (141 modules, exit 0), `npm test` (60 files, 1461 tests, exit 0), `npm run build` (168 files, exit 0).
- verify-hermes.ps1: ALL CHECKS PASSED.
- Changed files: `src/games/gomoku/rules.js`, `src/games/gomoku/rules.test.js`, `scripts/verify-hermes.ps1`, `ai/task-plans/73-gomoku-renju-five-over-overline.md`.
