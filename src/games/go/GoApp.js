/**
 * 围棋应用入口。
 *
 * 继承 BoardGameApp 基类，复用通用生命周期；围棋特有逻辑（落子/提子/贴目/数目）在子类实现。
 *
 * @module games/go/GoApp
 */

import { CoachController } from '../../app/controllers/CoachController.js';
import { buildGameCoachMapping } from '../../ui/dom.js';
import { i18n } from '../../utils/i18n.js';
import { BoardGameApp } from '../../app/BoardGameApp.js';
import { createGoState, createGoOptions } from './state.js';
import { placeStone, isLegalMove, getOpponent } from './rules.js';
import { scoreBoardWithRule, getTerritoryMap } from './scoring.js';
import { getGoAIMove, getGoAIDelay } from './ai.js';
import { GoRenderer3D } from './render3d/GoRenderer3D.js';
import { requestPostGameAnalysis, isLlmCoachConfigured, loadLlmCoachSettings } from '../../services/llmCoach.js';

const VIEW_MODE_STORAGE_KEY = 'gomoku-go-view-mode';

const COLUMN_LABELS = 'ABCDEFGHJKLMNOPQRST';

function formatGoMove(row, col) {
    const letter = COLUMN_LABELS[col] ?? '?';
    return `${letter}${row + 1}`;
}

function playerLabel(color) {
    return i18n.t(color === 'black' ? 'black' : 'white');
}

export class GoApp extends BoardGameApp {
    /**
     * @param {Document|HTMLElement} [root=document]
     */
    constructor(root = document) {
        super(root, createGoOptions());
        this.llmSettings = loadLlmCoachSettings();
        this.llmCoachRequestId = 0;
        this.llmCoachAbortController = null;
        this.coach = new CoachController(this);
        this.renderer3d = null;
        this.viewMode = GoApp._readStoredViewMode();
        this.exposeTestHooks();
    }

    static _readStoredViewMode() {
        return '3d';
    }

    // === Hooks ===

    queryDom(root) {
        return {
            root: root.getElementById('go-root'),
            setup: {
                panel: root.getElementById('go-setup'),
                size: root.getElementById('go-size-options'),
                mode: root.getElementById('go-mode-options'),
                level: root.getElementById('go-level-options'),
                levelRow: root.getElementById('go-level-row'),
                handicap: root.getElementById('go-handicap-options'),
                handicapRow: root.getElementById('go-handicap-row'),
                scoring: root.getElementById('go-scoring-options'),
                start: root.getElementById('go-start-btn'),
                backToLauncher: root.getElementById('go-back-to-launcher-btn')
            },
            game: {
                panel: root.getElementById('go-game'),
                board: root.getElementById('go-board'),
                board3d: root.getElementById('go-board-3d'),
                viewToggle: root.getElementById('go-view-toggle'),
                message: root.getElementById('go-message'),
                currentPlayer: root.getElementById('go-current-player'),
                moveCount: root.getElementById('go-move-count'),
                capturedBlack: root.getElementById('go-captures-black'),
                capturedWhite: root.getElementById('go-captures-white'),
                pass: root.getElementById('go-pass-btn'),
                undo: root.getElementById('go-undo-btn'),
                resign: root.getElementById('go-resign-btn'),
                restart: root.getElementById('go-restart-btn'),
                back: root.getElementById('go-back-btn')
            },
            result: {
                overlay: root.getElementById('go-result-overlay'),
                badge: root.getElementById('go-result-badge'),
                title: root.getElementById('go-result-title'),
                detail: root.getElementById('go-result-detail'),
                blackScore: root.getElementById('go-black-score'),
                whiteScore: root.getElementById('go-white-score'),
                restart: root.getElementById('go-result-restart-btn'),
                launcher: root.getElementById('go-result-launcher-btn')
            },
            guidance: buildGameCoachMapping(root, 'go'),
        };
    }

    createInitialState() {
        return createGoState({ ...this.options });
    }

    bindSetupEvents() {
        const { setup } = this.dom;
        if (!setup) return;
        this.bindOptionGroup(setup.size, 'size', (value) => {
            this.options.size = Number(value);
        });
        this.bindOptionGroup(setup.mode, 'mode', (value) => {
            this.options.mode = value;
            this.refreshSetupVisibility();
        });
        this.bindOptionGroup(setup.level, 'level', (value) => {
            this.options.level = value;
        });
        this.bindOptionGroup(setup.handicap, 'handicap', (value) => {
            this.options.handicap = Number(value);
        });
        this.bindOptionGroup(setup.scoring, 'scoring', (value) => {
            this.options.scoringRule = value;
        });

        setup.start?.addEventListener('click', () => {
            this.sound.play('start');
            this.startGame();
        });
        this.bindBackToLauncher(setup.backToLauncher);
    }

    bindGameEvents() {
        const { game, result } = this.dom;
        if (!game) return;
        game.board?.addEventListener('click', (event) => {
            const cell = event.target.closest('.go-cell');
            if (!cell) return;
            const row = Number(cell.dataset.row);
            const col = Number(cell.dataset.col);
            this.handleCellClick(row, col);
        });
        game.pass?.addEventListener('click', () => this.handlePass());
        game.undo?.addEventListener('click', () => this.handleUndo());
        game.resign?.addEventListener('click', () => this.resign());
        game.restart?.addEventListener('click', () => this.restart());
        this.bindBackToLauncher(game.back);
        game.viewToggle?.addEventListener('click', () => this.toggleView());
        result?.restart?.addEventListener('click', () => this.restart());
        result?.launcher?.addEventListener('click', () => window.__returnToLauncher?.());
    }

    refreshSetupVisibility() {
        const showAI = this.options.mode === 'pve';
        this.dom.setup?.levelRow?.classList.toggle('hidden', !showAI);
        this.dom.setup?.handicapRow?.classList.toggle('hidden', this.options.mode === 'practice');
    }

    startGameImpl() {
        this.showMessage(i18n.t('goGameStart'), 'info');
        // 让子局 + 人机模式，玩家执白时 AI 先出手（createGoState 会把 currentPlayer 设为 white）
        this.maybeScheduleAI();
        this.applyViewMode();
    }

    dispose() {
        super.dispose();
        this.renderer3d?.dispose();
        this.renderer3d = null;
    }

    isHumanTurn() {
        if (this.options.mode !== 'pve') return true;
        return this.state.currentPlayer === this.options.playerColor;
    }

    getAIDelay() {
        return getGoAIDelay(this.options.level);
    }

    getAIMove() {
        return getGoAIMove(this.state);
    }

    commitMove(move) {
        if (move?.pass) {
            this.commitPass();
            return;
        }
        this.playMove(move.row, move.col);
    }

    checkGameEnd() {
        // 围棋不会因为没走法而终局，由双方连续 pass 触发 finishByScoring。
    }

    onResign() {
        const winner = getOpponent(this.state.currentPlayer);
        this.state.result = { type: 'resign', winner };
    }

    formatResult() {
        const res = this.state?.result;
        if (!res) return { badge: '', title: '', detail: '' };
        if (res.type === 'resign') {
            return {
                badge: i18n.t('resultResignBadge'),
                title: i18n.t('resultResignTitle', { player: playerLabel(res.winner) }),
                detail: i18n.t('goResignDetail')
            };
        }
        const ruleSuffix = this.options.scoringRule === 'territory' ? 'Territory' : 'Area';
        return {
            badge: i18n.t(`goScoreBadge${ruleSuffix}`),
            title: res.winner
                ? i18n.t('goScoreWinnerTitle', { player: playerLabel(res.winner), margin: res.margin.toFixed(1) })
                : i18n.t('goScoreDrawTitle'),
            detail: i18n.t(`goScoreDetail${ruleSuffix}`, { komi: this.options.komi })
        };
    }

    postFormatResult(_formatted) {
        const { result } = this.dom;
        const res = this.state?.result;
        if (!result || !res) return;
        if (res.type === 'resign') {
            if (result.blackScore) result.blackScore.textContent = String(this.state.captures.black);
            if (result.whiteScore) result.whiteScore.textContent = String(this.state.captures.white);
        } else {
            if (result.blackScore) result.blackScore.textContent = res.blackScore.toFixed(1);
            if (result.whiteScore) result.whiteScore.textContent = res.whiteScore.toFixed(1);
        }
    }

    // === Go-specific game actions ===

    handleCellClick(row, col) {
        if (this.state.gameOver) return;
        if (this.state.aiThinking) {
            this.sound.play('error');
            return;
        }
        if (!this.isHumanTurn()) {
            this.sound.play('error');
            return;
        }
        this.playMove(row, col);
    }

    playMove(row, col) {
        const result = placeStone(this.state.board, row, col, this.state.currentPlayer, {
            koPoint: this.state.koPoint
        });
        if (!result.legal) {
            this.sound.play('error');
            const reasonKey = result.reason === 'ko'
                ? 'goIllegalKo'
                : result.reason === 'suicide'
                    ? 'goIllegalSuicide'
                    : 'goIllegalOccupied';
            this.showMessage(i18n.t(reasonKey), 'error');
            return;
        }

        const captured = result.captured.length;
        this.state.board = result.board;
        this.state.captures[this.state.currentPlayer] += captured;
        this.state.koPoint = result.koPoint;
        this.state.consecutivePasses = 0;
        const move = {
            index: this.state.moveHistory.length + 1,
            color: this.state.currentPlayer,
            row,
            col,
            pass: false,
            captured
        };
        this.state.moveHistory.push(move);
        this.state.lastMove = move;
        this.sound.play('move', { color: this.state.currentPlayer, source: 'human' });

        this.state.currentPlayer = getOpponent(this.state.currentPlayer);
        this.renderBoard();
        this.renderStatus();
        this.renderGameCoach();
        this.refreshCoachGuidance();
        this.maybeScheduleAI();
    }

    handlePass() {
        if (this.state.gameOver) return;
        if (this.state.aiThinking) return;
        if (!this.isHumanTurn()) return;
        this.commitPass();
    }

    commitPass() {
        this.state.consecutivePasses += 1;
        this.state.koPoint = null;
        const move = {
            index: this.state.moveHistory.length + 1,
            color: this.state.currentPlayer,
            row: null,
            col: null,
            pass: true,
            captured: 0
        };
        this.state.moveHistory.push(move);
        this.state.lastMove = move;
        this.sound.play('uiTap');

        if (this.state.consecutivePasses >= 2) {
            this.finishByScoring();
            return;
        }

        this.showMessage(i18n.t('goPassedMessage', { player: playerLabel(this.state.currentPlayer) }), 'info');
        this.state.currentPlayer = getOpponent(this.state.currentPlayer);
        this.renderStatus();
        this.maybeScheduleAI();
    }

    handleUndo() {
        if (this.state.moveHistory.length === 0) {
            this.sound.play('error');
            return;
        }
        const steps = this.options.mode === 'pve' && this.state.moveHistory.length >= 2 ? 2 : 1;
        const target = Math.max(0, this.state.moveHistory.length - steps);
        const prevHistory = this.state.moveHistory.slice(0, target);
        this.state = createGoState({ ...this.options });
        const preHandicapSize = this.state.moveHistory.length;
        prevHistory.slice(preHandicapSize).forEach((move) => {
            if (move.pass) {
                this.state.consecutivePasses += 1;
                this.state.koPoint = null;
                this.state.lastMove = move;
                this.state.moveHistory.push(move);
                this.state.currentPlayer = getOpponent(this.state.currentPlayer);
                return;
            }
            const result = placeStone(this.state.board, move.row, move.col, move.color, {
                koPoint: this.state.koPoint
            });
            if (!result.legal) return;
            this.state.board = result.board;
            this.state.captures[move.color] += result.captured.length;
            this.state.koPoint = result.koPoint;
            this.state.consecutivePasses = 0;
            const replay = { ...move, captured: result.captured.length };
            this.state.moveHistory.push(replay);
            this.state.lastMove = replay;
            this.state.currentPlayer = getOpponent(move.color);
        });

        this.sound.play('undo');
        this.renderBoard();
        this.renderStatus();
    }

    finishByScoring() {
        const score = scoreBoardWithRule(this.state.board, {
            komi: this.options.komi,
            rule: this.options.scoringRule || 'area',
            captures: this.state.captures
        });
        this.state.gameOver = true;
        this.state.result = {
            type: 'score',
            winner: score.winner,
            blackScore: score.blackScore,
            whiteScore: score.whiteScore,
            margin: score.margin
        };
        this.sound.play('win');
        // 3D 领地可视化
        if (this.viewMode === '3d' && this.renderer3d) {
            const tmap = getTerritoryMap(this.state.board);
            this.renderer3d.showTerritory(this.state.board, tmap);
        }
        this.renderBoard();
        this.renderStatus();
        this.showResult();
    }

    // === Rendering ===

        render() {
        this.renderBoard();
        this.renderStatus();
        this.renderGameCoach();
    }

renderBoard() {
        const board = this.dom.game?.board;
        board?.classList.add('hidden');
        this.render3DIfActive();
    }

    render3DIfActive() {
        if (this.viewMode !== '3d' || !this.renderer3d) return;
        if (this.renderer3d.boardSize !== this.options.size) {
            this.renderer3d.setBoardSize(this.options.size);
        }
        this.renderer3d.syncBoard(this.state.board);
        this.renderer3d.highlightLastMove(this.state.lastMove);
        this.renderer3d.highlightKo(this.state.koPoint);
        // 非终局时清除领地标记
        if (!this.state.gameOver) {
            this.renderer3d.hideTerritory();
        }
    }

    toggleView() {
        this.viewMode = '3d';
        this.applyViewMode();
        try {
            window.localStorage?.setItem(VIEW_MODE_STORAGE_KEY, this.viewMode);
        } catch (_err) { /* ignore */ }
    }

    applyViewMode() {
        const { game } = this.dom;
        if (!game) return;
        this.viewMode = '3d';
        game.viewToggle?.setAttribute('aria-pressed', 'true');
        game.viewToggle?.classList.add('hidden');
        game.board?.classList.add('hidden');
        this.ensureRenderer3D();
        this.renderer3d?.show();
        this.render3DIfActive();
    }

    ensureRenderer3D() {
        if (this.renderer3d || !this.dom.game?.board3d) return;
        try {
            this.renderer3d = new GoRenderer3D(this.dom.game.board3d, { boardSize: this.options.size, soundManager: this.sound });
            this.renderer3d.onCellClick(({ row, col }) => this.handleCellClick(row, col));
        } catch (err) {
            console.warn('[GoApp] 3D renderer init failed.', err);
            this.renderer3d = null;
            this.viewMode = '3d';
            this.dom.game.board?.classList.add('hidden');
            this.dom.game.board3d?.classList.add('hidden');
            this.showMessage(i18n.t('renderer3DRequired'), 'error');
        }
    }

    isStarPoint(row, col) {
        const size = this.options.size;
        if (size === 19) {
            const stars = [3, 9, 15];
            return stars.includes(row) && stars.includes(col);
        }
        if (size === 13) {
            const stars = [3, 6, 9];
            return stars.includes(row) && stars.includes(col);
        }
        const stars = [2, 4, 6];
        return stars.includes(row) && stars.includes(col);
    }

    renderStatus() {
        const { game } = this.dom;
        if (!game?.currentPlayer) return;
        game.currentPlayer.textContent = this.state.gameOver
            ? i18n.t('gameEnd')
            : playerLabel(this.state.currentPlayer);
        if (game.moveCount) game.moveCount.textContent = String(this.state.moveHistory.length);
        if (game.capturedBlack) game.capturedBlack.textContent = String(this.state.captures.black);
        if (game.capturedWhite) game.capturedWhite.textContent = String(this.state.captures.white);
    }
    async requestGoPostGameReview() {
        const panel = this.dom?.result?.postgamePanel;
        const contentEl = this.dom?.result?.postgameContent;
        if (!panel || !contentEl) return;
        const settings = loadLlmCoachSettings();
        if (!isLlmCoachConfigured(settings)) {
            panel.classList.remove('hidden');
            contentEl.innerHTML = '<p>' + i18n.t('coachPostGameUnavailable') + '</p>';
            return;
        }
        panel.classList.remove('hidden');
        contentEl.innerHTML = '<p>' + i18n.t('coachPostGameLoading') + '</p>';
        try {
            const snapshot = {
                boardSize: this.options.size,
                board: this.state.board,
                moveHistory: this.state.moveHistory || [],
                currentPlayer: this.state.currentPlayer,
                captures: this.state.captures,
                koPoint: this.state.koPoint
            };
            const raw = await requestPostGameAnalysis({ settings, snapshot, gameType: 'go' });
            let a;
            try { a = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { a = { summary: raw }; }
            this.renderPostGamePanel(panel, contentEl, a);
        } catch (e) {
            if (e && e.code === 'aborted') return;
            contentEl.innerHTML = '<p>' + i18n.t('coachLlmRequestFailed') + '</p>';
        }
    }

    isGuidedMode() { return this.options.mode === 'qi'; }

    cancelLlmCoachRequest() {
        if (this.llmCoachAbortController) {
            this.llmCoachAbortController.abort();
            this.llmCoachAbortController = null;
        }
    }

    refreshCoachGuidance(a) { return this.coach ? this.coach.refreshCoachGuidance(a) : null; }

    clearCoachState(o) { return this.coach ? this.coach.clearCoachState(o) : null; }

    renderGameCoach() {
        if (!this.coach) return;
        const g = this.dom && this.dom.guidance;
        if (!g || !g.card) return;
        const s = this.state;
        const guided = this.isGuidedMode();
        g.card.classList.toggle('hidden', !guided);
        if (!guided) return;
        if (g.move) g.move.textContent = s.coachSuggestion ? (s.coachSuggestion.row + ',' + s.coachSuggestion.col) : '-';
        if (g.source) g.source.textContent = s.coachSource === 'llm' ? 'LLM' : 'Local';
        if (g.status) g.status.textContent = s.coachLlmStatus || '-';
        if (g.insight) g.insight.textContent = s.coachInsight || 'Waiting...';
        if (g.risk) g.risk.textContent = s.coachRisk || 'Waiting...';
    }

}

export { formatGoMove, isLegalMove };
