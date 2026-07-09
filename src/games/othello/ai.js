/**
 * Othello AI engine with minimax and alpha-beta pruning.
 * @module games/othello/ai
 */

import { getLegalMoves, makeMove, getOpponent, evaluateBoard, countDiscs, isGameOver, BOARD_SIZE } from "./rules.js";

/**
 * Get AI delay based on difficulty.
 */
export function getOthelloAIDelay(level) {
    switch (level) {
        case "easy": return 300;
        case "hard": return 800;
        default: return 500;
    }
}

/**
 * Minimax with alpha-beta pruning.
 */
function minimax(board, depth, alpha, beta, maximizing, aiColor) {
    const currentColor = maximizing ? aiColor : getOpponent(aiColor);
    const moves = getLegalMoves(board, currentColor);

    if (depth === 0 || moves.length === 0) {
        if (moves.length === 0) {
            // Try opponent
            const opponent = getOpponent(currentColor);
            const opponentMoves = getLegalMoves(board, opponent);
            if (opponentMoves.length === 0 || isGameOver(board)) {
                const { black, white } = countDiscs(board);
                const score = black - white;
                return { score: aiColor === "black" ? score : -score, move: null };
            }
            // Pass turn: swap the optimizing role — the opponent now moves.
            // Previously this passed a hard-coded `false`, which corrupted the
            // search when the AI's own color had to pass (it kept evaluating
            // from the wrong perspective and never alternated correctly).
            const result = minimax(board, depth - 1, alpha, beta, !maximizing, aiColor);
            return { score: result.score, move: null };
        }
        return { score: evaluateBoard(board) * (aiColor === "black" ? 1 : -1), move: null };
    }

    let bestMove = moves[0];
    let bestScore = maximizing ? -Infinity : Infinity;

    for (const move of moves) {
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

    return { score: bestScore, move: bestMove };
}

/**
 * Get the best move for the AI.
 */
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
