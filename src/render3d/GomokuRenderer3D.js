/**
 * 五子棋 3D 渲染器
 * 封装 3D 场景管理，提供游戏渲染接口
 */

import * as THREE from 'three';
import {
    SceneManager,
    BoardBuilder,
    EnvironmentBuilder,
    StoneBuilder,
    CameraController,
    LightingSetup,
    AnimationManager,
    InteractionHandler,
    boardToWorld,
} from './index.js';

const MARKER_THEMES = {
    hint: { color: 0xf7c76a, innerRadius: 0.12, outerRadius: 0.24, opacity: 0.8 },
    coach: { color: 0x7fe1ff, innerRadius: 0.17, outerRadius: 0.31, opacity: 0.86 },
    coachFocus: { color: 0x9ff0b8, innerRadius: 0.2, outerRadius: 0.34, opacity: 0.82 },
    selected: { color: 0xffffff, innerRadius: 0.24, outerRadius: 0.38, opacity: 0.92 },
};

const WINNING_PULSE_TAG_PREFIX = 'winning-pulse';

export class GomokuRenderer3D {
    constructor(container, options = {}) {
        this.container = container;
        this.options = options;

        this.sceneManager = null;
        this.boardBuilder = null;
        this.stoneBuilder = null;
        this.environmentBuilder = null;
        this.cameraController = null;
        this.lightingSetup = null;
        this.animationManager = null;
        this.interactionHandler = null;

        this.boardSize = 15;
        this.scenePreset = options.scenePreset || 'competition';
        this.presentationMode = options.presentationMode || 'setup';
        this.config = null;
        this.cellSize = 1;
        this.boardThickness = 0.15;
        this.previewStone = null;
        this.markerGroup = null;
        this.markers = {
            hint: null,
            coach: null,
            coachFocus: null,
            selected: null
        };
        this.winningPulseKey = null;

        this.init();
    }

    /**
     * 初始化渲染器
     */
    init() {
        this.sceneManager = new SceneManager(this.container);
        this.config = this.sceneManager.config;
        this.cellSize = this.config.board.cellSize;
        this.boardThickness = this.config.board.thickness;

        this.lightingSetup = new LightingSetup(this.sceneManager, this.config);
        this.lightingSetup.setPresentationMode(this.presentationMode);
        this.lightingSetup.setup(this.scenePreset);

        this.boardBuilder = this.createBoardBuilder();
        this.environmentBuilder = this.createEnvironmentBuilder();
        this.sceneManager.add(this.environmentBuilder.build(this.boardSize, this.scenePreset));
        this.sceneManager.add(this.boardBuilder.build(this.boardSize));

        this.stoneBuilder = new StoneBuilder(this.config);
        this.sceneManager.add(this.stoneBuilder.createStonesGroup());

        this.markerGroup = new THREE.Group();
        this.markerGroup.name = 'boardMarkers';
        this.sceneManager.add(this.markerGroup);

        this.cameraController = new CameraController(this.sceneManager, this.config);
        this.cameraController.setScenePreset(this.scenePreset);
        this.cameraController.setPresentationMode(this.presentationMode);
        this.cameraController.fitToBoard(this.boardSize, false);

        this.animationManager = new AnimationManager(this.sceneManager, this.config);
        this.sceneManager.onBeforeRender = () => this.handleFrame();

        this.interactionHandler = new InteractionHandler(this.sceneManager, {
            config: this.config,
        });
        this.interactionHandler.updateBoardSize(this.boardSize);

    }

    handleFrame() {
        const timeSeconds = performance.now() / 1000;
        const environmentAnimated = this.environmentBuilder?.update(timeSeconds) ?? false;
        const lightingAnimated = this.lightingSetup?.update(timeSeconds) ?? false;

        if (environmentAnimated || lightingAnimated) {
            this.sceneManager.setNeedsRender();
        }
    }

    createBoardBuilder() {
        return new BoardBuilder(this.config, {
            maxAnisotropy: this.sceneManager.renderer.capabilities.getMaxAnisotropy()
        });
    }

    createEnvironmentBuilder() {
        return new EnvironmentBuilder(this.config);
    }

    /**
     * 设置棋盘大小
     * @param {number} size 棋盘大小
     */
    setBoardSize(size) {
        if (size === this.boardSize) return;

        this.boardSize = size;
        this.clearWinningPulseState();

        const oldBoard = this.sceneManager.scene.getObjectByName('board');
        if (oldBoard) {
            this.sceneManager.remove(oldBoard);
            this.boardBuilder.dispose();
        }

        const oldEnvironment = this.sceneManager.scene.getObjectByName('environment');
        if (oldEnvironment) {
            this.sceneManager.remove(oldEnvironment);
            this.environmentBuilder.dispose();
        }

        this.stoneBuilder.clearAllStones();
        this.clearMarkers();

        this.boardBuilder = this.createBoardBuilder();
        this.environmentBuilder = this.createEnvironmentBuilder();
        this.sceneManager.add(this.environmentBuilder.build(size, this.scenePreset));
        this.sceneManager.add(this.boardBuilder.build(size));

        this.interactionHandler.updateBoardSize(size);
        this.cameraController.setScenePreset(this.scenePreset);
        this.cameraController.fitToBoard(size, true);
    }

    setScenePreset(scenePreset, { animate = false } = {}) {
        if (!scenePreset) {
            return;
        }

        const sceneChanged = scenePreset !== this.scenePreset;
        this.scenePreset = scenePreset;
        this.cameraController?.setScenePreset(this.scenePreset);
        this.cameraController?.updateFrameState(this.boardSize);

        if (sceneChanged) {
            const oldEnvironment = this.sceneManager.scene.getObjectByName('environment');
            if (oldEnvironment) {
                this.sceneManager.remove(oldEnvironment);
            }

            if (this.environmentBuilder) {
                this.environmentBuilder.dispose();
            }

            this.environmentBuilder = this.createEnvironmentBuilder();
            this.sceneManager.add(this.environmentBuilder.build(this.boardSize, this.scenePreset));
        }

        this.lightingSetup?.applyPreset(this.scenePreset);

        if (sceneChanged && animate) {
            this.cameraController.playSceneShift(this.scenePreset);
        } else if (sceneChanged) {
            this.cameraController.fitToBoard(this.boardSize, false);
        }

        this.sceneManager.setNeedsRender();
    }

    setPresentationMode(mode, { animate = false } = {}) {
        const presentationMode = mode === 'setup' ? 'setup' : 'game';
        if (presentationMode === this.presentationMode) {
            return;
        }
        this.presentationMode = presentationMode;
        this.lightingSetup?.setPresentationMode(presentationMode);
        this.cameraController?.setPresentationMode(presentationMode);
        this.cameraController?.updateFrameState(this.boardSize);
        if (animate) {
            this.cameraController?.playPresentationEntry(presentationMode);
        } else {
            this.cameraController?.fitToBoard(this.boardSize, false);
        }
        this.sceneManager.setNeedsRender();
    }

    getPresentationProfileName() {
        return this.cameraController?.getPresentationProfileName?.() ?? `${this.scenePreset}-${this.presentationMode}`;
    }

    resize() {
        this.sceneManager.handleResize();
    }

    fitToBoard(size = this.boardSize, animate = false) {
        this.cameraController.fitToBoard(size, animate);
    }

    /**
     * 渲染棋盘状态
     * @param {Array<Array<string|null>>} boardState 棋盘状态数组
     * @param {Object} options 渲染选项
     */
    renderBoard(boardState, options = {}) {
        const {
            lastMove,
            winningCells,
            hintMove,
            coachSuggestion,
            coachFocus,
            selectedCell,
            animateLastMove = false
        } = options;

        const expected = new Map();
        let animatedStone = null;

        for (let row = 0; row < boardState.length; row += 1) {
            for (let col = 0; col < boardState[row].length; col += 1) {
                const color = boardState[row][col];
                if (!color) {
                    continue;
                }

                const key = `${row},${col}`;
                expected.set(key, color);
                const existingStone = this.stoneBuilder.getStone(row, col);

                if (!existingStone) {
                    const stone = this.stoneBuilder.addStone(
                        color,
                        row,
                        col,
                        this.boardSize,
                        this.cellSize,
                        this.boardThickness
                    );

                    if (animateLastMove && lastMove && lastMove.row === row && lastMove.col === col) {
                        animatedStone = stone;
                    }
                    continue;
                }

                if (existingStone.userData.color !== color) {
                    this.stoneBuilder.removeStone(row, col);
                    this.stoneBuilder.addStone(
                        color,
                        row,
                        col,
                        this.boardSize,
                        this.cellSize,
                        this.boardThickness
                    );
                }
            }
        }

        this.stoneBuilder.getAllStones().forEach((stone) => {
            const key = `${stone.userData.row},${stone.userData.col}`;
            if (!expected.has(key)) {
                this.stoneBuilder.removeStone(stone.userData.row, stone.userData.col);
            }
        });

        this.stoneBuilder.resetStoneStyles();

        if (lastMove) {
            this.stoneBuilder.highlightLastMove(lastMove.row, lastMove.col);
        }

        const winningKey = this.getWinningCellsKey(winningCells);

        if (winningKey) {
            this.stoneBuilder.highlightWinningStones(winningCells);

            if (winningKey !== this.winningPulseKey) {
                const winningStones = winningCells
                    .map(({ row, col }) => this.stoneBuilder.getStone(row, col))
                    .filter(Boolean);

                this.clearWinningPulseState();
                if (winningStones.length > 0) {
                    this.animationManager.playWinningPulseAnimation(
                        winningStones,
                        this.getWinningPulseTag(winningKey)
                    );
                    this.winningPulseKey = winningKey;
                }
            }
        } else {
            this.clearWinningPulseState();
        }

        this.updateMarker('hint', hintMove);
        this.updateMarker('coach', coachSuggestion);
        this.updateMarker('coachFocus', coachFocus);
        this.updateMarker('selected', selectedCell);

        if (animateLastMove && animatedStone) {
            const targetY = this.boardThickness / 2 + this.config.stone.height;
            this.animationManager.playDropAnimation(animatedStone, targetY, () => {
                if (lastMove) {
                    this.stoneBuilder.highlightLastMove(lastMove.row, lastMove.col);
                }
            });
        }

        this.sceneManager.setNeedsRender();
    }

    getWinningCellsKey(winningCells) {
        if (!winningCells || winningCells.length === 0) {
            return null;
        }

        return winningCells
            .map(({ row, col }) => `${row},${col}`)
            .join('|');
    }

    getWinningPulseTag(key = this.winningPulseKey) {
        return key ? `${WINNING_PULSE_TAG_PREFIX}:${key}` : null;
    }

    clearWinningPulseState() {
        const tag = this.getWinningPulseTag();
        if (tag) {
            this.animationManager?.stopByTag(tag);
        }
        this.winningPulseKey = null;
    }

    placeStone(color, row, col, animate = true) {
        const stone = this.stoneBuilder.addStone(
            color,
            row,
            col,
            this.boardSize,
            this.cellSize,
            this.boardThickness
        );

        if (animate) {
            const targetY = this.boardThickness / 2 + this.config.stone.height;
            this.animationManager.playDropAnimation(stone, targetY);
        }

        return stone;
    }

    removeStone(row, col) {
        this.stoneBuilder.removeStone(row, col);
        this.sceneManager.setNeedsRender();
    }

    showPreview(color, row, col) {
        this.hidePreview();

        this.previewStone = this.stoneBuilder.createPreviewStone(
            color,
            row,
            col,
            this.boardSize,
            this.cellSize,
            this.boardThickness
        );
        this.sceneManager.add(this.previewStone);
        this.animationManager.playPreviewPulseAnimation(this.previewStone);
    }

    hidePreview() {
        if (this.previewStone) {
            this.sceneManager.remove(this.previewStone);
            this.previewStone = null;
        }
    }

    updateMarker(name, cell) {
        if (!cell) {
            this.removeMarker(name);
            return;
        }

        const current = this.markers[name];
        if (current && current.userData.row === cell.row && current.userData.col === cell.col) {
            return;
        }

        this.removeMarker(name);

        const theme = MARKER_THEMES[name];
        const marker = new THREE.Mesh(
            new THREE.RingGeometry(theme.innerRadius, theme.outerRadius, 40),
            new THREE.MeshBasicMaterial({
                color: theme.color,
                transparent: true,
                opacity: theme.opacity,
                depthWrite: false,
                side: THREE.DoubleSide
            })
        );

        const world = boardToWorld(cell.row, cell.col, this.boardSize, this.cellSize);
        marker.position.set(world.x, this.boardThickness / 2 + 0.014, world.z);
        marker.rotation.x = -Math.PI / 2;
        marker.userData = { row: cell.row, col: cell.col };
        marker.name = `marker_${name}`;

        this.markerGroup.add(marker);
        this.markers[name] = marker;

        if (name === 'coach' || name === 'coachFocus' || name === 'selected') {
            this.animationManager.playPreviewPulseAnimation(marker);
        }
    }

    removeMarker(name) {
        const marker = this.markers[name];
        if (!marker) {
            return;
        }

        this.markerGroup.remove(marker);
        marker.geometry.dispose();
        marker.material.dispose();
        this.markers[name] = null;
    }

    clearMarkers() {
        Object.keys(this.markers).forEach((name) => this.removeMarker(name));
    }

    onCellClick(callback) {
        this.interactionHandler.onCellClick = callback;
    }

    onCellHover(callback) {
        this.interactionHandler.onCellHover = callback;
    }

    onCellLeave(callback) {
        this.interactionHandler.onCellLeave = callback;
    }

    setInteractionEnabled(enabled) {
        this.interactionHandler.setEnabled(enabled);
        this.sceneManager.controls.enabled = enabled;
    }

    setCameraPreset(preset) {
        this.cameraController.setPreset(preset, true);
    }

    getCameraPresets() {
        return this.cameraController.getAvailablePresets();
    }

    resetCamera() {
        this.cameraController.reset(true);
    }

    playGameStartSequence() {
        this.cameraController.playMatchIntro();
    }

    playSetupStartSequence() {
        this.cameraController.playEntryAnimation();
    }

    playMoveSequence(row, col, emphasis = 'human') {
        this.cameraController.playMoveFocus(row, col, this.boardSize, this.cellSize, emphasis);
    }

    playVictorySequence(cells) {
        this.cameraController.playVictoryFocus(cells, this.boardSize, this.cellSize);
    }

    static isWebGLAvailable() {
        return SceneManager.isWebGLAvailable();
    }

    dispose() {
        this.hidePreview();
        this.clearMarkers();
        this.clearWinningPulseState();

        if (this.animationManager) {
            this.animationManager.dispose();
        }

        if (this.interactionHandler) {
            this.interactionHandler.dispose();
        }

        if (this.cameraController) {
            this.cameraController.dispose();
        }

        if (this.stoneBuilder) {
            this.stoneBuilder.dispose();
        }

        if (this.boardBuilder) {
            this.boardBuilder.dispose();
        }

        if (this.environmentBuilder) {
            this.environmentBuilder.dispose();
        }

        if (this.lightingSetup) {
            this.lightingSetup.dispose();
        }

        if (this.sceneManager) {
            this.sceneManager.onBeforeRender = null;
            this.sceneManager.dispose();
        }
    }
}
