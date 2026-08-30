<div align="center">

# 🎮 Board Games 合集 / Multi-Board Game Collection

**五子棋 & 围棋 • Three.js 3D 对弈桌面 • LLM AI 教练 • 跨平台**

[![Demo](https://img.shields.io/badge/Live-Demo-black?logo=githubpages&logoColor=white)](https://ssc-studio.github.io/Multi-Board-Game-Collection/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-1.0.0-orange.svg)](version.json)
[![Tests](https://img.shields.io/badge/Tests-821%20passing-brightgreen.svg)]()
[![3D](https://img.shields.io/badge/Three.js-3D%20Rendering-blueviolet.svg)](https://threejs.org/)

[English](#english) | [简体中文](#简体中文)

<img src="assets/screenshots/screenshot_01.png" alt="游戏截图" width="600"/>

</div>

---

## 简体中文

### 游戏简介

本项目是五子棋与围棋的合集：从统一的 3D 启动器进入游戏，每款棋拥有独立的规则引擎与应用模块，共享同一套 Three.js 桌面布景。

- **五子棋 (Gomoku)** — 15×15 连五即胜，支持禁手规则（三三、四四、长连）、三档 AI 难度与 QI 指导
- **围棋 (Go)** — 9/13/19 路棋盘，中国规则与日本规则计分，支持让子、形势判断与 AI 对弈

### 核心特性

- **统一启动器** — 一键切换游戏，模块按需懒加载
- **多种模式** — 人人对战、人机对战（三档难度）、练习模式
- **3D 对弈桌面** — 共用桌面布景，家 / 公园 / 比赛三种氛围（光照、雾、相机、色调），IBL 环境光照提升棋子质感
- **LLM AI 教练** — 可选接入外部 LLM API，落子建议、风险提示与终局复盘
- **实用辅助** — 悔棋、提示、换边、认输、完整棋谱记录
- **音效** — Web Audio 落子音效与方向性声像定位
- **双语界面** — 简体中文 / English 完整覆盖

### 项目结构

```text
.
├── index.html              # 主入口（启动器）
├── sw.js                   # PWA Service Worker
├── capacitor.config.json   # Capacitor Android 配置
├── android/                # Android 原生工程
├── src/
│   ├── main.js             # 应用入口，启动器初始化
│   ├── app/                # 应用层（GomokuApp + 控制器）
│   ├── games/
│   │   ├── registry.js     # 游戏注册表
│   │   ├── gomoku/         # 五子棋（state/rules/ai）
│   │   └── go/             # 围棋（state/rules/ai/scoring + 3D）
│   ├── ui/                 # 表现层
│   ├── render3d/           # 3D 渲染（Three.js，含 scenes/tabletop.js）
│   ├── utils/              # 工具层（i18n、棋盘坐标等）
│   ├── config/             # 配置层
│   ├── audio/              # 音效
│   ├── services/           # 服务（LLM Coach、AI 解说）
│   └── styles/             # 样式文件
├── locales/                # 本地化文件
├── steam/                  # Steam 配置
├── tools/                  # 构建工具脚本
└── docs/                   # 文档
```

### 快速开始

#### Web 版本

```bash
git clone https://github.com/SSC-STUDIO/Multi-Board-Game-Collection.git
cd Multi-Board-Game-Collection
npm install
npm run serve
# 浏览器访问 http://localhost:4173
```

#### Android APK

```bash
npm install
npm run android:build:debug
```

可直接安装的 APK 输出到 `output/android/BoardGames-1.0.0-debug.apk`，原始 Gradle 产物在 `android/app/build/outputs/apk/debug/app-debug.apk`。LLM 本地服务地址说明见 [Android APK 文档](docs/ANDROID.md)。

#### 桌面版本 (Electron)

```bash
npm run start        # 开发模式
npm run build:win    # 构建 Windows 版本
npm run build:linux  # 构建 Linux 版本
```

### 开发相关

- **前端**: 原生 JavaScript (ES Modules)
- **样式**: 原生 CSS (CSS Variables)
- **3D 渲染**: Three.js ^0.164.0
- **测试**: Vitest（821 个测试 / 34 个文件）
- **打包**: Capacitor (Android)、Electron (桌面)

```bash
npm run serve   # 开发服务器
npm run check   # 代码检查
npm test        # 运行测试
npm run build   # 构建 Web 版本
```

详细开发文档请查看 [开发者指南](docs/DEVELOPER_GUIDE.md)。

### 更新日志

查看 [CHANGELOG.md](CHANGELOG.md) 了解详细的版本更新历史。

### 贡献指南

欢迎所有形式的贡献！请查看 [CONTRIBUTING.md](CONTRIBUTING.md) 了解如何报告 Bug、提出建议、改进文档与贡献代码。

### 许可证

本项目采用 [MIT License](LICENSE) 开源协议，保留原始版权声明即可自由使用、修改与分发。

---

## English

### About

A two-game board game collection: Gomoku and Go, entered from a unified 3D launcher. Each game ships its own rules engine and app module while sharing one Three.js tabletop environment.

- **Gomoku (Five in a Row)** — 15×15 board, Renju forbidden moves (3-3, 4-4, overline), three AI levels, QI coaching mode
- **Go (Weiqi/Baduk)** — 9/13/19 boards, Chinese and Japanese scoring, handicap stones, AI opponents

### Games at a Glance

| Game | Board | Rules | 3D | AI Levels | LLM Coach |
|------|-------|-------|:---:|:---------:|:---------:|
| **Gomoku** | 15×15 | Renju + forbidden moves | ✅ | 3 | ✅ |
| **Go** | 9/13/19 | Chinese + Japanese scoring | ✅ | 3 | ✅ |

### Key Features

- **Unified launcher** — switch games with one click, modules lazy-loaded on demand
- **Game modes** — Player vs Player, Player vs AI (3 difficulty levels), Practice
- **Shared 3D tabletop** — one tabletop environment with three moods (Home / Park / Competition: lighting, fog, camera, tone) plus image-based lighting (IBL) for richer PBR reflections
- **LLM AI Coach** — optional external LLM API for move advice, risk hints, and post-game review
- **Assistance** — undo, hint, swap sides, resign, full move history
- **Audio** — Web Audio piece-drop SFX with directional panning
- **Fully bilingual** — complete English & Simplified Chinese

### AI Engines

| Game | Easy | Medium | Hard |
|------|------|--------|------|
| **Gomoku** | Random top-6 | Minimax depth 2 | Adaptive depth 2-4 + opening book |
| **Go** | Random top-6 | Random top-3 | 2-ply minimax + Monte Carlo territory eval + transposition table |

### Quick Start

```bash
git clone https://github.com/SSC-STUDIO/Multi-Board-Game-Collection.git
cd Multi-Board-Game-Collection
npm install
npm run serve
# Visit http://localhost:4173
```

Android: `npm run android:build:debug` (APK at `output/android/BoardGames-1.0.0-debug.apk`, see [Android docs](docs/ANDROID.md)).
Desktop: `npm run start` for development, `npm run build:win` / `npm run build:linux` for packages.

### Development

- **Frontend**: Vanilla JavaScript (ES Modules)
- **Styling**: Vanilla CSS (CSS Variables)
- **3D Rendering**: Three.js ^0.164.0
- **Testing**: Vitest — 821 tests across 34 files
- **Packaging**: Capacitor (Android), Electron (Desktop)

```bash
npm run serve   # dev server
npm run check   # module syntax check
npm test        # run tests
npm run build   # build web bundle
```

### Roadmap

- [ ] Re-expand the collection (Chess, Xiangqi, Junqi, Shogi, Othello, ...)
- [ ] Online multiplayer via WebSockets
- [ ] Custom piece themes and board skins
- [ ] iOS app via Capacitor
- [x] Shared 3D tabletop with scene moods
- [x] Image-based lighting (IBL)
- [x] Difficulty-adaptive LLM coaching
- [x] Keyboard navigation and accessibility improvements

### License

[MIT License](LICENSE).

---

<div align="center">

**如果喜欢这个项目，请给我们一个 Star! / If you like this project, give it a star!**

[GitHub](https://github.com/SSC-STUDIO/Multi-Board-Game-Collection) | [Documentation](docs/DEVELOPER_GUIDE.md)

</div>
