import { describe, it, expect } from 'vitest';

import { findEmptyRegions, scoreBoard, scoreBoardWithRule, getTerritoryMap } from './scoring.js';

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

describe('scoreBoardWithRule – territory (Japanese) rule', () => {
    it('scores territory + captures, not stones on board', () => {
        // 9x9 棋盘：黑子在左上角落 3x3 围住中心 1 格领地
        const board = empty(9);
        board[0][1] = 'black'; board[0][2] = 'black'; board[0][3] = 'black';
        board[1][0] = 'black';                        board[1][3] = 'black';
        board[2][0] = 'black'; board[2][1] = 'black'; board[2][2] = 'black'; board[2][3] = 'black';
        // 白子在右下完全包围 3x3 区域
        board[5][5] = 'white'; board[5][6] = 'white'; board[5][7] = 'white';
        board[6][5] = 'white';                        board[6][7] = 'white';
        board[7][5] = 'white'; board[7][6] = 'white'; board[7][7] = 'white';
        // 黑捕获 3 子，白捕获 1 子
        const score = scoreBoardWithRule(board, { rule: 'territory', komi: 0, captures: { black: 3, white: 1 } });
        // 黑方领地 = [1,1] + [0,0]（角落无白子边界）+ [1,2] → 需要精确计算
        // 外围大片区域同时被黑和白包围（mixed）→ dame
        expect(score.blackScore).toBe(score.blackTerritory + 3);
        expect(score.whiteScore).toBe(score.whiteTerritory + 1);
        // 棋子数仍然被统计在返回值中
        expect(score.blackStones).toBe(9);
        expect(score.whiteStones).toBe(8);
    });

    it('applies komi to white score in territory rule', () => {
        // 9x9 棋盘，双方各围一块领地，确保领地平衡后 komi 决定胜负
        const board = empty(9);
        // 黑子围住左上 [1,1]
        board[0][0] = 'black'; board[0][1] = 'black'; board[0][2] = 'black';
        board[1][0] = 'black';                        board[1][2] = 'black';
        board[2][0] = 'black'; board[2][1] = 'black'; board[2][2] = 'black';
        // 白子围住右下 [7,7]
        board[6][6] = 'white'; board[6][7] = 'white'; board[6][8] = 'white';
        board[7][6] = 'white';                        board[7][8] = 'white';
        board[8][6] = 'white'; board[8][7] = 'white'; board[8][8] = 'white';
        // 双方领地大小相同，komi=6.5 → 白胜
        const score = scoreBoardWithRule(board, { rule: 'territory', komi: 6.5, captures: { black: 0, white: 0 } });
        expect(score.blackTerritory).toBe(score.whiteTerritory);
        expect(score.whiteScore).toBe(score.whiteTerritory + 6.5);
        expect(score.blackScore).toBe(score.blackTerritory);
        expect(score.winner).toBe('white');
        expect(score.margin).toBe(6.5);
    });

    it('counts white captures in territory rule', () => {
        // 空棋盘，白方捕获 10 子
        const board = empty(5);
        const score = scoreBoardWithRule(board, { rule: 'territory', komi: 0, captures: { black: 0, white: 10 } });
        expect(score.whiteScore).toBe(10);
        expect(score.winner).toBe('white');
    });

    it('defaults to area rule when rule not specified', () => {
        // 用 scoreBoardWithRule 不传 rule 参数，应等同于 scoreBoard
        const board = empty(9);
        board[0][0] = 'black'; board[0][1] = 'black';
        board[8][0] = 'white';
        const withRule = scoreBoardWithRule(board, { komi: 6.5 });
        const default_ = scoreBoard(board, { komi: 6.5 });
        expect(withRule.blackScore).toBe(default_.blackScore);
        expect(withRule.whiteScore).toBe(default_.whiteScore);
        expect(withRule.winner).toBe(default_.winner);
    });

    it('draws in territory rule when scores tie', () => {
        const board = empty(5);
        // 双方各有对称领地
        board[0][0] = 'black'; board[0][1] = 'black'; board[0][2] = 'black';
        board[1][0] = 'black';                       board[1][2] = 'black';
        board[2][0] = 'black'; board[2][1] = 'black'; board[2][2] = 'black';
        board[0][4] = 'white'; board[0][3] = 'white';
        board[1][3] = 'white'; board[1][4] = 'white';
        // komi=0, captures both 0 → symmetry doesn't guarantee draw here;
        // use an empty 3x3 with komi=0 for a guaranteed draw
        const emptyBoard = empty(3);
        const score = scoreBoardWithRule(emptyBoard, { rule: 'territory', komi: 0 });
        expect(score.winner).toBeNull();
        expect(score.margin).toBe(0);
    });
});

describe('getTerritoryMap', () => {
    it('returns coordinate arrays for black territory, white territory, and dame', () => {
        const board = empty(5);
        // 黑子包围中心 1 格 → 那 1 格是 black territory
        board[1][1] = 'black'; board[1][2] = 'black'; board[1][3] = 'black';
        board[2][1] = 'black';                        board[2][3] = 'black';
        board[3][1] = 'black'; board[3][2] = 'black'; board[3][3] = 'black';
        const map = getTerritoryMap(board);
        // 中心 [2,2] 是黑方领地
        expect(map.blackTerritory).toContainEqual([2, 2]);
        // 没有白方领地
        expect(map.whiteTerritory).toHaveLength(0);
        // 外围空点全归黑（因为没有白子），所以 dame=0
        expect(map.dame).toHaveLength(0);
        // 总坐标数 = 空点数 = 25 - 8 = 17
        const totalCoords = map.blackTerritory.length + map.whiteTerritory.length + map.dame.length;
        expect(totalCoords).toBe(17);
    });

    it('returns empty arrays for a completely empty board (no border colors)', () => {
        const board = empty(3);
        const map = getTerritoryMap(board);
        expect(map.blackTerritory).toHaveLength(0);
        expect(map.whiteTerritory).toHaveLength(0);
        // 整个棋盘是单区域，borderColors 为空 → 走 dame 分支
        expect(map.dame).toHaveLength(9);
    });

    it('detects both black and white territory', () => {
        // 9x9：黑子在左上、白子在右下，互不干扰
        const board = empty(9);
        // 黑子围住左上 [1,1]
        board[0][0] = 'black'; board[0][1] = 'black'; board[0][2] = 'black';
        board[1][0] = 'black';                        board[1][2] = 'black';
        board[2][0] = 'black'; board[2][1] = 'black'; board[2][2] = 'black';
        // 白子围住右下 [7,7]
        board[6][6] = 'white'; board[6][7] = 'white'; board[6][8] = 'white';
        board[7][6] = 'white';                        board[7][8] = 'white';
        board[8][6] = 'white'; board[8][7] = 'white'; board[8][8] = 'white';
        const map = getTerritoryMap(board);
        expect(map.blackTerritory).toContainEqual([1, 1]);
        expect(map.whiteTerritory).toContainEqual([7, 7]);
        const totalCoords = map.blackTerritory.length + map.whiteTerritory.length + map.dame.length;
        expect(totalCoords).toBe(81 - 16); // 65 空点
    });

    it('mixed-border region is classified as dame', () => {
        const board = empty(5);
        board[1][2] = 'black';
        board[3][2] = 'white';
        const map = getTerritoryMap(board);
        // 中间区域同时挨着黑白，整块是 dame
        expect(map.blackTerritory).toHaveLength(0);
        expect(map.whiteTerritory).toHaveLength(0);
        expect(map.dame.length).toBe(23); // 25 - 2 stones
    });
});
