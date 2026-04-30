import { GAME_INTRO_MESSAGES } from '../config/gameConfig.js';
import { getAIDelay, getBestMove, getMoveGuidance, getMoveReview } from '../game/ai.js';
import { getForbiddenReason, getWinningLine } from '../game/rules.js';
import { createGameState, createOptions } from '../game/state.js';
import { getDOMReferences, setActiveButton, setActiveByValue, setupLanguageSwitch } from '../ui/dom.js';
import {
    hideResultOverlay,
    renderBoard,
    setAIThinking,
    showGame,
    showMessage,
    showResultOverlay,
    showSetup,
    syncSetupPanel,
    updateGuidance,
    updateMeta,
    updateMoveList,
    updatePlacementPanel,
    updateStatus
} from '../ui/render.js';
import { i18n } from '../utils/i18n.js';
import { formatMove, getPlayerLabel } from '../utils/formatters.js';
import { getOpponent, isBoardFull, isInside } from '../utils/board.js';
import { GomokuRenderer3D } from '../render3d/GomokuRenderer3D.js';
import { SoundManager } from '../audio/SoundManager.js';
import { getSceneAmbienceCue } from '../config/sceneConfig.js';
import {
    getLlmCoachConfigStatus,
    isLlmCoachConfigured,
    loadLlmCoachSettings,
    normalizeLlmCoachSettings,
    requestLlmCoachAdvice,
    saveLlmCoachSettings,
    testLlmCoachConnection
} from '../services/llmCoach.js';

const IMMERSIVE_UI_STORAGE_KEY = 'gomoku-immersive-ui';
const FIRST_RUN_GUIDE_STORAGE_KEY = 'gomoku-first-run-guide';
const IMMERSIVE_REGION_KEYS = ['top', 'left', 'right', 'bottom'];

export class GomokuApp {
    constructor(root = document) {
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
        this.firstRunGuideSeen = this.loadFirstRunGuideSeen();
        this.firstRunGuideOpen = false;
        this.llmSettings = loadLlmCoachSettings();
        this.llmSettingsOpen = false;
        this.llmCoachRequestId = 0;
        this.llmCoachAbortController = null;
        this.llmTestAbortController = null;
        this.immersiveUiCapable = false;
        this.immersiveUiEnabled = this.loadImmersiveUiPreference();
        this.immersiveUiRects = {};
        this.immersiveUiRegions = { top: true, left: true, right: true, bottom: true };
        this.lastImmersivePointer = null;
        this.boundUnlockSound = () => {
            this.sound.unlock();
        };
        this.boundHandleImmersivePointer = this.handleImmersivePointer.bind(this);
        this.boundHandleImmersiveFocusIn = this.handleImmersiveFocusIn.bind(this);
        this.boundHandleGlobalKeydown = this.handleGlobalKeydown.bind(this);
        this.boundHandleImmersiveBlur = () => {
            if (!this.isImmersiveUiActive()) {
                return;
            }
            this.setImmersiveRegions({ top: false, left: false, right: false, bottom: false });
        };

        this.renderer3d = null;
        this.use3D = false;

        this.applyViewportProfile();
        this.initRenderer();
        document.body.classList.toggle('render-mode-3d', this.use3D);
        document.body.classList.toggle('render-mode-2d', !this.use3D);

        this.bindEvents();
        this.exposeTestHooks();
        setupLanguageSwitch(this.dom, () => this.handleLanguageChange());
        this.refreshSoundToggle();
        this.refreshSetup();
        this.refreshViewportMode();
        this.enterSetup();
        this.showFirstRunGuideIfNeeded();
    }

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
                    presentationMode: 'setup'
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

    setup3DCallbacks() {
        if (!this.renderer3d) return;

        this.renderer3d.onCellClick((row, col) => {
            this.handleCellClick(row, col);
        });

        this.renderer3d.onCellHover((row, col) => {
            this.showPreview3D(row, col);
        });

        this.renderer3d.onCellLeave(() => {
            this.clearPreview();
        });
    }

    bindEvents() {
        this.bindOptionGroup(this.dom.optionGroups.mode, 'mode', (value) => {
            this.options.mode = value;
            this.refreshSetup();
        });

        this.bindOptionGroup(this.dom.optionGroups.rule, 'rule', (value) => {
            this.options.rule = value;
        });

        this.bindOptionGroup(this.dom.optionGroups.size, 'size', (value) => {
            this.options.size = Number(value);
            this.refreshSetup();
        });

        this.bindOptionGroup(this.dom.optionGroups.scene, 'scene', (value) => {
            this.options.scene = value;
            this.refreshSetup({ animateScene: true });
            if (!this.dom.sections.game.classList.contains('hidden')) {
                this.render();
            }
        });

        this.bindOptionGroup(this.dom.optionGroups.level, 'level', (value) => {
            this.options.level = value;
        });

        this.bindOptionGroup(this.dom.optionGroups.playerColor, 'color', (value) => {
            this.options.playerColor = value;
        });

        this.dom.controls.start.addEventListener('click', () => {
            this.sound.unlock();
            this.sound.play('start');
            this.startGame();
        });
        this.dom.controls.back.addEventListener('click', () => {
            this.sound.play('uiTap');
            this.enterSetup();
        });
        this.dom.controls.undo.addEventListener('click', () => this.undo());
        this.dom.controls.hint.addEventListener('click', () => this.showHint());
        this.dom.controls.swap.addEventListener('click', () => this.swapSides());
        this.dom.controls.restart.addEventListener('click', () => {
            this.sound.play('uiTap');
            this.restart();
        });
        this.dom.controls.resign.addEventListener('click', () => this.resign());
        this.dom.controls.viewReset.addEventListener('click', () => {
            this.sound.play('uiTap');
            this.resetCamera();
        });
        this.dom.controls.soundToggle.addEventListener('click', () => this.toggleSound());
        this.dom.controls.immersiveToggle?.addEventListener('click', () => this.toggleImmersiveUi());
        this.dom.controls.setupLlmSettings?.addEventListener('click', () => {
            this.sound.play('uiTap');
            this.openLlmSettings();
        });
        this.dom.guidance.settings?.addEventListener('click', () => {
            this.sound.play('uiTap');
            this.openLlmSettings();
        });
        this.dom.guidance.rerun?.addEventListener('click', () => {
            this.sound.play('hint');
            this.refreshCoachGuidance(true);
        });
        this.dom.guidance.alternatives?.addEventListener('click', (event) => {
            const button = event.target.closest('.coach-candidate-btn');
            if (!button) {
                return;
            }

            this.focusCoachCandidate(Number(button.dataset.row), Number(button.dataset.col));
        });
        this.dom.llmSettings.close?.addEventListener('click', () => {
            this.sound.play('uiTap');
            this.closeLlmSettings();
        });
        this.dom.llmSettings.overlay?.addEventListener('click', (event) => {
            if (event.target !== this.dom.llmSettings.overlay) {
                return;
            }

            this.closeLlmSettings();
        });
        this.dom.llmSettings.save?.addEventListener('click', () => this.saveLlmSettingsFromForm());
        this.dom.llmSettings.test?.addEventListener('click', () => this.testLlmSettingsFromForm());
        this.dom.llmSettings.clearKey?.addEventListener('click', () => this.clearLlmApiKey());
        this.dom.help.open?.addEventListener('click', () => {
            this.sound.play('uiTap');
            this.openHelp();
        });
        this.dom.help.close?.addEventListener('click', () => {
            this.sound.play('uiTap');
            this.closeHelp();
        });
        this.dom.help.overlay?.addEventListener('click', (event) => {
            if (event.target !== this.dom.help.overlay) {
                return;
            }
            this.closeHelp();
        });
        this.dom.firstRunGuide.dismiss?.addEventListener('click', () => {
            this.sound.play('uiTap');
            this.dismissFirstRunGuide();
        });
        this.dom.firstRunGuide.details?.addEventListener('click', () => {
            this.sound.play('uiTap');
            this.dismissFirstRunGuide();
            this.openHelp();
        });
        this.dom.controls.placementConfirm.addEventListener('click', () => this.confirmSelectedPlacement());
        this.dom.controls.selectionCancel.addEventListener('click', () => {
            this.sound.play('cancel');
            this.cancelSelectedPlacement();
        });
        this.dom.result.restart.addEventListener('click', () => {
            this.sound.play('uiTap');
            this.restart();
        });
        this.dom.result.setup.addEventListener('click', () => {
            this.sound.play('uiTap');
            this.enterSetup();
        });
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
                if (!cell) {
                    return;
                }

                this.handleCellClick(Number(cell.dataset.row), Number(cell.dataset.col));
            });

            // 触摸设备上使用 touch 事件替代 mouseover/mouseout
            if (this.isTouchPlacementFlow()) {
                this.dom.board.addEventListener('touchstart', (event) => {
                    // 优先使用 event.target 获取触摸目标，fallback 到 elementFromPoint
                    const cell = event.target.closest('.cell')
                        || (event.touches[0] && document.elementFromPoint(
                            event.touches[0].clientX,
                            event.touches[0].clientY
                        )?.closest('.cell'));
                    if (!cell) {
                        return;
                    }

                    // 触摸时高亮格子，但不显示预览棋子
                    this.highlightCell(cell);
                }, { passive: true });

                this.dom.board.addEventListener('touchend', () => {
                    this.clearCellHighlight();
                }, { passive: true });

                this.dom.board.addEventListener('touchcancel', () => {
                    this.clearCellHighlight();
                }, { passive: true });
            } else {
                this.dom.board.addEventListener('mouseover', (event) => {
                    const cell = event.target.closest('.cell');
                    if (!cell) {
                        return;
                    }

                    this.showPreview(cell);
                });

                this.dom.board.addEventListener('mouseout', (event) => {
                    const cell = event.target.closest('.cell');
                    if (!cell) {
                        return;
                    }

                    if (event.relatedTarget && cell.contains(event.relatedTarget)) {
                        return;
                    }

                    if (this.previewCell === cell) {
                        this.clearPreview();
                    }
                });
            }
        }

        window.addEventListener('resize', () => {
            this.refreshViewportMode();

            if (this.renderer3d) {
                this.renderer3d.resize();
                this.renderer3d.fitToBoard(this.options.size, false);
            }

            if (!this.dom.sections.game.classList.contains('hidden')) {
                this.render();
            }
        });

        // 移动端键盘弹出时调整布局
        if ('visualViewport' in window) {
            window.visualViewport.addEventListener('resize', () => {
                this.handleViewportResize();
            });
        }

    }

    handleViewportResize() {
        if (!window.visualViewport) {
            return;
        }

        const vv = window.visualViewport;
        const keyboardOpen = vv.height < window.innerHeight * 0.75;

        document.body.classList.toggle('keyboard-open', keyboardOpen);

        // 键盘打开时滚动到输入框
        if (keyboardOpen) {
            const focused = document.activeElement;
            if (focused && (focused.tagName === 'INPUT' || focused.tagName === 'TEXTAREA')) {
                window.setTimeout(() => {
                    focused.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 100);
            }
        }
    }

    exposeTestHooks() {
        window.gomokuApp = this;
        window.render_game_to_text = () => JSON.stringify(this.getDebugState());
        window.advanceTime = (ms = 16) => new Promise((resolve) => {
            window.setTimeout(() => {
                resolve(this.getDebugState());
            }, ms);
        });
    }

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

    refreshViewportMode() {
        this.applyViewportProfile();
        document.body.classList.toggle('touch-input-active', this.isTouchPlacementFlow());
        this.desktopHoverUi = this.isDesktopHoverUi();
        document.body.classList.toggle('desktop-hover-ui', this.desktopHoverUi);
        this.immersiveUiCapable = this.isImmersiveUiCapable();
        document.body.classList.toggle('immersive-ui-capable', this.immersiveUiCapable);
        this.refreshImmersiveToggle();
        this.syncHelpUi();
        this.refreshImmersiveUi();
    }

    applyViewportProfile() {
        const { deviceForm, screenShape, orientation } = this.getViewportProfile();
        document.body.dataset.deviceForm = deviceForm;
        document.body.dataset.screenShape = screenShape;
        document.body.dataset.screenOrientation = orientation;
    }

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

        let deviceForm = 'desktop';
        if (touchLike) {
            deviceForm = longestEdge >= 1024 && shortestEdge >= 720 ? 'tablet' : 'mobile';
        } else if (width < 1280 || height < 760) {
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

    refreshSoundToggle() {
        const button = this.dom.controls.soundToggle;
        if (!button) {
            return;
        }

        const enabled = this.sound.isEnabled();
        const label = i18n.t(enabled ? 'soundOn' : 'soundOff');
        this.setButtonLabel(button, label);
        button.classList.toggle('control-btn-secondary', enabled);
        button.classList.toggle('is-muted', !enabled);
        button.classList.toggle('is-sound-off', !enabled);
        button.setAttribute('aria-label', label);
        button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    }

    setButtonLabel(button, text) {
        const label = button?.querySelector('[data-role="button-label"]');
        if (label) {
            label.textContent = text;
            return;
        }

        if (button) {
            button.textContent = text;
        }
    }

    loadFirstRunGuideSeen() {
        try {
            return window.localStorage?.getItem(FIRST_RUN_GUIDE_STORAGE_KEY) === '1';
        } catch {
            return false;
        }
    }

    persistFirstRunGuideSeen() {
        try {
            window.localStorage?.setItem(FIRST_RUN_GUIDE_STORAGE_KEY, '1');
        } catch {
            // Ignore storage failures and keep the in-memory state.
        }
    }

    loadImmersiveUiPreference() {
        try {
            const saved = window.localStorage?.getItem(IMMERSIVE_UI_STORAGE_KEY);
            if (saved === null) {
                return true;
            }
            return saved === '1';
        } catch {
            return true;
        }
    }

    persistImmersiveUiPreference() {
        try {
            window.localStorage?.setItem(IMMERSIVE_UI_STORAGE_KEY, this.immersiveUiEnabled ? '1' : '0');
        } catch {
            // Ignore storage failures and keep the in-memory preference.
        }
    }

    isImmersiveUiCapable() {
        const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
        const hoverless = window.matchMedia?.('(hover: none)').matches ?? false;
        return !coarsePointer && !hoverless && window.innerWidth > 960;
    }

    isDesktopHoverUi() {
        const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
        const hoverless = window.matchMedia?.('(hover: none)').matches ?? false;
        return !coarsePointer && !hoverless;
    }

    isImmersiveUiActive() {
        return this.immersiveUiEnabled
            && this.immersiveUiCapable
            && !this.dom.sections.game.classList.contains('hidden');
    }

    refreshImmersiveToggle() {
        const button = this.dom.controls.immersiveToggle;
        const card = this.dom.hud.immersiveCard;

        if (!button) {
            return;
        }

        const available = this.immersiveUiCapable;
        const label = available
            ? i18n.t(this.immersiveUiEnabled ? 'immersiveUiOn' : 'immersiveUiOff')
            : i18n.t('immersiveUiUnavailable');
        button.disabled = !available;
        this.setButtonLabel(button, label);
        button.classList.toggle('control-btn-secondary', available && this.immersiveUiEnabled);
        button.classList.toggle('is-muted', !available || !this.immersiveUiEnabled);
        button.classList.toggle('is-immersive-unavailable', !available);
        button.setAttribute('aria-label', label);
        button.setAttribute('aria-pressed', available && this.immersiveUiEnabled ? 'true' : 'false');

        if (card) {
            card.classList.toggle('panel-block-disabled', !available);
        }
    }

    syncHelpUi() {
        const overlay = this.dom.help.overlay;
        const openButton = this.dom.help.open;
        if (overlay) {
            overlay.classList.toggle('hidden', !this.helpOpen);
            overlay.setAttribute('aria-hidden', this.helpOpen ? 'false' : 'true');
        }
        if (openButton) {
            openButton.setAttribute('aria-expanded', this.helpOpen ? 'true' : 'false');
        }
        document.body.classList.toggle('help-open', this.helpOpen);
    }

    openHelp() {
        this.helpOpen = true;
        if (this.dom.help.sheet) {
            this.dom.help.sheet.scrollTop = 0;
            this.dom.help.sheet.scrollLeft = 0;
        }
        this.syncHelpUi();
    }

    closeHelp() {
        if (!this.helpOpen) {
            return;
        }
        this.helpOpen = false;
        this.syncHelpUi();
    }

    openLlmSettings() {
        this.llmSettingsOpen = true;
        this.syncLlmSettingsForm();
        this.syncLlmSettingsUi();
        window.setTimeout(() => {
            this.dom.llmSettings.baseUrl?.focus();
        }, 0);
    }

    closeLlmSettings() {
        if (!this.llmSettingsOpen) {
            return;
        }

        this.llmSettingsOpen = false;
        this.syncLlmSettingsUi();
    }

    syncLlmSettingsUi() {
        const overlay = this.dom.llmSettings.overlay;
        if (!overlay) {
            return;
        }

        overlay.classList.toggle('hidden', !this.llmSettingsOpen);
        overlay.setAttribute('aria-hidden', this.llmSettingsOpen ? 'false' : 'true');
        document.body.classList.toggle('llm-settings-open', this.llmSettingsOpen);
        this.dom.controls.setupLlmSettings?.setAttribute('aria-expanded', this.llmSettingsOpen ? 'true' : 'false');
        this.dom.guidance.settings?.setAttribute('aria-expanded', this.llmSettingsOpen ? 'true' : 'false');
    }

    syncLlmSettingsForm() {
        const fields = this.dom.llmSettings;
        if (!fields.enabled) {
            return;
        }

        fields.enabled.checked = Boolean(this.llmSettings.enabled);
        fields.baseUrl.value = this.llmSettings.baseUrl || '';
        fields.model.value = this.llmSettings.model || '';
        fields.apiKey.value = this.llmSettings.apiKey || '';
        fields.status.textContent = '';
        fields.status.className = 'llm-test-status';
    }

    readLlmSettingsForm() {
        const fields = this.dom.llmSettings;
        return normalizeLlmCoachSettings({
            enabled: fields.enabled?.checked,
            baseUrl: fields.baseUrl?.value,
            model: fields.model?.value,
            apiKey: fields.apiKey?.value
        });
    }

    saveLlmSettingsFromForm() {
        this.sound.play('uiTap');
        this.llmSettings = saveLlmCoachSettings(this.readLlmSettingsForm());
        this.setLlmSettingsStatus(i18n.t('llmSettingsSaved'), 'success');

        if (this.isGuidedMode() && this.canHumanMove()) {
            this.refreshCoachGuidance(false);
        } else {
            const configStatus = getLlmCoachConfigStatus(this.llmSettings);
            this.state.coachLlmStatus = configStatus === 'ready' ? 'local' : configStatus;
            this.render();
        }

        this.showMessageKey('llmSettingsSaved');
    }

    async testLlmSettingsFromForm() {
        const settings = this.readLlmSettingsForm();
        if (!isLlmCoachConfigured(settings)) {
            this.sound.play('error');
            this.setLlmSettingsStatus(i18n.t('llmConfigIncomplete'), 'error');
            return;
        }

        this.sound.play('uiTap');
        this.llmTestAbortController?.abort();
        this.llmTestAbortController = new AbortController();
        this.setLlmSettingsStatus(i18n.t('llmTesting'), 'pending');
        if (this.dom.llmSettings.test) {
            this.dom.llmSettings.test.disabled = true;
        }

        try {
            await testLlmCoachConnection(settings, {
                signal: this.llmTestAbortController.signal
            });
            this.setLlmSettingsStatus(i18n.t('llmTestOk'), 'success');
        } catch (error) {
            if (error?.code !== 'aborted') {
                this.setLlmSettingsStatus(`${i18n.t('llmTestFailed')} ${error?.message || ''}`.trim(), 'error');
            }
        } finally {
            if (this.dom.llmSettings.test) {
                this.dom.llmSettings.test.disabled = false;
            }
            this.llmTestAbortController = null;
        }
    }

    clearLlmApiKey() {
        if (this.dom.llmSettings.apiKey) {
            this.dom.llmSettings.apiKey.value = '';
        }

        this.llmSettings = saveLlmCoachSettings({
            ...this.readLlmSettingsForm(),
            apiKey: ''
        });
        this.sound.play('uiTap');
        this.setLlmSettingsStatus(i18n.t('llmKeyCleared'), 'success');

        if (this.isGuidedMode()) {
            const configStatus = getLlmCoachConfigStatus(this.llmSettings);
            this.state.coachLlmStatus = configStatus === 'ready' ? 'local' : configStatus;
            this.render();
        }
    }

    setLlmSettingsStatus(text, variant = '') {
        const status = this.dom.llmSettings.status;
        if (!status) {
            return;
        }

        status.textContent = text;
        status.className = `llm-test-status ${variant ? `llm-test-status-${variant}` : ''}`.trim();
    }

    showFirstRunGuideIfNeeded() {
        if (this.firstRunGuideSeen || !this.dom.firstRunGuide.card) {
            return;
        }

        this.firstRunGuideOpen = true;
        this.dom.firstRunGuide.card.classList.remove('hidden');
        this.dom.firstRunGuide.card.setAttribute('aria-hidden', 'false');
        document.body.classList.add('first-run-guide-open');
    }

    dismissFirstRunGuide() {
        if (!this.firstRunGuideOpen) {
            return;
        }

        this.firstRunGuideSeen = true;
        this.firstRunGuideOpen = false;
        this.persistFirstRunGuideSeen();
        this.dom.firstRunGuide.card?.classList.add('hidden');
        this.dom.firstRunGuide.card?.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('first-run-guide-open');
    }

    handleGlobalKeydown(event) {
        if (event.key !== 'Escape') {
            return;
        }

        if (this.llmSettingsOpen) {
            this.closeLlmSettings();
            return;
        }

        if (this.helpOpen) {
            this.closeHelp();
            return;
        }

        if (this.firstRunGuideOpen) {
            this.dismissFirstRunGuide();
        }
    }

    toggleImmersiveUi() {
        if (!this.immersiveUiCapable) {
            this.sound.play('error');
            return;
        }

        this.immersiveUiEnabled = !this.immersiveUiEnabled;
        this.persistImmersiveUiPreference();

        if (this.immersiveUiEnabled) {
            this.sound.play('toggleOn');
            this.setImmersiveRegions({ top: true, left: true, right: true, bottom: true });
        } else {
            this.sound.play('toggleOff');
        }

        this.refreshImmersiveToggle();
        this.refreshImmersiveUi();
    }

    handleImmersivePointer(event) {
        this.lastImmersivePointer = { x: event.clientX, y: event.clientY };

        if (!this.isImmersiveUiActive()) {
            return;
        }

        this.updateImmersiveRects();
        this.updateImmersiveRegionsFromPoint(this.lastImmersivePointer);
    }

    handleImmersiveFocusIn(event) {
        if (!this.isImmersiveUiActive()) {
            return;
        }

        const target = event.target;
        this.setImmersiveRegions({
            top: Boolean(target.closest('.hud-top, .lang-switch')),
            left: Boolean(target.closest('.hud-left')),
            right: Boolean(target.closest('.hud-right')),
            bottom: Boolean(target.closest('.hud-bottom'))
        });
    }

    refreshImmersiveUi({ forceAll = false } = {}) {
        const active = this.isImmersiveUiActive();
        document.body.classList.toggle('immersive-ui-enabled', active);

        if (!active) {
            this.setImmersiveRegions({ top: true, left: true, right: true, bottom: true });
            return;
        }

        if (document.body.classList.contains('match-entering')) {
            return;
        }

        this.updateImmersiveRects();

        if (forceAll || !this.lastImmersivePointer) {
            this.setImmersiveRegions({ top: true, left: true, right: true, bottom: true });
            return;
        }

        this.updateImmersiveRegionsFromPoint(this.lastImmersivePointer);
    }

    updateImmersiveRects() {
        this.immersiveUiRects = {
            top: this.dom.hud.top?.getBoundingClientRect() ?? null,
            left: this.dom.hud.left?.getBoundingClientRect() ?? null,
            right: this.dom.hud.right?.getBoundingClientRect() ?? null,
            bottom: this.dom.hud.bottom?.getBoundingClientRect() ?? null,
            lang: this.dom.hud.langSwitch?.getBoundingClientRect() ?? null
        };
    }

    updateImmersiveRegionsFromPoint(point) {
        if (!point) {
            this.setImmersiveRegions({ top: true, left: true, right: true, bottom: true });
            return;
        }

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const edgeLeft = Math.max(152, Math.min(260, viewportWidth * 0.18));
        const edgeRight = viewportWidth - Math.max(168, Math.min(280, viewportWidth * 0.2));
        const edgeTop = Math.max(88, Math.min(146, viewportHeight * 0.14));
        const edgeBottom = viewportHeight - Math.max(92, Math.min(142, viewportHeight * 0.14));
        const regions = {
            top: point.y <= edgeTop
                || this.isPointNearRect(point, this.immersiveUiRects.top, 24)
                || this.isPointNearRect(point, this.immersiveUiRects.lang, 18),
            left: point.x <= edgeLeft
                || this.isPointNearRect(point, this.immersiveUiRects.left, 28),
            right: point.x >= edgeRight
                || this.isPointNearRect(point, this.immersiveUiRects.right, 28),
            bottom: point.y >= edgeBottom
                || this.isPointNearRect(point, this.immersiveUiRects.bottom, 22)
        };

        if (!this.dom.placement.panel.classList.contains('hidden')) {
            regions.bottom = true;
        }

        this.setImmersiveRegions(regions);
    }

    isPointNearRect(point, rect, padding = 20) {
        if (!rect) {
            return false;
        }

        return point.x >= rect.left - padding
            && point.x <= rect.right + padding
            && point.y >= rect.top - padding
            && point.y <= rect.bottom + padding;
    }

    setImmersiveRegions(regions) {
        IMMERSIVE_REGION_KEYS.forEach((region) => {
            const active = Boolean(regions[region]);
            this.immersiveUiRegions[region] = active;
            document.body.classList.toggle(`immersive-${region}-active`, active);
        });
    }

    bindOptionGroup(group, dataAttribute, onSelect) {
        if (!group) {
            console.warn(`bindOptionGroup: group is null for attribute "${dataAttribute}"`);
            return;
        }
        group.addEventListener('click', (event) => {
            const button = event.target.closest('.option-btn');
            if (!button) {
                return;
            }

            this.sound.play('uiTap');
            setActiveButton(group, button);
            onSelect(button.dataset[dataAttribute]);
        });
    }

    isAIMode() {
        return this.options.mode === 'pve' || this.options.mode === 'qi';
    }

    isGuidedMode() {
        return this.options.mode === 'qi';
    }

    isTouchPlacementFlow() {
        const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
        const hoverless = window.matchMedia?.('(hover: none)').matches ?? false;
        return coarsePointer || hoverless;
    }

    refreshSetup({ animateScene = false } = {}) {
        syncSetupPanel(this.dom, this.options);
        this.applyScenePresentation({ animate: animateScene });
        this.syncSceneExperience({ animateCamera: animateScene });

        if (this.renderer3d) {
            this.renderer3d.setBoardSize(this.options.size);
            if (this.dom.sections.game.classList.contains('hidden')) {
                this.renderer3d.setInteractionEnabled(false);
                this.renderer3d.fitToBoard(this.options.size, false);
            }
        }
    }

    applyScenePresentation({ animate = false } = {}) {
        document.body.dataset.scene = this.options.scene;

        if (animate) {
            document.body.classList.add('scene-switching');
            if (this.sceneSwitchTimer) {
                window.clearTimeout(this.sceneSwitchTimer);
            }
            this.sceneSwitchTimer = window.setTimeout(() => {
                document.body.classList.remove('scene-switching');
                this.sceneSwitchTimer = null;
            }, 480);
        }

        if (this.renderer3d) {
            this.renderer3d.setScenePreset(this.options.scene, { animate });
        }
    }

    syncSceneExperience({ animateCamera = false } = {}) {
        const presentationMode = this.dom.sections.game.classList.contains('hidden') ? 'setup' : 'game';
        document.body.dataset.uiPresentation = presentationMode;

        if (this.renderer3d) {
            this.renderer3d.setPresentationMode(presentationMode, { animate: animateCamera });
        }

        this.currentAmbientCue = getSceneAmbienceCue(this.options.scene, presentationMode, {
            aiThinking: this.state.aiThinking,
            gameOver: this.state.gameOver
        });
        this.sound.setAmbience(this.currentAmbientCue);
    }

    handleLanguageChange() {
        this.refreshSetup();
        this.refreshSoundToggle();
        this.refreshImmersiveToggle();
        this.syncHelpUi();
        if (!this.dom.sections.game.classList.contains('hidden')) {
            this.render();
        } else {
            updateMeta(this.dom, this.options);
            updateStatus(this.dom, this.state);
            updateMoveList(this.dom, this.state.moveHistory);
            updateGuidance(this.dom, this.state, this.options);
            updatePlacementPanel(this.dom, this.state);
        }

        if (this.state.resultType && !this.dom.result.overlay.classList.contains('hidden')) {
            this.state.resultSummary = this.createResultSummary(this.state.resultType, this.state.resultWinnerColor);
            showResultOverlay(this.dom, this.state.resultSummary);
        }
    }

    createFreshState() {
        this.state = createGameState(this.options);
        hideResultOverlay(this.dom);
    }

    enterSetup() {
        this.clearPendingAI();
        this.cancelLlmCoachRequest();
        this.clearPreview();
        this.clearPlacementSelection(false);
        showSetup(this.dom);
        this.setAIThinking(false);
        hideResultOverlay(this.dom);
        this.dom.message.classList.add('hidden');

        if (this.renderer3d) {
            this.renderer3d.setInteractionEnabled(false);
            this.renderer3d.setScenePreset(this.options.scene, { animate: false });
            this.renderer3d.setPresentationMode('setup', { animate: false });
            this.renderer3d.fitToBoard(this.options.size, false);
            this.renderer3d.playSetupStartSequence();
        }

        this.render();
        this.refreshImmersiveUi();
        document.body.classList.remove('guided-mode', 'awaiting-placement');
    }

    startGame() {
        this.clearPendingAI();
        this.cancelLlmCoachRequest();
        this.dismissFirstRunGuide();
        this.createFreshState();
        updateMeta(this.dom, this.options);

        if (this.use3D && this.renderer3d) {
            this.renderer3d.setBoardSize(this.options.size);
            this.renderer3d.setScenePreset(this.options.scene, { animate: false });
            this.renderer3d.setPresentationMode('game', { animate: false });
            this.renderer3d.setInteractionEnabled(true);
        }

        showGame(this.dom);
        this.playMatchEnterUI();
        this.refreshImmersiveUi();

        if (this.use3D && this.renderer3d) {
            setTimeout(() => {
                this.renderer3d.resize();
                this.renderer3d.fitToBoard(this.options.size, false);
                this.renderer3d.playGameStartSequence();
            }, 50);
        }

        this.render();
        showMessage(this.dom, this.getIntroMessage(), 'info');

        if (this.isAIMode() && this.options.playerColor === 'white') {
            this.scheduleAIMove();
            return;
        }

        if (this.isGuidedMode()) {
            this.refreshCoachGuidance();
        }
    }

    playMatchEnterUI() {
        document.body.classList.add('match-entering');
        this.setImmersiveRegions({ top: false, left: false, right: false, bottom: false });
        if (this.matchEnterTimer) {
            window.clearTimeout(this.matchEnterTimer);
        }
        this.matchEnterTimer = window.setTimeout(() => {
            document.body.classList.remove('match-entering');
            this.matchEnterTimer = null;
            this.refreshImmersiveUi();
        }, 820);
    }

    getIntroMessage() {
        if (this.options.mode === 'pvp') {
            return i18n.t('introPvp');
        }

        if (this.options.mode === 'practice') {
            return i18n.t('introPractice');
        }

        if (this.options.mode === 'pve') {
            return this.options.playerColor === 'black'
                ? i18n.t('introPveBlack')
                : i18n.t('introPveWhite');
        }

        if (this.options.mode === 'qi') {
            return this.options.playerColor === 'black'
                ? i18n.t('introQiBlack')
                : i18n.t('introQiWhite');
        }

        return GAME_INTRO_MESSAGES[this.options.mode];
    }

    showMessageKey(key, params = {}, type = 'info') {
        showMessage(this.dom, i18n.t(key, params), type);
    }

    toggleSound() {
        if (this.sound.isEnabled()) {
            this.sound.play('toggleOff');
            this.sound.setEnabled(false);
        } else {
            this.sound.setEnabled(true);
            this.sound.unlock();
            this.sound.play('toggleOn');
        }

        this.refreshSoundToggle();
        this.sound.setAmbience(this.currentAmbientCue);
    }

    handleCellClick(row, col) {
        if (this.state.gameOver) {
            this.sound.play('error');
            this.showMessageKey('gameAlreadyEndedReturn');
            return;
        }

        if (!this.canHumanMove()) {
            this.sound.play('error');
            this.showMessageKey('aiTurnWait');
            return;
        }

        const error = this.validateMove(row, col, this.state.currentPlayer);
        if (error) {
            this.sound.play('error');
            showMessage(this.dom, error, 'error');
            return;
        }

        if (this.isTouchPlacementFlow()) {
            this.selectCellForPlacement(row, col);
            return;
        }

        this.commitMove(row, col, this.state.currentPlayer, { source: 'human' });
    }

    validateMove(row, col, color) {
        if (this.state.board[row][col]) {
            return i18n.t('cellOccupied');
        }

        return this.getForbiddenReason(row, col, color);
    }

    selectCellForPlacement(row, col) {
        const alreadySelected = this.state.selectedCell
            && this.state.selectedCell.row === row
            && this.state.selectedCell.col === col
            && this.state.awaitingPlacementConfirm;

        if (alreadySelected) {
            return;
        }

        this.clearPreview();
        this.state.selectedCell = { row, col };
        this.state.awaitingPlacementConfirm = true;
        this.sound.play('select');
        this.render();
        this.showMessageKey('selectedMoveConfirm', { move: formatMove(row, col) });
    }

    confirmSelectedPlacement() {
        if (!this.state.awaitingPlacementConfirm || !this.state.selectedCell) {
            this.sound.play('error');
            this.showMessageKey('selectPointFirstConfirm');
            return;
        }

        const { row, col } = this.state.selectedCell;
        const error = this.validateMove(row, col, this.state.currentPlayer);
        if (error) {
            this.sound.play('error');
            showMessage(this.dom, error, 'error');
            return;
        }

        this.commitMove(row, col, this.state.currentPlayer, { source: 'human' });
    }

    cancelSelectedPlacement() {
        if (!this.state.awaitingPlacementConfirm) {
            return;
        }

        this.clearPlacementSelection();
        this.render();
    }

    clearPlacementSelection(clearMessage = true) {
        this.state.selectedCell = null;
        this.state.awaitingPlacementConfirm = false;

        if (clearMessage) {
            this.showMessageKey('selectionCanceledMessage');
        }
    }

    canHumanMove() {
        if (!this.isAIMode()) {
            return true;
        }

        return !this.state.aiThinking && this.state.currentPlayer === this.options.playerColor;
    }

    getForbiddenReason(row, col, color) {
        return getForbiddenReason(
            this.state.board,
            this.options.size,
            this.options.rule,
            row,
            col,
            color
        );
    }

    clearCoachState({ preserveFeedback = false } = {}) {
        this.cancelLlmCoachRequest();
        this.state.coachSuggestion = null;
        this.state.coachAlternatives = [];
        this.state.coachSource = 'local';
        const configStatus = getLlmCoachConfigStatus(this.llmSettings);
        this.state.coachLlmStatus = configStatus === 'ready' ? 'local' : configStatus;
        this.state.coachInsight = '';
        this.state.coachRisk = '';
        this.state.coachPlan = '';
        this.state.coachConfidence = null;
        this.state.coachFocus = null;
        if (!preserveFeedback) {
            this.state.coachFeedback = '';
        }
    }

    refreshCoachGuidance(announce = false) {
        if (!this.isGuidedMode()) {
            this.clearCoachState();
            this.render();
            return;
        }

        if (this.state.gameOver || this.state.currentPlayer !== this.options.playerColor || this.state.aiThinking) {
            this.clearCoachState({ preserveFeedback: true });
            this.render();
            return;
        }

        const suggestion = getMoveGuidance(this.state, this.state.currentPlayer);
        if (!suggestion) {
            this.clearCoachState({ preserveFeedback: true });
            this.render();
            return;
        }

        this.state.coachSuggestion = { row: suggestion.row, col: suggestion.col };
        this.state.coachAlternatives = this.normalizeLocalAlternatives(suggestion.alternatives || []);
        this.state.coachSource = 'local';
        const configStatus = getLlmCoachConfigStatus(this.llmSettings);
        this.state.coachLlmStatus = configStatus === 'ready' ? 'local' : configStatus;
        this.state.coachInsight = suggestion.insight;
        this.state.coachRisk = suggestion.risk;
        this.state.coachPlan = 'coachPlanLocal';
        this.state.coachConfidence = null;
        this.state.coachFocus = null;
        this.render();

        if (announce) {
            this.showMessageKey('coachSuggestedMessage', { move: formatMove(suggestion.row, suggestion.col) });
        }

        this.requestLlmCoachGuidance(suggestion);
    }

    normalizeLocalAlternatives(alternatives) {
        const seen = new Set();
        return alternatives
            .map((move) => this.normalizeCoachPoint(move, { reason: move.reason }))
            .filter((move) => {
                if (!move || !this.isLegalCoachMove(move.row, move.col)) {
                    return false;
                }

                const key = `${move.row},${move.col}`;
                if (seen.has(key)) {
                    return false;
                }

                seen.add(key);
                return true;
            })
            .slice(0, 3);
    }

    async requestLlmCoachGuidance(localSuggestion) {
        this.cancelLlmCoachRequest();
        const configStatus = getLlmCoachConfigStatus(this.llmSettings);
        this.state.coachLlmStatus = configStatus === 'ready' ? 'local' : configStatus;

        if (!isLlmCoachConfigured(this.llmSettings)) {
            this.render();
            return;
        }

        const requestId = ++this.llmCoachRequestId;
        const positionKey = this.getPositionKey();
        this.llmCoachAbortController = new AbortController();
        this.state.coachLlmStatus = 'loading';
        this.render();

        try {
            const rawAdvice = await requestLlmCoachAdvice({
                settings: this.llmSettings,
                snapshot: this.createLlmCoachSnapshot(localSuggestion),
                signal: this.llmCoachAbortController.signal
            });

            if (!this.isCurrentLlmCoachRequest(requestId, positionKey)) {
                return;
            }

            const advice = this.normalizeLlmAdvice(rawAdvice);
            if (!advice) {
                this.state.coachLlmStatus = 'unavailable';
                this.render();
                return;
            }

            this.state.coachSuggestion = advice.recommended;
            this.state.coachAlternatives = advice.alternatives;
            this.state.coachSource = 'llm';
            this.state.coachLlmStatus = 'ready';
            this.state.coachInsight = advice.reason || this.state.coachInsight;
            this.state.coachRisk = advice.risk || this.state.coachRisk;
            this.state.coachPlan = advice.plan || this.state.coachPlan;
            this.state.coachConfidence = advice.confidence;
            this.state.coachFocus = null;
            this.render();
        } catch (error) {
            if (error?.code === 'aborted' || !this.isCurrentLlmCoachRequest(requestId, positionKey)) {
                return;
            }

            this.state.coachLlmStatus = 'unavailable';
            this.render();
        } finally {
            if (this.llmCoachAbortController?.signal.aborted || requestId === this.llmCoachRequestId) {
                this.llmCoachAbortController = null;
            }
        }
    }

    cancelLlmCoachRequest() {
        this.llmCoachRequestId += 1;
        if (this.llmCoachAbortController) {
            this.llmCoachAbortController.abort();
            this.llmCoachAbortController = null;
        }
    }

    isCurrentLlmCoachRequest(requestId, positionKey) {
        return requestId === this.llmCoachRequestId
            && positionKey === this.getPositionKey()
            && this.isGuidedMode()
            && this.canHumanMove()
            && !this.state.gameOver;
    }

    createLlmCoachSnapshot(localSuggestion) {
        return {
            boardSize: this.options.size,
            rule: this.options.rule,
            currentPlayer: this.state.currentPlayer,
            playerColor: this.options.playerColor,
            moveCount: this.state.moveHistory.length,
            lastMove: this.state.lastMove ? {
                row: this.state.lastMove.row,
                col: this.state.lastMove.col,
                color: this.state.lastMove.color,
                notation: formatMove(this.state.lastMove.row, this.state.lastMove.col)
            } : null,
            moveHistory: this.state.moveHistory.map((move) => ({
                index: move.index,
                row: move.row,
                col: move.col,
                color: move.color,
                notation: formatMove(move.row, move.col)
            })),
            localRecommendation: localSuggestion ? {
                row: localSuggestion.row,
                col: localSuggestion.col,
                notation: formatMove(localSuggestion.row, localSuggestion.col),
                reason: localSuggestion.insight,
                risk: localSuggestion.risk
            } : null,
            board: this.state.board.map((row) => [...row]),
            coordinateSystem: '0-based row and col; row increases downward; col increases to the right'
        };
    }

    normalizeLlmAdvice(rawAdvice) {
        const recommended = this.normalizeCoachPoint(rawAdvice?.recommended);
        if (!recommended || !this.isLegalCoachMove(recommended.row, recommended.col)) {
            return null;
        }

        const seen = new Set([`${recommended.row},${recommended.col}`]);
        const alternatives = Array.isArray(rawAdvice?.alternatives)
            ? rawAdvice.alternatives
                .map((move) => this.normalizeCoachPoint(move, { reason: move.reason }))
                .filter((move) => {
                    if (!move || !this.isLegalCoachMove(move.row, move.col)) {
                        return false;
                    }

                    const key = `${move.row},${move.col}`;
                    if (seen.has(key)) {
                        return false;
                    }

                    seen.add(key);
                    return true;
                })
                .slice(0, 3)
            : [];

        return {
            recommended,
            alternatives,
            reason: this.normalizeCoachText(rawAdvice?.reason),
            risk: this.normalizeCoachText(rawAdvice?.risk),
            plan: this.normalizeCoachText(rawAdvice?.plan),
            confidence: this.normalizeConfidence(rawAdvice?.confidence)
        };
    }

    normalizeCoachPoint(point, extra = {}) {
        const row = Number(point?.row);
        const col = Number(point?.col);
        if (!Number.isInteger(row) || !Number.isInteger(col)) {
            return null;
        }

        return {
            row,
            col,
            ...extra
        };
    }

    normalizeCoachText(text) {
        const normalized = String(text ?? '').trim();
        return normalized.length > 420 ? `${normalized.slice(0, 417)}...` : normalized;
    }

    normalizeConfidence(confidence) {
        const value = Number(confidence);
        if (!Number.isFinite(value)) {
            return null;
        }

        return Math.max(0, Math.min(1, value));
    }

    isLegalCoachMove(row, col) {
        return isInside(this.options.size, row, col)
            && !this.state.board[row][col]
            && !this.getForbiddenReason(row, col, this.state.currentPlayer);
    }

    getPositionKey() {
        return [
            this.options.mode,
            this.options.rule,
            this.options.size,
            this.options.playerColor,
            this.state.currentPlayer,
            this.state.moveHistory.map((move) => `${move.color}:${move.row},${move.col}`).join('|')
        ].join('::');
    }

    focusCoachCandidate(row, col) {
        if (!this.isGuidedMode() || !this.canHumanMove() || !this.isLegalCoachMove(row, col)) {
            this.sound.play('error');
            return;
        }

        this.state.coachFocus = { row, col };
        this.sound.play('select');
        this.render();
        this.showMessageKey('coachCandidateFocused', { move: formatMove(row, col) });
    }

    commitMove(row, col, color, { source = 'human' } = {}) {
        this.clearPreview();
        this.cancelLlmCoachRequest();
        const activeCoachSuggestion = this.state.coachSuggestion
            ? { ...this.state.coachSuggestion }
            : null;
        this.state.hintMove = null;
        this.state.selectedCell = null;
        this.state.awaitingPlacementConfirm = false;
        this.state.coachFocus = null;
        this.sound.play('move', { color, source });

        if (this.isGuidedMode() && source === 'human' && color === this.options.playerColor) {
            this.state.coachFeedback = activeCoachSuggestion
                && activeCoachSuggestion.row === row
                && activeCoachSuggestion.col === col
                ? 'coachReviewFollowed'
                : getMoveReview(this.state, row, col, color) || '';
        } else if (!this.isGuidedMode()) {
            this.clearCoachState();
        }

        this.state.board[row][col] = color;

        const move = {
            row,
            col,
            color,
            index: this.state.moveHistory.length + 1
        };

        this.state.moveHistory.push(move);
        this.state.lastMove = move;

        if (this.isGuidedMode() && source === 'human') {
            this.state.coachSuggestion = null;
            this.state.coachAlternatives = [];
            this.state.coachSource = 'local';
            const configStatus = getLlmCoachConfigStatus(this.llmSettings);
            this.state.coachLlmStatus = configStatus === 'ready' ? 'local' : configStatus;
            this.state.coachInsight = '';
            this.state.coachRisk = '';
            this.state.coachPlan = '';
            this.state.coachConfidence = null;
        }

        this.render({ animateLastMove: true });

        if (this.use3D && this.renderer3d) {
            this.renderer3d.playMoveSequence(row, col, source === 'ai' ? 'ai' : 'human');
        }

        const winningLine = getWinningLine(this.state.board, this.options.size, row, col, color);
        if (winningLine.length > 0) {
            this.state.gameOver = true;
            this.state.winningCells = winningLine;
            this.state.resultType = 'win';
            this.state.resultWinnerColor = color;
            this.state.resultSummary = this.createResultSummary('win', color);
            updateStatus(this.dom, this.state);
            showResultOverlay(this.dom, this.state.resultSummary);
            this.sound.play('win');
            this.showMessageKey('playerWinsMessage', { player: getPlayerLabel(color) }, 'success');
            this.setAIThinking(false);

            if (this.use3D && this.renderer3d) {
                this.renderer3d.playVictorySequence(winningLine);
            }

            this.render();
            return;
        }

        if (isBoardFull(this.state.board)) {
            this.state.gameOver = true;
            this.state.resultType = 'draw';
            this.state.resultWinnerColor = null;
            this.state.resultSummary = this.createResultSummary('draw');
            updateStatus(this.dom, this.state);
            showResultOverlay(this.dom, this.state.resultSummary);
            this.sound.play('draw');
            this.showMessageKey('boardFullDrawMessage');
            this.setAIThinking(false);
            this.render();
            return;
        }

        this.state.currentPlayer = getOpponent(color);
        updateStatus(this.dom, this.state);

        if (this.isGuidedMode() && this.state.currentPlayer === this.options.playerColor) {
            this.refreshCoachGuidance();
        } else {
            this.render();
        }

        if (this.isAIMode() && this.state.currentPlayer !== this.options.playerColor) {
            this.scheduleAIMove();
            return;
        }

        this.showMessageKey('playerTurnMessage', { player: getPlayerLabel(this.state.currentPlayer) });
    }

    scheduleAIMove() {
        this.clearPendingAI();
        this.setAIThinking(true);
        this.clearPreview();
        this.state.selectedCell = null;
        this.state.awaitingPlacementConfirm = false;
        if (this.isGuidedMode()) {
            this.clearCoachState({ preserveFeedback: true });
            this.render();
        }

        this.showMessageKey('aiThinkingMessage');

        this.aiTimer = window.setTimeout(() => {
            this.aiTimer = null;

            if (this.state.gameOver || this.state.currentPlayer === this.options.playerColor) {
                this.setAIThinking(false);
                return;
            }

            const aiMove = getBestMove(this.state, this.state.currentPlayer);
            this.setAIThinking(false);

            if (!aiMove) {
                this.state.gameOver = true;
                updateStatus(this.dom, this.state);
                this.showMessageKey('aiNoMoveMessage');
                this.render();
                return;
            }

            this.commitMove(aiMove.row, aiMove.col, this.state.currentPlayer, { source: 'ai' });
            if (!this.state.gameOver) {
                this.showMessageKey('aiPlayedMessage', { move: formatMove(aiMove.row, aiMove.col) });
            }
        }, getAIDelay(this.options.level));
    }

    undo() {
        if (this.state.moveHistory.length === 0) {
            this.sound.play('error');
            this.showMessageKey('nothingToUndo');
            return;
        }

        this.sound.play('undo');
        this.clearPendingAI();
        this.clearPreview();
        this.clearPlacementSelection(false);

        let steps = 1;
        if (this.isAIMode() && this.state.moveHistory.length > 1) {
            steps = Math.min(2, this.state.moveHistory.length);
        }

        for (let index = 0; index < steps; index += 1) {
            const move = this.state.moveHistory.pop();
            if (move) {
                this.state.board[move.row][move.col] = null;
            }
        }

        this.state.lastMove = this.state.moveHistory[this.state.moveHistory.length - 1] || null;
        this.state.currentPlayer = this.state.lastMove ? getOpponent(this.state.lastMove.color) : 'black';
        this.state.gameOver = false;
        this.state.hintMove = null;
        this.state.winningCells = [];
        this.state.resultSummary = null;
        this.state.resultType = null;
        this.state.resultWinnerColor = null;
        this.clearCoachState();
        hideResultOverlay(this.dom);

        const restoredWhiteAiOpening = this.isAIMode()
            && this.options.playerColor === 'white'
            && this.state.moveHistory.length === 0;

        if (restoredWhiteAiOpening) {
            this.enterSetup();
            this.showMessageKey('undoneMoves', { count: steps });
            return;
        }

        this.render();

        if (this.isGuidedMode() && this.canHumanMove()) {
            this.refreshCoachGuidance();
        }

        this.showMessageKey('undoneMoves', { count: steps });

        if (this.isAIMode() && this.state.currentPlayer !== this.options.playerColor) {
            this.scheduleAIMove();
        }
    }

    showHint() {
        if (this.state.gameOver) {
            this.sound.play('error');
            this.showMessageKey('noHintNeededGameOver');
            return;
        }

        if (this.isAIMode() && this.state.currentPlayer !== this.options.playerColor) {
            this.sound.play('error');
            this.showMessageKey('noHintDuringAiTurn');
            return;
        }

        if (this.isGuidedMode()) {
            this.sound.play('hint');
            this.refreshCoachGuidance(true);
            return;
        }

        const move = getBestMove(this.state, this.state.currentPlayer);
        if (!move) {
            this.sound.play('error');
            this.showMessageKey('noHintAvailable');
            return;
        }

        this.state.hintMove = { row: move.row, col: move.col };
        this.sound.play('hint');
        this.render();
        this.showMessageKey('hintSuggestionMessage', { move: formatMove(move.row, move.col) });
    }

    swapSides() {
        if (this.state.moveHistory.length > 0) {
            this.sound.play('error');
            this.showMessageKey('swapOnlyBeforeOpening');
            return;
        }

        this.sound.play('uiTap');
        if (this.isAIMode()) {
            this.options.playerColor = getOpponent(this.options.playerColor);
            this.state.currentPlayer = 'black';
            this.state.hintMove = null;
            this.clearCoachState();
            this.clearPlacementSelection(false);
            setActiveByValue(this.dom.optionGroups.playerColor, 'color', this.options.playerColor);
            this.render();

            if (this.options.playerColor === 'white') {
                this.showMessageKey('swappedToWhiteAiFirst');
                this.scheduleAIMove();
                return;
            }

            this.clearPendingAI();
            if (this.isGuidedMode()) {
                this.refreshCoachGuidance();
            }
            this.showMessageKey('swappedToBlack');
            return;
        }

        this.state.currentPlayer = getOpponent(this.state.currentPlayer);
        this.render();
        this.showMessageKey('swappedFirstPlayer', { player: getPlayerLabel(this.state.currentPlayer) });
    }

    restart() {
        this.clearPendingAI();
        this.cancelLlmCoachRequest();
        this.createFreshState();
        updateMeta(this.dom, this.options);

        if (this.use3D && this.renderer3d) {
            this.renderer3d.setBoardSize(this.options.size);
            this.renderer3d.setInteractionEnabled(true);
            this.renderer3d.playGameStartSequence();
        }

        this.render();
        this.showMessageKey('gameRestartedMessage');

        if (this.isAIMode() && this.options.playerColor === 'white') {
            this.scheduleAIMove();
            return;
        }

        if (this.isGuidedMode()) {
            this.refreshCoachGuidance();
        }
    }

    resign() {
        if (this.state.gameOver) {
            this.sound.play('error');
            this.showMessageKey('gameAlreadyEnded');
            return;
        }

        this.clearPendingAI();
        this.clearPreview();
        this.clearPlacementSelection(false);
        this.state.gameOver = true;
        const winner = getOpponent(this.state.currentPlayer);
        this.state.resultType = 'resign';
        this.state.resultWinnerColor = winner;
        this.state.resultSummary = this.createResultSummary('resign', winner);
        this.render();
        showResultOverlay(this.dom, this.state.resultSummary);
        this.sound.play('resign');
        this.showMessageKey('resignWinMessage', {
            loser: getPlayerLabel(this.state.currentPlayer),
            winner: getPlayerLabel(winner)
        }, 'success');
    }

    showPreview(cell) {
        if (this.use3D || this.isTouchPlacementFlow()) return;

        if (this.state.gameOver || !this.canHumanMove()) {
            this.clearPreview();
            return;
        }

        const row = Number(cell.dataset.row);
        const col = Number(cell.dataset.col);
        if (this.state.board[row][col]) {
            this.clearPreview();
            return;
        }

        if (this.options.rule === 'renju' && this.state.currentPlayer === 'black' && this.getForbiddenReason(row, col, 'black')) {
            this.clearPreview();
            return;
        }

        if (this.previewCell === cell) {
            return;
        }

        this.clearPreview();

        const stone = document.createElement('div');
        stone.className = `stone ${this.state.currentPlayer} preview`;
        cell.appendChild(stone);
        this.previewCell = cell;
    }

    showPreview3D(row, col) {
        if (!this.use3D || !this.renderer3d || this.isTouchPlacementFlow()) return;

        if (this.state.gameOver || !this.canHumanMove()) {
            this.clearPreview();
            return;
        }

        if (this.state.board[row][col]) {
            this.clearPreview();
            return;
        }

        if (this.options.rule === 'renju' && this.state.currentPlayer === 'black' && this.getForbiddenReason(row, col, 'black')) {
            this.clearPreview();
            return;
        }

        this.renderer3d.showPreview(this.state.currentPlayer, row, col);
    }

    clearPreview() {
        if (!this.use3D && this.previewCell) {
            const preview = this.previewCell.querySelector('.stone.preview');
            if (preview) {
                preview.remove();
            }
            this.previewCell = null;
        }

        if (this.use3D && this.renderer3d) {
            this.renderer3d.hidePreview();
        }
    }

    /**
     * 触摸设备上高亮格子（不显示预览棋子）
     */
    highlightCell(cell) {
        if (this.state.gameOver || !this.canHumanMove()) {
            return;
        }

        const row = Number(cell.dataset.row);
        const col = Number(cell.dataset.col);
        if (this.state.board[row][col]) {
            return;
        }

        if (this.options.rule === 'renju' && this.state.currentPlayer === 'black' && this.getForbiddenReason(row, col, 'black')) {
            return;
        }

        // 添加临时高亮类
        cell.classList.add('cell-touch-highlight');
    }

    /**
     * 清除触摸高亮
     */
    clearCellHighlight() {
        const highlighted = this.dom.board.querySelector('.cell-touch-highlight');
        if (highlighted) {
            highlighted.classList.remove('cell-touch-highlight');
        }
    }

    setAIThinking(isThinking) {
        this.state.aiThinking = isThinking;
        setAIThinking(this.dom, isThinking);
        this.syncSceneExperience();
    }

    clearPendingAI() {
        if (this.aiTimer !== null) {
            window.clearTimeout(this.aiTimer);
            this.aiTimer = null;
        }

        this.setAIThinking(false);
    }

    render(options = {}) {
        // 保存当前触摸高亮的格子位置，以便在重新渲染后恢复
        const highlightedCell = this.dom.board.querySelector('.cell-touch-highlight');
        const highlightPos = highlightedCell
            ? { row: Number(highlightedCell.dataset.row), col: Number(highlightedCell.dataset.col) }
            : null;

        if (this.use3D && this.renderer3d) {
            this.renderer3d.renderBoard(this.state.board, {
                lastMove: this.state.lastMove,
                winningCells: this.state.winningCells,
                hintMove: this.state.hintMove,
                coachSuggestion: this.state.coachSuggestion,
                coachFocus: this.state.coachFocus,
                selectedCell: this.state.selectedCell,
                animateLastMove: options.animateLastMove ?? false,
            });
        } else {
            renderBoard(this.dom, this.state);
        }

        // 恢复触摸高亮
        if (highlightPos && !this.state.gameOver && this.canHumanMove()) {
            const cell = this.dom.board.querySelector(
                `.cell[data-row="${highlightPos.row}"][data-col="${highlightPos.col}"]`
            );
            if (cell && !this.state.board[highlightPos.row][highlightPos.col]) {
                cell.classList.add('cell-touch-highlight');
            }
        }

        updateMeta(this.dom, this.options);
        updateStatus(this.dom, this.state);
        updateMoveList(this.dom, this.state.moveHistory);
        updateGuidance(this.dom, this.state, this.options);
        updatePlacementPanel(this.dom, this.state);
        this.syncSceneExperience();
        this.refreshImmersiveUi();
    }

    createResultSummary(type, winnerColor = null) {
        const isEnglish = i18n.getLanguage() === 'en';
        const lastMoveText = this.state.lastMove
            ? `${getPlayerLabel(this.state.lastMove.color)} ${formatMove(this.state.lastMove.row, this.state.lastMove.col)}`
            : '-';

        if (type === 'draw' && isEnglish) {
            return {
                badge: 'Draw',
                title: 'The board is full and the game is balanced',
                detail: 'No fatal break appeared in this round. It is a good game to review the midgame rhythm and key defensive points.',
                moves: this.state.moveHistory.length,
                lastMove: lastMoveText,
                variant: 'result-draw'
            };
        }

        if (type === 'draw') {
            return {
                badge: '平局',
                title: '棋盘已满，双方打成均势',
                detail: '这一局没有出现致命破绽，适合回看中盘节奏与关键防点。',
                moves: this.state.moveHistory.length,
                lastMove: lastMoveText,
                variant: 'result-draw'
            };
        }

        if (type === 'resign' && isEnglish) {
            return {
                badge: 'Resignation',
                title: `${getPlayerLabel(winnerColor)} takes over the game`,
                detail: 'The position has already tilted. Resignation closes this round cleanly and you can launch the next one immediately.',
                moves: this.state.moveHistory.length,
                lastMove: lastMoveText,
                variant: 'result-resign'
            };
        }

        if (type === 'resign') {
            return {
                badge: '认输结束',
                title: `${getPlayerLabel(winnerColor)} 接管胜势`,
                detail: '局面已经倾斜，认输为这盘对局画上句点。可以直接再开一局继续。 ',
                moves: this.state.moveHistory.length,
                lastMove: lastMoveText,
                variant: 'result-resign'
            };
        }

        if (isEnglish) {
            return {
                badge: 'Five in a Row',
                title: `${getPlayerLabel(winnerColor)} completes the winning line`,
                detail: 'The decisive connection is formed and the initiative fully converts on this move.',
                moves: this.state.moveHistory.length,
                lastMove: lastMoveText,
                variant: 'result-win'
            };
        }

        return {
            badge: '连五制胜',
            title: `${getPlayerLabel(winnerColor)} 完成致胜连线`,
            detail: '关键连线已经形成，攻守转换在这一手彻底落定。',
            moves: this.state.moveHistory.length,
            lastMove: lastMoveText,
            variant: 'result-win'
        };
    }

    resetCamera() {
        if (!this.renderer3d) {
            return;
        }

        this.renderer3d.resetCamera();
    }

    dispose() {
        this.clearPendingAI();
        this.cancelLlmCoachRequest();
        this.llmTestAbortController?.abort();
        this.clearPreview();

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

        if (window.gomokuApp === this) {
            delete window.gomokuApp;
        }
        delete window.render_game_to_text;
        delete window.advanceTime;
    }
}
