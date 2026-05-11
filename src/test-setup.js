// Mock browser APIs for Node.js test environment
if (typeof globalThis.localStorage === 'undefined') {
    const store = new Map();
    globalThis.localStorage = {
        getItem: (key) => store.get(key) ?? null,
        setItem: (key, value) => store.set(key, String(value)),
        removeItem: (key) => store.delete(key),
        clear: () => store.clear(),
    };
}

if (typeof globalThis.matchMedia === 'undefined') {
    globalThis.matchMedia = () => ({
        matches: false,
        addEventListener: () => {},
        removeEventListener: () => {},
    });
}

if (typeof globalThis.AudioContext === 'undefined') {
    globalThis.AudioContext = class {};
    globalThis.webkitAudioContext = globalThis.AudioContext;
}

if (typeof globalThis.document === 'undefined') {
    globalThis.document = {
        addEventListener: () => {},
        removeEventListener: () => {},
        querySelector: () => null,
        querySelectorAll: () => [],
        documentElement: { lang: 'zh-CN', classList: { add: () => {}, remove: () => {} } },
        createElement: (tag) => ({ style: {} }),
    };
}

if (typeof globalThis.window === 'undefined') {
    globalThis.window = globalThis;
}
