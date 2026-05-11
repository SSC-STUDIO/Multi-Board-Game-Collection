import { describe, it, expect } from 'vitest';
import {
    DEFAULT_CHESS_OPTIONS,
    createChessOptions,
    createChessState
} from './state.js';

describe('games/chess/state', () => {
    describe('DEFAULT_CHESS_OPTIONS', () => {
        it('contains expected defaults', () => {
            expect(DEFAULT_CHESS_OPTIONS.mode).toBe('pvp');
            expect(DEFAULT_CHESS_OPTIONS.level).toBe('medium');
            expect(DEFAULT_CHESS_OPTIONS.playerColor).toBe('w');
        });

        it('is frozen', () => {
            expect(Object.isFrozen(DEFAULT_CHESS_OPTIONS)).toBe(true);
        });
    });

    describe('createChessOptions', () => {
        it('returns defaults with no args', () => {
            expect(createChessOptions()).toEqual(DEFAULT_CHESS_OPTIONS);
        });

        it('merges overrides', () => {
            const opts = createChessOptions({ mode: 'pve', playerColor: 'b' });
            expect(opts.mode).toBe('pve');
            expect(opts.playerColor).toBe('b');
            expect(opts.level).toBe('medium');
        });
    });

    describe('createChessState', () => {
        it('returns well-formed initial state', () => {
            const state = createChessState();
            expect(state.turn).toBe('w');
            expect(state.gameOver).toBe(false);
            expect(state.aiThinking).toBe(false);
            expect(state.moveHistory).toEqual([]);
            expect(state.result).toBeNull();
        });

        it('has correct castling rights', () => {
            const state = createChessState();
            expect(state.castlingRights).toEqual({
                wK: true, wQ: true, bK: true, bQ: true
            });
        });

        it('starts with empty en passant target', () => {
            const state = createChessState();
            expect(state.enPassantTarget).toBeNull();
        });

        it('starts with halfmoveClock=0, fullmoveNumber=1', () => {
            const state = createChessState();
            expect(state.halfmoveClock).toBe(0);
            expect(state.fullmoveNumber).toBe(1);
        });

        it('board is 8x8', () => {
            const state = createChessState();
            expect(state.board.length).toBe(8);
            state.board.forEach(row => expect(row.length).toBe(8));
        });

        it('board has correct initial piece placement', () => {
            const state = createChessState();
            // row 0 = black back rank (rank 8), pieces are 2-char codes: color+role
            expect(state.board[0][0]).toBe('bR'); // rook
            expect(state.board[0][3]).toBe('bQ'); // queen
            expect(state.board[0][4]).toBe('bK'); // king
            expect(state.board[0][7]).toBe('bR');
            // row 1 = black pawns
            expect(state.board[1].every(p => p === 'bP')).toBe(true);
            // row 6 = white pawns
            expect(state.board[6].every(p => p === 'wP')).toBe(true);
            // row 7 = white back rank (rank 1)
            expect(state.board[7][0]).toBe('wR');
            expect(state.board[7][3]).toBe('wQ'); // queen
            expect(state.board[7][4]).toBe('wK'); // king
        });

        it('merges options with defaults', () => {
            const state = createChessState({ mode: 'pve' });
            expect(state.options.mode).toBe('pve');
            expect(state.options.level).toBe('medium');
        });
    });
});
