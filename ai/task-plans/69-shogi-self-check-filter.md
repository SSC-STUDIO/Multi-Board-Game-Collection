# Task Plan

## Goal
Add regression test for getLegalMovesFiltered and update verify-hermes allowlist.

## Baseline
- HEAD: f1473cf
- Working tree: 3 modified + 1 new file
- All gates pass, verify-hermes fails on diff check
- getLegalMovesFiltered imported in rules.test.js but never used

## Scope
- scripts/verify-hermes.ps1: add 4 files to $allowed array
- src/games/shogi/rules.test.js: add regression test for getLegalMovesFiltered

## Steps
1. Add 4 files to $allowed array in verify-hermes.ps1
2. Add test: set up board where moving a piece exposes own king to check — verify getLegalMovesFiltered excludes that move
3. Add test: verify getLegalMovesFiltered includes normal non-self-check moves
4. Run: npx vitest run src/games/shogi/rules.test.js
5. Run: powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File scripts/verify-hermes.ps1

## Verification
- Focused tests pass
- verify-hermes exits 0

## Risks
None — test additions and allowlist update

## Stop Conditions
- If verify-hermes still fails after updates
- If regression test cannot construct a valid self-check scenario

## Evidence
Focused: npx vitest run src/games/shogi/rules.test.js → exit 0, 30 tests (27 + 3 new)
Focused: npx vitest run src/games/shogi/ShogiApp.test.js → exit 0, 31 tests
Full: npm run check → exit 0, 141 modules
Full: npm test → exit 0, 60 files, 1444 tests (was 1441, +3 new)
Full: npm run build → exit 0, 168 files
