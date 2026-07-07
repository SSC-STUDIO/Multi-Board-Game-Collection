/**
 * 棋类游戏公共基类。
 *
 * 封装所有子游戏（Go/Chess/Xiangqi/Junqi）共享的生命周期骨架：
 * - Launcher 桥接（__reenter / enterSetupQuiet / dispose）
 * - 面板切换（enterSetup / showRoot / hideRoot）
 * - 选项组绑定（bindOptionGroup）
 * - 消息 toast（showMessage）
 * - 结果覆盖层（showResult / hideResult）
 * - AI 调度（maybeScheduleAI / scheduleAIMove / clearAITimer）
 * - 音效管理（SoundManager 实例化 + dispose）
 *
 * 子类需要实现的 hook（抽象方法）：
 * - queryDom(root) → 返回 { root, setup, game, result } DOM 引用
 * - createInitialState() → 返回初始 state
 * - bindSetupEvents() → 绑定 setup 面板事件
 * - bindGameEvents() → 绑定 game 面板事件
 * - startGameImpl() → 开始游戏的具体逻辑
 * - renderBoard() → 渲染棋盘
 * - renderStatus() → 渲染 HUD 状态
 * - getAIMove() → 返回 AI 走法（或 null）
 * - getAIDelay() → 返回 AI 延迟 ms
 * - commitMove(move) → 执行走法
 * - checkGameEnd() → 检查胜负
 * - isHumanTurn() → 当前是否人类回合
 * - formatResult() → 返回 { badge, title, detail } 用于 showResult
 *
 * @module app/BoardGameApp
 */

import { i18n } from '../utils/i18n.js';
import { SoundManager } from '../audio/SoundManager.js';

export class BoardGameApp {
    /**
     * @param {Document|HTMLElement} root
     * @param {Object} [options] - 子类传入的初始选项
     */
    constructor(root = document, options = {}) {
        this.sound = new SoundManager();
        this.aiTimer = null;
        this.messageTimer = null;
        this.selected = null;
        this.highlightMoves = [];
        this.options = options;
        this.state = null;
        this._renderGameToText = null;
        this._advanceTime = null;
        this.dom = this.queryDom(root);
        this.bindSetupEvents();
        this.bindGameEvents();
        this.enterSetup();
    }

    // === Abstract hooks (子类必须实现) ===

    queryDom(_root) { return { root: null, setup: {}, game: {}, result: {} }; }
    createInitialState() { return {}; }
    bindSetupEvents() {}
    bindGameEvents() {}
    startGameImpl() {}
    renderBoard() {}
    renderStatus() {}
    getAIMove() { return null; }
    getAIDelay() { return 500; }
    commitMove(_move) {}
    checkGameEnd() {}
    isHumanTurn() { return true; }
    formatResult() { return { badge: '', title: '', detail: '' }; }
    refreshSetupVisibility() {}

    // === Launcher bridges ===

    __reenter() {
        this.exposeTestHooks();
        this.enterSetup();
    }
    enterSetupQuiet() {
        this.exposeTestHooks();
        this.enterSetup();
    }


    renderPostGamePanel(panel, contentEl, data) {
        if (!panel || !contentEl || !data) return;
        panel.classList.remove('hidden');
        const sections = [];
        if (data.summary) sections.push(`<p><strong>${i18n.t('coachPostGameSummary') || 'Summary'}:</strong> ${data.summary}</p>`);
        if (data.turningPoints) sections.push(`<p><strong>${i18n.t('coachPostGameTurningPoints') || 'Turning Points'}:</strong> ${data.turningPoints}</p>`);
        if (data.mistakes) sections.push(`<p><strong>${i18n.t('coachPostGameMistakes') || 'Mistakes'}:</strong> ${data.mistakes}</p>`);
        if (data.strengths) sections.push(`<p><strong>${i18n.t('coachPostGameStrengths') || 'Strengths'}:</strong> ${data.strengths}</p>`);
        if (data.improvements) sections.push(`<p><strong>${i18n.t('coachPostGameImprovements') || 'Improvements'}:</strong> ${data.improvements}</p>`);
        if (data.rating) sections.push(`<p class="rating"><strong>${i18n.t('coachPostGameRating') || 'Rating'}:</strong> ${data.rating}</p>`);
        contentEl.innerHTML = sections.join('');
    }

    // === Coaching (non-Gomoku games) ===

    isGuidedMode() {
        return this.options.mode === 'qi';
    }

    cancelLlmCoachRequest() {
        if (this.llmCoachAbortController) {
            this.llmCoachAbortController.abort();
            this.llmCoachAbortController = null;
        }
    }

    refreshCoachGuidance(_announce) {
        // Override in subclass or delegate to CoachController
    }

    clearCoachState(_opts) {
        // Override in subclass or delegate to CoachController
    }

    renderPostGameOverlay() {
        if (!this.dom || !this.dom.result || !this.dom.result.postgamePanel) return;
        var panel = this.dom.result.postgamePanel;
        var contentEl = this.dom.result.postgameContent;
        if (!panel || !contentEl) return;
        var status = this.state ? this.state.coachPostGame : null;
        if (status === 'ready' && this.state && this.state.coachPostGameData) {
            this.renderPostGamePanel(panel, contentEl, this.state.coachPostGameData);
        } else if (status === 'loading') {
            panel.classList.remove('hidden');
            contentEl.innerHTML = '<p>Loading post-game analysis...</p>';
        } else {
            panel.classList.add('hidden');
        }
    }

    dispose() {
        this.clearAITimer();
        this.sound?.dispose?.();
        this.hideRoot();
        if (window.render_game_to_text === this._renderGameToText) {
            delete window.render_game_to_text;
        }
        if (window.advanceTime === this._advanceTime) {
            delete window.advanceTime;
        }
        if (window.boardGameApp === this) {
            delete window.boardGameApp;
        }
    }

    // === Panel switching ===

    enterSetup() {
        this.clearAITimer();
        this.showRoot();
        this.dom.setup?.panel?.classList.remove('hidden');
        this.dom.game?.panel?.classList.add('hidden');
        this.hideResult();
        this.refreshSetupVisibility();
    }

    showRoot() {
        this.exposeTestHooks();
        this.dom.root?.classList.remove('hidden');
        document.body.classList.add('scene-game-active');
    }

    hideRoot() {
        this.dom.root?.classList.add('hidden');
        this.dom.setup?.panel?.classList.add('hidden');
        this.dom.game?.panel?.classList.add('hidden');
        this.hideResult();
    }

    // === Game lifecycle ===

    startGame() {
        this.clearAITimer();
        this.selected = null;
        this.highlightMoves = [];
        this.state = this.createInitialState();
        this.dom.setup?.panel?.classList.add('hidden');
        this.dom.game?.panel?.classList.remove('hidden');
        this.hideResult();
        this.startGameImpl();
        this.renderBoard();
        this.renderStatus();
    }

    restart() {
        this.startGame();
    }

    resign() {
        if (!this.state || this.state.gameOver) return;
        this.clearAITimer();
        this.state.gameOver = true;
        this.onResign();
        this.sound.play('resign');
        this.renderStatus();
        this.showResult();
    }

    onResign() {
        // 子类覆盖以设置 state.result
    }

    // === Option group binding ===

    bindOptionGroup(group, attr, onChange) {
        if (!group) return;
        group.addEventListener('click', (event) => {
            const btn = event.target.closest(`[data-${attr}]`);
            if (!btn) return;
            const value = btn.dataset[attr];
            group.querySelectorAll('.option-btn').forEach((b) => {
                const active = b === btn;
                b.classList.toggle('active', active);
                if (b.getAttribute('role') === 'radio') {
                    b.setAttribute('aria-checked', active ? 'true' : 'false');
                }
            });
            onChange(value);
        });
    }

    // === Message toast ===

    showMessage(text, type = 'info') {
        const el = this.dom.game?.message;
        if (!el) return;
        if (this.messageTimer !== null) {
            window.clearTimeout(this.messageTimer);
        }
        el.textContent = text;
        el.className = `message glass-panel ${type}`;
        el.classList.remove('hidden');
        this.messageTimer = window.setTimeout(() => {
            el.classList.add('hidden');
            this.messageTimer = null;
        }, 2400);
    }

    // === Result overlay ===

    showResult() {
        const { result } = this.dom;
        if (!result?.overlay || !this.state?.result) return;
        result.overlay.classList.remove('hidden');
        result.overlay.setAttribute('aria-hidden', 'false');
        const formatted = this.formatResult();
        if (result.badge) result.badge.textContent = formatted.badge || '';
        if (result.title) result.title.textContent = formatted.title || '';
        if (result.detail) result.detail.textContent = formatted.detail || '';
        this.postFormatResult(formatted);
    }

    /** 子类可覆盖以填充非标准 result DOM（如 Go 的 blackScore/whiteScore）。 */
    postFormatResult(_formatted) {}

    hideResult() {
        const { result } = this.dom;
        result?.overlay?.classList.add('hidden');
        result?.overlay?.setAttribute('aria-hidden', 'true');
    }

    // === AI scheduling ===

    maybeScheduleAI() {
        if (!this.state || this.state.gameOver) return;
        if (this.options.mode !== 'pve') return;
        if (this.isHumanTurn()) return;
        this.scheduleAIMove();
    }

    scheduleAIMove() {
        this.clearAITimer();
        if (this.state) this.state.aiThinking = true;
        this.renderStatus();
        const delay = this.getAIDelay();
        this.aiTimer = window.setTimeout(() => {
            this.aiTimer = null;
            if (this.state) this.state.aiThinking = false;
            const mv = this.getAIMove();
            if (!mv) {
                this.checkGameEnd();
                this.renderStatus();
                return;
            }
            this.commitMove(mv);
        }, delay);
    }

    clearAITimer() {
        if (this.aiTimer !== null) {
            window.clearTimeout(this.aiTimer);
            this.aiTimer = null;
        }
        if (this.state) this.state.aiThinking = false;
    }

    // === Utility ===

    bindBackToLauncher(btn) {
        btn?.addEventListener('click', () => {
            this.sound.play('uiTap');
            window.__returnToLauncher?.();
        });
    }

    getDebugState() {
        const screen = this.dom.game?.panel?.classList?.contains?.('hidden') ? 'setup' : 'game';
        const moveHistory = Array.isArray(this.state?.moveHistory) ? this.state.moveHistory : [];
        const board = this.state?.board;
        return {
            screen,
            game: this.constructor.name.replace(/App$/, '').toLowerCase(),
            coordinateSystem: 'origin top-left; rows increase downward; columns increase to the right',
            mode: this.options?.mode ?? null,
            variant: this.variant ?? null,
            boardSize: this.options?.size ?? board?.length ?? null,
            viewMode: this.viewMode ?? (this.use3D ? '3d' : '2d'),
            use3D: Boolean(this.use3D ?? this.viewMode === '3d'),
            renderer3d: Boolean(this.renderer3d),
            currentPlayer: this.state?.currentPlayer ?? this.state?.turn ?? null,
            playerColor: this.options?.playerColor ?? null,
            moveCount: moveHistory.length,
            lastMove: moveHistory[moveHistory.length - 1] ?? this.state?.lastMove ?? null,
            selected: this.selected,
            highlightedMoves: Array.isArray(this.highlightMoves) ? this.highlightMoves.length : 0,
            aiThinking: Boolean(this.state?.aiThinking),
            gameOver: Boolean(this.state?.gameOver),
            result: this.state?.result ?? null
        };
    }

    exposeTestHooks() {
        this._renderGameToText = () => JSON.stringify(this.getDebugState());
        this._advanceTime = (ms = 16) => new Promise((resolve) => {
            window.setTimeout(() => resolve(this.getDebugState()), ms);
        });
        window.boardGameApp = this;
        window.render_game_to_text = this._renderGameToText;
        window.advanceTime = this._advanceTime;
    }
}
