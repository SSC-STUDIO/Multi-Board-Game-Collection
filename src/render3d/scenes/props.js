import * as THREE from 'three';
import { getFabricWeaveTexture, getLeafAlphaTexture, getRugPatternTexture } from './textures.js';

export function createSceneContext(config, boardSize) {
    const { cellSize, borderWidth, thickness, baseHeight } = config.board;
    const boardSpan = (boardSize - 1) * cellSize;
    const boardTotal = boardSpan + borderWidth * 2;
    const boardHalf = boardTotal / 2;
    const boardBottomY = -thickness / 2 - baseHeight;

    return {
        boardSize,
        cellSize,
        thickness,
        baseHeight,
        boardSpan,
        boardTotal,
        boardHalf,
        boardTopY: thickness / 2,
        boardBottomY,
        supportTopY: boardBottomY - 0.035,
        floorY: boardBottomY - 2.55,
        sceneScale: boardTotal / 14.8,
    };
}

export function material(builder, key, settings = {}, type = 'standard') {
    return builder.getSharedMaterial(key, () => {
        if (type === 'basic') {
            return new THREE.MeshBasicMaterial(settings);
        }
        if (type === 'physical') {
            return new THREE.MeshPhysicalMaterial(settings);
        }
        return new THREE.MeshStandardMaterial(settings);
    });
}

export function addGroup(parent, name, position = [0, 0, 0], rotation = [0, 0, 0]) {
    const group = new THREE.Group();
    group.name = name;
    group.position.set(...position);
    group.rotation.set(...rotation);
    parent.add(group);
    return group;
}

export function addBox(builder, parent, key, size, position, materialRef, options = {}) {
    const mesh = new THREE.Mesh(
        builder.getSharedGeometry(`${key}:box:${size.join(':')}`, () => new THREE.BoxGeometry(...size)),
        materialRef
    );
    mesh.name = options.name || key;
    mesh.position.set(...position);
    if (options.rotation) {
        mesh.rotation.set(...options.rotation);
    }
    mesh.castShadow = Boolean(options.castShadow);
    mesh.receiveShadow = options.receiveShadow ?? true;
    parent.add(mesh);
    return mesh;
}

export function addCylinder(builder, parent, key, radii, height, position, materialRef, options = {}) {
    const [radiusTop, radiusBottom = radiusTop] = Array.isArray(radii) ? radii : [radii, radii];
    const segments = options.segments ?? 32;
    const mesh = new THREE.Mesh(
        builder.getSharedGeometry(`${key}:cylinder:${radiusTop}:${radiusBottom}:${height}:${segments}`, () => (
            new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments)
        )),
        materialRef
    );
    mesh.name = options.name || key;
    mesh.position.set(...position);
    if (options.rotation) {
        mesh.rotation.set(...options.rotation);
    }
    mesh.castShadow = Boolean(options.castShadow);
    mesh.receiveShadow = options.receiveShadow ?? true;
    parent.add(mesh);
    return mesh;
}

export function addSphere(builder, parent, key, radius, position, materialRef, options = {}) {
    const widthSegments = options.widthSegments ?? 18;
    const heightSegments = options.heightSegments ?? 14;
    const mesh = new THREE.Mesh(
        builder.getSharedGeometry(`${key}:sphere:${radius}:${widthSegments}:${heightSegments}`, () => (
            new THREE.SphereGeometry(radius, widthSegments, heightSegments)
        )),
        materialRef
    );
    mesh.name = options.name || key;
    mesh.position.set(...position);
    if (options.scale) {
        mesh.scale.set(...options.scale);
    }
    if (options.rotation) {
        mesh.rotation.set(...options.rotation);
    }
    mesh.castShadow = Boolean(options.castShadow);
    mesh.receiveShadow = options.receiveShadow ?? true;
    parent.add(mesh);
    return mesh;
}

export function addCone(builder, parent, key, radius, height, position, materialRef, options = {}) {
    const segments = options.segments ?? 20;
    const openEnded = options.openEnded ?? false;
    const mesh = new THREE.Mesh(
        builder.getSharedGeometry(`${key}:cone:${radius}:${height}:${segments}:${openEnded}`, () => (
            new THREE.ConeGeometry(radius, height, segments, 1, openEnded)
        )),
        materialRef
    );
    mesh.name = options.name || key;
    mesh.position.set(...position);
    if (options.rotation) {
        mesh.rotation.set(...options.rotation);
    }
    mesh.castShadow = Boolean(options.castShadow);
    mesh.receiveShadow = options.receiveShadow ?? true;
    parent.add(mesh);
    return mesh;
}

export function addPlane(builder, parent, key, size, position, materialRef, options = {}) {
    const mesh = new THREE.Mesh(
        builder.getSharedGeometry(`${key}:plane:${size.join(':')}`, () => new THREE.PlaneGeometry(...size)),
        materialRef
    );
    mesh.name = options.name || key;
    mesh.position.set(...position);
    if (options.rotation) {
        mesh.rotation.set(...options.rotation);
    }
    mesh.castShadow = Boolean(options.castShadow);
    mesh.receiveShadow = options.receiveShadow ?? true;
    parent.add(mesh);
    return mesh;
}

/**
 * 车床旋转体：用 [半径, 高度] 剖面点列生成器皿类构件（棋罐、茶壶、花盆）。
 * 比圆柱堆叠更接近真实的鼓腹收口曲线。
 */
export function addLathe(builder, parent, key, profile, position, materialRef, options = {}) {
    const segments = options.segments ?? 24;
    const mesh = new THREE.Mesh(
        builder.getSharedGeometry(`${key}:lathe:${segments}:${profile.flat().join(',')}`, () => (
            new THREE.LatheGeometry(profile.map(([radius, y]) => new THREE.Vector2(radius, y)), segments)
        )),
        materialRef
    );
    mesh.name = options.name || key;
    mesh.position.set(...position);
    if (options.rotation) {
        mesh.rotation.set(...options.rotation);
    }
    mesh.castShadow = Boolean(options.castShadow);
    mesh.receiveShadow = options.receiveShadow ?? true;
    parent.add(mesh);
    return mesh;
}

export function addTorus(builder, parent, key, radius, tube, position, materialRef, options = {}) {
    const mesh = new THREE.Mesh(
        builder.getSharedGeometry(`${key}:torus:${radius}:${tube}`, () => (
            new THREE.TorusGeometry(radius, tube, options.radialSegments ?? 14, options.tubularSegments ?? 72)
        )),
        materialRef
    );
    mesh.name = options.name || key;
    mesh.position.set(...position);
    if (options.rotation) {
        mesh.rotation.set(...options.rotation);
    }
    mesh.castShadow = Boolean(options.castShadow);
    mesh.receiveShadow = options.receiveShadow ?? true;
    parent.add(mesh);
    return mesh;
}

export function addTable(builder, parent, key, ctx, settings) {
    const {
        width,
        depth,
        topThickness = 0.42,
        topY = ctx.supportTopY,
        height = 3.0,
        floorY = ctx.floorY,
        color = 0x7a5134,
        legColor = 0x4b3424,
        metalness = 0.03,
        roughness = 0.72,
        castShadow = true,
        apronHeight = 0.28,
        map = null,
        trimColor = null,
        drawer = false,
        stretchers = false,
        dentils = 0,
    } = settings;
    const group = addGroup(parent, `${key}:table`);
    const topMaterial = material(builder, `${key}:table-top-material`, {
        color,
        roughness,
        metalness,
        ...(map ? { map } : {}),
    });
    const legMaterial = material(builder, `${key}:table-leg-material`, {
        color: legColor,
        roughness: 0.78,
        metalness: 0.03,
    });
    const trimMaterial = trimColor === null ? legMaterial : material(builder, `${key}:table-trim-material`, {
        color: trimColor,
        roughness: 0.55,
        metalness: 0.14,
    });

    addBox(builder, group, `${key}:table-top`, [width, topThickness, depth], [0, topY - topThickness / 2, 0], topMaterial, {
        castShadow,
        receiveShadow: true,
    });

    // 桌沿包边：四条略深的窄条压住台面边缘，模拟倒角/镶边
    if (trimColor !== null) {
        const trimY = topY - topThickness * 0.32;
        const trimDepth = 0.12;
        addBox(builder, group, `${key}:table-trim-front`, [width, topThickness * 0.42, trimDepth], [0, trimY, depth / 2 - trimDepth / 2], trimMaterial, { castShadow: false });
        addBox(builder, group, `${key}:table-trim-back`, [width, topThickness * 0.42, trimDepth], [0, trimY, -depth / 2 + trimDepth / 2], trimMaterial, { castShadow: false });
        addBox(builder, group, `${key}:table-trim-left`, [trimDepth, topThickness * 0.42, depth], [-width / 2 + trimDepth / 2, trimY, 0], trimMaterial, { castShadow: false });
        addBox(builder, group, `${key}:table-trim-right`, [trimDepth, topThickness * 0.42, depth], [width / 2 - trimDepth / 2, trimY, 0], trimMaterial, { castShadow: false });
    }

    const resolvedFloorY = Number.isFinite(floorY) ? floorY : topY - height;
    const legHeight = Math.max(0.8, topY - topThickness - resolvedFloorY);
    const legY = topY - topThickness - legHeight / 2;
    const insetX = width * 0.38;
    const insetZ = depth * 0.34;

    if (apronHeight > 0) {
        const apronY = topY - topThickness - apronHeight / 2;
        addBox(builder, group, `${key}:table-front-apron`, [width * 0.88, apronHeight, 0.16], [0, apronY, depth * 0.43], legMaterial, {
            castShadow,
            receiveShadow: true,
        });
        addBox(builder, group, `${key}:table-back-apron`, [width * 0.88, apronHeight, 0.16], [0, apronY, -depth * 0.43], legMaterial, {
            castShadow,
            receiveShadow: true,
        });
        addBox(builder, group, `${key}:table-left-apron`, [0.16, apronHeight, depth * 0.76], [-width * 0.43, apronY, 0], legMaterial, {
            castShadow,
            receiveShadow: true,
        });
        addBox(builder, group, `${key}:table-right-apron`, [0.16, apronHeight, depth * 0.76], [width * 0.43, apronY, 0], legMaterial, {
            castShadow,
            receiveShadow: true,
        });
    }

    // 牙板齿饰：沿前牙板等距的小方齿，是"雕花"感最省的做法
    if (dentils > 0 && apronHeight > 0) {
        const dentilY = topY - topThickness - apronHeight * 0.86;
        const span = width * 0.78;
        for (let index = 0; index < dentils; index += 1) {
            const x = -span / 2 + (span / (dentils - 1)) * index;
            addBox(builder, group, `${key}:table-dentil`, [0.14, apronHeight * 0.5, 0.1], [x, dentilY, depth * 0.47], trimMaterial, {
                castShadow: false,
                name: `${key}:table-dentil-${index}`,
            });
        }
    }

    // 抽屉：前牙板上开一个屉面 + 两枚圆钮
    if (drawer && apronHeight > 0) {
        const drawerHeight = apronHeight * 0.78;
        const drawerY = topY - topThickness - apronHeight / 2;
        const drawerZ = depth * 0.44;
        addBox(builder, group, `${key}:table-drawer`, [width * 0.34, drawerHeight, 0.1], [0, drawerY, drawerZ], topMaterial, {
            castShadow: false,
        });
        [-1, 1].forEach((side) => {
            addSphere(builder, group, `${key}:table-drawer-knob`, 0.075, [side * width * 0.1, drawerY, drawerZ + 0.08], trimMaterial, {
                castShadow: false,
                widthSegments: 12,
                heightSegments: 10,
                name: `${key}:table-drawer-knob-${side === 1 ? 'right' : 'left'}`,
            });
        });
    }

    [-1, 1].forEach((dx) => {
        [-1, 1].forEach((dz) => {
            addBox(builder, group, `${key}:table-leg`, [0.34, legHeight, 0.34], [dx * insetX, legY, dz * insetZ], legMaterial, {
                castShadow,
                receiveShadow: true,
            });
        });
    });

    // 下横撑：贴近地面连接四腿，让桌子在低视角下不显得"腿悬空"
    if (stretchers) {
        const railY = resolvedFloorY + legHeight * 0.26;
        [-1, 1].forEach((dz) => {
            addBox(builder, group, `${key}:table-rail-x`, [insetX * 2, 0.13, 0.13], [0, railY, dz * insetZ], legMaterial, {
                castShadow: false,
                name: `${key}:table-rail-x-${dz === 1 ? 'front' : 'back'}`,
            });
        });
        [-1, 1].forEach((dx) => {
            addBox(builder, group, `${key}:table-rail-z`, [0.13, 0.13, insetZ * 2], [dx * insetX, railY, 0], legMaterial, {
                castShadow: false,
                name: `${key}:table-rail-z-${dx === 1 ? 'right' : 'left'}`,
            });
        });
    }

    return group;
}

/**
 * 纹样地毯：图案贴图铺在薄板上 + 一圈稍暗的外沿，落地更实。
 */
export function addRug(builder, parent, key, settings) {
    const {
        width,
        depth,
        position = [0, 0, 0],
        color = 0x5e3226,
        edgeColor = null,
        rotationY = 0,
    } = settings;
    const group = addGroup(parent, `${key}:rug`, position, [0, rotationY, 0]);
    const rugMaterial = material(builder, `${key}:rug-material`, {
        color,
        roughness: 0.98,
        metalness: 0.0,
        map: getRugPatternTexture(builder),
    });
    const edgeMaterial = material(builder, `${key}:rug-edge-material`, {
        color: edgeColor ?? color,
        roughness: 0.99,
        metalness: 0.0,
    });
    addBox(builder, group, `${key}:rug-body`, [width + 0.14, 0.05, depth + 0.14], [0, 0.025, 0], edgeMaterial, {
        castShadow: false,
        receiveShadow: true,
    });
    addPlane(builder, group, `${key}:rug-face`, [width, depth], [0, 0.053, 0], rugMaterial, {
        rotation: [-Math.PI / 2, 0, 0],
        castShadow: false,
        receiveShadow: true,
    });
    return group;
}

/**
 * 书堆：平躺叠放的几本书，每本略微错位与转角，比整齐堆叠自然。
 */
export function addBookStack(builder, parent, key, position, settings = {}) {
    const {
        colors = [0x8a4a3a, 0x4a6a52, 0xc2a05a, 0x53638a],
        scale = 1,
        rotationY = 0,
    } = settings;
    const group = addGroup(parent, `${key}:books`, position, [0, rotationY, 0]);
    let stackY = 0;
    colors.forEach((color, index) => {
        const bookMaterial = material(builder, `${key}:book-${index}`, {
            color,
            roughness: 0.86,
            metalness: 0.0,
        });
        const thickness = (0.1 + (index % 2) * 0.035) * scale;
        const bookWidth = (1.05 - index * 0.05) * scale;
        const bookDepth = (0.74 - index * 0.03) * scale;
        stackY += thickness / 2;
        addBox(builder, group, `${key}:book-${index}`, [bookWidth, thickness, bookDepth], [
            (index % 2 === 0 ? 0.03 : -0.04) * scale,
            stackY,
            (index % 3 === 0 ? -0.02 : 0.03) * scale,
        ], bookMaterial, {
            castShadow: true,
            rotation: [0, (index % 2 === 0 ? 0.07 : -0.11), 0],
        });
        stackY += thickness / 2;
    });
    return group;
}

/**
 * 茶具：托盘 + 鼓腹茶壶（壶身/壶盖/壶嘴/提梁）+ 两只茶杯。
 */
export function addTeaSet(builder, parent, key, position, settings = {}) {
    const {
        scale = 1,
        potColor = 0x6d5240,
        cupColor = 0xd8cfc0,
        trayColor = 0x4a3526,
        teaColor = 0x9a7a3a,
        rotationY = 0,
    } = settings;
    const group = addGroup(parent, `${key}:tea-set`, position, [0, rotationY, 0]);
    const s = scale;

    const trayMaterial = material(builder, `${key}:tea-tray`, { color: trayColor, roughness: 0.72, metalness: 0.04 });
    const potMaterial = material(builder, `${key}:tea-pot`, { color: potColor, roughness: 0.42, metalness: 0.08 });
    const cupMaterial = material(builder, `${key}:tea-cup`, { color: cupColor, roughness: 0.36, metalness: 0.02 });
    const teaMaterial = material(builder, `${key}:tea-liquid`, { color: teaColor, roughness: 0.2, metalness: 0.0 });

    addBox(builder, group, `${key}:tea-tray`, [1.55 * s, 0.07 * s, 1.0 * s], [0, 0.035 * s, 0], trayMaterial, {
        castShadow: true,
    });

    const potProfile = [
        [0, 0], [0.30, 0], [0.42, 0.06], [0.49, 0.19], [0.47, 0.31],
        [0.36, 0.39], [0.20, 0.42], [0.19, 0.45], [0.27, 0.475], [0.24, 0.50], [0.11, 0.545], [0, 0.55],
    ].map(([radius, y]) => [radius * s, y * s]);
    const potX = -0.34 * s;
    addLathe(builder, group, `${key}:tea-pot-body`, potProfile, [potX, 0.07 * s, 0], potMaterial, {
        segments: 22,
        castShadow: true,
    });
    addSphere(builder, group, `${key}:tea-pot-knob`, 0.06 * s, [potX, 0.635 * s, 0], potMaterial, {
        castShadow: false,
        widthSegments: 12,
        heightSegments: 10,
    });
    addCylinder(builder, group, `${key}:tea-pot-spout`, [0.045 * s, 0.075 * s], 0.4 * s, [potX - 0.4 * s, 0.36 * s, 0], potMaterial, {
        segments: 10,
        castShadow: false,
        rotation: [0, 0, 0.95],
    });
    addTorus(builder, group, `${key}:tea-pot-handle`, 0.17 * s, 0.032 * s, [potX + 0.44 * s, 0.33 * s, 0], potMaterial, {
        radialSegments: 8,
        tubularSegments: 20,
        castShadow: false,
        rotation: [Math.PI / 2, 0, 0],
    });

    [[0.3, 0.26], [0.55, -0.26]].forEach(([x, z], index) => {
        const cupX = x * s;
        const cupZ = z * s;
        addCylinder(builder, group, `${key}:tea-saucer`, [0.19 * s, 0.21 * s], 0.03 * s, [cupX, 0.085 * s, cupZ], cupMaterial, {
            segments: 16,
            castShadow: false,
            name: `${key}:tea-saucer-${index}`,
        });
        addCylinder(builder, group, `${key}:tea-cup`, [0.14 * s, 0.11 * s], 0.16 * s, [cupX, 0.18 * s, cupZ], cupMaterial, {
            segments: 16,
            castShadow: true,
            name: `${key}:tea-cup-${index}`,
        });
        addCylinder(builder, group, `${key}:tea-cup-liquid`, [0.12 * s, 0.12 * s], 0.02 * s, [cupX, 0.25 * s, cupZ], teaMaterial, {
            segments: 16,
            castShadow: false,
            receiveShadow: false,
            name: `${key}:tea-cup-liquid-${index}`,
        });
    });

    return group;
}

/**
 * 座垫：椅面上的一块布料软垫，让木椅不再是纯几何盒。
 */
export function addCushion(builder, parent, key, size, position, color) {
    const cushionMaterial = material(builder, `${key}:cushion-material`, {
        color,
        roughness: 0.95,
        metalness: 0.0,
        map: getFabricWeaveTexture(builder),
    });
    return addBox(builder, parent, `${key}:cushion`, size, position, cushionMaterial, {
        castShadow: false,
        receiveShadow: true,
    });
}

export function addChair(builder, parent, key, position, rotationY, settings = {}) {
    const group = addGroup(parent, `${key}:chair`, position, [0, rotationY, 0]);
    group.scale.setScalar(settings.scale ?? 1);
    const chairMaterial = material(builder, `${key}:chair-material`, {
        color: settings.color ?? 0x5d4634,
        roughness: 0.78,
        metalness: 0.03,
    });
    addBox(builder, group, `${key}:chair-seat`, [1.8, 0.22, 1.65], [0, 1.12, 0], chairMaterial, {
        castShadow: true,
        receiveShadow: true,
    });
    // 靠背改为两根立柱 + 三道横档，比整块板更像木椅
    [-0.78, 0.78].forEach((x) => {
        addBox(builder, group, `${key}:chair-stile`, [0.16, 1.9, 0.18], [x, 2.05, -0.76], chairMaterial, {
            castShadow: true,
            rotation: [-0.08, 0, 0],
            name: `${key}:chair-stile-${x < 0 ? 'left' : 'right'}`,
        });
    });
    [1.5, 2.16, 2.82].forEach((y, index) => {
        addBox(builder, group, `${key}:chair-slat`, [1.44, 0.2, 0.12], [0, y, -0.76 - (y - 2.05) * 0.08], chairMaterial, {
            castShadow: true,
            rotation: [-0.08, 0, 0],
            name: `${key}:chair-slat-${index}`,
        });
    });
    [-0.68, 0.68].forEach((x) => {
        [-0.56, 0.56].forEach((z) => {
            addBox(builder, group, `${key}:chair-leg`, [0.16, 1.1, 0.16], [x, 0.56, z], chairMaterial, {
                castShadow: true,
                receiveShadow: true,
            });
        });
    });
    if (settings.cushionColor) {
        addCushion(builder, group, key, [1.62, 0.16, 1.48], [0, 1.31, 0.04], settings.cushionColor);
    }
    return group;
}

export function addBench(builder, parent, key, position, rotationY, settings = {}) {
    const group = addGroup(parent, `${key}:bench`, position, [0, rotationY, 0]);
    group.scale.setScalar(settings.scale ?? 1);
    const benchMaterial = material(builder, `${key}:bench-material`, {
        color: settings.color ?? 0x7b5737,
        roughness: 0.78,
        metalness: 0.03,
    });
    const metalMaterial = material(builder, `${key}:bench-metal-material`, {
        color: 0x3f473b,
        roughness: 0.7,
        metalness: 0.12,
    });
    // 座面与靠背都用条板拼出，侧面能看到板缝
    [-0.24, 0.02, 0.28].forEach((z, index) => {
        addBox(builder, group, `${key}:bench-slat`, [4.4, 0.16, 0.22], [0, 1.05, z], benchMaterial, {
            castShadow: true,
            name: `${key}:bench-slat-${index}`,
        });
    });
    [1.5, 1.86].forEach((y, index) => {
        addBox(builder, group, `${key}:bench-back-slat`, [4.4, 0.2, 0.14], [0, y, -0.38 - (y - 1.5) * 0.18], benchMaterial, {
            castShadow: true,
            rotation: [-0.18, 0, 0],
            name: `${key}:bench-back-slat-${index}`,
        });
    });
    [-1.62, 1.62].forEach((x) => {
        addBox(builder, group, `${key}:bench-leg`, [0.18, 1.1, 0.18], [x, 0.52, 0.12], metalMaterial, {
            castShadow: true,
        });
        addBox(builder, group, `${key}:bench-brace`, [0.14, 0.14, 0.86], [x, 1.0, 0.02], metalMaterial, {
            castShadow: false,
            name: `${key}:bench-brace-${x < 0 ? 'left' : 'right'}`,
        });
    });
    return group;
}

export function addTree(builder, parent, key, position, scale, colors = {}) {
    const group = addGroup(parent, `${key}:tree`, position);
    const trunkMaterial = material(builder, `${key}:trunk-material`, {
        color: colors.trunk ?? 0x5d3f24,
        roughness: 0.9,
        metalness: 0.01,
    });
    const canopyMaterial = material(builder, `${key}:canopy-material`, {
        color: colors.canopy ?? 0x587c43,
        roughness: 0.94,
        metalness: 0.0,
    });
    addCylinder(builder, group, `${key}:trunk`, [0.28 * scale, 0.42 * scale], 3.3 * scale, [0, 1.65 * scale, 0], trunkMaterial, {
        segments: 12,
        castShadow: true,
    });
    const canopyRig = addGroup(group, `${key}:canopy-rig`);
    [
        [0, 3.85, 0, 1.28],
        [0.82, 3.48, 0.18, 0.92],
        [-0.76, 3.58, -0.18, 0.98],
        [0.18, 4.32, -0.06, 0.82],
    ].forEach(([x, y, z, radius], index) => {
        addSphere(builder, canopyRig, `${key}:canopy:${index}`, radius * scale, [x * scale, y * scale, z * scale], canopyMaterial, {
            castShadow: true,
            scale: [1.18, 0.82, 1.06],
        });
    });
    return { group, canopyRig, scale };
}

/**
 * 多叶盆栽：外扩花盆 + 盆口沿 + 深色土面 + 三层交错叶簇。
 * 叶片用轮廓遮罩（alphaMap + alphaTest）裁成叶形，不再是可见的矩形片。
 */
export function addPottedPlant(builder, parent, key, position, scale = 1, colors = {}) {
    const group = addGroup(parent, `${key}:plant`, position);
    const potMaterial = material(builder, `${key}:pot-material`, {
        color: colors.pot ?? 0x8f5a3d,
        roughness: 0.8,
        metalness: 0.02,
    });
    const soilMaterial = material(builder, `${key}:soil-material`, {
        color: colors.soil ?? 0x2e2118,
        roughness: 0.98,
        metalness: 0.0,
    });
    const leafMaterial = material(builder, `${key}:leaf-material`, {
        color: colors.leaf ?? 0x54744a,
        roughness: 0.9,
        metalness: 0.0,
        side: THREE.DoubleSide,
        alphaMap: getLeafAlphaTexture(builder),
        alphaTest: 0.45,
    });
    const leafDarkMaterial = material(builder, `${key}:leaf-dark-material`, {
        color: colors.leafDark ?? 0x3f5c38,
        roughness: 0.92,
        metalness: 0.0,
        side: THREE.DoubleSide,
        alphaMap: getLeafAlphaTexture(builder),
        alphaTest: 0.45,
    });
    const stemMaterial = material(builder, `${key}:stem-material`, {
        color: colors.stem ?? 0x4c6338,
        roughness: 0.9,
        metalness: 0.0,
    });

    addLathe(builder, group, `${key}:pot`, [
        [0, 0], [0.3, 0], [0.34, 0.06], [0.42, 0.42], [0.46, 0.5],
        [0.5, 0.52], [0.5, 0.6], [0.44, 0.6], [0.42, 0.56], [0, 0.56],
    ].map(([radius, y]) => [radius * scale, y * scale]), [0, 0, 0], potMaterial, {
        segments: 20,
        castShadow: true,
    });
    addCylinder(builder, group, `${key}:soil`, [0.4 * scale, 0.4 * scale], 0.04 * scale, [0, 0.55 * scale, 0], soilMaterial, {
        segments: 18,
        castShadow: false,
    });

    // 三层叶簇：越往上叶片越短越立，形成收拢的株型
    const layers = [
        { count: 7, radius: 0.3, y: 0.62, length: 1.0, pitch: 1.15, dark: true },
        { count: 6, radius: 0.22, y: 0.86, length: 0.86, pitch: 0.78, dark: false },
        { count: 5, radius: 0.13, y: 1.08, length: 0.66, pitch: 0.42, dark: false },
    ];
    layers.forEach((layer, layerIndex) => {
        const stemHeight = (layer.y - 0.5) * scale;
        if (stemHeight > 0.05) {
            addCylinder(builder, group, `${key}:stem-${layerIndex}`, [0.035 * scale, 0.055 * scale], stemHeight, [
                0,
                (0.5 + (layer.y - 0.5) / 2) * scale,
                0,
            ], stemMaterial, {
                segments: 8,
                castShadow: false,
            });
        }
        for (let index = 0; index < layer.count; index += 1) {
            const angle = (index / layer.count) * Math.PI * 2 + layerIndex * 0.55;
            addPlane(builder, group, `${key}:leaf-${layerIndex}`, [0.34 * scale * layer.length, 0.95 * scale * layer.length], [
                Math.cos(angle) * layer.radius * scale,
                layer.y * scale + 0.3 * scale * layer.length,
                Math.sin(angle) * layer.radius * scale,
            ], layer.dark && index % 2 === 0 ? leafDarkMaterial : leafMaterial, {
                castShadow: true,
                receiveShadow: false,
                rotation: [layer.pitch * (index % 2 === 0 ? 1 : 0.82), -angle, index % 3 === 0 ? 0.2 : -0.14],
                name: `${key}:leaf-${layerIndex}-${index}`,
            });
        }
    });

    return group;
}
