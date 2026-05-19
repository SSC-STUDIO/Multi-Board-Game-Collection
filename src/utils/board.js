/** 棋盘坐标工具函数 @module utils/board */

/**
 * 检查坐标是否在棋盘范围内
 * @param {number} size - 棋盘大小（如 15、19）
 * @param {number} row - 行坐标
 * @param {number} col - 列坐标
 * @returns {boolean} 坐标是否合法
 */
export function isInside(size, row, col) {
    return row >= 0 && row < size && col >= 0 && col < size;
}

/**
 * 获取对手棋子颜色
 * @param {'black'|'white'} color - 当前棋子颜色
 * @returns {'black'|'white'} 对手棋子颜色
 */
export function getOpponent(color) {
    return color === 'black' ? 'white' : 'black';
}

/**
 * 检查棋盘是否已满（平局判定）
 * @param {Array<Array<string|null>>} board - 二维棋盘数组
 * @returns {boolean} 棋盘是否已满
 */
export function isBoardFull(board) {
    return board.every((row) => row.every((cell) => cell !== null));
}

/**
 * 获取星位（天元/小目）坐标集合
 * @param {number} size - 棋盘大小
 * @returns {Set<string>} 星位坐标集合，格式为 "row,col"
 */
export function getStarPoints(size) {
    const points = size === 19 ? [3, 9, 15] : [3, 7, 11];
    const stars = new Set();

    points.forEach((row) => {
        points.forEach((col) => {
            stars.add(`${row},${col}`);
        });
    });

    return stars;
}

/**
 * 根据视口宽度和棋盘大小计算响应式单元格尺寸
 * @param {number} size - 棋盘大小
 * @param {number} viewportWidth - 当前视口宽度（像素）
 * @returns {string} CSS 尺寸值（如 "24px"）
 */
export function getResponsiveCellSize(size, viewportWidth) {
    if (size >= 19) {
        if (viewportWidth <= 380) return '16px';
        if (viewportWidth <= 480) return '18px';
        if (viewportWidth <= 640) return '20px';
        if (viewportWidth <= 900) return '24px';
        return '28px';
    }

    if (viewportWidth <= 380) return '18px';
    if (viewportWidth <= 480) return '20px';
    if (viewportWidth <= 640) return '22px';
    if (viewportWidth <= 900) return '26px';
    return '30px';
}

