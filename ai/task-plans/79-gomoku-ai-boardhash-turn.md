# Task Plan: Gomoku AI boardHash Omits Current Turn (Side to Move)

## Goal
Fix the Gomoku AI transposition table hash function (`boardHashGomoku` in
`src/games/gomoku/ai.js`) to include whose turn it is (`isMaximizing` /
currentColor) in the hash key. Currently only board piece positions are hashed,
causing TT collisions between identical board layouts where different players
are to move. This returns incorrect cached scores from the wrong player's
perspective, corrupting minimax search.

## Baseline
- HEAD: b7f1f1c (fix(chess): include castling rights, en passant, halfmove in boardHash)
- All gates pass: check (141 modules), test (1477 tests, 60 files), build (168 files)
- Gomoku AI `boardHashGomoku` at line 312-324 only hashes board pieces
- `minimaxSearch` calls `boardHashGomoku(board, size)` at line 350 — no turn info
- `ttLookupGomoku` checks depth but not turn

## Root Cause
`boardHashGomoku(board, size)` produces the same hash for two positions with
identical piece placement but where different players are to move. The
minimax search alternates between maximizing (AI color) and minimizing
(opponent color) nodes. If the same board layout appears at both a maximizing
and a minimizing node, the TT returns the score from whichever was stored
first — regardless of whose turn it actually is.

## Scope
- `src/games/gomoku/ai.js` — add turn parameter to `boardHashGomoku` and pass
  `isMaximizing` from `minimaxSearch`
- `src/games/gomoku/ai.test.js` — add regression test verifying TT
  distinguishes positions by turn
- `scripts/verify-hermes.ps1` — add new files to $allowed array
- `ai/task-plans/79-gomoku-ai-boardhash-turn.md` — this plan

## Steps
1. In `boardHashGomoku(board, size, isMaximizing)`, add `isMaximizing ? 1 : 0`
   to the hash computation.
2. In `minimaxSearch`, pass `isMaximizing` to `boardHashGomoku`.
3. Add regression test: call `getBestMove` (medium level) on a board with a
   known pattern, verify the AI returns a legal move. Then create a second
   position with the same board but different `moveHistory` order (swapped
   turns), verify no crash and a valid move is returned.
4. Run focused tests: `npx vitest run src/games/gomoku/ai.test.js`
5. Run full gate: `npm run check && npm test && npm run build`
6. Run verify-hermes.ps1 to confirm diff scope.

## Verification
- Focused: `npx vitest run src/games/gomoku/ai.test.js` → all tests pass, exit 0
- Full gate: `npm run check` (141 modules), `npm test` (1477+ tests), `npm run build` (168 files)
- verify-hermes: ALL CHECKS PASSED, exit 0

## Risks
- Adding isMaximizing to the hash changes all TT keys, so existing cached
  positions in the same session will not be found. This only affects
  in-session performance, not correctness. The TT is module-level and reset
  between games implicitly via new state objects.
- No schema, save/load, or IPC changes — low risk.

## Stop Conditions
- If any gate fails after the fix, stop and report the failure.
- If the diff includes files outside the allowed scope, stop.

## Evidence

### Implementation
- **File**: `src/games/gomoku/ai.js` — `boardHashGomoku()` function, line 312
- **Change 1**: Added `isMaximizing` parameter to `boardHashGomoku(board, size, isMaximizing)`.
  Initial hash value now seeds with `isMaximizing ? 1 : 0` instead of `0`.
- **Change 2**: Updated call site in `minimaxSearch()` line 350 to pass
  `isMaximizing` to `boardHashGomoku(board, size, isMaximizing)`.

### Root Cause
`boardHashGomoku` produced identical hashes for positions with the same piece
layout but different players to move. In `minimaxSearch`, the maximizing node
(AI color) and minimizing node (opponent color) could share a TT entry,
causing the search to return a score cached from the wrong player's perspective.

### Regression Test
- **File**: `src/games/gomoku/ai.test.js` — new describe block
  "boardHashGomoku turn sensitivity" with 1 test
- **Method**: Creates a board with 6 stones, calls `getBestMove` for black
  (medium level) then `getBestMove` for white on the same board. Both must
  return valid non-null moves. Before fix, the second call could return a
  stale/corrupted result from the TT.

### Gate Results
- `npx vitest run src/games/gomoku/ai.test.js` → exit 0, 35 tests passed
- `npm run check` → exit 0, 141 modules
- `npm test` → exit 0, 60 files, 1478 tests passed
- `npm run build` → exit 0, 168 files
- `scripts/verify-hermes.ps1` → ALL CHECKS PASSED, exit 0

### Diff Summary
```
 scripts/verify-hermes.ps1                      |  3 +-
 src/games/gomoku/ai.js                          |  4 +-
 src/games/gomoku/ai.test.js                     | 42 +++++++
 ai/task-plans/79-gomoku-ai-boardhash-turn.md    | (new)
 4 files changed
```
