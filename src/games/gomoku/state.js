/**
 * 游戏状态工厂与类型定义。
 * @module game/state
 */

import { DEFAULT_OPTIONS } from '../../config/gameConfig.js';

/**
 * @typedef {Object} GameOptions
 * @property {'pvp'|'pve'|'practice'|'qi'} mode - 游戏模式
 * @property {'classic'|'renju'} rule - 规则模式
 * @property {number} size - 棋盘尺寸
 * @property {'easy'|'medium'|'hard'} level - AI 难度
 * @property {'black'|'white'} playerColor - 玩家执子颜色
 * @property {'home'|'park'|'competition'} scene - 3D 场景预设
 */

/**
 * @typedef {Object} GameState
 * @property {GameOptions} options - 游戏配置选项
 * @property {Array<Array<'black'|'white'|null>>} board - 棋盘状态（二维数组，null 表示空位）
 * @property {'black'|'white'} currentPlayer - 当前落子方
 * @property {boolean} gameOver - 游戏是否结束
 * @property {Array<{row: number, col: number, color: 'black'|'white', index: number}>} moveHistory - 落子历史记录
 * @property {{row: number, col: number, color: 'black'|'white', index: number}|null} lastMove - 最后一步落子位置
 * @property {{row: number, col: number}|null} hintMove - AI 提示位置
 * @property {boolean} aiThinking - AI 是否正在计算
 * @property {{row: number, col: number}|null} coachSuggestion - 教练建议落点
 * @property {Array<{row: number, col: number, score: number, reason: string}>} coachAlternatives - 教练推荐的替代方案
 * @property {'local'|'llm'} coachSource - 教练建议来源
 * @property {'disabled'|'missing'|'ready'|'local'|'llm'|'loading'|'analyzing-image'|'unavailable'|string} coachLlmStatus - LLM 连接状态描述
 * @property {string} coachInsight - 棋局洞察分析
 * @property {string} coachRisk - 风险提示
 * @property {string} coachPlan - 战略计划
 * @property {number|null} coachConfidence - 教练置信度（0-100）
 * @property {string|null} coachFocus - 教练关注焦点
 * @property {string} coachFeedback - 教练反馈文本
 * @property {{row: number, col: number}|null} selectedCell - 当前选中的格子
 * @property {boolean} awaitingPlacementConfirm - 是否正在等待落子确认
 * @property {Array<{row: number, col: number}>} winningCells - 获胜连线上的所有格子
 * @property {string|null} resultSummary - 游戏结果摘要
 * @property {string|null} resultType - 结果类型（如 'win', 'draw', 'forbidden'）
 * @property {string|null} resultWinnerColor - 获胜方颜色
 */

/**
 * 创建游戏选项对象，合并默认配置与用户覆盖项
 * @param {Partial<GameOptions>} [overrides={}] - 要覆盖的配置项
 * @returns {GameOptions} 合并后的完整配置对象
 */
export function createOptions(overrides = {}) {
    return {
        ...DEFAULT_OPTIONS,
        ...overrides
    };
}

/**
 * 创建空棋盘二维数组
 * @param {number} size - 棋盘边长（如 15 表示 15x15）
 * @returns {Array<Array<null>>} 全部为 null 的二维数组
 */
export function createEmptyBoard(size) {
    return Array.from({ length: size }, () => Array(size).fill(null));
}

/**
 * 创建完整的游戏状态对象
 * @param {GameOptions} options - 游戏配置项（mode、rule、size 等）
 * @returns {GameState} 初始化的游戏状态快照
 */
export function createGameState(options) {
    return {
        options: createOptions(options),
        board: createEmptyBoard(options.size),
        currentPlayer: 'black',
        gameOver: false,
        moveHistory: [],
        lastMove: null,
        hintMove: null,
        aiThinking: false,
        coachSuggestion: null,
        coachAlternatives: [],
        coachSource: 'local',
        coachLlmStatus: 'disabled',
        coachInsight: '',
        coachRisk: '',
        coachPlan: '',
        coachConfidence: null,
        coachFocus: null,
        coachFeedback: '',
        coachAnalyzedBoard: null,
        coachPreviewMode: false,
        coachPreviewBoard: null,
        selectedCell: null,
        awaitingPlacementConfirm: false,
        winningCells: [],
        resultSummary: null,
        resultType: null,
        resultWinnerColor: null
    };
}
