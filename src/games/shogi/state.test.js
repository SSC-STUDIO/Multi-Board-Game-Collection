import { describe, it, expect } from "vitest";
import { createShogiState, createShogiOptions, DEFAULT_SHOGI_OPTIONS } from "./state.js";
import { createInitialBoard, BOARD_SIZE } from "./rules.js";

describe("Shogi state", () => {
    describe("DEFAULT_SHOGI_OPTIONS", () => {
        it("is frozen", () => {
            expect(Object.isFrozen(DEFAULT_SHOGI_OPTIONS)).toBe(true);
        });

        it("has default mode, level, and playerColor", () => {
            expect(DEFAULT_SHOGI_OPTIONS.mode).toBe("pvp");
            expect(DEFAULT_SHOGI_OPTIONS.level).toBe("medium");
            expect(DEFAULT_SHOGI_OPTIONS.playerColor).toBe("sente");
        });
    });

    describe("createShogiOptions", () => {
        it("returns defaults when no overrides", () => {
            const opts = createShogiOptions();
            expect(opts).toEqual({ ...DEFAULT_SHOGI_OPTIONS });
        });

        it("applies overrides", () => {
            const opts = createShogiOptions({ mode: "pve", level: "hard" });
            expect(opts.mode).toBe("pve");
            expect(opts.level).toBe("hard");
            expect(opts.playerColor).toBe("sente");
        });

        it("does not mutate the frozen defaults", () => {
            createShogiOptions({ mode: "pve" });
            expect(DEFAULT_SHOGI_OPTIONS.mode).toBe("pvp");
        });
    });

    describe("createShogiState", () => {
        it("initializes the board from createInitialBoard", () => {
            const state = createShogiState();
            expect(state.board).toEqual(createInitialBoard());
            expect(state.board.length).toBe(BOARD_SIZE);
        });

        it("starts with sente to move", () => {
            expect(createShogiState().turn).toBe("sente");
        });

        it("starts with empty hands", () => {
            const state = createShogiState();
            expect(state.hands).toEqual({ sente: [], gote: [] });
        });

        it("honors option overrides", () => {
            const state = createShogiState({ mode: "pve", level: "easy" });
            expect(state.options.mode).toBe("pve");
            expect(state.options.level).toBe("easy");
        });

        it("initializes all game-flow flags", () => {
            const state = createShogiState();
            expect(state.moveHistory).toEqual([]);
            expect(state.result).toBeNull();
            expect(state.gameOver).toBe(false);
            expect(state.aiThinking).toBe(false);
            expect(state.lastMove).toBeNull();
            expect(state.winningCells).toEqual([]);
            expect(state.selectedCell).toBeNull();
            expect(state.awaitingPlacementConfirm).toBe(false);
        });

        it("initializes coach fields with safe defaults", () => {
            const state = createShogiState();
            expect(state.coachSuggestion).toBeNull();
            expect(state.coachAlternatives).toEqual([]);
            expect(state.coachSource).toBe("local");
            expect(state.coachLlmStatus).toBe("idle");
            expect(state.coachConfidence).toBeNull();
            expect(state.hintMove).toBeNull();
            expect(state.coachPreviewMode).toBe(false);
        });

        it("exposes board size", () => {
            expect(createShogiState().size).toBe(BOARD_SIZE);
        });
    });
});
