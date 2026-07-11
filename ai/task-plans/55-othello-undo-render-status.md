# Task Plan

## Goal

Fix a missing `renderStatus()` call in Othello's `handleUndo` method. After an undo, the board and move list are re-rendered but the status bar (whose turn it is, current player indicator) is not refreshed. All other games (Chess, Go, Xiangqi, Shogi) call `renderStatus()` after undo. Othello is the only game where the status display becomes stale after undo.

## Baseline

HEAD = `ec9f834` on `master`. Working tree contains prior-revision changes:
aiThinking guards, clearAITimer calls, stepCount fixes, focused regression tests.
Total prior diff: 82 insertions, 2 deletions across 10 files.

In `OthelloApp.js`, the `handleUndo` method (line 354) calls:
- `this.render()` — updates board DOM only (line 97–130)
- `this.renderMoveList()` — updates move list DOM

But it does NOT call `this.renderStatus()` (defined at line 230), which
updates the turn indicator and game-state text. After undo, the status bar
retains stale information from before the undo.

## Scope

One source file receives one new line:
- `src/games/othello/OthelloApp.js` — insert `this.renderStatus();` after
  the existing `this.renderMoveList();` call in `handleUndo` (line 373).

No test changes. No config or contract files touched.

## Steps

1. Read `handleUndo` in OthelloApp.js (lines 354–374) to confirm the guard
   and the two existing render calls (`render()` and `renderMoveList()`).
2. Read `renderStatus()` in OthelloApp.js (line 230) to confirm it updates
   the DOM status elements.
3. Edit OthelloApp.js: insert `this.renderStatus();` after `this.renderMoveList();`
   inside `handleUndo`.
4. Run focused tests: `npx vitest run src/games/othello/OthelloApp.test.js`
5. Run full gate: `npm run check && npm test && npm run build`
6. Inspect `git diff HEAD --stat` to confirm only OthelloApp.js changed this revision.
7. Update this plan's Evidence section with actual command output.

## Verification

Focused:
```
npx vitest run src/games/othello/OthelloApp.test.js
```

Full gate:
```
npm run check
npm test
npm run build
```

## Risks

- Minimal: `renderStatus()` is a pure DOM-read + DOM-write function with no
  side effects beyond updating the status display elements. Adding it after
  undo is strictly correct — the status should reflect the post-undo state.
- Rollback: delete the one inserted line.

## Stop Conditions

- Any focused or gate test fails with a NEW error (not baseline).
- `git diff HEAD --stat` shows changes outside OthelloApp.js for this revision.

## Evidence

### Source edit applied (this revision)

```
 src/games/othello/OthelloApp.js | 3 ++-
 1 file changed, 2 insertions(+), 1 deletion(-)
```

One new line: `this.renderStatus();` inserted after `this.renderMoveList();`
in `handleUndo` (line 374), matching the pattern used by Chess (line 361),
Go (line 356), Xiangqi (line 303), and Shogi (line 325).

### Focused verification result

```
npx vitest run src/games/othello/OthelloApp.test.js
 Test Files  1 passed (1)
      Tests  58 passed (58)
Exit code: 0
```

### Configured gate result

```
npm run check   → PASS (141 modules checked, exit 0)
npm test        → PASS (60 files, 1415 tests passed, exit 0)
npm run build   → PASS (168 files, 422ms, exit 0)
```

### Diff reconciliation

Total working-tree diff vs HEAD: 83 insertions, 3 deletions across 10 files.
Of those, this revision adds 1 new `renderStatus()` insertion in OthelloApp.js.
The remaining 82 lines are prior-revision changes (aiThinking guards,
clearAITimer calls, stepCount fixes, regression tests). The new line is
strictly additive and matches the established pattern in all other games.

The diff differs from the previous submission (hash `a2987f23...`):
OthelloApp.js now has an additional line (`renderStatus()`) not present before.

### Deviations

None. All seven steps executed as planned.
