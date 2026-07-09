import { describe, it, expect } from 'vitest';
import {
  createBracket,
  isMatchReady,
  reportMatchResult,
  getReadyMatches,
  isTournamentComplete,
  getTournamentStatus,
} from './bracket.js';

describe('Tournament Bracket System', () => {
  describe('createBracket', () => {
    it('should create a bracket for exactly 2 players', () => {
      const players = [{ name: 'Alice' }, { name: 'Bob' }];
      const bracket = createBracket(players);

      expect(bracket.size).toBe(2);
      expect(bracket.numRounds).toBe(1);
      expect(bracket.rounds).toHaveLength(1);
      expect(bracket.champion).toBeNull();
      expect(bracket.rounds[0][0].player1.name).toBe('Alice');
      expect(bracket.rounds[0][0].player2.name).toBe('Bob');
    });

    it('should create a bracket for 4 players (2 rounds)', () => {
      const players = [
        { name: 'Alice' },
        { name: 'Bob' },
        { name: 'Carol' },
        { name: 'Dave' },
      ];
      const bracket = createBracket(players);

      expect(bracket.size).toBe(4);
      expect(bracket.numRounds).toBe(2);
      expect(bracket.rounds).toHaveLength(2);
      expect(bracket.rounds[0]).toHaveLength(2);
      expect(bracket.rounds[1]).toHaveLength(1);
    });

    it('should pad odd player count with BYEs', () => {
      const players = [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Carol' }];
      const bracket = createBracket(players);

      // Next power of 2 = 4, so 1 bye needed.
      // Top seed (Alice, index 0) should receive the bye — not the
      // last seed, which was the previous (incorrect) behavior.
      expect(bracket.size).toBe(4);
      expect(bracket.numRounds).toBe(2);

      // The BYE must be in match 0 (P1's match), not match 1.
      const byeMatch = bracket.rounds[0][0];
      expect(byeMatch.player1.name).toBe('Alice');
      expect(byeMatch.player2?.id).toBe('bye');
      expect(byeMatch.completed).toBe(true);
      expect(byeMatch.winner.name).toBe('Alice');

      // The other first-round match has two real players.
      expect(bracket.rounds[0][1].player2?.id).not.toBe('bye');
    });

    it('should auto-advance through BYEs in first round', () => {
      const players = [
        { name: 'Alice' },
        { name: 'BYE', id: 'bye' },
        { name: 'Bob' },
        { name: 'Carol' },
      ];
      const bracket = createBracket(players);

      expect(bracket.rounds[0][0].completed).toBe(true);
      expect(bracket.rounds[0][0].winner.name).toBe('Alice');
      expect(bracket.rounds[0][1].completed).toBe(false);
      expect(bracket.rounds[0][1].winner).toBeNull();
    });

    it('should create bracket for 8 players (3 rounds)', () => {
      const players = Array.from({ length: 8 }, (_, i) => ({
        name: `P${i + 1}`,
      }));
      const bracket = createBracket(players);

      expect(bracket.size).toBe(8);
      expect(bracket.numRounds).toBe(3);
      expect(bracket.rounds).toHaveLength(3);
      expect(bracket.rounds[0]).toHaveLength(4);
      expect(bracket.rounds[1]).toHaveLength(2);
      expect(bracket.rounds[2]).toHaveLength(1);
    });
  });

  describe('isMatchReady', () => {
    it('should return true when both players assigned and not completed', () => {
      const bracket = createBracket([
        { name: 'Alice' },
        { name: 'Bob' },
      ]);
      expect(isMatchReady(bracket, 0, 0)).toBe(true);
    });

    it('should return false when match is completed', () => {
      const bracket = createBracket([
        { name: 'Alice' },
        { name: 'Bob' },
      ]);
      reportMatchResult(bracket, 0, 0, bracket.rounds[0][0].player1);
      expect(isMatchReady(bracket, 0, 0)).toBe(false);
    });

    it('should return false when players are null (subsequent round)', () => {
      const bracket = createBracket([
        { name: 'Alice' },
        { name: 'Bob' },
        { name: 'Carol' },
        { name: 'Dave' },
      ]);
      // Round 1 match starts empty
      expect(isMatchReady(bracket, 1, 0)).toBe(false);
    });

    it('should return false for out-of-range indices', () => {
      const bracket = createBracket([{ name: 'Alice' }, { name: 'Bob' }]);
      expect(isMatchReady(bracket, 5, 0)).toBe(false);
      expect(isMatchReady(bracket, 0, 10)).toBe(false);
    });
  });

  describe('reportMatchResult', () => {
    it('should record winner and advance to next round', () => {
      const players = [
        { name: 'Alice' },
        { name: 'Bob' },
        { name: 'Carol' },
        { name: 'Dave' },
      ];
      const bracket = createBracket(players);

      // Play first match: Alice vs Bob
      const alice = bracket.rounds[0][0].player1;
      const result = reportMatchResult(bracket, 0, 0, alice, 3, 1);
      expect(result).toBe(true);
      expect(bracket.rounds[0][0].winner.name).toBe('Alice');
      expect(bracket.rounds[0][0].score1).toBe(3);
      expect(bracket.rounds[0][0].score2).toBe(1);
      expect(bracket.rounds[0][0].completed).toBe(true);

      // Winner advanced to next round
      expect(bracket.rounds[1][0].player1.name).toBe('Alice');
    });

    it('should advance second match winner to player2 slot', () => {
      const players = [
        { name: 'Alice' },
        { name: 'Bob' },
        { name: 'Carol' },
        { name: 'Dave' },
      ];
      const bracket = createBracket(players);

      // Play second match: Carol vs Dave
      const carol = bracket.rounds[0][1].player1;
      reportMatchResult(bracket, 0, 1, carol);

      expect(bracket.rounds[1][0].player2.name).toBe('Carol');
    });

    it('should set champion when final match is reported', () => {
      const players = [{ name: 'Alice' }, { name: 'Bob' }];
      const bracket = createBracket(players);

      reportMatchResult(bracket, 0, 0, bracket.rounds[0][0].player1);
      expect(bracket.champion.name).toBe('Alice');
    });

    it('should return false for invalid match index', () => {
      const bracket = createBracket([{ name: 'Alice' }, { name: 'Bob' }]);
      expect(reportMatchResult(bracket, 5, 0, null)).toBe(false);
    });

    it('should return false if match already completed', () => {
      const bracket = createBracket([{ name: 'Alice' }, { name: 'Bob' }]);
      reportMatchResult(bracket, 0, 0, bracket.rounds[0][0].player1);
      const result = reportMatchResult(
        bracket,
        0,
        0,
        bracket.rounds[0][0].player2
      );
      expect(result).toBe(false);
    });
  });

  describe('getReadyMatches', () => {
    it('should return first round matches when all players assigned', () => {
      const bracket = createBracket([
        { name: 'Alice' },
        { name: 'Bob' },
        { name: 'Carol' },
        { name: 'Dave' },
      ]);
      const ready = getReadyMatches(bracket);
      expect(ready).toHaveLength(2);
      expect(ready[0].round).toBe(0);
    });

    it('should return empty if all first round matches completed', () => {
      const bracket = createBracket([
        { name: 'Alice' },
        { name: 'Bob' },
        { name: 'Carol' },
        { name: 'Dave' },
      ]);
      reportMatchResult(bracket, 0, 0, bracket.rounds[0][0].player1);
      reportMatchResult(bracket, 0, 1, bracket.rounds[0][1].player1);
      const ready = getReadyMatches(bracket);
      expect(ready).toHaveLength(1); // Round 2 final
      expect(ready[0].round).toBe(1);
    });
  });

  describe('isTournamentComplete', () => {
    it('should return false initially', () => {
      const bracket = createBracket([{ name: 'Alice' }, { name: 'Bob' }]);
      expect(isTournamentComplete(bracket)).toBe(false);
    });

    it('should return true after final match', () => {
      const bracket = createBracket([{ name: 'Alice' }, { name: 'Bob' }]);
      reportMatchResult(bracket, 0, 0, bracket.rounds[0][0].player1);
      expect(isTournamentComplete(bracket)).toBe(true);
    });
  });

  describe('getTournamentStatus', () => {
    it('should report correct totals for 4-player bracket', () => {
      const bracket = createBracket([
        { name: 'Alice' },
        { name: 'Bob' },
        { name: 'Carol' },
        { name: 'Dave' },
      ]);
      const status = getTournamentStatus(bracket);
      expect(status.totalMatches).toBe(3);
      expect(status.completedMatches).toBe(0);
      expect(status.isComplete).toBe(false);
      expect(status.champion).toBeNull();
    });

    it('should show correct completed count after one match', () => {
      const bracket = createBracket([
        { name: 'Alice' },
        { name: 'Bob' },
        { name: 'Carol' },
        { name: 'Dave' },
      ]);
      reportMatchResult(bracket, 0, 0, bracket.rounds[0][0].player1);
      const status = getTournamentStatus(bracket);
      expect(status.completedMatches).toBe(1);
      expect(status.totalMatches).toBe(3);
    });

    it('should show isComplete true with champion after tournament', () => {
      const bracket = createBracket([{ name: 'Alice' }, { name: 'Bob' }]);
      reportMatchResult(bracket, 0, 0, bracket.rounds[0][0].player1);
      const status = getTournamentStatus(bracket);
      expect(status.isComplete).toBe(true);
      expect(status.champion.name).toBe('Alice');
      expect(status.completedMatches).toBe(status.totalMatches);
    });

    it('should handle full 8-player tournament walkthrough', () => {
      const players = Array.from({ length: 8 }, (_, i) => ({
        name: `P${i + 1}`,
      }));
      const bracket = createBracket(players);

      // Round 1: 4 matches
      reportMatchResult(bracket, 0, 0, bracket.rounds[0][0].player1);
      reportMatchResult(bracket, 0, 1, bracket.rounds[0][1].player1);
      reportMatchResult(bracket, 0, 2, bracket.rounds[0][2].player1);
      reportMatchResult(bracket, 0, 3, bracket.rounds[0][3].player1);

      // Round 2: 2 matches (semifinals)
      expect(isMatchReady(bracket, 1, 0)).toBe(true);
      expect(isMatchReady(bracket, 1, 1)).toBe(true);
      reportMatchResult(bracket, 1, 0, bracket.rounds[1][0].player1);
      reportMatchResult(bracket, 1, 1, bracket.rounds[1][1].player1);

      // Final
      expect(isMatchReady(bracket, 2, 0)).toBe(true);
      reportMatchResult(bracket, 2, 0, bracket.rounds[2][0].player1);

      const status = getTournamentStatus(bracket);
      expect(status.isComplete).toBe(true);
      expect(status.champion).not.toBeNull();
      expect(status.completedMatches).toBe(status.totalMatches);
    });
  });
});
