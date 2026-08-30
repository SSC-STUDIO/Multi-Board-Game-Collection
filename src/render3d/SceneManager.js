/**
 * 场景管理器
 * 负责初始化和管理 Three.js 场景、相机、渲染器、渲染循环
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { getOptimalConfig } from '../config/renderConfig.js';

export class SceneManager {
    constructor(container, options = {}) {
        this.container = container;
        this.options = options;
        this.config = getOptimalConfig();

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.environmentTexture = null;
        this.animationId = null;
        this.isRunning = false;
        this.needsRender = true;

        this.onBeforeRender = null;
        this.onAfterRender = null;
        this.boundHandleResize = this.handleResize.bind(this);

        this.init();
    }

    init() {
        this.createScene();
        this.createCamera();
        this.createRenderer();
        this.setupEnvironment();
        this.createControls();
        this.setupEventListeners();
        this.startRenderLoop();
    }

    createScene() {
        this.scene = new THREE.Scene();
        this.scene.background = null;
        this.scene.fog = new THREE.FogExp2(this.config.environment.fogColor, this.config.environment.fogDensity);
    }

    createCamera() {
        const { fov, near, far, defaultPosition, lookAt } = this.config.camera;
        const aspect = this.container.clientWidth / this.container.clientHeight;

        this.camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
        this.camera.position.set(defaultPosition.x, defaultPosition.y, defaultPosition.z);
        this.camera.lookAt(lookAt.x, lookAt.y, lookAt.z);
    }

    createRenderer() {
        const { antialias, alpha, powerPreference, stencil, shadowMapEnabled, toneMapping, toneMappingExposure } = this.config.renderer;

        this.renderer = new THREE.WebGLRenderer({
            antialias,
            alpha,
            powerPreference,
            stencil,
        });

        this.renderer.setPixelRatio(this.getPixelRatio());
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.shadowMap.enabled = shadowMapEnabled;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = toneMapping;
        this.renderer.toneMappingExposure = toneMappingExposure;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;

        this.container.appendChild(this.renderer.domElement);
    }

    /**
     * 生成基于图像的环境光照（IBL）。
     * 使用 RoomEnvironment 通过 PMREMGenerator 预处理成环境贴图，
     * 只赋给 scene.environment（保持 scene.background 透明），
     * 让棋子/棋盘等 PBR 材质获得柔和的高光与反射，提升 3D 质感。
     */
    setupEnvironment() {
        if (!this.renderer || !this.scene) {
            return;
        }

        let pmremGenerator = null;
        let roomEnvironment = null;
        try {
            pmremGenerator = new THREE.PMREMGenerator(this.renderer);
            roomEnvironment = new RoomEnvironment();
            const renderTarget = pmremGenerator.fromScene(roomEnvironment, 0.04);
            this.environmentTexture = renderTarget.texture;
            this.scene.environment = this.environmentTexture;

            const intensity = this.config.environment?.environmentIntensity ?? 0.55;
            if ('environmentIntensity' in this.scene) {
                this.scene.environmentIntensity = intensity;
            }
        } catch (error) {
            console.warn('[SceneManager] 环境贴图初始化失败，已跳过 IBL:', error);
            this.environmentTexture = null;
        } finally {
            roomEnvironment?.dispose?.();
            pmremGenerator?.dispose?.();
        }
    }

    createControls() {
        const { minDistance, maxDistance, minPolarAngle, maxPolarAngle } = this.config.camera;

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.09;
        this.controls.minDistance = minDistance;
        this.controls.maxDistance = maxDistance;
        this.controls.minPolarAngle = minPolarAngle ?? 0;
        this.controls.maxPolarAngle = maxPolarAngle;
        this.controls.enablePan = true;
        this.controls.panSpeed = 0.82;
        this.controls.screenSpacePanning = false;
        this.controls.rotateSpeed = 1.04;
        this.controls.zoomSpeed = 1.12;
        this.controls.mouseButtons = {
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.PAN,
            RIGHT: THREE.MOUSE.PAN
        };
        if ('zoomToCursor' in this.controls) {
            this.controls.zoomToCursor = true;
        }
        this.controls.target.set(0, this.config.board.thickness / 2, 0);

        this.controls.addEventListener('change', () => {
            this.needsRender = true;
        });
    }

    setupEventListeners() {
        window.addEventListener('resize', this.boundHandleResize);
    }

    handleResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        if (!width || !height) {
            return;
        }

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();

        this.renderer.setPixelRatio(this.getPixelRatio());
        this.renderer.setSize(width, height);
        this.needsRender = true;
    }

    getPixelRatio() {
        const devicePixelRatio = window.devicePixelRatio || this.config.deviceProfile?.devicePixelRatio || 1;
        const pixelRatioCap = this.config.renderer.pixelRatioCap ?? 2;
        return Math.max(1, Math.min(devicePixelRatio, pixelRatioCap));
    }

    startRenderLoop() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.animate();
    }

    stopRenderLoop() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    animate() {
        if (!this.isRunning) return;

        this.animationId = requestAnimationFrame(this.animate.bind(this));

        if (this.onBeforeRender) {
            this.onBeforeRender();
        }

        this.controls.update();

        if (this.needsRender) {
            this.renderer.render(this.scene, this.camera);
            this.needsRender = false;
        }

        if (this.onAfterRender) {
            this.onAfterRender();
        }
    }

    /**
     * 添加对象到场景
     * @param {THREE.Object3D} object
     */
    add(object) {
        this.scene.add(object);
        this.needsRender = true;
    }

    /**
     * 从场景移除对象
     * @param {THREE.Object3D} object
     */
    remove(object) {
        this.scene.remove(object);
        this.needsRender = true;
    }

    /**
     * 标记需要重新渲染
     */
    setNeedsRender() {
        this.needsRender = true;
    }

    /**
     * 重置相机到默认位置
     * @param {boolean} animate 是否动画过渡
     */
    resetCamera(animate = true) {
        const { defaultPosition, lookAt } = this.config.camera;

        if (animate) {
            this.animateCameraTo(defaultPosition.x, defaultPosition.y, defaultPosition.z);
        } else {
            this.camera.position.set(defaultPosition.x, defaultPosition.y, defaultPosition.z);
            this.camera.lookAt(lookAt.x, lookAt.y, lookAt.z);
            this.controls.update();
            this.needsRender = true;
        }
    }

    /**
     * 动画移动相机到目标位置
     * @param {number} targetX
     * @param {number} targetY
     * @param {number} targetZ
     * @param {number} duration 动画时长（秒）
     */
    animateCameraTo(targetX, targetY, targetZ, duration = 1.0) {
        const startPos = this.camera.position.clone();
        const startTime = performance.now();
        const durationMs = duration * 1000;

        const animateCamera = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / durationMs, 1);
            const eased = this.easeOutCubic(progress);

            this.camera.position.x = startPos.x + (targetX - startPos.x) * eased;
            this.camera.position.y = startPos.y + (targetY - startPos.y) * eased;
            this.camera.position.z = startPos.z + (targetZ - startPos.z) * eased;

            this.controls.update();
            this.needsRender = true;

            if (progress < 1) {
                requestAnimationFrame(animateCamera);
            }
        };

        animateCamera();
    }

    /**
     * 缓动函数
     */
    easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    /**
     * 销毁场景管理器
     */
    dispose() {
        this.stopRenderLoop();
        window.removeEventListener('resize', this.boundHandleResize);

        if (this.controls) {
            this.controls.dispose();
        }

        if (this.scene) {
            this.scene.environment = null;
        }
        if (this.environmentTexture) {
            this.environmentTexture.dispose();
            this.environmentTexture = null;
        }

        if (this.renderer) {
            this.renderer.dispose();
            if (this.renderer.domElement.parentElement) {
                this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
            }
        }

        this.scene.traverse((object) => {
            if (object.geometry) {
                object.geometry.dispose();
            }
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach((material) => material.dispose());
                } else {
                    object.material.dispose();
                }
            }
        });
    }

    /**
     * 检测 WebGL 是否可用
     * @returns {boolean}
     */
    static isWebGLAvailable() {
        try {
            const canvas = document.createElement('canvas');
            return !!(window.WebGLRenderingContext &&
                (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
        } catch (e) {
            return false;
        }
    }
}
