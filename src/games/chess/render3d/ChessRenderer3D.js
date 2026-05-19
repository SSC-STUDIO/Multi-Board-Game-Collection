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
            tileHeight: 0.095,
            bevelRadius: 0.1,
            pieceStyle: {
                radiusTop: 0.29,
                radiusBottom: 0.36,
                height: 0.34,
                labelSize: 0.52,
                metalness: 0.14,
                roughness: 0.36
            },
            theme: {
                base: 0x17110b,
                board: 0xd7c19a,
                boardAlt: 0x5b3521,
                pieceLight: 0xf3ead5,
                pieceDark: 0x20242f
            },
            coordinateLabels: {
                files: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
                ranks: ['8', '7', '6', '5', '4', '3', '2', '1'],
                edgeOffset: 0.68,
                size: 0.32
            },
            labelPiece: (piece) => PIECE_LABELS[piece] || '',
            pieceSide: (piece) => piece?.[0] === 'b' ? 'dark' : 'light',
            ...options
        });
    }
}

export { BoardGameRenderer3D };
