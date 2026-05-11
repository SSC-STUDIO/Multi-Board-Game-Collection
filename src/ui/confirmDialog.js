/**
 * 可复用的 Promise 化自定义确认对话框。
 * 替代 window.confirm，复用 `.result-overlay` 玻璃风格，
 * 保证 Electron/Web/Android 上表现一致。
 * @module ui/confirmDialog
 */

import { i18n } from '../utils/i18n.js';

/**
 * 展示一个确认对话框，返回 Promise<boolean>。
 * @param {Object} options
 * @param {string} [options.title] - 标题文本
 * @param {string} [options.message] - 正文消息
 * @param {string} [options.confirmLabel] - 确认按钮文本
 * @param {string} [options.cancelLabel] - 取消按钮文本
 * @param {Document} [options.doc] - 可选 document，便于测试注入
 * @returns {Promise<boolean>} 用户是否确认
 */
export function showConfirm({
    title = '',
    message = '',
    confirmLabel = '',
    cancelLabel = '',
    doc = (typeof document !== 'undefined' ? document : null)
} = {}) {
    if (!doc || !doc.body) {
        return Promise.resolve(false);
    }

    const resolvedTitle = title || i18n.t('coachConfirmTitle');
    const resolvedMessage = message || '';
    const resolvedConfirm = confirmLabel || i18n.t('coachConfirmOk');
    const resolvedCancel = cancelLabel || i18n.t('coachConfirmCancel');

    return new Promise((resolve) => {
        const overlay = doc.createElement('div');
        overlay.className = 'confirm-overlay';
        overlay.setAttribute('role', 'presentation');

        const card = doc.createElement('div');
        card.className = 'confirm-card glass-panel';
        card.setAttribute('role', 'dialog');
        card.setAttribute('aria-modal', 'true');

        const h = doc.createElement('h2');
        h.className = 'confirm-title';
        h.textContent = resolvedTitle;
        card.appendChild(h);

        if (resolvedMessage) {
            const p = doc.createElement('p');
            p.className = 'confirm-message';
            p.textContent = resolvedMessage;
            card.appendChild(p);
        }

        const actions = doc.createElement('div');
        actions.className = 'confirm-actions';

        const cancelBtn = doc.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'ghost-btn confirm-btn';
        cancelBtn.dataset.action = 'cancel';
        cancelBtn.textContent = resolvedCancel;
        actions.appendChild(cancelBtn);

        const okBtn = doc.createElement('button');
        okBtn.type = 'button';
        okBtn.className = 'primary-btn confirm-btn';
        okBtn.dataset.action = 'confirm';
        okBtn.textContent = resolvedConfirm;
        actions.appendChild(okBtn);

        card.appendChild(actions);
        overlay.appendChild(card);

        let settled = false;
        const finish = (value) => {
            if (settled) return;
            settled = true;
            overlay.removeEventListener('click', onOverlayClick);
            overlay.removeEventListener('keydown', onKeydown);
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
            resolve(value);
        };

        const onOverlayClick = (event) => {
            const action = event.target?.closest?.('[data-action]')?.dataset?.action;
            if (action === 'confirm') {
                finish(true);
                return;
            }
            if (action === 'cancel') {
                finish(false);
                return;
            }
            // 点击遮罩空白处视为取消
            if (event.target === overlay) {
                finish(false);
            }
        };

        const onKeydown = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                finish(false);
            } else if (event.key === 'Enter') {
                event.preventDefault();
                finish(true);
            }
        };

        overlay.addEventListener('click', onOverlayClick);
        overlay.addEventListener('keydown', onKeydown);
        overlay.tabIndex = -1;

        doc.body.appendChild(overlay);
        try {
            okBtn.focus();
        } catch {
            /* ignore focus errors in headless environments */
        }
    });
}
