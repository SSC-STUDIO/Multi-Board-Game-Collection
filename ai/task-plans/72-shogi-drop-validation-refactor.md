# Task Plan

## Goal
Extract drop validation into a reusable helper and add drop restrictions (nifu, uchidokoro) to `hasAnyLegalMove`'s drop-testing loop. Add tests for drop validation and hasAnyLegalMove behavior.

## Baseline
- **Previous fix**: 64d0437 (ai.test.js timeout fix)
- **Existing behavior**: `makeDrop` checked nifu and uchidokoro inline; `hasAnyLegalMove` did not validate any drop restrictions when testing escape moves.

## Scope (files to modify)
- `src/games/shogi/rules.js` — extract `isValidDrop`, update `makeDrop` and `hasAnyLegalMove`
- `src/games/shogi/rules.test.js` — add 3 new tests

## Steps

### Step 1: Extract `isValidDrop` helper
Extract drop validation (nifu, uchidokoro, bounds, occupied cell) from `makeDrop` into a new private `isValidDrop(board, type, side, toRow, toCol)` function. This ensures consistent validation across all call sites.

### Step 2: Update `makeDrop` to use `isValidDrop`
Replace the inline validation in `makeDrop` with a call to `isValidDrop`. The uchifuzume check remains in `makeDrop` since it requires board state search.

### Step 3: Update `hasAnyLegalMove` drop loop
Add `isValidDrop` call in the drop-testing loop (line ~318) so that nifu and uchidokoro restrictions are applied when checking for escape moves. Without this, an illegal pawn drop (e.g., nifu violation) could be incorrectly treated as a legal escape.

### Step 4: Add tests
- `should find drop escape that blocks a rook attack` — positive test confirming drops work
- `should reject nifu pawn drop (same file restriction)` — verifies nifu via makeDrop
- `should reject uchidokoro Lance drop on last rank` — verifies uchidokoro via makeDrop

## Verification
```bash
npx vitest run src/games/shogi/rules.test.js  # 40/40 pass
npm test   # 1459/1459 pass
npm run check   # 141 modules OK
npm run build  # 168 files
```

## Risks
- `isValidDrop` does NOT check uchifuzume (that stays in `makeDrop`), so `hasAnyLegalMove` can still find escape drops that happen to deliver checkmate — this is correct because we only need to know if ANY escape exists.

## Stop Conditions
- If extracting `isValidDrop` causes existing tests to fail → stop and investigate.
- If `hasAnyLegalMove` performance degrades due to additional validation → profile and optimize.

## Evidence
- 3 new tests added (hasAnyLegalMove: 1 positive, nifu: 1, uchidokoro: 1)
- Full test suite: 60 files, 1459 tests pass
- `npm run check`: 141 modules OK
- `npm run build`: 168 files, 413ms
- `isValidDrop` extracted from `makeDrop` and reused in `hasAnyLegalMove` drop loop
- `makeDrop` behavior unchanged (all 32 existing drop tests pass)
