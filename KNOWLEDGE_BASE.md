# Knowledge Base — Multi-Board-Game-Collection

> Lessons learned during development. Referenced by .bugs/ queue and handover protocol.

---

## RULE-001: Multi-Game LLM Coach Architecture

**Date**: 2026-07-07
**Bug**: BUG-001 — LLM Coach only supported Gomoku
**Impact**: 4 of 5 games had broken coach feature

### Root Cause
The LLM Coach service (src/services/llmCoach.js) hardcoded a Gomoku-specific system prompt and board image renderer. The CoachController.refreshCoachGuidance() method bailed when local getMoveGuidance() returned null for non-Gomoku games, never reaching the LLM path.

### Architecture Decision
Always pass gameType through the full LLM service call chain. Never assume a single game type in multi-game codebases.

### Key Files
- src/services/llmCoach.js — buildChatCompletionRequest() accepts gameType; system prompts branch per game; board image splits into createGridBoardImageUrl() (Chess/Xiangqi) and createIntersectionBoardImageUrl() (Gomoku/Go/Junqi)
- src/app/controllers/CoachController.js — getGameType() reads DOM body.dataset.activeGame or app.options.gameType; refreshCoachGuidance() skips local AI for non-Gomoku
- src/games/registry.js — All 5 games declare llm-coach capability
- src/services/llmCoach.test.js — Per-game system prompt assertions; canvas mock required

### Testing Pattern
When testing requestLlmCoachAdvice, always mock document.createElement(canvas) to return a mock context with fillRect, fillText, toDataURL, etc.

### Line Endings
Files use CRLF (Windows). Patch scripts must normalize to LF for string matching, then write back with CRLF.

---

## RULE-002: Node.js v24 TypeScript Stripping

**Date**: 2026-07-07
**Context**: Default TypeScript stripping in Node.js v24 affects .js files

### Resolution
Use --input-type=commonjs flag for inline scripts, or write .cjs files for patch scripts that need CommonJS semantics.

---

## RULE-003: Vitest Mock Patterns for DOM-dependent Services

**Date**: 2026-07-07
**Context**: Services that use document.createElement(canvas) fail in Vitest

### Pattern
vi.stubGlobal("document", { documentElement: { lang: "" }, querySelectorAll: vi.fn(() => []), createElement: vi.fn((tag) => { if (tag === "canvas") { return { width: 0, height: 0, getContext: () => mockCtx, toDataURL: () => "data:image/png;base64,mock" }; } }) });

---

## RULE-004: Three.js 3D Drop Animation Integration

**Date**: 2026-07-07
**Context**: Adding piece drop animations across all games

### Architecture
- AnimationManager class handles bounce physics for stone/piece drops
- Gomoku 3D: custom GomokuRenderer3D integrates AnimationManager directly
- Go 3D: custom GoRenderer3D integrates AnimationManager in _placeStone()
- Chess/Xiangqi/Junqi: shared BoardGameRenderer3D base class integrates AnimationManager in addPiece()
- Sound effects handled at app controller level (SoundManager.playMove()), not at renderer level

---

## RULE-005: i18n Key Pairing for Multi-Language Support

**Date**: 2026-07-07
**Context**: Bilingual UI (EN/ZH) for coach and game features

### Pattern
All i18n keys must exist in both zh and en sections of src/utils/i18n.js. Translations are inline (not locale JSON files). Always verify key parity after adding coach or game UI strings.

---

## RULE-006: 3D Scene Architecture

**Date**: 2026-07-07
**Context**: Three.js 3D rendering across 5 games

### Key Facts
- Gomoku and Go have custom 3D renderers inheriting from shared render3d/ infrastructure
- Chess, Xiangqi, Junqi share BoardGameRenderer3D base class in src/games/render3d/
- 3 scenes available: Home (warm lighting), Park (outdoor), Competition (bright)
- SoundManager lives in src/audio/SoundManager.js — procedural stone-drop audio via playMove()
- Headless Chromium + Three.js screenshots may timeout — known limitation

---

## RULE-007: ParticleSystem Integration for Victory Effects

**Date**: 2026-07-07
**Context**: ParticleSystem existed but was never wired into any renderer

### Key Finding
src/render3d/ParticleSystem.js contained full emitShatterEffect() (victory) and emitDropParticles() (dust) but was never imported by any renderer.

### Integration Pattern
1. Export from src/render3d/index.js
2. Import in renderer, init in init()
3. Update in handleFrame() with delta time
4. Call emitShatterEffect on victory with winning cell world positions
5. Call emitDropParticles on animated stone drops
6. Dispose before sceneManager

### Camera Follow-Zoom
Use cameraController.focusOnCell(row, col, size, cellSize, true) to smoothly zoom to last move or winning line center.

---

## RULE-008: Post-Game Analysis Feature

**Date**: 2026-07-07
**Context**: Adding LLM-powered post-game review to the coach

### Architecture
- New `requestPostGameAnalysis()` in llmCoach.js sends completed game snapshot to LLM
- `buildPostGameRequest()` builds the system prompt requesting summary, turning points, mistakes, strengths, improvements, rating
- CoachController.requestPostGameReview() orchestrates the flow: checks config, sends request, parses response into structured data
- Response stored in app.state.coachPostGameData as { summary, turningPoints, mistakes, strengths, improvements, rating }
- 9 i18n keys added for zh/en: coachPostGameTitle through coachPostGameRequest

### Testing Pattern
- Mock fetch returns JSON-stringified analysis object
- Assert system prompt contains expected role description
- Assert user message text contains 'Post-game analysis request'
- Test missing config throws, HTTP errors throw

## RULE-009: PowerShell Template Literal Escaping

**Date**: 2026-07-07
**Context**: Patch scripts with backtick template literals fail in PowerShell

### Solution
- Write .cjs files using single-quoted PowerShell here-strings (@' ... '@) to avoid backtick interpretation
- Avoid backticks entirely in inline Node.js code passed to PowerShell
- Use string concatenation instead of template literals in patch scripts

---

## RULE-010: ParticleSystem Integration in Shared Base Class

**Date**: 2026-07-07
**Context**: Extending 3D effects to Chess/Xiangqi/Junqi via BoardGameRenderer3D

### Architecture
- `BoardGameRenderer3D` is the shared base class for Chess, Xiangqi, Junqi 3D renderers
- Import ParticleSystem from render3d/index.js (must export it first)
- Initialize in init(): `this.particleSystem = new ParticleSystem(this.sceneManager.scene)`
- Call `emitDropParticles()` in addPiece() after drop animation
- Dispose before AnimationManager in dispose()
- Victory effects not yet wired (no `gameOver` detection in shared base — each game subclass handles it)

## RULE-011: Marketing Material Update Cadence

**Date**: 2026-07-07
**Context**: Keeping devlog and report in sync with features

### Pattern
- Update devlog.md with 'New This Sprint' section after each feature batch
- Update Board_Game_Collection_Report.md with 'Recent Additions' section
- Include feature name, one-line description, and test count in each update

### RULE-012: showVictoryCelebration for Non-Line Games
- **Context**: Chess/Xiangqi/Junqi don't have "winning line" positions like Gomoku
- **Rule**: Use `showVictoryCelebration(winColor)` (no positions needed) instead of `showVictory(winColor, winPositions)`
- **Color mapping**: Chess: `w`->`white`, `b`->`black`. Xiangqi: `r`->`red`, `b`->`black`. Junqi: `r`->`red`, `b`->`black`
- **Files**: `BoardGameRenderer3D.js`, `ChessApp.js`, `XiangqiApp.js`, `JunqiApp.js`

### RULE-013: GoRenderer3D Render Loop Integration
- **Context**: Go uses SceneManager.onBeforeRender hook for frame updates
- **Rule**: Set `this.sceneManager.onBeforeRender = () => { ... }` in init() and null it in dispose()
- **Pattern**: Track `_lastFrameTime` for dt calculation, call `particleSystem.update(dt)` each frame
- **Files**: `GoRenderer3D.js`

### RULE-014: Post-Game Analysis UI Integration
- **Context**: Backend CoachController.requestPostGameReview() was implemented but had no UI trigger
- **Rule**: Post-game buttons are added to each game's result overlay in index.html, wired via DOM refs in dom.js (postgameBtn, postgamePanel, postgameContent)
- **Pattern**: GomokuApp.render() calls renderPostGameOverlay() which checks coachPostGame state and renders data via BoardGameApp.renderPostGamePanel()
- **Files**: index.html, dom.js, BoardGameApp.js, GomokuApp.js

### RULE-015: SettingsController.bindOptionGroup Post-Selection Hooks
- **Context**: Difficulty level buttons need side effects (e.g., updating description text)
- **Rule**: Add post-selection logic in bindOptionGroup callback by checking `dataAttribute === 'level'` and calling `updateDifficultyDesc()`
- **Files**: SettingsController.js

## Rule: LLM Post-Game GameType Threading

When adding gameType to LLM Coach request functions:
1. buildPostGameRequest was generic - used fallback board game analyst
2. Adding gameType param and POST_GAME_ADVICE map per game provides tailored analysis
3. buildChatCompletionRequest already used GAME_COACH_CONFIG[gameType] correctly
4. Pattern: always thread gameType from requestPostGameAnalysis -> buildPostGameRequest -> system message
5. Test validates system message contains game-specific text

## Rule: AI Depth Settings per Game

Each game has a depthForLevel function mapping difficulty to search depth:
- Gomoku: easy=random top-6, medium=minimax depth 2, hard=adaptive depth 2/3/4 + opening book + transposition table
- Go: easy=random top-6, medium=random top-3, hard=2-ply minimax + territory evaluation + transposition table
- Chess: easy=depth 1, medium=depth 3, hard=depth 5 with MVV-LVA + killer moves + transposition table
- Xiangqi: easy=depth 1, medium=depth 3, hard=depth 5 with killer moves + transposition table
- Junqi: easy=random top-6, medium=random top-3, hard=best-move-only + defensive flag protection

When bumping depth, always run npm run test to verify no timeout. Depth 5 is safe max for browsers.
