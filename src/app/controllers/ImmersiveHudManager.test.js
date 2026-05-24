import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../utils/i18n.js', () => ({
    i18n: { t: (key) => key },
    t: (key) => key
}));

import { ImmersiveHudManager } from './ImmersiveHudManager.js';

// Setup document.body mock with classList.toggle
if (!document.body) {
    const bodyClasses = new Set();
    Object.defineProperty(document, 'body', {
        value: {
            classList: {
                add: (...names) => names.forEach((n) => bodyClasses.add(n)),
                remove: (...names) => names.forEach((n) => bodyClasses.delete(n)),
                contains: (name) => bodyClasses.has(name),
                toggle: (name, force) => {
                    if (force === undefined) {
                        if (bodyClasses.has(name)) { bodyClasses.delete(name); return false; }
                        bodyClasses.add(name); return true;
                    }
                    if (force) { bodyClasses.add(name); return true; }
                    bodyClasses.delete(name); return false;
                }
            },
            dataset: {}
        },
        writable: true,
        configurable: true
    });
    document.body._classes = bodyClasses;
}

function createMockElement(classListToggle = true) {
    const classes = new Set();
    const attrs = {};
    const dataset = {};
    return {
        className: '',
        classList: {
            add: (...names) => names.forEach((n) => classes.add(n)),
            remove: (...names) => names.forEach((n) => classes.delete(n)),
            contains: (name) => classes.has(name),
            toggle: (name, force) => {
                if (force === undefined) {
                    if (classes.has(name)) { classes.delete(name); return false; }
                    classes.add(name); return true;
                }
                if (force) { classes.add(name); return true; }
                classes.delete(name); return false;
            }
        },
        setAttribute: (k, v) => { attrs[k] = v; },
        getAttribute: (k) => attrs[k],
        dataset,
        textContent: '',
        _classes: classes,
        _attrs: attrs,
        disabled: false,
        closest: vi.fn(() => null),
        getBoundingClientRect: () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 })
    };
}

let originalMatchMedia;
let originalInnerWidth;

beforeEach(() => {
    vi.clearAllMocks();
    if (document.body._classes) {
        document.body._classes.clear();
    }
    originalMatchMedia = window.matchMedia;
    originalInnerWidth = window.innerWidth;
});

afterEach(() => {
    window.matchMedia = originalMatchMedia;
    Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, writable: true, configurable: true });
});

function createMockApp(overrides = {}) {
    const sections = {
        game: createMockElement()
    };
    const hud = {
        immersiveCard: createMockElement(),
        left: createMockElement(),
        right: createMockElement(),
        top: createMockElement(),
        bottom: createMockElement(),
        langSwitch: createMockElement()
    };
    const controls = {
        immersiveToggle: createMockElement()
    };
    const placement = {
        panel: createMockElement()
    };

    // Sections mock: game section starts NOT hidden (game visible)
    sections.game._classes.delete('hidden');

    return {
        immersiveUiEnabled: false,
        immersiveUiCapable: false,
        immersiveUiRegions: { top: false, left: false, right: false, bottom: false },
        dom: {
            sections,
            hud,
            controls,
            placement
        },
        sound: { play: vi.fn() },
        settings: {
            setButtonLabel: vi.fn(),
            persistImmersiveUiPreference: vi.fn()
        },
        lastImmersivePointer: null,
        immersiveUiRects: { top: null, left: null, right: null, bottom: null, lang: null },
        ...overrides,
        // Ensure nested properties from overrides merge correctly
        dom: {
            sections,
            hud,
            controls,
            placement,
            ...(overrides.dom || {})
        }
    };
}

describe('ImmersiveHudManager.isImmersiveUiCapable', () => {
    it('returns true when fine pointer, hover capable, and wide viewport', () => {
        window.matchMedia = vi.fn(() => ({ matches: false }));
        Object.defineProperty(window, 'innerWidth', { value: 1200, writable: true, configurable: true });
        const app = createMockApp();
        const mgr = new ImmersiveHudManager(app);
        expect(mgr.isImmersiveUiCapable()).toBe(true);
    });

    it('returns false with coarse pointer', () => {
        window.matchMedia = vi.fn((query) => ({
            matches: query === '(pointer: coarse)'
        }));
        Object.defineProperty(window, 'innerWidth', { value: 1200, writable: true, configurable: true });
        const app = createMockApp();
        const mgr = new ImmersiveHudManager(app);
        expect(mgr.isImmersiveUiCapable()).toBe(false);
    });

    it('returns false with hover none', () => {
        window.matchMedia = vi.fn((query) => ({
            matches: query === '(hover: none)'
        }));
        Object.defineProperty(window, 'innerWidth', { value: 1200, writable: true, configurable: true });
        const app = createMockApp();
        const mgr = new ImmersiveHudManager(app);
        expect(mgr.isImmersiveUiCapable()).toBe(false);
    });

    it('returns false on narrow viewport', () => {
        window.matchMedia = vi.fn(() => ({ matches: false }));
        Object.defineProperty(window, 'innerWidth', { value: 800, writable: true, configurable: true });
        const app = createMockApp();
        const mgr = new ImmersiveHudManager(app);
        expect(mgr.isImmersiveUiCapable()).toBe(false);
    });

    it('handles missing matchMedia gracefully', () => {
        window.matchMedia = undefined;
        Object.defineProperty(window, 'innerWidth', { value: 1200, writable: true, configurable: true });
        const app = createMockApp();
        const mgr = new ImmersiveHudManager(app);
        expect(mgr.isImmersiveUiCapable()).toBe(true);
    });
});

describe('ImmersiveHudManager.isDesktopHoverUi', () => {
    it('returns true for fine pointer with hover', () => {
        window.matchMedia = vi.fn(() => ({ matches: false }));
        Object.defineProperty(window, 'innerWidth', { value: 1200, writable: true, configurable: true });
        const app = createMockApp();
        const mgr = new ImmersiveHudManager(app);
        expect(mgr.isDesktopHoverUi()).toBe(true);
    });

    it('returns false for narrow emulated phone viewport', () => {
        window.matchMedia = vi.fn(() => ({ matches: false }));
        Object.defineProperty(window, 'innerWidth', { value: 390, writable: true, configurable: true });
        const app = createMockApp();
        const mgr = new ImmersiveHudManager(app);
        expect(mgr.isDesktopHoverUi()).toBe(false);
    });

    it('returns false for coarse pointer', () => {
        window.matchMedia = vi.fn((q) => ({
            matches: q === '(pointer: coarse)'
        }));
        Object.defineProperty(window, 'innerWidth', { value: 1200, writable: true, configurable: true });
        const app = createMockApp();
        const mgr = new ImmersiveHudManager(app);
        expect(mgr.isDesktopHoverUi()).toBe(false);
    });
});

describe('ImmersiveHudManager.isImmersiveUiActive', () => {
    it('returns true when all conditions met', () => {
        const app = createMockApp();
        app.immersiveUiEnabled = true;
        app.immersiveUiCapable = true;
        const mgr = new ImmersiveHudManager(app);
        expect(mgr.isImmersiveUiActive()).toBe(true);
    });

    it('returns false when immersiveUiEnabled is false', () => {
        const app = createMockApp();
        app.immersiveUiCapable = true;
        const mgr = new ImmersiveHudManager(app);
        expect(mgr.isImmersiveUiActive()).toBe(false);
    });

    it('returns false when game section is hidden', () => {
        const app = createMockApp();
        app.immersiveUiEnabled = true;
        app.immersiveUiCapable = true;
        app.dom.sections.game._classes.add('hidden');
        const mgr = new ImmersiveHudManager(app);
        expect(mgr.isImmersiveUiActive()).toBe(false);
    });
});

describe('ImmersiveHudManager.isPointNearRect', () => {
    it('returns true when point is inside rect', () => {
        const app = createMockApp();
        const mgr = new ImmersiveHudManager(app);
        const rect = { left: 100, top: 100, right: 200, bottom: 200 };
        expect(mgr.isPointNearRect({ x: 150, y: 150 }, rect)).toBe(true);
    });

    it('returns true when point is within padding', () => {
        const app = createMockApp();
        const mgr = new ImmersiveHudManager(app);
        const rect = { left: 100, top: 100, right: 200, bottom: 200 };
        // 90 is 10px outside left edge, but padding is 20
        expect(mgr.isPointNearRect({ x: 90, y: 150 }, rect, 20)).toBe(true);
    });

    it('returns false when point is outside padding', () => {
        const app = createMockApp();
        const mgr = new ImmersiveHudManager(app);
        const rect = { left: 100, top: 100, right: 200, bottom: 200 };
        expect(mgr.isPointNearRect({ x: 50, y: 150 }, rect, 20)).toBe(false);
    });

    it('returns false when rect is null', () => {
        const app = createMockApp();
        const mgr = new ImmersiveHudManager(app);
        expect(mgr.isPointNearRect({ x: 150, y: 150 }, null)).toBe(false);
    });
});

describe('ImmersiveHudManager.setImmersiveRegions', () => {
    it('sets region states and toggles body classes', () => {
        const app = createMockApp();
        const mgr = new ImmersiveHudManager(app);
        mgr.setImmersiveRegions({ top: true, left: false, right: true, bottom: false });
        expect(app.immersiveUiRegions.top).toBe(true);
        expect(app.immersiveUiRegions.left).toBe(false);
        expect(app.immersiveUiRegions.right).toBe(true);
        expect(app.immersiveUiRegions.bottom).toBe(false);
        expect(document.body.classList.contains('immersive-top-active')).toBe(true);
        expect(document.body.classList.contains('immersive-left-active')).toBe(false);
        expect(document.body.classList.contains('immersive-right-active')).toBe(true);
        expect(document.body.classList.contains('immersive-bottom-active')).toBe(false);
    });
});

describe('ImmersiveHudManager.refreshImmersiveToggle', () => {
    it('sets button state when capable and enabled', () => {
        const app = createMockApp();
        app.immersiveUiCapable = true;
        app.immersiveUiEnabled = true;
        const mgr = new ImmersiveHudManager(app);
        mgr.refreshImmersiveToggle();

        const button = app.dom.controls.immersiveToggle;
        expect(app.settings.setButtonLabel).toHaveBeenCalledWith(button, 'immersiveUiOn');
        expect(button.disabled).toBe(false);
        expect(button._attrs['aria-label']).toBe('immersiveUiOn');
        expect(button._attrs['aria-pressed']).toBe('true');
    });

    it('disables button when not capable', () => {
        const app = createMockApp();
        app.immersiveUiCapable = false;
        const mgr = new ImmersiveHudManager(app);
        mgr.refreshImmersiveToggle();

        const button = app.dom.controls.immersiveToggle;
        expect(app.settings.setButtonLabel).toHaveBeenCalledWith(button, 'immersiveUiUnavailable');
        expect(button.disabled).toBe(true);
        expect(button._attrs['aria-label']).toBe('immersiveUiUnavailable');
        expect(button._attrs['aria-pressed']).toBe('false');
    });

    it('shows unavailable card text and hides card when not capable', () => {
        const app = createMockApp();
        app.immersiveUiCapable = false;
        const mgr = new ImmersiveHudManager(app);
        mgr.refreshImmersiveToggle();

        // When not capable, card gets hidden with 'hidden' class
        expect(app.dom.hud.immersiveCard._classes.has('hidden')).toBe(true);
        expect(app.dom.hud.immersiveCard.textContent).toBe('immersiveUiUnavailable');
    });

    it('makes card visible when capable', () => {
        const app = createMockApp();
        app.immersiveUiCapable = true;
        const mgr = new ImmersiveHudManager(app);
        mgr.refreshImmersiveToggle();

        // When capable, card gets 'hidden' removed
        expect(app.dom.hud.immersiveCard._classes.has('hidden')).toBe(false);
    });
});

describe('ImmersiveHudManager.toggleImmersiveUi', () => {
    it('toggles enabled state and persists', () => {
        const app = createMockApp();
        app.immersiveUiCapable = true;
        app.immersiveUiEnabled = false;
        const mgr = new ImmersiveHudManager(app);
        mgr.toggleImmersiveUi();

        expect(app.immersiveUiEnabled).toBe(true);
        expect(app.settings.persistImmersiveUiPreference).toHaveBeenCalled();
        expect(app.sound.play).toHaveBeenCalledWith('toggleOn');
    });

    it('toggles back to disabled', () => {
        const app = createMockApp();
        app.immersiveUiCapable = true;
        app.immersiveUiEnabled = true;
        const mgr = new ImmersiveHudManager(app);
        mgr.toggleImmersiveUi();

        expect(app.immersiveUiEnabled).toBe(false);
        expect(app.sound.play).toHaveBeenCalledWith('toggleOff');
    });

    it('plays error when not capable', () => {
        const app = createMockApp();
        app.immersiveUiCapable = false;
        const mgr = new ImmersiveHudManager(app);
        mgr.toggleImmersiveUi();

        expect(app.sound.play).toHaveBeenCalledWith('error');
        expect(app.immersiveUiEnabled).toBe(false);
    });
});

describe('ImmersiveHudManager.handleImmersivePointer', () => {
    it('updates pointer position', () => {
        const app = createMockApp();
        const mgr = new ImmersiveHudManager(app);
        mgr.handleImmersivePointer({ clientX: 100, clientY: 200 });
        expect(app.lastImmersivePointer).toEqual({ x: 100, y: 200 });
    });

    it('does not update regions when immersive ui is not active', () => {
        const app = createMockApp();
        const mgr = new ImmersiveHudManager(app);
        const updateSpy = vi.spyOn(mgr, 'updateImmersiveRegionsFromPoint');
        mgr.handleImmersivePointer({ clientX: 100, clientY: 200 });
        expect(updateSpy).not.toHaveBeenCalled();
    });
});

describe('ImmersiveHudManager.handleImmersiveFocusIn', () => {
    it('sets region based on focus target closest match', () => {
        const app = createMockApp();
        app.immersiveUiEnabled = true;
        app.immersiveUiCapable = true;
        const mgr = new ImmersiveHudManager(app);
        mgr.setImmersiveRegions({ top: false, left: false, right: false, bottom: false });

        const target = { closest: vi.fn((sel) => sel === '.hud-top, .lang-switch' ? {} : null) };
        mgr.handleImmersiveFocusIn({ target });

        expect(app.immersiveUiRegions.top).toBe(true);
        expect(app.immersiveUiRegions.left).toBe(false);
        expect(app.immersiveUiRegions.right).toBe(false);
        expect(app.immersiveUiRegions.bottom).toBe(false);
    });

    it('shows all regions when focus is not in any HUD zone', () => {
        const app = createMockApp();
        app.immersiveUiEnabled = true;
        app.immersiveUiCapable = true;
        const mgr = new ImmersiveHudManager(app);
        mgr.setImmersiveRegions({ top: false, left: false, right: false, bottom: false });

        const target = { closest: vi.fn(() => null) };
        mgr.handleImmersiveFocusIn({ target });

        expect(app.immersiveUiRegions.top).toBe(false);
        expect(app.immersiveUiRegions.left).toBe(false);
        expect(app.immersiveUiRegions.right).toBe(false);
        expect(app.immersiveUiRegions.bottom).toBe(false);
    });
});

describe('ImmersiveHudManager.refreshImmersiveUi', () => {
    it('sets all regions active when not active', () => {
        const app = createMockApp();
        const mgr = new ImmersiveHudManager(app);
        mgr.refreshImmersiveUi();
        expect(app.immersiveUiRegions.top).toBe(true);
        expect(app.immersiveUiRegions.left).toBe(true);
        expect(app.immersiveUiRegions.right).toBe(true);
        expect(app.immersiveUiRegions.bottom).toBe(true);
    });

    it('shows all regions with forceAll=true', () => {
        const app = createMockApp();
        app.immersiveUiEnabled = true;
        app.immersiveUiCapable = true;
        const mgr = new ImmersiveHudManager(app);
        mgr.setImmersiveRegions({ top: false, left: false, right: false, bottom: false });
        mgr.refreshImmersiveUi({ forceAll: true });
        expect(app.immersiveUiRegions.top).toBe(true);
        expect(app.immersiveUiRegions.left).toBe(true);
        expect(app.immersiveUiRegions.right).toBe(true);
        expect(app.immersiveUiRegions.bottom).toBe(true);
    });
});

describe('ImmersiveHudManager.updateImmersiveRects', () => {
    it('caches getBoundingClientRect for all HUD elements', () => {
        const topRect = { left: 0, top: 0, right: 800, bottom: 50 };
        const leftRect = { left: 0, top: 50, right: 200, bottom: 500 };
        const app = createMockApp();
        app.dom.hud.top.getBoundingClientRect = () => topRect;
        app.dom.hud.left.getBoundingClientRect = () => leftRect;
        app.dom.hud.right.getBoundingClientRect = () => ({ left: 600, top: 50, right: 800, bottom: 500 });
        app.dom.hud.bottom.getBoundingClientRect = () => ({ left: 0, top: 500, right: 800, bottom: 600 });
        app.dom.hud.langSwitch.getBoundingClientRect = () => ({ left: 700, top: 10, right: 780, bottom: 40 });

        const mgr = new ImmersiveHudManager(app);
        mgr.updateImmersiveRects();

        expect(app.immersiveUiRects.top).toEqual(topRect);
        expect(app.immersiveUiRects.left).toEqual(leftRect);
        expect(app.immersiveUiRects.lang).toEqual({ left: 700, top: 10, right: 780, bottom: 40 });
    });

    it('handles missing HUD elements by storing null', () => {
        const app = createMockApp();
        app.dom.hud.top = null;
        const mgr = new ImmersiveHudManager(app);
        mgr.updateImmersiveRects();
        expect(app.immersiveUiRects.top).toBeNull();
    });
});

describe('ImmersiveHudManager.updateImmersiveRegionsFromPoint', () => {
    it('shows all regions when point is null', () => {
        const app = createMockApp();
        const mgr = new ImmersiveHudManager(app);
        mgr.setImmersiveRegions({ top: false, left: false, right: false, bottom: false });
        mgr.updateImmersiveRegionsFromPoint(null);
        expect(app.immersiveUiRegions.top).toBe(true);
        expect(app.immersiveUiRegions.left).toBe(true);
        expect(app.immersiveUiRegions.right).toBe(true);
        expect(app.immersiveUiRegions.bottom).toBe(true);
    });

    it('shows top region when point is in top edge zone', () => {
        // Viewport 1200x800, edgeTop = max(88, min(146, 800*0.14=112)) = 112
        Object.defineProperty(window, 'innerWidth', { value: 1200, writable: true, configurable: true });
        Object.defineProperty(window, 'innerHeight', { value: 800, writable: true, configurable: true });
        const app = createMockApp();
        // Null rects so edge proximity is the only trigger
        app.immersiveUiRects = { top: null, left: null, right: null, bottom: null, lang: null };
        const mgr = new ImmersiveHudManager(app);
        mgr.setImmersiveRegions({ top: false, left: false, right: false, bottom: false });
        mgr.updateImmersiveRegionsFromPoint({ x: 400, y: 50 }); // y <= 112 triggers top
        expect(app.immersiveUiRegions.top).toBe(true);
    });

    it('shows left region when point is in left edge zone', () => {
        Object.defineProperty(window, 'innerWidth', { value: 1200, writable: true, configurable: true });
        const app = createMockApp();
        app.immersiveUiRects = { top: null, left: null, right: null, bottom: null, lang: null };
        const mgr = new ImmersiveHudManager(app);
        const ctrl = mgr;
        ctrl.setImmersiveRegions({ top: false, left: false, right: false, bottom: false });
        // edgeLeft = max(152, min(260, 1200*0.18=216)) = 216
        ctrl.updateImmersiveRegionsFromPoint({ x: 50, y: 400 });
        expect(ctrl.app.immersiveUiRegions.left).toBe(true);
    });

    it('shows bottom region when placement panel is visible', () => {
        Object.defineProperty(window, 'innerWidth', { value: 1200, writable: true, configurable: true });
        Object.defineProperty(window, 'innerHeight', { value: 800, writable: true, configurable: true });
        const app = createMockApp();
        app.immersiveUiRects = { top: null, left: null, right: null, bottom: null, lang: null };
        // Make placement panel visible by NOT adding 'hidden'
        const mgr = new ImmersiveHudManager(app);
        mgr.setImmersiveRegions({ top: false, left: false, right: false, bottom: false });
        mgr.updateImmersiveRegionsFromPoint({ x: 600, y: 400 });
        expect(app.immersiveUiRegions.bottom).toBe(true);
    });
});
