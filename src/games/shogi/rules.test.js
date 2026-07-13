import { describe, it, expect } from "vitest";
import { createInitialBoard, getLegalMoves, getLegalMovesFiltered, makeMove, makeDrop, isInCheck, getPieceLabel, BOARD_SIZE, PIECES } from "./rules.js";

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

        it("should prevent dropping pawn on last rank (sente)", () => {
            const board = Array.from({ length: 9 }, () => Array(9).fill(null));
            expect(makeDrop(board, "P", "sente", 0, 0)).toBe(false);
        });

        it("should prevent dropping lance on last rank (sente)", () => {
            const board = Array.from({ length: 9 }, () => Array(9).fill(null));
            expect(makeDrop(board, "L", "sente", 0, 0)).toBe(false);
        });

        it("should prevent dropping knight on last two ranks (sente)", () => {
            const board = Array.from({ length: 9 }, () => Array(9).fill(null));
            expect(makeDrop(board, "N", "sente", 0, 0)).toBe(false);
            expect(makeDrop(board, "N", "sente", 1, 0)).toBe(false);
        });

        it("should prevent dropping pawn on last rank (gote)", () => {
            const board = Array.from({ length: 9 }, () => Array(9).fill(null));
            expect(makeDrop(board, "P", "gote", 8, 0)).toBe(false);
        });

        it("should prevent dropping lance on last rank (gote)", () => {
            const board = Array.from({ length: 9 }, () => Array(9).fill(null));
            expect(makeDrop(board, "L", "gote", 8, 0)).toBe(false);
        });

        it("should prevent dropping knight on last two ranks (gote)", () => {
            const board = Array.from({ length: 9 }, () => Array(9).fill(null));
            expect(makeDrop(board, "N", "gote", 8, 0)).toBe(false);
            expect(makeDrop(board, "N", "gote", 7, 0)).toBe(false);
        });

        it("should allow dropping gold on last rank (no movement restriction)", () => {
            const board = Array.from({ length: 9 }, () => Array(9).fill(null));
            expect(makeDrop(board, "G", "sente", 0, 0)).toBe(true);
        });

        it("should allow dropping knight on valid rank (sente row 2)", () => {
            const board = Array.from({ length: 9 }, () => Array(9).fill(null));
            expect(makeDrop(board, "N", "sente", 2, 0)).toBe(true);
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

    describe("getLegalMovesFiltered", () => {
        it("should filter moves that leave own king in check", () => {
            // Sente king at (4,4), gote rook at (4,8) attacking row 4
            // Sente gold at (4,5) — moving it away exposes king to rook check
            const board = Array.from({ length: 9 }, () => Array(9).fill(null));
            board[4][4] = { type: "K", side: "sente" };
            board[4][5] = { type: "G", side: "sente" };
            board[4][8] = { type: "R", side: "gote" };

            // Raw getLegalMoves should allow the gold to move away
            const raw = getLegalMoves(board, 4, 5);
            expect(raw.length).toBeGreaterThanOrEqual(1);

            // getLegalMovesFiltered must NOT include any move that exposes the king
            const filtered = getLegalMovesFiltered(board, 4, 5);
            for (const mv of filtered) {
                // Simulate and verify no self-check
                const cap = board[mv.row][mv.col];
                const origType = board[4][5].type;
                board[mv.row][mv.col] = board[4][5];
                board[4][5] = null;
                expect(isInCheck(board, "sente")).toBe(false);
                board[4][5] = board[mv.row][mv.col];
                board[mv.row][mv.col] = cap;
            }
        });

        it("should not modify the board after filtering", () => {
            const board = Array.from({ length: 9 }, () => Array(9).fill(null));
            board[4][4] = { type: "K", side: "sente" };
            board[4][5] = { type: "G", side: "sente" };
            board[4][8] = { type: "R", side: "gote" };

            const snapshot = board.map(r => r.map(c => c ? { ...c } : null));
            getLegalMovesFiltered(board, 4, 5);

            for (let r = 0; r < 9; r++) {
                for (let c = 0; c < 9; c++) {
                    expect(board[r][c]).toEqual(snapshot[r][c]);
                }
            }
        });

        it("should allow moves that don't expose the king", () => {
            // King at (0,0), gold at (1,1), no threats — gold can move freely
            const board = Array.from({ length: 9 }, () => Array(9).fill(null));
            board[0][0] = { type: "K", side: "sente" };
            board[1][1] = { type: "G", side: "sente" };

            const raw = getLegalMoves(board, 1, 1);
            const filtered = getLegalMovesFiltered(board, 1, 1);
            expect(filtered.length).toBe(raw.length);
        });
    });

    describe("getPieceLabel", () => {
        it("should return kanji for known piece", () => {
            expect(getPieceLabel("K")).toBe("王");
            expect(getPieceLabel("P")).toBe("歩");
            expect(getPieceLabel("R")).toBe("飛");
            expect(getPieceLabel("B")).toBe("角");
            expect(getPieceLabel("G")).toBe("金");
            expect(getPieceLabel("S")).toBe("銀");
            expect(getPieceLabel("N")).toBe("桂");
            expect(getPieceLabel("L")).toBe("香");
        });

        it("should return kanji for promoted pieces", () => {
            expect(getPieceLabel("DR")).toBe("龍");
            expect(getPieceLabel("DB")).toBe("馬");
            expect(getPieceLabel("PS")).toBe("全");
            expect(getPieceLabel("PN")).toBe("圭");
            expect(getPieceLabel("PL")).toBe("杏");
            expect(getPieceLabel("PP")).toBe("と");
        });

        it("should return ? for unknown piece", () => {
            expect(getPieceLabel("X")).toBe("?");
        });
    });
});
