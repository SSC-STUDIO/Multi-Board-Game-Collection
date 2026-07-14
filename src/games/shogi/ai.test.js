import { describe, it, expect } from 'vitest';

import { getShogiAIMove, getShogiAIDelay, evaluate, resetTranspositionTable } from './ai.js';
import { createInitialBoard, BOARD_SIZE, makeMove } from './rules.js';

function emptyHands() {
    return { sente: [], gote: [] };
}

describe('games/shogi/ai', () => {
    it('getShogiAIDelay returns a positive value per difficulty', () => {
        expect(getShogiAIDelay('easy')).toBeGreaterThan(0);
        expect(getShogiAIDelay('medium')).toBeGreaterThan(0);
        expect(getShogiAIDelay('hard')).toBeGreaterThan(0);
        expect(getShogiAIDelay('unknown')).toBeGreaterThan(0);
    });

    it('returns a legal board move on the starting position for sente', () => {
        const board = createInitialBoard();
        const move = getShogiAIMove(board, 'sente', emptyHands(), 'medium');
        expect(move).not.toBeNull();
        expect(['board', 'drop']).toContain(move.kind);
        if (move.kind === 'board') {
            const [fr, fc] = move.from;
            const [tr, tc] = move.to;
            expect(board[fr][fc]).not.toBeNull();
            expect(board[fr][fc].side).toBe('sente');
            expect(tr).toBeGreaterThanOrEqual(0);
            expect(tr).toBeLessThan(BOARD_SIZE);
            expect(tc).toBeGreaterThanOrEqual(0);
            expect(tc).toBeLessThan(BOARD_SIZE);
        }
    });

    it('easy mode also returns a legal move', () => {
        const board = createInitialBoard();
        const move = getShogiAIMove(board, 'sente', emptyHands(), 'easy');
        expect(move).not.toBeNull();
        expect(move.kind).toBeDefined();
    });

    it('hard mode returns a legal move within the board bounds', { timeout: 30000 }, () => {
        const board = createInitialBoard();
        const move = getShogiAIMove(board, 'gote', emptyHands(), 'hard');
        expect(move).not.toBeNull();
        if (move.kind === 'board') {
            const [tr, tc] = move.to;
            expect(tr).toBeGreaterThanOrEqual(0);
            expect(tr).toBeLessThan(BOARD_SIZE);
            expect(tc).toBeGreaterThanOrEqual(0);
            expect(tc).toBeLessThan(BOARD_SIZE);
        } else {
            const [tr, tc] = move.to;
            expect(board[tr][tc]).toBeNull();
        }
    });

    it('prefers a capturing move when one is available', () => {
        const board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
        board[8][4] = { type: 'K', side: 'sente' };
        board[4][4] = { type: 'R', side: 'sente' };
        board[4][5] = { type: 'B', side: 'gote' };
        // A sente pawn blocks the rook file so the gote king cannot be
        // captured directly, leaving the bishop on (4,5) as the best catch.
        board[3][4] = { type: 'P', side: 'sente' };
        board[0][4] = { type: 'K', side: 'gote' };
        board[0][0] = { type: 'L', side: 'gote' };
        const move = getShogiAIMove(board, 'sente', emptyHands(), 'hard');
        expect(move).not.toBeNull();
        if (move.kind === 'board') {
            const [tr, tc] = move.to;
            expect(tr === 4 && tc === 5).toBe(true);
        }
    });

    it('never lands on a friendly-occupied square', () => {
        const board = createInitialBoard();
        for (let attempt = 0; attempt < 8; attempt += 1) {
            const move = getShogiAIMove(board, 'sente', emptyHands(), 'medium');
            if (!move) continue;
            if (move.kind === 'board') {
                const [fr, fc] = move.from;
                const [tr, tc] = move.to;
                expect(board[fr][fc].side).toBe('sente');
                if (board[tr][tc]) {
                    expect(board[tr][tc].side).not.toBe('sente');
                }
            }
            const cloned = board.map(row => row.map(c => (c ? { ...c } : null)));
            const result = makeMove(cloned, move.from[0], move.from[1], move.to[0], move.to[1], move.promote || false);
            expect(result).toBeDefined();
        }
    });

    it('evaluate is positive when sente has extra material', () => {
        const board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
        board[8][4] = { type: 'K', side: 'sente' };
        board[0][4] = { type: 'K', side: 'gote' };
        board[4][4] = { type: 'R', side: 'sente' };
        const score = evaluate(board, emptyHands());
        expect(score).toBeGreaterThan(0);
    });

    it('evaluate is negative when gote has extra material', () => {
        const board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
        board[8][4] = { type: 'K', side: 'sente' };
        board[0][4] = { type: 'K', side: 'gote' };
        board[4][4] = { type: 'R', side: 'gote' };
        const score = evaluate(board, emptyHands());
        expect(score).toBeLessThan(0);
    });

    it('evaluate counts hand pieces toward the owner', () => {
        const board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
        board[8][4] = { type: 'K', side: 'sente' };
        board[0][4] = { type: 'K', side: 'gote' };
        const handsWithSenteRook = { sente: [{ type: 'R', side: 'gote' }], gote: [] };
        const score = evaluate(board, handsWithSenteRook);
        expect(score).toBeGreaterThan(0);
    });

    it('returns null when the side to move has no legal moves', () => {
        // Sente king trapped in the corner (0,0): three gote Golds on (0,1),
        // (1,0) and (1,1) cover every escape square, so sente is checkmated.
        const board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
        board[0][0] = { type: 'K', side: 'sente' };
        board[0][1] = { type: 'G', side: 'gote' };
        board[1][0] = { type: 'G', side: 'gote' };
        board[1][1] = { type: 'G', side: 'gote' };
        board[8][8] = { type: 'K', side: 'gote' };
        const move = getShogiAIMove(board, 'sente', emptyHands(), 'medium');
        expect(move).toBeNull();
    });

    it('can drop a hand piece onto the board when available', () => {
        const board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
        board[8][4] = { type: 'K', side: 'sente' };
        board[0][4] = { type: 'K', side: 'gote' };
        const hands = { sente: [{ type: 'R', side: 'gote' }], gote: [] };
        const move = getShogiAIMove(board, 'sente', hands, 'hard');
        expect(move).not.toBeNull();
        if (move.kind === 'drop') {
            expect(move.type).toBe('R');
            const [tr, tc] = move.to;
            expect(board[tr][tc]).toBeNull();
        }
    });

    it('resetTranspositionTable clears the table without error', () => {
        const board = createInitialBoard();
        getShogiAIMove(board, 'sente', emptyHands(), 'medium');
        expect(() => resetTranspositionTable()).not.toThrow();
    });
});
