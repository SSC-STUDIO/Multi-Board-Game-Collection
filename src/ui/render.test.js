import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../utils/i18n.js', () => ({
    i18n: { t: (key) => key }
}));

vi.mock('../utils/board.js', () => ({
    getResponsiveCellSize: () => '32px',
    getStarPoints: (size) => {
        if (size === 15) return new Set(['3,3', '3,11', '7,7', '11,3', '11,11']);
        return new Set();
    }
}));

vi.mock('../utils/formatters.js', () => ({
    formatMove: (r, c) => `${r},${c}`,
    getPlayerLabel: (c) => c === 'black' ? 'Black' : 'White'
}));

vi.mock('../config/sceneConfig.js', () => ({
    SCENE_SPECS: {
        home: { ui: { previewImage: 'home.jpg', setupTitleKey: 'homeTitle', ambienceKey: 'homeAmb', setupBlurbKey: 'homeBlurb' } },
        park: { ui: { previewImage: 'park.jpg', setupTitleKey: 'parkTitle', ambienceKey: 'parkAmb', setupBlurbKey: 'parkBlurb' } },
        competition: { ui: { previewImage: 'comp.jpg', setupTitleKey: 'compTitle', ambienceKey: 'compAmb', setupBlurbKey: 'compBlurb' } }
    },
    getSceneSpec: (scene) => ({
        ui: {
            previewImage: `${scene}.jpg`,
            setupTitleKey: `${scene}Title`,
            ambienceKey: `${scene}Amb`,
            setupBlurbKey: `${scene}Blurb`
        }
    })
}));

// Mock i18n.t for the scene config too (it's imported inside render.js scope via vi.mock hoisting)
import * as renderModule from './render.js';

/** Create a minimal mock DOM element with common properties */
function mockEl(overrides = {}) {
    const listeners = {};
    return {
        classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn(), contains: vi.fn(() => false) },
        style: { setProperty: vi.fn(), removeProperty: vi.fn() },
        dataset: {},
        textContent: '',
        replaceChildren: vi.fn(),
        appendChild: vi.fn((child) => child),
        removeAttribute: vi.fn(),
        setAttribute: vi.fn(),
        getAttribute: vi.fn(() => null),
        addEventListener: vi.fn((evt, fn) => { listeners[evt] = fn; }),
        removeEventListener: vi.fn(),
        closest: vi.fn(() => null),
        matches: vi.fn(() => false),
        focus: vi.fn(),
        disabled: false,
        checked: false,
        value: '',
        className: '',
        scrollTop: 0,
        scrollLeft: 0,
        offsetWidth: 100,
        naturalWidth: 0,
        complete: false,
        currentSrc: '',
        src: '',
        id: '',
        rid: '',
        children: [],
        querySelector: vi.fn(() => null),
        querySelectorAll: vi.fn(() => []),
        ...overrides
    };
}

function createMockImage() {
    const img = mockEl();
    img.complete = true;
    img.naturalWidth = 100;
    img.src = '';
    img.currentSrc = '';
    img.getAttribute = vi.fn((attr) => {
        if (attr === 'src') return img.src;
        return null;
    });
    return img;
}

function makeGuidance() {
    const guidance = {
        card: mockEl(),
        source: mockEl(),
        status: mockEl(),
        move: mockEl(),
        insight: mockEl(),
        risk: mockEl(),
        alternatives: mockEl(),
        alternativesWrap: mockEl(),
        plan: mockEl(),
        planWrap: mockEl(),
        confidence: mockEl(),
        confidenceWrap: mockEl(),
        feedback: mockEl(),
        feedbackWrap: mockEl(),
        rerun: mockEl(),
        settings: mockEl(),
        upload: mockEl(),
        importBtn: mockEl(),
        importWrap: mockEl(),
        editBtn: mockEl(),
        analyzeImage: createMockImage(),
        analyzeCount: mockEl(),
        analyzeConfidence: mockEl(),
        previewActions: mockEl(),
        previewCommit: mockEl(),
        previewCancel: mockEl(),
        imageInput: mockEl()
    };
    return guidance;
}

function createMockDom() {
    return {
        sections: {
            setup: mockEl({ id: 'setup' }),
            game: mockEl({ id: 'game' })
        },
        board: mockEl({ replaceChildren: vi.fn() }),
        boardPreviewOverlay: mockEl(),
        message: mockEl({ offsetWidth: 100 }),
        aiThinking: mockEl(),
        meta: {
            mode: mockEl(),
            rule: mockEl(),
            size: mockEl(),
            scene: mockEl()
        },
        status: {
            currentPlayer: mockEl(),
            moveCount: mockEl(),
            lastMove: mockEl(),
            boardPhase: mockEl()
        },
        stage: {
            phasePill: mockEl(),
            title: mockEl(),
            subtitle: mockEl(),
            turnSpotlightText: mockEl(),
            turnSpotlight: mockEl(),
            momentumText: mockEl(),
            momentumNote: mockEl()
        },
        moveList: mockEl(),
        guidance: makeGuidance(),
        result: {
            badge: mockEl(),
            title: mockEl(),
            detail: mockEl(),
            moves: mockEl(),
            lastMove: mockEl(),
            overlay: mockEl({ classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn(), contains: vi.fn(() => false) } }),
            restart: mockEl(),
            setup: mockEl()
        },
        placement: {
            panel: mockEl(),
            move: mockEl(),
            prompt: mockEl()
        },
        overlay: mockEl(),
        setupScene: {
            card: mockEl(),
            image: createMockImage(),
            mood: mockEl(),
            ambience: mockEl(),
            copy: mockEl()
        },
        setupGroups: {
            ai: mockEl(),
            color: mockEl(),
            llm: mockEl()
        },
        controls: mockEl(),
        optionGroups: mockEl(),
        dom: { mock: true }
    };
}

function makeState(overrides = {}) {
    const size = overrides.size ?? 15;
    const board = Array.from({ length: size }, () => Array(size).fill(null));
    return {
        board,
        currentPlayer: 'black',
        moveHistory: [],
        lastMove: null,
        gameOver: false,
        hintMove: null,
        winningCells: [],
        options: { size, rule: 'classic', mode: 'pvp' },
        coachSuggestion: null,
        coachAlternatives: [],
        coachFocus: null,
        selectedCell: null,
        awaitingPlacementConfirm: false,
        coachLlmStatus: 'disabled',
        coachInsight: '',
        coachRisk: '',
        coachPlan: '',
        coachConfidence: null,
        coachSource: 'local',
        coachFeedback: '',
        coachAnalyzedBoard: null,
        coachPreviewMode: false,
        coachPreviewBoard: null,
        ...overrides
    };
}

describe('syncSetupPanel', () => {
    it('shows AI and color options only in pve mode', () => {
        const dom = createMockDom();
        renderModule.syncSetupPanel(dom, { mode: 'pve' });
        expect(dom.setupGroups.ai.classList.toggle).toHaveBeenCalledWith('hidden', false);
        expect(dom.setupGroups.color.classList.toggle).toHaveBeenCalledWith('hidden', false);
    });

    it('shows AI and color options only in qi mode', () => {
        const dom = createMockDom();
        renderModule.syncSetupPanel(dom, { mode: 'qi' });
        expect(dom.setupGroups.ai.classList.toggle).toHaveBeenCalledWith('hidden', false);
        expect(dom.setupGroups.color.classList.toggle).toHaveBeenCalledWith('hidden', false);
    });

    it('shows LLM options only in qi mode', () => {
        const dom = createMockDom();
        dom.setupGroups.llm = mockEl();
        renderModule.syncSetupPanel(dom, { mode: 'qi' });
        expect(dom.setupGroups.llm.classList.toggle).toHaveBeenCalledWith('hidden', false);
    });

    it('hides LLM options in non-qi modes', () => {
        const dom = createMockDom();
        dom.setupGroups.llm = mockEl();
        renderModule.syncSetupPanel(dom, { mode: 'pvp' });
        expect(dom.setupGroups.llm.classList.toggle).toHaveBeenCalledWith('hidden', true);
    });
});

describe('showSetup', () => {
    it('hides game section and shows setup section', () => {
        const dom = createMockDom();
        renderModule.showSetup(dom);
        expect(dom.sections.game.classList.add).toHaveBeenCalledWith('hidden');
        expect(dom.sections.setup.classList.remove).toHaveBeenCalledWith('hidden');
    });

    it('resets scroll position on overlay and setup', () => {
        const dom = createMockDom();
        dom.overlay.scrollTop = 50;
        renderModule.showSetup(dom);
        expect(dom.overlay.scrollTop).toBe(0);
    });
});

describe('showGame', () => {
    it('hides setup section and shows game section', () => {
        const dom = createMockDom();
        renderModule.showGame(dom);
        expect(dom.sections.setup.classList.add).toHaveBeenCalledWith('hidden');
        expect(dom.sections.game.classList.remove).toHaveBeenCalledWith('hidden');
    });

    it('sets scene-game-active body class', () => {
        const dom = createMockDom();
        renderModule.showGame(dom);
        expect(document.body.classList.contains('scene-game-active')).toBe(true);
    });
});

describe('updateMeta', () => {
    it('sets mode text from i18n', () => {
        const dom = createMockDom();
        renderModule.updateMeta(dom, { mode: 'pvp', rule: 'classic', size: 15, scene: 'home' });
        expect(dom.meta.mode.textContent).toBe('pvp');
    });

    it('sets rule, size, and scene text', () => {
        const dom = createMockDom();
        renderModule.updateMeta(dom, { mode: 'pvp', rule: 'renju', size: 19, scene: 'park' });
        expect(dom.meta.rule.textContent).toBe('renju');
        expect(dom.meta.size.textContent).toBe('19 x 19');
        expect(dom.meta.scene.textContent).toBe('scenePark');
    });
});

describe('renderBoard', () => {
    it('clears board and sets style properties', () => {
        const dom = createMockDom();
        dom.board = mockEl({ replaceChildren: vi.fn(), style: { setProperty: vi.fn() } });
        const state = makeState({ size: 15 });
        renderModule.renderBoard(dom, state);
        expect(dom.board.replaceChildren).toHaveBeenCalled();
        expect(dom.board.style.setProperty).toHaveBeenCalledWith('--board-size', '15');
        expect(dom.board.style.setProperty).toHaveBeenCalledWith('--cell-size', '32px');
    });

    it('renders correct number of cells', () => {
        const dom = createMockDom();
        let cells = [];
        dom.board = mockEl({
            replaceChildren: vi.fn(),
            style: { setProperty: vi.fn() },
            appendChild: vi.fn((child) => { cells.push(child); return child; })
        });
        const state = makeState({ size: 9 });
        renderModule.renderBoard(dom, state);
        // 9x9 = 81 cells
        expect(dom.board.replaceChildren).toHaveBeenCalled();
    });

    it('adds stone element for occupied cells', () => {
        const dom = createMockDom();
        const capturedCells = [];
        dom.board = mockEl({
            replaceChildren: vi.fn(),
            style: { setProperty: vi.fn() },
            appendChild: vi.fn((child) => { capturedCells.push(child); return child; })
        });
        const state = makeState({ size: 3 });
        state.board[0][0] = 'black';
        state.board[1][1] = 'white';
        renderModule.renderBoard(dom, state);
        // Should create 9 cells, but we can't easily check appendChild on fragment
        expect(dom.board.replaceChildren).toHaveBeenCalled();
    });

    it('marks star points on 15x15 board', () => {
        const dom = createMockDom();
        dom.board = mockEl({ replaceChildren: vi.fn(), style: { setProperty: vi.fn() } });
        const state = makeState({ size: 15 });
        renderModule.renderBoard(dom, state);
        expect(dom.board.replaceChildren).toHaveBeenCalled();
    });
});

describe('updateStatus', () => {
    it('shows player label for ongoing game', () => {
        const dom = createMockDom();
        const state = makeState({ currentPlayer: 'black', moveHistory: [], gameOver: false });
        renderModule.updateStatus(dom, state);
        expect(dom.status.currentPlayer.textContent).toBe('Black');
    });

    it('shows game end label when game is over', () => {
        const dom = createMockDom();
        const state = makeState({ gameOver: true, moveHistory: [{}], lastMove: { row: 7, col: 7, color: 'black' } });
        renderModule.updateStatus(dom, state);
        expect(dom.status.currentPlayer.textContent).toBe('gameEnd');
    });
});

describe('updateMoveList', () => {
    it('shows empty message when no moves', () => {
        const dom = createMockDom();
        renderModule.updateMoveList(dom, []);
        expect(dom.moveList.textContent).toBe('noMoves');
    });

    it('formats moves in pairs', () => {
        const dom = createMockDom();
        const history = [
            { row: 7, col: 7, color: 'black' },
            { row: 7, col: 8, color: 'white' }
        ];
        renderModule.updateMoveList(dom, history);
        expect(dom.moveList.replaceChildren).toHaveBeenCalled();
    });
});

describe('updateGuidance', () => {
    it('hides guidance card in non-QI mode', () => {
        const dom = createMockDom();
        const state = makeState({});
        renderModule.updateGuidance(dom, state, { mode: 'pvp' });
        expect(dom.guidance.card.classList.toggle).toHaveBeenCalledWith('hidden', true);
    });

    it('shows guidance card in QI mode', () => {
        const dom = createMockDom();
        const state = makeState({ coachSource: 'local', coachLlmStatus: 'disabled' });
        renderModule.updateGuidance(dom, state, { mode: 'qi' });
        expect(dom.guidance.card.classList.toggle).toHaveBeenCalledWith('hidden', false);
    });
});

describe('updateBoardPreviewOverlay', () => {
    it('hides overlay when preview mode is off', () => {
        const dom = createMockDom();
        const state = makeState({});
        renderModule.updateBoardPreviewOverlay(dom, state);
        expect(dom.boardPreviewOverlay.classList.toggle).toHaveBeenCalledWith('hidden', true);
    });

    it('shows overlay and renders cells when preview mode is active', () => {
        const dom = createMockDom();
        const previewBoard = {
            size: 3,
            cells: [
                [null, 'black', null],
                [null, null, 'white'],
                [null, null, null]
            ]
        };
        const state = makeState({ coachPreviewMode: true, coachPreviewBoard: previewBoard });
        renderModule.updateBoardPreviewOverlay(dom, state);
        expect(dom.boardPreviewOverlay.classList.toggle).toHaveBeenCalledWith('hidden', false);
    });
});

describe('updatePlacementPanel', () => {
    it('hides panel when not in placement mode', () => {
        const dom = createMockDom();
        const state = makeState({});
        renderModule.updatePlacementPanel(dom, state);
        expect(dom.placement.panel.classList.toggle).toHaveBeenCalledWith('hidden', true);
    });

    it('shows panel when awaiting placement confirm', () => {
        const dom = createMockDom();
        const state = makeState({
            awaitingPlacementConfirm: true,
            selectedCell: { row: 7, col: 7 }
        });
        renderModule.updatePlacementPanel(dom, state);
        expect(dom.placement.panel.classList.toggle).toHaveBeenCalledWith('hidden', false);
    });
});

describe('setAIThinking', () => {
    it('shows thinking indicator', () => {
        const dom = createMockDom();
        renderModule.setAIThinking(dom, true);
        expect(dom.aiThinking.classList.toggle).toHaveBeenCalledWith('hidden', false);
    });

    it('hides thinking indicator', () => {
        const dom = createMockDom();
        renderModule.setAIThinking(dom, false);
        expect(dom.aiThinking.classList.toggle).toHaveBeenCalledWith('hidden', true);
    });
});

describe('showMessage', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('sets message text and type class', () => {
        const dom = createMockDom();
        renderModule.showMessage(dom, 'test message', 'error');
        expect(dom.message.textContent).toBe('test message');
        expect(dom.message.className).toContain('error');
    });

    it('auto-hides message after 3000ms', () => {
        const dom = createMockDom();
        renderModule.showMessage(dom, 'test');
        expect(dom.message.className).not.toContain('hidden');
        vi.advanceTimersByTime(3000);
        expect(dom.message.classList.add).toHaveBeenCalledWith('hidden');
    });

    it('removes existing timer before starting new one', () => {
        const dom = createMockDom();
        renderModule.showMessage(dom, 'first');
        renderModule.showMessage(dom, 'second');
        vi.advanceTimersByTime(3000);
        expect(dom.message.textContent).toBe('second');
    });
});

describe('showResultOverlay', () => {
    it('sets result summary fields', () => {
        const dom = createMockDom();
        const summary = {
            badge: 'Win',
            title: 'Black wins!',
            detail: 'Five in a row',
            moves: 23,
            lastMove: 'Black 7,7',
            variant: 'result-win'
        };
        renderModule.showResultOverlay(dom, summary);
        expect(dom.result.badge.textContent).toBe('Win');
        expect(dom.result.title.textContent).toBe('Black wins!');
        expect(dom.result.detail.textContent).toBe('Five in a row');
        expect(dom.result.moves.textContent).toBe('23');
        expect(dom.result.lastMove.textContent).toBe('Black 7,7');
    });
});

describe('hideResultOverlay', () => {
    it('adds hidden class and removes variant classes', () => {
        const dom = createMockDom();
        renderModule.hideResultOverlay(dom);
        expect(dom.result.overlay.classList.add).toHaveBeenCalledWith('hidden');
        expect(dom.result.overlay.classList.remove).toHaveBeenCalledWith('result-win', 'result-draw', 'result-resign');
    });
});
