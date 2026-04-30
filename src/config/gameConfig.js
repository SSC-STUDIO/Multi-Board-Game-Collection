export const DEFAULT_OPTIONS = {
    mode: 'pvp',
    rule: 'classic',
    size: 15,
    level: 'medium',
    playerColor: 'black',
    scene: 'competition'
};

export const MODE_LABELS = {
    pvp: '人人对战',
    pve: '人机对战',
    practice: '练习模式',
    qi: 'QI 指导'
};

export const RULE_LABELS = {
    classic: '经典规则',
    renju: '禁手规则'
};

export const SCENE_LABELS = {
    home: '家里',
    park: '公园',
    competition: '比赛现场'
};

export const PLAYER_LABELS = {
    black: '黑方',
    white: '白方'
};

export const GAME_INTRO_MESSAGES = {
    pvp: '人人对战已开始，黑方先行。',
    practice: '练习模式已开始，可自由落子与复盘。',
    qi: 'QI 指导已开始，每回合都会给出推荐点、原因和风险提醒。'
};

export const DIRECTIONS = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1]
];

export const FOUR_PATTERNS = ['.XXXX.', '.XXX.X.', '.XX.XX.', '.X.XXX.'];

export const THREE_PATTERNS = ['..XXX..', '..XX.X..', '..X.XX..', '.XXX..', '..XXX.', '.XX.X.', '.X.XX.'];

export const COLUMN_LABELS = 'ABCDEFGHJKLMNOPQRST';

export const AI_DELAY_BY_LEVEL = {
    easy: 280,
    medium: 420,
    hard: 680
};
