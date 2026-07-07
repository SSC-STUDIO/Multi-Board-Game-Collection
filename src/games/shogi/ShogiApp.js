/**
 * Shogi (Japanese Chess) application entry point.
 * Extends BoardGameApp with Shogi-specific game logic.
 * @module games/shogi/ShogiApp
 */

import { BoardGameApp } from "../../app/BoardGameApp.js";
import { createShogiState, createShogiOptions } from "./state.js";
import { createInitialBoard, getLegalMoves, makeMove, makeDrop, isInCheck, getPieceLabel, BOARD_SIZE, PIECES } from "./rules.js";

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
                size: null,
                sizeRow: null,
                startBtn: root.getElementById("shogi-start-btn"),
                backBtn: root.getElementById("shogi-back-btn")
            },
            game: {
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
                coachContent: root.getElementById("shogi-coach-content")
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

    createFreshState() {
        this.state = createShogiState(this.options);
    }

    enterSetup() {
        this.clearPendingAI();
        this.clearCoachState();
        this.state = createShogiState(this.options);
        if (this.dom && this.dom.setup && this.dom.setup.panel) {
            this.dom.setup.panel.classList.remove("hidden");
        }
        if (this.dom && this.dom.game && this.dom.game.board) {
            this.dom.game.board.classList.add("hidden");
        }
    }

    startGame() {
        this.state.gameOver = false;
        this.state.turn = "sente";
        this.state.moveHistory = [];
        this.state.hands = { sente: [], gote: [] };
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

        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                const cell = document.createElement("div");
                cell.className = "cell";
                cell.dataset.row = String(row);
                cell.dataset.col = String(col);

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
    }

    validateMove(row, col, side) {
        if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return "Invalid position";
        if (this.state.board[row][col] && this.state.board[row][col].side === side) return "Cell occupied by own piece";
        return "";
    }

    commitMove(row, col, side, opts = {}) {
        const piece = this.state.board[row][col];
        if (piece && piece.side !== side) {
            // Capture
            const captured = { type: piece.type, side: piece.side };
            this.state.hands[side].push(captured);
        }
        makeMove(this.state.board, row, col, row, col);
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
