/** 棋盘图片识别服务：上传图片 → LLM 识别棋子位置 → 返回结构化棋局数据 @module services/boardImageAnalyzer */

import {
    LlmCoachError,
    fetchWithTimeout,
    extractAssistantContent,
    parseCoachJson,
    normalizeLlmCoachSettings,
    isLlmCoachConfigured
} from './llmCoach.js';

const IMAGE_ANALYZE_TIMEOUT_MS = 60_000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB upload cap
const COMPRESS_MAX_EDGE = 1280;           // 压缩到长边 1280px
const COMPRESS_MIME = 'image/jpeg';
const COMPRESS_QUALITY = 0.85;

/**
 * 校验用户上传的文件是否合法，并在需要时压缩为 jpeg Data URL。
 * @param {File} file - 用户选择的图片文件
 * @returns {Promise<string>} Data URL
 */
export async function fileToDataUrl(file) {
    if (!file || !file.type?.startsWith('image/')) {
        throw new LlmCoachError('Unsupported file type.', 'file_error');
    }

    if (file.size > MAX_IMAGE_BYTES) {
        throw new LlmCoachError('Image exceeds 8MB limit.', 'file_too_large');
    }

    const rawDataUrl = await readFileAsDataUrl(file);
    try {
        return await compressDataUrl(rawDataUrl);
    } catch {
        // 压缩失败时（如 GIF/SVG）回退到原始 Data URL。
        return rawDataUrl;
    }
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new LlmCoachError('Failed to read image file.', 'file_error'));
        reader.readAsDataURL(file);
    });
}

function compressDataUrl(dataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            try {
                const scale = Math.min(1, COMPRESS_MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
                const width = Math.max(1, Math.round(img.naturalWidth * scale));
                const height = Math.max(1, Math.round(img.naturalHeight * scale));
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL(COMPRESS_MIME, COMPRESS_QUALITY));
            } catch (error) {
                reject(error);
            }
        };
        img.onerror = () => reject(new Error('Failed to decode image for compression.'));
        img.src = dataUrl;
    });
}

/**
 * 构造棋盘识别专用的 LLM 请求体
 * @param {string} imageDataUrl - 图片 base64 Data URL
 * @param {string} model - 模型名称
 * @returns {Object} OpenAI 兼容请求体
 */
function buildBoardAnalysisRequest(imageDataUrl, model) {
    return {
        model,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
            {
                role: 'system',
                content: [
                    'You are a Gomoku board recognition and coaching AI.',
                    'Analyze the board image and return strict JSON with these keys:',
                    'boardSize (integer, typically 15 or 19),',
                    'stones (array of {row, col, color} where row/col are 0-based integers and color is "black" or "white"),',
                    'currentPlayer ("black" or "white" — infer from stone count),',
                    'recommended ({row, col} — your best next move suggestion),',
                    'alternatives (array of up to 3 {row, col, reason}),',
                    'reason (string — why recommended is best),',
                    'risk (string — what happens if ignored),',
                    'plan (string — strategic direction),',
                    'confidence (number 0-1 — how confident you are in the recognition).',
                    'All coordinates are 0-based: row increases downward, col increases to the right.'
                ].join(' ')
            },
            {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: 'Identify all stones on this Gomoku board image. Return the board state and your move recommendation.'
                    },
                    {
                        type: 'image_url',
                        image_url: { url: imageDataUrl }
                    }
                ]
            }
        ]
    };
}

/**
 * 分析棋盘图片：发送给 LLM 识别棋子位置并返回结构化数据
 * @param {Object} options
 * @param {File} options.file - 用户上传的图片文件
 * @param {Object} options.settings - LLM 设置
 * @param {AbortSignal} [options.signal] - 取消信号
 * @returns {Promise<Object>} 识别结果 { boardSize, stones, currentPlayer, recommended, alternatives, reason, risk, plan, confidence }
 */
export async function analyzeBoardImage({ file, settings, signal } = {}) {
    const normalized = normalizeLlmCoachSettings(settings);
    if (!isLlmCoachConfigured(normalized)) {
        throw new LlmCoachError('LLM coach is not configured.', 'missing_config');
    }

    const imageDataUrl = await fileToDataUrl(file);
    const request = buildBoardAnalysisRequest(imageDataUrl, normalized.model);

    const response = await fetchWithTimeout(`${normalized.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${normalized.apiKey}`
        },
        body: JSON.stringify(request),
        signal,
        timeoutMs: IMAGE_ANALYZE_TIMEOUT_MS
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
    return {
        ...parsed,
        imageDataUrl,
        usage: payload?.usage || null
    };
}
