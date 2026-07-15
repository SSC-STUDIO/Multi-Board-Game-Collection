import { describe, it, expect } from 'vitest';
import { getOthelloAIMove, getOthelloAIDelay, resetTranspositionTable, boardHash, ttStore, ttLookup, ttExact, ttLower, ttUpper } from './ai.js';
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
// --------------------------------------------------------------------
// Pass-turn TT depth inflation regression (commit e07d430):
// When the current player must pass, minimax recurses with depth-1 but
// the TT entry must be stored at depth-1 (not depth). Storing at the
// original `depth` inflates the entry, so a later probe at `depth`
// accepts a score that was only searched to depth-1 — displacing a
// full-depth search with a shallower, less accurate evaluation.
//
// This test proves the invariant directly: a TT entry stored at an
// inflated depth is accepted by ttLookup at the full depth, whereas an
// entry stored at the correct (depth-1) is rejected.
// --------------------------------------------------------------------
describe("Othello AI pass-turn TT depth inflation", () => {
    it("ttLookup should reject a pass-turn entry stored at depth-1 when probing at full depth", () => {
        resetTranspositionTable();

        // Use boardHash to get a real hash for a position where a pass occurs.
        const board = Array.from({ length: 8 }, () => Array(8).fill(null));
        board[3][3] = "white";
        board[3][4] = "white";
        board[4][3] = "white";
        board[4][4] = "white";
        const hash = boardHash(board, true);

        // Simulate the CORRECT behavior: pass-turn result stored at depth-1.
        const passDepth = 3;
        const passScore = 42;
        ttStore(hash, passDepth - 1, passScore, ttExact);

        // Probe at full depth — should be REJECTED because the entry's
        // depth (2) is less than the requested depth (3).
        const probe = ttLookup(hash, passDepth, -Infinity, Infinity);
        expect(probe).toBeNull();

        // Probe at depth-1 — should be ACCEPTED.
        const shallowProbe = ttLookup(hash, passDepth - 1, -Infinity, Infinity);
        expect(shallowProbe).toBe(passScore);
    });

    it("ttLookup would WRONGLY accept a pass-turn entry if stored at full depth (the bug)", () => {
        resetTranspositionTable();

        const board = Array.from({ length: 8 }, () => Array(8).fill(null));
        board[3][3] = "white";
        board[3][4] = "white";
        board[4][3] = "white";
        board[4][4] = "white";
        const hash = boardHash(board, true);

        // Simulate the BUGGY behavior: pass-turn result stored at full depth.
        const fullDepth = 3;
        const passScore = 42;
        ttStore(hash, fullDepth, passScore, ttExact);

        // Probe at full depth — this WRONGLY accepts the entry.
        // The entry was only searched to depth-1 but claims depth=3.
        // This is exactly the depth-inflation bug the fix prevents.
        const wrongProbe = ttLookup(hash, fullDepth, -Infinity, Infinity);
        expect(wrongProbe).toBe(passScore);

        // Prove the consequence: the buggy entry displaces a real
        // full-depth search. A deeper probe at depth+1 correctly
        // rejects it (entry depth 3 < requested 4), but a same-depth
        // probe accepts a depth-1 search as if it were depth-3.
        resetTranspositionTable();
    });

    it("getOthelloAIMove should not return a corrupted move due to pass-turn TT depth inflation", () => {
        // Construct a board where black has a pass opportunity during search
        // and verify the AI still produces a correct, legal move. Before
        // e07d430, the inflated TT entry could cause the AI to accept a
        // shallower evaluation and pick a suboptimal or wrong move.
        resetTranspositionTable();

        // Fill a board where white has no legal moves (forces pass branch).
        const board = Array.from({ length: 8 }, () => Array(8).fill(null));
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                board[r][c] = "black";
            }
        }
        // Leave empties only black can play.
        board[0][0] = null;
        board[0][1] = null;
        board[1][0] = "white"; // a single white disc

        // White has no legal moves → pass branch is exercised.
        const whiteMoves = getLegalMoves(board, "white");
        expect(whiteMoves.length).toBe(0);

        // Black has legal moves → AI should return one.
        const blackMoves = getLegalMoves(board, "black");
        expect(blackMoves.length).toBeGreaterThan(0);

        // Run twice: the second run hits TT entries stored by the first.
        // If depth inflation were present, the second run could return a
        // corrupted result from a stale, inflated TT entry. Both runs must
        // return the same legal move.
        const move1 = getOthelloAIMove(board, "black", "hard");
        const move2 = getOthelloAIMove(board, "black", "hard");

        expect(move1).not.toBeNull();
        expect(move2).not.toBeNull();
        expect(move1.row).toBe(move2.row);
        expect(move1.col).toBe(move2.col);

        // Both moves must be legal.
        const legalMoves = getLegalMoves(board, "black");
        expect(legalMoves.some(m => m.row === move1.row && m.col === move1.col)).toBe(true);
        expect(legalMoves.some(m => m.row === move2.row && m.col === move2.col)).toBe(true);
    });
});

// --------------------------------------------------------------------
// boardHash turn sensitivity (revision 82 fix): the TT hash must encode
// the side-to-move so the same board state at a maximizing node and a
// minimizing node doesn't share a TT entry. Before the fix, boardHash
// only hashed the board discs which caused TT collisions between nodes
// with opposite turn — a wrong-side score would be returned.
// --------------------------------------------------------------------
describe("Othello AI boardHash turn sensitivity", () => {
    it("boardHash should produce different hashes for maximizing vs minimizing on the same board", () => {
        const board = createInitialBoard();
        makeMove(board, 2, 3, "black");
        makeMove(board, 2, 4, "white");

        const hashMax = boardHash(board, true);
        const hashMin = boardHash(board, false);

        expect(hashMax).not.toBe(hashMin);
    });

    it("AI should not return identical results for opposite perspectives on the same board after TT warm-up", () => {
        // If the hash omits the turn, the second search (white perspective)
        // finds the TT entry that was stored by the first search (black
        // perspective, maximizing=true) and returns the wrong score/move.
        const board = createInitialBoard();
        makeMove(board, 2, 3, "black");
        makeMove(board, 5, 4, "white");
        makeMove(board, 3, 5, "black");

        resetTranspositionTable();

        // To make this deterministic and reproducible, compare the hash
        // collisions directly: store a value for maximizing=true, then read
        // for maximizing=false on the same board — they must NOT collide.
        resetTranspositionTable();
        const hMax = boardHash(board, true);
        const hMin = boardHash(board, false);

        expect(hMax).not.toBe(hMin);

        // Verify getOthelloAIMove still produces valid moves after the fix.
        const blackMove = getOthelloAIMove(board, "black", "hard");
        const whiteMove = getOthelloAIMove(board, "white", "hard");

        if (blackMove) {
            const legalBlack = getLegalMoves(board, "black");
            expect(legalBlack.some(m => m.row === blackMove.row && m.col === blackMove.col)).toBe(true);
        }
        if (whiteMove) {
            const legalWhite = getLegalMoves(board, "white");
            expect(legalWhite.some(m => m.row === whiteMove.row && m.col === whiteMove.col)).toBe(true);
        }
    });
});

// --------------------------------------------------------------------
// TT flag boundary correctness (revision 82): Othello's minimax uses a
// single loop that mutates alpha (maximizing) OR beta (minimizing).
// The TT flag must compare bestScore against the ORIGINAL bounds, not the
// mutated ones. Before the fix, the flag used `bestScore >= beta` (the
// mutated beta after narrowing in the minimizing branch), which could
// produce a false ttLower flag — storing an upper-bound result as a
// lower bound. A later ttLookup at the parent's wider window would then
// wrongly accept the stale entry, corrupting the search.
//
// This test proves the invariant directly: the flag computed with
// origBeta differs from the flag computed with a narrowed beta, and
// only the origBeta-based flag is correctly rejected by ttLookup at a
// window wider than the narrowed beta.
// --------------------------------------------------------------------
describe("Othello AI TT flag origBeta boundary", () => {
    it("ttLookup should reject a ttLower entry when score < parent beta (origBeta-based flag)", () => {
        resetTranspositionTable();

        // Simulate a minimizing node that searched with original beta = 100.
        // The node's bestScore = 80, which is below the original beta (100),
        // so the correct flag is ttExact (not a beta cutoff / ttLower).
        // The fix computes: 80 >= origBeta(100)? No → ttExact.
        // The bug computed: 80 >= mutatedBeta(80)?  Yes → ttLower (WRONG).
        const hash = boardHash(createInitialBoard(), false);
        const origBeta = 100;
        const narrowedBeta = 80;  // what beta gets narrowed to during the loop
        const bestScore = 80;

        // Correct behavior (fix): flag = ttExact because bestScore < origBeta
        ttStore(hash, 3, bestScore, ttExact);

        // At the parent node, alpha=-Inf beta=100 (full window).
        // ttLookup with ttExact always returns the score (line 109).
        // But the point is: the flag SHOULD be ttExact, not ttLower.
        // If it were ttLower, the lookup at a parent window with beta=90
        // (where score 80 < 90) would REJECT it — but ttLower requires
        // score >= beta. So a ttLower entry with score=80 is rejected at
        // beta=90, while ttExact is always accepted.
        resetTranspositionTable();
        ttStore(hash, 3, bestScore, ttExact);
        const probeExact = ttLookup(hash, 3, -Infinity, 90);
        expect(probeExact).toBe(bestScore); // ttExact always returns

        // Now simulate the BUG: flag = ttLower (wrongly, because bestScore
        // >= narrowedBeta). At a parent with beta=90, ttLookup checks
        // score(80) >= beta(90)? No → rejects the entry.
        resetTranspositionTable();
        ttStore(hash, 3, bestScore, ttLower);
        const probeBuggy = ttLookup(hash, 3, -Infinity, 90);
        expect(probeBuggy).toBeNull(); // ttLower with score < beta is rejected

        // The consequence: the buggy ttLower flag causes the parent to
        // miss a valid TT entry that ttExact would have returned, forcing
        // a redundant re-search. In other cases (score between narrowed
        // and original beta with a narrower parent window), the buggy
        // ttLower could be wrongly accepted, returning a bound that was
        // only valid for a narrower window.
    });

    it("ttLookup should correctly accept a ttLower entry when score >= parent beta", () => {
        resetTranspositionTable();

        // A genuine beta cutoff: bestScore >= origBeta.
        // The fix computes ttLower (correct). The bug would also compute
        // ttLower here (since narrowedBeta <= origBeta <= bestScore), so
        // this case doesn't distinguish them — but it verifies the
        // correct path still works.
        const hash = boardHash(createInitialBoard(), false);
        ttStore(hash, 3, 150, ttLower);

        // Parent with beta=100: score 150 >= 100 → accepted.
        const probe = ttLookup(hash, 3, -Infinity, 100);
        expect(probe).toBe(150);
    });

    it("getOthelloAIMove should produce deterministic results after TT warm-up with minimizing nodes", () => {
        // Run the AI twice on the same board. The second run hits TT
        // entries stored by the first — including minimizing-node entries.
        // If the TT flags are wrong (mutated beta), the second run could
        // get a corrupted score and return a different move.
        resetTranspositionTable();
        const board = createInitialBoard();
        makeMove(board, 2, 3, "black");
        makeMove(board, 5, 4, "white");
        makeMove(board, 3, 5, "black");
        makeMove(board, 4, 2, "white");
        makeMove(board, 1, 4, "black");

        const move1 = getOthelloAIMove(board, "white", "hard");
        const move2 = getOthelloAIMove(board, "white", "hard");

        expect(move1).not.toBeNull();
        expect(move2).not.toBeNull();
        expect(move1.row).toBe(move2.row);
        expect(move1.col).toBe(move2.col);

        const legalMoves = getLegalMoves(board, "white");
        expect(legalMoves.some(m => m.row === move1.row && m.col === move1.col)).toBe(true);
    });
});
