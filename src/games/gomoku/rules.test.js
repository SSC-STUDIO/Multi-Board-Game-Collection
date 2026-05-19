import { describe, it, expect } from 'vitest';
import {
    checkWin, getWinningLine, wouldWin, hasOverline,
    getForbiddenReason, countOpenPatterns, getLineInfo, getLineString,
} from './rules.js';
import { isBoardFull } from '../../utils/board.js';

const S = 15;
function makeBoard() { return Array.from({ length: S }, () => Array(S).fill(null)); }
function setStones(board, stones) { for (const [r, c, color] of stones) board[r][c] = color; return board; }

describe('checkWin', () => {
    it('detects horizontal win', () => {
        const board = makeBoard();
        setStones(board, [[7,5,'black'],[7,6,'black'],[7,7,'black'],[7,8,'black'],[7,9,'black']]);
        expect(checkWin(board, S, 7, 7, 'black')).toBe(true);
    });
    it('detects vertical win', () => {
        const board = makeBoard();
        setStones(board, [[5,7,'black'],[6,7,'black'],[7,7,'black'],[8,7,'black'],[9,7,'black']]);
        expect(checkWin(board, S, 7, 7, 'black')).toBe(true);
    });
    it('detects diagonal win', () => {
        const board = makeBoard();
        setStones(board, [[3,3,'white'],[4,4,'white'],[5,5,'white'],[6,6,'white'],[7,7,'white']]);
        expect(checkWin(board, S, 5, 5, 'white')).toBe(true);
    });
    it('returns false for four in a row', () => {
        const board = makeBoard();
        setStones(board, [[7,5,'black'],[7,6,'black'],[7,7,'black'],[7,8,'black']]);
        expect(checkWin(board, S, 7, 7, 'black')).toBe(false);
    });
    it('returns false for empty board', () => {
        expect(checkWin(makeBoard(), S, 7, 7, 'black')).toBe(false);
    });
    it('detects long connection as win', () => {
        const board = makeBoard();
        setStones(board, [[7,4,'black'],[7,5,'black'],[7,6,'black'],[7,7,'black'],[7,8,'black'],[7,9,'black']]);
        expect(checkWin(board, S, 7, 7, 'black')).toBe(true);
    });
});

describe('getWinningLine', () => {
    it('returns correct coordinates for horizontal win', () => {
        const board = makeBoard();
        setStones(board, [[7,5,'black'],[7,6,'black'],[7,7,'black'],[7,8,'black'],[7,9,'black']]);
        const line = getWinningLine(board, S, 7, 7, 'black');
        expect(line.length).toBe(5);
    });
    it('returns empty array when no win', () => {
        const board = makeBoard();
        setStones(board, [[7,5,'black'],[7,6,'black'],[7,7,'black']]);
        expect(getWinningLine(board, S, 7, 7, 'black')).toEqual([]);
    });
    it('handles corner win', () => {
        const board = makeBoard();
        setStones(board, [[0,0,'white'],[1,1,'white'],[2,2,'white'],[3,3,'white'],[4,4,'white']]);
        expect(getWinningLine(board, S, 2, 2, 'white').length).toBe(5);
    });
});

describe('wouldWin', () => {
    it('returns true when placing stone creates win', () => {
        const board = makeBoard();
        setStones(board, [[7,5,'black'],[7,6,'black'],[7,7,'black'],[7,8,'black']]);
        expect(wouldWin(board, S, 7, 9, 'black')).toBe(true);
    });
    it('returns false when no win', () => {
        const board = makeBoard();
        setStones(board, [[7,5,'black'],[7,6,'black'],[7,7,'black']]);
        expect(wouldWin(board, S, 7, 8, 'black')).toBe(false);
    });
    it('does not mutate original board', () => {
        const board = makeBoard();
        setStones(board, [[7,5,'black'],[7,6,'black'],[7,7,'black'],[7,8,'black']]);
        const orig = board.map(r => [...r]);
        wouldWin(board, S, 7, 9, 'black');
        expect(board).toEqual(orig);
    });
});

describe('hasOverline', () => {
    it('returns true for 6+ in a row', () => {
        const board = makeBoard();
        setStones(board, [[7,4,'black'],[7,5,'black'],[7,6,'black'],[7,7,'black'],[7,8,'black'],[7,9,'black']]);
        expect(hasOverline(board, S, 7, 7, 'black')).toBe(true);
    });
    it('returns false for exactly 5', () => {
        const board = makeBoard();
        setStones(board, [[7,5,'black'],[7,6,'black'],[7,7,'black'],[7,8,'black'],[7,9,'black']]);
        expect(hasOverline(board, S, 7, 7, 'black')).toBe(false);
    });
});

describe('getForbiddenReason', () => {
    it('returns empty for white', () => {
        expect(getForbiddenReason(makeBoard(), S, 'renju', 7, 7, 'white')).toBe('');
    });
    it('returns empty for classic rule', () => {
        expect(getForbiddenReason(makeBoard(), S, 'classic', 7, 7, 'black')).toBe('');
    });
    it('returns empty for occupied cell', () => {
        const board = makeBoard(); board[7][7] = 'black';
        expect(getForbiddenReason(board, S, 'renju', 7, 7, 'black')).toBe('');
    });
    it('returns empty for non-forbidden position', () => {
        const board = makeBoard(); board[0][0] = 'black'; board[0][1] = 'white';
        expect(getForbiddenReason(board, S, 'renju', 7, 7, 'black')).toBe('');
    });
});

describe('isBoardFull', () => {
    it('returns false for empty board', () => { expect(isBoardFull(makeBoard(), S)).toBe(false); });
    it('returns true when full', () => { expect(isBoardFull(Array.from({length:S},()=>Array(S).fill('black')), S)).toBe(true); });
    it('returns false for partial', () => { const b = makeBoard(); b[0][0]='black'; expect(isBoardFull(b, S)).toBe(false); });
});

describe('getLineInfo', () => {
    it('counts consecutive stones', () => {
        const board = makeBoard();
        setStones(board, [[7,5,'black'],[7,6,'black'],[7,7,'black']]);
        expect(getLineInfo(board, S, 7, 7, 0, 1, 'black').count).toBe(3);
    });
    it('counts open ends', () => {
        const board = makeBoard();
        setStones(board, [[7,5,'black'],[7,6,'black'],[7,7,'black']]);
        expect(getLineInfo(board, S, 7, 7, 0, 1, 'black').openEnds).toBe(2);
    });
    it('detects blocked end', () => {
        const board = makeBoard();
        setStones(board, [[7,5,'black'],[7,6,'black'],[7,7,'black'],[7,8,'white']]);
        expect(getLineInfo(board, S, 7, 7, 0, 1, 'black').openEnds).toBe(1);
    });
});

describe('getLineString', () => {
    it('generates correct pattern', () => {
        const board = makeBoard();
        setStones(board, [[7,7,'black'],[7,8,'black'],[7,9,'black']]);
        const line = getLineString(board, S, 7, 8, 0, 1, 'black');
        expect(line).toContain('X');
        expect(line[5]).toBe('X');
    });
});
