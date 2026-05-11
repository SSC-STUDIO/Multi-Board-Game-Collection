import { describe, it, expect } from 'vitest';

import {
    createInitialBoard,
    getLegalMoves,
    getLegalMovesFrom,
    applyMove,
    isInCheck,
    isCheckmate,
    isStalemate,
    isInsufficientMaterial,
    isFiftyMoveDraw,
    findKing,
    pieceColor
} from './rules.js';
import { createChessState } from './state.js';

function emptyBoard() {
    return Array.from({ length: 8 }, () => Array(8).fill(null));
}

function baseState(overrides = {}) {
    return {
        turn: 'w',
        castlingRights: { wK: false, wQ: false, bK: false, bQ: false },
        enPassantTarget: null,
        halfmoveClock: 0,
        fullmoveNumber: 1,
        ...overrides
    };
}

describe('games/chess/rules — 基础', () => {
    it('pieceColor returns correct color', () => {
        expect(pieceColor('wK')).toBe('w');
        expect(pieceColor('bQ')).toBe('b');
        expect(pieceColor(null)).toBeNull();
    });

    it('初始棋盘有 20 种合法走法（白方）', () => {
        const state = createChessState();
        const moves = getLegalMoves(state.board, state);
        expect(moves).toHaveLength(20); // 8 兵 x2 步 + 2 马 x2 走法 = 20
    });

    it('初始棋盘黑方也有 20 种合法走法', () => {
        const state = createChessState();
        state.turn = 'b';
        const moves = getLegalMoves(state.board, state);
        expect(moves).toHaveLength(20);
    });

    it('findKing 返回王位置', () => {
        const state = createChessState();
        expect(findKing(state.board, 'w')).toEqual([7, 4]);
        expect(findKing(state.board, 'b')).toEqual([0, 4]);
    });
});

describe('games/chess/rules — 兵', () => {
    it('白兵起步可以走 1 或 2 格', () => {
        const state = createChessState();
        const moves = getLegalMovesFrom(state.board, state, 6, 4); // e2
        expect(moves).toHaveLength(2);
        expect(moves.some((m) => m.to[0] === 5 && m.to[1] === 4)).toBe(true); // e3
        expect(moves.some((m) => m.to[0] === 4 && m.to[1] === 4)).toBe(true); // e4
    });

    it('兵到达底线时生成 4 种升变走法', () => {
        const board = emptyBoard();
        board[1][0] = 'wP';
        board[0][7] = 'bK';
        board[7][4] = 'wK';
        const state = baseState();
        const moves = getLegalMovesFrom(board, state, 1, 0);
        const promos = moves.filter((m) => m.promotion);
        expect(promos.length).toBe(4);
        expect(new Set(promos.map((m) => m.promotion))).toEqual(new Set(['Q', 'R', 'B', 'N']));
    });

    it('吃过路兵可被识别', () => {
        const board = emptyBoard();
        board[3][4] = 'wP';                // e5
        board[1][5] = 'bP';                // f7
        board[7][4] = 'wK';
        board[0][4] = 'bK';
        // 模拟黑兵刚走 f7→f5 双步
        const state = baseState({ turn: 'w', enPassantTarget: [2, 5] });
        const moves = getLegalMovesFrom(board, state, 3, 4);
        const ep = moves.find((m) => m.enPassant);
        expect(ep).toBeDefined();
        expect(ep.to).toEqual([2, 5]);
    });
});

describe('games/chess/rules — 王车易位', () => {
    function basicCastleBoard() {
        const board = emptyBoard();
        board[7][4] = 'wK';
        board[7][7] = 'wR';
        board[7][0] = 'wR';
        board[0][4] = 'bK';
        return board;
    }

    it('短易位生成在合法走法中', () => {
        const board = basicCastleBoard();
        const state = baseState({ castlingRights: { wK: true, wQ: true, bK: false, bQ: false } });
        const moves = getLegalMovesFrom(board, state, 7, 4);
        expect(moves.some((m) => m.castle === 'K')).toBe(true);
        expect(moves.some((m) => m.castle === 'Q')).toBe(true);
    });

    it('王被将时不能易位', () => {
        const board = basicCastleBoard();
        board[1][4] = 'bR'; // 黑车占据 e 线——e1 王被将
        const state = baseState({ castlingRights: { wK: true, wQ: true, bK: false, bQ: false } });
        const moves = getLegalMovesFrom(board, state, 7, 4);
        expect(moves.some((m) => m.castle)).toBe(false);
    });

    it('王中途格被攻击时不能易位', () => {
        const board = basicCastleBoard();
        board[1][5] = 'bR'; // 黑车占据 f 线，f1 被控制
        const state = baseState({ castlingRights: { wK: true, wQ: true, bK: false, bQ: false } });
        const moves = getLegalMovesFrom(board, state, 7, 4);
        expect(moves.some((m) => m.castle === 'K')).toBe(false);
        // 长易位走向 c1，中途 d1 在 d 线，不被 f 线车影响——仍可行
        expect(moves.some((m) => m.castle === 'Q')).toBe(true);
    });

    it('易位后王车位置正确', () => {
        const board = basicCastleBoard();
        const state = baseState({ castlingRights: { wK: true, wQ: true, bK: false, bQ: false } });
        const moves = getLegalMovesFrom(board, state, 7, 4);
        const castleK = moves.find((m) => m.castle === 'K');
        const { board: after } = applyMove(board, state, castleK);
        expect(after[7][6]).toBe('wK');
        expect(after[7][5]).toBe('wR');
        expect(after[7][4]).toBeNull();
        expect(after[7][7]).toBeNull();
    });
});

describe('games/chess/rules — 将军/将死/逼和/和棋', () => {
    it('isInCheck 判断准确', () => {
        const board = emptyBoard();
        board[7][4] = 'wK';
        board[0][4] = 'bK';
        board[3][4] = 'bR'; // e5 黑车攻击 e1 王
        expect(isInCheck(board, 'w')).toBe(true);
        expect(isInCheck(board, 'b')).toBe(false);
    });

    it('简单折叠 mate：学者将杀（fool\'s mate setup）', () => {
        // 构造一个已被将死的局面：黑王在 a8，白后 a7，白王 a6
        const board = emptyBoard();
        board[0][0] = 'bK';
        board[1][0] = 'wQ';
        board[2][0] = 'wK';
        const state = baseState({ turn: 'b' });
        expect(isCheckmate(board, state)).toBe(true);
    });

    it('stalemate：黑王被逼和', () => {
        // 黑王在 h8，白后在 g6，白王 f7，黑方无合法走法但未被将
        const board = emptyBoard();
        board[0][7] = 'bK';
        board[2][6] = 'wQ';
        board[1][5] = 'wK';
        const state = baseState({ turn: 'b' });
        expect(isStalemate(board, state)).toBe(true);
        expect(isCheckmate(board, state)).toBe(false);
    });

    it('isInsufficientMaterial: K vs K 判和', () => {
        const board = emptyBoard();
        board[0][0] = 'bK';
        board[7][7] = 'wK';
        expect(isInsufficientMaterial(board)).toBe(true);
    });

    it('isInsufficientMaterial: K+B vs K+B 同色格判和', () => {
        const board = emptyBoard();
        board[0][0] = 'bK';    // a8 暗格
        board[7][7] = 'wK';    // h1 暗格
        board[0][2] = 'bB';    // c8 暗格 (0+2=2 偶→暗)
        board[7][5] = 'wB';    // f1 暗格 (7+5=12 偶→暗)
        expect(isInsufficientMaterial(board)).toBe(true);
    });

    it('isInsufficientMaterial: K+R vs K 不判和', () => {
        const board = emptyBoard();
        board[0][0] = 'bK';
        board[7][7] = 'wK';
        board[7][0] = 'wR';
        expect(isInsufficientMaterial(board)).toBe(false);
    });

    it('isFiftyMoveDraw 在 halfmoveClock >= 100 时为真', () => {
        expect(isFiftyMoveDraw({ halfmoveClock: 100 })).toBe(true);
        expect(isFiftyMoveDraw({ halfmoveClock: 99 })).toBe(false);
    });
});

describe('games/chess/rules — applyMove 状态更新', () => {
    it('兵走一步不更新 castling，halfmoveClock 归零', () => {
        const state = createChessState();
        const moves = getLegalMovesFrom(state.board, state, 6, 4); // e2
        const e4 = moves.find((m) => m.to[0] === 4 && m.to[1] === 4);
        const { state: next } = applyMove(state.board, state, e4);
        expect(next.turn).toBe('b');
        expect(next.halfmoveClock).toBe(0);
        expect(next.enPassantTarget).toEqual([5, 4]); // 白兵双步 → 黑可 e3 过路吃
        expect(next.castlingRights).toEqual(state.castlingRights);
    });

    it('王移动后双方易位权限均消失', () => {
        const board = emptyBoard();
        board[7][4] = 'wK';
        board[7][0] = 'wR';
        board[7][7] = 'wR';
        board[0][4] = 'bK';
        const state = baseState({ castlingRights: { wK: true, wQ: true, bK: false, bQ: false } });
        const moves = getLegalMovesFrom(board, state, 7, 4);
        const kingStep = moves.find((m) => m.to[0] === 7 && m.to[1] === 3);
        const { state: next } = applyMove(board, state, kingStep);
        expect(next.castlingRights.wK).toBe(false);
        expect(next.castlingRights.wQ).toBe(false);
    });

    it('车被吃后对应一侧易位权限消失', () => {
        const board = emptyBoard();
        board[7][4] = 'wK';
        board[7][0] = 'wR';
        board[7][7] = 'wR';
        board[0][4] = 'bK';
        board[3][7] = 'bR'; // 黑车 h5，直线可吃 h1 白车
        const state = baseState({ castlingRights: { wK: true, wQ: true, bK: false, bQ: false }, turn: 'b' });
        const moves = getLegalMovesFrom(board, state, 3, 7);
        const takeRook = moves.find((m) => m.to[0] === 7 && m.to[1] === 7);
        expect(takeRook).toBeDefined();
        const { state: next } = applyMove(board, state, takeRook);
        expect(next.castlingRights.wK).toBe(false);
        expect(next.castlingRights.wQ).toBe(true);
    });
});

describe('games/chess/rules — 升变与吃子场景', () => {
    it('升变后棋子变为所选子种', () => {
        const board = emptyBoard();
        board[1][0] = 'wP';
        board[0][4] = 'bK';
        board[7][4] = 'wK';
        const state = baseState();
        const moves = getLegalMovesFrom(board, state, 1, 0);
        const promoQ = moves.find((m) => m.promotion === 'Q');
        expect(promoQ).toBeDefined();
        const { board: after } = applyMove(board, state, promoQ);
        expect(after[0][0]).toBe('wQ');
        expect(after[1][0]).toBeNull();
    });

    it('升变为 N 时棋子变马而非后', () => {
        const board = emptyBoard();
        board[1][0] = 'wP';
        board[0][4] = 'bK';
        board[7][4] = 'wK';
        const state = baseState();
        const moves = getLegalMovesFrom(board, state, 1, 0);
        const promoN = moves.find((m) => m.promotion === 'N');
        expect(promoN).toBeDefined();
        const { board: after } = applyMove(board, state, promoN);
        expect(after[0][0]).toBe('wN');
    });

    it('过路吃完成后对方兵被移除', () => {
        const board = emptyBoard();
        board[3][4] = 'wP';                // e5
        board[3][5] = 'bP';                // f5 (刚双步到)
        board[7][4] = 'wK';
        board[0][4] = 'bK';
        const state = baseState({ turn: 'w', enPassantTarget: [2, 5] });
        const moves = getLegalMovesFrom(board, state, 3, 4);
        const ep = moves.find((m) => m.enPassant);
        const { board: after } = applyMove(board, state, ep);
        expect(after[2][5]).toBe('wP');     // 白兵到 f6
        expect(after[3][5]).toBeNull();     // 黑兵被吃
        expect(after[3][4]).toBeNull();     // 白兵离开 e5
    });
});

describe('games/chess/rules — 将杀深度', () => {
    it('back-rank mate：白后一线将杀无车底线', () => {
        // 黑王在 g8，被自己的兵锁在底线（f7/g7/h7），白车到 e8 或 d8 将杀
        const board = emptyBoard();
        board[0][6] = 'bK';
        board[1][5] = 'bP';
        board[1][6] = 'bP';
        board[1][7] = 'bP';
        board[0][4] = 'wR';    // e8 白车将军并锁线
        board[7][4] = 'wK';
        const state = baseState({ turn: 'b' });
        expect(isCheckmate(board, state)).toBe(true);
    });

    it('国王受双将时必须走开', () => {
        // 白王在 e1 被两条直线夹击（双将）：a1 黑车 + e8 黑车
        const board = emptyBoard();
        board[7][4] = 'wK';
        board[7][0] = 'bR';    // a1 横向攻击
        board[0][4] = 'bR';    // e8 纵向攻击
        board[0][7] = 'bK';
        const state = baseState({ turn: 'w' });
        // 白必须离开 e1。由于 a1/e8 只攻击 e1，白王周围格 d2/e2/f2/d1/f1 是否安全取决于攻击线
        // a1 车攻击整条 1 排 → d1/f1 被攻击
        // e8 车攻击整条 e 列 → e2 被攻击
        // 所以白王只能走 d2 或 f2
        const moves = getLegalMovesFrom(board, state, 7, 4);
        const dests = new Set(moves.map((m) => `${m.to[0]},${m.to[1]}`));
        expect(dests.has('6,3')).toBe(true);  // d2
        expect(dests.has('6,5')).toBe(true);  // f2
        expect(dests.has('6,4')).toBe(false); // e2 被 e8 车控制
        expect(dests.has('7,3')).toBe(false); // d1 被 a1 车控制
        expect(dests.has('7,5')).toBe(false); // f1 被 a1 车控制
    });

    it('挡将：兵/子走到将军线上解除将军', () => {
        // 白王 e1，黑车 e8 将军，白车在 d2——可走 e2 挡将
        const board = emptyBoard();
        board[7][4] = 'wK';
        board[0][4] = 'bR';
        board[6][3] = 'wR';    // d2 白车
        board[0][0] = 'bK';
        const state = baseState({ turn: 'w' });
        expect(isInCheck(board, 'w')).toBe(true);
        const rookMoves = getLegalMovesFrom(board, state, 6, 3);
        // 白车移到 e2 可挡将
        expect(rookMoves.some((m) => m.to[0] === 6 && m.to[1] === 4)).toBe(true);
    });

    it('吃掉将军子也解除将军', () => {
        // 白王 e1，黑象在 a5 将军（斜线 a5-e1）；白车 a1 可吃象
        const board = emptyBoard();
        board[7][4] = 'wK';
        board[3][0] = 'bB';    // a5 黑象
        board[7][0] = 'wR';    // a1 白车
        board[0][0] = 'bK';
        const state = baseState({ turn: 'w' });
        expect(isInCheck(board, 'w')).toBe(true);
        const moves = getLegalMovesFrom(board, state, 7, 0);
        expect(moves.some((m) => m.to[0] === 3 && m.to[1] === 0)).toBe(true);
    });
});
