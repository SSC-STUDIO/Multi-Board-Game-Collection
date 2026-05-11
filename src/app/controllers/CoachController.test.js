import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../utils/i18n.js', () => ({
    i18n: { t: (key) => key },
    t: (key) => key
}));
vi.mock('../../services/llmCoach.js', () => ({
    getLlmCoachConfigStatus: () => 'disabled',
    isLlmCoachConfigured: () => false,
    requestLlmCoachAdvice: vi.fn()
}));
vi.mock('../../services/boardImageAnalyzer.js', () => ({
    analyzeBoardImage: vi.fn()
}));
vi.mock('../../games/gomoku/ai.js', () => ({
    getMoveGuidance: () => null
}));

let confirmResult = true;
vi.mock('../../ui/confirmDialog.js', () => ({
    showConfirm: vi.fn(async () => confirmResult)
}));

import { CoachController } from './CoachController.js';

function createBoard(size) {
    return Array.from({ length: size }, () => Array(size).fill(null));
}

function createApp(overrides = {}) {
    const size = overrides.size ?? 15;
    return {
        options: { size, rule: 'classic', mode: 'qi', playerColor: 'black' },
        state: {
            board: createBoard(size),
            moveHistory: [],
            currentPlayer: 'black',
            gameOver: false,
            lastMove: null,
            hintMove: null,
            selectedCell: null,
            awaitingPlacementConfirm: false,
            coachSuggestion: null,
            coachAlternatives: [],
            coachFocus: null,
            coachLlmStatus: 'disabled',
            coachAnalyzedBoard: null,
            coachInsight: '',
            coachRisk: '',
            coachPlan: '',
            coachConfidence: null,
            coachSource: 'local',
            coachFeedback: '',
            winningCells: [],
            resultSummary: null,
            resultType: null,
            resultWinnerColor: null
        },
        llmSettings: { enabled: false },
        llmCoachRequestId: 0,
        llmCoachAbortController: null,
        sound: { play: vi.fn() },
        render: vi.fn(),
        showMessageKey: vi.fn(),
        startGame: vi.fn(function(opts = {}) {
            this.options = { ...this.options, ...opts };
            this.state.board = createBoard(opts.size ?? this.options.size);
            this.state.moveHistory = [];
        }),
        cancelLlmCoachRequest: vi.fn(),
        isGuidedMode: () => true,
        canHumanMove: () => true,
        getForbiddenReason: () => null,
        ...overrides
    };
}

beforeEach(() => {
    confirmResult = true;
    globalThis.window = { confirm: () => true };
});

describe('CoachController.orderImportedStones', () => {
    const controller = new CoachController(createApp());

    it('alternates when blacks equals whites', () => {
        const stones = [
            { row: 0, col: 0, color: 'black' },
            { row: 1, col: 1, color: 'black' },
            { row: 2, col: 2, color: 'white' },
            { row: 3, col: 3, color: 'white' }
        ];
        const ordered = controller.orderImportedStones(stones);
        expect(ordered.map(s => s.color)).toEqual(['black', 'white', 'black', 'white']);
    });

    it('alternates when blacks is one more than whites', () => {
        const stones = [
            { row: 0, col: 0, color: 'black' },
            { row: 1, col: 1, color: 'black' },
            { row: 2, col: 2, color: 'black' },
            { row: 3, col: 3, color: 'white' },
            { row: 4, col: 4, color: 'white' }
        ];
        const ordered = controller.orderImportedStones(stones);
        expect(ordered.map(s => s.color)).toEqual(['black', 'white', 'black', 'white', 'black']);
    });

    it('preserves original order when difference is >= 2', () => {
        const stones = [
            { row: 0, col: 0, color: 'black' },
            { row: 1, col: 1, color: 'black' },
            { row: 2, col: 2, color: 'black' }
        ];
        const ordered = controller.orderImportedStones(stones);
        expect(ordered).toEqual(stones);
    });
});

describe('CoachController.importAnalyzedBoard', () => {
    it('does nothing when analyzed board is empty', async () => {
        const app = createApp();
        app.state.coachAnalyzedBoard = null;
        const controller = new CoachController(app);
        await controller.importAnalyzedBoard();
        expect(app.state.moveHistory).toHaveLength(0);
        expect(app.render).not.toHaveBeenCalled();
    });

    it('aborts when user declines confirmation', async () => {
        confirmResult = false;
        const app = createApp();
        app.state.coachAnalyzedBoard = {
            boardSize: 15,
            stones: [{ row: 7, col: 7, color: 'black' }],
            currentPlayer: 'white'
        };
        const controller = new CoachController(app);
        await controller.importAnalyzedBoard();
        expect(app.state.moveHistory).toHaveLength(0);
    });

    it('imports stones and alternates colors', async () => {
        const app = createApp();
        app.state.coachAnalyzedBoard = {
            boardSize: 15,
            stones: [
                { row: 7, col: 7, color: 'black' },
                { row: 8, col: 7, color: 'white' },
                { row: 7, col: 8, color: 'black' },
                { row: 8, col: 8, color: 'white' }
            ],
            currentPlayer: 'black'
        };
        const controller = new CoachController(app);
        await controller.importAnalyzedBoard();

        expect(app.state.moveHistory).toHaveLength(4);
        expect(app.state.moveHistory.map(m => m.color)).toEqual(['black', 'white', 'black', 'white']);
        expect(app.state.board[7][7]).toBe('black');
        expect(app.state.board[8][8]).toBe('white');
        expect(app.state.currentPlayer).toBe('black');
        expect(app.state.coachAnalyzedBoard).toBeNull();
    });

    it('detects connect-five after import and sets gameOver', async () => {
        const app = createApp();
        app.state.coachAnalyzedBoard = {
            boardSize: 15,
            stones: [
                { row: 7, col: 3, color: 'black' },
                { row: 0, col: 0, color: 'white' },
                { row: 7, col: 4, color: 'black' },
                { row: 0, col: 1, color: 'white' },
                { row: 7, col: 5, color: 'black' },
                { row: 0, col: 2, color: 'white' },
                { row: 7, col: 6, color: 'black' },
                { row: 0, col: 3, color: 'white' },
                { row: 7, col: 7, color: 'black' }
            ],
            currentPlayer: 'white'
        };
        const controller = new CoachController(app);
        await controller.importAnalyzedBoard();

        expect(app.state.gameOver).toBe(true);
        expect(app.state.resultType).toBe('win');
        expect(app.state.resultWinnerColor).toBe('black');
        expect(app.state.winningCells).toHaveLength(5);
    });

    it('clears interactive state on import', async () => {
        const app = createApp();
        app.state.hintMove = { row: 1, col: 1 };
        app.state.selectedCell = { row: 2, col: 2 };
        app.state.awaitingPlacementConfirm = true;
        app.state.coachFocus = { row: 3, col: 3 };
        app.state.coachAnalyzedBoard = {
            boardSize: 15,
            stones: [{ row: 7, col: 7, color: 'black' }],
            currentPlayer: 'white'
        };
        const controller = new CoachController(app);
        await controller.importAnalyzedBoard();

        expect(app.state.hintMove).toBeNull();
        expect(app.state.selectedCell).toBeNull();
        expect(app.state.awaitingPlacementConfirm).toBe(false);
        expect(app.state.coachFocus).toBeNull();
    });

    it('restarts game when board size differs', async () => {
        const app = createApp({ size: 15 });
        app.state.coachAnalyzedBoard = {
            boardSize: 19,
            stones: [{ row: 9, col: 9, color: 'black' }],
            currentPlayer: 'white'
        };
        const controller = new CoachController(app);
        await controller.importAnalyzedBoard();

        expect(app.startGame).toHaveBeenCalledWith(expect.objectContaining({ size: 19, mode: 'qi' }));
    });

    it('skips invalid stone coordinates', async () => {
        const app = createApp();
        app.state.coachAnalyzedBoard = {
            boardSize: 15,
            stones: [
                { row: 7, col: 7, color: 'black' },
                { row: -1, col: 0, color: 'white' },
                { row: 0, col: 99, color: 'white' },
                { row: 5, col: 5, color: 'red' },
                { row: 6, col: 6, color: 'white' }
            ],
            currentPlayer: 'black'
        };
        const controller = new CoachController(app);
        await controller.importAnalyzedBoard();

        // Only valid stones placed: black(7,7) + white(6,6)
        expect(app.state.moveHistory).toHaveLength(2);
    });
});

describe('CoachController.openPreviewEdit / togglePreviewCell / closePreviewEdit', () => {
    it('opens preview mode and builds cells from analyzed stones', () => {
        const app = createApp();
        app.state.coachAnalyzedBoard = {
            boardSize: 15,
            stones: [
                { row: 7, col: 7, color: 'black' },
                { row: 8, col: 8, color: 'white' }
            ],
            currentPlayer: 'black'
        };
        const controller = new CoachController(app);
        controller.openPreviewEdit();

        expect(app.state.coachPreviewMode).toBe(true);
        expect(app.state.coachPreviewBoard.size).toBe(15);
        expect(app.state.coachPreviewBoard.cells[7][7]).toBe('black');
        expect(app.state.coachPreviewBoard.cells[8][8]).toBe('white');
        expect(app.state.coachPreviewBoard.cells[0][0]).toBeNull();
        expect(app.render).toHaveBeenCalled();
    });

    it('toggles a preview cell through empty → black → white → empty', () => {
        const app = createApp();
        app.state.coachPreviewMode = true;
        app.state.coachPreviewBoard = {
            size: 15,
            cells: Array.from({ length: 15 }, () => Array(15).fill(null))
        };
        const controller = new CoachController(app);

        controller.togglePreviewCell(3, 4);
        expect(app.state.coachPreviewBoard.cells[3][4]).toBe('black');

        controller.togglePreviewCell(3, 4);
        expect(app.state.coachPreviewBoard.cells[3][4]).toBe('white');

        controller.togglePreviewCell(3, 4);
        expect(app.state.coachPreviewBoard.cells[3][4]).toBeNull();
    });

    it('ignores toggle calls when preview mode is off', () => {
        const app = createApp();
        const controller = new CoachController(app);
        controller.togglePreviewCell(0, 0);
        expect(app.state.coachPreviewBoard ?? null).toBeNull();
        expect(app.render).not.toHaveBeenCalled();
    });

    it('closePreviewEdit(false) discards changes without importing', () => {
        const app = createApp();
        app.state.coachAnalyzedBoard = {
            boardSize: 15,
            stones: [{ row: 7, col: 7, color: 'black' }],
            currentPlayer: 'white'
        };
        app.state.coachPreviewMode = true;
        app.state.coachPreviewBoard = {
            size: 15,
            cells: Array.from({ length: 15 }, () => Array(15).fill(null))
        };
        app.state.coachPreviewBoard.cells[0][0] = 'white';

        const controller = new CoachController(app);
        controller.closePreviewEdit(false);

        expect(app.state.coachPreviewMode).toBe(false);
        expect(app.state.coachPreviewBoard).toBeNull();
        // analyzed stones should remain unchanged (not overridden by edits)
        expect(app.state.coachAnalyzedBoard.stones).toEqual([{ row: 7, col: 7, color: 'black' }]);
    });

    it('closePreviewEdit(true) rewrites analyzed stones and triggers import', async () => {
        confirmResult = true;
        const app = createApp();
        app.state.coachAnalyzedBoard = {
            boardSize: 15,
            stones: [{ row: 7, col: 7, color: 'black' }],
            currentPlayer: 'white'
        };
        app.state.coachPreviewMode = true;
        app.state.coachPreviewBoard = {
            size: 15,
            cells: Array.from({ length: 15 }, () => Array(15).fill(null))
        };
        app.state.coachPreviewBoard.cells[1][1] = 'black';
        app.state.coachPreviewBoard.cells[2][2] = 'white';

        const controller = new CoachController(app);
        await controller.closePreviewEdit(true);

        expect(app.state.coachPreviewMode).toBe(false);
        // 导入后 analyzed board 被清理
        expect(app.state.coachAnalyzedBoard).toBeNull();
        expect(app.state.board[1][1]).toBe('black');
        expect(app.state.board[2][2]).toBe('white');
    });
});

describe('CoachController.cancelImageAnalysis', () => {
    it('resets analyzing status and emits cancel message', () => {
        const app = createApp();
        app.state.coachLlmStatus = 'analyzing-image';
        const controller = new CoachController(app);
        controller.cancelImageAnalysis();
        expect(app.cancelLlmCoachRequest).toHaveBeenCalled();
        expect(app.state.coachLlmStatus).toBe('disabled');
        expect(app.showMessageKey).toHaveBeenCalledWith('coachAnalyzeCanceled');
    });

    it('keeps existing status when not analyzing', () => {
        const app = createApp();
        app.state.coachLlmStatus = 'ready';
        const controller = new CoachController(app);
        controller.cancelImageAnalysis();
        expect(app.state.coachLlmStatus).toBe('ready');
    });
});

describe('CoachController.pushLlmRequestLog', () => {
    it('records entry with derived tokens from usage', () => {
        const app = createApp();
        const controller = new CoachController(app);
        globalThis.window.__llmRequestLog = [];
        if (typeof globalThis.performance === 'undefined') {
            globalThis.performance = { now: () => 0 };
        }
        controller.pushLlmRequestLog({
            endpoint: 'analyzeImage',
            durationMs: 1234,
            usage: { prompt_tokens: 100, completion_tokens: 50 },
            status: 'ok'
        });
        expect(globalThis.window.__llmRequestLog).toHaveLength(1);
        const [entry] = globalThis.window.__llmRequestLog;
        expect(entry.endpoint).toBe('analyzeImage');
        expect(entry.durationMs).toBe(1234);
        expect(entry.tokensIn).toBe(100);
        expect(entry.tokensOut).toBe(50);
        expect(entry.status).toBe('ok');
    });

    it('caps the log at 50 entries', () => {
        const app = createApp();
        const controller = new CoachController(app);
        globalThis.window.__llmRequestLog = [];
        for (let i = 0; i < 60; i += 1) {
            controller.pushLlmRequestLog({ endpoint: 'x', durationMs: i, status: 'ok' });
        }
        expect(globalThis.window.__llmRequestLog).toHaveLength(50);
        expect(globalThis.window.__llmRequestLog[0].durationMs).toBe(10);
    });
});
