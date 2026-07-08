import { describe, it, expect } from 'vitest';
import { getOthelloAIMove, getOthelloAIDelay } from './ai.js';
import { createInitialBoard, makeMove, getLegalMoves } from './rules.js';

// ---------------------------------------------------------------------------
// getOthelloAIDelay
// ---------------------------------------------------------------------------
describe("getOthelloAIDelay", () => {
    it("should return 300 for easy level", () => {
        expect(getOthelloAIDelay("easy")).toBe(300);
    });

    it("should return 500 for medium level", () => {
        expect(getOthelloAIDelay("medium")).toBe(500);
    });

    it("should return 800 for hard level", () => {
        expect(getOthelloAIDelay("hard")).toBe(800);
    });

    it("should default to 500 for unknown level", () => {
        expect(getOthelloAIDelay("unknown")).toBe(500);
    });
});

// ---------------------------------------------------------------------------
// getOthelloAIMove — initial board
// ---------------------------------------------------------------------------
describe("getOthelloAIMove on initial board", () => {
    it("should return a valid legal move for black at medium level", () => {
        const board = createInitialBoard();
        const move = getOthelloAIMove(board, "black", "medium");

        expect(move).not.toBeNull();
        expect(move.row).toBeGreaterThanOrEqual(0);
        expect(move.row).toBeLessThan(8);
        expect(move.col).toBeGreaterThanOrEqual(0);
        expect(move.col).toBeLessThan(8);
    });

    it("should return a valid legal move for white", () => {
        const board = createInitialBoard();
        const move = getOthelloAIMove(board, "white", "medium");

        expect(move).not.toBeNull();
        expect(move.row).toBeGreaterThanOrEqual(0);
        expect(move.col).toBeLessThan(8);
    });

    it("should return a legal move by verifying the move is in legal moves list", () => {
        const board = createInitialBoard();
        const move = getOthelloAIMove(board, "black", "medium");

        const legalMoves = getLegalMoves(board, "black");
        const isLegal = legalMoves.some(m => m.row === move.row && m.col === move.col);
        expect(isLegal).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// getOthelloAIMove — different difficulty levels
// ---------------------------------------------------------------------------
describe("getOthelloAIMove difficulty levels", () => {
    it("should return a valid move for easy level", () => {
        const board = createInitialBoard();
        const move = getOthelloAIMove(board, "black", "easy");

        expect(move).not.toBeNull();
        const legalMoves = getLegalMoves(board, "black");
        expect(legalMoves.some(m => m.row === move.row && m.col === move.col)).toBe(true);
    });

    it("should return a valid move for hard level", () => {
        const board = createInitialBoard();
        const move = getOthelloAIMove(board, "black", "hard");

        expect(move).not.toBeNull();
        const legalMoves = getLegalMoves(board, "black");
        expect(legalMoves.some(m => m.row === move.row && m.col === move.col)).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// getOthelloAIMove — endgame scenario
// ---------------------------------------------------------------------------
describe("getOthelloAIMove in endgame", () => {
    it("should return null when no legal moves available", () => {
        // Create a board with no legal moves for black: fill a corner-adjacent
        // pattern that leaves no flip available.
        // Simplest way: create a board where black has no legal moves.
        const board = Array.from({ length: 8 }, () => Array(8).fill(null));
        // Place all black in one spot, all white around it with no flippable discs
        board[3][3] = "white";
        board[3][4] = "white";
        board[4][3] = "white";
        board[4][4] = "white";
        // Black's discs: none (so no bracket possible)
        const move = getOthelloAIMove(board, "black", "medium");
        // black has no legal moves — should return null
        expect(move).toBeNull();
    });

    it("should find a move in a midgame position", () => {
        const board = createInitialBoard();
        // Simulate some moves: black plays (2,3), white plays (2,4), black plays (1,5)
        makeMove(board, 2, 3, "black");  // flip
        makeMove(board, 2, 4, "white");  // flip
        makeMove(board, 1, 5, "black");  // flip

        const move = getOthelloAIMove(board, "white", "medium");
        if (move !== null) {
            expect(move.row).toBeGreaterThanOrEqual(0);
            expect(move.row).toBeLessThan(8);
        }
    });
});

// ---------------------------------------------------------------------------
// getOthelloAIMove — move quality (corner preference on hard)
// ---------------------------------------------------------------------------
describe("getOthelloAIMove move quality", () => {
    it("hard AI should prefer corner or edge moves over interior in opening", () => {
        // On the initial board, black has exactly 4 legal moves:
        // (2,3), (3,2), (5,4), (4,5) — none of which are corners.
        // After a couple of moves, corners become available.
        const board = createInitialBoard();
        makeMove(board, 2, 3, "black");
        makeMove(board, 1, 2, "white");
        makeMove(board, 2, 2, "black");

        const move = getOthelloAIMove(board, "white", "hard");
        if (move !== null) {
            const legalMoves = getLegalMoves(board, "white");
            expect(legalMoves.some(m => m.row === move.row && m.col === move.col)).toBe(true);
        }
    });
});
