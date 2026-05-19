/**
 * 翻翻棋 AI（启发式 MVP）。
 *
 * 翻翻棋是信息不完全博弈——对方棋子翻开前未知，因此无法用完整 minimax。
 * 我们用启发式评分：
 *  1) 吃大子：对敌方已翻开子的 RANK_LEVEL 直接加分（吃大得分高）；
 *  2) 避免被反吃：若目标格相邻有更高级别的敌方棋子 → 扣分；
 *  3) 翻棋：常数加分（比普通"移动"稍高，推进游戏进程）；
 *  4) 普通移动：占据中心格子（row 1-2, col 2-5）微加分；
 *  5) 最后按难度从 top-N 候选随机选取。
 *
 * @module games/junqi/flip/ai
 */

import {
    RANK_LEVEL,
    getLegalMoves,
    canCapture,
    inBounds,
    oppositeColor
} from './rules.js';

const AI_DELAY_BY_LEVEL = { easy: 260, medium: 480, hard: 780 };

export function getFlipAIDelay(level) {
    return AI_DELAY_BY_LEVEL[level] ?? AI_DELAY_BY_LEVEL.medium;
}

function randomFraction() {
    const cr = globalThis.crypto;
    if (cr?.getRandomValues) {
        const buf = new Uint32Array(1);
        cr.getRandomValues(buf);
        return buf[0] / 0x1_0000_0000;
    }
    return Math.random();
}

/** 计算某格是否处于"可被敌方高级别子反吃"。粗略：四邻有敌子且 level 更高 → true。 */
function isUnsafe(board, row, col, myPiece) {
    const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of DIRS) {
        const r = row + dr;
        const c = col + dc;
        if (!inBounds(r, c)) continue;
        const target = board[r][c];
        if (!target || !target.revealed) continue;
        if (target.color === myPiece.color) continue;
        // 反向视角：敌子作为 attacker 吃"占据目标格后的我方子"
        if (canCapture(target, { ...myPiece, revealed: true })) {
            return true;
        }
    }
    return false;
}

/**
 * 评估一个候选走法。
 */
function evaluateMove(board, move) {
    let score = 0;
    const [fr, fc] = move.from;
    const [tr, tc] = move.to;
    const piece = board[fr][fc];

    if (move.kind === 'flip') {
        // 翻棋 —— 解开不确定性，中等价值
        score += 8;
        // 中心格翻棋更值：能先看到中路形势
        const centerish = tr >= 1 && tr <= 2 && tc >= 2 && tc <= 5;
        if (centerish) score += 2;
    } else if (move.kind === 'capture') {
        const victim = board[tr][tc];
        if (victim && victim.revealed) {
            score += RANK_LEVEL[victim.rank] * 10;
        } else {
            // 炮吃未翻开：得分折扣（不知价值）
            score += 12;
        }
    } else if (move.kind === 'move') {
        // 占据中心小幅加分
        const centerish = tr >= 1 && tr <= 2 && tc >= 2 && tc <= 5;
        if (centerish) score += 2;
    }

    // 安全性：走到不安全格减分（放弃子）
    if (piece && (move.kind === 'move' || move.kind === 'capture')) {
        // 模拟简易：移动后自己的 piece 在 (tr,tc)，判断是否会被反吃
        // 吃子时走到 (tr,tc) 前 victim 已消失，仍可能被其他邻居反吃
        if (isUnsafe(board, tr, tc, piece)) {
            score -= RANK_LEVEL[piece.rank] * 6;
        }
    }

    // 微扰打散同分
    score += randomFraction() * 0.5;
    return score;
}

/**
 * 返回 AI 决策。
 * @param {import('./state.js').FlipState} state
 */
export function getFlipAIMove(state) {
    const legal = getLegalMoves(state.board, state.turn);
    if (legal.length === 0) return null;

    const scored = legal
        .map((mv) => ({ mv, score: evaluateMove(state.board, mv) }))
        .sort((a, b) => b.score - a.score);

    const level = state.options?.level ?? 'medium';
    const topN = level === 'easy' ? 5 : level === 'medium' ? 2 : 1;

    // 决定性优势：最高分领先 >15 分时直接选（典型吃大子场景）
    if (scored.length === 1 || scored[0].score - (scored[1]?.score ?? -Infinity) > 15) {
        return scored[0].mv;
    }

    const pool = scored.slice(0, Math.max(1, Math.min(topN, scored.length)));
    const idx = Math.floor(randomFraction() * pool.length);
    return pool[idx].mv;
}

export { oppositeColor };
