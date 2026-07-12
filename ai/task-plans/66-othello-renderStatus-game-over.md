# Task Plan — Rev 66: Fix Othello renderStatus not showing 'Game End' after game over

## Goal
Fix Othello's `renderStatus()` so it shows "Game End" when `this.state.gameOver` is true, matching all 5 other games (Chess, Xiangqi, Go, Shogi, Junqi).

## Root Cause
Othello's `renderStatus()` (line 231-237) always renders the current player label + AI thinking text. It never checks `this.state.gameOver`. After game end (board full, double pass, or resign), the status bar still shows the current player name instead of "Game End".

## Defect Evidence
All 5 other games check `gameOver` in `renderStatus()`:
- Chess: `this.state.gameOver ? i18n.t('gameEnd') : playerLabel(this.state.turn)` (line 507-509)
- Go: `this.state.gameOver ? i18n.t('gameEnd') : playerLabel(this.state.currentPlayer)` (line 497-499)
- Shogi: `if (this.state.gameOver) { el.textContent = i18n.t('gameEnd'); return; }` (line 193-196)
- Xiangqi: same pattern as Chess
- Junqi: `if (this.state.gameOver) game.currentPlayer.textContent = i18n.t('gameEnd')` (line 517)

Othello (line 231-237): NO gameOver check — just shows `label + aiLabel`.

## Fix
Add gameOver check at the top of `renderStatus()`:
```js
renderStatus() {
    const el = this.dom?.game?.status;
    if (!el || !this.state) return;
    if (this.state.gameOver) {
        el.textContent = i18n.t('gameEnd') || 'Game End';
        return;
    }
    const label = this.state.currentPlayer === "black" ? "\u26ab Black" : "\u26aa White";
    const aiLabel = this.state.aiThinking ? " \u2014 AI thinking\u2026" : "";
    el.textContent = label + aiLabel;
}
```

## Test Plan
1. Add test: `renderStatus` shows 'gameEnd' when `gameOver` is true
2. Add test: `renderStatus` shows player label when `gameOver` is false (existing test, keep)
3. Add test: After `commitMove` triggers game end, `renderStatus` is called and shows game end

## Gate
- `npm run check` exit 0 ✅ (141 modules)
- `npm test` exit 0 ✅ (60 files, 1429 tests, +3 from prior 1426)
- `npm run build` exit 0 ✅ (168 files)

## Evidence

### Date: 2026-07-14 (UTC+8: 04:20)
### Diff Summary
- `src/games/othello/OthelloApp.js`: Added `gameOver` check at top of `renderStatus()` — shows `i18n.t('gameEnd')` when game over, matching Chess/Xiangqi/Go/Shogi/Junqi pattern. +4 lines.
- `src/games/othello/OthelloApp.test.js`: +3 regression tests: (1) `renderStatus` shows 'gameEnd' when `gameOver=true`, (2) player label NOT shown when `gameOver=true`, (3) `commitMove` triggering game end → `renderStatus` shows 'gameEnd'. +27 lines.
- `scripts/verify-hermes.ps1`: No change needed — OthelloApp.js and OthelloApp.test.js already in allowlist.

### Gate Results at dfa26df..5792016
- Focused: `npx vitest run src/games/othello/OthelloApp.test.js` — 63 tests pass (was 60, +3)
- Full check: `npm run check` exit 0, 141 modules
- Full test: `npm test` exit 0, 60 files, 1429 tests
- Full build: `npm run build` exit 0, 168 files
