import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../utils/i18n.js', () => ({
    i18n: { t: (key, params) => {
        if (params) return `${key}:${JSON.stringify(params)}`;
        return key;
    } },
    t: (key) => key
}));
vi.mock('../../ui/dom.js', () => ({
    setActiveButton: vi.fn(),
    setActiveByValue: vi.fn()
}));
vi.mock('../../ui/render.js', () => ({
    syncSetupPanel: vi.fn(),
    updateMeta: vi.fn(),
    updateStatus: vi.fn(),
    updateMoveList: vi.fn(),
    updateGuidance: vi.fn(),
    updatePlacementPanel: vi.fn(),
    showResultOverlay: vi.fn()
}));
vi.mock('../../services/llmCoach.js', () => ({
    getLlmCoachConfigStatus: vi.fn(() => 'missing'),
    isLlmCoachConfigured: vi.fn(() => false),
    normalizeLlmCoachSettings: vi.fn((s) => ({
        enabled: Boolean(s?.enabled),
        baseUrl: (s?.baseUrl || '').trim(),
        model: (s?.model || '').trim(),
        apiKey: (s?.apiKey || '').trim()
    })),
    saveLlmCoachSettings: vi.fn((s) => ({ ...s, saved: true })),
    testLlmCoachConnection: vi.fn()
}));
vi.mock('../../config/sceneConfig.js', () => ({
    getSceneAmbienceCue: vi.fn(() => 'home-setup-idle')
}));

import { SettingsController } from './SettingsController.js';
import { setActiveButton, setActiveByValue } from '../../ui/dom.js';
import {
    syncSetupPanel,
    updateMeta,
    updateStatus,
    updateMoveList,
    updateGuidance,
    updatePlacementPanel,
    showResultOverlay
} from '../../ui/render.js';
import {
    getLlmCoachConfigStatus,
    isLlmCoachConfigured,
    normalizeLlmCoachSettings,
    saveLlmCoachSettings,
    testLlmCoachConnection
} from '../../services/llmCoach.js';

// Setup document.body mock with classList support
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

if (!Object.getOwnPropertyDescriptor(document, 'activeElement')) {
    Object.defineProperty(document, 'activeElement', {
        value: null,
        configurable: true
    });
}

function createMockElement() {
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
        disabled: false,
        checked: false,
        value: '',
        focus: vi.fn(),
        blur: vi.fn(),
        contains: vi.fn(() => false),
        closest: vi.fn(() => null),
        querySelector: vi.fn(() => null),
        querySelectorAll: vi.fn(() => []),
        _classes: classes,
        _attrs: attrs
    };
}

function createMockApp(overrides = {}) {
    const helpSheet = createMockElement();
    const helpOverlay = createMockElement();
    const helpOpen = createMockElement();
    const llmOverlay = createMockElement();
    const llmBaseUrl = createMockElement();
    const llmModel = createMockElement();
    const llmApiKey = createMockElement();
    const llmStatus = createMockElement();
    const llmSave = createMockElement();
    const llmTest = createMockElement();
    const llmClear = createMockElement();
    const llmClose = createMockElement();
    const llmEnabled = createMockElement();
    llmEnabled.checked = false;
    const firstRunCard = createMockElement();
    const soundToggle = createMockElement();
    const sectionGame = createMockElement();
    const sectionSetup = createMockElement();
    const resultOverlay = createMockElement();

    const mockState = {
        resultType: null,
        resultWinnerColor: null,
        resultSummary: null,
        moveHistory: [],
        lastMove: null,
        currentPlayer: 'black',
        gameOver: false,
        aiThinking: false,
        coachLlmStatus: 'local',
        board: Array.from({ length: 15 }, () => Array(15).fill(null))
    };

    return {
        dom: {
            help: {
                sheet: helpSheet,
                overlay: helpOverlay,
                open: helpOpen
            },
            llmSettings: {
                overlay: llmOverlay,
                baseUrl: llmBaseUrl,
                model: llmModel,
                apiKey: llmApiKey,
                status: llmStatus,
                save: llmSave,
                test: llmTest,
                clearKey: llmClear,
                close: llmClose,
                enabled: llmEnabled
            },
            firstRunGuide: {
                card: firstRunCard
            },
            controls: {
                soundToggle,
                setupLlmSettings: createMockElement()
            },
            guidance: {
                settings: createMockElement()
            },
            sections: {
                game: sectionGame,
                setup: sectionSetup
            },
            result: {
                overlay: resultOverlay
            }
        },
        options: { size: 15, rule: 'classic', mode: 'pvp', scene: 'home', playerColor: 'black', level: 'beginner' },
        state: mockState,
        sound: {
            play: vi.fn(),
            isEnabled: vi.fn(() => true),
            setAmbience: vi.fn()
        },
        renderer3d: null,
        use3D: false,
        helpOpen: false,
        llmSettingsOpen: false,
        llmSettings: { enabled: false, baseUrl: '', model: '', apiKey: '' },
        llmTestAbortController: null,
        firstRunGuideOpen: false,
        firstRunGuideSeen: false,
        immersiveUiEnabled: true,
        currentAmbientCue: null,
        sceneSwitchTimer: null,
        render: vi.fn(),
        showMessageKey: vi.fn(),
        isGuidedMode: vi.fn(() => false),
        canHumanMove: vi.fn(() => false),
        refreshCoachGuidance: vi.fn(),
        refreshSetup: vi.fn(),
        applyScenePresentation: vi.fn(),
        syncSceneExperience: vi.fn(),
        refreshSoundToggle: vi.fn(),
        refreshImmersiveToggle: vi.fn(),
        createResultSummary: vi.fn((t, w) => ({
            badge: t === 'win' ? 'Win!' : t === 'draw' ? 'Draw' : 'Resign',
            title: 'Game Over',
            detail: 'Detail',
            moves: 0,
            lastMove: '-',
            variant: `result-${t}`
        })),
        ...overrides
    };
}

let originalLocalStorage;
let originalSetTimeout;

beforeEach(() => {
    vi.clearAllMocks();
    if (document.body._classes) {
        document.body._classes.clear();
    }
    if (document.body.dataset) {
        Object.keys(document.body.dataset).forEach((k) => delete document.body.dataset[k]);
    }
    originalLocalStorage = window.localStorage;
    originalSetTimeout = window.setTimeout;
    window.setTimeout = (fn) => { if (typeof fn === 'function') fn(); return 0; };
});

afterEach(() => {
    window.setTimeout = originalSetTimeout;
});

describe('SettingsController.constructor', () => {
    it('stores app reference', () => {
        const app = createMockApp();
        const ctrl = new SettingsController(app);
        expect(ctrl.app).toBe(app);
    });
});

describe('SettingsController.syncHelpUi', () => {
    it('shows help when helpOpen is true', () => {
        const app = createMockApp();
        app.helpOpen = true;
        const ctrl = new SettingsController(app);
        ctrl.syncHelpUi();
        expect(app.dom.help.overlay._classes.has('hidden')).toBe(false);
        expect(app.dom.help.overlay._attrs['aria-hidden']).toBe('false');
        expect(app.dom.help.open._attrs['aria-expanded']).toBe('true');
        expect(document.body.classList.contains('help-open')).toBe(true);
    });

    it('hides help when helpOpen is false', () => {
        const app = createMockApp();
        const ctrl = new SettingsController(app);
        ctrl.syncHelpUi();
        expect(app.dom.help.overlay._classes.has('hidden')).toBe(true);
        expect(app.dom.help.overlay._attrs['aria-hidden']).toBe('true');
        expect(document.body.classList.contains('help-open')).toBe(false);
    });

    it('handles missing overlay gracefully', () => {
        const app = createMockApp();
        app.dom.help.overlay = null;
        const ctrl = new SettingsController(app);
        ctrl.syncHelpUi(); // should not throw
    });

    it('handles missing open button gracefully', () => {
        const app = createMockApp();
        app.dom.help.open = null;
        const ctrl = new SettingsController(app);
        ctrl.syncHelpUi(); // should not throw
    });
});

describe('SettingsController.openHelp', () => {
    it('sets helpOpen and scrolls sheet', () => {
        const app = createMockApp();
        const ctrl = new SettingsController(app);
        ctrl.openHelp();
        expect(app.helpOpen).toBe(true);
        expect(app.dom.help.sheet.scrollTop).toBe(0);
        expect(app.dom.help.sheet.scrollLeft).toBe(0);
    });

    it('handles missing sheet gracefully', () => {
        const app = createMockApp();
        app.dom.help.sheet = null;
        const ctrl = new SettingsController(app);
        ctrl.openHelp(); // should not throw
    });
});

describe('SettingsController.closeHelp', () => {
    it('sets helpOpen to false', () => {
        const app = createMockApp();
        app.helpOpen = true;
        const ctrl = new SettingsController(app);
        ctrl.closeHelp();
        expect(app.helpOpen).toBe(false);
    });
});

describe('SettingsController.openLlmSettings', () => {
    it('opens and syncs LLM settings', () => {
        const app = createMockApp();
        const ctrl = new SettingsController(app);
        ctrl.openLlmSettings();
        expect(app.llmSettingsOpen).toBe(true);
        expect(app.dom.llmSettings.baseUrl.value).toBe('');
    });
});

describe('SettingsController.closeLlmSettings', () => {
    it('closes LLM settings when open', () => {
        const app = createMockApp();
        app.llmSettingsOpen = true;
        const ctrl = new SettingsController(app);
        ctrl.closeLlmSettings();
        expect(app.llmSettingsOpen).toBe(false);
    });

    it('does nothing when already closed', () => {
        const app = createMockApp();
        const ctrl = new SettingsController(app);
        ctrl.closeLlmSettings();
        expect(app.llmSettingsOpen).toBe(false);
    });
});

describe('SettingsController.syncLlmSettingsUi', () => {
    it('shows overlay when open', () => {
        const app = createMockApp();
        app.llmSettingsOpen = true;
        const ctrl = new SettingsController(app);
        ctrl.syncLlmSettingsUi();
        expect(app.dom.llmSettings.overlay._classes.has('hidden')).toBe(false);
        expect(app.dom.llmSettings.overlay._attrs['aria-hidden']).toBe('false');
        expect(document.body.classList.contains('llm-settings-open')).toBe(true);
    });

    it('hides overlay when closed', () => {
        const app = createMockApp();
        const ctrl = new SettingsController(app);
        ctrl.syncLlmSettingsUi();
        expect(app.dom.llmSettings.overlay._classes.has('hidden')).toBe(true);
    });

    it('handles missing overlay', () => {
        const app = createMockApp();
        app.dom.llmSettings.overlay = null;
        const ctrl = new SettingsController(app);
        ctrl.syncLlmSettingsUi(); // should not throw
    });
});

describe('SettingsController.syncLlmSettingsForm', () => {
    it('writes settings to form fields', () => {
        const app = createMockApp();
        app.llmSettings = { enabled: true, baseUrl: 'http://test', model: 'gpt-4', apiKey: 'sk-test' };
        const ctrl = new SettingsController(app);
        ctrl.syncLlmSettingsForm();
        expect(app.dom.llmSettings.enabled.checked).toBe(true);
        expect(app.dom.llmSettings.baseUrl.value).toBe('http://test');
        expect(app.dom.llmSettings.model.value).toBe('gpt-4');
        expect(app.dom.llmSettings.apiKey.value).toBe('sk-test');
        expect(app.dom.llmSettings.status.textContent).toBe('');
    });

    it('handles missing enabled checkbox', () => {
        const app = createMockApp();
        app.dom.llmSettings.enabled = null;
        const ctrl = new SettingsController(app);
        ctrl.syncLlmSettingsForm(); // should not throw
    });
});

describe('SettingsController.readLlmSettingsForm', () => {
    it('reads and normalizes form values', () => {
        const app = createMockApp();
        app.dom.llmSettings.enabled.checked = true;
        app.dom.llmSettings.baseUrl.value = '  http://test  ';
        app.dom.llmSettings.model.value = 'gpt-4';
        app.dom.llmSettings.apiKey.value = 'sk-test';
        const ctrl = new SettingsController(app);
        const result = ctrl.readLlmSettingsForm();
        expect(result.enabled).toBe(true);
        expect(result.baseUrl).toBe('http://test');
        expect(result.model).toBe('gpt-4');
        expect(result.apiKey).toBe('sk-test');
    });

    it('handles null fields', () => {
        const app = createMockApp();
        app.dom.llmSettings.enabled = null;
        app.dom.llmSettings.baseUrl = null;
        const ctrl = new SettingsController(app);
        const result = ctrl.readLlmSettingsForm();
        expect(result.enabled).toBe(false);
    });
});

describe('SettingsController.saveLlmSettingsFromForm', () => {
    it('saves settings and shows message', () => {
        const app = createMockApp();
        const ctrl = new SettingsController(app);
        ctrl.saveLlmSettingsFromForm();
        expect(saveLlmCoachSettings).toHaveBeenCalled();
        expect(app.sound.play).toHaveBeenCalledWith('uiTap');
        expect(app.showMessageKey).toHaveBeenCalledWith('llmSettingsSaved');
    });

    it('refreshes coach guidance in guided mode when human can move', () => {
        const app = createMockApp();
        app.isGuidedMode.mockReturnValue(true);
        app.canHumanMove.mockReturnValue(true);
        const ctrl = new SettingsController(app);
        ctrl.saveLlmSettingsFromForm();
        expect(app.refreshCoachGuidance).toHaveBeenCalledWith(false);
    });
});

describe('SettingsController.testLlmSettingsFromForm', () => {
    it('shows error when config is incomplete', async () => {
        isLlmCoachConfigured.mockReturnValue(false);
        const app = createMockApp();
        const ctrl = new SettingsController(app);
        await ctrl.testLlmSettingsFromForm();
        expect(app.sound.play).toHaveBeenCalledWith('error');
    });

    it('tests connection when configured', async () => {
        isLlmCoachConfigured.mockReturnValue(true);
        testLlmCoachConnection.mockResolvedValue(undefined);
        const app = createMockApp();
        const ctrl = new SettingsController(app);
        await ctrl.testLlmSettingsFromForm();
        expect(app.dom.llmSettings.test.disabled).toBe(false);
    });

    it('handles test failure', async () => {
        isLlmCoachConfigured.mockReturnValue(true);
        testLlmCoachConnection.mockRejectedValue(new Error('Network error'));
        const app = createMockApp();
        const ctrl = new SettingsController(app);
        await ctrl.testLlmSettingsFromForm();
        expect(app.dom.llmSettings.test.disabled).toBe(false);
    });

    it('ignores abort errors', async () => {
        isLlmCoachConfigured.mockReturnValue(true);
        testLlmCoachConnection.mockRejectedValue({ code: 'aborted' });
        const app = createMockApp();
        const ctrl = new SettingsController(app);
        await ctrl.testLlmSettingsFromForm();
        // Should not show error message for aborted
    });
});

describe('SettingsController.clearLlmApiKey', () => {
    it('clears API key field', () => {
        const app = createMockApp();
        app.dom.llmSettings.apiKey.value = 'sk-old';
        const ctrl = new SettingsController(app);
        ctrl.clearLlmApiKey();
        expect(app.dom.llmSettings.apiKey.value).toBe('');
        expect(saveLlmCoachSettings).toHaveBeenCalled();
        expect(app.sound.play).toHaveBeenCalledWith('uiTap');
    });
});

describe('SettingsController.setLlmSettingsStatus', () => {
    it('sets status text and class', () => {
        const app = createMockApp();
        const ctrl = new SettingsController(app);
        ctrl.setLlmSettingsStatus('Ready', 'success');
        expect(app.dom.llmSettings.status.textContent).toBe('Ready');
        expect(app.dom.llmSettings.status.className).toContain('llm-test-status-success');
    });

    it('handles missing status element', () => {
        const app = createMockApp();
        app.dom.llmSettings.status = null;
        const ctrl = new SettingsController(app);
        ctrl.setLlmSettingsStatus('Ready'); // should not throw
    });

    it('uses empty variant when not specified', () => {
        const app = createMockApp();
        const ctrl = new SettingsController(app);
        ctrl.setLlmSettingsStatus('Ready');
        expect(app.dom.llmSettings.status.className).toBe('llm-test-status');
    });
});

describe('SettingsController.showFirstRunGuideIfNeeded', () => {
    it('shows guide when not seen', () => {
        const app = createMockApp();
        app.firstRunGuideSeen = false;
        const ctrl = new SettingsController(app);
        ctrl.showFirstRunGuideIfNeeded();
        expect(app.firstRunGuideOpen).toBe(true);
        expect(app.dom.firstRunGuide.card._classes.has('hidden')).toBe(false);
        expect(app.dom.firstRunGuide.card._attrs['aria-hidden']).toBe('false');
        expect(document.body.classList.contains('first-run-guide-open')).toBe(true);
    });

    it('does nothing when already seen', () => {
        const app = createMockApp();
        app.firstRunGuideSeen = true;
        const ctrl = new SettingsController(app);
        ctrl.showFirstRunGuideIfNeeded();
        expect(app.firstRunGuideOpen).toBe(false);
    });

    it('does nothing when card element is missing', () => {
        const app = createMockApp();
        app.dom.firstRunGuide.card = null;
        const ctrl = new SettingsController(app);
        ctrl.showFirstRunGuideIfNeeded(); // should not throw
    });
});

describe('SettingsController.dismissFirstRunGuide', () => {
    it('dismisses guide and persists', () => {
        const app = createMockApp();
        app.firstRunGuideOpen = true;
        const ctrl = new SettingsController(app);
        ctrl.dismissFirstRunGuide();
        expect(app.firstRunGuideSeen).toBe(true);
        expect(app.firstRunGuideOpen).toBe(false);
        expect(app.dom.firstRunGuide.card._classes.has('hidden')).toBe(true);
        expect(app.dom.firstRunGuide.card._attrs['aria-hidden']).toBe('true');
        expect(document.body.classList.contains('first-run-guide-open')).toBe(false);
    });

    it('blurs focused guide controls before hiding the guide', () => {
        const app = createMockApp();
        const focusedButton = createMockElement();
        app.firstRunGuideOpen = true;
        app.dom.firstRunGuide.card.contains = vi.fn((element) => element === focusedButton);
        const activeElementSpy = vi.spyOn(document, 'activeElement', 'get').mockReturnValue(focusedButton);
        const ctrl = new SettingsController(app);

        ctrl.dismissFirstRunGuide();

        expect(focusedButton.blur).toHaveBeenCalled();
        activeElementSpy.mockRestore();
    });

    it('does nothing when not open', () => {
        const app = createMockApp();
        const ctrl = new SettingsController(app);
        ctrl.dismissFirstRunGuide(); // should not throw
        expect(app.firstRunGuideSeen).toBe(false);
    });
});

describe('SettingsController.loadFirstRunGuideSeen', () => {
    it('returns true when localStorage has 1', () => {
        Object.defineProperty(window, 'localStorage', {
            value: { getItem: vi.fn(() => '1') },
            writable: true, configurable: true
        });
        const app = createMockApp();
        const ctrl = new SettingsController(app);
        expect(ctrl.loadFirstRunGuideSeen()).toBe(true);
        Object.defineProperty(window, 'localStorage', { value: originalLocalStorage, writable: true, configurable: true });
    });

    it('returns false when localStorage is null', () => {
        Object.defineProperty(window, 'localStorage', {
            value: { getItem: vi.fn(() => null) },
            writable: true, configurable: true
        });
        const app = createMockApp();
        const ctrl = new SettingsController(app);
        expect(ctrl.loadFirstRunGuideSeen()).toBe(false);
        Object.defineProperty(window, 'localStorage', { value: originalLocalStorage, writable: true, configurable: true });
    });

    it('returns false when localStorage throws', () => {
        Object.defineProperty(window, 'localStorage', {
            value: { getItem: vi.fn(() => { throw new Error('blocked'); }) },
            writable: true, configurable: true
        });
        const app = createMockApp();
        const ctrl = new SettingsController(app);
        expect(ctrl.loadFirstRunGuideSeen()).toBe(false);
        Object.defineProperty(window, 'localStorage', { value: originalLocalStorage, writable: true, configurable: true });
    });
});

describe('SettingsController.persistFirstRunGuideSeen', () => {
    it('saves to localStorage', () => {
        const storage = { setItem: vi.fn() };
        Object.defineProperty(window, 'localStorage', {
            value: storage,
            writable: true, configurable: true
        });
        const app = createMockApp();
        const ctrl = new SettingsController(app);
        ctrl.persistFirstRunGuideSeen();
        expect(storage.setItem).toHaveBeenCalledWith('gomoku-first-run-guide', '1');
        Object.defineProperty(window, 'localStorage', { value: originalLocalStorage, writable: true, configurable: true });
    });

    it('handles localStorage error', () => {
        Object.defineProperty(window, 'localStorage', {
            value: { setItem: vi.fn(() => { throw new Error('blocked'); }) },
            writable: true, configurable: true
        });
        const app = createMockApp();
        const ctrl = new SettingsController(app);
        ctrl.persistFirstRunGuideSeen(); // should not throw
        Object.defineProperty(window, 'localStorage', { value: originalLocalStorage, writable: true, configurable: true });
    });
});

describe('SettingsController.loadImmersiveUiPreference', () => {
    it('returns true when enabled', () => {
        Object.defineProperty(window, 'localStorage', {
            value: { getItem: vi.fn(() => '1') },
            writable: true, configurable: true
        });
        const app = createMockApp();
        const ctrl = new SettingsController(app);
        expect(ctrl.loadImmersiveUiPreference()).toBe(true);
        Object.defineProperty(window, 'localStorage', { value: originalLocalStorage, writable: true, configurable: true });
    });

    it('returns true when no saved value', () => {
        Object.defineProperty(window, 'localStorage', {
            value: { getItem: vi.fn(() => null) },
            writable: true, configurable: true
        });
        const app = createMockApp();
        const ctrl = new SettingsController(app);
        expect(ctrl.loadImmersiveUiPreference()).toBe(true);
        Object.defineProperty(window, 'localStorage', { value: originalLocalStorage, writable: true, configurable: true });
    });

    it('returns true on error', () => {
        Object.defineProperty(window, 'localStorage', {
            value: { getItem: vi.fn(() => { throw new Error('blocked'); }) },
            writable: true, configurable: true
        });
        const app = createMockApp();
        const ctrl = new SettingsController(app);
        expect(ctrl.loadImmersiveUiPreference()).toBe(true);
        Object.defineProperty(window, 'localStorage', { value: originalLocalStorage, writable: true, configurable: true });
    });
});

describe('SettingsController.persistImmersiveUiPreference', () => {
    it('saves enabled state', () => {
        const storage = { setItem: vi.fn() };
        Object.defineProperty(window, 'localStorage', {
            value: storage,
            writable: true, configurable: true
        });
        const app = createMockApp();
        const ctrl = new SettingsController(app);
        ctrl.persistImmersiveUiPreference();
        expect(storage.setItem).toHaveBeenCalledWith('gomoku-immersive-ui', '1');
        Object.defineProperty(window, 'localStorage', { value: originalLocalStorage, writable: true, configurable: true });
    });

    it('saves disabled state', () => {
        const storage = { setItem: vi.fn() };
        Object.defineProperty(window, 'localStorage', {
            value: storage,
            writable: true, configurable: true
        });
        const app = createMockApp();
        app.immersiveUiEnabled = false;
        const ctrl = new SettingsController(app);
        ctrl.persistImmersiveUiPreference();
        expect(storage.setItem).toHaveBeenCalledWith('gomoku-immersive-ui', '0');
        Object.defineProperty(window, 'localStorage', { value: originalLocalStorage, writable: true, configurable: true });
    });

    it('handles error', () => {
        Object.defineProperty(window, 'localStorage', {
            value: { setItem: vi.fn(() => { throw new Error('blocked'); }) },
            writable: true, configurable: true
        });
        const app = createMockApp();
        const ctrl = new SettingsController(app);
        ctrl.persistImmersiveUiPreference(); // should not throw
        Object.defineProperty(window, 'localStorage', { value: originalLocalStorage, writable: true, configurable: true });
    });
});

describe('SettingsController.refreshSoundToggle', () => {
    it('updates button when sound is enabled', () => {
        const app = createMockApp();
        const ctrl = new SettingsController(app);
        ctrl.refreshSoundToggle();
        const btn = app.dom.controls.soundToggle;
        expect(btn._attrs['aria-label']).toBe('soundOn');
        expect(btn._attrs['aria-pressed']).toBe('true');
        expect(btn._classes.has('is-muted')).toBe(false);
    });

    it('updates button when sound is muted', () => {
        const app = createMockApp();
        app.sound.isEnabled.mockReturnValue(false);
        const ctrl = new SettingsController(app);
        ctrl.refreshSoundToggle();
        const btn = app.dom.controls.soundToggle;
        expect(btn._attrs['aria-label']).toBe('soundOff');
        expect(btn._attrs['aria-pressed']).toBe('false');
        expect(btn._classes.has('is-muted')).toBe(true);
    });

    it('handles missing button', () => {
        const app = createMockApp();
        app.dom.controls.soundToggle = null;
        const ctrl = new SettingsController(app);
        ctrl.refreshSoundToggle(); // should not throw
    });
});

describe('SettingsController.setButtonLabel', () => {
    it('writes to data-role label element when present', () => {
        const labelEl = { textContent: '' };
        const button = {
            querySelector: vi.fn((sel) => sel === '[data-role="button-label"]' ? labelEl : null)
        };
        const app = createMockApp();
        const ctrl = new SettingsController(app);
        ctrl.setButtonLabel(button, 'New Label');
        expect(labelEl.textContent).toBe('New Label');
    });

    it('falls back to textContent', () => {
        const button = { querySelector: vi.fn(() => null), textContent: '' };
        const app = createMockApp();
        const ctrl = new SettingsController(app);
        ctrl.setButtonLabel(button, 'New Label');
        expect(button.textContent).toBe('New Label');
    });

    it('handles null button', () => {
        const app = createMockApp();
        const ctrl = new SettingsController(app);
        ctrl.setButtonLabel(null, 'test'); // should not throw
    });
});

describe('SettingsController.handleLanguageChange', () => {
    it('refreshes setup, sound, and immersive toggle', () => {
        const app = createMockApp();
        const ctrl = new SettingsController(app);
        ctrl.handleLanguageChange();
        expect(app.refreshSetup).toHaveBeenCalled();
        expect(app.dom.controls.soundToggle.getAttribute('aria-label')).toBe('soundOn');
        expect(app.refreshImmersiveToggle).toHaveBeenCalled();
    });

    it('calls render when game section is visible', () => {
        const app = createMockApp();
        // Game section starts visible by default (no 'hidden' class)
        const ctrl = new SettingsController(app);
        ctrl.handleLanguageChange();
        expect(app.render).toHaveBeenCalled();
    });

    it('updates meta when game section is hidden', () => {
        const app = createMockApp();
        app.dom.sections.game._classes.add('hidden');
        const ctrl = new SettingsController(app);
        ctrl.handleLanguageChange();
        expect(updateMeta).toHaveBeenCalled();
    });

    it('shows result overlay when result exists', () => {
        const app = createMockApp();
        app.dom.sections.game.classList.add('hidden');
        app.state.resultType = 'win';
        app.state.resultWinnerColor = 'black';
        const ctrl = new SettingsController(app);
        const resultSpy = vi.spyOn(ctrl.app.dom.result.overlay.classList, 'contains');
        resultSpy.mockReturnValue(false);
        ctrl.handleLanguageChange();
        // result overlay not visible, so not shown
    });
});

describe('SettingsController.refreshSetup', () => {
    it('syncs setup panel and applies scene', () => {
        const app = createMockApp();
        const ctrl = new SettingsController(app);
        ctrl.refreshSetup();
        expect(syncSetupPanel).toHaveBeenCalledWith(app.dom, app.options);
        expect(app.applyScenePresentation).toHaveBeenCalledWith({ animate: false });
        expect(app.syncSceneExperience).toHaveBeenCalledWith({ animateCamera: false });
    });

    it('configures 3D renderer when available and setup is visible', () => {
        const app = createMockApp();
        app.dom.sections.game.classList.add('hidden');
        app.use3D = true;
        app.renderer3d = {
            setBoardSize: vi.fn(),
            setInteractionEnabled: vi.fn(),
            fitToBoard: vi.fn()
        };
        const ctrl = new SettingsController(app);
        ctrl.refreshSetup();
        expect(app.renderer3d.setBoardSize).toHaveBeenCalledWith(15);
        expect(app.renderer3d.fitToBoard).toHaveBeenCalledWith(15, false);
    });

    it('skips interaction disable when game section is visible', () => {
        const app = createMockApp();
        app.use3D = true;
        app.renderer3d = {
            setBoardSize: vi.fn(),
            setInteractionEnabled: vi.fn(),
            fitToBoard: vi.fn()
        };
        app.dom.sections.game.classList.remove('hidden');
        const ctrl = new SettingsController(app);
        ctrl.refreshSetup();
        expect(app.renderer3d.setInteractionEnabled).not.toHaveBeenCalled();
        expect(app.renderer3d.fitToBoard).not.toHaveBeenCalled();
    });
});

describe('SettingsController.applyScenePresentation', () => {
    it('sets scene dataset on body', () => {
        const app = createMockApp();
        const ctrl = new SettingsController(app);
        ctrl.applyScenePresentation({ animate: false });
        expect(document.body.dataset.scene).toBe('home');
    });

    it('sets scene dataset on body when animate is true', () => {
        const app = createMockApp();
        const ctrl = new SettingsController(app);
        ctrl.applyScenePresentation({ animate: true });
        expect(document.body.dataset.scene).toBe('home');
    });
});

describe('SettingsController.syncSceneExperience', () => {
    it('sets presentation mode and ambience', () => {
        const app = createMockApp();
        app.dom.sections.game.classList.add('hidden');
        const ctrl = new SettingsController(app);
        ctrl.syncSceneExperience({ animateCamera: false });
        expect(document.body.dataset.uiPresentation).toBe('setup');
        expect(app.sound.setAmbience).toHaveBeenCalledWith('home-setup-idle');
    });

    it('configures 3D renderer when available', () => {
        const app = createMockApp();
        app.dom.sections.game.classList.add('hidden');
        app.use3D = true;
        app.renderer3d = { setPresentationMode: vi.fn() };
        const ctrl = new SettingsController(app);
        ctrl.syncSceneExperience({ animateCamera: true });
        expect(app.renderer3d.setPresentationMode).toHaveBeenCalledWith('setup', { animate: true });
    });
});

describe('SettingsController.bindOptionGroup', () => {
    it('warns when group is null', () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const app = createMockApp();
        const ctrl = new SettingsController(app);
        ctrl.bindOptionGroup(null, 'mode', vi.fn());
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    it('calls onSelect when option button is clicked', () => {
        const onSelect = vi.fn();
        const button = {
            closest: vi.fn((sel) => sel === '.option-btn' ? button : null),
            dataset: { mode: 'pve' }
        };
        const group = {
            addEventListener: vi.fn((type, fn) => {
                // Simulate click
                fn({ target: button });
            })
        };
        const app = createMockApp();
        const ctrl = new SettingsController(app);
        ctrl.bindOptionGroup(group, 'mode', onSelect);
        expect(setActiveButton).toHaveBeenCalledWith(group, button);
        expect(onSelect).toHaveBeenCalledWith('pve');
        expect(app.sound.play).toHaveBeenCalledWith('uiTap');
    });

    it('ignores non-option-button clicks', () => {
        const onSelect = vi.fn();
        const target = {
            closest: vi.fn(() => null)
        };
        const group = {
            addEventListener: vi.fn((type, fn) => {
                fn({ target });
            })
        };
        const app = createMockApp();
        const ctrl = new SettingsController(app);
        ctrl.bindOptionGroup(group, 'mode', onSelect);
        expect(onSelect).not.toHaveBeenCalled();
    });
});
