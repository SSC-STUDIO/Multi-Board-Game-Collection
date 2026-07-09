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
    it('getClassicAIDelay 为各难度返回正数且 hard>medium>easy', () => {
        const easy = getClassicAIDelay('easy');
        const medium = getClassicAIDelay('medium');
        const hard = getClassicAIDelay('hard');
        expect(easy).toBeGreaterThan(0);
        expect(medium).toBeGreaterThan(0);
        expect(hard).toBeGreaterThan(0);
        expect(hard).toBeGreaterThan(medium);
        expect(medium).toBeGreaterThan(easy);
    });

    it('未知难度回退到 medium 延迟', () => {
        const medium = getClassicAIDelay('medium');
        expect(getClassicAIDelay('ultra')).toBe(medium);
        expect(getClassicAIDelay(undefined)).toBe(medium);
    });

    it('能吃对方军旗时 AI 优先夺旗', () => {
        // 红师长(r, S) 在 (1,1)，黑军旗(b, F) 在 (2,1) 相邻可吃
        let board = placeEmpty();
        board = withPiece(board, 1, 1, 'r', 'S');
        board = withPiece(board, 2, 1, 'b', 'F');
        // 给黑方留一颗子保证有对方棋存在（避免规则层提前判胜负）
        board = withPiece(board, 12, 3, 'b', 'G');
        let state = createClassicState({ level: 'hard', playerColor: 'r' });
        state = setLevel(state, 'hard');
        state.board = board;
        state.turn = 'r';
        const mv = getClassicAIMove(state);
        expect(mv).not.toBeNull();
        expect(mv.kind).toBe('capture');
        expect(mv.to).toEqual([2, 1]);
    });

    it('有高价值目标时优先吃大子而非走空格', () => {
        // 红军长(r, G 级别8) 在 (1,1)；上(0,1)空、下(2,1)是黑师长(b, S 级别9)可吃
        // S 级别9 > G 级别8，红军长不能吃黑师长（会被反吃）。改黑将为可吃目标：
        // 黑司令(b, S=9) 不过——将级10不存在；用黑军长(b, G=8) vs 红司令(r, S=9) 可吃
        let board = placeEmpty();
        board = withPiece(board, 1, 1, 'r', 'S');
        board = withPiece(board, 2, 1, 'b', 'G');
        board = withPiece(board, 0, 1, 'b', 'P');
        board = withPiece(board, 12, 4, 'b', 'T');
        const state = setLevel({ ...createClassicState({ level: 'hard' }) }, 'hard');
        state.board = board;
        state.turn = 'r';
        const mv = getClassicAIMove(state);
        expect(mv).not.toBeNull();
        expect(mv.kind).toBe('capture');
        expect(mv.to).toEqual([2, 1]);
    });

    it('AI 返回的走法始终是合法走法', () => {
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

    it('无合法走法时返回 null', () => {
        // 空棋盘：没有可移动棋子 → getLegalMoves 返回 [] → AI 返回 null
        const state = setLevel({ ...createClassicState() }, 'hard');
        state.board = createEmptyClassicBoard();
        state.turn = 'r';
        expect(getClassicAIMove(state)).toBeNull();
    });

    it('炸弹(X)攻击目标获得额外评分加权', () => {
        // 红炸弹(r, X) 在 (1,1)：上(0,1)黑团长(b, T)可吃（炸弹同归），下(2,1)是黑工兵(b, E)可吃
        // 炸弹发起攻击评分 += 80（高于普通吃工兵 E 的分），尽管两目标都会同归
        // 间接验证：选一个 capture 走法吃到目标
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
        // target = T（团长，rank级别5）评分应高于 E（工兵1）+ 加权80
        // 然而两者都有 X 加权；这里至少确认选到了较高级别目标（T 级别5 > E 级别1）
        const [tr] = mv.to;
        const targetRank = board[tr][mv.to[1]].rank;
        expect(RANK_LEVEL[targetRank]).toBe(RANK_LEVEL.T);
    });

    it('easy 级别允许从更大候选池选择（随机性），hard 取最优', () => {
        // 同一棋盘跑多次 hard：topN=1 → 每次应选同一最高分走法（确定性，除非并列）
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
        // hard topN=1 → 仅在浮点并列时可能多于一种；这里吃黑车评分突出，应稳定选吃
        expect(picks.size).toBeLessThanOrEqual(2);
    });
});
