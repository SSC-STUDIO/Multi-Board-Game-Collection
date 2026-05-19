/**
 * 材质工厂
 * 创建棋盘、棋子等游戏元素的材质
 */

import * as THREE from 'three';
import { RENDER_CONFIG } from '../config/renderConfig.js';

export class MaterialFactory {
    constructor(config = RENDER_CONFIG, options = {}) {
        this.config = config;
        this.maxAnisotropy = options.maxAnisotropy ?? 1;
        this.cache = new Map();
    }

    /**
     * 获取或创建材质（带缓存）
     * @param {string} key 缓存键
     * @param {Function} createFn 创建函数
     * @returns {THREE.Material}
     */
    getOrCreate(key, createFn) {
        if (this.cache.has(key)) {
            return this.cache.get(key);
        }
        const material = createFn();
        this.cache.set(key, material);
        return material;
    }

    /**
     * 创建棋盘木纹材质
     * @returns {THREE.MeshStandardMaterial}
     */
    createBoardMaterial(size = this.config.board.size, totalSize = 0, starPositions = []) {
        return this.getOrCreate(`board_${size}`, () => {
            const texture = this.createBoardTexture(size, totalSize, starPositions);
            return new THREE.MeshStandardMaterial({
                color: 0xffffff,
                map: texture,
                roughness: 0.72,
                metalness: 0.02,
                side: THREE.FrontSide,
            });
        });
    }

    createBoardTexture(size, totalSize, starPositions) {
        const borderRatio = totalSize > 0 ? this.config.board.borderWidth / totalSize : 0.04;
        const defaultTextureSize = size >= 19 ? 2048 : 1536;
        const textureSizeCap = this.config.board.textureSizeCap ?? defaultTextureSize;
        const textureSize = Math.min(defaultTextureSize, textureSizeCap);
        const margin = textureSize * borderRatio;
        const workingSize = textureSize - margin * 2;
        const step = size > 1 ? workingSize / (size - 1) : workingSize;

        const canvas = document.createElement('canvas');
        canvas.width = textureSize;
        canvas.height = textureSize;
        const ctx = canvas.getContext('2d');

        const baseGradient = ctx.createLinearGradient(0, 0, textureSize, textureSize);
        baseGradient.addColorStop(0, '#d9a066');
        baseGradient.addColorStop(0.52, '#b97a3f');
        baseGradient.addColorStop(1, '#8f582d');
        ctx.fillStyle = baseGradient;
        ctx.fillRect(0, 0, textureSize, textureSize);

        for (let index = 0; index < 180; index += 1) {
            const alpha = 0.028 + Math.random() * 0.035;
            ctx.strokeStyle = `rgba(86, 50, 24, ${alpha.toFixed(3)})`;
            ctx.lineWidth = 1 + Math.random() * 1.6;
            const y = (index / 180) * textureSize;
            ctx.beginPath();
            ctx.moveTo(0, y + Math.sin(index * 0.35) * 8);
            ctx.bezierCurveTo(
                textureSize * 0.25,
                y - 10,
                textureSize * 0.7,
                y + 12,
                textureSize,
                y + Math.cos(index * 0.22) * 9
            );
            ctx.stroke();
        }

        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.fillRect(0, 0, textureSize, textureSize * 0.14);

        ctx.strokeStyle = 'rgba(33, 20, 9, 0.88)';
        ctx.lineCap = 'round';
        ctx.lineWidth = size >= 19 ? 3 : 3.6;

        for (let row = 0; row < size; row += 1) {
            const offset = margin + row * step;
            ctx.beginPath();
            ctx.moveTo(margin, offset);
            ctx.lineTo(textureSize - margin, offset);
            ctx.stroke();
        }

        for (let col = 0; col < size; col += 1) {
            const offset = margin + col * step;
            ctx.beginPath();
            ctx.moveTo(offset, margin);
            ctx.lineTo(offset, textureSize - margin);
            ctx.stroke();
        }

        ctx.fillStyle = 'rgba(22, 11, 3, 0.96)';
        const starRadius = Math.max(8, textureSize / 128);
        starPositions.forEach(({ row, col }) => {
            ctx.beginPath();
            ctx.arc(margin + col * step, margin + row * step, starRadius, 0, Math.PI * 2);
            ctx.fill();
        });

        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.max(1, Math.min(this.maxAnisotropy, 8));
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = true;
        texture.needsUpdate = true;

        return texture;
    }

    /**
     * 创建棋盘底座材质
     * @returns {THREE.MeshStandardMaterial}
     */
    createBaseMaterial() {
        return this.getOrCreate('base', () => {
            return new THREE.MeshStandardMaterial({
                color: this.config.colors.border,
                roughness: 0.7,
                metalness: 0.05,
            });
        });
    }

    /**
     * 创建网格线材质
     * @returns {THREE.LineBasicMaterial}
     */
    createGridLineMaterial() {
        return this.getOrCreate('gridLine', () => {
            return new THREE.LineBasicMaterial({
                color: this.config.colors.grid,
                linewidth: 1,
            });
        });
    }

    usesPhysicalStoneMaterials() {
        return this.config.stone.usePhysicalStoneMaterials !== false;
    }

    createStoneSurfaceMaterial(options, physicalOptions = {}) {
        if (!this.usesPhysicalStoneMaterials()) {
            return new THREE.MeshStandardMaterial(options);
        }

        return new THREE.MeshPhysicalMaterial({
            ...options,
            ...physicalOptions,
        });
    }

    /**
     * 创建黑子材质（玻璃质感）
     * @param {boolean} isPreview 是否为预览棋子
     * @returns {THREE.Material}
     */
    createBlackStoneMaterial(isPreview = false) {
        const key = isPreview ? 'blackStonePreview' : 'blackStone';
        return this.getOrCreate(key, () => {
            const { blackRoughness, blackMetalness, previewOpacity } = this.config.stone;
            return this.createStoneSurfaceMaterial({
                color: this.config.colors.blackStone,
                roughness: blackRoughness,
                metalness: blackMetalness,
                transparent: isPreview,
                opacity: isPreview ? previewOpacity : 1.0,
            }, {
                clearcoat: 0.3,
                clearcoatRoughness: 0.2,
                reflectivity: 0.5,
            });
        });
    }

    /**
     * 创建白子材质（玉石质感）
     * @param {boolean} isPreview 是否为预览棋子
     * @returns {THREE.Material}
     */
    createWhiteStoneMaterial(isPreview = false) {
        const key = isPreview ? 'whiteStonePreview' : 'whiteStone';
        return this.getOrCreate(key, () => {
            const { whiteRoughness, whiteMetalness, previewOpacity } = this.config.stone;
            return this.createStoneSurfaceMaterial({
                color: this.config.colors.whiteStone,
                roughness: whiteRoughness,
                metalness: whiteMetalness,
                transparent: isPreview,
                opacity: isPreview ? previewOpacity : 1.0,
            }, {
                clearcoat: 0.4,
                clearcoatRoughness: 0.15,
                sheen: 0.3,
                sheenRoughness: 0.5,
                sheenColor: new THREE.Color(0xffffff),
            });
        });
    }

    /**
     * 创建获胜棋子发光材质
     * @param {string} color 棋子颜色 ('black' | 'white')
     * @returns {THREE.Material}
     */
    createWinningStoneMaterial(color) {
        const key = `winning_${color}`;
        return this.getOrCreate(key, () => {
            const baseColor = color === 'black'
                ? this.config.colors.blackStone
                : this.config.colors.whiteStone;

            const options = {
                color: baseColor,
                emissive: color === 'black' ? 0x333333 : 0xffffff,
                emissiveIntensity: 0.5,
                roughness: color === 'black' ? 0.1 : 0.2,
                metalness: 0.1,
            };

            if (!this.usesPhysicalStoneMaterials()) {
                return new THREE.MeshStandardMaterial(options);
            }

            return new THREE.MeshPhysicalMaterial({
                ...options,
                clearcoat: 0.5,
            });
        });
    }

    /**
     * 根据棋子颜色获取对应材质
     * @param {string} color 'black' | 'white'
     * @param {boolean} isPreview 是否为预览
     * @returns {THREE.Material}
     */
    getStoneMaterial(color, isPreview = false) {
        if (color === 'black') {
            return this.createBlackStoneMaterial(isPreview);
        }
        return this.createWhiteStoneMaterial(isPreview);
    }

    /**
     * 创建星位点材质
     * @returns {THREE.MeshBasicMaterial}
     */
    createStarMaterial() {
        return this.getOrCreate('star', () => {
            return new THREE.MeshBasicMaterial({
                color: this.config.colors.star,
            });
        });
    }

    /**
     * 清除材质缓存
     */
    dispose() {
        this.cache.forEach((material) => {
            if (material.map) {
                material.map.dispose();
            }
            material.dispose();
        });
        this.cache.clear();
    }
}
