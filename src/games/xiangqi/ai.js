/**
 * 中国象棋 AI：alpha-beta + 子力 + 简版 piece-square。
 *
 * 评分以"红方视角"为正：红优 > 0，黑优 < 0。
 *
 * 子力价值（常见开源 Xiangqi 引擎参考值）：
 *   将 K = 20000（不参与交换）
 *   车 R = 600
 *   马 N = 300
 *   炮 C = 300
 *   兵/卒 P：未过河 30，过河 70，到底 90
 *   相/象 E = 150
 *   士/仕 A = 120
 *
 * @module games/xiangqi/ai
 */

import {
    applyMove,
    getLegalMoves,
    isCheckmate,
    isStalemate,
    oppositeColor
} from './rules.js';

const AI_DELAY_BY_LEVEL = { easy: 280, medium: 520, hard: 900 };
export function getXiangqiAIDelay(level) {
    return AI_DELAY_BY_LEVEL[level] ?? AI_DELAY_BY_LEVEL.medium;
}

const BASE_VALUES = {
    K: 20000, R: 600, N: 300, C: 300, A: 120, E: 150, P: 30
};

// 红兵过河加值表（黑卒用镜像）。row=0..9
// 红兵在未过河时（row>=5）都是基础价值；过河后（row<5）逐步提升
const RED_PAWN_BONUS = [
    120, 110, 100, 80, 60,   // row 0..4（过河后）
    0, 0, 0, 0, 0            // row 5..9（未过河）
];

function pawnValue(piece, row) {
    const base = BASE_VALUES.P;
    if (piece[0] === 'r') {
        return base + RED_PAWN_BONUS[row];
    }
    // 黑卒：上下翻转
    return base + RED_PAWN_BONUS[9 - row];
}

function pieceValue(piece, row) {
    const type = piece[1];
    if (type === 'P') return pawnValue(piece, row);
    return BASE_VALUES[type] || 0;
}

/**
 * 静态评估（红正黑负）。
 */
export function evaluate(board) {
    let score = 0;
    for (let r = 0; r < 10; r += 1) {
        for (let c = 0; c < 9; c += 1) {
            const p = board[r][c];
            if (!p) continue;
            const sign = p[0] === 'r' ? 1 : -1;
            score += sign * pieceValue(p, r);
        }
    }
    return score;
}

function orderMoves(moves) {
    return moves
        .map((mv) => {
            let s = 0;
            if (mv.capture) {
                const vic = BASE_VALUES[mv.capture[1]] || 0;
                const agr = BASE_VALUES[mv.piece[1]] || 0;
                s += 10 * vic - agr;
            }
            return { mv, score: s };
        })
        .sort((a, b) => b.score - a.score)
        .map((x) => x.mv);
}

function search(board, state, depth, alpha, beta) {
    if (isCheckmate(board, state)) {
        return { score: state.turn === 'r' ? -99_999 : 99_999, move: null };
    }
    if (isStalemate(board, state)) {
        // 困毙：被困方输（中国象棋规则）
        return { score: state.turn === 'r' ? -99_999 : 99_999, move: null };
    }
    if (depth === 0) {
        return { score: evaluate(board), move: null };
    }

    const moves = orderMoves(getLegalMoves(board, state));
    if (moves.length === 0) {
        return { score: evaluate(board), move: null };
    }

    let bestMove = null;
    if (state.turn === 'r') {
        let value = -Infinity;
        for (const mv of moves) {
            const { board: b2, state: s2 } = applyMove(board, state, mv);
            const { score } = search(b2, s2, depth - 1, alpha, beta);
            if (score > value) { value = score; bestMove = mv; }
            alpha = Math.max(alpha, value);
            if (alpha >= beta) break;
        }
        return { score: value, move: bestMove };
    }
    let value = Infinity;
    for (const mv of moves) {
        const { board: b2, state: s2 } = applyMove(board, state, mv);
        const { score } = search(b2, s2, depth - 1, alpha, beta);
        if (score < value) { value = score; bestMove = mv; }
        beta = Math.min(beta, value);
        if (alpha >= beta) break;
    }
    return { score: value, move: bestMove };
}

function depthForLevel(level) {
    if (level === 'easy') return 1;
    if (level === 'hard') return 5;
    return 3;
}

function randomFraction() {
    const cr = globalThis.crypto;
    if (cr?.getRandomValues) {
        const buf = new Uint32Array(1);
        cr.getRandomValues(buf);
        return buf[0] / 0x1_0000_0000;
    }
    return Math.random();
}

/**
 * 返回 AI 走法，或 null（无合法走法）。
 */
export function getXiangqiAIMove(state) {
    const legal = getLegalMoves(state.board, state);
    if (legal.length === 0) return null;

    const depth = depthForLevel(state.options?.level);
    const { move } = search(state.board, state, depth, -Infinity, Infinity);
    if (move) return move;

    const scored = legal.map((mv) => {
        const { board: b2 } = applyMove(state.board, state, mv);
        return { mv, score: evaluate(b2) };
    });
    scored.sort((a, b) => (state.turn === 'r' ? b.score - a.score : a.score - b.score));
    if (state.options?.level === 'easy') {
        const pool = scored.slice(0, Math.min(6, scored.length));
        return pool[Math.floor(randomFraction() * pool.length)].mv;
    }
    return scored[0].mv;
}

export { oppositeColor };
