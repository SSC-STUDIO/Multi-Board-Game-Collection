import { describe, it, expect } from 'vitest';

import { findEmptyRegions, scoreBoard } from './scoring.js';

function empty(size) {
    return Array.from({ length: size }, () => Array(size).fill(null));
}

describe('games/go/scoring', () => {
    it('findEmptyRegions collapses one empty board into one region', () => {
        const board = empty(5);
        const regions = findEmptyRegions(board);
        expect(regions).toHaveLength(1);
        expect(regions[0].cells).toHaveLength(25);
        expect(regions[0].borderColors.size).toBe(0);
    });

    it('detects single-color territory', () => {
        // 5x5, 黑子 3x3 包围中间一个空点
        const board = empty(5);
        board[1][1] = 'black'; board[1][2] = 'black'; board[1][3] = 'black';
        board[2][1] = 'black';                                board[2][3] = 'black';
        board[3][1] = 'black'; board[3][2] = 'black'; board[3][3] = 'black';
        const regions = findEmptyRegions(board);
        const inner = regions.find((r) => r.cells.length === 1 && r.cells[0][0] === 2 && r.cells[0][1] === 2);
        expect(inner).toBeDefined();
        expect(inner.borderColors.has('black')).toBe(true);
        expect(inner.borderColors.size).toBe(1);
    });

    it('scoreBoard treats mixed-border region as dame', () => {
        // 中间一个空点同时挨着黑白
        const board = empty(5);
        board[1][2] = 'black';
        board[3][2] = 'white';
        const score = scoreBoard(board, { komi: 0 });
        // 棋盘大多数是中立点，因为区域同时挨着黑和白
        expect(score.dame).toBeGreaterThan(0);
    });

    it('scoreBoard applies komi and finds winner', () => {
        const board = empty(9);
        // 仅棋子对比：黑 5 子，白 3 子
        board[0][0] = 'black'; board[0][1] = 'black'; board[0][2] = 'black';
        board[0][3] = 'black'; board[0][4] = 'black';
        board[8][0] = 'white'; board[8][1] = 'white'; board[8][2] = 'white';
        const score = scoreBoard(board, { komi: 6.5 });
        // 黑 5 子，白 3 子 + 6.5 贴目 = 9.5，白应获胜
        expect(score.winner).toBe('white');
        expect(score.blackStones).toBe(5);
        expect(score.whiteStones).toBe(3);
        expect(score.komi).toBe(6.5);
    });

    it('scoreBoard reports draw when scores tie', () => {
        const board = empty(3);
        // 3x3 空盘，双方 0 子 0 领地，komi=0 → 打平
        const score = scoreBoard(board, { komi: 0 });
        expect(score.winner).toBeNull();
        expect(score.margin).toBe(0);
    });

    it('scoreBoard allocates territory to a single enclosed color', () => {
        // 黑子围住 3x3 中心的 1 格；棋盘上没有白子，所有空点都归黑
        const board = empty(5);
        board[1][1] = 'black'; board[1][2] = 'black'; board[1][3] = 'black';
        board[2][1] = 'black';                        board[2][3] = 'black';
        board[3][1] = 'black'; board[3][2] = 'black'; board[3][3] = 'black';
        const score = scoreBoard(board, { komi: 0 });
        expect(score.blackStones).toBe(8);
        // 中心 1 格 + 外围 16 格 = 17 空点全部归黑
        expect(score.blackTerritory).toBe(17);
        expect(score.whiteTerritory).toBe(0);
        expect(score.winner).toBe('black');
    });

    it('scoreBoard handles komi=0 with empty board as draw', () => {
        const board = empty(3);
        const score = scoreBoard(board, { komi: 0 });
        expect(score.winner).toBeNull();
        expect(score.dame).toBe(9);
    });

    it('scoreBoard uses default komi 6.5 when not provided', () => {
        const board = empty(5);
        const score = scoreBoard(board);
        expect(score.komi).toBe(6.5);
        expect(score.winner).toBe('white');
        expect(score.margin).toBe(6.5);
    });

    it('findEmptyRegions isolates multiple disconnected empty regions', () => {
        // 一行横着的黑子把棋盘切成上下两块
        const board = empty(5);
        for (let c = 0; c < 5; c += 1) board[2][c] = 'black';
        const regions = findEmptyRegions(board);
        // 上下两个空区域
        expect(regions.length).toBe(2);
        regions.forEach((r) => {
            expect(r.borderColors.has('black')).toBe(true);
            expect(r.borderColors.size).toBe(1);
        });
    });
});
