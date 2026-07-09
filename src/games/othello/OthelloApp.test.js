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
            root: el('othello-root'),
            setup: {
                panel: el('othello-setup'),
                mode: el('othello-mode-options'),
                level: el('othello-level-options'),
                levelRow: el('othello-level-row'),
                size: null,
                sizeRow: null,
                startBtn: el('othello-start-btn'),
                backBtn: el('othello-back-btn'),
            },
            game: {
                board: el('othello-board'),
                board3d: el('othello-board-3d'),
                status: el('othello-status'),
                meta: el('othello-meta'),
                controls: el('othello-controls'),
                moveList: el('othello-move-list'),
                undoBtn: el('othello-undo-btn'),
                hintBtn: el('othello-hint-btn'),
                resignBtn: el('othello-resign-btn'),
                coachPanel: el('othello-coach-panel'),
                coachBtn: el('othello-coach-btn'),
                coachContent: el('othello-coach-content'),
                message: el('othello-message'),
            },
            result: {
                overlay: el('othello-result-overlay'),
                summary: el('othello-result-summary'),
                nBtn: el('othello-postgame-btn'),
                nPanel: el('othello-postgame-panel'),
                nContent: el('othello-postgame-content'),
                newBtn: el('othello-new-game-btn'),
                backBtn: el('othello-result-back-btn'),
            },
            message: el('othello-message'),
            langSwitch: el('othello-lang-switch'),
        };
    },
}));

const { mockDom } = vi.hoisted(() => ({
    mockDom: makeMockElements('othello'),
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

vi.mock('./ai.js', () => ({
    getOthelloAIDelay: vi.fn((level) => {
        switch (level) {
            case 'easy': return 300;
            case 'hard': return 800;
            default: return 500;
        }
    }),
    getOthelloAIMove: vi.fn(() => ({ row: 2, col: 3 })),
}));

const BOARD_SIZE = 8;

const createEmptyBoard = () =>
    Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));

const initialBoard = () => {
    const b = createEmptyBoard();
    b[3][3] = 'white';
    b[3][4] = 'black';
    b[4][3] = 'black';
    b[4][4] = 'white';
    return b;
};

vi.mock('./state.js', () => ({
    createOthelloState: vi.fn(() => ({
        board: initialBoard(),
        currentPlayer: 'black',
        moveHistory: [],
        passCount: 0,
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
    createOthelloOptions: vi.fn(() => ({
        mode: 'pvp', level: 'medium', playerColor: 'black',
    })),
}));

vi.mock('./rules.js', () => ({
    createInitialBoard: vi.fn(() => initialBoard()),
    getLegalMoves: vi.fn(() => [
        { row: 2, col: 3 }, { row: 3, col: 2 },
        { row: 4, col: 5 }, { row: 5, col: 4 },
    ]),
    makeMove: vi.fn((board, row, col, color) => {
        const b = board.map(r => [...r]);
        b[row][col] = color;
        // Flip two stones between (row,col) and (3,3) for a valid move
        const dr = row === 3 ? 0 : row - 3 > 0 ? -1 : 1;
        const dc = col === 3 ? 0 : col - 3 > 0 ? -1 : 1;
        b[row + dr][col + dc] = color;
        return { success: true, flipped: [{ row: row + dr, col: col + dc }] };
    }),
    isGameOver: vi.fn(() => false),
    getWinner: vi.fn(() => null),
    countDiscs: vi.fn(() => ({ black: 2, white: 2 })),
    BOARD_SIZE,
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

const { OthelloApp } = await import('./OthelloApp.js');

describe('OthelloApp', () => {
    let app;

    beforeEach(() => {
        vi.useFakeTimers();
        app = new OthelloApp(mockDoc);
    });

    afterEach(() => {
        if (app && typeof app.dispose === 'function') app.dispose();
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with default options', () => {
            expect(app.options.mode).toBe('pvp');
            expect(app.options.level).toBe('medium');
            expect(app.options.playerColor).toBe('black');
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
        });
    });

    describe('startGame', () => {
        it('should switch panels and create state', () => {
            app.startGame();
            expect(app.dom.setup.panel.classList.add).toHaveBeenCalledWith('hidden');
            expect(app.dom.game.board.classList.remove).toHaveBeenCalledWith('hidden');
            expect(app.state.currentPlayer).toBe('black');
            expect(app.state.gameOver).toBe(false);
            expect(app.state.moveHistory).toEqual([]);
            expect(app.state.passCount).toBe(0);
        });

        it('should render the board', () => {
            app.startGame();
            expect(app.dom.game.board.replaceChildren).toHaveBeenCalled();
            expect(app.dom.game.board.style.setProperty).toHaveBeenCalledWith('--board-size', '8');
        });
    });

    describe('enterSetup', () => {
        it('should show setup panel and hide game board', () => {
            app.enterSetup();
            expect(app.dom.setup.panel.classList.remove).toHaveBeenCalledWith('hidden');
            expect(app.dom.game.board.classList.add).toHaveBeenCalledWith('hidden');
        });

        it('should create a fresh state via enterSetup', async () => {
            const { createOthelloState } = await import('./state.js');
            app.enterSetup();
            expect(createOthelloState).toHaveBeenCalled();
        });
    });

    describe('validateMove', () => {
        it('should accept valid coordinates', () => {
            expect(app.validateMove(2, 3, 'black')).toBe('');
        });

        it('should reject out-of-bounds coordinates', () => {
            expect(app.validateMove(-1, 0, 'black')).toBe('Invalid position');
            expect(app.validateMove(0, 8, 'black')).toBe('Invalid position');
            expect(app.validateMove(8, 0, 'black')).toBe('Invalid position');
        });

        it('should reject occupied cells', () => {
            app.startGame();
            // (3,3) is occupied by white in initial board
            expect(app.validateMove(3, 3, 'black')).toBe('Cell occupied');
        });
    });

    describe('commitMove', () => {
        it('should execute a valid move', () => {
            app.startGame();
            const result = app.commitMove(2, 3, 'black');
            expect(result).toBe(true);
            expect(app.state.moveHistory.length).toBe(1);
            expect(app.state.moveHistory[0].color).toBe('black');
            expect(app.state.passCount).toBe(0);
        });

        it('should return false for failed move', async () => {
            const { makeMove } = await import('./rules.js');
            makeMove.mockReturnValueOnce({ success: false });
            app.startGame();
            const result = app.commitMove(0, 0, 'black');
            expect(result).toBe(false);
        });

        it('should detect game over', async () => {
            const { isGameOver, getWinner } = await import('./rules.js');
            isGameOver.mockReturnValueOnce(true);
            getWinner.mockReturnValueOnce('black');
            app.startGame();
            app.commitMove(2, 3, 'black');
            expect(app.state.gameOver).toBe(true);
            expect(app.state.resultType).toBe('win');
            expect(app.state.resultWinnerColor).toBe('black');
        });

        it('should handle draw on game over', async () => {
            const { isGameOver, getWinner } = await import('./rules.js');
            isGameOver.mockReturnValueOnce(true);
            getWinner.mockReturnValueOnce('draw');
            app.startGame();
            app.commitMove(2, 3, 'black');
            expect(app.state.gameOver).toBe(true);
            expect(app.state.resultType).toBe('draw');
            expect(app.state.resultWinnerColor).toBeNull();
        });

        it('should switch player after move', () => {
            app.startGame();
            app.commitMove(2, 3, 'black');
            expect(app.state.currentPlayer).toBe('white');
        });

        it('should handle opponent pass', async () => {
            const { getLegalMoves } = await import('./rules.js');
            app.startGame();
            getLegalMoves.mockReturnValueOnce([]);
            app.commitMove(2, 3, 'black');
            expect(app.state.currentPlayer).toBe('black');
            expect(app.state.passCount).toBe(1);
        });

        it('should detect double pass ending the game', async () => {
            const { getLegalMoves, getWinner } = await import('./rules.js');
            app.startGame();
            getLegalMoves.mockReturnValue([]);
            getWinner.mockReturnValueOnce('black');
            app.commitMove(2, 3, 'black');
            expect(app.state.passCount).toBe(1);
            app.state.currentPlayer = 'black';
            // Make opponent pass by returning empty legal + same current player
            getLegalMoves.mockReturnValue([]);
            app.commitMove(5, 4, 'black');
            expect(app.state.passCount).toBe(2);
            expect(app.state.gameOver).toBe(true);
        });

        it('should re-schedule AI after pass in PvE when AI must continue', async () => {
            const { getLegalMoves } = await import('./rules.js');
            app.options.mode = 'pve';
            app.options.playerColor = 'black';
            app.startGame();
            // Human (black) makes a move; mock AI (white) has no legal moves
            getLegalMoves.mockReturnValueOnce([]);
            app.state.currentPlayer = 'black';
            app.commitMove(2, 3, 'black');
            // currentPlayer should stay 'black' (human) — correct pass handling
            expect(app.state.passCount).toBe(1);
            expect(app.state.currentPlayer).toBe('black');
            // Now simulate: human (black) makes another move; AI (white) now has moves
            getLegalMoves.mockReturnValueOnce([{ row: 2, col: 2 }]);
            getLegalMoves.mockReturnValueOnce([]);
            app.state.currentPlayer = 'black';
            // After human move, AI has legal moves so it should switch to AI
            app.commitMove(5, 4, 'black');
            expect(app.state.currentPlayer).toBe('white');
        });

        it('should re-schedule AI after pass in PvE when opponent passed during AI turn', async () => {
            const { getLegalMoves } = await import('./rules.js');
            app.options.mode = 'pve';
            app.options.playerColor = 'black';
            app.startGame();
            // Simulate AI move (white) where human (black) has no legal moves
            getLegalMoves.mockReturnValueOnce([]);
            app.state.currentPlayer = 'white';
            app.commitMove(2, 3, 'white');
            // AI should still be currentPlayer — pass triggers re-schedule
            expect(app.state.currentPlayer).toBe('white');
            expect(app.state.passCount).toBe(1);
        });
    });

    describe('setAIThinking', () => {
        it('should set state flag', () => {
            app.state = { aiThinking: false };
            app.setAIThinking(true);
            expect(app.state.aiThinking).toBe(true);
        });
    });

    describe('AI integration', () => {
        it('isHumanTurn should return true in pvp mode', () => {
            app.state = { currentPlayer: 'black' };
            expect(app.isHumanTurn()).toBe(true);
        });

        it('isHumanTurn should return true when AI is not player color in pve', () => {
            app.options.mode = 'pve';
            app.options.playerColor = 'black';
            app.state = { currentPlayer: 'black' };
            expect(app.isHumanTurn()).toBe(true);
        });

        it('isHumanTurn should return false when it is AI turn in pve', () => {
            app.options.mode = 'pve';
            app.options.playerColor = 'black';
            app.state = { currentPlayer: 'white' };
            expect(app.isHumanTurn()).toBe(false);
        });

        it('getAIDelay should return delay based on level', () => {
            app.options.level = 'easy';
            expect(app.getAIDelay()).toBe(300);
            app.options.level = 'hard';
            expect(app.getAIDelay()).toBe(800);
        });

        it('handleCellClick should reject when AI is thinking', () => {
            app.startGame();
            app.state.aiThinking = true;
            app.handleCellClick(2, 3);
            expect(app.state.moveHistory.length).toBe(0);
        });

        it('handleCellClick should reject occupied cell', () => {
            app.startGame();
            app.handleCellClick(3, 3);
            expect(app.state.moveHistory.length).toBe(0);
        });

        it('handleCellClick should execute valid move', () => {
            app.startGame();
            app.handleCellClick(2, 3);
            expect(app.state.moveHistory.length).toBe(1);
        });
    });

    describe('undo and resign', () => {
        it('handleUndo should remove last move in pvp', async () => {
            const { makeMove } = await import('./rules.js');
            app.startGame();
            app.commitMove(2, 3, 'black');
            expect(app.state.moveHistory.length).toBe(1);
            makeMove.mockClear();
            app.handleUndo();
            expect(app.state.moveHistory.length).toBe(0);
        });

        it('handleResign should set game over with opponent as winner', () => {
            app.startGame();
            app.state.currentPlayer = 'black';
            app.handleResign();
            expect(app.state.gameOver).toBe(true);
            expect(app.state.resultWinnerColor).toBe('white');
        });
    });

    describe('handleHint', () => {
        it('should set hintMove from AI suggestion', async () => {
            const { getOthelloAIMove } = await import('./ai.js');
            getOthelloAIMove.mockReturnValueOnce({ row: 2, col: 3 });
            app.startGame();
            app.handleHint();
            expect(app.state.hintMove).toEqual({ row: 2, col: 3 });
        });

        it('should call render after setting hint', async () => {
            const { getOthelloAIMove } = await import('./ai.js');
            getOthelloAIMove.mockReturnValueOnce({ row: 3, col: 2 });
            app.startGame();
            app.handleHint();
            expect(app.dom.game.board.replaceChildren).toHaveBeenCalled();
        });

        it('should not hint when AI is thinking', async () => {
            const { getOthelloAIMove } = await import('./ai.js');
            app.startGame();
            app.state.aiThinking = true;
            const callsBefore = getOthelloAIMove.mock.calls.length;
            app.handleHint();
            expect(getOthelloAIMove.mock.calls.length).toBe(callsBefore);
            expect(app.state.hintMove).toBeNull();
        });

        it('should not hint when game is over', async () => {
            const { getOthelloAIMove } = await import('./ai.js');
            app.startGame();
            app.state.gameOver = true;
            const callsBefore = getOthelloAIMove.mock.calls.length;
            app.handleHint();
            expect(getOthelloAIMove.mock.calls.length).toBe(callsBefore);
        });

        it('should not hint when not human turn', async () => {
            const { getOthelloAIMove } = await import('./ai.js');
            app.options.mode = 'pve';
            app.options.playerColor = 'black';
            app.startGame();
            app.state.currentPlayer = 'white';
            const callsBefore = getOthelloAIMove.mock.calls.length;
            app.handleHint();
            expect(getOthelloAIMove.mock.calls.length).toBe(callsBefore);
        });

        it('should clear hintMove when a move is committed', async () => {
            const { getOthelloAIMove } = await import('./ai.js');
            getOthelloAIMove.mockReturnValueOnce({ row: 2, col: 3 });
            app.startGame();
            app.handleHint();
            expect(app.state.hintMove).not.toBeNull();
            app.commitMove(2, 3, 'black');
            expect(app.state.hintMove).toBeNull();
        });

        it('should show message when no hint available', async () => {
            const { getOthelloAIMove } = await import('./ai.js');
            getOthelloAIMove.mockReturnValueOnce(null);
            app.startGame();
            app.handleHint();
            expect(app.dom.message.textContent).toContain('noHintAvailable');
        });
    });

    describe('renderStatus', () => {
        it('should show current player and AI thinking state', () => {
            app.startGame();
            app.state.currentPlayer = 'black';
            app.state.aiThinking = false;
            app.renderStatus();
            expect(app.dom.game.status.textContent).toContain('Black');
        });

        it('should show AI thinking label', () => {
            app.startGame();
            app.state.aiThinking = true;
            app.renderStatus();
            expect(app.dom.game.status.textContent).toContain('AI thinking');
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
        it('should export boardSize as 8', async () => {
            const mod = await import('./OthelloApp.js');
            expect(mod.boardSize).toBe(8);
        });
    });
});
