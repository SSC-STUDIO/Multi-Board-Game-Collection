import * as THREE from 'three';
import { RENDER_CONFIG } from '../config/renderConfig.js';
import { getSceneSpec } from '../config/sceneConfig.js';
import { createSceneContext } from './scenes/props.js';
import { buildTabletop } from './scenes/tabletop.js';

/**
 * 收集一组布景里可以做透明度过渡的对象：
 * 材质记录原始 transparent/opacity/depthWrite 以便复原，灯光记录原始强度。
 */
function collectFadeTargets(group) {
    const materials = new Map();
    const lights = [];

    group.traverse((object) => {
        if (object.isLight) {
            lights.push({ light: object, intensity: object.intensity });
            return;
        }
        const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
        objectMaterials.forEach((materialRef) => {
            if (!materialRef || materials.has(materialRef)) {
                return;
            }
            materials.set(materialRef, {
                transparent: materialRef.transparent,
                opacity: materialRef.opacity,
                depthWrite: materialRef.depthWrite
            });
        });
    });

    return { materials, lights };
}

function applyFade({ materials, lights }, factor) {
    materials.forEach((original, materialRef) => {
        materialRef.transparent = true;
        materialRef.opacity = original.opacity * factor;
        materialRef.depthWrite = factor > 0.94 ? original.depthWrite : false;
    });
    lights.forEach(({ light, intensity }) => {
        light.intensity = intensity * factor;
    });
}

function restoreFade({ materials, lights }) {
    materials.forEach((original, materialRef) => {
        materialRef.transparent = original.transparent;
        materialRef.opacity = original.opacity;
        materialRef.depthWrite = original.depthWrite;
    });
    lights.forEach(({ light, intensity }) => {
        light.intensity = intensity;
    });
}

function disposeBundle(bundle) {
    bundle.group?.parent?.remove(bundle.group);
    bundle.resources.forEach((resource) => {
        if (typeof resource.dispose === 'function') {
            resource.dispose();
        }
    });
    bundle.resources.clear();
}

export class EnvironmentBuilder {
    constructor(config = RENDER_CONFIG) {
        this.config = config;
        this.group = null;
        this.scenePreset = 'competition';
        this.animators = [];
        this.dynamicObjects = new Set();
        this.trackedResources = new Set();
        this.sharedGeometries = new Map();
        this.sharedMaterials = new Map();
        this.sharedTextures = new Map();
        this.textureLoader = new THREE.TextureLoader();
        this.lastUpdateTime = null;
        this.updateInterval = 1 / 24;
        this.moodMaterials = null;
        this.transition = null;
        this.transitionDuration = 0.36;
    }

    build(boardSize = this.config.board.size, scenePreset = 'competition') {
        this.dispose();

        this.group = new THREE.Group();
        this.group.name = 'environment';
        this.scenePreset = scenePreset;
        this.lastBoardSize = boardSize;
        this.animators = [];
        this.dynamicObjects = new Set();
        this.trackedResources = new Set();
        this.sharedGeometries = new Map();
        this.sharedMaterials = new Map();
        this.sharedTextures = new Map();
        this.lastUpdateTime = null;
        this.updateInterval = this.getUpdateInterval(scenePreset);

        const context = createSceneContext(this.config, boardSize);
        this.moodMaterials = buildTabletop(this, context, scenePreset);

        this.freezeStaticScene();
        return this.group;
    }

    /**
     * 切换氛围：各氛围建模不同（家/公园/比赛各有专属布景），
     * 因此重建整组场景而非仅重染材质。旧布景不立即销毁，
     * 而是与新布景交叉淡入淡出，过渡结束后再释放。
     */
    applyMood(scenePreset = 'competition') {
        if (scenePreset === this.scenePreset && this.group) {
            return this.group;
        }
        const parent = this.group?.parent ?? null;
        const boardSize = this.lastBoardSize ?? this.config.board.size;

        // 上一次过渡还没走完就再次切换：直接结算，避免布景层层堆叠
        this.finishTransition();
        const retiring = this.detachCurrent();

        const group = this.build(boardSize, scenePreset);
        if (parent) {
            parent.add(group);
        }

        if (!retiring) {
            return group;
        }
        if (!parent) {
            disposeBundle(retiring);
            return group;
        }

        this.transition = {
            retiring,
            incoming: collectFadeTargets(group),
            startTime: null
        };
        applyFade(this.transition.incoming, 0);
        applyFade(retiring.targets, 1);

        return group;
    }

    /**
     * 把当前布景从内部状态里摘出来（不销毁），供交叉淡出使用。
     * 摘出后 build() 里的 dispose() 就不会误伤这批资源。
     */
    detachCurrent() {
        if (!this.group) {
            return null;
        }
        const bundle = {
            group: this.group,
            resources: this.trackedResources,
            targets: collectFadeTargets(this.group)
        };
        this.group = null;
        this.trackedResources = new Set();
        this.animators = [];
        this.dynamicObjects = new Set();
        this.sharedGeometries = new Map();
        this.sharedMaterials = new Map();
        this.sharedTextures = new Map();
        this.moodMaterials = null;
        return bundle;
    }

    /** 立即结束进行中的过渡：释放旧布景、把新布景的透明度复原。 */
    finishTransition() {
        if (!this.transition) {
            return;
        }
        const { retiring, incoming } = this.transition;
        this.transition = null;
        restoreFade(incoming);
        disposeBundle(retiring);
    }

    /**
     * 驱动氛围动效（树冠摇曳/灯光呼吸等）与场景切换过渡，按场景节流。
     * 过渡期间不节流，保证淡入淡出足够顺滑。
     * @returns {boolean} 本帧是否有动画推进（需要重绘）
     */
    update(timeSeconds = performance.now() / 1000) {
        let animated = false;

        if (this.transition) {
            if (this.transition.startTime === null) {
                this.transition.startTime = timeSeconds;
            }
            const progress = Math.min(1, (timeSeconds - this.transition.startTime) / this.transitionDuration);
            const eased = progress * progress * (3 - 2 * progress);
            applyFade(this.transition.incoming, eased);
            applyFade(this.transition.retiring.targets, 1 - eased);
            if (progress >= 1) {
                this.finishTransition();
            }
            animated = true;
        }

        if (this.animators.length === 0) {
            return animated;
        }
        if (!animated && this.lastUpdateTime !== null && timeSeconds - this.lastUpdateTime < this.updateInterval) {
            return false;
        }
        this.lastUpdateTime = timeSeconds;
        this.animators.forEach((animator) => animator(timeSeconds));
        return true;
    }

    registerAnimator(animator) {
        this.animators.push(animator);
    }

    getUpdateInterval(scenePreset) {
        return getSceneSpec(scenePreset).updateInterval;
    }

    getSharedGeometry(key, factory) {
        if (!this.sharedGeometries.has(key)) {
            const geometry = factory();
            this.sharedGeometries.set(key, geometry);
            this.track(geometry);
        }

        return this.sharedGeometries.get(key);
    }

    getSharedMaterial(key, factory) {
        if (!this.sharedMaterials.has(key)) {
            const material = factory();
            this.sharedMaterials.set(key, material);
            this.track(material);
        }

        return this.sharedMaterials.get(key);
    }

    getSharedTexture(key, url, configure = null) {
        if (!this.sharedTextures.has(key)) {
            const texture = this.textureLoader.load(url);
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.wrapS = THREE.ClampToEdgeWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;
            texture.minFilter = THREE.LinearMipmapLinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.generateMipmaps = true;
            if (configure) {
                configure(texture);
            }
            this.sharedTextures.set(key, texture);
            this.track(texture);
        }

        return this.sharedTextures.get(key);
    }

    markDynamic(...objects) {
        objects.flat().forEach((object) => {
            if (object) {
                this.dynamicObjects.add(object);
            }
        });
    }

    freezeStaticScene() {
        if (!this.group) {
            return;
        }

        this.group.traverse((object) => {
            if (!object || this.dynamicObjects.has(object)) {
                return;
            }

            object.matrixAutoUpdate = false;
            object.updateMatrix();
        });
    }

    track(...resources) {
        resources.flat().forEach((resource) => {
            if (resource) {
                this.trackedResources.add(resource);
            }
        });
    }

    dispose() {
        this.finishTransition();

        if (this.group?.parent) {
            this.group.parent.remove(this.group);
        }

        this.animators = [];
        this.dynamicObjects.clear();
        this.lastUpdateTime = null;
        this.moodMaterials = null;

        this.trackedResources.forEach((resource) => {
            if (typeof resource.dispose === 'function') {
                resource.dispose();
            }
        });

        this.trackedResources.clear();
        this.sharedGeometries.clear();
        this.sharedMaterials.clear();
        this.sharedTextures.clear();
        this.group = null;
    }
}
