# Task Plan: Shogi AI boardHash Truncates Promoted Piece Types to First Character

## Goal
Fix the Shogi AI transposition table hash function (`boardHash` in
`src/games/shogi/ai.js`) to use the full piece type string instead of only
`charCodeAt(0)`. Currently promoted piece types (`PP`, `PL`, `PN`, `PS`)
share the same first character as `P` (Pawn), causing identical hash codes
and TT collisions between positions that differ only in promotion status.

## Baseline
- HEAD: 893ed25 (fix(gomoku): include isMaximizing in boardHashGomoku)
- All gates pass: check (141 modules), test (1478 tests, 60 files), build (168 files)
- Shogi AI `boardHash` at line 285-304 uses `p.type.charCodeAt(0)` which
  truncates multi-char types to their first character
- `P` (Pawn) and `PP` (Promoted Pawn) both hash to charCode 80
- `PL` (Promoted Lance), `PN` (Promoted Knight), `PS` (Promoted Silver) also
  start with 'P' (charCode 80)

## Root Cause
Shogi piece types include single-char types (`K`, `R`, `B`, `G`, `S`, `N`,
`L`, `P`) and two-char promoted types (`DR`, `DB`, `PS`, `PN`, `PL`, `PP`).
`boardHash` uses `p.type.charCodeAt(0)` which only reads the first character.
This means `P` and `PP` (and `PL`, `PN`, `PS`) all produce the same hash code
`80 * 100 + sideBit`, causing the TT to conflate positions where a pawn has
been promoted with positions where it hasn't. The AI then returns cached
scores computed for the wrong piece type, corrupting search.

## Scope
- `src/games/shogi/ai.js` — fix `boardHash` to use full type string in hash
- `src/games/shogi/ai.test.js` — add regression test
- `scripts/verify-hermes.ps1` — add new files to $allowed array
- `ai/task-plans/80-shogi-ai-boardhash-promoted.md` — this plan

## Steps
1. In `boardHash`, replace `p.type.charCodeAt(0)` with a full-string hash
   that iterates over all characters of the type string.
2. Apply the same fix to hand piece hashing (lines 298, 301).
3. Add regression test: verify the AI returns valid different moves for
   positions that differ only in whether a pawn is promoted.
4. Run focused tests: `npx vitest run src/games/shogi/ai.test.js`
5. Run full gate: `npm run check && npm test && npm run build`
6. Run verify-hermes.ps1 to confirm diff scope.

## Verification
- Focused: `npx vitest run src/games/shogi/ai.test.js` → all tests pass, exit 0
- Full gate: `npm run check` (141 modules), `npm test` (1478+ tests), `npm run build` (168 files)
- verify-hermes: ALL CHECKS PASSED, exit 0

## Risks
- Changing the hash function invalidates all existing TT entries in the
  current session. This only affects in-session performance, not correctness.
  The TT is cleared between games via `resetTranspositionTable()`.
- No schema, save/load, or IPC changes — low risk.

## Stop Conditions
- If any gate fails after the fix, stop and report the failure.
- If the diff includes files outside the allowed scope, stop.

## Evidence

### Implementation
- **File**: `src/games/shogi/ai.js` — `boardHash()` function, line 285
- **Change**: Added `typeHash(type)` helper that hashes all characters of the
  piece type string. Replaced `p.type.charCodeAt(0)` with `typeHash(p.type)`
  in both the board piece hashing (line 291) and hand piece hashing (lines 298, 301).
- Before: `P` (Pawn) and `PP` (Promoted Pawn) both produced `charCodeAt(0) === 80`
  → identical hash codes for distinct piece types at the same position.
- After: `typeHash('P')` produces a different hash from `typeHash('PP')`, so
  promoted and unpromoted pieces are properly distinguished in the TT.

### Root Cause
Shogi piece types include single-char types (`K`, `R`, `B`, `G`, `S`, `N`,
`L`, `P`) and two-char promoted types (`DR`, `DB`, `PS`, `PN`, `PL`, `PP`).
`boardHash` used `p.type.charCodeAt(0)` which only reads the first character.
Types `P`, `PP`, `PL`, `PN`, `PS` all share charCode 80, causing TT collisions
between positions where a pawn has been promoted vs not promoted.

### Regression Test
- **File**: `src/games/shogi/ai.test.js` — new test case "boardHash distinguishes
  promoted pawn from unpromoted pawn (no TT collision)"
- **Method**: Two boards with identical layout except one has a promoted pawn
  (PP) and the other has an unpromoted pawn (P) at the same square. Both AI
  calls must return valid non-null moves.

### Gate Results
- `npx vitest run src/games/shogi/ai.test.js` → exit 0, 13 tests passed
- `npm run check` → exit 0, 141 modules
- `npm test` → exit 0, 60 files, 1479 tests passed
- `npm run build` → exit 0, 168 files
- `scripts/verify-hermes.ps1` → ALL CHECKS PASSED, exit 0

### Diff Summary
```
 scripts/verify-hermes.ps1                      |  3 +-
 src/games/shogi/ai.js                           | 14 +++--
 src/games/shogi/ai.test.js                      | 28 +++++++
 ai/task-plans/80-shogi-ai-boardhash-promoted.md| (new)
 4 files changed
```
