/**
 * 3D 渲染模块入口
 * 导出所有 3D 渲染相关组件
 */

export { SceneManager } from './SceneManager.js';
export { BoardBuilder } from './BoardBuilder.js';
export { StoneBuilder } from './StoneBuilder.js';
export { CameraController, CAMERA_PRESETS } from './CameraController.js';
export { LightingSetup } from './LightingSetup.js';
export { MaterialFactory } from './MaterialFactory.js';
export { AnimationManager } from './AnimationManager.js';
export { InteractionHandler } from './InteractionHandler.js';
export { EnvironmentBuilder } from './EnvironmentBuilder.js';
export { ParticleSystem } from './ParticleSystem.js';

// 配置和工具函数
export { RENDER_CONFIG, getOptimalConfig, boardToWorld, worldToBoard, getBoardOffset } from '../config/renderConfig.js';
