/** 教练控制器：管理本地和 LLM 教练建议的获取、缓存与状态同步 @module app/controllers/CoachController */

import { getMoveGuidance } from '../../games/gomoku/ai.js';
import { isInside } from '../../utils/board.js';
import { i18n } from '../../utils/i18n.js';
import { formatMove } from '../../utils/formatters.js';
import { checkWin, getWinningLine } from '../../games/gomoku/rules.js';
import {
    getLlmCoachConfigStatus,
    isLlmCoachConfigured,
    requestLlmCoachAdvice,
requestPostGameAnalysis} from '../../services/llmCoach.js';
import { analyzeBoardImage } from '../../services/boardImageAnalyzer.js';
import { showConfirm } from '../../ui/confirmDialog.js';

const DEV_LLM_LOG_LIMIT = 50;

/**
 * 教练控制器
 * 负责在 QI 模式下提供棋局建议（本地 AI + 可选的 LLM 增强），
 * 管理 LLM 请求生命周期、建议标准化与候选棋步验证
 */
export class CoachController {
    /**
     * @param {import('../GomokuApp.js').GomokuApp} app - 应用主实例
     */
    constructor(app) {
        this.app = app;
    }

    /**
     * Detect the active game type from the DOM or app options.
     * @returns {string} Game type key (gomoku, go, chess, xiangqi, junqi)
     */
    getGameType() {
        const domGame = document.body?.dataset?.activeGame;
        if (domGame) return domGame;
        if (this.app?.options?.gameType) return this.app.options.gameType;
        return 'gomoku';
    }

    /**
     * 清除教练状态（建议、备选、来源和洞察信息）
     * @param {{ preserveFeedback?: boolean }} [options] - 是否保留反馈文本
     */
    clearCoachState({ preserveFeedback = false } = {}) {
        this.app.cancelLlmCoachRequest();
        this.app.state.coachSuggestion = null;
        this.app.state.coachAlternatives = [];
        this.app.state.coachSource = 'local';
        const configStatus = getLlmCoachConfigStatus(this.app.llmSettings);
        this.app.state.coachLlmStatus = configStatus === 'ready' ? 'local' : configStatus;
        this.app.state.coachInsight = '';
        this.app.state.coachRisk = '';
        this.app.state.coachPlan = '';
        this.app.state.coachConfidence = null;
        this.app.state.coachFocus = null;
        this.app.state.coachPreviewMode = false;
        this.app.state.coachPreviewBoard = null;
        if (!preserveFeedback) {
            this.app.state.coachFeedback = '';
        }
    }

    /**
     * 刷新教练建议：在 QI 模式下计算推荐棋步，并触发异步 LLM 请求
     * @param {boolean} [announce=false] - 是否在刷新后显示消息提示
     */
    refreshCoachGuidance(announce = false) {
        if (!this.app.isGuidedMode()) {
            this.clearCoachState();
            this.app.render();
            return;
        }

        if (this.app.state.gameOver || this.app.state.currentPlayer !== this.app.options.playerColor || this.app.state.aiThinking) {
            this.clearCoachState({ preserveFeedback: true });
            this.app.render();
            return;
        }

        // Try local AI guidance (Gomoku only); for other games, skip straight to LLM path.
        const suggestion = getMoveGuidance(this.app.state, this.app.state.currentPlayer);
        if (suggestion) {
            this.app.state.coachSuggestion = { row: suggestion.row, col: suggestion.col };
            this.app.state.coachAlternatives = this.normalizeLocalAlternatives(suggestion.alternatives || []);
            this.app.state.coachSource = 'local';
            const configStatus = getLlmCoachConfigStatus(this.app.llmSettings);
            this.app.state.coachLlmStatus = configStatus === 'ready' ? 'local' : configStatus;
            this.app.state.coachInsight = suggestion.insight;
            this.app.state.coachRisk = suggestion.risk;
            this.app.state.coachPlan = 'coachPlanLocal';
            this.app.state.coachConfidence = null;
            this.app.state.coachFocus = null;
            this.app.render();

            if (announce) {
                this.app.showMessageKey('coachSuggestedMessage', { move: formatMove(suggestion.row, suggestion.col) });
            }

            this.requestLlmCoachGuidance(suggestion);
            return;
        }

        // Non-Gomoku games: no local AI, proceed directly to LLM coaching.
        const configStatus = getLlmCoachConfigStatus(this.app.llmSettings);
        this.app.state.coachLlmStatus = configStatus === 'ready' ? 'local' : configStatus;
        this.app.state.coachSuggestion = null;
        this.app.state.coachAlternatives = [];
        this.app.state.coachSource = 'local';
        this.app.state.coachInsight = '';
        this.app.state.coachRisk = '';
        this.app.state.coachPlan = 'coachPlanLocal';
        this.app.state.coachConfidence = null;
        this.app.state.coachFocus = null;
        this.app.render();
        this.requestLlmCoachGuidance(null);
    }

    /**
     * 标准化本地备选方案：去重、合法性校验、限制数量
     * @param {Array<{row: number, col: number, reason?: string}>} alternatives - 原始备选列表
     * @returns {Array<{row: number, col: number, reason?: string}>} 标准化后的备选列表（最多3个）
     */
    normalizeLocalAlternatives(alternatives) {
        const seen = new Set();
        return alternatives
            .map((move) => this.normalizeCoachPoint(move, { reason: move.reason }))
            .filter((move) => {
                if (!move || !this.isLegalCoachMove(move.row, move.col)) {
                    return false;
                }

                const key = `${move.row},${move.col}`;
                if (seen.has(key)) {
                    return false;
                }

                seen.add(key);
                return true;
            })
            .slice(0, 3);
    }

    /**
     * 异步请求 LLM 教练增强建议（如果已配置）
     * 使用内部递增请求 ID 和局面指纹来校验响应的时效性
     * @param {{ row: number, col: number, insight?: string, risk?: string }} localSuggestion - 本地建议作为 LLM 的上下文
     */
    async requestLlmCoachGuidance(localSuggestion) {
        this.app.cancelLlmCoachRequest();
        const configStatus = getLlmCoachConfigStatus(this.app.llmSettings);
        this.app.state.coachLlmStatus = configStatus === 'ready' ? 'local' : configStatus;

        if (!isLlmCoachConfigured(this.app.llmSettings)) {
            this.app.render();
            return;
        }

        const requestId = ++this.app.llmCoachRequestId;
        const positionKey = this.getPositionKey();
        this.app.llmCoachAbortController = new AbortController();
        this.app.state.coachLlmStatus = 'loading';
        this.app.render();

        const startedAt = (typeof performance !== 'undefined' && performance.now)
            ? performance.now()
            : Date.now();

        try {
            const rawAdvice = await requestLlmCoachAdvice({
                settings: this.app.llmSettings,
                snapshot: this.createLlmCoachSnapshot(localSuggestion),
                signal: this.app.llmCoachAbortController.signal,
                gameType: this.getGameType(),
                difficulty: this.app.options?.difficulty || 'medium'
            });

            if (!this.isCurrentLlmCoachRequest(requestId, positionKey)) {
                return;
            }

            const advice = this.normalizeLlmAdvice(rawAdvice);
            if (!advice) {
                this.app.state.coachLlmStatus = 'unavailable';
                this.app.render();
                this.pushLlmRequestLog({
                    endpoint: 'coachAdvice',
                    startedAt,
                    usage: rawAdvice?.usage,
                    status: 'unavailable'
                });
                return;
            }

            this.app.state.coachSuggestion = advice.recommended;
            this.app.state.coachAlternatives = advice.alternatives;
            this.app.state.coachSource = 'llm';
            this.app.state.coachLlmStatus = 'ready';
            this.app.state.coachInsight = advice.reason || this.app.state.coachInsight;
            this.app.state.coachRisk = advice.risk || this.app.state.coachRisk;
            this.app.state.coachPlan = advice.plan || this.app.state.coachPlan;
            this.app.state.coachConfidence = advice.confidence;
            this.app.state.coachFocus = null;
            this.app.render();
            this.pushLlmRequestLog({
                endpoint: 'coachAdvice',
                startedAt,
                usage: rawAdvice?.usage,
                status: 'ok'
            });
        } catch (error) {
            if (error?.code === 'aborted' || !this.isCurrentLlmCoachRequest(requestId, positionKey)) {
                return;
            }

            this.app.state.coachLlmStatus = 'unavailable';
            this.app.render();
            const reason = error?.message || error?.code || 'unknown';
            this.app.showMessageKey('coachLlmRequestFailed', { reason });
            this.pushLlmRequestLog({
                endpoint: 'coachAdvice',
                startedAt,
                status: error?.code || 'error'
            });
        } finally {
            if (this.app.llmCoachAbortController?.signal.aborted || requestId === this.app.llmCoachRequestId) {
                this.app.llmCoachAbortController = null;
            }
        }
    }

    /** 取消当前 LLM 教练请求（递增请求 ID 并中止 AbortController） */
    cancelLlmCoachRequest() {
        this.app.llmCoachRequestId += 1;
        if (this.app.llmCoachAbortController) {
            this.app.llmCoachAbortController.abort();
            this.app.llmCoachAbortController = null;
        }
    }

    /**
     * 检查指定的 LLM 请求是否仍为当前有效请求（避免过期响应覆盖最新状态）
     * @param {number} requestId - 请求递增 ID
     * @param {string} positionKey - 局面指纹字符串
     * @returns {boolean} 是否仍是当前请求
     */
    isCurrentLlmCoachRequest(requestId, positionKey) {
        return requestId === this.app.llmCoachRequestId
            && positionKey === this.getPositionKey()
            && this.app.isGuidedMode()
            && this.app.canHumanMove()
            && !this.app.state.gameOver;
    }

    /**
     * 创建 LLM 教练请求所需的局面快照（棋盘、历史、最近建议）
     * @param {{ row: number, col: number, insight?: string, risk?: string }|null} localSuggestion - 本地建议
     * @returns {Object} 符合 LLM API 要求的局面快照对象
     */
    createLlmCoachSnapshot(localSuggestion) {
        return {
            boardSize: this.app.options.size,
            rule: this.app.options.rule,
            currentPlayer: this.app.state.currentPlayer,
            playerColor: this.app.options.playerColor,
            moveCount: this.app.state.moveHistory.length,
            lastMove: this.app.state.lastMove ? {
                row: this.app.state.lastMove.row,
                col: this.app.state.lastMove.col,
                color: this.app.state.lastMove.color,
                notation: formatMove(this.app.state.lastMove.row, this.app.state.lastMove.col)
            } : null,
            moveHistory: this.app.state.moveHistory.map((move) => ({
                index: move.index,
                row: move.row,
                col: move.col,
                color: move.color,
                notation: formatMove(move.row, move.col)
            })),
            localRecommendation: localSuggestion ? {
                row: localSuggestion.row,
                col: localSuggestion.col,
                notation: formatMove(localSuggestion.row, localSuggestion.col),
                reason: localSuggestion.insight,
                risk: localSuggestion.risk
            } : null,
            board: this.app.state.board.map((row) => [...row]),
            coordinateSystem: '0-based row and col; row increases downward; col increases to the right'
        };
    }

    /**
     * 标准化 LLM 返回的原始建议：验证推荐落子合法性，去重备选、裁剪文本
     * @param {Object} rawAdvice - LLM 原始返回的建议对象
     * @returns {{ recommended: {row:number,col:number}, alternatives: Array, reason: string, risk: string, plan: string, confidence: number|null }|null} 标准化后的建议，无效时返回 null
     */
    normalizeLlmAdvice(rawAdvice) {
        const recommended = this.normalizeCoachPoint(rawAdvice?.recommended);
        if (!recommended || !this.isLegalCoachMove(recommended.row, recommended.col)) {
            return null;
        }

        const seen = new Set([`${recommended.row},${recommended.col}`]);
        const alternatives = Array.isArray(rawAdvice?.alternatives)
            ? rawAdvice.alternatives
                .map((move) => this.normalizeCoachPoint(move, { reason: move.reason }))
                .filter((move) => {
                    if (!move || !this.isLegalCoachMove(move.row, move.col)) {
                        return false;
                    }

                    const key = `${move.row},${move.col}`;
                    if (seen.has(key)) {
                        return false;
                    }

                    seen.add(key);
                    return true;
                })
                .slice(0, 3)
            : [];

        return {
            recommended,
            alternatives,
            reason: this.normalizeCoachText(rawAdvice?.reason),
            risk: this.normalizeCoachText(rawAdvice?.risk),
            plan: this.normalizeCoachText(rawAdvice?.plan),
            confidence: this.normalizeConfidence(rawAdvice?.confidence)
        };
    }

    /**
     * 标准化单个候选棋步点：校验坐标类型，附加额外属性
     * @param {Object} point - 候选点对象
     * @param {*} point.row - 行坐标
     * @param {*} point.col - 列坐标
     * @param {Object} [extra={}] - 需要附加到结果上的额外属性
     * @returns {{row:number, col:number}|null} 标准化后的点对象，无效时返回 null
     */
    normalizeCoachPoint(point, extra = {}) {
        if (point?.row === null || point?.row === undefined || point?.col === null || point?.col === undefined) {
            return null;
        }
        const row = Number(point?.row);
        const col = Number(point?.col);
        if (!Number.isInteger(row) || !Number.isInteger(col)) {
            return null;
        }

        return {
            row,
            col,
            ...extra
        };
    }

    /**
     * 标准化文本字段：去除首尾空格，超长时截断
     * @param {string} text - 原始文本
     * @returns {string} 标准化后的文本（最长420字符）
     */
    normalizeCoachText(text) {
        const normalized = String(text ?? '').trim();
        return normalized.length > 420 ? `${normalized.slice(0, 417)}...` : normalized;
    }

    /**
     * 标准化置信度值：确保在 0-1 范围内
     * @param {*} confidence - 原始置信度值
     * @returns {number|null} 标准化后的置信度，无效时返回 null
     */
    normalizeConfidence(confidence) {
        if (confidence === null || confidence === undefined || confidence === '') {
            return null;
        }
        const value = Number(confidence);
        if (!Number.isFinite(value)) {
            return null;
        }

        return Math.max(0, Math.min(1, value));
    }

    /**
     * 检查棋步是否合法（在棋盘内、空位、非禁手）
     * @param {number} row - 行坐标
     * @param {number} col - 列坐标
     * @returns {boolean} 是否为合法的教练建议棋步
     */
    isLegalCoachMove(row, col) {
        return isInside(this.app.options.size, row, col)
            && !this.app.state.board[row][col]
            && !this.app.getForbiddenReason(row, col, this.app.state.currentPlayer);
    }

    /**
     * 生成当前局面的唯一指纹字符串（用于校验 LLM 返回的时效性）
     * @returns {string} 局面指纹（包含模式、规则、尺寸、颜色、历史）
     */
    getPositionKey() {
        return [
            this.app.options.mode,
            this.app.options.rule,
            this.app.options.size,
            this.app.options.playerColor,
            this.app.state.currentPlayer,
            this.app.state.moveHistory.map((move) => `${move.color}:${move.row},${move.col}`).join('|')
        ].join('::');
    }

    /**
     * 聚焦某个教练候选棋步并高亮显示
     * @param {number} row - 行坐标
     * @param {number} col - 列坐标
     */
    focusCoachCandidate(row, col) {
        if (!this.app.isGuidedMode() || !this.app.canHumanMove() || !this.isLegalCoachMove(row, col)) {
            this.app.sound.play('error');
            return;
        }

        this.app.state.coachFocus = { row, col };
        this.app.sound.play('select');
        this.app.render();
        this.app.showMessageKey('coachCandidateFocused', { move: formatMove(row, col) });
    }

    /**
     * 处理用户上传的棋盘图片：调用 LLM 识别棋子位置
     * @param {File} file - 用户选择的图片文件
     */
    async handleImageUpload(file) {
        if (!isLlmCoachConfigured(this.app.llmSettings)) {
            this.app.showMessageKey('llmConfigIncomplete');
            return;
        }

        this.app.cancelLlmCoachRequest();
        this.app.state.coachLlmStatus = 'analyzing-image';
        this.app.state.coachAnalyzedBoard = null;
        this.closePreviewEdit(false, { silent: true, skipRender: true });
        this.app.render();
        this.app.showMessageKey('coachAnalyzing');

        const requestId = ++this.app.llmCoachRequestId;
        this.app.llmCoachAbortController = new AbortController();
        const startedAt = (typeof performance !== 'undefined' && performance.now)
            ? performance.now()
            : Date.now();

        try {
            const result = await analyzeBoardImage({
                file,
                settings: this.app.llmSettings,
                signal: this.app.llmCoachAbortController.signal
            });

            if (requestId !== this.app.llmCoachRequestId) {
                return;
            }

            const stones = Array.isArray(result.stones) ? result.stones : [];
            this.app.state.coachAnalyzedBoard = {
                boardSize: result.boardSize || this.app.options.size,
                stones,
                currentPlayer: result.currentPlayer || 'black',
                imageDataUrl: result.imageDataUrl || null,
                confidence: this.normalizeConfidence(result.confidence)
            };

            // 仅对推荐点做坐标归一，合法性校验延后到导入完成、棋盘更新后再进行，
            // 否则会用"导入前"的棋盘去判断"导入后"的棋局建议，造成误过滤。
            if (result.recommended) {
                const rec = this.normalizeCoachPoint(result.recommended);
                if (rec) {
                    this.app.state.coachSuggestion = rec;
                }
            }
            if (Array.isArray(result.alternatives)) {
                this.app.state.coachAlternatives = result.alternatives
                    .map((move) => this.normalizeCoachPoint(move, { reason: move?.reason }))
                    .filter((move) => move !== null)
                    .slice(0, 3);
            }
            if (result.reason) {
                this.app.state.coachInsight = this.normalizeCoachText(result.reason);
            }
            if (result.risk) {
                this.app.state.coachRisk = this.normalizeCoachText(result.risk);
            }
            if (result.plan) {
                this.app.state.coachPlan = this.normalizeCoachText(result.plan);
            }
            this.app.state.coachConfidence = this.normalizeConfidence(result.confidence);
            this.app.state.coachSource = 'llm';
            this.app.state.coachLlmStatus = 'ready';
            this.app.render();
            this.app.showMessageKey('coachAnalyzeSuccess', { count: stones.length });
            this.pushLlmRequestLog({
                endpoint: 'analyzeImage',
                startedAt,
                usage: result.usage,
                status: 'ok'
            });
        } catch (error) {
            if (error?.code === 'aborted' || requestId !== this.app.llmCoachRequestId) {
                return;
            }
            this.app.state.coachLlmStatus = 'unavailable';
            this.app.state.coachAnalyzedBoard = null;
            this.app.render();
            this.app.showMessageKey('coachAnalyzeFailed');
            this.pushLlmRequestLog({
                endpoint: 'analyzeImage',
                startedAt,
                status: error?.code || 'error'
            });
        } finally {
            if (this.app.llmCoachAbortController?.signal.aborted || requestId === this.app.llmCoachRequestId) {
                this.app.llmCoachAbortController = null;
            }
        }
    }

    /**
     * 取消正在进行的棋盘识别请求。
     */
    cancelImageAnalysis() {
        this.app.cancelLlmCoachRequest();
        if (this.app.state.coachLlmStatus === 'analyzing-image') {
            const configStatus = getLlmCoachConfigStatus(this.app.llmSettings);
            this.app.state.coachLlmStatus = configStatus === 'ready' ? 'local' : configStatus;
        }
        this.app.render();
        this.app.showMessageKey?.('coachAnalyzeCanceled');
    }

    /**
     * 记录一条 LLM 请求日志，供开发者面板读取。内部处理 startedAt/usage 归一。
     * @param {{
     *   endpoint: string,
     *   startedAt?: number,
     *   durationMs?: number,
     *   usage?: Object|null,
     *   tokensIn?: number,
     *   tokensOut?: number,
     *   status?: string
     * }} entry - 日志条目
     */
    pushLlmRequestLog(entry = {}) {
        if (typeof window === 'undefined') return;
        const now = (typeof performance !== 'undefined' && performance.now)
            ? performance.now()
            : Date.now();
        const durationMs = Number.isFinite(entry.durationMs)
            ? entry.durationMs
            : (Number.isFinite(entry.startedAt) ? now - entry.startedAt : null);
        const usage = entry.usage && typeof entry.usage === 'object' ? entry.usage : null;
        const tokensIn = Number.isFinite(entry.tokensIn)
            ? entry.tokensIn
            : (usage ? Number(usage.prompt_tokens ?? usage.input_tokens) : NaN);
        const tokensOut = Number.isFinite(entry.tokensOut)
            ? entry.tokensOut
            : (usage ? Number(usage.completion_tokens ?? usage.output_tokens) : NaN);
        const log = {
            endpoint: entry.endpoint || 'unknown',
            durationMs: Number.isFinite(durationMs) ? durationMs : null,
            tokensIn: Number.isFinite(tokensIn) ? tokensIn : null,
            tokensOut: Number.isFinite(tokensOut) ? tokensOut : null,
            status: entry.status || 'ok',
            at: Date.now()
        };
        if (!Array.isArray(window.__llmRequestLog)) {
            window.__llmRequestLog = [];
        }
        window.__llmRequestLog.push(log);
        if (window.__llmRequestLog.length > DEV_LLM_LOG_LIMIT) {
            window.__llmRequestLog.splice(0, window.__llmRequestLog.length - DEV_LLM_LOG_LIMIT);
        }
    }

    /**
     * 进入预览编辑模式：把 coachAnalyzedBoard.stones 转成二维数组并展示覆盖层。
     */
    openPreviewEdit() {
        const analyzed = this.app.state.coachAnalyzedBoard;
        if (!analyzed || !Array.isArray(analyzed.stones)) {
            return;
        }
        const size = Number(analyzed.boardSize) || this.app.options.size;
        const cells = Array.from({ length: size }, () => Array(size).fill(null));
        analyzed.stones.forEach((stone) => {
            const row = Number(stone?.row);
            const col = Number(stone?.col);
            const color = stone?.color;
            if (!Number.isInteger(row) || !Number.isInteger(col)) return;
            if (row < 0 || row >= size || col < 0 || col >= size) return;
            if (color !== 'black' && color !== 'white') return;
            cells[row][col] = color;
        });
        this.app.state.coachPreviewBoard = { size, cells };
        this.app.state.coachPreviewMode = true;
        this.app.state.coachFocus = null;
        this.app.sound?.play?.('uiTap');
        this.app.render();
    }

    /**
     * 循环切换一个预览格子的颜色：空 → 黑 → 白 → 空。
     * @param {number} row - 行坐标
     * @param {number} col - 列坐标
     */
    togglePreviewCell(row, col) {
        const preview = this.app.state.coachPreviewBoard;
        if (!this.app.state.coachPreviewMode || !preview) return;
        const size = preview.size;
        if (!Number.isInteger(row) || !Number.isInteger(col)) return;
        if (row < 0 || row >= size || col < 0 || col >= size) return;
        const current = preview.cells[row][col];
        const next = current === null ? 'black' : current === 'black' ? 'white' : null;
        preview.cells[row][col] = next;
        this.app.sound?.play?.('select');
        this.app.render();
    }

    /**
     * 关闭预览编辑模式。
     * @param {boolean} commit - 是否将预览修改写回 coachAnalyzedBoard 并触发导入
     * @param {{ silent?: boolean, skipRender?: boolean }} [options]
     */
    closePreviewEdit(commit, { silent = false, skipRender = false } = {}) {
        const preview = this.app.state.coachPreviewBoard;
        const wasOpen = this.app.state.coachPreviewMode;
        if (commit && preview && this.app.state.coachAnalyzedBoard) {
            const stones = [];
            for (let r = 0; r < preview.size; r += 1) {
                for (let c = 0; c < preview.size; c += 1) {
                    const color = preview.cells[r][c];
                    if (color === 'black' || color === 'white') {
                        stones.push({ row: r, col: c, color });
                    }
                }
            }
            this.app.state.coachAnalyzedBoard = {
                ...this.app.state.coachAnalyzedBoard,
                boardSize: preview.size,
                stones
            };
        }
        this.app.state.coachPreviewMode = false;
        this.app.state.coachPreviewBoard = null;
        if (!skipRender && wasOpen) {
            this.app.render();
        }
        if (commit && !silent) {
            return this.importAnalyzedBoard();
        }
        return Promise.resolve();
    }

    /**
     * 将 LLM 识别出的棋局导入到当前棋盘
     * 落子顺序策略：优先保留 LLM 返回的 stones 数组原顺序；若数量满足严格交替，则按黑白次序重排；
     * 否则按"黑/白差额"推断（差 1 则多出方的最后一枚视为 lastMove）。
     */
    async importAnalyzedBoard() {
        const analyzed = this.app.state.coachAnalyzedBoard;
        if (!analyzed || !Array.isArray(analyzed.stones) || analyzed.stones.length === 0) {
            return;
        }

        const confirmed = await showConfirm({
            title: i18n.t('coachConfirmTitle'),
            message: i18n.t('coachImportConfirm'),
            confirmLabel: i18n.t('coachConfirmOk'),
            cancelLabel: i18n.t('coachConfirmCancel')
        });
        if (!confirmed) {
            return;
        }

        const size = analyzed.boardSize || this.app.options.size;
        const pendingSuggestion = this.app.state.coachSuggestion;
        const pendingAlternatives = Array.isArray(this.app.state.coachAlternatives)
            ? this.app.state.coachAlternatives
            : [];

        // 如果棋盘尺寸不匹配，重开一局对齐
        if (!this.app.state.board || this.app.state.board.length !== size) {
            this.app.startGame({ size, mode: 'qi', rule: this.app.options.rule });
        }

        // 清空棋盘与相关交互态
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                this.app.state.board[r][c] = null;
            }
        }
        this.app.state.moveHistory = [];
        this.app.state.lastMove = null;
        this.app.state.gameOver = false;
        this.app.state.winningCells = [];
        this.app.state.resultSummary = null;
        this.app.state.resultType = null;
        this.app.state.resultWinnerColor = null;
        this.app.state.hintMove = null;
        this.app.state.selectedCell = null;
        this.app.state.awaitingPlacementConfirm = false;
        this.app.state.coachFocus = null;

        // 按棋局合法性最大程度保留顺序
        const ordered = this.orderImportedStones(analyzed.stones);

        let placed = 0;
        ordered.forEach((stone) => {
            const { row, col, color } = stone;
            if (!Number.isInteger(row) || !Number.isInteger(col)) return;
            if (row < 0 || row >= size || col < 0 || col >= size) return;
            if (color !== 'black' && color !== 'white') return;
            if (this.app.state.board[row][col]) return;

            this.app.state.board[row][col] = color;
            const move = { row, col, color, index: placed };
            this.app.state.moveHistory.push(move);
            this.app.state.lastMove = move;
            placed += 1;
        });

        // 推断当前落子方：优先使用 LLM 结果，否则由棋子数推断
        const blackCount = this.app.state.moveHistory.filter((m) => m.color === 'black').length;
        const whiteCount = this.app.state.moveHistory.filter((m) => m.color === 'white').length;
        const inferredNext = blackCount > whiteCount ? 'white' : 'black';
        this.app.state.currentPlayer = (analyzed.currentPlayer === 'black' || analyzed.currentPlayer === 'white')
            ? analyzed.currentPlayer
            : inferredNext;

        // 检查导入后是否已经是终局（最后一手连五）
        const last = this.app.state.lastMove;
        if (last && checkWin(this.app.state.board, size, last.row, last.col, last.color)) {
            this.app.state.gameOver = true;
            this.app.state.winningCells = getWinningLine(this.app.state.board, size, last.row, last.col, last.color);
            this.app.state.resultType = 'win';
            this.app.state.resultWinnerColor = last.color;
        }

        this.app.state.coachAnalyzedBoard = null;
        this.app.render();
        this.app.showMessageKey('coachImportSuccess', { count: this.app.state.moveHistory.length });

        // 导入后再校验 LLM 之前给出的推荐是否在新棋盘上合法
        if (!this.app.state.gameOver && pendingSuggestion) {
            if (this.isLegalCoachMove(pendingSuggestion.row, pendingSuggestion.col)) {
                this.app.state.coachSuggestion = { row: pendingSuggestion.row, col: pendingSuggestion.col };
                this.app.state.coachAlternatives = this.normalizeLocalAlternatives(pendingAlternatives);
                this.app.render();
                return;
            }
        }

        // 否则请求本地/LLM 重新分析
        this.refreshCoachGuidance();
    }

    /**
     * 对 LLM 返回的 stones 做顺序归一：若能形成严格黑白交替则按交替排；否则保留原顺序。
     * 当黑/白数量差 ≥ 2 或相等时，保留原顺序最稳妥——某些棋局（例如只有黑棋）也能如实显示。
     * @param {Array<{row:number,col:number,color:string}>} stones
     * @returns {Array<{row:number,col:number,color:string}>}
     */
    orderImportedStones(stones) {
        const blacks = stones.filter((s) => s.color === 'black');
        const whites = stones.filter((s) => s.color === 'white');
        const diff = blacks.length - whites.length;
        // 黑多 0 或 1：标准 Gomoku 局面 → 黑白交替
        if (diff === 0 || diff === 1) {
            const ordered = [];
            for (let i = 0; i < Math.max(blacks.length, whites.length); i += 1) {
                if (i < blacks.length) ordered.push(blacks[i]);
                if (i < whites.length) ordered.push(whites[i]);
            }
            return ordered;
        }
        return [...stones];
    }

    /**
     * Request post-game analysis from the LLM Coach.
     */
    async requestPostGameReview() {
        if (!isLlmCoachConfigured(this.app.llmSettings)) {
            this.app.state.coachPostGame = 'unavailable';
            this.app.render();
            return;
        }
        this.app.state.coachPostGame = 'loading';
        this.app.render();
        try {
            const snapshot = {
                boardSize: this.app.options.size,
                board: this.app.state.board,
                moveHistory: this.app.state.moveHistory,
                currentPlayer: this.app.state.currentPlayer,
                lastMove: this.app.state.lastMove,
                resultType: this.app.state.resultType,
                resultWinnerColor: this.app.state.resultWinnerColor,
                gameOver: this.app.state.gameOver,
                coordinateSystem: '0-based row and col'
            };
            const rawContent = await requestPostGameAnalysis({
                settings: this.app.llmSettings,
                snapshot,
                signal: this.app.llmCoachAbortController ? this.app.llmCoachAbortController.signal : undefined,
                gameType: this.getGameType()
            });
            let analysis;
            try {
                analysis = typeof rawContent === 'string' ? JSON.parse(rawContent) : rawContent;
            } catch {
                analysis = { summary: rawContent };
            }
            this.app.state.coachPostGame = 'ready';
            this.app.state.coachPostGameData = analysis;
            this.app.render();
        } catch (error) {
            if (error && error.code === 'aborted') return;
            this.app.state.coachPostGame = 'error';
            this.app.state.coachPostGameData = null;
            this.app.render();
            const reason = (error && error.message) || 'unknown';
            this.app.showMessageKey('coachLlmRequestFailed', { reason: reason });
        }
    }
}