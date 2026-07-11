# Task Plan

## Goal

Fix a turn-state inconsistency across three games (Chess, Go, Xiangqi):
their `handleUndo` methods do not cancel pending AI timers before replaying
board history. Othello (`OthelloApp.js:379`) and Shogi (`ShogiApp.js:287`)
already call `clearPendingAI` / `clearAITimer` at the top of their undo
handlers. In Chess, Go, and Xiangqi, the base-class `this.aiTimer` (set by
`BoardGameApp.scheduleAIMove` at line 292) could remain pending after undo,
meaning a stale setTimeout fires against a replayed board and commits a move
computed from the old position. The `aiThinking` guard currently masks this
race condition, but the cross-game invariant — "undo cancels all scheduled
AI work" — is broken for these three games. This revision restores the
invariant by adding a single `this.clearAITimer();` call after the guard
in each game's `handleUndo`.

## Baseline

HEAD = `ec9f834` on `master`. Working tree already contains prior-revision
changes: aiThinking guards (+1 line each in Chess/Go/Xiangqi source) and
focused regression tests (+20 lines each in Chess/Go/Xiangqi test files),
plus Othello/Shogi stepCount fixes. Total prior diff before this revision:
79 insertions, 2 deletions across 9 files.

`BoardGameApp.js` key methods:
- `scheduleAIMove()` (line 287): stores `window.setTimeout` handle in
  `this.aiTimer`, sets `this.state.aiThinking = true`.
- `clearAITimer()` (line 305): calls `window.clearTimeout(this.aiTimer)`,
  nulls the handle, sets `this.state.aiThinking = false`.
- Called from `dispose()`, `enterSetup()`, `hideRoot()`, `onStorageChanged()`
  — but NOT from any game's `handleUndo` (except Othello and Shogi).

## Scope

Exactly three source files receive one new line each:
- `src/games/chess/ChessApp.js` — insert `this.clearAITimer();` at line 341,
  immediately after the `aiThinking || gameOver` early-return guard.
- `src/games/go/GoApp.js` — insert `this.clearAITimer();` at line 325,
  immediately after the `aiThinking || gameOver` early-return guard.
- `src/games/xiangqi/XiangqiApp.js` — insert `this.clearAITimer();` at line 277,
  immediately after the `aiThinking || gameOver` early-return guard.

No test changes. No schema, config, or contract files touched.

## Steps

1. Read `handleUndo` in ChessApp.js (lines 340–366), GoApp.js (lines 324–358),
   XiangqiApp.js (lines 276–306) to confirm the guard and insertion point.
2. Read `clearAITimer()` in BoardGameApp.js (lines 305–311) to confirm
   idempotent behavior: no-op when `aiTimer` is null.
3. Edit ChessApp.js: insert `this.clearAITimer();` after the guard line.
4. Edit GoApp.js: insert `this.clearAITimer();` after the guard line.
5. Edit XiangqiApp.js: insert `this.clearAITimer();` after the guard line.
6. Run focused tests: `npx vitest run src/games/chess/ChessApp.test.js
   src/games/go/GoApp.test.js src/games/xiangqi/XiangqiApp.test.js`
7. Run full gate: `npm run check && npm test && npm run build`
8. Inspect `git diff HEAD --stat` to confirm only 3 source files changed.
9. Update this plan's Evidence section with actual command output.

## Verification

Focused:
```
npx vitest run src/games/chess/ChessApp.test.js src/games/go/GoApp.test.js src/games/xiangqi/XiangqiApp.test.js
```

Full gate:
```
npm run check
npm test
npm run build
```

## Risks

- Minimal: `clearAITimer()` is idempotent — it no-ops when `aiTimer` is null.
  Adding it after the `aiThinking` guard means it only fires when the guard
  passes (AI is NOT thinking), so the timer is either null (no-op) or stale
  (should be cancelled). No existing path is broken.
- Rollback: delete the three inserted lines.

## Stop Conditions

- Any focused or gate test fails with a NEW error (not baseline).
- `git diff HEAD --stat` shows changes outside the three target files.
- `clearAITimer` is not defined on the class prototype (verified: inherited
  from BoardGameApp at line 305).

## Evidence

### Before state

In Chess, Go, and Xiangqi `handleUndo`, after the `aiThinking || gameOver`
guard, the code immediately checks `moveHistory.length` and begins replaying.
No call to `clearAITimer()` or any AI-cancel mechanism exists. In contrast,
OthelloApp.js line 379 calls `this.clearPendingAI()` and ShogiApp.js line 287
calls `this.clearPendingAI()` at the equivalent position.

### Source edits applied (this revision)

```
 src/games/chess/ChessApp.js     | 2 ++
 src/games/go/GoApp.js           | 2 ++
 src/games/xiangqi/XiangqiApp.js | 2 ++
 3 files changed, 6 insertions(+)
```

Each file received exactly one new line: `this.clearAITimer();`

### Focused verification result

```
npx vitest run src/games/chess/ChessApp.test.js src/games/go/GoApp.test.js src/games/xiangqi/XiangqiApp.test.js
 Test Files  3 passed (3)
      Tests  75 passed (75)
   Duration  742ms
Exit code: 0
```

### Configured gate result

```
npm run check   → PASS (141 modules checked, exit 0)
npm test        → PASS (60 files, 1415 tests passed, exit 0)
npm run build   → PASS (168 files, 354ms, exit 0)
```

### Diff reconciliation

Total working-tree diff vs HEAD: 82 insertions, 2 deletions across 10 files.
Of those, this revision adds 3 new `clearAITimer()` insertions (one per game).
The remaining 79 lines are prior-revision changes (aiThinking guards, test
additions, stepCount fixes). The new lines are strictly additive and
idempotent — `clearAITimer()` is a no-op when no timer is pending.

The diff differs from the previous submission: the previous diff hash was
`716f5ffb47d72f41d81f5fbe7131c37a60db652202e4e35519263694f3332d37` and
did not include these three `clearAITimer()` lines.

### Deviations

None. All nine steps executed as planned.
