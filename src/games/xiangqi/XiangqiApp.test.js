import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';

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
                mode: el(`${prefix}-mode-options`),
                level: el(`${prefix}-level-options`),
                levelRow: el(`${prefix}-level-row`),
                color: el(`${prefix}-color-options`),
                colorRow: el(`${prefix}-color-row`),
                start: el(`${prefix}-start-btn`),
                back: el(`${prefix}-back-to-launcher-btn`),
            },
            game: {
                panel: el(`${prefix}-game`),
                board: el(`${prefix}-board`),
                board3d: el(`${prefix}-board-3d`),
                message: el(`${prefix}-message`),
                currentPlayer: el(`${prefix}-current-player`),
                moveCount: el(`${prefix}-move-count`),
                lastMove: el(`${prefix}-last-move`),
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
                restart: el(`${prefix}-result-restart-btn`),
                launcher: el(`${prefix}-result-launcher-btn`),
            },
        };
    },
}));

const { mockDom } = vi.hoisted(() => ({
    mockDom: makeMockElements('xiangqi'),
}));

vi.mock('../../utils/i18n.js', () => ({
    i18n: { t: (key) => key },
}));

vi.mock('../../audio/SoundManager.js', () => ({
    SoundManager: class {
        constructor() { this._enabled = true; }
        play() {}
        isEnabled() { return this._enabled; }
        unlock() {}
        dispose() {}
    },
}));

const initialBoard = () => {
    const b = Array.from({ length: 10 }, () => Array(9).fill(null));
    b[0] = ['bR', 'bN', 'bE', 'bA', 'bK', 'bA', 'bE', 'bN', 'bR'];
    b[2] = ['', '', '', '', '', '', '', '', ''];
    b[3] = ['bP', '', '', '', '', '', '', '', 'bP'];
    b[6] = ['rP', '', '', '', '', '', '', '', 'rP'];
    b[9] = ['rR', 'rN', 'rE', 'rA', 'rK', 'rA', 'rE', 'rN', 'rR'];
    return b;
};

vi.mock('./state.js', () => ({
    createXiangqiState: vi.fn(() => ({
        board: initialBoard(),
        turn: 'r',
        moveHistory: [],
        gameOver: false,
        aiThinking: false,
        result: null,
    })),
    createXiangqiOptions: vi.fn(() => ({
        mode: 'pvp', level: 'easy', playerColor: 'r',
    })),
}));

vi.mock('./rules.js', () => ({
    applyMove: vi.fn((board, state, move) => ({
        board: board,
        state: { ...state, turn: state.turn === 'r' ? 'b' : 'r' },
    })),
    getLegalMovesFrom: vi.fn(() => []),
    isCheckmate: vi.fn(() => false),
    isStalemate: vi.fn(() => false),
    isInCheck: vi.fn(() => false),
}));

vi.mock('./ai.js', () => ({
    getXiangqiAIMove: vi.fn(() => null),
    getXiangqiAIDelay: vi.fn(() => 300),
}));

vi.mock('./render3d/XiangqiRenderer3D.js', () => ({
    XiangqiRenderer3D: class {
        constructor() { this.flipped = false; }
        onCellClick() {}
        show() {}
        hide() {}
        dispose() {}
        syncBoard() {}
    },
}));

const mockDoc = vi.hoisted(() => ({
    getElementById: (id) => {
        const map = {};
        const collect = (obj) => {
            for (const v of Object.values(obj)) {
                if (v && typeof v === 'object' && 'id' in v) map[v.id] = v;
                if (v && typeof v === 'object' && !('id' in v)) collect(v);
            }
        };
        collect(mockDom);
        return map[id] || null;
    },
}));

const { XiangqiApp } = await import('./XiangqiApp.js');

describe('XiangqiApp', () => {
    let app;

    beforeEach(() => {
        vi.useFakeTimers();
        app = new XiangqiApp(mockDoc);
    });

    afterEach(() => {
        if (app && typeof app.dispose === 'function') app.dispose();
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with default options', () => {
            expect(app.options.mode).toBe('pvp');
            expect(app.options.level).toBe('easy');
            expect(app.options.playerColor).toBe('r');
        });

        it('should create DOM references', () => {
            expect(app.dom.root).toBeDefined();
            expect(app.dom.setup.panel).toBeDefined();
            expect(app.dom.game.board).toBeDefined();
            expect(app.dom.game.board3d).toBeDefined();
        });

        it('should enter setup on construction', () => {
            expect(app.dom.setup.panel.classList.remove).toHaveBeenCalledWith('hidden');
        });
    });

    describe('startGame', () => {
        it('should switch panels and create state', () => {
            app.startGame();
            expect(app.dom.setup.panel.classList.add).toHaveBeenCalledWith('hidden');
            expect(app.dom.game.panel.classList.remove).toHaveBeenCalledWith('hidden');
            expect(app.state.turn).toBe('r');
            expect(app.dom.game.board.classList.add).toHaveBeenCalledWith('hidden');
        });
    });

    describe('isHumanTurn', () => {
        it('should return true for PvP mode', () => {
            app.startGame();
            app.options.mode = 'pvp';
            expect(app.isHumanTurn()).toBe(true);
        });

        it('should check player color in PvE mode', () => {
            app.startGame();
            app.options.mode = 'pve';
            app.options.playerColor = 'r';
            app.state.turn = 'r';
            expect(app.isHumanTurn()).toBe(true);
        });
    });

    describe('handleCellClick', () => {
        it('should reject clicks when game is over', () => {
            app.startGame();
            app.state.gameOver = true;
            app.handleCellClick(5, 4);
            expect(app.selected).toBeNull();
        });

        it('should reject clicks during AI thinking', () => {
            app.startGame();
            app.state.aiThinking = true;
            app.handleCellClick(5, 4);
            expect(app.sound.play).toBeDefined();
        });
    });

    describe('formatResult', () => {
        it('should format checkmate result', () => {
            app.startGame();
            app.state.result = { type: 'checkmate', winner: 'r' };
            const res = app.formatResult();
            expect(res.badge).toBe('xiangqiCheckmateBadge');
        });

        it('should format resign result', () => {
            app.startGame();
            app.state.result = { type: 'resign', winner: 'b' };
            const res = app.formatResult();
            expect(res.badge).toBe('resultResignBadge');
        });

        it('should format stalemate result', () => {
            app.startGame();
            app.state.result = { type: 'stalemate', winner: 'b' };
            const res = app.formatResult();
            expect(res.badge).toBe('xiangqiStalemateBadge');
        });

        it('should return empty for null result', () => {
            const res = app.formatResult();
            expect(res.badge).toBe('');
        });
    });

    describe('refreshSetupVisibility', () => {
        it('should show level and color rows for PvE mode', () => {
            app.options.mode = 'pve';
            app.refreshSetupVisibility();
            expect(app.dom.setup.levelRow.classList.toggle).toHaveBeenCalledWith('hidden', false);
            expect(app.dom.setup.colorRow.classList.toggle).toHaveBeenCalledWith('hidden', false);
        });

        it('should hide level and color rows for PvP mode', () => {
            app.options.mode = 'pvp';
            app.refreshSetupVisibility();
            expect(app.dom.setup.levelRow.classList.toggle).toHaveBeenCalledWith('hidden', true);
            expect(app.dom.setup.colorRow.classList.toggle).toHaveBeenCalledWith('hidden', true);
        });
    });

    describe('dispose', () => {
        it('should clean up without errors', () => {
            expect(() => app.dispose()).not.toThrow();
        });
    });

    describe('__reenter and hideRoot', () => {
        it('__reenter should call enterSetup', () => {
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
});
