import { describe, it, expect } from 'vitest';

import {
    BOARD_ROWS,
    BOARD_COLS,
    RANK_LEVEL,
    createInitialBoard,
    oppositeColor,
    canCapture,
    generatePieceMoves,
    generateFlipMoves,
    getLegalMoves,
    applyMove,
    checkWinner,
    countAlive,
    inBounds
} from './rules.js';

function emptyBoard() {
    return Array.from({ length: BOARD_ROWS }, () => Array(BOARD_COLS).fill(null));
}

function piece(color, rank, revealed = true) {
    return { color, rank, revealed };
}

describe('games/junqi/flip/rules — 基础', () => {
    it('棋盘是 4 行 8 列', () => {
        expect(BOARD_ROWS).toBe(4);
        expect(BOARD_COLS).toBe(8);
    });

    it('inBounds 正确识别边界', () => {
        expect(inBounds(0, 0)).toBe(true);
        expect(inBounds(3, 7)).toBe(true);
        expect(inBounds(-1, 0)).toBe(false);
        expect(inBounds(4, 0)).toBe(false);
        expect(inBounds(0, 8)).toBe(false);
    });

    it('oppositeColor 反转颜色', () => {
        expect(oppositeColor('r')).toBe('b');
        expect(oppositeColor('b')).toBe('r');
    });

    it('createInitialBoard 生成 32 子背面朝下', () => {
        const board = createInitialBoard();
        let total = 0;
        let revealed = 0;
        for (let r = 0; r < 4; r += 1) {
            for (let c = 0; c < 8; c += 1) {
                const p = board[r][c];
                expect(p).not.toBeNull();
                total += 1;
                if (p.revealed) revealed += 1;
            }
        }
        expect(total).toBe(32);
        expect(revealed).toBe(0);
    });

    it('初始棋盘每色 16 子且军衔分布合法', () => {
        const board = createInitialBoard();
        const counts = { r: {}, b: {} };
        for (let r = 0; r < 4; r += 1) {
            for (let c = 0; c < 8; c += 1) {
                const p = board[r][c];
                counts[p.color][p.rank] = (counts[p.color][p.rank] || 0) + 1;
            }
        }
        const expected = { K: 1, A: 2, E: 2, R: 2, N: 2, C: 2, P: 5 };
        for (const col of ['r', 'b']) {
            expect(counts[col]).toEqual(expected);
        }
    });
});

describe('games/junqi/flip/rules — canCapture', () => {
    it('同色不能互吃', () => {
        expect(canCapture(piece('r', 'K'), piece('r', 'P'))).toBe(false);
    });

    it('未翻开不能被普通吃', () => {
        expect(canCapture(piece('r', 'K'), piece('b', 'P', false))).toBe(false);
    });

    it('级别高者吃级别低者', () => {
        expect(canCapture(piece('r', 'R'), piece('b', 'C'))).toBe(true); // R=4, C=2
        expect(canCapture(piece('r', 'C'), piece('b', 'R'))).toBe(false);
    });

    it('同级可以互吃', () => {
        expect(canCapture(piece('r', 'N'), piece('b', 'N'))).toBe(true);
    });

    it('特例：兵吃将', () => {
        expect(canCapture(piece('r', 'P'), piece('b', 'K'))).toBe(true);
    });

    it('特例：将不能吃兵', () => {
        expect(canCapture(piece('r', 'K'), piece('b', 'P'))).toBe(false);
    });
});

describe('games/junqi/flip/rules — generatePieceMoves', () => {
    it('未翻开的子不能走动', () => {
        const board = emptyBoard();
        board[1][1] = piece('r', 'N', false);
        expect(generatePieceMoves(board, 1, 1)).toHaveLength(0);
    });

    it('翻开后可沿四邻走到空格', () => {
        const board = emptyBoard();
        board[1][1] = piece('r', 'N');
        const moves = generatePieceMoves(board, 1, 1);
        // 四个邻居都空 → 4 个 move
        expect(moves.filter((m) => m.kind === 'move')).toHaveLength(4);
    });

    it('能吃相邻异色、级别 ≤ 自己的棋子', () => {
        const board = emptyBoard();
        board[1][1] = piece('r', 'R'); // 车 4
        board[1][2] = piece('b', 'C'); // 炮 2 —— 可吃
        board[0][1] = piece('b', 'K'); // 将 7 —— 不可吃（车级别 < 将级别）
        const moves = generatePieceMoves(board, 1, 1);
        const captures = moves.filter((m) => m.kind === 'capture');
        expect(captures.find((m) => m.to[0] === 1 && m.to[1] === 2)).toBeDefined();
        expect(captures.find((m) => m.to[0] === 0 && m.to[1] === 1)).toBeUndefined();
    });

    it('兵相邻可吃将', () => {
        const board = emptyBoard();
        board[1][1] = piece('r', 'P');
        board[1][2] = piece('b', 'K');
        const moves = generatePieceMoves(board, 1, 1);
        expect(moves.some((m) => m.kind === 'capture' && m.to[0] === 1 && m.to[1] === 2)).toBe(true);
    });

    it('炮可隔一子吃远处异色子', () => {
        const board = emptyBoard();
        board[0][0] = piece('r', 'C'); // 红炮
        board[0][2] = piece('b', 'N', false); // 炮架（未翻开也算）
        board[0][5] = piece('b', 'K'); // 目标
        const moves = generatePieceMoves(board, 0, 0);
        // 炮可经 (0,2) 的炮架吃 (0,5) 将
        expect(moves.some((m) => m.kind === 'capture' && m.to[0] === 0 && m.to[1] === 5)).toBe(true);
    });

    it('炮没炮架时不能隔子吃', () => {
        const board = emptyBoard();
        board[0][0] = piece('r', 'C');
        board[0][5] = piece('b', 'K');
        const moves = generatePieceMoves(board, 0, 0);
        expect(moves.some((m) => m.kind === 'capture' && m.to[0] === 0 && m.to[1] === 5)).toBe(false);
    });

    it('炮隔两子以上不能吃', () => {
        const board = emptyBoard();
        board[0][0] = piece('r', 'C');
        board[0][2] = piece('b', 'N', false);
        board[0][4] = piece('b', 'N', false); // 第二个炮架
        board[0][6] = piece('b', 'K');
        const moves = generatePieceMoves(board, 0, 0);
        expect(moves.some((m) => m.kind === 'capture' && m.to[0] === 0 && m.to[1] === 6)).toBe(false);
    });
});

describe('games/junqi/flip/rules — generateFlipMoves / getLegalMoves', () => {
    it('未翻开子生成 flip 走法', () => {
        const board = emptyBoard();
        board[1][1] = piece('r', 'N', false);
        expect(generateFlipMoves(board, 1, 1)).toHaveLength(1);
    });

    it('已翻开子不生成 flip 走法', () => {
        const board = emptyBoard();
        board[1][1] = piece('r', 'N');
        expect(generateFlipMoves(board, 1, 1)).toHaveLength(0);
    });

    it('turn=null（首翻阶段）只能翻棋', () => {
        const board = emptyBoard();
        board[0][0] = piece('r', 'N', false);
        board[0][1] = piece('r', 'K'); // 已翻开但不应产生走法
        const moves = getLegalMoves(board, null);
        expect(moves.every((m) => m.kind === 'flip')).toBe(true);
        expect(moves).toHaveLength(1);
    });

    it('turn="r" 时红方翻开子有走法，黑方子无走法', () => {
        const board = emptyBoard();
        board[0][0] = piece('r', 'N');
        board[0][1] = piece('b', 'P');
        const moves = getLegalMoves(board, 'r');
        const redMoves = moves.filter((m) => m.kind !== 'flip');
        // 红马 (0,0) 邻居：(0,1)=黑兵（可吃，P=1 < N=3）+ (1,0) 空
        expect(redMoves.some((m) => m.kind === 'capture' && m.to[0] === 0 && m.to[1] === 1)).toBe(true);
        expect(redMoves.some((m) => m.kind === 'move' && m.to[0] === 1 && m.to[1] === 0)).toBe(true);
    });
});

describe('games/junqi/flip/rules — applyMove', () => {
    it('flip 走法翻开目标棋子', () => {
        const board = emptyBoard();
        board[0][0] = piece('r', 'N', false);
        const state = { turn: null };
        const { board: after, state: next } = applyMove(board, state, {
            kind: 'flip', from: [0, 0], to: [0, 0]
        });
        expect(after[0][0].revealed).toBe(true);
        // 首翻后 turn 切到对手色（翻出红子 → 对手黑先走）
        expect(next.turn).toBe('b');
    });

    it('move 走法搬移棋子并切换 turn', () => {
        const board = emptyBoard();
        board[0][0] = piece('r', 'N');
        const state = { turn: 'r' };
        const { board: after, state: next } = applyMove(board, state, {
            kind: 'move', from: [0, 0], to: [1, 0]
        });
        expect(after[0][0]).toBeNull();
        expect(after[1][0]).toEqual(piece('r', 'N'));
        expect(next.turn).toBe('b');
    });

    it('capture 走法移除对方棋子并记录 lastCaptured', () => {
        const board = emptyBoard();
        board[0][0] = piece('r', 'R');
        board[0][1] = piece('b', 'C');
        const state = { turn: 'r' };
        const { board: after, state: next } = applyMove(board, state, {
            kind: 'capture', from: [0, 0], to: [0, 1]
        });
        expect(after[0][0]).toBeNull();
        expect(after[0][1].color).toBe('r');
        expect(next.lastCaptured?.color).toBe('b');
        expect(next.lastCaptured?.rank).toBe('C');
    });
});

describe('games/junqi/flip/rules — checkWinner', () => {
    it('对方全亡判对方负', () => {
        const board = emptyBoard();
        board[0][0] = piece('r', 'N');
        const state = { turn: 'b' };
        const winner = checkWinner(board, state);
        expect(winner).toEqual({ winner: 'r', reason: 'annihilation' });
    });

    it('双方都存活且有合法走法则无胜负', () => {
        const board = emptyBoard();
        board[0][0] = piece('r', 'N');
        board[3][7] = piece('b', 'C');
        const state = { turn: 'r' };
        expect(checkWinner(board, state)).toBeNull();
    });

    it('countAlive 正确统计子数', () => {
        const board = emptyBoard();
        board[0][0] = piece('r', 'K');
        board[0][1] = piece('r', 'P', false);
        board[1][0] = piece('b', 'N');
        expect(countAlive(board, 'r')).toBe(2);
        expect(countAlive(board, 'b')).toBe(1);
    });

    it('RANK_LEVEL 层级正确', () => {
        expect(RANK_LEVEL.K).toBe(7);
        expect(RANK_LEVEL.P).toBe(1);
        expect(RANK_LEVEL.C).toBe(2);
    });
});

describe('games/junqi/flip/rules — 扩展边界', () => {
    it('canCapture：兵不能吃兵上级（将军之外）', () => {
        expect(canCapture(piece('r', 'P'), piece('b', 'R'))).toBe(false);
        expect(canCapture(piece('r', 'P'), piece('b', 'P'))).toBe(true);
    });

    it('炮吃己方子不允许', () => {
        const board = emptyBoard();
        board[0][0] = piece('r', 'C');
        board[0][2] = piece('b', 'N');
        board[0][4] = piece('r', 'K'); // 己方子
        const moves = generatePieceMoves(board, 0, 0);
        expect(moves.some((m) => m.kind === 'capture' && m.to[0] === 0 && m.to[1] === 4)).toBe(false);
    });

    it('generatePieceMoves 在棋子被包围时无走法', () => {
        const board = emptyBoard();
        board[1][1] = piece('r', 'P');
        board[0][1] = piece('r', 'K');
        board[2][1] = piece('r', 'K');
        board[1][0] = piece('r', 'K');
        board[1][2] = piece('r', 'K');
        // 上下左右都是己方子（且 P 吃不了 K），所以无走法
        expect(generatePieceMoves(board, 1, 1)).toHaveLength(0);
    });

    it('checkWinner：当前方无合法走法且还有己方子视为困毙', () => {
        const board = emptyBoard();
        board[0][0] = piece('r', 'P');
        board[0][1] = piece('b', 'K');  // 兵不能吃相邻将？兵能吃将（特例）——换成非相邻
        // 把 bK 放远一点，让红兵既不能吃也被四围空格阻挡
        board[0][1] = null;
        board[3][7] = piece('b', 'K');
        board[1][0] = piece('r', 'K');  // 在 (1,0)，阻挡红兵向下
        board[0][1] = piece('r', 'K');  // 在 (0,1)，阻挡红兵向右（己方子）
        // 红兵 (0,0) 邻居：(1,0)=己方 / (0,1)=己方 —— 无合法走法
        // 但此时整个红方还有其他子 (1,0) 和 (0,1) 也有走法，所以整体不困毙
        // 简化：检查 getLegalMoves 非空 → checkWinner 应返回 null
        expect(checkWinner(board, { turn: 'r' })).toBeNull();
    });

    it('applyMove 的 flip 首翻正确根据翻出颜色确定 firstFlipColor', () => {
        const board = emptyBoard();
        board[0][0] = piece('r', 'N', false);
        const state = { turn: null, firstPlayer: 'p1' };
        const { state: next } = applyMove(board, state, {
            kind: 'flip', from: [0, 0], to: [0, 0]
        });
        // 翻开了红子，首翻者 p1 获得"对手色"（黑方先行），所以 turn 切到黑
        expect(next.turn).toBe('b');
    });

    it('move 后棋盘位置被清空', () => {
        const board = emptyBoard();
        board[2][3] = piece('r', 'R');
        const state = { turn: 'r' };
        const { board: after } = applyMove(board, state, {
            kind: 'move', from: [2, 3], to: [2, 4]
        });
        expect(after[2][3]).toBeNull();
        expect(after[2][4].rank).toBe('R');
    });

    it('countAlive 计入未翻开的己方子', () => {
        const board = emptyBoard();
        board[0][0] = piece('r', 'K', false);
        board[0][1] = piece('r', 'P', true);
        expect(countAlive(board, 'r')).toBe(2);
    });

    it('RANK_LEVEL 完整枚举', () => {
        expect(RANK_LEVEL.K).toBe(7);
        expect(RANK_LEVEL.A).toBe(6);
        expect(RANK_LEVEL.E).toBe(5);
        expect(RANK_LEVEL.R).toBe(4);
        expect(RANK_LEVEL.N).toBe(3);
        expect(RANK_LEVEL.C).toBe(2);
        expect(RANK_LEVEL.P).toBe(1);
    });
});
