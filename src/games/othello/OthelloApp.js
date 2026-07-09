/**
 * Othello (Reversi) application entry point.
 * Extends BoardGameApp with Othello-specific game logic.
 * @module games/othello/OthelloApp
 */

import { BoardGameApp } from "../../app/BoardGameApp.js";
import { createOthelloState, createOthelloOptions } from "./state.js";
import { createInitialBoard, getLegalMoves, makeMove, isGameOver, getWinner, countDiscs, BOARD_SIZE } from "./rules.js";
import { getOthelloAIMove, getOthelloAIDelay, resetTranspositionTable } from "./ai.js";
import { i18n } from "../../utils/i18n.js";
import { formatMove } from "../../utils/formatters.js";

const PIECE_GLYPH = { black: "\u25CF", white: "\u25CB" };
const opponent = (c) => c === "black" ? "white" : "black";

/** Return localized player label for result overlay */
function getPlayerLabel(color) {
    return color === "black"
        ? (i18n.t("othelloBlack") || "Black")
        : (i18n.t("othelloWhite") || "White");
}

export class OthelloApp extends BoardGameApp {
    constructor(root = document) {
        super(root, createOthelloOptions());
        this.renderer3d = null;
    }

    queryDom(root) {
        return {
            root: root.getElementById("othello-root"),
            setup: {
                panel: root.getElementById("othello-setup"),
                mode: root.getElementById("othello-mode-options"),
                level: root.getElementById("othello-level-options"),
                levelRow: root.getElementById("othello-level-row"),
                size: null,
                sizeRow: null,
                startBtn: root.getElementById("othello-start-btn"),
                backBtn: root.getElementById("othello-back-btn")
            },
            game: {
                board: root.getElementById("othello-board"),
                board3d: root.getElementById("othello-board-3d"),
                status: root.getElementById("othello-status"),
                meta: root.getElementById("othello-meta"),
                controls: root.getElementById("othello-controls"),
                moveList: root.getElementById("othello-move-list"),
                undoBtn: root.getElementById("othello-undo-btn"),
                hintBtn: root.getElementById("othello-hint-btn"),
                resignBtn: root.getElementById("othello-resign-btn"),
                coachPanel: root.getElementById("othello-coach-panel"),
                coachBtn: root.getElementById("othello-coach-btn"),
                coachContent: root.getElementById("othello-coach-content")
            },
            result: {
                overlay: root.getElementById("othello-result-overlay"),
                summary: root.getElementById("othello-result-summary"),
                nBtn: root.getElementById("othello-postgame-btn"),
                nPanel: root.getElementById("othello-postgame-panel"),
                nContent: root.getElementById("othello-postgame-content"),
                newBtn: root.getElementById("othello-new-game-btn"),
                backBtn: root.getElementById("othello-result-back-btn")
            },
            message: root.getElementById("othello-message"),
            langSwitch: root.getElementById("othello-lang-switch")
        };
    }

    createFreshState() {
        this.state = createOthelloState(this.options);
    }

    enterSetup() {
        this.clearPendingAI();
        this.clearCoachState();
        this.state = createOthelloState(this.options);
        if (this.dom && this.dom.setup && this.dom.setup.panel) {
            this.dom.setup.panel.classList.remove("hidden");
        }
        if (this.dom && this.dom.game && this.dom.game.board) {
            this.dom.game.board.classList.add("hidden");
        }
    }

    startGame() {
        this.state.gameOver = false;
        this.state.currentPlayer = "black";
        this.state.moveHistory = [];
        this.state.passCount = 0;
        // Clear the AI transposition table so stale board-state scores
        // from the previous match don't leak into this one.
        resetTranspositionTable();
        if (this.dom && this.dom.setup && this.dom.setup.panel) {
            this.dom.setup.panel.classList.add("hidden");
        }
        if (this.dom && this.dom.game && this.dom.game.board) {
            this.dom.game.board.classList.remove("hidden");
        }
        this.render();
    }

    render() {
        if (!this.dom || !this.dom.game || !this.dom.game.board) return;
        const board = this.dom.game.board;
        board.replaceChildren();
        board.style.setProperty("--board-size", String(BOARD_SIZE));

        const legalMoves = this.state.gameOver ? [] : getLegalMoves(this.state.board, this.state.currentPlayer);

        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                const cell = document.createElement("div");
                cell.className = "cell";
                cell.dataset.row = String(row);
                cell.dataset.col = String(col);

                const color = this.state.board[row][col];
                if (color) {
                    const stone = document.createElement("div");
                    stone.className = "stone " + color;
                    cell.appendChild(stone);
                } else if (legalMoves.some(m => m.row === row && m.col === col)) {
                    cell.classList.add("cell-hint");
                }

                // Highlight AI-suggested move from the hint feature
                if (this.state.hintMove && this.state.hintMove.row === row && this.state.hintMove.col === col) {
                    cell.classList.add("cell-suggested");
                }

                board.appendChild(cell);
            }
        }
    }

    validateMove(row, col, color) {
        if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return "Invalid position";
        if (this.state.board[row][col] !== null) return "Cell occupied";
        return "";
    }

    commitMove(row, col, color, opts = {}) {
        // Support single-object form from AI pipeline: commitMove({ row, col })
        if (typeof row === "object" && row !== null) {
            const mv = row;
            row = mv.row;
            col = mv.col;
            color = this.state.currentPlayer;
            opts = mv.opts || {};
        }
        // Clear any hint highlight when a move is committed
        this.state.hintMove = null;
        const result = makeMove(this.state.board, row, col, color);
        if (!result.success) return false;

        this.state.lastMove = { row, col, color };
        // Store flipped coordinates for undo support
        const flippedCoords = (result.flipped || []).map(f => ({ row: f.row, col: f.col }));
        this.state.moveHistory.push({ row, col, color, flips: result.flipped.length, flippedCoords });

        // Check game end (board full)
        if (isGameOver(this.state.board)) {
            this.state.gameOver = true;
            const winner = getWinner(this.state.board);
            this.state.resultType = winner === "draw" ? "draw" : "win";
            this.state.resultWinnerColor = winner === "draw" ? null : winner;
            this._finalizeResult(winner);
            this.render();
            this.renderMoveList();
            return true;
        }

        // Check if opponent has legal moves
        const opp = opponent(color);
        const opponentMoves = getLegalMoves(this.state.board, opp);
        if (opponentMoves.length === 0) {
            // Opponent must pass — same player continues
            this.state.passCount++;
            if (this.state.passCount >= 2) {
                // Both players passed consecutively → game over
                this.state.gameOver = true;
                const winner = getWinner(this.state.board);
                this.state.resultType = winner === "draw" ? "draw" : "win";
                this.state.resultWinnerColor = winner === "draw" ? null : winner;
                this._finalizeResult(winner);
            }
            this.render();
            this.renderMoveList();
            // Re-evaluate AI scheduling: in PvE, if the pass makes it the
            // AI's turn again, the AI must be re-scheduled to move.
            this.maybeScheduleAI();
            return true;
        }

        // Switch player and reset pass counter
        this.state.currentPlayer = opp;
        this.state.passCount = 0;
        this.render();
        this.renderMoveList();
        this.maybeScheduleAI();
        return true;
    }

    // === AI lifecycle hooks (BoardGameApp overrides) ===

    isHumanTurn() {
        if (this.options.mode !== "pve") return true;
        return this.state.currentPlayer === this.options.playerColor;
    }

    getAIMove() {
        const aiColor = opponent(this.options.playerColor);
        return getOthelloAIMove(this.state.board, aiColor, this.options.level);
    }

    getAIDelay() {
        return getOthelloAIDelay(this.options.level);
    }

    // === Board interaction ===

    handleCellClick(row, col) {
        if (!this.state || this.state.gameOver || this.state.aiThinking) return;
        if (!this.isHumanTurn()) return;

        const err = this.validateMove(row, col, this.state.currentPlayer);
        if (err) {
            this.showMessageKey("invalidMove", [], "warn");
            return;
        }

        this.commitMove(row, col, this.state.currentPlayer);
    }

    renderStatus() {
        const el = this.dom?.game?.status;
        if (!el || !this.state) return;
        const label = this.state.currentPlayer === "black" ? "\u26ab Black" : "\u26aa White";
        const aiLabel = this.state.aiThinking ? " \u2014 AI thinking\u2026" : "";
        el.textContent = label + aiLabel;
    }

    renderMoveList() {
        const el = this.dom?.game?.moveList;
        if (!el) return;
        el.innerHTML = "";
        for (const [i, mv] of this.state.moveHistory.entries()) {
            const span = document.createElement("span");
            span.className = "move-entry";
            const glyph = mv.color === "black" ? "\u26ab" : "\u26aa";
            span.textContent = `${i + 1}. ${glyph} (${mv.row},${mv.col})`;
            el.appendChild(span);
        }
    }

    showMessageKey(key, params, type) {
        const el = this.dom?.message;
        if (!el) return;
        let text = i18n.t(key);
        if (params && params.length) {
            for (const p of params) {
                text = text.replace(/\{[^}]+\}/, p);
            }
        }
        el.textContent = text || key;
        el.className = "message " + (type || "info");
        clearTimeout(this._messageTimer);
        this._messageTimer = setTimeout(() => { el.textContent = ""; }, 3000);
    }

    showMessage(msg, type) {
        this.showMessageKey(msg, [], type);
    }

    clearPendingAI() {
        this.clearAITimer();
    }

    setAIThinking(v) { if (this.state) this.state.aiThinking = v; }

    clearCoachState() {}

    cancelLlmCoachRequest() {}

    clearPreview() {}

    clearPlacementSelection() {}

    refreshImmersiveUi() {}

    refreshCoachGuidance() {}

    // === Event binding ===

    bindSetupEvents() {
        const { setup } = this.dom;
        setup?.startBtn?.addEventListener("click", () => this.startGame());
        setup?.backBtn?.addEventListener("click", () => window.__returnToLauncher?.());
    }

    bindGameEvents() {
        const { game, result } = this.dom;
        game?.board?.addEventListener("click", (event) => {
            const cell = event.target?.closest?.(".cell");
            if (!cell) return;
            const row = Number(cell.dataset.row);
            const col = Number(cell.dataset.col);
            if (Number.isNaN(row) || Number.isNaN(col)) return;
            this.handleCellClick(row, col);
        });
        game?.undoBtn?.addEventListener("click", () => this.handleUndo());
        game?.hintBtn?.addEventListener("click", () => this.handleHint());
        game?.resignBtn?.addEventListener("click", () => this.handleResign());
        result?.newBtn?.addEventListener("click", () => this.enterSetup());
        result?.backBtn?.addEventListener("click", () => window.__returnToLauncher?.());
    }

    // === Undo (replays from initial board + remaining history) ===

    handleUndo() {
        if (this.state.aiThinking || this.state.gameOver) return;
        const stepCount = this.options.mode === "pve" ? 2 : 1;
        if (this.state.moveHistory.length < stepCount) return;

        for (let i = 0; i < stepCount; i++) {
            this.state.moveHistory.pop();
        }
        // Replay from initial board to reconstruct correct state
        this.state.board = createInitialBoard();
        for (const mv of this.state.moveHistory) {
            makeMove(this.state.board, mv.row, mv.col, mv.color);
        }
        const last = this.state.moveHistory[this.state.moveHistory.length - 1];
        this.state.currentPlayer = last ? opponent(last.color) : "black";
        this.state.passCount = 0;
        this.state.lastMove = last || null;
        this.state.gameOver = false;
        this.render();
        this.renderMoveList();
    }

    handleResign() {
        if (this.state.aiThinking || this.state.gameOver) return;
        this.clearPendingAI();
        this.state.gameOver = true;
        this.state.resultType = "resign";
        const winnerColor = opponent(this.state.currentPlayer);
        this.state.resultWinnerColor = winnerColor;
        this.state.result = {
            type: "resign",
            winner: winnerColor,
            badge: "othelloResignBadge",
            title: "othelloResignTitle",
            detail: "othelloResignDetail"
        };
        this.showResult();
        this.render();
    }

    // === Result overlay ===

    /** Build state.result from resultType/resultWinnerColor and show the overlay. */
    _finalizeResult(winner) {
        const isDraw = winner === "draw" || winner === null || winner === undefined;

        if (isDraw) {
            this.state.result = {
                type: "draw",
                winner: null,
                badge: "othelloDrawBadge",
                title: "othelloDrawTitle",
                detail: "othelloDrawDetail"
            };
        } else {
            this.state.result = {
                type: "win",
                winner,
                badge: "othelloWinBadge",
                title: "othelloWinTitle",
                detail: "othelloWinDetail"
            };
        }

        this.showResult();
    }

    /** Format result data from state.result into i18n labels for the overlay. */
    formatResult() {
        const r = this.state?.result;
        if (!r) return { badge: "", title: "", detail: "" };
        const winnerLabel = r.winner ? getPlayerLabel(r.winner) : "";
        return {
            badge: (i18n.t(r.badge) || "").replace("{player}", winnerLabel),
            title: (i18n.t(r.title) || "").replace("{player}", winnerLabel),
            detail: i18n.t(r.detail) || ""
        };
    }

    handleHint() {
        if (this.state.aiThinking || this.state.gameOver) {
            this.sound.play('error');
            return;
        }
        if (!this.isHumanTurn()) {
            this.sound.play('error');
            return;
        }

        // Use the Othello AI (hard level) to suggest the best move
        const move = getOthelloAIMove(this.state.board, this.state.currentPlayer, "hard");
        if (!move) {
            this.sound.play('error');
            this.showMessageKey("noHintAvailable", [], "warn");
            return;
        }

        this.state.hintMove = { row: move.row, col: move.col };
        this.sound.play('select');
        this.render();
        this.showMessageKey("hintSuggestionMessage", [formatMove(move.row, move.col)], "info");
    }

    // === Cleanup ===

    use3D = false;

    dispose() {
        this.clearPendingAI();
        super.dispose?.();
    }
}

export { BOARD_SIZE as boardSize };
