import { BoardGameRenderer3D } from '../../render3d/BoardGameRenderer3D.js';

const PIECE_LABELS = {
    rK: '帅', rA: '仕', rE: '相', rN: '马', rR: '车', rC: '炮', rP: '兵',
    bK: '将', bA: '士', bE: '象', bN: '馬', bR: '車', bC: '砲', bP: '卒'
};

export class XiangqiRenderer3D extends BoardGameRenderer3D {
    constructor(container, options = {}) {
        super(container, {
            rows: 10,
            cols: 9,
            layout: 'intersection',
            cellSize: 0.78,
            riverBetween: 4,
            theme: {
                base: 0x5c3319,
                board: 0xd7a55f,
                line: 0x3b2010,
                pieceRed: 0xb52b25,
                pieceBlack: 0x202226
            },
            labelPiece: (piece) => PIECE_LABELS[piece] || '',
            pieceSide: (piece) => piece?.[0] === 'r' ? 'red' : 'black',
            ...options
        });
    }
}
