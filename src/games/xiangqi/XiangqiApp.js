/**
 * 中国象棋应用入口。
 *
 * 继承 BoardGameApp 基类，复用通用生命周期；象棋特有的九宫/楚河汉界渲染、走子合法性在子类实现。
 *
 * @module games/xiangqi/XiangqiApp
 */

import { CoachController } from '../../app/controllers/CoachController.js';
import { buildGameCoachMapping } from '../../ui/dom.js';
import { i18n } from '../../utils/i18n.js';
import { BoardGameApp } from '../../app/BoardGameApp.js';
import { createXiangqiState, createXiangqiOptions } from './state.js';
import {
    applyMove,
    getLegalMovesFrom,
    isCheckmate,
    isStalemate,
    isInCheck
} from './rules.js';
import { getXiangqiAIMove, getXiangqiAIDelay } from './ai.js';
import { XiangqiRenderer3D } from './render3d/XiangqiRenderer3D.js';
import { loadLlmCoachSettings } from '../../services/llmCoach.js';

const PIECE_GLYPH = {
    rK: '帅', rA: '仕', rE: '相', rN: '马', rR: '车', rC: '炮', rP: '兵',
    bK: '将', bA: '士', bE: '象', bN: '馬', bR: '車', bC: '砲', bP: '卒'
};

const FILE_LABELS_RED = '九八七六五四三二一'.split('');
const FILE_LABELS_BLACK = '１２３４５６７８９'.split('');

function playerLabel(color) {
    return i18n.t(color === 'r' ? 'xiangqiRed' : 'xiangqiBlack');
}

function describeMove(move) {
    const [fr, fc] = move.from;
    const [tr, tc] = move.to;
    const glyph = PIECE_GLYPH[move.piece] || '?';
    const cap = move.capture ? '×' : '→';
    return `${glyph} (${fr},${fc})${cap}(${tr},${tc})`;
}

export class XiangqiApp extends BoardGameApp {
    constructor(root = document) {
        super(root, createXiangqiOptions());
        this.renderer3d = null;
        this.use3D = true;
        this.llmSettings = loadLlmCoachSettings();
        this.llmCoachRequestId = 0;
        this.llmCoachAbortController = null;
        this.coach = new CoachController(this);
    }

    queryDom(root) {
        return {
            root: root.getElementById('xiangqi-root'),
            setup: {
                panel: root.getElementById('xiangqi-setup'),
                mode: root.getElementById('xiangqi-mode-options'),
                level: root.getElementById('xiangqi-level-options'),
                levelRow: root.getElementById('xiangqi-level-row'),
                color: root.getElementById('xiangqi-color-options'),
                colorRow: root.getElementById('xiangqi-color-row'),
                start: root.getElementById('xiangqi-start-btn'),
                back: root.getElementById('xiangqi-back-to-launcher-btn')
            },
            game: {
                panel: root.getElementById('xiangqi-game'),
                board: root.getElementById('xiangqi-board'),
                board3d: root.getElementById('xiangqi-board-3d'),
                message: root.getElementById('xiangqi-message'),
                currentPlayer: root.getElementById('xiangqi-current-player'),
                moveCount: root.getElementById('xiangqi-move-count'),
                lastMove: root.getElementById('xiangqi-last-move'),
                undo: root.getElementById('xiangqi-undo-btn'),
                hint: root.getElementById('xiangqi-hint-btn'),
                resign: root.getElementById('xiangqi-resign-btn'),
                restart: root.getElementById('xiangqi-restart-btn'),
                back: root.getElementById('xiangqi-back-btn')
            },
            result: {
                overlay: root.getElementById('xiangqi-result-overlay'),
                badge: root.getElementById('xiangqi-result-badge'),
                title: root.getElementById('xiangqi-result-title'),
                detail: root.getElementById('xiangqi-result-detail'),
                restart: root.getElementById('xiangqi-result-restart-btn'),
                launcher: root.getElementById('xiangqi-result-launcher-btn'),
                postgameBtn: root.getElementById('xiangqi-result-postgame-btn'),
                postgamePanel: root.getElementById('xiangqi-result-postgame-panel'),
                postgameContent: root.getElementById('xiangqi-result-postgame-content')
            },
            guidance: buildGameCoachMapping(root, 'xiangqi'),
        };
    }

    createInitialState() {
        return createXiangqiState({ ...this.options });
    }

    bindSetupEvents() {
        const { setup } = this.dom;
        if (!setup) return;
        this.bindOptionGroup(setup.mode, 'mode', (v) => {
            this.options.mode = v;
            this.refreshSetupVisibility();
        });
        this.bindOptionGroup(setup.level, 'level', (v) => { this.options.level = v; });
        this.bindOptionGroup(setup.color, 'color', (v) => { this.options.playerColor = v; });
        setup.start?.addEventListener('click', () => {
            this.sound.play('start');
            this.startGame();
        });
        this.bindBackToLauncher(setup.back);
    }

    bindGameEvents() {
        const { game, result } = this.dom;
        if (!game) return;
        game.board?.addEventListener('click', (event) => {
            const cell = event.target.closest('.xiangqi-cell');
            if (!cell) return;
            const row = Number(cell.dataset.row);
            const col = Number(cell.dataset.col);
            this.handleCellClick(row, col);
        });
        game.undo?.addEventListener('click', () => this.handleUndo());
        game.hint?.addEventListener('click', () => this.handleHint());
        game.resign?.addEventListener('click', () => this.resign());
        game.restart?.addEventListener('click', () => this.restart());
        this.bindBackToLauncher(game.back);
        result?.restart?.addEventListener('click', () => this.restart());
        result?.launcher?.addEventListener('click', () => window.__returnToLauncher?.());
    }

    refreshSetupVisibility() {
        const pve = this.options.mode === 'pve';
        this.dom.setup?.levelRow?.classList.toggle('hidden', !pve);
        this.dom.setup?.colorRow?.classList.toggle('hidden', !pve);
    }

    startGameImpl() {
        this.showMessage(i18n.t('xiangqiGameStart'), 'info');
        this.maybeScheduleAI();
        this.apply3DView();
    }

    hideRoot() {
        super.hideRoot();
        this.renderer3d?.hide();
    }

    dispose() {
        super.dispose();
        this.renderer3d?.dispose();
        this.renderer3d = null;
    }

    isHumanTurn() {
        if (this.options.mode !== 'pve') return true;
        return this.state.turn === this.options.playerColor;
    }

    getAIDelay() {
        return getXiangqiAIDelay(this.options.level);
    }

    getAIMove() {
        return getXiangqiAIMove(this.state);
    }

    onResign() {
        const winner = this.state.turn === 'r' ? 'b' : 'r';
        this.state.result = { type: 'resign', winner };
    }

    formatResult() {
        const res = this.state?.result;
        if (!res) return { badge: '', title: '', detail: '' };
        if (res.type === 'checkmate') {
            return {
                badge: i18n.t('xiangqiCheckmateBadge'),
                title: i18n.t('xiangqiCheckmateTitle', { player: playerLabel(res.winner) }),
                detail: i18n.t('xiangqiCheckmateDetail')
            };
        }
        if (res.type === 'resign') {
            return {
                badge: i18n.t('resultResignBadge'),
                title: i18n.t('resultResignTitle', { player: playerLabel(res.winner) }),
                detail: i18n.t('xiangqiResignDetail')
            };
        }
        if (res.type === 'stalemate') {
            return {
                badge: i18n.t('xiangqiStalemateBadge'),
                title: i18n.t('xiangqiStalemateTitle', { player: playerLabel(res.winner) }),
                detail: i18n.t('xiangqiStalemateDetail')
            };
        }
        return { badge: '', title: '', detail: '' };
    }

    // === Game actions ===

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

        const piece = this.state.board[row][col];

        // Clear hint highlight when user interacts
        this.state.hintMove = null;

        if (this.selected) {
            const [sr, sc] = this.selected;
            if (sr === row && sc === col) {
                this.selected = null;
                this.highlightMoves = [];
                this.renderBoard();
                return;
            }
            const candidate = this.highlightMoves.find((mv) => mv.to[0] === row && mv.to[1] === col);
            if (candidate) {
                this.commitMove(candidate);
                return;
            }
            if (piece && piece[0] === this.state.turn) {
                this.selectPiece(row, col);
                return;
            }
            this.selected = null;
            this.highlightMoves = [];
            this.renderBoard();
            return;
        }
        if (piece && piece[0] === this.state.turn) {
            this.selectPiece(row, col);
        }
    }

    selectPiece(row, col) {
        this.selected = [row, col];
        this.highlightMoves = getLegalMovesFrom(this.state.board, this.state, row, col);
        this.sound.play('select');
        this.renderBoard();
    }

    commitMove(move) {
        const { board, state } = applyMove(this.state.board, this.state, move);
        this.state.board = board;
        Object.assign(this.state, state);
        this.state.moveHistory = [...this.state.moveHistory, {
            ...move,
            notation: describeMove(move)
        }];
        this.selected = null;
        this.highlightMoves = [];
        this.state.hintMove = null;
        this.sound.play('move', { color: move.piece[0] === 'r' ? 'red' : 'black', source: 'human' });
        this.renderBoard();
        this.renderStatus();
        this.checkGameEnd();
        if (this.state.gameOver) return;
        this.maybeScheduleAI();
    }

    handleUndo() {
        if (this.state.aiThinking || this.state.gameOver) return;
        this.clearAITimer();
        if (this.state.moveHistory.length === 0) {
            this.sound.play('error');
            return;
        }
        const steps = this.options.mode === 'pve' && this.state.moveHistory.length >= 2 ? 2 : 1;
        const target = Math.max(0, this.state.moveHistory.length - steps);
        const replay = this.state.moveHistory.slice(0, target);
        this.state = createXiangqiState({ ...this.options });
        replay.forEach((mv) => {
            const { board, state } = applyMove(this.state.board, this.state, mv);
            this.state.board = board;
            Object.assign(this.state, state);
            this.state.moveHistory.push(mv);
        });
        this.selected = null;
        this.highlightMoves = [];
        this.state.hintMove = null;
        this.sound.play('undo');
        this.renderBoard();
        this.renderStatus();
    }

    /** 提示下一步建议走法（使用 AI 引擎） */
    handleHint() {
        if (this.state.gameOver) {
            this.sound.play('error');
            return;
        }
        if (this.state.aiThinking) {
            this.sound.play('error');
            return;
        }
        if (!this.isHumanTurn()) {
            this.sound.play('error');
            return;
        }

        const move = getXiangqiAIMove(this.state);
        if (!move) {
            this.showMessage(i18n.t('noHintAvailable') || 'No hint available', 'warn');
            return;
        }

        this.state.hintMove = { from: move.from, to: move.to };
        this.sound.play('select');
        this.renderBoard();
        this.renderStatus();
        this.showMessage(i18n.t('hintSuggestionMessage', { move: describeMove(move) }), 'info');
    }

    checkGameEnd() {
        if (isCheckmate(this.state.board, this.state)) {
            const winner = this.state.turn === 'r' ? 'b' : 'r';
            this.state.gameOver = true;
            this.state.result = { type: 'checkmate', winner };
            this.sound.play('win');
            this.showResult();
            if (this.renderer3d && winner) {
                this.renderer3d.playVictorySequence(winner === 'r' ? 'red' : 'black');
            }
            return;
        }
        if (isStalemate(this.state.board, this.state)) {
            const winner = this.state.turn === 'r' ? 'b' : 'r';
            this.state.gameOver = true;
            this.state.result = { type: 'stalemate', winner };
            this.sound.play('win');
            this.showResult();
        }
    }

    // === Rendering ===


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

    render() { this.renderBoard(); this.renderStatus(); this.renderGameCoach(); }
    renderBoard() {
        this.dom.game?.board?.classList.add('hidden');
        this.render3DIfActive();
    }

    apply3DView() {
        if (!this.use3D) return;
        this.ensureRenderer3D();
        if (this.renderer3d) {
            this.dom.game?.board?.classList.add('hidden');
            this.renderer3d.show();
            this.render3DIfActive();
        }
    }

    ensureRenderer3D() {
        if (this.renderer3d || !this.dom.game?.board3d) return;
        try {
            this.renderer3d = new XiangqiRenderer3D(this.dom.game.board3d, { soundManager: this.sound });
            this.renderer3d.onCellClick(({ row, col }) => this.handleCellClick(row, col));
        } catch (err) {
            console.warn('[XiangqiApp] 3D renderer unavailable.', err);
            this.use3D = true;
            this.renderer3d = null;
            this.dom.game.board3d?.classList.add('hidden');
            this.dom.game.board?.classList.add('hidden');
            this.showMessage(i18n.t('renderer3DRequired'), 'error');
        }
    }

    render3DIfActive() {
        if (!this.use3D) return;
        this.ensureRenderer3D();
        if (!this.renderer3d || !this.state) return;
        const flip = this.options.mode === 'pve' && this.options.playerColor === 'b';
        this.renderer3d.flipped = flip;
        this.renderer3d.syncBoard(this.state.board, {
            flipped: flip,
            selected: this.selected,
            moves: this.highlightMoves,
            lastMove: this.state.moveHistory[this.state.moveHistory.length - 1],
            labelFont: 'bold 122px KaiTi, STKaiti, serif',
            hintMove: this.state.hintMove
        });
    }

    renderStatus() {
        const { game } = this.dom;
        if (!game?.currentPlayer) return;
        game.currentPlayer.textContent = this.state.gameOver
            ? i18n.t('gameEnd')
            : playerLabel(this.state.turn);
        if (game.moveCount) game.moveCount.textContent = String(this.state.moveHistory.length);
        const last = this.state.moveHistory[this.state.moveHistory.length - 1];
        if (game.lastMove) game.lastMove.textContent = last ? last.notation : '-';
    }
}

export { FILE_LABELS_RED, FILE_LABELS_BLACK };
