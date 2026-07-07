import { describe, it, expect } from "vitest";
import { createInitialBoard, getLegalMoves, makeMove, makeDrop, isInCheck, getPieceLabel, BOARD_SIZE, PIECES } from "./rules.js";

describe("Shogi rules", () => {
    describe("createInitialBoard", () => {
        it("should create 9x9 board", () => {
            const board = createInitialBoard();
            expect(board.length).toBe(9);
            expect(board[0].length).toBe(9);
        });

        it("should place sente king at (8,4)", () => {
            const board = createInitialBoard();
            expect(board[8][4]).toEqual({ type: "K", side: "sente" });
        });

        it("should place gote king at (0,4)", () => {
            const board = createInitialBoard();
            expect(board[0][4]).toEqual({ type: "K", side: "gote" });
        });

        it("should place sente pawns on row 6", () => {
            const board = createInitialBoard();
            for (let col = 0; col < 9; col++) {
                expect(board[6][col]).toEqual({ type: "P", side: "sente" });
            }
        });

        it("should place gote pawns on row 2", () => {
            const board = createInitialBoard();
            for (let col = 0; col < 9; col++) {
                expect(board[2][col]).toEqual({ type: "P", side: "gote" });
            }
        });
    });

    describe("getLegalMoves", () => {
        it("should return moves for sente pawn (forward only)", () => {
            const board = createInitialBoard();
            const moves = getLegalMoves(board, 6, 0);
            expect(moves.length).toBeGreaterThanOrEqual(1);
            expect(moves.some(m => m.row === 5 && m.col === 0)).toBe(true);
        });

        it("should not allow pawn to move backward", () => {
            const board = createInitialBoard();
            const moves = getLegalMoves(board, 6, 0);
            expect(moves.some(m => m.row === 7)).toBe(false);
        });

        it("should return empty for empty cell", () => {
            const board = createInitialBoard();
            const moves = getLegalMoves(board, 4, 4);
            expect(moves).toEqual([]);
        });

        it("should return king moves in all 8 directions", () => {
            const board = createInitialBoard();
            const moves = getLegalMoves(board, 8, 4);
            const validKingMoves = moves.filter(m => !m.promote);
            expect(validKingMoves.length).toBeGreaterThanOrEqual(3);
        });
    });

    describe("makeMove", () => {
        it("should move piece from source to destination", () => {
            const board = createInitialBoard();
            makeMove(board, 6, 0, 5, 0);
            expect(board[6][0]).toBeNull();
            expect(board[5][0]).toEqual({ type: "P", side: "sente" });
        });

        it("should capture opponent piece", () => {
            const board = createInitialBoard();
            board[5][0] = { type: "P", side: "gote" };
            const result = makeMove(board, 6, 0, 5, 0);
            expect(result.captured).toEqual({ type: "P", side: "gote" });
        });
    });

    describe("makeDrop", () => {
        it("should place piece on empty cell", () => {
            const board = createInitialBoard();
            const success = makeDrop(board, "L", "sente", 4, 4);
            expect(success).toBe(true);
            expect(board[4][4]).toEqual({ type: "L", side: "sente" });
        });

        it("should fail on occupied cell", () => {
            const board = createInitialBoard();
            const success = makeDrop(board, "P", "sente", 8, 4);
            expect(success).toBe(false);
        });

        it("should prevent double pawn drop", () => {
            const board = createInitialBoard();
            board[5][3] = { type: "P", side: "sente" };
            const success = makeDrop(board, "P", "sente", 4, 3);
            expect(success).toBe(false);
        });
    });

    describe("isInCheck", () => {
        it("should detect check from gold general", () => {
            // Minimal board: king at (4,4), gold at (3,4) attacking it
            const board = Array.from({ length: 9 }, () => Array(9).fill(null));
            board[4][4] = { type: "K", side: "sente" };
            board[3][4] = { type: "G", side: "gote" };
            expect(isInCheck(board, "sente")).toBe(true);
        });

        it("should not detect check when king is safe", () => {
            const board = Array.from({ length: 9 }, () => Array(9).fill(null));
            board[4][4] = { type: "K", side: "sente" };
            expect(isInCheck(board, "sente")).toBe(false);
        });
    });

    describe("getPieceLabel", () => {
        it("should return kanji for known piece", () => {
            expect(getPieceLabel("K")).toBe("?");
            expect(getPieceLabel("P")).toBe("?");
        });

        it("should return ? for unknown piece", () => {
            expect(getPieceLabel("X")).toBe("?");
        });
    });
});
