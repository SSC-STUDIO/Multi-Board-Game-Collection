import { DIRECTIONS, FOUR_PATTERNS, THREE_PATTERNS } from '../config/gameConfig.js';
import { isInside } from '../utils/board.js';
import { i18n } from '../utils/i18n.js';

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

export function matchesAny(line, patterns) {
    return patterns.some((pattern) => line.includes(pattern));
}

export function checkWin(board, size, row, col, color) {
    return DIRECTIONS.some(([dRow, dCol]) => {
        const line = getLineInfo(board, size, row, col, dRow, dCol, color);
        return line.count >= 5;
    });
}

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

export function wouldWin(board, size, row, col, color) {
    board[row][col] = color;
    const isWin = checkWin(board, size, row, col, color);
    board[row][col] = null;
    return isWin;
}

export function hasOverline(board, size, row, col, color) {
    return DIRECTIONS.some(([dRow, dCol]) => {
        const line = getLineInfo(board, size, row, col, dRow, dCol, color);
        return line.count > 5;
    });
}

export function countOpenPatterns(board, size, row, col, color, target) {
    const patterns = target === 4 ? FOUR_PATTERNS : THREE_PATTERNS;
    let count = 0;

    DIRECTIONS.forEach(([dRow, dCol]) => {
        const line = getLineString(board, size, row, col, dRow, dCol, color);
        if (matchesAny(line, patterns)) {
            count += 1;
        }
    });

    return count;
}

export function getForbiddenReason(board, size, rule, row, col, color) {
    if (rule !== 'renju' || color !== 'black' || board[row][col]) {
        return '';
    }

    board[row][col] = color;

    const overline = hasOverline(board, size, row, col, color);
    const openFours = countOpenPatterns(board, size, row, col, color, 4);
    const openThrees = countOpenPatterns(board, size, row, col, color, 3);

    board[row][col] = null;

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
