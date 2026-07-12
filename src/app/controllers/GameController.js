/**
 * 游戏控制器：管理游戏生命周期、落子逻辑与 AI 调度。
 * @module app/controllers/GameController
 */

import { getAIDelay, getBestMove, getMoveGuidance, getMoveReview } from '../../games/gomoku/ai.js';
import { getForbiddenReason as getForbidden, getWinningLine } from '../../games/gomoku/rules.js';
import { createGameState } from '../../games/gomoku/state.js';
import {
    hideResultOverlay,
    renderBoard,
    setAIThinking as setAIThinkingUI,
    showGame,
    showMessage as showMessageUI,
    showResultOverlay,
    updateBoardPreviewOverlay,
    updateGuidance,
    updateMeta,
    updateMoveList,
    updatePlacementPanel,
    updateStatus,
    showSetup
} from '../../ui/render.js';
import { setActiveByValue } from '../../ui/dom.js';
import { i18n } from '../../utils/i18n.js';
import { formatMove, getPlayerLabel } from '../../utils/formatters.js';
import { getOpponent, isBoardFull, isInside } from '../../utils/board.js';
import { getSceneAmbienceCue } from '../../config/sceneConfig.js';
import { getLlmCoachConfigStatus, isLlmCoachConfigured } from '../../services/llmCoach.js';
import { getMoveCommentary, isCommentaryAvailable, clearCommentaryCache } from '../../services/aiCommentary.js';

/**
 * 游戏流程控制器。
 * 负责开始对局、提交落子、处理结果、协调 AI/教练状态，并驱动主视图刷新。
 */
export class GameController {
    /**
     * @param {import('../GomokuApp.js').GomokuApp} app - 应用主实例
     */
    constructor(app) {
        this.app = app;
    }

    // === Game Lifecycle ===

    /**
     * 创建一份新的空白游戏状态，并关闭结果覆盖层。
     * @returns {void}
     */
    createFreshState() {
        clearCommentaryCache();
        this.app.state = createGameState(this.app.options);
        hideResultOverlay(this.app.dom);
    }

    /**
     * 进入设置界面，清理运行中的局面状态并恢复设置态 3D 展示。
     * @returns {void}
     */
    enterSetup() {
        this.app.clearPendingAI();
        this.app.cancelLlmCoachRequest();
        this.app.clearPreview();
        this.app.clearPlacementSelection(false);
        showSetup(this.app.dom);
        this.app.setAIThinking(false);
        hideResultOverlay(this.app.dom);
        this.app.dom.message.classList.add('hidden');

        if (this.app.renderer3d) {
            this.app.renderer3d.setInteractionEnabled(false);
            this.app.renderer3d.setScenePreset(this.app.options.scene, { animate: false });
            this.app.renderer3d.setPresentationMode('setup', { animate: false });
            this.app.renderer3d.fitToBoard(this.app.options.size, false);
            this.app.renderer3d.playSetupStartSequence();
        }

        this.app.render();
        this.app.refreshImmersiveUi();
        document.body.classList.remove('guided-mode', 'awaiting-placement');
    }

    /**
     * 开始新对局，初始化棋局状态、切换界面并按模式触发首个 AI/教练动作。
     * @returns {void}
     */
    startGame() {
        this.app.clearPendingAI();
        this.app.cancelLlmCoachRequest();
        this.app.dismissFirstRunGuide();
        this.createFreshState();
        updateMeta(this.app.dom, this.app.options);

        if (this.app.use3D && this.app.renderer3d) {
            this.app.renderer3d.setBoardSize(this.app.options.size);
            this.app.renderer3d.setScenePreset(this.app.options.scene, { animate: false });
            this.app.renderer3d.setPresentationMode('game', { animate: false });
            this.app.renderer3d.setInteractionEnabled(true);
        }

        showGame(this.app.dom);
        this.playMatchEnterUI();
        this.app.refreshImmersiveUi();

        if (this.app.use3D && this.app.renderer3d) {
            setTimeout(() => {
                this.app.renderer3d.resize();
                this.app.renderer3d.fitToBoard(this.app.options.size, false);
                this.app.renderer3d.playGameStartSequence();
            }, 50);
        }

        this.app.render();
        showMessageUI(this.app.dom, this.getIntroMessage(), 'info');

        if (this.app.isAIMode() && this.app.options.playerColor === 'white') {
            this.scheduleAIMove();
            return;
        }

        if (this.app.isGuidedMode()) {
            this.app.refreshCoachGuidance();
        }
    }

    /**
     * 播放比赛入场过渡，并在过渡期间暂时关闭沉浸式 HUD 区域。
     * @returns {void}
     */
    playMatchEnterUI() {
        document.body.classList.add('match-entering');
        this.app.setImmersiveRegions({ top: false, left: false, right: false, bottom: false });
        if (this.app.matchEnterTimer) {
            window.clearTimeout(this.app.matchEnterTimer);
        }
        this.app.matchEnterTimer = window.setTimeout(() => {
            document.body.classList.remove('match-entering');
            this.app.matchEnterTimer = null;
            this.app.refreshImmersiveUi();
        }, 820);
    }

    /**
     * 获取当前游戏模式对应的开场提示文本。
     * @returns {string} 本地化开场消息
     */
    getIntroMessage() {
        if (this.app.options.mode === 'pvp') {
            return i18n.t('introPvp');
        }

        if (this.app.options.mode === 'practice') {
            return i18n.t('introPractice');
        }

        if (this.app.options.mode === 'pve') {
            return this.app.options.playerColor === 'black'
                ? i18n.t('introPveBlack')
                : i18n.t('introPveWhite');
        }

        if (this.app.options.mode === 'qi') {
            return this.app.options.playerColor === 'black'
                ? i18n.t('introQiBlack')
                : i18n.t('introQiWhite');
        }

        return i18n.t(`intro${this.app.options.mode.charAt(0).toUpperCase() + this.app.options.mode.slice(1)}`);
    }

    /**
     * 执行一次落子，并完成棋盘更新、结果判定、玩家切换与后续 AI/教练流转。
     * @param {number} row - 落子行坐标
     * @param {number} col - 落子列坐标
     * @param {'black'|'white'} color - 棋子颜色
     * @param {{ source?: 'human'|'ai' }} [options={}] - 落子来源标记
     * @returns {void}
     */
    commitMove(row, col, color, { source = 'human' } = {}) {
        try {
            this.app.clearPreview();
            this.app.cancelLlmCoachRequest();
            const activeCoachSuggestion = this.app.state.coachSuggestion
                ? { ...this.app.state.coachSuggestion }
                : null;
            this.app.state.hintMove = null;
            this.app.state.selectedCell = null;
            this.app.state.awaitingPlacementConfirm = false;
            this.app.state.coachFocus = null;
            this.app.sound.play('move', { color, source });

            if (this.app.isGuidedMode() && source === 'human' && color === this.app.options.playerColor) {
                this.app.state.coachFeedback = activeCoachSuggestion
                    && activeCoachSuggestion.row === row
                    && activeCoachSuggestion.col === col
                    ? 'coachReviewFollowed'
                    : getMoveReview(this.app.state, row, col, color) || '';
            } else if (!this.app.isGuidedMode()) {
                this.app.clearCoachState();
            }

            this.app.state.board[row][col] = color;

            const move = {
                row,
                col,
                color,
                index: this.app.state.moveHistory.length + 1
            };

            this.app.state.moveHistory.push(move);
            this.app.state.lastMove = move;

            if (this.app.isGuidedMode() && source === 'human') {
                this.app.state.coachSuggestion = null;
                this.app.state.coachAlternatives = [];
                this.app.state.coachSource = 'local';
                const configStatus = getLlmCoachConfigStatus(this.app.llmSettings);
                this.app.state.coachLlmStatus = configStatus === 'ready' ? 'local' : configStatus;
                this.app.state.coachInsight = '';
                this.app.state.coachRisk = '';
                this.app.state.coachPlan = '';
                this.app.state.coachConfidence = null;
            }

            this.app.render({ animateLastMove: true });

            if (this.app.use3D && this.app.renderer3d) {
                this.app.renderer3d.playMoveSequence(row, col, source === 'ai' ? 'ai' : 'human');
            }

            const winningLine = getWinningLine(this.app.state.board, this.app.options.size, row, col, color);
            if (winningLine.length > 0) {
                this.app.state.gameOver = true;
                this.app.state.winningCells = winningLine;
                this.app.state.resultType = 'win';
                this.app.state.resultWinnerColor = color;
                this.app.state.resultSummary = this.createResultSummary('win', color);
                updateStatus(this.app.dom, this.app.state);
                showResultOverlay(this.app.dom, this.app.state.resultSummary);
                this.app.sound.play('win');
                this.showMessageKey('playerWinsMessage', { player: getPlayerLabel(color) }, 'success');
                this.app.setAIThinking(false);

                if (this.app.use3D && this.app.renderer3d) {
                    this.app.renderer3d.playVictorySequence(winningLine);
                }

                this.app.render();
                return;
            }

            if (isBoardFull(this.app.state.board)) {
                this.app.state.gameOver = true;
                this.app.state.resultType = 'draw';
                this.app.state.resultWinnerColor = null;
                this.app.state.resultSummary = this.createResultSummary('draw');
                updateStatus(this.app.dom, this.app.state);
                showResultOverlay(this.app.dom, this.app.state.resultSummary);
                this.app.sound.play('draw');
                this.showMessageKey('boardFullDrawMessage');
                this.app.setAIThinking(false);
                this.app.render();
                return;
            }

            this.app.state.currentPlayer = getOpponent(color);
            updateStatus(this.app.dom, this.app.state);

            if (this.app.isGuidedMode() && this.app.state.currentPlayer === this.app.options.playerColor) {
                this.app.refreshCoachGuidance();
            } else {
                this.app.render();
            }

            // AI Commentary: request async move explanation
            if (isCommentaryAvailable(this.app.llmSettings) && !this.app.state.gameOver) {
                const gameType = this.app.options.gameType || 'gomoku';
                const commentarySnapshot = {
                    boardSize: this.app.options.size,
                    currentPlayer: this.app.state.currentPlayer,
                    moveHistory: this.app.state.moveHistory,
                    lastMove: move
                };
                getMoveCommentary({
                    settings: this.app.llmSettings,
                    snapshot: commentarySnapshot,
                    gameType
                }).then((text) => {
                    if (text && !this.app.state.gameOver) {
                        this.app.state.commentary = text;
                        this.app.render();
                    }
                }).catch(() => {});
            }

            if (this.app.isAIMode() && this.app.state.currentPlayer !== this.app.options.playerColor) {
                this.scheduleAIMove();
                return;
            }

            this.showMessageKey('playerTurnMessage', { player: getPlayerLabel(this.app.state.currentPlayer) });
        } catch (error) {
            console.error('Error in commitMove:', error);
            this.app.setAIThinking(false);
            this.app.render();
            this.showMessageKey('playerTurnMessage', { player: getPlayerLabel(this.app.state.currentPlayer) });
        }
    }

    // === AI ===

    /**
     * 调度 AI 落子：按难度延迟后调用 AI 引擎获取最佳下法。
     * @returns {void}
     */
    scheduleAIMove() {
        this.app.clearPendingAI();
        this.app.setAIThinking(true);
        this.app.clearPreview();
        this.app.state.selectedCell = null;
        this.app.state.awaitingPlacementConfirm = false;
        if (this.app.isGuidedMode()) {
            this.app.clearCoachState({ preserveFeedback: true });
            this.app.render();
        }

        this.showMessageKey('aiThinkingMessage');

        this.app.aiTimer = window.setTimeout(() => {
            this.app.aiTimer = null;

            if (this.app.state.gameOver || this.app.state.currentPlayer === this.app.options.playerColor) {
                this.app.setAIThinking(false);
                return;
            }

            try {
                const aiMove = getBestMove(this.app.state, this.app.state.currentPlayer);
                this.app.setAIThinking(false);

                if (!aiMove) {
                    this.app.state.gameOver = true;
                    updateStatus(this.app.dom, this.app.state);
                    this.showMessageKey('aiNoMoveMessage');
                    this.app.render();
                    return;
                }

                this.commitMove(aiMove.row, aiMove.col, this.app.state.currentPlayer, { source: 'ai' });
                if (!this.app.state.gameOver) {
                    this.showMessageKey('aiPlayedMessage', { move: formatMove(aiMove.row, aiMove.col) });
                }
            } catch (error) {
                console.error('Error in AI move:', error);
                this.app.setAIThinking(false);
                this.showMessageKey('aiNoMoveMessage');
            }
        }, getAIDelay(this.app.options.level));
    }

    // === Undo ===

    /**
     * 撤销最近一步或两步棋，并在需要时恢复 AI/教练状态。
     * @returns {void}
     */
    undo() {
        if (this.app.state.aiThinking) {
            this.app.sound.play('error');
            this.showMessageKey('noUndoDuringAiTurn');
            return;
        }
        if (this.app.state.gameOver) {
            this.app.sound.play('error');
            this.showMessageKey('gameAlreadyEnded');
            return;
        }
        if (this.app.state.moveHistory.length === 0) {
            this.app.sound.play('error');
            this.showMessageKey('nothingToUndo');
            return;
        }

        this.app.sound.play('undo');
        this.app.clearPendingAI();
        this.app.clearPreview();
        this.app.clearPlacementSelection(false);

        let steps = 1;
        if (this.app.isAIMode() && this.app.state.moveHistory.length > 1) {
            steps = Math.min(2, this.app.state.moveHistory.length);
        }

        for (let index = 0; index < steps; index += 1) {
            const move = this.app.state.moveHistory.pop();
            if (move) {
                this.app.state.board[move.row][move.col] = null;
            }
        }

        this.app.state.lastMove = this.app.state.moveHistory[this.app.state.moveHistory.length - 1] || null;
        this.app.state.currentPlayer = this.app.state.lastMove ? getOpponent(this.app.state.lastMove.color) : 'black';
        this.app.state.gameOver = false;
        this.app.state.hintMove = null;
        this.app.state.winningCells = [];
        this.app.state.resultSummary = null;
        this.app.state.resultType = null;
        this.app.state.resultWinnerColor = null;
        this.app.clearCoachState();
        hideResultOverlay(this.app.dom);

        const restoredWhiteAiOpening = this.app.isAIMode()
            && this.app.options.playerColor === 'white'
            && this.app.state.moveHistory.length === 0;

        if (restoredWhiteAiOpening) {
            this.enterSetup();
            this.showMessageKey('undoneMoves', { count: steps });
            return;
        }

        this.app.render();

        if (this.app.isGuidedMode() && this.app.canHumanMove()) {
            this.app.refreshCoachGuidance();
        }

        this.showMessageKey('undoneMoves', { count: steps });

        if (this.app.isAIMode() && this.app.state.currentPlayer !== this.app.options.playerColor) {
            this.scheduleAIMove();
        }
    }

    // === Hint ===

    /**
     * 显示当前推荐着法；QI 模式刷新教练建议，其余模式使用本地 AI。
     * @returns {void}
     */
    showHint() {
        if (this.app.state.gameOver) {
            this.app.sound.play('error');
            this.showMessageKey('noHintNeededGameOver');
            return;
        }

        if (this.app.isAIMode() && this.app.state.currentPlayer !== this.app.options.playerColor) {
            this.app.sound.play('error');
            this.showMessageKey('noHintDuringAiTurn');
            return;
        }

        if (this.app.isGuidedMode()) {
            this.app.sound.play('hint');
            this.app.refreshCoachGuidance(true);
            return;
        }

        const move = getBestMove(this.app.state, this.app.state.currentPlayer);
        if (!move) {
            this.app.sound.play('error');
            this.showMessageKey('noHintAvailable');
            return;
        }

        this.app.state.hintMove = { row: move.row, col: move.col };
        this.app.sound.play('hint');
        this.app.render();
        this.showMessageKey('hintSuggestionMessage', { move: formatMove(move.row, move.col) });
    }

    // === Game Lifecycle ===

    /**
     * 在开局前交换先后手或玩家执子颜色。
     * @returns {void}
     */
    swapSides() {
        if (this.app.state.moveHistory.length > 0) {
            this.app.sound.play('error');
            this.showMessageKey('swapOnlyBeforeOpening');
            return;
        }

        this.app.sound.play('uiTap');
        if (this.app.isAIMode()) {
            this.app.options.playerColor = getOpponent(this.app.options.playerColor);
            this.app.state.currentPlayer = 'black';
            this.app.state.hintMove = null;
            this.app.clearCoachState();
            this.app.clearPlacementSelection(false);
            setActiveByValue(this.app.dom.optionGroups.playerColor, 'color', this.app.options.playerColor);
            this.app.render();

            if (this.app.options.playerColor === 'white') {
                this.showMessageKey('swappedToWhiteAiFirst');
                this.scheduleAIMove();
                return;
            }

            this.app.clearPendingAI();
            if (this.app.isGuidedMode()) {
                this.app.refreshCoachGuidance();
            }
            this.showMessageKey('swappedToBlack');
            return;
        }

        this.app.state.currentPlayer = getOpponent(this.app.state.currentPlayer);
        this.app.render();
        this.showMessageKey('swappedFirstPlayer', { player: getPlayerLabel(this.app.state.currentPlayer) });
    }

    /**
     * 使用当前配置重新开始一局，并重新触发对应的首回合流程。
     * @returns {void}
     */
    restart() {
        this.app.clearPendingAI();
        this.app.cancelLlmCoachRequest();
        this.createFreshState();
        updateMeta(this.app.dom, this.app.options);

        if (this.app.use3D && this.app.renderer3d) {
            this.app.renderer3d.setBoardSize(this.app.options.size);
            this.app.renderer3d.setInteractionEnabled(true);
            this.app.renderer3d.playGameStartSequence();
        }

        this.app.render();
        this.showMessageKey('gameRestartedMessage');

        if (this.app.isAIMode() && this.app.options.playerColor === 'white') {
            this.scheduleAIMove();
            return;
        }

        if (this.app.isGuidedMode()) {
            this.app.refreshCoachGuidance();
        }
    }

    /**
     * 处理认输，立即结束对局并展示结果摘要。
     * @returns {void}
     */
    resign() {
        if (this.app.state.aiThinking) {
            this.app.sound.play('error');
            this.showMessageKey('noResignDuringAiTurn');
            return;
        }
        if (this.app.state.gameOver) {
            this.app.sound.play('error');
            this.showMessageKey('gameAlreadyEnded');
            return;
        }

        this.app.clearPendingAI();
        this.app.clearPreview();
        this.app.clearPlacementSelection(false);
        this.app.state.gameOver = true;
        const winner = getOpponent(this.app.state.currentPlayer);
        this.app.state.resultType = 'resign';
        this.app.state.resultWinnerColor = winner;
        this.app.state.resultSummary = this.createResultSummary('resign', winner);
        this.app.render();
        showResultOverlay(this.app.dom, this.app.state.resultSummary);
        this.app.sound.play('resign');
        this.showMessageKey('resignWinMessage', {
            loser: getPlayerLabel(this.app.state.currentPlayer),
            winner: getPlayerLabel(winner)
        }, 'success');
    }

    // === Validation ===

    /**
     * 验证落子是否合法，包括占位冲突与禁手判定。
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
     * 获取当前规则下的禁手原因。
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
            row,
            col,
            color
        );
    }

    /**
     * 生成结果覆盖层所需的摘要对象。
     * @param {'win'|'draw'|'resign'} type - 结果类型
     * @param {'black'|'white'|null} [winnerColor=null] - 获胜方颜色
     * @returns {{ badge: string, title: string, detail: string, moves: number, lastMove: string, variant: string }}
     */
    createResultSummary(type, winnerColor = null) {
        const lastMoveText = this.app.state.lastMove
            ? `${getPlayerLabel(this.app.state.lastMove.color)} ${formatMove(this.app.state.lastMove.row, this.app.state.lastMove.col)}`
            : '-';
        const winnerLabel = getPlayerLabel(winnerColor);

        if (type === 'draw') {
            return {
                badge: i18n.t('resultDrawBadge'),
                title: i18n.t('resultDrawTitle'),
                detail: i18n.t('resultDrawDetail'),
                moves: this.app.state.moveHistory.length,
                lastMove: lastMoveText,
                variant: 'result-draw'
            };
        }

        if (type === 'resign') {
            return {
                badge: i18n.t('resultResignBadge'),
                title: i18n.t('resultResignTitle', { player: winnerLabel }),
                detail: i18n.t('resultResignDetail'),
                moves: this.app.state.moveHistory.length,
                lastMove: lastMoveText,
                variant: 'result-resign'
            };
        }

        return {
            badge: i18n.t('resultWinBadge'),
            title: i18n.t('resultWinTitle', { player: winnerLabel }),
            detail: i18n.t('resultWinDetail'),
            moves: this.app.state.moveHistory.length,
            lastMove: lastMoveText,
            variant: 'result-win'
        };
    }

    // === Rendering ===

    /**
     * 渲染完整界面，包括棋盘、状态栏、步数列表、教练卡片与落子确认区。
     * @param {{ animateLastMove?: boolean }} [options={}] - 渲染选项
     * @returns {void}
     */
    render(options = {}) {
        const highlightedCell = this.app.dom.board.querySelector('.cell-touch-highlight');
        const highlightPos = highlightedCell
            ? { row: Number(highlightedCell.dataset.row), col: Number(highlightedCell.dataset.col) }
            : null;

        if (this.app.use3D && this.app.renderer3d) {
            this.app.renderer3d.renderBoard(this.app.state.board, {
                lastMove: this.app.state.lastMove,
                winningCells: this.app.state.winningCells,
                hintMove: this.app.state.hintMove,
                coachSuggestion: this.app.state.coachSuggestion,
                coachFocus: this.app.state.coachFocus,
                selectedCell: this.app.state.selectedCell,
                animateLastMove: options.animateLastMove ?? false,
            });
        } else {
            renderBoard(this.app.dom, this.app.state);
        }

        if (highlightPos && !this.app.state.gameOver && this.app.canHumanMove()) {
            const cell = this.app.dom.board.querySelector(
                `.cell[data-row="${highlightPos.row}"][data-col="${highlightPos.col}"]`
            );
            if (cell && !this.app.state.board[highlightPos.row][highlightPos.col]) {
                cell.classList.add('cell-touch-highlight');
            }
        }

        updateMeta(this.app.dom, this.app.options);
        updateStatus(this.app.dom, this.app.state);
        updateMoveList(this.app.dom, this.app.state.moveHistory);
        updateGuidance(this.app.dom, this.app.state, this.app.options);
        updateBoardPreviewOverlay(this.app.dom, this.app.state);
        updatePlacementPanel(this.app.dom, this.app.state);
        this.app.syncSceneExperience();
        this.app.refreshImmersiveUi();
    }

    /**
     * 通过 i18n key 显示一条浮动消息。
     * @param {string} key - i18n 翻译键
     * @param {Object} [params={}] - 翻译参数
     * @param {'info'|'success'|'error'} [type='info'] - 消息类型
     * @returns {void}
     */
    showMessageKey(key, params = {}, type = 'info') {
        showMessageUI(this.app.dom, i18n.t(key, params), type);
    }

    // === AI ===

    /**
     * 设置 AI 思考状态并同步对应的场景/界面表现。
     * @param {boolean} isThinking - AI 是否正在思考
     * @returns {void}
     */
    setAIThinking(isThinking) {
        this.app.state.aiThinking = isThinking;
        setAIThinkingUI(this.app.dom, isThinking);
        this.app.syncSceneExperience();
    }

    /**
     * 清除待处理的 AI 落子定时器，并重置 AI 思考状态。
     * @returns {void}
     */
    clearPendingAI() {
        if (this.app.aiTimer !== null) {
            window.clearTimeout(this.app.aiTimer);
            this.app.aiTimer = null;
        }

        this.setAIThinking(false);
    }

    /**
     * 切换音效启用状态，并刷新按钮与环境音景。
     * @returns {void}
     */
    toggleSound() {
        if (this.app.sound.isEnabled()) {
            this.app.sound.play('toggleOff');
            this.app.sound.setEnabled(false);
        } else {
            this.app.sound.setEnabled(true);
            this.app.sound.unlock();
            this.app.sound.play('toggleOn');
        }

        this.app.refreshSoundToggle();
        this.app.sound.setAmbience(this.app.currentAmbientCue);
    }

    /**
     * 将 3D 视角重置为当前场景的默认镜头。
     * @returns {void}
     */
    resetCamera() {
        if (!this.app.renderer3d) {
            return;
        }

        this.app.renderer3d.resetCamera();
    }
}
