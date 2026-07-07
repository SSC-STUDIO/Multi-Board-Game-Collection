# Devlog: Multi-Board-Game-Collection — 5-in-1 Board Game Suite with 3D & LLM Coach

## What is this?

A complete board game suite featuring **5 classic games** — Gomoku, Go, Chess, Xiangqi, and Military Flip Chess — all in one beautiful web app. Built with vanilla JavaScript + Three.js, it runs on Web, Desktop (Electron), and Android (Capacitor).

## Highlights

- **5 Games, One Launcher** — Switch between games instantly. Each has its own rule engine, AI, and UI.
- **Immersive 3D** — Gomoku and Go render in Three.js with realistic wood boards, stone textures, dynamic lighting, shadows, and smooth camera controls. Three 3D scenes: Home Study, Park Pavilion, Tournament Hall. Go 3D now features animated stone drops with bounce physics.
- **LLM Coach** — An AI teaching coach powered by any OpenAI-compatible API. It analyzes your position, suggests moves, explains strategy, and provides risk assessment — in natural language. Now supports all 5 games!
- **3 Difficulty Levels** — Easy, Medium, Hard AI opponents for every game. Gomoku uses Minimax + Alpha-Beta pruning; Go evaluates territory; Chess uses piece-square tables; Xiangqi has palace/river-aware evaluation.
- **Full Rules** — Renju forbidden moves in Gomoku, Chinese/Japanese scoring in Go, castling/en passant in Chess, river/palace rules in Xiangqi, flip mechanics in Junqi.
- **1005 Unit Tests** — 100% pass rate across 41 test files. Every rule engine is tested.
- **Bilingual UI** — English and 简体中文, zero text clipping.
- **Multi-Platform** — Web, Windows/Mac/Linux (Electron), Android APK.

## Tech Stack

- Vanilla JavaScript (ES Modules)
- Three.js ^0.164.0 for 3D rendering
- Vite ^8.0.10 for build
- Vitest ^4.1.5 for testing
- Capacitor ^8.3.1 for Android
- Electron ^28.0.0 for Desktop

## LLM Coach — Now for All 5 Games

The biggest recent upgrade: the LLM Coach now works for Go, Chess, Xiangqi, and Junqi too (previously Gomoku-only). Each game gets:
- A game-specific system prompt with rules and move format
- A board image rendered for the LLM (grid boards for Chess/Xiangqi, intersection boards for Gomoku/Go/Junqi)
- Real-time strategic advice in natural language

## How to Try It

`ash
git clone https://github.com/SSC-STUDIO/Multi-Board-Game-Collection.git
cd Multi-Board-Game-Collection
npm install
npm run dev
`

Open http://localhost:5173 in your browser. Pick a game and start playing!

## Star Us

If you find this useful, please give us a star on GitHub. It helps us keep building!

[GitHub](https://github.com/SSC-STUDIO/Multi-Board-Game-Collection)

---

*Built with passion for board games and open-source software.*

### Previous Sprint
## New This Sprint (2026-07-07)

### 3D Victory Celebrations (All Board Games)
- Added showVictoryCelebration() method to BoardGameRenderer3D shared base class
- Chess, Xiangqi, and Junqi now fire shatter particle effects across the board grid on checkmate
- Color-mapped winner colors: Chess (white/black), Xiangqi (red/black), Junqi (red/black)

### Go 3D Ambient Particles
- GoRenderer3D now hooks into the SceneManager render loop via onBeforeRender
- Emits ambient floating particles every 4 seconds for an atmospheric effect
- Properly cleans up the render loop on dispose

### AI Difficulty Descriptions
- Added bilingual difficulty level descriptions (EN/ZH) for all 3 levels
- Easy: Random moves for beginners | Medium: Minimax + Alpha-Beta with basic tactics | Hard: Deep search with full board evaluation
- Added dynamic description element in the Gomoku setup UI that updates when switching levels

- **LLM Post-Game Analysis**: After any game, the AI coach now provides a detailed post-game review — key turning points, mistakes by both sides, what you did well, areas for improvement, and a performance rating out of 10.
- **Victory Particle Effects**: When a game ends, the winning line explodes with a shatter particle effect, and the camera smoothly zooms to the winning move.
- **Drop Particle Dust**: Every piece drop now triggers a subtle dust particle effect for added immersion.
- **Camera Follow-Zoom**: The camera automatically focuses on the last placed piece across all 5 games.
- **All 5 Games Fully Supported**: LLM Coach, post-game analysis, and 3D particles now work for Gomoku, Go, Chess, Xiangqi, and Junqi.
### Real-Time LLM Coaching for All Games (July 2026)
- **Real-Time Coach for Go/Chess/Xiangqi/Junqi**: Each non-Gomoku game now has an in-game coach hint bar that shows LLM-powered move suggestions, reasons, and risk assessment during play (QI mode)
- **CoachController Integration**: All 4 non-Gomoku game apps now instantiate CoachController, wire coaching into move handlers, and render coaching state after each human move
- **GameCoach DOM Mapping**: New `buildGameCoachMapping()` helper in `dom.js` creates per-game DOM references for coach hint bars using `data-game-*` attribute selectors
- **Base Class Coaching Methods**: `BoardGameApp` now provides `isGuidedMode()`, `cancelLlmCoachRequest()`, `refreshCoachGuidance()`, `clearCoachState()`, and `render()` as base methods for all games
- **CSS Styling**: New `.game-coach-hint` CSS class with glassmorphism design matching the existing coach card aesthetic

### Camera Shake on Piece Placement (3D Polish)
- **CameraController.playCameraShake()**: New method adds a subtle randomized camera displacement that decays over time, triggered on every piece drop in 3D mode
- Configurable intensity (default 0.04) and duration (0.15s) — respects prefers-reduced-motion

### Gomoku Victory Celebration Particles
- **showVictoryCelebration()**: GomokuRenderer3D now emits a burst of 40 gold/silver confetti particles radiating from the board center when a game is won
- **emitVictoryParticles()**: New ParticleSystem method creates celebratory particles with upward velocity and gravity decay
- Wired into `playVictorySequence()` with a 400ms delay after camera victory focus

### Test & Build Status
- **1005/1005 tests passing** across 41 test files
- **Build clean**: 139 files, zero errors

## New: 3D Victory Celebrations (All Games)

Every game now has immersive 3D victory effects:

- **Confetti Particles** — Gold/silver confetti bursts in a ring pattern when you win
- **Camera Shake** — Subtle screen shake on piece placement (respects prefers-reduced-motion)
- **Shatter Effects** — Board-wide celebration on checkmate, capture, or resignation
- **Cross-Game Parity** — Chess, Xiangqi, and Junqi now match Gomoku's 3D victory experience

## New: QI Coach Mode (All 5 Games)

The AI coaching system now works in QI (指导) mode for every game:

- **Go** — Territory analysis, corner/side strategies, capture risk assessment
- **Chess** — Opening theory, tactical motifs, endgame technique
- **Xiangqi** — River crossing strategy, palace defense, piece coordination
- **Junqi** — Flag protection, annihilation tactics, flip probability analysis

Toggle QI Coach in any game's setup screen — the coach analyzes positions in real-time and provides natural-language strategic advice powered by any OpenAI-compatible LLM API.

## Game-Specific Post-Game Analysis (2026-07-07)

- LLM Coach buildPostGameRequest now accepts gameType and injects game-specific strategic prompts for all 5 games
- System prompt dynamically selects the right game role and strategy focus
- User message includes game type label for LLM context
- Tests updated: 999 passing across 41 test files

## Go AI 2-Ply Minimax + Gomoku Opening Book (2026-07-07)

- Go AI hard mode now uses 2-ply minimax search for stronger territorial play
- Gomoku AI hard mode includes center-first opening book and second-move response
- Both improvements make hard difficulty significantly more challenging

## 1002 Tests Milestone (2026-07-08)

- Junqi AI defensive mode tests added (hard/medium/empty board)
- Total test count now 1002 across 41 test files
- All 5 games now have AI engine tests
