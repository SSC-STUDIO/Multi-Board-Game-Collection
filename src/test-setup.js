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
    const bodyClasses = new Set();
    const bodyClassList = {
        add: (c) => bodyClasses.add(c),
        remove: (c) => bodyClasses.delete(c),
        toggle: (c, force) => {
            if (force !== undefined) {
                if (force) { bodyClasses.add(c); return true; }
                bodyClasses.delete(c); return false;
            }
            if (bodyClasses.has(c)) { bodyClasses.delete(c); return false; }
            bodyClasses.add(c); return true;
        },
        contains: (c) => bodyClasses.has(c),
    };
    const mockBody = {
        classList: bodyClassList,
        dataset: {},
        appendChild: () => {},
        querySelector: () => null,
        querySelectorAll: () => [],
        contains: () => false,
        closest: () => null,
    };
    globalThis.document = {
        addEventListener: () => {},
        removeEventListener: () => {},
        querySelector: () => null,
        querySelectorAll: () => [],
        documentElement: { lang: 'zh-CN', classList: { add: () => {}, remove: () => {} } },
        createElement: (tag) => ({ style: {}, classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false }, dataset: {}, textContent: '', appendChild: () => {}, replaceChildren: () => {}, closest: () => null, matches: () => false, remove: () => {}, focus: () => {}, disabled: false, checked: false, value: '', className: '', scrollTop: 0, scrollLeft: 0, offsetWidth: 100, getAttribute: () => null, setAttribute: () => {}, removeAttribute: () => {}, addEventListener: () => {}, removeEventListener: () => {} }),
        createDocumentFragment: () => ({
            appendChild: () => {},
            replaceChildren: () => {},
        }),
        createTextNode: (text) => ({ textContent: text, nodeType: 3 }),
        body: mockBody,
    };
}

if (typeof globalThis.window === 'undefined') {
    globalThis.window = globalThis;
}

if (typeof globalThis.window.addEventListener === 'undefined') {
    globalThis.window.addEventListener = () => {};
}
if (typeof globalThis.window.clearTimeout === 'undefined') {
    globalThis.window.clearTimeout = () => {};
}
if (typeof globalThis.window.setTimeout === 'undefined') {
    globalThis.window.setTimeout = (fn) => { if (typeof fn === 'function') fn(); return 0; };
}
if (typeof globalThis.window.innerWidth === 'undefined') {
    globalThis.window.innerWidth = 1024;
}
if (typeof globalThis.window.innerHeight === 'undefined') {
    globalThis.window.innerHeight = 768;
}
