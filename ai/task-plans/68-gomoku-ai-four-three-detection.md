# Task Plan

## Goal
Update verify-hermes.ps1 allowed file list to include src/games/gomoku/ai.js for this revision.

## Baseline
- HEAD: 3368097
- Working tree: 2 modified + 1 new file
- All gates pass, only diff check fails

## Scope
- scripts/verify-hermes.ps1: add 1 file to $allowed array

## Steps
1. Read scripts/verify-hermes.ps1 to find the $allowed array
2. Add 'src/games/gomoku/ai.js' to the array
3. Run: powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File scripts/verify-hermes.ps1
4. Confirm exit 0 and ALL CHECKS PASSED

## Verification
- verify-hermes.ps1 exits 0

## Risks
None — allowlist update only

## Stop Conditions
- If verify-hermes still fails after update

## Evidence
(to be filled after execution)

## Master Report
Gomoku AI four-three detection fix is correct. isFourThree now uses Math.max(openThrees, openThreePatterns) matching isDoubleThree's pattern. 2 regression tests added (1441 total). All gates pass. Only blocker: verify-hermes allowlist needs ai.js added.
