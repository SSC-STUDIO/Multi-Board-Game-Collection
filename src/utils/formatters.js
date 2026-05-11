/** 格式化工具函数 @module utils/formatters */

import { COLUMN_LABELS } from '../config/gameConfig.js';
import { i18n } from './i18n.js';

/**
 * 获取玩家颜色对应的本地化标签
 * @param {'black'|'white'} color - 棋子颜色
 * @returns {string} 本地化后的玩家标签
 */
export function getPlayerLabel(color) {
    return i18n.t(color);
}

/**
 * 将行列坐标格式化为棋盘记法（如 "H8"）
 * @param {number} row - 行坐标（从 0 开始）
 * @param {number} col - 列坐标（从 0 开始）
 * @returns {string} 格式化后的移动记法字符串
 */
export function formatMove(row, col) {
    const column = COLUMN_LABELS[col] || `C${col + 1}`;
    return `${column}${row + 1}`;
}
