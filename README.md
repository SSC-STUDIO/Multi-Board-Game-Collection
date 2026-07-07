<div align="center">

# 🎮 多款棋盘游戏合集 / Multi-Board Game Collection

**5 classic board games • Immersive Three.js 3D • LLM AI Coach • Cross-platform**

[![Stars](https://img.shields.io/github/stars/SSC-STUDIO/Multi-Board-Game-Collection?style=social)](https://github.com/SSC-STUDIO/Multi-Board-Game-Collection)
[![Steam](https://img.shields.io/badge/Steam-Wishlist-blue?logo=steam&logoColor=white)](https://store.steampowered.com/)
[![Demo](https://img.shields.io/badge/Live-Demo-black?logo=githubpages&logoColor=white)](https://ssc-studio.github.io/Multi-Board-Game-Collection/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-1.0.0-orange.svg)](version.json)
[![Tests](https://img.shields.io/badge/Tests-1015%20-passing-brightgreen.svg)]()
[![3D](https://img.shields.io/badge/Three.js-3D%20Rendering-blueviolet.svg)](https://threejs.org/)

[English](#english) | [简体中文](#简体中文)

<img src="assets/screenshots/screenshot_01.png" alt="游戏截图" width="600"/>

</div>

---

## 简体中文

### 游戏简介

本项目是一个多款棋盘游戏合集，集成五子棋、围棋、国际象棋、中国象棋和军棋翻翻棋于一体。通过统一的启动器界面选择游戏，每款游戏拥有独立的规则引擎和应用模块，为玩家提供多样化的对弈体验。

- **五子棋 (Gomoku)** — 连五即胜的经典棋类，支持禁手规则与智能AI
- **围棋 (Go)** — 古老的策略游戏，围地取胜，支持中国规则与日本规则计分
- **国际象棋 (Chess)** — 全球流行的棋类运动，完整的棋子走法与特殊规则
- **中国象棋 (Xiangqi)** — 中国传统棋艺，楚河汉界两侧红黑对弈
- **军棋翻翻棋 (Junqi/Flip)** — 基于运气的军事题材翻棋游戏，翻开棋子方可移动

### 核心特性

#### 多游戏支持
- 统一的启动器界面，一键切换游戏
- 游戏按需懒加载，优化启动性能
- 每款游戏独立运行，互不干扰

#### 丰富的对局模式
- **人人对战** — 与好友面对面博弈，享受真人对抗的乐趣
- **人机对战** — 挑战智能AI（五子棋支持三档难度）
- **练习模式** — 自由探索棋局变化，提升战术技巧

#### 灵活的规则选择
- 五子棋：经典规则与禁手规则（三三、四四、长连）
- 围棋：中国规则与日本规则计分
- 国际象棋：完整FIDE国际规则
- 中国象棋：完整传统规则
- 军棋翻翻棋：经典翻翻棋规则

#### 多渲染引擎
- 2D渲染：国际象棋、中国象棋、军棋翻翻棋
- 3D渲染：五子棋与围棋支持Three.js沉浸式3D场景
- 3D音效：棋子落子音效(SoundManager)，方向性声像定位
- 五子棋3D场景预设：家、公园、比赛现场
- 现代化UI设计，流畅动画效果

#### 实用辅助功能
- 悔棋 — 回退不当落子，重新思考策略
- 提示 — AI推荐最佳落子位置（部分游戏）
- 换边 — 随时切换执子方
- 认输 — 投子认负，快速结束对局
- 完整棋谱记录 — 复盘学习

### 项目结构

```text
.
├── index.html              # 主入口（启动器）
├── capacitor.config.json   # Capacitor Android 配置
├── android                 # Android 原生工程
├── src
│   ├── main.js            # 应用入口，启动器初始化
│   ├── app                # 应用层
│   │   ├── GomokuApp.js   # 五子棋应用（向后兼容）
│   │   └── controllers/   # 核心控制器
│   ├── games              # 各游戏独立模块
│   │   ├── registry.js    # 游戏注册表
│   │   ├── gomoku/        # 五子棋（state/rules/ai）
│   │   ├── go/            # 围棋（state/rules/ai/scoring）
│   │   ├── chess/         # 国际象棋（state/rules/ai）
│   │   ├── xiangqi/       # 中国象棋（state/rules/ai）
│   │   └── junqi/         # 军棋翻翻棋（state/rules/ai）
│   ├── ui                 # 表现层
│   ├── render3d           # 3D渲染（Three.js）
│   ├── utils              # 工具层
│   ├── config             # 配置层
│   ├── audio              # 音效
│   ├── services           # 服务（LLM Coach）
│   └── styles             # 样式文件
├── assets                 # 游戏资源
├── locales                # 本地化文件
├── steam                  # Steam 配置
├── tools                  # 构建工具脚本
└── docs                   # 文档
```

### 系统要求

#### 最低配置
- **操作系统**: Windows 7 SP1 / macOS 10.13 / Linux (任意主流发行版)
- **处理器**: Intel Core i3 或同等性能
- **内存**: 2 GB RAM
- **显卡**: 支持现代浏览器的集成显卡
- **存储空间**: 100 MB 可用空间

#### 推荐配置
- **操作系统**: Windows 10 / macOS 12 / Linux (Ubuntu 20.04+)
- **处理器**: Intel Core i5 或更高
- **内存**: 4 GB RAM
- **显卡**: 支持现代浏览器的独立显卡
- **存储空间**: 200 MB 可用空间

### 快速开始

#### Web版本
```bash
# 克隆仓库
git clone https://github.com/SSC-STUDIO/Multi-Board-Game-Collection.git
cd Multi-Board-Game-Collection

# 安装依赖（可选）
npm install

# 启动本地服务器
npm run serve

# 浏览器访问
# http://localhost:4173
```

#### Android APK
```bash
npm install
npm run android:build:debug
```

可直接安装的 APK 输出到 `output/android/BoardGames-1.0.0-debug.apk`，原始 Gradle 产物在 `android/app/build/outputs/apk/debug/app-debug.apk`。LLM 本地服务地址说明见 [Android APK 文档](docs/ANDROID.md)。

#### 桌面版本（Steam）
1. 访问Steam商店页面（即将开放）
2. 购买并下载游戏
3. 安装后即可开始游戏

### 开发相关

#### 技术栈
- **前端**: 原生JavaScript (ES Modules)
- **样式**: 原生CSS (CSS Variables)
- **3D渲染**: Three.js ^0.164.0
- **测试**: Vitest
- **架构**: 分层模块化设计
- **打包**: Capacitor (Android APK)、Electron (桌面版本)

#### 本地开发
```bash
# 运行开发服务器
npm run serve

# 运行代码检查
npm run check

# 运行测试
npm run test

# 构建Web版本
npm run build

# 构建桌面版本
npm run build:desktop
```

详细开发文档请查看 [开发者指南](docs/DEVELOPER_GUIDE.md)。

### 更新日志

查看 [CHANGELOG.md](CHANGELOG.md) 了解详细的版本更新历史。

#### v1.0.0 (即将发布)
- 多游戏启动器，支持五子棋、围棋、国际象棋、中国象棋、军棋翻翻棋
- 人人对战、人机对战、练习模式
- 五子棋经典规则和禁手规则，围棋中国规则和日本规则
- 三种AI难度等级（五子棋）
- 现代化UI设计
- 完整的辅助功能
- 跨平台支持（Web / Android / 桌面端）

### 贡献指南

我们欢迎所有形式的贡献！请查看 [CONTRIBUTING.md](CONTRIBUTING.md) 了解如何：

- 报告Bug
- 提出新功能建议
- 改进文档
- 设计游戏资源
- 贡献代码

### 许可证

本项目采用 [MIT License](LICENSE) 开源协议。

您可以自由地：
- 商业使用
- 修改代码
- 分发副本
- 私人使用

唯一的要求是保留原始版权声明。

### 联系我们

- **GitHub Issues**: [提交问题](https://github.com/SSC-STUDIO/Multi-Board-Game-Collection/issues)
- **官方网站**: (即将开放)

### 致谢

感谢所有为这个项目做出贡献的开发者、设计师和玩家！

特别感谢：
- 棋盘游戏爱好者社区
- Three.js 框架
- Electron 框架
- 所有开源项目贡献者

---

## English


### Games at a Glance

| Game | Board | Rules | 3D | AI Levels | LLM Coach |
|------|-------|-------|:---:|:---------:|:---------:|
| **Gomoku** (Five in a Row) | 15×15 | Renju + forbidden moves | ✅ | 3 | ✅ |
| **Go** (Weiqi/Baduk) | 9/13/19 | Chinese + Japanese scoring | ✅ | 3 | ✅ |
| **Chess** (International) | 8×8 | Full FIDE rules | ❌ | 3 | ✅ |
| **Xiangqi** (Chinese Chess) | 9×10 | River + palace rules | ❌ | 3 | ✅ |
| **Junqi** (Military Chess) | 6×10 | Flip-reveal mechanics | ❌ | 3 | ✅ |

### About

This is a multi-board game collection featuring Gomoku, Go, Chess, Xiangqi, and Junqi (Flip) in one unified launcher. Each game has its own independent rules engine and application module, providing diverse board game experiences.

- **Gomoku** — Classic five-in-a-row with Renju rule support and AI opponents
- **Go** — Ancient territory-capturing strategy game with Chinese and Japanese scoring
- **Chess** — Globally popular chess with complete piece movement and special rules
- **Xiangqi** — Traditional Chinese chess with river-separated red/black gameplay
- **Junqi (Flip)** — Luck-based military-themed flip chess

### Key Features

#### Multi-Game Support
- Unified launcher interface, switch games with one click
- Games are lazy-loaded on demand for optimal performance
- Each game runs independently without interference

#### Game Modes
- **Player vs Player** — Face-to-face competition with friends
- **Player vs AI** — Challenge intelligent AI opponents (3 difficulty levels for all games)
- **Practice Mode** — Explore game variations freely

#### Flexible Rules
- Gomoku: Classic rules and Renju rules (3-3, 4-4, overline)
- Go: Chinese and Japanese scoring rules
- Chess: Complete FIDE international rules
- Xiangqi: Complete traditional rules
- Junqi: Classic flip chess rules

#### Multiple Render Engines
- 2D rendering for Chess, Xiangqi, and Junqi
- 3D rendering for Gomoku and Go using Three.js
- Gomoku 3D scene presets: Home, Park, Competition
- Modern UI design with smooth animations

#### Smart Assistance
- Undo — Take back moves and rethink strategy
- Hint — AI recommends best moves (select games)
- Swap Sides — Switch colors anytime
- Resign — Concede the game
- Complete move history for review


#### Quality Assurance
- **1015 unit tests** across 41 test files — 100% pass rate
- Rule engine tests: Renju forbidden moves, Chinese/Japanese Go scoring, Chess castling/en passant, Xiangqi river/palace rules, Junqi flip mechanics
- Three.js renderer tests with mock DOM
- LLM Coach service tests with API mocking
#### Cross-Platform
- Web version (browser play)
- Android APK
- Desktop versions (Windows, macOS, Linux via Electron)
- Steam platform (coming soon)

### Quick Start

```bash
# Clone repository
git clone https://github.com/SSC-STUDIO/Multi-Board-Game-Collection.git
cd Multi-Board-Game-Collection

# Start local server
npm run serve

# Visit in browser
# http://localhost:4173
```

### Android APK

```bash
npm install
npm run android:build:debug
```

The debug APK is generated at `android/app/build/outputs/apk/debug/app-debug.apk`.
The side-load friendly copy is `output/android/BoardGames-1.0.0-debug.apk`.
See [Android APK docs](docs/ANDROID.md) for install steps and LLM endpoint notes.

### System Requirements

#### Minimum
- **OS**: Windows 7 SP1 / macOS 10.13 / Linux
- **Processor**: Intel Core i3 or equivalent
- **Memory**: 2 GB RAM
- **Storage**: 100 MB available space

#### Recommended
- **OS**: Windows 10 / macOS 12 / Linux (Ubuntu 20.04+)
- **Processor**: Intel Core i5 or better
- **Memory**: 4 GB RAM
- **Storage**: 200 MB available space

### Development

```bash
# Run development server
npm run serve

# Run code checks
npm run check

# Run tests
npm run test

# Build for web
npm run build

# Build for desktop
npm run build:desktop
```


#### AI Engine Features

All 5 games feature intelligent AI opponents with three difficulty levels:

| Game | Easy | Medium | Hard |
|------|------|--------|------|
| **Gomoku** | Random top-6 | Minimax depth 2 | Adaptive depth 2-4 + 3-move opening book |
| **Go** | Random top-6 | Random top-3 | 2-ply minimax + territory eval + transposition table |
| **Chess** | Depth 1 | Depth 3 | Depth 5 + MVV-LVA + killer move heuristic |
| **Xiangqi** | Depth 1 | Depth 3 | Depth 5 + positional bonuses + killer moves |
| **Junqi** | Random top-6 | Random top-3 | Best-move + defensive flag protection |

**Advanced AI Features:**
- Alpha-beta pruning with killer move heuristics (Chess, Xiangqi)
- Monte Carlo territory evaluation (Go hard mode)
- Opening book with strategic responses (Gomoku)
- Piece-square tables for positional evaluation (Chess, Xiangqi)
- Defensive mode with flag protection (Junqi)
- Adaptive search depth based on game phase (Gomoku)

#### Tech Stack
- **Frontend**: Vanilla JavaScript (ES Modules)
- **Styling**: Vanilla CSS (CSS Variables)
- **3D Rendering**: Three.js ^0.164.0
- **Testing**: Vitest
- **Architecture**: Layered modular design
- **Packaging**: Capacitor (Android APK), Electron (Desktop)

### Changelog

See [CHANGELOG.md](CHANGELOG.md) for detailed version history.

#### v1.0.0 (Coming Soon)
- Multi-game launcher supporting Gomoku, Go, Chess, Xiangqi, Junqi
- Player vs Player, Player vs AI, Practice modes
- Classic and Renju rules for Gomoku, Chinese and Japanese scoring for Go
- Three AI difficulty levels (all 5 games with advanced heuristics)
- Modern UI design
- Complete assist features
- Cross-platform support (Web / Android / Desktop)

### Contributing

We welcome all forms of contribution! Please see [CONTRIBUTING.md](CONTRIBUTING.md) to learn how to:

- Report bugs
- Suggest new features
- Improve documentation
- Design game assets
- Contribute code

### License

This project is licensed under the [MIT License](LICENSE).
### Roadmap

- [ ] 3D rendering for Chess, Xiangqi, and Junqi
- [ ] Shogi (Japanese Chess) implementation
- [ ] Othello/Reversi implementation
- [ ] Online multiplayer via WebSockets
- [ ] AI commentary during games
- [ ] Tournament mode with bracket system
- [ ] Custom piece themes and board skins
- [ ] Sound effects for piece placement
- [ ] Keyboard navigation and accessibility improvements
- [ ] iOS app via Capacitor

---

<div align="center">

**如果喜欢这个项目,请给我们一个 Star!**

Made with love by [Your Name]

[Steam](https://store.steampowered.com/) | [GitHub](https://github.com/SSC-STUDIO/Multi-Board-Game-Collection) | [Documentation](docs/DEVELOPER_GUIDE.md)

</div>
