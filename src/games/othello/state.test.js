/**
 * Othello state factory unit tests.
 * @module games/othello/state.test
 */

import { describe, it, expect } from 'vitest';
import { createOthelloOptions, createOthelloState, DEFAULT_OTHELLO_OPTIONS } from './state.js';
import { createInitialBoard, BOARD_SIZE } from './rules.js';

describe('games/othello/state', () => {
    describe('DEFAULT_OTHELLO_OPTIONS', () => {
        it('is frozen so options cannot be mutated', () => {
            expect(Object.isFrozen(DEFAULT_OTHELLO_OPTIONS)).toBe(true);
        });

        it('has sane defaults', () => {
            expect(DEFAULT_OTHELLO_OPTIONS.mode).toBe('pvp');
            expect(DEFAULT_OTHELLO_OPTIONS.level).toBe('medium');
            expect(DEFAULT_OTHELLO_OPTIONS.playerColor).toBe('black');
        });
    });

    describe('createOthelloOptions', () => {
        it('returns defaults when called with no args', () => {
            const opts = createOthelloOptions();
            expect(opts).toEqual({ ...DEFAULT_OTHELLO_OPTIONS });
        });

        it('merges overrides on top of defaults', () => {
            const opts = createOthelloOptions({ mode: 'pve', level: 'hard' });
            expect(opts.mode).toBe('pve');
            expect(opts.level).toBe('hard');
            expect(opts.playerColor).toBe('black'); // unchanged
        });

        it('does not mutate the frozen defaults', () => {
            createOthelloOptions({ mode: 'pve' });
            expect(DEFAULT_OTHELLO_OPTIONS.mode).toBe('pvp');
        });
    });

    describe('createOthelloState', () => {
        it('returns a well-formed initial state', () => {
            const state = createOthelloState();
            expect(state.currentPlayer).toBe('black');
            expect(state.gameOver).toBe(false);
            expect(state.result).toBeNull();
            expect(state.passCount).toBe(0);
            expect(state.moveHistory).toEqual([]);
            expect(state.aiThinking).toBe(false);
            expect(state.lastMove).toBeNull();
            expect(state.winningCells).toEqual([]);
            expect(state.selectedCell).toBeNull();
            expect(state.awaitingPlacementConfirm).toBe(false);
        });

        it('uses the standard Othello starting board', () => {
            const state = createOthelloState();
            expect(state.board).toEqual(createInitialBoard());
            expect(state.board.length).toBe(BOARD_SIZE);
            state.board.forEach((row) => expect(row.length).toBe(BOARD_SIZE));
        });

        it('size matches BOARD_SIZE constant', () => {
            const state = createOthelloState();
            expect(state.size).toBe(BOARD_SIZE);
            expect(state.size).toBe(8);
        });

        it('options merge provided overrides with defaults', () => {
            const state = createOthelloState({ mode: 'pve', level: 'hard' });
            expect(state.options.mode).toBe('pve');
            expect(state.options.level).toBe('hard');
            expect(state.options.playerColor).toBe('black');
        });

        it('coach fields default to empty/disabled values', () => {
            const state = createOthelloState();
            expect(state.coachSuggestion).toBeNull();
            expect(state.coachAlternatives).toEqual([]);
            expect(state.coachSource).toBe('local');
            expect(state.coachLlmStatus).toBe('idle');
            expect(state.coachInsight).toBe('');
            expect(state.coachRisk).toBe('');
            expect(state.coachPlan).toBe('');
            expect(state.coachConfidence).toBeNull();
            expect(state.coachFeedback).toBe('');
            expect(state.coachPreviewMode).toBe(false);
        });

        it('result-related fields are unset initially', () => {
            const state = createOthelloState();
            expect(state.resultType).toBeNull();
            expect(state.resultWinnerColor).toBeNull();
            expect(state.resultSummary).toBeNull();
            expect(state.commentary).toBe('');
        });

        it('each call produces an independent board instance', () => {
            const a = createOthelloState();
            const b = createOthelloState();
            expect(a.board).not.toBe(b.board);
            a.board[0][0] = 'black';
            expect(b.board[0][0]).toBeNull();
        });

        it('each call produces independent options', () => {
            const a = createOthelloState({ mode: 'pve' });
            const b = createOthelloState({ mode: 'pvp' });
            expect(a.options).not.toBe(b.options);
            expect(a.options.mode).toBe('pve');
            expect(b.options.mode).toBe('pvp');
        });
    });
});
