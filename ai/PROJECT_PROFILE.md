# Multi Board Game Collection Project Profile

## Mission
A multi-platform board-game suite for Gomoku, Go, chess, Chinese chess, and Stratego-style play using Vite, Vitest, Electron, Capacitor, localization, AI opponents, and persistent game state.

## Authoritative surfaces
- src: shared engine, game implementations, UI, persistence, and AI
- tools: deterministic checks, builds, serving, and platform helpers
- electron-main.js and electron-preload.js: desktop trust boundary
- android, assets, locales, and steam: platform and distribution surfaces

## Engineering posture
- Select one reproducible defect or measurable invariant per Goal revision.
- Read repository-local instructions and directly affected code before editing.
- Preserve existing user changes and report baseline failures separately from regressions.
- Prefer small, testable changes over broad modernization.
