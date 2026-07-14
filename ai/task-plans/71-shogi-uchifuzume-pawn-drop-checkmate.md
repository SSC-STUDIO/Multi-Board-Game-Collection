# Rev 71: Shogi gote piece direction fix + uchifuzume regression tests

## Defect
Shogi `getLegalMoves` in `src/games/shogi/rules.js` did not flip the row
component of movement deltas for gote pieces. Deltas (GOLD_DELTAS,
SILVER_DELTAS, KNIGHT_DELTAS, and the Lance sliding direction) are stored
in sente orientation (forward = decreasing row). For gote (forward =
increasing row), the row component must be negated.

The previous code only applied a direction filter for unpromoted P/L/N/S
pieces (`if (dr * forward < 0) continue`), but did not actually flip the
deltas. This meant gote Gold Generals, promoted pieces (PS/PN/PL/PP/DR/DB),
Silvers, Knights, and Lances all moved in the **wrong direction** for gote:
gote Gold attacked upward (toward row 0) instead of downward (toward row 8).

This is a fundamental rules correctness bug affecting all gote piece
movement, check detection, checkmate/stalemate detection, and AI evaluation.

## Fix
Added `const flip = side === "gote" ? -1 : 1;` in `getLegalMoves`.
Applied `const fdr = dr * flip;` to both the non-sliding delta loop and the
sliding direction loop (including the incremental step). Removed the
now-unnecessary direction filter for P/L/N/S since `getRawDeltas` only
returns forward-oriented deltas and the `flip` handles gote direction.

Also updated `hasAnyLegalMove` drop escape check to test all droppable
piece types (P, L, N, S, G, B, R) rather than only Gold.

## Files modified
- `src/games/shogi/rules.js` — direction flip in `getLegalMoves`; `hasAnyLegalMove` all-piece drop check
- `src/games/shogi/rules.test.js` — updated 6 uchifuzume/hasAnyLegalMove tests for correct gote direction; added 1 new regression test

## Test evidence
- Focused: `npx vitest run src/games/shogi/rules.test.js` → 37 passed
- Full suite: `npx vitest run` → 60 files, 1456 tests, all passed
- Lint: `npm run check` → 141 modules, exit 0
- Build: `npm run build` → 168 files, exit 0

## Verification
All gates pass. No regressions detected across 60 test files.
