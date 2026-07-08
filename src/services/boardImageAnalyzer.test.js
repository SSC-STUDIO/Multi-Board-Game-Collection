import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock browser-only APIs before importing the module
class MockFileReader {
  constructor() {
    this.onload = null;
    this.onerror = null;
    this._file = null;
  }
  readAsDataURL(file) {
    this._file = file;
    // Async resolution simulating FileReader
    queueMicrotask(() => {
      this.onload && this.onload({ target: { result: 'data:image/png;base64,AAAA' } });
    });
  }
}

if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = MockFileReader;
}

// Mock Image
class MockImage {
  constructor() {
    this.onload = null;
    this.onerror = null;
    this.naturalWidth = 100;
    this.naturalHeight = 100;
    this.src = '';
  }
}
if (typeof globalThis.Image === 'undefined') {
  globalThis.Image = MockImage;
}

// Compare for async FileReader (so we can control resolution)
let activeReader = null;
const OriginalFileReader = globalThis.FileReader;

vi.mock('./llmCoach.js', () => {
  class MockLlmCoachError extends Error {
    constructor(message, code) {
      super(message);
      this.code = code;
    }
  }
  return {
    LlmCoachError: MockLlmCoachError,
    isLlmCoachConfigured: vi.fn((s) => Boolean(s && s.enabled && s.apiKey)),
    normalizeLlmCoachSettings: vi.fn((s) => ({
      enabled: s?.enabled ?? false,
      baseUrl: s?.baseUrl || 'https://api.openai.com',
      model: s?.model || 'gpt-4o-mini',
      apiKey: s?.apiKey || '',
    })),
    fetchWithTimeout: vi.fn(),
    extractAssistantContent: vi.fn((p) => p?.choices?.[0]?.message?.content || ''),
    parseCoachJson: vi.fn((str) => {
      try {
        return JSON.parse(str);
      } catch {
        return {};
      }
    }),
  };
});

import { analyzeBoardImage, fileToDataUrl } from './boardImageAnalyzer.js';
import {
  LlmCoachError,
  fetchWithTimeout,
  parseCoachJson,
} from './llmCoach.js';

const mockSettings = {
  enabled: true,
  baseUrl: 'https://api.openai.com',
  model: 'gpt-4o-mini',
  apiKey: 'sk-test-key',
};

function makeFile({ type = 'image/png', size = 1024 } = {}) {
  return { type, size, name: 'board.png' };
}

function makeMockResponse(content, usage = null) {
  return {
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve({
        choices: [{ message: { content } }],
        usage: usage,
      }),
  };
}

describe('boardImageAnalyzer Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    // re-set behaviors
    fetchWithTimeout.mockClear();
  });

  describe('fileToDataUrl', () => {
    it('should throw LlmCoachError for non-image file type', async () => {
      const file = makeFile({ type: 'application/pdf' });
      await expect(fileToDataUrl(file)).rejects.toMatchObject({
        code: 'file_error',
      });
    });

    it('should throw LlmCoachError for null file', async () => {
      await expect(fileToDataUrl(null)).rejects.toMatchObject({
        code: 'file_error',
      });
    });

    it('should throw LlmCoachError when image exceeds 8MB', async () => {
      const file = makeFile({ size: 9 * 1024 * 1024 + 1 });
      await expect(fileToDataUrl(file)).rejects.toMatchObject({
        code: 'file_too_large',
      });
    });
  });

  describe('analyzeBoardImage', () => {
    it('should throw LlmCoachError when not configured', async () => {
      const file = makeFile();
      // when not configured: isLlmCoachConfigured returns false
      const { isLlmCoachConfigured } = await import('./llmCoach.js');
      isLlmCoachConfigured.mockReturnValueOnce(false);

      await expect(
        analyzeBoardImage({ file, settings: { enabled: false } })
      ).rejects.toMatchObject({ code: 'missing_config' });
    });

    it('should call fetchWithTimeout with correct request body for valid image', async () => {
      const file = makeFile();
      const analysisResult = JSON.stringify({
        boardSize: 15,
        stones: [{ row: 7, col: 7, color: 'black' }],
        currentPlayer: 'white',
        recommended: { row: 7, col: 8 },
        alternatives: [],
        reason: 'Strong opening.',
        risk: 'Black gains center.',
        plan: 'Build a chain.',
        confidence: 0.9,
      });

      fetchWithTimeout.mockResolvedValueOnce(makeMockResponse(analysisResult, { total_tokens: 100 }));

      const fileStub = { type: 'image/png', size: 1024, name: 'board.png' };
      const result = await analyzeBoardImage({
        file: fileStub,
        settings: mockSettings,
      });

      expect(fetchWithTimeout).toHaveBeenCalledTimes(1);
      const [url, options] = fetchWithTimeout.mock.calls[0];
      expect(url).toBe('https://api.openai.com/v1/chat/completions');
      expect(options.method).toBe('POST');
      expect(options.headers.Authorization).toBe('Bearer sk-test-key');
      expect(parseCoachJson).toHaveBeenCalled();

      const body = JSON.parse(options.body);
      expect(body.model).toBe('gpt-4o-mini');
      expect(body.temperature).toBe(0.1);
      expect(body.response_format).toEqual({ type: 'json_object' });
      expect(body.messages[0].role).toBe('system');
      expect(body.messages[1].content[1].type).toBe('image_url');
    });

    it('should throw LlmCoachError on bad_response (invalid JSON body)', async () => {
      fetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      const fileStub = { type: 'image/png', size: 1024, name: 'board.png' };
      await expect(
        analyzeBoardImage({ file: fileStub, settings: mockSettings })
      ).rejects.toMatchObject({ code: 'bad_response' });
    });

    it('should throw LlmCoachError on HTTP error response', async () => {
      fetchWithTimeout.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () =>
          Promise.resolve({
            error: { message: 'Invalid API key' },
          }),
      });

      const fileStub = { type: 'image/png', size: 1024, name: 'board.png' };
      await expect(
        analyzeBoardImage({ file: fileStub, settings: mockSettings })
      ).rejects.toMatchObject({ code: 'http_error', message: 'Invalid API key' });
    });

    it('should include imageDataUrl and usage in result', async () => {
      const analysisResult = JSON.stringify({
        boardSize: 15,
        stones: [],
        currentPlayer: 'black',
        recommended: { row: 7, col: 7 },
        alternatives: [],
        reason: '',
        risk: '',
        plan: '',
        confidence: 0.5,
      });

      fetchWithTimeout.mockResolvedValueOnce(
        makeMockResponse(analysisResult, { total_tokens: 250 })
      );

      const fileStub = { type: 'image/png', size: 1024, name: 'board.png' };
      const result = await analyzeBoardImage({
        file: fileStub,
        settings: mockSettings,
      });

      expect(result.imageDataUrl).toBeDefined();
      expect(result.usage).toEqual({ total_tokens: 250 });
      expect(result.boardSize).toBe(15);
    });

    it('should include abort signal in fetch options', async () => {
      const controller = new AbortController();
      const analysisResult = JSON.stringify({
        boardSize: 15,
        stones: [],
        currentPlayer: 'black',
        recommended: { row: 7, col: 7 },
        alternatives: [],
        reason: '',
        risk: '',
        plan: '',
        confidence: 0.5,
      });

      fetchWithTimeout.mockResolvedValueOnce(makeMockResponse(analysisResult));

      const fileStub = { type: 'image/png', size: 1024, name: 'board.png' };
      await analyzeBoardImage({
        file: fileStub,
        settings: mockSettings,
        signal: controller.signal,
      });

      const [, options] = fetchWithTimeout.mock.calls[0];
      expect(options.signal).toBe(controller.signal);
    });
  });
});
