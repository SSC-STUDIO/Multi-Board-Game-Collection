import { describe, it, expect } from 'vitest';
import { DEFAULT_OPTIONS } from '../../config/gameConfig.js';
import {
    createOptions,
    createEmptyBoard,
    createGameState
} from './state.js';

describe('games/gomoku/state', () => {
    describe('createOptions', () => {
        it('returns defaults matching gameConfig when called with no args', () => {
            const opts = createOptions();
            expect(opts.mode).toBe(DEFAULT_OPTIONS.mode);
            expect(opts.rule).toBe(DEFAULT_OPTIONS.rule);
            expect(opts.size).toBe(DEFAULT_OPTIONS.size);
        });

        it('merges overrides on top of defaults', () => {
            const opts = createOptions({ mode: 'pve', size: 19 });
            expect(opts.mode).toBe('pve');
            expect(opts.size).toBe(19);
            expect(opts.rule).toBe('classic'); // unchanged
        });
    });

    describe('createEmptyBoard', () => {
        it('creates a square board of the given size', () => {
            const board = createEmptyBoard(3);
            expect(board.length).toBe(3);
            board.forEach(row => expect(row.length).toBe(3));
        });

        it('fills every cell with null', () => {
            const board = createEmptyBoard(15);
            for (const row of board) {
                for (const cell of row) {
                    expect(cell).toBeNull();
                }
            }
        });
    });

    describe('createGameState', () => {
        it('returns a well-formed initial state', () => {
            const state = createGameState({ size: 15 });
            expect(state.currentPlayer).toBe('black');
            expect(state.gameOver).toBe(false);
            expect(state.moveHistory).toEqual([]);
            expect(state.lastMove).toBeNull();
            expect(state.hintMove).toBeNull();
            expect(state.aiThinking).toBe(false);
            expect(state.winningCells).toEqual([]);
        });

        it('board matches the requested size', () => {
            const state = createGameState({ size: 19 });
            expect(state.board.length).toBe(19);
            expect(state.board[0].length).toBe(19);
        });

        it('options are merged with defaults', () => {
            const state = createGameState({ mode: 'pve' });
            expect(state.options.mode).toBe('pve');
            expect(state.options.size).toBe(15);
        });

        it('coach fields default to empty/disabled', () => {
            const state = createGameState({ size: 15 });
            expect(state.coachSuggestion).toBeNull();
            expect(state.coachAlternatives).toEqual([]);
            expect(state.coachSource).toBe('local');
            expect(state.coachLlmStatus).toBe('disabled');
        });
    });
});
