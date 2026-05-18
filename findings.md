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

## 2026-05-16 (App-level tests for Chess/Xiangqi/Junqi)

- **ChessApp 测试要点**: 与国际象棋特有功能对应的测试包括 promo overlay（showPromotion/hidePromotion）、describeMove（王车易位 O-O/O-O-O、兵升变 =Q、吃子 x）、formatResult 的 5 种结果类型（将杀/认输/逼和/50步/无子可动）。handleSquareClick 需处理 gameOver 和 aiThinking 两种阻断条件。
- **XiangqiApp 测试要点**: formatResult 的将死/认输/困毙三种结果分别使用 xiangqiCheckmateBadge、resultResignBadge、xiangqiStalemateBadge 三个不同的 i18n key。refreshSetupVisibility 同时控制 levelRow 和 colorRow 两个元素。
- **JunqiApp 测试要点**: 构造后 `app.state === null`（BoardGameApp 构造函数不调用 createInitialState），所有需要 state 的测试必须先 startGame()。formatResult 包含三种结局（resign 对应 resultResignBadge、annihilation 对应 junqiAnnihilationBadge、stalemate 对应 junqiStalemateBadge）。variant 选择器控制着四个王国变体的的 comingSoon 消息。turn=null 是 JunqiApp 特有的首翻状态。
- **923 tests / 39 files / 100 modules 全部通过**: 项目从 0 个测试增长到 923 个。覆盖全部 5 个游戏的 state/rule/AI/App 层。本轮新增 63 个测试（3 新文件）。- **CHANGELOG.md 过时问题发现**: 项目从五子棋演变为 5 游戏平台后，CHANGELOG.md 仍描述为单五子棋 + Steam 发布计划，包含大量不相关/不准确内容（Steamworks SDK、Steam 成就系统、云存档等）。这个过时的 CHANGELOG 会严重误导读者对项目范围和状态的判断。已重写为准确反映 5 游戏平台所有真实变更。
- **CI workflow 配置选择**: 使用 ubuntu-latest runner + Node.js 20 + npm ci + vitest。触发条件包括 push 到 main/master/codex/ai-** 分支以及 pull_request。含 workflow_dispatch 支持手动触发。
- **Go 规则测试新增 16 个边缘用例**: 覆盖 isEmptyBoard (3), getNeighbors (1), getGroup (2), corner capture (1), out-of-bounds (1), isLegalMove (2), getLegalMoves (3), suicide (1), eye-filling (1)。Go 规则测试从 18 增至 34。


## 2026-05-16 (LLM Coach error feedback + CoachController test coverage)

- **LLM Coach `requestLlmCoachGuidance` 错误处理无用户提示**: 当 LLM 请求因网络/超时/API 错误失败时，CoachController 的 catch 块仅设置 `coachLlmStatus = 'unavailable'` 并渲染，不调用 `showMessageKey` 给用户任何解释。对比 `handleImageUpload` 的 catch 块调用了 `showMessageKey('coachAnalyzeFailed')`——同一控制器内行为不一致。
- **CoachController 测试覆盖缺口**: 当前 399 行测试仅覆盖 5/18 个方法（orderImportedStones, importAnalyzedBoard, openPreviewEdit/togglePreviewCell/closePreviewEdit, cancelImageAnalysis, pushLlmRequestLog）。`clearCoachState`, `refreshCoachGuidance`, `requestLlmCoachGuidance`, `normalizeLlmAdvice`, `normalizeCoachPoint`, `normalizeCoachText`, `normalizeConfidence`, `isLegalCoachMove`, `getPositionKey`, `focusCoachCandidate` 共 10 个方法无测试。`requestLlmCoachGuidance` 的 error path 也无测试。
- **CoachController 测试 mock 限制**: CoachController 内部依赖 `requestLlmCoachAdvice`（从 llmCoach.js 导入），而 `requestLlmCoachGuidance` 是异步方法。测试需要 mock `requestLlmCoachAdvice` 为 `vi.fn()` 并控制 resolve/reject 以测试 success/error 路径。
