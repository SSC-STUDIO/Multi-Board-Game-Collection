import { BoardGameRenderer3D } from '../../render3d/BoardGameRenderer3D.js';

const PIECE_LABELS = {
    wK: 'K', wQ: 'Q', wR: 'R', wB: 'B', wN: 'N', wP: 'P',
    bK: 'K', bQ: 'Q', bR: 'R', bB: 'B', bN: 'N', bP: 'P'
};

export class ChessRenderer3D extends BoardGameRenderer3D {
    constructor(container, options = {}) {
        super(container, {
            rows: 8,
            cols: 8,
            layout: 'square',
            cellSize: 0.82,
            cameraHeightScale: 1.36,
            cameraDistanceScale: 1.46,
            theme: {
                base: 0x17110b,
                board: 0xd7c19a,
                boardAlt: 0x5b3521,
                pieceLight: 0xf3ead5,
                pieceDark: 0x20242f
            },
            labelPiece: (piece) => PIECE_LABELS[piece] || '',
            pieceSide: (piece) => piece?.[0] === 'b' ? 'dark' : 'light',
            ...options
        });
    }
}

export { BoardGameRenderer3D };
