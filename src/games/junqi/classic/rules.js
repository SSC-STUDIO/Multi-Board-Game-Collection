export const CLASSIC_ROWS = 13;
export const CLASSIC_COLS = 5;

export const COLORS = Object.freeze(['r', 'b']);

export const RANK_LEVEL = Object.freeze({
    F: 0,
    M: 0,
    E: 1,
    P: 2,
    C: 3,
    B: 4,
    T: 5,
    R: 6,
    D: 7,
    G: 8,
    S: 9
});

export const ROSTER = Object.freeze({
    S: 1, G: 1, D: 2, R: 2, T: 2, B: 2, C: 3, P: 3, E: 3, X: 2, M: 3, F: 1
});

export const TOP_CAMPS = Object.freeze(['2,1', '2,3', '3,2', '4,1', '4,3']);
export const BOTTOM_CAMPS = Object.freeze(['8,1', '8,3', '9,2', '10,1', '10,3']);
export const CAMPS = Object.freeze([...TOP_CAMPS, ...BOTTOM_CAMPS]);
export const HEADQUARTERS = Object.freeze(['0,1', '0,3', '12,1', '12,3']);
export const MOUNTAINS = Object.freeze(['6,1', '6,3']);
export const FRONTLINES = Object.freeze(['6,0', '6,2', '6,4']);
export const RAIL_ROWS = Object.freeze([1, 5, 7, 11]);
export const RAIL_COLS = Object.freeze([0, 4]);
export const CENTER_RAIL_COLS = Object.freeze([0, 2, 4]);

const DIRS = Object.freeze([[-1, 0], [1, 0], [0, -1], [0, 1]]);

function key(row, col) {
    return `${row},${col}`;
}

export function inBounds(row, col) {
    return row >= 0 && row < CLASSIC_ROWS && col >= 0 && col < CLASSIC_COLS;
}

export function isMountain(row, col) {
    return MOUNTAINS.includes(key(row, col));
}

export function isFrontline(row, col) {
    return FRONTLINES.includes(key(row, col));
}

export function isCamp(row, col) {
    return CAMPS.includes(key(row, col));
}

export function isHeadquarters(row, col) {
    return HEADQUARTERS.includes(key(row, col));
}

export function isPlayable(row, col) {
    return inBounds(row, col) && !isMountain(row, col) && !isFrontline(row, col);
}

export function isRail(row, col) {
    if (!inBounds(row, col) || isMountain(row, col)) return false;
    if (RAIL_ROWS.includes(row)) return true;
    if (RAIL_COLS.includes(col) && ((row >= 0 && row <= 5) || (row >= 7 && row <= 12))) return true;
    if (CENTER_RAIL_COLS.includes(col) && row >= 5 && row <= 7) return true;
    return false;
}

export function homeRows(color) {
    return color === 'r'
        ? { front: 7, back: 12, flagRows: [11, 12], hq: [[12, 1], [12, 3]] }
        : { front: 5, back: 0, flagRows: [0, 1], hq: [[0, 1], [0, 3]] };
}

export function oppositeColor(color) {
    return color === 'r' ? 'b' : 'r';
}

export function cloneBoard(board) {
    return board.map((row) => row.map((piece) => piece ? { ...piece } : null));
}

export function createEmptyClassicBoard() {
    return Array.from({ length: CLASSIC_ROWS }, () => Array(CLASSIC_COLS).fill(null));
}

export function createClassicPiece(color, rank, revealed = false) {
    return { color, rank, revealed };
}

export function createRoadSegments() {
    const segments = [];
    for (let row = 0; row < CLASSIC_ROWS; row += 1) {
        for (let col = 0; col < CLASSIC_COLS; col += 1) {
            if (!isPlayable(row, col) && !isFrontline(row, col)) continue;
            for (const [dr, dc] of [[1, 0], [0, 1]]) {
                const nr = row + dr;
                const nc = col + dc;
                if (!inBounds(nr, nc) || isMountain(nr, nc)) continue;
                if (!isPlayable(nr, nc) && !isFrontline(nr, nc)) continue;
                segments.push({
                    from: [row, col],
                    to: [nr, nc],
                    type: isRail(row, col) && isRail(nr, nc) ? 'rail' : 'road'
                });
            }
        }
    }
    return segments;
}

export const BOARD_SEGMENTS = Object.freeze(createRoadSegments());

function isConnectedBySegment(row, col, nr, nc, type = null) {
    return BOARD_SEGMENTS.some((segment) => {
        if (type && segment.type !== type) return false;
        const [ar, ac] = segment.from;
        const [br, bc] = segment.to;
        return (ar === row && ac === col && br === nr && bc === nc)
            || (ar === nr && ac === nc && br === row && bc === col);
    });
}

function canLand(board, color, row, col, forAttack = false) {
    if (!isPlayable(row, col)) return false;
    const target = board[row][col];
    if (!target) return true;
    if (target.color === color) return false;
    if (forAttack && isCamp(row, col)) return false;
    return forAttack;
}

export function isMovablePiece(piece) {
    return !!piece && piece.rank !== 'M' && piece.rank !== 'F';
}

export function validateDeployment(board, color) {
    const counts = {};
    let total = 0;
    for (let row = 0; row < CLASSIC_ROWS; row += 1) {
        for (let col = 0; col < CLASSIC_COLS; col += 1) {
            const piece = board[row][col];
            if (!piece || piece.color !== color) continue;
            total += 1;
            counts[piece.rank] = (counts[piece.rank] || 0) + 1;
            if (!isPlayable(row, col)) return { valid: false, reason: 'unplayable' };
            const home = homeRows(color);
            if (color === 'r' && row < 7) return { valid: false, reason: 'outside-home' };
            if (color === 'b' && row > 5) return { valid: false, reason: 'outside-home' };
            if (piece.rank === 'F' && !home.hq.some(([r, c]) => r === row && c === col)) {
                return { valid: false, reason: 'flag-headquarters' };
            }
            if (piece.rank === 'X' && row === home.front) return { valid: false, reason: 'bomb-front' };
            if (piece.rank === 'M' && !home.flagRows.includes(row)) return { valid: false, reason: 'mine-back' };
        }
    }
    if (total !== 25) return { valid: false, reason: 'count' };
    for (const [rank, count] of Object.entries(ROSTER)) {
        if ((counts[rank] || 0) !== count) return { valid: false, reason: `count-${rank}` };
    }
    return { valid: true, reason: null };
}

export function mirrorRank(rank) {
    return rank;
}

const RED_TEMPLATES = Object.freeze([
    [
        ['S', 'G', 'D', 'C', 'D'],
        ['R', 'T', 'X', 'T', 'R'],
        ['B', null, 'C', null, 'B'],
        ['P', 'E', null, 'E', 'P'],
        ['C', null, 'P', null, 'E'],
        ['M', 'F', 'M', 'M', 'X']
    ],
    [
        ['G', 'D', 'S', 'D', 'C'],
        ['R', 'X', 'T', 'X', 'R'],
        ['B', null, 'C', null, 'T'],
        ['P', 'E', null, 'B', 'P'],
        ['C', null, 'E', null, 'P'],
        ['M', 'F', 'M', 'M', 'E']
    ],
    [
        ['D', 'S', 'G', 'D', 'R'],
        ['T', 'B', 'X', 'T', 'C'],
        ['C', null, 'R', null, 'B'],
        ['P', 'E', null, 'C', 'P'],
        ['E', null, 'P', null, 'E'],
        ['M', 'M', 'X', 'F', 'M']
    ]
]);

export function applyTemplate(board, color, templateIndex = 0) {
    const template = RED_TEMPLATES[((templateIndex % RED_TEMPLATES.length) + RED_TEMPLATES.length) % RED_TEMPLATES.length];
    const target = cloneBoard(board);
    const rows = color === 'r' ? [7, 8, 9, 10, 11, 12] : [5, 4, 3, 2, 1, 0];
    for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        for (let col = 0; col < CLASSIC_COLS; col += 1) {
            target[row][col] = null;
            const rank = template[i][col];
            if (rank) target[row][col] = createClassicPiece(color, mirrorRank(rank), color === 'r');
        }
    }
    return target;
}

export function createInitialBoard(templateIndex = 0, aiTemplateIndex = 1) {
    let board = createEmptyClassicBoard();
    board = applyTemplate(board, 'r', templateIndex);
    board = applyTemplate(board, 'b', aiTemplateIndex);
    return board;
}

function generateRoadMoves(board, row, col, piece) {
    const moves = [];
    for (const [dr, dc] of DIRS) {
        const nr = row + dr;
        const nc = col + dc;
        if (!isConnectedBySegment(row, col, nr, nc)) continue;
        if (!canLand(board, piece.color, nr, nc, true)) continue;
        const target = board[nr][nc];
        moves.push({
            kind: target ? 'capture' : 'move',
            from: [row, col],
            to: [nr, nc],
            piece,
            capture: target || null
        });
    }
    return moves;
}

function generateRailLineMoves(board, row, col, piece) {
    const moves = [];
    for (const [dr, dc] of DIRS) {
        let nr = row + dr;
        let nc = col + dc;
        while (isConnectedBySegment(nr - dr, nc - dc, nr, nc, 'rail')) {
            if (!canLand(board, piece.color, nr, nc, true)) break;
            const target = board[nr][nc];
            moves.push({
                kind: target ? 'capture' : 'move',
                from: [row, col],
                to: [nr, nc],
                piece,
                capture: target || null
            });
            if (target) break;
            nr += dr;
            nc += dc;
        }
    }
    return moves;
}

function generateEngineerRailMoves(board, row, col, piece) {
    const moves = [];
    const seen = new Set([key(row, col)]);
    const queue = [[row, col]];
    while (queue.length) {
        const [r, c] = queue.shift();
        for (const [dr, dc] of DIRS) {
            const nr = r + dr;
            const nc = c + dc;
            if (!isConnectedBySegment(r, c, nr, nc, 'rail')) continue;
            const k = key(nr, nc);
            if (seen.has(k)) continue;
            seen.add(k);
            if (!canLand(board, piece.color, nr, nc, true)) continue;
            const target = board[nr][nc];
            moves.push({
                kind: target ? 'capture' : 'move',
                from: [row, col],
                to: [nr, nc],
                piece,
                capture: target || null
            });
            if (!target) queue.push([nr, nc]);
        }
    }
    return moves;
}

export function generatePieceMoves(board, row, col) {
    const piece = board[row]?.[col];
    if (!isMovablePiece(piece)) return [];
    if (isHeadquarters(row, col)) return [];
    const moves = generateRoadMoves(board, row, col, piece);
    if (isRail(row, col)) {
        const railMoves = piece.rank === 'E'
            ? generateEngineerRailMoves(board, row, col, piece)
            : generateRailLineMoves(board, row, col, piece);
        for (const move of railMoves) {
            if (!moves.some((m) => m.to[0] === move.to[0] && m.to[1] === move.to[1])) {
                moves.push(move);
            }
        }
    }
    return moves;
}

export function getLegalMoves(board, color) {
    const moves = [];
    for (let row = 0; row < CLASSIC_ROWS; row += 1) {
        for (let col = 0; col < CLASSIC_COLS; col += 1) {
            const piece = board[row][col];
            if (!piece || piece.color !== color) continue;
            moves.push(...generatePieceMoves(board, row, col));
        }
    }
    return moves;
}

export function resolveBattle(attacker, defender) {
    if (!attacker || !defender) return { attackerDies: false, defenderDies: false, flagCaptured: false };
    if (defender.rank === 'F') return { attackerDies: false, defenderDies: true, flagCaptured: true };
    if (attacker.rank === 'X' || defender.rank === 'X') return { attackerDies: true, defenderDies: true, flagCaptured: false };
    if (defender.rank === 'M') {
        return attacker.rank === 'E'
            ? { attackerDies: false, defenderDies: true, flagCaptured: false }
            : { attackerDies: true, defenderDies: false, flagCaptured: false };
    }
    const a = RANK_LEVEL[attacker.rank] || 0;
    const d = RANK_LEVEL[defender.rank] || 0;
    if (a > d) return { attackerDies: false, defenderDies: true, flagCaptured: false };
    if (a < d) return { attackerDies: true, defenderDies: false, flagCaptured: false };
    return { attackerDies: true, defenderDies: true, flagCaptured: false };
}

export function findFlag(board, color) {
    for (let row = 0; row < CLASSIC_ROWS; row += 1) {
        for (let col = 0; col < CLASSIC_COLS; col += 1) {
            const piece = board[row][col];
            if (piece?.color === color && piece.rank === 'F') return [row, col];
        }
    }
    return null;
}

export function revealColor(board, color) {
    const next = cloneBoard(board);
    for (let row = 0; row < CLASSIC_ROWS; row += 1) {
        for (let col = 0; col < CLASSIC_COLS; col += 1) {
            if (next[row][col]?.color === color) next[row][col].revealed = true;
        }
    }
    return next;
}

export function applyMove(board, state, move) {
    const next = cloneBoard(board);
    const [fr, fc] = move.from;
    const [tr, tc] = move.to;
    const attacker = next[fr][fc];
    const defender = next[tr][tc];
    let result = null;
    next[fr][fc] = null;

    if (!defender) {
        next[tr][tc] = attacker;
    } else {
        attacker.revealed = true;
        defender.revealed = true;
        result = resolveBattle(attacker, defender);
        if (!result.attackerDies && result.defenderDies) {
            next[tr][tc] = attacker;
        } else if (result.attackerDies && !result.defenderDies) {
            next[tr][tc] = defender;
        } else {
            next[tr][tc] = null;
        }
    }

    let revealedBoard = next;
    let resultState = null;
    if (result?.flagCaptured) {
        resultState = { winner: attacker.color, reason: 'flag' };
    } else if (attacker?.rank === 'S' && result?.attackerDies) {
        revealedBoard = revealColor(next, attacker.color);
    } else if (defender?.rank === 'S' && result?.defenderDies) {
        revealedBoard = revealColor(next, defender.color);
    }

    const turn = oppositeColor(state.turn);
    return {
        board: revealedBoard,
        state: {
            ...state,
            turn,
            lastBattle: result ? { attacker, defender, result } : null,
            result: resultState || state.result || null
        }
    };
}

export function checkWinner(board, state) {
    if (state.result) return state.result;
    for (const color of COLORS) {
        if (!findFlag(board, color)) {
            return { winner: oppositeColor(color), reason: 'flag' };
        }
        if (getLegalMoves(board, color).length === 0) {
            return { winner: oppositeColor(color), reason: 'stalemate' };
        }
    }
    return null;
}
