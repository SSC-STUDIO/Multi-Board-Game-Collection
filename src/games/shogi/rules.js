/**
 * Shogi (Japanese Chess) rules engine.
 * 9x9 board, pieces with kanji labels, promotion zone, drop mechanics.
 * @module games/shogi/rules
 */

export const BOARD_SIZE = 9;

// Promotion zone: rows 0-2 for Sente (gote side), rows 6-8 for Gote (sente side)
// In our representation: row 0 = top (gote back rank), row 8 = bottom (sente back rank)
// Sente promotes in rows 0-2, Gote promotes in rows 6-8
export const PROMOTION_ZONE_SENTE = [0, 1, 2];
export const PROMOTION_ZONE_GOTE = [6, 7, 8];

// Piece types with their movement patterns
// direction: 1 = forward (toward row 0 for sente), -1 = forward (toward row 8 for gote)
export const PIECES = {
    K: { name: "King", kanji: "王", promoted: null, value: 15000 },
    R: { name: "Rook", kanji: "飛", promoted: "DR", value: 4770 },
    B: { name: "Bishop", kanji: "角", promoted: "DB", value: 4130 },
    G: { name: "Gold", kanji: "金", promoted: null, value: 2460 },
    S: { name: "Silver", kanji: "銀", promoted: "PS", value: 1830 },
    N: { name: "Knight", kanji: "桂", promoted: "PN", value: 1120 },
    L: { name: "Lance", kanji: "香", promoted: "PL", value: 1100 },
    P: { name: "Pawn", kanji: "歩", promoted: "PP", value: 1050 },
    DR: { name: "Dragon King", kanji: "龍", promoted: null, value: 6270 },
    DB: { name: "Dragon Horse", kanji: "馬", promoted: null, value: 5230 },
    PS: { name: "Promoted Silver", kanji: "全", promoted: null, value: 2460 },
    PN: { name: "Promoted Knight", kanji: "圭", promoted: null, value: 2460 },
    PL: { name: "Promoted Lance", kanji: "杏", promoted: null, value: 2460 },
    PP: { name: "Promoted Pawn", kanji: "と", promoted: null, value: 2460 }
};

// Gold general movement (6 directions)
const GOLD_DELTAS = [[-1, 0], [-1, 1], [-1, -1], [0, 1], [0, -1], [1, 0]];

// Silver general movement (5 directions)
const SILVER_DELTAS = [[-1, 0], [-1, 1], [-1, -1], [1, 1], [1, -1]];

// Knight movement (2 forward, 1 side)
const KNIGHT_DELTAS = [[-2, 1], [-2, -1]];

/**
 * Create the initial Shogi board.
 * Row 0 = gote back rank (top), Row 8 = sente back rank (bottom).
 * @returns {Array<Array<{type: string, side: 'sente'|'gote'}|null>>}
 */
export function createInitialBoard() {
    const board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));

    // Gote pieces (top, side = 'gote', moves toward row 8)
    board[0] = [
        { type: "L", side: "gote" }, { type: "N", side: "gote" }, { type: "S", side: "gote" },
        { type: "G", side: "gote" }, { type: "K", side: "gote" }, { type: "G", side: "gote" },
        { type: "S", side: "gote" }, { type: "N", side: "gote" }, { type: "L", side: "gote" }
    ];
    board[1][1] = { type: "R", side: "gote" };
    board[1][7] = { type: "B", side: "gote" };
    for (let col = 0; col < BOARD_SIZE; col++) {
        board[2][col] = { type: "P", side: "gote" };
    }

    // Sente pieces (bottom, side = 'sente', moves toward row 0)
    board[8] = [
        { type: "L", side: "sente" }, { type: "N", side: "sente" }, { type: "S", side: "sente" },
        { type: "G", side: "sente" }, { type: "K", side: "sente" }, { type: "G", side: "sente" },
        { type: "S", side: "sente" }, { type: "N", side: "sente" }, { type: "L", side: "sente" }
    ];
    board[7][7] = { type: "R", side: "sente" };
    board[7][1] = { type: "B", side: "sente" };
    for (let col = 0; col < BOARD_SIZE; col++) {
        board[6][col] = { type: "P", side: "sente" };
    }

    return board;
}

/**
 * Get raw movement deltas for a piece type (before direction filtering).
 */
function getRawDeltas(type) {
    switch (type) {
        case "K": return [[-1, 0], [-1, 1], [-1, -1], [0, 1], [0, -1], [1, 0], [1, 1], [1, -1]];
        case "G": case "DR": case "DB": case "PS": case "PN": case "PL": case "PP":
            return GOLD_DELTAS;
        case "S": return SILVER_DELTAS;
        case "N": return KNIGHT_DELTAS;
        case "P": case "L": return [[-1, 0]];
        default: return [];
    }
}

/**
 * Get sliding directions for rook/bishop/lance.
 */
function getSlidingDirections(type) {
    switch (type) {
        case "R": case "DR": return [[-1, 0], [1, 0], [0, 1], [0, -1]];
        case "B": case "DB": return [[-1, 1], [-1, -1], [1, 1], [1, -1]];
        case "L": return [[-1, 0]];
        default: return [];
    }
}

/**
 * Get all legal moves for a piece at (row, col).
 * @returns {Array<{row: number, col: number, promote?: boolean}>}
 */
export function getLegalMoves(board, row, col) {
    const piece = board[row][col];
    if (!piece) return [];

    const moves = [];
    const side = piece.side;
    const forward = side === "sente" ? -1 : 1;
    const isPromoted = piece.type !== "K" && piece.type.length > 1;

    // Non-sliding pieces
    const rawDeltas = getRawDeltas(piece.type);
    for (const [dr, dc] of rawDeltas) {
        // Filter direction for unpromoted pieces
        if (!isPromoted) {
            // Pawn, Lance, Knight, Silver can only move forward
            if (["P", "L", "N", "S"].includes(piece.type)) {
                if (dr * forward < 0) continue; // must move forward (negative for sente)
            }
            // Knight has special forward requirement
            if (piece.type === "N" && dr * forward >= 0) continue;
        }

        const nr = row + dr;
        const nc = col + dc;
        if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) continue;
        if (board[nr][nc] && board[nr][nc].side === side) continue;

        const move = { row: nr, col: nc };

        // Check promotion
        if (!isPromoted && canPromote(piece.type)) {
            const promoZone = side === "sente" ? PROMOTION_ZONE_SENTE : PROMOTION_ZONE_GOTE;
            if (promoZone.includes(row) || promoZone.includes(nr)) {
                move.promote = true;
                moves.push({ ...move, promote: true });
                moves.push({ ...move, promote: false });
                continue;
            }
        }

        moves.push(move);
    }

    // Sliding pieces (rook, bishop, lance)
    const slidingDirs = getSlidingDirections(piece.type);
    for (const [dr, dc] of slidingDirs) {
        let nr = row + dr;
        let nc = col + dc;
        while (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
            if (board[nr][nc]) {
                if (board[nr][nc].side !== side) {
                    const move = { row: nr, col: nc };
                    if (!isPromoted && canPromote(piece.type)) {
                        const promoZone = side === "sente" ? PROMOTION_ZONE_SENTE : PROMOTION_ZONE_GOTE;
                        if (promoZone.includes(row) || promoZone.includes(nr)) {
                            moves.push({ ...move, promote: true });
                            moves.push({ ...move, promote: false });
                        } else {
                            moves.push(move);
                        }
                    } else {
                        moves.push(move);
                    }
                }
                break;
            }
            const move = { row: nr, col: nc };
            if (!isPromoted && canPromote(piece.type)) {
                const promoZone = side === "sente" ? PROMOTION_ZONE_SENTE : PROMOTION_ZONE_GOTE;
                if (promoZone.includes(row) || promoZone.includes(nr)) {
                    moves.push({ ...move, promote: true });
                    moves.push({ ...move, promote: false });
                } else {
                    moves.push(move);
                }
            } else {
                moves.push(move);
            }
            nr += dr;
            nc += dc;
        }
    }

    return moves;
}

/**
 * Check if a piece type can be promoted.
 */
function canPromote(type) {
    return ["R", "B", "S", "N", "L", "P"].includes(type);
}

/**
 * Execute a move on the board (mutates board).
 * @returns {{ captured: object|null, dropped: boolean }}
 */
export function makeMove(board, fromRow, fromCol, toRow, toCol, promote = false) {
    const piece = board[fromRow][fromCol];
    if (!piece) return { captured: null, dropped: false };

    const captured = board[toRow][toCol];
    board[toRow][toCol] = piece;
    board[fromRow][fromCol] = null;

    if (promote && canPromote(piece.type)) {
        piece.type = PIECES[piece.type].promoted;
    }

    return { captured, dropped: false };
}

/**
 * Execute a drop (place captured piece from hand onto board).
 * @returns {boolean} success
 */
export function makeDrop(board, type, side, toRow, toCol) {
    if (toRow < 0 || toRow >= BOARD_SIZE || toCol < 0 || toCol >= BOARD_SIZE) return false;
    if (board[toRow][toCol]) return false;

    // Cannot drop pawn on column where unpromoted pawn of same side already exists (二歩 nifu)
    if (type === "P") {
        for (let r = 0; r < BOARD_SIZE; r++) {
            if (board[r][toCol] && board[r][toCol].side === side && board[r][toCol].type === "P") {
                return false;
            }
        }
    }

    // 行き所のない駒 (Uchidokoro naru koma): cannot drop a piece where it would
    // have no legal moves. Pawn/Lance cannot be dropped on the last rank;
    // Knight cannot be dropped on the last two ranks (it needs 2 rows to jump).
    if (side === "sente") {
        // Sente moves toward row 0
        if ((type === "P" || type === "L") && toRow === 0) return false;
        if (type === "N" && toRow <= 1) return false;
    } else {
        // Gote moves toward row 8
        if ((type === "P" || type === "L") && toRow === BOARD_SIZE - 1) return false;
        if (type === "N" && toRow >= BOARD_SIZE - 2) return false;
    }

    // Cannot drop pawn to give immediate checkmate (打ち歩詰め uchifuzume)
    // (simplified: skip this check for now)

    board[toRow][toCol] = { type, side };
    return true;
}

/**
 * Check if a side is in check.
 */
export function isInCheck(board, side) {
    // Find king position
    let kingRow = -1, kingCol = -1;
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] && board[r][c].side === side && board[r][c].type === "K") {
                kingRow = r;
                kingCol = c;
                break;
            }
        }
        if (kingRow !== -1) break;
    }
    if (kingRow === -1) return false;

    // Check if any opponent piece attacks the king
    const opponent = side === "sente" ? "gote" : "sente";
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] && board[r][c].side === opponent) {
                const moves = getLegalMoves(board, r, c);
                if (moves.some(m => m.row === kingRow && m.col === kingCol)) {
                    return true;
                }
            }
        }
    }
    return false;
}

/**
 * Get the piece label (kanji) for display.
 */
export function getPieceLabel(type) {
    return PIECES[type]?.kanji || "?";
}
