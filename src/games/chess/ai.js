/**
 * 国际象棋 AI：alpha-beta 极小化极大搜索 + 子力 & piece-square table 静态评估。
 *
 * - easy：depth 1（只看一层，基本看子力），搜索结果随机打散
 * - medium：depth 3（开局中盘防蓝废走），随机微调限于分差 ≤ 30 的候选
 * - hard：depth 5（更准，但仍限于 MVP 等级）
 *
 * 评分以"白方视角"为正：白优 > 0，黑优 < 0。
 * 搜索时按当前 turn 决定极大/极小方向。
 *
 * @module games/chess/ai
 */

import {
    applyMove,
    getLegalMoves,
    isCheckmate,
    isStalemate,
    isInsufficientMaterial,
    isFiftyMoveDraw,
    oppositeColor
} from './rules.js';

const AI_DELAY_BY_LEVEL = { easy: 280, medium: 520, hard: 900 };
export function getChessAIDelay(level) {
    return AI_DELAY_BY_LEVEL[level] ?? AI_DELAY_BY_LEVEL.medium;
}

const PIECE_VALUES = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20000 };

// Killer move heuristic: store best non-capture moves per depth
const MAX_KILLERS = 2;
const MAX_DEPTH = 8;
let killerMoves = Array.from({ length: MAX_DEPTH }, () => []);

function storeKiller(move, depth) {
    if (depth < 0 || depth >= MAX_DEPTH) return;
    const killers = killerMoves[depth];
    if (killers.some(k => k.from[0] === move.from[0] && k.from[1] === move.from[1]
        && k.to[0] === move.to[0] && k.to[1] === move.to[1])) return;
    killers.unshift(move);
    if (killers.length > MAX_KILLERS) killers.pop();
}


// Transposition table for caching evaluated positions
const TT_SIZE = 1 << 16; // 64K entries
const ttExact = 0, ttLower = 1, ttUpper = 2;
let transpositionTable = new Map();

function boardHash(board, state) {
    let h = 0;
    const turnBit = state.turn === "w" ? 1 : 0;
    h = (h * 31 + turnBit) | 0;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const p = board[r][c];
            if (p) {
                const code = p.charCodeAt(0) * 100 + p.charCodeAt(1);
                h = (h * 31 + code + r * 8 + c) | 0;
            }
        }
    }
    // Castling rights: 4 bits packed into one integer
    const cr = state.castlingRights || {};
    let castleBits = 0;
    if (cr.wK) castleBits |= 1;
    if (cr.wQ) castleBits |= 2;
    if (cr.bK) castleBits |= 4;
    if (cr.bQ) castleBits |= 8;
    h = (h * 31 + castleBits) | 0;
    // En passant target square (or -1 if none)
    const ep = state.enPassantTarget;
    const epSq = ep ? ep[0] * 8 + ep[1] : -1;
    h = (h * 31 + epSq) | 0;
    // Halfmove clock (50-move rule)
    h = (h * 31 + (state.halfmoveClock || 0)) | 0;
    return h;
}

function ttLookup(hash, depth, alpha, beta) {
    const entry = transpositionTable.get(hash);
    if (!entry || entry.depth < depth) return null;
    if (entry.flag === ttExact) return entry.score;
    if (entry.flag === ttLower && entry.score >= beta) return entry.score;
    if (entry.flag === ttUpper && entry.score <= alpha) return entry.score;
    return null;
}

function ttStore(hash, depth, score, flag, move) {
    if (transpositionTable.size >= TT_SIZE) {
        // Simple eviction: clear half the table
        let count = 0;
        for (const key of transpositionTable.keys()) {
            if (count++ % 2 === 0) transpositionTable.delete(key);
        }
    }
    transpositionTable.set(hash, { depth, score, flag, move });
}


// piece-square tables（从白方视角；黑方镜像）
const PST_P = [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [50, 50, 50, 50, 50, 50, 50, 50],
    [10, 10, 20, 30, 30, 20, 10, 10],
    [5, 5, 10, 25, 25, 10, 5, 5],
    [0, 0, 0, 20, 20, 0, 0, 0],
    [5, -5, -10, 0, 0, -10, -5, 5],
    [5, 10, 10, -20, -20, 10, 10, 5],
    [0, 0, 0, 0, 0, 0, 0, 0]
];
const PST_N = [
    [-50, -40, -30, -30, -30, -30, -40, -50],
    [-40, -20, 0, 0, 0, 0, -20, -40],
    [-30, 0, 10, 15, 15, 10, 0, -30],
    [-30, 5, 15, 20, 20, 15, 5, -30],
    [-30, 0, 15, 20, 20, 15, 0, -30],
    [-30, 5, 10, 15, 15, 10, 5, -30],
    [-40, -20, 0, 5, 5, 0, -20, -40],
    [-50, -40, -30, -30, -30, -30, -40, -50]
];
const PST_B = [
    [-20, -10, -10, -10, -10, -10, -10, -20],
    [-10, 0, 0, 0, 0, 0, 0, -10],
    [-10, 0, 5, 10, 10, 5, 0, -10],
    [-10, 5, 5, 10, 10, 5, 5, -10],
    [-10, 0, 10, 10, 10, 10, 0, -10],
    [-10, 10, 10, 10, 10, 10, 10, -10],
    [-10, 5, 0, 0, 0, 0, 5, -10],
    [-20, -10, -10, -10, -10, -10, -10, -20]
];
const PST_R = [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [5, 10, 10, 10, 10, 10, 10, 5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [0, 0, 0, 5, 5, 0, 0, 0]
];
const PST_Q = [
    [-20, -10, -10, -5, -5, -10, -10, -20],
    [-10, 0, 0, 0, 0, 0, 0, -10],
    [-10, 0, 5, 5, 5, 5, 0, -10],
    [-5, 0, 5, 5, 5, 5, 0, -5],
    [0, 0, 5, 5, 5, 5, 0, -5],
    [-10, 5, 5, 5, 5, 5, 0, -10],
    [-10, 0, 5, 0, 0, 0, 0, -10],
    [-20, -10, -10, -5, -5, -10, -10, -20]
];
const PST_K = [
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-20, -30, -30, -40, -40, -30, -30, -20],
    [-10, -20, -20, -20, -20, -20, -20, -10],
    [20, 20, 0, 0, 0, 0, 20, 20],
    [20, 30, 10, 0, 0, 10, 30, 20]
];

const PST = { P: PST_P, N: PST_N, B: PST_B, R: PST_R, Q: PST_Q, K: PST_K };

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
 * 静态评估：白方视角（白优 > 0）。
 */
export function evaluate(board) {
    let score = 0;
    for (let r = 0; r < 8; r += 1) {
        for (let c = 0; c < 8; c += 1) {
            const p = board[r][c];
            if (!p) continue;
            const [color, type] = [p[0], p[1]];
            const sign = color === 'w' ? 1 : -1;
            const pst = PST[type];
            // 黑方读表时做上下翻转
            const pstValue = color === 'w' ? pst[r][c] : pst[7 - r][c];
            score += sign * (PIECE_VALUES[type] + pstValue);
        }
    }
    return score;
}

/**
 * 走法排序：先看吃子（MVV-LVA）、升变、王车易位，有助于 alpha-beta 剪枝效率。
 */
function orderMoves(moves, depth = 0) {
    const killers = (depth >= 0 && depth < MAX_DEPTH) ? killerMoves[depth] : [];
    return moves
        .map((mv) => {
            let score = 0;
            if (mv.capture) {
                const vic = PIECE_VALUES[mv.capture[1]] || 0;
                const agr = PIECE_VALUES[mv.piece[1]] || 0;
                score += 1000 + 10 * vic - agr;
            } else {
                for (let k = 0; k < killers.length; k++) {
                    if (killers[k].from[0] === mv.from[0] && killers[k].from[1] === mv.from[1]
                        && killers[k].to[0] === mv.to[0] && killers[k].to[1] === mv.to[1]) {
                        score += 500 - k * 10;
                        break;
                    }
                }
            }
            if (mv.promotion) score += 900;
            if (mv.castle) score += 50;
            return { mv, score };
        })
        .sort((a, b) => b.score - a.score)
        .map((x) => x.mv);
}

/**
 * alpha-beta 搜索。返回 { score, move }。
 */
function search(board, state, depth, alpha, beta) {
    const hash = boardHash(board, state);
    const ttEntry = ttLookup(hash, depth, alpha, beta);
    if (ttEntry !== null) return { score: ttEntry, move: null };

    if (isCheckmate(board, state)) {
        // 被将死：当前执方失败，返回极大劣势（白被将死 → -inf，黑被将死 → +inf）
        return { score: state.turn === 'w' ? -99_999 : 99_999, move: null };
    }
    if (isStalemate(board, state) || isInsufficientMaterial(board) || isFiftyMoveDraw(state)) {
        return { score: 0, move: null };
    }
    if (depth === 0) {
        return { score: evaluate(board), move: null };
    }

    const moves = orderMoves(getLegalMoves(board, state), depth);
    if (moves.length === 0) {
        return { score: evaluate(board), move: null };
    }

    let bestMove = null;
    if (state.turn === 'w') {
        const alphaOrig = alpha;
        let value = -Infinity;
        for (const mv of moves) {
            const { board: b2, state: s2 } = applyMove(board, state, mv);
            const { score } = search(b2, s2, depth - 1, alpha, beta);
            if (score > value) {
                value = score;
                bestMove = mv;
            }
            alpha = Math.max(alpha, value);
            if (alpha >= beta) {
                if (!mv.capture) storeKiller(mv, depth);
                break;
            }
        }
        const flag = value <= alphaOrig ? ttUpper : value >= beta ? ttLower : ttExact;
        ttStore(hash, depth, value, flag, bestMove);
        return { score: value, move: bestMove };
    }
    // 黑方为最小化方
    const betaOrig = beta;
    let value = Infinity;
    for (const mv of moves) {
        const { board: b2, state: s2 } = applyMove(board, state, mv);
        const { score } = search(b2, s2, depth - 1, alpha, beta);
        if (score < value) {
            value = score;
            bestMove = mv;
        }
        beta = Math.min(beta, value);
        if (alpha >= beta) {
            if (!mv.capture) storeKiller(mv, depth);
            break;
        }
    }
    const flag = value >= betaOrig ? ttLower : value <= alpha ? ttUpper : ttExact;
    ttStore(hash, depth, value, flag, bestMove);
    return { score: value, move: bestMove };
}

/**
 * 根据难度选择搜索深度。
 */
function depthForLevel(level) {
    if (level === 'easy') return 1;
    if (level === 'hard') return 5;
    return 3;
}

/**
 * 根据当前棋局返回 AI 最佳走法。若无合法走法返回 null。
 * @param {import('./state.js').ChessState} state
 * @returns {Object|null}
 */
export function getChessAIMove(state) {
    const legal = getLegalMoves(state.board, state);
    if (legal.length === 0) return null;

    // 快速将杀检测（mate-in-1）：如果某步走法后对方被将死，立即返回
    // 避免 depth 4 搜索在空棋盘+后局面下超时
    for (const mv of legal) {
        const { board: b2, state: s2 } = applyMove(state.board, state, mv);
        if (isCheckmate(b2, s2)) return mv;
    }

    const depth = depthForLevel(state.options?.level);
    const { move } = search(state.board, state, depth, -Infinity, Infinity);
    if (move) return move;

    // 理论上应总能找到一步；保险：挑分数最优的合法走法。
    const scored = legal.map((mv) => {
        const { board: b2 } = applyMove(state.board, state, mv);
        return { mv, score: evaluate(b2) };
    });
    scored.sort((a, b) => (state.turn === 'w' ? b.score - a.score : a.score - b.score));
    // easy：前 6 里随机
    if (state.options?.level === 'easy') {
        const pool = scored.slice(0, Math.min(6, scored.length));
        return pool[Math.floor(randomFraction() * pool.length)].mv;
    }
    return scored[0].mv;
}

export { oppositeColor };

export function resetTranspositionTable() { transpositionTable.clear(); }
