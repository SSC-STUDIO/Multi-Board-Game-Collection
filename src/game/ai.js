import {
    AI_DELAY_BY_LEVEL,
    DIRECTIONS,
    FOUR_PATTERNS,
    THREE_PATTERNS
} from '../config/gameConfig.js';
import {
    countOpenPatterns,
    getForbiddenReason,
    getLineInfo,
    getLineString,
    matchesAny,
    wouldWin
} from './rules.js';
import { getOpponent, isInside } from '../utils/board.js';

export function getAIDelay(level) {
    return AI_DELAY_BY_LEVEL[level] ?? AI_DELAY_BY_LEVEL.medium;
}

function randomFraction() {
    const cryptoObject = globalThis.crypto;
    if (!cryptoObject?.getRandomValues) {
        throw new Error('Secure random generator unavailable');
    }

    const bytes = new Uint32Array(1);
    cryptoObject.getRandomValues(bytes);
    return bytes[0] / 0x1_0000_0000;
}

export function getBestMove(state, color) {
    const scoredMoves = getScoredMoves(state, color);
    if (scoredMoves.length === 0) {
        return null;
    }

    if (state.options.level === 'easy') {
        const topMoves = scoredMoves.slice(0, Math.min(6, scoredMoves.length));
        return topMoves[Math.floor(randomFraction() * topMoves.length)];
    }

    if (state.options.level === 'medium') {
        const topMoves = scoredMoves.slice(0, Math.min(3, scoredMoves.length));
        const total = topMoves.reduce((sum, move) => sum + Math.max(move.score, 1), 0);
        let cursor = randomFraction() * total;

        for (const move of topMoves) {
            cursor -= Math.max(move.score, 1);
            if (cursor <= 0) {
                return move;
            }
        }

        return topMoves[0];
    }

    return scoredMoves[0];
}

export function getMoveGuidance(state, color) {
    const scoredMoves = getScoredMoves(state, color);
    if (scoredMoves.length === 0) {
        return null;
    }

    const recommended = scoredMoves[0];
    return {
        row: recommended.row,
        col: recommended.col,
        score: recommended.score,
        insight: pickInsightTag(state, recommended.row, recommended.col, color),
        risk: pickRiskTag(state, recommended.row, recommended.col, color),
        alternatives: scoredMoves.slice(1, 4).map((move) => ({
            row: move.row,
            col: move.col,
            score: move.score,
            reason: pickInsightTag(state, move.row, move.col, color)
        }))
    };
}

export function getMoveReview(state, row, col, color) {
    const guidance = getMoveGuidance(state, color);
    if (!guidance) {
        return '';
    }

    if (guidance.row === row && guidance.col === col) {
        return 'coachReviewFollowed';
    }

    const selectedScore = evaluateMove(state, row, col, color);
    if (!Number.isFinite(selectedScore) || guidance.score <= 0) {
        return 'coachReviewDeviation';
    }

    const ratio = selectedScore / guidance.score;
    if (ratio >= 0.88) {
        return 'coachReviewFlexible';
    }

    if (ratio >= 0.56) {
        return 'coachReviewDeviation';
    }

    return 'coachReviewPunishable';
}

function getScoredMoves(state, color) {
    const candidates = getCandidateMoves(state, color);
    if (candidates.length === 0) {
        return [];
    }

    return candidates
        .map((move) => ({
            ...move,
            score: evaluateMove(state, move.row, move.col, color)
        }))
        .filter((move) => Number.isFinite(move.score))
        .sort((left, right) => right.score - left.score);
}

function getCandidateMoves(state, color) {
    const { board, moveHistory, options } = state;
    const { size, rule } = options;

    if (moveHistory.length === 0) {
        const center = Math.floor(size / 2);
        return [{ row: center, col: center }];
    }

    const candidates = new Map();

    for (let row = 0; row < size; row += 1) {
        for (let col = 0; col < size; col += 1) {
            if (!board[row][col]) {
                continue;
            }

            for (let dRow = -2; dRow <= 2; dRow += 1) {
                for (let dCol = -2; dCol <= 2; dCol += 1) {
                    const nextRow = row + dRow;
                    const nextCol = col + dCol;

                    if (!isInside(size, nextRow, nextCol) || board[nextRow][nextCol]) {
                        continue;
                    }

                    const key = `${nextRow},${nextCol}`;
                    if (!candidates.has(key)) {
                        candidates.set(key, { row: nextRow, col: nextCol });
                    }
                }
            }
        }
    }

    return Array.from(candidates.values()).filter((move) => {
        if (rule === 'renju' && color === 'black') {
            return !getForbiddenReason(board, size, rule, move.row, move.col, color);
        }

        return true;
    });
}

function evaluateMove(state, row, col, color) {
    const { board, options } = state;
    const { size, rule } = options;

    if (board[row][col]) {
        return Number.NEGATIVE_INFINITY;
    }

    if (rule === 'renju' && color === 'black' && getForbiddenReason(board, size, rule, row, col, color)) {
        return Number.NEGATIVE_INFINITY;
    }

    const opponent = getOpponent(color);

    if (wouldWin(board, size, row, col, color)) {
        return 1_000_000_000;
    }

    if (wouldWin(board, size, row, col, opponent)) {
        return 800_000_000;
    }

    const attackScore = evaluatePatterns(board, size, row, col, color);
    const defenseScore = evaluatePatterns(board, size, row, col, opponent) * 0.92;
    const center = Math.floor(size / 2);
    const centerBias = size * 2 - (Math.abs(row - center) + Math.abs(col - center));

    return attackScore * 1.18 + defenseScore + centerBias;
}

function evaluatePatterns(board, size, row, col, color) {
    let score = 0;

    board[row][col] = color;
    for (const [dRow, dCol] of DIRECTIONS) {
        const line = getLineInfo(board, size, row, col, dRow, dCol, color);
        score += getLineScore(line.count, line.openEnds);
        score += getPatternBonus(getLineString(board, size, row, col, dRow, dCol, color));
    }
    board[row][col] = null;

    return score;
}

function getLineScore(count, openEnds) {
    if (count >= 5) {
        return 500_000;
    }

    if (count === 4 && openEnds === 2) {
        return 80_000;
    }

    if (count === 4 && openEnds === 1) {
        return 12_000;
    }

    if (count === 3 && openEnds === 2) {
        return 5_200;
    }

    if (count === 3 && openEnds === 1) {
        return 1_000;
    }

    if (count === 2 && openEnds === 2) {
        return 380;
    }

    if (count === 2 && openEnds === 1) {
        return 90;
    }

    if (count === 1 && openEnds === 2) {
        return 24;
    }

    return 4;
}

function getPatternBonus(line) {
    if (matchesAny(line, FOUR_PATTERNS)) {
        return 18_000;
    }

    if (matchesAny(line, THREE_PATTERNS)) {
        return 2_800;
    }

    return 0;
}

function inspectMove(board, size, row, col, color) {
    board[row][col] = color;

    const openFours = countOpenPatterns(board, size, row, col, color, 4);
    const openThrees = countOpenPatterns(board, size, row, col, color, 3);
    let strongestLine = 0;
    let fourPattern = false;
    let threePattern = false;

    for (const [dRow, dCol] of DIRECTIONS) {
        const lineInfo = getLineInfo(board, size, row, col, dRow, dCol, color);
        strongestLine = Math.max(strongestLine, lineInfo.count);
        const lineString = getLineString(board, size, row, col, dRow, dCol, color);
        fourPattern ||= matchesAny(lineString, FOUR_PATTERNS);
        threePattern ||= matchesAny(lineString, THREE_PATTERNS);
    }

    board[row][col] = null;

    return {
        openFours,
        openThrees,
        strongestLine,
        fourPattern,
        threePattern
    };
}

function hasImmediateWin(state, color) {
    const candidates = getCandidateMoves(state, color);
    return candidates.some((move) => wouldWin(state.board, state.options.size, move.row, move.col, color));
}

function pickInsightTag(state, row, col, color) {
    const opponent = getOpponent(color);
    const { board, options, moveHistory } = state;

    if (wouldWin(board, options.size, row, col, color)) {
        return 'coachReasonWin';
    }

    if (wouldWin(board, options.size, row, col, opponent)) {
        return 'coachReasonBlock';
    }

    const signal = inspectMove(board, options.size, row, col, color);
    if (signal.openFours > 0 || signal.fourPattern || signal.strongestLine >= 4) {
        return 'coachReasonAttack';
    }

    if (signal.openThrees > 0 || signal.threePattern || signal.strongestLine >= 3) {
        return 'coachReasonShape';
    }

    const center = Math.floor(options.size / 2);
    const centerDistance = Math.abs(row - center) + Math.abs(col - center);
    if (moveHistory.length < 8 && centerDistance <= 3) {
        return 'coachReasonCenter';
    }

    return 'coachReasonPressure';
}

function pickRiskTag(state, row, col, color) {
    const opponent = getOpponent(color);
    const { board, options, moveHistory } = state;

    if (hasImmediateWin(state, opponent)) {
        return 'coachRiskThreat';
    }

    board[row][col] = color;
    const opponentThreatExists = hasImmediateWin(state, opponent);
    board[row][col] = null;

    if (opponentThreatExists) {
        return 'coachRiskThreat';
    }

    if (options.rule === 'renju' && color === 'black') {
        return 'coachRiskForbidden';
    }

    if (moveHistory.length < 10) {
        return 'coachRiskInitiative';
    }

    return 'coachRiskCounter';
}
