import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../utils/i18n.js', () => ({
    i18n: {
        t: (key, params) => {
            if (params && Object.keys(params).length > 0) return `${key}:${JSON.stringify(params)}`;
            return key;
        }
    },
    t: (key) => key
}));
vi.mock('../../games/gomoku/ai.js', () => ({
    getAIDelay: vi.fn(() => 0),
    getBestMove: vi.fn(),
    getMoveGuidance: vi.fn(),
    getMoveReview: vi.fn()
}));
vi.mock('../../games/gomoku/rules.js', () => ({
    getForbiddenReason: vi.fn(() => ''),
    getWinningLine: vi.fn(() => [])
}));
vi.mock('../../games/gomoku/state.js', () => ({
    createGameState: vi.fn((opts) => ({
        board: Array.from({ length: opts?.size || 15 }, () => Array(opts?.size || 15).fill(null)),
        currentPlayer: 'black',
        gameOver: false,
        aiThinking: false,
        moveHistory: [],
        lastMove: null,
        hintMove: null,
        winningCells: [],
        resultSummary: null,
        resultType: null,
        resultWinnerColor: null,
        coachSuggestion: null,
        coachAlternatives: [],
        coachFeedback: '',
        coachSource: 'local',
        coachLlmStatus: 'local',
        coachInsight: '',
        coachRisk: '',
        coachPlan: '',
        coachConfidence: null,
        coachFocus: null,
        coachPreviewMode: false,
        coachPreviewBoard: null,
        coachAnalyzedBoard: null,
        selectedCell: null,
        awaitingPlacementConfirm: false
    }))
}));
vi.mock('../../ui/render.js', () => ({
    hideResultOverlay: vi.fn(),
    renderBoard: vi.fn(),
    setAIThinking: vi.fn(),
    showGame: vi.fn(),
    showMessage: vi.fn(),
    showResultOverlay: vi.fn(),
    showSetup: vi.fn(),
    updateBoardPreviewOverlay: vi.fn(),
    updateGuidance: vi.fn(),
    updateMeta: vi.fn(),
    updateMoveList: vi.fn(),
    updatePlacementPanel: vi.fn(),
    updateStatus: vi.fn()
}));
vi.mock('../../ui/dom.js', () => ({
    setActiveByValue: vi.fn()
}));
vi.mock('../../utils/formatters.js', () => ({
    formatMove: vi.fn((r, c) => `${String.fromCharCode(65 + (c >= 8 ? c + 1 : c))}${r + 1}`),
    getPlayerLabel: vi.fn((color) => color === 'black' ? 'Black' : 'White')
}));
vi.mock('../../utils/board.js', () => ({
    getOpponent: vi.fn((color) => color === 'black' ? 'white' : 'black'),
    isBoardFull: vi.fn(() => false),
    isInside: vi.fn(() => true)
}));
vi.mock('../../config/sceneConfig.js', () => ({
    getSceneAmbienceCue: vi.fn(() => 'home-game-idle')
}));
vi.mock('../../services/llmCoach.js', () => ({
    getLlmCoachConfigStatus: vi.fn(() => 'missing'),
    isLlmCoachConfigured: vi.fn(() => false)
}));
vi.mock('../../services/aiCommentary.js', () => ({
    getMoveCommentary: vi.fn(async () => null),
    isCommentaryAvailable: vi.fn(() => false),
    clearCommentaryCache: vi.fn()
}));

import { GameController } from './GameController.js';
import { getBestMove, getAIDelay, getMoveReview } from '../../games/gomoku/ai.js';
import { getForbiddenReason as getForbidden, getWinningLine } from '../../games/gomoku/rules.js';
import { createGameState } from '../../games/gomoku/state.js';
import {
    hideResultOverlay,
    showSetup,
    showGame,
    showMessage,
    showResultOverlay,
    setAIThinking as setAIThinkingUI,
    updateMeta,
    updateStatus,
    updateMoveList,
    updateGuidance,
    updateBoardPreviewOverlay,
    updatePlacementPanel
} from '../../ui/render.js';
import { setActiveByValue } from '../../ui/dom.js';
import { getOpponent, isBoardFull } from '../../utils/board.js';

function createBoard(size) {
    return Array.from({ length: size }, () => Array(size).fill(null));
}

function createMockApp(overrides = {}) {
    const sound = {
        play: vi.fn(),
        isEnabled: vi.fn(() => true),
        setEnabled: vi.fn(),
        unlock: vi.fn(),
        setAmbience: vi.fn()
    };
    const sectionClasses = new Set();
    const messageClasses = new Set();
    const resultOverlayClasses = new Set();
    const bodyClasses = new Set();
    if (!document.body) {
        Object.defineProperty(document, 'body', {
            value: {
                classList: {
                    add: (...n) => n.forEach((c) => bodyClasses.add(c)),
                    remove: (...n) => n.forEach((c) => bodyClasses.delete(c)),
                    contains: (c) => bodyClasses.has(c),
                    toggle: () => {}
                },
                dataset: {}
            },
            writable: true, configurable: true
        });
    }

    return {
        options: { size: 15, rule: 'classic', mode: 'pvp', playerColor: 'black', level: 'beginner', scene: 'home' },
        state: createGameState({ size: 15 }),
        dom: {
            board: { querySelector: vi.fn(() => null), querySelectorAll: vi.fn(() => []) },
            sections: {
                game: {
                    classList: {
                        contains: vi.fn(() => false),
                        add: vi.fn(),
                        remove: vi.fn(),
                        toggle: vi.fn()
                    }
                }
            },
            message: {
                classList: { add: (...n) => n.forEach((c) => messageClasses.add(c)), remove: (...n) => n.forEach((c) => messageClasses.delete(c)), contains: (c) => messageClasses.has(c) }
            },
            result: {
                overlay: {
                    classList: { add: (...n) => n.forEach((c) => resultOverlayClasses.add(c)), remove: (...n) => n.forEach((c) => resultOverlayClasses.delete(c)), contains: vi.fn(() => false) }
                }
            },
            controls: {
                soundToggle: { classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn(), contains: vi.fn() }, setAttribute: vi.fn() }
            },
            optionGroups: {
                playerColor: { querySelector: vi.fn(), querySelectorAll: vi.fn() }
            },
            guidance: {},
            boardPreviewOverlay: null
        },
        sound,
        renderer3d: null,
        use3D: false,
        previewCell: null,
        aiTimer: null,
        matchEnterTimer: null,
        llmSettings: { enabled: false, baseUrl: '', model: '', apiKey: '' },
        immersiveUiRegions: { top: false, left: false, right: false, bottom: false },
        currentAmbientCue: null,
        isAIMode: vi.fn(() => false),
        isGuidedMode: vi.fn(() => false),
        canHumanMove: vi.fn(() => true),
        render: vi.fn(),
        showMessageKey: vi.fn(),
        refreshCoachGuidance: vi.fn(),
        clearCoachState: vi.fn(),
        cancelLlmCoachRequest: vi.fn(),
        clearPendingAI: vi.fn(),
        setAIThinking: vi.fn(),
        clearPreview: vi.fn(),
        clearPlacementSelection: vi.fn(),
        setImmersiveRegions: vi.fn(),
        refreshImmersiveUi: vi.fn(),
        refreshSoundToggle: vi.fn(),
        syncSceneExperience: vi.fn(),
        dismissFirstRunGuide: vi.fn(),
        refreshSetup: vi.fn(),
        createResultSummary: vi.fn((t, w) => ({
            badge: t === 'win' ? 'Win!' : t === 'draw' ? 'Draw' : 'Resign',
            title: 'Game Over',
            detail: 'Detail',
            moves: 0,
            lastMove: '-',
            variant: `result-${t}`
        })),
        ...overrides
    };
}

let originalSetTimeout;

beforeEach(() => {
    vi.clearAllMocks();
    originalSetTimeout = window.setTimeout;
    window.setTimeout = (fn) => { if (typeof fn === 'function') fn(); return 0; };
    getAIDelay.mockReturnValue(0);
    getBestMove.mockReturnValue(null);
    getWinningLine.mockReturnValue([]);
    isBoardFull.mockReturnValue(false);
});

afterEach(() => {
    window.setTimeout = originalSetTimeout;
});

describe('GameController.constructor', () => {
    it('stores app reference', () => {
        const app = createMockApp();
        const ctrl = new GameController(app);
        expect(ctrl.app).toBe(app);
    });
});

describe('GameController.createFreshState', () => {
    it('creates new state and hides result overlay', () => {
        const app = createMockApp();
        const oldState = app.state;
        const ctrl = new GameController(app);
        ctrl.createFreshState();
        expect(createGameState).toHaveBeenCalledWith(app.options);
        expect(app.state).not.toBe(oldState);
        expect(hideResultOverlay).toHaveBeenCalledWith(app.dom);
    });
});

describe('GameController.enterSetup', () => {
    it('clears state and shows setup panel', () => {
        const app = createMockApp();
        const ctrl = new GameController(app);
        ctrl.enterSetup();
        expect(app.clearPendingAI).toHaveBeenCalled();
        expect(app.cancelLlmCoachRequest).toHaveBeenCalled();
        expect(app.clearPreview).toHaveBeenCalled();
        expect(app.clearPlacementSelection).toHaveBeenCalledWith(false);
        expect(showSetup).toHaveBeenCalledWith(app.dom);
        expect(app.setAIThinking).toHaveBeenCalledWith(false);
        expect(hideResultOverlay).toHaveBeenCalledWith(app.dom);
        expect(app.render).toHaveBeenCalled();
        expect(app.refreshImmersiveUi).toHaveBeenCalled();
    });

    it('configures 3D renderer when available', () => {
        const app = createMockApp();
        app.use3D = true;
        app.renderer3d = {
            setInteractionEnabled: vi.fn(),
            setScenePreset: vi.fn(),
            setPresentationMode: vi.fn(),
            fitToBoard: vi.fn(),
            playSetupStartSequence: vi.fn()
        };
        const ctrl = new GameController(app);
        ctrl.enterSetup();
        expect(app.renderer3d.setInteractionEnabled).toHaveBeenCalledWith(false);
        expect(app.renderer3d.setScenePreset).toHaveBeenCalledWith('home', { animate: false });
        expect(app.renderer3d.setPresentationMode).toHaveBeenCalledWith('setup', { animate: false });
        expect(app.renderer3d.fitToBoard).toHaveBeenCalledWith(15, false);
        expect(app.renderer3d.playSetupStartSequence).toHaveBeenCalled();
    });
});

describe('GameController.startGame', () => {
    it('initializes game state and shows game view', () => {
        const app = createMockApp();
        const ctrl = new GameController(app);
        ctrl.startGame();
        expect(app.clearPendingAI).toHaveBeenCalled();
        expect(app.cancelLlmCoachRequest).toHaveBeenCalled();
        expect(app.dismissFirstRunGuide).toHaveBeenCalled();
        expect(updateMeta).toHaveBeenCalledWith(app.dom, app.options);
        expect(showGame).toHaveBeenCalledWith(app.dom);
        expect(app.render).toHaveBeenCalled();
        expect(showMessage).toHaveBeenCalledWith(app.dom, 'introPvp', 'info');
    });

    it('configures 3D renderer in game mode', () => {
        const app = createMockApp();
        app.use3D = true;
        app.renderer3d = {
            setBoardSize: vi.fn(),
            setScenePreset: vi.fn(),
            setPresentationMode: vi.fn(),
            setInteractionEnabled: vi.fn(),
            resize: vi.fn(),
            fitToBoard: vi.fn(),
            playGameStartSequence: vi.fn()
        };
        const ctrl = new GameController(app);
        ctrl.startGame();
        expect(app.renderer3d.setBoardSize).toHaveBeenCalledWith(15);
        expect(app.renderer3d.setPresentationMode).toHaveBeenCalledWith('game', { animate: false });
        expect(app.renderer3d.setInteractionEnabled).toHaveBeenCalledWith(true);
    });

    it('schedules AI move when AI mode and player is white', () => {
        const app = createMockApp();
        app.isAIMode.mockReturnValue(true);
        app.options.playerColor = 'white';
        const ctrl = new GameController(app);
        const scheduleSpy = vi.spyOn(ctrl, 'scheduleAIMove');
        ctrl.startGame();
        expect(scheduleSpy).toHaveBeenCalled();
    });

    it('refreshes coach guidance in guided mode', () => {
        const app = createMockApp();
        app.isGuidedMode.mockReturnValue(true);
        const ctrl = new GameController(app);
        ctrl.startGame();
        expect(app.refreshCoachGuidance).toHaveBeenCalled();
    });
});

describe('GameController.getIntroMessage', () => {
    it('returns pvp intro for pvp mode', () => {
        const app = createMockApp();
        app.options.mode = 'pvp';
        const ctrl = new GameController(app);
        expect(ctrl.getIntroMessage()).toBe('introPvp');
    });

    it('returns practice intro for practice mode', () => {
        const app = createMockApp();
        app.options.mode = 'practice';
        const ctrl = new GameController(app);
        expect(ctrl.getIntroMessage()).toBe('introPractice');
    });

    it('returns pve black intro for pve black', () => {
        const app = createMockApp();
        app.options.mode = 'pve';
        app.options.playerColor = 'black';
        const ctrl = new GameController(app);
        expect(ctrl.getIntroMessage()).toBe('introPveBlack');
    });

    it('returns pve white intro for pve white', () => {
        const app = createMockApp();
        app.options.mode = 'pve';
        app.options.playerColor = 'white';
        const ctrl = new GameController(app);
        expect(ctrl.getIntroMessage()).toBe('introPveWhite');
    });

    it('returns qi black intro for qi black', () => {
        const app = createMockApp();
        app.options.mode = 'qi';
        app.options.playerColor = 'black';
        const ctrl = new GameController(app);
        expect(ctrl.getIntroMessage()).toBe('introQiBlack');
    });

    it('returns qi white intro for qi white', () => {
        const app = createMockApp();
        app.options.mode = 'qi';
        app.options.playerColor = 'white';
        const ctrl = new GameController(app);
        expect(ctrl.getIntroMessage()).toBe('introQiWhite');
    });
});

describe('GameController.commitMove', () => {
    it('places stone and updates state', () => {
        const app = createMockApp();
        const ctrl = new GameController(app);
        ctrl.commitMove(7, 7, 'black');
        expect(app.state.board[7][7]).toBe('black');
        expect(app.state.moveHistory.length).toBe(1);
        expect(app.state.lastMove).toEqual({ row: 7, col: 7, color: 'black', index: 1 });
        expect(app.sound.play).toHaveBeenCalledWith('move', { color: 'black', source: 'human' });
        expect(app.render).toHaveBeenCalledWith({ animateLastMove: true });
    });

    it('handles winning move', () => {
        const app = createMockApp();
        getWinningLine.mockReturnValue([{ row: 7, col: 7 }, { row: 7, col: 8 }]);
        const ctrl = new GameController(app);
        ctrl.commitMove(7, 7, 'black');
        expect(app.state.gameOver).toBe(true);
        expect(app.state.resultType).toBe('win');
        expect(app.state.resultWinnerColor).toBe('black');
        expect(app.state.winningCells).toHaveLength(2);
        expect(showResultOverlay).toHaveBeenCalled();
        expect(app.sound.play).toHaveBeenCalledWith('win');
        expect(app.setAIThinking).toHaveBeenCalledWith(false);
    });

    it('handles board full draw', () => {
        isBoardFull.mockReturnValue(true);
        const app = createMockApp();
        const ctrl = new GameController(app);
        ctrl.commitMove(7, 7, 'black');
        expect(app.state.gameOver).toBe(true);
        expect(app.state.resultType).toBe('draw');
        expect(app.state.resultWinnerColor).toBeNull();
        expect(showResultOverlay).toHaveBeenCalled();
        expect(app.sound.play).toHaveBeenCalledWith('draw');
    });

    it('switches to opponent after valid move', () => {
        const app = createMockApp();
        const ctrl = new GameController(app);
        ctrl.commitMove(7, 7, 'black');
        expect(app.state.currentPlayer).toBe('white');
        expect(updateStatus).toHaveBeenCalledWith(app.dom, app.state);
    });

    it('schedules AI move after human move in AI mode', () => {
        const app = createMockApp();
        app.isAIMode.mockReturnValue(true);
        app.options.playerColor = 'black';
        const ctrl = new GameController(app);
        const scheduleSpy = vi.spyOn(ctrl, 'scheduleAIMove');
        ctrl.commitMove(7, 7, 'black');
        expect(scheduleSpy).toHaveBeenCalled();
    });

    it('evaluates coach feedback in guided mode after human move', () => {
        const app = createMockApp();
        app.isGuidedMode.mockReturnValue(true);
        app.options.playerColor = 'black';
        app.state.coachSuggestion = { row: 7, col: 7 };
        const ctrl = new GameController(app);
        ctrl.commitMove(7, 7, 'black');
        expect(app.state.coachFeedback).toBe('coachReviewFollowed');
        expect(app.state.coachSuggestion).toBeNull();
        expect(app.state.currentPlayer).toBe('white');
    });

    it('evaluates coach feedback in guided mode', () => {
        const app = createMockApp();
        app.isGuidedMode.mockReturnValue(true);
        app.options.playerColor = 'black';
        app.state.coachSuggestion = { row: 7, col: 7 };
        const ctrl = new GameController(app);
        ctrl.commitMove(7, 7, 'black');
        expect(app.state.coachFeedback).toBe('coachReviewFollowed');
    });

    it('evaluates coach feedback as review when not matching suggestion', () => {
        const app = createMockApp();
        app.isGuidedMode.mockReturnValue(true);
        app.options.playerColor = 'black';
        app.state.coachSuggestion = { row: 5, col: 5 };
        getMoveReview.mockReturnValue('coachReviewAlternative');
        const ctrl = new GameController(app);
        ctrl.commitMove(7, 7, 'black');
        expect(app.state.coachFeedback).toBe('coachReviewAlternative');
    });

    it('catches errors gracefully', () => {
        const app = createMockApp();
        app.state.board = null; // Will cause error
        const ctrl = new GameController(app);
        ctrl.commitMove(7, 7, 'black');
        expect(app.setAIThinking).toHaveBeenCalledWith(false);
        expect(showMessage).toHaveBeenCalled();
    });
});

describe('GameController.scheduleAIMove', () => {
    it('sets AI thinking state and calls getBestMove', () => {
        const app = createMockApp();
        app.isAIMode.mockReturnValue(true);
        app.state.currentPlayer = 'white';
        app.options.playerColor = 'black';
        getBestMove.mockReturnValue({ row: 7, col: 7 });
        const ctrl = new GameController(app);
        ctrl.scheduleAIMove();
        // setTimeout is used, so check synchronous setup
        expect(app.setAIThinking).toHaveBeenCalledWith(true);
        expect(showMessage).toHaveBeenCalledWith(app.dom, 'aiThinkingMessage', 'info');
    });

    it('aborts if game is over before AI moves', () => {
        const app = createMockApp();
        app.state.gameOver = true;
        const ctrl = new GameController(app);
        ctrl.scheduleAIMove();
        // AI timer fires, but gameOver check should abort
        expect(app.setAIThinking).toHaveBeenCalledWith(false);
    });

    it('handles AI returning no move', () => {
        const app = createMockApp();
        app.isAIMode.mockReturnValue(true);
        app.state.currentPlayer = 'white';
        app.options.playerColor = 'black';
        getBestMove.mockReturnValue(null);
        const ctrl = new GameController(app);
        ctrl.scheduleAIMove();
        expect(app.state.gameOver).toBe(true);
    });
});

describe('GameController.undo', () => {
    it('shows error when history is empty', () => {
        const app = createMockApp();
        const ctrl = new GameController(app);
        ctrl.undo();
        expect(app.sound.play).toHaveBeenCalledWith('error');
        expect(showMessage).toHaveBeenCalledWith(app.dom, 'nothingToUndo', 'info');
    });

    it('removes last move from history', () => {
        const app = createMockApp();
        app.state.moveHistory = [
            { row: 7, col: 7, color: 'black', index: 1 }
        ];
        app.state.lastMove = { row: 7, col: 7, color: 'black', index: 1 };
        app.state.board[7][7] = 'black';
        const ctrl = new GameController(app);
        ctrl.undo();
        expect(app.state.board[7][7]).toBeNull();
        expect(app.state.moveHistory).toHaveLength(0);
        expect(app.state.lastMove).toBeNull();
        expect(app.state.currentPlayer).toBe('black');
    });

    it('removes two moves in AI mode', () => {
        const app = createMockApp();
        app.isAIMode.mockReturnValue(true);
        app.options.playerColor = 'black';
        app.state.moveHistory = [
            { row: 7, col: 7, color: 'black', index: 1 },
            { row: 8, col: 8, color: 'white', index: 2 }
        ];
        app.state.lastMove = { row: 8, col: 8, color: 'white', index: 2 };
        app.state.board[7][7] = 'black';
        app.state.board[8][8] = 'white';
        const ctrl = new GameController(app);
        ctrl.undo();
        expect(app.state.moveHistory).toHaveLength(0);
        expect(app.state.currentPlayer).toBe('black');
    });

    it('ends in setup for white AI opening when history clears', () => {
        const app = createMockApp();
        app.isAIMode.mockReturnValue(true);
        app.options.playerColor = 'white';
        app.state.moveHistory = [{ row: 7, col: 7, color: 'black', index: 1 }];
        app.state.lastMove = { row: 7, col: 7, color: 'black', index: 1 };
        const ctrl = new GameController(app);
        const enterSpy = vi.spyOn(ctrl, 'enterSetup');
        ctrl.undo();
        expect(enterSpy).toHaveBeenCalled();
    });

    it('blocks undo when aiThinking is true', () => {
        const app = createMockApp();
        app.state.aiThinking = true;
        app.state.moveHistory = [
            { row: 7, col: 7, color: 'black', index: 1 }
        ];
        const ctrl = new GameController(app);
        ctrl.undo();
        expect(app.sound.play).toHaveBeenCalledWith('error');
        expect(showMessage).toHaveBeenCalledWith(app.dom, 'noUndoDuringAiTurn', 'info');
        expect(app.state.moveHistory).toHaveLength(1);
    });

    it('blocks undo when gameOver is true', () => {
        const app = createMockApp();
        app.state.gameOver = true;
        app.state.moveHistory = [
            { row: 7, col: 7, color: 'black', index: 1 }
        ];
        const ctrl = new GameController(app);
        ctrl.undo();
        expect(app.sound.play).toHaveBeenCalledWith('error');
        expect(showMessage).toHaveBeenCalledWith(app.dom, 'gameAlreadyEnded', 'info');
        expect(app.state.moveHistory).toHaveLength(1);
    });
});

describe('GameController.showHint', () => {
    it('shows error when game is over', () => {
        const app = createMockApp();
        app.state.gameOver = true;
        const ctrl = new GameController(app);
        ctrl.showHint();
        expect(app.sound.play).toHaveBeenCalledWith('error');
        expect(showMessage).toHaveBeenCalledWith(app.dom, 'noHintNeededGameOver', 'info');
    });

    it('shows error when AI turn in AI mode', () => {
        const app = createMockApp();
        app.isAIMode.mockReturnValue(true);
        app.state.currentPlayer = 'white';
        app.options.playerColor = 'black';
        const ctrl = new GameController(app);
        ctrl.showHint();
        expect(app.sound.play).toHaveBeenCalledWith('error');
        expect(showMessage).toHaveBeenCalledWith(app.dom, 'noHintDuringAiTurn', 'info');
    });

    it('refreshes coach in guided mode', () => {
        const app = createMockApp();
        app.isGuidedMode.mockReturnValue(true);
        const ctrl = new GameController(app);
        ctrl.showHint();
        expect(app.refreshCoachGuidance).toHaveBeenCalledWith(true);
        expect(app.sound.play).toHaveBeenCalledWith('hint');
    });

    it('sets hint from AI when available', () => {
        const app = createMockApp();
        getBestMove.mockReturnValue({ row: 7, col: 7 });
        const ctrl = new GameController(app);
        ctrl.showHint();
        expect(app.state.hintMove).toEqual({ row: 7, col: 7 });
        expect(app.sound.play).toHaveBeenCalledWith('hint');
        expect(app.render).toHaveBeenCalled();
        expect(showMessage).toHaveBeenCalledWith(app.dom, expect.stringContaining('hintSuggestionMessage'), 'info');
    });

    it('shows error when no hint available', () => {
        const app = createMockApp();
        getBestMove.mockReturnValue(null);
        const ctrl = new GameController(app);
        ctrl.showHint();
        expect(app.sound.play).toHaveBeenCalledWith('error');
        expect(showMessage).toHaveBeenCalledWith(app.dom, 'noHintAvailable', 'info');
    });
});

describe('GameController.swapSides', () => {
    it('shows error when game has started', () => {
        const app = createMockApp();
        app.state.moveHistory = [{ row: 7, col: 7, color: 'black', index: 1 }];
        const ctrl = new GameController(app);
        ctrl.swapSides();
        expect(app.sound.play).toHaveBeenCalledWith('error');
        expect(showMessage).toHaveBeenCalledWith(app.dom, 'swapOnlyBeforeOpening', 'info');
    });

    it('swaps player color in AI mode', () => {
        const app = createMockApp();
        app.isAIMode.mockReturnValue(true);
        const ctrl = new GameController(app);
        ctrl.swapSides();
        expect(app.options.playerColor).toBe('white');
        expect(app.state.currentPlayer).toBe('black');
        expect(setActiveByValue).toHaveBeenCalled();
    });

    it('schedules AI move when swapped to white in AI mode', () => {
        const app = createMockApp();
        app.isAIMode.mockReturnValue(true);
        app.options.playerColor = 'black';
        const ctrl = new GameController(app);
        ctrl.swapSides();
        // Now playerColor is 'white', AI should move
        expect(showMessage).toHaveBeenCalledWith(app.dom, expect.stringContaining('swappedToWhite'), 'info');
    });

    it('swaps current player in PvP mode', () => {
        const app = createMockApp();
        const ctrl = new GameController(app);
        ctrl.swapSides();
        expect(app.state.currentPlayer).toBe('white');
        expect(app.render).toHaveBeenCalled();
        expect(showMessage).toHaveBeenCalledWith(app.dom, expect.stringContaining('swappedFirstPlayer'), 'info');
    });
});

describe('GameController.restart', () => {
    it('resets game and shows restart message', () => {
        const app = createMockApp();
        const ctrl = new GameController(app);
        ctrl.restart();
        expect(app.clearPendingAI).toHaveBeenCalled();
        expect(app.cancelLlmCoachRequest).toHaveBeenCalled();
        expect(updateMeta).toHaveBeenCalledWith(app.dom, app.options);
        expect(app.render).toHaveBeenCalled();
        expect(showMessage).toHaveBeenCalledWith(app.dom, 'gameRestartedMessage', 'info');
    });

    it('schedules AI move for white player in AI mode', () => {
        const app = createMockApp();
        app.isAIMode.mockReturnValue(true);
        app.options.playerColor = 'white';
        const ctrl = new GameController(app);
        const scheduleSpy = vi.spyOn(ctrl, 'scheduleAIMove');
        ctrl.restart();
        expect(scheduleSpy).toHaveBeenCalled();
    });

    it('refreshes coach in guided mode', () => {
        const app = createMockApp();
        app.isGuidedMode.mockReturnValue(true);
        const ctrl = new GameController(app);
        ctrl.restart();
        expect(app.refreshCoachGuidance).toHaveBeenCalled();
    });
});

describe('GameController.resign', () => {
    it('shows error when game already ended', () => {
        const app = createMockApp();
        app.state.gameOver = true;
        const ctrl = new GameController(app);
        ctrl.resign();
        expect(app.sound.play).toHaveBeenCalledWith('error');
        expect(showMessage).toHaveBeenCalledWith(app.dom, 'gameAlreadyEnded', 'info');
    });

    it('ends game with opponent as winner', () => {
        const app = createMockApp();
        const ctrl = new GameController(app);
        ctrl.resign();
        expect(app.state.gameOver).toBe(true);
        expect(app.state.resultType).toBe('resign');
        expect(app.state.resultWinnerColor).toBe('white');
        expect(showResultOverlay).toHaveBeenCalledWith(app.dom, app.state.resultSummary);
        expect(app.sound.play).toHaveBeenCalledWith('resign');
    });

    it('blocks resign when aiThinking is true', () => {
        const app = createMockApp();
        app.state.aiThinking = true;
        const ctrl = new GameController(app);
        ctrl.resign();
        expect(app.sound.play).toHaveBeenCalledWith('error');
        expect(showMessage).toHaveBeenCalledWith(app.dom, 'noResignDuringAiTurn', 'info');
        expect(app.state.gameOver).toBe(false);
    });
});

describe('GameController.validateMove', () => {
    it('returns occupied error when cell is taken', () => {
        const app = createMockApp();
        app.state.board[3][4] = 'black';
        const ctrl = new GameController(app);
        expect(ctrl.validateMove(3, 4, 'white')).toBe('cellOccupied');
    });

    it('returns forbidden reason when applicable', () => {
        const app = createMockApp();
        getForbidden.mockReturnValue('doubleThree');
        const ctrl = new GameController(app);
        expect(ctrl.validateMove(7, 7, 'black')).toBe('doubleThree');
    });

    it('returns empty string for valid move', () => {
        const app = createMockApp();
        getForbidden.mockReturnValue('');
        const ctrl = new GameController(app);
        expect(ctrl.validateMove(7, 7, 'black')).toBe('');
    });
});

describe('GameController.getForbiddenReason', () => {
    it('delegates to rules.js getForbiddenReason', () => {
        getForbidden.mockReturnValue('overline');
        const app = createMockApp();
        const ctrl = new GameController(app);
        expect(ctrl.getForbiddenReason(7, 7, 'black')).toBe('overline');
        expect(getForbidden).toHaveBeenCalledWith(
            app.state.board, app.options.size, app.options.rule, 7, 7, 'black'
        );
    });
});

describe('GameController.createResultSummary', () => {
    it('creates win summary', () => {
        const app = createMockApp();
        const ctrl = new GameController(app);
        const summary = ctrl.createResultSummary('win', 'black');
        expect(summary.variant).toBe('result-win');
        expect(summary.moves).toBe(0);
    });

    it('creates draw summary', () => {
        const app = createMockApp();
        const ctrl = new GameController(app);
        const summary = ctrl.createResultSummary('draw');
        expect(summary.variant).toBe('result-draw');
    });

    it('creates resign summary', () => {
        const app = createMockApp();
        const ctrl = new GameController(app);
        const summary = ctrl.createResultSummary('resign', 'white');
        expect(summary.variant).toBe('result-resign');
    });
});

describe('GameController.setAIThinking', () => {
    it('updates state and UI', () => {
        const app = createMockApp();
        const ctrl = new GameController(app);
        ctrl.setAIThinking(true);
        expect(app.state.aiThinking).toBe(true);
        expect(app.syncSceneExperience).toHaveBeenCalled();
    });
});

describe('GameController.clearPendingAI', () => {
    it('clears timer and stops thinking', () => {
        const app = createMockApp();
        app.aiTimer = 123;
        const ctrl = new GameController(app);
        ctrl.clearPendingAI();
        expect(app.aiTimer).toBeNull();
        expect(app.state.aiThinking).toBe(false);
    });

    it('handles null timer', () => {
        const app = createMockApp();
        app.aiTimer = null;
        const ctrl = new GameController(app);
        ctrl.clearPendingAI();
        expect(app.state.aiThinking).toBe(false);
    });
});

describe('GameController.toggleSound', () => {
    it('disables sound when enabled', () => {
        const app = createMockApp();
        app.sound.isEnabled.mockReturnValue(true);
        const ctrl = new GameController(app);
        ctrl.toggleSound();
        expect(app.sound.play).toHaveBeenCalledWith('toggleOff');
        expect(app.sound.setEnabled).toHaveBeenCalledWith(false);
        expect(app.refreshSoundToggle).toHaveBeenCalled();
    });

    it('enables sound when disabled', () => {
        const app = createMockApp();
        app.sound.isEnabled.mockReturnValue(false);
        const ctrl = new GameController(app);
        ctrl.toggleSound();
        expect(app.sound.play).toHaveBeenCalledWith('toggleOn');
        expect(app.sound.setEnabled).toHaveBeenCalledWith(true);
        expect(app.sound.unlock).toHaveBeenCalled();
        expect(app.refreshSoundToggle).toHaveBeenCalled();
    });
});

describe('GameController.resetCamera', () => {
    it('calls renderer3d.resetCamera when available', () => {
        const app = createMockApp();
        app.use3D = true;
        app.renderer3d = { resetCamera: vi.fn() };
        const ctrl = new GameController(app);
        ctrl.resetCamera();
        expect(app.renderer3d.resetCamera).toHaveBeenCalled();
    });

    it('does nothing without 3D renderer', () => {
        const app = createMockApp();
        const ctrl = new GameController(app);
        ctrl.resetCamera(); // should not throw
    });
});

describe('GameController.showMessageKey', () => {
    it('calls showMessage with translated text', () => {
        const app = createMockApp();
        const ctrl = new GameController(app);
        ctrl.showMessageKey('testKey', { count: 2 }, 'success');
        expect(showMessage).toHaveBeenCalledWith(app.dom, 'testKey:{"count":2}', 'success');
    });
});
