import { describe, it, expect } from 'vitest';
import {
    DEFAULT_OPTIONS,
    MODE_I18N_KEYS,
    RULE_I18N_KEYS,
    SCENE_I18N_KEYS,
    DIRECTIONS,
    FOUR_PATTERNS,
    THREE_PATTERNS,
    COLUMN_LABELS,
    AI_DELAY_BY_LEVEL,
} from './gameConfig.js';

// ---------------------------------------------------------------------------
// DEFAULT_OPTIONS
// ---------------------------------------------------------------------------
describe('DEFAULT_OPTIONS', () => {
    it('should have all required fields', () => {
        expect(DEFAULT_OPTIONS).toHaveProperty('mode');
        expect(DEFAULT_OPTIONS).toHaveProperty('rule');
        expect(DEFAULT_OPTIONS).toHaveProperty('size');
        expect(DEFAULT_OPTIONS).toHaveProperty('level');
        expect(DEFAULT_OPTIONS).toHaveProperty('playerColor');
        expect(DEFAULT_OPTIONS).toHaveProperty('scene');
    });

    it('should default to pvp mode', () => {
        expect(DEFAULT_OPTIONS.mode).toBe('pvp');
    });

    it('should default to classic rules', () => {
        expect(DEFAULT_OPTIONS.rule).toBe('classic');
    });

    it('should default to 15×15 board', () => {
        expect(DEFAULT_OPTIONS.size).toBe(15);
    });

    it('should default to medium AI level', () => {
        expect(DEFAULT_OPTIONS.level).toBe('medium');
    });

    it('should default to black (first move)', () => {
        expect(DEFAULT_OPTIONS.playerColor).toBe('black');
    });

    it('should default to competition scene', () => {
        expect(DEFAULT_OPTIONS.scene).toBe('competition');
    });
});

// ---------------------------------------------------------------------------
// I18N key maps
// ---------------------------------------------------------------------------
describe('MODE_I18N_KEYS', () => {
    it('should cover all four modes', () => {
        expect(Object.keys(MODE_I18N_KEYS).sort()).toEqual(['practice', 'pve', 'pvp', 'qi']);
    });

    it('should map each mode to its own i18n key', () => {
        for (const [mode, key] of Object.entries(MODE_I18N_KEYS)) {
            expect(key).toBe(mode);
        }
    });
});

describe('RULE_I18N_KEYS', () => {
    it('should cover classic and renju', () => {
        expect(Object.keys(RULE_I18N_KEYS).sort()).toEqual(['classic', 'renju']);
    });
});

describe('SCENE_I18N_KEYS', () => {
    it('should cover all three scenes', () => {
        expect(Object.keys(SCENE_I18N_KEYS).sort()).toEqual(['competition', 'home', 'park']);
    });

    it('should map to sceneHome / scenePark / sceneCompetition', () => {
        expect(SCENE_I18N_KEYS.home).toBe('sceneHome');
        expect(SCENE_I18N_KEYS.park).toBe('scenePark');
        expect(SCENE_I18N_KEYS.competition).toBe('sceneCompetition');
    });
});

// ---------------------------------------------------------------------------
// DIRECTIONS
// ---------------------------------------------------------------------------
describe('DIRECTIONS', () => {
    it('should have exactly 4 direction vectors', () => {
        expect(DIRECTIONS).toHaveLength(4);
    });

    it('should cover horizontal, vertical, and both diagonals', () => {
        expect(DIRECTIONS).toContainEqual([1, 0]);
        expect(DIRECTIONS).toContainEqual([0, 1]);
        expect(DIRECTIONS).toContainEqual([1, 1]);
        expect(DIRECTIONS).toContainEqual([1, -1]);
    });

    it('should be pairs of integers', () => {
        for (const [dr, dc] of DIRECTIONS) {
            expect(Number.isInteger(dr)).toBe(true);
            expect(Number.isInteger(dc)).toBe(true);
        }
    });
});

// ---------------------------------------------------------------------------
// FOUR_PATTERNS
// ---------------------------------------------------------------------------
describe('FOUR_PATTERNS', () => {
    it('should be a non-empty array of strings', () => {
        expect(Array.isArray(FOUR_PATTERNS)).toBe(true);
        expect(FOUR_PATTERNS.length).toBeGreaterThan(0);
        for (const p of FOUR_PATTERNS) {
            expect(typeof p).toBe('string');
        }
    });

    it('each pattern should contain exactly 4 X characters', () => {
        for (const p of FOUR_PATTERNS) {
            const xCount = (p.match(/X/g) || []).length;
            expect(xCount).toBe(4);
        }
    });

    it('each pattern should contain only X and . characters', () => {
        for (const p of FOUR_PATTERNS) {
            expect(p).toMatch(/^[X.]+$/);
        }
    });
});

// ---------------------------------------------------------------------------
// THREE_PATTERNS
// ---------------------------------------------------------------------------
describe('THREE_PATTERNS', () => {
    it('should be a non-empty array of strings', () => {
        expect(Array.isArray(THREE_PATTERNS)).toBe(true);
        expect(THREE_PATTERNS.length).toBeGreaterThan(0);
        for (const p of THREE_PATTERNS) {
            expect(typeof p).toBe('string');
        }
    });

    it('each pattern should contain exactly 3 X characters', () => {
        for (const p of THREE_PATTERNS) {
            const xCount = (p.match(/X/g) || []).length;
            expect(xCount).toBe(3);
        }
    });

    it('each pattern should contain only X and . characters', () => {
        for (const p of THREE_PATTERNS) {
            expect(p).toMatch(/^[X.]+$/);
        }
    });
});

// ---------------------------------------------------------------------------
// COLUMN_LABELS
// ---------------------------------------------------------------------------
describe('COLUMN_LABELS', () => {
    it('should have 19 characters (A–T, skipping I)', () => {
        expect(COLUMN_LABELS).toHaveLength(19);
    });

    it('should start with A-H', () => {
        expect(COLUMN_LABELS.slice(0, 8)).toBe('ABCDEFGH');
    });

    it('should skip letter I (standard Go convention)', () => {
        expect(COLUMN_LABELS).not.toContain('I');
    });

    it('should continue with J after H', () => {
        expect(COLUMN_LABELS[8]).toBe('J');
    });

    it('should end with T at index 18', () => {
        expect(COLUMN_LABELS[18]).toBe('T');
    });

    it('should contain no duplicate letters', () => {
        const unique = new Set(COLUMN_LABELS.split(''));
        expect(unique.size).toBe(COLUMN_LABELS.length);
    });
});

// ---------------------------------------------------------------------------
// AI_DELAY_BY_LEVEL
// ---------------------------------------------------------------------------
describe('AI_DELAY_BY_LEVEL', () => {
    it('should cover all three difficulty levels', () => {
        expect(Object.keys(AI_DELAY_BY_LEVEL).sort()).toEqual(['easy', 'hard', 'medium']);
    });

    it('should have positive delays for all levels', () => {
        for (const delay of Object.values(AI_DELAY_BY_LEVEL)) {
            expect(delay).toBeGreaterThan(0);
        }
    });

    it('should have increasing delay from easy → medium → hard', () => {
        expect(AI_DELAY_BY_LEVEL.easy).toBeLessThan(AI_DELAY_BY_LEVEL.medium);
        expect(AI_DELAY_BY_LEVEL.medium).toBeLessThan(AI_DELAY_BY_LEVEL.hard);
    });
});
