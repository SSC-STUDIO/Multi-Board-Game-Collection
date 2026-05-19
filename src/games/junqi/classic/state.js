import { createInitialBoard } from './rules.js';

export const DEFAULT_CLASSIC_OPTIONS = Object.freeze({
    mode: 'pve',
    level: 'medium',
    playerColor: 'r',
    templateIndex: 0,
    aiTemplateIndex: 1
});

export function createClassicOptions(overrides = {}) {
    return { ...DEFAULT_CLASSIC_OPTIONS, ...overrides };
}

export function createClassicState(options = {}) {
    const merged = createClassicOptions(options);
    return {
        options: merged,
        board: createInitialBoard(merged.templateIndex, merged.aiTemplateIndex),
        turn: 'r',
        playerColor: merged.playerColor,
        moveHistory: [],
        result: null,
        gameOver: false,
        aiThinking: false,
        lastBattle: null
    };
}
