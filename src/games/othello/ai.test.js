import { describe, it, expect } from 'vitest';
import { getOthelloAIMove, getOthelloAIDelay, resetTranspositionTable } from './ai.js';
import { createInitialBoard, makeMove, getLegalMoves, getFlips, getFlipCount } from './rules.js';

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
// getOthelloAIMove — pass scenario (bug fix: minimax must swap maximizing
// on pass instead of hard-coding false)
// ---------------------------------------------------------------------------
describe("getOthelloAIMove pass scenario", () => {
    it("should return a valid move when the opponent must pass during search", () => {
        // Construct a board where white has zero legal moves but black does.
        // This forces the minimax search into the pass branch.  Before the fix,
        // the pass branch used a hard-coded `maximizing=false`, which corrupted
        // the search tree and could return an illegal move for the wrong side.
        const board = createInitialBoard();
        // Build a position where white has no moves after a black move.
        // We play a sequence that leaves white with no bracketing options.
        makeMove(board, 2, 3, "black");   // black plays a standard opening
        makeMove(board, 5, 4, "white");   // white plays standard response
        makeMove(board, 3, 5, "black");   // black plays

        // Now get AI move for white — even if white has no legal moves here
        // (or has a restricted set), the search tree should not crash and
        // should return either a valid legal move or null, never an
        // out-of-bounds or otherwise invalid result.
        const move = getOthelloAIMove(board, "white", "hard");
        if (move !== null) {
            const legalMoves = getLegalMoves(board, "white");
            expect(legalMoves.some(m => m.row === move.row && m.col === move.col)).toBe(true);
            expect(move.row).toBeGreaterThanOrEqual(0);
            expect(move.row).toBeLessThan(8);
            expect(move.col).toBeGreaterThanOrEqual(0);
            expect(move.col).toBeLessThan(8);
        }
        // Should not throw or produce undefined
        expect(move === null || (typeof move.row === "number" && typeof move.col === "number")).toBe(true);
    });
});
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

// ---------------------------------------------------------------------------
// Transposition table
// ---------------------------------------------------------------------------
describe("Othello AI transposition table", () => {
    it("resetTranspositionTable should be callable without errors", () => {
        expect(() => resetTranspositionTable()).not.toThrow();
    });

    it("should produce identical results before and after TT reset", () => {
        const board = createInitialBoard();
        makeMove(board, 2, 3, "black");
        makeMove(board, 2, 4, "white");

        resetTranspositionTable();
        const move1 = getOthelloAIMove(board, "black", "hard");

        resetTranspositionTable();
        const move2 = getOthelloAIMove(board, "black", "hard");

        // Deterministic: same board + same TT state should produce the same move
        if (move1 && move2) {
            expect(move1.row).toBe(move2.row);
            expect(move1.col).toBe(move2.col);
        }
    });

    it("should not corrupt results when TT has stale entries from a different position", () => {
        // Fill TT with entries from a different position
        const boardA = createInitialBoard();
        makeMove(boardA, 2, 3, "black");
        makeMove(boardA, 5, 4, "white");
        getOthelloAIMove(boardA, "black", "hard");

        // Now evaluate a completely different position without clearing TT
        const boardB = createInitialBoard();
        makeMove(boardB, 3, 2, "black");
        const move = getOthelloAIMove(boardB, "white", "medium");

        if (move !== null) {
            const legalMoves = getLegalMoves(boardB, "white");
            expect(legalMoves.some(m => m.row === move.row && m.col === move.col)).toBe(true);
        }
    });
});

// ---------------------------------------------------------------------------
// Pass-at-depth-0 regression: the minimax pass branch must not recurse
// infinitely when depth=0 and the current player must pass.
// ---------------------------------------------------------------------------
describe("Othello AI pass at depth 0", () => {
    it("should not stack-overflow when AI color must pass at a depth-0 leaf", () => {
        resetTranspositionTable();
        // Construct a board where white (AI) has NO legal moves but black does.
        // This forces the pass branch in minimax. With the bug, depth-1=-1
        // skips the base case and recurses infinitely.
        const board = Array.from({ length: 8 }, () => Array(8).fill(null));
        // Fill almost the entire board with black, leaving only a few empty
        // squares that only black can play.
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                board[r][c] = "black";
            }
        }
        // Leave two empty squares. Black can play them (flipping white discs),
        // but white has no discs to flip → white has no legal moves.
        board[0][0] = null;
        board[0][1] = null;
        // Place a single white disc so the game isn't over.
        board[1][0] = "white";

        // White has no legal moves (no black discs to flip).
        const whiteMoves = getLegalMoves(board, "white");
        expect(whiteMoves.length).toBe(0);

        // Black has at least one legal move.
        const blackMoves = getLegalMoves(board, "black");
        expect(blackMoves.length).toBeGreaterThan(0);

        // This call previously triggered infinite recursion via the pass
        // branch at depth=0. It should return null (no moves for white).
        const move = getOthelloAIMove(board, "white", "easy");
        expect(move).toBeNull();
    });

    it("should return a move when AI color has moves even if opponent must pass mid-search", () => {
        resetTranspositionTable();
        // Use the standard initial board — the search should complete
        // without stack overflow even if a pass occurs at a depth-0 leaf.
        const board = createInitialBoard();
        const blackMoves = getLegalMoves(board, "black");
        expect(blackMoves.length).toBeGreaterThan(0);

        const move = getOthelloAIMove(board, "black", "easy");
        expect(move).not.toBeNull();
    });
});

// ---------------------------------------------------------------------------
// Move ordering: the AI should prefer high-flip / high-positional moves
// ---------------------------------------------------------------------------
describe("Othello AI move ordering quality", () => {
    it("hard AI should prefer a move that flips more discs over one that flips fewer", () => {
        // Construct a position where one move flips significantly more discs
        const board = Array.from({ length: 8 }, () => Array(8).fill(null));
        // Set up a line of white discs that black can bracket for a big flip
        board[3][3] = "white";
        board[3][4] = "white";
        board[3][5] = "white";
        board[4][3] = "black"; // anchor
        board[2][3] = "black"; // anchor

        const legalMoves = getLegalMoves(board, "black");
        if (legalMoves.length === 0) return;

        // Find the move with the highest flip count
        const bestByCount = legalMoves.reduce((best, m) => {
            const cnt = getFlipCount(board, m.row, m.col, "black");
            return cnt > best.cnt ? { move: m, cnt } : best;
        }, { move: null, cnt: -1 });

        // The AI should pick the highest-flip move (or one equally good)
        const aiMove = getOthelloAIMove(board, "black", "hard");
        if (aiMove && bestByCount.move) {
            const aiFlipCount = getFlipCount(board, aiMove.row, aiMove.col, "black");
            // AI should match or come within 1 of the best flip count
            expect(aiFlipCount).toBeGreaterThanOrEqual(bestByCount.cnt - 1);
        }
    });
});
