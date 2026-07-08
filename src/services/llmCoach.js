/** LLM Coach 鏈嶅姟锛氳缃鐞嗐€丄PI 璇锋眰銆佽繛鎺ユ祴锟?@module services/llmCoach */

// === Constants ===
const STORAGE_KEY = 'gomoku-llm-coach-settings';
const REQUEST_TIMEOUT_MS = 12_000;
const REQUEST_TEMPERATURE = 0.2;
const DIFFICULTY_CONFIG = {
    easy: {
        hint: 'Explain like you are teaching a beginner. Use simple language, explain basic concepts, and focus on fundamental strategies.',
        maxAlternatives: 1
    },
    medium: {
        hint: 'Provide intermediate-level advice. Assume the player knows basic rules. Focus on tactical patterns and positional understanding.',
        maxAlternatives: 2
    },
    hard: {
        hint: 'Provide advanced competitive analysis. Focus on deep reading, opponent weaknesses, and optimal play. Be concise and precise.',
        maxAlternatives: 3
    }
};

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
    },
    othello: {
        role: 'You are an Othello (Reversi) teaching coach.',
        rules: 'Othello: 8x8 board. Black moves first. A move places a disc on an empty square and must bracket one or more opponent discs in a straight line; all bracketed discs flip to the current player color. If a player has no legal move, they pass. Game ends when neither player can move. Player with the most discs wins. Corners are the most valuable squares; X-squares and C-squares next to corners are dangerous.',
        moveHint: 'For Othello, recommended move uses {row, col} for an empty square that legally flips at least one opponent disc. Alternatives are other high-value legal moves, prioritizing corners and edges.',
        analyzePrefix: 'Analyze this Othello position for the human player.'
    },
    shogi: {
        role: 'You are a Shogi (Japanese Chess) teaching coach.',
        rules: 'Shogi: 9x9 board. Sente (first player) moves first. Pieces are captured and may be dropped back onto empty squares (drops are unique to Shogi). Promotion applies in the last three ranks; a moved piece may promote unless it is a King or Gold. Promoted pieces gain new movement. Checkmate of the king wins; the TwoPawn (doubling unpromoted pawns on a file) and similar illegal drop rules apply.',
        moveHint: 'For Shogi, recommended move uses {from: {row, col}, to: {row, col}, promote?: true|false} for a board move, or {drop: true, type, to: {row, col}} to drop a captured piece. Row 0 is the far side (Gote back rank), row 8 is Sente back rank.',
        analyzePrefix: 'Analyze this Shogi position for the human player.'
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
 * @property {boolean} enabled - 鏄惁鍚敤杩滅▼ LLM 鏁欑粌
 * @property {string} baseUrl - OpenAI 鍏煎 API 鍩虹鍦板潃
 * @property {string} model - 璇锋眰鏃朵娇鐢ㄧ殑妯″瀷锟?
 * @property {string} apiKey - 鍘熷 API Key
 */

/**
 * @typedef {Object} LlmCoachRequestOptions
 * @property {LlmCoachSettings} settings - 宸茶鑼冨寲锟?LLM 璁剧疆
 * @property {Object} snapshot - 鍙戦€佺粰妯″瀷鐨勬灞€蹇収
 * @property {AbortSignal} [signal] - 涓婂眰鍙栨秷淇″彿
 */

// === Obfuscation ===

/**
 * 瀵瑰瓧绗︿覆杩涜绠€鍗曠殑 XOR + Base64 娣锋穯缂栫爜锟?
 * 娉ㄦ剰锛氳繖鏄交閲忕骇娣锋穯锛屽苟闈炲畨鍏ㄥ姞瀵嗭紝浠呯敤浜庨槻姝㈡槑鏂囧瓨鍌拷?
 * @param {string} str - 鍘熷瀛楃锟?
 * @returns {string} 娣锋穯鍚庣殑瀛楃锟?
 */
function obfuscate(str) {
  try {
    /* 閫愬瓧锟?XOR 娣锋穯锛氭瘡涓瓧绗︾殑 charCode 涓庣储寮曞彇锟?256 鐨勫€艰繘琛屽紓鎴栵紝
       鍐嶇敤 btoa 缂栫爜锟?Base64锛岄伩锟?localStorage 涓槑鏂囧瓨锟?API Key锟?*/
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
 * 琛ㄧず LLM 鏁欑粌閰嶇疆銆佽姹傛垨鍝嶅簲瑙ｆ瀽闃舵鐨勫彲鍒嗙被閿欒锟?
 */
export class LlmCoachError extends Error {
    /**
     * @param {string} message - 閿欒璇存槑
     * @param {string} [code='llm_error'] - 鏈哄櫒鍙鐨勯敊璇爜
     */
    constructor(message, code = 'llm_error') {
        super(message);
        this.name = 'LlmCoachError';
        this.code = code;
    }
}

// === Settings ===

/**
 * 浠庢湰鍦板瓨鍌ㄥ姞锟?LLM 鏁欑粌璁剧疆锛屽苟鍦ㄥ繀瑕佹椂杩佺Щ鏃ф牸寮忥拷?
 * @returns {LlmCoachSettings} 瑙勮寖鍖栧悗鐨勮锟?
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
 * 瑙勮寖鍖栧苟鎸佷箙锟?LLM 鏁欑粌璁剧疆锟?
 * @param {Partial<LlmCoachSettings>} settings - 寰呬繚瀛樼殑璁剧疆
 * @returns {LlmCoachSettings} 瑙勮寖鍖栧悗鐨勮锟?
 */
export function saveLlmCoachSettings(settings) {
    const normalized = normalizeLlmCoachSettings(settings);
    // API Key 浠呭仛杞婚噺娣锋穯锛岀洰鏍囨槸閬垮厤璇壂鍒版槑鏂囷紝涓嶆壙鎷呯湡姝ｇ殑鏈哄瘑淇濇姢鑱岃矗锟?
    const toSave = { ...normalized, _v: 2, apiKey: obfuscate(normalized.apiKey) };
    try {
        window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch {
        // Keep the in-memory settings when localStorage is unavailable.
    }

    return normalized;
}

/**
 * 灏嗕换鎰忚緭鍏ヤ慨鏁翠负瀹屾暣锟?LLM 鏁欑粌璁剧疆瀵硅薄锟?
 * @param {Partial<LlmCoachSettings>} [settings={}] - 鍘熷璁剧疆
 * @returns {LlmCoachSettings} 瑙勮寖鍖栧悗鐨勮锟?
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
 * 鏍规嵁褰撳墠璁剧疆杩斿洖閰嶇疆鐘舵€侊拷?
 * @param {Partial<LlmCoachSettings>} settings - 寰呮鏌ョ殑璁剧疆
 * @returns {'disabled'|'missing'|'ready'} 閰嶇疆鐘讹拷?
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
 * 鍒ゆ柇 LLM 鏁欑粌閰嶇疆鏄惁瀹屾暣鍙敤锟?
 * @param {Partial<LlmCoachSettings>} settings - 寰呮鏌ョ殑璁剧疆
 * @returns {boolean} 鏄惁宸插叿澶囧彂璧疯姹傛墍闇€鐨勫叏閮ㄥ瓧锟?
 */
export function isLlmCoachConfigured(settings) {
    return getLlmCoachConfigStatus(settings) === 'ready';
}

/**
 * 娉ㄥ唽鍏ㄥ眬閿欒澶勭悊鍣紝渚夸簬蹇€熻瘑鍒暀缁冭姹傞摼璺腑鐨勬湭鎹曡幏寮傚父锟?
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
 * 璇锋眰 LLM 鏁欑粌寤鸿锛屽苟瑙ｆ瀽涓虹粨鏋勫寲瀵硅薄锟?
 * @param {LlmCoachRequestOptions} [options={}] - 璇锋眰鍙傛暟
 * @returns {Promise<Object>} 鏁欑粌杩斿洖鐨勭粨鏋勫寲寤鸿
 */
export async function requestLlmCoachAdvice({ settings, snapshot, signal, gameType, difficulty } = {}) {
    try {
        const normalized = normalizeLlmCoachSettings(settings);
        if (!isLlmCoachConfigured(normalized)) {
            throw new LlmCoachError('LLM coach is not configured.', 'missing_config');
        }

        const request = buildChatCompletionRequest(snapshot, createBoardImageDataUrl(snapshot, gameType), normalized.model, gameType, difficulty);
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
 * 浣跨敤涓€浠藉浐瀹氱殑绀轰緥妫嬪眬娴嬭瘯 LLM 杩炴帴閰嶇疆鏄惁鍙敤锟?
 * @param {Partial<LlmCoachSettings>} settings - 寰呮祴璇曠殑璁剧疆
 * @param {{ signal?: AbortSignal }} [options={}] - 鍙栨秷閫夐」
 * @returns {Promise<Object>} 杩滅杩斿洖鐨勮В鏋愮粨锟?
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
 * 鏋勶拷?OpenAI 鍏煎 `chat/completions` 璇锋眰浣擄拷?
 * @param {Object} snapshot - 妫嬪眬蹇収
 * @param {string} boardImageDataUrl - 妫嬬洏鎴浘 Data URL
 * @param {string} model - 鐩爣妯″瀷锟?
 * @returns {Object} 璇锋眰浣撳锟?
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
function buildChatCompletionRequest(snapshot, boardImageDataUrl, model, gameType, difficulty) {
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
                    (DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.medium).hint,
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
                            stateJson,
                            ...(snapshot.moveHistory && snapshot.moveHistory.length > 0
                                ? ['Move history (' + snapshot.moveHistory.length + ' moves):' + JSON.stringify(snapshot.moveHistory.slice(-10))]
                                : [])
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
 * 甯﹁秴鏃朵笌涓婂眰鍙栨秷淇″彿绔炰簤鎺у埗锟?`fetch` 鍖呰鍣拷?
 * @param {string} url - 璇锋眰鍦板潃
 * @param {RequestInit & { signal?: AbortSignal, timeoutMs?: number }} options - fetch 閫夐」
 * @returns {Promise<Response>} fetch 鍝嶅簲
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
            // 璁╄秴鏃舵帶鍒跺櫒涓庡灞傛帶鍒跺櫒鍏变韩鍚屼竴鍙栨秷鍑哄彛锛岄伩鍏嶅嚭鐜扳€滆姹傚凡鍙栨秷浣嗚秴鏃惰鏃跺櫒浠嶅湪璺戔€濈殑绔炴€侊拷?
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
 * 锟?OpenAI 鍏煎鍝嶅簲涓彁鍙栧姪鎵嬫秷鎭鏂囷拷?
 * @param {any} payload - 鍘熷鍝嶅簲 JSON
 * @returns {string} 绾枃鏈姪鎵嬪唴锟?
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
 * 灏嗘ā鍨嬭繑鍥炵殑鏂囨湰瑙ｆ瀽涓烘暀锟?JSON 瀵硅薄锟?
 * @param {string} content - 鍔╂墜杩斿洖鏂囨湰
 * @returns {Object} 瑙ｆ瀽鍚庣殑鏁欑粌鏁版嵁
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
 * 浠庢櫘閫氭枃鏈垨 Markdown 浠ｇ爜鍧椾腑鎴彇鏈€鍙兘锟?JSON 瀵硅薄姝ｆ枃锟?
 * @param {string} content - 鍘熷鍔╂墜鏂囨湰
 * @returns {string} 锟?JSON 鏂囨湰
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
 * 灏嗘灞€蹇収缁樺埗锟?Data URL锛屼緵澶氭ā鎬佹ā鍨嬭鍙栧綋鍓嶆鐩橈拷?
 * @param {Object} snapshot - 妫嬪眬蹇収
 * @returns {string} PNG Data URL
 */
function createBoardImageDataUrl(snapshot, gameType) {
    const gt = gameType || 'gomoku';
    if (gt === 'chess' || gt === 'xiangqi') {
        return createGridBoardImageUrl(snapshot, gt);
    }
    if (gt === 'othello') {
        return createOthelloBoardImageUrl(snapshot);
    }
    if (gt === 'shogi') {
        return createShogiBoardImageUrl(snapshot);
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


/**
 * Render an Othello (Reversi) 8x8 board with green felt and black/white discs.
 * Board cells are 'black' | 'white' | null.
 */
function createOthelloBoardImageUrl(snapshot) {
    const size = 8;
    const canvasSize = 768;
    const padding = 58;
    const cell = (canvasSize - padding * 2) / size;
    const canvas = document.createElement('canvas');
    canvas.width = canvasSize;
    canvas.height = canvasSize;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0d3b1f';
    ctx.fillRect(0, 0, canvasSize, canvasSize);
    ctx.fillStyle = '#e8e8e8';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i <= size; i += 1) {
        const pos = padding + i * cell;
        ctx.beginPath();
        ctx.moveTo(padding, pos);
        ctx.lineTo(canvasSize - padding, pos);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(pos, padding);
        ctx.lineTo(pos, canvasSize - padding);
        ctx.stroke();
    }

    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    [[2, 2], [2, 6], [6, 2], [6, 6]].forEach(([row, col]) => {
        const x = padding + col * cell;
        const y = padding + row * cell;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
    });

    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#cfcfcf';
    for (let i = 0; i < size; i += 1) {
        ctx.fillText(String.fromCharCode(65 + i), padding + i * cell + cell / 2, padding - 22);
        ctx.fillText(String(8 - i), padding - 22, padding + i * cell + cell / 2);
    }

    const board = snapshot.board;
    if (board) {
        for (let row = 0; row < size; row += 1) {
            for (let col = 0; col < size; col += 1) {
                const disc = board[row] && board[row][col];
                if (!disc) continue;
                const x = padding + col * cell + cell / 2;
                const y = padding + row * cell + cell / 2;
                const radius = cell * 0.4;
                const gradient = ctx.createRadialGradient(
                    x - radius * 0.35, y - radius * 0.4, radius * 0.2, x, y, radius
                );
                if (disc === 'black') {
                    gradient.addColorStop(0, '#5a5a5a');
                    gradient.addColorStop(1, '#0a0a0a');
                } else {
                    gradient.addColorStop(0, '#ffffff');
                    gradient.addColorStop(1, '#c9c4ba');
                }
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = disc === 'black' ? 'rgba(0,0,0,0.6)' : 'rgba(120,110,90,0.5)';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
        }
    }

    if (snapshot.lastMove) {
        const x = padding + snapshot.lastMove.col * cell + cell / 2;
        const y = padding + snapshot.lastMove.row * cell + cell / 2;
        ctx.strokeStyle = '#f1c75c';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(x, y, cell * 0.46, 0, Math.PI * 2);
        ctx.stroke();
    }

    return canvas.toDataURL('image/png');
}

/**
 * Render a Shogi (Japanese Chess) 9x9 board with traditional kanji piece labels
 * and promotion zone shading. Cells are {type, side} | null.
 * Row 0 = top (Gote back rank), row 8 = bottom (Sente back rank).
 */
function createShogiBoardImageUrl(snapshot) {
    const size = 9;
    const canvasSize = 768;
    const padding = 58;
    const cell = (canvasSize - padding * 2) / size;
    const canvas = document.createElement('canvas');
    canvas.width = canvasSize;
    canvas.height = canvasSize;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#d4a853';
    ctx.fillRect(0, 0, canvasSize, canvasSize);
    ctx.strokeStyle = 'rgba(47,36,25,0.85)';
    ctx.lineWidth = 1.5;

    for (let i = 0; i <= size; i += 1) {
        const pos = padding + i * cell;
        ctx.beginPath();
        ctx.moveTo(padding, pos);
        ctx.lineTo(canvasSize - padding, pos);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(pos, padding);
        ctx.lineTo(pos, canvasSize - padding);
        ctx.stroke();
    }

    ctx.fillStyle = 'rgba(255,200,100,0.35)';
    ctx.fillRect(padding, padding, canvasSize - padding * 2, cell * 3);
    ctx.fillRect(padding, canvasSize - padding - cell * 3, canvasSize - padding * 2, cell * 3);

    ctx.fillStyle = '#2f2419';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var cols = ['9','8','7','6','5','4','3','2','1'];
    for (let i = 0; i < size; i += 1) {
        ctx.fillText(cols[i], padding + i * cell + cell / 2, padding - 22);
        ctx.fillText(String(1 + i), padding - 22, padding + i * cell + cell / 2);
    }

    var kanjiMap = {
        K: '\u738B', R: '\u98DB\u8ECA', B: '\u89D2\u884C', G: '\u91D1',
        S: '\u9280', N: '\u69D8\u99AC', L: '\u9999\u8F66', P: '\u6B69\u5175',
        DR: '\u9F8D\u738B', DB: '\u9F8D\u9A6C', PS: '\u6210\u9280',
        PN: '\u6210\u69D8', PL: '\u6210\u9999', PP: '\u6210\u6B69'
    };

    var board = snapshot.board;
    if (board) {
        for (let row = 0; row < size; row += 1) {
            for (let col = 0; col < size; col += 1) {
                var piece = board[row] && board[row][col];
                if (!piece || !piece.type) continue;
                var x = padding + col * cell + cell / 2;
                var y = padding + row * cell + cell / 2;
                var label = kanjiMap[piece.type] || piece.type;

                var isSente = piece.side === 'sente';
                ctx.save();
                ctx.translate(x, y);
                if (!isSente) {
                    ctx.rotate(Math.PI);
                }

                ctx.fillStyle = '#2f2419';
                ctx.font = 'bold 11px sans-serif';
                ctx.beginPath();
                var triW = cell * 0.2;
                var triH = cell * 0.08;
                if (isSente) {
                    ctx.moveTo(-triW, -cell * 0.35);
                    ctx.lineTo(triW, -cell * 0.35);
                    ctx.lineTo(0, -cell * 0.35 + triH);
                } else {
                    ctx.moveTo(-triW, cell * 0.35);
                    ctx.lineTo(triW, cell * 0.35);
                    ctx.lineTo(0, cell * 0.35 - triH);
                }
                ctx.closePath();
                ctx.fill();

                ctx.font = 'bold 26px serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                var gradient = ctx.createRadialGradient(0, -4, 2, 0, 0, cell * 0.4);
                gradient.addColorStop(0, '#faf4e4');
                gradient.addColorStop(1, '#d4a853');
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.moveTo(0, -cell * 0.35);
                ctx.lineTo(cell * 0.22, -cell * 0.1);
                ctx.lineTo(cell * 0.15, cell * 0.32);
                ctx.lineTo(-cell * 0.15, cell * 0.32);
                ctx.lineTo(-cell * 0.22, -cell * 0.1);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = '#2f2419';
                ctx.lineWidth = 1.5;
                ctx.stroke();

                ctx.fillStyle = '#1a0e05';
                ctx.fillText(label, 0, isSente ? 2 : -2);
                ctx.restore();
            }
        }
    }

    if (snapshot.lastMove) {
        var lx = padding + snapshot.lastMove.col * cell + cell / 2;
        var ly = padding + snapshot.lastMove.row * cell + cell / 2;
        ctx.strokeStyle = '#f1c75c';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(lx, ly, cell * 0.42, 0, Math.PI * 2);
        ctx.stroke();
    }

    return canvas.toDataURL('image/png');
}
