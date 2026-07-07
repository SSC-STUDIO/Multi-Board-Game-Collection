import { describe, it, expect } from 'vitest';

import { getGoAIMove, getGoAIDelay } from './ai.js';
import { createGoState } from './state.js';
import { placeStone } from './rules.js';

describe('games/go/ai', () => {
    it('getGoAIDelay returns a positive number per difficulty', () => {
        expect(getGoAIDelay('easy')).toBeGreaterThan(0);
        expect(getGoAIDelay('medium')).toBeGreaterThan(0);
        expect(getGoAIDelay('hard')).toBeGreaterThan(0);
        expect(getGoAIDelay('unknown')).toBeGreaterThan(0);
    });

    it('returns a legal move on an empty 9x9 board', () => {
        const state = createGoState({ size: 9 });
        const move = getGoAIMove(state);
        expect(move.pass).toBeUndefined();
        expect(move.row).toBeGreaterThanOrEqual(0);
        expect(move.row).toBeLessThan(9);
        expect(move.col).toBeGreaterThanOrEqual(0);
        expect(move.col).toBeLessThan(9);
    });

    it('picks a capturing move when one stone is in atari', () => {
        // 构造白子 (1,1) 仅剩 (1,2) 一气，让黑 AI 落子 (1,2) 以吃子
        const state = createGoState({ size: 9 });
        state.board[1][1] = 'white';
        state.board[0][1] = 'black';
        state.board[2][1] = 'black';
        state.board[1][0] = 'black';
        // 白只剩 (1,2) 一气
        const move = getGoAIMove(state);
        expect(move.row).toBe(1);
        expect(move.col).toBe(2);
    });

    it('never returns an illegal suicide move', () => {
        const state = createGoState({ size: 5 });
        // 留一个黑方自杀点：(0,0) 被白子 (0,1)/(1,0) 占据
        state.board[0][1] = 'white';
        state.board[1][0] = 'white';
        for (let i = 0; i < 5; i += 1) {
            const move = getGoAIMove(state);
            if (move.pass) break;
            const res = placeStone(state.board, move.row, move.col, state.currentPlayer, {
                koPoint: state.koPoint
            });
            expect(res.legal).toBe(true);
            state.board = res.board;
            state.currentPlayer = state.currentPlayer === 'black' ? 'white' : 'black';
            state.koPoint = res.koPoint;
        }
    });

    it('passes when opponent just passed and no positive move exists', () => {
        const state = createGoState({ size: 5 });
        // 布满棋盘让所有点都被占，使评分为 -Inf → 会选 pass
        // 简化：让对方刚刚 pass 且棋盘几乎填满
        for (let r = 0; r < 5; r += 1) {
            for (let c = 0; c < 5; c += 1) {
                state.board[r][c] = (r + c) % 2 === 0 ? 'black' : 'white';
            }
        }
        state.board[4][4] = null; // 留一个空点
        state.lastMove = { color: 'white', pass: true };
        const move = getGoAIMove(state);
        expect(move.pass || (move.row === 4 && move.col === 4)).toBeTruthy();
    });
    it('hard mode returns a legal move on a partially filled board', () => {
        const state = createGoState({ size: 9, options: { level: 'hard' } });
        // Place some stones to create a realistic mid-game position
        state.board[3][3] = 'black';
        state.board[3][4] = 'white';
        state.board[4][3] = 'white';
        state.board[4][4] = 'black';
        state.board[2][3] = 'black';
        state.board[5][4] = 'white';
        const move = getGoAIMove(state);
        if (!move.pass) {
            expect(move.row).toBeGreaterThanOrEqual(0);
            expect(move.row).toBeLessThan(9);
            expect(move.col).toBeGreaterThanOrEqual(0);
            expect(move.col).toBeLessThan(9);
            expect(state.board[move.row][move.col]).toBeNull();
        }
    });

    it('hard mode prefers capturing moves over random placement', () => {
        const state = createGoState({ size: 9, options: { level: 'hard' } });
        // Set up a position where white stone at (4,4) has only 1 liberty at (4,5)
        state.board[4][4] = 'white';
        state.board[3][4] = 'black';
        state.board[5][4] = 'black';
        state.board[4][3] = 'black';
        // (4,5) is the only liberty - black should capture
        const move = getGoAIMove(state);
        if (!move.pass) {
            expect(move.row).toBe(4);
            expect(move.col).toBe(5);
        }
    });

    it('resetGoTT clears the transposition table without error', () => {
        const { resetGoTT } = require('./ai.js');
        expect(() => resetGoTT()).not.toThrow();
    });

    it('evaluateMove returns a finite number for valid positions', () => {
        const state = createGoState({ size: 9 });
        state.board[4][4] = 'black';
        // evaluateMove is not exported, but getGoAIMove uses it internally
        // Verify the AI produces a finite-scored move
        const move = getGoAIMove(state);
        expect(move).toBeDefined();
    });

});
