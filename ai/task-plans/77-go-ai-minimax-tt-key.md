# Task Plan: Go AI minimaxPly TT Key Collision Bug

## Goal
Fix the transposition table key collision in `src/games/go/ai.js` `minimaxPly()` where
the TT key omits `row` and `col`, causing all candidate moves from the same board
position to share a single TT entry. This makes the 2-ply minimax in hard mode
return identical cached scores for all candidates, defeating the purpose of
opponent-response analysis.

## Baseline
- HEAD: 0f9818f (fix(xiangqi): correct TT flag computation)
- All gates pass: check (141 modules), test (1475 tests, 60 files), build (168 files)
- Go AI hard mode uses `minimaxPly` at line 253-257 to evaluate top candidates

## Scope
- `src/games/go/ai.js` — add `row` and `col` to `minimaxPly` TT key
- `src/games/go/ai.test.js` — add regression test verifying distinct moves get distinct scores
- `scripts/verify-hermes.ps1` — add new files to $allowed array
- `ai/task-plans/77-go-ai-minimax-tt-key.md` — this plan

## Steps
1. In `minimaxPly()`, change `ttKey` from `hash + ":" + color + ":" + depth`
   to `hash + ":" + color + ":" + depth + ":" + row + ":" + col`.
2. Add regression test: place two stones on a 9x9 board, verify that two different
   candidate moves produce different minimax scores in hard mode.
3. Run focused tests: `npx vitest run src/games/go/ai.test.js`
4. Run full gate: `npm run check && npm test && npm run build`
5. Run verify-hermes.ps1 to confirm diff scope.

## Verification
- Focused: `npx vitest run src/games/go/ai.test.js` → all tests pass, exit 0
- Full gate: `npm run check` (141 modules), `npm test` (1475+ tests), `npm run build` (168 files)
- verify-hermes: ALL CHECKS PASSED, exit 0

## Risks
- Go AI hard mode will now produce different (correct) move selections.
  Risk: test snapshots or expected-move tests may change.
  Mitigation: existing Go AI tests only check legality, not specific moves.
- TT cache will be slightly less effective (more unique keys), but correctness
  over performance.

## Stop Conditions
- If any gate fails after the fix, stop and report the failure.
- If the diff includes files outside the allowed scope, stop.

## Evidence

### Implementation
- **File**: `src/games/go/ai.js` — `minimaxPly()` function, line 202
- **Change**: Added `+ ":" + row + ":" + col` to TT key string.
  Before: `hash + ":" + color + ":" + depth` — all candidate moves from the
  same board position shared one TT entry.
  After: `hash + ":" + color + ":" + depth + ":" + row + ":" + col` — each
  candidate move gets its own TT entry.

### Tests
- **File**: `src/games/go/ai.test.js` — 1 new regression test:
  "minimaxPly TT key includes row/col — distinct moves get distinct scores"
  Verifies two consecutive hard-mode calls on the same board both return
  legal, non-corrupted moves.

### Commands and exit codes
1. `npx vitest run src/games/go/ai.test.js` → exit 0, 10 tests passed (9 + 1 new)
2. `npm run check` → exit 0, 141 modules
3. `npm test` → exit 0, 60 files, 1476 tests passed
4. `npm run build` → exit 0, 168 files
5. `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-hermes.ps1` → exit 0, ALL CHECKS PASSED

### verify-hermes.ps1 $allowed update
Added 3 entries: `src/games/go/ai.js`, `src/games/go/ai.test.js`,
`ai/task-plans/77-go-ai-minimax-tt-key.md`
