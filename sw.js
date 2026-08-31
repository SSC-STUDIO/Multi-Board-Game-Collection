const CACHE_NAME = 'board-games-v6';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',

  // CSS
  './src/styles/main.css',
  './src/styles/base.css',
  './src/styles/components.css',
  './src/styles/responsive.css',

  // App shell
  './src/main.js',
  './src/app/BoardGameApp.js',
  './src/app/controllers/LauncherController.js',
  './src/app/controllers/CoachController.js',

  // Game registry
  './src/games/registry.js',

  // Gomoku
  './src/games/gomoku/GomokuApp.js',
  './src/games/gomoku/state.js',
  './src/games/gomoku/rules.js',
  './src/games/gomoku/ai.js',
  './src/games/gomoku/controllers/GameController.js',
  './src/games/gomoku/controllers/SettingsController.js',
  './src/games/gomoku/controllers/ImmersiveHudManager.js',
  './src/games/gomoku/controllers/InteractionManager.js',
  './src/games/gomoku/render3d/GomokuRenderer3D.js',

  // Go
  './src/games/go/GoApp.js',
  './src/games/go/state.js',
  './src/games/go/rules.js',
  './src/games/go/ai.js',
  './src/games/go/scoring.js',
  './src/games/go/render3d/GoRenderer3D.js',

  // UI
  './src/ui/dom.js',
  './src/ui/render.js',
  './src/ui/confirmDialog.js',
  './src/ui/devPanel.js',

  // Shared 3D engine
  './src/render3d/index.js',
  './src/render3d/SceneManager.js',
  './src/render3d/BoardBuilder.js',
  './src/render3d/StoneBuilder.js',
  './src/render3d/CameraController.js',
  './src/render3d/LightingSetup.js',
  './src/render3d/AnimationManager.js',
  './src/render3d/InteractionHandler.js',
  './src/render3d/EnvironmentBuilder.js',
  './src/render3d/MaterialFactory.js',
  './src/render3d/ParticleSystem.js',
  './src/render3d/scenes/props.js',
  './src/render3d/scenes/tabletop.js',

  // Config
  './src/config/gameConfig.js',
  './src/config/renderConfig.js',
  './src/config/sceneConfig.js',

  // Utils
  './src/utils/board.js',
  './src/utils/formatters.js',
  './src/utils/i18n.js',

  // Locales
  './src/locales/zh.json',
  './src/locales/en.json',

  // Audio & services
  './src/audio/SoundManager.js',
  './src/services/llmCoach.js',
  './src/services/aiCommentary.js',
  './src/services/boardImageAnalyzer.js',

  // Three.js
  './node_modules/three/build/three.module.js',
  './node_modules/three/examples/jsm/controls/OrbitControls.js',
  './node_modules/three/examples/jsm/environments/RoomEnvironment.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Network-first for API calls
  if (url.pathname.includes('/v1/') || url.hostname !== location.hostname) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
