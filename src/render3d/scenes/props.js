import * as THREE from 'three';

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
    } = settings;
    const group = addGroup(parent, `${key}:table`);
    const topMaterial = material(builder, `${key}:table-top-material`, {
        color,
        roughness,
        metalness,
    });
    const legMaterial = material(builder, `${key}:table-leg-material`, {
        color: legColor,
        roughness: 0.78,
        metalness: 0.03,
    });

    addBox(builder, group, `${key}:table-top`, [width, topThickness, depth], [0, topY - topThickness / 2, 0], topMaterial, {
        castShadow,
        receiveShadow: true,
    });

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

    [-1, 1].forEach((dx) => {
        [-1, 1].forEach((dz) => {
            addBox(builder, group, `${key}:table-leg`, [0.34, legHeight, 0.34], [dx * insetX, legY, dz * insetZ], legMaterial, {
                castShadow,
                receiveShadow: true,
            });
        });
    });

    return group;
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
    addBox(builder, group, `${key}:chair-back`, [1.8, 1.8, 0.22], [0, 2.05, -0.76], chairMaterial, {
        castShadow: true,
        receiveShadow: true,
        rotation: [-0.08, 0, 0],
    });
    [-0.68, 0.68].forEach((x) => {
        [-0.56, 0.56].forEach((z) => {
            addBox(builder, group, `${key}:chair-leg`, [0.16, 1.1, 0.16], [x, 0.56, z], chairMaterial, {
                castShadow: true,
                receiveShadow: true,
            });
        });
    });
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
    addBox(builder, group, `${key}:bench-seat`, [4.4, 0.22, 0.72], [0, 1.05, 0], benchMaterial, {
        castShadow: true,
    });
    addBox(builder, group, `${key}:bench-back`, [4.4, 0.2, 0.78], [0, 1.72, -0.38], benchMaterial, {
        castShadow: true,
        rotation: [-0.18, 0, 0],
    });
    [-1.62, 1.62].forEach((x) => {
        addBox(builder, group, `${key}:bench-leg`, [0.18, 1.1, 0.18], [x, 0.52, 0.12], metalMaterial, {
            castShadow: true,
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

export function addPottedPlant(builder, parent, key, position, scale = 1) {
    const group = addGroup(parent, `${key}:plant`, position);
    const potMaterial = material(builder, `${key}:pot-material`, {
        color: 0x8f5a3d,
        roughness: 0.8,
        metalness: 0.02,
    });
    const leafMaterial = material(builder, `${key}:leaf-material`, {
        color: 0x54744a,
        roughness: 0.9,
        metalness: 0.0,
    });
    addCylinder(builder, group, `${key}:pot`, [0.34 * scale, 0.44 * scale], 0.55 * scale, [0, 0.28 * scale, 0], potMaterial, {
        segments: 18,
        castShadow: true,
    });
    for (let index = 0; index < 7; index += 1) {
        const angle = (index / 7) * Math.PI * 2;
        const leaf = addPlane(builder, group, `${key}:leaf:${index}`, [0.28 * scale, 0.88 * scale], [
            Math.cos(angle) * 0.16 * scale,
            0.84 * scale,
            Math.sin(angle) * 0.16 * scale,
        ], leafMaterial, {
            castShadow: true,
            receiveShadow: false,
            rotation: [0.52, angle, (index % 2 === 0 ? 0.22 : -0.16)],
        });
        leaf.name = `${key}:leaf:${index}`;
    }
    return group;
}
