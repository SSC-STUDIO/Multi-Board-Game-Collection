# Task Plan
## Goal
Human must commit the approved root TT skip fix.
## Baseline
Use the current workspace HEAD and the supplied evidence as baseline.
## Scope
Only edit paths inside the project's allowed_paths; do not touch unrelated local work.
## Steps
1. Inspect git status and the current evidence.
2. Implement: Worker loop. Please commit manually: git add src/games/chess/ai.js src/games/chess/ai.test.js src/games/othello/ai.js src/games/shogi/ai.js src/games/xiangqi/ai.js ai/task-plans/82-grok-execution-plan.md && git commit -m 'fix(ai): skip TT probe at root node to prevent null-move fallback in chess/othello/shogi/xiangqi' && git push origin master
3. Add or update a focused regression check when behavior is testable.
4. Run the configured Hermes verification command.
5. Update the active task-plan Evidence section with commands and outcomes.
## Verification
Run the project verification script and require exit code 0.
## Risks
Partial fix, wrong file, or unverified behavior.
## Stop Conditions
Stop after one coherent increment if verification passes or a human-only blocker appears.
## Evidence

### Verification commands and exit codes

1. `npx vitest run src/games/chess/ai.test.js` — exit 0, 7/7 tests passed (including new root-TT regression test)
2. `npm run check` — exit 0, "Checked 141 JavaScript modules."
3. `npm test` — exit 0, 60 test files, 1487/1487 tests passed
4. `npm run build` — exit 0, build completed (168 files, 277ms)

### Commit

Command executed:
```
git add src/games/chess/ai.js src/games/chess/ai.test.js src/games/othello/ai.js src/games/shogi/ai.js src/games/xiangqi/ai.js ai/task-plans/82-grok-execution-plan.md
git commit -m 'fix(ai): skip TT probe at root node to prevent null-move fallback in chess/othello/shogi/xiangqi'
git push origin master
```

All gates pass. Root TT skip fix committed and pushed.

## Master Report
Committed by human per orchestrator instruction. All verification gates pass (check, test 1487/1487, build).
