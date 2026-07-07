import { describe, it, expect } from "vitest";
import { createBracket, isMatchReady, reportMatchResult, getReadyMatches, isTournamentComplete, getTournamentStatus } from "./bracket.js";

describe("Tournament bracket", () => {
    describe("createBracket", () => {
        it("should create a bracket for 2 players", () => {
            const players = [{ name: "Alice" }, { name: "Bob" }];
            const bracket = createBracket(players);
            expect(bracket.size).toBe(2);
            expect(bracket.numRounds).toBe(1);
            expect(bracket.rounds[0].length).toBe(1);
            expect(bracket.rounds[0][0].player1.name).toBe("Alice");
            expect(bracket.rounds[0][0].player2.name).toBe("Bob");
        });

        it("should create a bracket for 4 players", () => {
            const players = [{ name: "A" }, { name: "B" }, { name: "C" }, { name: "D" }];
            const bracket = createBracket(players);
            expect(bracket.size).toBe(4);
            expect(bracket.numRounds).toBe(2);
            expect(bracket.rounds[0].length).toBe(2);
            expect(bracket.rounds[1].length).toBe(1);
        });

        it("should add byes for non-power-of-2 player counts", () => {
            const players = [{ name: "A" }, { name: "B" }, { name: "C" }];
            const bracket = createBracket(players);
            expect(bracket.size).toBe(4);
            expect(bracket.rounds[0][1].player2.id).toBe("bye");
            expect(bracket.rounds[0][1].winner.name).toBe("C");
        });
    });

    describe("isMatchReady", () => {
        it("should return true when both players are set", () => {
            const players = [{ name: "A" }, { name: "B" }];
            const bracket = createBracket(players);
            expect(isMatchReady(bracket, 0, 0)).toBe(true);
        });

        it("should return false when no players set", () => {
            const bracket = createBracket([{ name: "A" }, { name: "B" }]);
            bracket.rounds[0][0].player1 = null;
            bracket.rounds[0][0].player2 = null;
            expect(isMatchReady(bracket, 0, 0)).toBe(false);
        });

        it("should return false when only one player set", () => {
            const bracket = createBracket([{ name: "A" }, { name: "B" }]);
            bracket.rounds[0][0].player2 = null;
            expect(isMatchReady(bracket, 0, 0)).toBe(false);
        });
    });

    describe("reportMatchResult", () => {
        it("should record winner and advance to next round", () => {
            const players = [{ name: "A" }, { name: "B" }, { name: "C" }, { name: "D" }];
            const bracket = createBracket(players);
            reportMatchResult(bracket, 0, 0, { name: "A" }, 1, 0);
            expect(bracket.rounds[0][0].winner.name).toBe("A");
            expect(bracket.rounds[1][0].player1.name).toBe("A");
        });

        it("should set champion when final is completed", () => {
            const players = [{ name: "A" }, { name: "B" }];
            const bracket = createBracket(players);
            reportMatchResult(bracket, 0, 0, { name: "A" }, 1, 0);
            expect(bracket.champion.name).toBe("A");
        });

        it("should not allow reporting on completed match", () => {
            const players = [{ name: "A" }, { name: "B" }];
            const bracket = createBracket(players);
            reportMatchResult(bracket, 0, 0, { name: "A" }, 1, 0);
            expect(reportMatchResult(bracket, 0, 0, { name: "B" }, 0, 1)).toBe(false);
        });
    });

    describe("getReadyMatches", () => {
        it("should return initial matches for 4-player bracket", () => {
            const players = [{ name: "A" }, { name: "B" }, { name: "C" }, { name: "D" }];
            const bracket = createBracket(players);
            const ready = getReadyMatches(bracket);
            expect(ready.length).toBe(2);
            expect(ready[0].round).toBe(0);
        });

        it("should return next round match after first round is played", () => {
            const players = [{ name: "A" }, { name: "B" }, { name: "C" }, { name: "D" }];
            const bracket = createBracket(players);
            reportMatchResult(bracket, 0, 0, { name: "A" }, 1, 0);
            reportMatchResult(bracket, 0, 1, { name: "C" }, 1, 0);
            const ready = getReadyMatches(bracket);
            expect(ready.length).toBe(1);
            expect(ready[0].round).toBe(1);
        });
    });

    describe("isTournamentComplete", () => {
        it("should not be complete at start", () => {
            const players = [{ name: "A" }, { name: "B" }];
            const bracket = createBracket(players);
            expect(isTournamentComplete(bracket)).toBe(false);
        });

        it("should be complete after final", () => {
            const players = [{ name: "A" }, { name: "B" }];
            const bracket = createBracket(players);
            reportMatchResult(bracket, 0, 0, { name: "A" }, 1, 0);
            expect(isTournamentComplete(bracket)).toBe(true);
        });
    });

    describe("getTournamentStatus", () => {
        it("should report correct status", () => {
            const players = [{ name: "A" }, { name: "B" }, { name: "C" }, { name: "D" }];
            const bracket = createBracket(players);
            const status = getTournamentStatus(bracket);
            expect(status.totalMatches).toBe(3);
            expect(status.completedMatches).toBe(0);
            expect(status.isComplete).toBe(false);
        });
    });
});
