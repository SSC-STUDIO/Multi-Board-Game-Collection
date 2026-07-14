/** Gomoku 规则引擎：胜负判定、禁手检测 @module game/rules */

import { DIRECTIONS, FOUR_PATTERNS, OPEN_THREE_PATTERNS } from '../../config/gameConfig.js';
import { isInside } from '../../utils/board.js';
import { i18n } from '../../utils/i18n.js';

/**
 * 获取某方向上的连线信息（同色棋子数和开放端数）
 * @param {Array<Array<string|null>>} board - 棋盘状态
 * @param {number} size - 棋盘尺寸
 * @param {number} row - 起始行
 * @param {number} col - 起始列
 * @param {number} dRow - 行方向增量
 * @param {number} dCol - 列方向增量
 * @param {string} color - 棋子颜色
 * @returns {{ count: number, openEnds: number }} 连子数和开放端数
 */
export function getLineInfo(board, size, row, col, dRow, dCol, color) {
    let count = 1;
    let openEnds = 0;

    let nextRow = row + dRow;
    let nextCol = col + dCol;
    while (isInside(size, nextRow, nextCol) && board[nextRow][nextCol] === color) {
        count += 1;
        nextRow += dRow;
        nextCol += dCol;
    }

    if (isInside(size, nextRow, nextCol) && board[nextRow][nextCol] === null) {
        openEnds += 1;
    }

    nextRow = row - dRow;
    nextCol = col - dCol;
    while (isInside(size, nextRow, nextCol) && board[nextRow][nextCol] === color) {
        count += 1;
        nextRow -= dRow;
        nextCol -= dCol;
    }

    if (isInside(size, nextRow, nextCol) && board[nextRow][nextCol] === null) {
        openEnds += 1;
    }

    return { count, openEnds };
}

/**
 * 构建某方向上的棋型字符串（用于模式匹配）
 * 以落子位置为中心，沿指定方向取前后各4格，生成包含棋子（X）、空位（.）和边界/异色（O）的9字符字符串
 * @param {Array<Array<string|null>>} board - 棋盘状态
 * @param {number} size - 棋盘尺寸
 * @param {number} row - 起始行
 * @param {number} col - 起始列
 * @param {number} dRow - 行方向增量
 * @param {number} dCol - 列方向增量
 * @param {string} color - 棋子颜色
 * @returns {string} 棋型字符串（X=同色棋子, .=空位, O=边界或异色棋子）
 */
export function getLineString(board, size, row, col, dRow, dCol, color) {
    let line = '';

    for (let offset = -4; offset <= 4; offset += 1) {
        const nextRow = row + dRow * offset;
        const nextCol = col + dCol * offset;

        if (!isInside(size, nextRow, nextCol)) {
            line += 'O';
            continue;
        }

        const cell = board[nextRow][nextCol];
        if (cell === color) {
            line += 'X';
        } else if (cell === null) {
            line += '.';
        } else {
            line += 'O';
        }
    }

    return line;
}

/**
 * 检查棋型字符串是否匹配任一预设模式
 * @param {string} line - 棋型字符串（由 getLineString 生成）
 * @param {string[]} patterns - 预设模式数组
 * @returns {boolean} 是否匹配任一模式
 */
export function matchesAny(line, patterns) {
    return patterns.some((pattern) => line.includes(pattern));
}

/**
 * 检查落子后是否形成五子连珠（获胜）
 * 沿四个方向（水平、垂直、两对角线）检查连子数
 * @param {Array<Array<string|null>>} board - 棋盘状态
 * @param {number} size - 棋盘尺寸
 * @param {number} row - 落子行
 * @param {number} col - 落子列
 * @param {string} color - 棋子颜色
 * @returns {boolean} 是否获胜
 */
export function checkWin(board, size, row, col, color) {
    return DIRECTIONS.some(([dRow, dCol]) => {
        const line = getLineInfo(board, size, row, col, dRow, dCol, color);
        return line.count >= 5;
    });
}

/**
 * 获取获胜连线上的所有格子坐标
 * @param {Array<Array<string|null>>} board - 棋盘状态
 * @param {number} size - 棋盘尺寸
 * @param {number} row - 落子行
 * @param {number} col - 落子列
 * @param {string} color - 棋子颜色
 * @returns {Array<{row: number, col: number}>} 获胜连线的格子坐标数组
 */
export function getWinningLine(board, size, row, col, color) {
    for (const [dRow, dCol] of DIRECTIONS) {
        const cells = [{ row, col }];

        let nextRow = row + dRow;
        let nextCol = col + dCol;
        while (isInside(size, nextRow, nextCol) && board[nextRow][nextCol] === color) {
            cells.push({ row: nextRow, col: nextCol });
            nextRow += dRow;
            nextCol += dCol;
        }

        nextRow = row - dRow;
        nextCol = col - dCol;
        while (isInside(size, nextRow, nextCol) && board[nextRow][nextCol] === color) {
            cells.unshift({ row: nextRow, col: nextCol });
            nextRow -= dRow;
            nextCol -= dCol;
        }

        if (cells.length >= 5) {
            return cells;
        }
    }

    return [];
}

/**
 * 检查在某位置落子是否会直接获胜
 * @param {Array<Array<string|null>>} board - 棋盘状态
 * @param {number} size - 棋盘尺寸
 * @param {number} row - 落子行
 * @param {number} col - 落子列
 * @param {string} color - 棋子颜色
 * @returns {boolean} 落此子后是否获胜
 */
export function wouldWin(board, size, row, col, color) {
    const copy = board.map((r) => [...r]);
    copy[row][col] = color;
    return checkWin(copy, size, row, col, color);
}

/**
 * 检查是否形成长连（六子或以上连珠，禁手规则中的长连禁手）
 * @param {Array<Array<string|null>>} board - 棋盘状态
 * @param {number} size - 棋盘尺寸
 * @param {number} row - 落子行
 * @param {number} col - 落子列
 * @param {string} color - 棋子颜色
 * @returns {boolean} 是否形成长连
 */
export function hasOverline(board, size, row, col, color) {
    return DIRECTIONS.some(([dRow, dCol]) => {
        const line = getLineInfo(board, size, row, col, dRow, dCol, color);
        return line.count > 5;
    });
}

/**
 * 统计指定类型（四子或三子）的开放棋型数量
 * 用于禁手检测：若形成两个以上活三（三三禁手）或两个以上冲四/活四（四四禁手）
 * @param {Array<Array<string|null>>} board - 棋盘状态
 * @param {number} size - 棋盘尺寸
 * @param {number} row - 落子行
 * @param {number} col - 落子列
 * @param {string} color - 棋子颜色
 * @param {number} target - 目标棋型（4=四子, 3=三子）
 * @returns {number} 匹配方向的数量
 */
export function countOpenPatterns(board, size, row, col, color, target) {
    const patterns = target === 4 ? FOUR_PATTERNS : OPEN_THREE_PATTERNS;
    let count = 0;

    DIRECTIONS.forEach(([dRow, dCol]) => {
        const line = getLineString(board, size, row, col, dRow, dCol, color);
        if (matchesAny(line, patterns)) {
            count += 1;
        }
    });

    return count;
}

/**
 * 获取禁手原因（仅 Renju 规则下黑方有禁手）
 * 检查顺序：长连禁手 → 四四禁手 → 三三禁手
 * @param {Array<Array<string|null>>} board - 棋盘状态
 * @param {number} size - 棋盘尺寸
 * @param {'classic'|'renju'} rule - 游戏规则
 * @param {number} row - 落子行
 * @param {number} col - 落子列
 * @param {string} color - 棋子颜色
 * @returns {string} 禁手原因（空字符串表示无禁手）
 */
export function getForbiddenReason(board, size, rule, row, col, color) {
    if (rule !== 'renju' || color !== 'black' || board[row][col]) {
        return '';
    }

    const copy = board.map((r) => [...r]);
    copy[row][col] = color;

    // Renju rule: if a move creates exactly five-in-a-row (win), it is NOT
    // forbidden even if another direction simultaneously forms an overline.
    // The overline prohibition applies only when no exact five exists.
    const hasExactFive = DIRECTIONS.some(([dRow, dCol]) => {
        const line = getLineInfo(copy, size, row, col, dRow, dCol, color);
        return line.count === 5;
    });
    if (hasExactFive) {
        return '';
    }

    const overline = hasOverline(copy, size, row, col, color);
    const openFours = countOpenPatterns(copy, size, row, col, color, 4);
    const openThrees = countOpenPatterns(copy, size, row, col, color, 3);

    if (overline) {
        return i18n.t('forbiddenOverline');
    }

    if (openFours >= 2) {
        return i18n.t('forbiddenDoubleFour');
    }

    if (openThrees >= 2) {
        return i18n.t('forbiddenDoubleThree');
    }

    return '';
}
