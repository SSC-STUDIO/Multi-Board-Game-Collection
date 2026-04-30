const STORAGE_KEY = 'gomoku-sound-enabled';

export class SoundManager {
    constructor() {
        this.AudioContextClass = window.AudioContext || window.webkitAudioContext || null;
        this.context = null;
        this.masterGain = null;
        this.enabled = this.loadEnabled();
        this.ambienceCue = null;
        this.ambienceHandle = null;
    }

    loadEnabled() {
        try {
            const stored = window.localStorage.getItem(STORAGE_KEY);
            return stored === null ? true : stored !== 'false';
        } catch {
            return true;
        }
    }

    persistEnabled() {
        try {
            window.localStorage.setItem(STORAGE_KEY, String(this.enabled));
        } catch {
            // ignore storage failures
        }
    }

    isEnabled() {
        return this.enabled;
    }

    setEnabled(enabled) {
        this.enabled = Boolean(enabled);
        this.persistEnabled();
        this.updateMasterLevel(this.enabled ? 0.16 : 0);
    }

    toggle() {
        this.setEnabled(!this.enabled);
        return this.enabled;
    }

    ensureContext() {
        if (!this.AudioContextClass) {
            return null;
        }

        if (this.context) {
            return this.context;
        }

        const context = new this.AudioContextClass();
        const masterGain = context.createGain();
        masterGain.gain.value = this.enabled ? 0.16 : 0;
        masterGain.connect(context.destination);

        this.context = context;
        this.masterGain = masterGain;
        return context;
    }

    updateMasterLevel(level) {
        if (!this.masterGain || !this.context) {
            return;
        }

        const now = this.context.currentTime;
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setTargetAtTime(level, now, 0.015);
    }

    unlock() {
        const context = this.ensureContext();
        if (!context) {
            return Promise.resolve(false);
        }

        if (context.state === 'suspended') {
            return context.resume()
                .then(() => {
                    this.updateMasterLevel(this.enabled ? 0.16 : 0);
                    this.applyAmbience(this.ambienceCue, { forceRebuild: true });
                    return true;
                })
                .catch(() => false);
        }

        this.applyAmbience(this.ambienceCue, { forceRebuild: true });
        return Promise.resolve(true);
    }

    setAmbience(cue) {
        this.ambienceCue = cue || null;
        this.applyAmbience(this.ambienceCue);
    }

    getAmbienceCue() {
        return this.ambienceCue;
    }

    applyAmbience(cue, { forceRebuild = false } = {}) {
        if (!cue) {
            this.clearAmbience();
            return;
        }

        if (!forceRebuild && this.ambienceHandle?.cue === cue) {
            return;
        }

        const context = this.ensureContext();
        if (!context || context.state === 'suspended' || !this.masterGain) {
            return;
        }

        this.clearAmbience();

        const [scene = 'competition', phase = 'active'] = cue.split('-');
        const stateLevel = {
            setup: 0.72,
            active: 1,
            thinking: 0.84,
            finished: 0.64
        }[phase] ?? 0.9;

        const ambienceOutput = context.createGain();
        ambienceOutput.gain.value = stateLevel;
        ambienceOutput.connect(this.masterGain);

        const cleanup = [];

        if (scene === 'home') {
            const air = this.createFilteredNoise({
                type: 'brown',
                gain: 0.06,
                lowpass: 820,
                highpass: 110
            });
            air.output.connect(ambienceOutput);
            cleanup.push(air);

            const lamp = this.createDrone({
                frequency: 176,
                type: 'sine',
                gain: 0.014,
                lfoFrequency: 0.08,
                lfoDepth: 0.12
            });
            lamp.output.connect(ambienceOutput);
            cleanup.push(lamp);

            const windowTone = this.createDrone({
                frequency: 432,
                type: 'triangle',
                gain: 0.0045,
                lfoFrequency: 0.11,
                lfoDepth: 0.2
            });
            windowTone.output.connect(ambienceOutput);
            cleanup.push(windowTone);
        } else if (scene === 'park') {
            const breeze = this.createFilteredNoise({
                type: 'white',
                gain: 0.045,
                lowpass: 2200,
                highpass: 220
            });
            breeze.output.connect(ambienceOutput);
            cleanup.push(breeze);

            const water = this.createDrone({
                frequency: 318,
                type: 'triangle',
                gain: 0.007,
                lfoFrequency: 0.16,
                lfoDepth: 0.26
            });
            water.output.connect(ambienceOutput);
            cleanup.push(water);

            const birds = this.createDrone({
                frequency: 1240,
                type: 'sine',
                gain: 0.0028,
                lfoFrequency: 0.27,
                lfoDepth: 0.9
            });
            birds.output.connect(ambienceOutput);
            cleanup.push(birds);
        } else {
            const hallAir = this.createFilteredNoise({
                type: 'brown',
                gain: 0.05,
                lowpass: 1450,
                highpass: 80
            });
            hallAir.output.connect(ambienceOutput);
            cleanup.push(hallAir);

            const lowHum = this.createDrone({
                frequency: 58,
                type: 'sine',
                gain: 0.012,
                lfoFrequency: 0.05,
                lfoDepth: 0.08
            });
            lowHum.output.connect(ambienceOutput);
            cleanup.push(lowHum);

            const upperHum = this.createDrone({
                frequency: 116,
                type: 'triangle',
                gain: 0.004,
                lfoFrequency: 0.09,
                lfoDepth: 0.12
            });
            upperHum.output.connect(ambienceOutput);
            cleanup.push(upperHum);
        }

        this.ambienceHandle = {
            cue,
            output: ambienceOutput,
            cleanup
        };
    }

    clearAmbience() {
        if (!this.ambienceHandle) {
            return;
        }

        this.ambienceHandle.cleanup.forEach((node) => node?.stop?.());
        this.ambienceHandle.output?.disconnect?.();
        this.ambienceHandle = null;
    }

    createFilteredNoise({ type = 'white', gain = 0.03, lowpass = 2000, highpass = 80 }) {
        const context = this.context;
        const source = context.createBufferSource();
        source.buffer = this.createNoiseBuffer(type);
        source.loop = true;

        const highpassFilter = context.createBiquadFilter();
        highpassFilter.type = 'highpass';
        highpassFilter.frequency.value = highpass;

        const lowpassFilter = context.createBiquadFilter();
        lowpassFilter.type = 'lowpass';
        lowpassFilter.frequency.value = lowpass;

        const output = context.createGain();
        output.gain.value = gain;

        source.connect(highpassFilter);
        highpassFilter.connect(lowpassFilter);
        lowpassFilter.connect(output);
        source.start();

        return {
            output,
            stop: () => {
                source.stop();
                source.disconnect();
                highpassFilter.disconnect();
                lowpassFilter.disconnect();
            }
        };
    }

    createNoiseBuffer(type = 'white') {
        const context = this.context;
        const length = Math.max(1, Math.floor(context.sampleRate * 2));
        const buffer = context.createBuffer(1, length, context.sampleRate);
        const channelData = buffer.getChannelData(0);
        let lastOut = 0;

        for (let index = 0; index < length; index += 1) {
            const white = Math.random() * 2 - 1;
            if (type === 'brown') {
                lastOut = (lastOut + 0.02 * white) / 1.02;
                channelData[index] = lastOut * 3.5;
            } else {
                channelData[index] = white * 0.7;
            }
        }

        return buffer;
    }

    createDrone({ frequency, type = 'sine', gain = 0.01, lfoFrequency = 0.1, lfoDepth = 0.1 }) {
        const context = this.context;
        const oscillator = context.createOscillator();
        oscillator.type = type;
        oscillator.frequency.value = frequency;

        const output = context.createGain();
        output.gain.value = gain;

        const lfo = context.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = lfoFrequency;

        const lfoGain = context.createGain();
        lfoGain.gain.value = gain * lfoDepth;

        lfo.connect(lfoGain);
        lfoGain.connect(output.gain);
        oscillator.connect(output);

        oscillator.start();
        lfo.start();

        return {
            output,
            stop: () => {
                oscillator.stop();
                lfo.stop();
                oscillator.disconnect();
                lfo.disconnect();
                lfoGain.disconnect();
            }
        };
    }

    play(name, detail = {}) {
        if (!this.enabled) {
            return;
        }

        const context = this.ensureContext();
        if (!context || context.state === 'suspended') {
            return;
        }

        switch (name) {
            case 'uiTap':
                this.playUiTap();
                break;
            case 'select':
                this.playSelect();
                break;
            case 'cancel':
                this.playCancel();
                break;
            case 'hint':
                this.playHint();
                break;
            case 'error':
                this.playError();
                break;
            case 'start':
                this.playStart();
                break;
            case 'move':
                this.playMove(detail.color, detail.source);
                break;
            case 'undo':
                this.playUndo();
                break;
            case 'win':
                this.playWin();
                break;
            case 'draw':
                this.playDraw();
                break;
            case 'resign':
                this.playResign();
                break;
            case 'toggleOn':
                this.playToggleOn();
                break;
            case 'toggleOff':
                this.playToggleOff();
                break;
            default:
                break;
        }
    }

    playUiTap() {
        this.voice({ frequency: 620, duration: 0.045, type: 'triangle', volume: 0.28 });
        this.voice({ frequency: 860, duration: 0.05, type: 'sine', volume: 0.12, delay: 0.012 });
    }

    playSelect() {
        this.voice({ frequency: 430, duration: 0.08, type: 'triangle', volume: 0.22, endFrequency: 560 });
        this.voice({ frequency: 840, duration: 0.06, type: 'sine', volume: 0.07, delay: 0.015 });
    }

    playCancel() {
        this.voice({ frequency: 480, duration: 0.08, type: 'triangle', volume: 0.18, endFrequency: 300 });
    }

    playHint() {
        this.voice({ frequency: 470, duration: 0.09, type: 'triangle', volume: 0.16 });
        this.voice({ frequency: 628, duration: 0.09, type: 'triangle', volume: 0.15, delay: 0.055 });
        this.voice({ frequency: 785, duration: 0.11, type: 'sine', volume: 0.14, delay: 0.11 });
    }

    playError() {
        this.voice({ frequency: 260, duration: 0.1, type: 'sawtooth', volume: 0.15, endFrequency: 210 });
    }

    playStart() {
        this.voice({ frequency: 240, duration: 0.22, type: 'triangle', volume: 0.18, endFrequency: 380 });
        this.voice({ frequency: 520, duration: 0.16, type: 'sine', volume: 0.08, delay: 0.04 });
    }

    playMove(color = 'black', source = 'human') {
        const isBlack = color === 'black';
        const base = isBlack ? 162 : 228;
        const accent = isBlack ? 254 : 346;
        const volume = source === 'ai' ? 0.15 : 0.2;

        this.voice({ frequency: base, duration: 0.075, type: 'sine', volume, endFrequency: base * 0.96 });
        this.voice({ frequency: accent, duration: 0.085, type: 'triangle', volume: volume * 0.66, delay: 0.01, endFrequency: accent * 0.92 });
    }

    playUndo() {
        this.voice({ frequency: 520, duration: 0.08, type: 'triangle', volume: 0.12, endFrequency: 420 });
        this.voice({ frequency: 360, duration: 0.09, type: 'sine', volume: 0.1, delay: 0.03 });
    }

    playWin() {
        this.voice({ frequency: 392, duration: 0.16, type: 'triangle', volume: 0.18 });
        this.voice({ frequency: 523, duration: 0.18, type: 'triangle', volume: 0.18, delay: 0.1 });
        this.voice({ frequency: 659, duration: 0.28, type: 'sine', volume: 0.2, delay: 0.22 });
    }

    playDraw() {
        this.voice({ frequency: 330, duration: 0.14, type: 'triangle', volume: 0.12 });
        this.voice({ frequency: 392, duration: 0.16, type: 'sine', volume: 0.11, delay: 0.12 });
    }

    playResign() {
        this.voice({ frequency: 370, duration: 0.12, type: 'triangle', volume: 0.14, endFrequency: 320 });
        this.voice({ frequency: 262, duration: 0.2, type: 'sine', volume: 0.16, delay: 0.09, endFrequency: 196 });
    }

    playToggleOn() {
        this.voice({ frequency: 580, duration: 0.08, type: 'triangle', volume: 0.14 });
        this.voice({ frequency: 820, duration: 0.1, type: 'sine', volume: 0.12, delay: 0.045 });
    }

    playToggleOff() {
        this.voice({ frequency: 520, duration: 0.07, type: 'triangle', volume: 0.12, endFrequency: 420 });
    }

    voice({
        frequency,
        duration = 0.1,
        type = 'sine',
        volume = 0.1,
        delay = 0,
        attack = 0.003,
        release = 0.08,
        endFrequency = null,
    }) {
        const context = this.context;
        if (!context || !this.masterGain) {
            return;
        }

        const oscillator = context.createOscillator();
        const gainNode = context.createGain();

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, context.currentTime + delay);
        if (endFrequency) {
            oscillator.frequency.exponentialRampToValueAtTime(
                Math.max(endFrequency, 10),
                context.currentTime + delay + duration
            );
        }

        gainNode.gain.setValueAtTime(0.0001, context.currentTime + delay);
        gainNode.gain.exponentialRampToValueAtTime(volume, context.currentTime + delay + attack);
        gainNode.gain.exponentialRampToValueAtTime(
            0.0001,
            context.currentTime + delay + Math.max(duration, attack + 0.01) + release
        );

        oscillator.connect(gainNode);
        gainNode.connect(this.masterGain);

        oscillator.start(context.currentTime + delay);
        oscillator.stop(context.currentTime + delay + duration + release + 0.02);
    }

    dispose() {
        this.clearAmbience();
        if (this.context) {
            this.context.close().catch(() => {});
        }
        this.context = null;
        this.masterGain = null;
    }
}
