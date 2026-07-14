# Task Plan

## Goal
Fix Othello AI minimax infinite recursion when depth=0 and current player must pass. The pass branch calls minimax(board, depth-1, ...) unconditionally, which when depth=0 becomes depth=-1. On the recursive call, depth=-1 ≠ 0 and moves > 0, so the base case is never hit — depth goes to -2, -3, ... causing stack overflow.

## Baseline
- HEAD: 4788b84 (fix(othello): recompute passCount in handleUndo)
- Working tree: clean except deleted 75-grok-execution-plan.md
- All tests pass (1471), check 141 modules, build 168 files
- Othello AI minimax at src/games/othello/ai.js lines 137-157

## Root Cause
In `minimax()`, line 137: `if (depth === 0 || moves.length === 0)`. When depth=0 and currentColor has no legal moves (must pass), it enters the pass branch (line 138). The pass branch checks if the opponent also has no moves (game over). If opponent has moves, it calls `minimax(board, depth - 1, ..., !maximizing, aiColor)` at line 154. With depth=0, this becomes depth=-1. On that recursive call, depth=-1 ≠ 0 and opponent has moves, so the condition `depth === 0 || moves.length === 0` is false. The function enters the full search loop with depth=-1, calling children with depth=-2, -3, etc. — infinite recursion / stack overflow.

## Scope
- `src/games/othello/ai.js` — fix pass branch to not recurse when depth=0
- `src/games/othello/ai.test.js` — add regression test

## Steps
1. In the pass branch (line 138-156), add a guard: if `depth === 0`, return static evaluation instead of recursing.
2. The pass-into-search path should only execute when `depth > 0`.
3. Add a regression test that constructs a board where the AI must pass at depth=0 and verifies no stack overflow.
4. Run focused tests: `npx vitest run src/games/othello/ai.test.js`
5. Run full gate: `npm run check`, `npm test`, `npm run build`
6. Update verify-hermes.ps1 $allowed array with new test file if needed (ai.js already in list, ai.test.js already in list).

## Verification
- `npx vitest run src/games/othello/ai.test.js` — focused
- `npm run check` — 141 modules
- `npm test` — 60 files, 1471+ tests
- `npm run build` — 168 files
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-hermes.ps1` — ALL CHECKS PASSED

## Risks
- The fix changes AI behavior when pass occurs at depth=0: instead of searching deeper (which was broken anyway), it returns a static evaluation. This is correct — the previous behavior was a stack overflow, so any non-overflowing result is strictly better.
- TT flag computation: the pass branch stores as ttExact, which is correct since the static evaluation is deterministic.

## Stop Conditions
- Stop after the fix is verified with focused + full gate.
- If the fix introduces new test failures, stop and report.

## Evidence

### Implementation
- **File**: `src/games/othello/ai.js` — minimax function, pass branch (lines 137-165)
- **Change**: Added depth===0 guard in the pass branch (lines 157-163). When depth=0 and current player must pass, return `evaluateBoard(board)` instead of recursing with depth-1 (which caused infinite recursion).
- **Lines added**: 9 (guard clause + static eval return)

### Tests
- **File**: `src/games/othello/ai.test.js` — added 2 regression tests
- **Test 1**: "should not stack-overflow when AI color must pass at a depth-0 leaf" — constructs a near-full board where white has no legal moves but black does, calls getOthelloAIMove(white, easy), expects null (no crash).
- **Test 2**: "should return a move when AI color has moves even if opponent must pass mid-search" — uses standard initial board, verifies normal operation.

### Gates
- `npx vitest run src/games/othello/ai.test.js` → 19 passed (2 new)
- `npm run check` → 141 modules, exit 0
- `npm test` → 60 files, 1473 tests (2 new), exit 0
- `npm run build` → 168 files, exit 0
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-hermes.ps1` → ALL CHECKS PASSED
