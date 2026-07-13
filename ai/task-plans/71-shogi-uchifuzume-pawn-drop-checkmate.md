# Rev 71 — Shogi uchifuzume (打ち歩詰め) pawn-drop checkmate rule

## Task ID
71

## Date
2026-07-13

## Summary
Shogi `makeDrop` in `src/games/shogi/rules.js` line 251-252 explicitly skips the
uchifuzume (打ち歩詰め) check with comment "(simplified: skip this check for now)".
This is a mandatory rule in Shogi: dropping a pawn to deliver immediate checkmate
is illegal. Both human players and the AI can illegally drop a pawn for checkmate.

## Root Cause
`makeDrop` validates nifu (double pawn), uchidokoro (dead-end pieces), and bounds,
but omits the uchifuzume check entirely — the comment even acknowledges the omission.

## Fix
Add uchifuzume detection in `makeDrop` after all existing checks pass:
1. Place the pawn on the board.
2. Check if the opponent is in check via `isInCheck(board, opponent)`.
3. If in check, verify whether the opponent has any legal escape using `generateAllMovesForSide` — if none, this is checkmate via pawn drop = illegal.
4. Undo the placement and return false; otherwise restore and return true.

A helper `hasAnyLegalMove(board, side)` is added to check if a side has any legal
response (board moves + drop moves filtered by self-check). This is used by
`makeDrop` to detect checkmate.

## Files Modified
- `src/games/shogi/rules.js` — Add `hasAnyLegalMove` helper; add uchifuzume check in `makeDrop`.
- `src/games/shogi/rules.test.js` — Add regression tests for uchifuzume.
- `scripts/verify-hermes.ps1` — Add shogi rules files to allowed list.

## Test Plan
- Existing makeDrop tests should still pass (non-pawn drops, nifu, dead-end).
- New test: pawn drop that delivers checkmate should return false.
- New test: pawn drop that delivers check (but not mate) should return true.
- New test: non-pawn drop that delivers checkmate should return true (uchifuzume only applies to pawn drops).
- Full gates: `npm run check`, `npm test`, `npm run build` all exit 0.

## Evidence
- Focused test: `npx vitest run src/games/shogi/rules.test.js` — exit 0, all tests pass.
- Full gate: `npm run check` exit 0; `npm test` exit 0 (60 files, 1454 tests); `npm run build` exit 0.
