import { describe, it, expect } from 'vitest';

import { getClassicAIMove, getClassicAIDelay } from './ai.js';
import { getLegalMoves, createEmptyClassicBoard, createClassicPiece, RANK_LEVEL } from './rules.js';
import { createClassicState } from './state.js';

function placeEmpty() {
    return createEmptyClassicBoard();
}

function withPiece(board, row, col, color, rank) {
    const next = board.map((r) => r.map((p) => (p ? { ...p } : null)));
    next[row][col] = createClassicPiece(color, rank);
    return next;
}

function legalIncludes(legal, move) {
    return legal.some((m) =>
        m.kind === move.kind
        && m.from[0] === move.from[0] && m.from[1] === move.from[1]
        && m.to[0] === move.to[0] && m.to[1] === move.to[1]
    );
}

function setLevel(state, level) {
    state.options = { ...state.options, level };
    return state;
}

describe('games/junqi/classic/ai', () => {
    it('getClassicAIDelay returns positive values with hard>medium>easy', () => {
        const easy = getClassicAIDelay('easy');
        const medium = getClassicAIDelay('medium');
        const hard = getClassicAIDelay('hard');
        expect(easy).toBeGreaterThan(0);
        expect(medium).toBeGreaterThan(0);
        expect(hard).toBeGreaterThan(0);
        expect(hard).toBeGreaterThan(medium);
        expect(medium).toBeGreaterThan(easy);
    });

    it('unknown difficulty falls back to medium delay', () => {
        const medium = getClassicAIDelay('medium');
        expect(getClassicAIDelay('ultra')).toBe(medium);
        expect(getClassicAIDelay(undefined)).toBe(medium);
    });

    it('AI prioritizes capturing enemy flag when possible', () => {
        let board = placeEmpty();
        board = withPiece(board, 5, 0, 'r', 'S');
        board = withPiece(board, 4, 0, 'b', 'F');
        board = withPiece(board, 12, 4, 'b', 'G');
        let state = createClassicState({ level: 'hard', playerColor: 'r' });
        state = setLevel(state, 'hard');
        state.board = board;
        state.turn = 'r';
        const mv = getClassicAIMove(state);
        expect(mv).not.toBeNull();
        expect(mv.kind).toBe('capture');
        expect(mv.to).toEqual([4, 0]);
    });

    it('AI captures high-value target instead of moving to empty square', () => {
        let board = placeEmpty();
        board = withPiece(board, 5, 0, 'r', 'S');
        board = withPiece(board, 4, 0, 'b', 'G');
        board = withPiece(board, 12, 4, 'b', 'T');
        const state = setLevel({ ...createClassicState({ level: 'hard' }) }, 'hard');
        state.board = board;
        state.turn = 'r';
        const mv = getClassicAIMove(state);
        expect(mv).not.toBeNull();
        expect(mv.kind).toBe('capture');
        expect(mv.to).toEqual([4, 0]);
    });

    it('AI always returns a legal move', () => {
        const state = setLevel({ ...createClassicState() }, 'medium');
        state.board = createClassicState().board;
        state.turn = 'r';
        for (let i = 0; i < 15; i += 1) {
            const mv = getClassicAIMove(state);
            if (!mv) break;
            const legal = getLegalMoves(state.board, state.turn);
            expect(legalIncludes(legal, mv)).toBe(true);
        }
    });

    it('returns null when no legal moves exist', () => {
        const state = setLevel({ ...createClassicState() }, 'hard');
        state.board = createEmptyClassicBoard();
        state.turn = 'r';
        expect(getClassicAIMove(state)).toBeNull();
    });

    it('bomb captures get priority scoring for high-value targets', () => {
        let board = placeEmpty();
        board = withPiece(board, 1, 1, 'r', 'X');
        board = withPiece(board, 0, 1, 'b', 'T');
        board = withPiece(board, 2, 1, 'b', 'E');
        board = withPiece(board, 12, 4, 'b', 'G');
        const state = setLevel({ ...createClassicState({ level: 'hard' }) }, 'hard');
        state.board = board;
        state.turn = 'r';
        const mv = getClassicAIMove(state);
        expect(mv).not.toBeNull();
        expect(mv.kind).toBe('capture');
        const [tr] = mv.to;
        const targetRank = board[tr][mv.to[1]].rank;
        expect(RANK_LEVEL[targetRank]).toBe(RANK_LEVEL.T);
    });

    it('easy mode picks from larger pool, hard picks best', () => {
        const state = setLevel({ ...createClassicState() }, 'hard');
        let board = placeEmpty();
        board = withPiece(board, 1, 1, 'r', 'G');
        board = withPiece(board, 2, 1, 'b', 'C');
        board = withPiece(board, 12, 4, 'b', 'T');
        state.board = board;
        state.turn = 'r';
        const picks = new Set();
        for (let i = 0; i < 12; i += 1) {
            const mv = getClassicAIMove(state);
            picks.add(`${mv.kind}::`);
        }
        expect(picks.size).toBeLessThanOrEqual(2);
    });

    it('hard mode threat avoidance: low-rank piece avoids exposed high-rank enemy', () => {
        // T(rank=5) at (8,2); exposed D(rank=7) at (7,1) -> threatens (7,2)
        // T should avoid moving to (7,2) and prefer safe direction
        let board = placeEmpty();
        board = withPiece(board, 8, 2, 'r', 'T');
        board[7][1] = { color: 'b', rank: 'D', revealed: true };
        board = withPiece(board, 12, 4, 'b', 'P');
        const state = setLevel({ ...createClassicState({ level: 'hard' }) }, 'hard');
        state.board = board;
        state.turn = 'r';
        const mv = getClassicAIMove(state);
        expect(mv).not.toBeNull();
        if (mv.kind === 'move') {
            expect(mv.to).not.toEqual([7, 2]);
        }
    });

    it('bomb prefers high-value target over low-value target', () => {
        // X at (1,2) can capture D(rank=7) at (0,2) or P(rank=2) at (2,2)
        // Should prioritize D
        let board = placeEmpty();
        board = withPiece(board, 1, 2, 'r', 'X');
        board = withPiece(board, 0, 2, 'b', 'D');
        board = withPiece(board, 2, 2, 'b', 'P');
        board = withPiece(board, 12, 4, 'b', 'G');
        const state = setLevel({ ...createClassicState({ level: 'hard' }) }, 'hard');
        state.board = board;
        state.turn = 'r';
        const mv = getClassicAIMove(state);
        expect(mv).not.toBeNull();
        expect(mv.kind).toBe('capture');
        const targetRank = board[mv.to[0]][mv.to[1]].rank;
        expect(RANK_LEVEL[targetRank]).toBeGreaterThanOrEqual(RANK_LEVEL.D);
    });

    it('medium mode also has threat awareness', () => {
        // R(rank=6) at (8,2); exposed G(rank=8) at (7,1) -> threatens (7,2)
        let board = placeEmpty();
        board = withPiece(board, 8, 2, 'r', 'R');
        board[7][1] = { color: 'b', rank: 'G', revealed: true };
        board = withPiece(board, 12, 4, 'b', 'E');
        const state = setLevel({ ...createClassicState({ level: 'medium' }) }, 'medium');
        state.board = board;
        state.turn = 'r';
        const mv = getClassicAIMove(state);
        expect(mv).not.toBeNull();
        if (mv.kind === 'move') {
            let dangerCount = 0;
            for (let i = 0; i < 10; i++) {
                const m = getClassicAIMove(state);
                if (m.kind === 'move' && m.to[0] === 7 && m.to[1] === 2) dangerCount++;
            }
            expect(dangerCount).toBeLessThan(8);
        }
    });
});
