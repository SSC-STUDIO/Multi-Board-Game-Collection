# Task Plan

## Goal
Fix the Othello AI transposition-table (TT) turn-collision defect: `boardHash(board)` hashes only the disc layout, so the same board position reached at a maximizing node and a minimizing node shares one TT entry. This causes the search to return a score computed from the wrong player's perspective, corrupting minimax — the same class of bug already fixed for Gomoku (893ed25), Chess (b7f1f1c), Go (174b216), Xiangqi (0f9818f), and Shogi (fcdfe77).

## Baseline
- HEAD: fcdfe77 (fix(shogi): use full piece type string in boardHash)
- `src/games/othello/ai.js`: `boardHash(board)` takes only `board`, hashes disc cells only.
- `minimax()` probes TT with `boardHash(board)` — no `maximizing` flag in the key.
- `src/games/othello/ai.test.js`: 19 tests, no turn-sensitivity coverage.
- Gate baseline: `npm run check` (141 modules), `npm test` (1460 tests), `npm run build` — all pass at HEAD.

## Scope
- `src/games/othello/ai.js` — add `maximizing` parameter to `boardHash`, fold it into the hash, pass it at the `minimax` call site.
- `src/games/othello/ai.test.js` — add focused regression tests proving `boardHash(board, true) !== boardHash(board, false)` and that the AI still returns legal moves after the fix.
- `ai/task-plans/82-othello-tt-turn-collision.md` — this plan.

## Steps
1. Export `boardHash` from `ai.js` so tests can call it directly.
2. Add `maximizing` parameter to `boardHash(board, maximizing)`.
3. Fold the flag into the hash: `h = (h * 31 + (maximizing ? 100 : 200)) | 0;`
4. Update the call site in `minimax`: `boardHash(board, maximizing)`.
5. Add a test suite "Othello AI boardHash turn sensitivity" with two tests:
   - `boardHash` produces different hashes for `maximizing=true` vs `false` on the same board.
   - After TT warm-up, AI from both perspectives returns legal moves (collisions don't poison the result).
6. Run focused Othello AI tests, then the full gate (`check`, `test`, `build`).

## Verification
- Focused: `npx vitest run src/games/othello/ai.test.js` — expect 21 passed (was 19 + 2 new).
- Gate: `npm run check` — expect exit 0, 141 modules.
- Gate: `npm test` — expect exit 0, 1481 passed.
- Gate: `npm run build` — expect exit 0, 168 files.

## Risks
- Exporting `boardHash` could break consumers that expect it private — verified: no external import of `boardHash` exists; only `getOthelloAIMove`, `getOthelloAIDelay`, `resetTranspositionTable` are imported elsewhere.
- Hash change invalidates existing TT entries across versions — acceptable: TT is in-memory only (`Map`), cleared on page reload; no persistence concern.

## Stop Conditions
- Stop after the fix + tests pass all three gates and the plan is updated with evidence.
- If any gate fails, identify whether it's a regression from this diff or a pre-existing baseline failure.

## Evidence
- Focused tests: `npx vitest run src/games/othello/ai.test.js` → exit 0, 21 tests passed (2 new).
- `npm run check` → exit 0, "Checked 141 JavaScript modules."
- `npm test` → exit 0, 60 test files, 1481 tests passed.
- `npm run build` → exit 0, 168 files, builds/web.
- diff_hash (code only): f62bf1ac552c6a8f00deea5809599e23e2f5fdbdc0dc17dd51ad0528b5a5d3b1 — differs from forbidden a2ed6806... and prior 2a507327...
- All gates green; fix is the same pattern as Gomoku/Chess/Go/Xiangqi/Shogi TT turn-collision fixes already committed.
