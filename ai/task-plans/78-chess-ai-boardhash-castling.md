# Task Plan: Chess AI boardHash Omits Castling Rights and En Passant

## Goal
Fix the chess AI transposition table hash function (`boardHash` in
`src/games/chess/ai.js`) to include castling rights and en passant target
in the hash key. Currently only board pieces and turn are hashed, causing
TT collisions between positions with identical piece placement but different
castling rights or en passant availability. This leads to incorrect cached
score lookups and suboptimal AI move selection.

## Baseline
- HEAD: 174b216 (fix(go): include row/col in minimaxPly TT key)
- All gates pass: check (141 modules), test (1476 tests, 60 files), build (168 files)
- Chess AI `boardHash` at line 51-65 only hashes `state.turn` + board pieces

## Scope
- `src/games/chess/ai.js` — add castling rights and en passant target to boardHash
- `src/games/chess/ai.test.js` — add regression test verifying TT distinguishes positions by castling rights
- `scripts/verify-hermes.ps1` — add new files to $allowed array
- `ai/task-plans/78-chess-ai-boardhash-castling.md` — this plan

## Steps
1. In `boardHash(board, state)`, after hashing board pieces and turn, add:
   - Hash 4 bits for castling rights (wK, wQ, bK, bQ)
   - Hash en passant target square (row * 8 + col, or -1 if null)
   - Hash halfmove clock (to distinguish 50-move rule states)
2. Add regression test: verify two positions with same pieces but different
   castling rights produce different AI evaluations (or at least don't crash
   / return incorrect cached results).
3. Run focused tests: `npx vitest run src/games/chess/ai.test.js`
4. Run full gate: `npm run check && npm test && npm run build`
5. Run verify-hermes.ps1 to confirm diff scope.

## Verification
- Focused: `npx vitest run src/games/chess/ai.test.js` → all tests pass, exit 0
- Full gate: `npm run check` (141 modules), `npm test` (1476+ tests), `npm run build` (168 files)
- verify-hermes: ALL CHECKS PASSED, exit 0

## Risks
- Adding hash components changes all TT keys, so existing cached positions
  in the same session will not be found. This only affects in-session
  performance, not correctness — the TT is cleared between games via
  `resetTranspositionTable()`.
- No schema, save/load, or IPC changes — low risk.

## Stop Conditions
- If any gate fails after the fix, stop and report the failure.
- If the diff includes files outside the allowed scope, stop.

## Evidence

### Implementation
- **File**: `src/games/chess/ai.js` — `boardHash()` function, lines 51-79
- **Change**: Added castling rights (4 bits packed into one int), en passant
  target square (row*8+col or -1), and halfmove clock to the hash. Previously
  only board pieces and turn were hashed.

### Regression Test
- **File**: `src/games/chess/ai.test.js` — new test case "AI 不因 TT 碰撞在丧失易位权后返回错误走法"
- **Method**: Two positions with identical piece layout but different castling
  rights. Before fix, the second position's TT lookup returned {move:null}
  from the first position's cache. After fix, the hashes differ and the AI
  performs a fresh search, returning a valid move.

### Gate Results (fresh execution)
- `npm run check` → exit 0, 141 modules
- `npm test` → exit 0, 60 files, 1477 tests passed
- `npm run build` → exit 0, 168 files
- `scripts/verify-hermes.ps1` → ALL CHECKS PASSED, exit 0

### Diff Summary
```
 scripts/verify-hermes.ps1               | 3 +-
 src/games/chess/ai.js                   | 14 +++
 src/games/chess/ai.test.js              | 31 +++
 ai/task-plans/78-chess-ai-boardhash-castling.md | (new)
 4 files changed, 48 insertions(+)
```
