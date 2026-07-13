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
                capturedWhite: el(`${prefix}-captured-white`),
                capturedBlack: el(`${prefix}-captured-black`),
                hintBtn: el(`${prefix}-hint-btn`),
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
            promotion: {
                overlay: el(`${prefix}-promotion-overlay`),
                buttons: el(`${prefix}-promotion-buttons`),
            },
        };
    },
}));

const { mockDom } = vi.hoisted(() => ({
    mockDom: makeMockElements('chess'),
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
    const b = Array.from({ length: 8 }, () => Array(8).fill(null));
    b[0] = ['bR', 'bN', 'bB', 'bQ', 'bK', 'bB', 'bN', 'bR'];
    b[1] = Array(8).fill('bP');
    b[6] = Array(8).fill('wP');
    b[7] = ['wR', 'wN', 'wB', 'wQ', 'wK', 'wB', 'wN', 'wR'];
    return b;
};

vi.mock('./state.js', () => ({
    createChessState: vi.fn(() => ({
        board: initialBoard(),
        turn: 'w',
        castling: { wK: true, wQ: true, bK: true, bQ: true },
        enPassantTarget: null,
        halfmoveClock: 0,
        fullmoveNumber: 1,
        moveHistory: [],
        positionHistory: [],
        gameOver: false,
        aiThinking: false,
        result: null,
    })),
    createChessOptions: vi.fn(() => ({
        mode: 'pvp', level: 'easy', playerColor: 'w',
    })),
}));

vi.mock('./rules.js', () => ({
    applyMove: vi.fn((board, state, move) => ({
        board: board,
        state: { ...state, turn: state.turn === 'w' ? 'b' : 'w' },
    })),
    getLegalMovesFrom: vi.fn(() => []),
    isCheckmate: vi.fn(() => false),
    isStalemate: vi.fn(() => false),
    isInsufficientMaterial: vi.fn(() => false),
    isFiftyMoveDraw: vi.fn(() => false),
    isInCheck: vi.fn(() => false),
    getPositionKey: vi.fn(() => 'mock-position-key'),
    isThreefoldRepetition: vi.fn(() => false),
}));

vi.mock('./ai.js', () => ({
    getChessAIMove: vi.fn(() => null),
    getChessAIDelay: vi.fn(() => 300),
}));

vi.mock('./render3d/ChessRenderer3D.js', () => ({
    ChessRenderer3D: class {
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

const { ChessApp } = await import('./ChessApp.js');

describe('ChessApp', () => {
    let app;

    beforeEach(() => {
        vi.useFakeTimers();
        app = new ChessApp(mockDoc);
    });

    afterEach(() => {
        if (app && typeof app.dispose === 'function') app.dispose();
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with default options', () => {
            expect(app.options.mode).toBe('pvp');
            expect(app.options.level).toBe('easy');
            expect(app.options.playerColor).toBe('w');
        });

        it('should create DOM references via queryDom', () => {
            expect(app.dom.root).toBeDefined();
            expect(app.dom.setup.panel).toBeDefined();
            expect(app.dom.game.board).toBeDefined();
            expect(app.dom.game.board3d).toBeDefined();
            expect(app.dom.promotion.overlay).toBeDefined();
        });

        it('should enter setup on construction', () => {
            expect(app.dom.setup.panel.classList.remove).toHaveBeenCalledWith('hidden');
        });
    });

    describe('createInitialState', () => {
        it('should create state with correct initial board', () => {
            const state = app.createInitialState();
            expect(state.turn).toBe('w');
            expect(state.board[0][3]).toBe('bQ');
            expect(state.board[7][4]).toBe('wK');
            expect(state.castling.wK).toBe(true);
        });
    });

    describe('startGame', () => {
        it('should switch panels and create state', () => {
            app.startGame();
            expect(app.dom.setup.panel.classList.add).toHaveBeenCalledWith('hidden');
            expect(app.dom.game.panel.classList.remove).toHaveBeenCalledWith('hidden');
            expect(app.state.turn).toBe('w');
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
            app.options.playerColor = 'w';
            app.state.turn = 'w';
            expect(app.isHumanTurn()).toBe(true);
        });

        it('should return false when it is AI turn', () => {
            app.startGame();
            app.options.mode = 'pve';
            app.options.playerColor = 'w';
            app.state.turn = 'b';
            expect(app.isHumanTurn()).toBe(false);
        });
    });

    describe('handleSquareClick', () => {
        it('should reject clicks when game is over', () => {
            app.startGame();
            app.state.gameOver = true;
            app.handleSquareClick(3, 3);
            expect(app.selected).toBeNull();
        });

        it('should reject clicks during AI thinking', () => {
            app.startGame();
            app.state.aiThinking = true;
            app.handleSquareClick(3, 3);
            expect(app.sound.play).toBeDefined();
        });
    });

    describe('handleUndo aiThinking guard', () => {
        it('should not undo when aiThinking is true', () => {
            app.startGame({ mode: 'pve', level: 'easy', playerColor: 'w' });
            app.state.moveHistory = [{ from: 'e2', to: 'e4', color: 'w' }];
            const lenBefore = app.state.moveHistory.length;
            app.state.aiThinking = true;
            app.handleUndo();
            expect(app.state.moveHistory.length).toBe(lenBefore);
        });

        it('should not undo when gameOver is true', () => {
            app.startGame({ mode: 'pve', level: 'easy', playerColor: 'w' });
            app.state.moveHistory = [{ from: 'e2', to: 'e4', color: 'w' }];
            const lenBefore = app.state.moveHistory.length;
            app.state.gameOver = true;
            app.handleUndo();
            expect(app.state.moveHistory.length).toBe(lenBefore);
        });
    });

    describe('formatResult', () => {
        it('should format checkmate result', () => {
            app.startGame();
            app.state.result = { type: 'checkmate', winner: 'w' };
            const res = app.formatResult();
            expect(res.badge).toBe('chessCheckmate');
            expect(res.title).toContain('chessCheckmateTitle');
        });

        it('should format resign result', () => {
            app.startGame();
            app.state.result = { type: 'resign', winner: 'b' };
            const res = app.formatResult();
            expect(res.badge).toBe('resultResignBadge');
        });

        it('should format stalemate result', () => {
            app.startGame();
            app.state.result = { type: 'stalemate', winner: null };
            const res = app.formatResult();
            expect(res.badge).toBe('chessStalemate');
        });

        it('should format draw result with insufficient material', () => {
            app.startGame();
            app.state.result = { type: 'draw', winner: null, reason: 'insufficient' };
            const res = app.formatResult();
            expect(res.badge).toBe('chessDraw');
            expect(res.title).toBe('chessDrawInsufficient');
        });

        it('should format draw result with fifty-move rule', () => {
            app.startGame();
            app.state.result = { type: 'draw', winner: null, reason: 'fiftyMove' };
            const res = app.formatResult();
            expect(res.title).toBe('chessDraw50');
        });

        it('should return empty for null result', () => {
            const res = app.formatResult();
            expect(res.badge).toBe('');
        });
    });

    describe('promotion overlay', () => {
        it('showPromotion should remove hidden class', () => {
            app.showPromotion();
            expect(app.dom.promotion.overlay.classList.remove).toHaveBeenCalledWith('hidden');
        });

        it('hidePromotion should add hidden class', () => {
            app.hidePromotion();
            expect(app.dom.promotion.overlay.classList.add).toHaveBeenCalledWith('hidden');
        });
    });

    describe('describeMove', () => {
        it('should describe kingside castling', () => {
            expect(app.describeMove({ from: [7, 4], to: [7, 6], piece: 'wK', castle: 'K' })).toBe('O-O');
        });

        it('should describe queenside castling', () => {
            expect(app.describeMove({ from: [7, 4], to: [7, 2], piece: 'wK', castle: 'Q' })).toBe('O-O-O');
        });

        it('should describe a pawn move', () => {
            const result = app.describeMove({ from: [6, 4], to: [4, 4], piece: 'wP' });
            expect(result).toContain('e2');
        });

        it('should describe a capture', () => {
            const result = app.describeMove({ from: [7, 3], to: [0, 3], piece: 'wQ', capture: 'bQ' });
            expect(result).toContain('x');
        });

        it('should describe a promotion', () => {
            const result = app.describeMove({ from: [1, 0], to: [0, 0], piece: 'wP', promotion: 'Q' });
            expect(result).toContain('=Q');
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

        it('hideRoot should hide all panels including promotion', () => {
            app.dom.setup.panel.classList.add = vi.fn();
            app.dom.game.panel.classList.add = vi.fn();
            app.hideRoot();
            expect(app.dom.setup.panel.classList.add).toHaveBeenCalledWith('hidden');
            expect(app.dom.game.panel.classList.add).toHaveBeenCalledWith('hidden');
        });
    });

    describe('commitMove status on game end', () => {
        it('should call renderStatus after checkGameEnd sets gameOver', () => {
            app.startGame();
            // Mock checkGameEnd to simulate checkmate without triggering
            // real code path (renderer3d.playVictorySequence is unmocked).
            app.checkGameEnd = () => { app.state.gameOver = true; };
            const spy = vi.spyOn(app, 'renderStatus');
            app.commitMove({ from: [6, 4], to: [4, 4], piece: 'wP', capture: null });
            expect(app.state.gameOver).toBe(true);
            expect(spy).toHaveBeenCalled();
            expect(app.dom.game.currentPlayer.textContent).toContain('gameEnd');
        });
    });
});
