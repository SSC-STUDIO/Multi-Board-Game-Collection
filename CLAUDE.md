# Board Games 合集 · 多款棋盘游戏

## 项目概述

Board Games 是一款多款棋盘游戏合集，采用原生 JavaScript + Three.js 构建，集成五子棋、围棋、国际象棋、中国象棋和军棋翻翻棋于一体。支持 Web、Android (Capacitor) 和桌面端 (Electron) 多平台发布。

**核心特性**：
- 5 款游戏：五子棋、围棋、国际象棋、中国象棋、军棋翻翻棋
- 统一启动器：从启动器选择任意游戏进入
- 多种游戏模式：PvP、PvE（AI）、练习模式
- 围棋：中国规则/日本规则计分、让子、3D 渲染（Three.js）
- 五子棋：禁手规则（Renju）、3D 渲染（Three.js）三档 AI 难度、QI 指导（LLM Coach）
- 3D 场景：Three.js 沉浸式场景（家/公园/比赛现场），支持场景切换
- LLM Coach：可选接入外部 LLM API 获取智能建议

## 技术栈

- **前端框架**：原生 JavaScript (ES Modules)
- **样式**：原生 CSS (CSS Variables)
- **3D 渲染**：Three.js ^0.164.0 (五子棋/围棋)
- **跨平台打包**：
  - Android: Capacitor ^8.3.1
  - 桌面端: Electron ^28.0.0 + electron-builder ^24.9.1
- **构建工具**：自定义 Node.js 脚本 (`tools/*.mjs`)

## 架构说明

项目采用分层模块化设计，代码按游戏和功能分层：

```
src/
├── main.js              # 应用入口 (DOMContentLoaded → 启动器)
├── app/                  # 应用层
│   ├── GomokuApp.js     # 应用主类，协调各模块
│   └── controllers/     # 控制器模块
├── game/                 # 五子棋游戏逻辑 (遗留，games/gomoku 为重构版)
├── games/                # 各游戏独立模块
│   ├── gomoku/           # 五子棋 (state.js, rules.js, ai.js)
│   ├── go/               # 围棋 (state.js, rules.js, 含计分+3D渲染)
│   ├── chess/            # 国际象棋 (state.js, rules.js)
│   ├── xiangqi/          # 中国象棋 (state.js, rules.js)
│   └── junqi/flip/       # 军棋翻翻棋 (state.js, rules.js)
├── ui/                   # 表现层 (DOM 操作、渲染)
│   ├── dom.js           # DOM 引用获取、事件绑定
│   └── render.js        # UI 渲染、状态同步
├── render3d/             # 3D 渲染模块 (Three.js)
│   ├── GomokuRenderer3D.js  # 五子棋 3D 渲染器
│   ├── scenes/          # 场景预设 (home/park/competition)
│   └── ...               # SceneManager, CameraController 等
├── render3d/go/          # 围棋 3D 渲染模块 (Three.js)
├── config/               # 配置层
│   ├── gameConfig.js    # 游戏常量、默认选项、模式标签
│   ├── sceneConfig.js   # 3D 场景配置
│   └── renderConfig.js  # 渲染参数配置
├── utils/                # 工具层
│   ├── board.js         # 棋盘坐标工具
│   ├── formatters.js    # 格式化函数
│   └── i18n.js          # 国际化 (中/英)
├── audio/
│   └── SoundManager.js  # 音效管理 (Web Audio API)
├── services/
│   └── llmCoach.js      # LLM Coach 服务 (可选外部 API，仅五子棋)
└── styles/               # CSS 样式
    ├── main.css         # 主样式入口
    ├── base.css         # 基础样式、变量
    ├── layout.css       # 布局
    ├── components.css   # 组件样式
    └── responsive.css   # 响应式适配
```

**模块依赖关系**：
- `games/` 纯逻辑层，仅依赖 `config/` 和 `utils/`
- `app/` 依赖 `games/`、`ui/`、`render3d/`、`audio/`、`services/`
- `ui/` 依赖 `game/`（或 `games/`）和 `render3d/`
- `render3d/` 依赖 `config/` 和 Three.js

## 开发命令

```bash
# 安装依赖
npm install

# 启动本地开发服务器 (http://localhost:4173)
npm run serve

# 运行全部测试 (Vitest)
npm test

# 代码检查 (ESM 模块语法检查)
npm run check

# 构建 Web 版本
npm run build

# Electron 桌面应用
npm run start          # 启动 Electron (开发)
npm run build:win      # 构建 Windows 版本
npm run build:linux    # 构建 Linux 版本

# Android APK
npm run android:sync        # 同步 Web 资源到 Android
npm run android:build:debug # 构建调试 APK

# 清理构建产物
npm run clean
```

## 测试

项目使用 Vitest 进行单元测试，测试文件与源代码同目录（`*.test.js`）。

```bash
# 运行全部测试
npm test

# 运行特定测试文件
npx vitest run src/games/go/rules.test.js

# 测试数量 (2026-05-16): 822 tests, 35 files
```

### 覆盖范围
- 各游戏规则引擎：胜负判定、特殊规则、边界条件
- 各游戏状态工厂：默认值、初始化、边界
- 应用控制器：GameController, SettingsController 等
- 工具函数：i18n、格式化、棋盘坐标
- 服务层：LLM Coach 配置、超时
- 音效系统：状态管理、音频上下文
- 应用主类：GomokuApp 构造/初始化/委托/销毁

## 代码约定

- **命名规范**：PascalCase (类) / camelCase (函数/变量) / UPPER_SNAKE_CASE (常量) / kebab-case (CSS 变量)
- **模块风格**：ES Modules，显式 `export`，避免 `export default`
- **测试文件**：`<module>.test.js` 与源文件同目录
- **状态管理**：`create<Game>State()` 创建不可变状态快照，`GomokuApp` 集中更新
- **持久化**：localStorage（语言/音效/LLM 设置）

## 已知问题

1. **LLM Coach 网络错误处理**：`llmCoach.js` 依赖外部 API，网络异常处理需加强
2. **3D 移动端性能**：低端设备上 Three.js 场景可能卡顿，PixelRatio 已有限制但仍需优化
3. **Electron 在 WSL 中不可用**：需要 Windows 原生环境构建和测试
4. **Gomoku 3D 截图在 headless Chromium 中不可用**：Three.js 场景使用 SwiftShader 渲染时 `page.screenshot()` 超时（已知 Playwright + headless 限制）。Go 3D 渲染（较简单结构）可正常截图。不影响真实用户。
5. **`.setup-panel` 使用 `position: fixed`**：Gomoku 设置面板 `#setup` 的 `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%)` 导致 `offsetParent` 恒为 null。Playwright 中需用 `!el.classList.contains('hidden')` 而非 `offsetParent !== null` 检测可见性。

## Playwright 冒烟测试注意事项

运行 `node tmp-playwright-smoke.mjs` 前需确保 `npm run serve` 已在 `http://127.0.0.1:4173` 运行。

### 关键技巧
- **每游戏独立 page**: 每个游戏测试使用独立的 page（`browser.newPage()`），测试后 `page.close()`。避免 activeGames Map 状态干扰。
- **使用 `page.evaluate(() => element.click())`**: 替代 Playwright 的 `locator.click()`。在 headless 模式中，`locator.click()` 可能在 "performing click action" 阶段挂起。
- **`!el.classList.contains('hidden')` 检测可见性**: 替代 `offsetParent !== null`。`.setup-panel` 使用 `position: fixed` 导致 `offsetParent` 恒为 null。
- **模块加载时间**: headless Chromium 中动态 `import()` 需要 3-8 秒。使用 `waitForSelector`/`waitForFunction` 显式等待，避免 `waitForTimeout`。
- **截图超时**: headless Chromium + Three.js 3D 场景的 `page.screenshot()` 可能超时（30s）。使用 try/catch 包裹，标记为已知限制。
- **字体加载**: `fullPage: true` 截图可能因等待字体加载而超时。使用默认 `fullPage: false` 或加长超时。

### 测试流程
```
page.goto → 等待启动器网格 → 点击游戏卡片 → 等待设置面板 → 截图 → 点击开始 → 等待游戏面板 → 截图 → 执行落子操作 → 截图 → page.close
```

## 版本信息

- 当前版本：1.0.0
- 许可证：MIT
