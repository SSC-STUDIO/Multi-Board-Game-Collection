# Task Plan — Rev 64: Fix Junqi status bar not showing 'Game End' after flag capture / annihilation

## Goal
Fix Junqi's `commitClassicMove` and `commitFlipMove` so that `renderStatus()` is called AFTER `finishIfWinner()` sets `gameOver=true`. Currently `renderStatus()` runs before `finishIfWinner()`, so the status bar shows the stale player name instead of "Game End" when a game ends by flag capture, annihilation, or stalemate.

## Baseline
- Latest commit: 23020e3 (rev 63, Chess+Xiangqi same-class fix)
- Working tree: clean except stale `ai/task-plans/61-grok-execution-plan.md` (untracked, not ours)
- Baseline gate: npm run check (141 modules), npm test (60 files, 1421 tests), npm run build (168 files) — all exit 0
- JunqiApp.js `renderStatus()` at line 516 checks `this.state.gameOver` and shows `i18n.t('gameEnd')` — but in `commitClassicMove` (line 243) and `commitFlipMove` (line 274), `renderStatus()` is called BEFORE `finishIfWinner()` which sets `gameOver=true`
- Same defect class as Shogi rev 62, Othello rev 58, Chess+Xiangqi rev 63

## Scope
- `src/games/junqi/JunqiApp.js` — swap renderStatus/finishIfWinner order in 2 methods
- `src/games/junqi/JunqiApp.test.js` — add 2 regression tests (classic + flip)
- `scripts/verify-hermes.ps1` — add plan file to allowlist
- `ai/task-plans/64-junqi-status-bar-game-end.md` — this plan

## Steps
1. In `commitClassicMove` (line 243-245): move `this.renderStatus()` from before `this.finishIfWinner(...)` to after it (after line 244, before line 245)
2. In `commitFlipMove` (line 273-275): move `this.renderStatus()` from before `this.finishIfWinner(...)` to after it
3. Add regression test for `commitClassicMove`: mock `finishIfWinner` to set `gameOver=true`, verify `renderStatus` called after, verify DOM shows 'gameEnd'
4. Add regression test for `commitFlipMove`: same pattern
5. Update `scripts/verify-hermes.ps1` allowlist with plan file
6. Run focused tests + full gate

## Verification
- `npx vitest run src/games/junqi/JunqiApp.test.js`
- `npm run check`
- `npm test`
- `npm run build`

## Risks
- Low risk: moving `renderStatus()` after `finishIfWinner()` means it runs with `gameOver=true`, which causes `renderStatus()` to show 'gameEnd' text — this is the desired behavior
- If `finishIfWinner` returns early (no winner), `renderStatus()` still runs showing the current player — same as before

## Stop Conditions
- If any existing Junqi test fails after the swap
- If focused test doesn't pass

## Evidence

### Date: 2026-07-13 (UTC+8: 2026-07-14 02:04)
### Diff Summary
- `src/games/junqi/JunqiApp.js`: In `commitClassicMove`, swapped `renderStatus()` and `finishIfWinner()` so renderStatus runs after gameOver is set. In `commitFlipMove`, extracted `finishIfWinner` result to `hasWinner` var, moved `renderStatus()` after it, early-return on `hasWinner`.
- `src/games/junqi/JunqiApp.test.js`: +3 regression tests (classic game-end, flip game-end, plus restored existing __reenter/hideRoot tests). Both new tests mock `finishIfWinner` directly, verify `renderStatus` called after gameOver and DOM shows 'gameEnd'.
- `scripts/verify-hermes.ps1`: Added JunqiApp.js, JunqiApp.test.js, and plan file to allowlist.

### Root Cause
Both `commitClassicMove` and `commitFlipMove` called `renderStatus()` BEFORE `finishIfWinner()`, then returned without calling `renderStatus()` again. Status bar showed stale player name instead of "Game End" after flag capture / annihilation / stalemate.

### Fix
Moved `renderStatus()` to after `finishIfWinner()` in both methods.

### Verification Results
- `npx vitest run src/games/junqi/JunqiApp.test.js`: exit 0, 20 tests (was 17, +3 new)
- `npm run check`: exit 0, 141 modules
- `npm test`: exit 0, 60 files, 1423 tests (+2 new)
- `npm run build`: exit 0, 168 files

### Baseline Failures
None.

### Remaining Risks
None.
