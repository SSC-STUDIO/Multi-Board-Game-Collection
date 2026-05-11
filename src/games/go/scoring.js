/**
 * 围棋终局计分（数子法，area scoring，中国规则）。
 *
 * 算法：
 * 1. 棋盘按四邻连通做 flood-fill，识别所有空"区域"；
 * 2. 每个空区域的周边棋子若仅有单一颜色，则整块空区域归该方（领地）；
 *    若同时与双方棋子相邻，则视为中立区（dame），不计分；
 * 3. 数子法（area scoring）：
 *    - 黑方得分 = 盘上黑子数 + 黑方领地 + 黑方让目（此处不加，让子本身已占空间）
 *    - 白方得分 = 盘上白子数 + 白方领地 + 贴目 komi
 *    - 胜负 = max(black, white)，差值为 margin
 *
 * 注意：本函数假设棋盘上活棋状态是已定的（即没有死子需要标出）。在 MVP 里简化为"对方已认可棋形全活"。
 * 后续可扩展为用户交互式标死子阶段。
 *
 * @module games/go/scoring
 */

import { getNeighbors, getOpponent } from './rules.js';

/**
 * 识别所有空区域（flood-fill）。返回每个区域的坐标与边界颜色集合。
 * @param {Array<Array<string|null>>} board
 * @returns {Array<{cells: Array<[number,number]>, borderColors: Set<string>}>}
 */
export function findEmptyRegions(board) {
    const size = board.length;
    // 只对"空点"做去重访问；棋子不进入 visited，避免作为边界被多次记录时影响 flood-fill。
    const visited = Array.from({ length: size }, () => Array(size).fill(false));
    const regions = [];

    for (let row = 0; row < size; row += 1) {
        for (let col = 0; col < size; col += 1) {
            if (board[row][col] !== null) continue;
            if (visited[row][col]) continue;

            const cells = [];
            const borderColors = new Set();
            const stack = [[row, col]];
            while (stack.length) {
                const [r, c] = stack.pop();
                if (visited[r][c]) continue;
                if (board[r][c] !== null) {
                    // 遇到边界棋子：记录颜色但不做 visited 标记，也不继续向外扩展。
                    borderColors.add(board[r][c]);
                    continue;
                }
                visited[r][c] = true;
                cells.push([r, c]);
                for (const [nr, nc] of getNeighbors(size, r, c)) {
                    if (board[nr][nc] === null && !visited[nr][nc]) {
                        stack.push([nr, nc]);
                    } else if (board[nr][nc] !== null) {
                        borderColors.add(board[nr][nc]);
                    }
                }
            }

            regions.push({ cells, borderColors });
        }
    }

    return regions;
}

/**
 * 计算数子法下的最终得分。
 * @param {Array<Array<string|null>>} board
 * @param {{ komi?: number }} [options]
 * @returns {{
 *   blackScore: number,
 *   whiteScore: number,
 *   blackTerritory: number,
 *   whiteTerritory: number,
 *   blackStones: number,
 *   whiteStones: number,
 *   dame: number,
 *   komi: number,
 *   winner: 'black'|'white'|null,
 *   margin: number
 * }}
 */
export function scoreBoard(board, { komi = 6.5 } = {}) {
    const size = board.length;
    let blackStones = 0;
    let whiteStones = 0;
    for (let row = 0; row < size; row += 1) {
        for (let col = 0; col < size; col += 1) {
            if (board[row][col] === 'black') blackStones += 1;
            else if (board[row][col] === 'white') whiteStones += 1;
        }
    }

    const regions = findEmptyRegions(board);
    let blackTerritory = 0;
    let whiteTerritory = 0;
    let dame = 0;

    regions.forEach(({ cells, borderColors }) => {
        const area = cells.length;
        if (borderColors.size === 1) {
            const [only] = borderColors;
            if (only === 'black') blackTerritory += area;
            else if (only === 'white') whiteTerritory += area;
            else dame += area;
        } else {
            dame += area;
        }
    });

    const blackScore = blackStones + blackTerritory;
    const whiteScore = whiteStones + whiteTerritory + komi;

    let winner = null;
    let margin = 0;
    if (blackScore > whiteScore) {
        winner = 'black';
        margin = blackScore - whiteScore;
    } else if (whiteScore > blackScore) {
        winner = 'white';
        margin = whiteScore - blackScore;
    }

    return {
        blackScore,
        whiteScore,
        blackTerritory,
        whiteTerritory,
        blackStones,
        whiteStones,
        dame,
        komi,
        winner,
        margin
    };
}

// getOpponent 保留未使用的 re-export，便于测试文件从本模块直接导入工具。
export { getOpponent };
