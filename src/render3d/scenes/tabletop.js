import * as THREE from 'three';
import { getSceneSpec } from '../../config/sceneConfig.js';
import { addBox, addCylinder, addPlane, addTable, material } from './props.js';

const FALLBACK_MOOD = {
    floor: 0x1a1c22,
    table: 0x4a3a28,
    legs: 0x2c241c,
    backdrop: 0x2a3040,
    lamp: 0xcfc6b8
};

/**
 * 程序化生成竖向木纹灰度贴图（近白底 + 半透明深色纹路），
 * 与桌面材质 color 相乘即可染出各氛围的木色，零额外资源。
 */
function getWoodGrainTexture(builder) {
    const key = 'tabletop:wood-grain';
    const cached = builder.sharedTextures.get(key);
    if (cached) {
        return cached;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ece4d2';
    ctx.fillRect(0, 0, 256, 256);

    for (let i = 0; i < 170; i += 1) {
        const x = Math.random() * 256;
        const width = 0.6 + Math.random() * 2.6;
        const alpha = 0.04 + Math.random() * 0.15;
        const sway = Math.sin(i * 0.73) * 7 + (Math.random() - 0.5) * 9;
        ctx.strokeStyle = `rgba(122, 92, 54, ${alpha.toFixed(3)})`;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(x, -6);
        ctx.bezierCurveTo(
            x + sway,
            64,
            x - sway * 0.55,
            196,
            x + (Math.random() - 0.5) * 6,
            262
        );
        ctx.stroke();
    }

    // 少量更深的宽年轮带
    for (let i = 0; i < 9; i += 1) {
        const x = Math.random() * 256;
        const width = 5 + Math.random() * 10;
        ctx.strokeStyle = `rgba(96, 70, 40, ${(0.05 + Math.random() * 0.06).toFixed(3)})`;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(x, -6);
        ctx.lineTo(x + (Math.random() - 0.5) * 14, 262);
        ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 1.4);
    texture.anisotropy = 4;
    texture.colorSpace = THREE.SRGBColorSpace;

    builder.sharedTextures.set(key, texture);
    builder.track(texture);
    return texture;
}

/**
 * 背板用的垂直亮度渐变（顶部亮、底部沉），
 * 与背板 color 相乘模拟上方灯光打亮的墙面，替代死色块。
 */
function getBackdropGradientTexture(builder) {
    const key = 'tabletop:backdrop-gradient';
    const cached = builder.sharedTextures.get(key);
    if (cached) {
        return cached;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 128);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.55, '#cfcfcf');
    gradient.addColorStop(1, '#8f8f8f');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 8, 128);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.colorSpace = THREE.SRGBColorSpace;

    builder.sharedTextures.set(key, texture);
    builder.track(texture);
    return texture;
}

export function getTabletopMood(preset = 'competition') {
    return getSceneSpec(preset).tabletop || FALLBACK_MOOD;
}

function applyHex(materialRef, hex) {
    if (materialRef?.color && typeof hex === 'number') {
        materialRef.color.setHex(hex);
    }
}

/**
 * Shared floor + table + backdrop. Moods only recolor materials.
 * @returns {{ floor: object, table: object, legs: object, backdrop: object, lamp: object }}
 */
export function buildTabletop(builder, ctx, preset = 'competition') {
    const mood = getTabletopMood(preset);
    const tableSize = ctx.boardTotal + 4.4;
    const group = builder.group;

    const floorMat = material(builder, 'tabletop-floor', {
        color: mood.floor,
        roughness: 0.96,
        metalness: 0.02
    });
    const backdropMat = material(builder, 'tabletop-backdrop', {
        color: mood.backdrop,
        roughness: 0.92,
        metalness: 0.0,
        map: getBackdropGradientTexture(builder)
    });
    const lampMat = material(builder, 'tabletop-lamp', {
        color: mood.lamp,
        roughness: 0.42,
        metalness: 0.18,
        emissive: new THREE.Color(mood.lamp),
        emissiveIntensity: 0.32
    });

    addPlane(builder, group, 'tabletop-floor', [42, 48], [0, ctx.floorY, 0], floorMat, {
        rotation: [-Math.PI / 2, 0, 0],
        castShadow: false,
        receiveShadow: true
    });

    addPlane(builder, group, 'tabletop-backdrop', [36, 16], [0, ctx.floorY + 7.2, -14.5], backdropMat, {
        castShadow: false,
        receiveShadow: false
    });

    addTable(builder, group, 'tabletop', ctx, {
        width: tableSize,
        depth: tableSize,
        color: mood.table,
        legColor: mood.legs,
        topY: ctx.supportTopY,
        floorY: ctx.floorY,
        height: 2.8,
        castShadow: true,
        map: getWoodGrainTexture(builder)
    });

    const lampX = tableSize * 0.36;
    const lampZ = -tableSize * 0.34;
    addCylinder(
        builder,
        group,
        'tabletop-lamp-stem',
        [0.05, 0.07],
        1.8,
        [lampX, ctx.supportTopY + 0.9, lampZ],
        lampMat,
        { segments: 10, castShadow: false, receiveShadow: false }
    );
    addBox(builder, group, 'tabletop-lamp-shade', [0.62, 0.18, 0.62], [lampX, ctx.supportTopY + 1.86, lampZ], lampMat, {
        castShadow: false,
        receiveShadow: false
    });

    return {
        floor: floorMat,
        table: builder.sharedMaterials.get('tabletop:table-top-material'),
        legs: builder.sharedMaterials.get('tabletop:table-leg-material'),
        backdrop: backdropMat,
        lamp: lampMat
    };
}

export function applyTabletopMood(materials, preset = 'competition') {
    const mood = getTabletopMood(preset);
    if (!materials) {
        return;
    }
    applyHex(materials.floor, mood.floor);
    applyHex(materials.table, mood.table);
    applyHex(materials.legs, mood.legs);
    applyHex(materials.backdrop, mood.backdrop);
    applyHex(materials.lamp, mood.lamp);
}
