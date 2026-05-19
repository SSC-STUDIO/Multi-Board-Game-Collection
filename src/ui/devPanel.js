/**
 * 开发者面板：Ctrl+Shift+D 切换，显示实时 getDebugState() 快照 + LLM 请求日志。
 * 双重启用开关：localStorage.gomoku-devtools=1 或 URL ?dev=1。
 * @module ui/devPanel
 */

import { i18n } from '../utils/i18n.js';

const SNAPSHOT_INTERVAL_MS = 500;
const MAX_LOG_ENTRIES = 10;
const STORAGE_KEY = 'gomoku-devtools';

function shouldAutoOpen() {
    try {
        if (window.localStorage?.getItem(STORAGE_KEY) === '1') {
            return true;
        }
    } catch {
        /* ignore */
    }
    try {
        const url = new URL(window.location.href);
        if (url.searchParams.get('dev') === '1') {
            return true;
        }
    } catch {
        /* ignore */
    }
    return false;
}

/**
 * 挂载开发者面板到 body，监听全局快捷键。
 * @param {import('../app/GomokuApp.js').GomokuApp} app - 应用主实例
 * @returns {{ dispose(): void, toggle(): void, open(): void, close(): void }|null} 控制句柄，非浏览器环境返回 null
 */
export function mountDevPanel(app) {
    if (typeof document === 'undefined' || !document.body) {
        return null;
    }

    const state = {
        open: false,
        timer: null,
        rendered: false
    };

    const panel = document.createElement('section');
    panel.className = 'dev-panel hidden';
    panel.setAttribute('aria-hidden', 'true');

    const header = document.createElement('header');
    header.className = 'dev-panel-header';
    const title = document.createElement('span');
    title.className = 'dev-panel-title';
    title.textContent = i18n.t('devPanelTitle');
    header.appendChild(title);
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'dev-panel-close';
    closeBtn.setAttribute('aria-label', i18n.t('devPanelClose'));
    closeBtn.textContent = '×';
    header.appendChild(closeBtn);
    panel.appendChild(header);

    const snapshotSection = document.createElement('section');
    snapshotSection.className = 'dev-panel-section';
    const snapshotHeading = document.createElement('h3');
    snapshotHeading.className = 'dev-panel-heading';
    snapshotHeading.textContent = i18n.t('devPanelSnapshot');
    const snapshotPre = document.createElement('pre');
    snapshotPre.className = 'dev-panel-snapshot';
    snapshotSection.appendChild(snapshotHeading);
    snapshotSection.appendChild(snapshotPre);
    panel.appendChild(snapshotSection);

    const logSection = document.createElement('section');
    logSection.className = 'dev-panel-section';
    const logHeading = document.createElement('h3');
    logHeading.className = 'dev-panel-heading';
    logHeading.textContent = i18n.t('devPanelLlmLog');
    const logList = document.createElement('ul');
    logList.className = 'dev-panel-log';
    logSection.appendChild(logHeading);
    logSection.appendChild(logList);
    panel.appendChild(logSection);

    document.body.appendChild(panel);

    function renderSnapshot() {
        try {
            const debug = typeof app?.getDebugState === 'function'
                ? app.getDebugState()
                : null;
            snapshotPre.textContent = debug ? JSON.stringify(debug, null, 2) : '(no data)';
        } catch (error) {
            snapshotPre.textContent = `(snapshot error: ${error?.message || error})`;
        }
    }

    function renderLog() {
        const entries = Array.isArray(window.__llmRequestLog) ? window.__llmRequestLog : [];
        logList.replaceChildren();
        if (!entries.length) {
            const empty = document.createElement('li');
            empty.className = 'dev-panel-log-empty';
            empty.textContent = i18n.t('devPanelLlmEmpty');
            logList.appendChild(empty);
            return;
        }
        const recent = entries.slice(-MAX_LOG_ENTRIES).reverse();
        recent.forEach((entry) => {
            const item = document.createElement('li');
            item.className = `dev-panel-log-item status-${entry.status || 'unknown'}`;
            const endpoint = document.createElement('span');
            endpoint.className = 'dev-panel-log-endpoint';
            endpoint.textContent = entry.endpoint || 'unknown';
            const duration = document.createElement('span');
            duration.className = 'dev-panel-log-duration';
            duration.textContent = Number.isFinite(entry.durationMs)
                ? `${Math.round(entry.durationMs)}ms`
                : '—';
            const tokens = document.createElement('span');
            tokens.className = 'dev-panel-log-tokens';
            const inT = Number.isFinite(entry.tokensIn) ? entry.tokensIn : '—';
            const outT = Number.isFinite(entry.tokensOut) ? entry.tokensOut : '—';
            tokens.textContent = `in:${inT} out:${outT}`;
            const status = document.createElement('span');
            status.className = 'dev-panel-log-status';
            status.textContent = entry.status || 'unknown';
            item.appendChild(endpoint);
            item.appendChild(duration);
            item.appendChild(tokens);
            item.appendChild(status);
            logList.appendChild(item);
        });
    }

    function tick() {
        if (!state.open) return;
        renderSnapshot();
        renderLog();
    }

    function open() {
        if (state.open) return;
        state.open = true;
        panel.classList.remove('hidden');
        panel.setAttribute('aria-hidden', 'false');
        try {
            window.localStorage?.setItem(STORAGE_KEY, '1');
        } catch {
            /* ignore */
        }
        tick();
        state.timer = window.setInterval(tick, SNAPSHOT_INTERVAL_MS);
    }

    function close() {
        if (!state.open) return;
        state.open = false;
        panel.classList.add('hidden');
        panel.setAttribute('aria-hidden', 'true');
        if (state.timer !== null) {
            window.clearInterval(state.timer);
            state.timer = null;
        }
        try {
            window.localStorage?.removeItem(STORAGE_KEY);
        } catch {
            /* ignore */
        }
    }

    function toggle() {
        if (state.open) {
            close();
        } else {
            open();
        }
    }

    const onKeydown = (event) => {
        const isToggle = event.key === 'D'
            && event.shiftKey
            && (event.ctrlKey || event.metaKey);
        if (isToggle) {
            event.preventDefault();
            toggle();
        }
    };

    closeBtn.addEventListener('click', () => close());
    window.addEventListener('keydown', onKeydown);

    if (shouldAutoOpen()) {
        open();
    }

    return {
        open,
        close,
        toggle,
        dispose() {
            close();
            window.removeEventListener('keydown', onKeydown);
            if (panel.parentNode) {
                panel.parentNode.removeChild(panel);
            }
        }
    };
}
