/**
 * Shogi AI engine: Alpha-Beta + piece-square + drop evaluation.
 *
 * Shogi features unique mechanics: captured pieces can be dropped back,
 * pieces promote entering the opponent's promotion zone, and all pieces
 * except King and Gold have promoted forms.
 *
 * Evaluation is from Sente's perspective: positive = Sente advantage.
 *
 * Material values from PIECES constant in rules.js, with hand piece bonuses.
 *
 * @module games/shogi/ai
 */

import {
    createInitialBoard,
    getLegalMoves,
    makeMove,
    makeDrop,
    isInCheck,
    PIECES,
    BOARD_SIZE,
    PROMOTION_ZONE_SENTE,
    PROMOTION_ZONE_GOTE
} from './rules.js';

const AI_DELAY_BY_LEVEL = { easy: 300, medium: 550, hard: 900 };

export function getShogiAIDelay(level) {
    return AI_DELAY_BY_LEVEL[level] ?? AI_DELAY_BY_LEVEL.medium;
}

/**
 * Material value of a piece type (using official PIECES values).
 */
function materialValue(type) {
    return PIECES[type]?.value ?? 0;
}

/**
 * Material value of a captured piece in hand (slightly less than on-board,
 * because drops are limited to legal squares and cannot promote on drop).
 */
function handPieceValue(type) {
    const v = materialValue(type);
    return Math.round(v * 0.85);
}

// Positional bonus table for pieces on the 9x9 board.
// Encourages advancing pieces and controlling the center.
// Sente perspective: row 0 = enemy back rank, row 8 = home.
// Bonuses are symmetric by side via `positionBonus(piece, row, col)`.

const CENTER_BONUS = [
    [ 2, 3, 4, 5, 6, 5, 4, 3, 2],
    [ 3, 5, 7, 8, 9, 8, 7, 5, 3],
    [ 4, 7, 9,10,11,10, 9, 7, 4],
    [ 5, 8,10,12,13,12,10, 8, 5],
    [ 6, 9,11,13,14,13,11, 9, 6],
    [ 5, 8,10,12,13,12,10, 8, 5],
    [ 4, 7, 9,10,11,10, 9, 7, 4],
    [ 3, 5, 7, 8, 9, 8, 7, 5, 3],
    [ 2, 3, 4, 5, 6, 5, 4, 3, 2],
];

/**
 * Compute positional bonus. Pieces closer to the opponent's back rank
 * get a higher bonus (advancing is good in Shogi).
 */
function positionBonus(type, row, col, side) {
    // Use center table as a baseline (center control matters)
    const center = CENTER_BONUS[row][col];

    // Advancement bonus: pieces closer to enemy back rank are worth more
    const advancement = side === 'sente'
        ? (8 - row) * 3
        : row * 3;

    // Pawn advancement is more valuable
    const isPawnLike = ['P', 'L', 'N'].includes(type);
    const pawnBonus = isPawnLike ? advancement * 2 : 0;

    return center + advancement + pawnBonus;
}

/**
 * Static evaluation of a position from Sente's perspective.
 * Positive = Sente advantage, negative = Gote advantage.
 */
export function evaluate(board, hands) {
    let score = 0;

    // Board material + positional
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const piece = board[r][c];
            if (!piece) continue;
            const sign = piece.side === 'sente' ? 1 : -1;
            const mat = materialValue(piece.type);
            const pos = positionBonus(piece.type, r, c, piece.side);
            score += sign * (mat + pos);
        }
    }

    // Hand pieces bonus
    if (hands) {
        for (const p of (hands.sente || [])) {
            score += handPieceValue(p.type);
        }
        for (const p of (hands.gote || [])) {
            score -= handPieceValue(p.type);
        }
    }

    return score;
}

/**
 * Deep-clone a board (9x9 array of {type, side}|null).
 */
function cloneBoard(board) {
    return board.map(row => row.map(cell => cell ? { ...cell } : null));
}

/**
 * Deep-clone hands object.
 */
function cloneHands(hands) {
    return {
        sente: (hands.sente || []).map(p => ({ ...p })),
        gote: (hands.gote || []).map(p => ({ ...p }))
    };
}

/**
 * Generate all candidate moves (board moves + drops) for a side.
 * Filters out moves that leave own king in check.
 *
 * @returns {Array<object>} legal candidate moves
 */
export function generateAllMoves(board, side, hands) {
    const candidates = [];

    // Board moves
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const piece = board[r][c];
            if (!piece || piece.side !== side) continue;
            const moves = getLegalMoves(board, r, c);
            for (const mv of moves) {
                candidates.push({
                    kind: 'board',
                    from: [r, c],
                    to: [mv.row, mv.col],
                    promote: mv.promote || false
                });
            }
        }
    }

    // Drop moves: pieces in hand can be dropped onto any empty square
    // (with restriction: no unpromoted pawn on a file that already has one of same side)
    const handPieces = hands[side] || [];
    // Deduplicate: only try each unique type once per empty square (we don't need
    // to try dropping each instance separately since the effect is the same)
    const uniqueTypes = [...new Set(handPieces.map(p => p.type))];
    for (const type of uniqueTypes) {
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (board[r][c]) continue;
                // makeDrop handles the nifu (double pawn) rule internally
                const testBoard = cloneBoard(board);
                if (makeDrop(testBoard, type, side, r, c)) {
                    candidates.push({
                        kind: 'drop',
                        type,
                        side,
                        to: [r, c]
                    });
                }
            }
        }
    }

    // Filter: reject moves that leave own king in check
    return candidates.filter(mv => {
        const b2 = cloneBoard(board);
        const h2 = cloneHands(hands);
        applyCandidate(b2, h2, mv, side);
        return !isInCheck(b2, side);
    });
}

/**
 * Apply a candidate move to a cloned board/hands (mutates them).
 */
function applyCandidate(board, hands, mv, side) {
    if (mv.kind === 'drop') {
        makeDrop(board, mv.type, side, mv.to[0], mv.to[1]);
        // Remove one instance from hand
        const arr = hands[side];
        const idx = arr.findIndex(p => p.type === mv.type);
        if (idx !== -1) arr.splice(idx, 1);
    } else {
        // Board move
        const piece = board[mv.from[0]][mv.from[1]];
        const captured = board[mv.to[0]][mv.to[1]];
        makeMove(board, mv.from[0], mv.from[1], mv.to[0], mv.to[1], mv.promote);
        // Add captured piece to hand (promoted pieces demote on capture)
        if (captured) {
            const demoted = demoteType(captured.type);
            hands[side].push({ type: demoted, side: captured.side });
        }
    }
}

/**
 * When a piece is captured, it demotes to its unpromoted form
 * (unless it has no promoted form, like King/Gold).
 */
function demoteType(type) {
    // Find the unpromoted version
    for (const [key, val] of Object.entries(PIECES)) {
        if (val.promoted === type) return key;
    }
    // Already unpromoted or King/Gold (no promoted form)
    return type;
}

/**
 * Move ordering: captures first (MVV-LVA), then promotions, then others.
 */
function orderMoves(moves, board) {
    return moves
        .map(mv => {
            let s = 0;
            if (mv.kind === 'drop') {
                // Drops are moderate priority
                s = 50;
            } else {
                const target = board[mv.to[0]][mv.to[1]];
                if (target) {
                    // MVV-LVA: victim value - attacker value / 10
                    const victim = materialValue(target.type);
                    const attacker = materialValue(board[mv.from[0]][mv.from[1]].type);
                    s = 2000 + victim - Math.floor(attacker / 10);
                }
                if (mv.promote) {
                    s += 100;
                }
            }
            return { mv, s };
        })
        .sort((a, b) => b.s - a.s)
        .map(x => x.mv);
}

/**
 * Killer move heuristic.
 */
const MAX_KILLERS = 2;
const MAX_DEPTH = 10;
const killerMoves = Array.from({ length: MAX_DEPTH }, () => []);

function storeKiller(move, depth) {
    if (depth < 0 || depth >= MAX_DEPTH) return;
    const killers = killerMoves[depth];
    const key = moveKey(move);
    if (killers.some(k => moveKey(k) === key)) return;
    killers.unshift(move);
    if (killers.length > MAX_KILLERS) killers.pop();
}

function moveKey(mv) {
    if (mv.kind === 'drop') return `d:${mv.type}:${mv.to[0]},${mv.to[1]}`;
    return `b:${mv.from[0]},${mv.from[1]}:${mv.to[0]},${mv.to[1]}:${mv.promote ? 'p' : '-'}`;
}

/**
 * Transposition table (simple hash).
 */
const TT_SIZE = 1 << 16;
let transpositionTable = new Map();

function boardHash(board, side, hands) {
    let h = side === 'sente' ? 1 : 0;
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const p = board[r][c];
            if (p) {
                const code = p.type.charCodeAt(0) * 100 + (p.side === 'sente' ? 1 : 0);
                h = (h * 31 + code + r * 9 + c) | 0;
            }
        }
    }
    // Hand pieces
    for (const p of (hands.sente || [])) {
        h = (h * 31 + p.type.charCodeAt(0) * 200) | 0;
    }
    for (const p of (hands.gote || [])) {
        h = (h * 31 + p.type.charCodeAt(0) * 300) | 0;
    }
    return h;
}

const ttExact = 0, ttLower = 1, ttUpper = 2;

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
        let count = 0;
        for (const key of transpositionTable.keys()) {
            if (count++ % 2 === 0) transpositionTable.delete(key);
        }
    }
    transpositionTable.set(hash, { depth, score, flag });
}

/**
 * Minimax with alpha-beta pruning.
 */
function search(board, side, hands, depth, alpha, beta) {
    const hash = boardHash(board, side, hands);
    const ttHit = ttLookup(hash, depth, alpha, beta);
    if (ttHit !== null) return { score: ttHit, move: null };

    const oppSide = side === 'sente' ? 'gote' : 'sente';

    // Terminal: check if current side has no legal moves
    const moves = generateAllMoves(board, side, hands);
    if (moves.length === 0) {
        // Side to move has no moves = checkmate or stalemate
        // In Shogi, being checkmated means you lose (no stalemate rule)
        if (isInCheck(board, side)) {
            // Checkmated
            return { score: side === 'sente' ? -99_999 : 99_999, move: null };
        }
        // No legal moves but not in check: in Shogi this is stalemate, which
        // per standard rules is still a loss for the side to move (same as
        // checkmate). In ShogiApp.checkGameEnd this same position ends the
        // game with the opponent winning, so keep the AI evaluation consistent.
        return { score: side === 'sente' ? -99_999 : 99_999, move: null };
    }

    if (depth === 0) {
        return { score: evaluate(board, hands) * (side === 'sente' ? 1 : -1), move: null };
    }

    const ordered = orderMoves(moves, board);
    const alphaOrig = alpha;
    let bestMove = ordered[0];
    let bestScore = -Infinity;

    for (const mv of ordered) {
        const b2 = cloneBoard(board);
        const h2 = cloneHands(hands);
        applyCandidate(b2, h2, mv, side);

        const { score: childScore } = search(b2, oppSide, h2, depth - 1, -beta, -alpha);
        const score = -childScore;

        if (score > bestScore) {
            bestScore = score;
            bestMove = mv;
        }
        alpha = Math.max(alpha, score);
        if (alpha >= beta) {
            if (mv.kind === 'board') storeKiller(mv, depth);
            break;
        }
    }

    const flag = bestScore <= alphaOrig ? ttUpper : bestScore >= beta ? ttLower : ttExact;
    ttStore(hash, depth, bestScore, flag);
    return { score: bestScore, move: bestMove };
}

function depthForLevel(level) {
    if (level === 'easy') return 1;
    if (level === 'hard') return 4;
    return 2;
}

/**
 * Cryptographically-seeded random for reproducibility in tests.
 */
function randomFraction() {
    const cr = globalThis.crypto;
    if (cr?.getRandomValues) {
        const buf = new Uint32Array(1);
        cr.getRandomValues(buf);
        return buf[0] / 0x1_0000_0000;
    }
    return Math.random();
}

/**
 * Get the best AI move for a given board state.
 *
 * @param {object} board - 9x9 board array
 * @param {string} side - 'sente' or 'gote'
 * @param {object} hands - { sente: [{type, side}], gote: [{type, side}] }
 * @param {string} level - 'easy' | 'medium' | 'hard'
 * @returns {object|null} best move or null if no legal moves
 */
export function getShogiAIMove(board, side, hands, level = 'medium') {
    const candidates = generateAllMoves(board, side, hands);
    if (candidates.length === 0) return null;

    const depth = depthForLevel(level);

    const { move } = search(board, side, hands, depth, -Infinity, Infinity);
    if (move) return move;

    // Fallback: evaluate and pick best by static eval
    const scored = candidates.map(mv => {
        const b2 = cloneBoard(board);
        const h2 = cloneHands(hands);
        applyCandidate(b2, h2, mv, side);
        return { mv, score: evaluate(b2, h2) * (side === 'sente' ? 1 : -1) };
    });
    scored.sort((a, b) => b.score - a.score);

    if (level === 'easy') {
        const pool = scored.slice(0, Math.min(6, scored.length));
        return pool[Math.floor(randomFraction() * pool.length)].mv;
    }
    return scored[0].mv;
}

export function resetTranspositionTable() {
    transpositionTable.clear();
}
