import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../utils/i18n.js', () => ({
    i18n: { t: (key) => key },
    t: (key) => key
}));

import { analyzeBoardImage, fileToDataUrl } from './boardImageAnalyzer.js';
import { LlmCoachError } from './llmCoach.js';

// ---------------------------------------------------------------------------
// Browser API mocks
// ---------------------------------------------------------------------------

class FakeFileReader {
    constructor() {
        this.result = null;
        this.onload = null;
        this.onerror = null;
    }
    readAsDataURL(file) {
        queueMicrotask(() => {
            if (file && file._fail) {
                this.onerror?.();
            } else {
                this.result = `data:${file?.type || 'image/png'};base64,FAKEBASE64`;
                this.onload?.();
            }
        });
    }
}

class FakeImage {
    constructor() {
        this.onload = null;
        this.onerror = null;
        this.naturalWidth = 2000;
        this.naturalHeight = 1500;
    }
    set src(_value) {
        queueMicrotask(() => this.onload?.());
    }
}

function makeFile({ type = 'image/png', size = 1024, fail = false } = {}) {
    return { type, size, _fail: fail, name: 'board.png' };
}

beforeEach(() => {
    globalThis.FileReader = FakeFileReader;
    globalThis.Image = FakeImage;
    globalThis.document = {
        ...globalThis.document,
        createElement: (tag) => {
            if (tag === 'canvas') {
                return {
                    width: 0,
                    height: 0,
                    getContext: () => ({ drawImage: () => {} }),
                    toDataURL: () => 'data:image/jpeg;base64,COMPRESSED'
                };
            }
            return { style: {} };
        }
    };
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// fileToDataUrl
// ---------------------------------------------------------------------------

describe('fileToDataUrl', () => {
    it('returns compressed data URL for valid image', async () => {
        const file = makeFile({ type: 'image/png', size: 1024 });
        const dataUrl = await fileToDataUrl(file);
        expect(dataUrl).toBe('data:image/jpeg;base64,COMPRESSED');
    });

    it('rejects non-image file types', async () => {
        const file = makeFile({ type: 'application/pdf' });
        await expect(fileToDataUrl(file)).rejects.toThrow(LlmCoachError);
        await expect(fileToDataUrl(file)).rejects.toMatchObject({ code: 'file_error' });
    });

    it('rejects images above 8MB limit', async () => {
        const file = makeFile({ type: 'image/png', size: 9 * 1024 * 1024 });
        await expect(fileToDataUrl(file)).rejects.toMatchObject({ code: 'file_too_large' });
    });

    it('rejects missing file', async () => {
        await expect(fileToDataUrl(null)).rejects.toMatchObject({ code: 'file_error' });
    });

    it('falls back to raw data URL when compression fails', async () => {
        globalThis.Image = class {
            set src(_value) {
                queueMicrotask(() => this.onerror?.());
            }
        };
        const file = makeFile({ type: 'image/gif', size: 1024 });
        const dataUrl = await fileToDataUrl(file);
        expect(dataUrl).toMatch(/^data:image\/gif;base64,/);
    });
});

// ---------------------------------------------------------------------------
// analyzeBoardImage
// ---------------------------------------------------------------------------

const validSettings = {
    enabled: true,
    baseUrl: 'https://api.example.com',
    model: 'gpt-4o',
    apiKey: 'sk-test-key'
};

describe('analyzeBoardImage', () => {
    it('throws when LLM is not configured', async () => {
        await expect(
            analyzeBoardImage({ file: makeFile(), settings: { enabled: false } })
        ).rejects.toMatchObject({ code: 'missing_config' });
    });

    it('sends correct payload to OpenAI-compatible endpoint', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                choices: [{
                    message: {
                        content: JSON.stringify({
                            boardSize: 15,
                            stones: [{ row: 7, col: 7, color: 'black' }],
                            currentPlayer: 'white'
                        })
                    }
                }],
                usage: { prompt_tokens: 123, completion_tokens: 45 }
            })
        });
        globalThis.fetch = fetchMock;
        globalThis.window.setTimeout = globalThis.setTimeout;
        globalThis.window.clearTimeout = globalThis.clearTimeout;

        const result = await analyzeBoardImage({ file: makeFile(), settings: validSettings });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('https://api.example.com/v1/chat/completions');
        expect(init.method).toBe('POST');
        expect(init.headers.Authorization).toBe('Bearer sk-test-key');

        const body = JSON.parse(init.body);
        expect(body.model).toBe('gpt-4o');
        expect(body.response_format).toEqual({ type: 'json_object' });
        expect(body.messages).toHaveLength(2);
        expect(body.messages[1].content[1].type).toBe('image_url');
        expect(body.messages[1].content[1].image_url.url).toMatch(/^data:image/);

        expect(result).toMatchObject({
            boardSize: 15,
            stones: [{ row: 7, col: 7, color: 'black' }],
            currentPlayer: 'white'
        });
        expect(result.imageDataUrl).toMatch(/^data:image/);
        expect(result.usage).toEqual({ prompt_tokens: 123, completion_tokens: 45 });
    });

    it('throws http_error on non-ok response', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 500,
            json: async () => ({ error: { message: 'Internal server error' } })
        });
        globalThis.window.setTimeout = globalThis.setTimeout;
        globalThis.window.clearTimeout = globalThis.clearTimeout;

        await expect(
            analyzeBoardImage({ file: makeFile(), settings: validSettings })
        ).rejects.toMatchObject({ code: 'http_error' });
    });

    it('throws bad_response when response is not valid JSON', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => { throw new Error('syntax'); }
        });
        globalThis.window.setTimeout = globalThis.setTimeout;
        globalThis.window.clearTimeout = globalThis.clearTimeout;

        await expect(
            analyzeBoardImage({ file: makeFile(), settings: validSettings })
        ).rejects.toMatchObject({ code: 'bad_response' });
    });
});
