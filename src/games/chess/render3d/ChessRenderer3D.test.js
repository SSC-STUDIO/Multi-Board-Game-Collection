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

import { ChessRenderer3D } from './ChessRenderer3D.js';

describe('ChessRenderer3D', () => {
    it('should set 8x8 square layout', () => {
        const r = new ChessRenderer3D(document.createElement('div'));
        expect(r.rows).toBe(8);
        expect(r.cols).toBe(8);
        expect(r.layout).toBe('square');
    });
    it('should have chess cell size', () => {
        const r = new ChessRenderer3D(document.createElement('div'));
        expect(r.cellSize).toBe(0.82);
    });
    it('should set chess theme colors', () => {
        const r = new ChessRenderer3D(document.createElement('div'));
        expect(r.theme.base).toBe(0x17110b);
        expect(r.theme.board).toBe(0xd7c19a);
        expect(r.theme.pieceLight).toBe(0xf3ead5);
        expect(r.theme.pieceDark).toBe(0x20242f);
    });
    it('should label white king as K', () => {
        const r = new ChessRenderer3D(document.createElement('div'));
        expect(r.labelPiece('wK')).toBe('K');
    });
    it('should label black queen as Q', () => {
        const r = new ChessRenderer3D(document.createElement('div'));
        expect(r.labelPiece('bQ')).toBe('Q');
    });
    it('should return empty string for unknown piece', () => {
        const r = new ChessRenderer3D(document.createElement('div'));
        expect(r.labelPiece('xx')).toBe('');
    });
    it('should identify white pieces as light side', () => {
        const r = new ChessRenderer3D(document.createElement('div'));
        expect(r.pieceSide('wK')).toBe('light');
        expect(r.pieceSide('wP')).toBe('light');
    });
    it('should identify black pieces as dark side', () => {
        const r = new ChessRenderer3D(document.createElement('div'));
        expect(r.pieceSide('bK')).toBe('dark');
        expect(r.pieceSide('bP')).toBe('dark');
    });
    it('should set chess coordinate labels', () => {
        const r = new ChessRenderer3D(document.createElement('div'));
        expect(r.coordinateLabels.files).toEqual(['a','b','c','d','e','f','g','h']);
        expect(r.coordinateLabels.ranks).toEqual(['8','7','6','5','4','3','2','1']);
    });
    it('should accept custom options', () => {
        const r = new ChessRenderer3D(document.createElement('div'), { cellSize: 1.0 });
        expect(r.cellSize).toBe(1.0);
    });
});
