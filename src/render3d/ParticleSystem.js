/**
 * 粒子特效系统
 * 包含落子粒子、获胜粉碎特效、环境粒子
 */

import * as THREE from 'three';
import { boardToWorld } from '../config/renderConfig.js';

/**
 * 各氛围的环境粒子性格：
 * - 家里：暖白尘埃，被窗光照亮后缓慢上浮
 * - 公园：黄绿落叶与花粉，向下飘并大幅横摆
 * - 比赛：冷白微光尘，几乎静止，只做极缓的浮沉
 */
const AMBIENT_STEP = 1 / 30;

const AMBIENT_PRESETS = {
    home: {
        colors: [0xffd9a0, 0xffe8c4, 0xfff4e2],
        size: 0.085,
        opacity: 0.5,
        rise: 0.24,
        sway: 0.32,
    },
    park: {
        colors: [0xd8c866, 0xc9a94e, 0xa8c46a, 0xfff0c0],
        size: 0.11,
        opacity: 0.44,
        rise: -0.34,
        sway: 0.62,
    },
    competition: {
        colors: [0xdfe7f2, 0xf2f4f8, 0xc9d6e8],
        size: 0.07,
        opacity: 0.34,
        rise: 0.12,
        sway: 0.16,
    },
};

export class ParticleSystem {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.geometry = new THREE.BufferGeometry();
        this.maxParticles = options.maxParticles ?? 1000;
        this.dropBurst = options.dropBurst ?? 20;
        this.activeCount = 0;

        // 粒子属性
        this.positions = new Float32Array(this.maxParticles * 3);
        this.velocities = new Float32Array(this.maxParticles * 3);
        this.colors = new Float32Array(this.maxParticles * 3);
        this.sizes = new Float32Array(this.maxParticles);
        this.lifetimes = new Float32Array(this.maxParticles);

        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
        this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));

        this.material = new THREE.PointsMaterial({
            size: 0.1,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });

        this.points = new THREE.Points(this.geometry, this.material);
        this.scene.add(this.points);

        // 氛围粒子独立成层：不受重力与碰撞影响，只做缓慢漂浮循环
        this.ambient = null;
    }

    /**
     * 按氛围配置环境粒子（家里=尘埃光点 / 公园=飘落叶与花粉 / 比赛=微光尘）。
     * 数量为 0 时直接拆除该层，低端设备完全不付代价。
     * @param {string} scenePreset 'home' | 'park' | 'competition'
     * @param {number} count 粒子数量（由 renderConfig 的设备画像决定）
     * @param {{ radius: number, floorY: number, height: number }} bounds 漂浮区域
     */
    emitAmbientParticles(scenePreset = 'competition', count = 0, bounds = {}) {
        this.disposeAmbient();
        if (!Number.isFinite(count) || count <= 0) {
            return;
        }

        const preset = AMBIENT_PRESETS[scenePreset] ?? AMBIENT_PRESETS.competition;
        const radius = bounds.radius ?? 14;
        const floorY = bounds.floorY ?? -2;
        const height = bounds.height ?? 10;

        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const sizes = new Float32Array(count);
        const phases = new Float32Array(count);
        const speeds = new Float32Array(count);

        const color = new THREE.Color();
        for (let i = 0; i < count; i += 1) {
            const i3 = i * 3;
            const angle = Math.random() * Math.PI * 2;
            const spread = Math.sqrt(Math.random()) * radius;
            positions[i3] = Math.cos(angle) * spread;
            positions[i3 + 1] = floorY + Math.random() * height;
            positions[i3 + 2] = Math.sin(angle) * spread;

            color.setHex(preset.colors[i % preset.colors.length]);
            const shade = 0.75 + Math.random() * 0.25;
            colors[i3] = color.r * shade;
            colors[i3 + 1] = color.g * shade;
            colors[i3 + 2] = color.b * shade;

            sizes[i] = preset.size * (0.6 + Math.random() * 0.8);
            phases[i] = Math.random() * Math.PI * 2;
            speeds[i] = preset.rise * (0.5 + Math.random());
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        const material = new THREE.PointsMaterial({
            size: preset.size,
            vertexColors: true,
            transparent: true,
            opacity: preset.opacity,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            sizeAttenuation: true,
        });

        const points = new THREE.Points(geometry, material);
        points.name = `ambient-particles:${scenePreset}`;
        points.frustumCulled = false;
        this.scene.add(points);

        this.ambient = {
            points,
            geometry,
            material,
            positions,
            phases,
            speeds,
            count,
            floorY,
            height,
            sway: preset.sway,
            elapsed: 0,
            accumulator: 0,
        };
    }

    /**
     * 推进氛围粒子。以 30fps 步进积分，避免仅为了漂浮粒子就把
     * 按需渲染的场景拉到满帧。
     * @returns {boolean} 本次是否真的移动了粒子（需要重绘）
     */
    updateAmbient(deltaTime) {
        const ambient = this.ambient;
        if (!ambient) {
            return false;
        }

        ambient.accumulator += deltaTime;
        if (ambient.accumulator < AMBIENT_STEP) {
            return false;
        }
        const step = ambient.accumulator;
        ambient.accumulator = 0;
        ambient.elapsed += step;
        deltaTime = step;

        const { positions, phases, speeds, count, floorY, height, sway } = ambient;
        const top = floorY + height;

        for (let i = 0; i < count; i += 1) {
            const i3 = i * 3;
            const phase = phases[i] + ambient.elapsed * 0.6;
            positions[i3] += Math.cos(phase) * sway * deltaTime;
            positions[i3 + 1] += speeds[i] * deltaTime;
            positions[i3 + 2] += Math.sin(phase * 0.8) * sway * deltaTime;

            // 越界后从另一端回流，维持恒定密度
            if (positions[i3 + 1] > top) {
                positions[i3 + 1] = floorY;
            } else if (positions[i3 + 1] < floorY) {
                positions[i3 + 1] = top;
            }
        }

        ambient.geometry.attributes.position.needsUpdate = true;
        return true;
    }

    disposeAmbient() {
        if (!this.ambient) {
            return;
        }
        this.scene.remove(this.ambient.points);
        this.ambient.geometry.dispose();
        this.ambient.material.dispose();
        this.ambient = null;
    }

    /**
     * 添加落子粒子效果
     * @param {number} x 世界坐标 X
     * @param {number} y 世界坐标 Y
     * @param {number} z 世界坐标 Z
     * @param {string} color 棋子颜色 'black' | 'white'
     */
    emitDropParticles(x, y, z, color) {
        const particleColor = color === 'black'
            ? new THREE.Color(0.2, 0.2, 0.2)
            : new THREE.Color(0.95, 0.95, 0.9);

        for (let i = 0; i < this.dropBurst; i++) {
            this.addParticle({
                x: x + (Math.random() - 0.5) * 0.3,
                y: y,
                z: z + (Math.random() - 0.5) * 0.3,
                vx: (Math.random() - 0.5) * 2,
                vy: Math.random() * 3 + 1,
                vz: (Math.random() - 0.5) * 2,
                color: particleColor,
                size: 0.08 + Math.random() * 0.06,
                lifetime: 1 + Math.random() * 0.5,
            });
        }
    }

    /**
     * 获胜粉碎特效
     * @param {Array<{x, y, z}>} positions 获胜棋子位置
     * @param {string} color 棋子颜色
     */
    emitShatterEffect(positions, color) {
        const particleColor = color === 'black'
            ? new THREE.Color(0.3, 0.3, 0.3)
            : new THREE.Color(1, 1, 0.95);

        // 为每个获胜位置发射大量粒子
        positions.forEach(pos => {
            // 爆炸核心
            for (let i = 0; i < 50; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 3 + Math.random() * 5;
                const elevation = Math.random() * Math.PI - Math.PI / 2;

                this.addParticle({
                    x: pos.x,
                    y: pos.y,
                    z: pos.z,
                    vx: Math.cos(angle) * Math.cos(elevation) * speed,
                    vy: Math.sin(elevation) * speed + 2,
                    vz: Math.sin(angle) * Math.cos(elevation) * speed,
                    color: particleColor,
                    size: 0.15 + Math.random() * 0.1,
                    lifetime: 2 + Math.random(),
                });
            }

            // 环形波
            for (let i = 0; i < 30; i++) {
                const angle = (i / 30) * Math.PI * 2;
                this.addParticle({
                    x: pos.x,
                    y: pos.y,
                    z: pos.z,
                    vx: Math.cos(angle) * 4,
                    vy: 1,
                    vz: Math.sin(angle) * 4,
                    color: new THREE.Color(0.5, 0.3, 1),
                    size: 0.12,
                    lifetime: 1.5,
                });
            }
        });

        // 闪光效果
        const flashColor = new THREE.Color(1, 0.9, 0.5);
        for (let i = 0; i < 100; i++) {
            this.addParticle({
                x: (Math.random() - 0.5) * 20,
                y: Math.random() * 10,
                z: (Math.random() - 0.5) * 20,
                vx: 0,
                vy: -0.5,
                vz: 0,
                color: flashColor,
                size: 0.05 + Math.random() * 0.05,
                lifetime: 0.5 + Math.random() * 0.5,
            });
        }
    }

    /**
     * 添加单个粒子
     */
    addParticle({ x, y, z, vx, vy, vz, color, size, lifetime }) {
        const index = this.activeCount;
        if (index >= this.maxParticles) return;

        const i3 = index * 3;

        this.positions[i3] = x;
        this.positions[i3 + 1] = y;
        this.positions[i3 + 2] = z;

        this.velocities[i3] = vx;
        this.velocities[i3 + 1] = vy;
        this.velocities[i3 + 2] = vz;

        this.colors[i3] = color.r;
        this.colors[i3 + 1] = color.g;
        this.colors[i3 + 2] = color.b;

        this.sizes[index] = size;
        this.lifetimes[index] = lifetime;

        this.activeCount++;
    }

    /**
     * 更新粒子系统
     * @param {number} deltaTime 帧间隔（秒）
     * @returns {boolean} 本帧是否有粒子在动（需要重绘）
     */
    update(deltaTime) {
        const ambientAdvanced = this.updateAmbient(deltaTime);
        if (this.activeCount === 0) {
            return ambientAdvanced;
        }

        const gravity = -9.8;

        for (let i = this.activeCount - 1; i >= 0; i--) {
            const i3 = i * 3;

            // 更新生命周期
            this.lifetimes[i] -= deltaTime;
            if (this.lifetimes[i] <= 0) {
                // 移除粒子（与最后一个交换）
                this.swapParticles(i, this.activeCount - 1);
                this.activeCount--;
                continue;
            }

            // 更新速度
            this.velocities[i3 + 1] += gravity * deltaTime;

            // 更新位置
            this.positions[i3] += this.velocities[i3] * deltaTime;
            this.positions[i3 + 1] += this.velocities[i3 + 1] * deltaTime;
            this.positions[i3 + 2] += this.velocities[i3 + 2] * deltaTime;

            // 地面碰撞
            if (this.positions[i3 + 1] < 0) {
                this.positions[i3 + 1] = 0;
                this.velocities[i3 + 1] *= -0.3;
            }

            // 淡出效果
            const life = this.lifetimes[i];
            const fadeStart = 0.5;
            if (life < fadeStart) {
                this.sizes[i] *= 0.98;
            }
        }

        // 更新缓冲区
        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.color.needsUpdate = true;
        this.geometry.attributes.size.needsUpdate = true;
        this.geometry.setDrawRange(0, this.activeCount);
        return true;
    }

    /**
     * 交换两个粒子
     */
    swapParticles(i, j) {
        const i3 = i * 3;
        const j3 = j * 3;

        // 交换位置
        [this.positions[i3], this.positions[j3]] = [this.positions[j3], this.positions[i3]];
        [this.positions[i3 + 1], this.positions[j3 + 1]] = [this.positions[j3 + 1], this.positions[i3 + 1]];
        [this.positions[i3 + 2], this.positions[j3 + 2]] = [this.positions[j3 + 2], this.positions[i3 + 2]];

        // 交换速度
        [this.velocities[i3], this.velocities[j3]] = [this.velocities[j3], this.velocities[i3]];
        [this.velocities[i3 + 1], this.velocities[j3 + 1]] = [this.velocities[j3 + 1], this.velocities[i3 + 1]];
        [this.velocities[i3 + 2], this.velocities[j3 + 2]] = [this.velocities[j3 + 2], this.velocities[i3 + 2]];

        // 交换颜色
        [this.colors[i3], this.colors[j3]] = [this.colors[j3], this.colors[i3]];
        [this.colors[i3 + 1], this.colors[j3 + 1]] = [this.colors[j3 + 1], this.colors[i3 + 1]];
        [this.colors[i3 + 2], this.colors[j3 + 2]] = [this.colors[j3 + 2], this.colors[i3 + 2]];

        // 交换大小和生命
        [this.sizes[i], this.sizes[j]] = [this.sizes[j], this.sizes[i]];
        [this.lifetimes[i], this.lifetimes[j]] = [this.lifetimes[j], this.lifetimes[i]];
    }

    /**
     * 清除所有粒子
     */
    clear() {
        this.activeCount = 0;
    }

    /**
     * Emit celebration particles at a board position using the buffer particle system.
     * @param {number} row
     * @param {number} col
     * @param {number} boardSize
     * @param {number} cellSize
     * @param {number} boardThickness
     * @param {number} color - particle color hex
     */
    emitVictoryParticles(row, col, boardSize, cellSize, boardThickness, color = 0xd4af37) {
        const world = boardToWorld(row, col, boardSize, cellSize);
        const particleColor = new THREE.Color(color);
        for (let i = 0; i < 30; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1.5 + Math.random() * 3;
            this.addParticle({
                x: world.x + (Math.random() - 0.5) * 0.5,
                y: boardThickness / 2,
                z: world.z + (Math.random() - 0.5) * 0.5,
                vx: Math.cos(angle) * speed,
                vy: 2.5 + Math.random() * 2.0,
                vz: Math.sin(angle) * speed,
                color: particleColor,
                size: 0.05 + Math.random() * 0.08,
                lifetime: 1.0 + Math.random() * 0.8,
            });
        }
    }

    dispose() {
        this.disposeAmbient();
        this.geometry.dispose();
        this.material.dispose();
        this.scene.remove(this.points);
    }
}
