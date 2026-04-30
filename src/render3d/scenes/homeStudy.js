import * as THREE from 'three';
import {
    addBox,
    addChair,
    addCylinder,
    addGroup,
    addPlane,
    addPottedPlant,
    addSphere,
    addTable,
    material,
} from './props.js';

export function buildHomeStudy(builder, ctx) {
    const root = builder.group;
    const floorMaterial = material(builder, 'home:floor-material', {
        color: 0x4b3022,
        roughness: 0.9,
        metalness: 0.02,
    });
    const wallMaterial = material(builder, 'home:wall-material', {
        color: 0x32241b,
        roughness: 0.94,
        metalness: 0.01,
        side: THREE.DoubleSide,
    });
    const trimMaterial = material(builder, 'home:trim-material', {
        color: 0x5d3d29,
        roughness: 0.78,
        metalness: 0.03,
    });
    const rugMaterial = material(builder, 'home:rug-material', {
        color: 0x7c5238,
        roughness: 0.86,
        metalness: 0.0,
        emissive: 0x25110a,
        emissiveIntensity: 0.08,
        side: THREE.DoubleSide,
    });

    addPlane(builder, root, 'home:floor', [ctx.boardTotal * 5.0, ctx.boardTotal * 4.1], [0, ctx.floorY, 1.8], floorMaterial, {
        rotation: [-Math.PI / 2, 0, 0],
        receiveShadow: true,
    });
    addPlane(builder, root, 'home:rug', [ctx.boardTotal * 2.6, ctx.boardTotal * 1.85], [0, ctx.floorY + 0.025, 1.25], rugMaterial, {
        rotation: [-Math.PI / 2, 0, 0],
        receiveShadow: true,
    });
    addFloorPlanks(builder, root, ctx);

    const table = addTable(builder, root, 'home', ctx, {
        width: ctx.boardTotal * 2.42,
        depth: ctx.boardTotal * 1.72,
        topThickness: 0.52,
        height: 3.25,
        color: 0x7b4d2f,
        legColor: 0x4a2f1e,
        roughness: 0.62,
        apronHeight: 0.36,
    });

    addBox(builder, table, 'home:table-runner', [ctx.boardTotal * 0.2, 0.035, ctx.boardTotal * 1.44], [-ctx.boardTotal * 0.52, ctx.supportTopY + 0.024, 0], material(builder, 'home:runner-material', {
        color: 0x9b6a43,
        roughness: 0.88,
        metalness: 0.0,
    }), { receiveShadow: true });
    addTableDetails(builder, table, ctx);

    const backWallZ = -ctx.boardTotal * 1.68;
    addPlane(builder, root, 'home:back-wall', [ctx.boardTotal * 4.3, 9.8], [0, 2.3, backWallZ], wallMaterial, {
        receiveShadow: true,
    });
    addPlane(builder, root, 'home:left-wall', [ctx.boardTotal * 2.55, 9.8], [-ctx.boardTotal * 2.15, 2.2, -1.05], wallMaterial, {
        rotation: [0, Math.PI / 2.25, 0],
        receiveShadow: true,
    });
    addPlane(builder, root, 'home:right-wall', [ctx.boardTotal * 2.55, 9.8], [ctx.boardTotal * 2.15, 2.2, -1.05], wallMaterial, {
        rotation: [0, -Math.PI / 2.25, 0],
        receiveShadow: true,
    });
    addBox(builder, root, 'home:wall-trim', [ctx.boardTotal * 3.62, 0.14, 0.12], [0, 4.9, backWallZ + 0.05], trimMaterial, {
        castShadow: false,
        receiveShadow: true,
    });
    addWallDetails(builder, root, ctx, backWallZ);

    addWindow(builder, root, ctx, backWallZ);
    addBookshelf(builder, root, ctx, [-ctx.boardTotal * 1.24, ctx.floorY + 3.2, backWallZ + 0.38], 0.08);
    addBookshelf(builder, root, ctx, [ctx.boardTotal * 1.3, ctx.floorY + 3.2, backWallZ + 0.4], -0.08);
    addChair(builder, root, 'home:near', [0, ctx.floorY, ctx.boardTotal * 1.08], Math.PI, { color: 0x5c4031, scale: 2.22 });
    addChair(builder, root, 'home:left', [-ctx.boardTotal * 1.08, ctx.floorY, 0.22], Math.PI / 2.45, { color: 0x6a4c38, scale: 2.05 });
    addDeskLamp(builder, root, ctx);
    addTeaSet(builder, root, ctx);
    addPottedPlant(builder, root, 'home:floor-plant', [ctx.boardTotal * 1.42, ctx.floorY + 0.02, ctx.boardTotal * 0.74], 1.85);

    const steam = addTeaSteam(builder, root, ctx);
    builder.markDynamic(steam);
    builder.registerAnimator((timeSeconds) => {
        steam.children.forEach((puff, index) => {
            puff.position.y = puff.userData.baseY + Math.sin(timeSeconds * 0.9 + index) * 0.08;
            puff.position.x = puff.userData.baseX + Math.sin(timeSeconds * 0.55 + index) * 0.04;
            puff.material.opacity = 0.12 + (Math.sin(timeSeconds * 0.85 + index) + 1) * 0.04;
        });
    });
}

function addFloorPlanks(builder, root, ctx) {
    const seam = material(builder, 'home:floor-seam-material', {
        color: 0x2c1c14,
        roughness: 0.94,
        metalness: 0.0,
    });
    for (let index = -5; index <= 5; index += 1) {
        addBox(builder, root, `home:floor-plank:${index}`, [0.035, 0.012, ctx.boardTotal * 3.15], [index * ctx.boardTotal * 0.34, ctx.floorY + 0.032, 2.3], seam, {
            receiveShadow: true,
        });
    }
}

function addTableDetails(builder, table, ctx) {
    const paper = material(builder, 'home:paper-material', {
        color: 0xd8c7aa,
        roughness: 0.76,
        metalness: 0.0,
    });
    const ink = material(builder, 'home:ink-brush-material', {
        color: 0x2a211a,
        roughness: 0.68,
        metalness: 0.04,
    });
    const bowlDark = material(builder, 'home:black-bowl-material', {
        color: 0x25201b,
        roughness: 0.42,
        metalness: 0.08,
    });
    const bowlLight = material(builder, 'home:white-bowl-material', {
        color: 0xd6ccb8,
        roughness: 0.48,
        metalness: 0.04,
    });

    addBox(builder, table, 'home:score-sheet', [2.25, 0.035, 1.34], [ctx.boardTotal * 0.34, ctx.supportTopY + 0.046, ctx.boardTotal * 0.6], paper, {
        receiveShadow: true,
        rotation: [0, 0.12, 0],
    });
    addCylinder(builder, table, 'home:black-bowl', [0.86, 1.02], 0.42, [-ctx.boardTotal * 0.82, ctx.supportTopY + 0.22, ctx.boardTotal * 0.58], bowlDark, {
        segments: 28,
        castShadow: true,
    });
    addCylinder(builder, table, 'home:white-bowl', [0.86, 1.02], 0.42, [-ctx.boardTotal * 0.82, ctx.supportTopY + 0.22, -ctx.boardTotal * 0.58], bowlLight, {
        segments: 28,
        castShadow: true,
    });
    addCylinder(builder, table, 'home:brush', 0.045, 1.52, [ctx.boardTotal * 0.48, ctx.supportTopY + 0.11, ctx.boardTotal * 0.56], ink, {
        segments: 10,
        castShadow: true,
        rotation: [0, 0, Math.PI / 2.18],
    });
}

function addWallDetails(builder, root, ctx, backWallZ) {
    const trim = material(builder, 'home:wall-detail-material', {
        color: 0x5d3d29,
        roughness: 0.8,
        metalness: 0.03,
    });
    const frame = material(builder, 'home:picture-frame-material', {
        color: 0x7a5638,
        roughness: 0.68,
        metalness: 0.04,
    });
    const paper = material(builder, 'home:picture-paper-material', {
        color: 0xcab790,
        roughness: 0.84,
        metalness: 0.0,
        side: THREE.DoubleSide,
    });

    addBox(builder, root, 'home:back-baseboard', [ctx.boardTotal * 3.58, 0.2, 0.14], [0, ctx.floorY + 0.24, backWallZ + 0.08], trim, {
        receiveShadow: true,
    });
    addBox(builder, root, 'home:left-baseboard', [ctx.boardTotal * 1.75, 0.18, 0.12], [-ctx.boardTotal * 1.86, ctx.floorY + 0.24, -1.35], trim, {
        rotation: [0, Math.PI / 2.25, 0],
        receiveShadow: true,
    });
    addBox(builder, root, 'home:right-baseboard', [ctx.boardTotal * 1.75, 0.18, 0.12], [ctx.boardTotal * 1.86, ctx.floorY + 0.24, -1.35], trim, {
        rotation: [0, -Math.PI / 2.25, 0],
        receiveShadow: true,
    });
    [-1.55, -0.78, 0.78, 1.55].forEach((x, index) => {
        addBox(builder, root, `home:wall-stile:${index}`, [0.12, 2.35, 0.08], [ctx.boardTotal * x, ctx.floorY + 1.46, backWallZ + 0.07], trim, {
            receiveShadow: true,
        });
    });
    const pictureX = -ctx.boardTotal * 0.44;
    addPlane(builder, root, 'home:wall-scroll-paper', [2.25, 2.95], [pictureX, 2.85, backWallZ + 0.09], paper, {
        receiveShadow: true,
    });
    addBox(builder, root, 'home:wall-scroll-top', [2.55, 0.11, 0.12], [pictureX, 4.38, backWallZ + 0.13], frame, {});
    addBox(builder, root, 'home:wall-scroll-bottom', [2.55, 0.11, 0.12], [pictureX, 1.32, backWallZ + 0.13], frame, {});
}

function addWindow(builder, root, ctx, backWallZ) {
    const frameMaterial = material(builder, 'home:window-frame-material', {
        color: 0x6b432a,
        roughness: 0.64,
        metalness: 0.03,
    });
    const glowMaterial = material(builder, 'home:window-glow-material', {
        color: 0xffc887,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        side: THREE.DoubleSide,
    }, 'basic');
    const texture = builder.getSharedTexture('home:window-backdrop-texture', 'assets/scene-backdrops/home-window-isometric.png');
    const backdropMaterial = material(builder, 'home:window-backdrop-material', {
        color: 0xffffff,
        map: texture,
        side: THREE.DoubleSide,
    }, 'basic');
    const group = addGroup(root, 'home:window', [ctx.boardTotal * 0.36, 3.0, backWallZ + 0.08]);
    addPlane(builder, group, 'home:window-view', [ctx.boardTotal * 1.28, 3.05], [0, 0, 0], backdropMaterial, {
        receiveShadow: false,
    });
    addPlane(builder, group, 'home:window-glow', [ctx.boardTotal * 1.34, 3.15], [0, 0, 0.012], glowMaterial, {
        receiveShadow: false,
    });
    addBox(builder, group, 'home:window-top', [ctx.boardTotal * 1.4, 0.16, 0.14], [0, 1.62, 0.08], frameMaterial, {});
    addBox(builder, group, 'home:window-bottom', [ctx.boardTotal * 1.4, 0.16, 0.14], [0, -1.62, 0.08], frameMaterial, {});
    addBox(builder, group, 'home:window-left', [0.16, 3.35, 0.14], [-ctx.boardTotal * 0.72, 0, 0.08], frameMaterial, {});
    addBox(builder, group, 'home:window-right', [0.16, 3.35, 0.14], [ctx.boardTotal * 0.72, 0, 0.08], frameMaterial, {});
    addBox(builder, group, 'home:window-cross', [0.12, 3.05, 0.12], [0, 0, 0.1], frameMaterial, {});
    addBox(builder, group, 'home:window-sill', [ctx.boardTotal * 1.58, 0.18, 0.48], [0, -1.82, 0.18], frameMaterial, {
        castShadow: true,
    });
}

function addBookshelf(builder, root, ctx, position, rotationY) {
    const group = addGroup(root, 'home:bookshelf', position, [0, rotationY, 0]);
    const wood = material(builder, 'home:bookshelf-wood', {
        color: 0x5c3a24,
        roughness: 0.76,
        metalness: 0.03,
    });
    const bookColors = [0x8b4d3f, 0x38546e, 0x6d7542, 0x8a6b3f];
    addBox(builder, group, 'home:bookshelf-case', [5.1, 6.4, 0.56], [0, 0, 0], wood, {
        castShadow: true,
    });
    for (let row = 0; row < 5; row += 1) {
        addBox(builder, group, 'home:bookshelf-shelf', [5.28, 0.14, 0.66], [0, -2.46 + row * 1.22, 0.1], wood, {
            castShadow: true,
        });
        for (let index = 0; index < 8; index += 1) {
            const bookMaterial = material(builder, `home:book-material:${bookColors[(index + row) % bookColors.length].toString(16)}`, {
                color: bookColors[(index + row) % bookColors.length],
                roughness: 0.82,
                metalness: 0.02,
            });
            addBox(builder, group, 'home:book', [0.36, 0.82 + (index % 3) * 0.1, 0.28], [-1.86 + index * 0.52, -2.08 + row * 1.22, 0.43], bookMaterial, {});
        }
    }
}

function addDeskLamp(builder, root, ctx) {
    const group = addGroup(root, 'home:lamp', [-ctx.boardTotal * 1.03, ctx.supportTopY + 0.02, -ctx.boardTotal * 0.46]);
    const metal = material(builder, 'home:lamp-metal', {
        color: 0x4a3326,
        roughness: 0.48,
        metalness: 0.24,
    });
    const shade = material(builder, 'home:lamp-shade', {
        color: 0xd79b62,
        roughness: 0.62,
        metalness: 0.03,
        emissive: 0x5f3215,
        emissiveIntensity: 0.18,
    });
    addCylinder(builder, group, 'home:lamp-base', 0.42, 0.12, [0, 0.08, 0], metal, { segments: 24, castShadow: true });
    addCylinder(builder, group, 'home:lamp-post', 0.06, 1.9, [0, 1.02, 0], metal, { segments: 12, castShadow: true });
    addCylinder(builder, group, 'home:lamp-shade', [0.56, 0.72], 0.68, [0.22, 2.04, 0], shade, { segments: 28, castShadow: true });
    addSphere(builder, group, 'home:lamp-bulb', 0.22, [0.22, 1.92, 0], material(builder, 'home:lamp-glow', {
        color: 0xffc67e,
        transparent: true,
        opacity: 0.44,
        depthWrite: false,
    }, 'basic'), { receiveShadow: false });
}

function addTeaSet(builder, root, ctx) {
    const group = addGroup(root, 'home:tea-set', [ctx.boardTotal * 0.74, ctx.supportTopY + 0.02, ctx.boardTotal * 0.44]);
    const ceramic = material(builder, 'home:ceramic-material', {
        color: 0xd8c6ae,
        roughness: 0.5,
        metalness: 0.02,
    });
    const tea = material(builder, 'home:tea-material', {
        color: 0x7f5738,
        roughness: 0.4,
        metalness: 0.02,
    });
    addCylinder(builder, group, 'home:teapot-body', [0.36, 0.42], 0.44, [0, 0.28, 0], ceramic, { segments: 24, castShadow: true });
    addSphere(builder, group, 'home:teapot-lid', 0.18, [0, 0.56, 0], ceramic, { castShadow: true, scale: [1, 0.45, 1] });
    [-0.62, 0.58].forEach((x, index) => {
        addCylinder(builder, group, `home:cup:${index}`, [0.18, 0.2], 0.24, [x, 0.16, 0.06], ceramic, { segments: 20, castShadow: true });
        addCylinder(builder, group, `home:tea:${index}`, 0.15, 0.018, [x, 0.29, 0.06], tea, { segments: 20 });
    });
}

function addTeaSteam(builder, root, ctx) {
    const steam = addGroup(root, 'home:tea-steam', [ctx.boardTotal * 0.74, ctx.supportTopY + 0.78, ctx.boardTotal * 0.44]);
    const steamMaterial = material(builder, 'home:steam-material', {
        color: 0xffe4c7,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
    }, 'basic');
    for (let index = 0; index < 4; index += 1) {
        const puff = addSphere(builder, steam, `home:steam:${index}`, 0.12 + index * 0.035, [
            (index - 1.5) * 0.07,
            index * 0.22,
            (index % 2 === 0 ? -0.04 : 0.04),
        ], steamMaterial, {
            receiveShadow: false,
            scale: [0.7, 1.35, 0.7],
        });
        puff.userData.baseX = puff.position.x;
        puff.userData.baseY = puff.position.y;
    }
    return steam;
}
