const STORAGE_KEY = 'gomoku-llm-coach-settings';
const REQUEST_TIMEOUT_MS = 12_000;
const REQUEST_TEMPERATURE = 0.2;

const DEFAULT_SETTINGS = {
    enabled: false,
    baseUrl: '',
    model: '',
    apiKey: ''
};

export class LlmCoachError extends Error {
    constructor(message, code = 'llm_error') {
        super(message);
        this.name = 'LlmCoachError';
        this.code = code;
    }
}

export function loadLlmCoachSettings() {
    try {
        const raw = window.localStorage?.getItem(STORAGE_KEY);
        if (!raw) {
            return { ...DEFAULT_SETTINGS };
        }

        return normalizeLlmCoachSettings(JSON.parse(raw));
    } catch {
        return { ...DEFAULT_SETTINGS };
    }
}

export function saveLlmCoachSettings(settings) {
    const normalized = normalizeLlmCoachSettings(settings);
    try {
        window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(normalized));
    } catch {
        // Keep the in-memory settings when localStorage is unavailable.
    }

    return normalized;
}

export function normalizeLlmCoachSettings(settings = {}) {
    return {
        enabled: Boolean(settings.enabled),
        baseUrl: String(settings.baseUrl ?? '').trim().replace(/\/+$/, ''),
        model: String(settings.model ?? '').trim(),
        apiKey: String(settings.apiKey ?? '').trim()
    };
}

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

export function isLlmCoachConfigured(settings) {
    return getLlmCoachConfigStatus(settings) === 'ready';
}

export async function requestLlmCoachAdvice({ settings, snapshot, signal } = {}) {
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
    return parseCoachJson(content);
}

export async function testLlmCoachConnection(settings, { signal } = {}) {
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
}

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

async function fetchWithTimeout(url, options) {
    const timeoutController = new AbortController();
    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
        timedOut = true;
        timeoutController.abort();
    }, REQUEST_TIMEOUT_MS);

    const parentSignal = options.signal;
    const abortFromParent = () => timeoutController.abort();
    if (parentSignal) {
        if (parentSignal.aborted) {
            timeoutController.abort();
        } else {
            parentSignal.addEventListener('abort', abortFromParent, { once: true });
        }
    }

    try {
        return await fetch(url, {
            ...options,
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

function extractAssistantContent(payload) {
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

function parseCoachJson(content) {
    const jsonText = extractJsonObjectText(content);
    try {
        return JSON.parse(jsonText);
    } catch {
        throw new LlmCoachError('LLM coach JSON could not be parsed.', 'bad_json');
    }
}

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

function getBoardImageStarPoints(size) {
    const points = size === 19 ? [3, 9, 15] : [3, 7, 11];
    return points.flatMap((row) => points.map((col) => [row, col]));
}
