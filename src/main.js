/**
 * 浏览器入口模块。
 * 渲染多游戏启动器（Launcher），按需懒加载对应游戏模块。
 * Gomoku 保持向后兼容：当用户选择"五子棋"时，实例化 GomokuApp，后续表现与旧入口一致。
 * @module main
 */

import { LauncherController } from './app/controllers/LauncherController.js';
import { findGame } from './games/registry.js';

/** @type {LauncherController|null} */
let launcher = null;
/** @type {Map<string, any>} 已加载的游戏实例，避免重复创建 */
const activeGames = new Map();

function showTransientToast(message) {
    const existing = document.getElementById('launcher-toast');
    if (existing) {
        existing.remove();
    }
    const toast = document.createElement('div');
    toast.id = 'launcher-toast';
    toast.className = 'launcher-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    window.setTimeout(() => {
        toast.classList.add('launcher-toast-out');
        window.setTimeout(() => toast.remove(), 240);
    }, 1800);
}

async function enterGame(gameId) {
    const game = findGame(gameId);
    if (!game || game.status !== 'available' || !game.loadModule) {
        showTransientToast(game?.titleKey ? gameId : 'Unknown game');
        launcher?.show();
        return;
    }

    // 先隐藏其他已加载游戏的 root，避免面板叠加显示。
    for (const [id, inst] of activeGames.entries()) {
        if (id !== gameId) inst?.hideRoot?.();
    }

    document.body.dataset.activeGame = gameId;

    const existing = activeGames.get(gameId);
    if (existing) {
        // 已加载：直接复用，确保 setup 面板可见
        existing.__reenter?.();
        return;
    }

    try {
        const mod = await game.loadModule();
        const instance = mod.enter(document);
        activeGames.set(gameId, instance);
    } catch (error) {
        console.error('[Launcher] failed to load game:', gameId, error);
        showTransientToast(`Failed to load ${gameId}`);
        launcher?.show();
    }
}

function showLauncher() {
    document.body.dataset.activeGame = '';
    launcher?.show();
}

document.addEventListener('DOMContentLoaded', () => {
    launcher = new LauncherController({
        root: document,
        onEnterGame: enterGame,
        onToast: showTransientToast
    });
    launcher.mount();
    launcher.show();

    // 供 setup 面板的"返回选择"按钮使用：任何游戏实例都可以调用它回启动器。
    window.__returnToLauncher = () => {
        // 让当前游戏实例有机会自我清理（如返回 setup 或清计时器），然后隐藏其 root。
        const currentGameId = document.body.dataset.activeGame;
        const instance = currentGameId ? activeGames.get(currentGameId) : null;
        instance?.enterSetupQuiet?.();
        instance?.hideRoot?.();
        showLauncher();
    };
});
