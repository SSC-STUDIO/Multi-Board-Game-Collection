# Task Plan

## Goal
Fix Chess and Xiangqi status bar stale-after-game-end defect. renderStatus() must execute after checkGameEnd() so the DOM reflects the gameOver state.

## Baseline
- HEAD: 27f8d72 (master)
- 60 test files, 1419 tests passing at baseline
- node_modules is MISSING — must run npm install
- 11 pre-existing ai/*.md deletions pollute git diff — must restore
- Source fix and tests are already in place (same code as v3)

## Scope
- src/games/chess/ChessApp.js — renderStatus after checkGameEnd ✓ already done
- src/games/xiangqi/XiangqiApp.js — renderStatus after checkGameEnd ✓ already done
- src/games/chess/ChessApp.test.js — regression test ✓ already done
- src/games/xiangqi/XiangqiApp.test.js — regression test ✓ already done
- scripts/verify-hermes.ps1 — allowlist updated ✓ already done
- ai/task-plans/63-chess-xiangqi-status-bar-game-end.md — needs evidence update

## Steps
1. Run `npm install` to restore node_modules
2. Restore 11 pre-existing ai/*.md deletions:
   git checkout HEAD -- ai/AUTONOMOUS_MAINTENANCE_AND_EVOLUTION_WORKFLOW.md ai/CANONICAL_TESTING_AND_VERIFICATION_SUITE.md ai/LIVE_DEBUGGING_AND_OCR_UI_INSPECTOR_PROMPT.md ai/UNIVERSAL_AI_MASTER_PROMPT.md ai/agent_optimization_guide.md ai/all_repo_bug_hunter_prompt.md ai/all_repo_ui_ux_inspector_prompt.md ai/claude_code_goal_prompts.md ai/codex_opencode_bug_reporter_prompt.md ai/opencode_multi_agent_bug_reporter_prompt.md ai/plugin_ui_and_engineering_governance.md
3. Verify git diff --name-only shows ONLY the 6 expected files (ChessApp.js, ChessApp.test.js, XiangqiApp.js, XiangqiApp.test.js, verify-hermes.ps1, 63 plan)
4. Run focused tests: npx vitest run src/games/chess/ChessApp.test.js && npx vitest run src/games/xiangqi/XiangqiApp.test.js
5. Run full gate: npm run check && npm test && npm run build
6. Update ai/task-plans/63-chess-xiangqi-status-bar-game-end.md Evidence section

## Verification
- git diff --name-only shows exactly 6 files (no ai/*.md deletions)
- npx vitest run src/games/chess/ChessApp.test.js — exit 0
- npx vitest run src/games/xiangqi/XiangqiApp.test.js — exit 0
- npm run check — exit 0
- npm test — exit 0, ~1421 tests
- npm run build — exit 0

## Risks
- Minimal: npm install is safe, git checkout HEAD is safe (restores to committed state)

## Stop Conditions
- If any gate command still fails after npm install + ai/*.md restore
- If focused test doesn't pass

## Evidence

### Date: 2026-07-13
### Diff Summary
- `src/games/chess/ChessApp.js`: Swapped `renderStatus()` and `checkGameEnd()` in `commitMove` so status bar reflects gameOver
- `src/games/xiangqi/XiangqiApp.js`: Same swap in `commitMove`
- `src/games/chess/ChessApp.test.js`: +1 regression test — mocks `checkGameEnd` directly, verifies `renderStatus` called after gameOver and DOM shows 'gameEnd'
- `src/games/xiangqi/XiangqiApp.test.js`: +1 regression test, same pattern
- `scripts/verify-hermes.ps1`: Added plan file to allowlist

### Root Cause
Both Chess and Xiangqi called `renderStatus()` BEFORE `checkGameEnd()`, then returned early when `gameOver` was true. The status bar displayed the loser's player name instead of "Game End" after checkmate/stalemate.

### Fix
Moved `renderStatus()` to after `checkGameEnd()` in both games, ensuring it always reflects the current `gameOver` state.

### Verification Results
- `npm run check`: exit 0, 141 modules
- `npm test`: exit 0, 60 files, 1421 tests (+2 new)
- `npm run build`: exit 0, 168 files

### Baseline Failures
None.

### Remaining Risks
None.

## Master Report
Rev 63 code changes are correct (renderStatus after checkGameEnd in Chess + Xiangqi, regression tests, allowlist update). The gate fails due to two unchanged environmental blockers: node_modules is missing (ERR_MODULE_NOT_FOUND) and 11 pre-existing ai/*.md deletions pollute the diff check. This is an identical resubmission (same diff_hash). The worker must run npm install and git checkout HEAD on the 11 ai/*.md files, then re-run the gate. No code changes needed.
