import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  requestMoveCommentary,
  getMoveCommentary,
  clearCommentaryCache,
  isCommentaryAvailable,
} from './aiCommentary.js';

// Mock llmCoach dependencies
vi.mock('./llmCoach.js', () => {
  const settingsMap = new WeakMap();
  return {
    isLlmCoachConfigured: vi.fn((s) => {
      return Boolean(s && s.enabled && s.apiKey);
    }),
    normalizeLlmCoachSettings: vi.fn((s) => ({
      enabled: s?.enabled ?? false,
      baseUrl: s?.baseUrl || 'https://api.openai.com',
      model: s?.model || 'gpt-4o',
      apiKey: s?.apiKey || '',
    })),
    fetchWithTimeout: vi.fn(),
    extractAssistantContent: vi.fn((payload) => {
      return payload?.choices?.[0]?.message?.content ?? '';
    }),
  };
});

// Import mocked functions
import {
  isLlmCoachConfigured,
  normalizeLlmCoachSettings,
  fetchWithTimeout,
  extractAssistantContent,
} from './llmCoach.js';

const mockSettings = {
  enabled: true,
  baseUrl: 'https://api.openai.com',
  model: 'gpt-4o',
  apiKey: 'sk-test-key',
};

const makeSnapshot = (overrides = {}) => ({
  boardSize: 15,
  currentPlayer: 'black',
  moveHistory: [
    { row: 7, col: 7, color: 'black', action: 'place' },
    { row: 7, col: 8, color: 'white', action: 'place' },
  ],
  lastMove: { row: 7, col: 8, color: 'white' },
  ...overrides,
});

describe('aiCommentary Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearCommentaryCache();
  });

  describe('isCommentaryAvailable', () => {
    it('should return true when settings are configured', () => {
      expect(isCommentaryAvailable(mockSettings)).toBe(true);
    });

    it('should return false when settings disabled', () => {
      expect(isCommentaryAvailable({ enabled: false, apiKey: 'sk-test' })).toBe(false);
    });

    it('should return false when no apiKey', () => {
      expect(isCommentaryAvailable({ enabled: true, apiKey: '' })).toBe(false);
    });
  });

  describe('requestMoveCommentary', () => {
    it('should return null when LLM is not configured', async () => {
      const result = await requestMoveCommentary({
        settings: { enabled: false },
        snapshot: makeSnapshot(),
        gameType: 'gomoku',
      });
      expect(result).toBeNull();
    });

    it('should build correct message structure for gomoku', async () => {
      fetchWithTimeout.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: 'Strong central opening.' } }],
          }),
      });

      await requestMoveCommentary({
        settings: mockSettings,
        snapshot: makeSnapshot(),
        gameType: 'gomoku',
      });

      expect(fetchWithTimeout).toHaveBeenCalledTimes(1);
      const [url, options] = fetchWithTimeout.mock.calls[0];
      expect(url).toContain('/v1/chat/completions');
      const body = JSON.parse(options.body);
      expect(body.temperature).toBe(0.4);
      expect(body.max_tokens).toBe(120);
      expect(body.messages).toHaveLength(2);
      expect(body.messages[0].role).toBe('system');
      expect(body.messages[1].role).toBe('user');
      expect(body.messages[0].content).toContain('Gomoku');
    });

    it('should format move history in user message', async () => {
      fetchWithTimeout.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: 'Nice move.' } }],
          }),
      });

      await requestMoveCommentary({
        settings: mockSettings,
        snapshot: makeSnapshot(),
        gameType: 'gomoku',
      });

      const body = JSON.parse(fetchWithTimeout.mock.calls[0][1].body);
      const userContent = body.messages[1].content;
      expect(userContent).toContain('black');
      expect(userContent).toContain('(7,7)');
      expect(userContent).toContain('(7,8)');
      expect(userContent).toContain('Recent moves');
    });

    it('should return null on non-ok response', async () => {
      fetchWithTimeout.mockResolvedValue({
        ok: false,
        status: 500,
        json: () =>
          Promise.resolve({ error: { message: 'Internal error' } }),
      });

      const result = await requestMoveCommentary({
        settings: mockSettings,
        snapshot: makeSnapshot(),
        gameType: 'gomoku',
      });
      expect(result).toBeNull();
    });

    it('should return null on JSON parse failure', async () => {
      fetchWithTimeout.mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      const result = await requestMoveCommentary({
        settings: mockSettings,
        snapshot: makeSnapshot(),
        gameType: 'go',
      });
      expect(result).toBeNull();
    });

    it('should use go prompts for gameType "go"', async () => {
      fetchWithTimeout.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: 'Good territory move.' } }],
          }),
      });

      await requestMoveCommentary({
        settings: mockSettings,
        snapshot: makeSnapshot({ boardSize: 19 }),
        gameType: 'go',
      });

      const body = JSON.parse(fetchWithTimeout.mock.calls[0][1].body);
      expect(body.messages[0].content).toContain('Go');
    });

    it('should support all 6 game types', async () => {
      const gameTypes = ['gomoku', 'go', 'chess', 'xiangqi', 'junqi', 'othello'];

      for (const gameType of gameTypes) {
        fetchWithTimeout.mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              choices: [{ message: { content: `Commentary for ${gameType}` } }],
            }),
        });

        const result = await requestMoveCommentary({
          settings: mockSettings,
          snapshot: makeSnapshot(),
          gameType,
        });
        expect(result).toBe(`Commentary for ${gameType}`);
      }
    });

    it('should handle snapshot with empty move history', async () => {
      fetchWithTimeout.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: 'Opening position.' } }],
          }),
      });

      await requestMoveCommentary({
        settings: mockSettings,
        snapshot: makeSnapshot({ moveHistory: [], lastMove: null }),
        gameType: 'gomoku',
      });

      const body = JSON.parse(fetchWithTimeout.mock.calls[0][1].body);
      expect(body.messages[1].content).toContain('opening move');
    });

    it('should limit history to last 6 moves', async () => {
      const longHistory = Array.from({ length: 20 }, (_, i) => ({
        row: i, col: i, color: i % 2 === 0 ? 'black' : 'white', action: 'place',
      }));

      fetchWithTimeout.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: 'Commentary' } }],
          }),
      });

      await requestMoveCommentary({
        settings: mockSettings,
        snapshot: makeSnapshot({ moveHistory: longHistory }),
        gameType: 'gomoku',
      });

      const body = JSON.parse(fetchWithTimeout.mock.calls[0][1].body);
      expect(body.messages[1].content).toContain('15. white');
      expect(body.messages[1].content).toContain('20. white');
    });

    it('should pass abort signal to fetchWithTimeout', async () => {
      const controller = new AbortController();
      fetchWithTimeout.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: 'OK' } }],
          }),
      });

      await requestMoveCommentary({
        settings: mockSettings,
        snapshot: makeSnapshot(),
        signal: controller.signal,
        gameType: 'gomoku',
      });

      const [, options] = fetchWithTimeout.mock.calls[0];
      expect(options.signal).toBe(controller.signal);
    });
  });

  describe('getMoveCommentary (cache)', () => {
    it('should cache commentary by move count and game type', async () => {
      fetchWithTimeout.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: 'Cached result' } }],
          }),
      });

      const snap = makeSnapshot();
      const result1 = await getMoveCommentary({
        settings: mockSettings,
        snapshot: snap,
        gameType: 'gomoku',
      });
      expect(result1).toBe('Cached result');
      expect(fetchWithTimeout).toHaveBeenCalledTimes(1);

      // Same move count → cached
      const result2 = await getMoveCommentary({
        settings: mockSettings,
        snapshot: snap,
        gameType: 'gomoku',
      });
      expect(result2).toBe('Cached result');
      expect(fetchWithTimeout).toHaveBeenCalledTimes(1); // no new fetch
    });

    it('should not cache across game types', async () => {
      fetchWithTimeout.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: 'Game specific' } }],
          }),
      });

      await getMoveCommentary({
        settings: mockSettings,
        snapshot: makeSnapshot(),
        gameType: 'gomoku',
      });
      await getMoveCommentary({
        settings: mockSettings,
        snapshot: makeSnapshot(),
        gameType: 'go',
      });
      expect(fetchWithTimeout).toHaveBeenCalledTimes(2);
    });

    it('should evict old entries when cache exceeds 20', async () => {
      fetchWithTimeout.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: 'OK' } }],
          }),
      });

      // Fill cache with 21 entries
      for (let i = 0; i < 21; i++) {
        await getMoveCommentary({
          settings: mockSettings,
          snapshot: makeSnapshot({ moveHistory: Array(i).fill({ row: 0, col: 0, color: 'black' }) }),
          gameType: 'gomoku',
        });
      }

      // First entry should have been evicted
      const result = await getMoveCommentary({
        settings: mockSettings,
        snapshot: makeSnapshot({ moveHistory: [] }),
        gameType: 'gomoku',
      });
      expect(result).toBe('OK');
    });

    it('should reset cache via clearCommentaryCache', async () => {
      fetchWithTimeout.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: 'First call' } }],
          }),
      });

      await getMoveCommentary({
        settings: mockSettings,
        snapshot: makeSnapshot(),
        gameType: 'gomoku',
      });
      expect(fetchWithTimeout).toHaveBeenCalledTimes(1);

      clearCommentaryCache();

      fetchWithTimeout.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: 'After clear' } }],
          }),
      });

      const result = await getMoveCommentary({
        settings: mockSettings,
        snapshot: makeSnapshot(),
        gameType: 'gomoku',
      });
      expect(result).toBe('After clear');
      expect(fetchWithTimeout).toHaveBeenCalledTimes(2);
    });
  });
});
