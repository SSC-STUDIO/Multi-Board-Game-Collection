# Task Plan
## Goal
Fix the Gomoku AI minimax search to detect terminal win states (5-in-a-row) immediately after placing a stone, instead of continuing to search opponent responses on an already-decided board.

## Baseline
- HEAD: 2012a1b (fix(shogi): enforce forced promotion for P/L on last rank and N on last 2 ranks)
- Working tree: clean
- All gates pass on HEAD (141 modules check, 60 files/1466 tests, 168 files build)
- `minimaxSearch` in `src/games/gomoku/ai.js` lines 330-386: places a stone, recurses to opponent, but never checks if the placed stone won the game
- `evaluateState` at depth 0 (line 388-410): comment says "Check for terminal win/loss first" but only sums line scores — `getLineScore(5, ...)` returns 500,000, not a proper terminal WIN score

## Scope
- `src/games/gomoku/ai.js` — add terminal win check in `minimaxSearch` after placing each stone; add WIN/LOSS constants
- `src/games/gomoku/ai.test.js` — add regression tests verifying the AI finds immediate wins and blocks immediate losses through the minimax search

## Steps
1. Import `checkWin` from `./rules.js` in `ai.js`
2. Define WIN_SCORE constant (= 1,000,000,000) to match `evaluateMove`'s win return value
3. In `minimaxSearch`, after placing a stone (both maximizing and minimizing branches), check `checkWin(board, size, move.row, move.col, currentColor)`:
   - Maximizing branch: if AI color wins, return +WIN_SCORE immediately (no need to recurse)
   - Minimizing branch: if opponent wins, return -WIN_SCORE immediately
4. Add regression tests in `ai.test.js`:
   - Test 1: AI has 4-in-a-row open, can place 5th stone → AI must place the winning stone (not a defensive move)
   - Test 2: Opponent has 4-in-a-row open, AI must block (verify via minimax that the search sees the loss)
5. Run focused tests: `npx vitest run src/games/gomoku/ai.test.js`
6. Run configured gates: `npm run check`, `npm test`, `npm run build`
7. Update this plan's Evidence section with actual results

## Verification
- Focused: `npx vitest run src/games/gomoku/ai.test.js` — exit 0, all tests pass
- Gate 1: `npm run check` — exit 0, 141 modules
- Gate 2: `npm test` — exit 0, 60 files, 1466+ tests
- Gate 3: `npm run build` — exit 0, 168 files

## Risks
- WIN_SCORE must be large enough to dominate any non-terminal evaluation (1e9 vs max eval ~500k) — verified: 1e9 >> 500k
- Transposition table might cache pre-fix results — cleared between test runs via module re-import; not an issue in production since TT entries include depth
- `checkWin` performance: O(1) per call (4 directions × board scan from the placed point) — negligible vs full recursion

## Stop Conditions
- Stop after implementing the terminal win check + tests, running all gates, and confirming they pass
- Stop if a gate fails and cannot be fixed within scope

## Evidence

### Git Baseline
- HEAD: 2012a1b (fix(shogi): enforce forced promotion for P/L on last rank and N on last 2 ranks)
- Parent: c664914 (fix(gomoku): check exact five-in-a-row before overline in Renju forbidden-move rules)

### Defect Found
`minimaxSearch` in `src/games/gomoku/ai.js` did not detect terminal win states (5-in-a-row) after placing a stone. Both the maximizing branch (AI's move) and minimizing branch (opponent's move) recursed into opponent responses on an already-decided board. Additionally, `getBestMove` (medium and hard branches) placed the AI's stone and called `minimaxSearch` without checking whether the placed stone won the game.

Root cause: missing `checkWin` calls at two levels:
1. `getBestMove` (medium line 76, hard line 129): after `board[move.row][move.col] = color`, no win check before `minimaxSearch`
2. `minimaxSearch` (maximizing line 361, minimizing line 374): after `board[move.row][move.col] = currentColor`, no win check before recursion

### Fix Applied
- Added `checkWin` to imports from `./rules.js`
- Added `WIN_SCORE = 1_000_000_000` constant (matches `evaluateMove`'s win return value)
- `getBestMove` medium branch: after placing stone, check `checkWin` → return `WIN_SCORE` immediately
- `getBestMove` hard branch: same terminal win check
- `minimaxSearch` maximizing branch: after placing stone, check `checkWin` → return `+WIN_SCORE`
- `minimaxSearch` minimizing branch: after placing stone, check `checkWin` → return `-WIN_SCORE`

### Test Coverage
- Test 1: "minimax: should prefer immediate win over slower win through minimax search" — both sides have open four; AI must take its own win, not block opponent
- Test 2: "minimax: should detect opponent win in search and block instead of counter-attacking" — opponent has open four, AI has fully blocked four; AI must block, not extend its own dead four

### Gate Results
- `npx vitest run src/games/gomoku/ai.test.js` — exit 0 — 34 tests passed (was 32 before, +2 new)
- `npm run check` — exit 0 — 141 modules checked
- `npm test` — exit 0 — 60 files, 1468 tests passed (was 1466, +2 new)
- `npm run build` — exit 0 — 168 files, 274ms

### Changed Files
- `src/games/gomoku/ai.js` — terminal win detection in minimax search and getBestMove
- `src/games/gomoku/ai.test.js` — two regression tests for minimax terminal win detection
- `ai/task-plans/75-grok-execution-plan.md` — this evidence section
