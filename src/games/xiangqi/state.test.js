import { describe, it, expect } from 'vitest';
import {
    DEFAULT_XIANGQI_OPTIONS,
    createXiangqiOptions,
    createXiangqiState
} from './state.js';

describe('games/xiangqi/state', () => {
    describe('DEFAULT_XIANGQI_OPTIONS', () => {
        it('contains expected defaults', () => {
            expect(DEFAULT_XIANGQI_OPTIONS.mode).toBe('pvp');
            expect(DEFAULT_XIANGQI_OPTIONS.level).toBe('medium');
            expect(DEFAULT_XIANGQI_OPTIONS.playerColor).toBe('r');
        });

        it('is frozen', () => {
            expect(Object.isFrozen(DEFAULT_XIANGQI_OPTIONS)).toBe(true);
        });
    });

    describe('createXiangqiOptions', () => {
        it('returns defaults with no args', () => {
            expect(createXiangqiOptions()).toEqual(DEFAULT_XIANGQI_OPTIONS);
        });

        it('merges overrides', () => {
            const opts = createXiangqiOptions({ mode: 'pve', playerColor: 'b' });
            expect(opts.mode).toBe('pve');
            expect(opts.playerColor).toBe('b');
            expect(opts.level).toBe('medium');
        });
    });

    describe('createXiangqiState', () => {
        it('returns well-formed initial state', () => {
            const state = createXiangqiState();
            expect(state.turn).toBe('r');
            expect(state.gameOver).toBe(false);
            expect(state.aiThinking).toBe(false);
            expect(state.moveHistory).toEqual([]);
            expect(state.result).toBeNull();
        });

        it('starts with halfmoveClock=0, fullmoveNumber=1', () => {
            const state = createXiangqiState();
            expect(state.halfmoveClock).toBe(0);
            expect(state.fullmoveNumber).toBe(1);
        });

        it('board is 10x9', () => {
            const state = createXiangqiState();
            expect(state.board.length).toBe(10);
            state.board.forEach(row => expect(row.length).toBe(9));
        });

        it('board has correct initial placement', () => {
            const state = createXiangqiState();
            // xiangqi pieces are 2-char codes: color + role
            // black back rank (row 0)
            expect(state.board[0][0]).toBe('bR'); // rook
            expect(state.board[0][4]).toBe('bK'); // king/general
            // white/red back rank (row 9)
            expect(state.board[9][0]).toBe('rR');
            expect(state.board[9][4]).toBe('rK');
        });

        it('merges options with defaults', () => {
            const state = createXiangqiState({ mode: 'pve' });
            expect(state.options.mode).toBe('pve');
            expect(state.options.level).toBe('medium');
        });
    });
});
