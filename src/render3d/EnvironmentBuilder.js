import * as THREE from 'three';
import { RENDER_CONFIG } from '../config/renderConfig.js';
import { getSceneSpec } from '../config/sceneConfig.js';
import { createSceneContext } from './scenes/props.js';
import { buildTabletop } from './scenes/tabletop.js';

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
     * 直接重建整组场景并挂回原父节点，而非仅重染材质。
     */
    applyMood(scenePreset = 'competition') {
        if (scenePreset === this.scenePreset && this.group) {
            return this.group;
        }
        const parent = this.group?.parent ?? null;
        const boardSize = this.lastBoardSize ?? this.config.board.size;
        const group = this.build(boardSize, scenePreset);
        if (parent) {
            parent.add(group);
        }
        return group;
    }

    update(_timeSeconds = performance.now() / 1000) {
        return false;
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
