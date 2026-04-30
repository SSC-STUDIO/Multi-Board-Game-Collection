import { getResponsiveCellSize, getStarPoints } from '../utils/board.js';
import { formatMove, getPlayerLabel } from '../utils/formatters.js';
import { i18n } from '../utils/i18n.js';
import { SCENE_SPECS, getSceneSpec } from '../config/sceneConfig.js';

let messageTimer = null;
let scenePreviewRequestId = 0;
let scenePreviewPreloadHookRegistered = false;
let scenePreviewPreloadFlushScheduled = false;

const SCENE_PREVIEW_SOURCES = Object.values(SCENE_SPECS).map((sceneSpec) => sceneSpec.ui.previewImage);
const scenePreviewPreloadCache = new Map();
const pendingScenePreviewPreloads = new Set();

const MODE_I18N_KEYS = {
    pvp: 'pvp',
    pve: 'pve',
    practice: 'practice',
    qi: 'qi'
};

const RULE_I18N_KEYS = {
    classic: 'classic',
    renju: 'renju'
};

const SCENE_I18N_KEYS = {
    home: 'sceneHome',
    park: 'scenePark',
    competition: 'sceneCompetition'
};

export function syncSetupPanel(dom, options) {
    const showAIOptions = options.mode === 'pve' || options.mode === 'qi';
    dom.setupGroups.ai.classList.toggle('hidden', !showAIOptions);
    dom.setupGroups.color.classList.toggle('hidden', !showAIOptions);
    dom.setupGroups.llm?.classList.toggle('hidden', options.mode !== 'qi');
    updateSetupScenePreview(dom, options);
}

function updateSetupScenePreview(dom, options) {
    if (!dom.setupScene?.card) {
        return;
    }

    const sceneSpec = getSceneSpec(options.scene);
    dom.setupScene.card.dataset.scene = options.scene;
    syncSetupScenePreviewImage(dom, sceneSpec.ui.previewImage);
    dom.setupScene.mood.textContent = i18n.t(sceneSpec.ui.setupTitleKey);
    dom.setupScene.ambience.textContent = i18n.t(sceneSpec.ui.ambienceKey);
    dom.setupScene.copy.textContent = i18n.t(sceneSpec.ui.setupBlurbKey);
}

function syncSetupScenePreviewImage(dom, src) {
    const card = dom.setupScene?.card;
    const image = dom.setupScene?.image;
    if (!card || !image) {
        return;
    }

    const requestId = ++scenePreviewRequestId;
    const currentAttr = image.getAttribute('src');
    const alreadyLoaded = isScenePreviewLoaded(image, src);

    card.classList.add('is-loading');

    if (!alreadyLoaded) {
        const settle = () => {
            if (requestId !== scenePreviewRequestId) {
                return;
            }
            card.classList.remove('is-loading');
        };

        image.addEventListener('load', settle, { once: true });
        image.addEventListener('error', settle, { once: true });
    }

    if (currentAttr !== src) {
        image.src = src;
    }

    if (alreadyLoaded || isScenePreviewLoaded(image, src)) {
        card.classList.remove('is-loading');
    }

    queueDeferredScenePreviewPreloads(src);
}

function preloadScenePreview(src) {
    const cached = scenePreviewPreloadCache.get(src);
    if (cached) {
        return cached;
    }

    const preload = new Promise((resolve) => {
        const image = new Image();
        image.decoding = 'async';

        const settle = () => resolve();
        image.addEventListener('load', settle, { once: true });
        image.addEventListener('error', settle, { once: true });
        image.src = src;
    });

    scenePreviewPreloadCache.set(src, preload);
    return preload;
}

function isScenePreviewLoaded(image, src) {
    const currentSrc = image.currentSrc || image.src || '';
    return image.complete
        && image.naturalWidth > 0
        && (image.getAttribute('src') === src || currentSrc.endsWith(src));
}

function queueDeferredScenePreviewPreloads(activeSrc) {
    SCENE_PREVIEW_SOURCES.forEach((previewSrc) => {
        if (previewSrc !== activeSrc) {
            pendingScenePreviewPreloads.add(previewSrc);
        }
    });

    if (pendingScenePreviewPreloads.size === 0) {
        return;
    }

    if (document.readyState === 'complete') {
        scheduleScenePreviewPreloadFlush();
        return;
    }

    if (scenePreviewPreloadHookRegistered) {
        return;
    }

    scenePreviewPreloadHookRegistered = true;
    window.addEventListener('load', scheduleScenePreviewPreloadFlush, { once: true });
}

function scheduleScenePreviewPreloadFlush() {
    if (scenePreviewPreloadFlushScheduled || pendingScenePreviewPreloads.size === 0) {
        return;
    }

    scenePreviewPreloadFlushScheduled = true;
    const flush = () => {
        scenePreviewPreloadFlushScheduled = false;
        const sources = Array.from(pendingScenePreviewPreloads);
        pendingScenePreviewPreloads.clear();
        sources.forEach((src) => {
            void preloadScenePreview(src);
        });
    };

    if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(flush, { timeout: 1200 });
        return;
    }

    window.setTimeout(flush, 0);
}

export function showSetup(dom) {
    if (dom.overlay) {
        dom.overlay.scrollTop = 0;
        dom.overlay.scrollLeft = 0;
    }

    dom.sections.game.classList.add('hidden');
    dom.sections.setup.classList.remove('hidden');
    dom.sections.setup.scrollTop = 0;
    dom.sections.setup.scrollLeft = 0;
    document.body.classList.remove(
        'scene-game-active',
        'match-entering',
        'guided-mode',
        'awaiting-placement'
    );
    document.body.classList.add('scene-setup-active');
    document.body.classList.remove('turn-black-active', 'turn-white-active', 'game-finished', 'ai-active', 'result-open');
}

export function showGame(dom) {
    if (dom.overlay) {
        dom.overlay.scrollTop = 0;
        dom.overlay.scrollLeft = 0;
    }

    dom.sections.setup.classList.add('hidden');
    dom.sections.game.classList.remove('hidden');
    document.body.classList.remove('scene-setup-active');
    document.body.classList.add('scene-game-active');
}

export function updateMeta(dom, options) {
    dom.meta.mode.textContent = i18n.t(MODE_I18N_KEYS[options.mode] || options.mode);
    dom.meta.rule.textContent = i18n.t(RULE_I18N_KEYS[options.rule] || options.rule);
    dom.meta.size.textContent = `${options.size} x ${options.size}`;
    if (dom.meta.scene) {
        dom.meta.scene.textContent = i18n.t(SCENE_I18N_KEYS[options.scene] || options.scene);
    }
}

export function renderBoard(dom, state) {
    const {
        board,
        lastMove,
        hintMove,
        coachSuggestion,
        coachFocus,
        selectedCell,
        options,
        winningCells
    } = state;
    const stars = getStarPoints(options.size);
    const winningCellSet = new Set((winningCells || []).map((cell) => `${cell.row},${cell.col}`));
    const fragment = document.createDocumentFragment();

    dom.board.replaceChildren();
    dom.board.style.setProperty('--board-size', String(options.size));
    dom.board.style.setProperty('--cell-size', getResponsiveCellSize(options.size, window.innerWidth));

    for (let row = 0; row < options.size; row += 1) {
        for (let col = 0; col < options.size; col += 1) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = String(row);
            cell.dataset.col = String(col);

            if (stars.has(`${row},${col}`)) {
                cell.classList.add('star');
            }

            if (hintMove && hintMove.row === row && hintMove.col === col) {
                cell.classList.add('cell-hint');
            }

            if (coachSuggestion && coachSuggestion.row === row && coachSuggestion.col === col) {
                cell.classList.add('cell-coach');
            }

            if (coachFocus && coachFocus.row === row && coachFocus.col === col) {
                cell.classList.add('cell-coach-focus');
            }

            if (selectedCell && selectedCell.row === row && selectedCell.col === col) {
                cell.classList.add('cell-selected');
            }

            if (winningCellSet.has(`${row},${col}`)) {
                cell.classList.add('cell-winning');
            }

            const stoneColor = board[row][col];
            if (stoneColor) {
                const stone = document.createElement('div');
                stone.className = `stone ${stoneColor}`;

                if (lastMove && lastMove.row === row && lastMove.col === col) {
                    stone.classList.add('last', 'fresh');
                }

                if (winningCellSet.has(`${row},${col}`)) {
                    stone.classList.add('winner');
                }

                cell.appendChild(stone);
            }

            fragment.appendChild(cell);
        }
    }

    dom.board.appendChild(fragment);
}

export function updateStatus(dom, state) {
    const { currentPlayer, gameOver, moveHistory, lastMove } = state;
    const phase = getBoardPhase(moveHistory.length, gameOver);
    const isBlackTurn = currentPlayer === 'black';

    dom.status.currentPlayer.textContent = gameOver ? i18n.t('gameEnd') : getPlayerLabel(currentPlayer);
    dom.status.currentPlayer.classList.toggle('white', !gameOver && !isBlackTurn);
    dom.status.moveCount.textContent = String(moveHistory.length);
    dom.status.lastMove.textContent = lastMove
        ? `${getPlayerLabel(lastMove.color)} ${formatMove(lastMove.row, lastMove.col)}`
        : '-';
    dom.status.boardPhase.textContent = phase.label;

    dom.stage.phasePill.textContent = phase.pill;
    dom.stage.title.textContent = phase.title;
    dom.stage.subtitle.textContent = phase.subtitle;
    dom.stage.turnSpotlightText.textContent = gameOver
        ? phase.finishedSpotlight
        : isBlackTurn
            ? phase.blackSpotlight
            : phase.whiteSpotlight;
    dom.stage.turnSpotlight.className = `turn-spotlight ${gameOver ? 'turn-finished' : isBlackTurn ? 'turn-black' : 'turn-white'}`;
    dom.stage.momentumText.textContent = phase.momentumTitle;
    dom.stage.momentumNote.textContent = phase.momentumNote;

    document.body.classList.toggle('turn-black-active', !gameOver && isBlackTurn);
    document.body.classList.toggle('turn-white-active', !gameOver && !isBlackTurn);
    document.body.classList.toggle('game-finished', gameOver);
}

export function updateMoveList(dom, moveHistory) {
    if (moveHistory.length === 0) {
        dom.moveList.textContent = i18n.t('noMoves');
        return;
    }

    const lines = [];
    for (let index = 0; index < moveHistory.length; index += 2) {
        const blackMove = moveHistory[index];
        const whiteMove = moveHistory[index + 1];
        const turn = Math.floor(index / 2) + 1;

        let line = `${turn}. ${formatMove(blackMove.row, blackMove.col)}`;
        if (whiteMove) {
            line += `  ${formatMove(whiteMove.row, whiteMove.col)}`;
        }

        lines.push(line);
    }

    const fragment = document.createDocumentFragment();
    lines.forEach((line, index) => {
        fragment.appendChild(document.createTextNode(line));
        if (index < lines.length - 1) {
            fragment.appendChild(document.createElement('br'));
        }
    });
    dom.moveList.replaceChildren(fragment);
}

export function updateGuidance(dom, state, options) {
    const guidedMode = options.mode === 'qi';
    document.body.classList.toggle('guided-mode', guidedMode);

    if (!dom.guidance.card) {
        return;
    }

    dom.guidance.card.classList.toggle('hidden', !guidedMode);
    if (!guidedMode) {
        return;
    }

    dom.guidance.source.textContent = i18n.t(state.coachSource === 'llm' ? 'coachSourceLlm' : 'coachSourceLocal');
    dom.guidance.source.classList.toggle('coach-chip-llm', state.coachSource === 'llm');
    dom.guidance.status.textContent = getCoachStatusText(state.coachLlmStatus);
    dom.guidance.status.className = `coach-chip coach-status coach-status-${state.coachLlmStatus || 'disabled'}`;

    dom.guidance.move.textContent = state.coachSuggestion
        ? formatMove(state.coachSuggestion.row, state.coachSuggestion.col)
        : '-';
    dom.guidance.insight.textContent = state.coachInsight
        ? translateCoachText(state.coachInsight)
        : i18n.t('coachWaiting');
    dom.guidance.risk.textContent = state.coachRisk
        ? translateCoachText(state.coachRisk)
        : i18n.t('coachWaiting');
    renderCoachAlternatives(dom.guidance.alternatives, state.coachAlternatives || []);
    dom.guidance.alternativesWrap?.classList.toggle('hidden', !(state.coachAlternatives || []).length);
    dom.guidance.plan.textContent = state.coachPlan ? translateCoachText(state.coachPlan) : '';
    dom.guidance.planWrap?.classList.toggle('hidden', !state.coachPlan);
    dom.guidance.confidence.textContent = formatCoachConfidence(state.coachConfidence);
    dom.guidance.confidenceWrap?.classList.toggle('hidden', state.coachConfidence === null || state.coachConfidence === undefined);
    dom.guidance.feedback.textContent = state.coachFeedback ? i18n.t(state.coachFeedback) : '';
    dom.guidance.feedbackWrap.classList.toggle('hidden', !state.coachFeedback);
    if (dom.guidance.rerun) {
        dom.guidance.rerun.disabled = state.gameOver || state.aiThinking || !state.coachSuggestion;
    }
}

function renderCoachAlternatives(container, alternatives) {
    if (!container) {
        return;
    }

    container.replaceChildren();
    alternatives.forEach((move) => {
        const button = document.createElement('button');
        button.className = 'coach-candidate-btn';
        button.type = 'button';
        button.dataset.row = String(move.row);
        button.dataset.col = String(move.col);

        const moveText = document.createElement('span');
        moveText.className = 'coach-candidate-move';
        moveText.textContent = formatMove(move.row, move.col);
        button.appendChild(moveText);

        if (move.reason) {
            const reason = document.createElement('span');
            reason.className = 'coach-candidate-reason';
            reason.textContent = translateCoachText(move.reason);
            button.appendChild(reason);
        }

        container.appendChild(button);
    });
}

function getCoachStatusText(status) {
    switch (status) {
        case 'loading':
            return i18n.t('coachStatusLlmLoading');
        case 'ready':
            return i18n.t('coachStatusLlmReady');
        case 'unavailable':
            return i18n.t('coachStatusLlmUnavailable');
        case 'missing':
            return i18n.t('coachStatusLlmMissing');
        case 'disabled':
            return i18n.t('coachStatusLlmDisabled');
        default:
            return i18n.t('coachStatusLocal');
    }
}

function translateCoachText(text) {
    return i18n.t(String(text || ''));
}

function formatCoachConfidence(confidence) {
    if (confidence === null || confidence === undefined) {
        return '';
    }

    const normalized = Number(confidence);
    if (!Number.isFinite(normalized)) {
        return '';
    }

    return `${Math.round(Math.max(0, Math.min(1, normalized)) * 100)}%`;
}

export function updatePlacementPanel(dom, state) {
    if (!dom.placement.panel) {
        return;
    }

    const active = Boolean(state.awaitingPlacementConfirm && state.selectedCell && !state.gameOver);
    dom.placement.panel.classList.toggle('hidden', !active);
    document.body.classList.toggle('awaiting-placement', active);

    if (!active) {
        return;
    }

    dom.placement.move.textContent = formatMove(state.selectedCell.row, state.selectedCell.col);
    dom.placement.prompt.textContent = i18n.t('choosePointFirst');
}

export function setAIThinking(dom, isThinking) {
    dom.aiThinking.classList.toggle('hidden', !isThinking);
    document.body.classList.toggle('ai-active', isThinking);
}

export function showMessage(dom, text, type = 'info') {
    if (messageTimer !== null) {
        window.clearTimeout(messageTimer);
        messageTimer = null;
    }

    dom.message.textContent = text;
    dom.message.className = `message glass-panel ${type}`;
    dom.message.classList.remove('hidden', 'message-pop');
    void dom.message.offsetWidth;
    dom.message.classList.add('message-pop');

    messageTimer = window.setTimeout(() => {
        dom.message.classList.add('hidden');
        messageTimer = null;
    }, 3000);
}

export function showResultOverlay(dom, summary) {
    dom.result.badge.textContent = summary.badge;
    dom.result.title.textContent = summary.title;
    dom.result.detail.textContent = summary.detail;
    dom.result.moves.textContent = String(summary.moves);
    dom.result.lastMove.textContent = summary.lastMove;
    dom.result.overlay.classList.remove('hidden', 'result-win', 'result-draw', 'result-resign');
    dom.result.overlay.classList.add(summary.variant);
    dom.result.overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('result-open');
}

export function hideResultOverlay(dom) {
    dom.result.overlay.classList.add('hidden');
    dom.result.overlay.classList.remove('result-win', 'result-draw', 'result-resign');
    dom.result.overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('result-open');
}

function getBoardPhase(moveCount, gameOver) {
    const lang = i18n.getLanguage();

    if (lang === 'en') {
        if (gameOver) {
            return {
                label: 'Game Finished',
                pill: 'Outcome Locked',
                title: 'The decisive move has landed',
                subtitle: 'Review the turning point.',
                blackSpotlight: 'Black is shaping the initiative',
                whiteSpotlight: 'White is looking for counterplay',
                finishedSpotlight: 'The winner is set. Review the turning point.',
                momentumTitle: 'Final review',
                momentumNote: 'Look back at the last few moves.'
            };
        }

        if (moveCount < 8) {
            return {
                label: 'Opening',
                pill: 'Opening Shape',
                title: 'Claim the center and key star points',
                subtitle: 'Build shape first, then fight for tempo.',
                blackSpotlight: 'Black is shaping the initiative',
                whiteSpotlight: 'White is looking for counterplay',
                finishedSpotlight: 'The winner is set. Review the turning point.',
                momentumTitle: 'Shape first',
                momentumNote: 'Watch space and tempo.'
            };
        }

        if (moveCount < 24) {
            return {
                label: 'Midgame',
                pill: 'Battle Rising',
                title: 'Attack and defense start to overlap',
                subtitle: 'Link threats and break shape.',
                blackSpotlight: 'Black is shaping the initiative',
                whiteSpotlight: 'White is looking for counterplay',
                finishedSpotlight: 'The winner is set. Review the turning point.',
                momentumTitle: 'Pressure is building',
                momentumNote: 'Track open threes, open fours, and forcing moves.'
            };
        }

        return {
            label: 'Endgame',
            pill: 'Winning Threats',
            title: 'One tempo loss can decide everything',
            subtitle: 'Answer the biggest threat first.',
            blackSpotlight: 'Black is shaping the initiative',
            whiteSpotlight: 'White is looking for counterplay',
            finishedSpotlight: 'The winner is set. Review the turning point.',
            momentumTitle: 'The winning move is near',
            momentumNote: 'Prioritize direct wins and forced lines.'
        };
    }

    if (gameOver) {
        return {
            label: '终局已定',
            pill: '胜负揭晓',
            title: '关键一手已经落定',
            subtitle: '复盘这一盘的转折。',
            blackSpotlight: '黑方正在塑造攻势',
            whiteSpotlight: '白方正在寻找反击点',
            finishedSpotlight: '胜负已定，复盘这一盘的关键转折。',
            momentumTitle: '终局复盘',
            momentumNote: '回看最后几手。'
        };
    }

    if (moveCount < 8) {
        return {
            label: '布局阶段',
            pill: '开局布局',
            title: '抢占天元与关键星位',
            subtitle: '先立形，再争先手。',
            blackSpotlight: '黑方正在塑造攻势',
            whiteSpotlight: '白方正在寻找反击点',
            finishedSpotlight: '胜负已定，复盘这一盘的关键转折。',
            momentumTitle: '棋势未定',
            momentumNote: '先看空间与节奏。'
        };
    }

    if (moveCount < 24) {
        return {
            label: '中盘拉扯',
            pill: '局势升温',
            title: '攻守开始交错，判断先后手',
            subtitle: '连威胁，拆对方。',
            blackSpotlight: '黑方正在塑造攻势',
            whiteSpotlight: '白方正在寻找反击点',
            finishedSpotlight: '胜负已定，复盘这一盘的关键转折。',
            momentumTitle: '压力上升',
            momentumNote: '留意活三、活四与先手。'
        };
    }

    return {
        label: '终盘决胜',
        pill: '决胜阶段',
        title: '一步失先，可能直接定胜负',
        subtitle: '先解最高威胁。',
        blackSpotlight: '黑方正在塑造攻势',
        whiteSpotlight: '白方正在寻找反击点',
        finishedSpotlight: '胜负已定，复盘这一盘的关键转折。',
        momentumTitle: '胜负临近',
        momentumNote: '优先算直接胜与强制手。'
    };
}
