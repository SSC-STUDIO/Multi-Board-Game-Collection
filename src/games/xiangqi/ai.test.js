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
});
