import { describe, it, expect } from 'vitest';
import {
    DEFAULT_FLIP_OPTIONS,
    createFlipOptions,
    createFlipState
} from './state.js';

describe('games/junqi/flip/state', () => {
    describe('DEFAULT_FLIP_OPTIONS', () => {
        it('contains expected defaults', () => {
            expect(DEFAULT_FLIP_OPTIONS.mode).toBe('pvp');
            expect(DEFAULT_FLIP_OPTIONS.level).toBe('medium');
            expect(DEFAULT_FLIP_OPTIONS.playerColor).toBeNull();
            expect(DEFAULT_FLIP_OPTIONS.seed).toBeNull();
        });

        it('is frozen', () => {
            expect(Object.isFrozen(DEFAULT_FLIP_OPTIONS)).toBe(true);
        });
    });

    describe('createFlipOptions', () => {
        it('returns defaults with no args', () => {
            expect(createFlipOptions()).toEqual(DEFAULT_FLIP_OPTIONS);
        });

        it('merges overrides', () => {
            const opts = createFlipOptions({ mode: 'pve', level: 'hard' });
            expect(opts.mode).toBe('pve');
            expect(opts.level).toBe('hard');
            expect(opts.playerColor).toBeNull();
        });
    });

    describe('createFlipState', () => {
        it('returns well-formed initial state', () => {
            const state = createFlipState();
            expect(state.turn).toBeNull(); // first-flip undecided
            expect(state.players).toEqual({ r: null, b: null });
            expect(state.firstPlayer).toBe('p1');
            expect(state.gameOver).toBe(false);
            expect(state.result).toBeNull();
            expect(state.aiThinking).toBe(false);
            expect(state.moveHistory).toEqual([]);
            expect(state.lastCaptured).toBeNull();
        });

        it('board has dimensions', () => {
            const state = createFlipState();
            expect(state.board.length).toBeGreaterThan(0);
            state.board.forEach(row => expect(row.length).toBeGreaterThan(0));
        });

        it('merges options with defaults', () => {
            const state = createFlipState({ mode: 'pve' });
            expect(state.options.mode).toBe('pve');
            expect(state.options.level).toBe('medium');
        });
    });
});
