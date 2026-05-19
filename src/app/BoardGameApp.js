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

    __reenter() { this.enterSetup(); }
    enterSetupQuiet() { this.enterSetup(); }

    dispose() {
        this.clearAITimer();
        this.sound?.dispose?.();
        this.hideRoot();
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
}
