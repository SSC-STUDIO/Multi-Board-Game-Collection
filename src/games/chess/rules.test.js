import { describe, it, expect } from 'vitest';

import {
    createInitialBoard,
    cloneBoard,
    getLegalMoves,
    getLegalMovesFrom,
    applyMove,
    isInCheck,
    isCheckmate,
    isStalemate,
    isInsufficientMaterial,
    isFiftyMoveDraw,
    findKing,
    pieceColor,
    isSquareAttacked,
    oppositeColor
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

describe('games/chess/rules — 易位边界', () => {
    function blackCastleBoard() {
        const board = emptyBoard();
        board[0][4] = 'bK';
        board[0][7] = 'bR';
        board[0][0] = 'bR';
        board[7][4] = 'wK';
        return board;
    }

    it('黑方短易位和长易位均合法', () => {
        const board = blackCastleBoard();
        const state = baseState({
            turn: 'b',
            castlingRights: { wK: false, wQ: false, bK: true, bQ: true }
        });
        const moves = getLegalMovesFrom(board, state, 0, 4);
        expect(moves.some((m) => m.castle === 'K')).toBe(true);
        expect(moves.some((m) => m.castle === 'Q')).toBe(true);
    });

    it('己方子阻塞路径时不能易位', () => {
        const board = blackCastleBoard();
        board[0][5] = 'bB'; // f8 有子，短易位路径被堵
        board[0][1] = 'bN'; // b8 有子，长易位路径被堵
        const state = baseState({
            turn: 'b',
            castlingRights: { wK: false, wQ: false, bK: true, bQ: true }
        });
        const moves = getLegalMovesFrom(board, state, 0, 4);
        expect(moves.some((m) => m.castle === 'K')).toBe(false);
        expect(moves.some((m) => m.castle === 'Q')).toBe(false);
    });

    it('仅有 b1（b 线 col=1）有子时长易位不可用', () => {
        const board = blackCastleBoard();
        board[0][1] = 'bN'; // b8 阻塞
        const state = baseState({
            turn: 'b',
            castlingRights: { wK: false, wQ: false, bK: true, bQ: true }
        });
        const moves = getLegalMovesFrom(board, state, 0, 4);
        expect(moves.some((m) => m.castle === 'Q')).toBe(false);
    });

    it('车已移动后相应易位权利丢失', () => {
        const board = emptyBoard();
        board[7][4] = 'wK';
        board[7][7] = 'wR';
        board[0][4] = 'bK';
        const state = baseState({ castlingRights: { wK: true, wQ: false, bK: false, bQ: false } });
        // 白车走 h1→h3
        const moves = getLegalMovesFrom(board, state, 7, 7);
        const rh3 = moves.find((m) => m.to[0] === 5 && m.to[1] === 7);
        const { state: next } = applyMove(board, state, rh3);
        expect(next.castlingRights.wK).toBe(false);
        expect(next.castlingRights.wQ).toBe(false);
    });

    it('目标格被攻击时不能易位', () => {
        const board = emptyBoard();
        board[7][4] = 'wK';
        board[7][7] = 'wR';
        board[7][0] = 'wR';
        board[0][4] = 'bK';
        board[1][6] = 'bR'; // g7 攻击 g1，短易位目标格
        const state = baseState({ castlingRights: { wK: true, wQ: true, bK: false, bQ: false } });
        const moves = getLegalMovesFrom(board, state, 7, 4);
        expect(moves.some((m) => m.castle === 'K')).toBe(false);
        // 长易位不受 g7 车影响
        expect(moves.some((m) => m.castle === 'Q')).toBe(true);
    });

    it('黑方王被将时不能易位', () => {
        const board = blackCastleBoard();
        board[4][4] = 'wR'; // e5 白车将军
        const state = baseState({
            turn: 'b',
            castlingRights: { wK: false, wQ: false, bK: true, bQ: true }
        });
        const moves = getLegalMovesFrom(board, state, 0, 4);
        expect(moves.some((m) => m.castle)).toBe(false);
    });

    it('易位后王和车位置正确（黑方长易位）', () => {
        const board = blackCastleBoard();
        const state = baseState({
            turn: 'b',
            castlingRights: { wK: false, wQ: false, bK: true, bQ: true }
        });
        const moves = getLegalMovesFrom(board, state, 0, 4);
        const castleQ = moves.find((m) => m.castle === 'Q');
        const { board: after } = applyMove(board, state, castleQ);
        expect(after[0][2]).toBe('bK');
        expect(after[0][3]).toBe('bR');
        expect(after[0][4]).toBeNull();
        expect(after[0][0]).toBeNull();
    });
});

describe('games/chess/rules — 吃过路兵边界', () => {
    it('过路兵仅在对手刚走双步后可用', () => {
        const board = emptyBoard();
        board[3][4] = 'wP'; // e5
        board[7][4] = 'wK';
        board[0][4] = 'bK';
        const state = baseState({ turn: 'w', enPassantTarget: null });
        const moves = getLegalMovesFrom(board, state, 3, 4);
        expect(moves.some((m) => m.enPassant)).toBe(false);
    });

    it('黑方过路吃白兵', () => {
        const board = emptyBoard();
        board[4][4] = 'bP'; // e4
        board[4][3] = 'wP'; // d4（刚从 d2 双步到 d4）
        board[7][4] = 'wK';
        board[0][4] = 'bK';
        const state = baseState({ turn: 'b', enPassantTarget: [5, 3] });
        const moves = getLegalMovesFrom(board, state, 4, 4);
        const ep = moves.find((m) => m.enPassant);
        expect(ep).toBeDefined();
        expect(ep.to).toEqual([5, 3]);
        const { board: after } = applyMove(board, state, ep);
        expect(after[5][3]).toBe('bP');     // 黑兵到 d5
        expect(after[4][3]).toBeNull();     // 白兵被移除
        expect(after[4][4]).toBeNull();     // 黑兵离开 e4
    });

    it('过路吃后生成正确 enPassantTarget', () => {
        const board = emptyBoard();
        board[6][4] = 'wP'; // e2
        board[0][4] = 'bK';
        board[7][4] = 'wK';
        const state = baseState();
        const moves = getLegalMovesFrom(board, state, 6, 4);
        const doubleStep = moves.find((m) => m.doubleStep);
        const { state: next } = applyMove(board, state, doubleStep);
        expect(next.enPassantTarget).toEqual([5, 4]); // e3
    });

    it('非双步走法不设 enPassantTarget', () => {
        const board = emptyBoard();
        board[5][4] = 'wP'; // e3
        board[0][4] = 'bK';
        board[7][4] = 'wK';
        const state = baseState();
        const moves = getLegalMovesFrom(board, state, 5, 4);
        const step = moves.find((m) => !m.doubleStep && !m.enPassant);
        const { state: next } = applyMove(board, state, step);
        expect(next.enPassantTarget).toBeNull();
    });
});

describe('games/chess/rules — 升变边界', () => {
    it('黑兵升变在第 7 行（row=7）', () => {
        const board = emptyBoard();
        board[6][4] = 'bP'; // e2，黑兵前进到 e1 即 row=7
        board[7][0] = 'wK';
        board[0][4] = 'bK';
        const state = baseState({ turn: 'b' });
        const moves = getLegalMovesFrom(board, state, 6, 4);
        const promos = moves.filter((m) => m.promotion);
        expect(promos).toHaveLength(4);
        expect(new Set(promos.map((m) => m.promotion))).toEqual(new Set(['Q', 'R', 'B', 'N']));
    });

    it('斜吃升变：吃掉对方子后升变', () => {
        const board = emptyBoard();
        board[1][0] = 'wP';     // a7
        board[0][1] = 'bR';     // b8 黑车
        board[7][4] = 'wK';
        board[0][4] = 'bK';
        const state = baseState();
        const moves = getLegalMovesFrom(board, state, 1, 0);
        const capturePromo = moves.filter((m) => m.promotion && m.capture);
        expect(capturePromo.length).toBe(4); // 4 种升变吃
        expect(capturePromo.every((m) => m.to[0] === 0 && m.to[1] === 1)).toBe(true);
        const { board: after } = applyMove(board, state, capturePromo.find((m) => m.promotion === 'Q'));
        expect(after[0][1]).toBe('wQ');
    });

    it('升变为后创造将军', () => {
        // 白兵 e7 升变为后在 e8，攻击 a8 上的黑王
        const board = emptyBoard();
        board[0][0] = 'bK';    // a8
        board[1][4] = 'wP';    // e7
        board[7][7] = 'wK';
        const state = baseState();
        const moves = getLegalMovesFrom(board, state, 1, 4);
        const promoQ = moves.find((m) => m.promotion === 'Q' && !m.capture);
        const { board: after } = applyMove(board, state, promoQ);
        expect(after[0][4]).toBe('wQ');
        const newState = { ...state, turn: 'b' };
        expect(isInCheck(after, 'b')).toBe(true);
    });

    it('升变为车创造将军', () => {
        // 白兵 b7 升变为车在 b8，攻击 c8 上的黑王
        const board = emptyBoard();
        board[0][2] = 'bK';    // c8
        board[1][1] = 'wP';    // b7
        board[7][7] = 'wK';
        const state = baseState();
        const moves = getLegalMovesFrom(board, state, 1, 1);
        const promoR = moves.find((m) => m.promotion === 'R' && !m.capture);
        const { board: after } = applyMove(board, state, promoR);
        expect(after[0][1]).toBe('wR');
        const newState = { ...state, turn: 'b' };
        expect(isInCheck(after, 'b')).toBe(true);
    });
});

describe('games/chess/rules — 子力不足边界', () => {
    it('K+N vs K 判和', () => {
        const board = emptyBoard();
        board[0][0] = 'bK';
        board[7][7] = 'wK';
        board[3][3] = 'wN';
        expect(isInsufficientMaterial(board)).toBe(true);
    });

    it('K+B vs K 判和', () => {
        const board = emptyBoard();
        board[0][0] = 'bK';
        board[7][7] = 'wK';
        board[4][4] = 'wB';
        expect(isInsufficientMaterial(board)).toBe(true);
    });

    it('K+B vs K+B 异色格判和', () => {
        const board = emptyBoard();
        board[0][0] = 'bK';    // a8 暗格 (0+0=0 偶)
        board[7][7] = 'wK';    // h1 暗格 (7+7=14 偶)
        board[4][4] = 'bB';    // e5 (4+4=8 偶→暗格)
        board[3][3] = 'wB';    // d4 (3+3=6 偶→暗格)
        // 同色格应判和
        expect(isInsufficientMaterial(board)).toBe(true);
    });

    it('K+B vs K+B 异色格不判和', () => {
        const board = emptyBoard();
        board[0][0] = 'bK';    // a8 暗格 (0+0=0 偶)
        board[7][7] = 'wK';    // h1 暗格 (7+7=14 偶)
        board[4][4] = 'bB';    // e5 (4+4=8 偶→暗格)
        board[3][4] = 'wB';    // e4 (3+4=7 奇→亮格)
        expect(isInsufficientMaterial(board)).toBe(false);
    });

    it('K+Q vs K 不判和', () => {
        const board = emptyBoard();
        board[0][0] = 'bK';
        board[7][7] = 'wK';
        board[3][3] = 'wQ';
        expect(isInsufficientMaterial(board)).toBe(false);
    });

    it('K+2B vs K 不判和', () => {
        const board = emptyBoard();
        board[0][0] = 'bK';
        board[7][7] = 'wK';
        board[3][3] = 'wB';
        board[3][4] = 'wB';
        expect(isInsufficientMaterial(board)).toBe(false);
    });
});

describe('games/chess/rules — 50 步规则', () => {
    it('halfmoveClock 为 99 时不算和棋', () => {
        expect(isFiftyMoveDraw({ halfmoveClock: 99 })).toBe(false);
    });

    it('halfmoveClock 为 100 时判和', () => {
        expect(isFiftyMoveDraw({ halfmoveClock: 100 })).toBe(true);
    });

    it('halfmoveClock 为 200 时仍判和', () => {
        expect(isFiftyMoveDraw({ halfmoveClock: 200 })).toBe(true);
    });

    it('缺 halfmoveClock 字段默认为 0', () => {
        expect(isFiftyMoveDraw({})).toBe(false);
    });
});

describe('games/chess/rules — isSquareAttacked', () => {
    it('马攻击所有 L 形格', () => {
        const board = emptyBoard();
        board[4][4] = 'wN'; // e5
        board[0][0] = 'bK';
        board[7][4] = 'wK';
        // 马在 e5 可攻击 c4/c6/d3/d7/f3/f7/g4/g6
        const expected = [[2, 3], [2, 5], [3, 2], [3, 6], [5, 2], [5, 6], [6, 3], [6, 5]];
        for (const [r, c] of expected) {
            expect(isSquareAttacked(board, r, c, 'w')).toBe(true);
        }
        // 不相邻的格不应被攻击
        expect(isSquareAttacked(board, 4, 4, 'w')).toBe(false); // 马本身
    });

    it('兵的攻击方向正确', () => {
        const board = emptyBoard();
        board[4][4] = 'wP'; // e5 白兵
        // 白兵攻击 d6(row=3) 和 f6(row=3)
        expect(isSquareAttacked(board, 3, 3, 'w')).toBe(true);
        expect(isSquareAttacked(board, 3, 5, 'w')).toBe(true);
        // 不攻击 e6（正前方）
        expect(isSquareAttacked(board, 3, 4, 'w')).toBe(false);
        // 不攻击 d5/f5（同行）
        expect(isSquareAttacked(board, 4, 3, 'w')).toBe(false);
    });

    it('黑兵攻击方向与白兵相反', () => {
        const board = emptyBoard();
        board[4][4] = 'bP'; // e5 黑兵
        // 黑兵攻击 d4(row=5) 和 f4(row=5)
        expect(isSquareAttacked(board, 5, 3, 'b')).toBe(true);
        expect(isSquareAttacked(board, 5, 5, 'b')).toBe(true);
        // 不攻击 e4（正前方）
        expect(isSquareAttacked(board, 5, 4, 'b')).toBe(false);
    });

    it('象攻击对角线', () => {
        const board = emptyBoard();
        board[4][4] = 'wB'; // e5
        board[0][0] = 'bK';
        board[7][4] = 'wK';
        expect(isSquareAttacked(board, 2, 2, 'w')).toBe(true); // c7 对角
        expect(isSquareAttacked(board, 2, 6, 'w')).toBe(true); // g7 对角
        expect(isSquareAttacked(board, 4, 5, 'w')).toBe(false); // 非对角
    });
});

describe('games/chess/rules — oppositeColor', () => {
    it('白返回黑，黑返回白', () => {
        expect(oppositeColor('w')).toBe('b');
        expect(oppositeColor('b')).toBe('w');
    });
});

describe('games/chess/rules — applyMove 全回合计数', () => {
    it('白方走后 fullmoveNumber 不变', () => {
        const board = emptyBoard();
        board[7][4] = 'wK';
        board[0][4] = 'bK';
        board[6][4] = 'wP';
        const state = baseState({ fullmoveNumber: 5 });
        const moves = getLegalMovesFrom(board, state, 6, 4);
        const step = moves.find((m) => !m.doubleStep);
        const { state: next } = applyMove(board, state, step);
        expect(next.fullmoveNumber).toBe(5);
    });

    it('黑方走后 fullmoveNumber +1', () => {
        const board = emptyBoard();
        board[7][4] = 'wK';
        board[0][4] = 'bK';
        board[1][4] = 'bP';
        const state = baseState({ turn: 'b', fullmoveNumber: 5 });
        const moves = getLegalMovesFrom(board, state, 1, 4);
        const step = moves.find((m) => !m.doubleStep);
        const { state: next } = applyMove(board, state, step);
        expect(next.fullmoveNumber).toBe(6);
    });
});

describe('games/chess/rules — cloneBoard', () => {
    it('克隆棋盘修改不影响原棋盘', () => {
        const state = createChessState();
        const copy = cloneBoard(state.board);
        copy[4][4] = 'wK';
        expect(state.board[4][4]).toBeNull();
    });
});

describe('games/chess/rules — 王车易位结构验证', () => {
    it('短易位的 rookFrom/rookTo 正确', () => {
        const board = emptyBoard();
        board[7][4] = 'wK';
        board[7][7] = 'wR';
        board[0][4] = 'bK';
        const state = baseState({ castlingRights: { wK: true, wQ: false, bK: false, bQ: false } });
        const moves = getLegalMovesFrom(board, state, 7, 4);
        const castleK = moves.find((m) => m.castle === 'K');
        expect(castleK.rookFrom).toEqual([7, 7]);
        expect(castleK.rookTo).toEqual([7, 5]);
    });

    it('长易位的 rookFrom/rookTo 正确', () => {
        const board = emptyBoard();
        board[7][4] = 'wK';
        board[7][0] = 'wR';
        board[0][4] = 'bK';
        const state = baseState({ castlingRights: { wK: false, wQ: true, bK: false, bQ: false } });
        const moves = getLegalMovesFrom(board, state, 7, 4);
        const castleQ = moves.find((m) => m.castle === 'Q');
        expect(castleQ.rookFrom).toEqual([7, 0]);
        expect(castleQ.rookTo).toEqual([7, 3]);
    });
});

describe('games/chess/rules — 吃过路兵深度边界', () => {
    it('过路兵移除两枚兵后暴露己方王到直线上——应被过滤', () => {
        // 经典 pin 场景：白王 a1，白兵 e5，黑兵 d5，黑车 a5
        // 白兵吃过路兵 d5→d6 会同时移除 e5 和 d5，但黑车 a5→a1 没有阻碍
        // 实际上 e5 移除不影响 a 线，换一个更好的 pin 场景：
        // 白王 e1，白兵 d5，黑兵 e5，黑车 e8
        // 过路兵目标是 d6，黑兵在 e6 被双步到 e5 → enPassantTarget=[4,4]
        // 白兵 d5 吃 e5 过路兵到 e6，但 e5 和 d5 的兵都被移除了……
        // 换：白王 a5，白兵 e5，黑兵 d5 刚双步到 d5，黑车 a5 行
        const board = emptyBoard();
        board[4][0] = 'wK';    // a5 白王
        board[4][4] = 'wP';    // e5 白兵
        board[3][3] = 'bP';    // d5 黑兵（已从 d7 双步到 d5）
        board[4][7] = 'bR';    // h5 黑车（同行攻击 a5 王）
        board[0][4] = 'bK';    // e8 黑王
        // 不行，两个兵都在 row=4，白王也在 row=4——如果白兵吃过路兵（到 d6=row2）
        // 移除的兵在 row=3 和 row=4，但白王在 row=4 col=0，黑车在 row=4 col=7
        // 过路吃：wP e5→enPassant(target at d6=[2,3])，移除 d5 黑兵(capRow=tr+1=3)
        // 结果：e5 和 d5 的兵都消失了，a5-h5 线上白王暴露给黑车 h5
        // 这正是经典 pin！
        const state = baseState({ turn: 'w', enPassantTarget: [2, 3] });
        const moves = getLegalMovesFrom(board, state, 4, 4);
        const ep = moves.find((m) => m.enPassant);
        // 过路吃后白王暴露到黑车直线，应被过滤
        expect(ep).toBeUndefined();
    });

    it('过路吃后 halfmoveClock 归零', () => {
        const board = emptyBoard();
        board[3][4] = 'wP';    // e5
        board[3][5] = 'bP';    // f5
        board[7][4] = 'wK';
        board[0][4] = 'bK';
        const state = baseState({ turn: 'w', enPassantTarget: [2, 5], halfmoveClock: 20 });
        const moves = getLegalMovesFrom(board, state, 3, 4);
        const ep = moves.find((m) => m.enPassant);
        const { state: next } = applyMove(board, state, ep);
        expect(next.halfmoveClock).toBe(0);
    });

    it('黑方过路吃白兵也正确过滤 pin 场景', () => {
        // 黑王 a5，黑兵 d4，白兵 e4 刚双步，白车 h5
        const board = emptyBoard();
        board[4][0] = 'bK';    // a5
        board[4][3] = 'bP';    // d4
        board[4][4] = 'wP';    // e4（从 e2 双步到 e4）
        board[4][7] = 'wR';    // h5
        board[7][4] = 'wK';    // e1
        const state = baseState({ turn: 'b', enPassantTarget: [5, 4] });
        const moves = getLegalMovesFrom(board, state, 4, 3);
        const ep = moves.find((m) => m.enPassant);
        // 过路吃 e4 后同时移除 d4 和 e4 兵，黑王暴露给白车 h5
        expect(ep).toBeUndefined();
    });
});

describe('games/chess/rules — 升变深度边界', () => {
    it('升变为象创造对角线攻击', () => {
        // 白兵 b7 升变为象在 b8，象在 b8 对角线攻击 c7 的黑王
        const board = emptyBoard();
        board[1][1] = 'wP';    // b7
        board[1][2] = 'bK';    // c7
        board[7][7] = 'wK';
        const state = baseState();
        const moves = getLegalMovesFrom(board, state, 1, 1);
        const promoB = moves.find((m) => m.promotion === 'B');
        const { board: after } = applyMove(board, state, promoB);
        expect(after[0][1]).toBe('wB');
        expect(isInCheck(after, 'b')).toBe(true); // wB b8 对角攻击 c7
    });

    it('升变为马创造将军', () => {
        // 白兵 e7 升变为马在 e8，马在 e8 的移动范围是 (1,2),(1,6),(2,3),(2,5)
        // 黑王在 d6 (row=2,col=3) 正好在攻击范围内
        const board = emptyBoard();
        board[1][4] = 'wP';    // e7
        board[2][3] = 'bK';    // d6
        board[7][7] = 'wK';
        const state = baseState();
        const moves = getLegalMovesFrom(board, state, 1, 4);
        const promoN = moves.find((m) => m.promotion === 'N');
        const { board: after } = applyMove(board, state, promoN);
        expect(after[0][4]).toBe('wN');
        expect(isInCheck(after, 'b')).toBe(true); // wN e8 攻击 d6
    });

    it('升变吃子后升变为正确子种', () => {
        // 黑兵 c2 吃白车 b1 升变为后
        const board = emptyBoard();
        board[6][2] = 'bP';    // c2
        board[7][1] = 'wR';    // b1
        board[7][7] = 'wK';
        board[0][4] = 'bK';
        const state = baseState({ turn: 'b' });
        const moves = getLegalMovesFrom(board, state, 6, 2);
        const capturePromo = moves.find((m) => m.promotion === 'Q' && m.capture);
        expect(capturePromo).toBeDefined();
        const { board: after } = applyMove(board, state, capturePromo);
        expect(after[7][1]).toBe('bQ');
        expect(after[6][2]).toBeNull();
    });

    it('被挡住无法升变的兵不生成升变走法', () => {
        // 白兵 a7 被己方象挡住
        const board = emptyBoard();
        board[1][0] = 'wP';    // a7
        board[0][0] = 'wB';    // a8 己方象挡路
        board[0][4] = 'bK';
        board[7][4] = 'wK';
        const state = baseState();
        const moves = getLegalMovesFrom(board, state, 1, 0);
        expect(moves.length).toBe(0);
    });
});

describe('games/chess/rules — 王车易位深度边界', () => {
    it('长易位路径中 b1 格被敌方攻击——仍然可行（b1 不是王经过格）', () => {
        // 白方长易位：王 e1→c1，经过 d1 和 c1；b1 只是车经过格，不检查攻击
        const board = emptyBoard();
        board[7][4] = 'wK';
        board[7][0] = 'wR';
        board[0][4] = 'bK';
        board[0][1] = 'bR';    // b8 车攻击 b1
        const state = baseState({ castlingRights: { wK: false, wQ: true, bK: false, bQ: false } });
        const moves = getLegalMovesFrom(board, state, 7, 4);
        // b1 不是王经过的格（王走 e1→d1→c1），长易位仍可行
        expect(moves.some((m) => m.castle === 'Q')).toBe(true);
    });

    it('王走了一步后双方易位权全部丢失', () => {
        const board = emptyBoard();
        board[7][4] = 'wK';
        board[7][0] = 'wR';
        board[7][7] = 'wR';
        board[0][4] = 'bK';
        board[0][0] = 'bR';
        board[0][7] = 'bR';
        const state = baseState({
            castlingRights: { wK: true, wQ: true, bK: true, bQ: true }
        });
        // 白王走 Ke2
        const moves = getLegalMovesFrom(board, state, 7, 4);
        const ke2 = moves.find((m) => m.to[0] === 6 && m.to[1] === 4);
        const { state: next } = applyMove(board, state, ke2);
        expect(next.castlingRights.wK).toBe(false);
        expect(next.castlingRights.wQ).toBe(false);
        // 黑方权不受影响
        expect(next.castlingRights.bK).toBe(true);
        expect(next.castlingRights.bQ).toBe(true);
    });

    it('己方子走动使己方车不在角落——易位权利仍按走动的子类型判定', () => {
        // 白兵走 h3 后，白车 h1 仍在——wK 易位权应保留
        const board = emptyBoard();
        board[7][4] = 'wK';
        board[7][7] = 'wR';
        board[6][7] = 'wP';    // h2 白兵
        board[0][4] = 'bK';
        const state = baseState({ castlingRights: { wK: true, wQ: false, bK: false, bQ: false } });
        const moves = getLegalMovesFrom(board, state, 6, 7);
        const h3 = moves.find((m) => m.to[0] === 5 && m.to[1] === 7);
        const { state: next } = applyMove(board, state, h3);
        expect(next.castlingRights.wK).toBe(true); // 车未动，王未动
    });
});

describe('games/chess/rules — isSquareAttacked 深度', () => {
    it('后攻击直线和对角线', () => {
        const board = emptyBoard();
        board[4][4] = 'wQ';    // e5
        board[0][0] = 'bK';
        board[7][4] = 'wK';
        // 直线
        expect(isSquareAttacked(board, 4, 0, 'w')).toBe(true); // a5
        expect(isSquareAttacked(board, 0, 4, 'w')).toBe(true); // e8
        // 对角
        expect(isSquareAttacked(board, 2, 2, 'w')).toBe(true); // c7
        expect(isSquareAttacked(board, 2, 6, 'w')).toBe(true); // g7
        // 不攻击
        expect(isSquareAttacked(board, 3, 6, 'w')).toBe(false); // f6 马步但非直线/对角
    });

    it('被己方子挡住的攻击线不穿透', () => {
        const board = emptyBoard();
        board[4][4] = 'wR';    // e5 白车
        board[4][2] = 'wP';    // c5 己方兵挡住 a5 方向
        board[0][0] = 'bK';
        board[7][4] = 'wK';
        // 被己方兵挡住，a5 不被攻击
        expect(isSquareAttacked(board, 4, 0, 'w')).toBe(false);
        // 但 d5 仍被攻击（没被挡）
        expect(isSquareAttacked(board, 4, 3, 'w')).toBe(true);
    });
});

describe('games/chess/rules — getLegalMoves 全局', () => {
    it('被将时只返回解除将军的走法', () => {
        // 白王 e1 被黑车 e8 将军，只有移动王、挡将或吃将子
        const board = emptyBoard();
        board[7][4] = 'wK';
        board[0][4] = 'bR';
        board[0][0] = 'bK';
        board[6][3] = 'wR';    // d2 白车可挡
        const state = baseState({ turn: 'w' });
        const moves = getLegalMoves(board, state, 'w');
        // 所有走法必须解除将军
        for (const mv of moves) {
            const { board: after } = applyMove(board, state, mv);
            expect(isInCheck(after, 'w')).toBe(false);
        }
    });

    it('getLegalMoves 包含所有棋子的走法', () => {
        const state = createChessState();
        const moves = getLegalMoves(state.board, state, 'w');
        // 应包含兵、马的走法
        const pawnMoves = moves.filter((m) => m.piece === 'wP');
        const knightMoves = moves.filter((m) => m.piece === 'wN');
        expect(pawnMoves.length).toBeGreaterThan(0);
        expect(knightMoves.length).toBeGreaterThan(0);
    });
});

describe('games/chess/rules — findKing 边界', () => {
    it('无王时返回 null', () => {
        const board = emptyBoard();
        expect(findKing(board, 'w')).toBeNull();
        expect(findKing(board, 'b')).toBeNull();
    });

    it('多王时返回第一个找到的', () => {
        const board = emptyBoard();
        board[0][0] = 'wK';
        board[7][7] = 'wK';
        const king = findKing(board, 'w');
        expect(king).toBeDefined();
        expect(board[king[0]][king[1]]).toBe('wK');
    });
});

describe('games/chess/rules — 绝对钉子（pinned piece）', () => {
    it('被钉住的己方子不能移动（离开攻击线）', () => {
        // 白王 e1，白车 e3，黑车 e8 —— 白车被钉在 e 线
        const board = emptyBoard();
        board[7][4] = 'wK';    // e1
        board[5][4] = 'wR';    // e3 白车被钉
        board[0][4] = 'bR';    // e8 黑车
        board[0][0] = 'bK';    // a8
        const state = baseState({ turn: 'w' });
        const rookMoves = getLegalMovesFrom(board, state, 5, 4);
        const dests = new Set(rookMoves.map((m) => `${m.to[0]},${m.to[1]}`));
        // 车沿 e 线向上挡将——合法
        expect(dests.has('4,4')).toBe(true);   // e4
        expect(dests.has('3,4')).toBe(true);   // e5
        expect(dests.has('2,4')).toBe(true);   // e6
        expect(dests.has('1,4')).toBe(true);   // e7
        expect(dests.has('0,4')).toBe(true);   // e8 吃车
        // 离开 e 线——暴露王——非法
        expect(dests.has('5,3')).toBe(false);  // d3
        expect(dests.has('5,5')).toBe(false);  // f3
    });

    it('被钉住的兵只能前进不能横吃', () => {
        // 白王 a1，白兵 b2，黑象 b8 对角线 a1——白兵被钉在 a1-b8 对角线
        // 但兵的前进方向是 b3（离开对角线）……换个场景：
        // 白王 e1，白兵 e2，黑象 h5 对角线 e2-h5 穿过 e1……不行
        // 白王 e1，白车 e3，黑车 e8 —— 白车被钉
        const board = emptyBoard();
        board[7][4] = 'wK';    // e1
        board[5][4] = 'wR';    // e3 白车被钉
        board[0][4] = 'bR';    // e8
        board[0][0] = 'bK';
        const state = baseState({ turn: 'w' });
        const rookMoves = getLegalMovesFrom(board, state, 5, 4);
        const dests = new Set(rookMoves.map((m) => `${m.to[0]},${m.to[1]}`));
        // 只能沿 e 线移动（向上或向下但不能过王）
        expect(dests.has('4,4')).toBe(true);   // e4 挡将方向
        expect(dests.has('5,3')).toBe(false);  // d3 离开线非法
        expect(dests.has('5,5')).toBe(false);  // f3 离开线非法
    });
});

describe('games/chess/rules — 王不能走入攻击格', () => {
    it('王不能走到被攻击的格子', () => {
        const board = emptyBoard();
        board[7][4] = 'wK';    // e1
        board[0][4] = 'bK';    // e8
        board[4][3] = 'bR';    // d5 控制 d1
        board[4][5] = 'bR';    // f5 控制 f1
        const state = baseState({ turn: 'w' });
        const kingMoves = getLegalMovesFrom(board, state, 7, 4);
        const dests = new Set(kingMoves.map((m) => `${m.to[0]},${m.to[1]}`));
        // e2 (6,4) 应该安全
        expect(dests.has('6,4')).toBe(true);
        // d1 (7,3) 被 d5 车控制
        expect(dests.has('7,3')).toBe(false);
        // f1 (7,5) 被 f5 车控制
        expect(dests.has('7,5')).toBe(false);
    });

    it('王不能走到相邻王控制的格子', () => {
        const board = emptyBoard();
        board[4][4] = 'wK';    // e5
        board[6][4] = 'bK';    // e3（注意row越大越靠下）
        const state = baseState({ turn: 'w' });
        const kingMoves = getLegalMovesFrom(board, state, 4, 4);
        const dests = new Set(kingMoves.map((m) => `${m.to[0]},${m.to[1]}`));
        // e4 (5,4) 被黑王控制
        expect(dests.has('5,4')).toBe(false);
        // d4 (5,3) 被黑王控制
        expect(dests.has('5,3')).toBe(false);
        // f4 (5,5) 被黑王控制
        expect(dests.has('5,5')).toBe(false);
    });
});

describe('games/chess/rules — 发现将军（discovered check）', () => {
    it('移开己方子后暴露将军（发现将军）', () => {
        // 白后 e1，白马 e4 遮挡——马移开后后攻击 e8 黑王
        const board = emptyBoard();
        board[7][4] = 'wQ';    // e1 白后
        board[4][4] = 'wN';    // e4 白马遮挡 e1→e8 线
        board[0][4] = 'bK';    // e8 黑王
        board[7][7] = 'wK';    // h1 白王
        const state = baseState({ turn: 'w' });
        // 马走 d6 (2,3) 后暴露后攻击 e8
        const knightMoves = getLegalMovesFrom(board, state, 4, 4);
        const d6 = knightMoves.find((m) => m.to[0] === 2 && m.to[1] === 3);
        expect(d6).toBeDefined();
        const { board: after } = applyMove(board, state, d6);
        expect(after[4][4]).toBeNull();
        expect(after[2][3]).toBe('wN');
        // 马移走后，后 e1 沿 e 线攻击 e8——发现将军
        expect(isInCheck(after, 'b')).toBe(true);
    });
});

describe('games/chess/rules — 升变将杀', () => {
    it('升变产生将杀', () => {
        // 白兵 g7 升变为后在 g8 将军黑王 h8
        // 后 g8 控制 h8(rank)、h7(对角)、g7(g列)
        // 白王 f7 保护 g8 后（黑王不能吃后）
        const board = emptyBoard();
        board[0][7] = 'bK';    // h8
        board[1][6] = 'wP';    // g7
        board[1][5] = 'wK';    // f7
        const state = baseState({ turn: 'w' });
        const moves = getLegalMovesFrom(board, state, 1, 6);
        const promoQ = moves.find((m) => m.promotion === 'Q');
        const { board: after } = applyMove(board, state, promoQ);
        expect(after[0][6]).toBe('wQ');
        const newState = { ...state, turn: 'b' };
        expect(isInCheck(after, 'b')).toBe(true);
        expect(isCheckmate(after, newState)).toBe(true);
    });
});

describe('games/chess/rules — 复杂场景', () => {
    it('将死后 isStalemate 返回 false', () => {
        const board = emptyBoard();
        board[0][0] = 'bK';
        board[1][0] = 'wQ';
        board[2][0] = 'wK';
        const state = baseState({ turn: 'b' });
        expect(isCheckmate(board, state)).toBe(true);
        expect(isStalemate(board, state)).toBe(false);
    });

    it('被将时 getLegalMoves 只返回解将走法', () => {
        const board = emptyBoard();
        board[7][4] = 'wK';    // e1
        board[0][4] = 'bK';    // e8
        board[3][4] = 'bQ';    // e5 将军
        board[7][0] = 'wR';    // a1
        board[6][0] = 'wP';    // a2
        const state = baseState({ turn: 'w' });
        expect(isInCheck(board, 'w')).toBe(true);
        const moves = getLegalMoves(board, state, 'w');
        for (const mv of moves) {
            const { board: after } = applyMove(board, state, mv);
            expect(isInCheck(after, 'w')).toBe(false);
        }
    });

    it('将和棋场景：只有王且所有格被攻击', () => {
        // 黑王 h8，白后 f7，白王 h6 —— 黑王无处可走且未被将
        const board = emptyBoard();
        board[0][7] = 'bK';    // h8
        board[1][5] = 'wQ';    // f7
        board[2][7] = 'wK';    // h6
        const state = baseState({ turn: 'b' });
        expect(isStalemate(board, state)).toBe(true);
    });

    it('子力不足：K+P vs K 不判和', () => {
        const board = emptyBoard();
        board[0][0] = 'bK';
        board[7][7] = 'wK';
        board[4][4] = 'wP';
        expect(isInsufficientMaterial(board)).toBe(false);
    });

    it('子力不足：K+R vs K+N 不判和', () => {
        const board = emptyBoard();
        board[0][0] = 'bK';
        board[7][7] = 'wK';
        board[3][3] = 'wR';
        board[4][4] = 'bN';
        expect(isInsufficientMaterial(board)).toBe(false);
    });

    it('子力不足：K+B vs K+B 异色格不判和', () => {
        const board = emptyBoard();
        board[0][0] = 'bK';    // a8 (0+0=0 偶)
        board[7][7] = 'wK';    // h1 (7+7=14 偶)
        board[3][3] = 'wB';    // d4 (3+3=6 偶→暗)
        board[3][4] = 'bB';    // e4 (3+4=7 奇→亮)
        expect(isInsufficientMaterial(board)).toBe(false);
    });

    it('长易位经过 d1 被攻击时不能易位', () => {
        const board = emptyBoard();
        board[7][4] = 'wK';
        board[7][0] = 'wR';
        board[0][4] = 'bK';
        board[4][3] = 'bR';    // d5 控制 d1
        const state = baseState({ castlingRights: { wK: false, wQ: true, bK: false, bQ: false } });
        const moves = getLegalMovesFrom(board, state, 7, 4);
        // d1 被攻击，长易位经过 d1——不可行
        expect(moves.some((m) => m.castle === 'Q')).toBe(false);
    });

    it('applyMove 更新 enPassantTarget 为 null 当非双步', () => {
        const board = emptyBoard();
        board[5][4] = 'wP';    // e3
        board[0][4] = 'bK';
        board[7][4] = 'wK';
        const state = baseState({ enPassantTarget: [5, 3] }); // 之前有过路兵目标
        const moves = getLegalMovesFrom(board, state, 5, 4);
        const step = moves.find((m) => !m.enPassant);
        const { state: next } = applyMove(board, state, step);
        expect(next.enPassantTarget).toBeNull();
    });

    it('半回合计数：吃子归零', () => {
        const board = emptyBoard();
        board[5][4] = 'wR';    // e3
        board[4][4] = 'bN';    // e4
        board[0][4] = 'bK';
        board[7][4] = 'wK';
        const state = baseState({ turn: 'w', halfmoveClock: 30 });
        const moves = getLegalMovesFrom(board, state, 5, 4);
        const capture = moves.find((m) => m.capture);
        const { state: next } = applyMove(board, state, capture);
        expect(next.halfmoveClock).toBe(0);
    });

    it('半回合计数：非吃子非兵走法递增', () => {
        const board = emptyBoard();
        board[5][4] = 'wR';    // e3
        board[0][4] = 'bK';
        board[7][4] = 'wK';
        const state = baseState({ turn: 'w', halfmoveClock: 15 });
        const moves = getLegalMovesFrom(board, state, 5, 4);
        const quiet = moves.find((m) => !m.capture);
        const { state: next } = applyMove(board, state, quiet);
        expect(next.halfmoveClock).toBe(16);
    });
});
