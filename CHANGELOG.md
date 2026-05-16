# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Go rules: 16 new edge-case tests (isEmptyBoard, getNeighbors, getGroup,
  corner capture, out-of-bounds, ko restriction, suicide prevention,
  eye-filling) — total 34 Go rules tests, 836 project-wide
- GitHub CI workflow for automated test verification on push/PR

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
