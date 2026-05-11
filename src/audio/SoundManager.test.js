import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Web Audio API mocks – lightweight stubs for AudioContext graph primitives
// ---------------------------------------------------------------------------

const mockGainParam = () => ({
    value: 0,
    setValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
    setTargetAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
});

const mockGainNode = () => ({
    gain: mockGainParam(),
    connect: vi.fn(),
    disconnect: vi.fn(),
});

const mockOscillatorNode = () => ({
    type: 'sine',
    frequency: mockGainParam(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
});

const mockBiquadFilter = () => ({
    type: 'lowpass',
    frequency: { value: 0 },
    connect: vi.fn(),
    disconnect: vi.fn(),
});

const mockStereoPanner = () => ({
    pan: mockGainParam(),
    connect: vi.fn(),
    disconnect: vi.fn(),
});

function createMockAudioContext() {
    const ctx = {
        state: 'running',
        currentTime: 0,
        sampleRate: 44100,
        destination: { connect: vi.fn() },
        createGain: vi.fn(() => mockGainNode()),
        createOscillator: vi.fn(() => mockOscillatorNode()),
        createBiquadFilter: vi.fn(() => mockBiquadFilter()),
        createStereoPanner: vi.fn(() => mockStereoPanner()),
        createBuffer: vi.fn((channels, length, sampleRate) => ({
            getChannelData: vi.fn(() => new Float32Array(length)),
        })),
        resume: vi.fn(() => Promise.resolve()),
        close: vi.fn(() => Promise.resolve()),
    };
    return ctx;
}

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------
const storage = {};
const localStorageMock = {
    getItem: vi.fn((k) => storage[k] ?? null),
    setItem: vi.fn((k, v) => { storage[k] = v; }),
    removeItem: vi.fn((k) => { delete storage[k]; }),
    clear: vi.fn(() => { for (const k of Object.keys(storage)) delete storage[k]; }),
};

vi.stubGlobal('window', {
    localStorage: localStorageMock,
    AudioContext: function MockAudioContext() { return createMockAudioContext(); },
    webkitAudioContext: undefined,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
});
vi.stubGlobal('localStorage', localStorageMock);

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------
const { SoundManager } = await import('./SoundManager.js');

// ---------------------------------------------------------------------------
// Construction & enabled persistence
// ---------------------------------------------------------------------------
describe('SoundManager – construction', () => {
    beforeEach(() => {
        localStorageMock.clear();
        vi.clearAllMocks();
    });

    it('should default to enabled when localStorage has no stored value', () => {
        const sm = new SoundManager();
        expect(sm.enabled).toBe(true);
    });

    it('should restore enabled=true from localStorage', () => {
        localStorageMock.setItem('gomoku-sound-enabled', 'true');
        const sm = new SoundManager();
        expect(sm.enabled).toBe(true);
    });

    it('should restore enabled=false from localStorage', () => {
        localStorageMock.setItem('gomoku-sound-enabled', 'false');
        const sm = new SoundManager();
        expect(sm.enabled).toBe(false);
    });

    it('should use default true for unexpected stored value', () => {
        localStorageMock.setItem('gomoku-sound-enabled', 'banana');
        const sm = new SoundManager();
        expect(sm.enabled).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// isEnabled / setEnabled / toggle
// ---------------------------------------------------------------------------
describe('SoundManager – toggle & persist', () => {
    let sm;
    beforeEach(() => {
        localStorageMock.clear();
        vi.clearAllMocks();
        sm = new SoundManager();
    });

    it('isEnabled returns current enabled state', () => {
        expect(sm.isEnabled()).toBe(true);
        sm.enabled = false;
        expect(sm.isEnabled()).toBe(false);
    });

    it('setEnabled persists and updates master level', () => {
        sm.setEnabled(false);
        expect(sm.enabled).toBe(false);
        expect(localStorageMock.setItem).toHaveBeenCalledWith('gomoku-sound-enabled', 'false');
    });

    it('toggle flips state and returns new value', () => {
        expect(sm.toggle()).toBe(false);
        expect(sm.enabled).toBe(false);
        expect(sm.toggle()).toBe(true);
        expect(sm.enabled).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// ensureContext
// ---------------------------------------------------------------------------
describe('SoundManager – ensureContext', () => {
    let sm;
    beforeEach(() => {
        localStorageMock.clear();
        vi.clearAllMocks();
        sm = new SoundManager();
    });

    it('should create AudioContext on first call', () => {
        const ctx = sm.ensureContext();
        expect(ctx).not.toBeNull();
        expect(sm.context).toBe(ctx);
        expect(sm.masterGain).not.toBeNull();
    });

    it('should return the same context on subsequent calls', () => {
        const ctx1 = sm.ensureContext();
        const ctx2 = sm.ensureContext();
        expect(ctx1).toBe(ctx2);
    });

    it('should return null when AudioContext is unavailable', () => {
        sm.AudioContextClass = null;
        expect(sm.ensureContext()).toBeNull();
    });

    it('should set masterGain to MASTER_VOLUME when enabled', () => {
        sm.enabled = true;
        sm.ensureContext();
        expect(sm.masterGain.gain.value).toBe(SoundManager.MASTER_VOLUME);
    });

    it('should set masterGain to 0 when disabled', () => {
        sm.enabled = false;
        sm.ensureContext();
        expect(sm.masterGain.gain.value).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// play routing – no crash when disabled or context suspended
// ---------------------------------------------------------------------------
describe('SoundManager – play routing', () => {
    let sm;
    beforeEach(() => {
        localStorageMock.clear();
        vi.clearAllMocks();
        sm = new SoundManager();
    });

    it('should no-op when disabled', () => {
        sm.enabled = false;
        sm.play('uiTap'); // should not throw
        expect(sm.context).toBeNull(); // context never created
    });

    it('should create context and play when enabled', () => {
        sm.play('move', { color: 'black', source: 'human' });
        expect(sm.context).not.toBeNull();
    });

    it('should handle unknown sound name without error', () => {
        sm.play('nonexistentSound');
        expect(sm.context).not.toBeNull(); // ensureContext still called
    });

    it('should play all named effects without throwing', () => {
        const names = ['uiTap', 'select', 'cancel', 'hint', 'error', 'start', 'move', 'undo', 'win', 'draw', 'resign', 'toggleOn', 'toggleOff'];
        for (const name of names) {
            expect(() => sm.play(name, { color: 'black', source: 'human' })).not.toThrow();
        }
    });
});

// ---------------------------------------------------------------------------
// dispose
// ---------------------------------------------------------------------------
describe('SoundManager – dispose', () => {
    it('should clean up context and ambience', () => {
        const sm = new SoundManager();
        sm.ensureContext();
        expect(sm.context).not.toBeNull();
        sm.dispose();
        expect(sm.context).toBeNull();
        expect(sm.masterGain).toBeNull();
    });

    it('should be safe to call when no context exists', () => {
        const sm = new SoundManager();
        expect(() => sm.dispose()).not.toThrow();
    });
});

// ---------------------------------------------------------------------------
// MASTER_VOLUME constant
// ---------------------------------------------------------------------------
describe('SoundManager – static', () => {
    it('MASTER_VOLUME should be between 0 and 1', () => {
        expect(SoundManager.MASTER_VOLUME).toBeGreaterThan(0);
        expect(SoundManager.MASTER_VOLUME).toBeLessThanOrEqual(1);
    });
});
