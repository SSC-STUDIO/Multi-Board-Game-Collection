/**
 * Shogi (Japanese Chess) application entry point.
 * Extends BoardGameApp with Shogi-specific game logic.
 * @module games/shogi/ShogiApp
 */

import { BoardGameApp } from "../../app/BoardGameApp.js";
import { createShogiState, createShogiOptions } from "./state.js";
import { createInitialBoard, getLegalMovesFiltered, makeMove, makeDrop, isInCheck, getPieceLabel, BOARD_SIZE, PIECES } from "./rules.js";
import { getShogiAIMove, getShogiAIDelay, generateAllMoves } from "./ai.js";
import { i18n } from "../../utils/i18n.js";

/** Demote a promoted piece type back to its unpromoted form on capture */
function demoteType(type) {
    for (const [key, val] of Object.entries(PIECES)) {
        if (val.promoted === type) return key;
    }
    return type;
}

export class ShogiApp extends BoardGameApp {
    constructor(root = document) {
        super(root, createShogiOptions());
        this.llmSettings = null;
        this.renderer3d = null;
    }

    queryDom(root) {
        return {
            root: root.getElementById("shogi-root"),
            setup: {
                panel: root.getElementById("shogi-setup"),
                mode: root.getElementById("shogi-mode-options"),
                level: root.getElementById("shogi-level-options"),
                levelRow: root.getElementById("shogi-level-row"),
                color: root.getElementById("shogi-color-options"),
                colorRow: root.getElementById("shogi-color-row"),
                size: null,
                sizeRow: null,
                start: root.getElementById("shogi-start-btn"),
                back: root.getElementById("shogi-back-btn")
            },
            game: {
                panel: root.getElementById("shogi-game"),
                board: root.getElementById("shogi-board"),
                board3d: root.getElementById("shogi-board-3d"),
                status: root.getElementById("shogi-status"),
                meta: root.getElementById("shogi-meta"),
                controls: root.getElementById("shogi-controls"),
                moveList: root.getElementById("shogi-move-list"),
                undoBtn: root.getElementById("shogi-undo-btn"),
                hintBtn: root.getElementById("shogi-hint-btn"),
                resignBtn: root.getElementById("shogi-resign-btn"),
                coachPanel: root.getElementById("shogi-coach-panel"),
                coachBtn: root.getElementById("shogi-coach-btn"),
                coachContent: root.getElementById("shogi-coach-content"),
                message: root.getElementById("shogi-message")
            },
            result: {
                overlay: root.getElementById("shogi-result-overlay"),
                summary: root.getElementById("shogi-result-summary"),
                nBtn: root.getElementById("shogi-postgame-btn"),
                nPanel: root.getElementById("shogi-postgame-panel"),
                nContent: root.getElementById("shogi-postgame-content"),
                newBtn: root.getElementById("shogi-new-game-btn"),
                backBtn: root.getElementById("shogi-result-back-btn")
            },
            message: root.getElementById("shogi-message"),
            langSwitch: root.getElementById("shogi-lang-switch")
        };
    }

    /** Bind setup panel events: mode/level/color option groups, start, back */
    bindSetupEvents() {
        const { setup } = this.dom;
        if (!setup) return;
        this.bindOptionGroup(setup.mode, 'mode', (v) => {
            this.options.mode = v;
            this.refreshSetupVisibility();
        });
        this.bindOptionGroup(setup.level, 'level', (v) => { this.options.level = v; });
        if (setup.color) {
            this.bindOptionGroup(setup.color, 'color', (v) => { this.options.playerColor = v; });
        }
        setup.start?.addEventListener('click', () => {
            this.sound.play('start');
            this.startGame();
        });
        this.bindBackToLauncher(setup.back);
    }

    /** Bind game panel events: board clicks, undo, resign, restart */
    bindGameEvents() {
        const { game, result } = this.dom;
        if (!game) return;
        game.board?.addEventListener('click', (event) => {
            const cell = event.target.closest('.cell');
            if (!cell) return;
            const row = Number(cell.dataset.row);
            const col = Number(cell.dataset.col);
            this.handleCellClick(row, col);
        });
        game.undoBtn?.addEventListener('click', () => this.handleUndo());
        game.hintBtn?.addEventListener('click', () => this.handleHint());
        game.resignBtn?.addEventListener('click', () => this.resign());
        result?.newBtn?.addEventListener('click', () => this.restart());
        result?.backBtn?.addEventListener('click', () => window.__returnToLauncher?.());
    }

    /** Toggle setup controls based on PvP / PvE mode */
    refreshSetupVisibility() {
        const pve = this.options.mode === 'pve';
        this.dom.setup?.levelRow?.classList.toggle('hidden', !pve);
        this.dom.setup?.colorRow?.classList.toggle('hidden', !pve);
    }

    createFreshState() {
        this.state = createShogiState(this.options);
    }

    /** Use base class enterSetup (panel toggles, hideResult, refreshSetupVisibility) */
    enterSetup() {
        super.enterSetup();
    }

    /** Use base class startGame (createInitialState, toggle panels, startGameImpl) */
    startGame() {
        super.startGame();
    }

    /** Post-start logic: schedule AI if PvE mode */
    startGameImpl() {
        this.maybeScheduleAI();
    }

    createInitialState() {
        return createShogiState(this.options);
    }

    /** Delegate renderBoard to render() */
    renderBoard() {
        this.render();
    }

    render() {
        if (!this.dom || !this.dom.game || !this.dom.game.board) return;
        const board = this.dom.game.board;
        board.replaceChildren();
        board.style.setProperty("--board-size", String(BOARD_SIZE));

        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                const cell = document.createElement("div");
                cell.className = "cell";
                cell.dataset.row = String(row);
                cell.dataset.col = String(col);

                // Highlight selected piece
                if (this.selected && this.selected.row === row && this.selected.col === col) {
                    cell.classList.add("selected");
                }
                // Highlight legal move destinations
                const isTarget = this.highlightMoves.some(mv => mv.row === row && mv.col === col);
                if (isTarget) {
                    cell.classList.add(this.state.board[row][col] ? "capture-target" : "move-target");
                }
                // Highlight AI-suggested move from the hint feature
                if (this.state.hintMove && this.state.hintMove.row === row && this.state.hintMove.col === col) {
                    cell.classList.add("cell-hint");
                }

                const piece = this.state.board[row][col];
                if (piece) {
                    const stone = document.createElement("div");
                    stone.className = "stone " + (piece.side === "sente" ? "black" : "white");
                    const label = document.createElement("span");
                    label.textContent = getPieceLabel(piece.type);
                    label.style.fontSize = "0.8em";
                    stone.appendChild(label);
                    cell.appendChild(stone);
                }

                board.appendChild(cell);
            }
        }
        this.renderStatus();
    }

    /** Board status display (turn indicator + AI thinking) */
    renderStatus() {
        const el = this.dom.game?.status;
        if (!el || !this.state) return;
        if (this.state.gameOver) {
            el.textContent = i18n.t('gameEnd') || 'Game Over';
            return;
        }
        const turnLabel = this.state.turn === 'sente'
            ? (i18n.t('shogiSente') || '先手') + ' (Sente)'
            : (i18n.t('shogiGote') || '後手') + ' (Gote)';
        const aiLabel = this.state.aiThinking ? ' — AI thinking…' : '';
        el.textContent = turnLabel + aiLabel;
    }

    renderMoveList() {
        const el = this.dom.game?.moveList;
        if (!el) return;
        el.replaceChildren();
        for (const [i, mv] of this.state.moveHistory.entries()) {
            const span = document.createElement("span");
            span.className = "move-entry";
            const side = mv.kind === 'drop' ? mv.side : this.state.board[mv.to[0]][mv.to[1]]?.side || '?';
            const tag = side === 'sente' ? '▲' : '△';
            const dest = `(${mv.to[0]},${mv.to[1]})`;
            if (mv.kind === 'drop') {
                span.textContent = `${i + 1}. ${tag} 打${getPieceLabel(mv.type)} ${dest}`;
            } else {
                const piece = this.state.board[mv.to[0]][mv.to[1]];
                const label = piece ? getPieceLabel(piece.type) : '?';
                const promo = mv.promote ? '成' : '';
                span.textContent = `${i + 1}. ${tag} ${label}${promo} ${dest}`;
            }
            el.appendChild(span);
        }
    }

    /** Handle a click on a board cell */
    handleCellClick(row, col) {
        if (!this.state || this.state.gameOver || this.state.aiThinking) return;
        if (!this.isHumanTurn()) return;
        this.state.hintMove = null;

        const piece = this.state.board[row][col];

        if (this.selected) {
            const { row: sr, col: sc } = this.selected;
            // Click same cell → deselect
            if (sr === row && sc === col) {
                this.selected = null;
                this.highlightMoves = [];
                this.render();
                return;
            }
            // Click a highlighted destination → commit move
            const candidate = this.highlightMoves.find(mv => mv.row === row && mv.col === col);
            if (candidate) {
                this.commitMove({
                    kind: 'board',
                    from: [sr, sc],
                    to: [row, col],
                    promote: candidate.promote || false
                });
                return;
            }
            // Click another own piece → switch selection
            if (piece && piece.side === this.state.turn) {
                this.selectPiece(row, col);
                return;
            }
            // Click elsewhere → deselect
            this.selected = null;
            this.highlightMoves = [];
            this.render();
            return;
        }

        // No piece selected: click own piece to select
        if (piece && piece.side === this.state.turn) {
            this.selectPiece(row, col);
        }
    }

    /** Select a piece and compute/highlight its legal moves */
    selectPiece(row, col) {
        this.selected = { row, col };
        const legalMoves = getLegalMovesFiltered(this.state.board, row, col);
        this.highlightMoves = legalMoves;
        if (legalMoves.length === 0) {
            this.showMessage('No legal moves from this piece', 'warn');
        }
        this.render();
    }

    /** Undo: in PvE mode revert 2 steps (AI + human), in PvP revert 1 step */
    handleUndo() {
        if (this.state.aiThinking || this.state.gameOver) return;
        const stepCount = this.options.mode === 'pve' && this.state.moveHistory.length >= 2 ? 2 : 1;
        if (this.state.moveHistory.length < stepCount) return;
        this.clearPendingAI();
        this.state.hintMove = null;

        for (let i = 0; i < stepCount; i++) {
            this.state.moveHistory.pop();
        }
        // Replay from initial board to reconstruct correct state
        const freshBoard = createInitialBoard();
        const freshHands = { sente: [], gote: [] };
        this.state.board = freshBoard;
        this.state.hands = freshHands;
        this.state.turn = 'sente';
        this.state.gameOver = false;
        this.state.lastMove = null;

        for (const mv of this.state.moveHistory) {
            if (mv.kind === 'drop') {
                const handArr = this.state.hands[mv.side];
                const idx = handArr.findIndex(p => p.type === mv.type);
                if (idx !== -1) handArr.splice(idx, 1);
                makeDrop(this.state.board, mv.type, mv.side, mv.to[0], mv.to[1]);
            } else {
                const piece = this.state.board[mv.from[0]][mv.from[1]];
                const captured = this.state.board[mv.to[0]][mv.to[1]];
                if (captured) {
                    const demoted = demoteType(captured.type);
                    this.state.hands[mv.side].push({ type: demoted, side: captured.side });
                }
                makeMove(this.state.board, mv.from[0], mv.from[1], mv.to[0], mv.to[1], mv.promote);
            }
            this.state.turn = this.state.turn === 'sente' ? 'gote' : 'sente';
        }

        const last = this.state.moveHistory[this.state.moveHistory.length - 1];
        this.state.lastMove = last ? { row: last.to[0], col: last.to[1] } : null;
        this.selected = null;
        this.highlightMoves = [];
        this.render();
        this.renderMoveList();
        this.maybeScheduleAI();
    }

    validateMove(row, col, side) {
        if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return "Invalid position";
        const piece = this.state.board[row][col];
        if (piece && piece.side === side) return "Cell occupied by own piece";
        return "";
    }

    /** Apply a move object (board move or drop) to the game state */
    commitMove(mv) {
        if (!mv) return;
        if (mv.kind === 'drop') {
            const handArr = this.state.hands[mv.side];
            const idx = handArr.findIndex(p => p.type === mv.type);
            if (idx !== -1) handArr.splice(idx, 1);
            makeDrop(this.state.board, mv.type, mv.side, mv.to[0], mv.to[1]);
        } else {
            const piece = this.state.board[mv.from[0]][mv.from[1]];
            const captured = this.state.board[mv.to[0]][mv.to[1]];
            if (captured) {
                const demoted = demoteType(captured.type);
                this.state.hands[mv.side].push({ type: demoted, side: captured.side });
            }
            makeMove(this.state.board, mv.from[0], mv.from[1], mv.to[0], mv.to[1], mv.promote);
        }
        this.state.moveHistory.push(mv);
        this.state.turn = this.state.turn === 'sente' ? 'gote' : 'sente';
        this.selected = null;
        this.highlightMoves = [];
        this.state.hintMove = null;
        this.state.lastMove = { row: mv.to[0], col: mv.to[1] };

        // Check for checkmate / stalemate before scheduling AI
        this.checkGameEnd();
        this.render();
        this.renderMoveList();
        if (this.state.gameOver) return;

        this.maybeScheduleAI();
    }

    /** Check for checkmate or stalemate and finalize the game */
    checkGameEnd() {
        if (!this.state || this.state.gameOver) return;
        const moves = generateAllMoves(this.state.board, this.state.turn, this.state.hands);
        if (moves.length > 0) return;
        this.state.gameOver = true;
        if (isInCheck(this.state.board, this.state.turn)) {
            const winner = this.state.turn === 'sente' ? 'gote' : 'sente';
            this.state.result = {
                type: 'checkmate',
                winner,
                badge: 'shogiCheckmateBadge',
                title: 'shogiCheckmateTitle',
                detail: 'shogiCheckmateDetail'
            };
        } else {
            // In Shogi, a side with no legal moves and not in check still loses
            const winner = this.state.turn === 'sente' ? 'gote' : 'sente';
            this.state.result = {
                type: 'stalemate',
                winner,
                badge: 'shogiStalemateBadge',
                title: 'shogiStalemateTitle',
                detail: 'shogiStalemateDetail'
            };
        }
        this.sound.play('win');
        this.render();
        this.showResult();
    }

    /** Format result overlay from state */
    formatResult() {
        const r = this.state?.result;
        if (!r) return { badge: '', title: '', detail: '' };
        const winnerLabel = r.winner === 'sente'
            ? i18n.t('shogiSente') || '先手'
            : i18n.t('shogiGote') || '後手';
        return {
            badge: i18n.t(r.badge) || '',
            title: (i18n.t(r.title) || '').replace('{player}', winnerLabel),
            detail: i18n.t(r.detail) || '',
        };
    }

    // === AI integration ===
    isHumanTurn() {
        if (this.options.mode !== 'pve') return true;
        return this.state.turn === this.options.playerColor;
    }

    handleHint() {
        if (this.state.aiThinking || this.state.gameOver) return;
        if (!this.isHumanTurn()) return;
        // Use the Shogi AI (hard level) to suggest the best move
        const mv = getShogiAIMove(this.state.board, this.state.turn, this.state.hands, 'hard');
        if (!mv) {
            this.showMessage(i18n.t('noHintAvailable') || 'No hint available', 'warn');
            return;
        }
        // Mark the destination cell for visual highlight
        this.state.hintMove = { row: mv.to[0], col: mv.to[1] };
        this.render();
        const label = mv.kind === 'drop'
            ? `Hint: drop ${mv.type} → (${mv.to[0]},${mv.to[1]})`
            : `Hint: (${mv.from[0]},${mv.from[1]}) → (${mv.to[0]},${mv.to[1]})`;
        this.showMessage(label, 'info');
    }

    getAIDelay() {
        return getShogiAIDelay(this.options.level);
    }

    getAIMove() {
        return getShogiAIMove(this.state.board, this.state.turn, this.state.hands, this.options.level);
    }

    onResign() {
        const winner = this.state.turn === 'sente' ? 'gote' : 'sente';
        this.state.result = {
            type: 'resign',
            winner,
            badge: 'shogiResignBadge',
            title: 'shogiResignTitle',
            detail: 'shogiResignDetail'
        };
    }

    dispose() {}

    setAIThinking(v) { this.state.aiThinking = v; }
    clearPendingAI() { this.clearAITimer(); }
    clearCoachState() {}
    clearPreview() {}
    clearPlacementSelection() {}
    refreshImmersiveUi() {}
    refreshCoachGuidance() {}
    use3D = false;
}

export { BOARD_SIZE as boardSize };
