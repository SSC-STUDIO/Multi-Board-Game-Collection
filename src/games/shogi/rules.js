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
 * Deltas are in sente orientation (forward = decreasing row).
 * For gote, the row component is flipped by the caller via `forward`.
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
 * Directions are in sente orientation (forward = decreasing row).
 * For gote, the row component is flipped by the caller via `forward`.
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
    const flip = side === "gote" ? -1 : 1; // deltas are sente-oriented; flip row for gote
    const isPromoted = piece.type !== "K" && piece.type.length > 1;

    // Non-sliding pieces
    const rawDeltas = getRawDeltas(piece.type);
    for (const [dr, dc] of rawDeltas) {
        // Apply side direction flip (deltas are sente-oriented)
        const fdr = dr * flip;

        const nr = row + fdr;
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
        const fdr = dr * flip;
        const fdc = dc; // columns are never flipped
        let nr = row + fdr;
        let nc = col + fdc;
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
            nr += fdr;
            nc += fdc;
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
    if (type === "P") {
        board[toRow][toCol] = { type, side };
        const opponent = side === "sente" ? "gote" : "sente";
        const givesCheck = isInCheck(board, opponent);
        if (givesCheck) {
            // Check if opponent has any legal escape (board moves + drops).
            // If not, this pawn drop is checkmate → illegal uchifuzume.
            const hasEscape = hasAnyLegalMove(board, opponent);
            if (!hasEscape) {
                // Undo placement — illegal uchifuzume
                board[toRow][toCol] = null;
                return false;
            }
        }
        board[toRow][toCol] = null;
    }

    board[toRow][toCol] = { type, side };
    return true;
}

/**
 * Check if a side has any legal move (board moves + drops) that does not
 * leave own king in check. Used by uchifuzume detection in makeDrop.
 * Does NOT recurse into uchifuzume checking (only pawn drops trigger it).
 * @param {Array<Array<object|null>>} board
 * @param {'sente'|'gote'} side
 * @returns {boolean}
 */
export function hasAnyLegalMove(board, side) {
    // Board moves
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const piece = board[r][c];
            if (!piece || piece.side !== side) continue;
            const moves = getLegalMoves(board, r, c);
            for (const mv of moves) {
                // Simulate move, check for self-check, then restore
                const captured = board[mv.row][mv.col];
                const originalType = piece.type;
                board[mv.row][mv.col] = piece;
                board[r][c] = null;
                if (mv.promote && canPromote(piece.type)) {
                    piece.type = PIECES[piece.type].promoted;
                }
                const inCheck = isInCheck(board, side);
                piece.type = originalType;
                board[r][c] = piece;
                board[mv.row][mv.col] = captured;
                if (!inCheck) return true;
            }
        }
    }

    // Drop moves — test all droppable piece types, not just Gold.
    // A Rook, Bishop, or Knight drop might block/escape check where Gold cannot.
    // We do NOT test pawn drops here because uchifuzume only restricts the
    // side delivering mate, not the side escaping it; but skipping pawn drops
    // could miss a legal pawn-drop escape. So we test P too.
    // However, makeDrop would recurse if called here — instead we simulate
    // the drop directly and check for self-check.
    const dropTypes = ["R", "B", "G", "S", "N", "L", "P"];
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c]) continue;
            for (const dt of dropTypes) {
                board[r][c] = { type: dt, side };
                if (!isInCheck(board, side)) {
                    board[r][c] = null;
                    return true;
                }
                board[r][c] = null;
            }
        }
    }

    return false;
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
 * Get all legal moves for a piece at (row, col), filtered to exclude
 * moves that leave the piece's own king in check (self-check filter).
 * @param {Array<Array<object|null>>} board - Board state
 * @param {number} row - Source row
 * @param {number} col - Source column
 * @returns {Array<{row: number, col: number, promote?: boolean}>}
 */
export function getLegalMovesFiltered(board, row, col) {
    const piece = board[row][col];
    if (!piece) return [];

    const rawMoves = getLegalMoves(board, row, col);
    const side = piece.side;

    return rawMoves.filter((mv) => {
        // Simulate the move on the board, check for self-check, then restore
        const captured = board[mv.row][mv.col];
        const originalType = piece.type;

        board[mv.row][mv.col] = piece;
        board[row][col] = null;
        if (mv.promote && canPromote(piece.type)) {
            piece.type = PIECES[piece.type].promoted;
        }

        const inCheck = isInCheck(board, side);

        // Restore
        piece.type = originalType;
        board[row][col] = piece;
        board[mv.row][mv.col] = captured;

        return !inCheck;
    });
}

/**
 * Get the piece label (kanji) for display.
 */
export function getPieceLabel(type) {
    return PIECES[type]?.kanji || "?";
}
