import { describe, it, expect } from 'vitest';
import { isInside, getOpponent, isBoardFull, getStarPoints, getResponsiveCellSize } from './board.js';

// ---------------------------------------------------------------------------
// isInside
// ---------------------------------------------------------------------------
describe('isInside', () => {
    it('should return true for valid coordinates', () => {
        expect(isInside(15, 7, 7)).toBe(true);
    });

    it('should return false for negative row', () => {
        expect(isInside(15, -1, 5)).toBe(false);
    });

    it('should return false for negative col', () => {
        expect(isInside(15, 5, -1)).toBe(false);
    });

    it('should return false for row >= size', () => {
        expect(isInside(15, 15, 5)).toBe(false);
    });

    it('should return false for col >= size', () => {
        expect(isInside(15, 5, 15)).toBe(false);
    });

    it('should return true for corner (0,0)', () => {
        expect(isInside(15, 0, 0)).toBe(true);
    });

    it('should return true for last valid cell (size-1, size-1)', () => {
        expect(isInside(15, 14, 14)).toBe(true);
    });

    it('should work with size 19', () => {
        expect(isInside(19, 18, 18)).toBe(true);
        expect(isInside(19, 19, 0)).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// getOpponent
// ---------------------------------------------------------------------------
describe('getOpponent', () => {
    it('should return white for black', () => {
        expect(getOpponent('black')).toBe('white');
    });

    it('should return black for white', () => {
        expect(getOpponent('white')).toBe('black');
    });
});

// ---------------------------------------------------------------------------
// isBoardFull
// ---------------------------------------------------------------------------
describe('isBoardFull', () => {
    it('should return false for empty board', () => {
        const board = Array.from({ length: 15 }, () => Array(15).fill(null));
        expect(isBoardFull(board)).toBe(false);
    });

    it('should return true when all cells filled', () => {
        const board = Array.from({ length: 3 }, () => Array(3).fill('black'));
        expect(isBoardFull(board)).toBe(true);
    });

    it('should return false when one cell is null', () => {
        const board = Array.from({ length: 3 }, () => Array(3).fill('white'));
        board[1][1] = null;
        expect(isBoardFull(board)).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// getStarPoints
// ---------------------------------------------------------------------------
describe('getStarPoints', () => {
    it('should return 9 points for 15x15 board', () => {
        const stars = getStarPoints(15);
        expect(stars.size).toBe(9);
    });

    it('should contain correct positions for 15x15 board', () => {
        const stars = getStarPoints(15);
        expect(stars.has('3,3')).toBe(true);
        expect(stars.has('3,7')).toBe(true);
        expect(stars.has('3,11')).toBe(true);
        expect(stars.has('7,3')).toBe(true);
        expect(stars.has('7,7')).toBe(true);
        expect(stars.has('7,11')).toBe(true);
        expect(stars.has('11,3')).toBe(true);
        expect(stars.has('11,7')).toBe(true);
        expect(stars.has('11,11')).toBe(true);
    });

    it('should return 9 points for 19x19 board', () => {
        const stars = getStarPoints(19);
        expect(stars.size).toBe(9);
    });

    it('should contain correct positions for 19x19 board', () => {
        const stars = getStarPoints(19);
        expect(stars.has('3,3')).toBe(true);
        expect(stars.has('3,9')).toBe(true);
        expect(stars.has('3,15')).toBe(true);
        expect(stars.has('9,9')).toBe(true);
        expect(stars.has('15,15')).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// getResponsiveCellSize
// ---------------------------------------------------------------------------
describe('getResponsiveCellSize', () => {
    it('should return 18px for small viewport (<=380) on 15x15 board', () => {
        expect(getResponsiveCellSize(15, 320)).toBe('18px');
        expect(getResponsiveCellSize(15, 380)).toBe('18px');
    });

    it('should return 30px for large viewport (>900) on 15x15 board', () => {
        expect(getResponsiveCellSize(15, 1200)).toBe('30px');
        expect(getResponsiveCellSize(15, 1920)).toBe('30px');
    });

    it('should return 16px for small viewport on 19x19 board', () => {
        expect(getResponsiveCellSize(19, 320)).toBe('16px');
        expect(getResponsiveCellSize(19, 380)).toBe('16px');
    });

    it('should return 28px for large viewport on 19x19 board', () => {
        expect(getResponsiveCellSize(19, 1200)).toBe('28px');
    });

    it('should return smaller cells for 19x19 than 15x15 at same viewport', () => {
        const size15 = parseInt(getResponsiveCellSize(15, 640), 10);
        const size19 = parseInt(getResponsiveCellSize(19, 640), 10);
        expect(size19).toBeLessThan(size15);
    });

    it('should handle mid-range viewport (481-640) for 15x15', () => {
        expect(getResponsiveCellSize(15, 550)).toBe('22px');
    });

    it('should handle mid-range viewport (641-900) for 15x15', () => {
        expect(getResponsiveCellSize(15, 768)).toBe('26px');
    });

    it('should handle mid-range viewport (481-640) for 19x19', () => {
        expect(getResponsiveCellSize(19, 550)).toBe('20px');
    });
});
