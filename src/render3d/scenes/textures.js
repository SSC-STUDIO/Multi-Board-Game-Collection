import * as THREE from 'three';

/**
 * 程序化贴图库：全部用 CanvasTexture 现场绘制，零外部资源。
 *
 * 灰度/近白底的贴图与材质 color 相乘，因此同一张贴图可以被不同氛围染成
 * 不同颜色（木纹既能做暖木桌也能做深色地板）。
 * 贴图缓存在 builder.sharedTextures，并登记到 builder.track 随场景一起释放。
 */

/** 固定种子的随机数，保证每次重建场景的纹理长相一致，切换氛围时不会"跳纹"。 */
function seededRandom(seed) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function cachedTexture(builder, key, width, height, draw, configure = null) {
    const cached = builder.sharedTextures.get(key);
    if (cached) {
        return cached;
    }
    if (typeof document === 'undefined') {
        return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    draw(canvas.getContext('2d'), width, height);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    if (configure) {
        configure(texture);
    }

    builder.sharedTextures.set(key, texture);
    builder.track(texture);
    return texture;
}

function tileWrap(repeatX, repeatY) {
    return (texture) => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(repeatX, repeatY);
    };
}

/** 竖向木纹：细纹 + 宽年轮带 + 导管孔 + 两处木节。 */
export function getWoodGrainTexture(builder) {
    return cachedTexture(builder, 'tex:wood-grain', 256, 256, (ctx) => {
        const rand = seededRandom(20260831);
        ctx.fillStyle = '#ece4d2';
        ctx.fillRect(0, 0, 256, 256);

        for (let i = 0; i < 200; i += 1) {
            const x = rand() * 256;
            ctx.strokeStyle = `rgba(122, 92, 54, ${(0.04 + rand() * 0.15).toFixed(3)})`;
            ctx.lineWidth = 0.6 + rand() * 2.6;
            const sway = Math.sin(i * 0.73) * 7 + (rand() - 0.5) * 9;
            ctx.beginPath();
            ctx.moveTo(x, -6);
            ctx.bezierCurveTo(x + sway, 64, x - sway * 0.55, 196, x + (rand() - 0.5) * 6, 262);
            ctx.stroke();
        }

        for (let i = 0; i < 12; i += 1) {
            const x = rand() * 256;
            ctx.strokeStyle = `rgba(96, 70, 40, ${(0.05 + rand() * 0.06).toFixed(3)})`;
            ctx.lineWidth = 5 + rand() * 10;
            ctx.beginPath();
            ctx.moveTo(x, -6);
            ctx.lineTo(x + (rand() - 0.5) * 14, 262);
            ctx.stroke();
        }

        // 导管孔：细密的短竖痕，近看才有的木材质感
        for (let i = 0; i < 520; i += 1) {
            ctx.fillStyle = `rgba(86, 62, 34, ${(0.05 + rand() * 0.1).toFixed(3)})`;
            ctx.fillRect(rand() * 256, rand() * 256, 0.8 + rand() * 0.9, 1.6 + rand() * 3.4);
        }

        [[64, 96], [190, 202]].forEach(([cx, cy]) => {
            for (let ring = 5; ring >= 1; ring -= 1) {
                ctx.strokeStyle = `rgba(104, 74, 40, ${(0.05 + ring * 0.012).toFixed(3)})`;
                ctx.lineWidth = 1.4;
                ctx.beginPath();
                ctx.ellipse(cx, cy, ring * 2.4, ring * 4.2, 0.2, 0, Math.PI * 2);
                ctx.stroke();
            }
        });
    }, tileWrap(2.8, 1.6));
}

/** 背板/墙面的竖向亮度渐变：顶部受光、底部沉入暗部。 */
export function getBackdropGradientTexture(builder) {
    return cachedTexture(builder, 'tex:backdrop-gradient', 8, 128, (ctx) => {
        const gradient = ctx.createLinearGradient(0, 0, 0, 128);
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.55, '#cfcfcf');
        gradient.addColorStop(1, '#8f8f8f');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 8, 128);
    }, (texture) => {
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
    });
}

/** 布料平织：经纬交叠的明暗格 + 绒面噪点，用于座椅、横幅、桌布。 */
export function getFabricWeaveTexture(builder) {
    return cachedTexture(builder, 'tex:fabric-weave', 128, 128, (ctx) => {
        const rand = seededRandom(778101);
        ctx.fillStyle = '#efe9df';
        ctx.fillRect(0, 0, 128, 128);

        const cell = 4;
        for (let y = 0; y < 128; y += cell) {
            for (let x = 0; x < 128; x += cell) {
                const over = ((x / cell) + (y / cell)) % 2 === 0;
                ctx.fillStyle = over ? 'rgba(255, 255, 255, 0.24)' : 'rgba(78, 68, 56, 0.16)';
                ctx.fillRect(x, y, cell, cell);
            }
        }

        ctx.strokeStyle = 'rgba(70, 60, 48, 0.1)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 128; i += cell) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, 128);
            ctx.moveTo(0, i);
            ctx.lineTo(128, i);
            ctx.stroke();
        }

        for (let i = 0; i < 900; i += 1) {
            const dark = rand() > 0.5;
            ctx.fillStyle = dark ? 'rgba(60, 52, 42, 0.1)' : 'rgba(255, 255, 255, 0.12)';
            ctx.fillRect(rand() * 128, rand() * 128, 1, 1);
        }
    }, tileWrap(6, 6));
}

/** 石材：麻点斑驳 + 淡色云斑 + 几道发丝裂纹，用于石板、灯笼、台座。 */
export function getStoneSpeckleTexture(builder) {
    return cachedTexture(builder, 'tex:stone-speckle', 256, 256, (ctx) => {
        const rand = seededRandom(31415926);
        ctx.fillStyle = '#dcd7cd';
        ctx.fillRect(0, 0, 256, 256);

        for (let i = 0; i < 26; i += 1) {
            const radius = 18 + rand() * 46;
            ctx.fillStyle = rand() > 0.5
                ? `rgba(255, 255, 255, ${(0.03 + rand() * 0.05).toFixed(3)})`
                : `rgba(120, 116, 108, ${(0.03 + rand() * 0.05).toFixed(3)})`;
            ctx.beginPath();
            ctx.ellipse(rand() * 256, rand() * 256, radius, radius * (0.5 + rand() * 0.7), rand() * Math.PI, 0, Math.PI * 2);
            ctx.fill();
        }

        for (let i = 0; i < 2600; i += 1) {
            const tone = rand();
            ctx.fillStyle = tone > 0.62
                ? `rgba(255, 255, 255, ${(0.1 + rand() * 0.3).toFixed(3)})`
                : `rgba(${70 + Math.floor(rand() * 50)}, ${68 + Math.floor(rand() * 46)}, ${62 + Math.floor(rand() * 40)}, ${(0.1 + rand() * 0.35).toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(rand() * 256, rand() * 256, 0.4 + rand() * 1.5, 0, Math.PI * 2);
            ctx.fill();
        }

        for (let i = 0; i < 7; i += 1) {
            ctx.strokeStyle = `rgba(96, 92, 84, ${(0.1 + rand() * 0.12).toFixed(3)})`;
            ctx.lineWidth = 0.6 + rand() * 0.8;
            const x = rand() * 256;
            const y = rand() * 256;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.bezierCurveTo(x + 40 - rand() * 80, y + 30, x + 90 - rand() * 60, y + 70, x + 130 - rand() * 90, y + 120);
            ctx.stroke();
        }
    }, tileWrap(3, 3));
}

/** 地毯纹样：回纹边框 + 菱形格心 + 中央团花，整块铺一次（不平铺）。 */
export function getRugPatternTexture(builder) {
    return cachedTexture(builder, 'tex:rug-pattern', 256, 256, (ctx) => {
        const rand = seededRandom(60606);
        ctx.fillStyle = '#f0e8db';
        ctx.fillRect(0, 0, 256, 256);

        // 三层回纹边框
        [[10, 'rgba(74, 58, 44, 0.42)', 5], [22, 'rgba(74, 58, 44, 0.24)', 2], [30, 'rgba(74, 58, 44, 0.34)', 3]]
            .forEach(([inset, color, width]) => {
                ctx.strokeStyle = color;
                ctx.lineWidth = width;
                ctx.strokeRect(inset, inset, 256 - inset * 2, 256 - inset * 2);
            });

        // 菱形格心
        ctx.save();
        ctx.beginPath();
        ctx.rect(36, 36, 184, 184);
        ctx.clip();
        ctx.strokeStyle = 'rgba(74, 58, 44, 0.16)';
        ctx.lineWidth = 1.4;
        for (let i = -256; i < 512; i += 26) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i + 256, 256);
            ctx.moveTo(i, 256);
            ctx.lineTo(i + 256, 0);
            ctx.stroke();
        }
        ctx.restore();

        // 中央团花：套叠菱形 + 圆心
        ctx.translate(128, 128);
        ctx.rotate(Math.PI / 4);
        [58, 42, 26].forEach((size, index) => {
            ctx.strokeStyle = `rgba(74, 58, 44, ${index === 1 ? 0.2 : 0.34})`;
            ctx.lineWidth = index === 1 ? 2 : 3;
            ctx.strokeRect(-size, -size, size * 2, size * 2);
        });
        ctx.rotate(-Math.PI / 4);
        ctx.fillStyle = 'rgba(74, 58, 44, 0.28)';
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        // 绒面噪点，避免纹样过于印刷感
        for (let i = 0; i < 2200; i += 1) {
            ctx.fillStyle = rand() > 0.5 ? 'rgba(255, 255, 255, 0.1)' : 'rgba(66, 54, 42, 0.08)';
            ctx.fillRect(rand() * 256, rand() * 256, 1.4, 1.4);
        }
    }, (texture) => {
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
    });
}

/** 挂画画心：远山 + 落日 + 水纹的抽象水墨，替代纯色块。 */
export function getInkArtTexture(builder) {
    return cachedTexture(builder, 'tex:ink-art', 160, 224, (ctx, width, height) => {
        const sky = ctx.createLinearGradient(0, 0, 0, height);
        sky.addColorStop(0, '#fdf6e8');
        sky.addColorStop(0.52, '#e2e6ea');
        sky.addColorStop(1, '#cdd6dd');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = 'rgba(255, 236, 202, 0.85)';
        ctx.beginPath();
        ctx.arc(width * 0.66, height * 0.26, 16, 0, Math.PI * 2);
        ctx.fill();

        const ridges = [
            { base: 0.68, peak: 0.42, alpha: 0.18 },
            { base: 0.74, peak: 0.52, alpha: 0.3 },
            { base: 0.82, peak: 0.6, alpha: 0.46 }
        ];
        ridges.forEach(({ base, peak, alpha }, index) => {
            ctx.fillStyle = `rgba(52, 62, 74, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(-4, height * base);
            ctx.quadraticCurveTo(width * (0.18 + index * 0.1), height * peak, width * (0.46 + index * 0.06), height * (base - 0.03));
            ctx.quadraticCurveTo(width * (0.74 - index * 0.08), height * (peak + 0.1), width + 4, height * (base + 0.02));
            ctx.lineTo(width + 4, height);
            ctx.lineTo(-4, height);
            ctx.closePath();
            ctx.fill();
        });

        ctx.strokeStyle = 'rgba(74, 86, 100, 0.34)';
        ctx.lineWidth = 1.2;
        for (let i = 0; i < 6; i += 1) {
            const y = height * (0.86 + i * 0.022);
            ctx.beginPath();
            ctx.moveTo(width * 0.1, y);
            ctx.quadraticCurveTo(width * 0.5, y - 3, width * 0.9, y);
            ctx.stroke();
        }

        ctx.strokeStyle = 'rgba(48, 56, 66, 0.5)';
        ctx.lineWidth = 1.4;
        [[0.24, 0.2], [0.34, 0.16]].forEach(([bx, by]) => {
            ctx.beginPath();
            ctx.moveTo(width * bx, height * by);
            ctx.lineTo(width * (bx + 0.04), height * (by - 0.018));
            ctx.lineTo(width * (bx + 0.08), height * by);
            ctx.stroke();
        });
    }, (texture) => {
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
    });
}

/** 叶片轮廓遮罩：让叶子平面不再是矩形（配合 alphaTest 使用）。 */
export function getLeafAlphaTexture(builder) {
    return cachedTexture(builder, 'tex:leaf-alpha', 64, 128, (ctx, width, height) => {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(width / 2, height - 2);
        ctx.quadraticCurveTo(width - 2, height * 0.62, width / 2, 4);
        ctx.quadraticCurveTo(2, height * 0.62, width / 2, height - 2);
        ctx.fill();
        // 中脉留出一丝透光，叶片看起来更薄
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(width / 2, height - 6);
        ctx.lineTo(width / 2, 8);
        ctx.stroke();
    }, (texture) => {
        texture.colorSpace = THREE.NoColorSpace;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
    });
}

/** 横向发光条：中心亮、两端收暗，让横幅/灯带看起来是被打亮的。 */
export function getGlowStripTexture(builder) {
    return cachedTexture(builder, 'tex:glow-strip', 128, 16, (ctx, width, height) => {
        const gradient = ctx.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, '#4a4a4a');
        gradient.addColorStop(0.5, '#ffffff');
        gradient.addColorStop(1, '#4a4a4a');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        const vertical = ctx.createLinearGradient(0, 0, 0, height);
        vertical.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
        vertical.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
        vertical.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
        ctx.fillStyle = vertical;
        ctx.fillRect(0, 0, width, height);
    }, (texture) => {
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
    });
}

/** 赛场记分牌：双方读秒与手数的发光面板。 */
export function getScoreboardTexture(builder) {
    return cachedTexture(builder, 'tex:scoreboard', 256, 128, (ctx, width, height) => {
        ctx.fillStyle = '#0d1118';
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = 'rgba(217, 178, 106, 0.9)';
        ctx.fillRect(0, 0, width, 5);
        ctx.fillRect(0, height - 5, width, 5);

        ctx.strokeStyle = 'rgba(217, 178, 106, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(width / 2, 16);
        ctx.lineTo(width / 2, height - 16);
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 20px monospace';
        ctx.fillStyle = 'rgba(226, 232, 240, 0.72)';
        ctx.fillText('BLACK', width * 0.25, 30);
        ctx.fillText('WHITE', width * 0.75, 30);

        ctx.font = 'bold 44px monospace';
        ctx.fillStyle = '#ffd79a';
        ctx.fillText('19:24', width * 0.25, 74);
        ctx.fillStyle = '#cfe6ff';
        ctx.fillText('21:08', width * 0.75, 74);

        ctx.font = '16px monospace';
        ctx.fillStyle = 'rgba(226, 232, 240, 0.5)';
        ctx.fillText('MOVE 138', width * 0.5, height - 20);
    }, (texture) => {
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
    });
}
