# Task Plan: Xiangqi AI Transposition Table Flag Bug

## Goal
Fix the transposition table (TT) flag corruption bug in `src/games/xiangqi/ai.js`
where alpha-narrowing (and beta-narrowing) causes exact scores to be stored as
bounds (ttUpper/ttLower), leading to suboptimal AI move selection.

## Baseline
- HEAD: ae4a5a8 (fix(othello): prevent infinite recursion in AI minimax pass branch at depth 0)
- Working tree: xiangqi/ai.js and ai.test.js modified (source fix + 2 regression tests)
- All gates pass pre-fix: check (141 modules), test (1473), build (168 files)

## Scope
- `src/games/xiangqi/ai.js` — save alphaOrig/betaOrig before search loop, use in flag computation
- `src/games/xiangqi/ai.test.js` — 2 regression tests for TT consistency
- `scripts/verify-hermes.ps1` — add new files to $allowed array
- `ai/task-plans/76-xiangqi-ai-tt-flag.md` — this plan

## Steps
1. In `search()` maximizing branch (red): save `const alphaOrig = alpha` before the loop.
   Change flag line from `value <= alpha` to `value <= alphaOrig`.
2. In `search()` minimizing branch (black): save `const betaOrig = beta` before the loop.
   Change flag line from `value >= beta` to `value >= betaOrig`.
3. Add 2 regression tests verifying TT consistency across repeated searches.
4. Add `src/games/xiangqi/ai.js`, `src/games/xiangqi/ai.test.js`,
   `ai/task-plans/76-xiangqi-ai-tt-flag.md`, `ai/task-plans/76-grok-execution-plan.md`
   to `$allowed` in `scripts/verify-hermes.ps1`.
5. Run focused tests: `npx vitest run src/games/xiangqi/ai.test.js`
6. Run full gate: `verify-hermes.ps1` (includes check, test, build, diff check).

## Verification
- Focused: `npx vitest run src/games/xiangqi/ai.test.js` → 8 tests passed, exit 0
- Full gate: `powershell -File scripts/verify-hermes.ps1` → ALL CHECKS PASSED, exit 0
  - vitest: 60 files, 1475 tests passed
  - check: 141 modules
  - build: 168 files
  - diff: only expected files changed

## Risks
- TT flag fix changes AI move selection behavior. Risk: AI may choose different moves
  than before. Mitigation: the fix makes TT flags correct, so any change is an improvement.
- No schema, save/load, or IPC changes — low risk.

## Stop Conditions
- If any gate fails after the fix, stop and report the failure.
- If the diff includes files outside the allowed scope, stop.

## Evidence

### Implementation
- **File**: `src/games/xiangqi/ai.js` — `search()` function, lines 240-270
- **Change**: Added `const alphaOrig = alpha` before maximizing loop (line 242).
  Changed flag from `value <= alpha` to `value <= alphaOrig` (line 254).
  Added `const betaOrig = beta` before minimizing loop (line 258).
  Changed flag from `value >= beta` to `value >= betaOrig` (line 268).
- **Tests**: `src/games/xiangqi/ai.test.js` — 2 new tests:
  1. "TT flag 正确性：同一位置在不同 alpha/beta 窗口下结果一致" — verifies same position searched twice returns same move
  2. "TT flag 正确性：alpha-narrowing 不污染 exact 标记" — verifies TT cache doesn't lose exact entries

### Commands and exit codes
1. `npx vitest run src/games/xiangqi/ai.test.js` → exit 0, 8 tests passed (6 existing + 2 new)
2. `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-hermes.ps1` → exit 0
   - vitest: 60 files, 1475 tests passed
   - npm run check: 141 modules, PASS
   - npm run build: 168 files, PASS
   - Diff check: PASS (only expected files changed)
   - ALL CHECKS PASSED

### verify-hermes.ps1 $allowed update
Added 4 entries: `src/games/xiangqi/ai.js`, `src/games/xiangqi/ai.test.js`,
`ai/task-plans/76-xiangqi-ai-tt-flag.md`, `ai/task-plans/76-grok-execution-plan.md`
