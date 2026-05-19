import { BoardGameRenderer3D } from '../../render3d/BoardGameRenderer3D.js';
import {
    CLASSIC_ROWS,
    CLASSIC_COLS,
    BOARD_SEGMENTS,
    isPlayable,
    isCamp,
    isHeadquarters,
    isMountain,
    isFrontline
} from '../classic/rules.js';

const CLASSIC_LABELS = {
    S: '司', G: '军', D: '师', R: '旅', T: '团', B: '营',
    C: '连', P: '排', E: '工', X: '炸', M: '雷', F: '旗'
};

const FLIP_LABELS = {
    K: '将', A: '士', E: '象', R: '车', N: '马', C: '炮', P: '兵'
};

export class JunqiRenderer3D extends BoardGameRenderer3D {
    constructor(container, options = {}) {
        const variant = options.variant || 'classic';
        super(container, JunqiRenderer3D.createOptions(variant, options));
        this.variant = variant;
    }

    static createOptions(variant, options = {}) {
        if (variant === 'flip') {
            return {
                rows: 4,
                cols: 8,
                layout: 'square',
                cellSize: 0.84,
                tileHeight: 0.085,
                bevelRadius: 0.09,
                pieceStyle: {
                    radiusTop: 0.31,
                    radiusBottom: 0.36,
                    height: 0.23,
                    labelSize: 0.55,
                    metalness: 0.1,
                    roughness: 0.42
                },
                theme: {
                    base: 0x202a21,
                    board: 0x526344,
                    boardAlt: 0x314032,
                    hidden: 0x7a5d2a,
                    pieceRed: 0xb23a31,
                    pieceBlack: 0x20242a
                },
                labelPiece: (piece) => piece?.revealed ? (FLIP_LABELS[piece.rank] || '?') : '?',
                pieceSide: (piece) => !piece?.revealed ? 'hidden' : piece.color === 'r' ? 'red' : 'black',
                ...options
            };
        }
        return {
            rows: CLASSIC_ROWS,
            cols: CLASSIC_COLS,
            layout: 'junqi',
            cellSize: 0.72,
            cameraHeightScale: 1.04,
            cameraDistanceScale: 1.34,
            cameraTargetZ: 0.2,
            tileHeight: 0.07,
            bevelRadius: 0.1,
            pieceStyle: {
                radiusTop: 0.29,
                radiusBottom: 0.34,
                height: 0.22,
                labelSize: 0.52,
                metalness: 0.08,
                roughness: 0.44
            },
            segments: BOARD_SEGMENTS,
            isCellEnabled: isPlayable,
            isCampCell: isCamp,
            isHeadquartersCell: isHeadquarters,
            isMountainCell: isMountain,
            isFrontlineCell: isFrontline,
            theme: {
                base: 0x172318,
                board: 0x5f6f4f,
                rail: 0xd2b96c,
                road: 0x7b6b4d,
                camp: 0x526f57,
                hq: 0x744a38,
                hidden: 0x6f5a31,
                pieceRed: 0xb43a31,
                pieceBlack: 0x222831
            },
            labelPiece: (piece, _row, _col, renderOptions = {}) => {
                if (piece.color !== renderOptions.playerColor && !piece.revealed) return '?';
                return CLASSIC_LABELS[piece.rank] || '?';
            },
            pieceSide: (piece, _row, _col, renderOptions = {}) => {
                if (piece.color !== renderOptions.playerColor && !piece.revealed) return 'hidden';
                return piece.color === 'r' ? 'red' : 'black';
            },
            ...options
        };
    }

    setVariant(variant) {
        if (variant === this.variant) return;
        this.variant = variant;
        this.rebuild(JunqiRenderer3D.createOptions(variant));
    }
}
