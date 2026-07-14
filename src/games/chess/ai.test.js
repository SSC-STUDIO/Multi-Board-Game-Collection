import { describe, it, expect, beforeAll } from 'vitest';

import { createChessState } from './state.js';
import { getChessAIMove, getChessAIDelay, evaluate, resetTranspositionTable } from './ai.js';
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

    it('AI 重复搜索同一局面仍返回合法走法（root TT hit 不丢走法）', () => {
        // Regression: before the isRoot fix, calling getChessAIMove twice on
        // the same position caused the second call to hit the TT at the root.
        // The TT probe returns { move: null }, so the caller fell through to
        // the weaker static-eval fallback — discarding the deep search.
        // After the fix, the root search skips the TT probe and always
        // iterates moves, returning a valid bestMove on every call.
        resetTranspositionTable();
        const state = createChessState({ level: 'medium' });
        // Use a simplified midgame position to ensure a non-trivial search
        state.board = Array.from({ length: 8 }, () => Array(8).fill(null));
        state.board[7][4] = 'wK'; // e1
        state.board[7][3] = 'wQ'; // d1
        state.board[0][4] = 'bK'; // e8
        state.board[0][3] = 'bQ'; // d8
        state.turn = 'w';
        state.castlingRights = { wK: false, wQ: false, bK: false, bQ: false };
        state.enPassantTarget = null;
        state.halfmoveClock = 0;

        // First call: populates TT including the root entry
        const m1 = getChessAIMove(state);
        expect(m1).not.toBeNull();
        expect(m1).toHaveProperty('from');
        expect(m1).toHaveProperty('to');

        // Second call on the SAME position: before fix, TT hit at root
        // returned move:null → fallthrough to static eval.
        // After fix: root skips TT probe, returns a valid move.
        const m2 = getChessAIMove(state);
        expect(m2).not.toBeNull();
        expect(m2).toHaveProperty('from');
        expect(m2).toHaveProperty('to');

        // Both moves must be legal
        const legal = getLegalMoves(state.board, state);
        const isLegal = (m) =>
            legal.some((lm) =>
                lm.from[0] === m.from[0] && lm.from[1] === m.from[1]
                && lm.to[0] === m.to[0] && lm.to[1] === m.to[1]
            );
        expect(isLegal(m1)).toBe(true);
        expect(isLegal(m2)).toBe(true);

        resetTranspositionTable();
    });
});
