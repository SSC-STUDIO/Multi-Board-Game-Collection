import { describe, it, expect, vi } from 'vitest';

vi.mock('three', () => {
    const noop = () => {};
    const D = function() {
        this.position = { x: 0, y: 0, z: 0, set: function(x,y,z) { this.x=x; this.y=y; this.z=z; } };
        this.rotation = { x: 0, y: 0, z: 0 };
        this.children = [];
    };
    D.prototype.add = function() { for (var i = 0; i < arguments.length; i++) this.children.push(arguments[i]); };
    D.prototype.traverse = function(fn) { fn(this); this.children.forEach(function(c) { if (c && c.traverse) c.traverse(fn); }); };
    D.prototype.rotateX = function() { return this; };
    D.prototype.translate = function() { return this; };
    const S = function() {};
    S.prototype.moveTo = function() {};
    S.prototype.lineTo = function() {};
    S.prototype.quadraticCurveTo = function() {};
    const t = {
        BufferGeometry: D, BufferAttribute: D, PointsMaterial: D, Points: D,
        Float32Array: globalThis.Float32Array,
        Color: function(r, g, b) { this.r = r; this.g = g; this.b = b; },
        AdditiveBlending: 1, DoubleSide: 2,
        Vector3: function(x, y, z) { this.x = x; this.y = y; this.z = z; },
        Vector2: function(x, y) { this.x = x; this.y = y; },
        Raycaster: D, Shape: S, ShapeGeometry: D, ExtrudeGeometry: D,
        Mesh: D, Group: D, BoxGeometry: D, CylinderGeometry: D,
        CircleGeometry: D, SphereGeometry: D, PlaneGeometry: D, TorusGeometry: D,
        MeshStandardMaterial: D, MeshBasicMaterial: D, MeshLambertMaterial: D,
        DirectionalLight: D, AmbientLight: D, FogExp2: D,
        Texture: D, CanvasTexture: D, SRGBColorSpace: 'srgb',
    };
    return Object.assign(t, { __esModule: true, default: t });
});
vi.mock('../../../render3d/index.js', () => {
    const noop = () => {};
    function SM() {
        this.scene = { add: noop, remove: noop, traverse: vi.fn(), fog: null };
        this.renderer = { render: noop, domElement: { width: 800, height: 600, addEventListener: noop } };
        this.camera = { position: { set: noop, x: 0, y: 5, z: 5 }, lookAt: noop, updateProjectionMatrix: noop, aspect: 1, fov: 75, near: 0.1, far: 1000 };
        this.config = { board: { cellSize: 0.4 }, stone: { height: 0.2 } };
        this.controls = { minDistance: 1, maxDistance: 100, target: { set: noop, x: 0, y: 0, z: 0 }, enableDamping: true, dampingFactor: 0.1, update: noop };
        this.startRenderLoop = noop; this.stopRenderLoop = noop; this.handleResize = noop;
        this.setNeedsRender = noop; this.dispose = noop; this.onBeforeRender = null;
        this.add = noop;
    }
    SM.isWebGLAvailable = () => true;
    return {
        SceneManager: SM,
        LightingSetup: vi.fn(function() { this.setup = noop; this.setPresentationMode = noop; this.dispose = noop; }),
        CameraController: vi.fn(function() { this.setScenePreset = noop; this.setPresentationMode = noop; this.fitToBoard = noop; this.dispose = noop; this.applyView = noop; }),
        MaterialFactory: vi.fn(function() { this.getStoneMaterial = vi.fn(() => ({})); this.dispose = noop; }),
        StoneBuilder: vi.fn(function() { this.createStonesGroup = vi.fn(() => ({ add: noop, traverse: vi.fn() })); this.stonesGroup = { add: noop, remove: noop, children: [], getObjectByName: vi.fn() }; this.getStoneGeometry = vi.fn(() => ({})); this.dispose = noop; }),
        AnimationManager: vi.fn(function() { this.playDropAnimation = noop; this.dispose = noop; }),
        ParticleSystem: vi.fn(function() { this.emitShatterEffect = vi.fn(); this.emitDropParticles = vi.fn(); this.emitAmbientParticles = noop; this.update = noop; this.dispose = noop; }),
    };
});

import { XiangqiRenderer3D } from './XiangqiRenderer3D.js';

describe('XiangqiRenderer3D', () => {
    it('should set 10x9 intersection layout', () => {
        const r = new XiangqiRenderer3D(document.createElement('div'));
        expect(r.rows).toBe(10);
        expect(r.cols).toBe(9);
        expect(r.layout).toBe('intersection');
    });
    it('should have xiangqi cell size', () => {
        const r = new XiangqiRenderer3D(document.createElement('div'));
        expect(r.cellSize).toBe(0.78);
    });
    it('should set river between rows 4 and 5', () => {
        const r = new XiangqiRenderer3D(document.createElement('div'));
        expect(r.riverBetween).toBe(4);
    });
    it('should set xiangqi theme colors', () => {
        const r = new XiangqiRenderer3D(document.createElement('div'));
        expect(r.theme.base).toBe(0x5c3319);
        expect(r.theme.board).toBe(0xd7a55f);
        expect(r.theme.pieceRed).toBe(0xb52b25);
        expect(r.theme.pieceBlack).toBe(0x202226);
    });
    it('should label red general with Chinese character', () => {
        const r = new XiangqiRenderer3D(document.createElement('div'));
        expect(r.labelPiece('rK').length).toBeGreaterThan(0);
    });
    it('should label black general with Chinese character', () => {
        const r = new XiangqiRenderer3D(document.createElement('div'));
        expect(r.labelPiece('bK').length).toBeGreaterThan(0);
    });
    it('should return empty string for unknown piece', () => {
        const r = new XiangqiRenderer3D(document.createElement('div'));
        expect(r.labelPiece('xx')).toBe('');
    });
    it('should identify red pieces as red side', () => {
        const r = new XiangqiRenderer3D(document.createElement('div'));
        expect(r.pieceSide('rK')).toBe('red');
        expect(r.pieceSide('rP')).toBe('red');
    });
    it('should identify black pieces as black side', () => {
        const r = new XiangqiRenderer3D(document.createElement('div'));
        expect(r.pieceSide('bK')).toBe('black');
        expect(r.pieceSide('bP')).toBe('black');
    });
    it('should accept custom options', () => {
        const r = new XiangqiRenderer3D(document.createElement('div'), { cellSize: 1.0 });
        expect(r.cellSize).toBe(1.0);
    });
});
