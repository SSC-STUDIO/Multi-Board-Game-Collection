import * as THREE from 'three';
import { RENDER_CONFIG } from '../config/renderConfig.js';
import { getSceneSpec } from '../config/sceneConfig.js';
import { createSceneContext } from './scenes/props.js';
import { buildHomeStudy } from './scenes/homeStudy.js';
import { buildParkPavilion } from './scenes/parkPavilion.js';
import { buildTournamentHall } from './scenes/tournamentHall.js';

const SCENE_BUILDERS = {
    home: buildHomeStudy,
    park: buildParkPavilion,
    competition: buildTournamentHall,
};

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
    }

    build(boardSize = this.config.board.size, scenePreset = 'competition') {
        this.dispose();

        this.group = new THREE.Group();
        this.group.name = 'environment';
        this.scenePreset = scenePreset;
        this.animators = [];
        this.dynamicObjects = new Set();
        this.trackedResources = new Set();
        this.sharedGeometries = new Map();
        this.sharedMaterials = new Map();
        this.sharedTextures = new Map();
        this.lastUpdateTime = null;
        this.updateInterval = this.getUpdateInterval(scenePreset);

        const context = createSceneContext(this.config, boardSize);
        const sceneBuilder = SCENE_BUILDERS[scenePreset] || SCENE_BUILDERS.competition;
        sceneBuilder(this, context);

        this.freezeStaticScene();
        return this.group;
    }

    update(timeSeconds = performance.now() / 1000) {
        if (this.animators.length === 0) {
            return false;
        }

        if (this.lastUpdateTime !== null && timeSeconds - this.lastUpdateTime < this.updateInterval) {
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
        if (this.group?.parent) {
            this.group.parent.remove(this.group);
        }

        this.animators = [];
        this.dynamicObjects.clear();
        this.lastUpdateTime = null;

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
