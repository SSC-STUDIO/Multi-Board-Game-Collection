/**
 * 国际象棋规则引擎（纯逻辑，无 UI 依赖）。
 *
 * 坐标约定：
 * - board[row][col]：row=0 为黑方底线（第 8 行），row=7 为白方底线（第 1 行）；
 * - col=0 为 a 线，col=7 为 h 线；
 * - 棋子编码：两位字符串，首字母颜色 'w'|'b'，次字母角色 'P'|'N'|'B'|'R'|'Q'|'K'；
 *   空格为 null。
 *
 * 生成合法走法：先列出"伪合法走法"（各子规则 + 特殊招），再过滤掉使己王被将的走法。
 *
 * 特殊招：
 * - 王车易位（castling）：看 state.castlingRights，校验王/车未动、中途不过将、目的格非将；
 * - 吃过路兵（en passant）：看 state.enPassantTarget（被吃方"过路"落子后的下一手可执行）；
 * - 升变（promotion）：兵到达对方底线时，move 附带 promotion: 'Q'|'R'|'B'|'N'。
 *
 * 和棋判定：
 * - 逼和（stalemate）：无合法走法且未被将；
 * - 50 步规则：halfmoveClock ≥ 100 视为可请求和棋（此处直接判和）；
 * - 子力不足（insufficient material）：K vs K / K+B vs K / K+N vs K / 同色格 K+B vs K+B；
 * - 三次重复：简化版仅比较 piecePlacement+turn+castling+enPassant 字符串。
 *
 * @module games/chess/rules
 */

const KNIGHT_DELTAS = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1]
];
const KING_DELTAS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1]
];
const ROOK_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const BISHOP_DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const QUEEN_DIRS = [...ROOK_DIRS, ...BISHOP_DIRS];

export function inBounds(row, col) {
    return row >= 0 && row < 8 && col >= 0 && col < 8;
}

export function pieceColor(piece) {
    return piece ? piece[0] : null;
}

export function pieceType(piece) {
    return piece ? piece[1] : null;
}

export function oppositeColor(color) {
    return color === 'w' ? 'b' : 'w';
}

/**
 * 初始位置棋盘（FEN: rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR）。
 */
export function createInitialBoard() {
    const empty = () => Array(8).fill(null);
    const board = Array.from({ length: 8 }, empty);
    const backRank = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
    for (let col = 0; col < 8; col += 1) {
        board[0][col] = `b${backRank[col]}`;  // 黑方底线（第 8 行，row=0）
        board[1][col] = 'bP';
        board[6][col] = 'wP';
        board[7][col] = `w${backRank[col]}`;  // 白方底线（第 1 行，row=7）
    }
    return board;
}

/**
 * 克隆棋盘（浅拷贝，每行独立数组）。
 */
export function cloneBoard(board) {
    return board.map((row) => row.slice());
}

/**
 * 查找指定颜色王的位置。
 * @returns {[number,number]|null}
 */
export function findKing(board, color) {
    const target = `${color}K`;
    for (let r = 0; r < 8; r += 1) {
        for (let c = 0; c < 8; c += 1) {
            if (board[r][c] === target) return [r, c];
        }
    }
    return null;
}

/**
 * 判断 (row,col) 是否被对手攻击。
 * 注意：此函数不依赖 castling/enPassant，仅基于当前棋盘即可判断。
 */
export function isSquareAttacked(board, row, col, attackerColor) {
    // 兵的攻击方向取决于颜色：白兵朝 row--（向上），黑兵朝 row++。
    // 注意"被谁攻击"视角——若 attacker 是白兵，它攻击 row-1 侧格子；
    // 所以判断 (row,col) 是否被白兵攻击：应看 (row+1, col±1) 是否白兵。
    const pawnDir = attackerColor === 'w' ? 1 : -1;
    for (const dc of [-1, 1]) {
        const r = row + pawnDir;
        const c = col + dc;
        if (inBounds(r, c) && board[r][c] === `${attackerColor}P`) return true;
    }
    // 马
    for (const [dr, dc] of KNIGHT_DELTAS) {
        const r = row + dr;
        const c = col + dc;
        if (inBounds(r, c) && board[r][c] === `${attackerColor}N`) return true;
    }
    // 车/后（直线）
    for (const [dr, dc] of ROOK_DIRS) {
        let r = row + dr;
        let c = col + dc;
        while (inBounds(r, c)) {
            const p = board[r][c];
            if (p) {
                if (p[0] === attackerColor && (p[1] === 'R' || p[1] === 'Q')) return true;
                break;
            }
            r += dr;
            c += dc;
        }
    }
    // 象/后（对角线）
    for (const [dr, dc] of BISHOP_DIRS) {
        let r = row + dr;
        let c = col + dc;
        while (inBounds(r, c)) {
            const p = board[r][c];
            if (p) {
                if (p[0] === attackerColor && (p[1] === 'B' || p[1] === 'Q')) return true;
                break;
            }
            r += dr;
            c += dc;
        }
    }
    // 王
    for (const [dr, dc] of KING_DELTAS) {
        const r = row + dr;
        const c = col + dc;
        if (inBounds(r, c) && board[r][c] === `${attackerColor}K`) return true;
    }
    return false;
}

/**
 * 判断指定颜色当前是否被将。
 */
export function isInCheck(board, color) {
    const king = findKing(board, color);
    if (!king) return false;
    return isSquareAttacked(board, king[0], king[1], oppositeColor(color));
}

/**
 * 生成指定子的伪合法走法。不过滤"将军后王安全"。
 * 返回走法对象：{ from:[r,c], to:[r,c], piece, capture?, promotion?, enPassant?, castle?: 'K'|'Q' }
 */
function generatePseudoMoves(board, state, row, col) {
    const piece = board[row][col];
    if (!piece) return [];
    const color = piece[0];
    const type = piece[1];
    const moves = [];
    const opp = oppositeColor(color);

    const push = (mv) => moves.push(mv);

    if (type === 'P') {
        const dir = color === 'w' ? -1 : 1;
        const startRow = color === 'w' ? 6 : 1;
        const promoteRow = color === 'w' ? 0 : 7;
        const r1 = row + dir;
        // 前进一格
        if (inBounds(r1, col) && !board[r1][col]) {
            if (r1 === promoteRow) {
                ['Q', 'R', 'B', 'N'].forEach((promo) => push({
                    from: [row, col], to: [r1, col], piece, promotion: promo
                }));
            } else {
                push({ from: [row, col], to: [r1, col], piece });
                // 首次双步
                if (row === startRow) {
                    const r2 = row + dir * 2;
                    if (inBounds(r2, col) && !board[r2][col]) {
                        push({ from: [row, col], to: [r2, col], piece, doubleStep: true });
                    }
                }
            }
        }
        // 斜吃
        for (const dc of [-1, 1]) {
            const tc = col + dc;
            if (!inBounds(r1, tc)) continue;
            const target = board[r1][tc];
            if (target && target[0] === opp) {
                if (r1 === promoteRow) {
                    ['Q', 'R', 'B', 'N'].forEach((promo) => push({
                        from: [row, col], to: [r1, tc], piece, capture: target, promotion: promo
                    }));
                } else {
                    push({ from: [row, col], to: [r1, tc], piece, capture: target });
                }
            }
        }
        // 吃过路兵
        if (state.enPassantTarget) {
            const [er, ec] = state.enPassantTarget;
            if (er === r1 && Math.abs(ec - col) === 1) {
                push({
                    from: [row, col],
                    to: [er, ec],
                    piece,
                    capture: `${opp}P`,
                    enPassant: true
                });
            }
        }
    } else if (type === 'N') {
        for (const [dr, dc] of KNIGHT_DELTAS) {
            const r = row + dr;
            const c = col + dc;
            if (!inBounds(r, c)) continue;
            const target = board[r][c];
            if (!target) push({ from: [row, col], to: [r, c], piece });
            else if (target[0] === opp) push({ from: [row, col], to: [r, c], piece, capture: target });
        }
    } else if (type === 'B' || type === 'R' || type === 'Q') {
        const dirs = type === 'B' ? BISHOP_DIRS : type === 'R' ? ROOK_DIRS : QUEEN_DIRS;
        for (const [dr, dc] of dirs) {
            let r = row + dr;
            let c = col + dc;
            while (inBounds(r, c)) {
                const target = board[r][c];
                if (!target) {
                    push({ from: [row, col], to: [r, c], piece });
                } else {
                    if (target[0] === opp) push({ from: [row, col], to: [r, c], piece, capture: target });
                    break;
                }
                r += dr;
                c += dc;
            }
        }
    } else if (type === 'K') {
        for (const [dr, dc] of KING_DELTAS) {
            const r = row + dr;
            const c = col + dc;
            if (!inBounds(r, c)) continue;
            const target = board[r][c];
            if (!target) push({ from: [row, col], to: [r, c], piece });
            else if (target[0] === opp) push({ from: [row, col], to: [r, c], piece, capture: target });
        }
        // 王车易位（此处只生成结构合法性；是否过将/目的格被攻击交由 filterLegal）
        const rights = state.castlingRights || {};
        const homeRow = color === 'w' ? 7 : 0;
        if (row === homeRow && col === 4) {
            // 短易位 (O-O)
            if (rights[`${color}K`] && !board[homeRow][5] && !board[homeRow][6]
                && board[homeRow][7] === `${color}R`) {
                push({
                    from: [row, col], to: [homeRow, 6], piece, castle: 'K',
                    rookFrom: [homeRow, 7], rookTo: [homeRow, 5]
                });
            }
            // 长易位 (O-O-O)
            if (rights[`${color}Q`] && !board[homeRow][3] && !board[homeRow][2] && !board[homeRow][1]
                && board[homeRow][0] === `${color}R`) {
                push({
                    from: [row, col], to: [homeRow, 2], piece, castle: 'Q',
                    rookFrom: [homeRow, 0], rookTo: [homeRow, 3]
                });
            }
        }
    }

    return moves;
}

/**
 * 把走法施加到棋盘（返回新棋盘 + 新 state），不校验合法性。
 * @returns {{ board: Array, state: Object }}
 */
export function applyMove(board, state, move) {
    const next = cloneBoard(board);
    const { from: [fr, fc], to: [tr, tc] } = move;
    const piece = next[fr][fc];
    const color = piece[0];

    next[fr][fc] = null;

    // 吃过路兵：被吃的兵在 to 的上/下一格（视执行方向而定）
    if (move.enPassant) {
        const capRow = color === 'w' ? tr + 1 : tr - 1;
        next[capRow][tc] = null;
    }

    // 升变
    if (move.promotion) {
        next[tr][tc] = `${color}${move.promotion}`;
    } else {
        next[tr][tc] = piece;
    }

    // 王车易位：同时挪车
    if (move.castle) {
        const [rfr, rfc] = move.rookFrom;
        const [rtr, rtc] = move.rookTo;
        next[rtr][rtc] = next[rfr][rfc];
        next[rfr][rfc] = null;
    }

    // 更新 castling rights：王移动 → 该色双方失去；车移动/被吃 → 相应边失去
    const castlingRights = { ...state.castlingRights };
    if (piece[1] === 'K') {
        castlingRights[`${color}K`] = false;
        castlingRights[`${color}Q`] = false;
    }
    if (piece[1] === 'R') {
        const homeRow = color === 'w' ? 7 : 0;
        if (fr === homeRow && fc === 0) castlingRights[`${color}Q`] = false;
        if (fr === homeRow && fc === 7) castlingRights[`${color}K`] = false;
    }
    // 若车被吃（对方走进来），角落车的权利也消失
    const capturedPiece = move.capture || null;
    if (capturedPiece && capturedPiece[1] === 'R') {
        const capColor = capturedPiece[0];
        const homeRow = capColor === 'w' ? 7 : 0;
        if (tr === homeRow && tc === 0) castlingRights[`${capColor}Q`] = false;
        if (tr === homeRow && tc === 7) castlingRights[`${capColor}K`] = false;
    }

    // enPassantTarget：只在兵双步时设为"过路格"；否则清空
    let enPassantTarget = null;
    if (move.doubleStep) {
        enPassantTarget = [(fr + tr) / 2, fc];
    }

    // 半回合计数：吃子 or 兵走动 → 归零；否则 +1
    let halfmoveClock = (state.halfmoveClock || 0) + 1;
    if (capturedPiece || piece[1] === 'P') halfmoveClock = 0;

    // 全回合：黑走后 +1
    const turn = oppositeColor(color);
    const fullmoveNumber = (state.fullmoveNumber || 1) + (color === 'b' ? 1 : 0);

    return {
        board: next,
        state: {
            ...state,
            turn,
            castlingRights,
            enPassantTarget,
            halfmoveClock,
            fullmoveNumber
        }
    };
}

/**
 * 对伪合法走法做"使己王安全"过滤，同时对王车易位加：中途三格不被攻击。
 */
function filterLegal(board, state, moves, color) {
    const out = [];
    for (const mv of moves) {
        // 王车易位特殊：王起点/中途格/目标格不能被攻击，且起点当前不被将
        if (mv.castle) {
            if (isInCheck(board, color)) continue;
            const [fr, fc] = mv.from;
            const path = mv.castle === 'K' ? [fc, fc + 1, fc + 2] : [fc, fc - 1, fc - 2];
            const opp = oppositeColor(color);
            let safe = true;
            for (const c of path) {
                if (isSquareAttacked(board, fr, c, opp)) { safe = false; break; }
            }
            if (!safe) continue;
            out.push(mv);
            continue;
        }
        const { board: after } = applyMove(board, state, mv);
        if (!isInCheck(after, color)) out.push(mv);
    }
    return out;
}

/**
 * 返回指定颜色全部合法走法。
 * @param {Array<Array<string|null>>} board
 * @param {Object} state
 * @param {'w'|'b'} [color]
 */
export function getLegalMoves(board, state, color = state.turn) {
    const moves = [];
    for (let r = 0; r < 8; r += 1) {
        for (let c = 0; c < 8; c += 1) {
            const p = board[r][c];
            if (!p || p[0] !== color) continue;
            moves.push(...generatePseudoMoves(board, state, r, c));
        }
    }
    return filterLegal(board, state, moves, color);
}

/**
 * 指定起点 (row,col) 的合法走法（用于 UI 高亮候选目的格）。
 */
export function getLegalMovesFrom(board, state, row, col) {
    const piece = board[row][col];
    if (!piece || piece[0] !== state.turn) return [];
    const pseudo = generatePseudoMoves(board, state, row, col);
    return filterLegal(board, state, pseudo, piece[0]);
}

/**
 * 是否将死（被将且无合法走法）。
 */
export function isCheckmate(board, state) {
    const color = state.turn;
    if (!isInCheck(board, color)) return false;
    return getLegalMoves(board, state, color).length === 0;
}

/**
 * 是否逼和（未被将但无合法走法）。
 */
export function isStalemate(board, state) {
    const color = state.turn;
    if (isInCheck(board, color)) return false;
    return getLegalMoves(board, state, color).length === 0;
}

/**
 * 子力不足判和（K vs K / K+B vs K / K+N vs K / K+B vs K+B 同色格）。
 */
export function isInsufficientMaterial(board) {
    const pieces = { w: [], b: [] };
    for (let r = 0; r < 8; r += 1) {
        for (let c = 0; c < 8; c += 1) {
            const p = board[r][c];
            if (!p) continue;
            pieces[p[0]].push({ type: p[1], row: r, col: c });
        }
    }
    const nonKing = (arr) => arr.filter((p) => p.type !== 'K');
    const wRest = nonKing(pieces.w);
    const bRest = nonKing(pieces.b);

    // K vs K
    if (wRest.length === 0 && bRest.length === 0) return true;
    // K+N vs K / K+B vs K
    if (wRest.length === 1 && bRest.length === 0) {
        return wRest[0].type === 'N' || wRest[0].type === 'B';
    }
    if (bRest.length === 1 && wRest.length === 0) {
        return bRest[0].type === 'N' || bRest[0].type === 'B';
    }
    // K+B vs K+B（同色格）
    if (wRest.length === 1 && bRest.length === 1 && wRest[0].type === 'B' && bRest[0].type === 'B') {
        const sqColor = (r, c) => (r + c) % 2;
        return sqColor(wRest[0].row, wRest[0].col) === sqColor(bRest[0].row, bRest[0].col);
    }
    return false;
}

/**
 * 50 步规则判和（halfmoveClock ≥ 100）。
 */
export function isFiftyMoveDraw(state) {
    return (state.halfmoveClock || 0) >= 100;
}
