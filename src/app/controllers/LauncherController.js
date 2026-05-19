/**
 * 启动器控制器：渲染游戏选择卡片，路由用户到 setup/游戏界面。
 * 设计要点：
 * 1. 只消费 registry 元数据，不直接依赖具体游戏实现；
 * 2. 可用游戏点击后调用 loadModule() 动态加载并通过 enter() 进入；
 * 3. 敬请期待卡片点击时给出 toast 提示，不触发加载；
 * 4. 当前 session 已经加载的 gomoku 实例复用即可——不重复挂载 GomokuApp。
 * @module app/controllers/LauncherController
 */

import { listGames, findGame } from '../../games/registry.js';
import { i18n } from '../../utils/i18n.js';

const STORAGE_LAST_GAME = 'boardgames-last-game';
const TOPOLOGY_I18N_KEYS = {
    grid: 'launcherTopologyGrid',
    intersection: 'launcherTopologyIntersection',
    unique: 'launcherTopologyUnique'
};
const CATEGORY_I18N_KEYS = {
    abstract: 'launcherCategoryAbstract',
    strategy: 'launcherCategoryStrategy',
    'imperfect-info': 'launcherCategoryImperfectInfo'
};
const CAPABILITY_I18N_KEYS = {
    '3d-scene': 'launcherCapability3D',
    'llm-coach': 'launcherCapabilityCoach',
    'image-import': 'launcherCapabilityImport'
};

const PREVIEW_DOTS_BY_TOPOLOGY = {
    grid: 16,
    intersection: 25,
    unique: 18
};

export class LauncherController {
    /**
     * @param {Object} options
     * @param {Document|HTMLElement} [options.root=document] - DOM 查询根
     * @param {(gameId: string) => void} [options.onEnterGame] - 选中可用游戏时的回调（宿主决定如何挂载）
     * @param {(message: string) => void} [options.onToast] - 轻量提示（敬请期待）
     */
    constructor({ root = document, onEnterGame, onToast } = {}) {
        this.root = root;
        this.onEnterGame = typeof onEnterGame === 'function' ? onEnterGame : () => {};
        this.onToast = typeof onToast === 'function' ? onToast : () => {};
        this.panel = root.getElementById('launcher');
        this.grid = root.getElementById('launcher-grid');
        this.setupPanel = root.getElementById('setup');
        this.gamePanel = root.getElementById('game');
        this.open = false;
        this._onGridClick = (event) => this.handleGridClick(event);
        this._onI18nChange = () => this.renderGrid();
    }

    /**
     * 初始化：渲染卡片、绑定监听。
     * 如果 localStorage 中记录了上次选择的游戏，同样显示启动器（不自动跳过）以强调切换入口。
     */
    mount() {
        if (!this.panel || !this.grid) {
            return;
        }
        this.renderGrid();
        this.grid.addEventListener('click', this._onGridClick);
        i18n.onChange?.(this._onI18nChange);
    }

    dispose() {
        this.grid?.removeEventListener('click', this._onGridClick);
        i18n.offChange?.(this._onI18nChange);
    }

    /**
     * 显示启动器，隐藏 setup/游戏面板。
     */
    show() {
        if (!this.panel) return;
        this.open = true;
        this.panel.classList.remove('hidden');
        this.panel.setAttribute('aria-hidden', 'false');
        this.setupPanel?.classList.add('hidden');
        this.gamePanel?.classList.add('hidden');
        document.body.dataset.activeGame = '';
        document.body.classList.add('launcher-open');
        document.body.classList.remove('scene-game-active');
        document.body.classList.add('scene-setup-active');
    }

    /** 隐藏启动器（由宿主切换到 setup 后调用） */
    hide() {
        if (!this.panel) return;
        this.open = false;
        this.panel.classList.add('hidden');
        this.panel.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('launcher-open');
    }

    /**
     * 渲染卡片网格。i18n 切换时也会重新渲染。
     */
    renderGrid() {
        if (!this.grid) return;
        const fragment = document.createDocumentFragment();
        listGames().forEach((game, index) => {
            fragment.appendChild(this.buildCard(game, index));
        });
        this.grid.replaceChildren(fragment);
    }

    buildCard(game, index = 0) {
        const card = document.createElement('article');
        card.className = `launcher-card launcher-card-${game.id} status-${game.status}`;
        card.setAttribute('role', 'listitem');
        card.tabIndex = game.status === 'available' ? 0 : -1;
        card.dataset.gameId = game.id;
        card.dataset.topology = game.boardTopology || 'grid';
        card.dataset.category = game.category || 'strategy';
        card.dataset.index = String(index);
        card.style.setProperty('--launcher-accent', game.accent || '#e6b15b');
        card.style.setProperty('--launcher-accent-alt', game.accentAlt || game.accent || '#6f4b25');
        card.style.setProperty('--launcher-card-index', String(index));
        card.style.setProperty('--launcher-card-offset', `${(index - 2) * 4}px`);
        card.style.setProperty('--launcher-card-yaw', `${(2 - index) * 1.2}deg`);

        const badge = document.createElement('span');
        badge.className = 'launcher-card-badge';
        badge.textContent = i18n.t(
            game.status === 'available' ? 'launcherAvailableBadge' : 'launcherComingSoonBadge'
        );
        card.appendChild(badge);

        const glyph = document.createElement('div');
        glyph.className = 'launcher-card-glyph';
        glyph.setAttribute('aria-hidden', 'true');
        glyph.textContent = game.glyph || i18n.t(game.titleKey).slice(0, 1);
        card.appendChild(glyph);

        const preview = this.buildBoardPreview(game);
        card.appendChild(preview);

        const body = document.createElement('div');
        body.className = 'launcher-card-body';

        const meta = document.createElement('div');
        meta.className = 'launcher-card-meta';
        const category = CATEGORY_I18N_KEYS[game.category] || 'launcherCategoryStrategy';
        const topology = TOPOLOGY_I18N_KEYS[game.boardTopology] || 'launcherTopologyGrid';
        meta.textContent = `${i18n.t(category)} / ${i18n.t(topology)}`;
        body.appendChild(meta);

        const title = document.createElement('h2');
        title.className = 'launcher-card-title';
        title.textContent = i18n.t(game.titleKey);
        body.appendChild(title);

        const tagline = document.createElement('p');
        tagline.className = 'launcher-card-tagline';
        tagline.textContent = i18n.t(game.taglineKey);
        body.appendChild(tagline);

        if (Array.isArray(game.capabilities) && game.capabilities.length > 0) {
            const chips = document.createElement('div');
            chips.className = 'launcher-card-chips';
            game.capabilities.forEach((capability) => {
                const chip = document.createElement('span');
                chip.className = 'launcher-card-chip';
                chip.textContent = i18n.t(CAPABILITY_I18N_KEYS[capability] || capability);
                chips.appendChild(chip);
            });
            body.appendChild(chips);
        }

        card.appendChild(body);

        const action = document.createElement('button');
        action.type = 'button';
        action.className = game.status === 'available' ? 'primary-btn launcher-card-btn' : 'ghost-btn launcher-card-btn';
        action.dataset.gameId = game.id;
        action.disabled = game.status !== 'available';
        action.textContent = i18n.t(
            game.status === 'available' ? 'launcherEnter' : 'comingSoon'
        );
        card.appendChild(action);

        return card;
    }

    buildBoardPreview(game) {
        const topology = game.boardTopology || 'grid';
        const preview = document.createElement('div');
        preview.className = `launcher-card-board launcher-card-board-${topology}`;
        preview.setAttribute('aria-hidden', 'true');
        const dotCount = PREVIEW_DOTS_BY_TOPOLOGY[topology] || PREVIEW_DOTS_BY_TOPOLOGY.grid;
        const cols = topology === 'intersection' ? 5 : 4;
        for (let i = 0; i < dotCount; i += 1) {
            const dot = document.createElement('span');
            dot.className = 'launcher-card-board-dot';
            dot.style.setProperty('--dot-index', String(i));
            dot.style.setProperty('--dot-x', `${(i % cols) - (cols - 1) / 2}`);
            dot.style.setProperty('--dot-y', `${Math.floor(i / cols) - 2}`);
            preview.appendChild(dot);
        }
        return preview;
    }

    handleGridClick(event) {
        const target = event.target.closest('[data-game-id]');
        if (!target) return;
        const gameId = target.dataset.gameId;
        const game = findGame(gameId);
        if (!game) return;
        if (game.status !== 'available') {
            this.onToast(i18n.t('comingSoon'));
            return;
        }
        try {
            window.localStorage?.setItem(STORAGE_LAST_GAME, game.id);
        } catch {
            /* ignore */
        }
        this.hide();
        this.onEnterGame(game.id);
    }

    /**
     * 返回上次进入过的游戏 id（用于 setup back 按钮等）。
     * @returns {string|null}
     */
    getLastGameId() {
        try {
            return window.localStorage?.getItem(STORAGE_LAST_GAME) || null;
        } catch {
            return null;
        }
    }
}
