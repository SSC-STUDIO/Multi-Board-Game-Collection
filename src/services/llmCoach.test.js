import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// DOM / browser mocks �?llmCoach uses localStorage, fetch, document, window
// ---------------------------------------------------------------------------

const localStorageMock = (() => {
    const store = {};
    return {
        getItem: vi.fn((k) => store[k] ?? null),
        setItem: vi.fn((k, v) => { store[k] = v; }),
        removeItem: vi.fn((k) => { delete store[k]; }),
        clear: vi.fn(() => { for (const k of Object.keys(store)) delete store[k]; }),
    };
})();
vi.stubGlobal('localStorage', localStorageMock);

vi.stubGlobal('navigator', { language: 'en-US' });
vi.stubGlobal('document', { documentElement: { lang: '' }, querySelectorAll: vi.fn(() => []), createElement: vi.fn(() => ({ width: 0, height: 0, getContext: vi.fn(() => null) })) });
vi.stubGlobal('fetch', vi.fn());
vi.stubGlobal('window', {
    localStorage: localStorageMock,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    addEventListener: vi.fn(),
    AudioContext: vi.fn(),
});

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------
const {
    LlmCoachError,
    normalizeLlmCoachSettings,
    getLlmCoachConfigStatus,
    isLlmCoachConfigured,
    extractAssistantContent,
    parseCoachJson,
    loadLlmCoachSettings,
    saveLlmCoachSettings,
    fetchWithTimeout,
    requestLlmCoachAdvice,
    requestPostGameAnalysis
} = await import('./llmCoach.js');

// ---------------------------------------------------------------------------
// LlmCoachError
// ---------------------------------------------------------------------------
describe('LlmCoachError', () => {
    it('should set name, message, and default code', () => {
        const err = new LlmCoachError('boom');
        expect(err).toBeInstanceOf(Error);
        expect(err.name).toBe('LlmCoachError');
        expect(err.message).toBe('boom');
        expect(err.code).toBe('llm_error');
    });

    it('should accept a custom code', () => {
        const err = new LlmCoachError('bad', 'custom_code');
        expect(err.code).toBe('custom_code');
    });
});

// ---------------------------------------------------------------------------
// normalizeLlmCoachSettings
// ---------------------------------------------------------------------------
describe('normalizeLlmCoachSettings', () => {
    it('should return defaults when called with no args', () => {
        const s = normalizeLlmCoachSettings();
        expect(s).toEqual({ enabled: false, baseUrl: '', model: '', apiKey: '' });
    });

    it('should trim trailing slashes from baseUrl', () => {
        const s = normalizeLlmCoachSettings({ baseUrl: 'https://example.com///' });
        expect(s.baseUrl).toBe('https://example.com');
    });

    it('should trim whitespace from model and apiKey', () => {
        const s = normalizeLlmCoachSettings({ model: '  gpt-4  ', apiKey: '  sk-abc  ' });
        expect(s.model).toBe('gpt-4');
        expect(s.apiKey).toBe('sk-abc');
    });

    it('should coerce enabled to boolean', () => {
        expect(normalizeLlmCoachSettings({ enabled: 1 }).enabled).toBe(true);
        expect(normalizeLlmCoachSettings({ enabled: 0 }).enabled).toBe(false);
        expect(normalizeLlmCoachSettings({ enabled: '' }).enabled).toBe(false);
    });

    it('should handle null/undefined fields gracefully', () => {
        const s = normalizeLlmCoachSettings({ baseUrl: null, model: undefined });
        expect(s.baseUrl).toBe('');
        expect(s.model).toBe('');
    });
});

// ---------------------------------------------------------------------------
// getLlmCoachConfigStatus
// ---------------------------------------------------------------------------
describe('getLlmCoachConfigStatus', () => {
    it('should return disabled when enabled is false', () => {
        expect(getLlmCoachConfigStatus({ enabled: false })).toBe('disabled');
    });

    it('should return missing when enabled but fields are empty', () => {
        expect(getLlmCoachConfigStatus({ enabled: true })).toBe('missing');
        expect(getLlmCoachConfigStatus({ enabled: true, baseUrl: 'x' })).toBe('missing');
        expect(getLlmCoachConfigStatus({ enabled: true, baseUrl: 'x', model: 'y' })).toBe('missing');
    });

    it('should return ready when all fields are present', () => {
        expect(getLlmCoachConfigStatus({ enabled: true, baseUrl: 'https://api.example.com', model: 'gpt-4', apiKey: 'sk-abc' })).toBe('ready');
    });
});

// ---------------------------------------------------------------------------
// isLlmCoachConfigured
// ---------------------------------------------------------------------------
describe('isLlmCoachConfigured', () => {
    it('should return true for complete config', () => {
        expect(isLlmCoachConfigured({ enabled: true, baseUrl: 'https://api.example.com', model: 'gpt-4', apiKey: 'sk-abc' })).toBe(true);
    });

    it('should return false for incomplete config', () => {
        expect(isLlmCoachConfigured({ enabled: false, baseUrl: 'x', model: 'y', apiKey: 'z' })).toBe(false);
        expect(isLlmCoachConfigured({ enabled: true })).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// extractAssistantContent
// ---------------------------------------------------------------------------
describe('extractAssistantContent', () => {
    it('should extract string content', () => {
        const payload = { choices: [{ message: { content: 'hello' } }] };
        expect(extractAssistantContent(payload)).toBe('hello');
    });

    it('should join array content parts', () => {
        const payload = {
            choices: [{ message: { content: [{ text: 'a' }, { text: 'b' }] } }],
        };
        expect(extractAssistantContent(payload)).toBe('a\nb');
    });

    it('should handle array with plain string parts', () => {
        const payload = {
            choices: [{ message: { content: ['x', 'y'] } }],
        };
        expect(extractAssistantContent(payload)).toBe('x\ny');
    });

    it('should throw LlmCoachError when content is missing', () => {
        expect(() => extractAssistantContent({})).toThrow(LlmCoachError);
        expect(() => extractAssistantContent({ choices: [] })).toThrow(LlmCoachError);
    });
});

// ---------------------------------------------------------------------------
// parseCoachJson
// ---------------------------------------------------------------------------
describe('parseCoachJson', () => {
    it('should parse plain JSON string', () => {
        const obj = { recommended: { row: 7, col: 7 } };
        expect(parseCoachJson(JSON.stringify(obj))).toEqual(obj);
    });

    it('should parse JSON inside markdown code fence', () => {
        const obj = { recommended: 'H8' };
        const fenced = '```json\n' + JSON.stringify(obj) + '\n```';
        expect(parseCoachJson(fenced)).toEqual(obj);
    });

    it('should parse JSON embedded in surrounding text', () => {
        const obj = { plan: 'play center' };
        const text = 'Here is my analysis:\n' + JSON.stringify(obj) + '\nDone.';
        expect(parseCoachJson(text)).toEqual(obj);
    });

    it('should throw LlmCoachError for unparseable content', () => {
        expect(() => parseCoachJson('no json here')).toThrow(LlmCoachError);
    });
});

// ---------------------------------------------------------------------------
// loadLlmCoachSettings / saveLlmCoachSettings round-trip
// ---------------------------------------------------------------------------
describe('loadLlmCoachSettings / saveLlmCoachSettings', () => {
    beforeEach(() => {
        localStorageMock.clear();
        vi.clearAllMocks();
    });

    it('should return defaults when localStorage is empty', () => {
        const s = loadLlmCoachSettings();
        expect(s.enabled).toBe(false);
        expect(s.baseUrl).toBe('');
    });

    it('should persist and restore settings with obfuscated apiKey', () => {
        const input = { enabled: true, baseUrl: 'https://api.example.com/', model: 'gpt-4', apiKey: 'sk-secret' };
        saveLlmCoachSettings(input);

        // Verify localStorage received obfuscated key (not plaintext)
        const raw = JSON.parse(localStorageMock.setItem.mock.calls.at(-1)[1]);
        expect(raw._v).toBe(2);
        expect(raw.apiKey).not.toBe('sk-secret');

        // Round-trip: load should restore the original plaintext key
        const loaded = loadLlmCoachSettings();
        expect(loaded.enabled).toBe(true);
        expect(loaded.baseUrl).toBe('https://api.example.com');
        expect(loaded.apiKey).toBe('sk-secret');
    });

    it('should return defaults on corrupted localStorage data', () => {
        localStorageMock.setItem('gomoku-llm-coach-settings', 'NOT JSON');
        const s = loadLlmCoachSettings();
        expect(s).toEqual({ enabled: false, baseUrl: '', model: '', apiKey: '' });
    });
});

// ---------------------------------------------------------------------------
// fetchWithTimeout
// ---------------------------------------------------------------------------
describe('fetchWithTimeout', () => {
    it('should pass options through to fetch', async () => {
        const mockResponse = { ok: true };
        globalThis.fetch.mockResolvedValueOnce(mockResponse);

        const resp = await fetchWithTimeout('https://api.test/v1', {
            method: 'POST',
            body: '{"x":1}',
        });
        expect(resp).toBe(mockResponse);
        expect(globalThis.fetch).toHaveBeenCalledWith('https://api.test/v1', expect.objectContaining({
            method: 'POST',
            body: '{"x":1}',
        }));
    });

    it('should throw LlmCoachError on network failure', async () => {
        globalThis.fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
        await expect(fetchWithTimeout('https://bad', {})).rejects.toThrow(LlmCoachError);
    });

    it('should throw LlmCoachError when parent signal is already aborted', async () => {
        const controller = new AbortController();
        controller.abort();
        // When parent signal is already aborted, the internal timeout controller
        // is immediately aborted. A real fetch would reject with AbortError.
        globalThis.fetch.mockImplementationOnce((_url, opts) => {
            if (opts?.signal?.aborted) {
                return Promise.reject(new DOMException('aborted', 'AbortError'));
            }
            return Promise.resolve({ ok: true });
        });

        await expect(fetchWithTimeout('https://x', { signal: controller.signal })).rejects.toThrow(LlmCoachError);
    });
});

// Mock canvas for board image rendering in test env
const origCreateElement = document.createElement.bind(document);
document.createElement = (tag) => {
    if (tag === 'canvas') {
        const ctx = {
            fillStyle: '',
            strokeStyle: '',
            lineWidth: 0,
            font: '',
            textAlign: '',
            textBaseline: '',
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            save: vi.fn(),
            restore: vi.fn(),
            translate: vi.fn(),
            rotate: vi.fn(),
            closePath: vi.fn(),
            stroke: vi.fn(),
            fill: vi.fn(),
            arc: vi.fn(),
            fillRect: vi.fn(),
            fillText: vi.fn(),
            createRadialGradient: () => ({ addColorStop: vi.fn() }),
        };
        return { width: 0, height: 0, getContext: () => ctx, toDataURL: () => 'data:image/png;base64,mock' };
    }
    return origCreateElement(tag);
};

describe('requestLlmCoachAdvice multi-game support', () => {
    const settings = { enabled: true, baseUrl: 'https://api.test', model: 'gpt-4o', apiKey: 'sk-test' };
    const baseSnapshot = { boardSize: 15, board: [], moveHistory: [], currentPlayer: 'black', lastMove: null };

    beforeEach(() => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ choices: [{ message: { content: '{"recommended":{"row":7,"col":7},"alternatives":[],"reason":"center","risk":"low","plan":"control"}' } }], usage: null })
        });
    });

    it('should use Gomoku role when gameType is gomoku', async () => {
        await requestLlmCoachAdvice({ settings, snapshot: baseSnapshot, gameType: 'gomoku' });
        const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
        expect(body.messages[0].content).toContain('Gomoku');
    });

    it('should use Go role when gameType is go', async () => {
        await requestLlmCoachAdvice({ settings, snapshot: baseSnapshot, gameType: 'go' });
        const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
        expect(body.messages[0].content).toContain('Go');
    });

    it('should use Chess role when gameType is chess', async () => {
        await requestLlmCoachAdvice({ settings, snapshot: baseSnapshot, gameType: 'chess' });
        const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
        expect(body.messages[0].content).toContain('Chess');
    });

    it('should use Xiangqi role when gameType is xiangqi', async () => {
        await requestLlmCoachAdvice({ settings, snapshot: baseSnapshot, gameType: 'xiangqi' });
        const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
        expect(body.messages[0].content).toContain('Xiangqi');
    });

    it('should use Junqi role when gameType is junqi', async () => {
        await requestLlmCoachAdvice({ settings, snapshot: baseSnapshot, gameType: 'junqi' });
        const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
        expect(body.messages[0].content).toContain('Military Chess');
    });

    it('should use Othello role when gameType is othello', async () => {
        await requestLlmCoachAdvice({ settings, snapshot: baseSnapshot, gameType: 'othello' });
        const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
        expect(body.messages[0].content).toContain('Othello');
        expect(body.messages[0].content).toContain('Reversi');
    });

    it('should use Shogi role when gameType is shogi', async () => {
        await requestLlmCoachAdvice({ settings, snapshot: baseSnapshot, gameType: 'shogi' });
        const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
        expect(body.messages[0].content).toContain('Shogi');
    });

    it('should fall back to Gomoku when gameType is empty', async () => {
        await requestLlmCoachAdvice({ settings, snapshot: baseSnapshot, gameType: '' });
        const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
        expect(body.messages[0].content).toContain('Gomoku');
    });
});
describe('requestPostGameAnalysis', () => {
    const settings = { enabled: true, baseUrl: 'https://api.test', model: 'gpt-4o', apiKey: 'sk-test' };
    const snapshot = {
        boardSize: 15,
        board: Array.from({ length: 15 }, () => Array(15).fill(null)),
        moveHistory: [],
        currentPlayer: 'black',
        lastMove: null,
        resultType: 'win',
        resultWinnerColor: 'black',
        gameOver: true
    };

    beforeEach(() => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                choices: [{ message: { content: JSON.stringify({
                    summary: 'A close game.',
                    turningPoints: 'Move 12 was key.',
                    mistakes: 'Both sides missed capture.',
                    strengths: 'Good opening.',
                    improvements: 'Endgame technique.',
                    rating: 7
                }) } }],
                usage: null
            })
        });
    });

    it('should send a post-game analysis request with gameType', async () => {
        await requestPostGameAnalysis({ settings, snapshot, gameType: 'gomoku' });
        const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
        expect(body.messages[0].content).toContain('post-game analyst');
        expect(body.messages[1].content[0].text).toContain('Post-game analysis request');
    });

    it('should throw when LLM is not configured', async () => {
        await expect(requestPostGameAnalysis({
            settings: { enabled: false },
            snapshot,
            gameType: 'go'
        })).rejects.toThrow('not configured');
    });

    it('should throw on HTTP error', async () => {
        globalThis.fetch.mockResolvedValueOnce({
            ok: false,
            json: () => Promise.resolve({ error: { message: 'rate limited' } })
        });
        await expect(requestPostGameAnalysis({ settings, snapshot, gameType: 'chess' })).rejects.toThrow('rate limited');
    });

    it('should include Othello post-game advice when gameType is othello', async () => {
        await requestPostGameAnalysis({ settings, snapshot, gameType: 'othello' });
        const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
        const text = body.messages[0].content + JSON.stringify(body.messages[1].content);
        expect(text).toContain('corner control');
    });

    it('should include Shogi post-game advice when gameType is shogi', async () => {
        await requestPostGameAnalysis({ settings, snapshot, gameType: 'shogi' });
        const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
        const text = body.messages[0].content + JSON.stringify(body.messages[1].content);
        expect(text).toContain('castle formations');
    });


describe('requestLlmCoachAdvice difficulty-adaptive coaching', () => {
    const settings = { enabled: true, baseUrl: 'https://api.test.com', model: 'gpt-4', apiKey: 'sk-test' };
    const snapshot = { boardSize: 15, board: [], moveHistory: [{ row: 7, col: 7, color: 'black' }], currentPlayer: 'white', lastMove: null };

    beforeEach(() => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                choices: [{ message: { content: JSON.stringify({
                    recommended: { row: 7, col: 8 },
                    alternatives: [],
                    reason: 'test',
                    risk: 'low',
                    plan: 'test plan',
                    confidence: 0.8
                }) } }],
                usage: null
            })
        });
    });

    it('should include easy difficulty hint in system prompt', async () => {
        await requestLlmCoachAdvice({ settings, snapshot, difficulty: 'easy', gameType: 'gomoku' });
        const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
        expect(body.messages[0].content).toContain('beginner');
    });

    it('should include hard difficulty hint in system prompt', async () => {
        await requestLlmCoachAdvice({ settings, snapshot, difficulty: 'hard', gameType: 'gomoku' });
        const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
        expect(body.messages[0].content).toContain('advanced');
    });

    it('should default to medium difficulty when not specified', async () => {
        await requestLlmCoachAdvice({ settings, snapshot, gameType: 'gomoku' });
        const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
        expect(body.messages[0].content).toContain('intermediate');
    });

    it('should include move history when available', async () => {
        await requestLlmCoachAdvice({ settings, snapshot, difficulty: 'medium', gameType: 'gomoku' });
        const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
        const userText = body.messages[1].content[0].text;
        expect(userText).toContain('Move history');
        expect(userText).toContain('1 moves');
    });

    it('should not include move history when empty', async () => {
        const emptySnapshot = { ...snapshot, moveHistory: [] };
        await requestLlmCoachAdvice({ settings, snapshot: emptySnapshot, difficulty: 'medium', gameType: 'gomoku' });
        const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
        const userText = body.messages[1].content[0].text;
        expect(userText).not.toContain('Move history');
    });
});
describe('requestLlmCoachAdvice Othello board rendering', () => {
    const settings = { enabled: true, baseUrl: 'https://api.test.com', model: 'gpt-4', apiKey: 'sk-test' };

    beforeEach(() => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ choices: [{ message: { content: JSON.stringify({ recommended: { row: 0, col: 0 }, alternatives: [], reason: 'corner', risk: 'low', plan: 'take corner' }) } }], usage: null })
        });
    });

    it('should render an 8x8 board with black and white discs', async () => {
        const snapshot = {
            boardSize: 8,
            board: [
                [null, null, null, null, null, null, null, null],
                [null, null, null, null, null, null, null, null],
                [null, null, null, 'black', null, null, null, null],
                [null, null, 'black', 'white', 'black', null, null, null],
                [null, null, null, 'black', 'white', null, null, null],
                [null, null, null, null, null, null, null, null],
                [null, null, null, null, null, null, null, null],
                [null, null, null, null, null, null, null, null]
            ],
            moveHistory: [],
            currentPlayer: 'white',
            lastMove: { row: 3, col: 3 }
        };
        await requestLlmCoachAdvice({ settings, snapshot, gameType: 'othello' });
        const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
        expect(body.messages[0].content).toContain('Othello');
        expect(body.messages[1].content[1].image_url.url).toBe('data:image/png;base64,mock');
    });

    it('should include lastMove highlight for othello', async () => {
        const snapshot = {
            boardSize: 8,
            board: Array.from({ length: 8 }, () => Array(8).fill(null)),
            moveHistory: [],
            currentPlayer: 'black',
            lastMove: { row: 0, col: 0 }
        };
        await requestLlmCoachAdvice({ settings, snapshot, gameType: 'othello' });
        expect(globalThis.fetch).toHaveBeenCalled();
    });
});

describe('requestLlmCoachAdvice Shogi board rendering', () => {
    const settings = { enabled: true, baseUrl: 'https://api.test.com', model: 'gpt-4', apiKey: 'sk-test' };

    beforeEach(() => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ choices: [{ message: { content: JSON.stringify({ recommended: { from: { row: 6, col: 4 }, to: { row: 5, col: 4 } }, alternatives: [], reason: 'pawn advance', risk: 'low', plan: 'control center' }) } }], usage: null })
        });
    });

    it('should render a 9x9 board with piece objects', async () => {
        const snapshot = {
            boardSize: 9,
            board: [
                [{ type: 'L', side: 'gote' }, { type: 'N', side: 'gote' }, { type: 'S', side: 'gote' }, { type: 'G', side: 'gote' }, { type: 'K', side: 'gote' }, { type: 'G', side: 'gote' }, { type: 'S', side: 'gote' }, { type: 'N', side: 'gote' }, { type: 'L', side: 'gote' }],
                [null, { type: 'R', side: 'gote' }, null, null, null, null, null, { type: 'B', side: 'gote' }, null],
                [{ type: 'P', side: 'gote' }, { type: 'P', side: 'gote' }, { type: 'P', side: 'gote' }, { type: 'P', side: 'gote' }, { type: 'P', side: 'gote' }, { type: 'P', side: 'gote' }, { type: 'P', side: 'gote' }, { type: 'P', side: 'gote' }, { type: 'P', side: 'gote' }],
                Array(9).fill(null),
                Array(9).fill(null),
                Array(9).fill(null),
                [{ type: 'P', side: 'sente' }, { type: 'P', side: 'sente' }, { type: 'P', side: 'sente' }, { type: 'P', side: 'sente' }, { type: 'P', side: 'sente' }, { type: 'P', side: 'sente' }, { type: 'P', side: 'sente' }, { type: 'P', side: 'sente' }, { type: 'P', side: 'sente' }],
                [null, { type: 'B', side: 'sente' }, null, null, null, null, null, { type: 'R', side: 'sente' }, null],
                [{ type: 'L', side: 'sente' }, { type: 'N', side: 'sente' }, { type: 'S', side: 'sente' }, { type: 'G', side: 'sente' }, { type: 'K', side: 'sente' }, { type: 'G', side: 'sente' }, { type: 'S', side: 'sente' }, { type: 'N', side: 'sente' }, { type: 'L', side: 'sente' }]
            ],
            moveHistory: [],
            turn: 'sente',
            lastMove: null
        };
        await requestLlmCoachAdvice({ settings, snapshot, gameType: 'shogi' });
        const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
        expect(body.messages[0].content).toContain('Shogi');
        expect(body.messages[1].content[1].image_url.url).toBe('data:image/png;base64,mock');
    });

    it('should handle promoted pieces in shogi board', async () => {
        const board = Array.from({ length: 9 }, () => Array(9).fill(null));
        board[0][4] = { type: 'K', side: 'gote' };
        board[8][4] = { type: 'K', side: 'sente' };
        board[4][4] = { type: 'DR', side: 'sente' };
        const snapshot = {
            boardSize: 9,
            board,
            moveHistory: [],
            turn: 'sente',
            lastMove: { row: 4, col: 4 }
        };
        await requestLlmCoachAdvice({ settings, snapshot, gameType: 'shogi' });
        expect(globalThis.fetch).toHaveBeenCalled();
    });
});

});