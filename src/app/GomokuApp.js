/**
 * 五子棋应用主协调器。
 * 负责装配 DOM、控制器、3D 渲染器、声音系统与测试钩子。
 * @module app/GomokuApp
 */

import { createGameState, createOptions } from '../games/gomoku/state.js';
import { getDOMReferences, setupLanguageSwitch } from '../ui/dom.js';
import { mountDevPanel } from '../ui/devPanel.js';
import { GomokuRenderer3D } from '../render3d/GomokuRenderer3D.js';
import { SoundManager } from '../audio/SoundManager.js';
import { loadLlmCoachSettings, setupGlobalErrorHandlers } from '../services/llmCoach.js';
import { formatMove } from '../utils/formatters.js';

import { GameController } from './controllers/GameController.js';
import { CoachController } from './controllers/CoachController.js';
import { i18n } from '../utils/i18n.js';
import { SettingsController } from './controllers/SettingsController.js';
import { ImmersiveHudManager } from './controllers/ImmersiveHudManager.js';
import { InteractionManager } from './controllers/InteractionManager.js';

/**
 * 应用层入口类。
 * 聚合游戏、设置、教练、交互和沉浸式 HUD 控制器，并协调 2D/3D 视图切换。
 */
export class GomokuApp {
    // === Lifecycle ===

    /**
     * @param {Document|HTMLElement} [root=document] - 用于查询应用 DOM 的根节点
     */
    constructor(root = document) {
        setupGlobalErrorHandlers();
        this.dom = getDOMReferences(root);
        this.options = createOptions();
        this.state = createGameState(this.options);
        this.previewCell = null;
        this.aiTimer = null;
        this.matchEnterTimer = null;
        this.sceneSwitchTimer = null;
        this.sound = new SoundManager();
        this.currentAmbientCue = null;
        this.desktopHoverUi = false;
        this.helpOpen = false;
        this.llmSettings = loadLlmCoachSettings();
        this.llmSettingsOpen = false;
        this.llmCoachRequestId = 0;
        this.llmCoachAbortController = null;
        this.llmTestAbortController = null;
        this.immersiveUiCapable = false;
        this.immersiveUiRects = {};
        this.immersiveUiRegions = { top: true, left: true, right: true, bottom: true };
        this.lastImmersivePointer = null;

        // Controllers
        this.game = new GameController(this);
        this.coach = new CoachController(this);
        this.settings = new SettingsController(this);
        this.immersive = new ImmersiveHudManager(this);
        this.interaction = new InteractionManager(this);

        this.firstRunGuideSeen = this.settings.loadFirstRunGuideSeen();
        this.firstRunGuideOpen = false;
        this.immersiveUiEnabled = this.settings.loadImmersiveUiPreference();

        this.boundUnlockSound = () => { this.sound.unlock(); };
        this.boundHandleImmersivePointer = (e) => this.immersive.handleImmersivePointer(e);
        this.boundHandleImmersiveFocusIn = (e) => this.immersive.handleImmersiveFocusIn(e);
        this.boundHandleGlobalKeydown = (e) => this.interaction.handleGlobalKeydown(e);
        this.boundHandleImmersiveBlur = () => {
            if (!this.immersive.isImmersiveUiActive()) return;
            this.immersive.setImmersiveRegions({ top: false, left: false, right: false, bottom: false });
        };

        this.renderer3d = null;
        this.use3D = false;

        this.applyViewportProfile();
        this.initRenderer();
        document.body.classList.toggle('render-mode-3d', this.use3D);
        document.body.classList.toggle('render-mode-2d', !this.use3D);

        this.bindEvents();
        this.exposeTestHooks();
        setupLanguageSwitch(this.dom, () => this.settings.handleLanguageChange());
        this.settings.refreshSoundToggle();
        this.settings.refreshSetup();
        this.refreshViewportMode();
        this.game.enterSetup();
        this.settings.showFirstRunGuideIfNeeded();
        this.devPanel = mountDevPanel(this);

        // 启动器桥接：首次选中时已由 main.js new 出来；如果用户切回 launcher 再回到 Gomoku，
        // __reenter 会被调用以保证 setup 面板可见、画面不是黑屏。
        this.__reenter = () => {
            this.exposeTestHooks();
            this.game.enterSetup();
            if (this.renderer3d) {
                this.renderer3d.resize();
            }
        };
        this.enterSetupQuiet = () => {
            this.exposeTestHooks();
            this.game.enterSetup();
        };
        // 隐藏 Gomoku 所有面板（用于切换到其他游戏时）
        this.hideRoot = () => {
            this.dom?.setup?.panel?.classList?.add?.('hidden');
            this.dom?.game?.panel?.classList?.add?.('hidden');
            this.dom?.result?.overlay?.classList?.add?.('hidden');
        };

        // setup 面板上的"返回选择"按钮（跨游戏），如果存在则把点击委托给全局钩子。
        const launcherBackBtn = this.dom?.controls?.setupBackToLauncher
            ?? document.getElementById('setup-back-to-launcher-btn');
        if (launcherBackBtn) {
            launcherBackBtn.addEventListener('click', () => {
                this.sound?.play?.('uiTap');
                window.__returnToLauncher?.();
            });
        }
    }

    /**
     * 初始化 3D 渲染器；若容器不存在或 WebGL 不可用则退回 2D 视图。
     * @returns {void}
     */
    initRenderer() {
        const board3DContainer = this.dom.scene3d;
        if (!board3DContainer) {
            console.warn('3D container not found, using 2D fallback');
            this.use3D = false;
            return;
        }
        if (GomokuRenderer3D.isWebGLAvailable()) {
            try {
                this.renderer3d = new GomokuRenderer3D(board3DContainer, {
                    scenePreset: this.options.scene,
                    presentationMode: 'setup',
                    soundManager: this.sound
                });
                this.use3D = true;
                this.renderer3d.setInteractionEnabled(false);
                this.setup3DCallbacks();
            } catch (error) {
                console.error('Failed to initialize 3D renderer:', error);
                this.use3D = false;
            }
        } else {
            console.log('WebGL not available, using 2D fallback');
            this.use3D = false;
        }
    }

    /**
     * 绑定 3D 棋盘交互回调到统一的交互控制器。
     * @returns {void}
     */
    setup3DCallbacks() {
        if (!this.renderer3d) return;
        this.renderer3d.onCellClick((row, col) => this.interaction.handleCellClick(row, col));
        this.renderer3d.onCellHover((row, col) => this.interaction.showPreview3D(row, col));
        this.renderer3d.onCellLeave(() => this.interaction.clearPreview());
    }

    // === Event Binding ===

    /**
     * 绑定设置面板、HUD、帮助面板、落子面板和窗口级事件。
     * @returns {void}
     */
    bindEvents() {
        this.settings.bindOptionGroup(this.dom.optionGroups.mode, 'mode', (value) => {
            this.options.mode = value;
            this.settings.refreshSetup();
        });
        this.settings.bindOptionGroup(this.dom.optionGroups.rule, 'rule', (value) => { this.options.rule = value; });
        this.settings.bindOptionGroup(this.dom.optionGroups.size, 'size', (value) => {
            this.options.size = Number(value);
            this.settings.refreshSetup();
        });
        this.settings.bindOptionGroup(this.dom.optionGroups.scene, 'scene', (value) => {
            this.options.scene = value;
            this.settings.refreshSetup({ animateScene: true });
            if (!this.dom.sections.game.classList.contains('hidden')) this.game.render();
        });
        this.settings.bindOptionGroup(this.dom.optionGroups.level, 'level', (value) => { this.options.level = value; });
        this.settings.bindOptionGroup(this.dom.optionGroups.playerColor, 'color', (value) => { this.options.playerColor = value; });

        this.dom.controls.start.addEventListener('click', () => {
            this.sound.unlock();
            this.sound.play('start');
            this.game.startGame();
        });
        this.dom.controls.back.addEventListener('click', () => {
            this.sound.play('uiTap');
            this.game.enterSetup();
        });
        this.dom.controls.undo.addEventListener('click', () => this.game.undo());
        this.dom.controls.hint.addEventListener('click', () => this.game.showHint());
        this.dom.controls.swap.addEventListener('click', () => this.game.swapSides());
        this.dom.controls.restart.addEventListener('click', () => {
            this.sound.play('uiTap');
            this.game.restart();
        });
        this.dom.controls.resign.addEventListener('click', () => this.game.resign());
        this.dom.controls.viewReset.addEventListener('click', () => {
            this.sound.play('uiTap');
            this.game.resetCamera();
        });
        this.dom.controls.soundToggle.addEventListener('click', () => this.game.toggleSound());
        this.dom.controls.immersiveToggle?.addEventListener('click', () => this.immersive.toggleImmersiveUi());
        this.dom.controls.setupLlmSettings?.addEventListener('click', () => {
            this.sound.play('uiTap');
            this.settings.openLlmSettings();
        });
        this.dom.guidance.settings?.addEventListener('click', () => {
            this.sound.play('uiTap');
            this.settings.openLlmSettings();
        });
        this.dom.guidance.rerun?.addEventListener('click', () => {
            this.sound.play('hint');
            this.coach.refreshCoachGuidance(true);
        });
        this.dom.guidance.upload?.addEventListener('click', () => {
            if (this.state.coachLlmStatus === 'analyzing-image') {
                this.coach.cancelImageAnalysis();
                return;
            }
            this.dom.guidance.imageInput?.click();
        });
        this.dom.guidance.imageInput?.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (file) this.coach.handleImageUpload(file);
            e.target.value = '';
        });
        this.dom.guidance.importBtn?.addEventListener('click', () => {
            this.coach.importAnalyzedBoard();
        });
        this.dom.guidance.editBtn?.addEventListener('click', () => {
            this.coach.openPreviewEdit();
        });
        this.dom.guidance.previewCommit?.addEventListener('click', () => {
            this.coach.closePreviewEdit(true);
        });
        this.dom.guidance.previewCancel?.addEventListener('click', () => {
            this.coach.closePreviewEdit(false);
        });
        this.dom.guidance.alternatives?.addEventListener('click', (event) => {
            const button = event.target.closest('.coach-candidate-btn');
            if (!button) return;
            this.coach.focusCoachCandidate(Number(button.dataset.row), Number(button.dataset.col));
        });
        this.dom.llmSettings.close?.addEventListener('click', () => {
            this.sound.play('uiTap');
            this.settings.closeLlmSettings();
        });
        this.dom.llmSettings.overlay?.addEventListener('click', (event) => {
            if (event.target !== this.dom.llmSettings.overlay) return;
            this.settings.closeLlmSettings();
        });
        this.dom.llmSettings.save?.addEventListener('click', () => this.settings.saveLlmSettingsFromForm());
        this.dom.llmSettings.test?.addEventListener('click', () => this.settings.testLlmSettingsFromForm());
        this.dom.llmSettings.clearKey?.addEventListener('click', () => this.settings.clearLlmApiKey());
        this.dom.help.open?.addEventListener('click', () => {
            this.sound.play('uiTap');
            this.settings.openHelp();
        });
        this.dom.help.close?.addEventListener('click', () => {
            this.sound.play('uiTap');
            this.settings.closeHelp();
        });
        this.dom.help.overlay?.addEventListener('click', (event) => {
            if (event.target !== this.dom.help.overlay) return;
            this.settings.closeHelp();
        });
        this.dom.firstRunGuide.dismiss?.addEventListener('click', () => {
            this.sound.play('uiTap');
            this.settings.dismissFirstRunGuide();
        });
        this.dom.firstRunGuide.details?.addEventListener('click', () => {
            this.sound.play('uiTap');
            this.settings.dismissFirstRunGuide();
            this.settings.openHelp();
        });
        this.dom.controls.placementConfirm.addEventListener('click', () => this.interaction.confirmSelectedPlacement());
        this.dom.controls.selectionCancel.addEventListener('click', () => {
            this.sound.play('cancel');
            this.interaction.cancelSelectedPlacement();
        });
        this.dom.result.restart.addEventListener('click', () => {
            this.sound.play('uiTap');
            this.game.restart();
        });
        this.dom.result.setup.addEventListener('click', () => {
            this.sound.play('uiTap');
            this.game.enterSetup();
        });
        if (this.dom.result.postgameBtn) {
            this.dom.result.postgameBtn.addEventListener('click', () => {
                this.sound.play('uiTap');
                this.coach.requestPostGameReview();
            });
        }
        this.dom.lang.zh.addEventListener('click', () => this.sound.play('uiTap'));
        this.dom.lang.en.addEventListener('click', () => this.sound.play('uiTap'));

        window.addEventListener('pointerdown', this.boundUnlockSound, { passive: true });
        window.addEventListener('keydown', this.boundUnlockSound, { passive: true });
        window.addEventListener('pointermove', this.boundHandleImmersivePointer, { passive: true });
        window.addEventListener('pointerdown', this.boundHandleImmersivePointer, { passive: true });
        window.addEventListener('blur', this.boundHandleImmersiveBlur);
        window.addEventListener('keydown', this.boundHandleGlobalKeydown);
        document.addEventListener('focusin', this.boundHandleImmersiveFocusIn);

        if (!this.use3D) {
            this.dom.board.addEventListener('click', (event) => {
                const cell = event.target.closest('.cell');
                if (!cell) return;
                this.interaction.handleCellClick(Number(cell.dataset.row), Number(cell.dataset.col));
            });
            if (this.interaction.isTouchPlacementFlow()) {
                this.dom.board.addEventListener('touchstart', (event) => {
                    const cell = event.target.closest('.cell')
                        || (event.touches[0] && document.elementFromPoint(
                            event.touches[0].clientX, event.touches[0].clientY
                        )?.closest('.cell'));
                    if (!cell) return;
                    this.interaction.highlightCell(cell);
                }, { passive: true });
                this.dom.board.addEventListener('touchend', () => this.interaction.clearCellHighlight(), { passive: true });
                this.dom.board.addEventListener('touchcancel', () => this.interaction.clearCellHighlight(), { passive: true });
            } else {
                this.dom.board.addEventListener('mouseover', (event) => {
                    const cell = event.target.closest('.cell');
                    if (!cell) return;
                    this.interaction.showPreview(cell);
                });
                this.dom.board.addEventListener('mouseout', (event) => {
                    const cell = event.target.closest('.cell');
                    if (!cell) return;
                    if (event.relatedTarget && cell.contains(event.relatedTarget)) return;
                    if (this.previewCell === cell) this.interaction.clearPreview();
                });
            }
        }

        window.addEventListener('resize', () => {
            this.refreshViewportMode();
            if (this.renderer3d) {
                this.renderer3d.resize();
                this.renderer3d.fitToBoard(this.options.size, false);
            }
            if (!this.dom.sections.game.classList.contains('hidden')) this.game.render();
        });

        this.bindCoachDropAndPaste();
        this.bindBoardPreviewOverlay();

        if ('visualViewport' in window) {
            window.visualViewport.addEventListener('resize', () => this.handleViewportResize());
        }
    }

    /**
     * 绑定 Coach 面板的拖拽文件和全局粘贴图片上传事件。
     * @returns {void}
     */
    bindCoachDropAndPaste() {
        const card = this.dom.guidance?.card;
        if (card) {
            const hasFiles = (event) => {
                const types = event.dataTransfer?.types;
                if (!types) return false;
                if (typeof types.includes === 'function') return types.includes('Files');
                return Array.from(types).includes('Files');
            };
            const onDragEnterOrOver = (event) => {
                if (!this.isGuidedMode()) return;
                if (!hasFiles(event)) return;
                event.preventDefault();
                if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
                card.classList.add('is-drop-active');
            };
            const onDragLeave = () => {
                card.classList.remove('is-drop-active');
            };
            const onDrop = (event) => {
                if (!this.isGuidedMode()) {
                    card.classList.remove('is-drop-active');
                    return;
                }
                if (!hasFiles(event)) return;
                event.preventDefault();
                card.classList.remove('is-drop-active');
                const file = event.dataTransfer?.files?.[0];
                if (file?.type?.startsWith('image/')) {
                    this.coach.handleImageUpload(file);
                }
            };
            card.addEventListener('dragenter', onDragEnterOrOver);
            card.addEventListener('dragover', onDragEnterOrOver);
            card.addEventListener('dragleave', onDragLeave);
            card.addEventListener('drop', onDrop);
        }

        window.addEventListener('paste', (event) => {
            if (!this.isGuidedMode()) return;
            const items = event.clipboardData?.items;
            if (!items) return;
            const imageItem = Array.from(items).find((it) => it.type?.startsWith('image/'));
            const file = imageItem?.getAsFile?.();
            if (file) {
                event.preventDefault();
                this.coach.handleImageUpload(file);
            }
        });
    }

    /**
     * 为棋盘预览覆盖层绑定点击：切换格子颜色（空 → 黑 → 白 → 空）。
     * @returns {void}
     */
    bindBoardPreviewOverlay() {
        const overlay = this.dom.boardPreviewOverlay;
        if (!overlay) return;
        overlay.addEventListener('click', (event) => {
            if (!this.state.coachPreviewMode) return;
            const target = event.target.closest('.preview-cell');
            if (!target) return;
            this.coach.togglePreviewCell(Number(target.dataset.row), Number(target.dataset.col));
        });
    }

    /**
     * 根据 `visualViewport` 的实时尺寸变化判断软键盘是否弹出，并在输入时滚动聚焦字段。
     * @returns {void}
     */
    handleViewportResize() {
        if (!window.visualViewport) return;
        const vv = window.visualViewport;
        const keyboardOpen = vv.height < window.innerHeight * 0.75;
        document.body.classList.toggle('keyboard-open', keyboardOpen);
        if (keyboardOpen) {
            const focused = document.activeElement;
            if (focused && (focused.tagName === 'INPUT' || focused.tagName === 'TEXTAREA')) {
                window.setTimeout(() => { focused.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100);
            }
        }
    }

    // === Test Hooks ===

    /**
     * 暴露浏览器自动化调试钩子，便于测试脚本读取稳定的结构化状态。
     * @returns {void}
     */
    exposeTestHooks() {
        window.gomokuApp = this;
        // 自动化测试通过一个序列化快照读取 UI/状态，避免散落的 DOM 选择器断言。
        window.render_game_to_text = () => JSON.stringify(this.getDebugState());
        // 测试可等待一定时间后重新读取快照，用于覆盖定时器和轻量动画场景。
        window.advanceTime = (ms = 16) => new Promise((resolve) => {
            window.setTimeout(() => resolve(this.getDebugState()), ms);
        });
    }

    /**
     * 汇总当前界面、场景和棋局状态，供调试面板与浏览器自动化读取。
     * @returns {Record<string, unknown>} 结构化调试快照
     */
    getDebugState() {
        return {
            screen: this.dom.sections.game.classList.contains('hidden') ? 'setup' : 'game',
            coordinateSystem: 'origin top-left; rows increase downward; columns increase to the right',
            mode: this.options.mode,
            scene: this.options.scene,
            boardSize: this.options.size,
            currentPlayer: this.state.currentPlayer,
            playerColor: this.options.playerColor,
            moveCount: this.state.moveHistory.length,
            lastMove: this.state.lastMove ? formatMove(this.state.lastMove.row, this.state.lastMove.col) : null,
            aiThinking: this.state.aiThinking,
            soundEnabled: this.sound.isEnabled(),
            ambientCue: this.currentAmbientCue,
            gameOver: this.state.gameOver,
            uiPresentation: this.dom.sections.game.classList.contains('hidden') ? 'setup' : this.state.gameOver ? 'game-finished' : this.state.aiThinking ? 'game-thinking' : 'game-active',
            sceneCameraProfile: this.renderer3d?.getPresentationProfileName?.() || `${this.options.scene}-${this.dom.sections.game.classList.contains('hidden') ? 'setup' : 'game'}`,
            deviceForm: document.body.dataset.deviceForm || 'desktop',
            screenShape: document.body.dataset.screenShape || 'standard',
            screenOrientation: document.body.dataset.screenOrientation || 'landscape',
            desktopHoverUi: this.desktopHoverUi,
            immersiveHudEnabled: this.isImmersiveUiActive(),
            immersiveHudRegions: Object.entries(this.immersiveUiRegions)
                .filter(([, active]) => active)
                .map(([region]) => region),
            helpVisible: this.helpOpen,
            firstRunGuideVisible: this.firstRunGuideOpen,
            coachSuggestion: this.state.coachSuggestion ? formatMove(this.state.coachSuggestion.row, this.state.coachSuggestion.col) : null,
            coachSource: this.state.coachSource,
            coachLlmStatus: this.state.coachLlmStatus,
            coachAlternatives: (this.state.coachAlternatives || []).map((move) => formatMove(move.row, move.col)),
            coachFocus: this.state.coachFocus ? formatMove(this.state.coachFocus.row, this.state.coachFocus.col) : null,
            selectedCell: this.state.selectedCell ? formatMove(this.state.selectedCell.row, this.state.selectedCell.col) : null,
            awaitingPlacementConfirm: this.state.awaitingPlacementConfirm,
            hintMove: this.state.hintMove ? formatMove(this.state.hintMove.row, this.state.hintMove.col) : null
        };
    }

    // === Viewport ===

    /**
     * 刷新视口分类，并同步触屏流、桌面悬浮 HUD 与沉浸式 UI 能力。
     * @returns {void}
     */
    refreshViewportMode() {
        this.applyViewportProfile();
        document.body.classList.toggle('touch-input-active', this.interaction.isTouchPlacementFlow());
        this.desktopHoverUi = this.immersive.isDesktopHoverUi();
        document.body.classList.toggle('desktop-hover-ui', this.desktopHoverUi);
        this.immersiveUiCapable = this.immersive.isImmersiveUiCapable();
        document.body.classList.toggle('immersive-ui-capable', this.immersiveUiCapable);
        this.immersive.refreshImmersiveToggle();
        this.settings.syncHelpUi();
        this.immersive.refreshImmersiveUi();
    }

    /**
     * 将当前视口分类写入 `body.dataset`，供样式与交互策略使用。
     * @returns {void}
     */
    applyViewportProfile() {
        const { deviceForm, screenShape, orientation } = this.getViewportProfile();
        document.body.dataset.deviceForm = deviceForm;
        document.body.dataset.screenShape = screenShape;
        document.body.dataset.screenOrientation = orientation;
    }

    /**
     * 根据窗口尺寸、指针能力和横竖屏信息推断设备形态与屏幕形状。
     * @returns {{
     *   deviceForm: 'desktop'|'desktop-compact'|'tablet'|'mobile',
     *   screenShape: 'standard'|'short'|'tall'|'wide',
     *   orientation: 'landscape'|'portrait'
     * }} 供布局与交互策略使用的视口画像
     */
    getViewportProfile() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
        const hoverless = window.matchMedia?.('(hover: none)').matches ?? false;
        const touchLike = coarsePointer || hoverless;
        const shortestEdge = Math.min(width, height);
        const longestEdge = Math.max(width, height);
        const orientation = width >= height ? 'landscape' : 'portrait';
        const aspectRatio = width / Math.max(height, 1);
        const phoneLikeViewport = shortestEdge <= 520 || (orientation === 'portrait' && width <= 640);

        let deviceForm = 'desktop';
        // 触屏优先设备按长短边阈值区分手机/平板，避免横竖屏切换时 HUD 策略抖动。
        if (touchLike) {
            deviceForm = longestEdge >= 1024 && shortestEdge >= 720 ? 'tablet' : 'mobile';
        } else if (phoneLikeViewport) {
            // Browser emulation and narrow desktop windows still need the phone HUD,
            // otherwise the compact desktop grid overflows and squeezes labels vertically.
            deviceForm = 'mobile';
        } else if (width < 1280 || height < 760) {
            // 非触屏但空间较紧时使用 compact 桌面布局，减少 HUD 占位。
            deviceForm = 'desktop-compact';
        }

        let screenShape = 'standard';
        if (height <= 720) {
            screenShape = 'short';
        } else if (orientation === 'portrait' && aspectRatio < 0.72) {
            screenShape = 'tall';
        } else if (orientation === 'landscape' && aspectRatio > 1.72) {
            screenShape = 'wide';
        }

        return { deviceForm, screenShape, orientation };
    }

    // === Delegation ===

    // Delegation methods for cross-controller calls
    render(opts) {
        this.game.render(opts);
        this.renderPostGameOverlay();
    }

    renderPostGameOverlay() {
        const panel = this.dom?.result?.postgamePanel;
        const contentEl = this.dom?.result?.postgameContent;
        if (!panel || !contentEl) return;
        const status = this.state.coachPostGame;
        if (status === 'ready' && this.state.coachPostGameData) {
            this.renderPostGamePanel(panel, contentEl, this.state.coachPostGameData);
        } else if (status === 'loading') {
            panel.classList.remove('hidden');
            contentEl.innerHTML = '<p>' + i18n.t('coachPostGameLoading') + '</p>';
        } else if (status === 'unavailable' || status === 'error') {
            panel.classList.add('hidden');
        } else {
            panel.classList.add('hidden');
        }
    }
    commitMove(row, col, color, opts) { return this.game.commitMove(row, col, color, opts); }
    toggleSound() { return this.game.toggleSound(); }
    showHint() { return this.game.showHint(); }
    showMessageKey(key, params, type) { return this.game.showMessageKey(key, params, type); }
    setAIThinking(v) { return this.game.setAIThinking(v); }
    clearPendingAI() { return this.game.clearPendingAI(); }
    createResultSummary(type, wc) { return this.game.createResultSummary(type, wc); }
    resetCamera() { return this.game.resetCamera(); }

    refreshCoachGuidance(a) { return this.coach.refreshCoachGuidance(a); }
    clearCoachState(opts) { return this.coach.clearCoachState(opts); }
    cancelLlmCoachRequest() { return this.coach.cancelLlmCoachRequest(); }
    focusCoachCandidate(r, c) { return this.coach.focusCoachCandidate(r, c); }
    isLegalCoachMove(r, c) { return this.coach.isLegalCoachMove(r, c); }

    refreshSetup(opts) { return this.settings.refreshSetup(opts); }
    applyScenePresentation(opts) { return this.settings.applyScenePresentation(opts); }
    syncSceneExperience(opts) { return this.settings.syncSceneExperience(opts); }
    handleLanguageChange() { return this.settings.handleLanguageChange(); }
    syncHelpUi() { return this.settings.syncHelpUi(); }
    refreshSoundToggle() { return this.settings.refreshSoundToggle(); }
    setButtonLabel(b, t) { return this.settings.setButtonLabel(b, t); }
    openHelp() { return this.settings.openHelp(); }
    closeHelp() { return this.settings.closeHelp(); }
    openLlmSettings() { return this.settings.openLlmSettings(); }
    closeLlmSettings() { return this.settings.closeLlmSettings(); }
    saveLlmSettingsFromForm() { return this.settings.saveLlmSettingsFromForm(); }
    testLlmSettingsFromForm() { return this.settings.testLlmSettingsFromForm(); }
    clearLlmApiKey() { return this.settings.clearLlmApiKey(); }
    setLlmSettingsStatus(t, v) { return this.settings.setLlmSettingsStatus(t, v); }
    dismissFirstRunGuide() { return this.settings.dismissFirstRunGuide(); }
    showFirstRunGuideIfNeeded() { return this.settings.showFirstRunGuideIfNeeded(); }
    persistImmersiveUiPreference() { return this.settings.persistImmersiveUiPreference(); }
    persistFirstRunGuideSeen() { return this.settings.persistFirstRunGuideSeen(); }
    loadFirstRunGuideSeen() { return this.settings.loadFirstRunGuideSeen(); }
    loadImmersiveUiPreference() { return this.settings.loadImmersiveUiPreference(); }

    refreshImmersiveUi(opts) { return this.immersive.refreshImmersiveUi(opts); }
    refreshImmersiveToggle() { return this.immersive.refreshImmersiveToggle(); }
    toggleImmersiveUi() { return this.immersive.toggleImmersiveUi(); }
    isImmersiveUiActive() { return this.immersive.isImmersiveUiActive(); }
    isImmersiveUiCapable() { return this.immersive.isImmersiveUiCapable(); }
    isDesktopHoverUi() { return this.immersive.isDesktopHoverUi(); }
    handleImmersivePointer(e) { return this.immersive.handleImmersivePointer(e); }
    handleImmersiveFocusIn(e) { return this.immersive.handleImmersiveFocusIn(e); }
    setImmersiveRegions(r) { return this.immersive.setImmersiveRegions(r); }

    handleCellClick(r, c) { return this.interaction.handleCellClick(r, c); }
    validateMove(r, c, color) { return this.interaction.validateMove(r, c, color); }
    selectCellForPlacement(r, c) { return this.interaction.selectCellForPlacement(r, c); }
    confirmSelectedPlacement() { return this.interaction.confirmSelectedPlacement(); }
    cancelSelectedPlacement() { return this.interaction.cancelSelectedPlacement(); }
    clearPlacementSelection(cm) { return this.interaction.clearPlacementSelection(cm); }
    canHumanMove() { return this.interaction.canHumanMove(); }
    getForbiddenReason(r, c, color) { return this.interaction.getForbiddenReason(r, c, color); }
    isAIMode() { return this.interaction.isAIMode(); }
    isGuidedMode() { return this.interaction.isGuidedMode(); }
    isTouchPlacementFlow() { return this.interaction.isTouchPlacementFlow(); }
    showPreview(cell) { return this.interaction.showPreview(cell); }
    showPreview3D(r, c) { return this.interaction.showPreview3D(r, c); }
    clearPreview() { return this.interaction.clearPreview(); }
    highlightCell(cell) { return this.interaction.highlightCell(cell); }
    clearCellHighlight() { return this.interaction.clearCellHighlight(); }
    handleGlobalKeydown(e) { return this.interaction.handleGlobalKeydown(e); }

    // === Lifecycle ===

    /**
     * 释放计时器、全局事件、3D 渲染器、音频上下文和测试钩子。
     * @returns {void}
     */
    dispose() {
        this.game.clearPendingAI();
        this.coach.cancelLlmCoachRequest();
        this.llmTestAbortController?.abort();
        this.interaction.clearPreview();

        if (this.matchEnterTimer) {
            window.clearTimeout(this.matchEnterTimer);
            this.matchEnterTimer = null;
        }
        if (this.sceneSwitchTimer) {
            window.clearTimeout(this.sceneSwitchTimer);
            this.sceneSwitchTimer = null;
        }
        if (this.renderer3d) {
            this.renderer3d.dispose();
            this.renderer3d = null;
        }

        this.sound.dispose();
        window.removeEventListener('pointerdown', this.boundUnlockSound);
        window.removeEventListener('keydown', this.boundUnlockSound);
        window.removeEventListener('pointermove', this.boundHandleImmersivePointer);
        window.removeEventListener('pointerdown', this.boundHandleImmersivePointer);
        window.removeEventListener('blur', this.boundHandleImmersiveBlur);
        window.removeEventListener('keydown', this.boundHandleGlobalKeydown);
        document.removeEventListener('focusin', this.boundHandleImmersiveFocusIn);

        if (window.gomokuApp === this) delete window.gomokuApp;
        delete window.render_game_to_text;
        delete window.advanceTime;
        this.devPanel?.dispose?.();
        this.devPanel = null;
    }
}
