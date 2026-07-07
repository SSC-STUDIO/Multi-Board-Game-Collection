import * as THREE from 'three';
import { SceneManager, LightingSetup, AnimationManager, ParticleSystem } from '../../render3d/index.js';

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

const DEFAULT_PIECE_STYLE = {
    radiusTop: 0.34,
    radiusBottom: 0.38,
    height: 0.24,
    labelSize: 0.58,
    lift: 0,
    bevel: true,
    metalness: 0.08,
    roughness: 0.42
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

function createRoundedBox(width, height, depth, radius = 0.08, smoothness = 3) {
    const shape = new THREE.Shape();
    const x = -width / 2;
    const y = -depth / 2;
    shape.moveTo(x + radius, y);
    shape.lineTo(x + width - radius, y);
    shape.quadraticCurveTo(x + width, y, x + width, y + radius);
    shape.lineTo(x + width, y + depth - radius);
    shape.quadraticCurveTo(x + width, y + depth, x + width - radius, y + depth);
    shape.lineTo(x + radius, y + depth);
    shape.quadraticCurveTo(x, y + depth, x, y + depth - radius);
    shape.lineTo(x, y + radius);
    shape.quadraticCurveTo(x, y, x + radius, y);
    return new THREE.ExtrudeGeometry(shape, {
        depth: height,
        bevelEnabled: true,
        bevelSegments: smoothness,
        bevelSize: Math.min(radius * 0.42, height * 0.36),
        bevelThickness: Math.min(radius * 0.42, height * 0.36),
        curveSegments: 8
    }).rotateX(Math.PI / 2).translate(0, height / 2, 0);
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
        this.pieceStyle = { ...DEFAULT_PIECE_STYLE, ...(options.pieceStyle || {}) };
        this.boardStyle = {
            tileHeight: options.tileHeight ?? 0.075,
            baseHeight: options.baseHeight ?? 0.28,
            bevelRadius: options.bevelRadius ?? 0.075,
            surfaceInset: options.surfaceInset ?? 0.04
        };
        this.labelPiece = options.labelPiece || ((piece) => piece || '');
        this.pieceSide = options.pieceSide || (() => 'light');
        this.isCellEnabled = options.isCellEnabled || (() => true);
        this.isCampCell = options.isCampCell || (() => false);
        this.isHeadquartersCell = options.isHeadquartersCell || (() => false);
        this.isMountainCell = options.isMountainCell || (() => false);
        this.isFrontlineCell = options.isFrontlineCell || (() => false);
        this.coordinateLabels = options.coordinateLabels || null;
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
        this.animationManager = null;
        this.particleSystem = null;
        this.ambientTimer = 0;
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
        this.addPresentationEnvironment();

        this.lightingSetup = new LightingSetup(this.sceneManager, this.sceneManager.config);
        this.lightingSetup.setPresentationMode('game');
        this.lightingSetup.setup('competition');

        this.boardGroup = new THREE.Group();
        this.pieceGroup = new THREE.Group();
        this.markerGroup = new THREE.Group();
        this.sceneManager.add(this.boardGroup);
        this.sceneManager.add(this.markerGroup);
        this.sceneManager.add(this.pieceGroup);
        this.animationManager = new AnimationManager(this.sceneManager, this.sceneManager.config);
        this.particleSystem = new ParticleSystem(this.sceneManager.scene);
        this.buildBoard();
        this.particleSystem.emitAmbientParticles();
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

    addPresentationEnvironment() {
        const extent = Math.max(this.rows, this.cols) * this.cellSize;
        const glow = new THREE.Mesh(
            new THREE.CircleGeometry(extent * 0.92, 96),
            new THREE.MeshBasicMaterial({ color: 0xf0c984, transparent: true, opacity: 0.08, depthWrite: false })
        );
        glow.rotation.x = -Math.PI / 2;
        glow.position.y = -0.31;
        this.sceneManager.scene.add(glow);

        const rim = new THREE.DirectionalLight(0xffd7a0, 1.2);
        rim.position.set(-extent * 0.7, extent * 1.1, -extent * 0.4);
        this.sceneManager.scene.add(rim);

        const coolFill = new THREE.DirectionalLight(0x88b5ff, 0.45);
        coolFill.position.set(extent * 0.8, extent * 0.7, extent * 0.8);
        this.sceneManager.scene.add(coolFill);
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
        this.pieceStyle = options.pieceStyle ? { ...DEFAULT_PIECE_STYLE, ...options.pieceStyle } : this.pieceStyle;
        this.labelPiece = options.labelPiece ?? this.labelPiece;
        this.pieceSide = options.pieceSide ?? this.pieceSide;
        this.isCellEnabled = options.isCellEnabled ?? this.isCellEnabled;
        this.isCampCell = options.isCampCell ?? this.isCampCell;
        this.isHeadquartersCell = options.isHeadquartersCell ?? this.isHeadquartersCell;
        this.isMountainCell = options.isMountainCell ?? this.isMountainCell;
        this.isFrontlineCell = options.isFrontlineCell ?? this.isFrontlineCell;
        this.coordinateLabels = options.coordinateLabels ?? this.coordinateLabels;
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
            createRoundedBox(width, this.boardStyle.baseHeight, depth, this.boardStyle.bevelRadius * 1.5, 4),
            new THREE.MeshStandardMaterial({
                color: this.theme.base,
                roughness: 0.62,
                metalness: 0.08,
                envMapIntensity: 0.55
            })
        );
        base.position.y = -0.2;
        base.receiveShadow = true;
        base.castShadow = false;
        this.boardGroup.add(base);

        const bevelLip = new THREE.Mesh(
            createRoundedBox(width * 0.985, 0.055, depth * 0.985, this.boardStyle.bevelRadius, 3),
            new THREE.MeshStandardMaterial({
                color: this.theme.boardAlt || this.theme.base,
                roughness: 0.52,
                metalness: 0.12,
                transparent: true,
                opacity: 0.42
            })
        );
        bevelLip.position.y = -0.025;
        bevelLip.receiveShadow = true;
        this.boardGroup.add(bevelLip);

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
        const geom = createRoundedBox(
            this.cellSize * (0.96 - this.boardStyle.surfaceInset),
            this.boardStyle.tileHeight,
            this.cellSize * (0.96 - this.boardStyle.surfaceInset),
            this.cellSize * 0.035,
            2
        );
        for (let row = 0; row < this.rows; row += 1) {
            for (let col = 0; col < this.cols; col += 1) {
                const light = (row + col) % 2 === 0;
                const mat = new THREE.MeshStandardMaterial({
                    color: light ? this.theme.board : this.theme.boardAlt,
                    roughness: light ? 0.54 : 0.6,
                    metalness: 0.04,
                    envMapIntensity: 0.32
                });
                const mesh = new THREE.Mesh(geom, mat);
                const { x, z } = this.coord(row, col);
                mesh.position.set(x, 0.005, z);
                mesh.receiveShadow = true;
                mesh.castShadow = true;
                this.boardGroup.add(mesh);
            }
        }
    }

    buildIntersectionBoard() {
        const min = this.coord(0, 0);
        const max = this.coord(this.rows - 1, this.cols - 1);
        const surface = new THREE.Mesh(
            createRoundedBox(Math.abs(max.x - min.x) + 0.86, 0.08, Math.abs(max.z - min.z) + 0.86, 0.08, 3),
            new THREE.MeshStandardMaterial({
                color: this.theme.board,
                roughness: 0.58,
                metalness: 0.06,
                envMapIntensity: 0.4
            })
        );
        surface.position.y = -0.025;
        surface.receiveShadow = true;
        surface.castShadow = true;
        this.boardGroup.add(surface);
        for (let row = 0; row < this.rows; row += 1) {
            const a = this.coord(row, 0);
            const b = this.coord(row, this.cols - 1);
            this.boardGroup.add(createLineBetween(a, b, this.theme.line, 0.035, 0.058));
        }
        for (let col = 0; col < this.cols; col += 1) {
            const a = this.coord(0, col);
            const b = this.coord(this.rows - 1, col);
            this.boardGroup.add(createLineBetween(a, b, this.theme.line, 0.035, 0.058));
        }
        if (this.riverBetween != null) {
            const a = this.coord(this.riverBetween, 0);
            const b = this.coord(this.riverBetween + 1, this.cols - 1);
            const river = new THREE.Mesh(
                createRoundedBox(Math.abs(b.x - a.x) + 0.7, 0.034, this.cellSize * 0.46, 0.025, 2),
                new THREE.MeshStandardMaterial({ color: 0x587a8d, roughness: 0.46, metalness: 0.08, transparent: true, opacity: 0.82 })
            );
            river.position.set(0, 0.076, (a.z + b.z) / 2);
            this.boardGroup.add(river);
        }
    }

    buildJunqiBoard() {
        const tileGeom = new THREE.CylinderGeometry(0.24, 0.27, 0.075, 40);
        for (const segment of this.segments) {
            const color = segment.type === 'rail' ? this.theme.rail : this.theme.road;
            const a = this.coord(segment.from[0], segment.from[1]);
            const b = this.coord(segment.to[0], segment.to[1]);
            this.boardGroup.add(createLineBetween(a, b, color, segment.type === 'rail' ? 0.088 : 0.04, 0.052));
        }
        for (let row = 0; row < this.rows; row += 1) {
            for (let col = 0; col < this.cols; col += 1) {
                if (!this.isCellEnabled(row, col)) continue;
                const color = this.isMountainCell(row, col) ? this.theme.mountain
                    : this.isCampCell(row, col) ? this.theme.camp
                        : this.isHeadquartersCell(row, col) ? this.theme.hq
                            : this.isFrontlineCell(row, col) ? this.theme.rail
                                : this.theme.board;
                const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.56, metalness: 0.07, envMapIntensity: 0.35 });
                const tile = new THREE.Mesh(tileGeom, mat);
                const { x, z } = this.coord(row, col);
                tile.position.set(x, 0.075, z);
                tile.receiveShadow = true;
                tile.castShadow = true;
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
        this.addCoordinateLabels(options);
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
        if (selected) this.addMarker(selected[0], selected[1], 0x4aa3ff, 0.39, 0.032, 0.28);
        for (const move of options.moves || []) {
            const [row, col] = move.to || move;
            const isCapture = move.capture || move.kind === 'capture';
            this.addMarker(row, col, isCapture ? 0xff564a : 0x52d37f, isCapture ? 0.32 : 0.29, 0.024, isCapture ? 0.34 : 0.24);
        }
        const last = options.lastMove;
        if (last?.from) this.addMarker(last.from[0], last.from[1], 0xf4ce5b, 0.25, 0.02, 0.2);
        if (last?.to) this.addMarker(last.to[0], last.to[1], 0xf4ce5b, 0.31, 0.024, 0.26);
    }

    addMarker(row, col, color, radius, height, fillOpacity = 0.24) {
        if (!this.isCellEnabled(row, col)) return;
        const { x, z } = this.coord(row, col);
        const disc = new THREE.Mesh(
            new THREE.CircleGeometry(radius * 0.86, 56),
            new THREE.MeshBasicMaterial({
                color,
                transparent: true,
                opacity: fillOpacity,
                depthWrite: false,
                side: THREE.DoubleSide
            })
        );
        disc.rotation.x = -Math.PI / 2;
        disc.position.set(x, 0.151, z);
        this.markerGroup.add(disc);

        const marker = new THREE.Mesh(
            new THREE.TorusGeometry(radius, Math.max(height, 0.012), 10, 52),
            new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.94, depthWrite: false })
        );
        marker.rotation.x = -Math.PI / 2;
        marker.position.set(x, 0.158, z);
        this.markerGroup.add(marker);
    }

    addCoordinateLabels(options = {}) {
        const labels = options.coordinateLabels || this.coordinateLabels;
        if (!labels) return;
        const files = labels.files || [];
        const ranks = labels.ranks || [];
        const offset = (labels.edgeOffset ?? 0.62) * this.cellSize;
        const size = labels.size ?? 0.32;
        const y = labels.y ?? 0.18;
        const fill = labels.fill || '#f8e4b7';
        const font = labels.font || 'bold 100px Georgia, serif';
        const shadow = labels.shadow || 'rgba(0,0,0,0.55)';

        files.forEach((label, col) => {
            if (label == null || col >= this.cols) return;
            const { x, z } = this.coord(this.rows - 1, col);
            this.addBoardLabel(label, x, z + offset, y, size, { fill, font, shadow });
        });
        ranks.forEach((label, row) => {
            if (label == null || row >= this.rows) return;
            const { x, z } = this.coord(row, 0);
            this.addBoardLabel(label, x - offset, z, y, size, { fill, font, shadow });
        });
    }

    addBoardLabel(label, x, z, y, size, textureOptions) {
        const texture = createLabelTexture(label, textureOptions);
        const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(size, size),
            new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
                depthWrite: false,
                side: THREE.DoubleSide
            })
        );
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(x, y, z);
        this.markerGroup.add(mesh);
    }

    addPiece(piece, row, col, options = {}) {
        const side = this.pieceSide(piece, row, col, options);
        const color = side === 'dark' ? this.theme.pieceDark
            : side === 'red' ? this.theme.pieceRed
                : side === 'black' ? this.theme.pieceBlack
                    : side === 'hidden' ? this.theme.hidden
                        : this.theme.pieceLight;
        const group = new THREE.Group();
        const style = this.pieceStyle;
        const body = new THREE.Mesh(
            new THREE.CylinderGeometry(style.radiusTop, style.radiusBottom, style.height, 56, 1, false),
            new THREE.MeshStandardMaterial({
                color,
                roughness: style.roughness,
                metalness: style.metalness,
                envMapIntensity: 0.58
            })
        );
        body.position.y = 0.18 + style.lift;
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);

        const rim = new THREE.Mesh(
            new THREE.TorusGeometry(style.radiusTop * 0.82, style.radiusTop * 0.035, 10, 56),
            new THREE.MeshStandardMaterial({
                color: side === 'dark' || side === 'black' || side === 'hidden' ? 0xf0d7a2 : 0xffffff,
                roughness: 0.35,
                metalness: 0.18,
                transparent: true,
                opacity: side === 'hidden' ? 0.36 : 0.48
            })
        );
        rim.rotation.x = -Math.PI / 2;
        rim.position.y = 0.18 + style.height / 2 + 0.006 + style.lift;
        group.add(rim);

        const label = this.labelPiece(piece, row, col, options);
        const texture = createLabelTexture(label, {
            fill: side === 'dark' || side === 'black' || side === 'hidden' ? '#f8efd6' : '#211810',
            font: options.labelFont || 'bold 118px serif'
        });
        const labelMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(style.labelSize, style.labelSize),
            new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide })
        );
        labelMesh.rotation.x = -Math.PI / 2;
        labelMesh.position.y = 0.18 + style.height / 2 + 0.016 + style.lift;
        group.add(labelMesh);

        const { x, z } = this.coord(row, col);
        group.position.set(x, 0, z);
        this.pieceGroup.add(group);

        const targetY = group.position.y + (style.height / 2) + 0.18 + style.lift;
        this.animationManager?.playDropAnimation(group, targetY);
        const dropPos = this.coord(row, col);
        this.particleSystem?.emitDropParticles(dropPos.x, targetY, dropPos.z, side === 'dark' || side === 'black' ? 'black' : 'white');
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

    showVictory(winColor, winPositions) {
        if (!this.particleSystem || !winPositions || winPositions.length === 0) return;
        const positions = winPositions.map(({ row, col }) => {
            const w = this.coord(row, col);
            return { x: w.x, y: 0.18 + (this.pieceStyle?.height ?? 0.3) / 2, z: w.z };
        });
        this.particleSystem.emitShatterEffect(positions, winColor);
    }

    playVictorySequence(winnerColor) {
        if (!winnerColor) return;
        setTimeout(() => this.showVictoryCelebration(winnerColor), 300);
        this.sceneManager?.setNeedsRender?.();
    }

        showVictoryCelebration(winColor) {
        if (!this.particleSystem) return;
        const positions = [];
        const step = Math.max(1, Math.floor(Math.min(this.rows, this.cols) / 4));
        for (let r = 0; r < this.rows; r += step) {
            for (let c = 0; c < this.cols; c += step) {
                const w = this.coord(r, c);
                positions.push({ x: w.x, y: 0.18 + (this.pieceStyle?.height ?? 0.3) / 2, z: w.z });
            }
        }
        if (positions.length === 0) {
            positions.push({ x: 0, y: 0.2, z: 0 });
        }
        this.particleSystem.emitShatterEffect(positions, winColor);
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
        if (this.particleSystem) this.particleSystem.dispose();
        this.animationManager?.dispose?.();
        this.lightingSetup?.dispose?.();
        this.sceneManager?.dispose?.();
    }
}
