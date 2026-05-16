import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../utils/i18n.js', () => ({
    i18n: { t: (key) => key },
    t: (key) => key
}));
vi.mock('../../games/gomoku/rules.js', () => ({
    getForbiddenReason: vi.fn(() => '')
}));
vi.mock('../../ui/render.js', () => ({
    showMessage: vi.fn()
}));

import { InteractionManager } from './InteractionManager.js';
import { getForbiddenReason } from '../../games/gomoku/rules.js';
import { showMessage } from '../../ui/render.js';

function createBoard(size) {
    return Array.from({ length: size }, () => Array(size).fill(null));
}

function createApp(overrides = {}) {
    const size = overrides.size ?? 15;
    return {
        options: { size, rule: 'classic', mode: 'pvp', playerColor: 'black' },
        state: {
            board: createBoard(size),
            currentPlayer: 'black',
            gameOver: false,
            aiThinking: false,
            coachPreviewMode: false,
            selectedCell: null,
            awaitingPlacementConfirm: false
        },
        sound: { play: vi.fn() },
        render: vi.fn(),
        showMessageKey: vi.fn(),
        commitMove: vi.fn(),
        validateMove: vi.fn(() => ''),
        dom: {
            board: {
                querySelector: vi.fn(() => null)
            }
        },
        use3D: false,
        renderer3d: null,
        previewCell: null,
        coach: { togglePreviewCell: vi.fn() },
        llmSettingsOpen: false,
        helpOpen: false,
        firstRunGuideOpen: false,
        closeLlmSettings: vi.fn(),
        closeHelp: vi.fn(),
        dismissFirstRunGuide: vi.fn(),
        ...overrides
    };
}

let originalMatchMedia;
let originalInnerWidth;

beforeEach(() => {
    vi.clearAllMocks();
    getForbiddenReason.mockReturnValue('');
    showMessage.mockClear();
    originalMatchMedia = window.matchMedia;
    originalInnerWidth = window.innerWidth;
});

afterEach(() => {
    window.matchMedia = originalMatchMedia;
    Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, writable: true, configurable: true });
});

describe('InteractionManager.isAIMode', () => {
    it('returns false for pvp mode', () => {
        const app = createApp();
        app.options.mode = 'pvp';
        const mgr = new InteractionManager(app);
        expect(mgr.isAIMode()).toBe(false);
    });

    it('returns true for pve mode', () => {
        const app = createApp();
        app.options.mode = 'pve';
        const mgr = new InteractionManager(app);
        expect(mgr.isAIMode()).toBe(true);
    });

    it('returns true for qi mode', () => {
        const app = createApp();
        app.options.mode = 'qi';
        const mgr = new InteractionManager(app);
        expect(mgr.isAIMode()).toBe(true);
    });
});

describe('InteractionManager.isGuidedMode', () => {
    it('returns true for qi mode', () => {
        const app = createApp();
        app.options.mode = 'qi';
        const mgr = new InteractionManager(app);
        expect(mgr.isGuidedMode()).toBe(true);
    });

    it('returns false for pve mode', () => {
        const app = createApp();
        app.options.mode = 'pve';
        const mgr = new InteractionManager(app);
        expect(mgr.isGuidedMode()).toBe(false);
    });

    it('returns false for pvp mode', () => {
        const app = createApp();
        app.options.mode = 'pvp';
        const mgr = new InteractionManager(app);
        expect(mgr.isGuidedMode()).toBe(false);
    });
});

describe('InteractionManager.isTouchPlacementFlow', () => {
    it('returns true when coarse pointer matches', () => {
        window.matchMedia = vi.fn((query) => ({
            matches: query === '(pointer: coarse)'
        }));
        const app = createApp();
        const mgr = new InteractionManager(app);
        expect(mgr.isTouchPlacementFlow()).toBe(true);
    });

    it('returns true when hover none matches', () => {
        window.matchMedia = vi.fn((query) => ({
            matches: query === '(hover: none)'
        }));
        const app = createApp();
        const mgr = new InteractionManager(app);
        expect(mgr.isTouchPlacementFlow()).toBe(true);
    });

    it('returns false for fine pointer with hover', () => {
        window.matchMedia = vi.fn(() => ({ matches: false }));
        const app = createApp();
        const mgr = new InteractionManager(app);
        expect(mgr.isTouchPlacementFlow()).toBe(false);
    });

    it('returns false when matchMedia is undefined', () => {
        window.matchMedia = undefined;
        const app = createApp();
        const mgr = new InteractionManager(app);
        expect(mgr.isTouchPlacementFlow()).toBe(false);
    });
});

describe('InteractionManager.canHumanMove', () => {
    it('returns true for non-AI mode regardless of state', () => {
        const app = createApp();
        app.options.mode = 'pvp';
        app.state.aiThinking = true;
        const mgr = new InteractionManager(app);
        expect(mgr.canHumanMove()).toBe(true);
    });

    it('returns true when AI mode, not thinking, and player turn', () => {
        const app = createApp();
        app.options.mode = 'pve';
        app.state.aiThinking = false;
        app.state.currentPlayer = 'black';
        app.options.playerColor = 'black';
        const mgr = new InteractionManager(app);
        expect(mgr.canHumanMove()).toBe(true);
    });

    it('returns false when AI is thinking', () => {
        const app = createApp();
        app.options.mode = 'pve';
        app.state.aiThinking = true;
        app.state.currentPlayer = 'black';
        app.options.playerColor = 'black';
        const mgr = new InteractionManager(app);
        expect(mgr.canHumanMove()).toBe(false);
    });

    it('returns false when not AI player turn', () => {
        const app = createApp();
        app.options.mode = 'pve';
        app.state.aiThinking = false;
        app.state.currentPlayer = 'white';
        app.options.playerColor = 'black';
        const mgr = new InteractionManager(app);
        expect(mgr.canHumanMove()).toBe(false);
    });
});

describe('InteractionManager.getForbiddenReason', () => {
    it('delegates to rules.js getForbiddenReason', () => {
        getForbiddenReason.mockReturnValue('forbidden');
        const app = createApp();
        const mgr = new InteractionManager(app);
        const result = mgr.getForbiddenReason(7, 7, 'black');
        expect(getForbiddenReason).toHaveBeenCalledWith(
            app.state.board, app.options.size, app.options.rule, 7, 7, 'black'
        );
        expect(result).toBe('forbidden');
    });
});

describe('InteractionManager.validateMove', () => {
    it('returns occupied error when cell is taken', () => {
        const app = createApp();
        app.state.board[3][4] = 'black';
        const mgr = new InteractionManager(app);
        expect(mgr.validateMove(3, 4, 'white')).toBe('cellOccupied');
    });

    it('returns forbidden reason when getForbiddenReason returns non-empty', () => {
        const app = createApp();
        getForbiddenReason.mockReturnValue('doubleThree');
        const mgr = new InteractionManager(app);
        expect(mgr.validateMove(7, 7, 'black')).toBe('doubleThree');
    });

    it('returns empty string when move is valid', () => {
        const app = createApp();
        const mgr = new InteractionManager(app);
        expect(mgr.validateMove(7, 7, 'black')).toBe('');
    });
});

describe('InteractionManager.handleCellClick', () => {
    it('delegates to coach.togglePreviewCell in preview mode', () => {
        const app = createApp();
        app.state.coachPreviewMode = true;
        const mgr = new InteractionManager(app);
        mgr.handleCellClick(3, 4);
        expect(app.coach.togglePreviewCell).toHaveBeenCalledWith(3, 4);
    });

    it('plays error and shows message when game is over', () => {
        const app = createApp();
        app.state.gameOver = true;
        const mgr = new InteractionManager(app);
        mgr.handleCellClick(7, 7);
        expect(app.sound.play).toHaveBeenCalledWith('error');
        expect(app.showMessageKey).toHaveBeenCalledWith('gameAlreadyEndedReturn');
    });

    it('plays error and shows message when human cannot move', () => {
        const app = createApp();
        app.options.mode = 'pve';
        app.state.aiThinking = true;
        const mgr = new InteractionManager(app);
        mgr.handleCellClick(7, 7);
        expect(app.sound.play).toHaveBeenCalledWith('error');
        expect(app.showMessageKey).toHaveBeenCalledWith('aiTurnWait');
    });

    it('plays error and shows UI message when validateMove returns error', () => {
        const app = createApp();
        app.validateMove.mockReturnValue('cellOccupied');
        const mgr = new InteractionManager(app);
        mgr.handleCellClick(7, 7);
        expect(app.sound.play).toHaveBeenCalledWith('error');
        expect(showMessage).toHaveBeenCalledWith(app.dom, 'cellOccupied', 'error');
    });

    it('calls commitMove directly in non-touch, valid move scenario', () => {
        window.matchMedia = vi.fn(() => ({ matches: false }));
        const app = createApp();
        const mgr = new InteractionManager(app);
        mgr.handleCellClick(7, 7);
        expect(app.commitMove).toHaveBeenCalledWith(7, 7, 'black', { source: 'human' });
    });

    it('calls selectCellForPlacement in touch flow scenario', () => {
        window.matchMedia = vi.fn((q) => ({ matches: q === '(pointer: coarse)' }));
        const app = createApp();
        const mgr = new InteractionManager(app);
        mgr.handleCellClick(7, 7);
        expect(app.state.selectedCell).toEqual({ row: 7, col: 7 });
        expect(app.state.awaitingPlacementConfirm).toBe(true);
    });
});

describe('InteractionManager.selectCellForPlacement', () => {
    it('sets selectedCell and awaitingPlacementConfirm', () => {
        const app = createApp();
        const mgr = new InteractionManager(app);
        mgr.selectCellForPlacement(3, 4);
        expect(app.state.selectedCell).toEqual({ row: 3, col: 4 });
        expect(app.state.awaitingPlacementConfirm).toBe(true);
        expect(app.sound.play).toHaveBeenCalledWith('select');
        expect(app.render).toHaveBeenCalled();
        expect(app.showMessageKey).toHaveBeenCalledWith('selectedMoveConfirm', expect.any(Object));
    });

    it('does nothing if same cell already selected and awaiting', () => {
        const app = createApp();
        app.state.selectedCell = { row: 3, col: 4 };
        app.state.awaitingPlacementConfirm = true;
        const mgr = new InteractionManager(app);
        mgr.selectCellForPlacement(3, 4);
        expect(app.sound.play).not.toHaveBeenCalled();
        expect(app.render).not.toHaveBeenCalled();
    });
});

describe('InteractionManager.confirmSelectedPlacement', () => {
    it('plays error when not awaiting confirmation', () => {
        const app = createApp();
        const mgr = new InteractionManager(app);
        mgr.confirmSelectedPlacement();
        expect(app.sound.play).toHaveBeenCalledWith('error');
        expect(app.showMessageKey).toHaveBeenCalledWith('selectPointFirstConfirm');
    });

    it('commits move when valid', () => {
        const app = createApp();
        app.state.selectedCell = { row: 7, col: 7 };
        app.state.awaitingPlacementConfirm = true;
        const mgr = new InteractionManager(app);
        mgr.confirmSelectedPlacement();
        expect(app.commitMove).toHaveBeenCalledWith(7, 7, 'black', { source: 'human' });
    });

    it('shows error when move is invalid at selected position', () => {
        const app = createApp();
        app.state.selectedCell = { row: 7, col: 7 };
        app.state.awaitingPlacementConfirm = true;
        app.validateMove.mockReturnValue('cellOccupied');
        const mgr = new InteractionManager(app);
        mgr.confirmSelectedPlacement();
        expect(app.sound.play).toHaveBeenCalledWith('error');
        expect(showMessage).toHaveBeenCalledWith(app.dom, 'cellOccupied', 'error');
    });
});

describe('InteractionManager.cancelSelectedPlacement', () => {
    it('does nothing when not awaiting', () => {
        const app = createApp();
        const mgr = new InteractionManager(app);
        mgr.cancelSelectedPlacement();
        expect(app.render).not.toHaveBeenCalled();
    });

    it('clears state and renders when awaiting', () => {
        const app = createApp();
        app.state.selectedCell = { row: 3, col: 4 };
        app.state.awaitingPlacementConfirm = true;
        const mgr = new InteractionManager(app);
        mgr.cancelSelectedPlacement();
        expect(app.state.selectedCell).toBeNull();
        expect(app.state.awaitingPlacementConfirm).toBe(false);
        expect(app.render).toHaveBeenCalled();
    });
});

describe('InteractionManager.clearPlacementSelection', () => {
    it('clears state and shows message by default', () => {
        const app = createApp();
        app.state.selectedCell = { row: 1, col: 1 };
        app.state.awaitingPlacementConfirm = true;
        const mgr = new InteractionManager(app);
        mgr.clearPlacementSelection();
        expect(app.state.selectedCell).toBeNull();
        expect(app.state.awaitingPlacementConfirm).toBe(false);
        expect(app.showMessageKey).toHaveBeenCalledWith('selectionCanceledMessage');
    });

    it('clears state without message when clearMessage=false', () => {
        const app = createApp();
        app.state.selectedCell = { row: 1, col: 1 };
        app.state.awaitingPlacementConfirm = true;
        const mgr = new InteractionManager(app);
        mgr.clearPlacementSelection(false);
        expect(app.state.selectedCell).toBeNull();
        expect(app.state.awaitingPlacementConfirm).toBe(false);
        expect(app.showMessageKey).not.toHaveBeenCalled();
    });
});

describe('InteractionManager.clearPreview', () => {
    it('removes 2D preview element and clears previewCell', () => {
        const previewEl = { remove: vi.fn() };
        const cell = { querySelector: vi.fn(() => previewEl) };
        const app = createApp();
        app.use3D = false;
        app.previewCell = cell;
        const mgr = new InteractionManager(app);
        mgr.clearPreview();
        expect(cell.querySelector).toHaveBeenCalledWith('.stone.preview');
        expect(previewEl.remove).toHaveBeenCalled();
        expect(app.previewCell).toBeNull();
    });

    it('calls renderer3d.hidePreview when in 3D mode', () => {
        const app = createApp();
        app.use3D = true;
        app.renderer3d = { hidePreview: vi.fn() };
        const mgr = new InteractionManager(app);
        mgr.clearPreview();
        expect(app.renderer3d.hidePreview).toHaveBeenCalled();
    });
});

describe('InteractionManager.highlightCell', () => {
    it('adds highlight class to cell', () => {
        const cell = {
            dataset: { row: '3', col: '4' },
            classList: { add: vi.fn() }
        };
        const app = createApp();
        const mgr = new InteractionManager(app);
        mgr.highlightCell(cell);
        expect(cell.classList.add).toHaveBeenCalledWith('cell-touch-highlight');
    });

    it('does nothing when game is over', () => {
        const cell = {
            dataset: { row: '3', col: '4' },
            classList: { add: vi.fn() }
        };
        const app = createApp();
        app.state.gameOver = true;
        const mgr = new InteractionManager(app);
        mgr.highlightCell(cell);
        expect(cell.classList.add).not.toHaveBeenCalled();
    });
});

describe('InteractionManager.clearCellHighlight', () => {
    it('removes highlight class from highlighted element', () => {
        const highlighted = { classList: { remove: vi.fn() } };
        const app = createApp();
        app.dom.board.querySelector.mockReturnValue(highlighted);
        const mgr = new InteractionManager(app);
        mgr.clearCellHighlight();
        expect(highlighted.classList.remove).toHaveBeenCalledWith('cell-touch-highlight');
    });

    it('does nothing when no highlighted element exists', () => {
        const app = createApp();
        app.dom.board.querySelector.mockReturnValue(null);
        const mgr = new InteractionManager(app);
        mgr.clearCellHighlight(); // should not throw
    });
});

describe('InteractionManager.handleGlobalKeydown', () => {
    it('closes llmSettings on Escape', () => {
        const app = createApp();
        app.llmSettingsOpen = true;
        const mgr = new InteractionManager(app);
        mgr.handleGlobalKeydown({ key: 'Escape' });
        expect(app.closeLlmSettings).toHaveBeenCalled();
    });

    it('closes help on Escape when llmSettings not open', () => {
        const app = createApp();
        app.helpOpen = true;
        const mgr = new InteractionManager(app);
        mgr.handleGlobalKeydown({ key: 'Escape' });
        expect(app.closeHelp).toHaveBeenCalled();
    });

    it('dismisses first run guide on Escape when other overlays closed', () => {
        const app = createApp();
        app.firstRunGuideOpen = true;
        const mgr = new InteractionManager(app);
        mgr.handleGlobalKeydown({ key: 'Escape' });
        expect(app.dismissFirstRunGuide).toHaveBeenCalled();
    });

    it('moves focus to next radio on ArrowRight', () => {
        const radios = [
            { focus: vi.fn(), click: vi.fn(), matches: vi.fn(() => true), closest: vi.fn(() => group) }
        ];
        const group = { querySelectorAll: vi.fn(() => radios) };
        const focusFn = vi.fn();
        const clickFn = vi.fn();
        radios[0] = { focus: focusFn, click: clickFn, matches: vi.fn(() => true), closest: vi.fn(() => group) };
        group.querySelectorAll = vi.fn(() => radios);
        globalThis.document = { activeElement: radios[0] };
        const event = { key: 'ArrowRight', preventDefault: vi.fn() };
        const app = createApp();
        const mgr = new InteractionManager(app);
        mgr.handleGlobalKeydown(event);
        expect(event.preventDefault).toHaveBeenCalled();
    });
});
