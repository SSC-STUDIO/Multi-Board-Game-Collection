/** LLM Coach 服务：设置管理、API 请求、连接测试 @module services/llmCoach */

// === Constants ===
const STORAGE_KEY = 'gomoku-llm-coach-settings';
const REQUEST_TIMEOUT_MS = 12_000;
const REQUEST_TEMPERATURE = 0.2;

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
 * @property {string} model - 请求时使用的模型名
 * @property {string} apiKey - 原始 API Key
 */

/**
 * @typedef {Object} LlmCoachRequestOptions
 * @property {LlmCoachSettings} settings - 已规范化的 LLM 设置
 * @property {Object} snapshot - 发送给模型的棋局快照
 * @property {AbortSignal} [signal] - 上层取消信号
 */

// === Obfuscation ===

/**
 * 对字符串进行简单的 XOR + Base64 混淆编码。
 * 注意：这是轻量级混淆，并非安全加密，仅用于防止明文存储。
 * @param {string} str - 原始字符串
 * @returns {string} 混淆后的字符串
 */
function obfuscate(str) {
  try {
    /* 逐字节 XOR 混淆：每个字符的 charCode 与索引取模 256 的值进行异或，
       再用 btoa 编码为 Base64，避免 localStorage 中明文存储 API Key。 */
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
 * 表示 LLM 教练配置、请求或响应解析阶段的可分类错误。
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
 * 从本地存储加载 LLM 教练设置，并在必要时迁移旧格式。
 * @returns {LlmCoachSettings} 规范化后的设置
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
 * 规范化并持久化 LLM 教练设置。
 * @param {Partial<LlmCoachSettings>} settings - 待保存的设置
 * @returns {LlmCoachSettings} 规范化后的设置
 */
export function saveLlmCoachSettings(settings) {
    const normalized = normalizeLlmCoachSettings(settings);
    // API Key 仅做轻量混淆，目标是避免误扫到明文，不承担真正的机密保护职责。
    const toSave = { ...normalized, _v: 2, apiKey: obfuscate(normalized.apiKey) };
    try {
        window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch {
        // Keep the in-memory settings when localStorage is unavailable.
    }

    return normalized;
}

/**
 * 将任意输入修整为完整的 LLM 教练设置对象。
 * @param {Partial<LlmCoachSettings>} [settings={}] - 原始设置
 * @returns {LlmCoachSettings} 规范化后的设置
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
 * 根据当前设置返回配置状态。
 * @param {Partial<LlmCoachSettings>} settings - 待检查的设置
 * @returns {'disabled'|'missing'|'ready'} 配置状态
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
 * 判断 LLM 教练配置是否完整可用。
 * @param {Partial<LlmCoachSettings>} settings - 待检查的设置
 * @returns {boolean} 是否已具备发起请求所需的全部字段
 */
export function isLlmCoachConfigured(settings) {
    return getLlmCoachConfigStatus(settings) === 'ready';
}

/**
 * 注册全局错误处理器，便于快速识别教练请求链路中的未捕获异常。
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
 * 请求 LLM 教练建议，并解析为结构化对象。
 * @param {LlmCoachRequestOptions} [options={}] - 请求参数
 * @returns {Promise<Object>} 教练返回的结构化建议
 */
export async function requestLlmCoachAdvice({ settings, snapshot, signal } = {}) {
    try {
        const normalized = normalizeLlmCoachSettings(settings);
        if (!isLlmCoachConfigured(normalized)) {
            throw new LlmCoachError('LLM coach is not configured.', 'missing_config');
        }

        const request = buildChatCompletionRequest(snapshot, createBoardImageDataUrl(snapshot), normalized.model);
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
 * 使用一份固定的示例棋局测试 LLM 连接配置是否可用。
 * @param {Partial<LlmCoachSettings>} settings - 待测试的设置
 * @param {{ signal?: AbortSignal }} [options={}] - 取消选项
 * @returns {Promise<Object>} 远端返回的解析结果
 */
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
 * 构造 OpenAI 兼容 `chat/completions` 请求体。
 * @param {Object} snapshot - 棋局快照
 * @param {string} boardImageDataUrl - 棋盘截图 Data URL
 * @param {string} model - 目标模型名
 * @returns {Object} 请求体对象
 */
function buildChatCompletionRequest(snapshot, boardImageDataUrl, model) {
    const stateJson = JSON.stringify(snapshot, null, 2);

    return {
        model,
        temperature: REQUEST_TEMPERATURE,
        response_format: { type: 'json_object' },
        messages: [
            {
                role: 'system',
                content: [
                    'You are a Gomoku teaching coach.',
                    'Return only strict JSON with keys: recommended, alternatives, reason, risk, plan, confidence.',
                    'All move coordinates must use 0-based integer row and col from the supplied board JSON.',
                    'Recommended and alternative moves must be legal empty points for the current player.',
                    'Keep reason, risk, and plan concise and useful for a human learner.'
                ].join(' ')
            },
            {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: [
                            'Analyze this Gomoku position for the human player.',
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
 * 带超时与上层取消信号竞争控制的 `fetch` 包装器。
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
            // 让超时控制器与外层控制器共享同一取消出口，避免出现“请求已取消但超时计时器仍在跑”的竞态。
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
 * 从 OpenAI 兼容响应中提取助手消息正文。
 * @param {any} payload - 原始响应 JSON
 * @returns {string} 纯文本助手内容
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
 * 将模型返回的文本解析为教练 JSON 对象。
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
 * 从普通文本或 Markdown 代码块中截取最可能的 JSON 对象正文。
 * @param {string} content - 原始助手文本
 * @returns {string} 纯 JSON 文本
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
 * 将棋局快照绘制为 Data URL，供多模态模型读取当前棋盘。
 * @param {Object} snapshot - 棋局快照
 * @returns {string} PNG Data URL
 */
function createBoardImageDataUrl(snapshot) {
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
    starPoints.forEach(([row, col]) => {
        const x = padding + col * cell;
        const y = padding + row * cell;
        context.beginPath();
        context.arc(x, y, 5, 0, Math.PI * 2);
        context.fill();
    });

    for (let row = 0; row < size; row += 1) {
        for (let col = 0; col < size; col += 1) {
            const color = snapshot.board?.[row]?.[col];
            if (!color) {
                continue;
            }

            const x = padding + col * cell;
            const y = padding + row * cell;
            const radius = Math.max(11, cell * 0.36);
            const gradient = context.createRadialGradient(
                x - radius * 0.34,
                y - radius * 0.4,
                radius * 0.2,
                x,
                y,
                radius
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

/**
 * 返回用于棋盘渲染图的星位坐标。
 * @param {number} size - 棋盘尺寸
 * @returns {Array<[number, number]>} 星位行列坐标
 */
function getBoardImageStarPoints(size) {
    const points = size === 19 ? [3, 9, 15] : [3, 7, 11];
    return points.flatMap((row) => points.map((col) => [row, col]));
}
