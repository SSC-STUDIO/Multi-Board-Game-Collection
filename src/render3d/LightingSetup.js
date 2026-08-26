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
        if (this.lights.fill && preset.fill) {
            this.applyDirectional(this.lights.fill, preset.fill);
        }
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

    update(_timeSeconds = performance.now() / 1000) {
        return false;
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
