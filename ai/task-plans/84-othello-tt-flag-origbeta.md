# Task Plan
## Goal
Human must commit the approved Othello TT flag fix.
## Baseline
Use the current workspace HEAD and the supplied evidence as baseline.
## Scope
Only edit paths inside the project's allowed_paths; do not touch unrelated local work.
## Steps
1. Inspect git status and the current evidence.
2. Implement: EXECUTE MANUALLY:
git add src/games/othello/ai.js src/games/othello/ai.test.js scripts/verify-hermes.ps1 ai/task-plans/84-othello-tt-flag-origbeta.md && git commit -m 'fix(ai): save origBeta for TT flag in Othello minimax to prevent false ttLower on minimizing nodes' && git push origin master
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
Fill after execution with exact commands, exit codes, and key log lines.

## Master Report
Worker stuck in commit loop (3 identical submissions). Fix approved, all gates pass. Human must manually commit and push.
