# Findings

- The requested files already contain partial JSDoc coverage, but coverage is inconsistent across exported APIs and public class methods.
- `src/game/state.js`, `src/ui/render.js`, `src/ui/dom.js`, `src/utils/board.js`, `src/utils/formatters.js`, `src/services/llmCoach.js`, `src/audio/SoundManager.js`, and `src/main.js` already have file-level module comments that can be tightened instead of replaced wholesale.
- `src/app/GomokuApp.js`, `src/app/controllers/GameController.js`, and `src/app/controllers/SettingsController.js` need the largest documentation pass because they expose the most public methods and need explicit section headings.
- `src/services/llmCoach.js` and `src/audio/SoundManager.js` also need internal explanatory comments because their helper flows are stateful and not obvious from signatures alone.
- **2026-05-16**: GameController.test.js 和 SettingsController.test.js 的 mock 与实际实现存在大量不匹配：
  - GameController 的 `showMessageKey()` 直接调用 `showMessageUI()`（render 模块），而非 `app.showMessageKey`
  - GameController 的 `setAIThinking()` 直接操作 state + 调用 `setAIThinkingUI()`，而非 `app.setAIThinking`
  - `vi.clearAllMocks()` 不重置 `mockReturnValue`，导致 `getForbidden` mock 值在测试间泄露
  - SettingsController 的 `refreshSoundToggle()` 是控制器方法，不是 `app.refreshSoundToggle`
  - sync setTimeout 会导致 `scene-switching` 类立即被移除

## 2026-05-16 (GitHub Hosting Readiness 轮)

- **项目身份过时**: 项目已从单一五子棋演变为5游戏平台，但 README 和 package.json 仍只描述 Gomoku。已更新。
- **GomokuApp 测试经验**: 测试需要模拟5个控制器+7个外部依赖。关键技巧：
  - 使用 `vi.hoisted()` 创建共享 mock 引用，避免 mock 作用域隔离
  - 所有 mock 模块路径必须相对于测试文件位置（`../ui/dom.js` 而非 `../../ui/dom.js`）
  - `makeMockCtrls.settings.bindOptionGroup` 需要在 mock 工厂中添加（GomokuApp.bindEvents 调用）
  - `setupBackToLauncher` 按钮需在 mock DOM 中添加，否则触发 `document.getElementById`（test-setup.js 未提供该方法）
  - `window.removeEventListener` 在 test-setup.js 中缺失，需在测试中补充
  - `getViewportProfile` 在 1024x768 下返回 `desktop-compact`（`width < 1280` 条件），不是 `desktop`
  - `sections.game.classList.contains('hidden')` mock 默认返回 `false`，导致 `getDebugState().screen = 'game'`；应返回 `true` 模拟初始设置界面
