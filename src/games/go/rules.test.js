import { describe, it, expect } from 'vitest';

import {
    getNeighbors,
    getGroup,
    countLiberties,
    placeStone,
    isLegalMove,
    getLegalMoves,
    getOpponent,
    isInside,
    isEmptyBoard
} from './rules.js';

function emptyBoard(size) {
    return Array.from({ length: size }, () => Array(size).fill(null));
}

describe('games/go/rules', () => {
    it('getOpponent flips color', () => {
        expect(getOpponent('black')).toBe('white');
        expect(getOpponent('white')).toBe('black');
    });

    it('isInside checks bounds', () => {
        expect(isInside(9, 0, 0)).toBe(true);
        expect(isInside(9, 8, 8)).toBe(true);
        expect(isInside(9, -1, 0)).toBe(false);
        expect(isInside(9, 0, 9)).toBe(false);
    });

    it('getNeighbors filters by boundary', () => {
        expect(getNeighbors(9, 0, 0)).toEqual([[1, 0], [0, 1]]);
        expect(getNeighbors(9, 4, 4).length).toBe(4);
    });

    it('getGroup finds a lone stone with 4 liberties', () => {
        const board = emptyBoard(9);
        board[4][4] = 'black';
        const group = getGroup(board, 4, 4);
        expect(group.color).toBe('black');
        expect(group.stones).toHaveLength(1);
        expect(group.libertyCount).toBe(4);
    });

    it('countLiberties reflects adjacent occupation', () => {
        const board = emptyBoard(9);
        board[4][4] = 'black';
        board[3][4] = 'white';
        board[5][4] = 'white';
        // 两侧被白占，上下两气消失，左右仍然是气
        expect(countLiberties(board, 4, 4)).toBe(2);
    });

    it('placeStone captures an opponent group with no liberties', () => {
        // 白子 2-2 被黑子 1-2 / 3-2 / 2-1 包围，再落 2-3 则提子
        const board = emptyBoard(9);
        board[2][2] = 'white';
        board[1][2] = 'black';
        board[3][2] = 'black';
        board[2][1] = 'black';
        const result = placeStone(board, 2, 3, 'black');
        expect(result.legal).toBe(true);
        expect(result.captured).toContainEqual([2, 2]);
        expect(result.board[2][2]).toBeNull();
    });

    it('placeStone rejects suicide', () => {
        // 黑子被白包围的空点落黑 → 自杀
        const board = emptyBoard(9);
        board[0][1] = 'white';
        board[1][0] = 'white';
        const result = placeStone(board, 0, 0, 'black');
        expect(result.legal).toBe(false);
        expect(result.reason).toBe('suicide');
    });

    it('placeStone allows "self-fill" when it captures opponent (not suicide)', () => {
        // 构造：白 (3,3) 仅剩 (4,3) 一气；黑落 (4,3) → 合法，吃掉白子
        const b = Array.from({ length: 9 }, () => Array(9).fill(null));
        b[3][3] = 'white';
        b[2][3] = 'black';
        b[3][2] = 'black';
        b[3][4] = 'black';
        // 白 (3,3) 邻居：(2,3)黑 / (3,2)黑 / (3,4)黑 / (4,3)空 → 1 气
        const result = placeStone(b, 4, 3, 'black');
        expect(result.legal).toBe(true);
        expect(result.captured).toContainEqual([3, 3]);
    });

    it('placeStone rejects occupied points', () => {
        const board = emptyBoard(9);
        board[4][4] = 'black';
        const result = placeStone(board, 4, 4, 'white');
        expect(result.legal).toBe(false);
        expect(result.reason).toBe('occupied');
    });

    it('placeStone honours ko restriction', () => {
        const board = emptyBoard(9);
        const ko = { row: 3, col: 3 };
        const result = placeStone(board, 3, 3, 'black', { koPoint: ko });
        expect(result.legal).toBe(false);
        expect(result.reason).toBe('ko');
    });

    it('placeStone sets koPoint when capture=1 and self group is 1-stone 1-liberty', () => {
        // 典型单劫形：
        //   . W B .
        //   W . W B
        //   . W B .
        // 黑落 (1,1) 吃掉白 (1,2)；落子后黑 (1,1) 1 子 1 气，触发 ko
        const b = Array.from({ length: 5 }, () => Array(5).fill(null));
        b[0][1] = 'white'; b[0][2] = 'black';
        b[1][0] = 'white'; b[1][2] = 'white'; b[1][3] = 'black';
        b[2][1] = 'white'; b[2][2] = 'black';
        const res = placeStone(b, 1, 1, 'black');
        expect(res.legal).toBe(true);
        expect(res.captured).toContainEqual([1, 2]);
        expect(res.koPoint).toEqual({ row: 1, col: 2 });
    });

    it('isLegalMove agrees with placeStone', () => {
        const board = emptyBoard(9);
        board[4][4] = 'black';
        expect(isLegalMove(board, 4, 4, 'white')).toBe(false);
        expect(isLegalMove(board, 0, 0, 'white')).toBe(true);
    });

    it('getLegalMoves excludes suicide and ko points', () => {
        const board = emptyBoard(5);
        board[0][1] = 'white';
        board[1][0] = 'white';
        // (0,0) 对黑是自杀
        const moves = getLegalMoves(board, 'black');
        expect(moves.find((m) => m.row === 0 && m.col === 0)).toBeUndefined();
        // 其他位置都应合法
        expect(moves.length).toBe(5 * 5 - 2 /* 两个白子 */ - 1 /* (0,0) 自杀 */);
    });

    it('placeStone rejects multi-stone suicide when no opponent captured', () => {
        // 白子围成"凹"形死腔，黑落入最后一气 → 自杀
        //  W W W W
        //  W . . W
        //  W . . W
        //  W W W W
        const b = emptyBoard(6);
        // 用 5x5 区域：边界白子包围中间 2x2
        for (let c = 0; c < 5; c += 1) {
            b[0][c] = 'white';
            b[4][c] = 'white';
        }
        for (let r = 1; r < 4; r += 1) {
            b[r][0] = 'white';
            b[r][4] = 'white';
        }
        // 内部 (1,1)(1,2)(1,3)(2,1)(2,3)(3,1)(3,2)(3,3) 放黑，只留 (2,2) 一气
        b[1][1] = 'black'; b[1][2] = 'black'; b[1][3] = 'black';
        b[2][1] = 'black';                    b[2][3] = 'black';
        b[3][1] = 'black'; b[3][2] = 'black'; b[3][3] = 'black';
        // 黑自己的 group 最后一气在 (2,2)，但这整块黑的外侧还靠白——白活——所以黑已经是 1 气 group
        // 白落 (2,2) → 没有吃黑（黑还能吃就要黑气=0），白落后黑 group 气变 0 提走
        // 反过来，若黑落 (2,2) 填自己最后一气：黑 group 气=0，且无吃白
        const suicideResult = placeStone(b, 2, 2, 'black');
        expect(suicideResult.legal).toBe(false);
        expect(suicideResult.reason).toBe('suicide');
    });

    it('placeStone allows move that captures multi-stone opponent group', () => {
        // 黑群 (0,0)(0,1) 共 2 子，白封锁三面只留 (1,0) 一气；白落 (1,0) → 提 2 子
        const b = emptyBoard(5);
        b[0][0] = 'black'; b[0][1] = 'black';
        b[0][2] = 'white'; // 右气
        b[1][1] = 'white'; // 下气
        // (1,0) 是黑群最后一气
        const result = placeStone(b, 1, 0, 'white');
        expect(result.legal).toBe(true);
        expect(result.captured).toHaveLength(2);
        expect(result.captured).toContainEqual([0, 0]);
        expect(result.captured).toContainEqual([0, 1]);
        expect(result.board[0][0]).toBeNull();
        expect(result.board[0][1]).toBeNull();
    });

    it('placeStone ko rule: captured stone position cannot be immediately retaken', () => {
        const b = Array.from({ length: 5 }, () => Array(5).fill(null));
        b[0][1] = 'white'; b[0][2] = 'black';
        b[1][0] = 'white'; b[1][2] = 'white'; b[1][3] = 'black';
        b[2][1] = 'white'; b[2][2] = 'black';
        const res = placeStone(b, 1, 1, 'black');
        // 下一手白若想立刻回提 (1,2)（被黑提走的位置），应被 ko 拒绝
        const retake = placeStone(res.board, 1, 2, 'white', { koPoint: res.koPoint });
        expect(retake.legal).toBe(false);
        expect(retake.reason).toBe('ko');
    });

    it('placeStone does not set koPoint when capture count is not exactly 1', () => {
        // 同时吃两颗白子，不设 ko
        const b = emptyBoard(5);
        b[0][0] = 'white'; b[0][1] = 'white';
        b[0][2] = 'black'; // 右气
        b[1][1] = 'black'; // 下气
        // (1,0) 是白群最后一气
        const res = placeStone(b, 1, 0, 'black');
        expect(res.legal).toBe(true);
        expect(res.captured.length).toBe(2);
        expect(res.koPoint).toBeNull();
    });

    it('getGroup on an empty point returns that single empty cell', () => {
        // 当前实现：空点起步只收集起点，邻居空点进 libertySet 不进 stack
        const b = emptyBoard(5);
        b[2][2] = 'black';
        const group = getGroup(b, 0, 0);
        expect(group.color).toBeNull();
        expect(group.stones.length).toBe(1);
        // 邻居两个都是空，算作 liberty
        expect(group.libertyCount).toBe(2);
    });

    it('countLiberties returns 0 for a surrounded stone', () => {
        const b = emptyBoard(9);
        b[4][4] = 'black';
        b[3][4] = 'white';
        b[5][4] = 'white';
        b[4][3] = 'white';
        b[4][5] = 'white';
        expect(countLiberties(b, 4, 4)).toBe(0);
    });

    it('placeStone with allowSuicide option permits self-capture', () => {
        const b = emptyBoard(5);
        b[0][1] = 'white';
        b[1][0] = 'white';
        const res = placeStone(b, 0, 0, 'black', { allowSuicide: true });
        expect(res.legal).toBe(true);
    });

    it('isEmptyBoard returns true for empty board', () => {
        expect(isEmptyBoard(emptyBoard(9))).toBe(true);
        expect(isEmptyBoard(emptyBoard(13))).toBe(true);
        expect(isEmptyBoard(emptyBoard(19))).toBe(true);
    });

    it('isEmptyBoard returns false when any stone is on board', () => {
        const b = emptyBoard(9);
        b[4][4] = 'black';
        expect(isEmptyBoard(b)).toBe(false);
    });

    it('isEmptyBoard returns false for full board', () => {
        const b = Array.from({ length: 5 }, () => Array(5).fill('black'));
        expect(isEmptyBoard(b)).toBe(false);
    });

    it('getNeighbors returns correct counts for all board positions', () => {
        // 角: 2 邻
        expect(getNeighbors(9, 0, 0)).toHaveLength(2);
        expect(getNeighbors(9, 0, 8)).toHaveLength(2);
        expect(getNeighbors(9, 8, 0)).toHaveLength(2);
        expect(getNeighbors(9, 8, 8)).toHaveLength(2);
        // 边 (非角): 3 邻
        expect(getNeighbors(9, 0, 4)).toHaveLength(3);
        expect(getNeighbors(9, 4, 0)).toHaveLength(3);
        expect(getNeighbors(9, 8, 4)).toHaveLength(3);
        expect(getNeighbors(9, 4, 8)).toHaveLength(3);
        // 中心: 4 邻
        expect(getNeighbors(9, 4, 4)).toHaveLength(4);
    });

    it('getGroup correctly identifies a larger connected group', () => {
        // 2x2 黑块: 有 4+4-重复边 = 8气? 实际上 2x2 块共 8 气
        const b = emptyBoard(9);
        b[3][3] = 'black'; b[3][4] = 'black';
        b[4][3] = 'black'; b[4][4] = 'black';
        const group = getGroup(b, 3, 3);
        expect(group.color).toBe('black');
        expect(group.stones).toHaveLength(4);
        // 2x2 块: 内边无气，外侧有 4*2+2 = 10? 不对, 2x2 方块有 (2+2+2+2) - 4 = 8
        // 实际上: 2x2 块占据 (3,3)(3,4)(4,3)(4,4), 周围空点:
        // 上(2,3)(2,4), 下(5,3)(5,4), 左(3,2)(4,2), 右(3,5)(4,5) = 8
        expect(group.libertyCount).toBe(8);
    });

    it('getGroup with empty-start collects single cell', () => {
        const b = emptyBoard(9);
        const group = getGroup(b, 0, 0);
        expect(group.color).toBeNull();
        expect(group.stones).toHaveLength(1);
    });

    it('capture in corner removes opponent stone', () => {
        // 白 (0,0) 角部，仅剩 (1,0) 一气；黑落 (1,0) → 提白子
        const b = emptyBoard(5);
        b[0][0] = 'white';
        b[0][1] = 'black';
        const res = placeStone(b, 1, 0, 'black');
        expect(res.legal).toBe(true);
        expect(res.captured).toHaveLength(1);
        expect(res.captured).toContainEqual([0, 0]);
    });

    it('placeStone returns occupied for out-of-bounds coordinates', () => {
        const b = emptyBoard(9);
        const res = placeStone(b, -1, 0, 'black');
        expect(res.legal).toBe(false);
        expect(res.reason).toBe('occupied');
    });

    it('isLegalMove returns true for valid empty intersection', () => {
        const b = emptyBoard(9);
        expect(isLegalMove(b, 4, 4, 'black')).toBe(true);
    });

    it('isLegalMove returns false for occupied intersection', () => {
        const b = emptyBoard(9);
        b[4][4] = 'black';
        expect(isLegalMove(b, 4, 4, 'white')).toBe(false);
    });

    it('getLegalMoves returns correct count for empty board', () => {
        const moves = getLegalMoves(emptyBoard(9), 'black');
        expect(moves).toHaveLength(81);
    });

    it('getLegalMoves excludes occupied positions', () => {
        const b = emptyBoard(5);
        b[0][0] = 'black';
        b[4][4] = 'white';
        const moves = getLegalMoves(b, 'black');
        // 25 - 2 occupied = 23, but some might be suicide
        expect(moves.length).toBeLessThanOrEqual(23);
        expect(moves.find((m) => m.row === 0 && m.col === 0)).toBeUndefined();
    });

    it('getLegalMoves respects ko point', () => {
        // 构造劫形后，下一手的 ko 点应从 legal moves 排除
        const b = Array.from({ length: 5 }, () => Array(5).fill(null));
        b[0][1] = 'white'; b[0][2] = 'black';
        b[1][0] = 'white'; b[1][2] = 'white'; b[1][3] = 'black';
        b[2][1] = 'white'; b[2][2] = 'black';
        const res = placeStone(b, 1, 1, 'black');
        // 白下一步不能落在 (1,2)
        const whiteMoves = getLegalMoves(res.board, 'white', { koPoint: res.koPoint });
        expect(whiteMoves.find((m) => m.row === 1 && m.col === 2)).toBeUndefined();
        // 但 (1,2) 以外其它空位应该合法
        expect(whiteMoves.length).toBeGreaterThan(0);
    });

    it('placeStone does not allow move that would fill own eye without capture', () => {
        // 简单自杀检查: 被全包围时不能填眼
        const b = emptyBoard(5);
        // 白围住 (1,1)
        b[0][1] = 'white'; b[1][0] = 'white'; b[1][2] = 'white'; b[2][1] = 'white';
        const res = placeStone(b, 1, 1, 'black');
        expect(res.legal).toBe(false);
        expect(res.reason).toBe('suicide');
    });
});
