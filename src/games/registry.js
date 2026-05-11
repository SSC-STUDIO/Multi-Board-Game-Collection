/**
 * 多游戏启动器的注册表。
 * 每个棋类游戏（Gomoku、Go、Chess、Xiangqi、Junqi）以一个条目登记，包含标识、
 * 元数据、可用状态与懒加载的 enter() 工厂。
 * 启动器 UI 只消费元数据；真正进入游戏时才调用 enter() 把应用挂载到 DOM。
 * @module games/registry
 */

/**
 * @typedef {Object} GameEntry
 * @property {string} id - 唯一 id，用于 body.dataset.activeGame 与 localStorage
 * @property {string} titleKey - i18n 键：游戏中文/英文名
 * @property {string} taglineKey - i18n 键：一句话卖点
 * @property {string} category - 'abstract' | 'strategy' | 'imperfect-info'
 * @property {string} boardTopology - 'grid' | 'intersection' | 'unique'（用于描述渲染拓扑）
 * @property {'available'|'coming-soon'} status - 是否已实现
 * @property {string[]} [capabilities] - 可选能力标签：'llm-coach'、'image-import'、'3d-scene'
 * @property {string} [icon] - SVG 字符串或图片 URL（留空时启动器用首字母占位）
 * @property {string} [accent] - 卡片主色（CSS 颜色字符串），用于视觉区分
 * @property {() => Promise<any>} [loadModule] - 懒加载模块工厂；返回暴露 { enter(root, ctx) } 的模块
 */

/** @type {GameEntry[]} */
export const GAMES = [
    {
        id: 'gomoku',
        titleKey: 'gameGomokuTitle',
        taglineKey: 'gameGomokuTagline',
        category: 'abstract',
        boardTopology: 'intersection',
        status: 'available',
        capabilities: ['llm-coach', 'image-import', '3d-scene'],
        accent: '#e6b15b',
        loadModule: () => import('../app/GomokuApp.js').then((m) => ({
            enter(root) {
                // 兼容旧入口：直接实例化 GomokuApp。
                return new m.GomokuApp(root);
            }
        }))
    },
    {
        id: 'go',
        titleKey: 'gameGoTitle',
        taglineKey: 'gameGoTagline',
        category: 'abstract',
        boardTopology: 'intersection',
        status: 'available',
        capabilities: ['2d-scene'],
        accent: '#8aa9b8',
        loadModule: () => import('./go/GoApp.js').then((m) => ({
            enter(root) {
                return new m.GoApp(root);
            }
        }))
    },
    {
        id: 'chess',
        titleKey: 'gameChessTitle',
        taglineKey: 'gameChessTagline',
        category: 'abstract',
        boardTopology: 'grid',
        status: 'available',
        capabilities: ['2d-scene'],
        accent: '#c7c0ad',
        loadModule: () => import('./chess/ChessApp.js').then((m) => ({
            enter(root) {
                return new m.ChessApp(root);
            }
        }))
    },
    {
        id: 'xiangqi',
        titleKey: 'gameXiangqiTitle',
        taglineKey: 'gameXiangqiTagline',
        category: 'abstract',
        boardTopology: 'intersection',
        status: 'available',
        capabilities: ['2d-scene'],
        accent: '#d48a5b',
        loadModule: () => import('./xiangqi/XiangqiApp.js').then((m) => ({
            enter(root) {
                return new m.XiangqiApp(root);
            }
        }))
    },
    {
        id: 'junqi',
        titleKey: 'gameJunqiTitle',
        taglineKey: 'gameJunqiTagline',
        category: 'imperfect-info',
        boardTopology: 'unique',
        status: 'available',
        capabilities: ['2d-scene'],
        accent: '#7b8a6f',
        loadModule: () => import('./junqi/JunqiApp.js').then((m) => ({
            enter(root) {
                return new m.JunqiApp(root);
            }
        }))
    }
];

/**
 * 按 id 查找游戏条目。
 * @param {string} id
 * @returns {GameEntry|null}
 */
export function findGame(id) {
    return GAMES.find((game) => game.id === id) || null;
}

/**
 * 返回全部游戏条目（只读）。调用方不应修改结果数组。
 * @returns {GameEntry[]}
 */
export function listGames() {
    return GAMES.slice();
}

/**
 * 仅返回已上线可用的游戏。
 * @returns {GameEntry[]}
 */
export function listAvailableGames() {
    return GAMES.filter((game) => game.status === 'available');
}
