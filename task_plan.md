# Task Plan

## Goal

Expand test coverage across all game modules. The project has evolved from a single Gomoku game into a multi-board-game platform with 5 games (Gomoku, Go, Chess, Xiangqi, Junqi/Flip). Focus on unit testing state factories, rule engines, and AI modules for each game.

## Phases

- [completed] Add unit tests for `src/utils/formatters.js`
- [completed] Add unit tests for `src/utils/i18n.js`
- [completed] Add unit tests for `src/config/gameConfig.js`
- [completed] Add unit tests for `src/services/llmCoach.js`
- [completed] Add unit tests for `src/audio/SoundManager.js`
- [completed] Add unit tests for all 5 game state factories (`src/games/*/state.js`)
- [completed] Fix Go registry: add '3d-scene' capability
- [completed] Implement Japanese territory scoring (`scoreBoardWithRule` + `getTerritoryMap`)
- [completed] Add last-move highlight and ko marker in GoRenderer3D
- [completed] Add territory visualization in GoRenderer3D (scoring phase)
- [completed] Add scoring rule selector (area/territory) to Go setup UI (HTML + i18n)
- [completed] Add tests for `scoreBoardWithRule` (territory rule) and `getTerritoryMap`
- [next] Add tests for `src/games/chess/rules.js` edge cases (castling, en passant, promotion)
- [ ] Add tests for `src/games/xiangqi/rules.js` edge cases (palace, river crossing, piece-specific moves)
- [ ] Add tests for `src/games/junqi/flip/rules.js` edge cases (capture legality, stalemate detection)
- [ ] Add tests for `src/app/controllers/` (InteractionManager, GameController, LauncherController)
- [ ] Add tests for `src/ui/render.js` (render helpers, DOM output)
- [ ] Add tests for `src/app/GomokuApp.js` (game lifecycle, mode switching, undo flow)

## Constraints

- Preserve existing behavior; tests only, no runtime changes.
- Mock `i18n` where needed to isolate pure logic.
- Keep test files co-located with their source (`*.test.js` next to `*.js`).
