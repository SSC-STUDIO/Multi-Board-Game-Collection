/**
 * 国际象棋游戏状态。
 *
 * @module games/chess/state
 */

import { createInitialBoard } from './rules.js';

export const DEFAULT_CHESS_OPTIONS = Object.freeze({
    mode: 'pvp',               // 'pvp' | 'pve'
    level: 'medium',           // 'easy' | 'medium' | 'hard'
    playerColor: 'w'
});

/**
 * @typedef {Object} ChessOptions
 * @property {'pvp'|'pve'} mode
 * @property {'easy'|'medium'|'hard'} level
 * @property {'w'|'b'} playerColor
 */

/**
 * @typedef {Object} ChessState
 * @property {ChessOptions} options
 * @property {Array<Array<string|null>>} board - row 0 = 黑底线（第 8 行）
 * @property {'w'|'b'} turn
 * @property {{ wK:boolean, wQ:boolean, bK:boolean, bQ:boolean }} castlingRights
 * @property {[number, number]|null} enPassantTarget
 * @property {number} halfmoveClock - 用于 50 步和棋
 * @property {number} fullmoveNumber
 * @property {Array} moveHistory
 * @property {{ type:'checkmate'|'stalemate'|'draw'|'resign', winner:'w'|'b'|null, reason?:string }|null} result
 * @property {boolean} gameOver
 * @property {boolean} aiThinking
 */

export function createChessOptions(overrides = {}) {
    return { ...DEFAULT_CHESS_OPTIONS, ...overrides };
}

/**
 * 创建一局新国际象棋状态。
 * @param {Partial<ChessOptions>} [options]
 * @returns {ChessState}
 */
export function createChessState(options = {}) {
    return {
        options: createChessOptions(options),
        board: createInitialBoard(),
        turn: 'w',
        castlingRights: { wK: true, wQ: true, bK: true, bQ: true },
        enPassantTarget: null,
        halfmoveClock: 0,
        fullmoveNumber: 1,
        moveHistory: [],
        result: null,
        gameOver: false,
        aiThinking: false,
        coachSuggestion: null,
        coachAlternatives: [],
        coachSource: 'local',
        coachLlmStatus: 'unavailable',
        coachInsight: '',
        coachRisk: '',
        coachPlan: '',
        coachConfidence: null,
        coachFocus: null,
        coachPreviewMode: false,
        coachPreviewBoard: null,
        coachAnalyzedBoard: null,
        coachFeedback: '',
        coachPostGame: null,
        coachPostGameData: null,    };
}
