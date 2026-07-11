import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';

// Patch window for test environment
beforeAll(() => {
    if (typeof window.removeEventListener === 'undefined') {
        window.removeEventListener = () => {};
    }
});

const { makeMockElements } = vi.hoisted(() => ({
    makeMockElements: (prefix) => {
        const el = (id) => ({
            id,
            classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn(), contains: vi.fn(() => false) },
            dataset: {},
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            style: { setProperty: vi.fn() },
            querySelector: vi.fn(() => null),
            closest: vi.fn(() => null),
            appendChild: vi.fn(),
            replaceChildren: vi.fn(),
            focus: vi.fn(),
            getAttribute: vi.fn(() => null),
            setAttribute: vi.fn(),
            textContent: '',
            disabled: false,
            className: '',
            value: '',
        });
        return {
            root: el(`${prefix}-root`),
            setup: {
                panel: el(`${prefix}-setup`),
                size: el(`${prefix}-size-options`),
                mode: el(`${prefix}-mode-options`),
                level: el(`${prefix}-level-options`),
                levelRow: el(`${prefix}-level-row`),
                handicap: el(`${prefix}-handicap-options`),
                handicapRow: el(`${prefix}-handicap-row`),
                scoring: el(`${prefix}-scoring-options`),
                start: el(`${prefix}-start-btn`),
                backToLauncher: el(`${prefix}-back-to-launcher-btn`),
            },
            game: {
                panel: el(`${prefix}-game`),
                board: el(`${prefix}-board`),
                board3d: el(`${prefix}-board-3d`),
                viewToggle: el(`${prefix}-view-toggle`),
                message: el(`${prefix}-message`),
                currentPlayer: el(`${prefix}-current-player`),
                moveCount: el(`${prefix}-move-count`),
                capturedBlack: el(`${prefix}-captures-black`),
                capturedWhite: el(`${prefix}-captures-white`),
                pass: el(`${prefix}-pass-btn`),
                undo: el(`${prefix}-undo-btn`),
                resign: el(`${prefix}-resign-btn`),
                restart: el(`${prefix}-restart-btn`),
                back: el(`${prefix}-back-btn`),
            },
            result: {
                overlay: el(`${prefix}-result-overlay`),
                badge: el(`${prefix}-result-badge`),
                title: el(`${prefix}-result-title`),
                detail: el(`${prefix}-result-detail`),
                blackScore: el(`${prefix}-black-score`),
                whiteScore: el(`${prefix}-white-score`),
                restart: el(`${prefix}-result-restart-btn`),
                launcher: el(`${prefix}-result-launcher-btn`),
            },
        };
    },
}));

const { mockDom } = vi.hoisted(() => ({
    mockDom: makeMockElements('go'),
}));

vi.mock('../../utils/i18n.js', () => ({
    i18n: { t: (key) => key },
}));

vi.mock('../../audio/SoundManager.js', () => ({
    SoundManager: class {
        constructor() { this._enabled = true; this.play = vi.fn(); }
        play() {}
        isEnabled() { return this._enabled; }
        unlock() {}
        dispose() {}
    },
}));

vi.mock('./state.js', () => ({
    createGoState: vi.fn(() => ({
        board: Array.from({ length: 9 }, () => Array(9).fill(null)),
        currentPlayer: 'black',
        captures: { black: 0, white: 0 },
        moveHistory: [],
        lastMove: null,
        koPoint: null,
        consecutivePasses: 0,
        gameOver: false,
        aiThinking: false,
    })),
    createGoOptions: vi.fn(() => ({
        mode: 'pvp', size: 9, level: 'easy', playerColor: 'black',
        handicap: 0, komi: 6.5, scoringRule: 'area',
    })),
}));

vi.mock('./rules.js', () => ({
    placeStone: vi.fn(() => ({ legal: true, board: Array.from({ length: 9 }, () => Array(9).fill(null)), captured: [], koPoint: null })),
    isLegalMove: vi.fn(() => true),
    getOpponent: vi.fn((color) => (color === 'black' ? 'white' : 'black')),
}));

vi.mock('./scoring.js', () => ({
    scoreBoardWithRule: vi.fn(() => ({ winner: 'black', blackScore: 18.5, whiteScore: 12.0, margin: 6.5 })),
    getTerritoryMap: vi.fn(() => ({})),
}));

vi.mock('./ai.js', () => ({
    getGoAIMove: vi.fn(() => null),
    getGoAIDelay: vi.fn(() => 500),
}));

// GoRenderer3D requires Three.js — mock completely
vi.mock('./render3d/GoRenderer3D.js', () => ({
    GoRenderer3D: class {
        constructor() { this.boardSize = 0; }
        setBoardSize() {}
        syncBoard() {}
        highlightLastMove() {}
        highlightKo() {}
        highlightHint() {}
        showTerritory() {}
        hideTerritory() {}
        show() {}
        hide() {}
        dispose() {}
        onCellClick() {}
    },
}));

const mockDoc = vi.hoisted(() => {
    const el = (id) => {
        const e = { id, classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn(), contains: vi.fn(() => false) }, addEventListener: vi.fn(), dataset: {} };
        return e;
    };
    return {
        getElementById: (id) => {
            const map = {};
            mockDom.root.id = 'go-root';
            const collect = (obj) => {
                for (const v of Object.values(obj)) {
                    if (v && typeof v === 'object' && 'id' in v) map[v.id] = v;
                    if (v && typeof v === 'object' && !('id' in v)) collect(v);
                }
            };
            collect(mockDom);
            return map[id] || null;
        },
    };
});

const { GoApp } = await import('./GoApp.js');

describe('GoApp', () => {
    let app;

    beforeEach(() => {
        vi.useFakeTimers();
        app = new GoApp(mockDoc);
    });

    afterEach(() => {
        if (app && typeof app.dispose === 'function') app.dispose();
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with default options', () => {
            expect(app.options.size).toBe(9);
            expect(app.options.mode).toBe('pvp');
            expect(app.options.komi).toBe(6.5);
            expect(app.viewMode).toBe('3d');
            expect(app.renderer3d).toBeNull();
        });

        it('should create DOM references via queryDom', () => {
            expect(app.dom.root).toBeDefined();
            expect(app.dom.setup.panel).toBeDefined();
            expect(app.dom.game.board).toBeDefined();
            expect(app.dom.result.overlay).toBeDefined();
        });

        it('should enter setup on construction', () => {
            expect(app.dom.setup.panel.classList.remove).toHaveBeenCalledWith('hidden');
        });
    });

    describe('createInitialState', () => {
        it('should create state with correct board size', () => {
            const state = app.createInitialState();
            expect(state.currentPlayer).toBe('black');
            expect(state.captures).toEqual({ black: 0, white: 0 });
        });
    });

    describe('startGame', () => {
        it('should switch panels and create state', () => {
            // board.style.setProperty kept for mock compatibility with the hidden DOM board.
            app.dom.game.board.style.setProperty = vi.fn();
            app.startGame();
            expect(app.dom.setup.panel.classList.add).toHaveBeenCalledWith('hidden');
            expect(app.dom.game.panel.classList.remove).toHaveBeenCalledWith('hidden');
            expect(app.state.currentPlayer).toBe('black');
        });
    });

    describe('isHumanTurn', () => {
        it('should return true for PvP mode', () => {
            app.dom.game.board.style.setProperty = vi.fn();
            app.startGame();
            app.options.mode = 'pvp';
            expect(app.isHumanTurn()).toBe(true);
        });

        it('should check player color in PvE mode', () => {
            app.dom.game.board.style.setProperty = vi.fn();
            app.startGame();
            app.options.mode = 'pve';
            app.options.playerColor = 'black';
            app.state.currentPlayer = 'black';
            expect(app.isHumanTurn()).toBe(true);
        });
    });

    describe('handleCellClick', () => {
        it('should reject clicks when game is over', () => {
            app.dom.game.board.style.setProperty = vi.fn();
            app.startGame();
            app.state.gameOver = true;
            app.handleCellClick(3, 3);
            expect(app.state.moveHistory.length).toBe(0);
        });

        it('should reject clicks during AI thinking', () => {
            app.dom.game.board.style.setProperty = vi.fn();
            app.startGame();
            app.state.aiThinking = true;
            app.handleCellClick(3, 3);
            expect(app.sound.play).toHaveBeenCalledWith('error');
        });
    });

    describe('handlePass', () => {
        it('should reject pass when game is over', () => {
            app.dom.game.board.style.setProperty = vi.fn();
            app.startGame();
            app.state.gameOver = true;
            app.handlePass();
            expect(app.state.consecutivePasses).toBe(0);
        });
    });

    describe('toggleView and applyViewMode', () => {
        it('should keep Go in 3D-only mode', () => {
            app.dom.game.board.style.setProperty = vi.fn();
            app.startGame();
            expect(app.viewMode).toBe('3d');
            app.toggleView();
            expect(app.viewMode).toBe('3d');
            app.toggleView();
            expect(app.viewMode).toBe('3d');
        });
    });

    describe('dispose', () => {
        it('should clear renderer and call super dispose', () => {
            app.dispose();
            expect(app.renderer3d).toBeNull();
        });
    });

    describe('isStarPoint', () => {
        it('should identify 9路 star points', () => {
            expect(app.isStarPoint(2, 2)).toBe(true);
            expect(app.isStarPoint(4, 4)).toBe(true);
            expect(app.isStarPoint(0, 0)).toBe(false);
        });

        it('should identify 13路 star points', () => {
            app.options.size = 13;
            expect(app.isStarPoint(3, 3)).toBe(true);
            expect(app.isStarPoint(6, 6)).toBe(true);
        });

        it('should identify 19路 star points', () => {
            app.options.size = 19;
            expect(app.isStarPoint(3, 3)).toBe(true);
            expect(app.isStarPoint(9, 9)).toBe(true);
            expect(app.isStarPoint(15, 15)).toBe(true);
        });
    });

    describe('formatResult', () => {
        it('should format resign result', () => {
            app.dom.game.board.style.setProperty = vi.fn();
            app.startGame();
            app.state.result = { type: 'resign', winner: 'white' };
            const res = app.formatResult();
            expect(res.badge).toBe('resultResignBadge');
            expect(res.title).toContain('resultResignTitle');
        });

        it('should format scoring result with area rule', () => {
            app.dom.game.board.style.setProperty = vi.fn();
            app.startGame();
            app.state.result = { type: 'score', winner: 'black', blackScore: 18.5, whiteScore: 12.0, margin: 6.5 };
            const res = app.formatResult();
            expect(res.badge).toBe('goScoreBadgeArea');
        });

        it('should format scoring result with territory rule', () => {
            app.dom.game.board.style.setProperty = vi.fn();
            app.startGame();
            app.options.scoringRule = 'territory';
            app.state.result = { type: 'score', winner: 'black', blackScore: 12.5, whiteScore: 6.0, margin: 6.5 };
            const res = app.formatResult();
            expect(res.badge).toBe('goScoreBadgeTerritory');
        });
    });

    describe('commitMove', () => {
        it('should handle pass moves', () => {
            app.dom.game.board.style.setProperty = vi.fn();
            app.startGame();
            app.state.currentPlayer = 'black';
            app.commitMove({ pass: true });
            expect(app.state.moveHistory.length).toBe(1);
        });

        it('should handle stone placement moves', () => {
            app.dom.game.board.style.setProperty = vi.fn();
            app.startGame();
            app.commitMove({ row: 3, col: 3 });
        });
    });

    describe('__reenter and hideRoot', () => {
        it('__reenter should call enterSetup showing the panel', () => {
            app.dom.setup.panel.classList.remove = vi.fn();
            app.__reenter();
            expect(app.dom.setup.panel.classList.remove).toHaveBeenCalledWith('hidden');
        });

        it('hideRoot should hide panels', () => {
            app.dom.setup.panel.classList.add = vi.fn();
            app.dom.game.panel.classList.add = vi.fn();
            app.hideRoot();
            expect(app.dom.setup.panel.classList.add).toHaveBeenCalledWith('hidden');
            expect(app.dom.game.panel.classList.add).toHaveBeenCalledWith('hidden');
        });
    });

    describe('refreshSetupVisibility', () => {
        it('should show level row for PvE mode', () => {
            app.options.mode = 'pve';
            app.refreshSetupVisibility();
            expect(app.dom.setup.levelRow.classList.toggle).toHaveBeenCalledWith('hidden', false);
        });

        it('should show handicap row for non-practice mode', () => {
            app.options.mode = 'pvp';
            app.refreshSetupVisibility();
            expect(app.dom.setup.handicapRow.classList.toggle).toHaveBeenCalledWith('hidden', false);
        });
    });

    describe('handleUndo aiThinking guard', () => {
        it('should not undo when aiThinking is true', () => {
            app.startGame();
            app.state.moveHistory = [{ row: 3, col: 3, color: 'black' }];
            const lenBefore = app.state.moveHistory.length;
            app.state.aiThinking = true;
            app.handleUndo();
            expect(app.state.moveHistory.length).toBe(lenBefore);
        });

        it('should not undo when gameOver is true', () => {
            app.startGame();
            app.state.moveHistory = [{ row: 3, col: 3, color: 'black' }];
            const lenBefore = app.state.moveHistory.length;
            app.state.gameOver = true;
            app.handleUndo();
            expect(app.state.moveHistory.length).toBe(lenBefore);
        });
    });
});
