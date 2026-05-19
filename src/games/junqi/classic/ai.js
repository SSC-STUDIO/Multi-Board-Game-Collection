import { getLegalMoves, RANK_LEVEL } from './rules.js';

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

export function getClassicAIDelay(level) {
    return AI_DELAY_BY_LEVEL[level] ?? AI_DELAY_BY_LEVEL.medium;
}

function evaluateMove(board, move) {
    const target = board[move.to[0]][move.to[1]];
    const piece = board[move.from[0]][move.from[1]];
    let score = 0;
    if (target?.rank === 'F') score += 10000;
    if (target?.rank === 'S') score += 250;
    if (target) score += (RANK_LEVEL[target.rank] || 0) * 18;
    if (piece?.rank === 'E') score += 6;
    if (piece?.rank === 'X' && target) score += 80;
    score -= Math.abs(move.to[0] - 6) * 0.5;
    score += randomFraction();
    return score;
}

export function getClassicAIMove(state) {
    const moves = getLegalMoves(state.board, state.turn);
    if (!moves.length) return null;
    const scored = moves
        .map((move) => ({ move, score: evaluateMove(state.board, move) }))
        .sort((a, b) => b.score - a.score);
    const topN = state.options?.level === 'easy' ? 6 : state.options?.level === 'hard' ? 1 : 3;
    const pool = scored.slice(0, Math.max(1, Math.min(topN, scored.length)));
    return pool[Math.floor(randomFraction() * pool.length)].move;
}
