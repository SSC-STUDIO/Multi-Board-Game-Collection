import { describe, it, expect, beforeAll } from 'vitest';

import { createChessState } from './state.js';
import { getChessAIMove, getChessAIDelay, evaluate } from './ai.js';
import { getLegalMoves, applyMove, isCheckmate } from './rules.js';

beforeAll(() => {
    if (!globalThis.crypto || typeof globalThis.crypto.getRandomValues !== 'function') {
        try {
            // 尝试定义一个 getRandomValues；已有就跳过
            Object.defineProperty(globalThis, 'crypto', {
                value: {
                    getRandomValues: (arr) => {
                        for (let i = 0; i < arr.length; i += 1) arr[i] = Math.floor(Math.random() * 0xffffffff);
                        return arr;
                    }
                },
                configurable: true
            });
        } catch {
            // 只读且已存在时静默跳过
        }
    }
});

describe('games/chess/ai', () => {
    it('getChessAIDelay returns positive ms for all levels', () => {
        expect(getChessAIDelay('easy')).toBeGreaterThan(0);
        expect(getChessAIDelay('medium')).toBeGreaterThan(0);
        expect(getChessAIDelay('hard')).toBeGreaterThan(0);
    });

    it('evaluate 初始棋盘返回 0（双方子力相等）', () => {
        const state = createChessState();
        expect(evaluate(state.board)).toBe(0);
    });

    it('evaluate 少一兵的一方得分降低', () => {
        const state = createChessState();
        state.board[6][0] = null; // 白方失去一兵
        expect(evaluate(state.board)).toBeLessThan(0);
    });

    it('AI 从合法走法中选择', () => {
        const state = createChessState({ level: 'easy' });
        const move = getChessAIMove(state);
        const legal = getLegalMoves(state.board, state);
        expect(legal.some((m) =>
            m.from[0] === move.from[0] && m.from[1] === move.from[1]
            && m.to[0] === move.to[0] && m.to[1] === move.to[1]
        )).toBe(true);
    });

    it('AI 在 1 步可将死时选择将死', () => {
        const state = createChessState({ level: 'hard' });
        // 经典 mate-in-1：bK h8, wK g6, wQ h5。白走 Qh5-h7# 或 Qh5-h8#（后者王被吃还要王支援）
        // 用 Qh5→h7：h7 紧邻黑王 h8，由 wK g6 支援 → 黑王无处可逃
        state.board = Array.from({ length: 8 }, () => Array(8).fill(null));
        state.board[0][7] = 'bK'; // h8
        state.board[2][6] = 'wK'; // g6
        state.board[3][7] = 'wQ'; // h5
        state.turn = 'w';
        state.castlingRights = { wK: false, wQ: false, bK: false, bQ: false };

        const move = getChessAIMove(state);
        expect(move).not.toBeNull();
        const { board, state: next } = applyMove(state.board, state, move);
        expect(isCheckmate(board, next)).toBe(true);
    });

    it('AI 不因 TT 碰撞在丧失易位权后返回错误走法', () => {
        // 两个棋盘布局完全相同，但易位权不同。
        // 修复前 boardHash 只哈希棋盘+轮次 → 两位置 TT 碰撞 →
        // 第二次查表直接返回缓存分数（move=null），导致 AI 无走法。
        const makeState = (castle) => {
            const state = createChessState({ level: 'medium' });
            state.board = Array.from({ length: 8 }, () => Array(8).fill(null));
            state.board[7][4] = 'wK'; // e1
            state.board[7][7] = 'wR'; // h1
            state.board[0][4] = 'bK'; // e8
            state.board[0][0] = 'bR'; // a8
            state.turn = 'w';
            state.castlingRights = { wK: castle, wQ: false, bK: false, bQ: false };
            state.enPassantTarget = null;
            state.halfmoveClock = 0;
            return state;
        };

        // First: with castling rights → AI should find a move
        const s1 = makeState(true);
        const m1 = getChessAIMove(s1);
        expect(m1).not.toBeNull();

        // Second: without castling rights → same board, different hash.
        // Before fix: TT collision → returns {move:null} from cache.
        // After fix: distinct hash → fresh search → valid move.
        const s2 = makeState(false);
        const m2 = getChessAIMove(s2);
        expect(m2).not.toBeNull();
    });
});
