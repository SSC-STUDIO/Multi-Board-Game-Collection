const CACHE_NAME = 'gomoku-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',

  // CSS
  '/src/styles/main.css',
  '/src/styles/base.css',
  '/src/styles/layout.css',
  '/src/styles/components.css',
  '/src/styles/responsive.css',

  // App entry
  '/src/main.js',
  '/src/app/GomokuApp.js',
  '/src/app/controllers/GameController.js',
  '/src/app/controllers/CoachController.js',
  '/src/app/controllers/SettingsController.js',
  '/src/app/controllers/ImmersiveHudManager.js',
  '/src/app/controllers/InteractionManager.js',

  // Game logic
  '/src/games/gomoku/state.js',
  '/src/games/gomoku/rules.js',
  '/src/games/gomoku/ai.js',

  // Go (3D)
  '/src/games/go/render3d/GoRenderer3D.js',

  // UI
  '/src/ui/dom.js',
  '/src/ui/render.js',

  // 3D rendering
  '/src/render3d/index.js',
  '/src/render3d/GomokuRenderer3D.js',
  '/src/render3d/SceneManager.js',
  '/src/render3d/BoardBuilder.js',
  '/src/render3d/StoneBuilder.js',
  '/src/render3d/CameraController.js',
  '/src/render3d/LightingSetup.js',
  '/src/render3d/AnimationManager.js',
  '/src/render3d/InteractionHandler.js',
  '/src/render3d/EnvironmentBuilder.js',
  '/src/render3d/MaterialFactory.js',
  '/src/render3d/ParticleSystem.js',
  '/src/render3d/scenes/props.js',
  '/src/render3d/scenes/homeStudy.js',
  '/src/render3d/scenes/parkPavilion.js',
  '/src/render3d/scenes/tournamentHall.js',

  // Config
  '/src/config/gameConfig.js',
  '/src/config/renderConfig.js',
  '/src/config/sceneConfig.js',

  // Utils
  '/src/utils/board.js',
  '/src/utils/formatters.js',
  '/src/utils/i18n.js',

  // Audio & services
  '/src/audio/SoundManager.js',
  '/src/services/llmCoach.js',

  // Three.js
  '/node_modules/three/build/three.module.js'
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
  if (url.pathname.startsWith('/v1/') || url.hostname !== location.hostname) {
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
