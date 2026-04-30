export function isInside(size, row, col) {
    return row >= 0 && row < size && col >= 0 && col < size;
}

export function getOpponent(color) {
    return color === 'black' ? 'white' : 'black';
}

export function isBoardFull(board) {
    return board.every((row) => row.every((cell) => cell !== null));
}

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

