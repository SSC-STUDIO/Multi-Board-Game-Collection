import { i18n } from '../utils/i18n.js';

/**
 * DOM 引用与基础 UI 辅助方法。
 * @module ui/dom
 */

/**
 * 获取页面中所有关键 DOM 元素的引用
 * @param {Document|HTMLElement} [root=document] - 查询根元素
 * @returns {Object} 按功能分组的 DOM 元素映射
 */
export function getDOMReferences(root = document) {
    return {
        overlay: root.querySelector('.ui-overlay'),
        sections: {
            setup: root.getElementById('setup'),
            game: root.getElementById('game')
        },
        scene3d: root.getElementById('scene-3d'),
        board: root.getElementById('board'),
        boardShell: root.getElementById('board-shell'),
        boardPreviewOverlay: root.getElementById('board-preview-overlay'),
        message: root.getElementById('message'),
        moveList: root.getElementById('move-list'),
        aiThinking: root.getElementById('ai-thinking'),
        setupGroups: {
            ai: root.getElementById('ai-options'),
            color: root.getElementById('color-options'),
            llm: root.getElementById('llm-options')
        },
        setupScene: {
            card: root.getElementById('setup-scene-preview'),
            image: root.getElementById('setup-scene-image'),
            mood: root.getElementById('setup-scene-mood'),
            ambience: root.getElementById('setup-scene-ambience'),
            copy: root.getElementById('setup-scene-copy')
        },
        hud: {
            top: root.querySelector('.hud-top'),
            left: root.querySelector('.hud-left'),
            right: root.querySelector('.hud-right'),
            bottom: root.querySelector('.hud-bottom'),
            langSwitch: root.querySelector('.lang-switch'),
            immersiveCard: root.getElementById('immersive-ui-card')
        },
        help: {
            open: root.getElementById('help-open-btn'),
            overlay: root.getElementById('help-overlay'),
            sheet: root.querySelector('.help-sheet'),
            close: root.getElementById('help-close-btn')
        },
        firstRunGuide: {
            card: root.getElementById('first-run-guide'),
            dismiss: root.getElementById('guide-dismiss-btn'),
            details: root.getElementById('guide-help-btn')
        },
        optionGroups: {
            mode: root.getElementById('mode-options'),
            rule: root.getElementById('rule-options'),
            size: root.getElementById('size-options'),
            scene: root.getElementById('scene-options'),
            level: root.getElementById('difficulty-options'),
            playerColor: root.getElementById('color-select')
        },
        meta: {
            mode: root.getElementById('meta-mode'),
            rule: root.getElementById('meta-rule'),
            size: root.getElementById('meta-size'),
            scene: root.getElementById('meta-scene')
        },
        stage: {
            phasePill: root.getElementById('phase-pill'),
            title: root.getElementById('stage-title'),
            subtitle: root.getElementById('stage-subtitle'),
            turnSpotlight: root.getElementById('turn-spotlight'),
            turnSpotlightText: root.getElementById('turn-spotlight-text'),
            momentumText: root.getElementById('momentum-text'),
            momentumNote: root.getElementById('momentum-note')
        },
        status: {
            currentPlayer: root.getElementById('current-player'),
            moveCount: root.getElementById('move-count'),
            lastMove: root.getElementById('last-move'),
            boardPhase: root.getElementById('board-phase')
        },
        controls: {
            start: root.getElementById('start-btn'),
            back: root.getElementById('back-btn'),
            undo: root.getElementById('undo-btn'),
            hint: root.getElementById('hint-btn'),
            swap: root.getElementById('swap-btn'),
            restart: root.getElementById('restart-btn'),
            resign: root.getElementById('resign-btn'),
            viewReset: root.getElementById('view-reset-btn'),
            soundToggle: root.getElementById('sound-toggle-btn'),
            immersiveToggle: root.getElementById('immersive-ui-btn'),
            placementConfirm: root.getElementById('placement-confirm-btn'),
            selectionCancel: root.getElementById('selection-cancel-btn'),
            setupLlmSettings: root.getElementById('setup-llm-settings-btn'),
            setupBackToLauncher: root.getElementById('setup-back-to-launcher-btn')
        },
        guidance: {
            card: root.getElementById('coach-card'),
            source: root.getElementById('coach-source'),
            status: root.getElementById('coach-status'),
            move: root.getElementById('coach-move'),
            insight: root.getElementById('coach-insight'),
            risk: root.getElementById('coach-risk'),
            alternativesWrap: root.getElementById('coach-alternatives-wrap'),
            alternatives: root.getElementById('coach-alternatives'),
            planWrap: root.getElementById('coach-plan-wrap'),
            plan: root.getElementById('coach-plan'),
            confidenceWrap: root.getElementById('coach-confidence-wrap'),
            confidence: root.getElementById('coach-confidence'),
            feedbackWrap: root.getElementById('coach-feedback-wrap'),
            feedback: root.getElementById('coach-feedback'),
            rerun: root.getElementById('coach-rerun-btn'),
            settings: root.getElementById('coach-llm-settings-btn'),
            upload: root.getElementById('coach-upload-btn'),
            imageInput: root.getElementById('coach-image-input'),
            importWrap: root.getElementById('coach-import-wrap'),
            importBtn: root.getElementById('coach-import-btn'),
            editBtn: root.getElementById('coach-edit-btn'),
            analyzeImage: root.getElementById('coach-analyze-image'),
            analyzeCount: root.getElementById('coach-analyze-count'),
            analyzeConfidence: root.getElementById('coach-analyze-confidence'),
            previewHint: root.getElementById('coach-preview-hint'),
            previewCommit: root.getElementById('coach-preview-commit'),
            previewCancel: root.getElementById('coach-preview-cancel'),
            previewActions: root.getElementById('coach-preview-actions')
        },
        llmSettings: {
            overlay: root.getElementById('llm-settings-overlay'),
            panel: root.getElementById('llm-settings-panel'),
            close: root.getElementById('llm-settings-close-btn'),
            enabled: root.getElementById('llm-enabled-input'),
            baseUrl: root.getElementById('llm-base-url-input'),
            model: root.getElementById('llm-model-input'),
            apiKey: root.getElementById('llm-api-key-input'),
            save: root.getElementById('llm-save-btn'),
            test: root.getElementById('llm-test-btn'),
            clearKey: root.getElementById('llm-clear-key-btn'),
            status: root.getElementById('llm-test-status')
        },
        placement: {
            panel: root.getElementById('placement-panel'),
            move: root.getElementById('selected-move'),
            prompt: root.getElementById('placement-prompt')
        },
        result: {
            overlay: root.getElementById('result-overlay'),
            badge: root.getElementById('result-badge'),
            title: root.getElementById('result-title'),
            detail: root.getElementById('result-detail'),
            moves: root.getElementById('result-moves'),
            lastMove: root.getElementById('result-last-move'),
            restart: root.getElementById('result-restart-btn'),
            setup: root.getElementById('result-setup-btn')
        },
        lang: {
            zh: root.getElementById('lang-zh'),
            en: root.getElementById('lang-en')
        }
    };
}

/**
 * 设置选项组中的激活按钮
 * @param {HTMLElement} group - 选项按钮容器
 * @param {HTMLElement} activeButton - 当前激活的按钮元素
 * @returns {void}
 */
export function setActiveButton(group, activeButton) {
    group.querySelectorAll('.option-btn').forEach((button) => {
        const isActive = button === activeButton;
        button.classList.toggle('active', isActive);
        // Sync ARIA checked state for radio buttons
        if (button.getAttribute('role') === 'radio') {
            button.setAttribute('aria-checked', isActive ? 'true' : 'false');
        }
    });
}

/**
 * 通过 data 属性值设置选项组中的激活按钮
 * @param {HTMLElement} group - 选项按钮容器
 * @param {string} attribute - data 属性名（不含 data- 前缀）
 * @param {string} value - 要匹配的属性值
 * @returns {void}
 */
export function setActiveByValue(group, attribute, value) {
    const button = group?.querySelector(`[data-${attribute}="${value}"]`);
    if (button) {
        setActiveButton(group, button);
    }
}

/**
 * 设置语言切换按钮的事件监听与状态同步
 * @param {Object} dom - DOM 元素引用集合
 * @param {Function} [onChange=null] - 语言切换后的回调函数
 * @returns {void}
 */
export function setupLanguageSwitch(dom, onChange = null) {
    const sync = () => {
        const lang = i18n.getLanguage();
        dom.lang.zh.classList.toggle('active', lang === 'zh');
        dom.lang.en.classList.toggle('active', lang === 'en');
        i18n.updateDOM();
        if (onChange) {
            onChange(lang);
        }
    };

    dom.lang.zh.addEventListener('click', () => {
        i18n.setLanguage('zh');
    });

    dom.lang.en.addEventListener('click', () => {
        i18n.setLanguage('en');
    });

    i18n.onChange(sync);
    sync();
}
