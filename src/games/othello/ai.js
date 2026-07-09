/**
 * Othello AI engine with minimax + alpha-beta pruning,
 * move ordering, and transposition table.
 *
 * Improvements over previous version:
 * - Move ordering: sort candidates by flip count + positional weight
 *   before search, dramatically improving alpha-beta cutoff rates.
 * - Transposition table: cache evaluated positions to avoid redundant
 *   re-evaluation of identical board states (same pattern as Chess/Xiangqi).
 *
 * @module games/othello/ai
 */

import {
    getLegalMoves,
    getFlipCount,
    makeMove,
    getOpponent,
    evaluateBoard,
    countDiscs,
    isGameOver,
    BOARD_SIZE
} from "./rules.js";

/** Get AI delay based on difficulty. */
export function getOthelloAIDelay(level) {
    switch (level) {
        case "easy": return 300;
        case "hard": return 800;
        default: return 500;
    }
}

// ---------------------------------------------------------------------------
// Move ordering
// ---------------------------------------------------------------------------

const POSITION_WEIGHTS = [
    [120, -20,  20,   5,   5,  20, -20, 120],
    [-20, -40,  -5,  -5,  -5,  -5, -40, -20],
    [ 20,  -5,  15,   3,   3,  15,  -5,  20],
    [  5,  -5,   3,   3,   3,   3,  -5,   5],
    [  5,  -5,   3,   3,   3,   3,  -5,   5],
    [ 20,  -5,  15,   3,   3,  15,  -5,  20],
    [-20, -40,  -5,  -5,  -5,  -5, -40, -20],
    [120, -20,  20,   5,   5,  20, -20, 120]
];

/**
 * Quick heuristic score for move ordering (not the full evaluation).
 * Higher = should be searched first for better alpha-beta cutoffs.
 * @param {Array} board
 * @param {{row: number, col: number}} move
 * @param {'black'|'white'} color
 * @returns {number}
 */
function moveOrderScore(board, move, color) {
    return getFlipCount(board, move.row, move.col, color)
        + POSITION_WEIGHTS[move.row][move.col] * 0.1;
}

/**
 * Sort moves so the strongest candidates come first.
 * @param {Array} board
 * @param {Array<{row: number, col: number}>} moves
 * @param {'black'|'white'} color
 * @returns {Array<{row: number, col: number}>}
 */
function orderMoves(board, moves, color) {
    return moves
        .map(m => ({ m, score: moveOrderScore(board, m, color) }))
        .sort((a, b) => b.score - a.score)
        .map(x => x.m);
}

// ---------------------------------------------------------------------------
// Transposition table
// ---------------------------------------------------------------------------

const TT_SIZE = 1 << 16; // 64K entries
const ttExact = 0, ttLower = 1, ttUpper = 2;
let transpositionTable = new Map();

function boardHash(board) {
    let h = 0;
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const p = board[r][c];
            if (p) {
                const code = (p === "black" ? 1 : 2);
                h = (h * 31 + code + r * BOARD_SIZE + c) | 0;
            }
        }
    }
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

function ttStore(hash, depth, score, flag) {
    if (transpositionTable.size >= TT_SIZE) {
        // Simple eviction: clear half the table
        let count = 0;
        for (const key of transpositionTable.keys()) {
            if (count++ % 2 === 0) transpositionTable.delete(key);
        }
    }
    transpositionTable.set(hash, { depth, score, flag });
}

/** Clear the transposition table (call between games). */
export function resetTranspositionTable() { transpositionTable.clear(); }

// ---------------------------------------------------------------------------
// Minimax with alpha-beta pruning + move ordering + TT
// ---------------------------------------------------------------------------

function minimax(board, depth, alpha, beta, maximizing, aiColor) {
    const currentColor = maximizing ? aiColor : getOpponent(aiColor);

    // Transposition table probe
    const hash = boardHash(board);
    const ttEntry = ttLookup(hash, depth, alpha, beta);
    if (ttEntry !== null) {
        return { score: ttEntry, move: null };
    }

    const moves = getLegalMoves(board, currentColor);

    if (depth === 0 || moves.length === 0) {
        if (moves.length === 0) {
            // Try opponent
            const opponent = getOpponent(currentColor);
            const opponentMoves = getLegalMoves(board, opponent);
            if (opponentMoves.length === 0 || isGameOver(board)) {
                const { black, white } = countDiscs(board);
                const score = black - white;
                const finalScore = aiColor === "black" ? score : -score;
                // Store exact result in TT
                ttStore(hash, depth, finalScore, ttExact);
                return { score: finalScore, move: null };
            }
            // Pass turn: swap the optimizing role — the opponent now moves.
            // Previously this passed a hard-coded `false`, which corrupted the
            // search when the AI's own color had to pass (it kept evaluating
            // from the wrong perspective and never alternated correctly).
            const result = minimax(board, depth - 1, alpha, beta, !maximizing, aiColor);
            ttStore(hash, depth, result.score, ttExact);
            return { score: result.score, move: null };
        }
        const score = evaluateBoard(board) * (aiColor === "black" ? 1 : -1);
        ttStore(hash, depth, score, ttExact);
        return { score, move: null };
    }

    // Move ordering: sort candidates for better pruning
    const ordered = orderMoves(board, moves, currentColor);

    let bestMove = ordered[0];
    let bestScore = maximizing ? -Infinity : Infinity;

    for (const move of ordered) {
        const copy = board.map(row => [...row]);
        makeMove(copy, move.row, move.col, currentColor);

        const result = minimax(copy, depth - 1, alpha, beta, !maximizing, aiColor);

        if (maximizing) {
            if (result.score > bestScore) {
                bestScore = result.score;
                bestMove = move;
            }
            alpha = Math.max(alpha, bestScore);
        } else {
            if (result.score < bestScore) {
                bestScore = result.score;
                bestMove = move;
            }
            beta = Math.min(beta, bestScore);
        }

        if (beta <= alpha) break;
    }

    // Store result in transposition table
    const flag = bestScore <= alpha ? ttUpper : bestScore >= beta ? ttLower : ttExact;
    ttStore(hash, depth, bestScore, flag);

    return { score: bestScore, move: bestMove };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Get the best move for the AI. */
export function getOthelloAIMove(board, aiColor, level = "medium") {
    const moves = getLegalMoves(board, aiColor);
    if (moves.length === 0) return null;

    let depth;
    switch (level) {
        case "easy": depth = 1; break;
        case "hard": depth = 4; break;
        default: depth = 2;
    }

    // Adjust depth based on game phase
    const { empty } = countDiscs(board);
    if (empty < 10) depth = Math.max(depth, 6);
    else if (empty < 20) depth = Math.max(depth, 3);

    const { move } = minimax(board, depth, -Infinity, Infinity, true, aiColor);
    return move || moves[0];
}
