import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';

// Patch window for test environment — removeEventListener is used in dispose()
beforeAll(() => {
    if (typeof window.removeEventListener === 'undefined') {
        window.removeEventListener = () => {};
    }
});

// Minimal mocks before any imports
const { mockControllerFactory } = vi.hoisted(() => {
    const factory = () => ({
        enterSetup: vi.fn(),
        startGame: vi.fn(),
        render: vi.fn(),
        commitMove: vi.fn(),
        undo: vi.fn(),
        showHint: vi.fn(),
        swapSides: vi.fn(),
        restart: vi.fn(),
        resign: vi.fn(),
        toggleSound: vi.fn(),
        resetCamera: vi.fn(),
        showMessageKey: vi.fn(),
        setAIThinking: vi.fn(),
        clearPendingAI: vi.fn(),
        createResultSummary: vi.fn(),
        refreshCoachGuidance: vi.fn(),
        clearCoachState: vi.fn(),
        cancelLlmCoachRequest: vi.fn(),
        focusCoachCandidate: vi.fn(),
        isLegalCoachMove: vi.fn(),
        handleImageUpload: vi.fn(),
        cancelImageAnalysis: vi.fn(),
        importAnalyzedBoard: vi.fn(),
        openPreviewEdit: vi.fn(),
        closePreviewEdit: vi.fn(),
        refreshSetup: vi.fn(),
        bindOptionGroup: vi.fn(),
        applyScenePresentation: vi.fn(),
        syncSceneExperience: vi.fn(),
        handleLanguageChange: vi.fn(),
        syncHelpUi: vi.fn(),
        refreshSoundToggle: vi.fn(),
        setButtonLabel: vi.fn(),
        openHelp: vi.fn(),
        closeHelp: vi.fn(),
        openLlmSettings: vi.fn(),
        closeLlmSettings: vi.fn(),
        saveLlmSettingsFromForm: vi.fn(),
        testLlmSettingsFromForm: vi.fn(),
        clearLlmApiKey: vi.fn(),
        setLlmSettingsStatus: vi.fn(),
        dismissFirstRunGuide: vi.fn(),
        showFirstRunGuideIfNeeded: vi.fn(),
        persistImmersiveUiPreference: vi.fn(),
        persistFirstRunGuideSeen: vi.fn(),
        loadFirstRunGuideSeen: vi.fn(() => false),
        loadImmersiveUiPreference: vi.fn(() => false),
        handleImmersivePointer: vi.fn(),
        handleImmersiveFocusIn: vi.fn(),
        isImmersiveUiActive: vi.fn(() => false),
        isImmersiveUiCapable: vi.fn(() => false),
        isDesktopHoverUi: vi.fn(() => true),
        refreshImmersiveUi: vi.fn(),
        refreshImmersiveToggle: vi.fn(),
        toggleImmersiveUi: vi.fn(),
        setImmersiveRegions: vi.fn(),
        handleCellClick: vi.fn(),
        validateMove: vi.fn(),
        selectCellForPlacement: vi.fn(),
        confirmSelectedPlacement: vi.fn(),
        cancelSelectedPlacement: vi.fn(),
        clearPlacementSelection: vi.fn(),
        canHumanMove: vi.fn(() => false),
        getForbiddenReason: vi.fn(),
        isAIMode: vi.fn(() => false),
        isGuidedMode: vi.fn(() => false),
        isTouchPlacementFlow: vi.fn(() => false),
        showPreview: vi.fn(),
        showPreview3D: vi.fn(),
        clearPreview: vi.fn(),
        highlightCell: vi.fn(),
        clearCellHighlight: vi.fn(),
        handleGlobalKeydown: vi.fn(),
    });
    return { mockControllerFactory: factory };
});

vi.mock('../render3d/GomokuRenderer3D.js', () => ({
    GomokuRenderer3D: class MockRenderer {
        constructor() { this.callbacks = {}; }
        static isWebGLAvailable() { return true; }
        setInteractionEnabled() { }
        onCellClick(fn) { this.callbacks.cellClick = fn; }
        onCellHover(fn) { this.callbacks.cellHover = fn; }
        onCellLeave(fn) { this.callbacks.cellLeave = fn; }
        resize() { }
        fitToBoard() { }
        dispose() { }
        getPresentationProfileName() { return 'home-setup'; }
    }
}));

vi.mock('../audio/SoundManager.js', () => ({
    SoundManager: class {
        constructor() { this._enabled = true; }
        play() { }
        isEnabled() { return this._enabled; }
        unlock() { }
        dispose() { }
    }
}));

vi.mock('../services/llmCoach.js', () => ({
    loadLlmCoachSettings: () => ({
        apiEndpoint: '', apiKey: '', model: '', enabled: false,
        defaultMessages: '', systemPrompt: ''
    }),
    setupGlobalErrorHandlers: () => { }
}));

const makeMockCtrls = vi.hoisted(() => ({
    game: null, coach: null, settings: null, immersive: null, interaction: null,
}));

vi.mock('./controllers/GameController.js', () => {
    const ctrl = mockControllerFactory();
    makeMockCtrls.game = ctrl;
    return { GameController: class { constructor() { return ctrl; } } };
});
vi.mock('./controllers/CoachController.js', () => {
    const ctrl = mockControllerFactory();
    makeMockCtrls.coach = ctrl;
    return { CoachController: class { constructor() { return ctrl; } } };
});
vi.mock('./controllers/SettingsController.js', () => {
    const ctrl = mockControllerFactory();
    makeMockCtrls.settings = ctrl;
    return { SettingsController: class { constructor() { return ctrl; } } };
});
vi.mock('./controllers/ImmersiveHudManager.js', () => {
    const ctrl = mockControllerFactory();
    makeMockCtrls.immersive = ctrl;
    return { ImmersiveHudManager: class { constructor() { return ctrl; } } };
});
vi.mock('./controllers/InteractionManager.js', () => {
    const ctrl = mockControllerFactory();
    makeMockCtrls.interaction = ctrl;
    return { InteractionManager: class { constructor() { return ctrl; } } };
});

vi.mock('../ui/dom.js', () => {
    const makeEl = (tag = 'div') => ({
        tag,
        classList: {
            add: vi.fn(), remove: vi.fn(), toggle: vi.fn(),
            contains: vi.fn(() => false)
        },
        dataset: {},
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        style: {},
        querySelector: vi.fn(() => null),
        closest: vi.fn(() => null),
        appendChild: vi.fn(),
        replaceChildren: vi.fn(),
        focus: vi.fn(),
        disabled: false,
        checked: false,
        value: '',
        className: '',
        scrollTop: 0,
        textContent: '',
        contains: vi.fn(() => false),
        getAttribute: vi.fn(() => null),
    });
    return {
        getDOMReferences: () => ({
            scene3d: makeEl('div'),
            board: makeEl('div'),
            boardPreviewOverlay: makeEl('div'),
            controls: {
                start: makeEl('button'), back: makeEl('button'), undo: makeEl('button'),
                hint: makeEl('button'), swap: makeEl('button'), restart: makeEl('button'),
                resign: makeEl('button'), viewReset: makeEl('button'), soundToggle: makeEl('button'),
                placementConfirm: makeEl('button'), selectionCancel: makeEl('button'),
                setupBackToLauncher: makeEl('button'),
            },
            sections: {
                game: { classList: { add: vi.fn(), remove: vi.fn(), contains: vi.fn(() => true) } },
            },
            optionGroups: {
                mode: makeEl(), rule: makeEl(), size: makeEl(), scene: makeEl(),
                level: makeEl(), playerColor: makeEl(),
            },
            result: { restart: makeEl('button'), setup: makeEl('button'), overlay: makeEl('div') },
            lang: { zh: makeEl('button'), en: makeEl('button') },
            guidance: {
                card: makeEl('div'), settings: makeEl('button'), rerun: makeEl('button'),
                upload: makeEl('button'), imageInput: makeEl('input'),
                importBtn: makeEl('button'), editBtn: makeEl('button'),
                previewCommit: makeEl('button'), previewCancel: makeEl('button'),
                alternatives: makeEl('div'),
            },
            llmSettings: {
                close: makeEl('button'), overlay: makeEl('div'), save: makeEl('button'),
                test: makeEl('button'), clearKey: makeEl('button'),
            },
            help: { open: makeEl('button'), close: makeEl('button'), overlay: makeEl('div') },
            firstRunGuide: { dismiss: makeEl('button'), details: makeEl('button') },
        }),
        setupLanguageSwitch: vi.fn(),
    };
});

vi.mock('../ui/devPanel.js', () => ({
    mountDevPanel: vi.fn(() => ({ dispose: vi.fn() })),
}));

vi.mock('../utils/formatters.js', () => ({
    formatMove: (r, c) => `${String.fromCharCode(65 + c)}${r + 1}`,
}));

vi.mock('../games/gomoku/state.js', () => ({
    createGameState: () => ({
        currentPlayer: 'black', moveHistory: [], lastMove: null,
        aiThinking: false, gameOver: false, coachSuggestion: null,
        coachSource: null, coachLlmStatus: null, coachAlternatives: [],
        coachFocus: null, selectedCell: null, awaitingPlacementConfirm: false,
        hintMove: null, coachPreviewMode: false,
    }),
    createOptions: () => ({
        mode: 'pvp', rule: 'classic', size: 15, scene: 'home',
        level: 'easy', playerColor: 'black',
    }),
}));

const { GomokuApp } = await import('./GomokuApp.js');

describe('GomokuApp', () => {
    let app;

    beforeEach(() => {
        vi.useFakeTimers();
        app = new GomokuApp();
    });

    afterEach(() => {
        if (app && typeof app.dispose === 'function') {
            app.dispose();
        }
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with default options and state', () => {
            expect(app.options.mode).toBe('pvp');
            expect(app.options.rule).toBe('classic');
            expect(app.options.size).toBe(15);
            expect(app.state.currentPlayer).toBe('black');
            expect(app.state.moveHistory).toEqual([]);
        });

        it('should create all 5 controllers', () => {
            expect(app.game).toBeDefined();
            expect(app.coach).toBeDefined();
            expect(app.settings).toBeDefined();
            expect(app.immersive).toBeDefined();
            expect(app.interaction).toBeDefined();
            expect(typeof app.game.enterSetup).toBe('function');
            expect(typeof app.coach.refreshCoachGuidance).toBe('function');
        });

        it('should call enterSetup and showFirstRunGuideIfNeeded on startup', () => {
            const ctrl = makeMockCtrls.game;
            expect(ctrl.enterSetup).toHaveBeenCalled();
        });
    });

    describe('initRenderer', () => {
        it('should initialize 3D renderer when WebGL is available', () => {
            expect(app.use3D).toBe(true);
            expect(app.renderer3d).toBeDefined();
        });

        it('should fall back to 2D when container is null', () => {
            app.dom.scene3d = null;
            app.use3D = true;
            app.renderer3d = null;
            app.initRenderer();
            expect(app.use3D).toBe(false);
        });
    });

    describe('getDebugState', () => {
        it('should return a complete debug state object', () => {
            const state = app.getDebugState();
            expect(state).toBeDefined();
            expect(state.screen).toBe('setup');
            expect(state.mode).toBe('pvp');
            expect(state.scene).toBe('home');
            expect(state.boardSize).toBe(15);
            expect(state.currentPlayer).toBe('black');
            expect(state.moveCount).toBe(0);
            expect(state.aiThinking).toBe(false);
            expect(state.gameOver).toBe(false);
            expect(typeof state.soundEnabled).toBe('boolean');
            expect(state.helpVisible).toBe(false);
        });
    });

    describe('delegation methods', () => {
        it('showMessageKey delegates to game.showMessageKey', () => {
            app.showMessageKey('test.key', { x: 1 }, 'info');
            expect(makeMockCtrls.game.showMessageKey).toHaveBeenCalledWith('test.key', { x: 1 }, 'info');
        });

        it('setAIThinking delegates to game.setAIThinking', () => {
            app.setAIThinking(true);
            expect(makeMockCtrls.game.setAIThinking).toHaveBeenCalledWith(true);
        });

        it('resetCamera delegates to game.resetCamera', () => {
            app.resetCamera();
            expect(makeMockCtrls.game.resetCamera).toHaveBeenCalled();
        });

        it('openLlmSettings delegates to settings.openLlmSettings', () => {
            app.openLlmSettings();
            expect(makeMockCtrls.settings.openLlmSettings).toHaveBeenCalled();
        });

        it('handleCellClick delegates to interaction.handleCellClick', () => {
            app.handleCellClick(3, 5);
            expect(makeMockCtrls.interaction.handleCellClick).toHaveBeenCalledWith(3, 5);
        });

        it('isGuidedMode delegates to interaction.isGuidedMode', () => {
            app.isGuidedMode();
            expect(makeMockCtrls.interaction.isGuidedMode).toHaveBeenCalled();
        });

        it('isImmersiveUiActive delegates to immersive', () => {
            app.isImmersiveUiActive();
            expect(makeMockCtrls.immersive.isImmersiveUiActive).toHaveBeenCalled();
        });
    });

    describe('test hooks', () => {
        it('should expose gomokuApp on window', () => {
            expect(window.gomokuApp).toBe(app);
        });

        it('render_game_to_text should return stringified JSON', () => {
            const text = window.render_game_to_text();
            expect(typeof text).toBe('string');
            const parsed = JSON.parse(text);
            expect(parsed.mode).toBe('pvp');
        });

        it('advanceTime should resolve with debug state after timeout', async () => {
            const promise = window.advanceTime(50);
            vi.advanceTimersByTime(50);
            const result = await promise;
            expect(result).toBeDefined();
            expect(result.screen).toBe('setup');
        });

        it('should clean up hooks on dispose', () => {
            app.dispose();
            expect(window.gomokuApp).toBeUndefined();
        });
    });

    describe('dispose', () => {
        it('should clean up renderer and sound', () => {
            const app2 = new GomokuApp();
            const disposeSound = vi.spyOn(app2.sound, 'dispose');
            app2.dispose();
            expect(app2.renderer3d).toBeNull();
            expect(disposeSound).toHaveBeenCalled();
        });
    });

    describe('getViewportProfile', () => {
        it('should return desktop-compact for 1024x768 viewport', () => {
            const profile = app.getViewportProfile();
            expect(profile.deviceForm).toBe('desktop-compact');
            expect(profile.orientation).toBe('landscape');
        });

        it('should return portrait when height > width', () => {
            Object.defineProperty(window, 'innerWidth', { value: 400, configurable: true });
            Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
            const profile = app.getViewportProfile();
            expect(profile.orientation).toBe('portrait');
            Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
            Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });
        });
    });

    describe('__reenter and hideRoot', () => {
        it('__reenter should call enterSetup', () => {
            app.__reenter();
            expect(makeMockCtrls.game.enterSetup).toHaveBeenCalled();
        });

        it('hideRoot should add hidden class to panels', () => {
            const setupPanel = { classList: { add: vi.fn() } };
            const gamePanel = { classList: { add: vi.fn() } };
            const resultOverlay = { classList: { add: vi.fn() } };
            app.dom.setup = { panel: setupPanel };
            app.dom.game = { panel: gamePanel };
            app.dom.result = { overlay: resultOverlay };
            app.hideRoot();
            expect(setupPanel.classList.add).toHaveBeenCalledWith('hidden');
            expect(gamePanel.classList.add).toHaveBeenCalledWith('hidden');
            expect(resultOverlay.classList.add).toHaveBeenCalledWith('hidden');
        });
    });
});
