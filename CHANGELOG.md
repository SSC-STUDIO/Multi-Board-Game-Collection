# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### New This Sprint
- **AI Search Improvements**: Transposition tables for all 5 games + killer moves for Chess/Xiangqi
- **Chess & Xiangqi Killer Move Heuristic**: Both games now store top 2 killer moves per depth for better alpha-beta pruning
- **GitHub Community Templates**: Bug report, feature request, PR templates, CODEOWNERS, SECURITY.md, CONTRIBUTING.md
- **Go AI Territory Evaluation**: Monte Carlo territory evaluation with alive group scoring and random playout sampling for hard mode
- **Gomoku Opening Book**: Expanded with 3-move strategic responses (diagonal/orthogonal counters)
- **3D Camera Shake**: BoardGameRenderer3D now triggers a subtle camera shake when pieces land, with decay-based random offset restoring position after 160ms
- **Dead Code Cleanup**: Removed unused pgConfig variable from LLM Coach post-game analysis
- **Test Count**: 1005 tests across 41 files
- **Go Post-Game Analysis**: GoApp now supports LLM-powered post-game analysis via the result overlay button, with bilingual error handling
- **Renderer3D Unit Tests**: 6 new tests for `showVictory` and `showVictoryCelebration` methods on `BoardGameRenderer3D`
- **Post-Game Analysis UI**: Added 'Request Post-Game Analysis' button to all 5 game result overlays, wired to CoachController LLM analysis with structured summary display panel
- **AI Difficulty Tooltips**: Bilingual difficulty level descriptions (EN/ZH) for Easy/Medium/Master with dynamic display in Gomoku setup UI
- **3D Victory Celebration**: `showVictoryCelebration()` on `BoardGameRenderer3D` fires shatter particles across the board grid on checkmate for Chess, Xiangqi, and Junqi
- **Go 3D Ambient Particles**: `GoRenderer3D` now hooks into the render loop with periodic ambient particle emissions every 4 seconds

### Added
- **LLM Post-Game Analysis**: AI-powered game review with structured feedback (summary, turning points, mistakes, strengths, improvements, performance rating)
- **Victory Particle Effects**: Shatter particle system for winning line celebrations across all 5 games
- **Drop Particle Dust**: Immersive stone/piece placement particle effects
- **Ambient Particles**: Background particle atmosphere in all 3D scenes
- **Camera Follow-Zoom**: Automatic focus on last placed piece and winning line center
- **Multi-Game LLM Coach**: Full support for all 5 games with game-specific prompts and board image rendering
- **Promotional Materials**: Reddit, Bilibili, V2EX, Zhihu, Chiphell ready-to-post content
- **Knowledge Base**: 11 architecture rules documenting design decisions
- Go rules: 16 new edge-case tests (isEmptyBoard, getNeighbors, getGroup,
  corner capture, out-of-bounds, ko restriction, suicide prevention,
  eye-filling) — total 34 Go rules tests, 836 project-wide
- GitHub CI workflow for automated test verification on push/PR
- App-level tests: GoApp (24 tests covering constructor, lifecycle,
  panel switching, star points, formatResult, commitMove), ChessApp
  (24 tests covering promotion overlay, describeMove, formatResult,
  setup visibility, lifecycle), XiangqiApp (19 tests covering same
  lifecycle and result formatting), JunqiApp (18 tests covering
  variant selector, first-flip turn handling, formatResult,
  refreshSetupVisibility)
- **Test suite**: 923 tests across 39 files, all passing

## [1.0.0] - 2026-05-16

### Added
- **5-game platform**: Unified launcher with Gomoku, Go, Chess, Xiangqi,
  Junqi (Flip Chess) — each game has its own setup panel, game section,
  and state management
- **Go (围棋)**: Chinese/Japanese scoring rules (area/territory selection),
  9/13/19路 boards, handicap system, 3D rendering (Three.js), last-move
  highlight + ko marker, territory visualization in scoring phase
- **Gomoku (五子棋)**: Renju forbidden-move rules, 3D rendering (Three.js)
  with three scene presets (home/park/competition), LLM Coach (Qi guidance),
  three AI difficulty levels, first-run guide, immersive HUD mode, three
  game modes (PvP/PvE/practice)
- **Chess (国际象棋)**: Full rule engine (castling, en passant, promotion),
  AI with alpha-beta search + mate-in-1 pre-check, piece move validation
- **Xiangqi (中国象棋)**: Full rule engine (palace/river/cannon screen/
  flying-general), AI depth-4 search
- **Junqi Flip (军棋翻翻棋)**: Flip-and-capture mechanics, cannon screen
  rules, stalemate detection
- **Cross-platform packaging**: Android (Capacitor ^8.3.1), Desktop
  (Electron ^28.0.0 + electron-builder ^24.9.1)
- **Sound system**: Web Audio API, UI tap/placement/hint/undo/win sounds,
  persistent mute toggle
- **i18n**: Chinese + English locale support, HUD/camera/help all localized
- **First-run guide**: Desktop/mobile contextual onboarding card

### Fixed
- **Runtime CSS loading**: Replaced broken ESM CSS import (`import './styles/main.css'`)
  with HTML `<link>` tags — previously the entire app would fail to load in
  browsers without a bundler
- **Three.js module resolution**: Added importmap for `three` and
  `three/addons/` bare specifiers — 3D scenes (Gomoku/Go) previously failed
  silently without a bundler
- **Chess AI timeout**: Added mate-in-1 pre-check in `getChessAIMove()`
  before entering depth-4 alpha-beta search; empty-board+queen scenarios
  dropped from ~5000ms to 178ms
- **GameController.test.js mock mismatch**: 20 test failures fixed —
  mocks expected `app.showMessageKey`/`app.setAIThinking` but actual
  implementation delegates to render module directly
- **SettingsController.test.js mock mismatch**: 11 test failures fixed —
  missing `querySelector`, `Set.remove()` used on DOM classList,
  `mockReturnValue` leakage across tests, sync `setTimeout` interference

### Changed
- **Project identity**: Renamed from `gomoku` to `board-games` in
  package.json; README and CLAUDE.md rewritten from single-game to 5-game
  platform description
- **Project structure**: Migrated from single-game architecture to
  `src/games/{gomoku,go,chess,xiangqi,junqi/}` modular layout
- **Test coverage**: Expanded from 0 unit tests to 836 tests across 35 files
  covering all 5 game rule engines, AI modules, state factories, controllers,
  UI rendering, i18n, LLM Coach, and sound manager
- **`.gitignore`**: Added Playwright output, screenshots, temp scripts,
  and Node.js standard patterns

### Removed
- Outdated Steam/Steamworks preparation content from CHANGELOG (project
  is a web-based board games collection, not a Steam title)

---
### New This Sprint (continued)
- **Real-Time LLM Coaching for Non-Gomoku Games**: Go, Chess, Xiangqi, Junqi now have in-game coach hint bars showing LLM-powered move suggestions, reasons, and risk assessment during QI mode play
- **GameCoach DOM Mapping**: New `buildGameCoachMapping()` helper in `dom.js` creates per-game DOM references for coach hint bars using `data-game-*` attribute selectors
- **Base Class Coaching Methods**: `BoardGameApp` now provides `isGuidedMode()`, `cancelLlmCoachRequest()`, `refreshCoachGuidance()`, `clearCoachState()`, and `render()` as base methods for all games
- **Camera Shake on Piece Placement**: `CameraController.playCameraShake()` adds subtle randomized camera displacement on every piece drop in 3D mode
- **Gomoku Victory Celebration Particles**: `showVictoryCelebration()` emits 40 gold/silver confetti particles radiating from board center on win
- **Victory Particle System**: New `emitVictoryParticles()` method in ParticleSystem with upward velocity and gravity decay
- **CSS Styling**: New `.game-coach-hint` class with glassmorphism design for non-Gomoku coach UI

### New This Session (Sprint Update)
- ✅ 3D victory celebrations for Chess, Xiangqi, Junqi (confetti + camera shake)
- ✅ QI Coach mode wired for Go, Chess, Xiangqi, Junqi setup screens
- ✅ game.mode.qi i18n key added to en-US and zh-CN
- ✅ .game-coach-hint glassmorphism UI styles
- ✅ playVictorySequence() added to BoardGameRenderer3D base class
- ✅ 995 tests passing across 41 test files

### Game-Specific Post-Game Analysis
- LLM Coach post-game analysis now uses game-specific strategic prompts
- Each of 5 games gets tailored expert analysis
