/**
 * 中国象棋状态。
 * @module games/xiangqi/state
 */

import { createInitialBoard } from './rules.js';

export const DEFAULT_XIANGQI_OPTIONS = Object.freeze({
    mode: 'pvp',
    level: 'medium',
    playerColor: 'r'
});

export function createXiangqiOptions(overrides = {}) {
    return { ...DEFAULT_XIANGQI_OPTIONS, ...overrides };
}

/**
 * @typedef {Object} XiangqiState
 * @property {import('./state.js').XiangqiOptions} options
 * @property {Array<Array<string|null>>} board - 10 行 × 9 列；row=0 黑底线，row=9 红底线
 * @property {'r'|'b'} turn
 * @property {number} halfmoveClock
 * @property {number} fullmoveNumber
 * @property {Array} moveHistory
 * @property {{ type:'checkmate'|'stalemate'|'resign', winner:'r'|'b'|null }|null} result
 * @property {boolean} gameOver
 * @property {boolean} aiThinking
 */

export function createXiangqiState(options = {}) {
    return {
        options: createXiangqiOptions(options),
        board: createInitialBoard(),
        turn: 'r',
        halfmoveClock: 0,
        fullmoveNumber: 1,
        moveHistory: [],
        result: null,
        gameOver: false,
        aiThinking: false
    };
}
