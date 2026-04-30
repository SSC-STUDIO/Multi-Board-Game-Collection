/**
 * 棋子构建器
 * 创建黑/白棋子、预览棋子、获胜棋子
 */

import * as THREE from 'three';
import { RENDER_CONFIG, boardToWorld } from '../config/renderConfig.js';
import { MaterialFactory } from './MaterialFactory.js';

export class StoneBuilder {
    constructor(config = RENDER_CONFIG) {
        this.config = config;
        this.materialFactory = new MaterialFactory(config);
        this.geometryCache = new Map();
        this.stonesGroup = null;
    }

    /**
     * 创建棋子组
     * @returns {THREE.Group}
     */
    createStonesGroup() {
        this.stonesGroup = new THREE.Group();
        this.stonesGroup.name = 'stones';
        return this.stonesGroup;
    }

    /**
     * 获取棋子几何体（带缓存）
     * @param {number} segments 分段数
     * @returns {THREE.SphereGeometry}
     */
    getStoneGeometry(segments = this.config.stone.segments) {
        const requestedSegments = Number.isFinite(segments) ? segments : RENDER_CONFIG.stone.segments;
        const stoneSegments = Math.max(8, Math.floor(requestedSegments));
        const key = `stone_${stoneSegments}`;
        if (!this.geometryCache.has(key)) {
            const { radius, height } = this.config.stone;
            const geometry = new THREE.SphereGeometry(radius, stoneSegments, stoneSegments);
            geometry.scale(1, height / radius, 1);
            this.geometryCache.set(key, geometry);
        }
        return this.geometryCache.get(key);
    }

    /**
     * 创建单个棋子
     * @param {string} color 'black' | 'white'
     * @param {number} row 行号
     * @param {number} col 列号
     * @param {number} boardSize 棋盘大小
     * @param {number} cellSize 格子尺寸
     * @param {number} boardThickness 棋盘厚度
     * @returns {THREE.Mesh}
     */
    createStone(color, row, col, boardSize, cellSize, boardThickness) {
        const geometry = this.getStoneGeometry();
        const material = this.materialFactory.getStoneMaterial(color);
        const stone = new THREE.Mesh(geometry, material);

        const worldPos = boardToWorld(row, col, boardSize, cellSize);
        stone.position.set(worldPos.x, boardThickness / 2 + this.config.stone.height, worldPos.z);
        stone.name = `stone_${row}_${col}`;
        stone.userData = { row, col, color, isLastMove: false };
        stone.castShadow = true;
        stone.receiveShadow = true;

        return stone;
    }

    /**
     * 添加棋子到场景
     * @param {string} color 'black' | 'white'
     * @param {number} row 行号
     * @param {number} col 列号
     * @param {number} boardSize 棋盘大小
     * @param {number} cellSize 格子尺寸
     * @param {number} boardThickness 棋盘厚度
     * @returns {THREE.Mesh}
     */
    addStone(color, row, col, boardSize, cellSize, boardThickness) {
        const existing = this.getStone(row, col);
        if (existing) {
            if (existing.userData.color === color) {
                return existing;
            }
            this.removeStone(row, col);
        }

        const stone = this.createStone(color, row, col, boardSize, cellSize, boardThickness);
        if (this.stonesGroup) {
            this.stonesGroup.add(stone);
        }
        return stone;
    }

    /**
     * 移除棋子
     * @param {number} row 行号
     * @param {number} col 列号
     * @returns {boolean} 是否成功移除
     */
    removeStone(row, col) {
        if (!this.stonesGroup) return false;

        const stoneName = `stone_${row}_${col}`;
        const stone = this.stonesGroup.getObjectByName(stoneName);
        if (stone) {
            this.stonesGroup.remove(stone);
            return true;
        }
        return false;
    }

    /**
     * 获取棋子
     * @param {number} row 行号
     * @param {number} col 列号
     * @returns {THREE.Mesh | null}
     */
    getStone(row, col) {
        if (!this.stonesGroup) return null;
        const stoneName = `stone_${row}_${col}`;
        return this.stonesGroup.getObjectByName(stoneName);
    }

    getAllStones() {
        if (!this.stonesGroup) {
            return [];
        }

        return this.stonesGroup.children.filter((object) => object.isMesh && !object.userData.isPreview);
    }

    /**
     * 清除所有棋子
     */
    clearAllStones() {
        if (!this.stonesGroup) return;

        const stones = this.getAllStones();
        stones.forEach((stone) => {
            this.stonesGroup.remove(stone);
        });
    }

    resetStoneStyles() {
        this.getAllStones().forEach((stone) => {
            stone.material = this.materialFactory.getStoneMaterial(stone.userData.color);
            stone.scale.set(1, 1, 1);
            stone.userData.isLastMove = false;
        });
    }

    /**
     * 创建预览棋子
     * @param {string} color 'black' | 'white'
     * @param {number} row 行号
     * @param {number} col 列号
     * @param {number} boardSize 棋盘大小
     * @param {number} cellSize 格子尺寸
     * @param {number} boardThickness 棋盘厚度
     * @returns {THREE.Mesh}
     */
    createPreviewStone(color, row, col, boardSize, cellSize, boardThickness) {
        const geometry = this.getStoneGeometry();
        const material = this.materialFactory.getStoneMaterial(color, true);
        const stone = new THREE.Mesh(geometry, material);

        const worldPos = boardToWorld(row, col, boardSize, cellSize);
        stone.position.set(worldPos.x, boardThickness / 2 + this.config.stone.height, worldPos.z);
        stone.name = 'preview_stone';
        stone.userData = { row, col, isPreview: true };

        return stone;
    }

    /**
     * 高亮获胜棋子
     * @param {Array<{row: number, col: number}>} winningCells
     */
    highlightWinningStones(winningCells) {
        if (!this.stonesGroup || !winningCells) return;

        winningCells.forEach(({ row, col }) => {
            const stone = this.getStone(row, col);
            if (stone) {
                stone.material = this.materialFactory.createWinningStoneMaterial(stone.userData.color);
            }
        });
    }

    /**
     * 高亮最后一手棋子
     * @param {number} row 行号
     * @param {number} col 列号
     */
    highlightLastMove(row, col) {
        this.getAllStones().forEach((stone) => {
            if (stone.userData.isLastMove) {
                stone.userData.isLastMove = false;
                stone.scale.set(1, 1, 1);
            }
        });

        const stone = this.getStone(row, col);
        if (stone) {
            stone.userData.isLastMove = true;
            stone.scale.set(1.05, 1.05, 1.05);
        }
    }

    /**
     * 销毁资源
     */
    dispose() {
        this.geometryCache.forEach((geometry) => {
            geometry.dispose();
        });
        this.geometryCache.clear();
        this.materialFactory.dispose();
    }
}
