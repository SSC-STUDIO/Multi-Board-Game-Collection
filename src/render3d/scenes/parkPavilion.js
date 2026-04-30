import * as THREE from 'three';
import {
    addBench,
    addBox,
    addCylinder,
    addGroup,
    addPlane,
    addSphere,
    addTree,
    material,
} from './props.js';

function createParkSurfaceMaterial(builder, key, {
    colorMap,
    normalMap,
    roughnessMap,
    repeat,
    color,
    roughness,
    normalScale,
}) {
    const map = loadRepeatingTexture(builder, `park:${key}:color`, colorMap, repeat, true);
    const normal = loadRepeatingTexture(builder, `park:${key}:normal`, normalMap, repeat, false);
    const roughnessTexture = loadRepeatingTexture(builder, `park:${key}:roughness`, roughnessMap, repeat, false);

    return material(builder, `park:${key}:surface-material`, {
        color,
        map,
        normalMap: normal,
        roughnessMap: roughnessTexture,
        normalScale: new THREE.Vector2(normalScale, normalScale),
        roughness,
        metalness: 0.0,
        side: THREE.DoubleSide,
    });
}

function loadRepeatingTexture(builder, key, url, repeat, colorTexture) {
    return builder.getSharedTexture(key, url, (texture) => {
        texture.colorSpace = colorTexture ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(...repeat);
        texture.anisotropy = 8;
    });
}

export function buildParkPavilion(builder, ctx) {
    const root = builder.group;
    const grass = createParkSurfaceMaterial(builder, 'grass', {
        colorMap: 'assets/textures/park/grass004_color_1k.jpg',
        normalMap: 'assets/textures/park/grass004_normal_gl_1k.jpg',
        roughnessMap: 'assets/textures/park/grass004_roughness_1k.jpg',
        repeat: [10.8, 9.2],
        color: 0x5d7b4a,
        roughness: 0.98,
        normalScale: 0.38,
    });
    const meadow = createParkSurfaceMaterial(builder, 'meadow', {
        colorMap: 'assets/textures/park/grass004_color_1k.jpg',
        normalMap: 'assets/textures/park/grass004_normal_gl_1k.jpg',
        roughnessMap: 'assets/textures/park/grass004_roughness_1k.jpg',
        repeat: [7.6, 2.2],
        color: 0x668452,
        roughness: 0.99,
        normalScale: 0.22,
    });
    const pathMaterial = createParkSurfaceMaterial(builder, 'path', {
        colorMap: 'assets/textures/park/grass_path_3_diff_1k.jpg',
        normalMap: 'assets/textures/park/grass_path_3_nor_gl_1k.jpg',
        roughnessMap: 'assets/textures/park/grass_path_3_rough_1k.jpg',
        repeat: [5.8, 1.0],
        color: 0xd0c095,
        roughness: 0.94,
        normalScale: 0.3,
    });
    const sidePathMaterial = createParkSurfaceMaterial(builder, 'side-path', {
        colorMap: 'assets/textures/park/grass_path_3_diff_1k.jpg',
        normalMap: 'assets/textures/park/grass_path_3_nor_gl_1k.jpg',
        roughnessMap: 'assets/textures/park/grass_path_3_rough_1k.jpg',
        repeat: [1.0, 4.6],
        color: 0xd0c095,
        roughness: 0.94,
        normalScale: 0.3,
    });
    const plazaMaterial = createParkSurfaceMaterial(builder, 'plaza', {
        colorMap: 'assets/textures/park/grass_path_3_diff_1k.jpg',
        normalMap: 'assets/textures/park/grass_path_3_nor_gl_1k.jpg',
        roughnessMap: 'assets/textures/park/grass_path_3_rough_1k.jpg',
        repeat: [2.6, 2.2],
        color: 0xc8ba92,
        roughness: 0.94,
        normalScale: 0.24,
    });
    const stone = material(builder, 'park:stone-material', {
        color: 0x9d9988,
        roughness: 0.93,
        metalness: 0.02,
    });
    const moss = material(builder, 'park:moss-material', {
        color: 0x6f8f55,
        roughness: 0.96,
        metalness: 0.0,
    });
    const sky = material(builder, 'park:sky-material', {
        color: 0xc7ddd2,
        side: THREE.DoubleSide,
    }, 'basic');
    const treeLine = material(builder, 'park:tree-line-material', {
        color: 0x6f8d5d,
        roughness: 0.98,
        metalness: 0.0,
        side: THREE.DoubleSide,
    });
    const distantTreeLine = material(builder, 'park:distant-tree-line-material', {
        color: 0x5d7652,
        roughness: 0.99,
        metalness: 0.0,
        side: THREE.DoubleSide,
    });

    addPlane(builder, root, 'park:sky-backdrop', [ctx.boardTotal * 13.6, 23], [0, ctx.floorY + 9.8, -ctx.boardTotal * 5.6], sky, {
        receiveShadow: false,
    });
    addPlane(builder, root, 'park:distant-tree-line', [ctx.boardTotal * 13.4, 5.6], [0, ctx.floorY + 2.35, -ctx.boardTotal * 5.34], distantTreeLine, {
        receiveShadow: false,
    });
    addPlane(builder, root, 'park:middle-tree-line', [ctx.boardTotal * 10.8, 4.6], [0, ctx.floorY + 2.05, -ctx.boardTotal * 4.26], treeLine, {
        receiveShadow: false,
    });

    addPlane(builder, root, 'park:ground', [ctx.boardTotal * 10.8, ctx.boardTotal * 9.2], [0, ctx.floorY, 0.25], grass, {
        rotation: [-Math.PI / 2, 0, 0],
        receiveShadow: true,
    });
    addPlane(builder, root, 'park:far-meadow', [ctx.boardTotal * 10.2, ctx.boardTotal * 2.6], [0, ctx.floorY + 0.006, -ctx.boardTotal * 3.34], meadow, {
        rotation: [-Math.PI / 2, 0, 0],
        receiveShadow: true,
    });
    addPlane(builder, root, 'park:main-path', [ctx.boardTotal * 8.4, 2.45], [0, ctx.floorY + 0.018, -ctx.boardTotal * 1.28], pathMaterial, {
        rotation: [-Math.PI / 2, 0, -0.08],
        receiveShadow: true,
    });
    addPlane(builder, root, 'park:far-path', [ctx.boardTotal * 3.4, 1.24], [-ctx.boardTotal * 1.95, ctx.floorY + 0.017, -ctx.boardTotal * 3.48], pathMaterial, {
        rotation: [-Math.PI / 2, 0, 0.18],
        receiveShadow: true,
    });
    addPlane(builder, root, 'park:side-path', [2.12, ctx.boardTotal * 5.85], [ctx.boardTotal * 2.02, ctx.floorY + 0.019, 0.12], sidePathMaterial, {
        rotation: [-Math.PI / 2, 0, 0.24],
        receiveShadow: true,
    });

    addStonePlaza(builder, root, ctx, plazaMaterial);
    addStoneTable(builder, root, ctx, stone, moss);
    addStools(builder, root, ctx, stone);
    addPavilion(builder, root, ctx);
    addPond(builder, root, ctx);
    addTrees(builder, root, ctx);
    addDistantGroves(builder, root, ctx);
    addGardenDetails(builder, root, ctx);

    const breezeTargets = [];
    root.traverse((object) => {
        if (object.name?.includes(':tree')) {
            breezeTargets.push(object);
        }
    });
    builder.markDynamic(breezeTargets);
    builder.registerAnimator((timeSeconds) => {
        breezeTargets.forEach((tree, index) => {
            tree.rotation.z = Math.sin(timeSeconds * 0.42 + index * 0.7) * 0.008;
            tree.rotation.x = Math.cos(timeSeconds * 0.28 + index * 0.4) * 0.004;
        });
    });
}

function addStonePlaza(builder, root, ctx, pathMaterial) {
    const plaza = addCylinder(builder, root, 'park:stone-plaza', ctx.boardTotal * 1.55, 0.045, [0, ctx.floorY + 0.024, 0], pathMaterial, {
        segments: 72,
        receiveShadow: true,
    });
    plaza.scale.set(1.12, 1, 0.9);

    const joint = material(builder, 'park:paver-joint-material', {
        color: 0x9f9476,
        roughness: 0.96,
        metalness: 0.0,
    });
    [-1, 0, 1].forEach((offset, index) => {
        addBox(builder, root, `park:plaza-joint-x:${index}`, [0.055, 0.018, ctx.boardTotal * 2.35], [offset * ctx.boardTotal * 0.54, ctx.floorY + 0.06, 0], joint, {
            receiveShadow: true,
        });
        addBox(builder, root, `park:plaza-joint-z:${index}`, [ctx.boardTotal * 2.75, 0.018, 0.055], [0, ctx.floorY + 0.061, offset * ctx.boardTotal * 0.42], joint, {
            receiveShadow: true,
        });
    });
}

function addStoneTable(builder, root, ctx, stone, moss) {
    const tableTopY = ctx.supportTopY - 0.02;
    const topSize = ctx.boardTotal * 1.24;
    const topThickness = 0.48;
    const halfTop = topSize / 2;
    addBox(builder, root, 'park:stone-table-top', [topSize, topThickness, topSize], [0, tableTopY - topThickness / 2, 0], stone, {
        castShadow: true,
        receiveShadow: true,
    });
    addBox(builder, root, 'park:stone-table-front-bevel', [topSize * 0.94, 0.16, 0.18], [0, tableTopY - 0.16, halfTop + 0.03], stone, {
        castShadow: true,
        receiveShadow: true,
    });
    addBox(builder, root, 'park:stone-table-back-bevel', [topSize * 0.94, 0.16, 0.18], [0, tableTopY - 0.16, -halfTop - 0.03], stone, {
        castShadow: true,
        receiveShadow: true,
    });
    addBox(builder, root, 'park:stone-table-left-bevel', [0.18, 0.16, topSize * 0.94], [-halfTop - 0.03, tableTopY - 0.16, 0], stone, {
        castShadow: true,
        receiveShadow: true,
    });
    addBox(builder, root, 'park:stone-table-right-bevel', [0.18, 0.16, topSize * 0.94], [halfTop + 0.03, tableTopY - 0.16, 0], stone, {
        castShadow: true,
        receiveShadow: true,
    });

    const pedestalHeight = tableTopY - topThickness - ctx.floorY;
    addCylinder(builder, root, 'park:stone-table-pedestal', [ctx.boardTotal * 0.2, ctx.boardTotal * 0.32], pedestalHeight, [0, ctx.floorY + pedestalHeight / 2, 0], stone, {
        segments: 32,
        castShadow: true,
        receiveShadow: true,
    });
    addCylinder(builder, root, 'park:stone-table-foot', [ctx.boardTotal * 0.52, ctx.boardTotal * 0.66], 0.28, [0, ctx.floorY + 0.14, 0], stone, {
        segments: 36,
        castShadow: true,
        receiveShadow: true,
    });
    addBox(builder, root, 'park:table-moss-front', [topSize * 0.72, 0.045, 0.16], [0, tableTopY + 0.034, halfTop * 0.88], moss, {
        receiveShadow: true,
    });
    addBox(builder, root, 'park:table-moss-back', [topSize * 0.72, 0.045, 0.16], [0, tableTopY + 0.034, -halfTop * 0.88], moss, {
        receiveShadow: true,
    });
    addBox(builder, root, 'park:table-moss-left', [0.16, 0.045, topSize * 0.58], [-halfTop * 0.88, tableTopY + 0.035, 0], moss, {
        receiveShadow: true,
    });
    addBox(builder, root, 'park:table-moss-right', [0.16, 0.045, topSize * 0.58], [halfTop * 0.88, tableTopY + 0.035, 0], moss, {
        receiveShadow: true,
    });
}

function addStools(builder, root, ctx, stone) {
    const distance = ctx.boardTotal * 0.92;
    [
        [0, distance, 0],
        [0, -distance * 0.98, Math.PI],
        [distance, 0, -Math.PI / 2],
        [-distance, 0, Math.PI / 2],
    ].forEach(([x, z, rotationY], index) => {
        const group = addGroup(root, `park:stool:${index}`, [x, ctx.floorY, z], [0, rotationY, 0]);
        addCylinder(builder, group, `park:stool-seat:${index}`, [2.35, 2.58], 0.56, [0, 1.34, 0], stone, {
            segments: 28,
            castShadow: true,
            receiveShadow: true,
        });
        addCylinder(builder, group, `park:stool-base:${index}`, [0.78, 1.02], 1.18, [0, 0.6, 0], stone, {
            segments: 22,
            castShadow: true,
            receiveShadow: true,
        });
    });
}

function addPavilion(builder, root, ctx) {
    const post = material(builder, 'park:pavilion-post-material', {
        color: 0x6f5131,
        roughness: 0.72,
        metalness: 0.04,
    });
    const roof = material(builder, 'park:pavilion-roof-material', {
        color: 0x49633f,
        roughness: 0.86,
        metalness: 0.02,
        emissive: 0x152512,
        emissiveIntensity: 0.04,
    });
    const pavilion = addGroup(root, 'park:pavilion', [ctx.boardTotal * 1.34, ctx.floorY, -ctx.boardTotal * 2.12], [0, -0.24, 0]);
    const width = ctx.boardTotal * 1.72;
    const depth = ctx.boardTotal * 1.05;
    const height = 7.45;
    addBox(builder, pavilion, 'park:pavilion-deck', [width * 0.92, 0.18, depth * 0.74], [0, 0.09, 0], material(builder, 'park:pavilion-deck-material', {
        color: 0x8f8065,
        roughness: 0.9,
        metalness: 0.01,
    }), {
        receiveShadow: true,
    });
    [-1, 1].forEach((x) => {
        [-1, 1].forEach((z) => {
            addCylinder(builder, pavilion, 'park:pavilion-post', 0.19, height, [x * width * 0.43, height / 2, z * depth * 0.34], post, {
                segments: 12,
                castShadow: true,
                receiveShadow: true,
            });
        });
    });
    addBox(builder, pavilion, 'park:pavilion-front-beam', [width, 0.22, 0.26], [0, height + 0.08, depth * 0.34], post, { castShadow: true });
    addBox(builder, pavilion, 'park:pavilion-back-beam', [width, 0.22, 0.26], [0, height + 0.08, -depth * 0.34], post, { castShadow: true });
    addBox(builder, pavilion, 'park:pavilion-left-beam', [0.28, 0.2, depth * 0.72], [-width * 0.43, height + 0.06, 0], post, { castShadow: true });
    addBox(builder, pavilion, 'park:pavilion-right-beam', [0.28, 0.2, depth * 0.72], [width * 0.43, height + 0.06, 0], post, { castShadow: true });
    addBox(builder, pavilion, 'park:pavilion-roof-near-plane', [width * 1.22, 0.18, depth * 0.72], [0, height + 0.72, depth * 0.18], roof, {
        castShadow: false,
        receiveShadow: true,
        rotation: [0.32, 0, 0],
    });
    addBox(builder, pavilion, 'park:pavilion-roof-far-plane', [width * 1.22, 0.18, depth * 0.72], [0, height + 0.72, -depth * 0.18], roof, {
        castShadow: false,
        receiveShadow: true,
        rotation: [-0.32, 0, 0],
    });
    addBox(builder, pavilion, 'park:pavilion-roof-ridge', [width * 1.12, 0.24, 0.2], [0, height + 1.3, 0], roof, {
        castShadow: false,
        receiveShadow: true,
    });
    [-1, 1].forEach((direction) => {
        addBox(builder, pavilion, `park:pavilion-eave:${direction}`, [width * 1.3, 0.26, 0.28], [0, height + 0.46, direction * depth * 0.56], roof, {
            castShadow: false,
            receiveShadow: true,
        });
    });
}

function addPond(builder, root, ctx) {
    const water = material(builder, 'park:water-material', {
        color: 0x74a4a8,
        transparent: true,
        opacity: 0.78,
        roughness: 0.22,
        metalness: 0.02,
        side: THREE.DoubleSide,
    }, 'physical');
    const rock = material(builder, 'park:rock-material', {
        color: 0x8c8980,
        roughness: 0.96,
        metalness: 0.01,
    });
    const pondCenterX = -ctx.boardTotal * 1.55;
    const pondCenterZ = ctx.boardTotal * 0.95;
    const pond = addCylinder(builder, root, 'park:pond-water', [ctx.boardTotal * 0.62, ctx.boardTotal * 0.66], 0.035, [pondCenterX, ctx.floorY + 0.04, pondCenterZ], water, {
        segments: 48,
        receiveShadow: false,
        rotation: [0, 0, 0],
    });
    pond.scale.set(1.28, 1, 0.68);
    builder.markDynamic(pond);
    builder.registerAnimator((timeSeconds) => {
        const pulse = 1 + Math.sin(timeSeconds * 0.48) * 0.006;
        pond.scale.set(1.28 * pulse, 1, 0.68 / pulse);
        water.opacity = 0.72 + (Math.sin(timeSeconds * 0.36) + 1) * 0.035;
    });
    [
        [-0.72, -0.44, 0.34],
        [0.32, 0.58, 0.28],
        [0.86, 0.24, 0.22],
        [-0.82, 0.18, 0.25],
    ].forEach(([x, z, scale], index) => {
        addSphere(builder, root, `park:pond-rock:${index}`, scale, [pondCenterX + ctx.boardTotal * x * 0.48, ctx.floorY + scale * 0.44, pondCenterZ + ctx.boardTotal * z * 0.38], rock, {
            castShadow: true,
            scale: [1.28, 0.52, 0.82],
        });
    });
}

function addTrees(builder, root, ctx) {
    const specs = [
        [-ctx.boardTotal * 2.24, -ctx.boardTotal * 0.76, 6.0, 0x52743d],
        [ctx.boardTotal * 2.18, -ctx.boardTotal * 0.82, 5.75, 0x5d8348],
        [-ctx.boardTotal * 2.04, ctx.boardTotal * 1.82, 5.15, 0x648b4d],
        [ctx.boardTotal * 2.18, ctx.boardTotal * 1.72, 5.25, 0x5f8248],
        [0, -ctx.boardTotal * 2.34, 6.55, 0x557a44],
        [-ctx.boardTotal * 2.78, ctx.boardTotal * 0.72, 5.3, 0x5b7d43],
    ];
    specs.forEach(([x, z, scale, canopy], index) => {
        addTree(builder, root, `park:primary:${index}`, [x, ctx.floorY, z], scale, { canopy });
    });
}

function addDistantGroves(builder, root, ctx) {
    const farSpecs = [
        [-4.46, -3.76, 4.9, 0x5c7a4e],
        [-3.42, -4.28, 5.7, 0x527047],
        [-2.26, -4.74, 4.7, 0x688858],
        [-0.86, -4.48, 5.4, 0x58784c],
        [0.74, -4.9, 4.9, 0x638552],
        [2.18, -4.36, 5.8, 0x55744b],
        [3.58, -3.86, 4.8, 0x648657],
        [4.58, -3.18, 5.35, 0x547348],
        [-4.94, 1.82, 4.9, 0x5d7f4e],
        [4.86, 1.72, 4.7, 0x5b7d4b],
        [-3.72, 3.12, 4.2, 0x678756],
        [3.64, 3.04, 4.35, 0x607f52],
    ];

    farSpecs.forEach(([x, z, scale, canopy], index) => {
        const tree = addTree(
            builder,
            root,
            `park:far:${index}`,
            [ctx.boardTotal * x, ctx.floorY, ctx.boardTotal * z],
            scale,
            { canopy }
        );
        tree.group.rotation.y = (index % 5) * 0.16 - 0.28;
    });
}

function addGardenDetails(builder, root, ctx) {
    const shrub = material(builder, 'park:shrub-material', {
        color: 0x617d4f,
        roughness: 0.95,
        metalness: 0.0,
    });
    const flower = material(builder, 'park:flower-material', {
        color: 0xd8d0b8,
        roughness: 0.88,
        metalness: 0.0,
    });
    addBench(builder, root, 'park:left', [-ctx.boardTotal * 2.08, ctx.floorY, -ctx.boardTotal * 1.24], -0.34, { scale: 1.34 });
    addBench(builder, root, 'park:right', [ctx.boardTotal * 2.12, ctx.floorY, -ctx.boardTotal * 1.16], 0.38, { scale: 1.34 });
    addStoneLantern(builder, root, 'park:left', [-ctx.boardTotal * 0.98, ctx.floorY, ctx.boardTotal * 1.06], -0.22);
    addStoneLantern(builder, root, 'park:right', [ctx.boardTotal * 1.0, ctx.floorY, ctx.boardTotal * 1.02], 0.2);
    [
        [-1.78, 1.04, 0.9],
        [1.78, 0.98, 0.82],
        [-2.16, -0.08, 0.72],
        [2.14, 0.08, 0.76],
        [0.84, 1.7, 0.68],
    ].forEach(([x, z, scale], index) => {
        addSphere(builder, root, `park:shrub:${index}`, scale, [ctx.boardTotal * x, ctx.floorY + scale * 0.3, ctx.boardTotal * z], shrub, {
            castShadow: true,
            scale: [1.35, 0.62, 1],
        });
        addSphere(builder, root, `park:flower:${index}`, 0.08, [ctx.boardTotal * x + 0.22, ctx.floorY + scale * 0.84, ctx.boardTotal * z + 0.12], flower, {});
    });
}

function addStoneLantern(builder, root, key, position, rotationY) {
    const group = addGroup(root, `${key}:stone-lantern`, position, [0, rotationY, 0]);
    const stone = material(builder, `${key}:lantern-stone-material`, {
        color: 0x8f8b7c,
        roughness: 0.94,
        metalness: 0.01,
    });
    const glow = material(builder, `${key}:lantern-glow-material`, {
        color: 0xffd7a0,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
    }, 'basic');
    addCylinder(builder, group, `${key}:lantern-base`, [0.52, 0.66], 0.3, [0, 0.15, 0], stone, {
        segments: 18,
        castShadow: true,
    });
    addCylinder(builder, group, `${key}:lantern-post`, 0.18, 1.28, [0, 0.94, 0], stone, {
        segments: 14,
        castShadow: true,
    });
    addBox(builder, group, `${key}:lantern-box`, [0.82, 0.54, 0.82], [0, 1.72, 0], stone, {
        castShadow: true,
    });
    addSphere(builder, group, `${key}:lantern-light`, 0.32, [0, 1.72, 0], glow, {
        receiveShadow: false,
    });
    addCylinder(builder, group, `${key}:lantern-cap`, [0.28, 0.68], 0.32, [0, 2.15, 0], stone, {
        segments: 4,
        castShadow: true,
        rotation: [0, Math.PI / 4, 0],
    });
}
