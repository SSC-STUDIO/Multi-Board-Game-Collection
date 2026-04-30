/**
 * 棋盘构建器
 * 创建 3D 棋盘模型：烘焙网格表面、底座、边框
 */

import * as THREE from 'three';
import { RENDER_CONFIG } from '../config/renderConfig.js';
import { MaterialFactory } from './MaterialFactory.js';

export class BoardBuilder {
    constructor(config = RENDER_CONFIG, options = {}) {
        this.config = config;
        this.materialFactory = new MaterialFactory(config, options);
        this.boardGroup = null;
    }

    /**
     * 创建完整棋盘
     * @param {number} size 棋盘大小
     * @returns {THREE.Group}
     */
    build(size = 15) {
        this.boardGroup = new THREE.Group();
        this.boardGroup.name = 'board';

        const { cellSize, thickness, baseHeight, borderWidth } = this.config.board;
        const boardSpan = (size - 1) * cellSize;
        const totalSize = boardSpan + borderWidth * 2;
        const starPositions = this.getStarPositions(size);

        this.addBase(totalSize, baseHeight, thickness);
        this.addBoardSurface(totalSize, thickness, size, starPositions);
        this.addBorder(totalSize, thickness);
        this.setupShadows();

        return this.boardGroup;
    }

    /**
     * 添加底座
     */
    addBase(totalSize, baseHeight, thickness) {
        const baseGeometry = new THREE.BoxGeometry(
            totalSize + 0.2,
            baseHeight,
            totalSize + 0.2
        );
        const baseMaterial = this.materialFactory.createBaseMaterial();
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.name = 'base';
        base.position.y = -thickness / 2 - baseHeight / 2;
        base.receiveShadow = true;
        base.castShadow = false;
        this.boardGroup.add(base);
    }

    /**
     * 添加棋盘表面
     */
    addBoardSurface(totalSize, thickness, size, starPositions) {
        const surfaceGeometry = new THREE.BoxGeometry(totalSize, thickness, totalSize);
        const surfaceMaterial = this.materialFactory.createBoardMaterial(size, totalSize, starPositions);
        const surface = new THREE.Mesh(surfaceGeometry, surfaceMaterial);
        surface.name = 'surface';
        surface.receiveShadow = true;
        surface.castShadow = false;
        this.boardGroup.add(surface);
    }

    /**
     * 添加边框装饰
     */
    addBorder(totalSize, thickness) {
        const borderMaterial = this.materialFactory.createBaseMaterial();
        const borderHeight = thickness * 0.3;
        const borderWidth = 0.15;

        const borderGroup = new THREE.Group();
        borderGroup.name = 'border';

        const edges = [
            { pos: [0, thickness / 2 + borderHeight / 2, -totalSize / 2], size: [totalSize, borderHeight, borderWidth] },
            { pos: [0, thickness / 2 + borderHeight / 2, totalSize / 2], size: [totalSize, borderHeight, borderWidth] },
            { pos: [-totalSize / 2, thickness / 2 + borderHeight / 2, 0], size: [borderWidth, borderHeight, totalSize] },
            { pos: [totalSize / 2, thickness / 2 + borderHeight / 2, 0], size: [borderWidth, borderHeight, totalSize] },
        ];

        edges.forEach(({ pos, size }, index) => {
            const geometry = new THREE.BoxGeometry(...size);
            const border = new THREE.Mesh(geometry, borderMaterial);
            border.position.set(...pos);
            border.name = `border_${index}`;
            border.receiveShadow = true;
            border.castShadow = true;
            borderGroup.add(border);
        });

        const cornerSize = 0.3;
        const cornerPositions = [
            [-totalSize / 2, totalSize / 2],
            [totalSize / 2, totalSize / 2],
            [-totalSize / 2, -totalSize / 2],
            [totalSize / 2, -totalSize / 2],
        ];

        cornerPositions.forEach(([x, z], index) => {
            const geometry = new THREE.CylinderGeometry(cornerSize / 2, cornerSize / 2, borderHeight, 8);
            const corner = new THREE.Mesh(geometry, borderMaterial);
            corner.position.set(x, thickness / 2 + borderHeight / 2, z);
            corner.name = `corner_${index}`;
            corner.receiveShadow = true;
            corner.castShadow = true;
            borderGroup.add(corner);
        });

        this.boardGroup.add(borderGroup);
    }

    /**
     * 设置阴影属性
     */
    setupShadows() {
        this.boardGroup.traverse((object) => {
            if (object.isMesh) {
                object.receiveShadow = true;
                object.castShadow = object.name.startsWith('border_') || object.name.startsWith('corner_');
            }
        });
    }

    /**
     * 获取星位点位置
     * @param {number} size 棋盘大小
     * @returns {Array<{row: number, col: number}>}
     */
    getStarPositions(size) {
        if (size === 15) {
            return [
                { row: 7, col: 7 },
                { row: 3, col: 3 }, { row: 3, col: 7 }, { row: 3, col: 11 },
                { row: 7, col: 3 }, { row: 7, col: 11 },
                { row: 11, col: 3 }, { row: 11, col: 7 }, { row: 11, col: 11 },
            ];
        }

        if (size === 19) {
            return [
                { row: 9, col: 9 },
                { row: 3, col: 3 }, { row: 3, col: 9 }, { row: 3, col: 15 },
                { row: 9, col: 3 }, { row: 9, col: 15 },
                { row: 15, col: 3 }, { row: 15, col: 9 }, { row: 15, col: 15 },
            ];
        }

        const center = Math.floor(size / 2);
        return [{ row: center, col: center }];
    }

    /**
     * 销毁棋盘
     */
    dispose() {
        if (this.boardGroup) {
            this.boardGroup.traverse((object) => {
                if (object.geometry) {
                    object.geometry.dispose();
                }
            });
        }
        this.materialFactory.dispose();
    }
}
