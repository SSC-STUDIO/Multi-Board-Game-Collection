import { describe, it, expect } from "vitest";
import { createInitialBoard, getFlips, isLegalMove, getLegalMoves, makeMove, countDiscs, isGameOver, getWinner, evaluateBoard, BOARD_SIZE } from "./rules.js";

describe("Othello rules", () => {
    describe("createInitialBoard", () => {
        it("should create 8x8 board", () => {
            const board = createInitialBoard();
            expect(board.length).toBe(8);
            expect(board[0].length).toBe(8);
        });

        it("should place 4 center discs", () => {
            const board = createInitialBoard();
            expect(board[3][3]).toBe("white");
            expect(board[3][4]).toBe("black");
            expect(board[4][3]).toBe("black");
            expect(board[4][4]).toBe("white");
        });

        it("should have 60 empty cells", () => {
            const board = createInitialBoard();
            const { empty } = countDiscs(board);
            expect(empty).toBe(60);
        });
    });

    describe("getFlips", () => {
        it("should find horizontal flips", () => {
            const board = createInitialBoard();
            // Place black at (2,3) to flip white at (3,3) horizontally
            const flips = getFlips(board, 2, 3, "black");
            expect(flips.some(f => f.row === 3 && f.col === 3)).toBe(true);
        });

        it("should find diagonal flips", () => {
            const board = createInitialBoard();
            // Place black at (5,4) to flip white at (4,4) vertically
            const flips = getFlips(board, 5, 4, "black");
            expect(flips.some(f => f.row === 4 && f.col === 4)).toBe(true);
        });

        it("should return empty for occupied cell", () => {
            const board = createInitialBoard();
            const flips = getFlips(board, 3, 3, "black");
            expect(flips).toEqual([]);
        });

        it("should return empty for no capture", () => {
            const board = createInitialBoard();
            const flips = getFlips(board, 0, 0, "black");
            expect(flips).toEqual([]);
        });
    });

    describe("isLegalMove", () => {
        it("should return true for valid move", () => {
            const board = createInitialBoard();
            expect(isLegalMove(board, 2, 3, "black")).toBe(true);
        });

        it("should return false for occupied cell", () => {
            const board = createInitialBoard();
            expect(isLegalMove(board, 3, 3, "black")).toBe(false);
        });

        it("should return false for no capture", () => {
            const board = createInitialBoard();
            expect(isLegalMove(board, 0, 0, "black")).toBe(false);
        });
    });

    describe("getLegalMoves", () => {
        it("should return 4 legal moves for black at start", () => {
            const board = createInitialBoard();
            const moves = getLegalMoves(board, "black");
            expect(moves.length).toBe(4);
        });
    });

    describe("makeMove", () => {
        it("should place disc and flip captures", () => {
            const board = createInitialBoard();
            const result = makeMove(board, 2, 3, "black");
            expect(result.success).toBe(true);
            expect(result.flipped.length).toBeGreaterThan(0);
            expect(board[2][3]).toBe("black");
            expect(board[3][3]).toBe("black");
        });

        it("should fail for illegal move", () => {
            const board = createInitialBoard();
            const result = makeMove(board, 0, 0, "black");
            expect(result.success).toBe(false);
            expect(board[0][0]).toBeNull();
        });
    });

    describe("countDiscs", () => {
        it("should count correctly at start", () => {
            const board = createInitialBoard();
            const { black, white } = countDiscs(board);
            expect(black).toBe(2);
            expect(white).toBe(2);
        });
    });

    describe("isGameOver", () => {
        it("should not be over at start", () => {
            const board = createInitialBoard();
            expect(isGameOver(board)).toBe(false);
        });

        it("should be over when no moves for either side", () => {
            const board = Array.from({ length: 8 }, () => Array(8).fill("black"));
            expect(isGameOver(board)).toBe(true);
        });
    });

    describe("getWinner", () => {
        it("should return black when more black discs", () => {
            const board = Array.from({ length: 8 }, () => Array(8).fill("black"));
            board[0][0] = "white";
            expect(getWinner(board)).toBe("black");
        });

        it("should return draw when equal", () => {
            const board = createInitialBoard();
            expect(getWinner(board)).toBe("draw");
        });
    });

    describe("evaluateBoard", () => {
        it("should return 0 for initial position", () => {
            const board = createInitialBoard();
            expect(evaluateBoard(board)).toBe(0);
        });

        it("should favor corner positions", () => {
            const board = createInitialBoard();
            board[0][0] = "black";
            expect(evaluateBoard(board)).toBeGreaterThan(100);
        });
    });
});
