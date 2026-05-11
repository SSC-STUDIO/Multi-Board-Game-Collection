/**
 * 设置控制器：管理界面选项、帮助系统、LLM 设置、首屏引导与沉浸式 UI。
 * @module app/controllers/SettingsController
 */

import { i18n } from '../../utils/i18n.js';
import { setActiveButton, setActiveByValue } from '../../ui/dom.js';
import {
    syncSetupPanel,
    updateMeta,
    updateStatus,
    updateMoveList,
    updateGuidance,
    updatePlacementPanel,
    showResultOverlay
} from '../../ui/render.js';
import {
    getLlmCoachConfigStatus,
    isLlmCoachConfigured,
    normalizeLlmCoachSettings,
    saveLlmCoachSettings,
    testLlmCoachConnection
} from '../../services/llmCoach.js';
import { getSceneAmbienceCue } from '../../config/sceneConfig.js';

const IMMERSIVE_UI_STORAGE_KEY = 'gomoku-immersive-ui';
const FIRST_RUN_GUIDE_STORAGE_KEY = 'gomoku-first-run-guide';

/**
 * 设置面板控制器。
 * 负责设置面板、帮助系统、LLM 教练配置、持久化偏好与场景展示同步。
 */
export class SettingsController {
    /**
     * @param {import('../GomokuApp.js').GomokuApp} app - 应用主实例
     */
    constructor(app) {
        this.app = app;
    }

    // === Help ===

    /**
     * 同步帮助面板的显示状态、ARIA 属性与 body 类名。
     * @returns {void}
     */
    syncHelpUi() {
        const { dom, helpOpen } = this.app;
        const overlay = dom.help.overlay;
        const openButton = dom.help.open;
        if (overlay) {
            overlay.classList.toggle('hidden', !helpOpen);
            overlay.setAttribute('aria-hidden', helpOpen ? 'false' : 'true');
        }
        if (openButton) {
            openButton.setAttribute('aria-expanded', helpOpen ? 'true' : 'false');
        }
        document.body.classList.toggle('help-open', helpOpen);
    }

    /**
     * 打开帮助面板并重置滚动位置。
     * @returns {void}
     */
    openHelp() {
        this.app.helpOpen = true;
        if (this.app.dom.help.sheet) {
            this.app.dom.help.sheet.scrollTop = 0;
            this.app.dom.help.sheet.scrollLeft = 0;
        }
        this.syncHelpUi();
    }

    /**
     * 关闭帮助面板。
     * @returns {void}
     */
    closeHelp() {
        this.app.helpOpen = false;
        this.syncHelpUi();
    }

    // === LLM Settings ===

    /**
     * 打开 LLM 设置面板并将当前设置同步到表单。
     * @returns {void}
     */
    openLlmSettings() {
        this.app.llmSettingsOpen = true;
        this.syncLlmSettingsForm();
        this.syncLlmSettingsUi();
        window.setTimeout(() => {
            this.app.dom.llmSettings.baseUrl?.focus();
        }, 0);
    }

    /**
     * 关闭 LLM 设置面板。
     * @returns {void}
     */
    closeLlmSettings() {
        if (!this.app.llmSettingsOpen) return;
        this.app.llmSettingsOpen = false;
        this.syncLlmSettingsUi();
    }

    /**
     * 同步 LLM 设置面板的可见性与辅助属性。
     * @returns {void}
     */
    syncLlmSettingsUi() {
        const overlay = this.app.dom.llmSettings.overlay;
        if (!overlay) return;
        overlay.classList.toggle('hidden', !this.app.llmSettingsOpen);
        overlay.setAttribute('aria-hidden', this.app.llmSettingsOpen ? 'false' : 'true');
        document.body.classList.toggle('llm-settings-open', this.app.llmSettingsOpen);
        this.app.dom.controls.setupLlmSettings?.setAttribute('aria-expanded', this.app.llmSettingsOpen ? 'true' : 'false');
        this.app.dom.guidance.settings?.setAttribute('aria-expanded', this.app.llmSettingsOpen ? 'true' : 'false');
    }

    /**
     * 将内存中的 LLM 设置值写回表单字段。
     * @returns {void}
     */
    syncLlmSettingsForm() {
        const fields = this.app.dom.llmSettings;
        if (!fields.enabled) return;
        fields.enabled.checked = Boolean(this.app.llmSettings.enabled);
        fields.baseUrl.value = this.app.llmSettings.baseUrl || '';
        fields.model.value = this.app.llmSettings.model || '';
        fields.apiKey.value = this.app.llmSettings.apiKey || '';
        fields.status.textContent = '';
        fields.status.className = 'llm-test-status';
    }

    /**
     * 从表单读取并规范化 LLM 设置。
     * @returns {{ enabled: boolean, baseUrl: string, model: string, apiKey: string }} 规范化后的设置对象
     */
    readLlmSettingsForm() {
        const fields = this.app.dom.llmSettings;
        return normalizeLlmCoachSettings({
            enabled: fields.enabled?.checked,
            baseUrl: fields.baseUrl?.value,
            model: fields.model?.value,
            apiKey: fields.apiKey?.value
        });
    }

    /**
     * 保存表单中的 LLM 设置，并同步当前对局中的教练状态。
     * @returns {void}
     */
    saveLlmSettingsFromForm() {
        this.app.sound.play('uiTap');
        this.app.llmSettings = saveLlmCoachSettings(this.readLlmSettingsForm());
        this.setLlmSettingsStatus(i18n.t('llmSettingsSaved'), 'success');
        if (this.app.isGuidedMode() && this.app.canHumanMove()) {
            this.app.refreshCoachGuidance(false);
        } else {
            const configStatus = getLlmCoachConfigStatus(this.app.llmSettings);
            this.app.state.coachLlmStatus = configStatus === 'ready' ? 'local' : configStatus;
            this.app.render();
        }
        this.app.showMessageKey('llmSettingsSaved');
    }

    /**
     * 测试当前表单中的 LLM 连接配置。
     * @returns {Promise<void>}
     */
    async testLlmSettingsFromForm() {
        const settings = this.readLlmSettingsForm();
        if (!isLlmCoachConfigured(settings)) {
            this.app.sound.play('error');
            this.setLlmSettingsStatus(i18n.t('llmConfigIncomplete'), 'error');
            return;
        }
        this.app.sound.play('uiTap');
        this.app.llmTestAbortController?.abort();
        this.app.llmTestAbortController = new AbortController();
        this.setLlmSettingsStatus(i18n.t('llmTesting'), 'pending');
        if (this.app.dom.llmSettings.test) this.app.dom.llmSettings.test.disabled = true;
        try {
            await testLlmCoachConnection(settings, { signal: this.app.llmTestAbortController.signal });
            this.setLlmSettingsStatus(i18n.t('llmTestOk'), 'success');
        } catch (error) {
            if (error?.code !== 'aborted') {
                this.setLlmSettingsStatus(`${i18n.t('llmTestFailed')} ${error?.message || ''}`.trim(), 'error');
            }
        } finally {
            if (this.app.dom.llmSettings.test) this.app.dom.llmSettings.test.disabled = false;
            this.app.llmTestAbortController = null;
        }
    }

    /**
     * 清空 API Key 字段并持久化。
     * @returns {void}
     */
    clearLlmApiKey() {
        if (this.app.dom.llmSettings.apiKey) this.app.dom.llmSettings.apiKey.value = '';
        this.app.llmSettings = saveLlmCoachSettings({ ...this.readLlmSettingsForm(), apiKey: '' });
        this.app.sound.play('uiTap');
        this.setLlmSettingsStatus(i18n.t('llmKeyCleared'), 'success');
        if (this.app.isGuidedMode()) {
            const configStatus = getLlmCoachConfigStatus(this.app.llmSettings);
            this.app.state.coachLlmStatus = configStatus === 'ready' ? 'local' : configStatus;
            this.app.render();
        }
    }

    /**
     * 设置 LLM 设置面板中的状态文案与状态样式。
     * @param {string} text - 要显示的状态文案
     * @param {string} [variant=''] - 状态样式变体
     * @returns {void}
     */
    setLlmSettingsStatus(text, variant = '') {
        const status = this.app.dom.llmSettings.status;
        if (!status) return;
        status.textContent = text;
        status.className = `llm-test-status ${variant ? `llm-test-status-${variant}` : ''}`.trim();
    }

    // === First-Run Guide ===

    /**
     * 在首次访问设备上显示新手引导卡片。
     * @returns {void}
     */
    showFirstRunGuideIfNeeded() {
        if (this.app.firstRunGuideSeen || !this.app.dom.firstRunGuide.card) return;
        this.app.firstRunGuideOpen = true;
        this.app.dom.firstRunGuide.card.classList.remove('hidden');
        this.app.dom.firstRunGuide.card.setAttribute('aria-hidden', 'false');
        document.body.classList.add('first-run-guide-open');
    }

    /**
     * 关闭新手引导，并记录用户已经看过该引导。
     * @returns {void}
     */
    dismissFirstRunGuide() {
        if (!this.app.firstRunGuideOpen) return;
        this.app.firstRunGuideSeen = true;
        this.app.firstRunGuideOpen = false;
        this.persistFirstRunGuideSeen();
        this.app.dom.firstRunGuide.card?.classList.add('hidden');
        this.app.dom.firstRunGuide.card?.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('first-run-guide-open');
    }

    // === Storage ===

    /**
     * 读取首次引导是否已展示过的持久化标记。
     * @returns {boolean} 是否已看过首次引导
     */
    loadFirstRunGuideSeen() {
        try {
            return window.localStorage?.getItem(FIRST_RUN_GUIDE_STORAGE_KEY) === '1';
        } catch {
            return false;
        }
    }

    /**
     * 持久化首次引导已查看状态。
     * @returns {void}
     */
    persistFirstRunGuideSeen() {
        try {
            window.localStorage?.setItem(FIRST_RUN_GUIDE_STORAGE_KEY, '1');
        } catch { /* ignore */ }
    }

    /**
     * 读取沉浸式 HUD 偏好；未存储时默认启用。
     * @returns {boolean} 是否启用沉浸式 HUD
     */
    loadImmersiveUiPreference() {
        try {
            const saved = window.localStorage?.getItem(IMMERSIVE_UI_STORAGE_KEY);
            if (saved === null) return true;
            return saved === '1';
        } catch {
            return true;
        }
    }

    /**
     * 持久化沉浸式 HUD 偏好。
     * @returns {void}
     */
    persistImmersiveUiPreference() {
        try {
            window.localStorage?.setItem(IMMERSIVE_UI_STORAGE_KEY, this.app.immersiveUiEnabled ? '1' : '0');
        } catch { /* ignore */ }
    }

    // === Setup Panel ===

    /**
     * 刷新声音切换按钮的文本、样式和辅助属性。
     * @returns {void}
     */
    refreshSoundToggle() {
        const button = this.app.dom.controls.soundToggle;
        if (!button) return;
        const enabled = this.app.sound.isEnabled();
        const label = i18n.t(enabled ? 'soundOn' : 'soundOff');
        this.setButtonLabel(button, label);
        button.classList.toggle('control-btn-secondary', enabled);
        button.classList.toggle('is-muted', !enabled);
        button.classList.toggle('is-sound-off', !enabled);
        button.setAttribute('aria-label', label);
        button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    }

    /**
     * 更新按钮主文案；若存在专用 label 节点则优先写入该节点。
     * @param {HTMLElement|null|undefined} button - 目标按钮
     * @param {string} text - 按钮文案
     * @returns {void}
     */
    setButtonLabel(button, text) {
        const label = button?.querySelector('[data-role="button-label"]');
        if (label) {
            label.textContent = text;
            return;
        }
        if (button) button.textContent = text;
    }

    /**
     * 处理语言切换后的整体验证与视图刷新。
     * @returns {void}
     */
    handleLanguageChange() {
        this.app.refreshSetup();
        this.refreshSoundToggle();
        this.app.refreshImmersiveToggle();
        this.syncHelpUi();
        if (!this.app.dom.sections.game.classList.contains('hidden')) {
            this.app.render();
        } else {
            updateMeta(this.app.dom, this.app.options);
            updateStatus(this.app.dom, this.app.state);
            updateMoveList(this.app.dom, this.app.state.moveHistory);
            updateGuidance(this.app.dom, this.app.state, this.app.options);
            updatePlacementPanel(this.app.dom, this.app.state);
        }
        if (this.app.state.resultType && !this.app.dom.result.overlay.classList.contains('hidden')) {
            this.app.state.resultSummary = this.app.createResultSummary(this.app.state.resultType, this.app.state.resultWinnerColor);
            showResultOverlay(this.app.dom, this.app.state.resultSummary);
        }
    }

    /**
     * 刷新设置面板、场景表现和 3D 棋盘尺寸。
     * @param {{ animateScene?: boolean }} [options={}] - 是否播放场景切换动画
     * @returns {void}
     */
    refreshSetup({ animateScene = false } = {}) {
        syncSetupPanel(this.app.dom, this.app.options);
        this.app.applyScenePresentation({ animate: animateScene });
        this.app.syncSceneExperience({ animateCamera: animateScene });
        if (this.app.renderer3d) {
            this.app.renderer3d.setBoardSize(this.app.options.size);
            if (this.app.dom.sections.game.classList.contains('hidden')) {
                this.app.renderer3d.setInteractionEnabled(false);
                this.app.renderer3d.fitToBoard(this.app.options.size, false);
            }
        }
    }

    /**
     * 应用当前场景对应的 body 状态与 3D 场景预设。
     * @param {{ animate?: boolean }} [options={}] - 是否播放场景切换动画
     * @returns {void}
     */
    applyScenePresentation({ animate = false } = {}) {
        document.body.dataset.scene = this.app.options.scene;
        if (animate) {
            document.body.classList.add('scene-switching');
            if (this.app.sceneSwitchTimer) window.clearTimeout(this.app.sceneSwitchTimer);
            this.app.sceneSwitchTimer = window.setTimeout(() => {
                document.body.classList.remove('scene-switching');
                this.app.sceneSwitchTimer = null;
            }, 480);
        }
        if (this.app.renderer3d) {
            this.app.renderer3d.setScenePreset(this.app.options.scene, { animate });
        }
    }

    /**
     * 同步当前 UI 展示态对应的镜头模式与环境音景。
     * @param {{ animateCamera?: boolean }} [options={}] - 是否播放镜头切换动画
     * @returns {void}
     */
    syncSceneExperience({ animateCamera = false } = {}) {
        const presentationMode = this.app.dom.sections.game.classList.contains('hidden') ? 'setup' : 'game';
        document.body.dataset.uiPresentation = presentationMode;
        if (this.app.renderer3d) {
            this.app.renderer3d.setPresentationMode(presentationMode, { animate: animateCamera });
        }
        this.app.currentAmbientCue = getSceneAmbienceCue(this.app.options.scene, presentationMode, {
            aiThinking: this.app.state.aiThinking,
            gameOver: this.app.state.gameOver
        });
        this.app.sound.setAmbience(this.app.currentAmbientCue);
    }

    /**
     * 为选项按钮组绑定点击委托，并在选择后调用回调。
     * @param {HTMLElement|null} group - 选项组容器
     * @param {string} dataAttribute - 读取按钮值时使用的 data 属性名
     * @param {(value: string) => void} onSelect - 选择回调
     * @returns {void}
     */
    bindOptionGroup(group, dataAttribute, onSelect) {
        if (!group) {
            console.warn(`bindOptionGroup: group is null for attribute "${dataAttribute}"`);
            return;
        }
        group.addEventListener('click', (event) => {
            const button = event.target.closest('.option-btn');
            if (!button) return;
            this.app.sound.play('uiTap');
            setActiveButton(group, button);
            onSelect(button.dataset[dataAttribute]);
        });
    }
}
