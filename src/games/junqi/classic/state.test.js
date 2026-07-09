import { describe, it, expect } from 'vitest';
import {
    DEFAULT_CLASSIC_OPTIONS,
    createClassicOptions,
    createClassicState
} from './state.js';

describe('games/junqi/classic/state', () => {
    describe('DEFAULT_CLASSIC_OPTIONS', () => {
        it('contains expected defaults', () => {
            expect(DEFAULT_CLASSIC_OPTIONS.mode).toBe('pve');
            expect(DEFAULT_CLASSIC_OPTIONS.level).toBe('medium');
            expect(DEFAULT_CLASSIC_OPTIONS.playerColor).toBe('r');
            expect(DEFAULT_CLASSIC_OPTIONS.templateIndex).toBe(0);
            expect(DEFAULT_CLASSIC_OPTIONS.aiTemplateIndex).toBe(1);
        });

        it('is frozen', () => {
            expect(Object.isFrozen(DEFAULT_CLASSIC_OPTIONS)).toBe(true);
        });
    });

    describe('createClassicOptions', () => {
        it('returns defaults with no args', () => {
            expect(createClassicOptions()).toEqual(DEFAULT_CLASSIC_OPTIONS);
        });

        it('merges overrides on top of defaults', () => {
            const opts = createClassicOptions({ level: 'hard', templateIndex: 2 });
            expect(opts.level).toBe('hard');
            expect(opts.templateIndex).toBe(2);
            expect(opts.mode).toBe('pve'); // unchanged
            expect(opts.playerColor).toBe('r'); // unchanged
        });
    });

    describe('createClassicState', () => {
        it('returns well-formed initial state', () => {
            const state = createClassicState();
            expect(state.turn).toBe('r');
            expect(state.playerColor).toBe('r');
            expect(state.gameOver).toBe(false);
            expect(state.result).toBeNull();
            expect(state.aiThinking).toBe(false);
            expect(state.moveHistory).toEqual([]);
            expect(state.lastBattle).toBeNull();
        });

        it('board has correct dimensions (13x5)', () => {
            const state = createClassicState();
            expect(state.board.length).toBe(13);
            state.board.forEach(row => expect(row.length).toBe(5));
        });

        it('board is populated with pieces (not empty)', () => {
            const state = createClassicState();
            const flat = state.board.flat();
            const pieceCount = flat.filter(cell => cell !== null).length;
            // Each side deploys 25 pieces = 50 total
            expect(pieceCount).toBe(50);
        });

        it('red pieces are revealed, blue pieces are hidden', () => {
            const state = createClassicState();
            for (const row of state.board) {
                for (const cell of row) {
                    if (cell?.color === 'r') {
                        expect(cell.revealed).toBe(true);
                    }
                    if (cell?.color === 'b') {
                        expect(cell.revealed).toBe(false);
                    }
                }
            }
        });

        it('playerColor matches the overridden option', () => {
            const state = createClassicState({ playerColor: 'b' });
            expect(state.playerColor).toBe('b');
            expect(state.turn).toBe('r'); // turn always starts with red
        });

        it('honors different template indices', () => {
            const stateA = createClassicState({ templateIndex: 0 });
            const stateB = createClassicState({ templateIndex: 1 });
            // Different templates produce different board layouts
            const piecesA = stateA.board.flat().filter(c => c?.color === 'r').map(p => p.rank);
            const piecesB = stateB.board.flat().filter(c => c?.color === 'r').map(p => p.rank);
            expect(piecesA).not.toEqual(piecesB);
        });

        it('merges options with defaults', () => {
            const state = createClassicState({ mode: 'pvp', level: 'hard' });
            expect(state.options.mode).toBe('pvp');
            expect(state.options.level).toBe('hard');
            expect(state.options.templateIndex).toBe(0); // default
        });
    });
});
