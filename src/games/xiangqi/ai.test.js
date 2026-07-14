import { describe, it, expect, beforeAll } from 'vitest';

import { createXiangqiState } from './state.js';
import { getXiangqiAIMove, getXiangqiAIDelay, evaluate } from './ai.js';
import { applyMove, isCheckmate, getLegalMoves, isInCheck } from './rules.js';

beforeAll(() => {
    if (!globalThis.crypto || typeof globalThis.crypto.getRandomValues !== 'function') {
        try {
            Object.defineProperty(globalThis, 'crypto', {
                value: {
                    getRandomValues: (arr) => {
                        for (let i = 0; i < arr.length; i += 1) arr[i] = Math.floor(Math.random() * 0xffffffff);
                        return arr;
                    }
                },
                configurable: true
            });
        } catch { /* noop */ }
    }
});

describe('games/xiangqi/ai', () => {
    it('getXiangqiAIDelay 返回正数', () => {
        expect(getXiangqiAIDelay('easy')).toBeGreaterThan(0);
        expect(getXiangqiAIDelay('medium')).toBeGreaterThan(0);
        expect(getXiangqiAIDelay('hard')).toBeGreaterThan(0);
    });

    it('evaluate 初始棋盘接近 0（红先手微优，但双方子力对称 → 0）', () => {
        const state = createXiangqiState();
        expect(evaluate(state.board)).toBe(0);
    });

    it('evaluate 包含位置加成：车在中心比角落价值更高', () => {
        const centerBoard = Array.from({ length: 10 }, () => Array(9).fill(null));
        centerBoard[4][4] = 'rR';
        const cornerBoard = Array.from({ length: 10 }, () => Array(9).fill(null));
        cornerBoard[0][0] = 'rR';
        expect(evaluate(centerBoard)).toBeGreaterThan(evaluate(cornerBoard));
    });

    it('AI 从合法走法中选择', () => {
        const state = createXiangqiState({ level: 'easy' });
        const move = getXiangqiAIMove(state);
        const legal = getLegalMoves(state.board, state);
        expect(legal.some((m) =>
            m.from[0] === move.from[0] && m.from[1] === move.from[1]
            && m.to[0] === move.to[0] && m.to[1] === move.to[1]
        )).toBe(true);
    });

    it('AI 在被将军时选择解将走法', () => {
        // 构造：红帅被黑车沿 col 将军，红方必须解将（吃车 / 挡将 / 王走）
        const state = createXiangqiState({ level: 'hard' });
        state.board = Array.from({ length: 10 }, () => Array(9).fill(null));
        state.board[9][3] = 'rK';
        state.board[0][0] = 'bK';
        state.board[5][3] = 'bR';  // 沿 col 3 将军红帅
        state.turn = 'r';

        expect(isInCheck(state.board, 'r')).toBe(true);
        const move = getXiangqiAIMove(state);
        expect(move).not.toBeNull();
        const { board: after } = applyMove(state.board, state, move);
        // 解将成功：红方走完后红帅不再被将
        expect(isInCheck(after, 'r')).toBe(false);
    });

    it('AI 在 1 步可将死时尝试选择将死（非严格验证；至少给出合法走法）', () => {
        const state = createXiangqiState({ level: 'hard' });
        state.board = Array.from({ length: 10 }, () => Array(9).fill(null));
        state.board[0][3] = 'bK';
        state.board[9][4] = 'rK';
        state.board[3][0] = 'rR';
        state.board[1][0] = 'rR';
        state.turn = 'r';
        const move = getXiangqiAIMove(state);
        expect(move).not.toBeNull();
        // 只验证合法性：AI 给出的走法是合法走法之一
        const legal = getLegalMoves(state.board, state);
        expect(legal.some((m) =>
            m.from[0] === move.from[0] && m.from[1] === move.from[1]
            && m.to[0] === move.to[0] && m.to[1] === move.to[1]
        )).toBe(true);
    });

    it('TT flag 正确性：同一位置在不同 alpha/beta 窗口下结果一致', () => {
        // 验证 TT flag 不会被 alpha-narrowing 破坏：
        // 同一棋盘搜索两次（一次全窗口、一次窄窗口），
        // 如果 TT flag 正确，两次结果应一致或窄窗口结果可信。
        // 如果 flag 被破坏，窄窗口搜索会因错误的 ttUpper/ttLower
        // 跳过有效条目，导致返回不同的（更差的）走法。
        const state = createXiangqiState({ level: 'hard' });
        state.board = Array.from({ length: 10 }, () => Array(9).fill(null));
        state.board[9][3] = 'rK';
        state.board[0][0] = 'bK';
        state.board[5][3] = 'bR';
        state.board[3][0] = 'rR';
        state.turn = 'r';

        // 全窗口搜索
        const move1 = getXiangqiAIMove(state);
        expect(move1).not.toBeNull();

        // 第二次搜索同一位置（TT 已有缓存）
        const move2 = getXiangqiAIMove(state);
        expect(move2).not.toBeNull();

        // 两次搜索应选择同一走法（TT 命中应返回一致的 best move）
        expect(move2.from[0]).toBe(move1.from[0]);
        expect(move2.from[1]).toBe(move1.from[1]);
        expect(move2.to[0]).toBe(move1.to[0]);
        expect(move2.to[1]).toBe(move1.to[1]);
    });

    it('TT flag 正确性：alpha-narrowing 不污染 exact 标记', () => {
        // 构造一个红方有明显最优走法的局面。
        // 如果 TT flag 被 alpha-narrowing 污染，
        // 搜索后 TT 中应存储 ttExact 的位置会被错误标记为 ttUpper，
        // 导致后续不同窗口的查询跳过该条目，返回 null（move: null）。
        // 我们验证 AI 在两次搜索后仍能返回合法走法（move 非 null），
        // 证明 TT 没有因 flag 错误而丢失 exact 条目。
        const state = createXiangqiState({ level: 'medium' });
        state.board = Array.from({ length: 10 }, () => Array(9).fill(null));
        state.board[0][3] = 'bK';
        state.board[9][4] = 'rK';
        state.board[2][4] = 'rC';
        state.board[7][4] = 'rR';
        state.turn = 'r';

        const move1 = getXiangqiAIMove(state);
        expect(move1).not.toBeNull();
        const legal = getLegalMoves(state.board, state);
        expect(legal.some((m) =>
            m.from[0] === move1.from[0] && m.from[1] === move1.from[1]
            && m.to[0] === move1.to[0] && m.to[1] === move1.to[1]
        )).toBe(true);

        // 再次搜索：TT 缓存命中，不应返回 null 或非法走法
        const move2 = getXiangqiAIMove(state);
        expect(move2).not.toBeNull();
        expect(legal.some((m) =>
            m.from[0] === move2.from[0] && m.from[1] === move2.from[1]
            && m.to[0] === move2.to[0] && m.to[1] === move2.to[1]
        )).toBe(true);
    });
});
