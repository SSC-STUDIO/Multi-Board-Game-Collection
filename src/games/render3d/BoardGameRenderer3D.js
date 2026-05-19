import * as THREE from 'three';
import { SceneManager, LightingSetup } from '../../render3d/index.js';

const DEFAULT_THEME = {
    base: 0x2f2419,
    board: 0xb88a4a,
    boardAlt: 0x5a3a24,
    line: 0x1f160f,
    rail: 0xd3c07a,
    road: 0x6f5b3b,
    camp: 0x55745f,
    hq: 0x7a4738,
    mountain: 0x1f2a20,
    pieceLight: 0xf3e4bf,
    pieceDark: 0x2d3441,
    pieceRed: 0xb43a31,
    pieceBlack: 0x22252c,
    hidden: 0x6c5731
};

function disposeMaterial(material) {
    if (!material) return;
    if (Array.isArray(material)) {
        material.forEach(disposeMaterial);
        return;
    }
    material.map?.dispose?.();
    material.dispose?.();
}

function disposeObject(object) {
    object.traverse?.((child) => {
        child.geometry?.dispose?.();
        disposeMaterial(child.material);
    });
}

function createLabelTexture(label, options = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.Texture();

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = options.fill || '#1a1712';
    ctx.font = options.font || 'bold 116px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = options.shadow || 'rgba(255,255,255,0.45)';
    ctx.shadowBlur = 5;
    ctx.fillText(String(label || ''), 128, 136);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    return texture;
}

function createLineBetween(a, b, color, thickness = 0.035, y = 0.035) {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const length = Math.hypot(dx, dz);
    const geom = new THREE.BoxGeometry(thickness, thickness, length || thickness);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.02 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set((a.x + b.x) / 2, y, (a.z + b.z) / 2);
    mesh.rotation.y = Math.atan2(dx, dz);
    mesh.receiveShadow = true;
    return mesh;
}

export class BoardGameRenderer3D {
    constructor(container, options = {}) {
        if (!BoardGameRenderer3D.isAvailable()) {
            throw new Error('WebGL is not available');
        }
        this.container = container;
        this.rows = options.rows || 8;
        this.cols = options.cols || 8;
        this.layout = options.layout || 'square';
        this.cellSize = options.cellSize || 1;
        this.viewConfig = this.createViewConfig(options);
        this.theme = { ...DEFAULT_THEME, ...(options.theme || {}) };
        this.labelPiece = options.labelPiece || ((piece) => piece || '');
        this.pieceSide = options.pieceSide || (() => 'light');
        this.isCellEnabled = options.isCellEnabled || (() => true);
        this.isCampCell = options.isCampCell || (() => false);
        this.isHeadquartersCell = options.isHeadquartersCell || (() => false);
        this.isMountainCell = options.isMountainCell || (() => false);
        this.isFrontlineCell = options.isFrontlineCell || (() => false);
        this.segments = options.segments || [];
        this.riverBetween = options.riverBetween ?? null;
        this.flipped = Boolean(options.flipped);

        this.sceneManager = null;
        this.lightingSetup = null;
        this.boardGroup = null;
        this.pieceGroup = null;
        this.markerGroup = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.pickPlane = null;
        this.clickHandler = null;
        this.cellClick = null;
        this.disposed = false;

        this.init();
    }

    static isAvailable() {
        return SceneManager.isWebGLAvailable();
    }

    createViewConfig(options = {}) {
        const extent = Math.max(this.rows, this.cols) * this.cellSize;
        return {
            height: options.cameraHeight ?? extent * (options.cameraHeightScale ?? 1.22),
            distance: options.cameraDistance ?? extent * (options.cameraDistanceScale ?? 1.2),
            targetX: options.cameraTargetX ?? 0,
            targetY: options.cameraTargetY ?? 0,
            targetZ: options.cameraTargetZ ?? 0,
            minDistance: options.cameraMinDistance ?? extent * 0.66,
            maxDistance: options.cameraMaxDistance ?? extent * 2.45,
            maxPolarAngle: options.cameraMaxPolarAngle ?? Math.PI * 0.48
        };
    }

    init() {
        this.container.replaceChildren?.();
        this.sceneManager = new SceneManager(this.container);
        this.sceneManager.scene.fog = new THREE.FogExp2(0x10141a, 0.025);
        this.applyViewConfig();

        this.lightingSetup = new LightingSetup(this.sceneManager, this.sceneManager.config);
        this.lightingSetup.setPresentationMode('game');
        this.lightingSetup.setup('competition');

        this.boardGroup = new THREE.Group();
        this.pieceGroup = new THREE.Group();
        this.markerGroup = new THREE.Group();
        this.sceneManager.add(this.boardGroup);
        this.sceneManager.add(this.markerGroup);
        this.sceneManager.add(this.pieceGroup);
        this.buildBoard();
        this.setupPicking();
    }

    applyViewConfig() {
        const { height, distance, targetX, targetY, targetZ, minDistance, maxDistance, maxPolarAngle } = this.viewConfig;
        this.sceneManager.camera.position.set(0, height, distance);
        this.sceneManager.camera.lookAt(targetX, targetY, targetZ);
        this.sceneManager.controls.target.set(targetX, targetY, targetZ);
        this.sceneManager.controls.minDistance = minDistance;
        this.sceneManager.controls.maxDistance = maxDistance;
        this.sceneManager.controls.maxPolarAngle = maxPolarAngle;
        this.sceneManager.controls.update();
        this.sceneManager.setNeedsRender();
    }

    coord(row, col) {
        const displayRow = this.flipped ? this.rows - 1 - row : row;
        const displayCol = this.flipped ? this.cols - 1 - col : col;
        return {
            x: (displayCol - (this.cols - 1) / 2) * this.cellSize,
            z: (displayRow - (this.rows - 1) / 2) * this.cellSize
        };
    }

    worldToCell(x, z) {
        let col = Math.round(x / this.cellSize + (this.cols - 1) / 2);
        let row = Math.round(z / this.cellSize + (this.rows - 1) / 2);
        if (this.flipped) {
            row = this.rows - 1 - row;
            col = this.cols - 1 - col;
        }
        if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return null;
        if (!this.isCellEnabled(row, col)) return null;
        return { row, col };
    }

    rebuild(options = {}) {
        const nextRows = options.rows ?? this.rows;
        const nextCols = options.cols ?? this.cols;
        const nextCellSize = options.cellSize ?? this.cellSize;
        const changedSize = nextRows !== this.rows || nextCols !== this.cols || nextCellSize !== this.cellSize;
        this.rows = nextRows;
        this.cols = nextCols;
        this.cellSize = nextCellSize;
        this.layout = options.layout ?? this.layout;
        this.flipped = options.flipped ?? this.flipped;
        this.segments = options.segments ?? this.segments;
        this.theme = options.theme ? { ...DEFAULT_THEME, ...options.theme } : this.theme;
        this.labelPiece = options.labelPiece ?? this.labelPiece;
        this.pieceSide = options.pieceSide ?? this.pieceSide;
        this.isCellEnabled = options.isCellEnabled ?? this.isCellEnabled;
        this.isCampCell = options.isCampCell ?? this.isCampCell;
        this.isHeadquartersCell = options.isHeadquartersCell ?? this.isHeadquartersCell;
        this.isMountainCell = options.isMountainCell ?? this.isMountainCell;
        this.isFrontlineCell = options.isFrontlineCell ?? this.isFrontlineCell;
        this.riverBetween = options.riverBetween ?? this.riverBetween;
        this.viewConfig = this.createViewConfig(options);
        this.applyViewConfig();
        if (changedSize || options.layout || options.segments || options.theme) {
            this.clearGroup(this.boardGroup);
            this.buildBoard();
            this.setupPicking();
        }
    }

    buildBoard() {
        const width = (this.cols + 0.85) * this.cellSize;
        const depth = (this.rows + 0.85) * this.cellSize;
        const base = new THREE.Mesh(
            new THREE.BoxGeometry(width, 0.24, depth),
            new THREE.MeshStandardMaterial({ color: this.theme.base, roughness: 0.76, metalness: 0.04 })
        );
        base.position.y = -0.16;
        base.receiveShadow = true;
        base.castShadow = false;
        this.boardGroup.add(base);

        if (this.layout === 'square') {
            this.buildSquareBoard();
        } else if (this.layout === 'junqi') {
            this.buildJunqiBoard();
        } else {
            this.buildIntersectionBoard();
        }
        this.sceneManager.setNeedsRender();
    }

    buildSquareBoard() {
        const geom = new THREE.BoxGeometry(this.cellSize * 0.96, 0.06, this.cellSize * 0.96);
        for (let row = 0; row < this.rows; row += 1) {
            for (let col = 0; col < this.cols; col += 1) {
                const light = (row + col) % 2 === 0;
                const mat = new THREE.MeshStandardMaterial({
                    color: light ? this.theme.board : this.theme.boardAlt,
                    roughness: 0.65,
                    metalness: 0.03
                });
                const mesh = new THREE.Mesh(geom, mat);
                const { x, z } = this.coord(row, col);
                mesh.position.set(x, 0, z);
                mesh.receiveShadow = true;
                this.boardGroup.add(mesh);
            }
        }
    }

    buildIntersectionBoard() {
        const min = this.coord(0, 0);
        const max = this.coord(this.rows - 1, this.cols - 1);
        for (let row = 0; row < this.rows; row += 1) {
            const a = this.coord(row, 0);
            const b = this.coord(row, this.cols - 1);
            this.boardGroup.add(createLineBetween(a, b, this.theme.line, 0.035));
        }
        for (let col = 0; col < this.cols; col += 1) {
            const a = this.coord(0, col);
            const b = this.coord(this.rows - 1, col);
            this.boardGroup.add(createLineBetween(a, b, this.theme.line, 0.035));
        }
        const surface = new THREE.Mesh(
            new THREE.BoxGeometry(Math.abs(max.x - min.x) + 0.8, 0.045, Math.abs(max.z - min.z) + 0.8),
            new THREE.MeshStandardMaterial({ color: this.theme.board, roughness: 0.7, metalness: 0.02 })
        );
        surface.position.y = -0.045;
        surface.receiveShadow = true;
        this.boardGroup.add(surface);
        if (this.riverBetween != null) {
            const a = this.coord(this.riverBetween, 0);
            const b = this.coord(this.riverBetween + 1, this.cols - 1);
            const river = new THREE.Mesh(
                new THREE.BoxGeometry(Math.abs(b.x - a.x) + 0.7, 0.026, this.cellSize * 0.46),
                new THREE.MeshStandardMaterial({ color: 0x587a8d, roughness: 0.58, metalness: 0.02 })
            );
            river.position.set(0, 0.005, (a.z + b.z) / 2);
            this.boardGroup.add(river);
        }
    }

    buildJunqiBoard() {
        const tileGeom = new THREE.CylinderGeometry(0.23, 0.25, 0.055, 32);
        for (const segment of this.segments) {
            const color = segment.type === 'rail' ? this.theme.rail : this.theme.road;
            const a = this.coord(segment.from[0], segment.from[1]);
            const b = this.coord(segment.to[0], segment.to[1]);
            this.boardGroup.add(createLineBetween(a, b, color, segment.type === 'rail' ? 0.06 : 0.03, 0.02));
        }
        for (let row = 0; row < this.rows; row += 1) {
            for (let col = 0; col < this.cols; col += 1) {
                if (!this.isCellEnabled(row, col)) continue;
                const color = this.isMountainCell(row, col) ? this.theme.mountain
                    : this.isCampCell(row, col) ? this.theme.camp
                        : this.isHeadquartersCell(row, col) ? this.theme.hq
                            : this.isFrontlineCell(row, col) ? this.theme.rail
                                : this.theme.board;
                const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.68, metalness: 0.03 });
                const tile = new THREE.Mesh(tileGeom, mat);
                const { x, z } = this.coord(row, col);
                tile.position.set(x, 0.03, z);
                tile.receiveShadow = true;
                this.boardGroup.add(tile);
            }
        }
    }

    setupPicking() {
        if (this.pickPlane) {
            this.sceneManager.scene.remove(this.pickPlane);
            disposeObject(this.pickPlane);
        }
        const width = (this.cols + 1) * this.cellSize;
        const depth = (this.rows + 1) * this.cellSize;
        this.pickPlane = new THREE.Mesh(
            new THREE.PlaneGeometry(width, depth),
            new THREE.MeshBasicMaterial({ visible: false })
        );
        this.pickPlane.rotation.x = -Math.PI / 2;
        this.pickPlane.position.y = 0.12;
        this.sceneManager.scene.add(this.pickPlane);
        if (!this.clickHandler) {
            this.clickHandler = (event) => this.handleClick(event);
            this.sceneManager.renderer.domElement.addEventListener('click', this.clickHandler);
        }
    }

    handleClick(event) {
        if (!this.cellClick || this.disposed) return;
        const canvas = this.sceneManager.renderer.domElement;
        const rect = canvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.sceneManager.camera);
        const hit = this.raycaster.intersectObject(this.pickPlane)[0];
        if (!hit) return;
        const cell = this.worldToCell(hit.point.x, hit.point.z);
        if (cell) this.cellClick(cell);
    }

    onCellClick(callback) {
        this.cellClick = callback;
    }

    syncState(state = {}) {
        this.syncBoard(state.board, state);
    }

    syncBoard(board, options = {}) {
        this.clearGroup(this.pieceGroup);
        this.clearGroup(this.markerGroup);
        this.flipped = options.flipped ?? this.flipped;
        this.addMarkers(options);
        if (!Array.isArray(board)) {
            this.sceneManager.setNeedsRender();
            return;
        }
        for (let row = 0; row < board.length; row += 1) {
            for (let col = 0; col < board[row].length; col += 1) {
                const piece = board[row][col];
                if (!piece) continue;
                this.addPiece(piece, row, col, options);
            }
        }
        this.sceneManager.setNeedsRender();
    }

    addMarkers(options) {
        const selected = options.selected;
        if (selected) this.addMarker(selected[0], selected[1], 0x4aa3ff, 0.32, 0.026);
        for (const move of options.moves || []) {
            const [row, col] = move.to || move;
            this.addMarker(row, col, move.capture || move.kind === 'capture' ? 0xff564a : 0x52d37f, 0.24, 0.018);
        }
        const last = options.lastMove;
        if (last?.from) this.addMarker(last.from[0], last.from[1], 0xf4ce5b, 0.18, 0.014);
        if (last?.to) this.addMarker(last.to[0], last.to[1], 0xf4ce5b, 0.22, 0.016);
    }

    addMarker(row, col, color, radius, height) {
        if (!this.isCellEnabled(row, col)) return;
        const marker = new THREE.Mesh(
            new THREE.CylinderGeometry(radius, radius, height, 36),
            new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.62 })
        );
        const { x, z } = this.coord(row, col);
        marker.position.set(x, 0.08, z);
        this.markerGroup.add(marker);
    }

    addPiece(piece, row, col, options = {}) {
        const side = this.pieceSide(piece, row, col, options);
        const color = side === 'dark' ? this.theme.pieceDark
            : side === 'red' ? this.theme.pieceRed
                : side === 'black' ? this.theme.pieceBlack
                    : side === 'hidden' ? this.theme.hidden
                        : this.theme.pieceLight;
        const group = new THREE.Group();
        const body = new THREE.Mesh(
            new THREE.CylinderGeometry(0.34, 0.37, 0.22, 42),
            new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.08 })
        );
        body.position.y = 0.18;
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);

        const label = this.labelPiece(piece, row, col, options);
        const texture = createLabelTexture(label, {
            fill: side === 'dark' || side === 'black' || side === 'hidden' ? '#f8efd6' : '#211810',
            font: options.labelFont || 'bold 118px serif'
        });
        const labelMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(0.58, 0.58),
            new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide })
        );
        labelMesh.rotation.x = -Math.PI / 2;
        labelMesh.position.y = 0.296;
        group.add(labelMesh);

        const { x, z } = this.coord(row, col);
        group.position.set(x, 0, z);
        this.pieceGroup.add(group);
    }

    clearGroup(group) {
        if (!group) return;
        while (group.children.length) {
            const child = group.children.pop();
            disposeObject(child);
        }
    }

    show() {
        this.container.classList.remove('hidden');
        this.container.setAttribute('aria-hidden', 'false');
        this.sceneManager?.startRenderLoop?.();
        this.sceneManager?.handleResize?.();
        this.sceneManager?.setNeedsRender?.();
    }

    hide() {
        this.container.classList.add('hidden');
        this.container.setAttribute('aria-hidden', 'true');
        this.sceneManager?.stopRenderLoop?.();
    }

    dispose() {
        this.disposed = true;
        if (this.clickHandler && this.sceneManager?.renderer?.domElement) {
            this.sceneManager.renderer.domElement.removeEventListener('click', this.clickHandler);
        }
        this.clearGroup(this.pieceGroup);
        this.clearGroup(this.markerGroup);
        this.clearGroup(this.boardGroup);
        if (this.pickPlane) disposeObject(this.pickPlane);
        this.lightingSetup?.dispose?.();
        this.sceneManager?.dispose?.();
    }
}
