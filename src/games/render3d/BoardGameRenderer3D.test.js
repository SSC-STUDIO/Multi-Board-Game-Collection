import { describe, it, expect, vi } from 'vitest';

vi.mock('three', () => {
    const noop = () => {};
    const D = function() {};
    D.prototype = {};
    const t = {
        BufferGeometry: D, BufferAttribute: D, PointsMaterial: D, Points: D,
        Float32Array: globalThis.Float32Array,
        Color: function(r, g, b) { this.r = r; this.g = g; this.b = b; },
        AdditiveBlending: 1, DoubleSide: 2,
        Vector3: function(x, y, z) { this.x = x; this.y = y; this.z = z; },
        Vector2: function(x, y) { this.x = x; this.y = y; },
        Raycaster: D, Shape: D, ShapeGeometry: D, ExtrudeGeometry: D,
        Mesh: D, Group: D, BoxGeometry: D, CylinderGeometry: D,
        CircleGeometry: D, SphereGeometry: D, PlaneGeometry: D, TorusGeometry: D,
        MeshStandardMaterial: D, MeshBasicMaterial: D, MeshLambertMaterial: D,
        DirectionalLight: D, AmbientLight: D, FogExp2: D,
        Texture: D, CanvasTexture: D, SRGBColorSpace: 'srgb',
    };
    return Object.assign(t, { __esModule: true, default: t });
});

vi.mock('../../render3d/index.js', () => {
    const noop = () => {};
    function SM() {
        this.scene = { add: noop, remove: noop, traverse: vi.fn(), fog: null };
        this.renderer = { render: noop, domElement: { width: 800, height: 600, addEventListener: noop } };
        this.camera = { position: { set: noop, x: 0, y: 5, z: 5 }, lookAt: noop, updateProjectionMatrix: noop, aspect: 1, fov: 75, near: 0.1, far: 1000 };
        this.config = { board: { cellSize: 0.4 }, stone: { height: 0.2 } };
        this.controls = { minDistance: 1, maxDistance: 100, target: { set: noop, x: 0, y: 0, z: 0 }, enableDamping: true, dampingFactor: 0.1, update: noop };
        this.startRenderLoop = noop; this.stopRenderLoop = noop; this.handleResize = noop;
        this.setNeedsRender = noop; this.dispose = noop; this.onBeforeRender = null;
    }
    SM.isWebGLAvailable = () => true;
    return {
        SceneManager: SM,
        LightingSetup: vi.fn(function() { this.setup = noop; this.setPresentationMode = noop; this.dispose = noop; }),
        CameraController: vi.fn(function() {
            this.setScenePreset = noop; this.setPresentationMode = noop;
            this.fitToBoard = noop; this.dispose = noop; this.applyView = noop;
        }),
        MaterialFactory: vi.fn(function() { this.getStoneMaterial = vi.fn(() => ({})); this.dispose = noop; }),
        StoneBuilder: vi.fn(function() {
            this.createStonesGroup = vi.fn(() => ({ add: noop, traverse: vi.fn() }));
            this.stonesGroup = { add: noop, remove: noop, children: [], getObjectByName: vi.fn() };
            this.getStoneGeometry = vi.fn(() => ({})); this.dispose = noop;
        }),
        AnimationManager: vi.fn(function() { this.playDropAnimation = noop; this.dispose = noop; }),
        ParticleSystem: vi.fn(function() {
            this.emitShatterEffect = vi.fn(); this.emitDropParticles = vi.fn();
            this.emitAmbientParticles = noop; this.update = noop; this.dispose = noop;
        }),
    };
});

vi.mock('../../../config/renderConfig.js', () => ({
    boardToWorld: (row, col, boardSize, cellSize) => ({ x: col * cellSize, z: row * cellSize }),
    worldToBoard: (x, z, boardSize, cellSize) => ({ row: Math.round(z / cellSize), col: Math.round(x / cellSize) }),
}));

import { BoardGameRenderer3D } from './BoardGameRenderer3D.js';

function createPartialRenderer(rows = 8, cols = 8) {
    const container = document.createElement('div');
    const r = Object.create(BoardGameRenderer3D.prototype);
    r.container = container;
    r.rows = rows;
    r.cols = cols;
    r.cellSize = 0.4;
    r.pieceStyle = { height: 0.3 };
    r.boardStyle = { tileHeight: 0.075, baseHeight: 0.28, bevelRadius: 0.075, surfaceInset: 0.04 };
    r.theme = {};
    r.sceneManager = { scene: { add: () => {} } };
    r.particleSystem = null;
    r.coord = (row, col) => ({ x: col * 0.4, z: row * 0.4 });
    return r;
}

describe('BoardGameRenderer3D', () => {
    describe('showVictory', () => {
        it('should call emitShatterEffect with converted positions', () => {
            const r = createPartialRenderer();
            r.particleSystem = { emitShatterEffect: vi.fn() };
            r.showVictory('white', [{ row: 0, col: 0 }, { row: 1, col: 1 }]);
            expect(r.particleSystem.emitShatterEffect).toHaveBeenCalledOnce();
            const [positions, color] = r.particleSystem.emitShatterEffect.mock.calls[0];
            expect(color).toBe('white');
            expect(positions).toHaveLength(2);
            expect(positions[0]).toHaveProperty('x');
            expect(positions[0]).toHaveProperty('y');
            expect(positions[0]).toHaveProperty('z');
        });

        it('should not call emitShatterEffect if no positions', () => {
            const r = createPartialRenderer();
            r.particleSystem = { emitShatterEffect: vi.fn() };
            r.showVictory('white', []);
            expect(r.particleSystem.emitShatterEffect).not.toHaveBeenCalled();
        });

        it('should not throw if particleSystem is null', () => {
            const r = createPartialRenderer();
            r.particleSystem = null;
            expect(() => r.showVictory('white', [{ row: 0, col: 0 }])).not.toThrow();
        });
    });

    describe('showVictoryCelebration', () => {
        it('should call emitShatterEffect with grid positions', () => {
            const r = createPartialRenderer();
            r.particleSystem = { emitShatterEffect: vi.fn() };
            r.showVictoryCelebration('black');
            expect(r.particleSystem.emitShatterEffect).toHaveBeenCalledOnce();
            const [positions, color] = r.particleSystem.emitShatterEffect.mock.calls[0];
            expect(color).toBe('black');
            expect(positions.length).toBeGreaterThan(0);
            positions.forEach(pos => {
                expect(pos).toHaveProperty('x');
                expect(pos).toHaveProperty('y');
                expect(pos).toHaveProperty('z');
            });
        });

        it('should not throw if particleSystem is null', () => {
            const r = createPartialRenderer();
            r.particleSystem = null;
            expect(() => r.showVictoryCelebration('white')).not.toThrow();
        });

        it('should produce positions for a 1x1 board', () => {
            const r = createPartialRenderer(1, 1);
            r.particleSystem = { emitShatterEffect: vi.fn() };
            r.showVictoryCelebration('white');
            expect(r.particleSystem.emitShatterEffect).toHaveBeenCalledOnce();
            const [positions] = r.particleSystem.emitShatterEffect.mock.calls[0];
            expect(positions.length).toBeGreaterThanOrEqual(1);
        });
    });
});
