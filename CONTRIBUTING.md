# Contributing to Multi-Board-Game-Collection

Thank you for your interest in contributing! This is an open-source 5-in-1 board game suite with Three.js 3D rendering and LLM AI coaching. We welcome contributions of all kinds.

## 🎮 Quick Start

```bash
# Clone the repository
git clone https://github.com/SSC-STUDIO/Multi-Board-Game-Collection.git
cd Multi-Board-Game-Collection

# Install dependencies
npm install

# Run tests
npm test

# Start development server
npm run dev

# Build for production
npm run build
```

## 🏗️ Project Structure

```
src/
  games/           # Game implementations
    gomoku/        # Five-in-a-Row (Renju rules)
    go/            # Weiqi/Baduk (Chinese & Japanese scoring)
    chess/         # International Chess (FIDE rules)
    xiangqi/       # Chinese Chess (river & palace rules)
    junqi/         # Military Flip Chess
    render3d/      # BoardGameRenderer3D for Chess/Xiangqi/Junqi
  render3d/        # Three.js 3D engine (SceneManager, CameraController, etc.)
  services/        # LLM Coach service
  audio/           # SoundManager
  config/          # Render config with device profiles
```

## 🧪 Testing

We maintain 1005 unit tests across 41 test files with 100% pass rate:

```bash
npm test           # Run all tests
npm run build      # Build and verify no errors
```

### Test Guidelines

- Every rule engine change must have corresponding tests
- AI engine changes should include tests for all difficulty levels
- 3D renderer changes should test with mocked Three.js
- Use Vitest for all tests (vi.fn(), vi.mock(), etc.)

## 🎯 Ways to Contribute

### 🐛 Bug Reports
- Open an issue with steps to reproduce
- Include browser/OS info
- Screenshots or console errors help!

### ✨ Feature Ideas
- New board game implementations
- 3D scene improvements
- AI engine enhancements
- UI/UX improvements
- Mobile performance optimizations

### 📝 Documentation
- Improve README translations
- Add game strategy guides
- Write development tutorials

### 🧪 Tests
- Add missing test coverage
- Test edge cases in rule engines
- Cross-browser compatibility tests

## 🎨 3D Rendering

The project uses Three.js for immersive 3D board scenes:

- **BoardGameRenderer3D**: Generic 3D renderer for Chess/Xiangqi/Junqi
- **GomokuRenderer3D**: Specialized Gomoku renderer with stone textures
- **CameraController**: Smooth camera transitions and preset views
- **ParticleSystem**: Victory celebrations and ambient effects

### Adding New 3D Features

1. Create your feature in `src/render3d/`
2. Export from `src/render3d/index.js`
3. Add tests in `src/render3d/*.test.js`
4. Ensure mobile performance (pixel ratio cap, shadow map scaling)

## 🤖 AI Engine

Each game has its own AI engine in `src/games/<game>/ai.js`:

- **Easy**: Random selection from top candidates
- **Medium**: Minimax with alpha-beta pruning (depth 2-3)
- **Hard**: Deep search (depth 4-5) with advanced heuristics

### AI Improvement Areas

- Opening book expansion
- Move ordering optimizations (killer moves, MVV-LVA)
- Endgame tablebases
- Neural network evaluation

## 🌐 Internationalization

We support English and Simplified Chinese:

- Translation files: `locales/en.json`, `locales/zh-CN.json`
- 332+ localized UI elements
- Zero text clipping across all screen sizes

### Adding New Languages

1. Copy `locales/en.json` to `locales/<lang>.json`
2. Translate all strings
3. Register in `src/utils/i18n.js`

## 📱 Cross-Platform

- **Web**: Vite dev server, works in all modern browsers
- **Desktop**: Electron (Windows/Mac/Linux)
- **Mobile**: Capacitor (Android APK)

### Platform-Specific Testing

```bash
npm run dev              # Web development
npm run build            # Production build
npm run android:build:debug  # Android APK (requires Capacitor setup)
```

## 📋 Code Style

- ES Modules (import/export)
- No TypeScript (vanilla JS for simplicity)
- Consistent naming: camelCase for variables, PascalCase for classes
- JSDoc comments for public APIs
- Windows line endings (CRLF)

## 🎯 Priority Areas

1. **3D Polish**: Camera animations, audio SFX, texture improvements
2. **AI Strength**: Opening books, evaluation functions, search optimizations
3. **Mobile Performance**: FPS optimization, touch controls
4. **New Games**: Shogi, Othello/Reversi, Checkers

## 📜 License

MIT License - see [LICENSE](LICENSE) for details.

---

⭐ If you find this project useful, please star it on GitHub! It helps others discover the project.

🙏 Thank you for contributing!
