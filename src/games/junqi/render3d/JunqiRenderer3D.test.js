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

vi.mock('../../junqi/classic/rules.js', () => ({
    CLASSIC_ROWS: 13,
    CLASSIC_COLS: 5,
    BOARD_SEGMENTS: [],
    isPlayable: () => true,
    isCamp: () => false,
    isHeadquarters: () => false,
    isMountain: () => false,
    isFrontline: () => false,
}));

import { JunqiRenderer3D } from './JunqiRenderer3D.js';

describe('JunqiRenderer3D', () => {
    it('should default to classic variant with junqi layout', () => {
        const r = new JunqiRenderer3D(document.createElement('div'));
        expect(r.variant).toBe('classic');
        expect(r.layout).toBe('junqi');
        expect(r.rows).toBe(13);
        expect(r.cols).toBe(5);
    });
    it('should use flip variant with square layout', () => {
        const r = new JunqiRenderer3D(document.createElement('div'), { variant: 'flip' });
        expect(r.variant).toBe('flip');
        expect(r.layout).toBe('square');
        expect(r.rows).toBe(4);
        expect(r.cols).toBe(8);
    });
    it('should have junqi cell size for classic', () => {
        const r = new JunqiRenderer3D(document.createElement('div'));
        expect(r.cellSize).toBe(0.72);
    });
    it('should have larger cell size for flip', () => {
        const r = new JunqiRenderer3D(document.createElement('div'), { variant: 'flip' });
        expect(r.cellSize).toBe(0.84);
    });
    it('should set junqi theme colors for classic', () => {
        const r = new JunqiRenderer3D(document.createElement('div'));
        expect(r.theme.base).toBe(0x172318);
        expect(r.theme.rail).toBe(0xd2b96c);
        expect(r.theme.road).toBe(0x7b6b4d);
        expect(r.theme.pieceRed).toBe(0xb43a31);
    });
    it('should set flip theme colors', () => {
        const r = new JunqiRenderer3D(document.createElement('div'), { variant: 'flip' });
        expect(r.theme.base).toBe(0x202a21);
        expect(r.theme.board).toBe(0x526344);
        expect(r.theme.hidden).toBe(0x7a5d2a);
    });
    it('should label classic pieces for own side', () => {
        const r = new JunqiRenderer3D(document.createElement('div'));
        const label = r.labelPiece({ color: 'r', rank: 'K', revealed: false }, 0, 0, { playerColor: 'r' });
        expect(label.length).toBeGreaterThan(0);
    });
    it('should show ? for unrevealed classic pieces of opponent', () => {
        const r = new JunqiRenderer3D(document.createElement('div'));
        const label = r.labelPiece({ color: 'b', rank: 'K', revealed: false }, 0, 0, { playerColor: 'r' });
        expect(label).toBe('?');
    });
    it('should identify own side pieces as red/black', () => {
        const r = new JunqiRenderer3D(document.createElement('div'));
        expect(r.pieceSide({ color: 'r', revealed: false }, 0, 0, { playerColor: 'r' })).toBe('red');
        expect(r.pieceSide({ color: 'b', revealed: false }, 0, 0, { playerColor: 'b' })).toBe('black');
    });
    it('should identify opponent pieces as hidden', () => {
        const r = new JunqiRenderer3D(document.createElement('div'));
        expect(r.pieceSide({ color: 'b', revealed: false }, 0, 0, { playerColor: 'r' })).toBe('hidden');
    });
    it('should label flip pieces when revealed', () => {
        const r = new JunqiRenderer3D(document.createElement('div'), { variant: 'flip' });
        const label = r.labelPiece({ color: 'r', rank: 'K', revealed: true });
        expect(label.length).toBeGreaterThan(0);
    });
    it('should show ? for unrevealed flip pieces', () => {
        const r = new JunqiRenderer3D(document.createElement('div'), { variant: 'flip' });
        expect(r.labelPiece({ color: 'r', rank: 'K', revealed: false })).toBe('?');
    });
    it('should identify flip unrevealed as hidden side', () => {
        const r = new JunqiRenderer3D(document.createElement('div'), { variant: 'flip' });
        expect(r.pieceSide({ color: 'r', revealed: false })).toBe('hidden');
        expect(r.pieceSide({ color: 'r', revealed: true })).toBe('red');
    });
    it('should accept custom options', () => {
        const r = new JunqiRenderer3D(document.createElement('div'), { cellSize: 1.0 });
        expect(r.cellSize).toBe(1.0);
    });
});
