/**
 * Shogi game state.
 * @module games/shogi/state
 */

import { createInitialBoard, BOARD_SIZE } from "./rules.js";

export const DEFAULT_SHOGI_OPTIONS = Object.freeze({
    mode: "pvp",
    level: "medium",
    playerColor: "sente"
});

export function createShogiOptions(overrides = {}) {
    return { ...DEFAULT_SHOGI_OPTIONS, ...overrides };
}

export function createShogiState(options = {}) {
    return {
        options: createShogiOptions(options),
        board: createInitialBoard(),
        turn: "sente",
        hands: { sente: [], gote: [] },
        moveHistory: [],
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
