/**
 * 光照配置
 * 设置场景光照并支持场景预设切换
 */

import * as THREE from 'three';
import { RENDER_CONFIG } from '../config/renderConfig.js';
import { getSceneSpec } from '../config/sceneConfig.js';

export class LightingSetup {
    constructor(sceneManager, config = RENDER_CONFIG) {
        this.sceneManager = sceneManager;
        this.scene = sceneManager.scene;
        this.renderer = sceneManager.renderer;
        this.config = config;
        this.lights = {};
        this.currentPreset = 'competition';
        this.presentationMode = 'setup';
        this.lastUpdateTime = null;
        this.updateInterval = 1 / 24;
    }

    setup(scenePreset = 'competition') {
        this.createAmbientLight();
        this.createHemisphereLight();
        this.createDirectionalLight('main');
        this.createDirectionalLight('fill');
        this.createDirectionalLight('rim');
        this.createPointLight('accentA');
        this.createPointLight('accentB');
        this.createSpotLight();
        this.applyPreset(scenePreset);
    }

    applyPreset(scenePreset = 'competition') {
        const preset = this.resolveLightingPreset(scenePreset);
        this.currentPreset = scenePreset;

        if (this.scene.fog instanceof THREE.FogExp2) {
            this.scene.fog.color.setHex(preset.fogColor);
            this.scene.fog.density = preset.fogDensity;
        } else {
            this.scene.fog = new THREE.FogExp2(preset.fogColor, preset.fogDensity);
        }

        this.renderer.toneMappingExposure = preset.exposure;

        this.applyAmbient(preset.ambient);
        this.applyHemisphere(preset.hemisphere);
        this.applyDirectional(this.lights.main, preset.main);
        this.applyDirectional(this.lights.fill, preset.fill);
        this.applyDirectional(this.lights.rim, preset.rim);
        this.applyPoint(this.lights.accentA, preset.accentA);
        this.applyPoint(this.lights.accentB, preset.accentB);
        this.applySpot(this.lights.spot, preset.spot);
        this.lastUpdateTime = null;

        this.sceneManager.setNeedsRender();
    }

    setPresentationMode(mode = 'setup') {
        const presentationMode = mode === 'setup' ? 'setup' : 'game';
        if (presentationMode === this.presentationMode) {
            return;
        }
        this.presentationMode = presentationMode;
        if (!this.lights.ambient) {
            return;
        }
        this.applyPreset(this.currentPreset);
    }

    resolveLightingPreset(scenePreset = this.currentPreset) {
        const lighting = getSceneSpec(scenePreset).lighting;
        const { presentation, ...base } = lighting;
        const overrides = presentation?.[this.presentationMode];

        if (!overrides) {
            return this.applyQualitySettings(base);
        }

        return this.applyQualitySettings({
            ...base,
            ...overrides,
            ambient: { ...base.ambient, ...overrides.ambient },
            hemisphere: { ...base.hemisphere, ...overrides.hemisphere },
            main: { ...base.main, ...overrides.main },
            fill: { ...base.fill, ...overrides.fill },
            rim: { ...base.rim, ...overrides.rim },
            accentA: { ...base.accentA, ...overrides.accentA },
            accentB: { ...base.accentB, ...overrides.accentB },
            spot: { ...base.spot, ...overrides.spot }
        });
    }

    applyQualitySettings(preset) {
        const shadowMapSize = this.getShadowMapSize(preset.main?.shadowMapSize);
        const shadowsEnabled = this.config.renderer?.shadowMapEnabled !== false;

        return {
            ...preset,
            main: {
                ...preset.main,
                castShadow: shadowsEnabled && (preset.main?.castShadow ?? this.config.lighting.main.castShadow),
                shadowMapSize,
            },
            fill: {
                ...preset.fill,
                castShadow: false,
            },
            rim: {
                ...preset.rim,
                castShadow: false,
            },
            spot: {
                ...preset.spot,
                castShadow: false,
            },
        };
    }

    getShadowMapSize(requestedSize = 2048) {
        const qualitySize = this.config.lighting?.main?.shadowMapSize ?? requestedSize;
        return Math.min(requestedSize, qualitySize);
    }

    update(timeSeconds = performance.now() / 1000) {
        const preset = this.resolveLightingPreset(this.currentPreset);

        if (this.lastUpdateTime !== null && timeSeconds - this.lastUpdateTime < this.updateInterval) {
            return false;
        }

        this.lastUpdateTime = timeSeconds;

        if (this.currentPreset === 'home') {
            const daylight = (Math.sin(timeSeconds * 0.12) + 1) / 2;
            const nightfall = 1 - daylight;
            const flicker = (Math.sin(timeSeconds * 3.4) + Math.sin(timeSeconds * 5.2 + 0.3)) * 0.03;

            this.lights.ambient.intensity = preset.ambient.intensity - 0.05 + daylight * 0.08;
            this.lights.hemisphere.intensity = preset.hemisphere.intensity - 0.04 + daylight * 0.08;
            this.lights.main.intensity = preset.main.intensity - 0.08 + daylight * 0.14;
            this.lights.fill.intensity = preset.fill.intensity - 0.08 + daylight * 0.1;
            this.lights.rim.intensity = preset.rim.intensity + daylight * 0.08;
            this.lights.accentA.intensity = preset.accentA.intensity + nightfall * 0.72 + flicker;
            this.lights.accentB.intensity = 0.22 + daylight * 0.72;
            this.lights.spot.intensity = preset.spot.intensity + nightfall * 0.42 + flicker * 2;
            return true;
        }

        if (this.currentPreset === 'park') {
            const breeze = (Math.sin(timeSeconds * 0.44) + 1) / 2;
            const sparkle = Math.sin(timeSeconds * 1.18);

            this.lights.ambient.intensity = preset.ambient.intensity + breeze * 0.05;
            this.lights.hemisphere.intensity = preset.hemisphere.intensity + breeze * 0.06;
            this.lights.main.intensity = preset.main.intensity + breeze * 0.14;
            this.lights.fill.intensity = preset.fill.intensity + sparkle * 0.05;
            this.lights.rim.intensity = preset.rim.intensity + (Math.sin(timeSeconds * 0.7 + 0.5) + 1) * 0.04;
            this.lights.accentA.intensity = preset.accentA.intensity + (Math.sin(timeSeconds * 0.9) + 1) * 0.08;
            this.lights.accentB.intensity = preset.accentB.intensity + (Math.cos(timeSeconds * 0.82) + 1) * 0.05;
            this.lights.accentA.position.x = preset.accentA.position.x + Math.sin(timeSeconds * 0.2) * 0.8;
            this.lights.accentA.position.y = preset.accentA.position.y + Math.sin(timeSeconds * 0.16) * 0.24;
            return true;
        }

        const drift = Math.sin(timeSeconds * 0.16);
        const breathe = (Math.sin(timeSeconds * 0.28) + 1) / 2;

        this.lights.ambient.intensity = preset.ambient.intensity + breathe * 0.015;
        this.lights.hemisphere.intensity = preset.hemisphere.intensity + breathe * 0.01;
        this.lights.main.intensity = preset.main.intensity + breathe * 0.03;
        this.lights.fill.intensity = preset.fill.intensity + breathe * 0.02;
        this.lights.rim.intensity = preset.rim.intensity + breathe * 0.015;
        this.lights.accentA.intensity = preset.accentA.intensity + breathe * 0.025;
        this.lights.accentB.intensity = preset.accentB.intensity + breathe * 0.02;
        this.lights.spot.intensity = preset.spot.intensity + breathe * 0.04;
        this.lights.spot.position.x = preset.spot.position.x + drift * 0.14;
        this.lights.spot.target.position.x = preset.spot.target.x + drift * 0.08;
        return true;
    }

    createAmbientLight() {
        this.lights.ambient = new THREE.AmbientLight(0xffffff, 1);
        this.lights.ambient.name = 'ambientLight';
        this.scene.add(this.lights.ambient);
    }

    createHemisphereLight() {
        this.lights.hemisphere = new THREE.HemisphereLight(0xffffff, 0x101010, 0.4);
        this.lights.hemisphere.name = 'hemisphereLight';
        this.scene.add(this.lights.hemisphere);
    }

    createDirectionalLight(name) {
        const light = new THREE.DirectionalLight(0xffffff, 1);
        light.name = `${name}Light`;
        light.userData.isPrimaryShadowLight = name === 'main';
        this.scene.add(light);
        this.lights[name] = light;
    }

    createPointLight(name) {
        const light = new THREE.PointLight(0xffffff, 0, 20, 2);
        light.name = `${name}Light`;
        light.castShadow = false;
        this.scene.add(light);
        this.lights[name] = light;
    }

    createSpotLight() {
        const light = new THREE.SpotLight(0xffffff, 0, 30, 0.5, 0.5, 1.4);
        light.name = 'spotLight';
        light.castShadow = false;
        this.scene.add(light);
        this.scene.add(light.target);
        this.lights.spot = light;
    }

    applyAmbient(settings) {
        this.lights.ambient.color.setHex(settings.color);
        this.lights.ambient.intensity = settings.intensity;
    }

    applyHemisphere(settings) {
        this.lights.hemisphere.color.setHex(settings.skyColor);
        this.lights.hemisphere.groundColor.setHex(settings.groundColor);
        this.lights.hemisphere.intensity = settings.intensity;
    }

    applyDirectional(light, settings) {
        light.color.setHex(settings.color);
        light.intensity = settings.intensity;
        light.position.set(settings.position.x, settings.position.y, settings.position.z);
        light.target.position.set(settings.target?.x ?? 0, settings.target?.y ?? 0, settings.target?.z ?? 0);
        this.scene.add(light.target);

        light.castShadow = light.userData.isPrimaryShadowLight && Boolean(settings.castShadow);
        if (light.castShadow) {
            const shadowMapSize = this.getShadowMapSize(settings.shadowMapSize);
            light.shadow.mapSize.width = shadowMapSize;
            light.shadow.mapSize.height = shadowMapSize;
            light.shadow.camera.near = 0.5;
            light.shadow.camera.far = 60;
            light.shadow.camera.left = -18;
            light.shadow.camera.right = 18;
            light.shadow.camera.top = 18;
            light.shadow.camera.bottom = -18;
            light.shadow.bias = -0.00012;
            light.shadow.normalBias = 0.02;
        }
    }

    applyPoint(light, settings) {
        light.color.setHex(settings.color);
        light.intensity = settings.intensity;
        light.distance = settings.distance;
        light.decay = settings.decay;
        light.position.set(settings.position.x, settings.position.y, settings.position.z);
        light.visible = settings.intensity > 0;
    }

    applySpot(light, settings) {
        light.color.setHex(settings.color);
        light.intensity = settings.intensity;
        light.distance = settings.distance;
        light.angle = settings.angle;
        light.penumbra = settings.penumbra;
        light.position.set(settings.position.x, settings.position.y, settings.position.z);
        light.target.position.set(settings.target.x, settings.target.y, settings.target.z);
        light.visible = settings.intensity > 0;
        light.castShadow = false;
    }

    getLight(name) {
        return this.lights[name];
    }

    setMainIntensity(intensity) {
        if (this.lights.main) {
            this.lights.main.intensity = intensity;
            this.sceneManager.setNeedsRender();
        }
    }

    setAmbientIntensity(intensity) {
        if (this.lights.ambient) {
            this.lights.ambient.intensity = intensity;
            this.sceneManager.setNeedsRender();
        }
    }

    dispose() {
        Object.values(this.lights).forEach((light) => {
            if (!light) {
                return;
            }
            if (light.parent) {
                light.parent.remove(light);
            }
            if (light.target?.parent) {
                light.target.parent.remove(light.target);
            }
            if (light.dispose) {
                light.dispose();
            }
        });
        this.lights = {};
    }
}
