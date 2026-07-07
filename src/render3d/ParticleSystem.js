/**
 * 粒子特效系统
 * 包含落子粒子、获胜粉碎特效、环境粒子
 */

import * as THREE from 'three';

export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
        this.geometry = new THREE.BufferGeometry();
        this.maxParticles = 1000;
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

        for (let i = 0; i < 20; i++) {
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
     * 环境粒子（背景浮动光点）
     */
    emitAmbientParticles() {
        const color = new THREE.Color(0.3, 0.4, 0.6);

        for (let i = 0; i < 50; i++) {
            this.addParticle({
                x: (Math.random() - 0.5) * 30,
                y: Math.random() * 15,
                z: (Math.random() - 0.5) * 30,
                vx: (Math.random() - 0.5) * 0.2,
                vy: Math.random() * 0.1,
                vz: (Math.random() - 0.5) * 0.2,
                color: color,
                size: 0.03 + Math.random() * 0.03,
                lifetime: 5 + Math.random() * 5,
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
     */
    update(deltaTime) {
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
     * 销毁粒子系统
     */

    /**
     * Emit celebration particles at a board position.
     * @param {number} row
     * @param {number} col
     * @param {number} boardSize
     * @param {number} cellSize
     * @param {number} boardThickness
     * @param {number} color - particle color
     */
    emitVictoryParticles(row, col, boardSize, cellSize, boardThickness, color = 0xd4af37) {
        const world = boardToWorld(row, col, boardSize, cellSize);
        const count = 3;
        for (let i = 0; i < count; i++) {
            const size = 0.04 + Math.random() * 0.06;
            const velocity = {
                x: (Math.random() - 0.5) * 1.2,
                y: 2.5 + Math.random() * 2.0,
                z: (Math.random() - 0.5) * 1.2,
            };
            this.particles.push({
                position: { x: world.x, y: boardThickness + 0.2, z: world.z },
                velocity,
                size,
                color,
                life: 1.0,
                decay: 0.3 + Math.random() * 0.3,
                gravity: -4.0,
                tag: 'victory',
            });
        }
        this.needsUpdate = true;
    }

    dispose() {
        this.geometry.dispose();
        this.material.dispose();
        this.scene.remove(this.points);
    }
}
