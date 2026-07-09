/**
 * Othello (Reversi) rules engine.
 * 8x8 board, discs with black/white sides, flip captured discs.
 * @module games/othello/rules
 */

export const BOARD_SIZE = 8;
const DIRECTIONS = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];

/**
 * Create the standard Othello starting position.
 * @returns {Array<Array<'black'|'white'|null>>}
 */
export function createInitialBoard() {
    const board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
    const mid = BOARD_SIZE / 2;
    board[mid - 1][mid - 1] = "white";
    board[mid - 1][mid] = "black";
    board[mid][mid - 1] = "black";
    board[mid][mid] = "white";
    return board;
}

/**
 * Check if coordinates are inside the board.
 */
function isInside(row, col) {
    return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

/**
 * Get discs that would be flipped if `color` plays at (row, col).
 * @returns {Array<{row: number, col: number}>} discs to flip, empty array if move is illegal
 */
export function getFlips(board, row, col, color) {
    if (board[row][col] !== null) return [];
    const opponent = color === "black" ? "white" : "black";
    const allFlips = [];

    for (const [dr, dc] of DIRECTIONS) {
        const flips = [];
        let r = row + dr;
        let c = col + dc;

        while (isInside(r, c) && board[r][c] === opponent) {
            flips.push({ row: r, col: c });
            r += dr;
            c += dc;
        }

        if (flips.length > 0 && isInside(r, c) && board[r][c] === color) {
            allFlips.push(...flips);
        }
    }

    return allFlips;
}

/**
 * Count discs that would be flipped if `color` plays at (row, col).
 * Lightweight version of getFlips that avoids array allocation —
 * used for move ordering heuristics where only the count matters.
 * @returns {number} number of discs that would flip, 0 if move is illegal
 */
export function getFlipCount(board, row, col, color) {
    if (board[row][col] !== null) return 0;
    const opponent = color === "black" ? "white" : "black";
    let total = 0;

    for (const [dr, dc] of DIRECTIONS) {
        let count = 0;
        let r = row + dr;
        let c = col + dc;

        while (isInside(r, c) && board[r][c] === opponent) {
            count++;
            r += dr;
            c += dc;
        }

        if (count > 0 && isInside(r, c) && board[r][c] === color) {
            total += count;
        }
    }

    return total;
}

/**
 * Check if a move is legal.
 */
export function isLegalMove(board, row, col, color) {
    return getFlips(board, row, col, color).length > 0;
}

/**
 * Get all legal moves for a color.
 * @returns {Array<{row: number, col: number}>}
 */
export function getLegalMoves(board, color) {
    const moves = [];
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            if (isLegalMove(board, row, col, color)) {
                moves.push({ row, col });
            }
        }
    }
    return moves;
}

/**
 * Place a disc and flip captured discs (mutates board).
 * @returns {{ flipped: Array<{row: number, col: number}>, success: boolean }}
 */
export function makeMove(board, row, col, color) {
    const flips = getFlips(board, row, col, color);
    if (flips.length === 0) return { flipped: [], success: false };

    board[row][col] = color;
    for (const f of flips) {
        board[f.row][f.col] = color;
    }

    return { flipped: flips, success: true };
}

/**
 * Count discs for each color.
 * @returns {{ black: number, white: number, empty: number }}
 */
export function countDiscs(board) {
    let black = 0;
    let white = 0;
    let empty = 0;
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            if (board[row][col] === "black") black++;
            else if (board[row][col] === "white") white++;
            else empty++;
        }
    }
    return { black, white, empty };
}

/**
 * Check if the game is over (neither side can move).
 */
export function isGameOver(board) {
    return getLegalMoves(board, "black").length === 0 && getLegalMoves(board, "white").length === 0;
}

/**
 * Get the winner based on disc count.
 * @returns {'black'|'white'|'draw'|null}
 */
export function getWinner(board) {
    const { black, white } = countDiscs(board);
    if (black > white) return "black";
    if (white > black) return "white";
    return "draw";
}

/**
 * Evaluate board position for AI (positive = good for black, negative = good for white).
 * Uses positional weights, disc count, and mobility.
 *
 * Strategy rationale:
 * - Positional weights reward corners (stable) and punish C-squares
 *   (easy for opponent to attack).
 * - Disc count provides a material baseline, weighted lightly so
 *   positional play dominates early.
 * - Mobility (number of legal moves) reflects flexibility: more moves
 *   means the AI can choose optimally while constraining the opponent.
 */
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

export function evaluateBoard(board) {
    let score = 0;
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            if (board[row][col] === "black") {
                score += POSITION_WEIGHTS[row][col];
            } else if (board[row][col] === "white") {
                score -= POSITION_WEIGHTS[row][col];
            }
        }
    }
    const { black, white } = countDiscs(board);
    score += (black - white) * 2;

    // Mobility: players with more legal moves can dictate the game.
    // The heuristic favours positions where the AI has many options
    // while the opponent has few.
    score += (getLegalMoves(board, "black").length - getLegalMoves(board, "white").length) * 10;

    return score;
}

/**
 * Get the opponent color.
 */
export function getOpponent(color) {
    return color === "black" ? "white" : "black";
}
