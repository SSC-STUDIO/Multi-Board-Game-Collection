import { describe, it, expect } from 'vitest';
import { getClassicAIMove, getClassicAIDelay } from './ai.js';
import {
    CLASSIC_ROWS,
    CLASSIC_COLS,
    RANK_LEVEL,
    ROSTER,
    COLORS,
    oppositeColor,
    mirrorRank,
    cloneBoard,
    createEmptyClassicBoard,
    createInitialBoard,
    createClassicPiece,
    applyTemplate,
    validateDeployment,
    isPlayable,
    isCamp,
    isHeadquarters,
    isMountain,
    isRail,
    findFlag,
    revealColor,
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

    it('applyMove handles a non-capture move correctly', () => {
        const board = createEmptyClassicBoard();
        board[8][0] = createClassicPiece('r', 'S', true);
        board[5][0] = createClassicPiece('b', 'G', false);
        const state = { turn: 'r', result: null };
        const move = { kind: 'move', from: [8, 0], to: [7, 0], piece: board[8][0] };
        const { board: after, state: next } = applyMove(board, state, move);
        expect(after[8][0]).toBeNull();
        expect(after[7][0]).not.toBeNull();
        expect(after[7][0].color).toBe('r');
        expect(after[7][0].rank).toBe('S');
        expect(next.turn).toBe('b');
        expect(next.result).toBeNull();
    });

    it('applyMove handles attacker death (leaves defender in place)', () => {
        const board = createEmptyClassicBoard();
        board[8][0] = createClassicPiece('r', 'C', true);
        board[7][0] = createClassicPiece('b', 'S', false);
        const state = { turn: 'r', result: null };
        const move = { kind: 'capture', from: [8, 0], to: [7, 0], piece: board[8][0], capture: board[7][0] };
        const { board: after, state: next } = applyMove(board, state, move);
        expect(after[7][0].color).toBe('b');
        expect(after[7][0].rank).toBe('S');
        expect(after[7][0].revealed).toBe(true);
        expect(next.lastBattle).not.toBeNull();
        expect(next.lastBattle.result.attackerDies).toBe(true);
    });

    it('applyMove handles mutual destruction (bomb)', () => {
        const board = createEmptyClassicBoard();
        board[8][0] = createClassicPiece('r', 'X', true);
        board[7][0] = createClassicPiece('b', 'S', false);
        const state = { turn: 'r', result: null };
        const move = { kind: 'capture', from: [8, 0], to: [7, 0], piece: board[8][0], capture: board[7][0] };
        const { board: after } = applyMove(board, state, move);
        expect(after[8][0]).toBeNull();
        expect(after[7][0]).toBeNull();
    });

    it('checkWinner detects stalemate when one side has no legal moves', () => {
        const board = createEmptyClassicBoard();
        board[12][1] = createClassicPiece('r', 'F', true);
        board[12][3] = createClassicPiece('r', 'S', true);
        board[0][1] = createClassicPiece('b', 'F', false);
        board[0][0] = createClassicPiece('b', 'S', false);
        const state = { turn: 'b', result: null };
        const rMoves = getLegalMoves(board, 'r');
        expect(rMoves).toHaveLength(0);
        expect(checkWinner(board, state)).toEqual({ winner: 'b', reason: 'stalemate' });
    });

    it('checkWinner returns null when game is ongoing', () => {
        const board = createInitialBoard();
        const state = { turn: 'r', result: null };
        expect(checkWinner(board, state)).toBeNull();
    });
});
describe('games/junqi/classic/constants', () => {
    it('COLORS contains red and blue', () => {
        expect(COLORS).toEqual(['r', 'b']);
    });

    it('RANK_LEVEL orders ranks highest to lowest correctly', () => {
        expect(RANK_LEVEL.S).toBe(9);
        expect(RANK_LEVEL.G).toBe(8);
        expect(RANK_LEVEL.F).toBe(0);
        expect(RANK_LEVEL.M).toBe(0);
        expect(RANK_LEVEL.S).toBeGreaterThan(RANK_LEVEL.R);
        expect(RANK_LEVEL.R).toBeGreaterThan(RANK_LEVEL.P);
    });

    it('ROSTER defines correct piece counts per rank', () => {
        expect(ROSTER.S).toBe(1);
        expect(ROSTER.G).toBe(1);
        expect(ROSTER.X).toBe(2);
        expect(ROSTER.E).toBe(3);
        expect(ROSTER.M).toBe(3);
        expect(ROSTER.F).toBe(1);
        const total = Object.values(ROSTER).reduce((s, v) => s + v, 0);
        expect(total).toBe(25);
    });
});

describe('games/junqi/classic/rules/utils', () => {
    it('oppositeColor returns the other color', () => {
        expect(oppositeColor('r')).toBe('b');
        expect(oppositeColor('b')).toBe('r');
    });

    it('mirrorRank returns the same rank unchanged', () => {
        expect(mirrorRank('S')).toBe('S');
        expect(mirrorRank('G')).toBe('G');
        expect(mirrorRank('X')).toBe('X');
    });

    it('cloneBoard creates a deep independent copy', () => {
        const board = createEmptyClassicBoard();
        board[0][0] = createClassicPiece('r', 'S', true);
        board[1][1] = createClassicPiece('b', 'G', false);
        const copy = cloneBoard(board);
        expect(copy[0][0]).toEqual({ color: 'r', rank: 'S', revealed: true });
        expect(copy[1][1]).toEqual({ color: 'b', rank: 'G', revealed: false });
        copy[0][0].rank = 'P';
        expect(board[0][0].rank).toBe('S');
    });

    it('applyTemplate deploys pieces to correct rows for red', () => {
        const board = createEmptyClassicBoard();
        const deployed = applyTemplate(board, 'r', 0);
        let filled = 0;
        for (let r = 7; r < CLASSIC_ROWS; r += 1) {
            for (let c = 0; c < CLASSIC_COLS; c += 1) {
                if (deployed[r][c] !== null) filled += 1;
            }
        }
        expect(filled).toBe(25);
        for (let r = 0; r < 7; r += 1) {
            for (let c = 0; c < CLASSIC_COLS; c += 1) {
                expect(deployed[r][c]).toBeNull();
            }
        }
    });

    it('applyTemplate deploys pieces to correct rows for blue', () => {
        const board = createEmptyClassicBoard();
        const deployed = applyTemplate(board, 'b', 0);
        let filled = 0;
        for (let r = 0; r <= 5; r += 1) {
            for (let c = 0; c < CLASSIC_COLS; c += 1) {
                if (deployed[r][c] !== null) filled += 1;
            }
        }
        expect(filled).toBe(25);
        for (let r = 6; r < CLASSIC_ROWS; r += 1) {
            for (let c = 0; c < CLASSIC_COLS; c += 1) {
                expect(deployed[r][c]).toBeNull();
            }
        }
    });

    it('applyTemplate validates all 3 template indices produce valid deployments', () => {
        const board = createEmptyClassicBoard();
        for (let i = 0; i < 3; i += 1) {
            const rDeployed = applyTemplate(board, 'r', i);
            expect(validateDeployment(rDeployed, 'r')).toEqual({ valid: true, reason: null });
            const bDeployed = applyTemplate(board, 'b', i);
            expect(validateDeployment(bDeployed, 'b')).toEqual({ valid: true, reason: null });
        }
    });

    it('findFlag locates the flag for a given color', () => {
        const board = createEmptyClassicBoard();
        board[12][1] = createClassicPiece('r', 'F', false);
        board[0][1] = createClassicPiece('b', 'F', false);
        expect(findFlag(board, 'r')).toEqual([12, 1]);
        expect(findFlag(board, 'b')).toEqual([0, 1]);
    });

    it('findFlag returns null when no flag exists', () => {
        const board = createEmptyClassicBoard();
        expect(findFlag(board, 'r')).toBeNull();
        expect(findFlag(board, 'b')).toBeNull();
    });

    it('revealColor reveals all pieces of a color without mutating original', () => {
        const board = createEmptyClassicBoard();
        board[7][0] = createClassicPiece('r', 'S', false);
        board[7][1] = createClassicPiece('r', 'G', false);
        board[5][0] = createClassicPiece('b', 'P', false);
        const revealed = revealColor(board, 'r');
        expect(revealed[7][0].revealed).toBe(true);
        expect(revealed[7][1].revealed).toBe(true);
        expect(revealed[5][0].revealed).toBe(false);
        expect(board[7][0].revealed).toBe(false);
    });

    it('revealColor handles empty board without error', () => {
        const board = createEmptyClassicBoard();
        const result = revealColor(board, 'r');
        expect(result).toEqual(board);
    });

    it('revealColor creates a new board, does not mutate original', () => {
        const board = createEmptyClassicBoard();
        board[7][0] = createClassicPiece('r', 'S', false);
        const result = revealColor(board, 'r');
        expect(result).not.toBe(board);
        expect(board[7][0].revealed).toBe(false);
    });

    it('applyMove reveals all blue pieces when blue chief (S rank) defender dies to bomb', () => {
        const board = createEmptyClassicBoard();
        board[8][0] = createClassicPiece('r', 'X', true);
        board[7][0] = createClassicPiece('b', 'S', false);
        board[7][2] = createClassicPiece('b', 'P', false);
        const state = { turn: 'r', result: null };
        const move = { kind: 'capture', from: [8, 0], to: [7, 0], piece: board[8][0], capture: board[7][0] };
        const { board: after } = applyMove(board, state, move);
        expect(after[7][2].revealed).toBe(true);
    });

    it('checkWinner detects win when one side\'s flag is missing', () => {
        const board = createEmptyClassicBoard();
        board[12][1] = createClassicPiece('r', 'F', true);
        board[8][0] = createClassicPiece('r', 'S', true);
        board[0][0] = createClassicPiece('b', 'S', false);
        const state = { turn: 'b', result: null };
        expect(getLegalMoves(board, 'r').length).toBeGreaterThan(0);
        expect(checkWinner(board, state)).toEqual({ winner: 'r', reason: 'flag' });
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

    it('getClassicAIDelay returns correct delay per difficulty level', () => {
        expect(getClassicAIDelay('easy')).toBe(320);
        expect(getClassicAIDelay('medium')).toBe(520);
        expect(getClassicAIDelay('hard')).toBe(780);
    });

    it('getClassicAIDelay falls back to medium for unknown level', () => {
        expect(getClassicAIDelay('impossible')).toBe(520);
        expect(getClassicAIDelay()).toBe(520);
    });
});
