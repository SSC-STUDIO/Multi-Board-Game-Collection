# 五子棋 · Gomoku

## 项目概述

五子棋 · Gomoku 是一款现代化的五子棋游戏，采用原生 JavaScript + Three.js 构建，支持 Web、Android (Capacitor) 和桌面端 (Electron) 多平台发布。

**核心特性**：
- 多种游戏模式：人人对战 (PvP)、人机对战 (PvE)、练习模式、QI 指导 (LLM Coach)
- 规则支持：经典规则、禁手规则 (Renju)
- 智能AI：三档难度 (轻松/进阶/大师)
- 3D 渲染：Three.js 沉浸式场景 (家、公园、比赛现场)
- LLM Coach：可选接入外部 LLM API 获取智能建议

## 技术栈

- **前端框架**：原生 JavaScript (ES Modules)
- **样式**：原生 CSS (CSS Variables)
- **3D 渲染**：Three.js ^0.164.0
- **跨平台打包**：
  - Android: Capacitor ^8.3.1
  - 桌面端: Electron ^28.0.0 + electron-builder ^24.9.1
- **构建工具**：自定义 Node.js 脚本 (`tools/*.mjs`)

## 架构说明

项目采用分层模块化设计，代码组织清晰：

```
src/
├── main.js              # 应用入口 (DOMContentLoaded 初始化)
├── app/
│   └── GomokuApp.js     # 应用层主类，协调各模块
├── game/                 # 游戏逻辑层 (纯逻辑，无 UI 依赖)
│   ├── state.js         # 状态管理：棋盘、历史、游戏选项
│   ├── rules.js         # 规则引擎：胜负判定、禁手检测
│   └── ai.js            # AI 算法：评分函数、决策逻辑
├── ui/                   # 表现层 (DOM 操作、渲染)
│   ├── dom.js           # DOM 引用获取、事件绑定
│   └── render.js        # UI 渲染、状态同步
├── render3d/             # 3D 渲染模块 (Three.js)
│   ├── index.js         # 模块导出入口
│   ├── GomokuRenderer3D.js  # 主渲染器封装
│   ├── SceneManager.js  # 场景生命周期
│   ├── BoardBuilder.js  # 棋盘网格构建
│   ├── StoneBuilder.js  # 棋子几何体与材质
│   ├── CameraController.js  # 相机控制
│   ├── LightingSetup.js # 光照系统
│   ├── AnimationManager.js  # 动画管理
│   ├── InteractionHandler.js # 鼠标/触摸交互
│   ├── EnvironmentBuilder.js # 环境装饰
│   ├── MaterialFactory.js # 材质工厂
│   ├── ParticleSystem.js # 粒子效果
│   └── scenes/          # 场景预设 (home/park/competition)
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
│   └── llmCoach.js      # LLM Coach 服务 (可选外部 API)
└── styles/               # CSS 样式文件
    ├── main.css         # 主样式入口
    ├── base.css         # 基础样式、变量
    ├── layout.css       # 布局
    ├── components.css   # 组件样式
    └── responsive.css   # 响应式适配
```

**模块依赖关系**：
- `app/` 依赖 `game/`、`ui/`、`render3d/`、`audio/`、`services/`
- `game/` 纯逻辑层，仅依赖 `config/` 和 `utils/`
- `ui/` 依赖 `game/` (状态) 和 `render3d/` (3D 渲染)
- `render3d/` 依赖 `config/` 和 Three.js

## 开发命令

```bash
# 安装依赖
npm install

# 启动本地开发服务器 (http://localhost:4173)
npm run serve

# 代码检查
npm run check

# 构建 Web 版本
npm run build

# Electron 桌面应用
npm run start          # 启动 Electron
npm run start:dev      # 开发模式启动 Electron
npm run build:win      # 构建 Windows 版本
npm run build:mac      # 构建 macOS 版本
npm run build:linux    # 构建 Linux 版本
npm run build:all      # 构建全平台

# Android APK
npm run android:sync       # 同步 Web 资源到 Android 工程
npm run android:open       # 打开 Android Studio
npm run android:build:debug  # 构建调试 APK
# 输出：output/android/Gomoku-1.0.0-debug.apk

# 清理构建产物
npm run clean
```

## 代码约定

### 命名规范
- 文件名：PascalCase (类文件如 `GomokuApp.js`) 或 camelCase (模块文件如 `state.js`)
- 类名：PascalCase (`GomokuApp`, `SoundManager`)
- 函数/变量：camelCase (`getBestMove`, `createGameState`)
- 常量：UPPER_SNAKE_CASE (`DEFAULT_OPTIONS`, `DIRECTIONS`)
- CSS 变量：kebab-case (`--cell-size`, --board-color`)

### 模块风格
- 使用 ES Modules (`import`/`export`)
- 每个 `export` 显式声明，避免 `export default`
- 工具函数使用纯函数，无副作用

### 状态管理
- `createGameState()` 创建不可变状态快照
- 状态更新通过 `GomokuApp` 方法集中处理
- 使用 localStorage 持久化用户偏好 (语言、音效、LLM 设置)

### AI 算法
- 基于评分函数的启发式搜索
- 三档难度通过 `getBestMove()` 参数控制随机性
- 禁手检测在 `rules.js` 中实现

## 已知问题与改进建议

### 待改进项

1. **缺少测试框架**
   - 项目当前无测试文件
   - 建议添加：
     - 单元测试：`game/rules.js` (胜负判定、禁手检测)
     - 单元测试：`game/ai.js` (AI 评分逻辑)
     - 集成测试：`app/GomokuApp.js` (游戏流程)
   - 推荐框架：Vitest (ESM 原生支持) 或 Jest

2. **类型安全**
   - 项目使用纯 JavaScript，无类型检查
   - 可选：迁移到 TypeScript 或添加 JSDoc 类型注解

3. **构建优化**
   - 当前构建工具为自定义脚本
   - 可考虑迁移到 Vite 以获得更好的开发体验 (HMR、依赖预构建)

4. **LLM Coach 错误处理**
   - `llmCoach.js` 依赖外部 API，网络异常处理需加强
   - 建议添加重试机制和更详细的错误提示

### 文档资源
- 详细开发文档：`docs/DEVELOPER_GUIDE.md`
- Android 文档：`docs/ANDROID.md`
- 更新日志：`CHANGELOG.md`

## 版本信息

- 当前版本：1.0.0
- 许可证：MIT
