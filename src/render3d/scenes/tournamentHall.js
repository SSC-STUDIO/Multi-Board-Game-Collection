import * as THREE from 'three';
import {
    addBox,
    addChair,
    addCylinder,
    addGroup,
    addPlane,
    addSphere,
    addTable,
    material,
} from './props.js';

export function buildTournamentHall(builder, ctx) {
    const root = builder.group;
    const stageHeight = 0.46;
    const stageTopY = ctx.floorY + stageHeight;
    const stageWidth = ctx.boardTotal * 3.16;
    const stageDepth = ctx.boardTotal * 2.28;
    const floor = material(builder, 'hall:floor-material', {
        color: 0x1e2630,
        roughness: 0.92,
        metalness: 0.03,
        side: THREE.DoubleSide,
    });
    const stage = material(builder, 'hall:stage-material', {
        color: 0x303947,
        roughness: 0.86,
        metalness: 0.08,
    });
    const trim = material(builder, 'hall:trim-material', {
        color: 0xa18455,
        roughness: 0.56,
        metalness: 0.18,
    });
    const carpet = material(builder, 'hall:carpet-material', {
        color: 0x1f3146,
        roughness: 0.88,
        metalness: 0.02,
    });
    const wall = material(builder, 'hall:side-wall-material', {
        color: 0x1b2530,
        roughness: 0.88,
        metalness: 0.04,
        side: THREE.DoubleSide,
    });

    addPlane(builder, root, 'hall:floor', [ctx.boardTotal * 6.45, ctx.boardTotal * 5.35], [0, ctx.floorY, 0.48], floor, {
        rotation: [-Math.PI / 2, 0, 0],
        receiveShadow: true,
    });
    addPlane(builder, root, 'hall:left-wall', [ctx.boardTotal * 4.6, 8.8], [-ctx.boardTotal * 2.55, ctx.floorY + 3.78, -0.48], wall, {
        rotation: [0, Math.PI / 2, 0],
        receiveShadow: true,
    });
    addPlane(builder, root, 'hall:right-wall', [ctx.boardTotal * 4.6, 8.8], [ctx.boardTotal * 2.55, ctx.floorY + 3.78, -0.48], wall, {
        rotation: [0, -Math.PI / 2, 0],
        receiveShadow: true,
    });
    addBox(builder, root, 'hall:stage', [stageWidth, stageHeight, stageDepth], [0, ctx.floorY + stageHeight / 2, 0], stage, {
        castShadow: true,
        receiveShadow: true,
    });
    addBox(builder, root, 'hall:stage-carpet', [ctx.boardTotal * 2.42, 0.035, ctx.boardTotal * 1.66], [0, stageTopY + 0.026, 0], carpet, {
        receiveShadow: true,
    });
    addBox(builder, root, 'hall:front-trim', [stageWidth * 1.01, 0.14, 0.18], [0, stageTopY + 0.08, stageDepth / 2], trim, {
        castShadow: true,
    });
    addBox(builder, root, 'hall:rear-trim', [stageWidth * 0.94, 0.1, 0.16], [0, stageTopY + 0.06, -stageDepth / 2], trim, {
        castShadow: true,
    });
    [-1, 1].forEach((direction) => {
        addBox(builder, root, `hall:side-trim:${direction}`, [0.16, 0.12, stageDepth * 0.92], [direction * stageWidth / 2, stageTopY + 0.07, 0], trim, {
            castShadow: true,
        });
    });

    addCompetitionTable(builder, root, ctx, stageTopY);
    addPlayerArea(builder, root, ctx, stageTopY);
    addJudgeDesk(builder, root, ctx, stageTopY);
    addBackdrop(builder, root, ctx);
    addAudience(builder, root, ctx);
    addCameraRigs(builder, root, ctx);
    addBarriers(builder, root, ctx);
    addStageSteps(builder, root, ctx, stageTopY, stageDepth, trim);
    addBroadcastDetails(builder, root, ctx, stageTopY);
    addLightRig(builder, root, ctx);
}

function addCompetitionTable(builder, root, ctx, stageTopY) {
    addTable(builder, root, 'hall:match', ctx, {
        width: ctx.boardTotal * 2.06,
        depth: ctx.boardTotal * 1.36,
        topThickness: 0.42,
        height: 2.76,
        floorY: stageTopY,
        color: 0x6a4a32,
        legColor: 0x2e2530,
        roughness: 0.58,
        apronHeight: 0.3,
    });
    const cloth = material(builder, 'hall:table-cloth-material', {
        color: 0x243648,
        roughness: 0.78,
        metalness: 0.02,
    });
    const tableEdge = material(builder, 'hall:table-edge-material', {
        color: 0x141c25,
        roughness: 0.58,
        metalness: 0.14,
    });
    addBox(builder, root, 'hall:table-cloth', [ctx.boardTotal * 1.9, 0.035, ctx.boardTotal * 1.14], [0, ctx.supportTopY + 0.028, 0], cloth, {
        receiveShadow: true,
    });
    addBox(builder, root, 'hall:table-front-edge', [ctx.boardTotal * 2.0, 0.11, 0.18], [0, ctx.supportTopY + 0.08, ctx.boardTotal * 0.72], tableEdge, {
        castShadow: true,
    });
    addBox(builder, root, 'hall:table-back-edge', [ctx.boardTotal * 2.0, 0.11, 0.18], [0, ctx.supportTopY + 0.08, -ctx.boardTotal * 0.72], tableEdge, {
        castShadow: true,
    });
    addBox(builder, root, 'hall:table-left-edge', [0.18, 0.11, ctx.boardTotal * 1.28], [-ctx.boardTotal * 1.04, ctx.supportTopY + 0.08, 0], tableEdge, {
        castShadow: true,
    });
    addBox(builder, root, 'hall:table-right-edge', [0.18, 0.11, ctx.boardTotal * 1.28], [ctx.boardTotal * 1.04, ctx.supportTopY + 0.08, 0], tableEdge, {
        castShadow: true,
    });

    const clockMaterial = material(builder, 'hall:clock-material', {
        color: 0x1e252d,
        roughness: 0.5,
        metalness: 0.12,
        emissive: 0x111a22,
        emissiveIntensity: 0.1,
    });
    const displayMaterial = material(builder, 'hall:clock-display-material', {
        color: 0x9ed4ff,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
    }, 'basic');
    addBox(builder, root, 'hall:clock-body', [1.54, 0.52, 0.42], [ctx.boardTotal * 0.73, ctx.supportTopY + 0.29, -ctx.boardTotal * 0.53], clockMaterial, {
        castShadow: true,
    });
    addPlane(builder, root, 'hall:clock-display-left', [0.58, 0.2], [ctx.boardTotal * 0.7, ctx.supportTopY + 0.32, -ctx.boardTotal * 0.746], displayMaterial, {});
    addPlane(builder, root, 'hall:clock-display-right', [0.58, 0.2], [ctx.boardTotal * 0.77, ctx.supportTopY + 0.32, -ctx.boardTotal * 0.746], displayMaterial, {});

    const nameplate = material(builder, 'hall:nameplate-material', {
        color: 0xd7c08b,
        roughness: 0.52,
        metalness: 0.12,
    });
    addBox(builder, root, 'hall:black-nameplate', [2.15, 0.08, 0.16], [-ctx.boardTotal * 0.36, ctx.supportTopY + 0.08, ctx.boardTotal * 0.73], nameplate, {
        castShadow: true,
    });
    addBox(builder, root, 'hall:white-nameplate', [2.15, 0.08, 0.16], [ctx.boardTotal * 0.36, ctx.supportTopY + 0.08, -ctx.boardTotal * 0.73], nameplate, {
        castShadow: true,
    });
    addTableAccessories(builder, root, ctx);
}

function addTableAccessories(builder, root, ctx) {
    const black = material(builder, 'hall:black-bowl-material', {
        color: 0x171719,
        roughness: 0.36,
        metalness: 0.1,
    });
    const white = material(builder, 'hall:white-bowl-material', {
        color: 0xded8c9,
        roughness: 0.44,
        metalness: 0.04,
    });
    const paper = material(builder, 'hall:score-paper-material', {
        color: 0xd4c7af,
        roughness: 0.74,
        metalness: 0.0,
    });
    const pencil = material(builder, 'hall:pencil-material', {
        color: 0xe1b35d,
        roughness: 0.48,
        metalness: 0.02,
    });
    const mic = material(builder, 'hall:mic-material', {
        color: 0x161b22,
        roughness: 0.52,
        metalness: 0.18,
    });
    addCylinder(builder, root, 'hall:black-bowl', [0.72, 0.9], 0.42, [-ctx.boardTotal * 0.78, ctx.supportTopY + 0.24, ctx.boardTotal * 0.46], black, {
        segments: 28,
        castShadow: true,
    });
    addCylinder(builder, root, 'hall:white-bowl', [0.72, 0.9], 0.42, [-ctx.boardTotal * 0.78, ctx.supportTopY + 0.24, -ctx.boardTotal * 0.46], white, {
        segments: 28,
        castShadow: true,
    });
    addBox(builder, root, 'hall:black-score-sheet', [1.72, 0.03, 1.04], [ctx.boardTotal * 0.58, ctx.supportTopY + 0.056, ctx.boardTotal * 0.46], paper, {
        rotation: [0, -0.08, 0],
    });
    addBox(builder, root, 'hall:white-score-sheet', [1.72, 0.03, 1.04], [ctx.boardTotal * 0.58, ctx.supportTopY + 0.056, -ctx.boardTotal * 0.34], paper, {
        rotation: [0, 0.1, 0],
    });
    addCylinder(builder, root, 'hall:score-pencil', 0.035, 1.22, [ctx.boardTotal * 0.68, ctx.supportTopY + 0.11, ctx.boardTotal * 0.32], pencil, {
        segments: 8,
        castShadow: true,
        rotation: [0, 0, Math.PI / 2.1],
    });
    [-1, 1].forEach((direction) => {
        addCylinder(builder, root, `hall:table-mic:${direction}`, 0.035, 1.15, [direction * ctx.boardTotal * 0.38, ctx.supportTopY + 0.12, ctx.boardTotal * 0.68], mic, {
            segments: 10,
            castShadow: true,
            rotation: [Math.PI / 2, 0, direction * 0.2],
        });
        addSphere(builder, root, `hall:mic-head:${direction}`, 0.12, [direction * ctx.boardTotal * 0.42, ctx.supportTopY + 0.16, ctx.boardTotal * 0.63], mic, {
            castShadow: true,
        });
    });
}

function addPlayerArea(builder, root, ctx, stageTopY) {
    addChair(builder, root, 'hall:black-player', [0, stageTopY, ctx.boardTotal * 1.13], Math.PI, { color: 0x3d4855, scale: 2.18 });
    addChair(builder, root, 'hall:white-player', [0, stageTopY, -ctx.boardTotal * 1.13], 0, { color: 0x44505d, scale: 2.18 });
    addSeatedPlayer(builder, root, 'hall:black-player-figure', [0, stageTopY, ctx.boardTotal * 1.05], Math.PI, 1.72, 0x2f3d4b);
    addSeatedPlayer(builder, root, 'hall:white-player-figure', [0, stageTopY, -ctx.boardTotal * 1.05], 0, 1.72, 0x3e4651);
    addBox(builder, root, 'hall:black-foot-mat', [4.7, 0.025, 2.1], [0, stageTopY + 0.035, ctx.boardTotal * 1.38], material(builder, 'hall:foot-mat-material', {
        color: 0x202936,
        roughness: 0.86,
        metalness: 0.02,
    }), {});
    addBox(builder, root, 'hall:white-foot-mat', [4.7, 0.025, 2.1], [0, stageTopY + 0.036, -ctx.boardTotal * 1.38], material(builder, 'hall:foot-mat-material', {
        color: 0x202936,
        roughness: 0.86,
        metalness: 0.02,
    }), {});
}

function addSeatedPlayer(builder, root, key, position, rotationY, scale, jacketColor) {
    const group = addGroup(root, key, position, [0, rotationY, 0]);
    group.scale.setScalar(scale);
    const jacket = material(builder, `${key}:jacket-material`, {
        color: jacketColor,
        roughness: 0.84,
        metalness: 0.02,
    });
    const skin = material(builder, 'hall:player-skin-material', {
        color: 0xc79e84,
        roughness: 0.78,
        metalness: 0.0,
    });
    const hair = material(builder, 'hall:player-hair-material', {
        color: 0x211a18,
        roughness: 0.86,
        metalness: 0.0,
    });
    addCylinder(builder, group, `${key}:torso`, [0.36, 0.48], 1.18, [0, 2.0, 0], jacket, {
        segments: 12,
        castShadow: true,
    });
    addSphere(builder, group, `${key}:head`, 0.32, [0, 2.82, 0.02], skin, {
        castShadow: true,
        scale: [0.92, 1.08, 0.9],
    });
    addSphere(builder, group, `${key}:hair`, 0.34, [0, 3.02, -0.02], hair, {
        castShadow: true,
        scale: [0.96, 0.48, 0.94],
    });
    [-1, 1].forEach((side) => {
        addBox(builder, group, `${key}:forearm:${side}`, [0.16, 0.16, 1.04], [side * 0.38, 1.82, -0.52], skin, {
            castShadow: true,
            rotation: [0.2, side * 0.04, side * 0.12],
        });
    });
}

function addJudgeDesk(builder, root, ctx, stageTopY) {
    const desk = material(builder, 'hall:judge-desk-material', {
        color: 0x344050,
        roughness: 0.78,
        metalness: 0.07,
    });
    const judgeZ = -ctx.boardTotal * 1.62;
    addBox(builder, root, 'hall:judge-desk', [ctx.boardTotal * 1.16, 0.68, 1.02], [0, stageTopY + 0.34, judgeZ], desk, {
        castShadow: true,
        receiveShadow: true,
    });
    addChair(builder, root, 'hall:judge-chair', [-ctx.boardTotal * 0.64, stageTopY, judgeZ - 0.82], 0.2, { color: 0x4c5664, scale: 1.86 });
    addJudgeDetails(builder, root, ctx, stageTopY, judgeZ);
}

function addJudgeDetails(builder, root, ctx, stageTopY, judgeZ) {
    const screen = material(builder, 'hall:judge-monitor-material', {
        color: 0x172536,
        roughness: 0.48,
        metalness: 0.16,
        emissive: 0x0a1d2e,
        emissiveIntensity: 0.22,
    });
    const glow = material(builder, 'hall:judge-monitor-glow', {
        color: 0x83c7ff,
        transparent: true,
        opacity: 0.38,
        depthWrite: false,
    }, 'basic');
    const paper = material(builder, 'hall:judge-paper-material', {
        color: 0xd7ceb8,
        roughness: 0.74,
        metalness: 0.0,
    });
    addBox(builder, root, 'hall:judge-monitor', [1.45, 0.84, 0.12], [ctx.boardTotal * 0.28, stageTopY + 0.93, judgeZ + 0.06], screen, {
        castShadow: true,
        rotation: [-0.12, 0, 0],
    });
    addPlane(builder, root, 'hall:judge-monitor-screen', [1.12, 0.54], [ctx.boardTotal * 0.28, stageTopY + 0.95, judgeZ + 0.132], glow, {
        rotation: [-0.12, 0, 0],
    });
    addBox(builder, root, 'hall:judge-paper-a', [1.42, 0.03, 0.82], [-ctx.boardTotal * 0.2, stageTopY + 0.7, judgeZ + 0.28], paper, {
        rotation: [0, 0.16, 0],
    });
    addSeatedPlayer(builder, root, 'hall:judge-figure', [-ctx.boardTotal * 0.64, stageTopY, judgeZ - 0.68], 0.16, 1.42, 0x394858);
}

function addBackdrop(builder, root, ctx) {
    const wall = material(builder, 'hall:back-wall-material', {
        color: 0x263140,
        roughness: 0.82,
        metalness: 0.08,
        side: THREE.DoubleSide,
    });
    const screen = material(builder, 'hall:screen-material', {
        color: 0x405168,
        roughness: 0.58,
        metalness: 0.08,
        emissive: 0x17283a,
        emissiveIntensity: 0.2,
        side: THREE.DoubleSide,
    });
    const glow = material(builder, 'hall:screen-glow-material', {
        color: 0x8ec4ff,
        transparent: true,
        opacity: 0.15,
        depthWrite: false,
        side: THREE.DoubleSide,
    }, 'basic');
    const backZ = -ctx.boardTotal * 2.8;
    const wallCenterY = ctx.floorY + 4.45;
    addPlane(builder, root, 'hall:back-wall', [ctx.boardTotal * 5.15, 9.2], [0, wallCenterY, backZ], wall, {});
    addBox(builder, root, 'hall:main-screen-frame', [ctx.boardTotal * 1.44, 3.08, 0.16], [0, ctx.floorY + 4.45, backZ + 0.02], material(builder, 'hall:screen-frame-material', {
        color: 0x141b24,
        roughness: 0.58,
        metalness: 0.2,
    }), {
        castShadow: true,
    });
    addPlane(builder, root, 'hall:main-screen', [ctx.boardTotal * 1.22, 2.58], [0, ctx.floorY + 4.45, backZ + 0.11], screen, {});
    addPlane(builder, root, 'hall:screen-glow', [ctx.boardTotal * 1.34, 2.95], [0, ctx.floorY + 4.45, backZ + 0.12], glow, {});
    addScreenGraphics(builder, root, ctx, backZ);
    [-1, 1].forEach((direction) => {
        addPlane(builder, root, `hall:side-score:${direction}`, [3.4, 1.34], [direction * ctx.boardTotal * 1.58, ctx.floorY + 3.7, backZ + 0.12], screen, {
            rotation: [0, -direction * 0.1, 0],
        });
        addBox(builder, root, `hall:side-score-frame:${direction}`, [3.64, 1.52, 0.08], [direction * ctx.boardTotal * 1.58, ctx.floorY + 3.7, backZ + 0.08], material(builder, 'hall:screen-frame-material', {
            color: 0x141b24,
            roughness: 0.58,
            metalness: 0.2,
        }), {
            rotation: [0, -direction * 0.1, 0],
            castShadow: true,
        });
    });
}

function addScreenGraphics(builder, root, ctx, backZ) {
    const line = material(builder, 'hall:screen-line-material', {
        color: 0x9ed4ff,
        transparent: true,
        opacity: 0.54,
        depthWrite: false,
    }, 'basic');
    const accent = material(builder, 'hall:screen-accent-material', {
        color: 0xf0c97b,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
    }, 'basic');
    const centerY = ctx.floorY + 4.45;
    const screenZ = backZ + 0.145;
    addBox(builder, root, 'hall:screen-title-bar', [ctx.boardTotal * 1.02, 0.12, 0.035], [0, centerY + 1.05, screenZ], accent, {});
    addBox(builder, root, 'hall:screen-board-outline', [2.26, 0.045, 0.035], [0, centerY + 0.16, screenZ], line, {});
    addBox(builder, root, 'hall:screen-board-outline-v', [0.045, 1.66, 0.035], [-1.12, centerY + 0.16, screenZ], line, {});
    addBox(builder, root, 'hall:screen-board-outline-v2', [0.045, 1.66, 0.035], [1.12, centerY + 0.16, screenZ], line, {});
    addBox(builder, root, 'hall:screen-board-outline-b', [2.26, 0.045, 0.035], [0, centerY - 0.67, screenZ], line, {});
    for (let index = -3; index <= 3; index += 1) {
        addBox(builder, root, `hall:screen-grid-x:${index}`, [0.025, 1.42, 0.03], [index * 0.3, centerY - 0.25, screenZ + 0.01], line, {});
        addBox(builder, root, `hall:screen-grid-y:${index}`, [1.9, 0.025, 0.03], [0, centerY - 0.25 + index * 0.2, screenZ + 0.012], line, {});
    }
    addSphere(builder, root, 'hall:screen-black-stone', 0.1, [-0.28, centerY - 0.16, screenZ + 0.04], accent, {
        scale: [1, 1, 0.18],
    });
    addSphere(builder, root, 'hall:screen-white-stone', 0.1, [0.33, centerY - 0.36, screenZ + 0.04], line, {
        scale: [1, 1, 0.18],
    });
}

function addAudience(builder, root, ctx) {
    const tier = material(builder, 'hall:audience-tier-material', {
        color: 0x303846,
        roughness: 0.86,
        metalness: 0.05,
    });
    const bodyColors = [0x566577, 0x6a574b, 0x4c5d50, 0x6d6757];
    for (let row = 0; row < 3; row += 1) {
        const width = ctx.boardTotal * (3.18 - row * 0.24);
        const z = -ctx.boardTotal * (2.16 + row * 0.27);
        const y = ctx.floorY + 0.3 + row * 0.44;
        addBox(builder, root, `hall:tier:${row}`, [width, 0.32, 1.08], [0, y, z], tier, {
            receiveShadow: true,
        });
        for (let index = 0; index < 12 - row * 2; index += 1) {
            const x = -width * 0.42 + index * (width * 0.84 / (11 - row * 2));
            addAudienceSeat(builder, root, `hall:seat:${row}:${index}`, [x, y + 0.26, z + 0.12], 0.98 - row * 0.02);
            addAudienceFigure(builder, root, `hall:audience:${row}:${index}`, [x, y + 0.28, z - 0.08], 1.45 - row * 0.08, bodyColors[(index + row) % bodyColors.length]);
        }
    }
}

function addAudienceSeat(builder, root, key, position, scale) {
    const group = addGroup(root, key, position);
    group.scale.setScalar(scale);
    const seat = material(builder, 'hall:audience-seat-material', {
        color: 0x263244,
        roughness: 0.72,
        metalness: 0.04,
    });
    addBox(builder, group, `${key}:seat`, [0.92, 0.18, 0.58], [0, 0.12, 0], seat, {});
    addBox(builder, group, `${key}:back`, [0.92, 0.72, 0.14], [0, 0.5, -0.28], seat, {});
}

function addAudienceFigure(builder, root, key, position, scale, color) {
    const group = addGroup(root, key, position, [0, Math.PI, 0]);
    group.scale.setScalar(scale);
    const body = material(builder, `${key}:body-material`, {
        color,
        roughness: 0.9,
        metalness: 0.02,
    });
    const head = material(builder, 'hall:audience-head-material', {
        color: 0xc6a48d,
        roughness: 0.78,
        metalness: 0.01,
    });
    addCylinder(builder, group, `${key}:body`, [0.14, 0.18], 0.5, [0, 0.25, 0], body, {
        segments: 10,
    });
    addSphere(builder, group, `${key}:head`, 0.12, [0, 0.58, 0], head, {});
}

function addCameraRigs(builder, root, ctx) {
    const metal = material(builder, 'hall:camera-metal-material', {
        color: 0x202834,
        roughness: 0.48,
        metalness: 0.22,
    });
    [-1, 1].forEach((direction) => {
        const rig = addGroup(root, `hall:camera:${direction}`, [direction * ctx.boardTotal * 1.58, ctx.floorY + 0.02, ctx.boardTotal * 0.78], [0, direction * -0.72, 0]);
        rig.scale.setScalar(1.36);
        addCylinder(builder, rig, `hall:tripod-post:${direction}`, 0.045, 2.2, [0, 1.1, 0], metal, { segments: 8, castShadow: true });
        addBox(builder, rig, `hall:camera-body:${direction}`, [0.64, 0.36, 0.46], [0, 2.38, 0], metal, { castShadow: true });
        addCylinder(builder, rig, `hall:camera-lens:${direction}`, [0.16, 0.22], 0.32, [0, 2.38, -0.36], metal, {
            segments: 14,
            castShadow: true,
            rotation: [Math.PI / 2, 0, 0],
        });
        [-0.46, 0, 0.46].forEach((x, index) => {
            addBox(builder, rig, `hall:tripod-leg:${direction}:${index}`, [0.045, 1.32, 0.045], [x, 0.66, index === 1 ? -0.42 : 0.28], metal, {
                castShadow: true,
                rotation: [index === 1 ? -0.32 : 0.24, 0, x * 0.18],
            });
        });
        addSeatedPlayer(builder, root, `hall:camera-operator:${direction}`, [direction * ctx.boardTotal * 1.82, ctx.floorY, ctx.boardTotal * 0.88], direction * -0.72, 1.32, 0x222c38);
    });
}

function addBarriers(builder, root, ctx) {
    const rail = material(builder, 'hall:barrier-material', {
        color: 0x5b6672,
        roughness: 0.62,
        metalness: 0.18,
    });
    [-1, 1].forEach((direction) => {
        addBox(builder, root, `hall:side-barrier:${direction}`, [0.08, 0.72, ctx.boardTotal * 1.92], [direction * ctx.boardTotal * 1.62, ctx.floorY + 0.72, ctx.boardTotal * 0.22], rail, {
            castShadow: true,
        });
        [-0.72, 0.0, 0.72].forEach((offset, index) => {
            addCylinder(builder, root, `hall:side-stanchion:${direction}:${index}`, 0.09, 1.08, [direction * ctx.boardTotal * 1.62, ctx.floorY + 0.54, offset * ctx.boardTotal], rail, {
                segments: 12,
                castShadow: true,
            });
        });
    });
    addBox(builder, root, 'hall:front-barrier', [ctx.boardTotal * 2.96, 0.72, 0.08], [0, ctx.floorY + 0.72, ctx.boardTotal * 1.66], rail, {
        castShadow: true,
    });
}

function addStageSteps(builder, root, ctx, stageTopY, stageDepth, trim) {
    const step = material(builder, 'hall:stage-step-material', {
        color: 0x283240,
        roughness: 0.82,
        metalness: 0.06,
    });
    const frontZ = stageDepth / 2 + 0.38;
    addBox(builder, root, 'hall:front-step-low', [ctx.boardTotal * 0.92, 0.2, 0.7], [0, ctx.floorY + 0.1, frontZ + 0.34], step, {
        receiveShadow: true,
    });
    addBox(builder, root, 'hall:front-step-high', [ctx.boardTotal * 1.08, 0.22, 0.62], [0, ctx.floorY + 0.31, frontZ - 0.04], step, {
        receiveShadow: true,
    });
    addBox(builder, root, 'hall:step-front-gold', [ctx.boardTotal * 1.12, 0.08, 0.1], [0, ctx.floorY + 0.45, frontZ + 0.28], trim, {
        castShadow: true,
    });
}

function addBroadcastDetails(builder, root, ctx, stageTopY) {
    const tape = material(builder, 'hall:floor-tape-material', {
        color: 0xcaa46a,
        roughness: 0.62,
        metalness: 0.02,
    });
    const cable = material(builder, 'hall:cable-material', {
        color: 0x11161c,
        roughness: 0.72,
        metalness: 0.08,
    });
    [-1, 1].forEach((direction) => {
        addBox(builder, root, `hall:camera-mark:${direction}`, [1.2, 0.02, 0.08], [direction * ctx.boardTotal * 1.58, stageTopY + 0.05, ctx.boardTotal * 0.86], tape, {});
        addBox(builder, root, `hall:camera-mark-cross:${direction}`, [0.08, 0.02, 1.2], [direction * ctx.boardTotal * 1.58, stageTopY + 0.052, ctx.boardTotal * 0.86], tape, {});
        addBox(builder, root, `hall:cable-run:${direction}`, [0.08, 0.035, ctx.boardTotal * 1.48], [direction * ctx.boardTotal * 1.72, stageTopY + 0.045, ctx.boardTotal * 0.12], cable, {
            rotation: [0, direction * 0.08, 0],
        });
    });
    addBox(builder, root, 'hall:center-axis-mark', [0.08, 0.02, ctx.boardTotal * 1.9], [0, stageTopY + 0.05, 0], tape, {});
}

function addLightRig(builder, root, ctx) {
    const truss = material(builder, 'hall:truss-material', {
        color: 0x253141,
        roughness: 0.68,
        metalness: 0.18,
    });
    const lamp = material(builder, 'hall:lamp-material', {
        color: 0xd9c6a8,
        roughness: 0.46,
        metalness: 0.18,
        emissive: 0x4a3820,
        emissiveIntensity: 0.12,
    });
    const beam = material(builder, 'hall:spot-beam-material', {
        color: 0xf6e7c3,
        transparent: true,
        opacity: 0.09,
        depthWrite: false,
        side: THREE.DoubleSide,
    }, 'basic');
    const z = -ctx.boardTotal * 1.88;
    const towerHeight = 7.6;
    const trussY = ctx.floorY + towerHeight;
    [-1, 1].forEach((direction) => {
        addBox(builder, root, `hall:truss-tower:${direction}`, [0.34, towerHeight, 0.34], [direction * ctx.boardTotal * 1.82, ctx.floorY + towerHeight / 2, z], truss, {
            castShadow: true,
        });
    });
    addBox(builder, root, 'hall:truss-top', [ctx.boardTotal * 3.72, 0.28, 0.34], [0, trussY, z], truss, {
        castShadow: true,
    });
    [-1.4, -0.72, 0, 0.72, 1.4].forEach((x, index) => {
        addBox(builder, root, `hall:truss-cross:${index}`, [0.18, 0.18, 1.08], [x * ctx.boardTotal, trussY - 0.02, z], truss, {
            castShadow: true,
        });
    });
    [-1.2, -0.4, 0.4, 1.2].forEach((x, index) => {
        addCylinder(builder, root, `hall:lamp:${index}`, [0.24, 0.34], 0.48, [x * ctx.boardTotal, trussY - 0.38, z + 0.28], lamp, {
            segments: 18,
            castShadow: true,
            rotation: [Math.PI / 2.8, 0, 0],
        });
        addCylinder(builder, root, `hall:spot-beam:${index}`, [0.18, 1.15], 5.7, [x * ctx.boardTotal * 0.72, trussY - 3.28, z + ctx.boardTotal * 0.78], beam, {
            segments: 28,
            receiveShadow: false,
        });
    });
}
