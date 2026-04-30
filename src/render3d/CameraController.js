/**
 * 相机控制器
 * 管理相机视角切换、入场动画、视角预设
 */

import * as THREE from 'three';
import { RENDER_CONFIG, boardToWorld } from '../config/renderConfig.js';
import { getSceneSpec } from '../config/sceneConfig.js';

export const CAMERA_PRESETS = {
    default: {
        position: { x: 0, y: 12, z: 10 },
        name: '默认视角',
    },
    topDown: {
        position: { x: 0, y: 28, z: 0.01 },
        name: '俯视视角',
    },
    side: {
        position: { x: 0, y: 6, z: 14 },
        name: '侧面视角',
    },
    corner: {
        position: { x: 10, y: 10, z: 10 },
        name: '角落视角',
    },
    close: {
        position: { x: 0, y: 8, z: 7 },
        name: '近距离视角',
    },
};

export class CameraController {
    constructor(sceneManager, config = RENDER_CONFIG) {
        this.sceneManager = sceneManager;
        this.camera = sceneManager.camera;
        this.controls = sceneManager.controls;
        this.config = config;

        this.currentPreset = 'default';
        this.animationId = null;
        this.boardSize = config.board.size;
        this.defaultTarget = new THREE.Vector3(0, config.board.thickness / 2, 0);
        this.defaultPosition = new THREE.Vector3(
            config.camera.defaultPosition.x,
            config.camera.defaultPosition.y,
            config.camera.defaultPosition.z
        );
        this.scenePreset = 'competition';
        this.presentationMode = 'game';
        this.motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null;
        this.prefersReducedMotion = this.motionQuery?.matches ?? false;

        if (this.motionQuery?.addEventListener) {
            this.motionQuery.addEventListener('change', (event) => {
                this.prefersReducedMotion = event.matches;
            });
        }
    }

    setScenePreset(scenePreset = 'competition') {
        this.scenePreset = scenePreset;
    }

    setPresentationMode(mode = 'game') {
        this.presentationMode = mode === 'setup' ? 'setup' : 'game';
    }

    getFrameConfig(scenePreset = this.scenePreset, presentationMode = this.presentationMode) {
        const spec = getSceneSpec(scenePreset);
        return spec.camera[presentationMode] || spec.camera.game;
    }

    getPresentationProfileName() {
        return `${this.scenePreset}-${this.presentationMode}`;
    }

    getInteractionConfig(frame) {
        return frame.interaction || {};
    }

    /**
     * 切换到预设视角
     * @param {string} presetName 预设名称
     * @param {boolean} animate 是否动画过渡
     */
    setPreset(presetName, animate = true) {
        const preset = CAMERA_PRESETS[presetName];
        if (!preset) {
            console.warn(`Camera preset "${presetName}" not found`);
            return;
        }

        this.currentPreset = presetName;
        this.defaultPosition.set(preset.position.x, preset.position.y, preset.position.z);
        this.controls.target.copy(this.defaultTarget);
        this.applyView(this.defaultPosition, this.defaultTarget, animate ? 0.72 : 0);
    }

    cancelAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    setViewInstant(targetPosition, targetLookAt) {
        this.cancelAnimation();
        this.camera.position.copy(targetPosition);
        this.controls.target.copy(targetLookAt);
        this.controls.update();
        this.sceneManager.setNeedsRender();
    }

    applyView(targetPosition, targetLookAt, duration = 0.85, onComplete = null) {
        this.cancelAnimation();

        if (this.prefersReducedMotion || duration <= 0) {
            this.camera.position.copy(targetPosition);
            this.controls.target.copy(targetLookAt);
            this.controls.update();
            this.sceneManager.setNeedsRender();
            if (onComplete) {
                onComplete();
            }
            return;
        }

        const startPos = this.camera.position.clone();
        const startTarget = this.controls.target.clone();
        const startTime = performance.now();
        const durationMs = duration * 1000;

        const animate = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / durationMs, 1);
            const eased = this.easeInOutCubic(progress);

            this.camera.position.lerpVectors(startPos, targetPosition, eased);
            this.controls.target.lerpVectors(startTarget, targetLookAt, eased);
            this.controls.update();
            this.sceneManager.setNeedsRender();

            if (progress < 1) {
                this.animationId = requestAnimationFrame(animate);
            } else {
                this.animationId = null;
                if (onComplete) {
                    onComplete();
                }
            }
        };

        animate();
    }

    /**
     * 入场动画
     * @param {Function} onComplete 完成回调
     */
    playEntryAnimation(onComplete = null) {
        this.playUnifiedEntry('setup', this.scenePreset, onComplete);
    }

    playMatchIntro(onComplete = null) {
        this.playUnifiedEntry('game', this.scenePreset, onComplete);
    }

    playMoveFocus(row, col, size, cellSize, emphasis = 'human') {
        if (this.prefersReducedMotion) {
            return;
        }

        const focusTarget = this.getFocusTarget(row, col, size, cellSize, emphasis === 'ai' ? 0.52 : 0.42);
        const direction = this.defaultPosition.clone().sub(this.defaultTarget).normalize();
        const baseDistance = this.defaultPosition.distanceTo(this.defaultTarget);
        const focusDistance = emphasis === 'ai' ? baseDistance * 0.91 : baseDistance * 0.95;
        const focusPosition = focusTarget.clone()
            .add(direction.multiplyScalar(focusDistance))
            .add(new THREE.Vector3(0, emphasis === 'ai' ? 0.38 : 0.16, 0));

        this.applyView(focusPosition, focusTarget, emphasis === 'ai' ? 0.26 : 0.2, () => {
            this.applyView(this.defaultPosition.clone(), this.defaultTarget.clone(), emphasis === 'ai' ? 0.34 : 0.28);
        });
    }

    playVictoryFocus(cells, size, cellSize) {
        if (!cells?.length) {
            return;
        }

        const center = cells.reduce((acc, cell) => {
            acc.row += cell.row;
            acc.col += cell.col;
            return acc;
        }, { row: 0, col: 0 });

        center.row /= cells.length;
        center.col /= cells.length;

        const focusTarget = this.getFocusTarget(center.row, center.col, size, cellSize, 0.6);
        const direction = this.defaultPosition.clone().sub(this.defaultTarget).normalize();
        const stableDistance = this.defaultPosition.distanceTo(this.defaultTarget) * 0.94;
        const focusPosition = focusTarget.clone()
            .add(direction.multiplyScalar(stableDistance))
            .add(new THREE.Vector3(0, 0.6, 0));

        this.applyView(focusPosition, focusTarget, 0.5);
    }

    playSceneShift(scenePreset = 'competition') {
        this.playUnifiedEntry('scene', scenePreset);
    }

    playPresentationEntry(mode = this.presentationMode, onComplete = null) {
        this.playUnifiedEntry(mode === 'setup' ? 'setup' : 'game', this.scenePreset, onComplete);
    }

    getEntryProfile(kind = 'setup') {
        const baseDuration = Math.max(this.config.animation.cameraEntryDuration, 1);

        if (kind === 'game') {
            return {
                establishScale: 1.04,
                focusScale: 0.66,
                heightBoost: 0.22,
                targetLift: 0.05,
                firstDuration: baseDuration * 0.38,
                secondDuration: baseDuration * 0.5
            };
        }

        if (kind === 'scene') {
            return {
                establishScale: 1.1,
                focusScale: 0.72,
                heightBoost: 0.28,
                targetLift: 0.07,
                firstDuration: baseDuration * 0.42,
                secondDuration: baseDuration * 0.54
            };
        }

        return {
            establishScale: 1.2,
            focusScale: 0.8,
            heightBoost: 0.36,
            targetLift: 0.08,
            firstDuration: baseDuration * 0.56,
            secondDuration: baseDuration * 0.62
        };
    }

    playUnifiedEntry(kind = 'setup', scenePreset = this.scenePreset, onComplete = null) {
        if (this.prefersReducedMotion) {
            this.applyView(this.defaultPosition.clone(), this.defaultTarget.clone(), 0, onComplete);
            return;
        }

        const variant = getSceneSpec(scenePreset).camera.shift;
        const profile = this.getEntryProfile(kind);
        const establishPosition = this.defaultPosition.clone().add(new THREE.Vector3(
            variant.establishOffset.x * profile.establishScale,
            variant.establishOffset.y * profile.establishScale + profile.heightBoost,
            variant.establishOffset.z * profile.establishScale
        ));
        const establishTarget = this.defaultTarget.clone().add(new THREE.Vector3(
            variant.establishTarget.x,
            variant.establishTarget.y + profile.targetLift,
            variant.establishTarget.z
        ));
        const focusPosition = this.defaultPosition.clone().add(new THREE.Vector3(
            variant.focusOffset.x * profile.focusScale,
            variant.focusOffset.y * profile.focusScale + profile.heightBoost * 0.35,
            variant.focusOffset.z * profile.focusScale
        ));
        const focusTarget = this.defaultTarget.clone().add(new THREE.Vector3(
            variant.targetOffset.x * profile.focusScale,
            variant.targetOffset.y * profile.focusScale + profile.targetLift * 0.45,
            variant.targetOffset.z * profile.focusScale
        ));

        this.setViewInstant(establishPosition, establishTarget);
        this.applyView(focusPosition, focusTarget, profile.firstDuration, () => {
            this.applyView(this.defaultPosition.clone(), this.defaultTarget.clone(), profile.secondDuration, onComplete);
        });
    }

    /**
     * 聚焦到某个格子
     * @param {number} row 行号
     * @param {number} col 列号
     * @param {number} size 棋盘大小
     * @param {number} cellSize 格子尺寸
     * @param {boolean} animate 是否动画
     */
    focusOnCell(row, col, size, cellSize, animate = true) {
        const focusTarget = this.getFocusTarget(row, col, size, cellSize, 0.42);
        const direction = this.defaultPosition.clone().sub(this.defaultTarget).normalize();
        const focusPosition = focusTarget.clone().add(direction.multiplyScalar(this.defaultPosition.distanceTo(this.defaultTarget)));
        this.applyView(focusPosition, focusTarget, animate ? 0.45 : 0);
    }

    getFocusTarget(row, col, size, cellSize, influence = 0.4) {
        const world = boardToWorld(row, col, size, cellSize);
        return new THREE.Vector3(
            world.x * influence,
            this.config.board.thickness / 2,
            world.z * influence
        );
    }

    /**
     * 获取当前视角名称
     * @returns {string}
     */
    getCurrentPresetName() {
        return CAMERA_PRESETS[this.currentPreset]?.name || '自定义视角';
    }

    /**
     * 获取所有可用预设
     * @returns {Array<{key: string, name: string}>}
     */
    getAvailablePresets() {
        return Object.entries(CAMERA_PRESETS).map(([key, value]) => ({
            key,
            name: value.name,
        }));
    }

    easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    /**
     * 重置到默认视角
     * @param {boolean} animate 是否动画
     */
    reset(animate = true) {
        this.fitToBoard(this.boardSize, animate);
    }

    updateFrameState(boardSize = this.boardSize) {
        this.boardSize = boardSize;
        this.currentPreset = 'default';

        const { cellSize, borderWidth, thickness } = this.config.board;
        const boardSpan = (boardSize - 1) * cellSize;
        const totalSize = boardSpan + borderWidth * 2;
        const aspect = this.sceneManager.container.clientWidth / this.sceneManager.container.clientHeight || 1;
        const aspectMultiplier = aspect < 1 ? 1.16 : aspect < 1.35 ? 1.08 : aspect > 1.9 ? 0.94 : 1;
        const frame = this.getFrameConfig();
        const elevation = THREE.MathUtils.degToRad(frame.elevation ?? 50);
        const azimuth = THREE.MathUtils.degToRad(frame.azimuth ?? 0);
        const distance = Math.max(totalSize * 1.12 * aspectMultiplier, 14) * (frame.distanceScale ?? 1);
        const targetLookAt = new THREE.Vector3(
            frame.targetOffset?.x ?? 0,
            thickness / 2 + (frame.targetOffset?.y ?? 0),
            frame.targetOffset?.z ?? 0
        );
        const horizontalDistance = Math.cos(elevation) * distance;
        const targetPosition = new THREE.Vector3(
            targetLookAt.x + Math.sin(azimuth) * horizontalDistance,
            targetLookAt.y + Math.sin(elevation) * distance + (frame.lift ?? 0),
            targetLookAt.z + Math.cos(azimuth) * horizontalDistance
        );

        this.defaultPosition.copy(targetPosition);
        this.defaultTarget.copy(targetLookAt);
        const interaction = this.getInteractionConfig(frame);
        const minElevation = THREE.MathUtils.clamp(
            interaction.minElevation ?? ((frame.elevation ?? 50) + (interaction.minElevationOffset ?? -6)),
            8,
            88
        );
        const maxElevation = THREE.MathUtils.clamp(
            interaction.maxElevation ?? ((frame.elevation ?? 50) + (interaction.maxElevationOffset ?? 6)),
            minElevation + 1,
            89.5
        );
        const minAzimuth = THREE.MathUtils.degToRad((frame.azimuth ?? 0) + (interaction.minAzimuthOffset ?? -10));
        const maxAzimuth = THREE.MathUtils.degToRad((frame.azimuth ?? 0) + (interaction.maxAzimuthOffset ?? 10));

        this.controls.minDistance = Math.max(distance * (interaction.minDistanceScale ?? 0.9), totalSize * 0.42, 5.8);
        this.controls.maxDistance = Math.max(
            distance * (interaction.maxDistanceScale ?? 1.12),
            this.controls.minDistance + 1.2
        );
        this.controls.minPolarAngle = THREE.MathUtils.degToRad(90 - maxElevation);
        this.controls.maxPolarAngle = THREE.MathUtils.degToRad(90 - minElevation);
        if (interaction.fullAzimuth) {
            this.controls.minAzimuthAngle = -Infinity;
            this.controls.maxAzimuthAngle = Infinity;
        } else {
            this.controls.minAzimuthAngle = Math.min(minAzimuth, maxAzimuth);
            this.controls.maxAzimuthAngle = Math.max(minAzimuth, maxAzimuth);
        }
        this.controls.enablePan = interaction.allowPan ?? false;
        this.controls.panSpeed = interaction.allowPan ? (interaction.panSpeed ?? 0.32) : 0;
        this.controls.rotateSpeed = interaction.rotateSpeed ?? 0.82;
        this.controls.zoomSpeed = interaction.zoomSpeed ?? 0.88;

        return {
            targetPosition: targetPosition.clone(),
            targetLookAt: targetLookAt.clone()
        };
    }

    fitToBoard(boardSize = this.boardSize, animate = true) {
        const { targetPosition, targetLookAt } = this.updateFrameState(boardSize);

        this.applyView(targetPosition, targetLookAt, animate ? 0.85 : 0);
    }

    /**
     * 销毁
     */
    dispose() {
        this.cancelAnimation();
    }
}
