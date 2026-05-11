import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../utils/i18n.js', () => ({
    i18n: { t: (key) => key },
    t: (key) => key
}));

import { showConfirm } from './confirmDialog.js';

/**
 * Minimal DOM emulation — confirmDialog only needs:
 * - document.createElement(tag) → node with appendChild / addEventListener / removeEventListener / classList / dataset / setAttribute
 * - document.body.appendChild / removeChild
 * - node.parentNode linkage so overlay.parentNode.removeChild(overlay) works
 */
function createStubDocument() {
    function makeNode(tag) {
        const listeners = new Map();
        const children = [];
        const node = {
            tag,
            children,
            parentNode: null,
            className: '',
            textContent: '',
            tabIndex: 0,
            dataset: {},
            style: {},
            attrs: {},
            classList: {
                _set: new Set(),
                add(c) { this._set.add(c); node.className = [...this._set].join(' '); },
                remove(c) { this._set.delete(c); node.className = [...this._set].join(' '); },
                contains(c) { return this._set.has(c); }
            },
            appendChild(child) {
                child.parentNode = node;
                children.push(child);
                return child;
            },
            removeChild(child) {
                const i = children.indexOf(child);
                if (i >= 0) children.splice(i, 1);
                child.parentNode = null;
                return child;
            },
            setAttribute(name, value) { node.attrs[name] = value; },
            getAttribute(name) { return node.attrs[name]; },
            addEventListener(type, handler) {
                if (!listeners.has(type)) listeners.set(type, new Set());
                listeners.get(type).add(handler);
            },
            removeEventListener(type, handler) {
                listeners.get(type)?.delete(handler);
            },
            dispatchEvent(event) {
                const set = listeners.get(event.type);
                if (!set) return;
                for (const fn of [...set]) {
                    fn(event);
                }
            },
            focus() { /* noop */ },
            closest(selector) {
                // 仅支持 [data-action] 选择器
                if (selector === '[data-action]') {
                    let cur = node;
                    while (cur) {
                        if (cur.dataset && cur.dataset.action) return cur;
                        cur = cur.parentNode;
                    }
                }
                return null;
            }
        };
        return node;
    }

    const doc = {
        createElement: (tag) => makeNode(tag),
        body: makeNode('body')
    };
    return doc;
}

function dispatchClick(node, target) {
    node.dispatchEvent({ type: 'click', target });
}

describe('showConfirm', () => {
    let doc;

    beforeEach(() => {
        doc = createStubDocument();
    });

    it('resolves true when confirm button is clicked', async () => {
        const promise = showConfirm({ doc, title: 't', message: 'm' });
        const overlay = doc.body.children[0];
        const card = overlay.children[0];
        // card: title, message, actions
        const actions = card.children[card.children.length - 1];
        const confirmBtn = actions.children.find((c) => c.dataset.action === 'confirm');
        dispatchClick(overlay, confirmBtn);
        await expect(promise).resolves.toBe(true);
        expect(doc.body.children).toHaveLength(0);
    });

    it('resolves false when cancel button is clicked', async () => {
        const promise = showConfirm({ doc, title: 't' });
        const overlay = doc.body.children[0];
        const card = overlay.children[0];
        const actions = card.children[card.children.length - 1];
        const cancelBtn = actions.children.find((c) => c.dataset.action === 'cancel');
        dispatchClick(overlay, cancelBtn);
        await expect(promise).resolves.toBe(false);
    });

    it('resolves false when clicking overlay background', async () => {
        const promise = showConfirm({ doc });
        const overlay = doc.body.children[0];
        dispatchClick(overlay, overlay);
        await expect(promise).resolves.toBe(false);
    });

    it('handles Enter (confirm) and Escape (cancel) keys', async () => {
        const confirmPromise = showConfirm({ doc });
        const overlay = doc.body.children[0];
        overlay.dispatchEvent({ type: 'keydown', key: 'Enter', preventDefault: () => {} });
        await expect(confirmPromise).resolves.toBe(true);

        const cancelPromise = showConfirm({ doc });
        const overlay2 = doc.body.children[0];
        overlay2.dispatchEvent({ type: 'keydown', key: 'Escape', preventDefault: () => {} });
        await expect(cancelPromise).resolves.toBe(false);
    });

    it('falls back to i18n defaults for labels', async () => {
        const promise = showConfirm({ doc });
        const overlay = doc.body.children[0];
        const card = overlay.children[0];
        const title = card.children[0];
        expect(title.textContent).toBe('coachConfirmTitle');
        const actions = card.children[card.children.length - 1];
        const cancelBtn = actions.children.find((c) => c.dataset.action === 'cancel');
        const okBtn = actions.children.find((c) => c.dataset.action === 'confirm');
        expect(cancelBtn.textContent).toBe('coachConfirmCancel');
        expect(okBtn.textContent).toBe('coachConfirmOk');
        dispatchClick(overlay, cancelBtn);
        await promise;
    });
});
