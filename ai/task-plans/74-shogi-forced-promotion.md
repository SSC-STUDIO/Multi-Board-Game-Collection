# Task Plan

## Goal
Fix Shogi forced promotion: when a Pawn, Lance, or Knight moves to a position where it would have no legal moves without promotion (last rank for P/L, last 2 ranks for N), the move MUST be a promotion — the non-promotion option should not be generated.

## Baseline
- HEAD: c664914 (fix(gomoku): check exact five-in-a-row before overline in Renju forbidden-move rules)
- Working tree: clean
- Tests: 60 files, 1461 tests pass (npm test exit 0)
- The bug: `getLegalMoves` in `src/games/shogi/rules.js` generates both `promote: true` and `promote: false` move variants for P/L/N pieces reaching the last rank(s), even though `promote: false` is illegal per Shogi rules (piece would have no legal moves).

## Scope
- `src/games/shogi/rules.js` — add `mustPromote` helper and apply it in `getLegalMoves`
- `src/games/shogi/rules.test.js` — add regression tests for forced promotion
- `scripts/verify-hermes.ps1` — add new task plan to allowed files

## Steps
1. Add a `mustPromote(type, side, toRow)` function that returns true when a piece type at a given row would have no legal moves without promotion:
   - Sente: P or L at row 0 → true; N at row 0 or 1 → true
   - Gote: P or L at row 8 → true; N at row 7 or 8 → true
2. In the move generation, when both `promote: true` and `promote: false` would be generated, check `mustPromote`. If true, only push `promote: true`.
3. Add regression tests:
   - Pawn moving to last rank must only generate promotion move (no non-promotion option)
   - Knight moving to last 2 ranks must only generate promotion move
   - Silver moving to promotion zone still generates both options (no forced promotion)

## Verification
- Focused: `npx vitest run src/games/shogi/rules.test.js`
- Full gate: `npm run check`, `npm test`, `npm run build`

## Risks
- **Low risk**: The fix only REMOVES illegal `promote: false` moves. No existing legal moves are affected.
- **AI impact**: The AI search may find slightly different moves since illegal non-promoting moves are no longer in the move list. This is correct behavior.
- **Rollback-safe**: Remove the `mustPromote` check to restore old behavior.

## Stop Conditions
- If any existing test breaks, investigate the specific failure.
- If the full gate fails, do not commit.

## Evidence
- HEAD: c664914, clean working tree at start.
- Root cause: `getLegalMoves` generated both `promote: true` and `promote: false` for P/L/N pieces reaching the last rank(s), but `promote: false` is illegal — those pieces have no legal moves without promotion.
- Fix: Added `mustPromote(type, side, toRow)` helper. Applied at all 3 promotion-generation sites in `getLegalMoves`.
- Tests: 5 new tests (sente P/L/N forced promotion, silver both options, gote P forced promotion). All 45 shogi tests pass (40→45).
- Full gate: check exit 0 (141 modules), test exit 0 (60 files, 1466 tests), build exit 0 (168 files).
- verify-hermes: ALL CHECKS PASSED.
