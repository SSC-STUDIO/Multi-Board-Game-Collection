import { DEFAULT_OPTIONS } from '../config/gameConfig.js';

export function createOptions(overrides = {}) {
    return {
        ...DEFAULT_OPTIONS,
        ...overrides
    };
}

export function createEmptyBoard(size) {
    return Array.from({ length: size }, () => Array(size).fill(null));
}

export function createGameState(options) {
    return {
        options: createOptions(options),
        board: createEmptyBoard(options.size),
        currentPlayer: 'black',
        gameOver: false,
        moveHistory: [],
        lastMove: null,
        hintMove: null,
        aiThinking: false,
        coachSuggestion: null,
        coachAlternatives: [],
        coachSource: 'local',
        coachLlmStatus: 'disabled',
        coachInsight: '',
        coachRisk: '',
        coachPlan: '',
        coachConfidence: null,
        coachFocus: null,
        coachFeedback: '',
        selectedCell: null,
        awaitingPlacementConfirm: false,
        winningCells: [],
        resultSummary: null,
        resultType: null,
        resultWinnerColor: null
    };
}
