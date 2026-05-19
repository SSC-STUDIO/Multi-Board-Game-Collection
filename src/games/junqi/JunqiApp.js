import { i18n } from '../../utils/i18n.js';
import { BoardGameApp } from '../../app/BoardGameApp.js';
import { createFlipState, createFlipOptions } from './flip/state.js';
import {
    applyMove as applyFlipMove,
    checkWinner as checkFlipWinner,
    getLegalMoves as getFlipLegalMoves,
    generatePieceMoves as generateFlipPieceMoves,
    generateFlipMoves,
    oppositeColor,
    RANK_LEVEL as FLIP_RANK_LEVEL,
    BOARD_ROWS as FLIP_ROWS,
    BOARD_COLS as FLIP_COLS
} from './flip/rules.js';
import { getFlipAIMove, getFlipAIDelay } from './flip/ai.js';
import { createClassicState, createClassicOptions } from './classic/state.js';
import {
    applyMove as applyClassicMove,
    checkWinner as checkClassicWinner,
    getLegalMoves as getClassicLegalMoves,
    generatePieceMoves as generateClassicPieceMoves,
    isPlayable
} from './classic/rules.js';
import { getClassicAIMove, getClassicAIDelay } from './classic/ai.js';
import { JunqiRenderer3D } from './render3d/JunqiRenderer3D.js';

const FLIP_RANK_GLYPH = {
    K: { r: '帅', b: '将' },
    A: { r: '仕', b: '士' },
    E: { r: '相', b: '象' },
    R: { r: '车', b: '車' },
    N: { r: '马', b: '馬' },
    C: { r: '炮', b: '砲' },
    P: { r: '兵', b: '卒' }
};

const CLASSIC_RANK_GLYPH = {
    S: '司令',
    G: '军长',
    D: '师长',
    R: '旅长',
    T: '团长',
    B: '营长',
    C: '连长',
    P: '排长',
    E: '工兵',
    X: '炸弹',
    M: '地雷',
    F: '军旗'
};

function playerLabel(color) {
    return i18n.t(color === 'r' ? 'junqiRed' : 'junqiBlack');
}

function describeFlipMove(board, move) {
    if (move.kind === 'flip') {
        const [r, c] = move.from;
        return `${i18n.t('junqiFlip')} (${r},${c})`;
    }
    const piece = board[move.from[0]][move.from[1]];
    const glyph = piece ? (FLIP_RANK_GLYPH[piece.rank]?.[piece.color] || '?') : '?';
    const sep = move.kind === 'capture' ? 'x' : '->';
    return `${glyph} (${move.from[0]},${move.from[1]})${sep}(${move.to[0]},${move.to[1]})`;
}

function describeClassicMove(board, move) {
    const piece = move.piece || board[move.from[0]][move.from[1]];
    const glyph = piece ? (CLASSIC_RANK_GLYPH[piece.rank] || '?') : '?';
    const sep = move.kind === 'capture' ? 'x' : '->';
    return `${glyph} (${move.from[0]},${move.from[1]})${sep}(${move.to[0]},${move.to[1]})`;
}

export class JunqiApp extends BoardGameApp {
    constructor(root = document) {
        super(root, createClassicOptions());
        this.variant = 'classic';
        this.renderer3d = null;
        this.rendererVariant = null;
        this.use3D = true;
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
                template: root.getElementById('junqi-template-options'),
                templateRow: root.getElementById('junqi-template-row'),
                start: root.getElementById('junqi-start-btn'),
                back: root.getElementById('junqi-back-to-launcher-btn')
            },
            game: {
                panel: root.getElementById('junqi-game'),
                board: root.getElementById('junqi-board'),
                board3d: root.getElementById('junqi-board-3d'),
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
        if (this.variant === 'flip') {
            return createFlipState({ ...this.options });
        }
        return createClassicState({ ...this.options });
    }

    bindSetupEvents() {
        const { setup } = this.dom;
        if (!setup) return;
        this.bindOptionGroup(setup.variant, 'variant', (variant) => {
            this.variant = variant;
            this.options = variant === 'flip'
                ? createFlipOptions({ mode: this.options.mode, level: this.options.level })
                : createClassicOptions({
                    mode: this.options.mode,
                    level: this.options.level,
                    templateIndex: this.options.templateIndex || 0
                });
            this.refreshSetupVisibility();
        });
        this.bindOptionGroup(setup.mode, 'mode', (value) => {
            this.options.mode = value;
            this.refreshSetupVisibility();
        });
        this.bindOptionGroup(setup.level, 'level', (value) => { this.options.level = value; });
        this.bindOptionGroup(setup.template, 'template', (value) => {
            this.options.templateIndex = Number(value);
        });
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
            const cell = event.target.closest('.junqi-cell');
            if (!cell) return;
            this.handleCellClick(Number(cell.dataset.row), Number(cell.dataset.col));
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
        this.dom.setup?.templateRow?.classList.toggle('hidden', this.variant === 'flip');
    }

    startGameImpl() {
        this.showMessage(i18n.t(this.variant === 'flip' ? 'junqiFlipIntro' : 'junqiClassicIntro'), 'info');
        this.apply3DView();
        this.maybeScheduleAI();
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
        if (this.variant === 'classic') {
            if (this.options.mode !== 'pve') return true;
            return this.state.turn === (this.options.playerColor || 'r');
        }
        if (this.state.turn === null) return true;
        if (this.options.mode !== 'pve') return true;
        const humanColor = Object.keys(this.state.players || {}).find((c) => this.state.players[c] === 'p1');
        return humanColor ? this.state.turn === humanColor : true;
    }

    getAIDelay() {
        return this.variant === 'classic'
            ? getClassicAIDelay(this.options.level)
            : getFlipAIDelay(this.options.level);
    }

    getAIMove() {
        return this.variant === 'classic'
            ? getClassicAIMove(this.state)
            : getFlipAIMove(this.state);
    }

    commitMove(move) {
        if (this.variant === 'classic') {
            this.commitClassicMove(move);
            return;
        }
        this.commitFlipMove(move);
    }

    commitClassicMove(move) {
        const notation = describeClassicMove(this.state.board, move);
        const { board, state } = applyClassicMove(this.state.board, this.state, move);
        this.state.board = board;
        Object.assign(this.state, state);
        this.state.moveHistory.push({ ...move, notation });
        this.selected = null;
        this.highlightMoves = [];
        this.sound.play(move.kind === 'capture' ? 'move' : 'uiTap', { color: move.piece?.color, source: 'human' });
        this.renderBoard();
        this.renderStatus();
        this.finishIfWinner(checkClassicWinner(this.state.board, this.state));
        if (!this.state.gameOver) this.maybeScheduleAI();
    }

    commitFlipMove(move) {
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

        const notation = describeFlipMove(this.state.board, move);
        const { board, state } = applyFlipMove(this.state.board, this.state, move);
        this.state.board = board;
        Object.assign(this.state, state);
        this.state.moveHistory.push({ ...move, notation });
        this.selected = null;
        this.highlightMoves = [];
        this.sound.play(move.kind === 'capture' ? 'move' : move.kind === 'flip' ? 'uiTap' : 'move', {
            color: 'black', source: 'human'
        });
        this.renderBoard();
        this.renderStatus();
        if (this.finishIfWinner(checkFlipWinner(this.state.board, this.state))) return;
        if (firstFlipAssigned) {
            this.showMessage(
                i18n.t('junqiFirstFlipAssigned', {
                    player: playerLabel(Object.keys(this.state.players).find((c) => this.state.players[c] === 'p1'))
                }),
                'info'
            );
        }
        this.maybeScheduleAI();
    }

    maybeScheduleAI() {
        if (!this.state || this.state.gameOver) return;
        if (this.options.mode !== 'pve') return;
        if (this.variant === 'flip' && this.state.turn === null) return;
        if (this.isHumanTurn()) return;
        this.scheduleAIMove();
    }

    checkGameEnd() {
        const winner = this.variant === 'classic'
            ? checkClassicWinner(this.state.board, this.state)
            : checkFlipWinner(this.state.board, this.state);
        this.finishIfWinner(winner);
    }

    finishIfWinner(winner) {
        if (!winner) return false;
        this.state.gameOver = true;
        this.state.result = winner;
        this.sound.play('win');
        this.showResult();
        return true;
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
        if (res.reason === 'flag') {
            return {
                badge: i18n.t('junqiFlagCapturedBadge'),
                title: i18n.t('junqiFlagCapturedTitle', { player: playerLabel(res.winner) }),
                detail: i18n.t('junqiFlagCapturedDetail')
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

    handleCellClick(row, col) {
        if (this.state.gameOver) return;
        if (this.state.aiThinking || !this.isHumanTurn()) {
            this.sound.play('error');
            return;
        }
        if (this.variant === 'classic') {
            this.handleClassicCellClick(row, col);
        } else {
            this.handleFlipCellClick(row, col);
        }
    }

    handleClassicCellClick(row, col) {
        if (!isPlayable(row, col)) return;
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
            if (piece && piece.color === this.state.turn) {
                this.selectPiece(row, col);
                return;
            }
            this.selected = null;
            this.highlightMoves = [];
            this.renderBoard();
            return;
        }
        if (piece && piece.color === this.state.turn) this.selectPiece(row, col);
    }

    handleFlipCellClick(row, col) {
        const piece = this.state.board[row][col];
        if (this.state.turn === null) {
            if (piece && !piece.revealed) this.commitMove({ kind: 'flip', from: [row, col], to: [row, col] });
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
        if (piece && piece.revealed && piece.color === this.state.turn) this.selectPiece(row, col);
    }

    selectPiece(row, col) {
        this.selected = [row, col];
        this.highlightMoves = this.variant === 'classic'
            ? generateClassicPieceMoves(this.state.board, row, col)
            : generateFlipPieceMoves(this.state.board, row, col);
        this.sound.play('select');
        this.renderBoard();
    }

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
        if (!this.dom.game?.board3d) return;
        if (this.renderer3d && this.rendererVariant === this.variant) return;
        this.renderer3d?.dispose();
        this.renderer3d = null;
        try {
            this.renderer3d = new JunqiRenderer3D(this.dom.game.board3d, { variant: this.variant });
            this.rendererVariant = this.variant;
            this.renderer3d.onCellClick(({ row, col }) => this.handleCellClick(row, col));
        } catch (err) {
            console.warn('[JunqiApp] 3D renderer unavailable.', err);
            this.use3D = true;
            this.renderer3d = null;
            this.rendererVariant = null;
            this.dom.game.board3d?.classList.add('hidden');
            this.dom.game.board?.classList.add('hidden');
            this.showMessage(i18n.t('renderer3DRequired'), 'error');
        }
    }

    render3DIfActive() {
        if (!this.use3D) return;
        this.ensureRenderer3D();
        if (!this.renderer3d || !this.state) return;
        this.renderer3d.syncBoard(this.state.board, {
            selected: this.selected,
            moves: this.highlightMoves,
            lastMove: this.state.moveHistory[this.state.moveHistory.length - 1],
            playerColor: this.options.playerColor || 'r',
            labelFont: 'bold 104px KaiTi, STKaiti, serif'
        });
    }

    renderStatus() {
        const { game } = this.dom;
        if (!game?.currentPlayer || !this.state) return;
        if (this.state.gameOver) game.currentPlayer.textContent = i18n.t('gameEnd');
        else if (this.variant === 'flip' && this.state.turn === null) game.currentPlayer.textContent = i18n.t('junqiFirstFlip');
        else game.currentPlayer.textContent = playerLabel(this.state.turn);
        if (game.moveCount) game.moveCount.textContent = String(this.state.moveHistory.length);
        const last = this.state.moveHistory[this.state.moveHistory.length - 1];
        if (game.lastMove) game.lastMove.textContent = last ? last.notation : '-';
        if (game.hint) {
            if (this.state.aiThinking) game.hint.textContent = i18n.t('aiThinkingMessage');
            else if (this.variant === 'classic') game.hint.textContent = i18n.t('junqiHintClassic');
            else if (this.state.turn === null) game.hint.textContent = i18n.t('junqiHintFirstFlip');
            else game.hint.textContent = i18n.t('junqiHintPlay');
        }
    }
}

export { FLIP_RANK_LEVEL as RANK_LEVEL, getFlipLegalMoves as getLegalMoves, generateFlipMoves };
