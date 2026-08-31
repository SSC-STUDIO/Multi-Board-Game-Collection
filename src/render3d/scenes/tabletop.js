import * as THREE from 'three';
import { getSceneSpec } from '../../config/sceneConfig.js';
import {
    addBench,
    addBox,
    addChair,
    addCylinder,
    addPlane,
    addPottedPlant,
    addSphere,
    addTable,
    addTree,
    material
} from './props.js';

const FALLBACK_MOOD = {
    floor: 0x1a1c22,
    table: 0x4a3a28,
    legs: 0x2c241c,
    backdrop: 0x2a3040,
    lamp: 0xcfc6b8,
    props: {}
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

    for (let i = 0; i < 200; i += 1) {
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
    for (let i = 0; i < 12; i += 1) {
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
    texture.repeat.set(2.8, 1.6);
    texture.anisotropy = 8;
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
 * 车床旋转体棋罐：罐身鼓腹收口 + 扣合的盖子一体成型，
 * 比圆柱堆叠更接近真实棋罐的曲线轮廓。
 */
function getBowlGeometry(builder, s) {
    return builder.getSharedGeometry(`tabletop:bowl-lathe:${s.toFixed(3)}`, () => {
        const profile = [
            [0, 0], [0.36, 0], [0.52, 0.03], [0.64, 0.15], [0.7, 0.32],
            [0.67, 0.46], [0.57, 0.57], [0.52, 0.6],
            [0.56, 0.63], [0.58, 0.66], [0.46, 0.72], [0.26, 0.77], [0.1, 0.79], [0, 0.795]
        ].map(([radius, y]) => new THREE.Vector2(radius * s, y * s));
        return new THREE.LatheGeometry(profile, 28);
    });
}

/**
 * 共享桌面道具：两只棋罐（车床曲线 + 盖钮）+ 茶杯茶碟。
 * 摆在棋盘边缘与桌沿之间的空带上，避免遮挡俯视棋盘与交互射线。
 */
function buildTableProps(builder, group, ctx, palette) {
    const s = ctx.sceneScale;
    const topY = ctx.supportTopY;
    const bowlBlackMat = material(builder, 'tabletop:bowl-black', {
        color: palette.bowlBlack ?? 0x2f3a34,
        roughness: 0.46,
        metalness: 0.06
    });
    const bowlWhiteMat = material(builder, 'tabletop:bowl-white', {
        color: palette.bowlWhite ?? 0x8a5a34,
        roughness: 0.46,
        metalness: 0.06
    });

    const bowlGeometry = getBowlGeometry(builder, s);
    const bowlInset = ctx.boardHalf + 1.05 * s;
    const bowlSide = ctx.boardHalf * 0.42;

    [
        { mat: bowlBlackMat, x: bowlInset, z: bowlSide, key: 'black' },
        { mat: bowlWhiteMat, x: -bowlInset, z: -bowlSide, key: 'white' }
    ].forEach(({ mat, x, z, key }) => {
        const body = new THREE.Mesh(bowlGeometry, mat);
        body.name = `tabletop:bowl-${key}-body`;
        body.position.set(x, topY, z);
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);
        addSphere(builder, group, `tabletop:bowl-${key}-knob`, 0.1 * s, [x, topY + 0.82 * s, z], mat, {
            castShadow: false
        });
    });

    const cupMat = material(builder, 'tabletop:cup', {
        color: palette.cup ?? 0xd8cfc0,
        roughness: 0.38,
        metalness: 0.02
    });
    const teaMat = material(builder, 'tabletop:tea', {
        color: palette.tea ?? 0x9a7a3a,
        roughness: 0.24,
        metalness: 0.0
    });
    const cupX = -(ctx.boardHalf + 1.0 * s);
    const cupZ = ctx.boardHalf * 0.52;
    addCylinder(builder, group, 'tabletop:saucer', [0.4 * s, 0.44 * s], 0.05, [cupX, topY + 0.03, cupZ], cupMat, {
        segments: 20,
        castShadow: false
    });
    addCylinder(builder, group, 'tabletop:cup-body', [0.26 * s, 0.2 * s], 0.3 * s, [cupX, topY + 0.05 + 0.15 * s, cupZ], cupMat, {
        segments: 18,
        castShadow: true
    });
    addCylinder(builder, group, 'tabletop:cup-tea', [0.22 * s, 0.22 * s], 0.03, [cupX, topY + 0.05 + 0.28 * s, cupZ], teaMat, {
        segments: 18,
        castShadow: false,
        receiveShadow: false
    });
}

/** 桌上台灯（家里氛围专属）：锥形灯罩 + 细杆。 */
function buildDeskLamp(builder, group, ctx, lampMat, tableSize) {
    const lampX = tableSize * 0.36;
    const lampZ = -tableSize * 0.34;
    addCylinder(builder, group, 'tabletop-lamp-stem', [0.05, 0.07], 1.8, [lampX, ctx.supportTopY + 0.9, lampZ], lampMat, {
        segments: 10,
        castShadow: false,
        receiveShadow: false
    });
    addCylinder(builder, group, 'tabletop-lamp-shade', [0.16, 0.36], 0.34, [lampX, ctx.supportTopY + 1.82, lampZ], lampMat, {
        segments: 14,
        castShadow: false,
        receiveShadow: false
    });
}

/**
 * 家里·窗边对局：木地板 + 圆毯 + L 形墙角 + 发光窗 + 书架 + 挂画 + 盆栽 + 对坐两椅。
 */
function buildHomeScene(builder, group, ctx, mood, mats) {
    const s = ctx.sceneScale;
    const palette = mood.props ?? {};
    const floorY = ctx.floorY;
    const backZ = -14.5 * s;
    const sideX = -16 * s;
    const wallHeight = 15;
    const wallCenterY = floorY + wallHeight / 2;

    const carpetMat = material(builder, 'home:carpet', {
        color: palette.carpet ?? 0x5e3226,
        roughness: 0.98,
        metalness: 0.0
    });
    addCylinder(builder, group, 'home:carpet', [ctx.boardTotal * 0.86, ctx.boardTotal * 0.86], 0.05, [0, floorY + 0.03, 0], carpetMat, {
        segments: 40,
        castShadow: false
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

    // 发光窗：窗框贴墙 + 暖光窗芯（克隆材质供呼吸动效），是"窗边对局"的光源记忆点
    const frameMat = material(builder, 'home:window-frame', {
        color: palette.windowFrame ?? 0x241a12,
        roughness: 0.7,
        metalness: 0.03
    });
    const glowMat = material(builder, 'home:window-glow', {
        color: palette.windowGlow ?? 0xffd9a0,
        emissive: new THREE.Color(palette.windowGlow ?? 0xffd9a0),
        emissiveIntensity: 1.25,
        roughness: 0.6,
        metalness: 0.0
    }).clone();
    builder.track(glowMat);
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
    addBox(builder, group, 'home:window-left', [0.24, winH + 0.3, 0.16], [winX - winW / 2, winY, backZ + 0.1], frameMat, { castShadow: false });
    addBox(builder, group, 'home:window-right', [0.24, winH + 0.3, 0.16], [winX + winW / 2, winY, backZ + 0.1], frameMat, { castShadow: false });
    addBox(builder, group, 'home:window-mullion-v', [0.14, winH - 0.4, 0.12], [winX, winY, backZ + 0.1], frameMat, { castShadow: false });
    addBox(builder, group, 'home:window-mullion-h', [winW - 0.4, 0.14, 0.12], [winX, winY, backZ + 0.1], frameMat, { castShadow: false });

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

    // 侧墙挂画
    const paintingFrameMat = material(builder, 'home:painting-frame', {
        color: palette.painting ?? 0x8a6a4a,
        roughness: 0.6,
        metalness: 0.08
    });
    const paintingArtMat = material(builder, 'home:painting-art', {
        color: palette.paintingArt ?? 0x40556a,
        roughness: 0.9,
        metalness: 0.0
    });
    const paintY = floorY + 6.4;
    const paintZ = -3.5 * s;
    addBox(builder, group, 'home:painting-frame', [0.14, 3.1, 2.4 * s], [sideX + 0.12, paintY, paintZ], paintingFrameMat, { castShadow: false });
    addBox(builder, group, 'home:painting-art', [0.1, 2.7, 2.0 * s], [sideX + 0.2, paintY, paintZ], paintingArtMat, { castShadow: false });

    // 靠墙书架 + 彩色书脊
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
    [1.15, 2.75, 4.35].forEach((h, index) => {
        addBox(builder, group, `home:shelf-board-${index}`, [3.8 * s, 0.14, 1.5], [shelfX, floorY + h, shelfZ], shelfMat, { castShadow: true });
    });
    const bookColors = palette.books ?? [0x8a4a3a, 0x4a6a52, 0xc2a05a, 0x53638a, 0x7a4a62];
    bookColors.forEach((color, index) => {
        const bookMat = material(builder, `home:book-${index}`, {
            color,
            roughness: 0.85,
            metalness: 0.0
        });
        const rowY = index < 3 ? 1.15 : 2.75;
        const offset = (index % 3) * 0.62 * s - 0.62 * s;
        const height = 1.02 + (index % 2) * 0.18;
        addBox(builder, group, `home:book-${index}`, [0.34 * s, height, 1.1], [shelfX + offset, floorY + rowY + 0.07 + height / 2, shelfZ], bookMat, {
            castShadow: false
        });
    });

    addPottedPlant(builder, group, 'home:plant', [-12.6 * s, floorY, backZ + 1.6], 2.1);

    const tableSize = ctx.boardTotal + 4.4;
    addChair(builder, group, 'home:chair-north', [0, floorY, -tableSize * 0.78], 0, { color: palette.chair ?? 0x5d4634, scale: 1.35 * s });
    addChair(builder, group, 'home:chair-south', [0, floorY, tableSize * 0.78], Math.PI, { color: palette.chair ?? 0x5d4634, scale: 1.35 * s });

    buildDeskLamp(builder, group, ctx, mats.lamp, tableSize);
}

/**
 * 公园·树荫棋桌：草地 + 石板圆台 + 汀步小径 + 三棵树 + 灌木 + 长椅 + 石灯笼 + 天空背板。
 */
function buildParkScene(builder, group, ctx, mood) {
    const s = ctx.sceneScale;
    const palette = mood.props ?? {};
    const floorY = ctx.floorY;
    const tableSize = ctx.boardTotal + 4.4;

    const stoneMat = material(builder, 'park:stone', {
        color: palette.path ?? 0x8f8a7c,
        roughness: 0.92,
        metalness: 0.0
    });
    const stoneEdgeMat = material(builder, 'park:stone-edge', {
        color: palette.pathEdge ?? 0x767268,
        roughness: 0.95,
        metalness: 0.0
    });
    // 桌下石板圆台
    addCylinder(builder, group, 'park:plaza', [tableSize * 0.72, tableSize * 0.76], 0.1, [0, floorY + 0.05, 0], stoneMat, {
        segments: 34,
        castShadow: false
    });
    // 汀步小径伸向前景
    for (let index = 0; index < 4; index += 1) {
        const z = tableSize * 0.82 + index * 2.0 * s;
        const x = (index % 2 === 0 ? 0.7 : -0.7) * s;
        addBox(builder, group, `park:step-${index}`, [1.9 * s, 0.1, 1.25 * s], [x, floorY + 0.05, z], index % 2 ? stoneMat : stoneEdgeMat, {
            castShadow: false,
            rotation: [0, (index % 2 === 0 ? 0.14 : -0.1), 0]
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

    addBench(builder, group, 'park:bench-a', [-(tableSize * 0.92), floorY, 4.5 * s], Math.PI / 2.3, {
        color: palette.bench ?? 0x7b5737,
        scale: 1.15 * s
    });
    addBench(builder, group, 'park:bench-b', [tableSize * 0.05, floorY, -(tableSize * 0.98)], 0, {
        color: palette.bench ?? 0x7b5737,
        scale: 1.15 * s
    });

    // 石灯笼：底座 + 柱 + 发光灯室 + 檐顶
    const lanternMat = material(builder, 'park:lantern', {
        color: palette.lantern ?? 0x8f8b82,
        roughness: 0.9,
        metalness: 0.0
    });
    const lanternGlowMat = material(builder, 'park:lantern-glow', {
        color: palette.lanternGlow ?? 0xffe9b8,
        emissive: new THREE.Color(palette.lanternGlow ?? 0xffe9b8),
        emissiveIntensity: 1.1,
        roughness: 0.5,
        metalness: 0.0
    }).clone();
    builder.track(lanternGlowMat);
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
    addCylinder(builder, group, 'park:lantern-roof', [0.1 * s, 0.85 * s], 0.5, [lanternX, floorY + 2.5, lanternZ], lanternMat, {
        segments: 8,
        castShadow: true
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
}

/**
 * 比赛大厅：深色地板 + 赛用红毯 + 三面围墙 + 发光赛事横幅 + 立式射灯 + 双面计时钟 + 名牌 + 观众席。
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

    const carpetMat = material(builder, 'comp:carpet', {
        color: palette.carpet ?? 0x572a2a,
        roughness: 0.98,
        metalness: 0.0
    });
    const carpetTrimMat = material(builder, 'comp:carpet-trim', {
        color: palette.carpetTrim ?? 0x8a5a3a,
        roughness: 0.9,
        metalness: 0.04
    });
    addBox(builder, group, 'comp:carpet', [tableSize * 1.95, 0.05, tableSize * 1.6], [0, floorY + 0.03, 0], carpetMat, {
        castShadow: false
    });
    addBox(builder, group, 'comp:carpet-trim-front', [tableSize * 1.95, 0.06, 0.3], [0, floorY + 0.04, tableSize * 0.8], carpetTrimMat, { castShadow: false });
    addBox(builder, group, 'comp:carpet-trim-back', [tableSize * 1.95, 0.06, 0.3], [0, floorY + 0.04, -tableSize * 0.8], carpetTrimMat, { castShadow: false });

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

    // 发光赛事横幅（主横幅 + 副条），是大厅的视觉锚点
    const bannerMat = material(builder, 'comp:banner', {
        color: palette.banner ?? 0xd9b26a,
        emissive: new THREE.Color(palette.banner ?? 0xd9b26a),
        emissiveIntensity: 0.85,
        roughness: 0.6,
        metalness: 0.0
    }).clone();
    builder.track(bannerMat);
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

    // 横幅呼吸：赛场大屏的缓慢明暗循环
    builder.registerAnimator((time) => {
        bannerMat.emissiveIntensity = 0.78 + (Math.sin(time * 0.8) * 0.5 + 0.5) * 0.2;
    });

    // 立式射灯杆一对
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

    // 远处观众席（暗色长椅剪影，环在红毯之外）
    [
        { pos: [-(tableSize * 1.35), floorY, 3 * s], rot: Math.PI / 2 },
        { pos: [-(tableSize * 1.35), floorY, -6 * s], rot: Math.PI / 2 },
        { pos: [tableSize * 1.35, floorY, 3 * s], rot: -Math.PI / 2 },
        { pos: [tableSize * 1.35, floorY, -6 * s], rot: -Math.PI / 2 }
    ].forEach(({ pos, rot }, index) => {
        addBench(builder, group, `comp:seat-${index}`, pos, rot, {
            color: palette.seat ?? 0x232830,
            scale: 1.2 * s
        });
    });
}

/**
 * 共享布景入口：地板 + 桌子 + 桌面道具，随后按氛围搭建各自的完整环境。
 * 切换氛围时由 EnvironmentBuilder 重建整组场景（不再是仅换色）。
 * @returns {{ floor: object, table: object, legs: object, backdrop: object, lamp: object }}
 */
export function buildTabletop(builder, ctx, preset = 'competition') {
    const mood = getTabletopMood(preset);
    const s = ctx.sceneScale;
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
        map: getWoodGrainTexture(builder)
    });

    buildTableProps(builder, group, ctx, mood.props ?? {});

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
