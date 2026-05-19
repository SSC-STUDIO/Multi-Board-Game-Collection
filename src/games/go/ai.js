/**
 * 围棋 AI（启发式 MVP）。
 *
 * 目标：不追求高棋力，但要能稳定产出"像样的"着法——
 * 1. 优先抢占能吃子最多的点；
 * 2. 避免落入自杀 / 劫点；
 * 3. 强防己方危险棋（气 ≤ 1 的 group 要增气或撤退）；
 * 4. 开局倾向于星位 / 小目；
 * 5. 靠近己方/对方棋子扩张，但不贴得太死（简易势力图）。
 *
 * 难度梯度：easy 只在高分候选里随机，hard 取最高分。
 *
 * @module games/go/ai
 */

import { getGroup, getLegalMoves, getNeighbors, getOpponent, placeStone } from './rules.js';

const AI_DELAY_BY_LEVEL = { easy: 300, medium: 500, hard: 800 };

export function getGoAIDelay(level) {
    return AI_DELAY_BY_LEVEL[level] ?? AI_DELAY_BY_LEVEL.medium;
}

function randomFraction() {
    if (globalThis.crypto?.getRandomValues) {
        const buf = new Uint32Array(1);
        globalThis.crypto.getRandomValues(buf);
        return buf[0] / 0x1_0000_0000;
    }
    return Math.random();
}

/**
 * 评估一个候选落点：正数越大越想下。
 * 评分项：
 *  + 吃子：每子 +14
 *  + 拯救己方 1 气 group：每子 +10
 *  + 逼迫对方 group 气数减少：减到 1 气 +6、减到 2 气 +2
 *  + 开局偏爱 3/4 线：+2，星位 +1
 *  - 接近边角但己方无子支援：-3（避免盲冲 2-2 点等）
 *
 * @param {Array<Array<string|null>>} board
 * @param {number} row
 * @param {number} col
 * @param {'black'|'white'} color
 */
function evaluateMove(board, row, col, color) {
    const size = board.length;
    const placement = placeStone(board, row, col, color);
    if (!placement.legal) return -Infinity;

    let score = 0;
    score += placement.captured.length * 14;

    // 己方棋型评估
    const self = getGroup(placement.board, row, col);
    score += self.stones.length * 1.2;
    if (self.libertyCount <= 1) score -= 6;
    if (self.libertyCount >= 3) score += 2;

    // 对手邻接 group 压迫分
    const opponent = getOpponent(color);
    const seen = new Set();
    for (const [nr, nc] of getNeighbors(size, row, col)) {
        if (placement.board[nr][nc] !== opponent) continue;
        const key = `${nr},${nc}`;
        if (seen.has(key)) continue;
        const opGroup = getGroup(placement.board, nr, nc);
        opGroup.stones.forEach(([sr, sc]) => seen.add(`${sr},${sc}`));
        if (opGroup.libertyCount === 1) score += 8;
        else if (opGroup.libertyCount === 2) score += 3;
    }

    // 开局偏好：3/4 线附近。
    const margin = Math.min(row, col, size - 1 - row, size - 1 - col);
    if (margin === 2 || margin === 3) score += 2;
    else if (margin === 0) score -= 2;
    else if (margin === 1) score -= 1;

    // 星位偏好（天元、小目）
    if (size === 19 && [3, 9, 15].includes(row) && [3, 9, 15].includes(col)) score += 1.2;
    if (size === 13 && [3, 6, 9].includes(row) && [3, 6, 9].includes(col)) score += 1.1;
    if (size === 9 && [2, 4, 6].includes(row) && [2, 4, 6].includes(col)) score += 1.0;

    // 靠近己方棋子加少量分（让棋子连成形）
    let neighborSelf = 0;
    let neighborOpp = 0;
    for (const [nr, nc] of getNeighbors(size, row, col)) {
        if (board[nr][nc] === color) neighborSelf += 1;
        if (board[nr][nc] === opponent) neighborOpp += 1;
    }
    score += neighborSelf * 0.4;
    score += neighborOpp * 0.6;

    // 微扰打散同分
    score += randomFraction() * 0.3;
    return score;
}

/**
 * 返回 AI 决策：{ pass: true } 或 { row, col }。
 * 当所有合法走法评分都 ≤ -50（几乎全部劣势），AI 选择 pass，加速终局。
 * @param {import('./state.js').GoState} state
 * @returns {{ pass: true } | { row: number, col: number }}
 */
export function getGoAIMove(state) {
    const { board, currentPlayer, koPoint, options } = state;
    const legal = getLegalMoves(board, currentPlayer, { koPoint });
    if (legal.length === 0) return { pass: true };

    const scored = legal
        .map(({ row, col }) => ({
            row,
            col,
            score: evaluateMove(board, row, col, currentPlayer)
        }))
        .sort((a, b) => b.score - a.score);

    // 若对方刚刚 pass 且己方最高分仍是负数 → 跟着 pass 结束对局。
    const opponent = getOpponent(currentPlayer);
    const opponentPassed = state.lastMove?.pass && state.lastMove.color === opponent;
    if (opponentPassed && scored[0].score < 0) {
        return { pass: true };
    }

    const level = options?.level ?? 'medium';
    const topN = level === 'easy' ? 6 : level === 'medium' ? 3 : 1;
    const best = scored[0];
    // 决定性优势（吃子/救子/形成活二眼等）：当 best 领先次名 > 6 分时，绕过随机池直接选它，
    // 避免"明明能吃子却随机避开"的业余常识错误。
    if (scored.length === 1 || best.score - (scored[1]?.score ?? -Infinity) > 6) {
        return { row: best.row, col: best.col };
    }
    const pool = scored.slice(0, Math.max(1, Math.min(topN, scored.length)));
    const idx = Math.floor(randomFraction() * pool.length);
    const pick = pool[idx] || pool[0];
    return { row: pick.row, col: pick.col };
}
