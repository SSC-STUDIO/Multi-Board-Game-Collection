/**
 * 国际象棋应用入口。
 *
 * 继承 BoardGameApp 基类，复用通用生命周期；国际象棋特有的选子/升变/将军检测在子类实现。
 *
 * @module games/chess/ChessApp
 */

import { i18n } from '../../utils/i18n.js';
import { BoardGameApp } from '../../app/BoardGameApp.js';
import { createChessState, createChessOptions } from './state.js';
import {
    applyMove,
    getLegalMovesFrom,
    isCheckmate,
    isStalemate,
    isInsufficientMaterial,
    isFiftyMoveDraw,
    isInCheck
} from './rules.js';
import { getChessAIMove, getChessAIDelay } from './ai.js';
import { ChessRenderer3D } from './render3d/ChessRenderer3D.js';

const PIECE_GLYPH = {
    wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
    bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟'
};
const FILE_LABELS = 'abcdefgh';

function squareName(row, col) {
    const rank = 8 - row;
    return `${FILE_LABELS[col]}${rank}`;
}

function playerLabel(color) {
    return i18n.t(color === 'w' ? 'chessWhite' : 'chessBlack');
}

export class ChessApp extends BoardGameApp {
    constructor(root = document) {
        super(root, createChessOptions());
        this.renderer3d = null;
        this.use3D = true;
    }

    queryDom(root) {
        return {
            root: root.getElementById('chess-root'),
            setup: {
                panel: root.getElementById('chess-setup'),
                mode: root.getElementById('chess-mode-options'),
                level: root.getElementById('chess-level-options'),
                levelRow: root.getElementById('chess-level-row'),
                color: root.getElementById('chess-color-options'),
                colorRow: root.getElementById('chess-color-row'),
                start: root.getElementById('chess-start-btn'),
                back: root.getElementById('chess-back-to-launcher-btn')
            },
            game: {
                panel: root.getElementById('chess-game'),
                board: root.getElementById('chess-board'),
                board3d: root.getElementById('chess-board-3d'),
                message: root.getElementById('chess-message'),
                currentPlayer: root.getElementById('chess-current-player'),
                moveCount: root.getElementById('chess-move-count'),
                lastMove: root.getElementById('chess-last-move'),
                capturedWhite: root.getElementById('chess-captured-white'),
                capturedBlack: root.getElementById('chess-captured-black'),
                undo: root.getElementById('chess-undo-btn'),
                resign: root.getElementById('chess-resign-btn'),
                restart: root.getElementById('chess-restart-btn'),
                back: root.getElementById('chess-back-btn')
            },
            result: {
                overlay: root.getElementById('chess-result-overlay'),
                badge: root.getElementById('chess-result-badge'),
                title: root.getElementById('chess-result-title'),
                detail: root.getElementById('chess-result-detail'),
                restart: root.getElementById('chess-result-restart-btn'),
                launcher: root.getElementById('chess-result-launcher-btn')
            },
            promotion: {
                overlay: root.getElementById('chess-promotion-overlay'),
                buttons: root.getElementById('chess-promotion-buttons')
            }
        };
    }

    createInitialState() {
        return createChessState({ ...this.options });
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
        const { game, result, promotion } = this.dom;
        if (!game) return;
        game.board?.addEventListener('click', (event) => {
            const square = event.target.closest('.chess-square');
            if (!square) return;
            const row = Number(square.dataset.row);
            const col = Number(square.dataset.col);
            this.handleSquareClick(row, col);
        });
        game.undo?.addEventListener('click', () => this.handleUndo());
        game.resign?.addEventListener('click', () => this.resign());
        game.restart?.addEventListener('click', () => this.restart());
        this.bindBackToLauncher(game.back);
        result?.restart?.addEventListener('click', () => this.restart());
        result?.launcher?.addEventListener('click', () => window.__returnToLauncher?.());
        promotion?.buttons?.addEventListener('click', (event) => {
            const btn = event.target.closest('[data-promotion]');
            if (!btn) return;
            this.handlePromotionPick(btn.dataset.promotion);
        });
    }

    refreshSetupVisibility() {
        const pve = this.options.mode === 'pve';
        this.dom.setup?.levelRow?.classList.toggle('hidden', !pve);
        this.dom.setup?.colorRow?.classList.toggle('hidden', !pve);
    }

    // 基类 enterSetup/hideRoot 不处理 promotion overlay，子类补齐
    enterSetup() {
        super.enterSetup();
        this.hidePromotion();
    }

    hideRoot() {
        super.hideRoot();
        this.hidePromotion();
        this.renderer3d?.hide();
    }

    startGameImpl() {
        this.hidePromotion();
        this.showMessage(i18n.t('chessGameStart'), 'info');
        this.maybeScheduleAI();
        this.apply3DView();
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
        return getChessAIDelay(this.options.level);
    }

    getAIMove() {
        return getChessAIMove(this.state);
    }

    onResign() {
        const winner = this.state.turn === 'w' ? 'b' : 'w';
        this.state.result = { type: 'resign', winner };
    }

    formatResult() {
        const res = this.state?.result;
        if (!res) return { badge: '', title: '', detail: '' };
        if (res.type === 'checkmate') {
            return {
                badge: i18n.t('chessCheckmate'),
                title: i18n.t('chessCheckmateTitle', { player: playerLabel(res.winner) }),
                detail: i18n.t('chessCheckmateDetail')
            };
        }
        if (res.type === 'resign') {
            return {
                badge: i18n.t('resultResignBadge'),
                title: i18n.t('resultResignTitle', { player: playerLabel(res.winner) }),
                detail: i18n.t('chessResignDetail')
            };
        }
        if (res.type === 'stalemate') {
            return {
                badge: i18n.t('chessStalemate'),
                title: i18n.t('chessStalemateTitle'),
                detail: i18n.t('chessStalemateDetail')
            };
        }
        if (res.type === 'draw') {
            const reasonKey = res.reason === 'insufficient' ? 'chessDrawInsufficient' : 'chessDraw50';
            return {
                badge: i18n.t('chessDraw'),
                title: i18n.t(reasonKey),
                detail: i18n.t('chessDrawDetail')
            };
        }
        return { badge: '', title: '', detail: '' };
    }

    // === Chess-specific game actions ===

    handleSquareClick(row, col) {
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
                this.tryPlayMove(candidate);
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

    tryPlayMove(move) {
        if (move.promotion) {
            const targets = this.highlightMoves.filter((mv) =>
                mv.to[0] === move.to[0] && mv.to[1] === move.to[1] && mv.promotion
            );
            if (targets.length > 1) {
                this.pendingPromotion = { from: move.from, to: move.to };
                this.showPromotion();
                return;
            }
        }
        this.commitMove(move);
    }

    handlePromotionPick(promo) {
        this.hidePromotion();
        const pending = this.pendingPromotion;
        if (!pending) return;
        const match = this.highlightMoves.find((mv) =>
            mv.from[0] === pending.from[0] && mv.from[1] === pending.from[1]
            && mv.to[0] === pending.to[0] && mv.to[1] === pending.to[1]
            && mv.promotion === promo
        );
        this.pendingPromotion = null;
        if (!match) return;
        this.commitMove(match);
    }

    commitMove(move) {
        const { board, state } = applyMove(this.state.board, this.state, move);
        this.state.board = board;
        Object.assign(this.state, state);
        this.state.moveHistory = [...this.state.moveHistory, {
            ...move,
            san: this.describeMove(move)
        }];
        this.selected = null;
        this.highlightMoves = [];
        this.sound.play('move', { color: move.piece[0] === 'w' ? 'white' : 'black', source: 'human' });
        this.renderBoard();
        this.renderStatus();
        this.checkGameEnd();
        if (this.state.gameOver) return;
        this.maybeScheduleAI();
    }

    describeMove(move) {
        const { from, to, piece, capture, castle, promotion } = move;
        if (castle === 'K') return 'O-O';
        if (castle === 'Q') return 'O-O-O';
        const pieceLetter = piece[1] === 'P' ? '' : piece[1];
        const cap = capture ? 'x' : '';
        const promo = promotion ? `=${promotion}` : '';
        return `${pieceLetter}${squareName(from[0], from[1])}${cap}${squareName(to[0], to[1])}${promo}`;
    }

    handleUndo() {
        if (this.state.moveHistory.length === 0) {
            this.sound.play('error');
            return;
        }
        const steps = this.options.mode === 'pve' && this.state.moveHistory.length >= 2 ? 2 : 1;
        const target = Math.max(0, this.state.moveHistory.length - steps);
        const replay = this.state.moveHistory.slice(0, target);
        this.state = createChessState({ ...this.options });
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
            const winner = this.state.turn === 'w' ? 'b' : 'w';
            this.state.gameOver = true;
            this.state.result = { type: 'checkmate', winner };
            this.sound.play('win');
            this.showResult();
            return;
        }
        if (isStalemate(this.state.board, this.state)) {
            this.state.gameOver = true;
            this.state.result = { type: 'stalemate', winner: null };
            this.sound.play('draw');
            this.showResult();
            return;
        }
        if (isInsufficientMaterial(this.state.board)) {
            this.state.gameOver = true;
            this.state.result = { type: 'draw', winner: null, reason: 'insufficient' };
            this.sound.play('draw');
            this.showResult();
            return;
        }
        if (isFiftyMoveDraw(this.state)) {
            this.state.gameOver = true;
            this.state.result = { type: 'draw', winner: null, reason: 'fiftyMove' };
            this.sound.play('draw');
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
        const frag = document.createDocumentFragment();
        const flip = this.options.mode === 'pve' && this.options.playerColor === 'b';
        const moveDests = new Set(this.highlightMoves.map((mv) => `${mv.to[0]},${mv.to[1]}`));
        const captureDests = new Set(
            this.highlightMoves.filter((mv) => mv.capture).map((mv) => `${mv.to[0]},${mv.to[1]}`)
        );
        const lastMove = this.state.moveHistory[this.state.moveHistory.length - 1];

        const rows = flip ? [...Array(8).keys()].reverse() : [...Array(8).keys()];
        const cols = flip ? [...Array(8).keys()].reverse() : [...Array(8).keys()];
        for (const row of rows) {
            for (const col of cols) {
                const sq = document.createElement('div');
                sq.className = 'chess-square';
                sq.classList.add((row + col) % 2 === 0 ? 'chess-light' : 'chess-dark');
                sq.dataset.row = String(row);
                sq.dataset.col = String(col);
                sq.setAttribute('role', 'gridcell');
                sq.setAttribute('aria-label', squareName(row, col));

                if (this.selected && this.selected[0] === row && this.selected[1] === col) {
                    sq.classList.add('chess-selected');
                }
                if (lastMove && (
                    (lastMove.from[0] === row && lastMove.from[1] === col)
                    || (lastMove.to[0] === row && lastMove.to[1] === col)
                )) {
                    sq.classList.add('chess-last-move');
                }
                const key = `${row},${col}`;
                if (moveDests.has(key)) sq.classList.add('chess-move-dest');
                if (captureDests.has(key)) sq.classList.add('chess-capture-dest');

                const piece = this.state.board[row][col];
                if (piece) {
                    const glyph = document.createElement('span');
                    glyph.className = `chess-piece chess-piece-${piece[0]}`;
                    glyph.textContent = PIECE_GLYPH[piece] || '?';
                    sq.appendChild(glyph);
                    if (piece[1] === 'K' && piece[0] === this.state.turn && isInCheck(this.state.board, piece[0])) {
                        sq.classList.add('chess-check');
                    }
                }
                frag.appendChild(sq);
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
            this.renderer3d = new ChessRenderer3D(this.dom.game.board3d);
            this.renderer3d.onCellClick(({ row, col }) => this.handleSquareClick(row, col));
        } catch (err) {
            console.warn('[ChessApp] 3D renderer unavailable, using 2D board.', err);
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
            lastMove: this.state.moveHistory[this.state.moveHistory.length - 1]
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
        if (game.lastMove) game.lastMove.textContent = last ? last.san : '-';

        const capturedByWhite = []; const capturedByBlack = [];
        this.state.moveHistory.forEach((mv) => {
            if (!mv.capture) return;
            if (mv.piece[0] === 'w') capturedByWhite.push(mv.capture);
            else capturedByBlack.push(mv.capture);
        });
        if (game.capturedWhite) game.capturedWhite.textContent = capturedByWhite.map((p) => PIECE_GLYPH[p]).join(' ') || '-';
        if (game.capturedBlack) game.capturedBlack.textContent = capturedByBlack.map((p) => PIECE_GLYPH[p]).join(' ') || '-';
    }

    // === Promotion overlay ===

    showPromotion() {
        const { promotion } = this.dom;
        if (!promotion?.overlay) return;
        promotion.overlay.classList.remove('hidden');
        promotion.overlay.setAttribute('aria-hidden', 'false');
    }

    hidePromotion() {
        const { promotion } = this.dom;
        promotion?.overlay?.classList.add('hidden');
        promotion?.overlay?.setAttribute('aria-hidden', 'true');
    }
}
