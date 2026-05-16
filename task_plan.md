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
- [completed] Add tests for `src/app/GomokuApp.js` — 22 tests covering constructor, initRenderer, delegation, hooks, dispose, viewport

## Completed Round (2026-05-16): Critical Runtime Bug Fixes

**目标**: 基于现有计划和代码分析，发现并修复真实用户遇到的致命错误。

**发现的问题**:
1. **CSS 完全不加载**: `main.js` 使用 `import './styles/main.css'`（ESM CSS 导入），但项目不使用 bundler。浏览器拒绝将 CSS 作为 JS 模块加载，导致 main.js 完全不执行、所有 CSS 不加载、整个应用无法运行。
2. **Three.js 模块解析失败**: `import * as THREE from 'three'` 使用 bare specifier，但 HTML 缺少 import map，导致 gomoku 和 go 两个 3D 游戏加载失败。

**修复内容**:
1. 在 index.html 添加 `<link>` 标签加载所有 5 个 CSS 文件（base/main/layout/components/responsive）
2. 移除 main.js 中错误的 `import './styles/main.css'`
3. 在 index.html 添加 `<script type="importmap">` 映射 `three` → `node_modules/three/build/three.module.js` 和 `three/addons/` → `node_modules/three/examples/jsm/`

**验证结果**:
- Playwright 验证：所有 5 个游戏（gomoku/go/chess/xiangqi/junqi）均成功进入并返回启动器
- 无控制台错误
- 800 tests / 34 files 全部通过
- 98 模块语法检查通过
- 截图视觉验证：启动器、五子棋、围棋、国际象棋、中国象棋 UI 渲染正确

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

---

## Current Round (2026-05-16): GitHub Hosting Readiness

### 目标
准备代码库用于私有 GitHub 托管，重点修复用户可见的项目身份问题。

### 发现的关键问题
1. **README 完全过时** — 仍只描述五子棋（Gomoku），实际已是 5 游戏平台（Go/Gomoku/Chess/Xiangqi/Junqi）
2. **package.json 名称/描述/关键词** — 仍为 `gomoku` 和 `五子棋 · Gomoku`
3. **关键运行时修复未提交** — CSS 加载修复、Three.js import map、test-setup 增强
4. **未跟踪文件混乱** — Playwright 输出、截图、tmp 脚本
5. **GomokuApp 测试缺失** — task_plan 中最后一个测试缺口

### Agent Team 分工

| Agent | 任务 | 预期产出 |
|-------|------|----------|
| Agent-Builder-1 | 提交已修改文件的修复（index.html/src/main.js/src/test-setup.js）+ 更新 .gitignore | git commit + .gitignore 清理 |
| Agent-Builder-2 | 更新 README.md 和 package.json 反映多游戏平台 | README、package.json 修改 |
| Agent-Builder-3 | 添加 GomokuApp.test.js | 新测试文件 + 验证通过 |
| Agent-Verifier | 运行全量验证 + 视觉检查 | 测试/检查/serve/Codex视觉报告 |

### 实际验证方案
1. `npm test` — 全部测试通过
2. `npm run check` — 模块检查通过
3. `npm run serve` 启动开发服务器
4. Playwright 截图验证启动器和各游戏 UI
5. Codex GPT-5.4-mini 视觉检查截图（如果 Playwright 可用）

### 需要视觉验证的点
- 启动器界面：5 个游戏按钮可见
- 五子棋、围棋、国际象棋、中国象棋、军棋各游戏界面渲染
- 3D 场景渲染（围棋有 Three.js 3D 渲染）
- 语言切换功能
- 移动端响应式布局

---

## Current Round (2026-05-16): 国际象棋 AI 将杀提前检测修复 + 交互式冒烟测试

### 目标
1. **修复国际象棋 AI 测试超时** — `ai.test.js` 中 hard 模式的将杀在望检测需要完整 depth 4 搜索，在皇后+空棋盘局面下超时 5000ms
2. **实际对弈冒烟测试** — 使用 Playwright 进入游戏并实际落子，不只停留在设置面板加载
3. **视觉验证** — 截图检查游戏渲染

### 发现的问题
1. **国际象棋 AI 无将杀提前退出** — `getChessAIMove()` 在所有走法中执行 depth 4 alpha-beta 搜索，不先检查是否有一步将杀走法。在空棋盘+皇后+双王局面下，皇后有 ~29 种走法，导致搜索树过大超时
2. **Gomoku 3D 截图在 headless Chromium 中超时** — 设置面板截图可正常捕获，但点击"开始游戏"启动 3D Three.js 场景后，`page.screenshot()` 在 swiftshader WebGL 渲染中超时
3. **Go 3D 截图正常** — Go 的 3D 渲染（较简单的三维棋盘结构）在 headless 模式下截图正常（526KB）

### 修复内容
1. 在 `getChessAIMove()` 中添加将杀提前检测（mate-in-1）：在完整搜索前遍历所有合法走法，若有走法后对方被将死则立即返回，避免完整搜索

### Agent Team 分工
| Agent | 任务 | 预期产出 |
|-------|------|----------|
| Agent-Builder | 修复 AI 将杀检测 + 更新记录文件 | ai.js 修改、文件更新 |
| Agent-Verifier | 运行全量测试 + Playwright 冒烟 + 截图验证 | 测试通过 + 截图 |

### 实际验证方案
1. `npm test` — 822 测试全部通过 ✅
2. `npm run check` — 99 模块通过 ✅
3. `npm run serve` 启动开发服务器
4. Playwright 交互式对弈测试：进入 Gomoku 并实际落子
5. Playwright 加载验证：全部 5 游戏可进入设置面板
6. 截图视觉验证（Go 3D 截图可用）

### 需要视觉验证的点
- Go 3D 棋盘 + 棋子渲染（截图已捕获 ✅）
- Gomoku gameplay 状态（headless 截图超时，但 0 控制台错误，棋子已落下）

### 目标
1. **更新 CLAUDE.md** — 当前仍只描述"五子棋·Gomoku"，实际已是多游戏平台（Gomoku/Go/Chess/Xiangqi/Junqi），过时描述会误导开发者和 AI Agent
2. **Playwright 运行时冒烟测试** — 实际验证所有 5 个游戏可加载、启动器正常、无控制台错误
3. **视觉验证** — 截图检查各游戏 UI 渲染正确
4. **统一问题记录** — 遇到 API/socket/运行时/视觉问题时追加到 issues.md

### 发现的关键问题
1. **CLAUDE.md 完全过时** — 项目描述仍为"五子棋·Gomoku"，项目架构只列了 gomoku 相关模块，完全未反映多游戏平台现状
2. **运行时冒烟测试未完成** — 上一轮虽然计划了 Playwright 验证但未实际执行冒烟脚本
3. **缺少游戏间切换的实际验证** — 从启动器进入每个游戏再返回的功能未验证

### Agent Team 分工
| Agent | 任务 | 预期产出 |
|-------|------|----------|
| Agent-Builder-1 | 更新 CLAUDE.md 为多游戏平台 | CLAUDE.md 修改 |
| Agent-Builder-2 | 运行 Playwright 冒烟测试 | 截图 + 控制台错误报告 |
| Agent-Verifier | 全量测试 + 视觉验证 | 测试通过确认 + 截图视觉检查 |

### 实际验证方案
1. `npm test` — 822 测试通过 ✅
2. `npm run check` — 99 模块通过 ✅  
3. `npm run serve` 启动开发服务器
4. Playwright 脚本访问启动器并截取各游戏界面
5. 视觉检查截图（通过 Read tool + Codex 视觉能力）
6. 记录任何运行时错误到 issues.md

### 需要视觉验证的点
- 启动器界面：5 个游戏按钮可见
- 五子棋设置界面
- 围棋设置界面（含计分规则选择器）
- 国际象棋设置界面
- 中国象棋设置界面
- 军棋翻翻棋设置界面
- 无控制台错误
