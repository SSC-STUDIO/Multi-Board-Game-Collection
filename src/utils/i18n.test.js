import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks – must be set before the module is imported because the i18n singleton
// is created at import time and its constructor calls detectLanguage(), which
// reads localStorage and navigator.language.
// ---------------------------------------------------------------------------

const localStorageMock = (() => {
    const store = {};
    return {
        getItem: vi.fn((k) => store[k] ?? null),
        setItem: vi.fn((k, v) => { store[k] = v; }),
        removeItem: vi.fn((k) => { delete store[k]; }),
        clear: vi.fn(() => { for (const k of Object.keys(store)) delete store[k]; }),
    };
})();
vi.stubGlobal('localStorage', localStorageMock);

vi.stubGlobal('navigator', { language: 'zh-CN' });

// Minimal DOM stubs for updateDOM
vi.stubGlobal('document', {
    documentElement: { lang: '' },
    querySelectorAll: vi.fn(() => []),
});

// fetch mock for loadTranslations
vi.stubGlobal('fetch', vi.fn());

// ---------------------------------------------------------------------------
// Import after mocks are in place
// ---------------------------------------------------------------------------
const { i18n, t } = await import('./i18n.js');

// ---------------------------------------------------------------------------
// t() – basic translation lookup
// ---------------------------------------------------------------------------
describe('i18n.t()', () => {
    beforeEach(() => {
        i18n.setLanguage('zh');
    });

    it('should return the zh translation for a known key', () => {
        expect(i18n.t('appTitle')).toBe('多棋类合集 · Board Games');
    });

    it('should return the en translation when locale is en', () => {
        i18n.setLanguage('en');
        expect(i18n.t('appTitle')).toBe('Board Games Collection');
    });

    it('should interpolate {param} placeholders', () => {
        i18n.setLanguage('en');
        const result = i18n.t('selectedMoveConfirm', { move: 'H8' });
        expect(result).toBe('Selected H8. Confirm to place the stone.');
    });

    it('should leave unknown placeholder keys as-is', () => {
        const result = i18n.t('appTitle', { missing: 'X' });
        expect(result).toBe('多棋类合集 · Board Games');
    });

    it('should return the key itself when key is not found in any locale', () => {
        expect(i18n.t('nonexistent.key.xyz')).toBe('nonexistent.key.xyz');
    });

    it('should fall back to English when key is missing in current non-English locale', () => {
        i18n.setLanguage('zh');
        // Remove remote translations to test built-in fallback
        i18n.remoteTranslations = {};
        i18n.flatRemoteTranslations = {};
        // "black" exists in both zh and en – test with a key that would only
        // matter if zh was missing. Use the built-in fallback path by picking
        // a key only present in en (simulated via remote).
        // Instead, verify English fallback by temporarily clearing zh translations.
        const savedZh = i18n.translations.zh;
        i18n.translations.zh = {};
        try {
            expect(i18n.t('black')).toBe('Black');
        } finally {
            i18n.translations.zh = savedZh;
        }
    });
});

// ---------------------------------------------------------------------------
// t() – plural forms
// ---------------------------------------------------------------------------
describe('i18n.t() plural forms', () => {
    beforeEach(() => {
        i18n.remoteTranslations = {};
        i18n.flatRemoteTranslations = {};
    });

    it('should select "one" form for count=1 when the value is a plural object', () => {
        i18n.remoteTranslations.en = { item: { one: '{count} item', other: '{count} items' } };
        i18n.flatRemoteTranslations.en = {};
        const result = i18n.t('item', { count: 1 });
        expect(result).toBe('1 item');
    });

    it('should select "other" form for count=0', () => {
        i18n.remoteTranslations.en = { item: { one: '{count} item', other: '{count} items' } };
        i18n.flatRemoteTranslations.en = {};
        const result = i18n.t('item', { count: 0 });
        expect(result).toBe('0 items');
    });

    it('should select "other" form when count is absent', () => {
        i18n.remoteTranslations.en = { item: { one: '{count} item', other: '{count} items' } };
        i18n.flatRemoteTranslations.en = {};
        const result = i18n.t('item');
        expect(result).toBe('{count} items');
    });
});

// ---------------------------------------------------------------------------
// interpolate
// ---------------------------------------------------------------------------
describe('i18n.interpolate()', () => {
    it('should replace all occurrences of {key}', () => {
        const out = i18n.interpolate('{a} and {a} or {b}', { a: 'X', b: 'Y' });
        expect(out).toBe('X and X or Y');
    });

    it('should keep {key} if param is undefined', () => {
        expect(i18n.interpolate('{missing}', {})).toBe('{missing}');
    });

    it('should handle text with no placeholders', () => {
        expect(i18n.interpolate('plain', { x: 1 })).toBe('plain');
    });
});

// ---------------------------------------------------------------------------
// setLanguage / getLanguage
// ---------------------------------------------------------------------------
describe('i18n.setLanguage / getLanguage', () => {
    it('should switch to a known language and persist to localStorage', () => {
        i18n.setLanguage('en');
        expect(i18n.getLanguage()).toBe('en');
        expect(localStorageMock.setItem).toHaveBeenCalledWith('gomoku-lang', 'en');
    });

    it('should not switch to an unknown language', () => {
        i18n.setLanguage('en');
        i18n.setLanguage('xx');
        expect(i18n.getLanguage()).toBe('en');
    });
});

// ---------------------------------------------------------------------------
// onChange / offChange
// ---------------------------------------------------------------------------
describe('i18n listener management', () => {
    it('should call registered listeners when language changes', () => {
        const spy = vi.fn();
        i18n.onChange(spy);
        i18n.setLanguage('zh');
        expect(spy).toHaveBeenCalledWith('zh');
        i18n.offChange(spy);
    });

    it('should not call removed listeners', () => {
        const spy = vi.fn();
        i18n.onChange(spy);
        i18n.offChange(spy);
        i18n.setLanguage('en');
        expect(spy).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// loadTranslations
// ---------------------------------------------------------------------------
describe('i18n.loadTranslations()', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should store fetched translations and flatten them', async () => {
        const nested = { greeting: { hello: 'Hello Remote' } };
        globalThis.fetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(nested),
        });

        const result = await i18n.loadTranslations('en');
        expect(result).toBe(true);
        expect(i18n.remoteTranslations.en).toEqual(nested);
        expect(i18n.flatRemoteTranslations.en.hello).toBe('Hello Remote');
    });

    it('should return false when fetch fails', async () => {
        globalThis.fetch.mockResolvedValueOnce({ ok: false });
        const result = await i18n.loadTranslations('zz');
        expect(result).toBe(false);
    });

    it('should return false when fetch throws', async () => {
        globalThis.fetch.mockRejectedValueOnce(new Error('network'));
        const result = await i18n.loadTranslations('zz');
        expect(result).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// t() – remote translation priority
// ---------------------------------------------------------------------------
describe('i18n.t() with remote translations', () => {
    it('should prefer remote translation over built-in', () => {
        i18n.remoteTranslations.zh = { appTitle: '远程标题' };
        i18n.flatRemoteTranslations.zh = { appTitle: '远程标题' };
        i18n.setLanguage('zh');
        expect(i18n.t('appTitle')).toBe('远程标题');
        // cleanup
        i18n.remoteTranslations = {};
        i18n.flatRemoteTranslations = {};
    });
});

// ---------------------------------------------------------------------------
// Bound export `t`
// ---------------------------------------------------------------------------
describe('exported t()', () => {
    it('should work identically to i18n.t()', () => {
        i18n.setLanguage('zh');
        expect(t('appTitle')).toBe(i18n.t('appTitle'));
    });
});
