# Promotional Posts — Multi-Board-Game-Collection

> Ready-to-post content for marketing channels. Edit URLs before posting.

---

## Reddit (r/boardgames, r/gamedev, r/chess, r/baduk)

### Title:
I built a 5-in-1 board game suite with AI coaching and 3D rendering — open source

### Body:
Hey r/boardgames! 👋

I've been working on **Multi-Board-Game-Collection** — an open-source suite that packs **5 classic board games** into one app:

- **Gomoku** (Renju rules with forbidden moves)
- **Go** (Chinese & Japanese scoring, 3D stones)
- **Chess** (full rule set with castling, en passant, promotion)
- **Xiangqi** (Chinese Chess with river & palace rules)
- **Junqi** (Flip Chess — military strategy with hidden pieces)

### What makes it special:
- **Three.js 3D rendering** — realistic board textures, dynamic lighting, piece drop physics with bounce animations, and victory particle effects
- **AI Coach powered by LLM** — connects to any OpenAI-compatible API for real-time move suggestions, strategic analysis, and **post-game reviews** with performance ratings
- **3 difficulty levels** per game with Minimax/Alpha-Beta/MCTS engines
- **Bilingual UI** (English & Chinese)
- **Cross-platform**: Web, Electron Desktop, Android (Capacitor)

Tech stack: vanilla JS + Three.js + Vite + Vitest (1009 tests passing).
- **Piece drop audio SFX** with color-coded sounds and directional panning via SoundManager
- **Difficulty-adaptive coaching** (Easy/Medium/Hard) for beginners to advanced players
- **Move history context** — AI coach sees your recent moves for smarter strategic advice
- **Camera shake** on piece drops for tactile feedback
- **Monte Carlo territory evaluation** in Go AI for stronger hard mode
- **Expanded opening book** for Gomoku with 3-move strategic responses

- **Victory celebrations** — confetti particles, camera shake, board-wide animations on checkmate

Star it on GitHub: https://github.com/SSC-STUDIO/Multi-Board-Game-Collection

Would love feedback from fellow board game enthusiasts! What features would you want next?

---

## Bilibili / V2EX / Zhihu (Chinese)

### Title:
开源五合一棋盘游戏合集 — Three.js 3D 渲染 + AI 教练 + 后复盘分析

### Body:
大家好！分享一个我开发的开源项目：**Multi-Board-Game-Collection（多棋盘游戏合集）**

🎮 **5 款经典棋类游戏**：五子棋（禁手规则）、围棋（中日规则）、国际象棋、中国象棋、军棋翻翻棋

✨ **核心亮点**：
- Three.js 3D 沉浸式棋盘场景（Home/Park/Competition 三种主题）
- AI 教练接入任意 OpenAI 兼容 API，实时提供走子建议、战略分析
- **赛后复盘分析**：游戏结束后自动生成复盘报告，包含关键转折点、双方失误、改进建议和评分
- 落子粒子特效 + 获胜庆祝特效 + 相机跟随聚焦
- 双语 UI（中文/英文）
- 支持 Web、Electron 桌面端、Android APK

📦 技术栈：原生 JavaScript + Three.js + Vite + Vitest（995 个测试全部通过）

GitHub: https://github.com/SSC-STUDIO/Multi-Board-Game-Collection

欢迎 Star 和反馈！有什么想加的功能欢迎评论区讨论 🙌

---

## Steam Store Page Description

**Multi-Board-Game-Collection** is a premium 5-in-1 board game suite featuring:

- 5 classic games: Gomoku, Go, Chess, Xiangqi, Junqi
- Immersive Three.js 3D boards with realistic textures and dynamic lighting
- AI-powered coaching with post-game analysis
- 3 difficulty levels per game
- Beautiful particle effects and smooth camera animations
- Bilingual support (English & Chinese)
- Cross-platform: Web, Desktop, Mobile

**Wishlist now and never miss an update!**

---

## Chiphell

### Title:
[开源] 五合一棋盘游戏 — Three.js 3D + AI 教练 + 赛后复盘

### Body:
折腾了一个开源项目，把五款经典棋盘游戏打包到一起：

五子棋、围棋、国际象棋、中国象棋、军棋翻翻棋

技术栈：原生 JS + Three.js + Vite

亮点功能：
- Three.js 3D 沉浸式渲染，三种场景主题
- AI 教练（接入 OpenAI 兼容 API），实时分析 + 赛后复盘
- 粒子特效系统（落子灰尘 + 获胜爆炸）
- 989 个单元测试，全量通过

GitHub 地址：https://github.com/SSC-STUDIO/Multi-Board-Game-Collection

欢迎提 PR 和反馈！
### New Features (July 2026)

- **Real-Time LLM Coaching for All Games**: Go, Chess, Xiangqi, and Junqi now have in-game coach hint bars showing AI move suggestions, strategic reasoning, and risk assessment during play (QI mode)
- **Camera Shake on Piece Placement**: Subtle camera impact effect when stones/pieces land in 3D mode, adding physicality to every move
- **Gomoku Victory Celebration**: Gold/silver confetti particle burst radiates from the board center when a game is won
- **Post-Game Analysis for All Games**: After any game ends, request a detailed AI review covering turning points, mistakes, strengths, and a performance rating
- **5 Complete Games**: Gomoku (Renju), Go (Chinese/Japanese scoring), Chess (FIDE), Xiangqi, Junqi (Flip Chess)
- **Three.js 3D Scenes**: Home Study, Park Pavilion, Tournament Hall with dynamic lighting, shadows, and particle effects
- **995 Unit Tests**: 100% pass rate across 41 test files
- **Bilingual UI**: English and 简体中文 throughout

## Latest Features for Promotion

### 3D Victory Celebrations
Every game now has stunning 3D victory effects — confetti particles, camera shake, and board-wide celebration animations. Gomoku, Go, Chess, Xiangqi, and Junqi all benefit from the same immersive experience.

### QI Coach Mode
Real-time AI coaching powered by any OpenAI-compatible API. Toggle "QI Coach" in setup to get move suggestions, strategic insights, and risk assessments — in natural language.

### Stats
- 995 unit tests, 100% pass rate
- 41 test files covering all 5 rule engines
- 5 games in one launcher
- 3D scenes: Home Study, Park Pavilion, Tournament Hall


---

## 52Poje / Chiphell (Technical Deep-Dive)

### Title:
从零构建 Five-in-One 棋盘游戏合集 — 技术架构分享

### Body:
最近完成了一个5合1棋盘游戏项目，分享下技术架构和踩坑经验。

**项目架构**：
- 每款游戏独立模块（state/rules/ai/render3d），通过 GameRegistry 动态加载
- 共享基础设施：BoardGameRenderer3D 基类、SceneManager、LightingSetup、AnimationManager
- LLM Coach 服务层：通过 OpenAI 兼容 API 提供实时策略指导

**3D 渲染亮点**：
- Three.js + 自定义 SceneManager（OrbitControls + 自动渲染循环）
- 3种场景预设：Home Study（暖光）、Park Pavilion（自然光）、Tournament Hall（竞技光）
- 材质系统：CanvasTexture 生成木纹棋盘、抛光石材棋子
- 粒子系统：落子特效、胜利庆祝（confetti）、碎片效果

**测试策略**：
- Vitest 995 个单元测试，100% 通过
- 规则引擎全覆盖：Renju禁手、中国/日本围棋计分、国际象棋特殊规则
- Three.js 渲染器测试使用 Mock DOM
- LLM Coach 服务测试使用 API Mock

GitHub: https://github.com/SSC-STUDIO/Multi-Board-Game-Collection

欢迎交流技术细节！
## Updated Feature List (2026-07-07)

- 999 unit tests passing across 41 test files
- LLM Coach now game-specific for all 5 games (Gomoku, Go, Chess, Xiangqi, Junqi)
- Go AI hard mode: 2-ply minimax for stronger territorial play
- Gomoku AI hard mode: center-first opening book + second-move response
- Chess/Xiangqi AI hard mode: depth 5 (up from 4)
- 3D Victory celebrations wired into Chess, Xiangqi, Junqi
- 332 i18n elements fully bilingual (English/Chinese)
- Smooth camera transitions with 5 preset angles
