import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../audio/SoundManager.js', () => ({
    SoundManager: class { play() {} dispose() {} }
}));
vi.mock('../utils/i18n.js', () => ({
    i18n: { t: (key) => key }
}));

import { BoardGameApp } from './BoardGameApp.js';

function createFakeDomSet() {
    const node = () => {
        const el = {
            classList: {
                _set: new Set(),
                add(...cls) { cls.forEach((c) => el.classList._set.add(c)); },
                remove(...cls) { cls.forEach((c) => el.classList._set.delete(c)); },
                toggle(c, force) {
                    const has = el.classList._set.has(c);
                    const next = force === undefined ? !has : Boolean(force);
                    if (next) el.classList._set.add(c); else el.classList._set.delete(c);
                    return next;
                },
                contains(c) { return el.classList._set.has(c); }
            },
            setAttribute: vi.fn(),
            addEventListener: vi.fn(),
            textContent: '',
            className: ''
        };
        return el;
    };
    return { node };
}

class TestApp extends BoardGameApp {
    constructor(domBuilder, options = {}) {
        const log = [];
        const hooks = {
            queryDom: vi.fn(() => domBuilder()),
            createInitialState: vi.fn(() => ({ gameOver: false, log })),
            bindSetupEvents: vi.fn(),
            bindGameEvents: vi.fn(),
            startGameImpl: vi.fn(() => log.push('startGameImpl')),
            renderBoard: vi.fn(() => log.push('renderBoard')),
            renderStatus: vi.fn(() => log.push('renderStatus')),
            getAIMove: vi.fn(() => null),
            getAIDelay: vi.fn(() => 10),
            commitMove: vi.fn(),
            checkGameEnd: vi.fn(),
            isHumanTurn: vi.fn(() => true),
            formatResult: vi.fn(() => ({ badge: '', title: '', detail: '' })),
            refreshSetupVisibility: vi.fn(),
            onResign: vi.fn(),
            postFormatResult: vi.fn()
        };
        // 临时占位让 super() 不炸
        const fakeRoot = {};
        super(fakeRoot, options);
        this._log = log;
        this._hooks = hooks;
    }

    // 基类构造函数会先调用子类 hook。为此我们在 super 之前无法设 this._hooks，
    // 这里直接重写 hook 让它们使用可追踪对象。
    queryDom() {
        if (!this._fakeDom) {
            const { node } = createFakeDomSet();
            this._fakeDom = {
                root: node(),
                setup: { panel: node() },
                game: { panel: node(), message: node() },
                result: { overlay: node(), badge: node(), title: node(), detail: node() }
            };
        }
        return this._fakeDom;
    }
    createInitialState() { return { gameOver: false }; }
    bindSetupEvents() {}
    bindGameEvents() {}
    startGameImpl() { (this._log ||= []).push('startGameImpl'); }
    renderBoard() { (this._log ||= []).push('renderBoard'); }
    renderStatus() { (this._log ||= []).push('renderStatus'); }
    getAIMove() { return null; }
    getAIDelay() { return 10; }
    isHumanTurn() { return true; }
    formatResult() { return { badge: 'b', title: 't', detail: 'd' }; }
}

describe('BoardGameApp', () => {
    beforeEach(() => {
        globalThis.window = { setTimeout: () => 1, clearTimeout: () => {} };
        globalThis.document = {
            body: {
                classList: { add() {}, remove() {}, toggle() {} }
            }
        };
    });

    it('构造时进入 setup 模式', () => {
        const app = new TestApp();
        expect(app.state).toBeNull();
        // 进入 setup 后 game.panel 应被 hidden
        expect(app.dom.game.panel.classList.contains('hidden')).toBe(true);
    });

    it('startGame 调用 createInitialState / startGameImpl / renderBoard / renderStatus', () => {
        const app = new TestApp();
        app._log = [];
        app.startGame();
        expect(app._log).toEqual(['startGameImpl', 'renderBoard', 'renderStatus']);
        expect(app.state).not.toBeNull();
    });

    it('restart 等价于 startGame', () => {
        const app = new TestApp();
        app.startGame();
        app._log = [];
        app.restart();
        expect(app._log).toEqual(['startGameImpl', 'renderBoard', 'renderStatus']);
    });

    it('resign 设置 gameOver 并调用 onResign', () => {
        class ResignApp extends TestApp {
            onResign() { this.state.result = { type: 'resign' }; }
        }
        const app = new ResignApp();
        app.startGame();
        app.resign();
        expect(app.state.gameOver).toBe(true);
        expect(app.state.result?.type).toBe('resign');
        expect(app.dom.result.overlay.classList.contains('hidden')).toBe(false);
    });

    it('gameOver 状态下重复 resign 不重复触发', () => {
        const app = new TestApp();
        app.startGame();
        app.state.gameOver = true;
        const spy = vi.spyOn(app, 'showResult');
        app.resign();
        expect(spy).not.toHaveBeenCalled();
    });

    it('maybeScheduleAI 在 pvp 模式下不触发', () => {
        const app = new TestApp();
        app.options = { mode: 'pvp' };
        app.startGame();
        const spy = vi.spyOn(app, 'scheduleAIMove');
        app.maybeScheduleAI();
        expect(spy).not.toHaveBeenCalled();
    });

    it('maybeScheduleAI 在人类回合时不触发', () => {
        const app = new TestApp();
        app.options = { mode: 'pve' };
        app.startGame();
        // TestApp.isHumanTurn 始终 true
        const spy = vi.spyOn(app, 'scheduleAIMove');
        app.maybeScheduleAI();
        expect(spy).not.toHaveBeenCalled();
    });

    it('formatResult 返回值写入 result DOM', () => {
        const app = new TestApp();
        app.startGame();
        app.state.result = { type: 'mock' };
        app.showResult();
        expect(app.dom.result.badge.textContent).toBe('b');
        expect(app.dom.result.title.textContent).toBe('t');
        expect(app.dom.result.detail.textContent).toBe('d');
    });

    it('没有 state.result 时 showResult 不生效', () => {
        const app = new TestApp();
        app.startGame();
        app.state.result = null;
        app.dom.result.overlay.classList.add('hidden');
        app.showResult();
        expect(app.dom.result.overlay.classList.contains('hidden')).toBe(true);
    });

    it('dispose 调用 sound.dispose 与 hideRoot', () => {
        const app = new TestApp();
        app.startGame();
        const soundSpy = vi.spyOn(app.sound, 'dispose');
        app.dispose();
        expect(soundSpy).toHaveBeenCalled();
        expect(app.dom.root.classList.contains('hidden')).toBe(true);
    });
    it('exposes render_game_to_text for the active board game', () => {
        const app = new TestApp();
        app.startGame();
        const payload = JSON.parse(window.render_game_to_text());
        expect(payload.game).toBe('test');
        expect(payload.screen).toBe('game');
        expect(payload.moveCount).toBe(0);
    });

    it('dispose only clears hooks owned by this app', () => {
        const app = new TestApp();
        app.showRoot();
        app.dispose();
        expect(window.render_game_to_text).toBeUndefined();

        const otherHook = () => '{}';
        window.render_game_to_text = otherHook;
        app.dispose();
        expect(window.render_game_to_text).toBe(otherHook);
    });
});
