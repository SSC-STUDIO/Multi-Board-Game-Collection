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
                color: el('shogi-color-options'),
                colorRow: el('shogi-color-row'),
                size: null,
                sizeRow: null,
                start: el('shogi-start-btn'),
                back: el('shogi-back-btn'),
            },
            game: {
                panel: el('shogi-game'),
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
    getLegalMovesFiltered: vi.fn(() => []),
    makeMove: vi.fn((board, fromRow, fromCol, toRow, toCol) => board),
    makeDrop: vi.fn((board, type, side, toRow, toCol) => board),
    isInCheck: vi.fn(() => false),
    getPieceLabel: vi.fn((type) => {
        const labels = { K: '王', R: '飛', B: '角', G: '金', S: '銀', N: '桂', L: '香', P: '歩',
                          DR: '龍', DB: '馬', PS: '全', PN: '圭', PL: '杏', PP: 'と' };
        return labels[type] || '?';
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
    generateAllMoves: vi.fn(() => [{ kind: 'board', from: [0, 0], to: [1, 1], promote: false }]),
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
            expect(app.dom.setup.start).toBeDefined();
            expect(app.dom.setup.back).toBeDefined();
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
            expect(app.dom.game.panel.classList.remove).toHaveBeenCalledWith('hidden');
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
            expect(app.dom.game.panel.classList.add).toHaveBeenCalledWith('hidden');
        });

        it('should create a fresh state', async () => {
            const { createShogiState } = await import('./state.js');
            app.enterSetup();
            expect(createShogiState).toHaveBeenCalled();
        });
    });

    describe('validateMove', () => {
        it('should accept valid coordinates', () => {
            app.startGame();
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

    describe('hint', () => {
        it('should bind hintBtn click event on startGame', () => {
            app.startGame();
            expect(app.dom.game.hintBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
        });

        it('should show no hint message when AI returns null', () => {
            app.startGame();
            app.handleHint();
            expect(app.dom.game.message.textContent).toContain('noHintAvailable');
        });

        it('should show hint suggestion when AI returns a move', async () => {
            // Override the mock to return a board move
            const { getShogiAIMove } = await import('./ai.js');
            getShogiAIMove.mockReturnValueOnce({
                kind: 'board', from: [7, 4], to: [6, 4], promote: false
            });
            app.startGame();
            app.handleHint();
            expect(app.state.hintMove).toEqual({ row: 6, col: 4 });
            expect(app.dom.game.board.style.setProperty).toHaveBeenCalled();
        });

        it('should clear hintMove when user clicks a cell', () => {
            app.startGame();
            app.state.hintMove = { row: 6, col: 4 };
            app.handleCellClick(7, 4);
            expect(app.state.hintMove).toBeNull();
        });

        it('should clear hintMove when move is committed', () => {
            app.startGame();
            app.state.hintMove = { row: 6, col: 4 };
            app.commitMove({ kind: 'board', from: [7, 4], to: [6, 4], promote: false });
            expect(app.state.hintMove).toBeNull();
        });

        it('should not show hint during AI thinking', () => {
            app.startGame();
            app.state.aiThinking = true;
            app.handleHint();
            expect(app.state.hintMove).toBeNull();
        });

        it('should not show hint when game is over', () => {
            app.startGame();
            app.state.gameOver = true;
            app.handleHint();
            expect(app.state.hintMove).toBeNull();
        });

        it('should clear hintMove on undo', () => {
            app.startGame();
            app.state.hintMove = { row: 6, col: 4 };
            app.state.moveHistory.push({ kind: 'board', from: [7, 4], to: [6, 4], promote: false });
            app.handleUndo();
            expect(app.state.hintMove).toBeNull();
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

    describe('resign and formatResult', () => {
        it('onResign should set result with badge/title/detail keys', () => {
            app.startGame();
            app.state.turn = 'sente';
            app.onResign();
            expect(app.state.result.type).toBe('resign');
            expect(app.state.result.winner).toBe('gote');
            expect(app.state.result.badge).toBe('shogiResignBadge');
            expect(app.state.result.title).toBe('shogiResignTitle');
            expect(app.state.result.detail).toBe('shogiResignDetail');
        });

        it('formatResult should localize resign result with winner label', () => {
            app.startGame();
            app.state.result = {
                type: 'resign',
                winner: 'gote',
                badge: 'shogiResignBadge',
                title: 'shogiResignTitle',
                detail: 'shogiResignDetail'
            };
            const formatted = app.formatResult();
            // i18n mock returns key as-is; {player} replaced with winner label
            expect(formatted.badge).toBe('shogiResignBadge');
            expect(formatted.title).toBe('shogiResignTitle');
            expect(formatted.detail).toBe('shogiResignDetail');
        });

        it('resign() should call onResign and show result overlay', () => {
            app.startGame();
            app.state.turn = 'sente';
            app.resign();
            expect(app.state.gameOver).toBe(true);
            expect(app.state.result.type).toBe('resign');
            expect(app.state.result.winner).toBe('gote');
            expect(app.dom.result.overlay.classList.remove).toHaveBeenCalledWith('hidden');
        });

        it('formatResult should return empty strings when no result', () => {
            app.startGame();
            app.state.result = null;
            const formatted = app.formatResult();
            expect(formatted.badge).toBe('');
            expect(formatted.title).toBe('');
            expect(formatted.detail).toBe('');
        });

        it('should call renderMoveList even when commitMove ends the game', () => {
            app.startGame();
            const spy = vi.spyOn(app, 'renderMoveList');
            // Force checkGameEnd to detect game over
            app.checkGameEnd = () => { app.state.gameOver = true; };
            app.commitMove({ kind: 'board', from: [7, 4], to: [6, 4], promote: false });
            expect(spy).toHaveBeenCalled();
            expect(app.state.moveHistory.length).toBe(1);
        });
    });
});
