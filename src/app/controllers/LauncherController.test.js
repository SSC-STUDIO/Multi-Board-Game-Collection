import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../utils/i18n.js', () => ({
    i18n: { t: (key) => key, onChange: null, offChange: null },
    t: (key) => key
}));
vi.mock('../../games/registry.js', () => ({
    listGames: () => [
        { id: 'gomoku', titleKey: 'gomoku', taglineKey: 'gomokuTag', accent: '#e6b15b', status: 'available' },
        { id: 'go', titleKey: 'go', taglineKey: 'goTag', accent: '#8aa9b8', status: 'available' },
        { id: 'chess', titleKey: 'chess', taglineKey: 'chessTag', accent: '#c7c0ad', status: 'coming-soon' }
    ],
    findGame: vi.fn((id) => {
        const games = {
            gomoku: { id: 'gomoku', titleKey: 'gomoku', taglineKey: 'gomokuTag', accent: '#e6b15b', status: 'available' },
            go: { id: 'go', titleKey: 'go', taglineKey: 'goTag', accent: '#8aa9b8', status: 'available' }
        };
        return games[id] || null;
    })
}));

import { LauncherController } from './LauncherController.js';
import { findGame } from '../../games/registry.js';

// Provide a full createElement mock since test-setup.js only returns { style: {} }
document.createElement = (tag) => createMockElement(tag);

// Provide document.body mock since test-setup.js only mocks document partially
if (!document.body) {
    const bodyClasses = new Set();
    const bodyDataset = {};
    Object.defineProperty(document, 'body', {
        value: {
            classList: {
                add: (...names) => names.forEach((n) => bodyClasses.add(n)),
                remove: (...names) => names.forEach((n) => bodyClasses.delete(n)),
                contains: (name) => bodyClasses.has(name)
            },
            dataset: bodyDataset
        },
        writable: true,
        configurable: true
    });
    // Expose for test assertions
    document.body._classes = bodyClasses;
    document.body._dataset = bodyDataset;
}

function createMockElement(tagName = 'div') {
    const classes = new Set();
    const attrs = {};
    const dataset = {};
    const children = [];
    const listeners = {};
    const styleProps = {};
    return {
        tagName,
        className: '',
        get classList() {
            return {
                add: (...names) => names.forEach((n) => classes.add(n)),
                remove: (...names) => names.forEach((n) => classes.delete(n)),
                contains: (name) => classes.has(name)
            };
        },
        setAttribute: (k, v) => { attrs[k] = v; },
        getAttribute: (k) => attrs[k],
        dataset,
        style: { setProperty: (k, v) => { styleProps[k] = v; } },
        textContent: '',
        children,
        appendChild: (child) => { children.push(child); },
        replaceChildren: (fragment) => {
            children.length = 0;
            if (fragment && fragment.children) {
                children.push(...fragment.children);
            } else if (fragment) {
                // DocumentFragment mock: fragment itself holds children
                children.push(...(fragment._children || []));
            }
        },
        addEventListener: (type, fn) => { listeners[type] = fn; },
        removeEventListener: (type) => { delete listeners[type]; },
        _classes: classes,
        _attrs: attrs,
        _listeners: listeners,
        _styleProps: styleProps
    };
}

// Mock document.createDocumentFragment for renderGrid
const originalCreateDocumentFragment = document.createDocumentFragment;
document.createDocumentFragment = () => {
    const _children = [];
    return {
        appendChild: (child) => { _children.push(child); },
        _children
    };
};

function createMockRoot() {
    const launcher = createMockElement('section');
    const grid = createMockElement('div');
    const setup = createMockElement('section');
    const game = createMockElement('section');
    const elements = { launcher, 'launcher-grid': grid, setup, game };
    return {
        root: {
            getElementById: (id) => elements[id] || null
        },
        launcher,
        grid,
        setup,
        game
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    // Reset body mock state
    if (document.body._classes) {
        document.body._classes.clear();
    }
    if (document.body._dataset) {
        Object.keys(document.body._dataset).forEach((k) => delete document.body._dataset[k]);
    }
});

describe('LauncherController.constructor', () => {
    it('stores root, callbacks, and DOM references', () => {
        const onEnterGame = vi.fn();
        const onToast = vi.fn();
        const { root } = createMockRoot();
        const ctrl = new LauncherController({ root, onEnterGame, onToast });
        expect(ctrl.root).toBe(root);
        expect(ctrl.onEnterGame).toBe(onEnterGame);
        expect(ctrl.onToast).toBe(onToast);
        expect(ctrl.panel).toBeTruthy();
        expect(ctrl.grid).toBeTruthy();
        expect(ctrl.open).toBe(false);
    });

    it('uses no-op defaults when callbacks not provided', () => {
        const { root } = createMockRoot();
        const ctrl = new LauncherController({ root });
        expect(ctrl.onEnterGame).toBeInstanceOf(Function);
        expect(ctrl.onToast).toBeInstanceOf(Function);
    });

    it('handles missing DOM elements gracefully', () => {
        const root = { getElementById: () => null };
        const ctrl = new LauncherController({ root });
        expect(ctrl.panel).toBeNull();
        expect(ctrl.grid).toBeNull();
    });
});

describe('LauncherController.mount', () => {
    it('renders grid and adds click listener', () => {
        const { root, grid } = createMockRoot();
        const addSpy = vi.spyOn(grid, 'addEventListener');
        const ctrl = new LauncherController({ root });
        ctrl.mount();
        expect(grid.children.length).toBeGreaterThan(0);
        expect(addSpy).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('does nothing when panel is missing', () => {
        const root = { getElementById: () => null };
        const ctrl = new LauncherController({ root });
        ctrl.mount(); // should not throw
    });
});

describe('LauncherController.dispose', () => {
    it('removes click listener from grid', () => {
        const { root, grid } = createMockRoot();
        const removeSpy = vi.spyOn(grid, 'removeEventListener');
        const ctrl = new LauncherController({ root });
        ctrl.mount();
        ctrl.dispose();
        expect(removeSpy).toHaveBeenCalledWith('click', expect.any(Function));
    });
});

describe('LauncherController.show', () => {
    it('sets open=true and updates DOM classes', () => {
        const { root, launcher, setup, game } = createMockRoot();
        const ctrl = new LauncherController({ root });
        ctrl.show();
        expect(ctrl.open).toBe(true);
        expect(launcher._classes.has('hidden')).toBe(false);
        expect(launcher._attrs['aria-hidden']).toBe('false');
        expect(setup._classes.has('hidden')).toBe(true);
        expect(game._classes.has('hidden')).toBe(true);
        expect(document.body.dataset.activeGame).toBe('');
        expect(document.body.classList.contains('launcher-open')).toBe(true);
    });

    it('does nothing when panel is missing', () => {
        const root = { getElementById: () => null };
        const ctrl = new LauncherController({ root });
        ctrl.show(); // should not throw
        expect(ctrl.open).toBe(false);
    });
});

describe('LauncherController.hide', () => {
    it('sets open=false and hides panel', () => {
        const { root, launcher } = createMockRoot();
        const ctrl = new LauncherController({ root });
        ctrl.open = true;
        ctrl.hide();
        expect(ctrl.open).toBe(false);
        expect(launcher._classes.has('hidden')).toBe(true);
        expect(launcher._attrs['aria-hidden']).toBe('true');
        expect(document.body.classList.contains('launcher-open')).toBe(false);
    });

    it('does nothing when panel is missing', () => {
        const root = { getElementById: () => null };
        const ctrl = new LauncherController({ root });
        ctrl.hide(); // should not throw
    });
});

describe('LauncherController.buildCard', () => {
    it('creates an article with correct class and dataset', () => {
        const { root } = createMockRoot();
        const ctrl = new LauncherController({ root });
        const card = ctrl.buildCard({ id: 'gomoku', titleKey: 'gomoku', taglineKey: 'gomokuTag', accent: '#e6b15b', status: 'available' });
        expect(card.tagName).toBe('article');
        expect(card.className).toContain('launcher-card-gomoku');
        expect(card.className).toContain('status-available');
        expect(card.dataset.gameId).toBe('gomoku');
    });

    it('disables button for coming-soon games', () => {
        const { root } = createMockRoot();
        const ctrl = new LauncherController({ root });
        const card = ctrl.buildCard({ id: 'chess', titleKey: 'chess', taglineKey: 'chessTag', accent: '#c7c0ad', status: 'coming-soon' });
        const btn = card.children[card.children.length - 1];
        expect(btn.disabled).toBe(true);
        expect(btn.className).toContain('ghost-btn');
    });

    it('enables button for available games', () => {
        const { root } = createMockRoot();
        const ctrl = new LauncherController({ root });
        const card = ctrl.buildCard({ id: 'gomoku', titleKey: 'gomoku', taglineKey: 'gomokuTag', accent: '#e6b15b', status: 'available' });
        const btn = card.children[card.children.length - 1];
        expect(btn.disabled).toBe(false);
        expect(btn.className).toContain('primary-btn');
    });
});

describe('LauncherController.renderGrid', () => {
    it('renders cards for all games from registry', () => {
        const { root, grid } = createMockRoot();
        const ctrl = new LauncherController({ root });
        ctrl.renderGrid();
        expect(grid.children.length).toBeGreaterThan(0);
    });

    it('does nothing when grid is missing', () => {
        const root = { getElementById: () => null };
        const ctrl = new LauncherController({ root });
        ctrl.renderGrid(); // should not throw
    });
});

describe('LauncherController.handleGridClick', () => {
    it('calls onEnterGame for available game and hides launcher', () => {
        const onEnterGame = vi.fn();
        const { root } = createMockRoot();
        const ctrl = new LauncherController({ root, onEnterGame });
        const target = {
            closest: vi.fn(() => target),
            dataset: { gameId: 'gomoku' }
        };
        ctrl.handleGridClick({ target });
        expect(onEnterGame).toHaveBeenCalledWith('gomoku');
        expect(ctrl.open).toBe(false);
    });

    it('shows toast for coming-soon game', () => {
        const onToast = vi.fn();
        findGame.mockReturnValueOnce({ id: 'chess', status: 'coming-soon' });
        const { root } = createMockRoot();
        const ctrl = new LauncherController({ root, onToast });
        const target = {
            closest: vi.fn(() => target),
            dataset: { gameId: 'chess' }
        };
        ctrl.handleGridClick({ target });
        expect(onToast).toHaveBeenCalledWith('comingSoon');
    });

    it('does nothing when click target has no game-id', () => {
        const onEnterGame = vi.fn();
        const { root } = createMockRoot();
        const ctrl = new LauncherController({ root, onEnterGame });
        const target = { closest: vi.fn(() => null) };
        ctrl.handleGridClick({ target });
        expect(onEnterGame).not.toHaveBeenCalled();
    });

    it('does nothing when game is not found in registry', () => {
        findGame.mockReturnValueOnce(null);
        const onEnterGame = vi.fn();
        const { root } = createMockRoot();
        const ctrl = new LauncherController({ root, onEnterGame });
        const target = {
            closest: vi.fn(() => target),
            dataset: { gameId: 'unknown' }
        };
        ctrl.handleGridClick({ target });
        expect(onEnterGame).not.toHaveBeenCalled();
    });
});

describe('LauncherController.getLastGameId', () => {
    it('returns stored game id from localStorage', () => {
        const original = window.localStorage;
        Object.defineProperty(window, 'localStorage', {
            value: { getItem: vi.fn(() => 'gomoku') },
            writable: true,
            configurable: true
        });
        const { root } = createMockRoot();
        const ctrl = new LauncherController({ root });
        expect(ctrl.getLastGameId()).toBe('gomoku');
        Object.defineProperty(window, 'localStorage', { value: original, writable: true, configurable: true });
    });

    it('returns null when no stored game', () => {
        const original = window.localStorage;
        Object.defineProperty(window, 'localStorage', {
            value: { getItem: vi.fn(() => null) },
            writable: true,
            configurable: true
        });
        const { root } = createMockRoot();
        const ctrl = new LauncherController({ root });
        expect(ctrl.getLastGameId()).toBeNull();
        Object.defineProperty(window, 'localStorage', { value: original, writable: true, configurable: true });
    });

    it('returns null when localStorage throws', () => {
        const original = window.localStorage;
        Object.defineProperty(window, 'localStorage', {
            value: { getItem: vi.fn(() => { throw new Error('blocked'); }) },
            writable: true,
            configurable: true
        });
        const { root } = createMockRoot();
        const ctrl = new LauncherController({ root });
        expect(ctrl.getLastGameId()).toBeNull();
        Object.defineProperty(window, 'localStorage', { value: original, writable: true, configurable: true });
    });
});
