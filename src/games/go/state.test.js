import { describe, it, expect } from 'vitest';
import {
    DEFAULT_GO_OPTIONS,
    createGoOptions,
    createEmptyGoBoard,
    getHandicapPoints,
    createGoState
} from './state.js';

describe('games/go/state', () => {
    describe('DEFAULT_GO_OPTIONS', () => {
        it('contains expected default values', () => {
            expect(DEFAULT_GO_OPTIONS.size).toBe(19);
            expect(DEFAULT_GO_OPTIONS.komi).toBe(6.5);
            expect(DEFAULT_GO_OPTIONS.handicap).toBe(0);
            expect(DEFAULT_GO_OPTIONS.scoringRule).toBe('area');
            expect(DEFAULT_GO_OPTIONS.mode).toBe('pvp');
            expect(DEFAULT_GO_OPTIONS.playerColor).toBe('black');
        });

        it('is frozen', () => {
            expect(Object.isFrozen(DEFAULT_GO_OPTIONS)).toBe(true);
        });
    });

    describe('createGoOptions', () => {
        it('returns defaults with no args', () => {
            expect(createGoOptions()).toEqual(DEFAULT_GO_OPTIONS);
        });

        it('merges overrides', () => {
            const opts = createGoOptions({ size: 9, komi: 7.5 });
            expect(opts.size).toBe(9);
            expect(opts.komi).toBe(7.5);
            expect(opts.mode).toBe('pvp');
        });
    });

    describe('createEmptyGoBoard', () => {
        it('creates a square board of the given size', () => {
            const board = createEmptyGoBoard(9);
            expect(board.length).toBe(9);
            board.forEach(row => expect(row.length).toBe(9));
        });

        it('fills every cell with null', () => {
            const board = createEmptyGoBoard(13);
            for (const row of board) {
                for (const cell of row) {
                    expect(cell).toBeNull();
                }
            }
        });
    });

    describe('getHandicapPoints', () => {
        it('returns 9 points for 19路', () => {
            const pts = getHandicapPoints(19);
            expect(pts.length).toBe(9);
        });

        it('returns 9 points for 13路', () => {
            const pts = getHandicapPoints(13);
            expect(pts.length).toBe(9);
        });

        it('returns 9 points for 9路', () => {
            const pts = getHandicapPoints(9);
            expect(pts.length).toBe(9);
        });

        it('all points are within board bounds for each size', () => {
            for (const size of [9, 13, 19]) {
                const pts = getHandicapPoints(size);
                for (const { row, col } of pts) {
                    expect(row).toBeGreaterThanOrEqual(0);
                    expect(row).toBeLessThan(size);
                    expect(col).toBeGreaterThanOrEqual(0);
                    expect(col).toBeLessThan(size);
                }
            }
        });

        it('天元 is included for 9路 and 19路', () => {
            const center9 = Math.floor(9 / 2);
            expect(getHandicapPoints(9)).toEqual(
                expect.arrayContaining([expect.objectContaining({ row: center9, col: center9 })])
            );
            const center19 = Math.floor(19 / 2);
            expect(getHandicapPoints(19)).toEqual(
                expect.arrayContaining([expect.objectContaining({ row: center19, col: center19 })])
            );
        });
    });

    describe('createGoState', () => {
        it('returns well-formed initial state', () => {
            const state = createGoState();
            expect(state.currentPlayer).toBe('black');
            expect(state.gameOver).toBe(false);
            expect(state.captures).toEqual({ black: 0, white: 0 });
            expect(state.moveHistory).toEqual([]);
            expect(state.lastMove).toBeNull();
            expect(state.koPoint).toBeNull();
            expect(state.consecutivePasses).toBe(0);
        });

        it('board matches requested size', () => {
            const state = createGoState({ size: 9 });
            expect(state.board.length).toBe(9);
        });

        it('options are merged with defaults', () => {
            const state = createGoState({ size: 13 });
            expect(state.options.size).toBe(13);
            expect(state.options.komi).toBe(6.5);
        });

        describe('handicap', () => {
            it('places black stones for handicap >= 2', () => {
                const state = createGoState({ size: 19, handicap: 4 });
                const blackCount = state.board.flat().filter(c => c === 'black').length;
                expect(blackCount).toBe(4);
            });

            it('sets current player to white after handicap', () => {
                const state = createGoState({ size: 19, handicap: 2 });
                expect(state.currentPlayer).toBe('white');
            });

            it('records handicap stones in moveHistory', () => {
                const state = createGoState({ size: 19, handicap: 3 });
                expect(state.moveHistory.length).toBe(3);
                state.moveHistory.forEach(m => {
                    expect(m.color).toBe('black');
                    expect(m.handicap).toBe(true);
                });
            });

            it('clamps handicap to 0-9', () => {
                const state = createGoState({ size: 19, handicap: 15 });
                const blackCount = state.board.flat().filter(c => c === 'black').length;
                expect(blackCount).toBeLessThanOrEqual(9);
            });

            it('no handicap stones for handicap < 2', () => {
                const state = createGoState({ size: 19, handicap: 1 });
                const blackCount = state.board.flat().filter(c => c === 'black').length;
                expect(blackCount).toBe(0);
                expect(state.currentPlayer).toBe('black');
            });
        });
    });
});
