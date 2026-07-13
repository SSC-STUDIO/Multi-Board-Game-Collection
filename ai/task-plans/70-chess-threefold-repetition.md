# Task Plan

## Goal
Implement the missing threefold repetition draw rule in Chess. The FIDE rules declare a draw when the same position occurs three times. The rules.js header comment documents this feature, but no implementation exists — no position tracking, no `getPositionKey` function, and `checkGameEnd` never checks for repetition. This means games that should end in a draw by repetition never terminate.

## Baseline
- HEAD: d260ec5 (Rev 69 Shogi self-check filter)
- Tree: clean
- Gates: check=141 modules, test=60 files/1444 tests, build=168 files
- Pre-existing: no threefold repetition function exists in rules.js; no positionHistory in state; no repetition check in checkGameEnd

## Scope
- `src/games/chess/rules.js` — add `getPositionKey(board, state)` and `isThreefoldRepetition(history)` functions
- `src/games/chess/state.js` — add `positionHistory: []` to `createChessState`
- `src/games/chess/ChessApp.js` — track position after each move; call `isThreefoldRepetition` in `checkGameEnd`
- `src/games/chess/rules.test.js` — add regression tests for threefold repetition detection
- `scripts/verify-hermes.ps1` — add new/changed files to allowed list

## Steps
1. Read chess/rules.js to find the right insertion point for new functions
2. Implement `getPositionKey(board, state)` — serializes board + turn + castling + enPassant into a string key
3. Implement `isThreefoldRepetition(history)` — counts occurrences of last position in history, returns true if >= 3
4. Add `positionHistory: []` to `createChessState` in state.js
5. In ChessApp.commitMove, after applyMove, push position key to state.positionHistory
6. In ChessApp.checkGameEnd, add repetition check before the fifty-move check
7. Add regression tests in rules.test.js: simple threefold detection, non-repetition when positions differ
8. Update verify-hermes.ps1 allowed list
9. Run focused tests, then full gate

## Verification
- Focused: `npx vitest run src/games/chess/rules.test.js`
- Full: `npm run check && npm test && npm run build`

## Risks
- Position key must capture all state that determines a position (board, turn, castling, enPassant)
- Overly strict key could miss valid repetitions (false negatives); overly loose key could flag non-repetitions (false positives)
- Performance: positionHistory grows by one entry per move — trivial for chess game lengths (<500 moves)

## Stop Conditions
- All tests pass (focused + full gate)
- No functional regressions in existing chess tests
- Threefold repetition correctly detected in the regression test

## Evidence
Focused: npx vitest run src/games/chess/rules.test.js → exit 0, 100 tests (95 + 5 new)
Full: npm run check → exit 0, 141 modules
Full: npm test → exit 0, 60 files, 1449 tests (was 1444, +5 new)
Full: npm run build → exit 0, 168 files
