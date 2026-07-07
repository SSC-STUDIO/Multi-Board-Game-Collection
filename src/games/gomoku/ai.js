/** AI 引擎：走法评分、搜索决策与引导分析 @module game/ai */

import {
    AI_DELAY_BY_LEVEL,
    DIRECTIONS,
    FOUR_PATTERNS,
    THREE_PATTERNS
} from '../../config/gameConfig.js';
import {
    countOpenPatterns,
    getForbiddenReason,
    getLineInfo,
    getLineString,
    matchesAny,
    wouldWin
} from './rules.js';
import { getOpponent, isInside } from '../../utils/board.js';

/**
 * 根据难度等级获取 AI 思考延迟
 * @param {'easy'|'medium'|'hard'} level - 难度等级
 * @returns {number} 延迟毫秒数
 */
export function getAIDelay(level) {
    return AI_DELAY_BY_LEVEL[level] ?? AI_DELAY_BY_LEVEL.medium;
}

/**
 * 生成 [0, 1) 区间的安全随机浮点数
 * @returns {number} 0（含）到 1（不含）之间的浮点数
 */
function randomFraction() {
    const cryptoObject = globalThis.crypto;
    if (!cryptoObject?.getRandomValues) {
        throw new Error('Secure random generator unavailable');
    }

    const bytes = new Uint32Array(1);
    cryptoObject.getRandomValues(bytes);
    return bytes[0] / 0x1_0000_0000;
}

/**
 * 获取 AI 最佳走法（主入口）。根据难度选择策略：
 * - easy：从评分前 6 的走法中随机选取
 * - medium：minimax 深度 2，候选前 10，alpha-beta 剪枝
 * - hard：minimax 自适应深度(2-4)，候选前 10-15，alpha-beta 剪枝
 * @param {import('./state.js').GameState} state - 游戏状态快照
 * @param {'black'|'white'} color - AI 执子颜色
 * @returns {{row: number, col: number, score: number}|null} 最佳走法坐标与评分，无合法走法时返回 null
 */
export function getBestMove(state, color) {
    const scoredMoves = getScoredMoves(state, color);
    if (scoredMoves.length === 0) {
        return null;
    }

    const { board, options, moveHistory } = state;
    const { size } = options;
    const opponent = getOpponent(color);

    if (options.level === 'easy') {
        const topMoves = scoredMoves.slice(0, Math.min(6, scoredMoves.length));
        return topMoves[Math.floor(randomFraction() * topMoves.length)];
    }

    if (options.level === 'medium') {
        // Medium: minimax with alpha-beta, depth 2, top 10 candidates
        const depth = 2;
        const candidates = scoredMoves.slice(0, Math.min(10, scoredMoves.length));

        let bestScore = -Infinity;
        let bestMove = candidates[0];

        for (const move of candidates) {
            board[move.row][move.col] = color;
            const childState = { ...state, moveHistory: [...moveHistory, { row: move.row, col: move.col, color }] };
            const score = minimaxSearch(childState, depth - 1, -Infinity, Infinity, false, color, opponent);
            board[move.row][move.col] = null;

            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }

        return { row: bestMove.row, col: bestMove.col, score: bestScore };
    }

    // Hard: opening book - first move always center
    if (moveHistory.length === 0) {
        const center = Math.floor(size / 2);
        return { row: center, col: center, score: 1000 };
    }
    // Second move: if center is free, claim it
    if (moveHistory.length === 1) {
        const center = Math.floor(size / 2);
        if (!board[center][center]) {
            return { row: center, col: center, score: 900 };
        }
    }
    // Third move: respond to opponent's placement near center
    if (moveHistory.length === 2) {
        const center = Math.floor(size / 2);
        const lastOpp = moveHistory[moveHistory.length - 1];
        if (lastOpp && lastOpp.color !== color) {
            const dr = lastOpp.row - center;
            const dc = lastOpp.col - center;
            // If opponent played diagonal, play orthogonally adjacent to center
            if (Math.abs(dr) === 1 && Math.abs(dc) === 1 && !board[center][center]) {
                return { row: center, col: center, score: 950 };
            }
            // If opponent played orthogonal, play diagonal to maintain balance
            if ((Math.abs(dr) + Math.abs(dc)) === 1 && !board[center + dr][center + dc]) {
                return { row: center + dr, col: center + dc, score: 920 };
            }
        }
    }
    // Hard: minimax with alpha-beta, adaptive depth, top 15 candidates
    const moveCount = moveHistory.length;
    const depth = moveCount < 6 ? 2 : moveCount < 20 ? 3 : 4;
    const maxCandidates = moveCount < 6 ? 10 : 15;
    const candidates = scoredMoves.slice(0, Math.min(maxCandidates, scoredMoves.length));

    let bestScore = -Infinity;
    let bestMove = candidates[0];

    for (const move of candidates) {
        board[move.row][move.col] = color;
        const childState = { ...state, moveHistory: [...moveHistory, { row: move.row, col: move.col, color }] };
        const score = minimaxSearch(childState, depth - 1, -Infinity, Infinity, false, color, opponent);
        board[move.row][move.col] = null;

        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
        }
    }

    return { row: bestMove.row, col: bestMove.col, score: bestScore };
}

/**
 * 生成走法指导信息，包含推荐走法、洞察标签、风险标签及替代方案
 * @param {import('./state.js').GameState} state - 游戏状态快照
 * @param {'black'|'white'} color - 当前执子颜色
 * @returns {{row: number, col: number, score: number, insight: string, risk: string, alternatives: Array<{row: number, col: number, score: number, reason: string}>}|null} 指导信息，无合法走法时返回 null
 */
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

    // Composite threat bonuses: detect cross-direction synergy (double threes,
    // four-three, double four) separately for attack and defense perspectives.
    const attackBonus = getCompositeBonus(board, size, row, col, color);
    const defenseBonus = getCompositeBonus(board, size, row, col, opponent);

    return (attackScore + attackBonus) * 1.18 + (defenseScore + defenseBonus) + centerBias;
}

function minimaxSearch(state, depth, alpha, beta, isMaximizing, aiColor, opponentColor) {
    const { board, options } = state;
    const { size } = options;

    // Terminal: depth exhausted or no candidates
    if (depth === 0) {
        return evaluateState(board, size, aiColor, opponentColor);
    }

    const currentColor = isMaximizing ? aiColor : opponentColor;
    const candidates = getCandidateMoves(state, currentColor);

    if (candidates.length === 0) {
        return evaluateState(board, size, aiColor, opponentColor);
    }

    // Move ordering: score candidates with quick heuristic for better pruning
    const scored = candidates.map(m => ({
        ...m,
        score: evaluateMove(state, m.row, m.col, currentColor)
    })).sort((a, b) => b.score - a.score).slice(0, 20);

    if (isMaximizing) {
        let maxEval = -Infinity;
        for (const move of scored) {
            board[move.row][move.col] = currentColor;
            const eval_ = minimaxSearch(state, depth - 1, alpha, beta, false, aiColor, opponentColor);
            board[move.row][move.col] = null;
            if (eval_ > maxEval) maxEval = eval_;
            alpha = Math.max(alpha, eval_);
            if (beta <= alpha) break;
        }
        return maxEval;
    } else {
        let minEval = Infinity;
        for (const move of scored) {
            board[move.row][move.col] = currentColor;
            const eval_ = minimaxSearch(state, depth - 1, alpha, beta, true, aiColor, opponentColor);
            board[move.row][move.col] = null;
            if (eval_ < minEval) minEval = eval_;
            beta = Math.min(beta, eval_);
            if (beta <= alpha) break;
        }
        return minEval;
    }
}

function evaluateState(board, size, aiColor, opponentColor) {
    let score = 0;

    // Check for terminal win/loss first
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            const cell = board[r][c];
            if (!cell) continue;

            for (const [dRow, dCol] of DIRECTIONS) {
                const line = getLineInfo(board, size, r, c, dRow, dCol, cell);
                const lineScore = getLineScore(line.count, line.openEnds);
                if (cell === aiColor) {
                    score += lineScore;
                } else {
                    score -= lineScore;
                }
            }
        }
    }

    return score;
}

function evaluatePatterns(board, size, row, col, color) {
    const copy = board.map((r) => [...r]);
    copy[row][col] = color;
    let score = 0;
    for (const [dRow, dCol] of DIRECTIONS) {
        const line = getLineInfo(copy, size, row, col, dRow, dCol, color);
        score += getLineScore(line.count, line.openEnds);
        score += getPatternBonus(getLineString(copy, size, row, col, dRow, dCol, color));
    }
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

function detectCompositeThreats(board, size, row, col, color) {
    const copy = board.map(r => [...r]);
    copy[row][col] = color;

    let openThrees = 0;
    let openFours = 0;
    let halfOpenFours = 0;

    for (const [dRow, dCol] of DIRECTIONS) {
        const line = getLineInfo(copy, size, row, col, dRow, dCol, color);
        if (line.count === 3 && line.openEnds === 2) openThrees++;
        if (line.count === 4 && line.openEnds === 2) openFours++;
        if (line.count === 4 && line.openEnds === 1) halfOpenFours++;
    }

    // Check pattern-based detection too
    const openFourPatterns = countOpenPatterns(copy, size, row, col, color, 4);
    const openThreePatterns = countOpenPatterns(copy, size, row, col, color, 3);

    return {
        openThrees: Math.max(openThrees, openThreePatterns),
        openFours: Math.max(openFours, openFourPatterns),
        halfOpenFours,
        // Double open three (unstoppable)
        isDoubleThree: openThrees >= 2 || openThreePatterns >= 2,
        // Four-three (unstoppable)
        isFourThree: (openFours + halfOpenFours) >= 1 && openThrees >= 1,
        // Double four (forbidden in renju but still dangerous)
        isDoubleFour: openFours >= 2 || openFourPatterns >= 2
    };
}

function getCompositeBonus(board, size, row, col, color) {
    const threats = detectCompositeThreats(board, size, row, col, color);
    let bonus = 0;

    if (threats.isDoubleThree) bonus += 120_000;
    if (threats.isFourThree) bonus += 200_000;
    if (threats.isDoubleFour) bonus += 150_000;
    if (threats.openThrees === 1) bonus += 3_000;
    if (threats.openFours >= 1) bonus += 25_000;

    return bonus;
}

function inspectMove(board, size, row, col, color) {
    const copy = board.map((r) => [...r]);
    copy[row][col] = color;

    const openFours = countOpenPatterns(copy, size, row, col, color, 4);
    const openThrees = countOpenPatterns(copy, size, row, col, color, 3);
    let strongestLine = 0;
    let fourPattern = false;
    let threePattern = false;

    for (const [dRow, dCol] of DIRECTIONS) {
        const lineInfo = getLineInfo(copy, size, row, col, dRow, dCol, color);
        strongestLine = Math.max(strongestLine, lineInfo.count);
        const lineString = getLineString(copy, size, row, col, dRow, dCol, color);
        fourPattern ||= matchesAny(lineString, FOUR_PATTERNS);
        threePattern ||= matchesAny(lineString, THREE_PATTERNS);
    }

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

    const copy = board.map((r) => [...r]);
    copy[row][col] = color;
    const threatState = { board: copy, options, moveHistory };
    const opponentThreatExists = hasImmediateWin(threatState, opponent);

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
