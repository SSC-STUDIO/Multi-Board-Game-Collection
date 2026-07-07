/** LLM Coach 服务：设置管理、API 请求、连接测�?@module services/llmCoach */

// === Constants ===
const STORAGE_KEY = 'gomoku-llm-coach-settings';
const REQUEST_TIMEOUT_MS = 12_000;
const REQUEST_TEMPERATURE = 0.2;

// === Multi-Game Coach Prompts ===
const GAME_COACH_CONFIG = {
    gomoku: {
        role: 'You are a Gomoku (Five-in-a-Row) teaching coach.',
        rules: 'Gomoku: Black moves first. Five stones in a row (horizontal, vertical, or diagonal) wins. Under Renju rules, black cannot make double-threes, double-fours, or overlines.',
        moveHint: 'Recommended and alternative moves must be legal empty intersections for the current player.',
        analyzePrefix: 'Analyze this Gomoku position for the human player.'
    },
    go: {
        role: 'You are a Go (Weiqi/Baduk) teaching coach.',
        rules: 'Go: Players alternate placing stones on intersections. Captured groups (zero liberties) are removed. Game ends with two consecutive passes. Score is territory + captures (Chinese: area scoring; Japanese: territory scoring).',
        moveHint: 'For Go, recommended move uses {row, col} for an intersection, or {pass: true} to pass. Alternatives are other viable points.',
        analyzePrefix: 'Analyze this Go position for the human player.'
    },
    chess: {
        role: 'You are an International Chess teaching coach.',
        rules: 'Chess: White moves first. Standard piece movement rules apply. Special moves: castling, en passant, pawn promotion. Checkmate wins; stalemate is a draw.',
        moveHint: 'For Chess, recommended move uses {from: {row, col}, to: {row, col}, promotion?: "Q"|"R"|"B"|"N"}. Row 0 is rank 1 (white back rank).',
        analyzePrefix: 'Analyze this Chess position for the human player.'
    },
    xiangqi: {
        role: 'You are a Chinese Chess (Xiangqi) teaching coach.',
        rules: 'Xiangqi: Red moves first. Pieces move on intersections of a 9x10 board with a river in the middle. Generals and advisors stay in the palace. Elephants cannot cross the river. Cannon captures by jumping over exactly one piece.',
        moveHint: 'For Xiangqi, recommended move uses {from: {row, col}, to: {row, col}}. Row 0 is the top edge.',
        analyzePrefix: 'Analyze this Xiangqi position for the human player.'
    },
    junqi: {
        role: 'You are a Military Chess (Junqi/Flip Chess) teaching coach.',
        rules: 'Junqi Flip: All pieces start face-down. Players flip one piece per turn to determine sides, then alternate moves. Higher rank captures lower. Bombs destroy attackers. Mines block all except engineers. Flag capture wins.',
        moveHint: 'For Junqi, recommended move uses {action: "flip"|"move", row, col, to?: {row, col}}. Flipping reveals a hidden piece.',
        analyzePrefix: 'Analyze this Junqi position for the human player.'
    }
};

const DEFAULT_SETTINGS = {
    enabled: false,
    baseUrl: '',
    model: '',
    apiKey: ''
};

/**
 * @typedef {Object} LlmCoachSettings
 * @property {boolean} enabled - 是否启用远程 LLM 教练
 * @property {string} baseUrl - OpenAI 兼容 API 基础地址
 * @property {string} model - 请求时使用的模型�?
 * @property {string} apiKey - 原始 API Key
 */

/**
 * @typedef {Object} LlmCoachRequestOptions
 * @property {LlmCoachSettings} settings - 已规范化�?LLM 设置
 * @property {Object} snapshot - 发送给模型的棋局快照
 * @property {AbortSignal} [signal] - 上层取消信号
 */

// === Obfuscation ===

/**
 * 对字符串进行简单的 XOR + Base64 混淆编码�?
 * 注意：这是轻量级混淆，并非安全加密，仅用于防止明文存储�?
 * @param {string} str - 原始字符�?
 * @returns {string} 混淆后的字符�?
 */
function obfuscate(str) {
  try {
    /* 逐字�?XOR 混淆：每个字符的 charCode 与索引取�?256 的值进行异或，
       再用 btoa 编码�?Base64，避�?localStorage 中明文存�?API Key�?*/
    return btoa(String(str).split('').map((ch, i) =>
      String.fromCharCode(ch.charCodeAt(0) ^ (i % 256))
    ).join(''));
  } catch { return str; }
}

function deobfuscate(encoded) {
  try {
    const decoded = atob(encoded);
    return decoded.split('').map((ch, i) =>
      String.fromCharCode(ch.charCodeAt(0) ^ (i % 256))
    ).join('');
  } catch { return ''; }
}

/**
 * 表示 LLM 教练配置、请求或响应解析阶段的可分类错误�?
 */
export class LlmCoachError extends Error {
    /**
     * @param {string} message - 错误说明
     * @param {string} [code='llm_error'] - 机器可读的错误码
     */
    constructor(message, code = 'llm_error') {
        super(message);
        this.name = 'LlmCoachError';
        this.code = code;
    }
}

// === Settings ===

/**
 * 从本地存储加�?LLM 教练设置，并在必要时迁移旧格式�?
 * @returns {LlmCoachSettings} 规范化后的设�?
 */
export function loadLlmCoachSettings() {
    try {
        const raw = window.localStorage?.getItem(STORAGE_KEY);
        if (!raw) {
            return { ...DEFAULT_SETTINGS };
        }

        const parsed = JSON.parse(raw);
        const settings = normalizeLlmCoachSettings(parsed);
        if (parsed._v >= 2) {
            settings.apiKey = deobfuscate(settings.apiKey);
        }
        // Legacy plaintext: re-save with obfuscation and version marker.
        if (!parsed._v) {
            saveLlmCoachSettings(settings);
        }
        return settings;
    } catch {
        return { ...DEFAULT_SETTINGS };
    }
}

/**
 * 规范化并持久�?LLM 教练设置�?
 * @param {Partial<LlmCoachSettings>} settings - 待保存的设置
 * @returns {LlmCoachSettings} 规范化后的设�?
 */
export function saveLlmCoachSettings(settings) {
    const normalized = normalizeLlmCoachSettings(settings);
    // API Key 仅做轻量混淆，目标是避免误扫到明文，不承担真正的机密保护职责�?
    const toSave = { ...normalized, _v: 2, apiKey: obfuscate(normalized.apiKey) };
    try {
        window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch {
        // Keep the in-memory settings when localStorage is unavailable.
    }

    return normalized;
}

/**
 * 将任意输入修整为完整�?LLM 教练设置对象�?
 * @param {Partial<LlmCoachSettings>} [settings={}] - 原始设置
 * @returns {LlmCoachSettings} 规范化后的设�?
 */
export function normalizeLlmCoachSettings(settings = {}) {
    return {
        enabled: Boolean(settings.enabled),
        baseUrl: String(settings.baseUrl ?? '').trim().replace(/\/+$/, ''),
        model: String(settings.model ?? '').trim(),
        apiKey: String(settings.apiKey ?? '').trim()
    };
}

/**
 * 根据当前设置返回配置状态�?
 * @param {Partial<LlmCoachSettings>} settings - 待检查的设置
 * @returns {'disabled'|'missing'|'ready'} 配置状�?
 */
export function getLlmCoachConfigStatus(settings) {
    const normalized = normalizeLlmCoachSettings(settings);
    if (!normalized.enabled) {
        return 'disabled';
    }

    if (!normalized.baseUrl || !normalized.model || !normalized.apiKey) {
        return 'missing';
    }

    return 'ready';
}

/**
 * 判断 LLM 教练配置是否完整可用�?
 * @param {Partial<LlmCoachSettings>} settings - 待检查的设置
 * @returns {boolean} 是否已具备发起请求所需的全部字�?
 */
export function isLlmCoachConfigured(settings) {
    return getLlmCoachConfigStatus(settings) === 'ready';
}

/**
 * 注册全局错误处理器，便于快速识别教练请求链路中的未捕获异常�?
 * @returns {void}
 */
export function setupGlobalErrorHandlers() {
  if (typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
      console.error('[LlmCoach] Uncaught error:', event.error?.message || event.message);
    });
    window.addEventListener('unhandledrejection', (event) => {
      console.error('[LlmCoach] Unhandled rejection:', event.reason?.message || String(event.reason));
    });
  }
}

// === API Request ===

/**
 * 请求 LLM 教练建议，并解析为结构化对象�?
 * @param {LlmCoachRequestOptions} [options={}] - 请求参数
 * @returns {Promise<Object>} 教练返回的结构化建议
 */
export async function requestLlmCoachAdvice({ settings, snapshot, signal, gameType } = {}) {
    try {
        const normalized = normalizeLlmCoachSettings(settings);
        if (!isLlmCoachConfigured(normalized)) {
            throw new LlmCoachError('LLM coach is not configured.', 'missing_config');
        }

        const request = buildChatCompletionRequest(snapshot, createBoardImageDataUrl(snapshot, gameType), normalized.model, gameType);
        const response = await fetchWithTimeout(`${normalized.baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${normalized.apiKey}`
            },
            body: JSON.stringify(request),
            signal
        });

        let payload = null;
        try {
            payload = await response.json();
        } catch {
            throw new LlmCoachError('LLM response was not valid JSON.', 'bad_response');
        }

        if (!response.ok) {
            const message = payload?.error?.message || `LLM request failed with HTTP ${response.status}.`;
            throw new LlmCoachError(message, 'http_error');
        }

        const content = extractAssistantContent(payload);
        const parsed = parseCoachJson(content);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            parsed.usage = payload?.usage || null;
        }
        return parsed;
    } catch (error) {
        if (error instanceof LlmCoachError) throw error;
        throw new LlmCoachError(error?.message || 'Unexpected LLM coach error.', 'internal_error');
    }
}

/**
 * 使用一份固定的示例棋局测试 LLM 连接配置是否可用�?
 * @param {Partial<LlmCoachSettings>} settings - 待测试的设置
 * @param {{ signal?: AbortSignal }} [options={}] - 取消选项
 * @returns {Promise<Object>} 远端返回的解析结�?
 */
/**
 * Request post-game analysis from the LLM.
 */
export async function requestPostGameAnalysis({ settings, snapshot, signal, gameType } = {}) {
    try {
        const normalized = normalizeLlmCoachSettings(settings);
        if (!isLlmCoachConfigured(normalized)) {
            throw new LlmCoachError("LLM coach is not configured.", "missing_config");
        }
        const boardImageData = createBoardImageDataUrl(snapshot, gameType);
        const request = buildPostGameRequest(snapshot, boardImageData, normalized.model, gameType);
        const response = await fetchWithTimeout(normalized.baseUrl + "/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer " + normalized.apiKey
            },
            body: JSON.stringify(request),
            signal
        });
        let payload = null;
        try {
            payload = await response.json();
        } catch {
            throw new LlmCoachError("LLM response was not valid JSON.", "bad_response");
        }
        if (!response.ok) {
            const message = (payload && payload.error && payload.error.message) || "LLM request failed with HTTP " + response.status + ".";
            throw new LlmCoachError(message, "http_error");
        }
        return extractAssistantContent(payload);
    } catch (error) {
        if (error instanceof LlmCoachError) throw error;
        throw new LlmCoachError(error.message || "Unexpected post-game analysis error.", "internal_error");
    }
}
export async function testLlmCoachConnection(settings, { signal } = {}) {
    try {
        const snapshot = {
            boardSize: 15,
            rule: 'classic',
            currentPlayer: 'black',
            playerColor: 'black',
            moveCount: 0,
            lastMove: null,
            moveHistory: [],
            localRecommendation: { row: 7, col: 7, notation: 'H8' },
            board: Array.from({ length: 15 }, () => Array(15).fill(null)),
            coordinateSystem: '0-based row and col; row increases downward; col increases to the right'
        };

        return requestLlmCoachAdvice({ settings, snapshot, signal });
    } catch (error) {
        if (error instanceof LlmCoachError) throw error;
        throw new LlmCoachError(error?.message || 'Unexpected LLM coach error.', 'internal_error');
    }
}

/**
 * 构�?OpenAI 兼容 `chat/completions` 请求体�?
 * @param {Object} snapshot - 棋局快照
 * @param {string} boardImageDataUrl - 棋盘截图 Data URL
 * @param {string} model - 目标模型�?
 * @returns {Object} 请求体对�?
 */
/**
 * Build a chat completion request for post-game analysis.
 */
const POST_GAME_ADVICE = {
    gomoku: "For Gomoku: evaluate five-in-a-row threats, Renji forbidden-move avoidance, opening theory, and mid-game attack-defend balance.",
    go: "For Go: evaluate territory vs influence, life-and-death, ko fights, and endgame scoring.",
    chess: "For Chess: evaluate material balance, king safety, pawn structure, piece activity, and tactical motifs.",
    xiangqi: "For Xiangqi: evaluate material, river-crossing advantages, palace defense, and checkmate nets.",
    junqi: "For Junqi: evaluate flag protection, rank hierarchy, railway mobility, and tactical reveals."
};

function buildPostGameRequest(snapshot, boardImageDataUrl, model, gameType) {
    const stateJson = JSON.stringify(snapshot, null, 2);
    const _advice = POST_GAME_ADVICE[gameType] || POST_GAME_ADVICE.gomoku;
    const pgConfig = (typeof GAME_COACH_CONFIG !== "undefined" && GAME_COACH_CONFIG._postGame) || {
        role: "You are an expert board game analyst.",
        analysisPrompt: "Analyze this completed game."
    };
    return {
        model,
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
            {
                role: "system",
                content: [
                    "You are an expert " + (gameType || "gomoku") + " post-game analyst.",
                    "Return only strict JSON with keys: summary, turningPoints, mistakes, strengths, improvements, rating.",
                    "All fields are strings except rating which is a number 1-10.",
                    "Analyze the full game sequence, not just the final position.",
                    _advice
                ].join(" ")
            },
            {
                role: "user",
                content: [
                    { type: "text", text: "Post-game analysis request for " + (gameType || "gomoku") + ".\nJSON game data:\n" + stateJson },
                    ...(boardImageDataUrl ? [{ type: "image_url", image_url: { url: boardImageDataUrl } }] : [])
                ]
            }
        ]
    };
}
function buildChatCompletionRequest(snapshot, boardImageDataUrl, model, gameType) {
    const stateJson = JSON.stringify(snapshot, null, 2);

    return {
        model,
        temperature: REQUEST_TEMPERATURE,
        response_format: { type: 'json_object' },
        messages: [
            {
                role: 'system',
                content: [
                    (GAME_COACH_CONFIG[gameType] || GAME_COACH_CONFIG.gomoku).role,
                    (GAME_COACH_CONFIG[gameType] || GAME_COACH_CONFIG.gomoku).rules,
                    'Return only strict JSON with keys: recommended, alternatives, reason, risk, plan, confidence.',
                    'All move coordinates must use 0-based integer row and col from the supplied board JSON.',
                    (GAME_COACH_CONFIG[gameType] || GAME_COACH_CONFIG.gomoku).moveHint,
                    'Keep reason, risk, and plan concise and useful for a human learner.'
                ].join(' ')
            },
            {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: [
                            (GAME_COACH_CONFIG[gameType] || GAME_COACH_CONFIG.gomoku).analyzePrefix,
                            'JSON board state:',
                            stateJson
                        ].join('\n')
                    },
                    {
                        type: 'image_url',
                        image_url: {
                            url: boardImageDataUrl
                        }
                    }
                ]
            }
        ]
    };
}

/**
 * 带超时与上层取消信号竞争控制�?`fetch` 包装器�?
 * @param {string} url - 请求地址
 * @param {RequestInit & { signal?: AbortSignal, timeoutMs?: number }} options - fetch 选项
 * @returns {Promise<Response>} fetch 响应
 */
export async function fetchWithTimeout(url, options) {
    const timeoutMs = Number(options?.timeoutMs) > 0 ? Number(options.timeoutMs) : REQUEST_TIMEOUT_MS;
    const timeoutController = new AbortController();
    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
        timedOut = true;
        timeoutController.abort();
    }, timeoutMs);

    const parentSignal = options.signal;
    const abortFromParent = () => timeoutController.abort();
    if (parentSignal) {
        if (parentSignal.aborted) {
            timeoutController.abort();
        } else {
            // 让超时控制器与外层控制器共享同一取消出口，避免出现“请求已取消但超时计时器仍在跑”的竞态�?
            parentSignal.addEventListener('abort', abortFromParent, { once: true });
        }
    }

    const { timeoutMs: _ignored, ...fetchOptions } = options;
    try {
        return await fetch(url, {
            ...fetchOptions,
            signal: timeoutController.signal
        });
    } catch (error) {
        if (timedOut) {
            throw new LlmCoachError('LLM request timed out.', 'timeout');
        }

        if (parentSignal?.aborted) {
            throw new LlmCoachError('LLM request was aborted.', 'aborted');
        }

        throw new LlmCoachError(error?.message || 'LLM request failed.', 'network_error');
    } finally {
        window.clearTimeout(timeoutId);
        parentSignal?.removeEventListener?.('abort', abortFromParent);
    }
}

/**
 * �?OpenAI 兼容响应中提取助手消息正文�?
 * @param {any} payload - 原始响应 JSON
 * @returns {string} 纯文本助手内�?
 */
export function extractAssistantContent(payload) {
    const message = payload?.choices?.[0]?.message;
    const content = message?.content;

    if (typeof content === 'string') {
        return content;
    }

    if (Array.isArray(content)) {
        return content
            .map((part) => {
                if (typeof part === 'string') {
                    return part;
                }

                return part?.text || '';
            })
            .join('\n')
            .trim();
    }

    throw new LlmCoachError('LLM response did not include assistant content.', 'bad_response');
}

/**
 * 将模型返回的文本解析为教�?JSON 对象�?
 * @param {string} content - 助手返回文本
 * @returns {Object} 解析后的教练数据
 */
export function parseCoachJson(content) {
    const jsonText = extractJsonObjectText(content);
    try {
        return JSON.parse(jsonText);
    } catch {
        throw new LlmCoachError('LLM coach JSON could not be parsed.', 'bad_json');
    }
}

/**
 * 从普通文本或 Markdown 代码块中截取最可能�?JSON 对象正文�?
 * @param {string} content - 原始助手文本
 * @returns {string} �?JSON 文本
 */
function extractJsonObjectText(content) {
    const trimmed = String(content || '').trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenced) {
        return fenced[1].trim();
    }

    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
        return trimmed.slice(start, end + 1);
    }

    return trimmed;
}

// === Image Generation ===

/**
 * 将棋局快照绘制�?Data URL，供多模态模型读取当前棋盘�?
 * @param {Object} snapshot - 棋局快照
 * @returns {string} PNG Data URL
 */
function createBoardImageDataUrl(snapshot, gameType) {
    const gt = gameType || 'gomoku';
    if (gt === 'chess' || gt === 'xiangqi') {
        return createGridBoardImageUrl(snapshot, gt);
    }
    return createIntersectionBoardImageUrl(snapshot, gt);
}

/**
 * Render a rectangular grid board (Chess 8x8 or Xiangqi 9x10) with piece labels.
 */
function createGridBoardImageUrl(snapshot, gameType) {
    const cols = gameType === 'xiangqi' ? 9 : 8;
    const rows = gameType === 'xiangqi' ? 10 : 8;
    const canvasSize = 768;
    const padding = 58;
    const cellW = (canvasSize - padding * 2) / cols;
    const cellH = (canvasSize - padding * 2) / rows;
    const canvas = document.createElement('canvas');
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#deb887';
    ctx.fillRect(0, 0, canvasSize, canvasSize);
    ctx.fillStyle = '#2f2419';
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.strokeStyle = 'rgba(47, 36, 25, 0.82)';
    ctx.lineWidth = 2;
    for (let r = 0; r <= rows; r++) {
        const y = padding + r * cellH;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(canvasSize - padding, y);
        ctx.stroke();
    }
    for (let col = 0; col <= cols; col++) {
        const x = padding + col * cellW;
        ctx.beginPath();
        ctx.moveTo(x, padding);
        ctx.lineTo(x, canvasSize - padding);
        ctx.stroke();
    }

    if (gameType === 'xiangqi') {
        const riverY = padding + 4.5 * cellH;
        ctx.fillStyle = '#deb887';
        ctx.fillRect(padding, riverY - cellH * 0.4, canvasSize - padding * 2, cellH * 0.8);
        ctx.fillStyle = '#2f2419';
        ctx.font = '20px sans-serif';
        ctx.fillText('\u695a \u6cb3          \u6c49 \u754c', canvasSize / 2, riverY);
    }

    if (gameType === 'chess') {
        const labels = 'ABCDEFGH';
        ctx.font = '16px sans-serif';
        for (let i = 0; i < 8; i++) {
            ctx.fillText(labels[i], padding + i * cellW + cellW / 2, padding - 25);
            ctx.fillText(labels[i], padding + i * cellW + cellW / 2, canvasSize - padding + 25);
        }
    }

    ctx.font = 'bold 22px sans-serif';
    const board = snapshot.board;
    if (board) {
        for (let r = 0; r < rows; r++) {
            for (let col = 0; col < cols; col++) {
                const cell = board[r] && board[r][col];
                if (!cell) continue;
                const x = padding + col * cellW + cellW / 2;
                const y = padding + r * cellH + cellH / 2;
                const rad = Math.min(cellW, cellH) * 0.42;
                ctx.fillStyle = cell.color === 'red' || cell.color === 'black'
                    ? 'rgba(40,40,40,0.12)' : 'rgba(255,255,255,0.12)';
                ctx.beginPath();
                ctx.arc(x, y, rad, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = cell.color === 'red' ? '#cc0000'
                    : cell.color === 'black' ? '#111' : '#fff';
                ctx.fillText(cell.symbol || cell.piece || '?', x, y);
            }
        }
    }

    if (snapshot.lastMove) {
        const x = padding + snapshot.lastMove.col * cellW + cellW / 2;
        const y = padding + snapshot.lastMove.row * cellH + cellH / 2;
        ctx.strokeStyle = '#f1c75c';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(x, y, Math.min(cellW, cellH) * 0.46, 0, Math.PI * 2);
        ctx.stroke();
    }

    return canvas.toDataURL('image/png');
}

/**
 * Render an intersection-based board (Gomoku, Go, Junqi).
 */
function createIntersectionBoardImageUrl(snapshot, gameType) {
    const size = Number(snapshot.boardSize) || 15;
    const canvasSize = 768;
    const padding = 58;
    const cell = (canvasSize - padding * 2) / Math.max(size - 1, 1);
    const canvas = document.createElement('canvas');
    canvas.width = canvasSize;
    canvas.height = canvasSize;

    const context = canvas.getContext('2d');
    context.fillStyle = '#e4b979';
    context.fillRect(0, 0, canvasSize, canvasSize);
    context.fillStyle = '#2f2419';
    context.font = '18px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    context.strokeStyle = 'rgba(47, 36, 25, 0.82)';
    context.lineWidth = 2;
    for (let index = 0; index < size; index += 1) {
        const pos = padding + index * cell;
        context.beginPath();
        context.moveTo(padding, pos);
        context.lineTo(canvasSize - padding, pos);
        context.stroke();
        context.beginPath();
        context.moveTo(pos, padding);
        context.lineTo(pos, canvasSize - padding);
        context.stroke();
        context.fillText(String(index), padding - 30, pos);
        context.fillText(String(index), pos, padding - 30);
    }

    const starPoints = getBoardImageStarPoints(size);
    context.fillStyle = 'rgba(47, 36, 25, 0.82)';
    starPoints.forEach(function (pt) {
        const x = padding + pt[1] * cell;
        const y = padding + pt[0] * cell;
        context.beginPath();
        context.arc(x, y, 5, 0, Math.PI * 2);
        context.fill();
    });

    for (let row = 0; row < size; row += 1) {
        for (let col = 0; col < size; col += 1) {
            const color = snapshot.board && snapshot.board[row] && snapshot.board[row][col];
            if (!color) continue;
            const x = padding + col * cell;
            const y = padding + row * cell;
            const radius = Math.max(11, cell * 0.36);
            const gradient = context.createRadialGradient(
                x - radius * 0.34, y - radius * 0.4, radius * 0.2, x, y, radius
            );
            if (color === 'black') {
                gradient.addColorStop(0, '#646464');
                gradient.addColorStop(1, '#080808');
            } else {
                gradient.addColorStop(0, '#ffffff');
                gradient.addColorStop(1, '#cfc7b8');
            }
            context.fillStyle = gradient;
            context.beginPath();
            context.arc(x, y, radius, 0, Math.PI * 2);
            context.fill();
            context.strokeStyle = color === 'black' ? 'rgba(0,0,0,0.55)' : 'rgba(70,58,44,0.55)';
            context.lineWidth = 2;
            context.stroke();
        }
    }

    if (snapshot.lastMove) {
        const x = padding + snapshot.lastMove.col * cell;
        const y = padding + snapshot.lastMove.row * cell;
        context.strokeStyle = '#f1c75c';
        context.lineWidth = 5;
        context.beginPath();
        context.arc(x, y, Math.max(15, cell * 0.48), 0, Math.PI * 2);
        context.stroke();
    }

    return canvas.toDataURL('image/png');
}

function getBoardImageStarPoints(size) {
    const points = size === 19 ? [3, 9, 15] : [3, 7, 11];
    return points.flatMap((row) => points.map((col) => [row, col]));
}
