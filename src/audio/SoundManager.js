/** 音效管理：棋盘音效与环境音景合成 @module audio/SoundManager */

const STORAGE_KEY = 'gomoku-sound-enabled';

/**
 * 基于 Web Audio API 的音频管理器。
 * 负责音效开关持久化、场景环境音景，以及交互/对局音效的即时合成。
 */
export class SoundManager {
    /** @type {number} 主音量系数 */
    static MASTER_VOLUME = 0.16;

    // === Lifecycle ===

    /**
     * 初始化音频管理器的基础状态，但延迟创建实际的 `AudioContext`。
     */
    constructor() {
    /** @type {typeof AudioContext|null} */
    this.AudioContextClass = window.AudioContext || window.webkitAudioContext || null;
    /** @type {AudioContext|null} */
    this.context = null;
    /** @type {GainNode|null} */
    this.masterGain = null;
    /** @type {boolean} */
    this.enabled = this.loadEnabled();
    /** @type {string|null} */
    this.ambienceCue = null;
    /** @type {{ cue: string, output: GainNode, cleanup: Array<{stop: Function}> }|null} */
    this.ambienceHandle = null;
    /** @type {Map<string, AudioBuffer>} */
    this.noiseBufferCache = new Map();
    }

    /**
     * 从 localStorage 读取音效启用状态
     * @returns {boolean} 音效是否启用（默认 true）
     */
    loadEnabled() {
        try {
            const stored = window.localStorage.getItem(STORAGE_KEY);
            return stored === null ? true : stored !== 'false';
        } catch {
            return true;
        }
    }

    /**
     * 将音效启用状态持久化到 localStorage
     */
    persistEnabled() {
        try {
            window.localStorage.setItem(STORAGE_KEY, String(this.enabled));
        } catch {
            // ignore storage failures
        }
    }

    /**
     * 获取音效是否启用
     * @returns {boolean} 音效启用状态
     */
    isEnabled() {
        return this.enabled;
    }

    /**
     * 设置音效启用状态并持久化，同时更新主音量
     * @param {boolean} enabled - 是否启用音效
     */
    setEnabled(enabled) {
        this.enabled = Boolean(enabled);
        this.persistEnabled();
        this.updateMasterLevel(this.enabled ? SoundManager.MASTER_VOLUME : 0);
    }

    /**
     * 切换音效启用/停用状态
     * @returns {boolean} 切换后的音效启用状态
     */
    toggle() {
        this.setEnabled(!this.enabled);
        return this.enabled;
    }

    // === Audio Graph ===

    /**
     * 延迟创建 AudioContext 实例（单例模式），初始化主音量增益节点
     * @returns {AudioContext|null} AudioContext 实例，若 Web Audio API 不可用则返回 null
     */
    ensureContext() {
        if (!this.AudioContextClass) {
            return null;
        }

        if (this.context) {
            return this.context;
        }

        const context = new this.AudioContextClass();
        const masterGain = context.createGain();
        masterGain.gain.value = this.enabled ? SoundManager.MASTER_VOLUME : 0;
        masterGain.connect(context.destination);

        this.context = context;
        this.masterGain = masterGain;
        return context;
    }

    /**
     * 更新主音量增益值
     * @param {number} level - 目标音量值（0-1）
     */
    updateMasterLevel(level) {
        if (!this.masterGain || !this.context) {
            return;
        }

        const now = this.context.currentTime;
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setTargetAtTime(level, now, 0.015);
    }

    /**
     * 恢复 AudioContext 并重新应用音景
     * @returns {Promise<boolean>} 是否成功解锁
     */
    unlock() {
        const context = this.ensureContext();
        if (!context) {
            return Promise.resolve(false);
        }

        if (context.state === 'suspended') {
            return context.resume()
                .then(() => {
                    this.updateMasterLevel(this.enabled ? SoundManager.MASTER_VOLUME : 0);
                    this.applyAmbience(this.ambienceCue, { forceRebuild: true });
                    return true;
                })
                .catch(() => false);
        }

        this.applyAmbience(this.ambienceCue, { forceRebuild: true });
        return Promise.resolve(true);
    }

    // === Ambience ===

    /**
     * 设置当前音景场景标识，并触发音景重建
     * @param {string|null} cue - 音景标识符（如 "home-active", "park-thinking"），null 表示清除音景
     * @returns {void}
     */
    setAmbience(cue) {
        this.ambienceCue = cue || null;
        this.applyAmbience(this.ambienceCue);
    }

    /**
     * 获取当前音景场景标识
     * @returns {string|null} 当前音景标识符，无音景时返回 null
     */
    getAmbienceCue() {
        return this.ambienceCue;
    }

    /**
     * 应用（重建）指定音景场景
     * 根据场景类型（home/park/competition）和阶段（setup/active/thinking/finished）
     * 组合对应的噪声层与 drone 层，连接到主音量输出。
     * 若 forceRebuild 为 false 且 cue 与当前音景相同，则跳过重建。
     * @param {string|null} cue - 音景标识符，null 则清除音景
     * @param {{ forceRebuild?: boolean }} [options] - 选项
     * @param {boolean} [options.forceRebuild=false] - 是否强制重建（即使 cue 未变）
     * @returns {void}
     */
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

        // 每个场景都由噪声底床 + 若干 drone 叠加而成，拓扑保持一致，便于统一清理与渐进替换。
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

    /**
     * 停止并断开当前环境音景的所有节点。
     * @returns {void}
     */
    clearAmbience() {
        if (!this.ambienceHandle) {
            return;
        }

        this.ambienceHandle.cleanup.forEach((node) => node?.stop?.());
        this.ambienceHandle.output?.disconnect?.();
        this.ambienceHandle = null;
    }

    /**
     * 创建一条由噪声源、高通、低通和输出增益组成的底噪链路。
     * @param {{ type?: 'white'|'brown', gain?: number, lowpass?: number, highpass?: number }} [options={}] - 噪声参数
     * @returns {{ output: GainNode, stop: () => void }} 可连接并可停止的节点句柄
     */
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

    /**
     * 创建或复用缓存的噪声缓冲区。
     * @param {'white'|'brown'} [type='white'] - 噪声类型
     * @returns {AudioBuffer} 可循环播放的噪声缓冲区
     */
    createNoiseBuffer(type = 'white') {
        const cached = this.noiseBufferCache.get(type);
        if (cached) return cached;

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

        this.noiseBufferCache.set(type, buffer);
        return buffer;
    }

    /**
     * 创建一条带 LFO 振幅调制的持续音 drone。
     * @param {{ frequency: number, type?: OscillatorType, gain?: number, lfoFrequency?: number, lfoDepth?: number }} options - drone 参数
     * @returns {{ output: GainNode, stop: () => void }} 可连接并可停止的节点句柄
     */
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

    // === Sound Effects ===

    /**
     * 按名称播放预定义音效。
     * @param {string} name - 音效名称
     * @param {{ color?: 'black'|'white', source?: 'human'|'ai' }} [detail={}] - 补充参数
     * @returns {void}
     */
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

    /**
     * 播放轻触 UI 的短提示音。
     * @returns {void}
     */
    playUiTap() {
        this.voice({ frequency: 620, duration: 0.045, type: 'triangle', volume: 0.28 });
        this.voice({ frequency: 860, duration: 0.05, type: 'sine', volume: 0.12, delay: 0.012 });
    }

    /**
     * 播放选中动作音。
     * @returns {void}
     */
    playSelect() {
        this.voice({ frequency: 430, duration: 0.08, type: 'triangle', volume: 0.22, endFrequency: 560 });
        this.voice({ frequency: 840, duration: 0.06, type: 'sine', volume: 0.07, delay: 0.015 });
    }

    /**
     * 播放取消动作音。
     * @returns {void}
     */
    playCancel() {
        this.voice({ frequency: 480, duration: 0.08, type: 'triangle', volume: 0.18, endFrequency: 300 });
    }

    /**
     * 播放提示音。
     * @returns {void}
     */
    playHint() {
        this.voice({ frequency: 470, duration: 0.09, type: 'triangle', volume: SoundManager.MASTER_VOLUME });
        this.voice({ frequency: 628, duration: 0.09, type: 'triangle', volume: 0.15, delay: 0.055 });
        this.voice({ frequency: 785, duration: 0.11, type: 'sine', volume: 0.14, delay: 0.11 });
    }

    /**
     * 播放错误提示音。
     * @returns {void}
     */
    playError() {
        this.voice({ frequency: 260, duration: 0.1, type: 'sawtooth', volume: 0.15, endFrequency: 210 });
    }

    /**
     * 播放开局音。
     * @returns {void}
     */
    playStart() {
        this.voice({ frequency: 240, duration: 0.22, type: 'triangle', volume: 0.18, endFrequency: 380 });
        this.voice({ frequency: 520, duration: 0.16, type: 'sine', volume: 0.08, delay: 0.04 });
    }

    /**
     * 播放落子音；颜色与来源会影响音高和声像。
     * @param {'black'|'white'} [color='black'] - 棋子颜色
     * @param {'human'|'ai'} [source='human'] - 落子来源
     * @returns {void}
     */
    playMove(color = 'black', source = 'human') {
        const isBlack = color === 'black';
        const base = isBlack ? 162 : 228;
        const accent = isBlack ? 254 : 346;
        const volume = source === 'ai' ? 0.15 : 0.2;
        const pan = isBlack
            ? (source === 'ai' ? -0.6 : -0.3)
            : (source === 'ai' ? 0.6 : 0.3);

        this.voice({ frequency: base, duration: 0.075, type: 'sine', volume, endFrequency: base * 0.96, pan });
        this.voice({ frequency: accent, duration: 0.085, type: 'triangle', volume: volume * 0.66, delay: 0.01, endFrequency: accent * 0.92, pan });
    }

    /**
     * 播放悔棋音。
     * @returns {void}
     */
    playUndo() {
        this.voice({ frequency: 520, duration: 0.08, type: 'triangle', volume: 0.12, endFrequency: 420 });
        this.voice({ frequency: 360, duration: 0.09, type: 'sine', volume: 0.1, delay: 0.03 });
    }

    /**
     * 播放胜利音。
     * @returns {void}
     */
    playWin() {
        this.voice({ frequency: 392, duration: 0.16, type: 'triangle', volume: 0.18 });
        this.voice({ frequency: 523, duration: 0.18, type: 'triangle', volume: 0.18, delay: 0.1 });
        this.voice({ frequency: 659, duration: 0.28, type: 'sine', volume: 0.2, delay: 0.22 });
    }

    /**
     * 播放和棋音。
     * @returns {void}
     */
    playDraw() {
        this.voice({ frequency: 330, duration: 0.14, type: 'triangle', volume: 0.12 });
        this.voice({ frequency: 392, duration: 0.16, type: 'sine', volume: 0.11, delay: 0.12 });
    }

    /**
     * 播放认输音。
     * @returns {void}
     */
    playResign() {
        this.voice({ frequency: 370, duration: 0.12, type: 'triangle', volume: 0.14, endFrequency: 320 });
        this.voice({ frequency: 262, duration: 0.2, type: 'sine', volume: SoundManager.MASTER_VOLUME, delay: 0.09, endFrequency: 196 });
    }

    /**
     * 播放音效开启提示音。
     * @returns {void}
     */
    playToggleOn() {
        this.voice({ frequency: 580, duration: 0.08, type: 'triangle', volume: 0.14 });
        this.voice({ frequency: 820, duration: 0.1, type: 'sine', volume: 0.12, delay: 0.045 });
    }

    /**
     * 播放音效关闭提示音。
     * @returns {void}
     */
    playToggleOff() {
        this.voice({ frequency: 520, duration: 0.07, type: 'triangle', volume: 0.12, endFrequency: 420 });
    }

    /**
     * 合成并播放一个包络化的短音符，可选终止频率和声像。
     * @param {{
     *   frequency: number,
     *   duration?: number,
     *   type?: OscillatorType,
     *   volume?: number,
     *   delay?: number,
     *   attack?: number,
     *   release?: number,
     *   endFrequency?: number|null,
     *   pan?: number|null
     * }} options - 合成参数
     * @returns {void}
     */
    voice({
        frequency,
        duration = 0.1,
        type = 'sine',
        volume = 0.1,
        delay = 0,
        attack = 0.003,
        release = 0.08,
        endFrequency = null,
        pan = null,
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

        if (pan !== null && context.createStereoPanner) {
            const panner = context.createStereoPanner();
            panner.pan.setValueAtTime(pan, context.currentTime + delay);
            gainNode.connect(panner);
            panner.connect(this.masterGain);
        } else {
            gainNode.connect(this.masterGain);
        }

        oscillator.start(context.currentTime + delay);
        oscillator.stop(context.currentTime + delay + duration + release + 0.02);
    }

    // === Lifecycle ===

    /**
     * 释放环境音景和音频上下文。
     * @returns {void}
     */
    dispose() {
        this.clearAmbience();
        if (this.context) {
            this.context.close().catch(() => {});
        }
        this.context = null;
        this.masterGain = null;
    }
}
