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
            root: el('shogi-root'),
            setup: {
                panel: el('shogi-setup'),
                mode: el('shogi-mode-options'),
                level: el('shogi-level-options'),
                levelRow: el('shogi-level-row'),
                size: null,
                sizeRow: null,
                startBtn: el('shogi-start-btn'),
                backBtn: el('shogi-back-btn'),
            },
            game: {
                board: el('shogi-board'),
                board3d: el('shogi-board-3d'),
                status: el('shogi-status'),
                meta: el('shogi-meta'),
                controls: el('shogi-controls'),
                moveList: el('shogi-move-list'),
                undoBtn: el('shogi-undo-btn'),
                hintBtn: el('shogi-hint-btn'),
                resignBtn: el('shogi-resign-btn'),
                coachPanel: el('shogi-coach-panel'),
                coachBtn: el('shogi-coach-btn'),
                coachContent: el('shogi-coach-content'),
                message: el('shogi-message'),
            },
            result: {
                overlay: el('shogi-result-overlay'),
                summary: el('shogi-result-summary'),
                nBtn: el('shogi-postgame-btn'),
                nPanel: el('shogi-postgame-panel'),
                nContent: el('shogi-postgame-content'),
                newBtn: el('shogi-new-game-btn'),
                backBtn: el('shogi-result-back-btn'),
            },
            message: el('shogi-message'),
            langSwitch: el('shogi-lang-switch'),
        };
    },
}));

const { mockDom } = vi.hoisted(() => ({
    mockDom: makeMockElements('shogi'),
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

const BOARD_SIZE = 9;

const initialBoard = () => {
    const b = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
    // Sent pieces at bottom (row 8 = sente's first rank)
    b[8] = [
        { type: 'K', side: 'sente' }, { type: 'K', side: 'gote' }, // placeholder — not realistic but sufficient for tests
    ];
    return b;
};

vi.mock('./state.js', () => ({
    createShogiState: vi.fn(() => ({
        board: initialBoard(),
        turn: 'sente',
        hands: { sente: [], gote: [] },
        moveHistory: [],
        result: null,
        gameOver: false,
        aiThinking: false,
        coachSuggestion: null,
        coachAlternatives: [],
        coachSource: 'local',
        coachLlmStatus: 'idle',
        coachInsight: '',
        coachRisk: '',
        coachPlan: '',
        coachConfidence: null,
        coachFeedback: '',
        coachPreviewMode: false,
        hintMove: null,
        selectedCell: null,
        awaitingPlacementConfirm: false,
        lastMove: null,
        winningCells: [],
        resultType: null,
        resultWinnerColor: null,
        resultSummary: null,
        size: BOARD_SIZE,
        commentary: '',
    })),
    createShogiOptions: vi.fn(() => ({
        mode: 'pvp', level: 'medium', playerColor: 'sente',
    })),
}));

vi.mock('./rules.js', () => ({
    createInitialBoard: vi.fn(() => initialBoard()),
    getLegalMoves: vi.fn(() => []),
    makeMove: vi.fn((board, fromRow, fromCol, toRow, toCol) => board),
    makeDrop: vi.fn((board, type, side, toRow, toCol) => board),
    isInCheck: vi.fn(() => false),
    getPieceLabel: vi.fn((type) => {
        const labels = { K: '玉', R: '飛', B: '角', G: '金', S: '銀', N: '桂', L: '香', P: '歩' };
        return labels[type] || type;
    }),
    BOARD_SIZE,
    PIECES: {
        K: { label: '玉将', promoted: false },
        R: { label: '飛車', promoted: '龍王' },
        B: { label: '角行', promoted: '龍馬' },
        G: { label: '金将', promoted: false },
    },
}));

vi.mock('./ai.js', () => ({
    getShogiAIMove: vi.fn(() => null),
    getShogiAIDelay: vi.fn(() => 500),
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

const { ShogiApp } = await import('./ShogiApp.js');

describe('ShogiApp', () => {
    let app;

    beforeEach(() => {
        vi.useFakeTimers();
        app = new ShogiApp(mockDoc);
    });

    afterEach(() => {
        if (app && typeof app.dispose === 'function') app.dispose();
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with default options', () => {
            expect(app.options.mode).toBe('pvp');
            expect(app.options.level).toBe('medium');
            expect(app.options.playerColor).toBe('sente');
        });

        it('should create DOM references via queryDom', () => {
            expect(app.dom.root).toBeDefined();
            expect(app.dom.setup.panel).toBeDefined();
            expect(app.dom.setup.mode).toBeDefined();
            expect(app.dom.setup.level).toBeDefined();
            expect(app.dom.setup.levelRow).toBeDefined();
            expect(app.dom.setup.startBtn).toBeDefined();
            expect(app.dom.setup.backBtn).toBeDefined();
            expect(app.dom.game.board).toBeDefined();
            expect(app.dom.game.board3d).toBeDefined();
            expect(app.dom.game.undoBtn).toBeDefined();
            expect(app.dom.game.hintBtn).toBeDefined();
            expect(app.dom.game.resignBtn).toBeDefined();
            expect(app.dom.game.coachPanel).toBeDefined();
            expect(app.dom.result.overlay).toBeDefined();
            expect(app.dom.result.summary).toBeDefined();
            expect(app.dom.message).toBeDefined();
            expect(app.dom.langSwitch).toBeDefined();
        });

        it('should enter setup on construction', () => {
            expect(app.dom.setup.panel.classList.remove).toHaveBeenCalledWith('hidden');
        });

        it('should not use 3D', () => {
            expect(app.use3D).toBe(false);
            expect(app.renderer3d).toBeNull();
            expect(app.llmSettings).toBeNull();
        });
    });

    describe('startGame', () => {
        it('should switch panels and create state', () => {
            app.startGame();
            expect(app.dom.setup.panel.classList.add).toHaveBeenCalledWith('hidden');
            expect(app.dom.game.board.classList.remove).toHaveBeenCalledWith('hidden');
            expect(app.state.turn).toBe('sente');
            expect(app.state.gameOver).toBe(false);
            expect(app.state.moveHistory).toEqual([]);
            expect(app.state.hands).toEqual({ sente: [], gote: [] });
        });

        it('should render the board', () => {
            app.startGame();
            expect(app.dom.game.board.replaceChildren).toHaveBeenCalled();
            expect(app.dom.game.board.style.setProperty).toHaveBeenCalledWith('--board-size', '9');
        });
    });

    describe('enterSetup', () => {
        it('should show setup panel and hide game board', () => {
            app.enterSetup();
            expect(app.dom.setup.panel.classList.remove).toHaveBeenCalledWith('hidden');
            expect(app.dom.game.board.classList.add).toHaveBeenCalledWith('hidden');
        });

        it('should create a fresh state', async () => {
            const { createShogiState } = await import('./state.js');
            app.enterSetup();
            expect(createShogiState).toHaveBeenCalled();
        });
    });

    describe('validateMove', () => {
        it('should accept valid coordinates', () => {
            expect(app.validateMove(5, 5, 'sente')).toBe('');
            expect(app.validateMove(0, 0, 'sente')).toBe('');
            expect(app.validateMove(8, 8, 'sente')).toBe('');
        });

        it('should reject out-of-bounds coordinates', () => {
            expect(app.validateMove(-1, 0, 'sente')).toBe('Invalid position');
            expect(app.validateMove(0, 9, 'sente')).toBe('Invalid position');
            expect(app.validateMove(9, 0, 'sente')).toBe('Invalid position');
        });

        it('should reject occupation by own piece', () => {
            app.startGame();
            // Row 8 col 0 has a sente piece in initial board
            expect(app.validateMove(8, 0, 'sente')).toBe('Cell occupied by own piece');
        });

        it('should allow capture of opponent piece', () => {
            app.startGame();
            // Row 8 col 1 has a gote piece (mocked), so sente can capture
            expect(app.validateMove(8, 1, 'sente')).toBe('');
        });
    });

    describe('setAIThinking', () => {
        it('should set state flag', () => {
            app.state = { aiThinking: false };
            app.setAIThinking(true);
            expect(app.state.aiThinking).toBe(true);
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

        it('hideRoot should hide root and setup panel', () => {
            app.dom.root.classList.add = vi.fn();
            app.dom.setup.panel.classList.add = vi.fn();
            app.hideRoot();
            expect(app.dom.root.classList.add).toHaveBeenCalledWith('hidden');
            expect(app.dom.setup.panel.classList.add).toHaveBeenCalledWith('hidden');
        });
    });

    describe('boardSize export', () => {
        it('should export boardSize as 9', async () => {
            const mod = await import('./ShogiApp.js');
            expect(mod.boardSize).toBe(9);
        });
    });

    describe('render', () => {
        it('should render piece labels for occupied cells', async () => {
            app.startGame();
            // board[8][0] is occupied, board[8][1] is occupied
            const { getPieceLabel } = await import('./rules.js');
            expect(getPieceLabel).toHaveBeenCalled();
        });
    });
});
