/**
 * 围棋游戏状态。
 * 设计要点：
 * - state 独立于 UI，纯数据；
 * - board 为二维数组，与 Gomoku 共用一致的颜色字符串；
 * - captures 记录双方累计吃子数（胜负与数目阶段两处都会用到）；
 * - koPoint 存当前被禁着点（由 rules.placeStone 回传）；
 * - moveHistory 每手含 color/row/col/captured 数量，便于悔棋和棋谱记录；
 * - consecutivePasses ≥ 2 触发终局数目阶段。
 *
 * @module games/go/state
 */

/**
 * @typedef {Object} GoOptions
 * @property {9|13|19} size
 * @property {number} komi - 贴目（默认 6.5，中国规则 7.5 也可）
 * @property {number} handicap - 让子数（0-9）
 * @property {'area'|'territory'} scoringRule - 数子（中国）或数目（日韩）
 * @property {'easy'|'medium'|'hard'} level
 * @property {'pvp'|'pve'|'practice'} mode
 * @property {'black'|'white'} playerColor
 */

/**
 * @typedef {Object} GoMove
 * @property {number} index - 手数（1 起）
 * @property {'black'|'white'} color
 * @property {number|null} row - pass 时为 null
 * @property {number|null} col - pass 时为 null
 * @property {boolean} pass
 * @property {number} captured - 本手吃子数
 */

/**
 * @typedef {Object} GoState
 * @property {GoOptions} options
 * @property {Array<Array<'black'|'white'|null>>} board
 * @property {'black'|'white'} currentPlayer
 * @property {{ black: number, white: number }} captures - 累计吃子
 * @property {GoMove[]} moveHistory
 * @property {GoMove|null} lastMove
 * @property {{ row: number, col: number }|null} koPoint
 * @property {number} consecutivePasses
 * @property {boolean} gameOver
 * @property {{
 *   type: 'score'|'resign',
 *   winner: 'black'|'white'|null,
 *   blackScore?: number,
 *   whiteScore?: number,
 *   margin?: number
 * }|null} result
 * @property {boolean} aiThinking
 */

export const DEFAULT_GO_OPTIONS = Object.freeze({
    size: 19,
    komi: 6.5,
    handicap: 0,
    scoringRule: 'area',
    level: 'medium',
    mode: 'pvp',
    playerColor: 'black'
});

/**
 * 合并默认值生成完整选项。
 * @param {Partial<GoOptions>} [overrides={}]
 * @returns {GoOptions}
 */
export function createGoOptions(overrides = {}) {
    return { ...DEFAULT_GO_OPTIONS, ...overrides };
}

/**
 * 生成指定尺寸的空棋盘。
 * @param {number} size
 * @returns {Array<Array<null>>}
 */
export function createEmptyGoBoard(size) {
    return Array.from({ length: size }, () => Array(size).fill(null));
}

/**
 * 根据手数获取让子星位（适配 9/13/19 路棋盘常用摆法）。
 * 返回数组中的前 N 个坐标即为让 N 子的标准位置；黑子不足 3 子时只摆 2 子对角。
 * @param {number} size
 * @returns {Array<{row:number,col:number}>}
 */
export function getHandicapPoints(size) {
    if (size === 19) {
        return [
            { row: 15, col: 3 },   // D4
            { row: 3, col: 15 },   // Q16
            { row: 15, col: 15 },  // Q4
            { row: 3, col: 3 },    // D16
            { row: 9, col: 9 },    // K10 天元
            { row: 9, col: 3 },    // D10
            { row: 9, col: 15 },   // Q10
            { row: 15, col: 9 },   // K4
            { row: 3, col: 9 }     // K16
        ];
    }
    if (size === 13) {
        return [
            { row: 9, col: 3 },
            { row: 3, col: 9 },
            { row: 9, col: 9 },
            { row: 3, col: 3 },
            { row: 6, col: 6 },
            { row: 6, col: 3 },
            { row: 6, col: 9 },
            { row: 9, col: 6 },
            { row: 3, col: 6 }
        ];
    }
    // 9x9
    return [
        { row: 6, col: 2 },
        { row: 2, col: 6 },
        { row: 6, col: 6 },
        { row: 2, col: 2 },
        { row: 4, col: 4 },
        { row: 4, col: 2 },
        { row: 4, col: 6 },
        { row: 6, col: 4 },
        { row: 2, col: 4 }
    ];
}

/**
 * 创建完整围棋状态。包含让子摆放（黑子）。
 * @param {Partial<GoOptions>} [options]
 * @returns {GoState}
 */
export function createGoState(options = {}) {
    const merged = createGoOptions(options);
    const board = createEmptyGoBoard(merged.size);
    const moveHistory = [];

    // 让子：在黑方占子后交由白方先行。
    const handicap = Math.max(0, Math.min(9, merged.handicap | 0));
    if (handicap >= 2) {
        const points = getHandicapPoints(merged.size).slice(0, handicap);
        points.forEach(({ row, col }, idx) => {
            board[row][col] = 'black';
            moveHistory.push({
                index: idx + 1,
                color: 'black',
                row,
                col,
                pass: false,
                captured: 0,
                handicap: true
            });
        });
    }

    return {
        options: merged,
        board,
        currentPlayer: handicap >= 2 ? 'white' : 'black',
        captures: { black: 0, white: 0 },
        moveHistory,
        lastMove: moveHistory[moveHistory.length - 1] || null,
        koPoint: null,
        consecutivePasses: 0,
        gameOver: false,
        result: null,
        aiThinking: false
    };
}
