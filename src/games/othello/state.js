/**
 * Othello game state.
 * @module games/othello/state
 */

import { createInitialBoard, BOARD_SIZE } from "./rules.js";

export const DEFAULT_OTHELLO_OPTIONS = Object.freeze({
    mode: "pvp",
    level: "medium",
    playerColor: "black"
});

export function createOthelloOptions(overrides = {}) {
    return { ...DEFAULT_OTHELLO_OPTIONS, ...overrides };
}

export function createOthelloState(options = {}) {
    return {
        options: createOthelloOptions(options),
        board: createInitialBoard(),
        currentPlayer: "black",
        moveHistory: [],
        passCount: 0,
        result: null,
        gameOver: false,
        aiThinking: false,
        coachSuggestion: null,
        coachAlternatives: [],
        coachSource: "local",
        coachLlmStatus: "idle",
        coachInsight: "",
        coachRisk: "",
        coachPlan: "",
        coachConfidence: null,
        coachFeedback: "",
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
        commentary: ""
    };
}
