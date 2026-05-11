/**
 * 中国象棋规则引擎（纯逻辑，无 UI 依赖）。
 *
 * 坐标约定（沿用 Gomoku / Chess 的 row,col 习惯，不用 UCI）：
 * - 棋盘 10 行 × 9 列；
 * - row=0 为黑方底线（上方），row=9 为红方底线（下方）；
 * - col=0 为左侧（黑方视角的左）；col=8 为右侧；
 * - 楚河汉界：row=4 与 row=5 之间。红兵在 row=5 之下（含 row=5 以下行）未过河；过河线是红 <4、黑 >5。
 *
 * 棋子编码：两位字符串。首字母颜色 'r'|'b'，次字母角色：
 *   K 将/帅、A 士/仕、E 相/象（E for Elephant）、N 马、R 车、C 炮（Cannon）、P 兵/卒
 *
 * @module games/xiangqi/rules
 */

export function inBounds(row, col) {
    return row >= 0 && row < 10 && col >= 0 && col < 9;
}

export function pieceColor(piece) {
    return piece ? piece[0] : null;
}

export function pieceType(piece) {
    return piece ? piece[1] : null;
}

export function oppositeColor(color) {
    return color === 'r' ? 'b' : 'r';
}

/**
 * 判断格子是否在 (color) 的九宫内。
 * 红九宫：row 7..9, col 3..5；黑九宫：row 0..2, col 3..5。
 */
export function inPalace(color, row, col) {
    if (col < 3 || col > 5) return false;
    return color === 'r' ? (row >= 7 && row <= 9) : (row >= 0 && row <= 2);
}

/**
 * 判断格子是否在 color 方一侧（不过河）。
 * 红方不过河：row >= 5；黑方不过河：row <= 4。
 */
export function isOwnHalf(color, row) {
    return color === 'r' ? row >= 5 : row <= 4;
}

/**
 * 初始局面（红在下黑在上）。
 */
export function createInitialBoard() {
    const empty = () => Array(9).fill(null);
    const board = Array.from({ length: 10 }, empty);
    // 黑方底线 row=0：车马象士将士象马车
    const backRow = ['R', 'N', 'E', 'A', 'K', 'A', 'E', 'N', 'R'];
    backRow.forEach((t, c) => { board[0][c] = `b${t}`; });
    board[2][1] = 'bC';
    board[2][7] = 'bC';
    for (let c = 0; c < 9; c += 2) board[3][c] = 'bP';
    // 红方底线 row=9
    backRow.forEach((t, c) => { board[9][c] = `r${t}`; });
    board[7][1] = 'rC';
    board[7][7] = 'rC';
    for (let c = 0; c < 9; c += 2) board[6][c] = 'rP';
    return board;
}

export function cloneBoard(board) {
    return board.map((row) => row.slice());
}

/**
 * 查找指定颜色的将/帅坐标。
 */
export function findKing(board, color) {
    const target = `${color}K`;
    for (let r = 0; r < 10; r += 1) {
        for (let c = 0; c < 9; c += 1) {
            if (board[r][c] === target) return [r, c];
        }
    }
    return null;
}

/**
 * 将帅对脸（同列之间无任何子）→ 视为"将军"局面，不允许。
 */
export function kingsFacing(board) {
    const wk = findKing(board, 'r');
    const bk = findKing(board, 'b');
    if (!wk || !bk) return false;
    if (wk[1] !== bk[1]) return false;
    const col = wk[1];
    const [top, bot] = wk[0] < bk[0] ? [wk[0], bk[0]] : [bk[0], wk[0]];
    for (let r = top + 1; r < bot; r += 1) {
        if (board[r][col]) return false;
    }
    return true;
}

/**
 * 生成指定坐标棋子的"伪合法"走法（不过滤被将和将帅对脸）。
 */
function generatePseudoMoves(board, row, col) {
    const piece = board[row][col];
    if (!piece) return [];
    const color = piece[0];
    const type = piece[1];
    const opp = oppositeColor(color);
    const moves = [];

    const push = (tr, tc, extra = {}) => {
        const target = board[tr][tc];
        if (target && target[0] === color) return; // 不能吃己方
        moves.push({
            from: [row, col], to: [tr, tc], piece,
            capture: target || null, ...extra
        });
    };

    if (type === 'K') {
        // 帅/将：九宫内走一步，仅上下左右
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const r = row + dr;
            const c = col + dc;
            if (!inBounds(r, c)) continue;
            if (!inPalace(color, r, c)) continue;
            push(r, c);
        }
    } else if (type === 'A') {
        // 士/仕：九宫内走对角一步
        for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
            const r = row + dr;
            const c = col + dc;
            if (!inBounds(r, c)) continue;
            if (!inPalace(color, r, c)) continue;
            push(r, c);
        }
    } else if (type === 'E') {
        // 相/象：田字走法，不能过河，象眼不能被堵
        for (const [dr, dc] of [[-2, -2], [-2, 2], [2, -2], [2, 2]]) {
            const r = row + dr;
            const c = col + dc;
            if (!inBounds(r, c)) continue;
            if (!isOwnHalf(color, r)) continue;
            // 象眼：方向中间一格
            const er = row + dr / 2;
            const ec = col + dc / 2;
            if (board[er][ec]) continue;
            push(r, c);
        }
    } else if (type === 'N') {
        // 马：日字走法，蹩马腿
        const jumps = [
            { dr: -2, dc: -1, leg: [-1, 0] },
            { dr: -2, dc: 1, leg: [-1, 0] },
            { dr: 2, dc: -1, leg: [1, 0] },
            { dr: 2, dc: 1, leg: [1, 0] },
            { dr: -1, dc: -2, leg: [0, -1] },
            { dr: 1, dc: -2, leg: [0, -1] },
            { dr: -1, dc: 2, leg: [0, 1] },
            { dr: 1, dc: 2, leg: [0, 1] }
        ];
        for (const { dr, dc, leg } of jumps) {
            const r = row + dr;
            const c = col + dc;
            if (!inBounds(r, c)) continue;
            const lr = row + leg[0];
            const lc = col + leg[1];
            if (board[lr][lc]) continue; // 蹩马腿
            push(r, c);
        }
    } else if (type === 'R') {
        // 车：直线无阻挡
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            let r = row + dr;
            let c = col + dc;
            while (inBounds(r, c)) {
                const target = board[r][c];
                if (!target) {
                    push(r, c);
                } else {
                    if (target[0] === opp) push(r, c);
                    break;
                }
                r += dr;
                c += dc;
            }
        }
    } else if (type === 'C') {
        // 炮：移动和车一样；吃子必须翻越一个屏障
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            let r = row + dr;
            let c = col + dc;
            let jumped = false;
            while (inBounds(r, c)) {
                const target = board[r][c];
                if (!jumped) {
                    if (!target) push(r, c);
                    else { jumped = true; }
                } else {
                    // 已翻越屏障：遇到任何子 → 若为对方可吃，必定停止
                    if (target) {
                        if (target[0] === opp) push(r, c);
                        break;
                    }
                }
                r += dr;
                c += dc;
            }
        }
    } else if (type === 'P') {
        // 兵/卒：过河前只能前进；过河后还能左右
        const forward = color === 'r' ? -1 : 1;
        const fr = row + forward;
        if (inBounds(fr, col)) push(fr, col);
        const crossed = color === 'r' ? row < 5 : row > 4;
        if (crossed) {
            if (inBounds(row, col - 1)) push(row, col - 1);
            if (inBounds(row, col + 1)) push(row, col + 1);
        }
    }
    return moves;
}

/**
 * 施加走法，返回新棋盘 + 新 state。
 */
export function applyMove(board, state, move) {
    const next = cloneBoard(board);
    const { from: [fr, fc], to: [tr, tc] } = move;
    const piece = next[fr][fc];
    next[fr][fc] = null;
    next[tr][tc] = piece;

    // 半回合计数：吃子归零，否则 +1（仅用于统计，非和棋规则）
    let halfmoveClock = (state.halfmoveClock || 0) + 1;
    if (move.capture) halfmoveClock = 0;

    const turn = oppositeColor(piece[0]);
    const fullmoveNumber = (state.fullmoveNumber || 1) + (piece[0] === 'b' ? 1 : 0);
    return {
        board: next,
        state: { ...state, turn, halfmoveClock, fullmoveNumber }
    };
}

/**
 * 判断指定颜色当前是否被将（含将帅对脸的情况）。
 */
export function isInCheck(board, color) {
    const king = findKing(board, color);
    if (!king) return false;
    // 将帅对脸视为"被将"
    if (kingsFacing(board)) return true;
    const opp = oppositeColor(color);
    for (let r = 0; r < 10; r += 1) {
        for (let c = 0; c < 9; c += 1) {
            const p = board[r][c];
            if (!p || p[0] !== opp) continue;
            const pseudo = generatePseudoMoves(board, r, c);
            if (pseudo.some((mv) => mv.to[0] === king[0] && mv.to[1] === king[1])) {
                return true;
            }
        }
    }
    return false;
}

/**
 * 过滤掉"走完使己方被将 / 将帅对脸"的走法。
 */
function filterLegal(board, state, moves, color) {
    const out = [];
    for (const mv of moves) {
        const { board: after } = applyMove(board, state, mv);
        if (isInCheck(after, color)) continue;
        out.push(mv);
    }
    return out;
}

/**
 * 指定颜色全部合法走法。
 */
export function getLegalMoves(board, state, color = state.turn) {
    const moves = [];
    for (let r = 0; r < 10; r += 1) {
        for (let c = 0; c < 9; c += 1) {
            const p = board[r][c];
            if (!p || p[0] !== color) continue;
            moves.push(...generatePseudoMoves(board, r, c));
        }
    }
    return filterLegal(board, state, moves, color);
}

export function getLegalMovesFrom(board, state, row, col) {
    const piece = board[row][col];
    if (!piece || piece[0] !== state.turn) return [];
    const pseudo = generatePseudoMoves(board, row, col);
    return filterLegal(board, state, pseudo, piece[0]);
}

/**
 * 被将且无合法走法 → 将死。
 */
export function isCheckmate(board, state) {
    if (!isInCheck(board, state.turn)) return false;
    return getLegalMoves(board, state).length === 0;
}

/**
 * 未被将但无合法走法 → 困毙（中国象棋视为输棋；MVP 里按"困毙方输"处理）。
 */
export function isStalemate(board, state) {
    if (isInCheck(board, state.turn)) return false;
    return getLegalMoves(board, state).length === 0;
}
