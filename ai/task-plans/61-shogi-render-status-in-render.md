# Task Plan

## Goal
Restore Shogi HUD consistency: `ShogiApp.render()` currently rebuilds board cells only and never calls `renderStatus()`. Chess, Xiangqi, Go, and Othello (rev 60) already refresh status inside `render()`. Add `this.renderStatus()` at the end of `ShogiApp.render()`, then remove now-redundant explicit `this.renderStatus()` calls that immediately follow `this.render()` on move/undo/end paths. Invariant: every board re-render also refreshes turn / AI-thinking status text.

## Baseline
- Branch: `master` at `879f702` (clean working tree)
- Prior: `879f702` Othello `render()`→`renderStatus()`; `0a51088` Othello undo clearPendingAI; `7d51b33` Go commitPass renderBoard
- Defect site: `src/games/shogi/ShogiApp.js` `render()` ends after board DOM rebuild (lines 145-186) with no status update
- Explicit pairs today: `handleUndo` (lines 324-325), `commitMove` (lines 364-365, 369-370), `checkGameEnd` (lines 402-403) call `render()` then `renderStatus()`
- Board-only paths call only `render()`: `handleCellClick` deselect (lines 239, 261), `selectPiece` (line 279), `handleHint` (line 438)
- Base `BoardGameApp.scheduleAIMove` / `startGame` still call `renderStatus()` directly for AI-thinking / start — keep those
- Gate allowlist note: `scripts/verify-hermes.ps1` allows `src/games/shogi/ShogiApp.js` but not `ShogiApp.test.js`; do not modify the test file this revision

## Scope
In scope:
- `src/games/shogi/ShogiApp.js` — add `this.renderStatus()` at end of `render()`; remove redundant immediate `this.renderStatus()` after `this.render()` in `handleUndo`, `commitMove`, and `checkGameEnd` only
- `ai/task-plans/61-shogi-render-status-in-render.md` — create once before source edits (≥800 UTF-8 bytes; required headings); update Evidence at end

Out of scope:
- Othello / Chess / Go / Xiangqi / Junqi
- `src/games/shogi/ShogiApp.test.js` (blocked by verify-hermes allowlist)
- `scripts/verify-hermes.ps1`, rules/AI engines, save schema, 3D, packaging
- No commit/push until master approves

## Steps
1. Create `ai/task-plans/61-shogi-render-status-in-render.md` with this full plan (Goal/Baseline/Scope/Steps/Verification/Risks/Stop Conditions/Evidence placeholders). Do not edit source before the plan exists.
2. Read `src/games/shogi/ShogiApp.js` methods: `render`, `renderStatus`, `handleUndo`, `commitMove`, `checkGameEnd`, `handleHint`, `selectPiece`.
3. In `render()`, after the board cell loop and before the method closing brace (line 186), add `this.renderStatus();` as the last statement (mirror Othello rev 60 / Go pattern).
4. Remove only redundant pairs where `this.renderStatus();` is the next statement after `this.render();` in:
   - `handleUndo` (line 325)
   - `commitMove` game-over early return (line 365)
   - `commitMove` normal path (line 370)
   - `checkGameEnd` (line 403)
   Do not remove standalone `renderStatus()` calls that are not paired with `render()`.
5. Leave `handleHint` / selection / deselect paths as `this.render()` only — they now get status refresh for free via render().
6. Do not edit `ShogiApp.test.js`.
7. Run focused tests, then full verify-hermes gate.
8. Update plan Evidence with commands, exit codes, diff stat, and deviations.
9. Stop for master review with structured evidence (status, diff, checks). Do not commit/push.

## Verification
Focused:
- `npx vitest run src/games/shogi/ShogiApp.test.js` — exit 0, no regressions

Broad gate:
- `npm run check && npm test && npm run build` — all exit 0

Expected diff:
- Tracked: only `src/games/shogi/ShogiApp.js`
- Untracked: `ai/task-plans/61-shogi-render-status-in-render.md`
- `git diff --name-only` must not list any non-allowlisted path

Manual code assertions (document in Evidence):
- `render()` body ends with `this.renderStatus();`
- No `this.render();` immediately followed by `this.renderStatus();` remains in handleUndo/commitMove/checkGameEnd

## Risks
- Double `renderStatus()` if a call site is left paired: harmless (pure `textContent` write) but avoid for clarity
- Forgetting to add status inside `render()` while removing pairs would regress HUD — add first, then remove pairs
- `BoardGameApp.scheduleAIMove` still relies on direct `renderStatus()` when only `aiThinking` flips (no board rebuild) — do not remove base-class behavior
- No new automated status-via-render regression test this revision because verify-hermes allowlist excludes `ShogiApp.test.js`

## Stop Conditions
- Stop after this single Shogi render/status centralization; do not start another game or cleanup
- Stop and report if focused Shogi tests or verify-hermes exit non-zero
- Stop if working tree shows unexpected files beyond Scope
- Stop for secrets, cross-project edits, or any need to edit non-writable paths
- Do not commit, push, amend, rebase, reset, or force-push

## Evidence
Record after implementation:
- `git status --short`, `git diff --stat`, `git diff`
- Focused vitest command + exit code + pass count
- verify-hermes.ps1 exit code + tail
- Exact lines changed in `ShogiApp.js`
- Plan file byte size ≥ 800
- Deviations from Steps (if any)

### Implementation evidence (appended during revision 61)

**Diff**: `src/games/shogi/ShogiApp.js` — 1 file changed, 1 insertion, 4 deletions
- Line 186: added `this.renderStatus();` at end of `render()` (insertion)
- Line 325: removed redundant `this.renderStatus();` after `this.render()` in `handleUndo`
- Line 365: removed redundant `this.renderStatus();` after `this.render()` in `commitMove` game-over path
- Line 371: removed redundant `this.renderStatus();` after `this.render()` in `commitMove` normal path
- Line 403: removed redundant `this.renderStatus();` after `this.render()` in `checkGameEnd`

**Focused tests**: `npx vitest run src/games/shogi/ShogiApp.test.js` — exit 0, 30 passed
**npm run check**: exit 0, 141 modules checked
**npm test**: exit 0, 60 files, 1418 tests passed
**npm run build**: exit 0, 168 files

**Plan file size**: 5098 bytes (≥ 800)
**Deviations**: None. Executed steps 1-7 exactly as planned.
