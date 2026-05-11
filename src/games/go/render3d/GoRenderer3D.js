/**
 * 围棋 3D 渲染器（MVP）。
 *
 * 复用 `src/render3d/` 的通用基础设施（SceneManager/LightingSetup/StoneBuilder/MaterialFactory），
 * 用 Canvas 贴图绘制围棋交叉点棋盘（9/13/19 路，含星位），在交叉点上放置棋子。
 *
 * 不包含的功能（留给后续迭代）：
 *   - 提子动画
 *   - 最后一手高亮 / koPoint 标记
 *   - 数子结算的 3D 领地可视化
 *   - 让子起手预置石
 *
 * @module games/go/render3d/GoRenderer3D
 */

import * as THREE from 'three';
import {
    SceneManager,
    LightingSetup,
    CameraController,
    MaterialFactory,
    StoneBuilder
} from '../../../render3d/index.js';
import { boardToWorld, worldToBoard } from '../../../config/renderConfig.js';

const BOARD_COLOR = '#d6a86a';
const LINE_COLOR = '#1b1b1b';
const STAR_COLOR = '#1b1b1b';
const BASE_COLOR = '#2c1a0c';

/** 不同路数的星位。坐标是 (row, col)。 */
export function getStarPoints(size) {
    if (size === 19) {
        const s = [3, 9, 15];
        return s.flatMap((r) => s.map((c) => ({ row: r, col: c })));
    }
    if (size === 13) {
        const s = [3, 6, 9];
        return s.flatMap((r) => s.map((c) => ({ row: r, col: c })));
    }
    // 9 路
    return [
        { row: 2, col: 2 }, { row: 2, col: 4 }, { row: 2, col: 6 },
        { row: 4, col: 2 }, { row: 4, col: 4 }, { row: 4, col: 6 },
        { row: 6, col: 2 }, { row: 6, col: 4 }, { row: 6, col: 6 }
    ];
}

/**
 * 为给定 size 生成交叉点棋盘贴图。
 * @param {number} size
 * @returns {THREE.CanvasTexture}
 */
function createGoBoardTexture(size) {
    const canvas = document.createElement('canvas');
    const px = 1024;
    canvas.width = px;
    canvas.height = px;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.Texture();

    // 木纹底色
    ctx.fillStyle = BOARD_COLOR;
    ctx.fillRect(0, 0, px, px);

    // 网格参数：margin 半个格子作为边距
    const cellPx = px / (size + 1);
    const origin = cellPx;
    const span = cellPx * (size - 1);

    ctx.strokeStyle = LINE_COLOR;
    ctx.lineWidth = Math.max(1.5, px / 900);
    ctx.beginPath();
    for (let i = 0; i < size; i += 1) {
        const p = origin + i * cellPx;
        ctx.moveTo(origin, p);
        ctx.lineTo(origin + span, p);
        ctx.moveTo(p, origin);
        ctx.lineTo(p, origin + span);
    }
    ctx.stroke();

    // 星位
    const stars = getStarPoints(size);
    ctx.fillStyle = STAR_COLOR;
    const starR = Math.max(3, px / 240);
    stars.forEach(({ row, col }) => {
        const x = origin + col * cellPx;
        const y = origin + row * cellPx;
        ctx.beginPath();
        ctx.arc(x, y, starR, 0, Math.PI * 2);
        ctx.fill();
    });

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
    return texture;
}

/**
 * 把 (row, col) 映射到世界坐标。统一使用项目共享的 boardToWorld。
 * @param {number} row
 * @param {number} col
 * @param {number} size
 * @param {number} cellSize
 */
function goBoardToWorld(row, col, size, cellSize) {
    return boardToWorld(row, col, size, cellSize);
}

export class GoRenderer3D {
    /**
     * @param {HTMLElement} container
     * @param {{ boardSize?: number }} [options]
     */
    constructor(container, options = {}) {
        this.container = container;
        this.boardSize = options.boardSize || 19;
        this.cellSize = 1.0;

        this.sceneManager = null;
        this.lightingSetup = null;
        this.cameraController = null;
        this.stoneBuilder = null;
        this.materialFactory = null;
        this.boardGroup = null;
        this.boardTexture = null;

        this._onCellClick = null;
        this._raycaster = new THREE.Raycaster();
        this._mouse = new THREE.Vector2();
        this._boardPlane = null;
        this._clickHandler = null;
        this._disposed = false;

        this.init();
    }

    init() {
        this.sceneManager = new SceneManager(this.container);
        const config = this.sceneManager.config;
        this.cellSize = config.board.cellSize;

        this.lightingSetup = new LightingSetup(this.sceneManager, config);
        this.lightingSetup.setPresentationMode('game');
        this.lightingSetup.setup('competition');

        this.materialFactory = new MaterialFactory(config);
        this.stoneBuilder = new StoneBuilder(config);
        this.sceneManager.add(this.stoneBuilder.createStonesGroup());

        this.buildBoard();

        this.cameraController = new CameraController(this.sceneManager, config);
        this.cameraController.setScenePreset('competition');
        this.cameraController.setPresentationMode('game');
        this.cameraController.fitToBoard(this.boardSize, false);

        this._setupInteraction();
    }

    buildBoard() {
        if (this.boardGroup) {
            this.sceneManager.remove(this.boardGroup);
            this.boardGroup.traverse((obj) => {
                if (obj.geometry) obj.geometry.dispose();
            });
        }
        if (this.boardTexture) this.boardTexture.dispose();

        const group = new THREE.Group();
        group.name = 'go-board';

        const config = this.sceneManager.config;
        const { thickness, baseHeight } = config.board;
        const totalSize = (this.boardSize + 1) * this.cellSize; // 含边距
        const surfaceSize = totalSize;

        // 底座
        const baseGeometry = new THREE.BoxGeometry(surfaceSize + 0.4, baseHeight, surfaceSize + 0.4);
        const baseMaterial = new THREE.MeshStandardMaterial({ color: BASE_COLOR, roughness: 0.75, metalness: 0.05 });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.position.y = -thickness / 2 - baseHeight / 2;
        base.receiveShadow = true;
        group.add(base);

        // 棋盘表面：贴 canvas 纹理
        this.boardTexture = createGoBoardTexture(this.boardSize);
        const surfaceGeometry = new THREE.BoxGeometry(surfaceSize, thickness, surfaceSize);
        const topMat = new THREE.MeshStandardMaterial({
            map: this.boardTexture,
            roughness: 0.55,
            metalness: 0.0
        });
        const sideMat = new THREE.MeshStandardMaterial({ color: 0xb6844a, roughness: 0.7, metalness: 0.02 });
        const surface = new THREE.Mesh(surfaceGeometry, [sideMat, sideMat, topMat, sideMat, sideMat, sideMat]);
        surface.receiveShadow = true;
        surface.castShadow = false;
        group.add(surface);

        this.boardGroup = group;
        this.sceneManager.add(group);
    }

    _setupInteraction() {
        const { thickness } = this.sceneManager.config.board;
        const planeGeometry = new THREE.PlaneGeometry(100, 100);
        const planeMaterial = new THREE.MeshBasicMaterial({ visible: false });
        this._boardPlane = new THREE.Mesh(planeGeometry, planeMaterial);
        this._boardPlane.rotation.x = -Math.PI / 2;
        this._boardPlane.position.y = thickness / 2 + 0.01;
        this.sceneManager.scene.add(this._boardPlane);

        this._clickHandler = (event) => this._handleClick(event);
        this.sceneManager.renderer.domElement.addEventListener('click', this._clickHandler);
    }

    _handleClick(event) {
        if (!this._onCellClick || this._disposed) return;
        const canvas = this.sceneManager.renderer.domElement;
        const rect = canvas.getBoundingClientRect();
        this._mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this._mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        this._raycaster.setFromCamera(this._mouse, this.sceneManager.camera);
        const hits = this._raycaster.intersectObject(this._boardPlane);
        if (!hits.length) return;
        const { x, z } = hits[0].point;
        const cell = worldToBoard(x, z, this.boardSize, this.cellSize);
        if (!cell) return;
        this._onCellClick(cell);
    }

    /**
     * 注册点击交叉点回调。
     * @param {(move:{row:number,col:number})=>void} cb
     */
    onCellClick(cb) {
        this._onCellClick = cb;
    }

    /**
     * 切换棋盘路数。会重建棋盘与贴图，清空棋子。
     */
    setBoardSize(size) {
        if (size === this.boardSize) return;
        this.boardSize = size;
        this.clearStones();
        this.buildBoard();
        this.cameraController?.fitToBoard(size, false);
    }

    /**
     * 根据 state.board 二维数组增量同步棋子。
     * 对比 last snapshot 与当前 board，只 add/remove 变化的交叉点。
     * @param {Array<Array<string|null>>} board
     */
    syncBoard(board) {
        if (!Array.isArray(board)) return;
        const size = board.length;
        // 尺寸变化 → fallback 到全量重建
        if (!this._lastBoard || this._lastBoard.length !== size) {
            this.clearStones();
            this._lastBoard = Array.from({ length: size }, () => Array(size).fill(null));
        }
        const thickness = this.sceneManager.config.board.thickness;
        for (let row = 0; row < size; row += 1) {
            for (let col = 0; col < size; col += 1) {
                const prev = this._lastBoard[row][col];
                const curr = board[row][col];
                if (prev === curr) continue;
                if (prev) this._removeStone(row, col);
                if (curr === 'black' || curr === 'white') {
                    this._placeStone(curr, row, col, thickness);
                }
                this._lastBoard[row][col] = curr;
            }
        }
        this.sceneManager.needsRender = true;
    }

    _placeStone(color, row, col, thickness) {
        const { x, z } = goBoardToWorld(row, col, this.boardSize, this.cellSize);
        const geometry = this.stoneBuilder.getStoneGeometry();
        const material = this.materialFactory.getStoneMaterial(color);
        const stone = new THREE.Mesh(geometry, material);
        stone.position.set(x, thickness / 2 + this.sceneManager.config.stone.height, z);
        stone.name = `go_stone_${row}_${col}`;
        stone.castShadow = true;
        stone.receiveShadow = true;
        this.stoneBuilder.stonesGroup.add(stone);
    }

    _removeStone(row, col) {
        const group = this.stoneBuilder?.stonesGroup;
        if (!group) return;
        const stone = group.getObjectByName(`go_stone_${row}_${col}`);
        if (stone) group.remove(stone);
    }

    clearStones() {
        if (!this.stoneBuilder?.stonesGroup) return;
        const group = this.stoneBuilder.stonesGroup;
        while (group.children.length > 0) {
            group.remove(group.children[0]);
        }
        this._lastBoard = null;
    }

    show() {
        this.container.classList.remove('hidden');
        this.container.setAttribute('aria-hidden', 'false');
        this.sceneManager?.startRenderLoop?.();
        // 尺寸可能在隐藏时变化，重新 fit
        if (this.container.clientWidth && this.container.clientHeight) {
            this.sceneManager?.handleResize?.();
        }
    }

    hide() {
        this.container.classList.add('hidden');
        this.container.setAttribute('aria-hidden', 'true');
        this.sceneManager?.stopRenderLoop?.();
    }

    dispose() {
        this._disposed = true;
        if (this._clickHandler && this.sceneManager?.renderer?.domElement) {
            this.sceneManager.renderer.domElement.removeEventListener('click', this._clickHandler);
        }
        this.clearStones();
        this.boardTexture?.dispose();
        this.stoneBuilder?.dispose?.();
        this.materialFactory?.dispose?.();
        this.lightingSetup?.dispose?.();
        this.cameraController?.dispose?.();
        this.sceneManager?.dispose?.();
    }
}
