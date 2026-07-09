import { describe, it, expect, vi } from 'vitest';

// MaterialFactory depends on THREE + canvas — stub them at import time
vi.mock('three', () => {
    class FakeMaterial { clone() { return new FakeMaterial(); } }
    return {
        SRGBColorSpace: 'srgb',
        ClampToEdgeWrapping: 1000,
        LinearMipmapLinearFilter: 1001,
        LinearFilter: 1002,
        FrontSide: 0,
        BackSide: 1,
        MeshStandardMaterial: FakeMaterial,
        MeshPhysicalMaterial: FakeMaterial,
        LineBasicMaterial: FakeMaterial,
        CanvasTexture: class {
            constructor() { this.colorSpace = null; this.anisotropy = 0; this.wrapS = null; this.wrapT = null; this.minFilter = null; this.magFilter = null; this.generateMipmaps = false; this.needsUpdate = false; }
            set() {}
            dispose() {}
        },
        Color: class { constructor() {} },
    };
});

vi.mock('../config/renderConfig.js', () => ({
    RENDER_CONFIG: {
        board: {
            size: 19,
            borderWidth: 1,
            textureSizeCap: 512,
        },
    },
}));

const { MaterialFactory } = await import('./MaterialFactory.js');

describe('MaterialFactory', () => {
    describe('constructor', () => {
        it('should use provided config and default maxAnisotropy', () => {
            const factory = new MaterialFactory();
            expect(factory.config).toBeDefined();
            expect(factory.maxAnisotropy).toBe(1);
            expect(factory.cache).toBeInstanceOf(Map);
        });

        it('should accept custom maxAnisotropy', () => {
            const factory = new MaterialFactory({}, { maxAnisotropy: 16 });
            expect(factory.maxAnisotropy).toBe(16);
        });
    });

    describe('getOrCreate', () => {
        it('should return the same material for the same key', () => {
            const factory = new MaterialFactory();
            const mat = { type: 'test-mat' };
            const createFn = vi.fn(() => mat);

            const first = factory.getOrCreate('k1', createFn);
            const second = factory.getOrCreate('k1', createFn);

            expect(first).toBe(mat);
            expect(second).toBe(mat);
            expect(createFn).toHaveBeenCalledTimes(1);
        });

        it('should create separate materials for different keys', () => {
            const factory = new MaterialFactory();
            const mat1 = { id: 1 };
            const mat2 = { id: 2 };

            const first = factory.getOrCreate('a', () => mat1);
            const second = factory.getOrCreate('b', () => mat2);

            expect(first).toBe(mat1);
            expect(second).toBe(mat2);
        });
    });

    describe('createBoardMaterial', () => {
        it('should create a material for a given board size', () => {
            const factory = new MaterialFactory();
            // Stub document.createElement so canvas and its 2D context work
            const origCreateElement = document.createElement;
            const mockCtx = {
                createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
                fillRect: vi.fn(),
                fillText: vi.fn(),
                measureText: vi.fn(() => ({ width: 10 })),
                beginPath: vi.fn(),
                moveTo: vi.fn(),
                bezierCurveTo: vi.fn(),
                lineTo: vi.fn(),
                stroke: vi.fn(),
                fill: vi.fn(),
                arc: vi.fn(),
                closePath: vi.fn(),
                setLineDash: vi.fn(),
                save: vi.fn(),
                restore: vi.fn(),
                translate: vi.fn(),
                rotate: vi.fn(),
            };
            document.createElement = vi.fn((tag) => {
                if (tag === 'canvas') {
                    const canvas = { width: 512, height: 512, getContext: vi.fn(() => mockCtx), toDataURL: vi.fn(() => 'data:image/png;base64,') };
                    return canvas;
                }
                return origCreateElement(tag);
            });

            const mat = factory.createBoardMaterial(9);
            expect(mat).toBeDefined();

            document.createElement = origCreateElement;
        });

        it('should return the same material from cache on second call', () => {
            const factory = new MaterialFactory();

            // Pre-seed the cache to verify cache-return logic without canvas
            const preMat = { isMaterial: true };
            factory.cache.set('board_9', preMat);

            const first = factory.createBoardMaterial(9);
            const second = factory.createBoardMaterial(9);
            expect(first).toBe(preMat);
            expect(second).toBe(preMat);
        });
    });
});
