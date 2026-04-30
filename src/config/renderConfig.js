/**
 * 3D 渲染配置
 * 集中管理棋盘、棋子、光照、相机的渲染参数
 */

import * as THREE from 'three';

export const RENDER_CONFIG = {
    // 棋盘配置
    board: {
        size: 15,               // 默认棋盘大小
        cellSize: 1.0,          // 每格单位尺寸
        thickness: 0.15,        // 棋盘厚度
        baseHeight: 0.1,        // 底座高度
        borderWidth: 0.4,       // 边框宽度
        starRadius: 0.08,       // 星位点半径
        gridLineWidth: 0.02,    // 网格线宽度
        textureSizeCap: 2048,   // 棋盘贴图尺寸上限
    },

    // 棋子配置
    stone: {
        radius: 0.42,           // 棋子半径（相对于 cellSize）
        height: 0.22,           // 棋子高度
        segments: 24,           // 经纬度分段数
        blackRoughness: 0.15,   // 黑子粗糙度
        blackMetalness: 0.1,    // 黑子金属度
        whiteRoughness: 0.25,   // 白子粗糙度
        whiteMetalness: 0.05,   // 白子金属度
        previewOpacity: 0.5,    // 预览棋子透明度
        usePhysicalStoneMaterials: true,
    },

    // 相机配置
    camera: {
        fov: 45,
        near: 0.1,
        far: 1000,
        defaultPosition: { x: 0, y: 12, z: 10 },
        lookAt: { x: 0, y: 0, z: 0 },
        minDistance: 8,
        maxDistance: 38,
        minPolarAngle: Math.PI / 7,
        maxPolarAngle: Math.PI / 1.58,
    },

    // 光照配置
    lighting: {
        ambient: {
            color: 0xffffff,
            intensity: 0.5,
        },
        main: {
            color: 0xffffff,
            intensity: 1.2,
            position: { x: 8, y: 15, z: 8 },
            castShadow: true,
            shadowMapSize: 2048,
        },
        fill: {
            color: 0xfff5e6,
            intensity: 0.4,
            position: { x: -6, y: 10, z: -4 },
        },
        rim: {
            color: 0xe6f0ff,
            intensity: 0.3,
            position: { x: 0, y: 5, z: -10 },
        },
    },

    // 材质颜色
    colors: {
        board: 0xdeb887,        // 木纹底色（浅棕）
        boardDark: 0x8b7355,    // 木纹深色
        grid: 0x2f2f2f,         // 网格线颜色
        star: 0x1a1a1a,         // 星位点颜色
        border: 0x5c4033,       // 边框颜色
        blackStone: 0x1a1a1a,   // 黑子颜色
        whiteStone: 0xf5f5f0,   // 白子颜色
        previewBlack: 0x333333, // 预览黑子颜色
        previewWhite: 0xcccccc, // 预览白子颜色
    },

    // 动画配置
    animation: {
        dropDuration: 0.4,      // 落子动画时长（秒）
        dropHeight: 3,          // 落子初始高度
        bounceScale: 0.9,       // 弹跳缩放比例
        winPulseDuration: 1.5,  // 获胜脉冲周期
        winPulseIntensity: 0.3, // 获胜脉冲强度
        cameraEntryDuration: 1.0, // 相机入场动画时长
    },

    // 渲染器配置
    renderer: {
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
        stencil: false,
        shadowMapEnabled: true,
        pixelRatioCap: 2,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.0,
    },

    highQuality: {
        shadowMapSize: 2048,
        stoneSegments: 32,
        pixelRatioCap: 2,
        antialias: true,
        usePhysicalStoneMaterials: true,
        boardTextureSizeCap: 2048,
    },

    // 移动端配置：降低 DPR，但保留抗锯齿
    mobileQuality: {
        shadowMapSize: 1024,
        stoneSegments: 16,
        pixelRatioCap: 1.25,
        antialias: true,
        usePhysicalStoneMaterials: false,
        boardTextureSizeCap: 1024,
    },

    // 降质配置（低内存桌面）
    lowQuality: {
        shadowMapSize: 1024,
        stoneSegments: 16,
        pixelRatioCap: 1.5,
        antialias: true,
        usePhysicalStoneMaterials: false,
        boardTextureSizeCap: 1536,
    },

    // 极低端设备配置
    extremeLowQuality: {
        shadowMapSize: 512,
        stoneSegments: 12,
        pixelRatioCap: 1,
        antialias: false,
        usePhysicalStoneMaterials: false,
        boardTextureSizeCap: 1024,
    },

    // 场景环境配置
    environment: {
        fogColor: 0x08111d,
        fogDensity: 0.026,
        platformHeight: 0.42,
        platformRadiusPadding: 4.8,
        floorSize: 64,
    },
};

const MOBILE_USER_AGENT_PATTERN = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

function getDeviceProfile() {
    const nav = typeof navigator !== 'undefined' ? navigator : {};
    const win = typeof window !== 'undefined' ? window : {};
    const userAgent = nav.userAgent ?? '';
    const coarsePointer = win.matchMedia?.('(pointer: coarse)')?.matches ?? false;
    const isMobile = MOBILE_USER_AGENT_PATTERN.test(userAgent) || coarsePointer;
    const deviceMemory = typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null;
    const hardwareConcurrency = typeof nav.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : null;
    const isLowMemory = deviceMemory !== null && deviceMemory <= 4;
    const isVeryLowMemory = deviceMemory !== null && deviceMemory <= 2;
    const isVeryLowCoreMobile = isMobile && hardwareConcurrency !== null && hardwareConcurrency <= 2;
    const isExtremeLowEnd = isVeryLowMemory || isVeryLowCoreMobile;
    const devicePixelRatio = win.devicePixelRatio || 1;
    const isLowDpr = devicePixelRatio <= 1.25;
    const isReducedQuality = isMobile || isLowMemory;
    const isHighPerformance = !isReducedQuality
        && (deviceMemory === null || deviceMemory >= 8)
        && (hardwareConcurrency === null || hardwareConcurrency >= 8);

    return {
        tier: isExtremeLowEnd ? 'extreme' : isReducedQuality ? 'low' : isHighPerformance ? 'high' : 'balanced',
        isMobile,
        isLowMemory,
        isExtremeLowEnd,
        isHighPerformance,
        isLowDpr,
        deviceMemory,
        hardwareConcurrency,
        devicePixelRatio,
    };
}

function getQualityOverrides(deviceProfile) {
    if (deviceProfile.isExtremeLowEnd) {
        return RENDER_CONFIG.extremeLowQuality;
    }

    if (deviceProfile.isMobile) {
        return RENDER_CONFIG.mobileQuality;
    }

    if (deviceProfile.isLowMemory) {
        return RENDER_CONFIG.lowQuality;
    }

    if (deviceProfile.isHighPerformance) {
        return RENDER_CONFIG.highQuality;
    }

    return {};
}

/**
 * 根据设备性能返回适当配置
 * @returns {Object} 优化后的配置
 */
export function getOptimalConfig() {
    const deviceProfile = getDeviceProfile();
    const quality = getQualityOverrides(deviceProfile);
    const antialias = deviceProfile.isExtremeLowEnd
        ? quality.antialias ?? false
        : true;

    return {
        ...RENDER_CONFIG,
        deviceProfile,
        board: {
            ...RENDER_CONFIG.board,
            textureSizeCap: quality.boardTextureSizeCap ?? RENDER_CONFIG.board.textureSizeCap,
        },
        renderer: {
            ...RENDER_CONFIG.renderer,
            antialias,
            pixelRatioCap: quality.pixelRatioCap ?? RENDER_CONFIG.renderer.pixelRatioCap,
        },
        lighting: {
            ...RENDER_CONFIG.lighting,
            main: {
                ...RENDER_CONFIG.lighting.main,
                shadowMapSize: quality.shadowMapSize ?? RENDER_CONFIG.lighting.main.shadowMapSize,
            },
        },
        stone: {
            ...RENDER_CONFIG.stone,
            segments: quality.stoneSegments ?? RENDER_CONFIG.stone.segments,
            usePhysicalStoneMaterials: quality.usePhysicalStoneMaterials ?? RENDER_CONFIG.stone.usePhysicalStoneMaterials,
        },
    };
}

/**
 * 计算棋盘中心偏移
 * @param {number} size 棋盘大小
 * @param {number} cellSize 格子尺寸
 * @returns {number} 偏移量
 */
export function getBoardOffset(size, cellSize) {
    return ((size - 1) * cellSize) / 2;
}

/**
 * 棋盘坐标转世界坐标
 * @param {number} row 行号
 * @param {number} col 列号
 * @param {number} size 棋盘大小
 * @param {number} cellSize 格子尺寸
 * @returns {{x: number, z: number}} 世界坐标
 */
export function boardToWorld(row, col, size, cellSize) {
    const offset = getBoardOffset(size, cellSize);
    return {
        x: col * cellSize - offset,
        z: row * cellSize - offset,
    };
}

/**
 * 世界坐标转棋盘坐标
 * @param {number} x 世界坐标 x
 * @param {number} z 世界坐标 z
 * @param {number} size 棋盘大小
 * @param {number} cellSize 格子尺寸
 * @returns {{row: number, col: number} | null} 棋盘坐标，越界返回 null
 */
export function worldToBoard(x, z, size, cellSize) {
    const offset = getBoardOffset(size, cellSize);
    const tolerance = cellSize * 1e-3;
    const outerHalfCell = cellSize / 2 - tolerance;

    // 允许命中落在最外圈线外半格内的区域，保持边线交叉点在 3D 里仍然容易点击；
    // 再往外的射线命中仍然视为越界，避免把远离棋盘的命中误判到边线坐标。
    if (
        x < -offset - outerHalfCell
        || x > offset + outerHalfCell
        || z < -offset - outerHalfCell
        || z > offset + outerHalfCell
    ) {
        return null;
    }

    const col = Math.round((x + offset) / cellSize);
    const row = Math.round((z + offset) / cellSize);

    if (row < 0 || row >= size || col < 0 || col >= size) {
        return null;
    }

    return { row, col };
}
