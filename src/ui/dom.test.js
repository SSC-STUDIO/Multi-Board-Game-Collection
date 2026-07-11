import { describe, it, expect, vi, beforeEach } from 'vitest';

const i18nMock = vi.hoisted(() => ({
    getLanguage: vi.fn(() => 'zh'),
    setLanguage: vi.fn(),
    updateDOM: vi.fn(),
    onChange: vi.fn(),
}));

vi.mock('../utils/i18n.js', () => ({
    i18n: i18nMock,
}));

import {
    getDOMReferences,
    setActiveButton,
    setActiveByValue,
    setupLanguageSwitch,
    buildGameCoachMapping,
} from './dom.js';

function mockEl(tag = 'div', overrides = {}) {
    const listeners = {};
    return {
        tag,
        classList: {
            add: vi.fn(),
            remove: vi.fn(),
            toggle: vi.fn(() => false),
            contains: vi.fn(() => false),
        },
        style: {},
        dataset: {},
        textContent: '',
        childNodes: [],
        children: [],
        replaceChildren: vi.fn(),
        appendChild: vi.fn((c) => c),
        remove: vi.fn(),
        setAttribute: vi.fn(),
        getAttribute: vi.fn((attr) => overrides[attr] ?? null),
        addEventListener: vi.fn((evt, fn) => { listeners[evt] = fn; }),
        removeEventListener: vi.fn(),
        closest: vi.fn(() => null),
        matches: vi.fn(() => false),
        disabled: false,
        value: '',
        ...overrides,
        _listeners: listeners,
    };
}

function makeFakeRoot() {
    const byId = {};
    const bySelector = {};

    const root = {
        getElementById: vi.fn((id) => byId[id] ?? null),
        querySelector: vi.fn((sel) => bySelector[sel] ?? null),
        querySelectorAll: vi.fn(() => []),
    };
    root._byId = byId;
    root._bySelector = bySelector;
    return root;
}

function registerIds(root, ...ids) {
    for (const id of ids) {
        root._byId[id] = mockEl('div', { id });
    }
}

function registerSelector(root, selector, el) {
    root._bySelector[selector] = el;
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('getDOMReferences', () => {
    it('returns an object with all expected keys', () => {
        const root = makeFakeRoot();
        registerIds(root,
            'setup', 'game', 'scene-3d', 'board', 'board-shell',
            'board-preview-overlay', 'message', 'move-list', 'ai-thinking',
            'ai-options', 'color-options', 'llm-options',
            'setup-scene-preview', 'setup-scene-image', 'setup-scene-mood',
            'setup-scene-ambience', 'setup-scene-copy',
            'immersive-ui-card',
            'help-open-btn', 'help-overlay', 'help-close-btn',
            'first-run-guide', 'guide-dismiss-btn', 'guide-help-btn',
            'mode-options', 'rule-options', 'size-options',
            'scene-options', 'difficulty-options', 'color-select',
            'meta-mode', 'meta-rule', 'meta-size', 'meta-scene',
            'phase-pill', 'stage-title', 'stage-subtitle',
            'turn-spotlight', 'turn-spotlight-text',
            'momentum-text', 'momentum-note',
            'current-player', 'move-count', 'last-move', 'board-phase',
            'start-btn', 'back-btn', 'undo-btn', 'hint-btn',
            'swap-btn', 'restart-btn', 'resign-btn', 'view-reset-btn',
            'sound-toggle-btn', 'immersive-ui-btn',
            'placement-confirm-btn', 'selection-cancel-btn',
            'setup-llm-settings-btn', 'setup-back-to-launcher-btn',
            'coach-card', 'coach-source', 'coach-status',
            'coach-move', 'coach-insight',
        );
        registerSelector(root, '.ui-overlay', mockEl('div'));
        registerSelector(root, '.hud-top', mockEl('div'));
        registerSelector(root, '.hud-left', mockEl('div'));
        registerSelector(root, '.hud-right', mockEl('div'));
        registerSelector(root, '.hud-bottom', mockEl('div'));
        registerSelector(root, '.lang-switch', mockEl('div'));
        registerSelector(root, '.help-sheet', mockEl('div'));
        registerSelector(root, '.option-btn', mockEl('button'));

        const refs = getDOMReferences(root);
        expect(refs).toHaveProperty('overlay');
        expect(refs).toHaveProperty('sections');
        expect(refs.sections).toHaveProperty('setup');
        expect(refs.sections).toHaveProperty('game');
        expect(refs).toHaveProperty('board');
        expect(refs).toHaveProperty('controls');
        expect(refs).toHaveProperty('hud');
        expect(refs).toHaveProperty('guidance');
        expect(refs).toHaveProperty('help');
        expect(refs).toHaveProperty('firstRunGuide');
        expect(refs).toHaveProperty('meta');
        expect(refs).toHaveProperty('stage');
        expect(refs).toHaveProperty('status');
        expect(refs.controls).toHaveProperty('start');
        expect(refs.controls).toHaveProperty('undo');
    });

    it('returns null when root has no matching elements', () => {
        const root = makeFakeRoot();
        const refs = getDOMReferences(root);
        expect(refs.board).toBeNull();
        expect(refs.controls.start).toBeNull();
        expect(refs.sections.setup).toBeNull();
    });

    it('delegates getElementById calls to the root', () => {
        const root = makeFakeRoot();
        registerIds(root, 'board');
        getDOMReferences(root);
        expect(root.getElementById).toHaveBeenCalledWith('board');
    });

    it('delegates querySelector calls to the root', () => {
        const root = makeFakeRoot();
        registerSelector(root, '.ui-overlay', mockEl('div'));
        getDOMReferences(root);
        expect(root.querySelector).toHaveBeenCalledWith('.ui-overlay');
    });
});

describe('setActiveButton', () => {
    it('toggles active class on buttons', () => {
        const btn1 = mockEl('button');
        const btn2 = mockEl('button');
        const group = {
            querySelectorAll: vi.fn(() => [btn1, btn2]),
        };
        setActiveButton(group, btn1);
        expect(btn1.classList.toggle).toHaveBeenCalledWith('active', true);
        expect(btn2.classList.toggle).toHaveBeenCalledWith('active', false);
    });

    it('syncs aria-checked for radio role buttons', () => {
        const btn1 = mockEl('button', { 'role': 'radio' });
        const btn2 = mockEl('button', { 'role': 'radio' });
        btn1.getAttribute = vi.fn((attr) => {
            if (attr === 'role') return 'radio';
            return null;
        });
        btn2.getAttribute = vi.fn((attr) => {
            if (attr === 'role') return 'radio';
            return null;
        });
        const group = {
            querySelectorAll: vi.fn(() => [btn1, btn2]),
        };
        setActiveButton(group, btn1);
        expect(btn1.setAttribute).toHaveBeenCalledWith('aria-checked', 'true');
        expect(btn2.setAttribute).toHaveBeenCalledWith('aria-checked', 'false');
    });

    it('does not touch aria-checked for non-radio buttons', () => {
        const btn1 = mockEl('button');
        btn1.getAttribute = vi.fn(() => null);
        const group = {
            querySelectorAll: vi.fn(() => [btn1]),
        };
        setActiveButton(group, btn1);
        expect(btn1.setAttribute).not.toHaveBeenCalled();
    });

    it('does nothing when group has no option-btn children', () => {
        const group = {
            querySelectorAll: vi.fn(() => []),
        };
        expect(() => setActiveButton(group, mockEl('button'))).not.toThrow();
        expect(group.querySelectorAll).toHaveBeenCalledWith('.option-btn');
    });
});

describe('setActiveByValue', () => {
    it('calls setActiveButton with the matched button', () => {
        const targetBtn = mockEl('button');
        const group = {
            querySelector: vi.fn(() => targetBtn),
            querySelectorAll: vi.fn(() => [targetBtn]),
        };
        setActiveByValue(group, 'difficulty', 'hard');
        expect(group.querySelector).toHaveBeenCalledWith('[data-difficulty="hard"]');
        expect(targetBtn.classList.toggle).toHaveBeenCalledWith('active', true);
    });

    it('does nothing if no button matches', () => {
        const group = {
            querySelector: vi.fn(() => null),
        };
        expect(() => setActiveByValue(group, 'mode', 'missing')).not.toThrow();
        expect(group.querySelector).toHaveBeenCalledWith('[data-mode="missing"]');
    });

    it('handles null group gracefully', () => {
        expect(() => setActiveByValue(null, 'mode', 'x')).not.toThrow();
    });
});

describe('setupLanguageSwitch', () => {
    function createLangDom() {
        const zhBtn = mockEl('button');
        const enBtn = mockEl('button');
        return {
            lang: { zh: zhBtn, en: enBtn },
            zhBtn,
            enBtn,
        };
    }

    it('calls i18n.onChange with a sync function', () => {
        const { lang } = createLangDom();
        setupLanguageSwitch({ lang }, null);
        expect(i18nMock.onChange).toHaveBeenCalledTimes(1);
        expect(typeof i18nMock.onChange.mock.calls[0][0]).toBe('function');
    });

    it('registers click handlers for zh and en buttons', () => {
        const { lang, zhBtn, enBtn } = createLangDom();
        setupLanguageSwitch({ lang }, null);
        expect(zhBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
        expect(enBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('clicking zh button calls i18n.setLanguage("zh")', () => {
        const { lang, zhBtn } = createLangDom();
        setupLanguageSwitch({ lang }, null);
        const handler = zhBtn.addEventListener.mock.calls.find(([e]) => e === 'click')?.[1];
        expect(handler).toBeDefined();
        handler();
        expect(i18nMock.setLanguage).toHaveBeenCalledWith('zh');
    });

    it('clicking en button calls i18n.setLanguage("en")', () => {
        const { lang, enBtn } = createLangDom();
        setupLanguageSwitch({ lang }, null);
        const handler = enBtn.addEventListener.mock.calls.find(([e]) => e === 'click')?.[1];
        expect(handler).toBeDefined();
        handler();
        expect(i18nMock.setLanguage).toHaveBeenCalledWith('en');
    });

    it('invokes onChange callback with current language', () => {
        const { lang } = createLangDom();
        const cb = vi.fn();
        i18nMock.getLanguage.mockReturnValue('en');
        setupLanguageSwitch({ lang }, cb);
        // onChange was registered; call the registered sync function manually
        const sync = i18nMock.onChange.mock.calls[0][0];
        sync();
        expect(cb).toHaveBeenCalledWith('en');
    });

    it('toggles active class based on current language', () => {
        const { lang, zhBtn, enBtn } = createLangDom();
        i18nMock.getLanguage.mockReturnValue('en');
        setupLanguageSwitch({ lang }, null);
        const sync = i18nMock.onChange.mock.calls[0][0];
        sync();
        expect(zhBtn.classList.toggle).toHaveBeenCalledWith('active', false);
        expect(enBtn.classList.toggle).toHaveBeenCalledWith('active', true);
    });

    it('calls i18n.updateDOM on sync', () => {
        const { lang } = createLangDom();
        setupLanguageSwitch({ lang }, null);
        const sync = i18nMock.onChange.mock.calls[0][0];
        sync();
        expect(i18nMock.updateDOM).toHaveBeenCalled();
    });
});

describe('buildGameCoachMapping', () => {
    it('returns all expected keys with null for unqueried fields', () => {
        const root = makeFakeRoot();
        const mapping = buildGameCoachMapping(root, 'go');
        expect(mapping).toHaveProperty('card');
        expect(mapping).toHaveProperty('source');
        expect(mapping).toHaveProperty('status');
        expect(mapping).toHaveProperty('move');
        expect(mapping).toHaveProperty('insight');
        expect(mapping).toHaveProperty('risk');
        expect(mapping).toHaveProperty('settings');
        expect(mapping.alternatives).toBeNull();
        expect(mapping.plan).toBeNull();
        expect(mapping.confidence).toBeNull();
        expect(mapping.upload).toBeNull();
    });

    it('queries correct selectors with prefix', () => {
        const root = makeFakeRoot();
        const fakeEl = mockEl('div');
        registerSelector(root, '.game-coach-hint[data-game="chess"]', fakeEl);
        registerSelector(root, '[data-game-source="chess"]', mockEl('span'));
        registerSelector(root, '[data-game-coach-status="chess"]', mockEl('span'));
        registerSelector(root, '[data-game-coach-move="chess"]', mockEl('span'));
        registerSelector(root, '[data-game-coach-insight="chess"]', mockEl('span'));
        registerSelector(root, '[data-game-coach-risk="chess"]', mockEl('span'));
        registerSelector(root, '[data-game-settings="chess"]', mockEl('button'));

        const mapping = buildGameCoachMapping(root, 'chess');
        expect(mapping.card).toBe(fakeEl);
        expect(mapping.settings).not.toBeNull();
    });

    it('returns null for selectors that are not present in root', () => {
        const root = makeFakeRoot();
        const mapping = buildGameCoachMapping(root, 'xiangqi');
        expect(mapping.card).toBeNull();
        expect(mapping.source).toBeNull();
        expect(mapping.settings).toBeNull();
    });

    it('always returns null for fields without DOM counterparts', () => {
        const root = makeFakeRoot();
        const mapping = buildGameCoachMapping(root, 'go');
        expect(mapping.alternatives).toBeNull();
        expect(mapping.plan).toBeNull();
        expect(mapping.confidence).toBeNull();
        expect(mapping.feedback).toBeNull();
        expect(mapping.rerun).toBeNull();
        expect(mapping.upload).toBeNull();
        expect(mapping.imageInput).toBeNull();
        expect(mapping.importWrap).toBeNull();
        expect(mapping.importBtn).toBeNull();
        expect(mapping.editBtn).toBeNull();
        expect(mapping.analyzeImage).toBeNull();
        expect(mapping.analyzeCount).toBeNull();
        expect(mapping.analyzeConfidence).toBeNull();
        expect(mapping.previewHint).toBeNull();
        expect(mapping.previewCommit).toBeNull();
        expect(mapping.previewCancel).toBeNull();
        expect(mapping.previewActions).toBeNull();
    });
});
