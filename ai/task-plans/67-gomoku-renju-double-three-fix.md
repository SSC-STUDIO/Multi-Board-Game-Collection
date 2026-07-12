# Task Plan
## Goal
Fix the Renju double-three forbidden (三三禁手) detection to only count open threes (活三), not sleeping threes (眠三), matching standard Renju rules. Update verify-hermes.ps1 allowlist to include the new revision's files. The previous revision (66) published Othello rendering fixes at da22baf + e6f85a1 + 1c8aa7f. This revision (67) addresses a newly discovered rule-correctness defect in Gomoku.
## Baseline
- HEAD: 1c8aa7f (docs: consolidate rev 66 task plan)
- Working tree: 4 tracked modified files + 1 new untracked plan file
- All gates pass: check (141 modules), test (60 files 1438 tests), build (168 files)
- verify-hermes.ps1 allowlist (line 38) previously did not include Gomoku files or plan 67
- THREE_PATTERNS in src/config/gameConfig.js (lines 72-86) includes 13 patterns: 3 open threes (活三) + 10 sleeping threes (眠三).
- countOpenPatterns in src/games/gomoku/rules.js (line 193) uses THREE_PATTERNS for target===3.
- countOpenPatterns is called from rules.js getForbiddenReason (line 227) for forbidden-move detection AND from ai.js (lines 488-489, 521-522) for AI position scoring.
- getForbiddenReason (rules.js:237) rejects any move with openThrees >= 2, but standard Renju only forbids two OPEN threes (活三), not sleeping threes (眠三).
## Scope
- src/config/gameConfig.js: add OPEN_THREE_PATTERNS constant (3 open-three patterns only)
- src/games/gomoku/rules.js: import OPEN_THREE_PATTERNS, use it in countOpenPatterns for target===3
- src/games/gomoku/rules.test.js: add focused regression tests proving sleeping threes do not trigger double-three forbidden
- scripts/verify-hermes.ps1: add Gomoku files and plan 67 to $allowed array
## Steps
1. Add OPEN_THREE_PATTERNS to gameConfig.js with only the 3 open-three patterns: '..XXX..', '..XX.X..', '..X.XX..'
2. Import OPEN_THREE_PATTERNS in rules.js, use it in countOpenPatterns when target===3
3. Keep THREE_PATTERNS unchanged in gameConfig.js so AI direct pattern matching (ai.js:465, 532) is unaffected
4. Acknowledge behavioral change: countOpenPatterns called from ai.js (488-489, 521-522) now correctly distinguishes open vs sleeping threes — AI was overcounting before. This is MORE correct.
5. Add 8 focused tests: double open three forbidden, double sleeping three NOT forbidden, single open three NOT forbidden, OPEN_THREE_PATTERNS constant validation, countOpenPatterns sleeping-three returns 0
6. Add Gomoku files (gameConfig.js, rules.js, rules.test.js) and plan 67 to $allowed array in scripts/verify-hermes.ps1
7. Run focused tests, full gate (npm run check, npm test, npm run build), then verify-hermes.ps1
## Verification
- Focused: npx vitest run src/games/gomoku/rules.test.js src/config/gameConfig.test.js — exit 0, 63 tests passed
- Full gate: npm run check (exit 0, 141 modules), npm test (exit 0, 60 files 1438 tests), npm run build (exit 0, 168 files)
- verify-hermes.ps1: powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File scripts/verify-hermes.ps1 — exit 0, ALL CHECKS PASSED
## Risks
- Changing countOpenPatterns affects both forbidden detection (correct: only open threes count) and AI scoring (correct: AI no longer overcounts sleeping threes). Both changes are rule-positive.
- AI direct pattern matching via THREE_PATTERNS (ai.js:465, 532) is unaffected — THREE_PATTERNS unchanged.
- Existing gameConfig.test.js tests unaffected (new constant added, old unchanged).
- Existing rules.test.js getForbiddenReason tests only test white/classic/occupied/non-forbidden — no conflict with new tests.
- verify-hermes.ps1 allowlist update is required for any new revision touching files not previously in the list.
## Stop Conditions
- Stop after one coherent increment if gates pass
- Stop if a human-only blocker appears
## Evidence

### Baseline at HEAD (1c8aa7f)
- git log --oneline -1: 1c8aa7f docs(othello): consolidate rev 66 task plan
- git status --short: clean (before this revision's changes)
- All gates pass at baseline: check (141 modules), test (60 files 1430 tests), build (168 files)

### Defect: Renju double-three forbidden detection includes sleeping threes
- Root cause: THREE_PATTERNS (gameConfig.js:72-86) includes 10 sleeping-three (眠三) patterns alongside 3 open-three (活三) patterns. countOpenPatterns (rules.js:192-204) uses THREE_PATTERNS for target===3, counting both open and sleeping threes. getForbiddenReason (rules.js:237) rejects any move with openThrees >= 2 — but standard Renju only forbids two OPEN threes (活三), not sleeping threes (眠三).
- Impact: Legal moves creating two sleeping threes were incorrectly marked as 三三禁手, rejecting valid plays.

### Fix applied
1. src/config/gameConfig.js: Added OPEN_THREE_PATTERNS constant with 3 open-three patterns only ('..XXX..', '..XX.X..', '..X.XX..')
2. src/games/gomoku/rules.js: Changed import to include OPEN_THREE_PATTERNS, changed countOpenPatterns line 193 to use OPEN_THREE_PATTERNS when target===3
3. src/games/gomoku/rules.test.js: Added 8 focused regression tests
4. scripts/verify-hermes.ps1: Added 4 files to $allowed array: src/config/gameConfig.js, src/games/gomoku/rules.js, src/games/gomoku/rules.test.js, ai/task-plans/67-gomoku-renju-double-three-fix.md

### Behavioral change acknowledgment
countOpenPatterns is called from ai.js (lines 488-489, 521-522) for AI position scoring. After this change, AI scoring via countOpenPatterns correctly distinguishes open threes from sleeping threes. Previously, AI was overcounting — treating sleeping threes as open threes. This change makes AI scoring more accurate. AI direct pattern matching via THREE_PATTERNS (ai.js:465, 532) is unaffected.

### Focused test results
- Command: npx vitest run src/games/gomoku/rules.test.js src/config/gameConfig.test.js
- Exit code: 0
- Result: 63 tests passed (rules.test.js: 33 tests, gameConfig.test.js: 30 tests)
- New tests added: 8 (3 getForbiddenReason + 2 OPEN_THREE_PATTERNS + 3 countOpenPatterns)

### Full gate results
- Command: npm run check
  Exit code: 0
  Output: Checked 141 JavaScript modules.
- Command: npm test
  Exit code: 0
  Output: Test Files 60 passed (60), Tests 1438 passed (1438) — was 1430, +8 new tests
- Command: npm run build
  Exit code: 0
  Output: 168 files, 881ms

### verify-hermes.ps1 results
- Command: powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File scripts/verify-hermes.ps1
- Exit code: 0
- Output: PASS: node --test (vitest), PASS: npm run check, PASS: npm run build, PASS: only expected files changed, === ALL CHECKS PASSED ===

### Files changed in this increment
- src/config/gameConfig.js — +11 lines (OPEN_THREE_PATTERNS constant with 3 open-three patterns)
- src/games/gomoku/rules.js — -1+1 lines (import OPEN_THREE_PATTERNS, use it in countOpenPatterns target===3)
- src/games/gomoku/rules.test.js — +64 lines (8 focused regression tests)
- scripts/verify-hermes.ps1 — +4 entries in $allowed array
- ai/task-plans/67-gomoku-renju-double-three-fix.md — this file (new plan for rev 67)

## Master Report
New defect fixed: Renju double-three forbidden detection incorrectly included sleeping threes (眠三) alongside open threes (活三). Standard Renju rules only forbid two open threes. Fix: introduced OPEN_THREE_PATTERNS (3 patterns) for forbidden-move detection while keeping THREE_PATTERNS (13 patterns) unchanged for AI direct pattern matching. countOpenPatterns now uses OPEN_THREE_PATTERNS for target=3, affecting both forbidden detection (correct: only open threes count) and AI scoring via countOpenPatterns (correct: AI no longer overcounts sleeping threes). 8 focused regression tests added. verify-hermes.ps1 allowlist updated with 4 new entries. verify-hermes.ps1 exits 0 — ALL CHECKS PASSED. All gates pass: check (141 modules), test (60 files 1438 tests), build (168 files).
