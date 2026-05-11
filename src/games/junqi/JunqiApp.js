/**
 * 军棋应用入口。
 *
 * 继承 BoardGameApp 基类，复用通用生命周期；翻翻棋特有的首翻定色、暗棋机制在子类实现。
 * 四国军棋（fourKingdom）仍为占位。
 *
 * @module games/junqi/JunqiApp
 */

import { i18n } from '../../utils/i18n.js';
import { BoardGameApp } from '../../app/BoardGameApp.js';
import { createFlipState, createFlipOptions } from './flip/state.js';
import {
    applyMove,
    checkWinner,
    getLegalMoves,
    generatePieceMoves,
    generateFlipMoves,
    oppositeColor,
    RANK_LEVEL,
    BOARD_ROWS,
    BOARD_COLS
} from './flip/rules.js';
import { getFlipAIMove, getFlipAIDelay } from './flip/ai.js';

const RANK_GLYPH = {
    K: { r: '帅', b: '将' },
    A: { r: '士', b: '士' },
    E: { r: '相', b: '象' },
    R: { r: '车', b: '車' },
    N: { r: '马', b: '馬' },
    C: { r: '炮', b: '砲' },
    P: { r: '兵', b: '卒' }
};

function playerLabel(color) {
    return i18n.t(color === 'r' ? 'junqiRed' : 'junqiBlack');
}

function describeMove(board, move) {
    if (move.kind === 'flip') {
        const [r, c] = move.from;
        return `${i18n.t('junqiFlip')} (${r},${c})`;
    }
    const piece = board[move.from[0]][move.from[1]];
    const glyph = piece ? (RANK_GLYPH[piece.rank]?.[piece.color] || '?') : '?';
    const sep = move.kind === 'capture' ? '×' : '→';
    return `${glyph} (${move.from[0]},${move.from[1]})${sep}(${move.to[0]},${move.to[1]})`;
}

export class JunqiApp extends BoardGameApp {
    constructor(root = document) {
        super(root, createFlipOptions());
        this.variant = 'flip';
    }

    queryDom(root) {
        return {
            root: root.getElementById('junqi-root'),
            setup: {
                panel: root.getElementById('junqi-setup'),
                variant: root.getElementById('junqi-variant-options'),
                mode: root.getElementById('junqi-mode-options'),
                level: root.getElementById('junqi-level-options'),
                levelRow: root.getElementById('junqi-level-row'),
                start: root.getElementById('junqi-start-btn'),
                back: root.getElementById('junqi-back-to-launcher-btn')
            },
            game: {
                panel: root.getElementById('junqi-game'),
                board: root.getElementById('junqi-board'),
                message: root.getElementById('junqi-message'),
                currentPlayer: root.getElementById('junqi-current-player'),
                moveCount: root.getElementById('junqi-move-count'),
                lastMove: root.getElementById('junqi-last-move'),
                hint: root.getElementById('junqi-hint'),
                resign: root.getElementById('junqi-resign-btn'),
                restart: root.getElementById('junqi-restart-btn'),
                back: root.getElementById('junqi-back-btn')
            },
            result: {
                overlay: root.getElementById('junqi-result-overlay'),
                badge: root.getElementById('junqi-result-badge'),
                title: root.getElementById('junqi-result-title'),
                detail: root.getElementById('junqi-result-detail'),
                restart: root.getElementById('junqi-result-restart-btn'),
                launcher: root.getElementById('junqi-result-launcher-btn')
            }
        };
    }

    createInitialState() {
        return createFlipState({ ...this.options });
    }

    bindSetupEvents() {
        const { setup } = this.dom;
        if (!setup) return;
        this.bindOptionGroup(setup.variant, 'variant', (v) => {
            this.variant = v;
            this.refreshSetupVisibility();
        });
        this.bindOptionGroup(setup.mode, 'mode', (v) => {
            this.options.mode = v;
            this.refreshSetupVisibility();
        });
        this.bindOptionGroup(setup.level, 'level', (v) => { this.options.level = v; });
        setup.start?.addEventListener('click', () => {
            if (this.variant === 'fourKingdom') {
                this.showMessage(i18n.t('comingSoon'), 'info');
                return;
            }
            this.sound.play('start');
            this.startGame();
        });
        this.bindBackToLauncher(setup.back);
    }

    bindGameEvents() {
        const { game, result } = this.dom;
        if (!game) return;
        game.board?.addEventListener('click', (event) => {
            const cell = event.target.closest('.junqi-cell');
            if (!cell) return;
            const row = Number(cell.dataset.row);
            const col = Number(cell.dataset.col);
            this.handleCellClick(row, col);
        });
        game.resign?.addEventListener('click', () => this.resign());
        game.restart?.addEventListener('click', () => this.restart());
        this.bindBackToLauncher(game.back);
        result?.restart?.addEventListener('click', () => this.restart());
        result?.launcher?.addEventListener('click', () => window.__returnToLauncher?.());
    }

    refreshSetupVisibility() {
        const pve = this.options.mode === 'pve';
        this.dom.setup?.levelRow?.classList.toggle('hidden', !pve);
    }

    startGameImpl() {
        this.showMessage(i18n.t('junqiFlipIntro'), 'info');
    }

    isHumanTurn() {
        if (this.state.turn === null) return true;
        if (this.options.mode !== 'pve') return true;
        const humanColor = Object.keys(this.state.players || {}).find((c) => this.state.players[c] === 'p1');
        return humanColor ? this.state.turn === humanColor : true;
    }

    getAIDelay() {
        return getFlipAIDelay(this.options.level);
    }

    getAIMove() {
        return getFlipAIMove(this.state);
    }

    commitMove(move) {
        // 首翻：翻者自动获得翻出颜色
        let firstFlipAssigned = false;
        if (this.state.turn === null && move.kind === 'flip') {
            const [r, c] = move.from;
            const piece = this.state.board[r][c];
            if (piece) {
                const first = this.state.firstPlayer || 'p1';
                this.state.players = {
                    [piece.color]: first,
                    [oppositeColor(piece.color)]: first === 'p1' ? 'p2' : 'p1'
                };
                firstFlipAssigned = true;
            }
        }

        const { board, state } = applyMove(this.state.board, this.state, move);
        this.state.board = board;
        Object.assign(this.state, state);
        this.state.moveHistory.push({ ...move, notation: describeMove(this.state.board, move) });
        this.selected = null;
        this.highlightMoves = [];
        this.sound.play(move.kind === 'capture' ? 'move' : move.kind === 'flip' ? 'uiTap' : 'move', {
            color: 'black', source: 'human'
        });

        this.renderBoard();
        this.renderStatus();

        const winner = checkWinner(this.state.board, this.state);
        if (winner) {
            this.state.gameOver = true;
            this.state.result = winner;
            this.sound.play('win');
            this.showResult();
            return;
        }

        if (firstFlipAssigned) {
            this.showMessage(
                i18n.t('junqiFirstFlipAssigned', {
                    player: playerLabel(
                        Object.keys(this.state.players).find((c) => this.state.players[c] === 'p1')
                    )
                }),
                'info'
            );
        }

        this.maybeScheduleAI();
    }

    // 重写 maybeScheduleAI：首翻阶段不触发；其余由 isHumanTurn 决定
    maybeScheduleAI() {
        if (!this.state || this.state.gameOver) return;
        if (this.options.mode !== 'pve') return;
        if (this.state.turn === null) return;
        if (this.isHumanTurn()) return;
        this.scheduleAIMove();
    }

    checkGameEnd() {
        const winner = checkWinner(this.state.board, this.state);
        if (winner) {
            this.state.gameOver = true;
            this.state.result = winner;
            this.sound.play('win');
            this.showResult();
            return;
        }
        // 若当前方无任何合法走法（既无棋可走也无棋可翻），按困毙处理
        if (this.state.turn !== null && getLegalMoves(this.state.board, this.state.turn).length === 0) {
            this.state.gameOver = true;
            this.state.result = { winner: oppositeColor(this.state.turn), reason: 'stalemate' };
            this.sound.play('win');
            this.showResult();
        }
    }

    onResign() {
        const loser = this.state.turn || 'r';
        this.state.result = { winner: oppositeColor(loser), reason: 'resign' };
    }

    formatResult() {
        const res = this.state?.result;
        if (!res) return { badge: '', title: '', detail: '' };
        if (res.reason === 'resign') {
            return {
                badge: i18n.t('resultResignBadge'),
                title: i18n.t('resultResignTitle', { player: playerLabel(res.winner) }),
                detail: i18n.t('junqiResignDetail')
            };
        }
        if (res.reason === 'annihilation') {
            return {
                badge: i18n.t('junqiAnnihilationBadge'),
                title: i18n.t('junqiAnnihilationTitle', { player: playerLabel(res.winner) }),
                detail: i18n.t('junqiAnnihilationDetail')
            };
        }
        return {
            badge: i18n.t('junqiStalemateBadge'),
            title: i18n.t('junqiStalemateTitle', { player: playerLabel(res.winner) }),
            detail: i18n.t('junqiStalemateDetail')
        };
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
        if (this.state.turn === null) {
            if (piece && !piece.revealed) {
                this.commitMove({ kind: 'flip', from: [row, col], to: [row, col] });
            }
            return;
        }

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
            if (piece && piece.revealed && piece.color === this.state.turn) {
                this.selectPiece(row, col);
                return;
            }
            this.selected = null;
            this.highlightMoves = [];
            this.renderBoard();
            return;
        }

        if (piece && !piece.revealed) {
            this.commitMove({ kind: 'flip', from: [row, col], to: [row, col] });
            return;
        }
        if (piece && piece.revealed && piece.color === this.state.turn) {
            this.selectPiece(row, col);
        }
    }

    selectPiece(row, col) {
        this.selected = [row, col];
        this.highlightMoves = generatePieceMoves(this.state.board, row, col);
        this.sound.play('select');
        this.renderBoard();
    }

    // === Rendering ===

    renderBoard() {
        const board = this.dom.game?.board;
        if (!board) return;
        board.replaceChildren();
        const frag = document.createDocumentFragment();
        const moveDests = new Set(this.highlightMoves.map((mv) => `${mv.to[0]},${mv.to[1]}`));
        const captureDests = new Set(
            this.highlightMoves.filter((mv) => mv.kind === 'capture').map((mv) => `${mv.to[0]},${mv.to[1]}`)
        );
        const lastMove = this.state.moveHistory[this.state.moveHistory.length - 1];

        for (let row = 0; row < BOARD_ROWS; row += 1) {
            for (let col = 0; col < BOARD_COLS; col += 1) {
                const cell = document.createElement('div');
                cell.className = 'junqi-cell';
                cell.dataset.row = String(row);
                cell.dataset.col = String(col);
                cell.setAttribute('role', 'gridcell');

                if (this.selected && this.selected[0] === row && this.selected[1] === col) {
                    cell.classList.add('junqi-selected');
                }
                const key = `${row},${col}`;
                if (moveDests.has(key)) cell.classList.add('junqi-move-dest');
                if (captureDests.has(key)) cell.classList.add('junqi-capture-dest');
                if (lastMove && (
                    (lastMove.from?.[0] === row && lastMove.from?.[1] === col)
                    || (lastMove.to?.[0] === row && lastMove.to?.[1] === col)
                )) {
                    cell.classList.add('junqi-last-move');
                }

                const piece = this.state.board[row][col];
                if (piece) {
                    const disc = document.createElement('div');
                    disc.className = 'junqi-piece';
                    if (piece.revealed) {
                        disc.classList.add(`junqi-piece-${piece.color}`, 'junqi-piece-face');
                        disc.textContent = RANK_GLYPH[piece.rank]?.[piece.color] || '?';
                    } else {
                        disc.classList.add('junqi-piece-back');
                    }
                    cell.appendChild(disc);
                }

                frag.appendChild(cell);
            }
        }
        board.appendChild(frag);
    }

    renderStatus() {
        const { game } = this.dom;
        if (!game?.currentPlayer) return;
        if (this.state.gameOver) {
            game.currentPlayer.textContent = i18n.t('gameEnd');
        } else if (this.state.turn === null) {
            game.currentPlayer.textContent = i18n.t('junqiFirstFlip');
        } else {
            game.currentPlayer.textContent = playerLabel(this.state.turn);
        }
        if (game.moveCount) game.moveCount.textContent = String(this.state.moveHistory.length);
        const last = this.state.moveHistory[this.state.moveHistory.length - 1];
        if (game.lastMove) game.lastMove.textContent = last ? last.notation : '-';
        if (game.hint) {
            if (this.state.turn === null) {
                game.hint.textContent = i18n.t('junqiHintFirstFlip');
            } else if (this.state.aiThinking) {
                game.hint.textContent = i18n.t('aiThinkingMessage');
            } else {
                game.hint.textContent = i18n.t('junqiHintPlay');
            }
        }
    }
}

export { RANK_LEVEL, getLegalMoves, generateFlipMoves };
