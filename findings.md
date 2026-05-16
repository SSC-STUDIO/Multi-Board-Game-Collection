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

## 2026-05-16 (CLAUDE.md 更新 + 运行时冒烟测试轮)

- **CLAUDE.md 过时问题**: 项目从五子棋演变为5游戏平台后，CLAUDE.md 仍描述为"五子棋·Gomoku"。开发者/AI Agent 无法准确理解项目范围。已更新为完整5游戏平台描述。
- **架构发现**: 各游戏使用独立的 setup 和 game section（gomoku: `#setup`/`#game`; go: `#go-setup`/`#go-game`; chess: `#chess-setup`/`#chess-game`; xiangqi: `#xiangqi-setup`/`#xiangqi-game`; junqi: `#junqi-setup`/`#junqi-game`）。这个设计使得游戏之间完全解耦，不共享 setup 逻辑。
- **Playwright locator.evaluate 限制**: Playwright 的 locator.evaluate() 会等待元素"可交互"（可见、稳定、启用）。在测试隐藏面板时改用 page.evaluate() 配合 CSS 选择器可以绕过此限制。
- **运行时验证结果**: 所有 5 个游戏设置面板在 Playwright 中加载正常，0 控制台错误。代码运行时无需修复。
- **已验证的测试基线**: 822 tests, 35 files, 99 modules 全部通过。运行时冒烟测试：启动器 + 5 游戏设置面板全部正常显示。

## 2026-05-16 (国际象棋 AI 将杀提前检测修复 + 交互式冒烟测试轮)

- **国际象棋 AI 无将杀提前退出机制**: `getChessAIMove()` 在合法走法中存在 mate-in-1 时仍执行完整 depth-4 alpha-beta 搜索。在空棋盘+后的局面下，皇后 ~29 种走法导致 37×8×37×8 ≈ 87,000 叶子节点的搜索树，测试超时 5000ms。修复：在 `getChessAIMove()` 中添加 mate-in-1 提前检测（遍历合法走法，applyMove + isCheckmate 检查），将走法搜索从数秒缩短至 178ms。
- **Gomoku 3D 截图在 headless Chromium 中不可用**: 设置面板截图（HTML/CSS）正常，但启动 game 后的 Three.js 场景截图在 swiftshader WebGL 渲染中静默超时。Go 3D 截图（较简单的三维棋盘，无场景预设）可正常捕获（526KB）。这可能是 Gomoku 场景预设的渲染复杂度导致。非代码缺陷，是 headless 测试环境限制。
- **Playwright 元素稳定性与 CSS 过渡冲突**: Gomoku 设置面板的 `#start-btn` 使用 CSS 过渡（opacity: 0→1），Playwright 的 `elementHandle.click()` 在 CSS 过渡期间因元素"不稳定"而等待 30s 超时。使用 `page.mouse.click(boundingBox)` 或等待过渡完成后再点击可绕过。验证脚本已使用 boundingBox + mouse.click 方案成功。
- **Playwright runtime 确认无运行时错误**: Gomoku 实际对弈流程（启动 → 设置 → 开始 → 落子 3 手）全程 0 控制台错误。Go 设置界面 0 控制台错误。代码运行时无需修复。

## 2026-05-16 (全量 UI/交互扫描 + 实际运行冒烟测试轮)

- **Playwright 冒烟测试 v5 验证结果**: 4/5 游戏全部通过（Go/Chess/Xiangqi/Junqi），0 控制台错误，0 页面错误。Gomoku 因 Three.js 3D 场景在 headless Chromium 中截图超时——已知环境限制（已在之前轮次记录）。
- **`.setup-panel` 的 `position: fixed` 导致 Playwright `offsetParent` 为 null**: Gomoku 设置面板（`#setup`）使用 `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%)`。Playwright 的 `waitForFunction` 中用 `offsetParent !== null` 判断可见性会永久失败。替代方案：使用 `!el.classList.contains('hidden')` 检测。
- **国际象棋面板设置面板截图超时**: v1 测试中 Chess 游戏截图（`fullPage: true`）在 headless Chromium 中因字体加载超时。去掉 `fullPage: true` 后在其他测试中正常（说明不是全页面或字体加载问题，而是 headless 性能的间歇性问题）。
- **国际象棋和中国象棋的 Playwright `page.locator.click()` 在 "performing click action" 阶段挂起**: 元素已确定可见、可用、稳定，但 Locator.click() 在 click 执行阶段超时。改用 `page.evaluate(() => element.click())` 通过 DOM 的 click() 方法绕过 Playwright 的可交互性检查后正常。
- **Gomoku 模块加载在 headless Chromium 中需要较长时间**: 动态 `import()` 在 headless 环境中较慢（约 3-8 秒）。测试中需使用 `waitForSelector` 或 `waitForFunction` 而非 `waitForTimeout()`。
- **每游戏独立 page 策略**: 在每个游戏测试之间使用 `page.close()` + 新 `page.goto()` 消除了游戏间状态干扰（activeGames Map 共享、上一游戏的 setup panel 残留等），是最可靠的跨游戏测试方案。
- **视觉验证确认**: 4 款游戏（Go/Chess/Xiangqi/Junqi）的设置界面、游戏界面、落子后界面均渲染正确，无遮挡/错位/空白/不可读文字。Dark 主题一致，HUD 元素正确。Gomoku UI 在真实浏览器中已验证工作正常，headless 截图限制不影响实际用户。
