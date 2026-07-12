/**
 * 游戏配置
 * 包含游戏规则常量、默认选项、国际化键名、AI 难度延迟等全局配置
 * @module config/gameConfig
 */

/**
 * @typedef {Object} GameOptions
 * @property {'pvp'|'pve'|'practice'|'qi'} mode - 游戏模式
 * @property {'classic'|'renju'} rule - 规则模式
 * @property {number} size - 棋盘尺寸（通常为 15）
 * @property {'easy'|'medium'|'hard'} level - AI 难度等级
 * @property {'black'|'white'} playerColor - 玩家执子颜色
 * @property {'home'|'park'|'competition'} scene - 3D 场景预设
 */

/** @type {GameOptions} 默认游戏选项 */
export const DEFAULT_OPTIONS = {
    mode: 'pvp',
    rule: 'classic',
    size: 15,
    level: 'medium',
    playerColor: 'black',
    scene: 'competition'
};

// 标签已迁移至 i18n 翻译系统，通过 i18n.t('pvp') 等键名获取

/** @type {{ pvp: string, pve: string, practice: string, qi: string }} 游戏模式的 i18n 翻译键映射 */
export const MODE_I18N_KEYS = { pvp: 'pvp', pve: 'pve', practice: 'practice', qi: 'qi' };

/** @type {{ classic: string, renju: string }} 规则模式的 i18n 翻译键映射 */
export const RULE_I18N_KEYS = { classic: 'classic', renju: 'renju' };

/** @type {{ home: string, park: string, competition: string }} 场景预设的 i18n 翻译键映射 */
export const SCENE_I18N_KEYS = { home: 'sceneHome', park: 'scenePark', competition: 'sceneCompetition' };

/**
 * 方向偏移量：水平、垂直、主对角线、副对角线
 * 用于沿四个方向检测连子
 * @type {Array<[number, number]>}
 */
export const DIRECTIONS = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1]
];

/**
 * 四子匹配模式（用于四四禁手检测）
 * 点号 '.' 表示空位，'X' 表示同色棋子
 * @type {string[]}
 */
export const FOUR_PATTERNS = [
    '.XXXX.',       // 活四
    '.XXX.X.',      // 冲四
    '.XX.XX.',      // 冲四
    '.X.XXX.',      // 冲四
    'XXXX.',        // 边界冲四（左侧被堵）
    '.XXXX',        // 边界冲四（右侧被堵）
    'XX.XX',        // 边界冲四（中间有空位）
    'X.XXX',        // 边界冲四
    'XXX.X'         // 边界冲四
];

/**
 * 三子匹配模式（用于三三禁手检测）
 * 点号 '.' 表示空位，'X' 表示同色棋子
 * @type {string[]}
 */
export const THREE_PATTERNS = [
    '..XXX..',      // 活三
    '..XX.X..',     // 跳活三
    '..X.XX..',     // 跳活三
    '.XXX..',       // 眠三
    '..XXX.',       // 眠三
    '.XX.X.',       // 眠三
    '.X.XX.',       // 眠三
    'XXX..',        // 边界眠三
    '..XXX',        // 边界眠三
    'X.XX.',        // 边界眠三
    '.XX.X',        // 边界眠三
    'X..XX',        // 边界跳三
    'XX..X'         // 边界跳三
];

/**
 * 活三（open three）匹配模式（仅用于三三禁手检测）
 * 标准 Renju 规则：三三禁手仅适用于两个活三，不含眠三
 * @type {string[]}
 */
export const OPEN_THREE_PATTERNS = [
    '..XXX..',      // 活三
    '..XX.X..',     // 跳活三
    '..X.XX..'      // 跳活三
];

/**
 * 棋盘列标签（跳过字母 'I'，符合围棋/五子棋惯例）
 * @type {string}
 */
export const COLUMN_LABELS = 'ABCDEFGHJKLMNOPQRST';

/**
 * 各 AI 难度等级的落子延迟（毫秒），用于模拟思考时间
 * @type {Record<'easy'|'medium'|'hard', number>}
 */
export const AI_DELAY_BY_LEVEL = {
    easy: 280,
    medium: 420,
    hard: 680
};
