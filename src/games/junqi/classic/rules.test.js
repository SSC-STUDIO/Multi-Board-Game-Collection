import { describe, it, expect } from 'vitest';
import { getClassicAIMove } from './ai.js';
import {
    CLASSIC_ROWS,
    CLASSIC_COLS,
    createEmptyClassicBoard,
    createInitialBoard,
    createClassicPiece,
    validateDeployment,
    isPlayable,
    isCamp,
    isHeadquarters,
    isMountain,
    isRail,
    getLegalMoves,
    generatePieceMoves,
    resolveBattle,
    applyMove,
    checkWinner
} from './rules.js';

function empty() {
    return createEmptyClassicBoard();
}

describe('games/junqi/classic/rules', () => {
    it('defines a 13x5 board with camps, headquarters, mountains and railways', () => {
        expect(CLASSIC_ROWS).toBe(13);
        expect(CLASSIC_COLS).toBe(5);
        expect(isMountain(6, 1)).toBe(true);
        expect(isPlayable(6, 1)).toBe(false);
        expect(isCamp(8, 1)).toBe(true);
        expect(isHeadquarters(12, 1)).toBe(true);
        expect(isRail(5, 2)).toBe(true);
        expect(isRail(6, 2)).toBe(true);
    });

    it('creates legal template deployments for both colors', () => {
        const board = createInitialBoard(0, 1);
        expect(validateDeployment(board, 'r')).toEqual({ valid: true, reason: null });
        expect(validateDeployment(board, 'b')).toEqual({ valid: true, reason: null });
    });

    it('rejects illegal flag and mine placement', () => {
        let board = empty();
        board[7][0] = createClassicPiece('r', 'F', true);
        expect(validateDeployment(board, 'r').reason).toBe('flag-headquarters');

        board = createInitialBoard();
        board[7][0] = createClassicPiece('r', 'M', true);
        expect(validateDeployment(board, 'r').reason).toBe('mine-back');
    });

    it('allows road moves by one connected step', () => {
        const board = empty();
        board[8][2] = createClassicPiece('r', 'C', true);
        const moves = generatePieceMoves(board, 8, 2);
        expect(moves.some((mv) => mv.to[0] === 8 && mv.to[1] === 1)).toBe(true);
        expect(moves.some((mv) => mv.to[0] === 7 && mv.to[1] === 2)).toBe(true);
    });

    it('allows straight railway movement and blocks through occupied pieces', () => {
        const board = empty();
        board[11][0] = createClassicPiece('r', 'S', true);
        board[9][0] = createClassicPiece('r', 'P', true);
        const moves = generatePieceMoves(board, 11, 0);
        expect(moves.some((mv) => mv.to[0] === 10 && mv.to[1] === 0)).toBe(true);
        expect(moves.some((mv) => mv.to[0] === 8 && mv.to[1] === 0)).toBe(false);
    });

    it('lets engineers turn across connected railway graph', () => {
        const board = empty();
        board[11][0] = createClassicPiece('r', 'E', true);
        const moves = generatePieceMoves(board, 11, 0);
        expect(moves.some((mv) => mv.to[0] === 7 && mv.to[1] === 2)).toBe(true);
    });

    it('prevents attacks into camps and moving out of headquarters', () => {
        const board = empty();
        board[8][0] = createClassicPiece('r', 'S', true);
        board[8][1] = createClassicPiece('b', 'P', false);
        board[12][1] = createClassicPiece('r', 'G', true);
        expect(generatePieceMoves(board, 8, 0).some((mv) => mv.to[0] === 8 && mv.to[1] === 1)).toBe(false);
        expect(generatePieceMoves(board, 12, 1)).toHaveLength(0);
    });

    it('resolves rank, bomb, mine and flag battles', () => {
        expect(resolveBattle(createClassicPiece('r', 'S'), createClassicPiece('b', 'G'))).toMatchObject({ defenderDies: true });
        expect(resolveBattle(createClassicPiece('r', 'X'), createClassicPiece('b', 'S'))).toEqual({ attackerDies: true, defenderDies: true, flagCaptured: false });
        expect(resolveBattle(createClassicPiece('r', 'E'), createClassicPiece('b', 'M'))).toMatchObject({ defenderDies: true });
        expect(resolveBattle(createClassicPiece('r', 'S'), createClassicPiece('b', 'M'))).toMatchObject({ attackerDies: true, defenderDies: false });
        expect(resolveBattle(createClassicPiece('r', 'P'), createClassicPiece('b', 'F'))).toMatchObject({ flagCaptured: true });
    });

    it('captures flags and detects winner', () => {
        const board = empty();
        board[11][1] = createClassicPiece('r', 'P', true);
        board[12][1] = createClassicPiece('b', 'F', false);
        const state = { turn: 'r', result: null };
        const move = { kind: 'capture', from: [11, 1], to: [12, 1], piece: board[11][1], capture: board[12][1] };
        const { board: after, state: next } = applyMove(board, state, move);
        expect(next.result).toEqual({ winner: 'r', reason: 'flag' });
        expect(checkWinner(after, next)).toEqual({ winner: 'r', reason: 'flag' });
    });

    it('generates legal moves for the side to move in the initial setup', () => {
        const board = createInitialBoard();
        expect(getLegalMoves(board, 'r').length).toBeGreaterThan(0);
    });
});
describe('games/junqi/classic/ai', () => {
    it('getClassicAIMove returns a move for hard mode', () => {
        const board = createInitialBoard();
        const state = {
            board,
            turn: 'r',
            options: { level: 'hard' }
        };
        const move = getClassicAIMove(state);
        expect(move).toBeDefined();
        expect(move.from).toBeDefined();
        expect(move.to).toBeDefined();
    });

    it('getClassicAIMove returns a move for medium mode', () => {
        const board = createInitialBoard();
        const state = {
            board,
            turn: 'r',
            options: { level: 'medium' }
        };
        const move = getClassicAIMove(state);
        expect(move).toBeDefined();
    });

    it('getClassicAIMove returns null for empty board', () => {
        const board = Array.from({ length: 13 }, () => Array(5).fill(null));
        const state = {
            board,
            turn: 'r',
            options: { level: 'easy' }
        };
        const move = getClassicAIMove(state);
        expect(move).toBeNull();
    });
});
