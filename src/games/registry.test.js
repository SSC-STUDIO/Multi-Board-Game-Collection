import { describe, it, expect } from 'vitest';

import { GAMES, findGame, listGames, listAvailableGames } from './registry.js';

describe('games/registry', () => {
    it('includes only gomoku and go', () => {
        expect(GAMES.map((game) => game.id)).toEqual(['gomoku', 'go']);
    });

    it('every entry has id, titleKey, taglineKey and a status', () => {
        GAMES.forEach((game) => {
            expect(typeof game.id).toBe('string');
            expect(game.id.length).toBeGreaterThan(0);
            expect(typeof game.titleKey).toBe('string');
            expect(typeof game.taglineKey).toBe('string');
            expect(['available', 'coming-soon']).toContain(game.status);
        });
    });

    it('available entries provide a loadModule factory', () => {
        const available = listAvailableGames();
        expect(available).toHaveLength(2);
        available.forEach((game) => {
            expect(typeof game.loadModule).toBe('function');
        });
    });

    it('findGame returns null for unknown ids', () => {
        expect(findGame('unknown')).toBeNull();
        expect(findGame('chess')).toBeNull();
        expect(findGame('gomoku')?.id).toBe('gomoku');
        expect(findGame('go')?.id).toBe('go');
    });

    it('listGames returns a fresh array (safe to mutate)', () => {
        const first = listGames();
        first.pop();
        expect(GAMES.length).not.toBe(first.length - 1);
    });

    it('gomoku is marked available with core capabilities', () => {
        const gomoku = findGame('gomoku');
        expect(gomoku?.status).toBe('available');
        expect(gomoku?.capabilities).toEqual(
            expect.arrayContaining(['llm-coach', 'image-import', '3d-scene'])
        );
    });

    it('go is marked available with 3d and coach capabilities', () => {
        const go = findGame('go');
        expect(go?.status).toBe('available');
        expect(go?.capabilities).toEqual(expect.arrayContaining(['3d-scene', 'llm-coach']));
    });

    it('coming-soon games (if any) have no loadModule', () => {
        const pending = GAMES.filter((game) => game.status === 'coming-soon');
        pending.forEach((game) => {
            expect(game.loadModule).toBeUndefined();
        });
    });

    it('all listed games are currently marked available', () => {
        const available = listAvailableGames();
        expect(available.length).toBe(GAMES.length);
    });
});
