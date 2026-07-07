import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./llmCoach.js', () => ({
    isLlmCoachConfigured: vi.fn((s) => s.enabled && s.baseUrl && s.model && s.apiKey),
    normalizeLlmCoachSettings: vi.fn((s) => s || {}),
    fetchWithTimeout: vi.fn(),
    extractAssistantContent: vi.fn(() => 'Black develops a knight toward the center, eyeing kingside castling.')
}));

import { requestMoveCommentary, getMoveCommentary, clearCommentaryCache, isCommentaryAvailable } from './aiCommentary.js';
import { isLlmCoachConfigured, normalizeLlmCoachSettings, fetchWithTimeout, extractAssistantContent } from './llmCoach.js';

beforeEach(() => {
    clearCommentaryCache();
    isLlmCoachConfigured.mockImplementation((s) => s && s.enabled && s.baseUrl && s.model && s.apiKey);
    normalizeLlmCoachSettings.mockImplementation((s) => s || {});
    fetchWithTimeout.mockReset();
    extractAssistantContent.mockReturnValue('Black develops a knight toward the center, eyeing kingside castling.');
});

describe('aiCommentary', () => {
    describe('requestMoveCommentary', () => {
        it('should return null when LLM is not configured', async () => {
            isLlmCoachConfigured.mockReturnValue(false);
            const result = await requestMoveCommentary({
                settings: { enabled: false },
                snapshot: { boardSize: 15, currentPlayer: 'black', moveHistory: [] },
                gameType: 'gomoku'
            });
            expect(result).toBeNull();
            expect(fetchWithTimeout).not.toHaveBeenCalled();
        });

        it('should call LLM API when configured', async () => {
            const mockResponse = { ok: true, json: vi.fn(async () => ({ choices: [{ message: { content: 'Good opening move.' } }] })) };
            fetchWithTimeout.mockResolvedValue(mockResponse);
            extractAssistantContent.mockReturnValue('Good opening move.');

            const settings = { enabled: true, baseUrl: 'https://api.example.com', model: 'gpt-4', apiKey: 'sk-test' };
            const snapshot = {
                boardSize: 15,
                currentPlayer: 'black',
                moveHistory: [{ color: 'black', row: 7, col: 7 }]
            };

            const result = await requestMoveCommentary({ settings, snapshot, gameType: 'gomoku' });
            expect(fetchWithTimeout).toHaveBeenCalledOnce();
            expect(result).toBe('Good opening move.');
        });

        it('should include move history in prompt', async () => {
            const mockResponse = { ok: true, json: vi.fn(async () => ({})) };
            fetchWithTimeout.mockResolvedValue(mockResponse);
            extractAssistantContent.mockReturnValue('Commentary');

            const settings = { enabled: true, baseUrl: 'https://api.example.com', model: 'gpt-4', apiKey: 'sk-test' };
            const snapshot = {
                boardSize: 15,
                currentPlayer: 'white',
                moveHistory: [
                    { color: 'black', row: 7, col: 7 },
                    { color: 'white', row: 7, col: 8 }
                ]
            };

            await requestMoveCommentary({ settings, snapshot, gameType: 'gomoku' });

            const callArgs = fetchWithTimeout.mock.calls[0];
            const body = JSON.parse(callArgs[1].body);
            expect(body.messages.length).toBe(2);
            expect(body.messages[1].content).toContain('black');
            expect(body.messages[1].content).toContain('(7,7)');
        });

        it('should return null on HTTP error', async () => {
            const mockResponse = { ok: false, status: 429, json: vi.fn(async () => ({ error: { message: 'Rate limited' } })) };
            fetchWithTimeout.mockResolvedValue(mockResponse);

            const settings = { enabled: true, baseUrl: 'https://api.example.com', model: 'gpt-4', apiKey: 'sk-test' };
            const result = await requestMoveCommentary({
                settings,
                snapshot: { boardSize: 15, currentPlayer: 'black', moveHistory: [] },
                gameType: 'gomoku'
            });
            expect(result).toBeNull();
        });

        it('should work with all 5 game types', async () => {
            const mockResponse = { ok: true, json: vi.fn(async () => ({})) };
            fetchWithTimeout.mockResolvedValue(mockResponse);
            extractAssistantContent.mockReturnValue('Commentary');

            const settings = { enabled: true, baseUrl: 'https://api.example.com', model: 'gpt-4', apiKey: 'sk-test' };
            const snapshot = { boardSize: 15, currentPlayer: 'black', moveHistory: [] };

            for (const gameType of ['gomoku', 'go', 'chess', 'xiangqi', 'junqi']) {
                clearCommentaryCache();
                const result = await requestMoveCommentary({ settings, snapshot, gameType });
                expect(result).toBe('Commentary');
                expect(fetchWithTimeout).toHaveBeenCalled();
            }
        });
    });

    describe('getMoveCommentary', () => {
        it('should cache results by move count', async () => {
            const mockResponse = { ok: true, json: vi.fn(async () => ({})) };
            fetchWithTimeout.mockResolvedValue(mockResponse);
            extractAssistantContent.mockReturnValue('Cached commentary');

            const settings = { enabled: true, baseUrl: 'https://api.example.com', model: 'gpt-4', apiKey: 'sk-test' };
            const snapshot = { boardSize: 15, currentPlayer: 'black', moveHistory: [{ color: 'black', row: 7, col: 7 }] };

            const result1 = await getMoveCommentary({ settings, snapshot, gameType: 'gomoku' });
            const result2 = await getMoveCommentary({ settings, snapshot, gameType: 'gomoku' });

            expect(result1).toBe('Cached commentary');
            expect(result2).toBe('Cached commentary');
            expect(fetchWithTimeout).toHaveBeenCalledOnce();
        });

        it('should make new request when move count changes', async () => {
            const mockResponse = { ok: true, json: vi.fn(async () => ({})) };
            fetchWithTimeout.mockResolvedValue(mockResponse);
            extractAssistantContent.mockReturnValue('New commentary');

            const settings = { enabled: true, baseUrl: 'https://api.example.com', model: 'gpt-4', apiKey: 'sk-test' };

            const snapshot1 = { boardSize: 15, currentPlayer: 'black', moveHistory: [] };
            const snapshot2 = { boardSize: 15, currentPlayer: 'white', moveHistory: [{ color: 'black', row: 7, col: 7 }] };

            await getMoveCommentary({ settings, snapshot: snapshot1, gameType: 'gomoku' });
            await getMoveCommentary({ settings, snapshot: snapshot2, gameType: 'gomoku' });

            expect(fetchWithTimeout).toHaveBeenCalledTimes(2);
        });
    });

    describe('clearCommentaryCache', () => {
        it('should clear all cached commentary', async () => {
            const mockResponse = { ok: true, json: vi.fn(async () => ({})) };
            fetchWithTimeout.mockResolvedValue(mockResponse);
            extractAssistantContent.mockReturnValue('Commentary');

            const settings = { enabled: true, baseUrl: 'https://api.example.com', model: 'gpt-4', apiKey: 'sk-test' };
            const snapshot = { boardSize: 15, currentPlayer: 'black', moveHistory: [] };

            await getMoveCommentary({ settings, snapshot, gameType: 'gomoku' });
            clearCommentaryCache();

            // Second call should hit API again (not cached)
            await getMoveCommentary({ settings, snapshot, gameType: 'gomoku' });
            expect(fetchWithTimeout).toHaveBeenCalledTimes(2);
        });
    });

    describe('isCommentaryAvailable', () => {
        it('should return true when settings are configured', () => {
            isLlmCoachConfigured.mockReturnValue(true);
            expect(isCommentaryAvailable({ enabled: true, baseUrl: 'https://api.example.com', model: 'gpt-4', apiKey: 'sk-test' })).toBe(true);
        });

        it('should return false when settings are not configured', () => {
            isLlmCoachConfigured.mockReturnValue(false);
            expect(isCommentaryAvailable({ enabled: false })).toBe(false);
        });
    });
});
