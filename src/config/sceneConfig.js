export const SCENE_SPECS = {
    home: {
        i18nKey: 'sceneHome',
        updateInterval: 1 / 22,
        ui: {
            previewImage: 'assets/scene-previews/home.jpg',
            setupTitleKey: 'sceneHomeMood',
            setupBlurbKey: 'sceneHomeBlurb',
            ambienceKey: 'sceneSoundHome'
        },
        ambience: {
            setup: 'home-setup',
            active: 'home-active',
            thinking: 'home-thinking',
            finished: 'home-finished'
        },
        camera: {
            setup: {
                azimuth: -30,
                elevation: 38,
                distanceScale: 1.62,
                targetOffset: { x: 0.42, y: 0.04, z: -1.1 },
                lift: 0.24,
                interaction: {
                    allowPan: false,
                    fullAzimuth: true,
                    minElevation: 18,
                    maxElevation: 48,
                    minAzimuthOffset: -8,
                    maxAzimuthOffset: 6,
                    minElevationOffset: -5,
                    maxElevationOffset: 7,
                    minDistanceScale: 0.92,
                    maxDistanceScale: 1.12,
                    rotateSpeed: 0.84,
                    zoomSpeed: 0.9
                }
            },
            game: {
                azimuth: 0,
                elevation: 88,
                distanceScale: 1.54,
                targetOffset: { x: 0, y: 0.02, z: 0 },
                lift: 0,
                interaction: {
                    allowPan: true,
                    fullAzimuth: true,
                    minElevation: 34,
                    maxElevation: 89.2,
                    minDistanceScale: 0.78,
                    maxDistanceScale: 1.42,
                    panSpeed: 0.24,
                    rotateSpeed: 0.82,
                    zoomSpeed: 0.86
                }
            },
            shift: {
                establishOffset: { x: -0.92, y: 1.18, z: 1.18 },
                focusOffset: { x: 0.42, y: 0.42, z: 0.48 },
                establishTarget: { x: -0.24, y: 0.14, z: 0.2 },
                targetOffset: { x: 0.16, y: 0.08, z: 0.04 },
                glideDuration: 0.28,
                settleDuration: 0.22,
                returnDuration: 0.34
            }
        },
        lighting: {
            fogColor: 0x1b1510,
            fogDensity: 0.013,
            exposure: 1.12,
            ambient: { color: 0xfff3e3, intensity: 0.58 },
            hemisphere: { skyColor: 0xcfdff0, groundColor: 0x312217, intensity: 0.24 },
            main: {
                color: 0xeaf3ff,
                intensity: 1.18,
                position: { x: 2.8, y: 10.2, z: -6.8 },
                target: { x: 0.4, y: 0, z: -0.6 },
                castShadow: true,
                shadowMapSize: 2048
            },
            fill: { color: 0xffcf9f, intensity: 0.42, position: { x: -4.8, y: 6.2, z: 4.4 } },
            rim: { color: 0x97b9de, intensity: 0.14, position: { x: 0.8, y: 4.4, z: -9.2 } },
            accentA: { color: 0xffc48a, intensity: 1.1, distance: 18, decay: 1.7, position: { x: -4.9, y: 3.9, z: 2.6 } },
            accentB: { color: 0xffb97a, intensity: 0.38, distance: 14, decay: 2, position: { x: 4.4, y: 3, z: -4.6 } },
            spot: {
                color: 0xffd7ab,
                intensity: 1.46,
                distance: 28,
                angle: 0.54,
                penumbra: 0.72,
                position: { x: -4.2, y: 8.1, z: 2.6 },
                target: { x: -1.2, y: 0, z: 0.6 }
            },
            presentation: {
                setup: {
                    exposure: 1.14,
                    fogDensity: 0.0122,
                    ambient: { intensity: 0.6 },
                    hemisphere: { intensity: 0.26 },
                    fill: { intensity: 0.46 },
                    rim: { intensity: 0.16 },
                    accentA: { intensity: 1.14 },
                    spot: { intensity: 1.5 }
                },
                game: {
                    exposure: 1.17,
                    fogDensity: 0.0112,
                    ambient: { intensity: 0.64 },
                    hemisphere: { intensity: 0.3 },
                    main: { intensity: 1.24 },
                    fill: { intensity: 0.5 },
                    rim: { intensity: 0.2 },
                    accentA: { intensity: 1.2 },
                    accentB: { intensity: 0.44 },
                    spot: { intensity: 1.58 }
                }
            }
        }
    },
    park: {
        i18nKey: 'scenePark',
        updateInterval: 1 / 20,
        ui: {
            previewImage: 'assets/scene-previews/park.jpg',
            setupTitleKey: 'sceneParkMood',
            setupBlurbKey: 'sceneParkBlurb',
            ambienceKey: 'sceneSoundPark'
        },
        ambience: {
            setup: 'park-setup',
            active: 'park-active',
            thinking: 'park-thinking',
            finished: 'park-finished'
        },
        camera: {
            setup: {
                azimuth: 28,
                elevation: 32,
                distanceScale: 1.92,
                targetOffset: { x: 0.08, y: 0.02, z: -1.34 },
                lift: 0.16,
                interaction: {
                    allowPan: false,
                    fullAzimuth: true,
                    minElevation: 18,
                    maxElevation: 48,
                    minAzimuthOffset: -7,
                    maxAzimuthOffset: 8,
                    minElevationOffset: -5,
                    maxElevationOffset: 7,
                    minDistanceScale: 0.92,
                    maxDistanceScale: 1.12,
                    rotateSpeed: 0.84,
                    zoomSpeed: 0.9
                }
            },
            game: {
                azimuth: 0,
                elevation: 88,
                distanceScale: 1.58,
                targetOffset: { x: 0, y: 0.02, z: 0 },
                lift: 0,
                interaction: {
                    allowPan: true,
                    fullAzimuth: true,
                    minElevation: 34,
                    maxElevation: 89.2,
                    minDistanceScale: 0.78,
                    maxDistanceScale: 1.42,
                    panSpeed: 0.24,
                    rotateSpeed: 0.82,
                    zoomSpeed: 0.86
                }
            },
            shift: {
                establishOffset: { x: 1.02, y: 1.28, z: -1.3 },
                focusOffset: { x: -0.42, y: 0.72, z: -0.58 },
                establishTarget: { x: 0.24, y: 0.12, z: -0.18 },
                targetOffset: { x: -0.1, y: 0.05, z: 0.12 },
                glideDuration: 0.32,
                settleDuration: 0.24,
                returnDuration: 0.36
            }
        },
        lighting: {
            fogColor: 0xadc6d1,
            fogDensity: 0.0065,
            exposure: 1.2,
            ambient: { color: 0xf9fff0, intensity: 0.64 },
            hemisphere: { skyColor: 0xb9def7, groundColor: 0x5b7651, intensity: 0.44 },
            main: {
                color: 0xfff0ce,
                intensity: 1.54,
                position: { x: 7.8, y: 15.2, z: 8.5 },
                target: { x: 0, y: 0, z: 0.4 },
                castShadow: true,
                shadowMapSize: 2048
            },
            fill: { color: 0xd6efc4, intensity: 0.35, position: { x: -6.8, y: 7, z: -2.6 } },
            rim: { color: 0xc9ecff, intensity: 0.18, position: { x: 1.2, y: 6.2, z: -10.8 } },
            accentA: { color: 0xffe1aa, intensity: 0.74, distance: 24, decay: 1.6, position: { x: 7.4, y: 8, z: 5 } },
            accentB: { color: 0xa6d58f, intensity: 0.32, distance: 18, decay: 2, position: { x: -6.4, y: 2.6, z: 5.4 } },
            spot: {
                color: 0xffffff,
                intensity: 0,
                distance: 1,
                angle: 0.45,
                penumbra: 0.4,
                position: { x: 0, y: 8, z: 0 },
                target: { x: 0, y: 0, z: 0 }
            },
            presentation: {
                setup: {
                    exposure: 1.24,
                    fogDensity: 0.0068,
                    ambient: { intensity: 0.68 },
                    main: { intensity: 1.58 },
                    fill: { intensity: 0.38 },
                    rim: { intensity: 0.2 },
                    accentA: { intensity: 0.78 }
                },
                game: {
                    exposure: 1.27,
                    fogDensity: 0.0062,
                    ambient: { intensity: 0.72 },
                    hemisphere: { intensity: 0.48 },
                    main: { intensity: 1.66 },
                    fill: { intensity: 0.44 },
                    rim: { intensity: 0.24 },
                    accentA: { intensity: 0.84 },
                    accentB: { intensity: 0.38 }
                }
            }
        }
    },
    competition: {
        i18nKey: 'sceneCompetition',
        updateInterval: 1 / 24,
        ui: {
            previewImage: 'assets/scene-previews/competition.jpg',
            setupTitleKey: 'sceneCompetitionMood',
            setupBlurbKey: 'sceneCompetitionBlurb',
            ambienceKey: 'sceneSoundCompetition'
        },
        ambience: {
            setup: 'competition-setup',
            active: 'competition-active',
            thinking: 'competition-thinking',
            finished: 'competition-finished'
        },
        camera: {
            setup: {
                azimuth: -8,
                elevation: 36,
                distanceScale: 1.58,
                targetOffset: { x: 0.04, y: 0.02, z: -1.42 },
                lift: 0.18,
                interaction: {
                    allowPan: false,
                    fullAzimuth: true,
                    minElevation: 16,
                    maxElevation: 45,
                    minAzimuthOffset: -5,
                    maxAzimuthOffset: 5,
                    minElevationOffset: -4,
                    maxElevationOffset: 5,
                    minDistanceScale: 0.94,
                    maxDistanceScale: 1.1,
                    rotateSpeed: 0.78,
                    zoomSpeed: 0.84
                }
            },
            game: {
                azimuth: 0,
                elevation: 88,
                distanceScale: 1.52,
                targetOffset: { x: 0, y: 0.02, z: 0 },
                lift: 0,
                interaction: {
                    allowPan: true,
                    fullAzimuth: true,
                    minElevation: 34,
                    maxElevation: 89.2,
                    minDistanceScale: 0.78,
                    maxDistanceScale: 1.42,
                    panSpeed: 0.24,
                    rotateSpeed: 0.82,
                    zoomSpeed: 0.8
                }
            },
            shift: {
                establishOffset: { x: 0, y: 1.4, z: 1.36 },
                focusOffset: { x: 0, y: 0.62, z: 0.52 },
                establishTarget: { x: 0, y: 0.16, z: -0.3 },
                targetOffset: { x: 0, y: 0.08, z: -0.1 },
                glideDuration: 0.26,
                settleDuration: 0.2,
                returnDuration: 0.34
            }
        },
        lighting: {
            fogColor: 0x1b2430,
            fogDensity: 0.0055,
            exposure: 1.28,
            ambient: { color: 0xf5f7f8, intensity: 0.74 },
            hemisphere: { skyColor: 0xb7c5d2, groundColor: 0x35404d, intensity: 0.4 },
            main: {
                color: 0xfdfbf5,
                intensity: 1.72,
                position: { x: 3.8, y: 12.4, z: 6.2 },
                target: { x: 0, y: 0, z: -0.2 },
                castShadow: true,
                shadowMapSize: 2048
            },
            fill: { color: 0xe1e6eb, intensity: 0.62, position: { x: -5.2, y: 8.4, z: -1.4 } },
            rim: { color: 0xd4dfe8, intensity: 0.38, position: { x: 0.8, y: 5.8, z: -9.6 } },
            accentA: { color: 0xded8cf, intensity: 0.34, distance: 22, decay: 1.85, position: { x: 4.4, y: 4.8, z: -5.2 } },
            accentB: { color: 0xd7dee6, intensity: 0.28, distance: 22, decay: 1.85, position: { x: -4.4, y: 4.8, z: -5.2 } },
            spot: {
                color: 0xf6f1e8,
                intensity: 1.96,
                distance: 34,
                angle: 0.48,
                penumbra: 0.72,
                position: { x: 0, y: 10.6, z: 1.4 },
                target: { x: 0, y: 0, z: -0.2 }
            },
            presentation: {
                setup: {
                    exposure: 1.31,
                    fogDensity: 0.0048,
                    ambient: { intensity: 0.82 },
                    hemisphere: { intensity: 0.44 },
                    main: { intensity: 1.8 },
                    fill: { intensity: 0.74 },
                    rim: { intensity: 0.46 },
                    accentA: { intensity: 0.4 },
                    accentB: { intensity: 0.34 },
                    spot: { intensity: 2.08 }
                },
                game: {
                    exposure: 1.34,
                    fogDensity: 0.0042,
                    ambient: { intensity: 0.88 },
                    hemisphere: { intensity: 0.48 },
                    main: { intensity: 1.86 },
                    fill: { intensity: 0.8 },
                    rim: { intensity: 0.52 },
                    accentA: { intensity: 0.44 },
                    accentB: { intensity: 0.36 },
                    spot: { intensity: 2.16 }
                }
            }
        }
    }
};

export function getSceneSpec(scenePreset = 'competition') {
    return SCENE_SPECS[scenePreset] || SCENE_SPECS.competition;
}

export function getSceneAmbienceCue(
    scenePreset = 'competition',
    presentationMode = 'setup',
    { aiThinking = false, gameOver = false } = {}
) {
    const spec = getSceneSpec(scenePreset);

    if (presentationMode === 'setup') {
        return spec.ambience.setup;
    }

    if (gameOver) {
        return spec.ambience.finished;
    }

    if (aiThinking) {
        return spec.ambience.thinking;
    }

    return spec.ambience.active;
}
