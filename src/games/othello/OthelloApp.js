/**
 * Othello (Reversi) application entry point.
 * Extends BoardGameApp with Othello-specific game logic.
 * @module games/othello/OthelloApp
 */

import { BoardGameApp } from "../../app/BoardGameApp.js";
import { createOthelloState, createOthelloOptions } from "./state.js";
import { createInitialBoard, getLegalMoves, makeMove, isGameOver, getWinner, countDiscs, BOARD_SIZE } from "./rules.js";

const PIECE_GLYPH = { black: "\u25CF", white: "\u25CB" };

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
        const result = makeMove(this.state.board, row, col, color);
        if (!result.success) return false;

        this.state.lastMove = { row, col, color };
        this.state.moveHistory.push({ row, col, color, flips: result.flipped.length });

        // Check game end (board full)
        const opponent = color === "black" ? "white" : "black";
        if (isGameOver(this.state.board)) {
            this.state.gameOver = true;
            const winner = getWinner(this.state.board);
            this.state.resultType = winner === "draw" ? "draw" : "win";
            this.state.resultWinnerColor = winner === "draw" ? null : winner;
            return true;
        }

        // Check if opponent has legal moves
        const opponentMoves = getLegalMoves(this.state.board, opponent);
        if (opponentMoves.length === 0) {
            // Opponent must pass — same player continues
            this.state.passCount++;
            if (this.state.passCount >= 2) {
                // Both players passed consecutively → game over
                this.state.gameOver = true;
                const winner = getWinner(this.state.board);
                this.state.resultType = winner === "draw" ? "draw" : "win";
                this.state.resultWinnerColor = winner === "draw" ? null : winner;
            }
            return true;
        }

        // Switch player and reset pass counter
        this.state.currentPlayer = opponent;
        this.state.passCount = 0;
        return true;
    }

    scheduleAIMove() {
        // Placeholder for AI integration
    }

    renderMoveList() {}
    updateStatus() {}
    showMessageKey(key, params, type) {}
    setAIThinking(v) { this.state.aiThinking = v; }
    clearPendingAI() {}
    clearCoachState() {}
    cancelLlmCoachRequest() {}
    clearPreview() {}
    clearPlacementSelection() {}
    refreshImmersiveUi() {}
    refreshCoachGuidance() {}
    use3D = false;
}

export { BOARD_SIZE as boardSize };
