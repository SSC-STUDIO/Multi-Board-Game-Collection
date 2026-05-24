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
            root: el('junqi-root'),
            setup: {
                panel: el('junqi-setup'),
                variant: el('junqi-variant-options'),
                mode: el('junqi-mode-options'),
                level: el('junqi-level-options'),
                levelRow: el('junqi-level-row'),
                template: el('junqi-template-options'),
                templateRow: el('junqi-template-row'),
                start: el('junqi-start-btn'),
                back: el('junqi-back-to-launcher-btn'),
            },
            game: {
                panel: el('junqi-game'),
                board: el('junqi-board'),
                board3d: el('junqi-board-3d'),
                message: el('junqi-message'),
                currentPlayer: el('junqi-current-player'),
                moveCount: el('junqi-move-count'),
                lastMove: el('junqi-last-move'),
                hint: el('junqi-hint'),
                resign: el('junqi-resign-btn'),
                restart: el('junqi-restart-btn'),
                back: el('junqi-back-btn'),
            },
            result: {
                overlay: el('junqi-result-overlay'),
                badge: el('junqi-result-badge'),
                title: el('junqi-result-title'),
                detail: el('junqi-result-detail'),
                restart: el('junqi-result-restart-btn'),
                launcher: el('junqi-result-launcher-btn'),
            },
        };
    },
}));

const { mockDom } = vi.hoisted(() => ({
    mockDom: makeMockElements('junqi'),
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

const BOARD_ROWS = 5;
const BOARD_COLS = 6;

vi.mock('./flip/state.js', () => ({
    createFlipState: vi.fn(() => ({
        board: Array.from({ length: BOARD_ROWS }, () =>
            Array.from({ length: BOARD_COLS }, () => ({ rank: 'X', color: 'r', revealed: false }))
        ),
        turn: null,
        players: {},
        firstPlayer: 'p1',
        moveHistory: [],
        gameOver: false,
        aiThinking: false,
        result: null,
    })),
    createFlipOptions: vi.fn(() => ({
        variant: 'flip', mode: 'pvp', level: 'easy',
    })),
}));

vi.mock('./flip/rules.js', () => ({
    applyMove: vi.fn((board, state, move) => ({
        board: board,
        state: { ...state, turn: 'r' },
    })),
    checkWinner: vi.fn(() => null),
    getLegalMoves: vi.fn(() => []),
    generatePieceMoves: vi.fn(() => []),
    generateFlipMoves: vi.fn(() => []),
    oppositeColor: vi.fn((c) => (c === 'r' ? 'b' : 'r')),
    RANK_LEVEL: { K: 0, A: 1, E: 2, R: 3, N: 4, C: 5, P: 6 },
    BOARD_ROWS,
    BOARD_COLS,
}));

vi.mock('./flip/ai.js', () => ({
    getFlipAIMove: vi.fn(() => null),
    getFlipAIDelay: vi.fn(() => 500),
}));

vi.mock('./classic/state.js', () => ({
    createClassicState: vi.fn(() => ({
        board: Array.from({ length: 13 }, () => Array(5).fill(null)),
        turn: 'r',
        playerColor: 'r',
        moveHistory: [],
        gameOver: false,
        aiThinking: false,
        result: null,
    })),
    createClassicOptions: vi.fn(() => ({
        variant: 'classic', mode: 'pve', level: 'easy', playerColor: 'r', templateIndex: 0,
    })),
}));

vi.mock('./classic/rules.js', () => ({
    applyMove: vi.fn((board, state) => ({ board, state: { ...state, turn: 'b' } })),
    checkWinner: vi.fn(() => null),
    getLegalMoves: vi.fn(() => []),
    generatePieceMoves: vi.fn(() => []),
    CLASSIC_ROWS: 13,
    CLASSIC_COLS: 5,
    isPlayable: vi.fn(() => true),
    isCamp: vi.fn(() => false),
    isHeadquarters: vi.fn(() => false),
    isMountain: vi.fn(() => false),
    isFrontline: vi.fn(() => false),
}));

vi.mock('./classic/ai.js', () => ({
    getClassicAIMove: vi.fn(() => null),
    getClassicAIDelay: vi.fn(() => 500),
}));

vi.mock('./render3d/JunqiRenderer3D.js', () => ({
    JunqiRenderer3D: class {
        constructor() {}
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

const { JunqiApp } = await import('./JunqiApp.js');

describe('JunqiApp', () => {
    let app;

    beforeEach(() => {
        vi.useFakeTimers();
        app = new JunqiApp(mockDoc);
    });

    afterEach(() => {
        if (app && typeof app.dispose === 'function') app.dispose();
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with classic variant and default options', () => {
            expect(app.options.mode).toBe('pve');
            expect(app.options.level).toBe('easy');
            expect(app.variant).toBe('classic');
        });

        it('should create DOM references', () => {
            expect(app.dom.root).toBeDefined();
            expect(app.dom.setup.panel).toBeDefined();
            expect(app.dom.setup.variant).toBeDefined();
            expect(app.dom.setup.template).toBeDefined();
            expect(app.dom.game.hint).toBeDefined();
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
        });
    });

    describe('setup start button', () => {
        it('should start flip variant when selected', () => {
            app.variant = 'flip';
            const clickHandler = app.dom.setup.start.addEventListener.mock.calls.find(
                (c) => c[0] === 'click'
            );
            if (clickHandler) {
                const handler = app.dom.setup.start.addEventListener.mock.calls
                    .filter((c) => c[0] === 'click')
                    .at(-1)[1];
                handler();
            }
            expect(app.state.turn).toBeNull();
        });
    });

    describe('isHumanTurn', () => {
        it('should return true when flip turn is null (first flip)', () => {
            app.variant = 'flip';
            app.startGame();
            expect(app.isHumanTurn()).toBe(true);
        });

        it('should return true for PvP mode', () => {
            app.startGame();
            app.options.mode = 'pvp';
            app.state.turn = 'r';
            expect(app.isHumanTurn()).toBe(true);
        });
    });

    describe('handleCellClick', () => {
        it('should reject clicks when game is over', () => {
            app.startGame();
            app.state.gameOver = true;
            app.handleCellClick(2, 3);
            expect(app.selected).toBeNull();
        });

        it('should reject clicks during AI thinking', () => {
            app.startGame();
            app.state.aiThinking = true;
            app.handleCellClick(2, 3);
        });
    });

    describe('formatResult', () => {
        it('should format resign result', () => {
            app.state = { result: { winner: 'r', reason: 'resign' } };
            const res = app.formatResult();
            expect(res.badge).toBe('resultResignBadge');
        });

        it('should format annihilation result', () => {
            app.state = { result: { winner: 'r', reason: 'annihilation' } };
            const res = app.formatResult();
            expect(res.badge).toBe('junqiAnnihilationBadge');
        });

        it('should format stalemate result', () => {
            app.state = { result: { winner: 'r', reason: 'stalemate' } };
            const res = app.formatResult();
            expect(res.badge).toBe('junqiStalemateBadge');
        });

        it('should return empty for null result', () => {
            const res = app.formatResult();
            expect(res.badge).toBe('');
        });
    });

    describe('refreshSetupVisibility', () => {
        it('should show level row for PvE mode', () => {
            app.options.mode = 'pve';
            app.refreshSetupVisibility();
            expect(app.dom.setup.levelRow.classList.toggle).toHaveBeenCalledWith('hidden', false);
        });

        it('should hide level row for PvP mode', () => {
            app.options.mode = 'pvp';
            app.refreshSetupVisibility();
            expect(app.dom.setup.levelRow.classList.toggle).toHaveBeenCalledWith('hidden', true);
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
