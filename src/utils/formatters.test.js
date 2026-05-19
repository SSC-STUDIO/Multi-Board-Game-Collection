import { describe, it, expect } from 'vitest';
import { getPlayerLabel, formatMove } from './formatters.js';

// ---------------------------------------------------------------------------
// getPlayerLabel
// ---------------------------------------------------------------------------
describe('getPlayerLabel', () => {
    it('should return a non-empty string for black', () => {
        const label = getPlayerLabel('black');
        expect(typeof label).toBe('string');
        expect(label.length).toBeGreaterThan(0);
    });

    it('should return a non-empty string for white', () => {
        const label = getPlayerLabel('white');
        expect(typeof label).toBe('string');
        expect(label.length).toBeGreaterThan(0);
    });
});

// ---------------------------------------------------------------------------
// formatMove
// ---------------------------------------------------------------------------
describe('formatMove', () => {
    it('should format center of 15x15 board as H8', () => {
        expect(formatMove(7, 7)).toBe('H8');
    });

    it('should format top-left corner as A1', () => {
        expect(formatMove(0, 0)).toBe('A1');
    });

    it('should skip column I (standard Go convention)', () => {
        // COLUMN_LABELS = 'ABCDEFGHJKLMNOPQRST'
        // index 8 = 'J' (I is skipped)
        expect(formatMove(0, 8)).toBe('J1');
    });

    it('should format row as 1-indexed', () => {
        expect(formatMove(4, 0)).toBe('A5');
    });

    it('should handle 19x19 board edge (col 18 = T)', () => {
        expect(formatMove(18, 18)).toBe('T19');
    });

    it('should fallback to C{n} label for out-of-range column', () => {
        // col 20 is past COLUMN_LABELS ('ABCDEFGHJKLMNOPQRST', length 20)
        // fallback: `C${col + 1}` = 'C21', then `${column}${row + 1}` = 'C211'
        expect(formatMove(0, 20)).toBe('C211');
    });
});
