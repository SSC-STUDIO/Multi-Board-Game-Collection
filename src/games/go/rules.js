/**
 * 围棋规则引擎（纯逻辑，无 UI 依赖）。
 *
 * 核心概念：
 * - group：同色连通块（4-邻接，即上下左右）。
 * - liberty：group 相邻的空点数（去重后）。
 * - capture：当对手 group 气归零时移除该 group 的全部棋子。
 * - suicide：落子后若己方 group 气为零，而且并不同时吃掉对方棋子，则禁手。
 * - ko：简化劫规（"位置重复禁止 / 打劫即时禁着点"）——
 *   每次落子若恰好提子 1 枚且落子 group 本身也只剩 1 枚 1 气，则把被提位置记为 koPoint，
 *   下一手禁止落在该点。更严格的"同形再现"由上层自行处理。
 *
 * 约定：棋盘二维数组 board[row][col] === 'black'|'white'|null。颜色字符串和 Gomoku 保持一致。
 *
 * @module games/go/rules
 */

const NEIGHBOR_DELTAS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

/**
 * 返回对手颜色。
 * @param {'black'|'white'} color
 * @returns {'black'|'white'}
 */
export function getOpponent(color) {
    return color === 'black' ? 'white' : 'black';
}

/**
 * 坐标是否在棋盘范围内。
 * @param {number} size
 * @param {number} row
 * @param {number} col
 * @returns {boolean}
 */
export function isInside(size, row, col) {
    return row >= 0 && row < size && col >= 0 && col < size;
}

/**
 * 返回 (row,col) 的四邻坐标（已做边界过滤）。
 * @param {number} size
 * @param {number} row
 * @param {number} col
 * @returns {Array<[number, number]>}
 */
export function getNeighbors(size, row, col) {
    const result = [];
    for (const [dr, dc] of NEIGHBOR_DELTAS) {
        const nr = row + dr;
        const nc = col + dc;
        if (isInside(size, nr, nc)) {
            result.push([nr, nc]);
        }
    }
    return result;
}

/**
 * 从 (row,col) 出发 flood-fill，返回同色连通 group 的坐标集合。
 * 若起点为空，则返回该空区域 flood-fill 的所有相连空点。
 * @param {Array<Array<string|null>>} board
 * @param {number} row
 * @param {number} col
 * @returns {{
 *   color: 'black'|'white'|null,
 *   stones: Array<[number, number]>,
 *   liberties: Array<[number, number]>,
 *   libertyCount: number
 * }}
 */
export function getGroup(board, row, col) {
    const size = board.length;
    if (!isInside(size, row, col)) {
        return { color: null, stones: [], liberties: [], libertyCount: 0 };
    }
    const color = board[row][col];
    const visited = new Set();
    const stones = [];
    const libertySet = new Set();
    const stack = [[row, col]];
    const keyOf = (r, c) => `${r},${c}`;

    while (stack.length) {
        const [r, c] = stack.pop();
        const key = keyOf(r, c);
        if (visited.has(key)) continue;
        visited.add(key);

        const cell = board[r][c];
        // 如果从空点起步则只收集空点；否则只收集同色棋子。
        if (cell !== color) continue;
        stones.push([r, c]);

        for (const [nr, nc] of getNeighbors(size, r, c)) {
            const neighbor = board[nr][nc];
            if (neighbor === null) {
                libertySet.add(keyOf(nr, nc));
                continue;
            }
            if (neighbor === color) {
                stack.push([nr, nc]);
            }
        }
    }

    const liberties = [...libertySet].map((k) => k.split(',').map(Number));
    return { color, stones, liberties, libertyCount: libertySet.size };
}

/**
 * 统计一个 group 的气数（不展开 group 本身，仅用于快速查询）。
 * @param {Array<Array<string|null>>} board
 * @param {number} row
 * @param {number} col
 * @returns {number}
 */
export function countLiberties(board, row, col) {
    return getGroup(board, row, col).libertyCount;
}

/**
 * 尝试落子，返回"落子后"的棋盘与提子信息。不修改输入 board。
 *
 * 计算顺序（权威围棋规则）：
 * 1. 在副本棋盘上放置落子；
 * 2. 遍历四邻，若出现对手 group 且气为 0，则移除该 group；
 * 3. 若落子 group 气仍为 0，则判定为自杀——整个操作视为非法，返回 legal=false。
 *
 * 此函数同时负责"简化劫"标记：若本步只吃掉对方 1 枚棋子，且落子 group 本身只有 1 枚 1 气，
 * 则将被吃位置作为 koPoint；上层在下一步禁止落在该点。
 *
 * @param {Array<Array<string|null>>} board - 原始棋盘（不会被修改）
 * @param {number} row
 * @param {number} col
 * @param {'black'|'white'} color
 * @param {{ koPoint?: {row:number,col:number}|null, allowSuicide?: boolean }} [options]
 * @returns {{
 *   legal: boolean,
 *   reason?: 'occupied'|'ko'|'suicide',
 *   board?: Array<Array<string|null>>,
 *   captured?: Array<[number, number]>,
 *   koPoint?: {row:number,col:number}|null
 * }}
 */
export function placeStone(board, row, col, color, { koPoint = null, allowSuicide = false } = {}) {
    const size = board.length;
    if (!isInside(size, row, col)) {
        return { legal: false, reason: 'occupied' };
    }
    if (board[row][col] !== null) {
        return { legal: false, reason: 'occupied' };
    }
    if (koPoint && koPoint.row === row && koPoint.col === col) {
        return { legal: false, reason: 'ko' };
    }

    const next = board.map((r) => r.slice());
    next[row][col] = color;

    const opponent = getOpponent(color);
    const captured = [];
    const seenGroup = new Set();

    for (const [nr, nc] of getNeighbors(size, row, col)) {
        if (next[nr][nc] !== opponent) continue;
        const key = `${nr},${nc}`;
        if (seenGroup.has(key)) continue;
        const group = getGroup(next, nr, nc);
        // 标记整个 group 已处理过，避免重复扫描。
        group.stones.forEach(([sr, sc]) => seenGroup.add(`${sr},${sc}`));
        if (group.libertyCount === 0) {
            group.stones.forEach(([sr, sc]) => {
                next[sr][sc] = null;
                captured.push([sr, sc]);
            });
        }
    }

    const selfGroup = getGroup(next, row, col);
    if (selfGroup.libertyCount === 0 && !allowSuicide) {
        return { legal: false, reason: 'suicide' };
    }

    let nextKo = null;
    // 简化劫：恰好吃掉 1 子 + 落子 group 1 子 1 气 → 被吃点为下一手禁着点
    if (captured.length === 1 && selfGroup.stones.length === 1 && selfGroup.libertyCount === 1) {
        const [kr, kc] = captured[0];
        nextKo = { row: kr, col: kc };
    }

    return { legal: true, board: next, captured, koPoint: nextKo };
}

/**
 * 判断在 (row, col) 落子是否合法（不关心具体结果，仅快速校验）。
 * @param {Array<Array<string|null>>} board
 * @param {number} row
 * @param {number} col
 * @param {'black'|'white'} color
 * @param {{ koPoint?: {row:number,col:number}|null }} [options]
 * @returns {boolean}
 */
export function isLegalMove(board, row, col, color, { koPoint = null } = {}) {
    const result = placeStone(board, row, col, color, { koPoint });
    return result.legal;
}

/**
 * 遍历整盘，返回某色当前的所有合法落子坐标。
 * @param {Array<Array<string|null>>} board
 * @param {'black'|'white'} color
 * @param {{ koPoint?: {row:number,col:number}|null }} [options]
 * @returns {Array<{row:number,col:number}>}
 */
export function getLegalMoves(board, color, { koPoint = null } = {}) {
    const size = board.length;
    const moves = [];
    for (let row = 0; row < size; row += 1) {
        for (let col = 0; col < size; col += 1) {
            if (board[row][col] !== null) continue;
            if (isLegalMove(board, row, col, color, { koPoint })) {
                moves.push({ row, col });
            }
        }
    }
    return moves;
}

/**
 * 棋盘是否完全空（用于开局判断）。
 * @param {Array<Array<string|null>>} board
 * @returns {boolean}
 */
export function isEmptyBoard(board) {
    return board.every((row) => row.every((cell) => cell === null));
}
