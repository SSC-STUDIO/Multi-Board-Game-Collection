import { getLegalMoves, generatePieceMoves, RANK_LEVEL } from './rules.js';

const AI_DELAY_BY_LEVEL = { easy: 320, medium: 520, hard: 780 };

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
 * Check if a square is threatened by a higher-ranking enemy piece.
 * Returns the highest-level threat found, or null if the square is safe.
 */
function getThreatAtSquare(board, row, col, myColor, myRank) {
    const enemyColor = myColor === 'r' ? 'b' : 'r';
    const myLevel = RANK_LEVEL[myRank] || 0;
    let strongestThreat = null;
    let strongestLevel = -1;

    for (let r = 0; r < board.length; r++) {
        for (let c = 0; c < board[r].length; c++) {
            const enemy = board[r][c];
            if (!enemy || enemy.color !== enemyColor) continue;
            if (!enemy.revealed) continue; // only consider revealed pieces
            if (enemy.rank === 'F' || enemy.rank === 'M') continue; // immobile pieces don't threaten

            const enemyMoves = generatePieceMoves(board, r, c);
            for (const mv of enemyMoves) {
                if (mv.to[0] === row && mv.to[1] === col) {
                    const enemyLevel = RANK_LEVEL[enemy.rank] || 0;
                    // For bombs (X), any encounter is mutually destructive - a soft threat
                    if (enemy.rank === 'X') {
                        if (strongestThreat === null) {
                            strongestThreat = enemy;
                            strongestLevel = 0;
                        }
                        continue;
                    }
                    if (enemyLevel > myLevel && enemyLevel > strongestLevel) {
                        strongestThreat = enemy;
                        strongestLevel = enemyLevel;
                    }
                }
            }
        }
    }
    return strongestThreat ? { piece: strongestThreat, levelDiff: strongestLevel - myLevel } : null;
}

export function getClassicAIDelay(level) {
    return AI_DELAY_BY_LEVEL[level] ?? AI_DELAY_BY_LEVEL.medium;
}

function evaluateMove(board, move, level) {
    const target = board[move.to[0]][move.to[1]];
    const piece = board[move.from[0]][move.from[1]];
    let score = 0;
    // Hard mode: defensive bonus for protecting flag area (rows 11-12)
    if (level === 'hard' && move.from[0] >= 11 && move.to[0] < 11) {
        score -= 8;
    }
    // Hard mode: prioritize advancing pieces toward opponent
    if (level === 'hard' && move.to[0] < move.from[0]) {
        score += 2;
    }
    if (target?.rank === 'F') score += 10000;
    if (target?.rank === 'S') score += 250;
    if (target) score += (RANK_LEVEL[target.rank] || 0) * 18;
    if (piece?.rank === 'E') score += 6;
    if (piece?.rank === 'X' && target) score += 80;
    score -= Math.abs(move.to[0] - 6) * 0.5;

    // Threat avoidance: penalize moving to squares threatened by stronger revealed enemies
    if (piece && move.kind === 'move') {
        const threat = getThreatAtSquare(board, move.to[0], move.to[1], piece.color, piece.rank);
        if (threat) {
            const penalty = threat.levelDiff * 20;
            if (level === 'hard') {
                score -= penalty;              // full penalty
            } else if (level === 'medium') {
                score -= penalty * 0.5;         // partial penalty
            }
            // easy: no threat avoidance (random play)
        }
    }
    // Threat avoidance for captures: if capturing leaves us vulnerable, partially penalize
    if (piece && move.kind === 'capture' && target) {
        const threat = getThreatAtSquare(board, move.to[0], move.to[1], piece.color, piece.rank);
        if (threat && (RANK_LEVEL[target.rank] || 0) < RANK_LEVEL[piece.rank]) {
            // We're trading a high-value piece for a low-value one in a threatened spot
            if (level === 'hard') {
                score -= threat.levelDiff * 10;
            }
        }
    }

    score += randomFraction();
    return score;
}

export function getClassicAIMove(state) {
    const moves = getLegalMoves(state.board, state.turn);
    if (!moves.length) return null;
    const scored = moves
        .map((move) => ({ move, score: evaluateMove(state.board, move, state.options?.level) }))
        .sort((a, b) => b.score - a.score);
    const topN = state.options?.level === 'easy' ? 6 : state.options?.level === 'hard' ? 1 : 3;
    const pool = scored.slice(0, Math.max(1, Math.min(topN, scored.length)));
    return pool[Math.floor(randomFraction() * pool.length)].move;
}
