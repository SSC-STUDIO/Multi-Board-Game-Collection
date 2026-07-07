# Bug Reports — Resolved

> Bugs verified and closed.

## Resolved

### BUG-001: LLM Coach only supports Gomoku [RESOLVED by BoardGame-Agent-001]
- **Severity**: High
- **Resolved**: 2026-07-07
- **Description**: buildChatCompletionRequest() in services/llmCoach.js hardcoded "You are a Gomoku teaching coach" and only rendered a 15x15 Gomoku board image. The coach should support all 5 games.
- **Files**: src/services/llmCoach.js, src/app/controllers/CoachController.js, src/games/registry.js
- **Fix**:
  1. Added getGameType() to CoachController to detect active game from DOM body.dataset.activeGame
  2. Passed gameType parameter through requestLlmCoachAdvice() call chain
  3. Split createBoardImageDataUrl() into createGridBoardImageUrl() (Chess/Xiangqi 8x8/9x10 rectangular grids) and createIntersectionBoardImageUrl() (Gomoku/Go/Junqi intersection boards)
  4. Added 'llm-coach' capability to all 5 games in registry.js (was Gomoku-only)
- **Tests**: 976/976 pass, npm run check clean on 111 modules
- **Rule**: Always pass gameType through the full LLM service call chain; never assume a single game type in multi-game codebases.
