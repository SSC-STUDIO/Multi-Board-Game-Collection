import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/llmCoach.js', () => {
    class LlmCoachError extends Error {
        constructor(message, code = 'llm_error') {
            super(message);
            this.name = 'LlmCoachError';
            this.code = code;
        }
    }
    return {
        LlmCoachError,
        getLlmCoachConfigStatus: vi.fn(() => 'disabled'),
        isLlmCoachConfigured: vi.fn(() => false),
        requestLlmCoachAdvice: vi.fn()
    };
});
vi.mock('../../services/boardImageAnalyzer.js', () => ({
    analyzeBoardImage: vi.fn()
}));
vi.mock('../../games/gomoku/ai.js', () => ({
    getMoveGuidance: vi.fn(() => null)
}));

let confirmResult = true;
vi.mock('../../ui/confirmDialog.js', () => ({
    showConfirm: vi.fn(async () => confirmResult)
}));

import { CoachController } from './CoachController.js';

// Import mocked module symbols so we can control them per-test
import {
    isLlmCoachConfigured,
    requestLlmCoachAdvice
} from '../../services/llmCoach.js';
import { getMoveGuidance } from '../../games/gomoku/ai.js';

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
    vi.mocked(isLlmCoachConfigured).mockReset();
    vi.mocked(isLlmCoachConfigured).mockReturnValue(false);
    vi.mocked(requestLlmCoachAdvice).mockReset();
    vi.mocked(getMoveGuidance).mockReset();
    vi.mocked(getMoveGuidance).mockReturnValue(null);
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

describe('CoachController.clearCoachState', () => {
    it('resets all coach state fields to defaults', () => {
        const app = createApp();
        app.state.coachSuggestion = { row: 7, col: 7 };
        app.state.coachAlternatives = [{ row: 0, col: 0 }];
        app.state.coachSource = 'llm';
        app.state.coachLlmStatus = 'ready';
        app.state.coachInsight = 'test';
        app.state.coachRisk = 'test';
        app.state.coachPlan = 'test';
        app.state.coachConfidence = 0.8;
        app.state.coachFocus = { row: 1, col: 1 };
        app.state.coachPreviewMode = true;
        app.state.coachPreviewBoard = { size: 15, cells: [] };
        app.state.coachFeedback = 'feedback';
        const controller = new CoachController(app);
        controller.clearCoachState();
        expect(app.state.coachSuggestion).toBeNull();
        expect(app.state.coachAlternatives).toEqual([]);
        expect(app.state.coachSource).toBe('local');
        expect(app.state.coachInsight).toBe('');
        expect(app.state.coachRisk).toBe('');
        expect(app.state.coachPlan).toBe('');
        expect(app.state.coachConfidence).toBeNull();
        expect(app.state.coachFocus).toBeNull();
        expect(app.state.coachPreviewMode).toBe(false);
        expect(app.state.coachPreviewBoard).toBeNull();
        expect(app.state.coachFeedback).toBe('');
        expect(app.cancelLlmCoachRequest).toHaveBeenCalled();
    });

    it('preserves coachFeedback when preserveFeedback is true', () => {
        const app = createApp();
        app.state.coachFeedback = 'keep me';
        const controller = new CoachController(app);
        controller.clearCoachState({ preserveFeedback: true });
        expect(app.state.coachFeedback).toBe('keep me');
    });
});

describe('CoachController.refreshCoachGuidance', () => {
    it('clears state when not in guided mode', () => {
        const app = createApp({ isGuidedMode: () => false });
        app.state.coachSuggestion = { row: 7, col: 7 };
        const controller = new CoachController(app);
        controller.refreshCoachGuidance();
        expect(app.state.coachSuggestion).toBeNull();
        expect(app.render).toHaveBeenCalled();
    });

    it('clears state when game is over', () => {
        const app = createApp();
        app.state.gameOver = true;
        app.state.coachSuggestion = { row: 7, col: 7 };
        const controller = new CoachController(app);
        controller.refreshCoachGuidance();
        expect(app.state.coachSuggestion).toBeNull();
    });

    it('clears state when AI is thinking', () => {
        const app = createApp();
        app.state.aiThinking = true;
        const controller = new CoachController(app);
        controller.refreshCoachGuidance();
        expect(app.state.coachSuggestion).toBeNull();
    });

    it('clears state when not human turn', () => {
        const app = createApp();
        app.state.currentPlayer = 'white';
        app.options.playerColor = 'black';
        const controller = new CoachController(app);
        controller.refreshCoachGuidance();
        expect(app.state.coachSuggestion).toBeNull();
    });

    it('refreshes guidance when getMoveGuidance returns null', () => {
        const app = createApp();
        vi.mocked(getMoveGuidance).mockReturnValue(null);
        const controller = new CoachController(app);
        controller.refreshCoachGuidance();
        expect(app.state.coachSuggestion).toBeNull();
    });

    it('sets coach state from getMoveGuidance result', () => {
        const app = createApp();
        vi.mocked(getMoveGuidance).mockReturnValue({
            row: 7, col: 7,
            alternatives: [{ row: 8, col: 8, reason: 'alt' }],
            insight: 'good move',
            risk: 'low risk',
        });
        const controller = new CoachController(app);
        controller.refreshCoachGuidance();
        expect(app.state.coachSuggestion).toEqual({ row: 7, col: 7 });
        expect(app.state.coachAlternatives).toHaveLength(1);
        expect(app.state.coachInsight).toBe('good move');
        expect(app.state.coachRisk).toBe('low risk');
        expect(app.state.coachPlan).toBe('coachPlanLocal');
        expect(app.state.coachSource).toBe('local');
        expect(app.state.coachLlmStatus).toBe('disabled');
    });

    it('shows message when announce is true', () => {
        const app = createApp();
        vi.mocked(getMoveGuidance).mockReturnValue({ row: 3, col: 3, alternatives: [] });
        const controller = new CoachController(app);
        controller.refreshCoachGuidance(true);
        expect(app.showMessageKey).toHaveBeenCalledWith('coachSuggestedMessage', expect.any(Object));
    });
});

describe('CoachController.isLegalCoachMove', () => {
    it('returns true for empty point inside board', () => {
        const app = createApp();
        const controller = new CoachController(app);
        expect(controller.isLegalCoachMove(7, 7)).toBe(true);
    });

    it('returns false for point outside board', () => {
        const app = createApp();
        const controller = new CoachController(app);
        expect(controller.isLegalCoachMove(-1, 0)).toBe(false);
        expect(controller.isLegalCoachMove(0, 15)).toBe(false);
        expect(controller.isLegalCoachMove(15, 0)).toBe(false);
    });

    it('returns false for occupied point', () => {
        const app = createApp();
        app.state.board[7][7] = 'black';
        const controller = new CoachController(app);
        expect(controller.isLegalCoachMove(7, 7)).toBe(false);
    });

    it('returns false for forbidden move', () => {
        const app = createApp({ getForbiddenReason: () => '三三禁手' });
        const controller = new CoachController(app);
        expect(controller.isLegalCoachMove(7, 7)).toBe(false);
    });
});

describe('CoachController.focusCoachCandidate', () => {
    it('sets coachFocus for a valid move', () => {
        const app = createApp();
        const controller = new CoachController(app);
        controller.focusCoachCandidate(5, 5);
        expect(app.state.coachFocus).toEqual({ row: 5, col: 5 });
        expect(app.render).toHaveBeenCalled();
    });

    it('plays error sound for illegal move', () => {
        const app = createApp();
        app.state.board[5][5] = 'black';
        const controller = new CoachController(app);
        controller.focusCoachCandidate(5, 5);
        expect(app.state.coachFocus).toBeNull();
        expect(app.sound.play).toHaveBeenCalledWith('error');
    });

    it('ignores when not in guided mode', () => {
        const app = createApp({ isGuidedMode: () => false });
        const controller = new CoachController(app);
        controller.focusCoachCandidate(5, 5);
        expect(app.state.coachFocus).toBeNull();
    });
});

describe('CoachController.getPositionKey', () => {
    it('produces different keys for different states', () => {
        const app = createApp();
        const controller = new CoachController(app);
        const key1 = controller.getPositionKey();
        app.state.moveHistory.push({ color: 'black', row: 7, col: 7 });
        const key2 = controller.getPositionKey();
        expect(key1).not.toBe(key2);
    });

    it('includes mode, rule, size, colors and move history', () => {
        const app = createApp();
        const controller = new CoachController(app);
        const key = controller.getPositionKey();
        expect(key).toContain('qi');
        expect(key).toContain('classic');
        expect(key).toContain('15');
        expect(key).toContain('black');
    });
});

describe('CoachController.normalizeCoachPoint', () => {
    it('normalizes valid coordinates', () => {
        const app = createApp();
        const controller = new CoachController(app);
        expect(controller.normalizeCoachPoint({ row: 7, col: 7 })).toEqual({ row: 7, col: 7 });
    });

    it('coerces string numbers', () => {
        const controller = new CoachController(createApp());
        expect(controller.normalizeCoachPoint({ row: '7', col: '7' })).toEqual({ row: 7, col: 7 });
    });

    it('returns null for invalid inputs', () => {
        const controller = new CoachController(createApp());
        expect(controller.normalizeCoachPoint(null)).toBeNull();
        expect(controller.normalizeCoachPoint({})).toBeNull();
        expect(controller.normalizeCoachPoint({ row: 'a', col: 7 })).toBeNull();
        expect(controller.normalizeCoachPoint({ row: 7, col: null })).toBeNull();
    });

    it('attaches extra properties', () => {
        const controller = new CoachController(createApp());
        const result = controller.normalizeCoachPoint({ row: 3, col: 4 }, { reason: 'test' });
        expect(result).toEqual({ row: 3, col: 4, reason: 'test' });
    });
});

describe('CoachController.normalizeCoachText', () => {
    it('trims whitespace', () => {
        const controller = new CoachController(createApp());
        expect(controller.normalizeCoachText('  hello  ')).toBe('hello');
    });

    it('returns empty string for null/undefined', () => {
        const controller = new CoachController(createApp());
        expect(controller.normalizeCoachText(null)).toBe('');
        expect(controller.normalizeCoachText(undefined)).toBe('');
    });

    it('truncates long text to 420 chars', () => {
        const controller = new CoachController(createApp());
        const long = 'a'.repeat(500);
        const result = controller.normalizeCoachText(long);
        expect(result).toHaveLength(420);
        expect(result.endsWith('...')).toBe(true);
    });
});

describe('CoachController.normalizeConfidence', () => {
    it('passes through valid 0-1 values', () => {
        const controller = new CoachController(createApp());
        expect(controller.normalizeConfidence(0.5)).toBe(0.5);
        expect(controller.normalizeConfidence(0)).toBe(0);
        expect(controller.normalizeConfidence(1)).toBe(1);
    });

    it('clamps out-of-range values', () => {
        const controller = new CoachController(createApp());
        expect(controller.normalizeConfidence(-0.5)).toBe(0);
        expect(controller.normalizeConfidence(1.5)).toBe(1);
    });

    it('returns null for invalid inputs', () => {
        const controller = new CoachController(createApp());
        expect(controller.normalizeConfidence(null)).toBeNull();
        expect(controller.normalizeConfidence('abc')).toBeNull();
        expect(controller.normalizeConfidence(undefined)).toBeNull();
    });
});

describe('CoachController.normalizeLlmAdvice', () => {
    it('returns null when recommended point is invalid', () => {
        const controller = new CoachController(createApp());
        expect(controller.normalizeLlmAdvice({ recommended: null })).toBeNull();
        expect(controller.normalizeLlmAdvice({ recommended: { row: -1, col: 0 } })).toBeNull();
    });

    it('normalizes valid advice with all fields', () => {
        const controller = new CoachController(createApp());
        const advice = controller.normalizeLlmAdvice({
            recommended: { row: 7, col: 7 },
            alternatives: [{ row: 8, col: 8, reason: 'alt1' }, { row: 9, col: 9 }],
            reason: 'good',
            risk: 'low',
            plan: 'play here',
            confidence: 0.85
        });
        expect(advice).not.toBeNull();
        expect(advice.recommended).toEqual({ row: 7, col: 7 });
        expect(advice.alternatives).toHaveLength(2);
        expect(advice.reason).toBe('good');
        expect(advice.risk).toBe('low');
        expect(advice.plan).toBe('play here');
        expect(advice.confidence).toBe(0.85);
    });

    it('deduplicates alternatives', () => {
        const controller = new CoachController(createApp());
        const advice = controller.normalizeLlmAdvice({
            recommended: { row: 7, col: 7 },
            alternatives: [
                { row: 7, col: 7 },
                { row: 8, col: 8 },
                { row: 8, col: 8 }
            ]
        });
        expect(advice.alternatives).toHaveLength(1);
    });

    it('caps alternatives at 3', () => {
        const controller = new CoachController(createApp());
        const advice = controller.normalizeLlmAdvice({
            recommended: { row: 7, col: 7 },
            alternatives: Array.from({ length: 10 }, (_, i) => ({ row: i, col: i }))
        });
        expect(advice.alternatives).toHaveLength(3);
    });
});

describe('CoachController.requestLlmCoachGuidance error handling', () => {
    it('sets unavailable status on network error', async () => {
        const app = createApp();
        app.llmSettings = { enabled: true, baseUrl: 'http://test', model: 'm', apiKey: 'k' };
        vi.mocked(isLlmCoachConfigured).mockReturnValue(true);
        vi.mocked(getMoveGuidance).mockReturnValue({ row: 7, col: 7, alternatives: [] });
        vi.mocked(requestLlmCoachAdvice).mockRejectedValue(
            new (await import('../../services/llmCoach.js')).LlmCoachError('Network error', 'network_error')
        );
        const controller = new CoachController(app);
        await controller.requestLlmCoachGuidance({ row: 7, col: 7 });
        expect(app.state.coachLlmStatus).toBe('unavailable');
        expect(app.render).toHaveBeenCalled();
        expect(app.showMessageKey).toHaveBeenCalledWith(
            'coachLlmRequestFailed',
            { reason: 'Network error' }
        );
    });

    it('sets unavailable status on timeout', async () => {
        const app = createApp();
        app.llmSettings = { enabled: true, baseUrl: 'http://test', model: 'm', apiKey: 'k' };
        vi.mocked(isLlmCoachConfigured).mockReturnValue(true);
        vi.mocked(getMoveGuidance).mockReturnValue({ row: 7, col: 7, alternatives: [] });
        vi.mocked(requestLlmCoachAdvice).mockRejectedValue(
            new (await import('../../services/llmCoach.js')).LlmCoachError('LLM request timed out.', 'timeout')
        );
        const controller = new CoachController(app);
        await controller.requestLlmCoachGuidance({ row: 7, col: 7 });
        expect(app.state.coachLlmStatus).toBe('unavailable');
        expect(app.showMessageKey).toHaveBeenCalledWith(
            'coachLlmRequestFailed',
            { reason: 'LLM request timed out.' }
        );
    });

    it('ignores aborted errors silently', async () => {
        const app = createApp();
        app.llmSettings = { enabled: true, baseUrl: 'http://test', model: 'm', apiKey: 'k' };
        vi.mocked(isLlmCoachConfigured).mockReturnValue(true);
        vi.mocked(getMoveGuidance).mockReturnValue({ row: 7, col: 7, alternatives: [] });
        vi.mocked(requestLlmCoachAdvice).mockRejectedValue(
            new (await import('../../services/llmCoach.js')).LlmCoachError('LLM request was aborted.', 'aborted')
        );
        const controller = new CoachController(app);
        await controller.requestLlmCoachGuidance({ row: 7, col: 7 });
        expect(app.state.coachLlmStatus).not.toBe('unavailable');
        expect(app.showMessageKey).not.toHaveBeenCalled();
    });

    it('skips when LLM not configured', async () => {
        const app = createApp();
        app.llmSettings = { enabled: false };
        vi.mocked(isLlmCoachConfigured).mockReturnValue(false);
        vi.mocked(getMoveGuidance).mockReturnValue({ row: 7, col: 7, alternatives: [] });
        const controller = new CoachController(app);
        await controller.requestLlmCoachGuidance({ row: 7, col: 7 });
        expect(app.state.coachLlmStatus).toBe('disabled');
    });
});
