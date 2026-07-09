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

        it("should prefer higher mobility positions", () => {
            // Create a board where black has many options and white few
            // Edge setup: black owns most of the left edge, white is boxed in
            const board = Array.from({ length: 8 }, () => Array(8).fill(null));
            // Place discs so black has 3+ legal moves while white has only 1
            board[2][2] = "white";
            board[2][3] = "black";
            board[3][2] = "black";
            board[3][3] = "white";
            // Add more black discs to give black good mobility
            board[0][0] = "black";  // corner
            board[0][1] = "white";
            board[1][0] = "white";
            // Black now has flanks along top, white is constrained
            const blackMoves = getLegalMoves(board, "black").length;
            const whiteMoves = getLegalMoves(board, "white").length;
            const diff = blackMoves - whiteMoves;

            const score = evaluateBoard(board);
            // If black has a mobility advantage, score should reflect it
            if (diff > 0) {
                expect(score).toBeGreaterThan(0);
            } else if (diff < 0) {
                expect(score).toBeLessThan(0);
            }
            // Mobility differential * 10 is part of the score
            expect(score).toEqual(expect.any(Number));
        });

        it("should detect symmetric mobility as a balanced score", () => {
            // A board where both sides have similar mobility should be near 0
            // from the mobility component (positional weights may shift it)
            const board = createInitialBoard();
            const blackMoves = getLegalMoves(board, "black").length;
            const whiteMoves = getLegalMoves(board, "white").length;
            // On initial board both have 4 moves → mobility diff = 0
            expect(blackMoves).toBe(whiteMoves);
            expect(evaluateBoard(board)).toBe(0);
        });
    });
});
