/**
 * 翻翻棋状态。
 * @module games/junqi/flip/state
 */

import { createInitialBoard } from './rules.js';

export const DEFAULT_FLIP_OPTIONS = Object.freeze({
    mode: 'pvp',       // pvp | pve
    level: 'medium',
    playerColor: null, // 翻翻棋颜色不是玩家选择的——由首翻决定
    seed: null         // 可选随机种子（调试用，此 MVP 未实现确定性 rng）
});

export function createFlipOptions(overrides = {}) {
    return { ...DEFAULT_FLIP_OPTIONS, ...overrides };
}

/**
 * @typedef {Object} FlipState
 * @property {import('./state.js').FlipOptions} options
 * @property {Array<Array<import('./rules.js').Piece|null>>} board
 * @property {'r'|'b'|null} turn - null 表示首翻未决定
 * @property {{ r: 'p1'|'p2'|null, b: 'p1'|'p2'|null }} players - 哪个玩家执红/黑，由首翻确定
 * @property {'p1'|'p2'} firstPlayer - 谁先翻（默认 p1 = 玩家）
 * @property {boolean} gameOver
 * @property {{ winner:'r'|'b', reason:'annihilation'|'stalemate'|'resign' }|null} result
 * @property {boolean} aiThinking
 * @property {Array} moveHistory
 * @property {{color:string,rank:string}|null} lastCaptured
 */

export function createFlipState(options = {}) {
    const merged = createFlipOptions(options);
    return {
        options: merged,
        board: createInitialBoard(),
        turn: null,
        players: { r: null, b: null },
        firstPlayer: 'p1',
        gameOver: false,
        result: null,
        aiThinking: false,
        moveHistory: [],
        lastCaptured: null
    };
}
