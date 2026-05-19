/**
 * 中国象棋应用入口。
 *
 * 继承 BoardGameApp 基类，复用通用生命周期；象棋特有的九宫/楚河汉界渲染、走子合法性在子类实现。
 *
 * @module games/xiangqi/XiangqiApp
 */

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
                launcher: root.getElementById('xiangqi-result-launcher-btn')
            }
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
        this.sound.play('move', { color: move.piece[0] === 'r' ? 'red' : 'black', source: 'human' });
        this.renderBoard();
        this.renderStatus();
        this.checkGameEnd();
        if (this.state.gameOver) return;
        this.maybeScheduleAI();
    }

    handleUndo() {
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
        this.sound.play('undo');
        this.renderBoard();
        this.renderStatus();
    }

    checkGameEnd() {
        if (isCheckmate(this.state.board, this.state)) {
            const winner = this.state.turn === 'r' ? 'b' : 'r';
            this.state.gameOver = true;
            this.state.result = { type: 'checkmate', winner };
            this.sound.play('win');
            this.showResult();
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

    renderBoard() {
        const board = this.dom.game?.board;
        if (!board) return;
        this.render3DIfActive();
        if (this.use3D && this.renderer3d) {
            board.classList.add('hidden');
            return;
        }
        board.classList.remove('hidden');
        board.replaceChildren();
        const flip = this.options.mode === 'pve' && this.options.playerColor === 'b';
        const rows = flip ? [...Array(10).keys()].reverse() : [...Array(10).keys()];
        const cols = flip ? [...Array(9).keys()].reverse() : [...Array(9).keys()];
        const moveDests = new Set(this.highlightMoves.map((mv) => `${mv.to[0]},${mv.to[1]}`));
        const captureDests = new Set(
            this.highlightMoves.filter((mv) => mv.capture).map((mv) => `${mv.to[0]},${mv.to[1]}`)
        );
        const lastMove = this.state.moveHistory[this.state.moveHistory.length - 1];
        const checkedColor = isInCheck(this.state.board, this.state.turn) ? this.state.turn : null;

        const frag = document.createDocumentFragment();
        for (const row of rows) {
            for (const col of cols) {
                const cell = document.createElement('div');
                cell.className = 'xiangqi-cell';
                cell.dataset.row = String(row);
                cell.dataset.col = String(col);
                cell.setAttribute('role', 'gridcell');

                if (row === 0) cell.classList.add('xiangqi-top-edge');
                if (row === 9) cell.classList.add('xiangqi-bottom-edge');
                if (col === 0) cell.classList.add('xiangqi-left-edge');
                if (col === 8) cell.classList.add('xiangqi-right-edge');

                if (row === 4) cell.classList.add('xiangqi-river-top');
                if (row === 5) cell.classList.add('xiangqi-river-bottom');

                const inRedPalace = row >= 7 && row <= 9 && col >= 3 && col <= 5;
                const inBlackPalace = row >= 0 && row <= 2 && col >= 3 && col <= 5;
                if (inRedPalace || inBlackPalace) {
                    cell.classList.add('xiangqi-palace');
                    if ((row === 7 && col === 3) || (row === 0 && col === 3)) {
                        cell.classList.add('xiangqi-palace-diag-tl');
                    }
                    if ((row === 7 && col === 4) || (row === 0 && col === 4)) {
                        cell.classList.add('xiangqi-palace-diag-tl', 'xiangqi-palace-diag-tr');
                    }
                    if ((row === 7 && col === 5) || (row === 0 && col === 5)) {
                        cell.classList.add('xiangqi-palace-diag-tr');
                    }
                }

                if (this.selected && this.selected[0] === row && this.selected[1] === col) {
                    cell.classList.add('xiangqi-selected');
                }
                const key = `${row},${col}`;
                if (moveDests.has(key)) cell.classList.add('xiangqi-move-dest');
                if (captureDests.has(key)) cell.classList.add('xiangqi-capture-dest');
                if (lastMove && (
                    (lastMove.from[0] === row && lastMove.from[1] === col)
                    || (lastMove.to[0] === row && lastMove.to[1] === col)
                )) {
                    cell.classList.add('xiangqi-last-move');
                }

                const piece = this.state.board[row][col];
                if (piece) {
                    const disc = document.createElement('div');
                    disc.className = `xiangqi-piece xiangqi-piece-${piece[0]}`;
                    disc.textContent = PIECE_GLYPH[piece] || '?';
                    cell.appendChild(disc);
                    if (checkedColor && piece[0] === checkedColor && piece[1] === 'K') {
                        cell.classList.add('xiangqi-check');
                    }
                }
                frag.appendChild(cell);
            }
        }
        board.appendChild(frag);
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
            this.renderer3d = new XiangqiRenderer3D(this.dom.game.board3d);
            this.renderer3d.onCellClick(({ row, col }) => this.handleCellClick(row, col));
        } catch (err) {
            console.warn('[XiangqiApp] 3D renderer unavailable, using 2D board.', err);
            this.use3D = false;
            this.dom.game.board3d?.classList.add('hidden');
            this.dom.game.board?.classList.remove('hidden');
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
            labelFont: 'bold 122px KaiTi, STKaiti, serif'
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
