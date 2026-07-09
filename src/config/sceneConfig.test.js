import { describe, it, expect } from 'vitest';
import { SCENE_SPECS, getSceneSpec, getSceneAmbienceCue } from './sceneConfig.js';

describe('config/sceneConfig', () => {
    describe('SCENE_SPECS', () => {
        it('defines home, park, and competition presets', () => {
            expect(Object.keys(SCENE_SPECS).sort()).toEqual(['competition', 'home', 'park']);
        });

        it('every preset has an i18nKey and ambience cues', () => {
            for (const [name, spec] of Object.entries(SCENE_SPECS)) {
                expect(spec.i18nKey, `${name} i18nKey`).toBeTruthy();
                expect(spec.ambience, `${name} ambience`).toBeDefined();
                expect(spec.ambience.setup, `${name} setup ambience`).toBeTruthy();
                expect(spec.ambience.active, `${name} active ambience`).toBeTruthy();
                expect(spec.ambience.thinking, `${name} thinking ambience`).toBeTruthy();
                expect(spec.ambience.finished, `${name} finished ambience`).toBeTruthy();
            }
        });
    });

    describe('getSceneSpec', () => {
        it('returns the requested preset', () => {
            expect(getSceneSpec('home')).toBe(SCENE_SPECS.home);
            expect(getSceneSpec('park')).toBe(SCENE_SPECS.park);
            expect(getSceneSpec('competition')).toBe(SCENE_SPECS.competition);
        });

        it('defaults to competition when preset is unknown', () => {
            expect(getSceneSpec('unknown')).toBe(SCENE_SPECS.competition);
        });

        it('defaults to competition when no argument is given', () => {
            expect(getSceneSpec()).toBe(SCENE_SPECS.competition);
        });
    });

    describe('getSceneAmbienceCue', () => {
        it('returns setup cue during setup presentation mode', () => {
            const cue = getSceneAmbienceCue('home', 'setup');
            expect(cue).toBe(SCENE_SPECS.home.ambience.setup);
        });

        it('returns finished cue when gameOver is true', () => {
            const cue = getSceneAmbienceCue('park', 'game', { gameOver: true });
            expect(cue).toBe(SCENE_SPECS.park.ambience.finished);
        });

        it('gameOver takes precedence over aiThinking', () => {
            const cue = getSceneAmbienceCue('competition', 'game', { aiThinking: true, gameOver: true });
            expect(cue).toBe(SCENE_SPECS.competition.ambience.finished);
        });

        it('returns thinking cue when aiThinking is true and game is not over', () => {
            const cue = getSceneAmbienceCue('home', 'game', { aiThinking: true });
            expect(cue).toBe(SCENE_SPECS.home.ambience.thinking);
        });

        it('returns active cue during normal gameplay', () => {
            const cue = getSceneAmbienceCue('park', 'game');
            expect(cue).toBe(SCENE_SPECS.park.ambience.active);
        });

        it('setup mode ignores aiThinking/gameOver flags', () => {
            const cue = getSceneAmbienceCue('competition', 'setup', { aiThinking: true, gameOver: true });
            expect(cue).toBe(SCENE_SPECS.competition.ambience.setup);
        });

        it('falls back to competition when scene preset is unknown', () => {
            const cue = getSceneAmbienceCue('nope', 'game', { aiThinking: true });
            expect(cue).toBe(SCENE_SPECS.competition.ambience.thinking);
        });
    });
});
