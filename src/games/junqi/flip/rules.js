/**
 * 翻翻棋（暗棋 / Banqi）规则引擎。
 *
 * 棋盘：4 行 × 8 列。棋子背面朝下随机打乱放置。
 *
 * 棋子编码：5 字符字符串 "cXnnn"——
 *   c = 'r'|'b' 颜色
 *   X = 角色级别 'K'|'A'|'E'|'R'|'N'|'C'|'P'
 *   数字位只是补位，实际用 [0:2] 即可；我们用两位字符串 color+role：如 'rK' / 'bC'
 *
 * 棋子编号及级别（数字越大级别越高）：
 *   K 将/帅 7
 *   A 士/仕 6
 *   E 象/相 5
 *   R 车    4
 *   N 马    3
 *   C 炮    2
 *   P 兵/卒 1
 *
 * 每色 16 子：将 1 / 士 2 / 象 2 / 车 2 / 马 2 / 炮 2 / 兵 5。
 *
 * 吃子规则：
 *   - 上下左右相邻一格：级别 ≥ 对方 → 可吃；
 *   - **特例**：兵 P(1) 可吃将 K(7)——以小制大；将 K(7) 不能吃兵 P(1)；
 *   - **炮** C(2) 特殊：必须有且仅有一个"炮架"（任意颜色的一个棋子，暗/明都算），
 *     沿直线可跨越任意空格到达目标，吃任意棋子（含己方？——不，只吃对方）。
 *     炮不经过炮架时按普通级别吃子（即只能吃炮/兵/翻开的 P）。
 *
 * 走法：
 *   - 翻棋（flip）：把一枚未翻开的棋子翻面，回合结束；
 *   - 移动（move）：己方翻开的棋子走一格到空格；
 *   - 吃子（capture）：己方翻开子按上述规则吃对方翻开子；
 *   - 炮可吃未翻开的子（因为不打招呼直接炸）。
 *
 * 首翻：游戏开始时 turn=null，任意玩家翻开一枚子；该子颜色即为翻者的己方色，
 * 对方自动归为另一色。翻完回合切换。
 *
 * 胜负：
 *   - 一方所有棋子（无论明暗）全被吃 → 对方胜；
 *   - 一方无合法走法 → 对方胜。
 *
 * @module games/junqi/flip/rules
 */

export const BOARD_ROWS = 4;
export const BOARD_COLS = 8;

/** 军衔到级别的映射。 */
export const RANK_LEVEL = {
    K: 7, A: 6, E: 5, R: 4, N: 3, C: 2, P: 1
};

/** 每色 16 子的角色分布。 */
export const ROSTER = {
    K: 1, A: 2, E: 2, R: 2, N: 2, C: 2, P: 5
};

/**
 * @typedef {Object} Piece
 * @property {'r'|'b'} color
 * @property {'K'|'A'|'E'|'R'|'N'|'C'|'P'} rank
 * @property {boolean} revealed - 是否已翻开
 */

export function inBounds(row, col) {
    return row >= 0 && row < BOARD_ROWS && col >= 0 && col < BOARD_COLS;
}

export function oppositeColor(color) {
    return color === 'r' ? 'b' : 'r';
}

/**
 * 生成完整的 32 枚棋子池（无颜色分配外的顺序）。
 */
function createPiecePool() {
    const pool = [];
    for (const color of ['r', 'b']) {
        for (const [rank, count] of Object.entries(ROSTER)) {
            for (let i = 0; i < count; i += 1) {
                pool.push({ color, rank, revealed: false });
            }
        }
    }
    return pool;
}

/**
 * Fisher-Yates 打乱（使用 Web Crypto 作为熵源；node 环境兜底到 Math.random）。
 */
function shuffleInPlace(arr, rng) {
    for (let i = arr.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/** 默认随机源。 */
export function createDefaultRng() {
    const cr = globalThis.crypto;
    if (cr?.getRandomValues) {
        return () => {
            const buf = new Uint32Array(1);
            cr.getRandomValues(buf);
            return buf[0] / 0x1_0000_0000;
        };
    }
    return () => Math.random();
}

/**
 * 随机生成初始 4×8 棋盘：32 子全背面朝下随机摆放。
 * @param {() => number} [rng]
 */
export function createInitialBoard(rng = createDefaultRng()) {
    const pool = shuffleInPlace(createPiecePool(), rng);
    const board = Array.from({ length: BOARD_ROWS }, () => Array(BOARD_COLS).fill(null));
    let idx = 0;
    for (let r = 0; r < BOARD_ROWS; r += 1) {
        for (let c = 0; c < BOARD_COLS; c += 1) {
            board[r][c] = pool[idx];
            idx += 1;
        }
    }
    return board;
}

export function cloneBoard(board) {
    return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

/**
 * 判断 attacker 是否可以吃 victim（按标准规则）。不处理炮——炮走子专门在 pseudoMoves 里判定。
 * @param {Piece} attacker
 * @param {Piece} victim
 */
export function canCapture(attacker, victim) {
    if (!attacker || !victim) return false;
    if (attacker.color === victim.color) return false;
    if (!victim.revealed) return false; // 普通相邻吃子要求对方已翻开
    const a = RANK_LEVEL[attacker.rank];
    const v = RANK_LEVEL[victim.rank];
    // 特例：兵吃将
    if (attacker.rank === 'P' && victim.rank === 'K') return true;
    // 将不能吃兵
    if (attacker.rank === 'K' && victim.rank === 'P') return false;
    return a >= v;
}

/**
 * 枚举一枚棋子（必须已翻开 + 颜色=actingColor）的全部伪合法走法。
 * 包含普通移动、相邻吃子、炮的隔子吃子。
 *
 * @param {Array<Array<Piece|null>>} board
 * @param {number} row
 * @param {number} col
 * @returns {Array<{ kind:'move'|'capture', from:[number,number], to:[number,number] }>}
 */
export function generatePieceMoves(board, row, col) {
    const piece = board[row][col];
    if (!piece || !piece.revealed) return [];
    const color = piece.color;
    const moves = [];
    const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    // 相邻四向：空格→移动；对方棋子→能否吃
    for (const [dr, dc] of DIRS) {
        const r = row + dr;
        const c = col + dc;
        if (!inBounds(r, c)) continue;
        const target = board[r][c];
        if (!target) {
            moves.push({ kind: 'move', from: [row, col], to: [r, c] });
            continue;
        }
        if (target.color === color) continue;
        // 相邻炮吃子也按普通规则（炮级别=2 邻格可吃 炮/兵）
        if (canCapture(piece, target)) {
            moves.push({ kind: 'capture', from: [row, col], to: [r, c] });
        }
    }

    // 炮：跨越恰好 1 个炮架的直线吃子（四向均可；距离不限）
    if (piece.rank === 'C') {
        for (const [dr, dc] of DIRS) {
            let r = row + dr;
            let c = col + dc;
            let jumped = false;
            while (inBounds(r, c)) {
                const target = board[r][c];
                if (!jumped) {
                    if (target) {
                        // 找到第一个棋子 —— 它是炮架；炮不能直接停在此处（已由上方"相邻吃子"覆盖）
                        jumped = true;
                    }
                } else {
                    if (target) {
                        if (target.color !== color) {
                            moves.push({ kind: 'capture', from: [row, col], to: [r, c] });
                        }
                        break;
                    }
                }
                r += dr;
                c += dc;
            }
        }
    }

    return moves;
}

/**
 * 返回某格可翻开的"翻棋"走法（未翻开则可翻）。
 */
export function generateFlipMoves(board, row, col) {
    const p = board[row][col];
    if (!p || p.revealed) return [];
    return [{ kind: 'flip', from: [row, col], to: [row, col] }];
}

/**
 * 返回指定颜色（turn）当前所有合法走法。
 *
 * 若 turn === null（首翻阶段），所有未翻开的格子都是 flip 候选。
 *
 * @param {Array<Array<Piece|null>>} board
 * @param {'r'|'b'|null} turn
 */
export function getLegalMoves(board, turn) {
    const moves = [];
    for (let r = 0; r < BOARD_ROWS; r += 1) {
        for (let c = 0; c < BOARD_COLS; c += 1) {
            const p = board[r][c];
            if (!p) continue;
            // 翻棋：任何未翻开的棋子都可被翻（翻者在首翻时无颜色限制；之后所有玩家都能翻）
            if (!p.revealed) {
                moves.push(...generateFlipMoves(board, r, c));
                continue;
            }
            if (turn === null) continue; // 首翻阶段只能翻棋
            if (p.color !== turn) continue;
            moves.push(...generatePieceMoves(board, r, c));
        }
    }
    return moves;
}

/**
 * 施加走法，返回新棋盘 + 新 state。
 */
export function applyMove(board, state, move) {
    const next = cloneBoard(board);
    if (move.kind === 'flip') {
        const [r, c] = move.from;
        next[r][c] = { ...next[r][c], revealed: true };
        // 若首翻：确定双方颜色
        let turn = state.turn;
        if (turn === null) {
            const flipped = next[r][c];
            // 翻者是 state.firstTurnPlayer（默认 'p1'），暂用便捷约定：首翻者获得翻出的颜色
            // 由上层 JunqiApp 读 state.firstPlayer 分配。
            // 此处只把 turn 切给对手：翻出颜色 → 下手轮到另一色
            turn = oppositeColor(flipped.color);
        } else {
            turn = oppositeColor(turn);
        }
        return { board: next, state: { ...state, turn } };
    }

    // move / capture：共同处理
    const [fr, fc] = move.from;
    const [tr, tc] = move.to;
    const piece = next[fr][fc];
    let captured = null;
    if (move.kind === 'capture') {
        captured = next[tr][tc];
    }
    next[fr][fc] = null;
    next[tr][tc] = piece;

    const turn = oppositeColor(state.turn);
    return { board: next, state: { ...state, turn, lastCaptured: captured } };
}

/**
 * 统计棋盘上某色存活子数（含未翻开）。
 */
export function countAlive(board, color) {
    let n = 0;
    for (let r = 0; r < BOARD_ROWS; r += 1) {
        for (let c = 0; c < BOARD_COLS; c += 1) {
            const p = board[r][c];
            if (p && p.color === color) n += 1;
        }
    }
    return n;
}

/**
 * 判断是否已分胜负。
 * @returns {{ winner:'r'|'b', reason:'annihilation'|'stalemate' }|null}
 */
export function checkWinner(board, state) {
    const redAlive = countAlive(board, 'r');
    const blackAlive = countAlive(board, 'b');
    if (redAlive === 0) return { winner: 'b', reason: 'annihilation' };
    if (blackAlive === 0) return { winner: 'r', reason: 'annihilation' };
    if (state.turn !== null) {
        const moves = getLegalMoves(board, state.turn);
        if (moves.length === 0) {
            return { winner: oppositeColor(state.turn), reason: 'stalemate' };
        }
    }
    return null;
}
