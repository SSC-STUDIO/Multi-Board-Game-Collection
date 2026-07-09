import { describe, it, expect } from 'vitest';
import {
    RENDER_CONFIG,
    getBoardOffset,
    boardToWorld,
    worldToBoard
} from './renderConfig.js';

describe('config/renderConfig', () => {
    describe('RENDER_CONFIG structure', () => {
        it('has all expected top-level sections', () => {
            const keys = ['board', 'stone', 'camera', 'lighting', 'colors', 'animation', 'renderer', 'highQuality', 'mobileQuality', 'lowQuality', 'extremeLowQuality', 'environment'];
            for (const k of keys) {
                expect(RENDER_CONFIG).toHaveProperty(k);
            }
        });

        it('board has positive size and cellSize', () => {
            expect(RENDER_CONFIG.board.size).toBeGreaterThan(0);
            expect(RENDER_CONFIG.board.cellSize).toBeGreaterThan(0);
        });

        it('quality tiers override shadowMapSize', () => {
            expect(RENDER_CONFIG.highQuality.shadowMapSize).toBeGreaterThanOrEqual(1024);
            expect(RENDER_CONFIG.extremeLowQuality.shadowMapSize).toBeLessThan(RENDER_CONFIG.highQuality.shadowMapSize);
        });
    });

    describe('getBoardOffset', () => {
        it('returns 0 for a 1x1 board', () => {
            expect(getBoardOffset(1, 1)).toBe(0);
        });

        it('returns half board width for 15x15 default board', () => {
            const cellSize = 1.0;
            expect(getBoardOffset(15, cellSize)).toBe(7);
        });

        it('scales with cellSize', () => {
            expect(getBoardOffset(3, 2.0)).toBe(2.0);
        });
    });

    describe('boardToWorld', () => {
        const size = 15;
        const cellSize = 1.0;

        it('center cell (7,7) maps to near origin', () => {
            const pos = boardToWorld(7, 7, size, cellSize);
            expect(pos.x).toBeCloseTo(0);
            expect(pos.z).toBeCloseTo(0);
        });

        it('top-left cell (0,0) maps to negative offset', () => {
            const pos = boardToWorld(0, 0, size, cellSize);
            expect(pos.x).toBeCloseTo(-7);
            expect(pos.z).toBeCloseTo(-7);
        });

        it('bottom-right cell (14,14) maps to positive offset', () => {
            const pos = boardToWorld(14, 14, size, cellSize);
            expect(pos.x).toBeCloseTo(7);
            expect(pos.z).toBeCloseTo(7);
        });

        it('x is determined by col, z is determined by row', () => {
            const pos = boardToWorld(3, 5, 15, 1.0);
            expect(pos.x).toBeCloseTo(5 - 7);
            expect(pos.z).toBeCloseTo(3 - 7);
        });
    });

    describe('worldToBoard', () => {
        const size = 15;
        const cellSize = 1.0;

        it('center of board returns (7,7)', () => {
            const pos = worldToBoard(0, 0, size, cellSize);
            expect(pos).toEqual({ row: 7, col: 7 });
        });

        it('returns null for out-of-bounds x', () => {
            expect(worldToBoard(100, 0, size, cellSize)).toBeNull();
            expect(worldToBoard(-100, 0, size, cellSize)).toBeNull();
        });

        it('returns null for out-of-bounds z', () => {
            expect(worldToBoard(0, 100, size, cellSize)).toBeNull();
            expect(worldToBoard(0, -100, size, cellSize)).toBeNull();
        });

        it('rounds to nearest cell', () => {
            const pos = worldToBoard(0.3, 0.3, size, cellSize);
            expect(pos).toEqual({ row: 7, col: 7 });
        });

        it('is inverse of boardToWorld', () => {
            for (const row of [0, 3, 7, 14]) {
                for (const col of [0, 5, 7, 14]) {
                    const world = boardToWorld(row, col, size, cellSize);
                    const back = worldToBoard(world.x, world.z, size, cellSize);
                    expect(back).toEqual({ row, col });
                }
            }
        });

        it('allows clicks slightly outside the board edge (outer half-cell tolerance)', () => {
            const offset = 7;
            // x just past the last column center
            const pos = worldToBoard(offset + cellSize * 0.49, 0, size, cellSize);
            expect(pos).toEqual({ row: 7, col: 14 });
        });

        it('rejects clicks far outside the board edge', () => {
            const pos = worldToBoard(10, 10, size, cellSize);
            expect(pos).toBeNull();
        });
    });
});
