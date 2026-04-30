/**
 * 动画管理器
 * 管理落子动画、获胜动画、相机动画
 */

import * as THREE from 'three';
import { RENDER_CONFIG } from '../config/renderConfig.js';

export class AnimationManager {
    constructor(sceneManager, config = RENDER_CONFIG) {
        this.sceneManager = sceneManager;
        this.config = config;

        // 活跃动画列表
        this.activeAnimations = [];
        this.animationId = null;
        this.boundAnimate = this.runAnimationFrame.bind(this);
    }

    /**
     * 启动动画循环
     */
    startAnimationLoop() {
        if (this.animationId) {
            return;
        }

        this.animationId = requestAnimationFrame(this.boundAnimate);
    }

    runAnimationFrame() {
        this.animationId = null;
        this.update();

        if (this.activeAnimations.length > 0) {
            this.startAnimationLoop();
        }
    }

    /**
     * 更新所有活跃动画
     */
    update() {
        const now = performance.now();
        const toRemove = [];

        this.activeAnimations.forEach((animation, index) => {
            const elapsed = (now - animation.startTime) / 1000;
            const progress = Math.min(elapsed / animation.duration, 1);
            const eased = animation.easing(progress);

            // 调用更新回调
            if (animation.onUpdate) {
                animation.onUpdate(eased, progress);
            }

            // 动画完成
            if (progress >= 1) {
                if (animation.onComplete) {
                    animation.onComplete();
                }
                toRemove.push(index);
            }
        });

        // 移除已完成的动画
        for (let i = toRemove.length - 1; i >= 0; i--) {
            this.activeAnimations.splice(toRemove[i], 1);
        }

        // 如果有活跃动画，标记需要渲染
        if (this.activeAnimations.length > 0) {
            this.sceneManager.setNeedsRender();
        }
    }

    /**
     * 添加动画
     * @param {Object} animation 动画配置
     */
    addAnimation(animation) {
        this.activeAnimations.push({
            ...animation,
            tag: animation.tag ?? null,
            startTime: performance.now(),
        });
        this.startAnimationLoop();
    }

    /**
     * 按标签停止动画
     * @param {string} tag 动画标签
     */
    stopByTag(tag) {
        if (!tag) {
            return;
        }

        this.activeAnimations = this.activeAnimations.filter((animation) => animation.tag !== tag);
    }

    /**
     * 落子动画
     * @param {THREE.Mesh} stone 棋子网格
     * @param {number} targetY 目标 Y 坐标
     * @param {Function} onComplete 完成回调
     */
    playDropAnimation(stone, targetY, onComplete = null) {
        const { dropDuration, dropHeight, bounceScale } = this.config.animation;

        // 初始位置（在目标位置上方）
        const startY = targetY + dropHeight;
        stone.position.y = startY;
        stone.scale.set(0.5, 0.5, 0.5);

        // 下落阶段
        this.addAnimation({
            duration: dropDuration * 0.6,
            easing: this.easeOutQuad,
            onUpdate: (eased) => {
                stone.position.y = startY + (targetY - startY) * eased;
                const scale = 0.5 + 0.5 * eased;
                stone.scale.set(scale, scale, scale);
            },
            onComplete: () => {
                // 弹跳阶段
                this.playBounceAnimation(stone, bounceScale, dropDuration * 0.4, onComplete);
            },
        });
    }

    /**
     * 弹跳动画
     * @param {THREE.Mesh} stone 棋子网格
     * @param {number} bounceScale 弹跳缩放比例
     * @param {number} duration 时长
     * @param {Function} onComplete 完成回调
     */
    playBounceAnimation(stone, bounceScale, duration, onComplete = null) {
        const originalScale = 1;

        this.addAnimation({
            duration,
            easing: this.easeOutElastic,
            onUpdate: (eased) => {
                const scale = bounceScale + (originalScale - bounceScale) * eased;
                stone.scale.set(scale, scale, scale);
            },
            onComplete,
        });
    }

    /**
     * 获胜脉冲动画
     * @param {Array<THREE.Mesh>} stones 获胜棋子列表
     */
    playWinningPulseAnimation(stones, tag = 'winning-pulse') {
        const { winPulseDuration, winPulseIntensity } = this.config.animation;
        this.stopByTag(tag);

        stones.forEach((stone) => {
            if (!stone.material) return;

            const originalEmissiveIntensity = stone.material.emissiveIntensity || 0;

            this.addAnimation({
                tag,
                duration: winPulseDuration,
                easing: (t) => (Math.sin(t * Math.PI * 2) + 1) / 2, // 正弦波
                onUpdate: (eased) => {
                    stone.material.emissiveIntensity = originalEmissiveIntensity + eased * winPulseIntensity;
                },
            });
        });

        // 持续脉冲（循环）
        this.addAnimation({
            tag,
            duration: winPulseDuration * 3,
            easing: (t) => t,
            onUpdate: () => {
                stones.forEach((stone) => {
                    if (stone.material) {
                        const pulse = (Math.sin(performance.now() / 300) + 1) / 2;
                        stone.material.emissiveIntensity = 0.3 + pulse * winPulseIntensity;
                    }
                });
            },
        });
    }

    /**
     * 移除棋子动画（消失）
     * @param {THREE.Mesh} stone 棋子网格
     * @param {Function} onComplete 完成回调
     */
    playRemoveAnimation(stone, onComplete = null) {
        const duration = 0.3;

        this.addAnimation({
            duration,
            easing: this.easeInQuad,
            onUpdate: (eased) => {
                stone.scale.set(1 - eased * 0.5, 1 - eased * 0.5, 1 - eased * 0.5);
                stone.position.y += 0.02;
                if (stone.material) {
                    stone.material.opacity = 1 - eased;
                }
            },
            onComplete: () => {
                if (onComplete) {
                    onComplete();
                }
            },
        });
    }

    /**
     * 预览棋子闪烁动画
     * @param {THREE.Mesh} stone 预览棋子
     */
    playPreviewPulseAnimation(stone) {
        this.addAnimation({
            duration: 1.0,
            easing: (t) => (Math.sin(t * Math.PI * 2) + 1) / 2,
            onUpdate: (eased) => {
                if (stone.material) {
                    stone.material.opacity = 0.3 + eased * 0.3;
                }
            },
        });
    }

    // 缓动函数
    easeOutQuad(t) {
        return 1 - (1 - t) * (1 - t);
    }

    easeInQuad(t) {
        return t * t;
    }

    easeOutElastic(t) {
        const c4 = (2 * Math.PI) / 3;
        return t === 0 ? 0 : t === 1 ? 1 :
            Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    }

    easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    /**
     * 停止所有动画
     */
    stopAll() {
        this.activeAnimations = [];
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    /**
     * 销毁
     */
    dispose() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        this.activeAnimations = [];
    }
}
