import * as THREE from 'three';
import { getSceneSpec } from '../../config/sceneConfig.js';
import {
    addBench,
    addBookStack,
    addBox,
    addChair,
    addCone,
    addCylinder,
    addLathe,
    addPlane,
    addPottedPlant,
    addRug,
    addSphere,
    addTable,
    addTeaSet,
    addTree,
    material
} from './props.js';
import {
    getBackdropGradientTexture,
    getFabricWeaveTexture,
    getGlowStripTexture,
    getInkArtTexture,
    getScoreboardTexture,
    getStoneSpeckleTexture,
    getWoodGrainTexture
} from './textures.js';

const FALLBACK_MOOD = {
    floor: 0x1a1c22,
    table: 0x4a3a28,
    legs: 0x2c241c,
    backdrop: 0x2a3040,
    lamp: 0xcfc6b8,
    props: {}
};

export function getTabletopMood(preset = 'competition') {
    return getSceneSpec(preset).tabletop || FALLBACK_MOOD;
}

function applyHex(materialRef, hex) {
    if (materialRef?.color && typeof hex === 'number') {
        materialRef.color.setHex(hex);
    }
}

/** 复用同一张画布但需要不同平铺密度时，克隆贴图实例。 */
function cloneTiled(builder, texture, repeatX, repeatY) {
    if (!texture) {
        return null;
    }
    const clone = texture.clone();
    clone.needsUpdate = true;
    clone.repeat.set(repeatX, repeatY);
    builder.track(clone);
    return clone;
}

/** 发光材质：克隆一份独立实例，供动画单独调 emissiveIntensity。 */
function glowMaterial(builder, key, color, intensity) {
    const base = material(builder, key, {
        color,
        emissive: new THREE.Color(color),
        emissiveIntensity: intensity,
        roughness: 0.55,
        metalness: 0.0
    }).clone();
    builder.track(base);
    return base;
}

/**
 * 车床旋转体棋罐：罐身鼓腹收口 + 扣合的盖子一体成型，
 * 比圆柱堆叠更接近真实棋罐的曲线轮廓。
 */
function bowlProfile(s) {
    return [
        [0, 0], [0.36, 0], [0.52, 0.03], [0.64, 0.15], [0.7, 0.32],
        [0.67, 0.46], [0.57, 0.57], [0.52, 0.6],
        [0.56, 0.63], [0.58, 0.66], [0.46, 0.72], [0.26, 0.77], [0.1, 0.79], [0, 0.795]
    ].map(([radius, y]) => [radius * s, y * s]);
}

/**
 * 共享桌面道具：两只棋罐（车床曲线 + 盖钮）。
 * 摆在棋盘边缘与桌沿之间的空带上，避免遮挡俯视棋盘与交互射线。
 */
function buildBowls(builder, group, ctx, palette) {
    const s = ctx.sceneScale;
    const topY = ctx.supportTopY;
    const profile = bowlProfile(s);
    const bowlInset = ctx.boardHalf + 1.05 * s;
    const bowlSide = ctx.boardHalf * 0.42;

    [
        { color: palette.bowlBlack ?? 0x2f3a34, x: bowlInset, z: bowlSide, key: 'black' },
        { color: palette.bowlWhite ?? 0x8a5a34, x: -bowlInset, z: -bowlSide, key: 'white' }
    ].forEach(({ color, x, z, key }) => {
        const bowlMat = material(builder, `tabletop:bowl-${key}`, {
            color,
            roughness: 0.46,
            metalness: 0.06
        });
        addLathe(builder, group, `tabletop:bowl-${key}-body`, profile, [x, topY, z], bowlMat, {
            segments: 28,
            castShadow: true
        });
        addSphere(builder, group, `tabletop:bowl-${key}-knob`, 0.1 * s, [x, topY + 0.82 * s, z], bowlMat, {
            castShadow: false
        });
    });
}

/** 落地/桌面灯：锥形灯罩 + 细杆 + 罩内发光面。 */
function buildDeskLamp(builder, group, ctx, lampMat, tableSize) {
    const lampX = tableSize * 0.36;
    const lampZ = -tableSize * 0.34;
    addCylinder(builder, group, 'tabletop-lamp-stem', [0.05, 0.07], 1.8, [lampX, ctx.supportTopY + 0.9, lampZ], lampMat, {
        segments: 10,
        castShadow: false,
        receiveShadow: false
    });
    addCone(builder, group, 'tabletop-lamp-shade', 0.38, 0.46, [lampX, ctx.supportTopY + 1.86, lampZ], lampMat, {
        segments: 16,
        openEnded: true,
        castShadow: false,
        receiveShadow: false
    });
    const bulbMat = glowMaterial(builder, 'tabletop-lamp-bulb', 0xffe3b8, 1.4);
    addSphere(builder, group, 'tabletop-lamp-bulb', 0.12, [lampX, ctx.supportTopY + 1.76, lampZ], bulbMat, {
        castShadow: false,
        receiveShadow: false
    });
}

/** 窗帘：几片错位的窄板拼出褶皱，比一整块平面立体。 */
function buildCurtain(builder, group, key, { x, y, z, width, height, folds, color }) {
    const curtainMat = material(builder, `${key}:curtain`, {
        color,
        roughness: 0.96,
        metalness: 0.0,
        map: getFabricWeaveTexture(builder)
    });
    const foldWidth = width / folds;
    for (let index = 0; index < folds; index += 1) {
        const offset = -width / 2 + foldWidth * (index + 0.5);
        addBox(builder, group, `${key}:curtain-fold`, [foldWidth * 0.96, height, 0.12 + (index % 2) * 0.08], [
            x + offset,
            y,
            z
        ], curtainMat, {
            castShadow: false,
            name: `${key}:curtain-fold-${index}`
        });
    }
}

/**
 * 家里·窗边对局：木地板 + 纹样地毯 + L 形墙角 + 发光窗与窗帘 +
 * 书架书堆 + 水墨挂画 + 沙发茶几 + 盆栽 + 对坐两椅 + 桌上茶具。
 */
function buildHomeScene(builder, group, ctx, mood, mats) {
    const s = ctx.sceneScale;
    const palette = mood.props ?? {};
    const floorY = ctx.floorY;
    const backZ = -14.5 * s;
    const sideX = -16 * s;
    const wallHeight = 15;
    const wallCenterY = floorY + wallHeight / 2;
    const tableSize = ctx.boardTotal + 4.4;

    addRug(builder, group, 'home', {
        width: ctx.boardTotal * 1.85,
        depth: ctx.boardTotal * 1.62,
        position: [0, floorY, 0.6 * s],
        color: palette.carpet ?? 0x5e3226,
        edgeColor: palette.carpetEdge ?? 0x4a2620
    });

    const wallMat = material(builder, 'home:wall', {
        color: palette.wall ?? 0x30231a,
        roughness: 0.94,
        metalness: 0.0,
        map: getBackdropGradientTexture(builder)
    });
    addPlane(builder, group, 'home:wall-back', [40 * s, wallHeight], [0, wallCenterY, backZ], wallMat, {
        castShadow: false,
        receiveShadow: true
    });
    addPlane(builder, group, 'home:wall-side', [34 * s, wallHeight], [sideX, wallCenterY, backZ / 2 + 4 * s], wallMat, {
        rotation: [0, Math.PI / 2, 0],
        castShadow: false,
        receiveShadow: true
    });

    const trimMat = material(builder, 'home:wall-trim', {
        color: palette.wallTrim ?? 0x1f1610,
        roughness: 0.8,
        metalness: 0.02
    });
    addBox(builder, group, 'home:skirting-back', [40 * s, 0.5, 0.14], [0, floorY + 0.25, backZ + 0.08], trimMat, {
        castShadow: false
    });
    addBox(builder, group, 'home:skirting-side', [0.14, 0.5, 34 * s], [sideX + 0.08, floorY + 0.25, backZ / 2 + 4 * s], trimMat, {
        castShadow: false
    });
    addBox(builder, group, 'home:picture-rail', [40 * s, 0.22, 0.1], [0, floorY + 9.6, backZ + 0.06], trimMat, {
        castShadow: false
    });

    // 发光窗：窗框贴墙 + 暖光窗芯，是"窗边对局"的光源记忆点
    const frameMat = material(builder, 'home:window-frame', {
        color: palette.windowFrame ?? 0x241a12,
        roughness: 0.7,
        metalness: 0.03
    });
    const glowMat = glowMaterial(builder, 'home:window-glow', palette.windowGlow ?? 0xffd9a0, 1.25);
    const winX = 5.4 * s;
    const winY = floorY + 6.6;
    const winW = 5.2 * s;
    const winH = 4.2;
    addPlane(builder, group, 'home:window-glow', [winW - 0.5, winH - 0.5], [winX, winY, backZ + 0.05], glowMat, {
        castShadow: false,
        receiveShadow: false
    });
    addBox(builder, group, 'home:window-top', [winW + 0.3, 0.24, 0.16], [winX, winY + winH / 2, backZ + 0.1], frameMat, { castShadow: false });
    addBox(builder, group, 'home:window-bottom', [winW + 0.3, 0.24, 0.16], [winX, winY - winH / 2, backZ + 0.1], frameMat, { castShadow: false });
    addBox(builder, group, 'home:window-sill', [winW + 0.7, 0.16, 0.44], [winX, winY - winH / 2 - 0.16, backZ + 0.24], frameMat, { castShadow: false });
    addBox(builder, group, 'home:window-left', [0.24, winH + 0.3, 0.16], [winX - winW / 2, winY, backZ + 0.1], frameMat, { castShadow: false });
    addBox(builder, group, 'home:window-right', [0.24, winH + 0.3, 0.16], [winX + winW / 2, winY, backZ + 0.1], frameMat, { castShadow: false });
    addBox(builder, group, 'home:window-mullion-v', [0.14, winH - 0.4, 0.12], [winX, winY, backZ + 0.1], frameMat, { castShadow: false });
    addBox(builder, group, 'home:window-mullion-h', [winW - 0.4, 0.14, 0.12], [winX, winY, backZ + 0.1], frameMat, { castShadow: false });

    // 两侧窗帘：褶皱窄板 + 顶部帘杆
    addCylinder(builder, group, 'home:curtain-rod', [0.07, 0.07], winW + 2.6, [winX, winY + winH / 2 + 0.6, backZ + 0.34], frameMat, {
        segments: 8,
        castShadow: false,
        rotation: [0, 0, Math.PI / 2]
    });
    [-1, 1].forEach((side) => {
        buildCurtain(builder, group, `home:curtain-${side === 1 ? 'right' : 'left'}`, {
            x: winX + side * (winW / 2 + 0.75),
            y: winY + 0.2,
            z: backZ + 0.34,
            width: 1.5 * s,
            height: winH + 1.6,
            folds: 4,
            color: palette.curtain ?? 0x7a4a3a
        });
    });

    // 窗内侧暖色点光：让发光窗真正往屋里洒光（无阴影，成本可控）
    const windowLight = new THREE.PointLight(palette.windowGlow ?? 0xffd9a0, 0.9, 28 * s, 1.8);
    windowLight.position.set(winX, winY - 0.5, backZ + 1.8);
    windowLight.name = 'home:window-light';
    group.add(windowLight);

    // 窗光呼吸：极缓的明暗起伏，像午后阳光掠过云影
    builder.registerAnimator((time) => {
        const wave = Math.sin(time * 0.55) * 0.5 + 0.5;
        glowMat.emissiveIntensity = 1.12 + wave * 0.22;
        windowLight.intensity = 0.82 + wave * 0.14;
    });

    // 侧墙水墨挂画
    const paintingFrameMat = material(builder, 'home:painting-frame', {
        color: palette.painting ?? 0x8a6a4a,
        roughness: 0.6,
        metalness: 0.08
    });
    const paintingArtMat = material(builder, 'home:painting-art', {
        color: palette.paintingArt ?? 0xc8d2dc,
        roughness: 0.9,
        metalness: 0.0,
        map: getInkArtTexture(builder)
    });
    const paintY = floorY + 6.4;
    const paintZ = -3.5 * s;
    addBox(builder, group, 'home:painting-frame', [0.14, 3.1, 2.4 * s], [sideX + 0.12, paintY, paintZ], paintingFrameMat, { castShadow: false });
    addPlane(builder, group, 'home:painting-art', [2.0 * s, 2.7], [sideX + 0.22, paintY, paintZ], paintingArtMat, {
        rotation: [0, Math.PI / 2, 0],
        castShadow: false,
        receiveShadow: false
    });

    // 靠墙书架：立柱 + 三层隔板 + 竖排书脊 + 顶层平放书堆
    const shelfMat = material(builder, 'home:shelf', {
        color: palette.shelf ?? 0x3a2a1c,
        roughness: 0.78,
        metalness: 0.02
    });
    const shelfX = -8.5 * s;
    const shelfZ = backZ + 0.95;
    const shelfHeight = 5.2;
    addBox(builder, group, 'home:shelf-left', [0.22, shelfHeight, 1.5], [shelfX - 1.9 * s, floorY + shelfHeight / 2, shelfZ], shelfMat, { castShadow: true });
    addBox(builder, group, 'home:shelf-right', [0.22, shelfHeight, 1.5], [shelfX + 1.9 * s, floorY + shelfHeight / 2, shelfZ], shelfMat, { castShadow: true });
    addBox(builder, group, 'home:shelf-back', [3.8 * s, shelfHeight, 0.1], [shelfX, floorY + shelfHeight / 2, shelfZ - 0.72], shelfMat, { castShadow: false });
    [1.15, 2.75, 4.35].forEach((h, index) => {
        addBox(builder, group, `home:shelf-board-${index}`, [3.8 * s, 0.14, 1.5], [shelfX, floorY + h, shelfZ], shelfMat, { castShadow: true });
    });
    const bookColors = palette.books ?? [0x8a4a3a, 0x4a6a52, 0xc2a05a, 0x53638a, 0x7a4a62];
    for (let index = 0; index < 14; index += 1) {
        const color = bookColors[index % bookColors.length];
        const bookMat = material(builder, `home:book-spine-${index % bookColors.length}`, {
            color,
            roughness: 0.85,
            metalness: 0.0
        });
        const row = index < 7 ? 0 : 1;
        const rowY = row === 0 ? 1.15 : 2.75;
        const slot = index % 7;
        const height = 1.0 + ((index * 7) % 3) * 0.12;
        const thickness = (0.2 + ((index * 5) % 3) * 0.07) * s;
        addBox(builder, group, `home:book-spine-${index}`, [thickness, height, 1.05], [
            shelfX - 1.55 * s + slot * 0.5 * s,
            floorY + rowY + 0.07 + height / 2,
            shelfZ - 0.05
        ], bookMat, {
            castShadow: false,
            rotation: [0, 0, index % 5 === 4 ? 0.13 : 0]
        });
    }
    addBookStack(builder, group, 'home:shelf-stack', [shelfX + 0.9 * s, floorY + 4.42, shelfZ], {
        colors: bookColors.slice(0, 3),
        scale: 1.25 * s,
        rotationY: 0.24
    });

    // 沙发与茶几：远景轮廓，补足"客厅"的体量层次
    const sofaMat = material(builder, 'home:sofa', {
        color: palette.sofa ?? 0x4a3a4e,
        roughness: 0.95,
        metalness: 0.0,
        map: getFabricWeaveTexture(builder)
    });
    const sofaX = 12.5 * s;
    const sofaZ = -6.5 * s;
    const sofaGroup = new THREE.Group();
    sofaGroup.name = 'home:sofa';
    sofaGroup.position.set(sofaX, floorY, sofaZ);
    sofaGroup.rotation.y = -Math.PI / 2.3;
    group.add(sofaGroup);
    addBox(builder, sofaGroup, 'home:sofa-base', [5.6 * s, 1.05, 2.4 * s], [0, 0.52, 0], sofaMat, { castShadow: true });
    addBox(builder, sofaGroup, 'home:sofa-back', [5.6 * s, 1.75, 0.6 * s], [0, 1.4, -0.9 * s], sofaMat, { castShadow: true });
    [-1, 1].forEach((side) => {
        addBox(builder, sofaGroup, 'home:sofa-arm', [0.55 * s, 0.85, 2.4 * s], [side * 2.5 * s, 1.35, 0], sofaMat, {
            castShadow: true,
            name: `home:sofa-arm-${side === 1 ? 'right' : 'left'}`
        });
    });
    [-1.35, 0, 1.35].forEach((offset, index) => {
        addBox(builder, sofaGroup, 'home:sofa-cushion', [1.7 * s, 0.42, 2.0 * s], [offset * s, 1.24, 0.12 * s], sofaMat, {
            castShadow: false,
            rotation: [0, 0, index === 1 ? 0 : (index === 0 ? 0.02 : -0.02)],
            name: `home:sofa-cushion-${index}`
        });
    });

    const coffeeMat = material(builder, 'home:coffee-table', {
        color: palette.coffeeTable ?? 0x4b3628,
        roughness: 0.7,
        metalness: 0.03,
        map: getWoodGrainTexture(builder)
    });
    const coffeeX = 8.6 * s;
    const coffeeZ = -2.6 * s;
    addBox(builder, group, 'home:coffee-top', [2.9 * s, 0.18, 1.7 * s], [coffeeX, floorY + 1.05, coffeeZ], coffeeMat, {
        castShadow: true,
        rotation: [0, -0.34, 0]
    });
    [-1, 1].forEach((dx) => {
        [-1, 1].forEach((dz) => {
            addBox(builder, group, 'home:coffee-leg', [0.16, 1.0, 0.16], [
                coffeeX + dx * 1.2 * s,
                floorY + 0.5,
                coffeeZ + dz * 0.62 * s
            ], coffeeMat, {
                castShadow: false,
                name: `home:coffee-leg-${dx}-${dz}`
            });
        });
    });
    addBookStack(builder, group, 'home:coffee-books', [coffeeX - 0.5 * s, floorY + 1.14, coffeeZ], {
        colors: bookColors.slice(2),
        scale: 1.35 * s,
        rotationY: -0.34
    });

    const plantColors = {
        pot: palette.pot ?? 0x8f5a3d,
        leaf: palette.plantLeaf ?? 0x54744a,
        leafDark: palette.plantLeafDark ?? 0x3f5c38
    };
    addPottedPlant(builder, group, 'home:plant', [-12.6 * s, floorY, backZ + 1.6], 2.4, plantColors);
    addPottedPlant(builder, group, 'home:plant', [winX + 1.6 * s, winY - winH / 2 - 0.08, backZ + 0.26], 0.85, plantColors);

    addChair(builder, group, 'home:chair-north', [0, floorY, -tableSize * 0.78], 0, {
        color: palette.chair ?? 0x5d4634,
        cushionColor: palette.cushion ?? 0x7a4a3a,
        scale: 1.35 * s
    });
    addChair(builder, group, 'home:chair-south', [0, floorY, tableSize * 0.78], Math.PI, {
        color: palette.chair ?? 0x5d4634,
        cushionColor: palette.cushion ?? 0x7a4a3a,
        scale: 1.35 * s
    });

    addTeaSet(builder, group, 'home:tea', [-(ctx.boardHalf + 1.15 * s), ctx.supportTopY, ctx.boardHalf * 0.55], {
        scale: 1.15 * s,
        potColor: palette.teapot ?? 0x6d5240,
        cupColor: palette.cup ?? 0xd8cfc0,
        trayColor: palette.tray ?? 0x4a3526,
        teaColor: palette.tea ?? 0x9a7a3a,
        rotationY: 0.4
    });

    buildDeskLamp(builder, group, ctx, mats.lamp, tableSize);
}

/**
 * 公园·树荫棋桌：草地 + 石纹圆台 + 汀步小径 + 花坛 + 远处树线 +
 * 树荫三株 + 灌木 + 长椅 + 石灯笼 + 野餐布 + 桌上茶具。
 */
function buildParkScene(builder, group, ctx, mood) {
    const s = ctx.sceneScale;
    const palette = mood.props ?? {};
    const floorY = ctx.floorY;
    const tableSize = ctx.boardTotal + 4.4;
    const stoneTexture = getStoneSpeckleTexture(builder);

    const stoneMat = material(builder, 'park:stone', {
        color: palette.path ?? 0xbfbaad,
        roughness: 0.92,
        metalness: 0.0,
        map: stoneTexture
    });
    const stoneEdgeMat = material(builder, 'park:stone-edge', {
        color: palette.pathEdge ?? 0xa19c91,
        roughness: 0.95,
        metalness: 0.0,
        map: stoneTexture
    });
    addCylinder(builder, group, 'park:plaza', [tableSize * 0.72, tableSize * 0.76], 0.1, [0, floorY + 0.05, 0], stoneMat, {
        segments: 34,
        castShadow: false
    });
    addCylinder(builder, group, 'park:plaza-rim', [tableSize * 0.8, tableSize * 0.82], 0.06, [0, floorY + 0.03, 0], stoneEdgeMat, {
        segments: 34,
        castShadow: false
    });
    // 汀步小径伸向前景
    for (let index = 0; index < 5; index += 1) {
        const z = tableSize * 0.86 + index * 2.0 * s;
        const x = (index % 2 === 0 ? 0.7 : -0.7) * s;
        addBox(builder, group, `park:step-${index}`, [1.9 * s, 0.1, 1.25 * s], [x, floorY + 0.05, z], index % 2 ? stoneMat : stoneEdgeMat, {
            castShadow: false,
            rotation: [0, (index % 2 === 0 ? 0.14 : -0.1), 0]
        });
    }

    // 远处树线：压扁的暗色球冠排成一线，给天空背板一个地平线
    const treeLineMat = material(builder, 'park:tree-line', {
        color: palette.treeLine ?? 0x3f5a38,
        roughness: 0.98,
        metalness: 0.0
    });
    for (let index = 0; index < 9; index += 1) {
        const x = (-20 + index * 5.1) * s;
        const radius = (2.4 + ((index * 7) % 4) * 0.5) * s;
        addSphere(builder, group, 'park:tree-line', radius, [x, floorY + radius * 0.42, -19 * s], treeLineMat, {
            castShadow: false,
            receiveShadow: false,
            scale: [1.3, 0.8, 0.9],
            widthSegments: 12,
            heightSegments: 8,
            name: `park:tree-line-${index}`
        });
    }

    // 树木与灌木围出树荫感；树冠标记为动态对象并注册微风摇曳
    const treeRigs = [
        addTree(builder, group, 'park:tree-a', [-13.5 * s, floorY, -9.5 * s], 1.5, {
            trunk: palette.treeTrunk,
            canopy: palette.treeCanopy
        }),
        addTree(builder, group, 'park:tree-b', [12.5 * s, floorY, -12 * s], 1.9, {
            trunk: palette.treeTrunk,
            canopy: palette.treeCanopyAlt ?? palette.treeCanopy
        }),
        addTree(builder, group, 'park:tree-c', [16 * s, floorY, 0.5 * s], 1.2, {
            trunk: palette.treeTrunk,
            canopy: palette.treeCanopy
        })
    ];
    treeRigs.forEach(({ canopyRig }, index) => {
        builder.markDynamic(canopyRig);
        const phase = index * 1.7;
        builder.registerAnimator((time) => {
            canopyRig.rotation.z = Math.sin(time * 0.9 + phase) * 0.028;
            canopyRig.rotation.x = Math.cos(time * 0.72 + phase) * 0.02;
        });
    });

    const bushMat = material(builder, 'park:bush', {
        color: palette.bush ?? 0x4d6a42,
        roughness: 0.95,
        metalness: 0.0
    });
    const bushDarkMat = material(builder, 'park:bush-dark', {
        color: palette.bushDark ?? 0x415c38,
        roughness: 0.95,
        metalness: 0.0
    });
    [
        [-10.5, -12.5, 1.35, false],
        [-15.5, -3.5, 1.05, true],
        [9.0, -14.0, 1.2, true],
        [14.5, 5.5, 0.95, false]
    ].forEach(([x, z, radius, dark], index) => {
        addSphere(builder, group, `park:bush-${index}`, radius * s, [x * s, floorY + radius * 0.52 * s, z * s], dark ? bushDarkMat : bushMat, {
            castShadow: true,
            scale: [1.25, 0.72, 1.1]
        });
    });

    // 花坛：石砌矮墙 + 泥土 + 点点花色
    const bedX = -11.5 * s;
    const bedZ = 7.5 * s;
    const bedW = 5.4 * s;
    const bedD = 3.2 * s;
    const soilMat = material(builder, 'park:soil', {
        color: palette.soil ?? 0x3a2a1e,
        roughness: 0.99,
        metalness: 0.0
    });
    addBox(builder, group, 'park:bed-soil', [bedW - 0.5, 0.4, bedD - 0.5], [bedX, floorY + 0.2, bedZ], soilMat, {
        castShadow: false
    });
    [
        [0, bedD / 2, bedW, 0.34],
        [0, -bedD / 2, bedW, 0.34],
        [bedW / 2, 0, 0.34, bedD],
        [-bedW / 2, 0, 0.34, bedD]
    ].forEach(([dx, dz, w, d], index) => {
        addBox(builder, group, 'park:bed-wall', [w, 0.56, d], [bedX + dx, floorY + 0.28, bedZ + dz], stoneEdgeMat, {
            castShadow: true,
            name: `park:bed-wall-${index}`
        });
    });
    const flowerColors = palette.flowers ?? [0xd8697a, 0xe8b45a, 0xd9d3e8, 0xe07a4a];
    flowerColors.forEach((color, index) => {
        const flowerMat = material(builder, `park:flower-${index}`, {
            color,
            roughness: 0.85,
            metalness: 0.0,
            emissive: new THREE.Color(color),
            emissiveIntensity: 0.12
        });
        for (let n = 0; n < 5; n += 1) {
            const fx = bedX + (-1.7 + ((index * 5 + n * 3) % 7) * 0.55) * s;
            const fz = bedZ + (-0.9 + ((index * 3 + n * 5) % 5) * 0.42) * s;
            addSphere(builder, group, `park:flower-${index}`, 0.16 * s, [fx, floorY + 0.5 + (n % 2) * 0.12, fz], flowerMat, {
                castShadow: false,
                receiveShadow: false,
                widthSegments: 8,
                heightSegments: 6,
                name: `park:flower-${index}-${n}`
            });
        }
    });

    addBench(builder, group, 'park:bench', [-(tableSize * 0.92), floorY, 4.5 * s], Math.PI / 2.3, {
        color: palette.bench ?? 0x7b5737,
        scale: 1.15 * s
    });
    addBench(builder, group, 'park:bench', [tableSize * 0.05, floorY, -(tableSize * 0.98)], 0, {
        color: palette.bench ?? 0x7b5737,
        scale: 1.15 * s
    });

    // 野餐布 + 篮子：长椅旁的生活痕迹
    addRug(builder, group, 'park:picnic', {
        width: 4.2 * s,
        depth: 3.2 * s,
        position: [10.5 * s, floorY, 9.5 * s],
        color: palette.picnicCloth ?? 0xc45a52,
        edgeColor: palette.picnicClothEdge ?? 0xa8463f,
        rotationY: 0.32
    });
    const basketMat = material(builder, 'park:basket', {
        color: palette.basket ?? 0xa8813f,
        roughness: 0.9,
        metalness: 0.0,
        map: getFabricWeaveTexture(builder)
    });
    addBox(builder, group, 'park:basket', [1.1 * s, 0.6 * s, 0.8 * s], [10.2 * s, floorY + 0.35 * s, 9.0 * s], basketMat, {
        castShadow: true,
        rotation: [0, 0.32, 0]
    });

    // 石灯笼：底座 + 柱 + 发光灯室 + 檐顶
    const lanternMat = material(builder, 'park:lantern', {
        color: palette.lantern ?? 0xb9b4ab,
        roughness: 0.9,
        metalness: 0.0,
        map: stoneTexture
    });
    const lanternGlowMat = glowMaterial(builder, 'park:lantern-glow', palette.lanternGlow ?? 0xffe9b8, 1.1);
    const lanternX = 9.5 * s;
    const lanternZ = 6.5 * s;
    addCylinder(builder, group, 'park:lantern-base', [0.62 * s, 0.75 * s], 0.4, [lanternX, floorY + 0.2, lanternZ], lanternMat, {
        segments: 14,
        castShadow: true
    });
    addCylinder(builder, group, 'park:lantern-pillar', [0.2 * s, 0.26 * s], 1.35, [lanternX, floorY + 1.05, lanternZ], lanternMat, {
        segments: 12,
        castShadow: true
    });
    addBox(builder, group, 'park:lantern-glow', [0.62 * s, 0.55, 0.62 * s], [lanternX, floorY + 2.0, lanternZ], lanternGlowMat, {
        castShadow: false,
        receiveShadow: false
    });
    addCone(builder, group, 'park:lantern-roof', 0.85 * s, 0.55, [lanternX, floorY + 2.55, lanternZ], lanternMat, {
        segments: 8,
        castShadow: true
    });
    addSphere(builder, group, 'park:lantern-finial', 0.12 * s, [lanternX, floorY + 2.88, lanternZ], lanternMat, {
        castShadow: false
    });

    // 石灯笼烛光：轻微闪烁，像被风拂动
    builder.registerAnimator((time) => {
        lanternGlowMat.emissiveIntensity = 1.02 + Math.sin(time * 2.1) * 0.1 + Math.sin(time * 5.3) * 0.05;
    });

    // 散落的黄叶点缀草地
    const leafMat = material(builder, 'park:leaf', {
        color: palette.leaf ?? 0xc9a94e,
        roughness: 0.9,
        metalness: 0.0,
        side: THREE.DoubleSide
    });
    [
        [-6.5, 8.5, 0.5], [4.0, 11.0, -0.4], [-11.0, 3.0, 1.1],
        [8.0, 9.0, 2.2], [-4.0, -11.5, -1.2], [12.0, -6.5, 0.8]
    ].forEach(([x, z, spin], index) => {
        addPlane(builder, group, `park:leaf-${index}`, [0.55 * s, 0.36 * s], [x * s, floorY + 0.03 + index * 0.004, z * s], leafMat, {
            rotation: [-Math.PI / 2, 0, spin],
            castShadow: false,
            receiveShadow: false
        });
    });

    addTeaSet(builder, group, 'park:tea', [-(ctx.boardHalf + 1.15 * s), ctx.supportTopY, ctx.boardHalf * 0.55], {
        scale: 1.1 * s,
        potColor: palette.teapot ?? 0x5f6a50,
        cupColor: palette.cup ?? 0xcfc8b8,
        trayColor: palette.tray ?? 0x54452e,
        teaColor: palette.tea ?? 0x8a7a3a,
        rotationY: -0.3
    });
}

/**
 * 比赛大厅：深色地板 + 赛用红毯 + 三面围墙 + 发光横幅 + 记分牌 +
 * 立式射灯与锥形光束 + 双面棋钟 + 名牌 + 两层观众席。
 */
function buildCompetitionScene(builder, group, ctx, mood) {
    const s = ctx.sceneScale;
    const palette = mood.props ?? {};
    const floorY = ctx.floorY;
    const tableSize = ctx.boardTotal + 4.4;
    const backZ = -16 * s;
    const sideX = 19 * s;
    const wallHeight = 16;
    const wallCenterY = floorY + wallHeight / 2;

    addRug(builder, group, 'comp', {
        width: tableSize * 1.95,
        depth: tableSize * 1.6,
        position: [0, floorY, 0],
        color: palette.carpet ?? 0x572a2a,
        edgeColor: palette.carpetTrim ?? 0x8a5a3a
    });

    const wallMat = material(builder, 'comp:wall', {
        color: palette.wall ?? 0x252c3a,
        roughness: 0.9,
        metalness: 0.02,
        map: getBackdropGradientTexture(builder)
    });
    const wallPanelMat = material(builder, 'comp:wall-panel', {
        color: palette.wallPanel ?? 0x1e2430,
        roughness: 0.85,
        metalness: 0.04
    });
    addPlane(builder, group, 'comp:wall-back', [46 * s, wallHeight], [0, wallCenterY, backZ], wallMat, {
        castShadow: false,
        receiveShadow: true
    });
    addPlane(builder, group, 'comp:wall-left', [40 * s, wallHeight], [-sideX, wallCenterY, -2 * s], wallMat, {
        rotation: [0, Math.PI / 2, 0],
        castShadow: false,
        receiveShadow: true
    });
    addPlane(builder, group, 'comp:wall-right', [40 * s, wallHeight], [sideX, wallCenterY, -2 * s], wallMat, {
        rotation: [0, -Math.PI / 2, 0],
        castShadow: false,
        receiveShadow: true
    });
    addBox(builder, group, 'comp:wall-dado', [46 * s, 2.4, 0.16], [0, floorY + 1.2, backZ + 0.1], wallPanelMat, {
        castShadow: false
    });
    // 墙面竖向壁柱，把大片背墙切出节奏
    for (let index = 0; index < 7; index += 1) {
        const x = (-18 + index * 6) * s;
        addBox(builder, group, 'comp:wall-pilaster', [0.5, wallHeight - 3.2, 0.22], [x, floorY + 1.6 + (wallHeight - 3.2) / 2, backZ + 0.14], wallPanelMat, {
            castShadow: false,
            name: `comp:wall-pilaster-${index}`
        });
    }

    // 发光赛事横幅（主横幅 + 副条），是大厅的视觉锚点
    const bannerMat = glowMaterial(builder, 'comp:banner', palette.banner ?? 0xd9b26a, 0.85);
    bannerMat.map = getGlowStripTexture(builder);
    bannerMat.emissiveMap = bannerMat.map;
    const bannerDarkMat = material(builder, 'comp:banner-dark', {
        color: palette.bannerDark ?? 0x3a3a4a,
        roughness: 0.8,
        metalness: 0.04
    });
    addBox(builder, group, 'comp:banner-board', [19 * s, 2.4, 0.2], [0, floorY + 11.2, backZ + 0.25], bannerDarkMat, {
        castShadow: false
    });
    addPlane(builder, group, 'comp:banner-glow', [18.2 * s, 1.7], [0, floorY + 11.2, backZ + 0.38], bannerMat, {
        castShadow: false,
        receiveShadow: false
    });
    addPlane(builder, group, 'comp:banner-sub', [10 * s, 0.7], [0, floorY + 9.4, backZ + 0.38], bannerMat, {
        castShadow: false,
        receiveShadow: false
    });

    // 记分牌：读秒与手数的发光面板，挂在横幅下方偏侧
    const scoreboardTexture = getScoreboardTexture(builder);
    const scoreboardMat = material(builder, 'comp:scoreboard', {
        color: 0xffffff,
        map: scoreboardTexture,
        emissive: new THREE.Color(0xffffff),
        emissiveMap: scoreboardTexture,
        emissiveIntensity: 0.72,
        roughness: 0.5,
        metalness: 0.0
    }).clone();
    builder.track(scoreboardMat);
    const boardX = -11.5 * s;
    const boardY = floorY + 7.4;
    addBox(builder, group, 'comp:scoreboard-case', [6.6 * s, 3.6, 0.3], [boardX, boardY, backZ + 0.24], bannerDarkMat, {
        castShadow: false
    });
    addPlane(builder, group, 'comp:scoreboard-face', [6.2 * s, 3.1], [boardX, boardY, backZ + 0.41], scoreboardMat, {
        castShadow: false,
        receiveShadow: false
    });
    builder.registerAnimator((time) => {
        bannerMat.emissiveIntensity = 0.78 + (Math.sin(time * 0.8) * 0.5 + 0.5) * 0.2;
        scoreboardMat.emissiveIntensity = 0.66 + (Math.sin(time * 1.6 + 1.2) * 0.5 + 0.5) * 0.12;
    });

    // 立式射灯杆一对 + 向下的锥形光束
    const rigPoleMat = material(builder, 'comp:rig-pole', {
        color: palette.rigPole ?? 0x2a2e36,
        roughness: 0.6,
        metalness: 0.35
    });
    const rigHeadMat = material(builder, 'comp:rig-head', {
        color: palette.rigHead ?? 0x3a4048,
        roughness: 0.5,
        metalness: 0.4
    });
    const rigGlowMat = material(builder, 'comp:rig-glow', {
        color: palette.rigGlow ?? 0xfff2d8,
        emissive: new THREE.Color(palette.rigGlow ?? 0xfff2d8),
        emissiveIntensity: 1.5,
        roughness: 0.4,
        metalness: 0.0
    });
    const beamMat = material(builder, 'comp:rig-beam', {
        color: palette.rigGlow ?? 0xfff2d8,
        transparent: true,
        opacity: 0.055,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
    }, 'basic');
    [-1, 1].forEach((side) => {
        const x = side * 12.5 * s;
        const z = -7.5 * s;
        addCylinder(builder, group, 'comp:rig-pole', [0.16, 0.22], 9.2, [x, floorY + 4.6, z], rigPoleMat, {
            segments: 10,
            castShadow: true
        });
        addBox(builder, group, 'comp:rig-head', [1.0, 0.7, 0.7], [x, floorY + 9.3, z], rigHeadMat, {
            castShadow: false,
            rotation: [0.42, side * -0.5, 0]
        });
        addPlane(builder, group, 'comp:rig-glow', [0.72, 0.5], [x - side * 0.28, floorY + 9.06, z + 0.42], rigGlowMat, {
            castShadow: false,
            receiveShadow: false,
            rotation: [0.42, side * -0.5, 0]
        });
        // 光束锥：顶点在灯头、开口朝棋盘方向，倾斜对准桌面
        const beamHeight = 9.6;
        addCone(builder, group, 'comp:rig-beam', 3.1 * s, beamHeight, [
            x - side * 3.4 * s,
            floorY + 9.0 - beamHeight / 2 + 0.6,
            z + 3.6 * s
        ], beamMat, {
            segments: 18,
            openEnded: true,
            castShadow: false,
            receiveShadow: false,
            rotation: [-0.3, 0, side * 0.34],
            name: `comp:rig-beam-${side === 1 ? 'right' : 'left'}`
        });
    });

    // 桌沿双面棋钟 + 双方名牌
    const clockBodyMat = material(builder, 'comp:clock-body', {
        color: palette.clockBody ?? 0x2e2620,
        roughness: 0.55,
        metalness: 0.12
    });
    const clockFaceMat = material(builder, 'comp:clock-face', {
        color: palette.clockFace ?? 0xf2ead8,
        roughness: 0.4,
        metalness: 0.0
    });
    const clockButtonMat = material(builder, 'comp:clock-button', {
        color: palette.clockButton ?? 0xc9b89a,
        roughness: 0.5,
        metalness: 0.2
    });
    const clockX = ctx.boardHalf + 1.15 * s;
    const clockZ = -(ctx.boardHalf * 0.5);
    const clockY = ctx.supportTopY + 0.42;
    addBox(builder, group, 'comp:clock-body', [1.5 * s, 0.8, 0.6 * s], [clockX, clockY, clockZ], clockBodyMat, {
        castShadow: true,
        rotation: [0, -0.5, 0]
    });
    [-0.36, 0.36].forEach((offset, index) => {
        addCylinder(builder, group, 'comp:clock-face', [0.24 * s, 0.24 * s], 0.05, [
            clockX + Math.sin(-0.5) * offset * s * -1,
            clockY + 0.02,
            clockZ + Math.cos(-0.5) * offset * s
        ], clockFaceMat, {
            segments: 18,
            castShadow: false,
            receiveShadow: false,
            rotation: [Math.PI / 2, 0, -0.5],
            name: `comp:clock-face-${index}`
        });
        addCylinder(builder, group, 'comp:clock-button', [0.08 * s, 0.08 * s], 0.16, [
            clockX + Math.sin(-0.5) * offset * s * -1,
            clockY + 0.48,
            clockZ + Math.cos(-0.5) * offset * s
        ], clockButtonMat, {
            segments: 10,
            castShadow: false,
            name: `comp:clock-button-${index}`
        });
    });

    const plateMat = material(builder, 'comp:name-plate', {
        color: palette.namePlate ?? 0xe8dcc4,
        roughness: 0.6,
        metalness: 0.0
    });
    [-1, 1].forEach((side) => {
        addBox(builder, group, 'comp:name-plate', [1.7 * s, 0.5, 0.1], [
            -(ctx.boardHalf * 0.45),
            ctx.supportTopY + 0.24,
            side * (ctx.boardHalf + 1.35 * s)
        ], plateMat, {
            castShadow: false,
            rotation: [side * -0.42, 0, 0],
            name: `comp:name-plate-${side === 1 ? 'south' : 'north'}`
        });
    });

    // 观众席：两级看台 + 台上暗色长椅剪影，环在红毯之外。
    // 所有长椅共用同一个 key，几何体与材质得以复用（只有位置/朝向不同）。
    const tierMat = material(builder, 'comp:tier', {
        color: palette.tier ?? 0x1c212a,
        roughness: 0.94,
        metalness: 0.02
    });
    [-1, 1].forEach((side) => {
        [0, 1].forEach((level) => {
            const height = 0.55 + level * 0.55;
            const x = side * (tableSize * (1.2 + level * 0.34));
            addBox(builder, group, 'comp:tier', [tableSize * 0.42, height, tableSize * 1.5], [
                x,
                floorY + height / 2,
                -1.5 * s
            ], tierMat, {
                castShadow: false,
                name: `comp:tier-${side === 1 ? 'right' : 'left'}-${level}`
            });
            addBench(builder, group, 'comp:seat', [x, floorY + height, -1.5 * s], side * -Math.PI / 2, {
                color: palette.seat ?? 0x232830,
                scale: 1.2 * s
            });
        });
    });
}

/**
 * 共享布景入口：地板 + 桌子 + 棋罐，随后按氛围搭建各自的完整环境。
 * 切换氛围时由 EnvironmentBuilder 重建整组场景（不再是仅换色）。
 * @returns {{ floor: object, table: object, legs: object, backdrop: object, lamp: object }}
 */
export function buildTabletop(builder, ctx, preset = 'competition') {
    const mood = getTabletopMood(preset);
    const palette = mood.props ?? {};
    const s = ctx.sceneScale;
    const tableSize = ctx.boardTotal + 4.4;
    const group = builder.group;

    // 室内木地板复用木纹贴图，但需要更密的 repeat（桌面那张太疏），
    // 因此克隆一份独立实例单独设置平铺密度。
    const floorWood = preset === 'home' ? cloneTiled(builder, getWoodGrainTexture(builder), 10, 11) : null;
    const floorMat = material(builder, 'tabletop-floor', {
        color: mood.floor,
        roughness: 0.96,
        metalness: 0.02,
        ...(floorWood ? { map: floorWood } : {})
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
        emissiveIntensity: 0.42
    });

    const groundSize = preset === 'park' ? [62 * s, 56 * s] : [46 * s, 50 * s];
    addPlane(builder, group, 'tabletop-floor', groundSize, [0, ctx.floorY, 0], floorMat, {
        rotation: [-Math.PI / 2, 0, 0],
        castShadow: false,
        receiveShadow: true
    });

    // 公园用远处天空背板，室内场景由各自墙面代替
    if (preset === 'park') {
        addPlane(builder, group, 'tabletop-backdrop', [64 * s, 26], [0, ctx.floorY + 11, -20 * s], backdropMat, {
            castShadow: false,
            receiveShadow: false
        });
    }

    addTable(builder, group, 'tabletop', ctx, {
        width: tableSize,
        depth: tableSize,
        color: mood.table,
        legColor: mood.legs,
        topY: ctx.supportTopY,
        floorY: ctx.floorY,
        height: 2.8,
        castShadow: true,
        map: getWoodGrainTexture(builder),
        trimColor: palette.tableTrim ?? null,
        drawer: preset === 'home',
        stretchers: preset !== 'park',
        dentils: preset === 'home' ? 9 : 0
    });

    buildBowls(builder, group, ctx, palette);

    const mats = {
        floor: floorMat,
        table: builder.sharedMaterials.get('tabletop:table-top-material'),
        legs: builder.sharedMaterials.get('tabletop:table-leg-material'),
        backdrop: backdropMat,
        lamp: lampMat
    };

    if (preset === 'home') {
        buildHomeScene(builder, group, ctx, mood, mats);
    } else if (preset === 'park') {
        buildParkScene(builder, group, ctx, mood);
    } else {
        buildCompetitionScene(builder, group, ctx, mood);
    }

    return mats;
}

/**
 * 兼容 API：仅重染主材质五件套（地板/桌面/桌腿/背板/台灯）。
 * 完整的氛围切换请走 EnvironmentBuilder.applyMood（重建布景）。
 */
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
