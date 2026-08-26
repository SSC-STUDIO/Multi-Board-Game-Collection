import { getSceneSpec } from '../../config/sceneConfig.js';
import { addBox, addCylinder, addPlane, addTable, material } from './props.js';

const FALLBACK_MOOD = {
    floor: 0x1a1c22,
    table: 0x4a3a28,
    legs: 0x2c241c,
    backdrop: 0x2a3040,
    lamp: 0xcfc6b8
};

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
        metalness: 0.0
    });
    const lampMat = material(builder, 'tabletop-lamp', {
        color: mood.lamp,
        roughness: 0.42,
        metalness: 0.18
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
        castShadow: true
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
