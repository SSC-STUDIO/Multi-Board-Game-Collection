import { describe, it, expect } from 'vitest';

import { GAMES, findGame, listGames, listAvailableGames } from './registry.js';

describe('games/registry', () => {
    it('includes all four planned games + gomoku', () => {
        const ids = GAMES.map((game) => game.id);
        expect(ids).toContain('gomoku');
        expect(ids).toContain('go');
        expect(ids).toContain('chess');
        expect(ids).toContain('xiangqi');
        expect(ids).toContain('junqi');
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
        expect(available.length).toBeGreaterThan(0);
        available.forEach((game) => {
            expect(typeof game.loadModule).toBe('function');
        });
    });

    it('findGame returns null for unknown ids', () => {
        expect(findGame('unknown')).toBeNull();
        expect(findGame('gomoku')?.id).toBe('gomoku');
    });

    it('listGames returns a fresh array (safe to mutate)', () => {
        const first = listGames();
        first.pop();
        expect(GAMES.length).not.toBe(first.length - 1);
    });

    it('gomoku is marked available with core capabilities', () => {
        const gomoku = findGame('gomoku');
        expect(gomoku?.status).toBe('available');
        expect(gomoku?.capabilities).toEqual(expect.arrayContaining(['llm-coach', 'image-import']));
    });

    it('coming-soon games (if any) have no loadModule', () => {
        const pending = GAMES.filter((game) => game.status === 'coming-soon');
        // Sprint 1~4 完成后全部上线；允许 0 款 coming-soon
        pending.forEach((game) => {
            expect(game.loadModule).toBeUndefined();
        });
    });

    it('all listed games are currently marked available', () => {
        const available = listAvailableGames();
        expect(available.length).toBe(GAMES.length);
    });
});
