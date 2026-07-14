# Task Plan

## Goal
Fix the pre-existing Shogi AI hard-mode test timeout that blocks the verification gate. The gote direction fix (bfaadda) expanded the legal move tree for gote, making the depth-4 AI search slower. The test now needs a higher timeout and must be in the verify-hermes allowed list.

## Baseline
- HEAD: bfaadda (gote direction fix, already committed)
- Working tree: M src/games/shogi/ai.test.js (timeout 15000), M ai/task-plans/71-shogi-uchifuzume-pawn-drop-checkmate.md
- Pre-existing failure: ai.test.js:42 'hard mode' times out at default 5000ms in full suite
- verify-hermes.ps1 allowed list does NOT include src/games/shogi/ai.test.js

## Scope
- `src/games/shogi/ai.test.js` — change timeout from 15000 to 30000
- `scripts/verify-hermes.ps1` — add `src/games/shogi/ai.test.js` to $allowed array
- `ai/task-plans/71-grok-execution-plan.md` — DELETE (copied review output, not a plan)

## Steps
1. Edit src/games/shogi/ai.test.js line 42: change `{ timeout: 15000 }` to `{ timeout: 30000 }`
2. Edit scripts/verify-hermes.ps1: add `"src/games/shogi/ai.test.js"` to the $allowed array
3. Delete ai/task-plans/71-grok-execution-plan.md
4. Run focused test: `npx vitest run src/games/shogi/ai.test.js` — exit 0, 12 passed
5. Run full gate: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-hermes.ps1` — exit 0, ALL CHECKS PASSED
6. Update ai/task-plans/71-shogi-uchifuzume-pawn-drop-checkmate.md Evidence section with results
7. DO NOT COMMIT — await master approval

## Verification
- `npx vitest run src/games/shogi/ai.test.js` → 12 passed, exit 0
- `npm test` → 60 files, 1456 passed, exit 0
- `npm run check` → 141 modules, exit 0
- `npm run build` → 168 files, exit 0
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-hermes.ps1` → ALL CHECKS PASSED

## Risks
- 30s timeout is generous but necessary — the AI test took 10.3s in the full suite and was timing out at 5s
- Adding ai.test.js to allowed list is a one-time config change; future reviewers should be aware

## Stop Conditions
- If verify-hermes still fails after both fixes, investigate the root cause before retrying
- Do not commit until master approves

## Evidence
### Completed steps with results
1. ✅ Edit ai.test.js line 42: changed `{ timeout: 15000 }` to `{ timeout: 30000 }`
2. ✅ Edit verify-hermes.ps1: added `"src/games/shogi/ai.test.js"` to $allowed array
3. ✅ Deleted ai/task-plans/71-grok-execution-plan.md
4. ✅ Focused test: `npx vitest run src/games/shogi/ai.test.js` → 12 passed, exit 0
5. ✅ Full gate: `powershell -ExecutionPolicy Bypass -File scripts/verify-hermes.ps1` → ALL CHECKS PASSED
   - PASS: node --test (vitest)
   - PASS: npm run check
   - PASS: npm run build
   - PASS: only expected files changed

### Git status (DO NOT COMMIT — awaiting master approval)
- HEAD: bfaadda (pushed)
- Uncommitted: M src/games/shogi/ai.test.js, M scripts/verify-hermes.ps1, M ai/task-plans/71-shogi-uchifuzume-pawn-drop-checkmate.md
- No committed history was created in this attempt

## Master Report
Worker submitted ai.test.js timeout fix (15s) and plan update. Two blockers: (1) ai.test.js not in verify-hermes allowed list — diff check would fail; (2) 15s timeout is marginal (test took 10.3s full suite). Fix is conceptually correct. Worker correctly did not commit. Need to add file to allowed list and increase timeout to 30s.
