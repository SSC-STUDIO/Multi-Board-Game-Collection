import { describe, it, expect } from 'vitest';
import { getStarPoints } from './GoRenderer3D.js';

describe('games/go/render3d/getStarPoints', () => {
    it('19 路返回 9 个星位', () => {
        const stars = getStarPoints(19);
        expect(stars).toHaveLength(9);
        expect(stars).toContainEqual({ row: 9, col: 9 });
        expect(stars).toContainEqual({ row: 3, col: 3 });
        expect(stars).toContainEqual({ row: 15, col: 15 });
    });

    it('13 路返回 9 个星位（角星与中心）', () => {
        const stars = getStarPoints(13);
        expect(stars).toHaveLength(9);
        expect(stars).toContainEqual({ row: 6, col: 6 });
        expect(stars).toContainEqual({ row: 3, col: 3 });
        expect(stars).toContainEqual({ row: 9, col: 9 });
    });

    it('9 路返回 9 个星位（含三三和天元）', () => {
        const stars = getStarPoints(9);
        expect(stars).toHaveLength(9);
        expect(stars).toContainEqual({ row: 4, col: 4 });
        expect(stars).toContainEqual({ row: 2, col: 2 });
        expect(stars).toContainEqual({ row: 6, col: 6 });
    });

    it('所有星位都在棋盘范围内', () => {
        for (const size of [9, 13, 19]) {
            const stars = getStarPoints(size);
            stars.forEach(({ row, col }) => {
                expect(row).toBeGreaterThanOrEqual(0);
                expect(row).toBeLessThan(size);
                expect(col).toBeGreaterThanOrEqual(0);
                expect(col).toBeLessThan(size);
            });
        }
    });
});
