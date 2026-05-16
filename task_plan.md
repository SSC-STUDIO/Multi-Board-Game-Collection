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
- [completed] Add tests for `src/games/chess/rules.js` edge cases (castling, en passant, promotion)
- [completed] Add tests for `src/games/xiangqi/rules.js` edge cases (palace, river crossing, piece-specific moves)
- [completed] Add tests for `src/games/junqi/flip/rules.js` edge cases (capture legality, stalemate detection)
- [completed] Add tests for `src/app/controllers/` (InteractionManager, LauncherController, ImmersiveHudManager) — 130 tests passing
- [completed] Add tests for `src/ui/render.js` — 31 tests passing
- [completed] Add tests for `src/app/controllers/GameController.test.js`
- [completed] Add tests for `src/app/controllers/SettingsController.test.js`
- [ ] Add tests for `src/app/GomokuApp.js`

## Completed Round (2026-05-16)

**目标**: 在已有控制器测试基础上（4 个测试文件 + render 测试，677 用例全部通过），完成剩余模块的单元测试。

**实际结果**:
1. GameController.test.js (837 行，59 测试用例) 和 SettingsController.test.js (906 行，64 测试用例) 已存在但存在大量 mock 与实际实现不匹配的问题
2. **GameController.test.js**: 修复了 20 个失败用例 — 主要原因是测试预期 `app.showMessageKey` 被调用，但实际实现直接调用 `showMessageUI`（来自 render 模块）。同样，`app.setAIThinking` 预期与实际 GameController.setAIThinking 实现不匹配
3. **SettingsController.test.js**: 修复了 11 个失败用例 — 主要原因是 mock 元素缺少 `querySelector`、`createResultSummary`、`_classes` vs `classList` 混淆、setTimeout 同步执行导致 scene-switching 类被立即移除
4. 全量测试验证: **800 tests, 34 files, 全部通过**
5. `node tools/check.mjs` 通过 (98 modules)

**经验教训**:
- 测试文件创建时需对照实际实现，而非预期 mock 行为
- 使用 `showMessage` mock 替代 `app.showMessageKey` 预期
- vitest `clearAllMocks()` 不会重置 `mockReturnValue`，需手动重置
- mock 元素需要提供 `querySelector` 方法
- `Set` 没有 `remove` 方法，应使用 `classList.remove()`

## Constraints

- Preserve existing behavior; tests only, no runtime changes.
- Mock `i18n` where needed to isolate pure logic.
- Keep test files co-located with their source (`*.test.js` next to `*.js`).
