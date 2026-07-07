/** 交互控制器：管理棋盘点击、落子前选择流程、预览和高亮 @module app/controllers/InteractionManager */

import { getForbiddenReason as getForbidden } from '../../games/gomoku/rules.js';
import { i18n } from '../../utils/i18n.js';
import { isInside } from '../../utils/board.js';
import { formatMove } from '../../utils/formatters.js';
import { showMessage as showMessageUI } from '../../ui/render.js';

/**
 * 交互控制器
 * 处理棋盘的鼠标/触摸交互，包括格子点击、落子前选择确认流程、
 * 悬停预览、触摸高亮和全局键盘事件
 */
export class InteractionManager {
    /**
     * @param {import('../GomokuApp.js').GomokuApp} app - 应用主实例
     */
    constructor(app) {
        this.app = app;
    }

    /**
     * 是否为 AI 对战模式（PvE 或 QI）
     * @returns {boolean} 是否为 AI 模式
     */
    isAIMode() {
        return this.app.options.mode === 'pve' || this.app.options.mode === 'qi';
    }

    /**
     * 是否为 QI 指导模式（含教练建议）
     * @returns {boolean} 是否为 QI 模式
     */
    isGuidedMode() {
        return this.app.options.mode === 'qi';
    }

    /**
     * 是否为触摸设备落子前确认流程
     * @returns {boolean} 是否使用触摸确认流程
     */
    isTouchPlacementFlow() {
        const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
        const hoverless = window.matchMedia?.('(hover: none)').matches ?? false;
        return coarsePointer || hoverless;
    }

    /**
     * 当前玩家是否可以落子（非 AI 模式时总是可落子）
     * @returns {boolean} 玩家是否可以落子
     */
    canHumanMove() {
        if (!this.isAIMode()) return true;
        return !this.app.state.aiThinking && this.app.state.currentPlayer === this.app.options.playerColor;
    }

    /**
     * 获取禁手原因（委派给 rules.js）
     * @param {number} row - 行坐标
     * @param {number} col - 列坐标
     * @param {'black'|'white'} color - 棋子颜色
     * @returns {string} 禁手原因，空字符串表示无禁手
     */
    getForbiddenReason(row, col, color) {
        return getForbidden(
            this.app.state.board,
            this.app.options.size,
            this.app.options.rule,
            row, col, color
        );
    }

    /**
     * 处理棋盘格子点击：验证落子合法性，触摸设备走选择确认流程，其他设备直接落子
     * @param {number} row - 行坐标
     * @param {number} col - 列坐标
     */
    handleCellClick(row, col) {
        if (this.app.state.coachPreviewMode) {
            this.app.coach?.togglePreviewCell?.(row, col);
            return;
        }
        if (this.app.state.gameOver) {
            this.app.sound.play('error');
            this.app.showMessageKey('gameAlreadyEndedReturn');
            return;
        }
        if (!this.canHumanMove()) {
            this.app.sound.play('error');
            this.app.showMessageKey('aiTurnWait');
            return;
        }
        const error = this.app.validateMove(row, col, this.app.state.currentPlayer);
        if (error) {
            this.app.sound.play('error');
            showMessageUI(this.app.dom, error, 'error');
            return;
        }
        if (this.isTouchPlacementFlow()) {
            this.selectCellForPlacement(row, col);
            return;
        }
        this.app.commitMove(row, col, this.app.state.currentPlayer, { source: 'human' });
    }

    /**
     * 验证落子合法性（是否被占、是否禁手）
     * @param {number} row - 行坐标
     * @param {number} col - 列坐标
     * @param {'black'|'white'} color - 棋子颜色
     * @returns {string} 错误信息，空字符串表示合法
     */
    validateMove(row, col, color) {
        if (this.app.state.board[row][col]) {
            return i18n.t('cellOccupied');
        }
        return this.getForbiddenReason(row, col, color);
    }

    /**
     * 选择格子进入落子确认流程（触摸设备使用）
     * @param {number} row - 行坐标
     * @param {number} col - 列坐标
     */
    selectCellForPlacement(row, col) {
        const alreadySelected = this.app.state.selectedCell
            && this.app.state.selectedCell.row === row
            && this.app.state.selectedCell.col === col
            && this.app.state.awaitingPlacementConfirm;
        if (alreadySelected) return;

        this.clearPreview();
        this.app.state.selectedCell = { row, col };
        this.app.state.awaitingPlacementConfirm = true;
        this.app.sound.play('select');
        this.app.render();
        this.app.showMessageKey('selectedMoveConfirm', { move: formatMove(row, col) });
    }

    /** 确认当前选中的落子位置并执行落子 */
    confirmSelectedPlacement() {
        if (!this.app.state.awaitingPlacementConfirm || !this.app.state.selectedCell) {
            this.app.sound.play('error');
            this.app.showMessageKey('selectPointFirstConfirm');
            return;
        }
        const { row, col } = this.app.state.selectedCell;
        const error = this.app.validateMove(row, col, this.app.state.currentPlayer);
        if (error) {
            this.app.sound.play('error');
            showMessageUI(this.app.dom, error, 'error');
            return;
        }
        this.app.commitMove(row, col, this.app.state.currentPlayer, { source: 'human' });
    }

    /** 取消当前落子选择 */
    cancelSelectedPlacement() {
        if (!this.app.state.awaitingPlacementConfirm) return;
        this.clearPlacementSelection();
        this.app.render();
    }

    /**
     * 清除落子选择状态
     * @param {boolean} [clearMessage=true] - 是否显示取消消息
     */
    clearPlacementSelection(clearMessage = true) {
        this.app.state.selectedCell = null;
        this.app.state.awaitingPlacementConfirm = false;
        if (clearMessage) {
            this.app.showMessageKey('selectionCanceledMessage');
        }
    }

    /**
     * 显示 2D 悬停预览棋子
     * @param {HTMLElement} cell - 棋盘格子 DOM 元素
     */
    showPreview(cell) {
        if (this.app.use3D || this.isTouchPlacementFlow()) return;
        if (this.app.state.gameOver || !this.canHumanMove()) {
            this.clearPreview();
            return;
        }
        const row = Number(cell.dataset.row);
        const col = Number(cell.dataset.col);
        if (this.app.state.board[row][col]) {
            this.clearPreview();
            return;
        }
        if (this.app.options.rule === 'renju' && this.app.state.currentPlayer === 'black' && this.getForbiddenReason(row, col, 'black')) {
            this.clearPreview();
            return;
        }
        if (this.app.previewCell === cell) return;
        this.clearPreview();
        const stone = document.createElement('div');
        stone.className = `stone ${this.app.state.currentPlayer} preview`;
        cell.appendChild(stone);
        this.app.previewCell = cell;
    }

    /**
     * 显示 3D 悬停预览棋子
     * @param {number} row - 行坐标
     * @param {number} col - 列坐标
     */
    showPreview3D(row, col) {
        if (!this.app.use3D || !this.app.renderer3d || this.isTouchPlacementFlow()) return;
        if (this.app.state.gameOver || !this.canHumanMove()) {
            this.clearPreview();
            return;
        }
        if (this.app.state.board[row][col]) {
            this.clearPreview();
            return;
        }
        if (this.app.options.rule === 'renju' && this.app.state.currentPlayer === 'black' && this.getForbiddenReason(row, col, 'black')) {
            this.clearPreview();
            return;
        }
        this.app.renderer3d.showPreview(this.app.state.currentPlayer, row, col);
    }

    /** 清除所有预览（2D 和 3D） */
    clearPreview() {
        if (!this.app.use3D && this.app.previewCell) {
            const preview = this.app.previewCell.querySelector('.stone.preview');
            if (preview) preview.remove();
            this.app.previewCell = null;
        }
        if (this.app.use3D && this.app.renderer3d) {
            this.app.renderer3d.hidePreview();
        }
    }

    /**
     * 高亮触摸悬停的格子（移动端使用）
     * @param {HTMLElement} cell - 棋盘格子 DOM 元素
     */
    highlightCell(cell) {
        if (this.app.state.gameOver || !this.canHumanMove()) return;
        const row = Number(cell.dataset.row);
        const col = Number(cell.dataset.col);
        if (this.app.state.board[row][col]) return;
        if (this.app.options.rule === 'renju' && this.app.state.currentPlayer === 'black' && this.getForbiddenReason(row, col, 'black')) return;
        cell.classList.add('cell-touch-highlight');
    }

    /** 清除触摸高亮 */
    clearCellHighlight() {
        const highlighted = this.app.dom.board.querySelector('.cell-touch-highlight');
        if (highlighted) highlighted.classList.remove('cell-touch-highlight');
    }

    /**
     * 处理全局键盘事件：Escape 关闭覆盖层，方向键导航选项按钮
     * @param {KeyboardEvent} event - 键盘事件对象
     */
    /**
     * Initialize keyboard cursor at center of the board
     */
    initKeyboardCursor() {
        const size = this.app.options.size || 15;
        this.keyboardCursor = { row: Math.floor(size / 2), col: Math.floor(size / 2) };
        this.updateKeyboardCursorVisual();
    }

    /**
     * Update the visual cursor indicator on the board
     */
    updateKeyboardCursorVisual() {
        const board = this.app.dom.board;
        if (!board) return;
        const existing = board.querySelector('.cell-keyboard-cursor');
        if (existing) existing.classList.remove('cell-keyboard-cursor');
        if (!this.keyboardCursor) return;
        const cell = board.querySelector(
            `[data-row="${this.keyboardCursor.row}"][data-col="${this.keyboardCursor.col}"]`
        );
        if (cell) cell.classList.add('cell-keyboard-cursor');
    }

    /**
     * Move keyboard cursor in a direction
     * @param {number} dr - row delta (-1, 0, 1)
     * @param {number} dc - col delta (-1, 0, 1)
     */
    moveKeyboardCursor(dr, dc) {
        if (!this.keyboardCursor) this.initKeyboardCursor();
        const size = this.app.options.size || 15;
        const newRow = Math.max(0, Math.min(size - 1, this.keyboardCursor.row + dr));
        const newCol = Math.max(0, Math.min(size - 1, this.keyboardCursor.col + dc));
        this.keyboardCursor.row = newRow;
        this.keyboardCursor.col = newCol;
        this.updateKeyboardCursorVisual();
    }

    /**
     * Confirm keyboard selection: place piece at cursor position
     */
    confirmKeyboardSelection() {
        if (!this.keyboardCursor) return;
        this.handleCellClick(this.keyboardCursor.row, this.keyboardCursor.col);
    }

    /**
     * Clear keyboard cursor visual
     */
    clearKeyboardCursor() {
        const board = this.app.dom.board;
        if (!board) return;
        const existing = board.querySelector('.cell-keyboard-cursor');
        if (existing) existing.classList.remove('cell-keyboard-cursor');
        this.keyboardCursor = null;
    }

    handleGlobalKeydown(event) {
        // Arrow keys: board cursor navigation
        if (!this.app.state.gameOver && !event.ctrlKey && !event.altKey && !event.metaKey) {
            if (event.key === 'ArrowUp') { event.preventDefault(); this.moveKeyboardCursor(-1, 0); return; }
            if (event.key === 'ArrowDown') { event.preventDefault(); this.moveKeyboardCursor(1, 0); return; }
            if (event.key === 'ArrowLeft') { event.preventDefault(); this.moveKeyboardCursor(0, -1); return; }
            if (event.key === 'ArrowRight') { event.preventDefault(); this.moveKeyboardCursor(0, 1); return; }
            if (event.key === 'Enter' || event.key === ' ') {
                const focused = document.activeElement;
                if (!focused || focused === document.body || focused === this.app.dom.board) {
                    event.preventDefault();
                    this.confirmKeyboardSelection();
                    return;
                }
            }
        }

        // Escape key: close open overlays
        if (event.key === 'Escape') {
            if (this.app.llmSettingsOpen) {
                this.app.closeLlmSettings();
                return;
            }
            if (this.app.helpOpen) {
                this.app.closeHelp();
                return;
            }
            if (this.app.firstRunGuideOpen) {
                this.app.dismissFirstRunGuide();
                return;
            }
            if (this.keyboardCursor) {
                this.clearKeyboardCursor();
                return;
            }
        }

        // Arrow keys: navigate within radio groups (option button rows)
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft' || event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            const focused = document.activeElement;
            if (!focused || !focused.matches('[role="radio"]')) return;

            const group = focused.closest('[role="radiogroup"]');
            if (!group) return;

            const radios = Array.from(group.querySelectorAll('[role="radio"]'));
            const currentIndex = radios.indexOf(focused);
            if (currentIndex === -1) return;

            const isNext = (event.key === 'ArrowRight' || event.key === 'ArrowDown');
            event.preventDefault();

            const nextIndex = isNext
                ? (currentIndex + 1) % radios.length
                : (currentIndex - 1 + radios.length) % radios.length;

            radios[nextIndex].focus();
            radios[nextIndex].click();
        }

        // Enter/Space: activate focused option buttons (handled natively for <button>)
        // Tab: handled natively by the browser for focus navigation
    }
}
