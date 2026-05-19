/** UI 渲染模块：视图同步、DOM 更新 @module ui/render */

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

/**
 * 同步设置面板的可见性与场景预览
 * 根据游戏模式显示/隐藏 AI 选项、颜色选择、LLM 设置
 * @param {Object} dom - DOM 元素引用集合
 * @param {import('../config/gameConfig.js').GameOptions} options - 游戏配置选项
 * @returns {void}
 */
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

// === Setup ===

/**
 * 显示设置界面并隐藏游戏界面
 * 重置 body 类名以切换到设置场景状态
 * @param {Object} dom - DOM 元素引用集合
 * @returns {void}
 */
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

/**
 * 显示游戏界面并隐藏设置界面
 * @param {Object} dom - DOM 元素引用集合
 * @returns {void}
 */
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

// === Status ===

/**
 * 更新游戏信息栏中的模式、规则、尺寸、场景标签
 * @param {Object} dom - DOM 元素引用集合
 * @param {import('../config/gameConfig.js').GameOptions} options - 游戏配置选项
 * @returns {void}
 */
export function updateMeta(dom, options) {
    dom.meta.mode.textContent = i18n.t(MODE_I18N_KEYS[options.mode] || options.mode);
    dom.meta.rule.textContent = i18n.t(RULE_I18N_KEYS[options.rule] || options.rule);
    dom.meta.size.textContent = `${options.size} x ${options.size}`;
    if (dom.meta.scene) {
        dom.meta.scene.textContent = i18n.t(SCENE_I18N_KEYS[options.scene] || options.scene);
    }
}

// === Board ===

/**
 * 渲染 2D 棋盘视图
 * 根据棋盘状态创建所有格子和棋子元素，并标记星位、提示、教练建议、选中和高亮
 * @param {Object} dom - DOM 元素引用集合
 * @param {import('../game/state.js').GameState} state - 游戏状态对象
 * @returns {void}
 */
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

/**
 * 更新游戏状态信息（当前玩家、步数、最后一步、阶段）
 * 同时更新舞台标题、回合聚光灯和 momentum 区域
 * @param {Object} dom - DOM 元素引用集合
 * @param {import('../game/state.js').GameState} state - 游戏状态对象
 * @returns {void}
 */
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

// === Move List ===

/**
 * 更新步数历史列表
 * 按回合分组显示黑白双方的落子记录
 * @param {Object} dom - DOM 元素引用集合
 * @param {Array<{row: number, col: number, color: string}>} moveHistory - 落子历史数组
 * @returns {void}
 */
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

// === Coach Guidance ===

/**
 * 更新教练面板（QI 模式）
 * 显示建议落子、替代方案、洞察、风险、计划、置信度和反馈
 * @param {Object} dom - DOM 元素引用集合
 * @param {import('../game/state.js').GameState} state - 游戏状态对象
 * @param {import('../config/gameConfig.js').GameOptions} options - 游戏配置选项
 * @returns {void}
 */
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
    syncCoachUploadButton(dom.guidance.upload, state.coachLlmStatus);
    updateCoachAnalyzePreview(dom, state);
    dom.guidance.importWrap?.classList.toggle('hidden', !state.coachAnalyzedBoard);
}

function syncCoachUploadButton(button, status) {
    if (!button) return;
    const analyzing = status === 'analyzing-image';
    button.dataset.mode = analyzing ? 'cancel' : 'upload';
    button.classList.toggle('is-canceling', analyzing);
    const ariaKey = analyzing ? 'coachAnalyzeCancel' : 'coachUploadImage';
    button.setAttribute('data-i18n-aria-label', ariaKey);
    button.setAttribute('aria-label', i18n.t(ariaKey));
    const label = button.querySelector('.btn-label')
        || button.querySelector('[data-i18n="coachUploadImage"]')
        || button.querySelector('[data-i18n="coachAnalyzeCancel"]');
    if (label) {
        const labelKey = analyzing ? 'coachAnalyzeCancel' : 'coachUploadImage';
        label.textContent = i18n.t(labelKey);
        label.setAttribute('data-i18n', labelKey);
    }
    button.disabled = false;
}

function updateCoachAnalyzePreview(dom, state) {
    const analyzed = state.coachAnalyzedBoard;
    const image = dom.guidance.analyzeImage;
    const countEl = dom.guidance.analyzeCount;
    const confidenceEl = dom.guidance.analyzeConfidence;
    const editBtn = dom.guidance.editBtn;
    const previewActions = dom.guidance.previewActions;
    const hasAnalysis = Boolean(analyzed && Array.isArray(analyzed.stones));

    if (image) {
        if (hasAnalysis && analyzed.imageDataUrl) {
            if (image.getAttribute('src') !== analyzed.imageDataUrl) {
                image.src = analyzed.imageDataUrl;
            }
            image.classList.remove('hidden');
        } else {
            image.removeAttribute('src');
            image.classList.add('hidden');
        }
    }

    if (countEl) {
        const count = hasAnalysis ? analyzed.stones.length : 0;
        countEl.textContent = i18n.t('coachStoneCount', { count });
    }

    if (confidenceEl) {
        const confidence = hasAnalysis ? Number(analyzed.confidence ?? state.coachConfidence) : null;
        if (Number.isFinite(confidence)) {
            const pct = Math.round(Math.max(0, Math.min(1, confidence)) * 100);
            confidenceEl.textContent = i18n.t('coachConfidenceLabel', { pct });
            confidenceEl.classList.remove('hidden');
        } else {
            confidenceEl.textContent = '';
            confidenceEl.classList.add('hidden');
        }
    }

    const inPreview = Boolean(state.coachPreviewMode);
    if (editBtn) {
        editBtn.classList.toggle('hidden', !hasAnalysis || inPreview);
        editBtn.disabled = !hasAnalysis;
    }
    if (dom.guidance.importBtn) {
        dom.guidance.importBtn.classList.toggle('hidden', !hasAnalysis || inPreview);
        dom.guidance.importBtn.disabled = !hasAnalysis;
    }
    if (previewActions) {
        previewActions.classList.toggle('hidden', !inPreview);
    }
    document.body.classList.toggle('coach-preview-active', inPreview);
}

/**
 * 渲染棋盘预览覆盖层（预览 & 编辑模式）。
 * 空/黑/白三态循环，半透明 + 虚线描边表示"待确认"。
 * @param {Object} dom - DOM 元素引用集合
 * @param {import('../game/state.js').GameState} state - 游戏状态
 * @returns {void}
 */
export function updateBoardPreviewOverlay(dom, state) {
    const overlay = dom.boardPreviewOverlay;
    if (!overlay) return;
    const active = Boolean(state.coachPreviewMode && state.coachPreviewBoard);
    overlay.classList.toggle('hidden', !active);
    overlay.setAttribute('aria-hidden', active ? 'false' : 'true');
    if (!active) {
        overlay.replaceChildren();
        overlay.style.removeProperty('--preview-size');
        overlay.style.removeProperty('--cell-size');
        return;
    }

    const preview = state.coachPreviewBoard;
    const size = preview.size;
    overlay.style.setProperty('--preview-size', String(size));
    overlay.style.setProperty('--cell-size', getResponsiveCellSize(size, window.innerWidth));

    const fragment = document.createDocumentFragment();
    for (let row = 0; row < size; row += 1) {
        for (let col = 0; col < size; col += 1) {
            const cell = document.createElement('div');
            cell.className = 'preview-cell';
            cell.dataset.row = String(row);
            cell.dataset.col = String(col);
            const color = preview.cells[row][col];
            if (color === 'black' || color === 'white') {
                const stone = document.createElement('div');
                stone.className = `preview-stone ${color}`;
                cell.appendChild(stone);
            } else {
                cell.classList.add('preview-empty');
            }
            fragment.appendChild(cell);
        }
    }
    overlay.replaceChildren(fragment);
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
        case 'analyzing-image':
            return i18n.t('coachAnalyzing');
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

/**
 * 更新落子确认面板（触摸屏双确认流程）
 * @param {Object} dom - DOM 元素引用集合
 * @param {import('../game/state.js').GameState} state - 游戏状态对象
 * @returns {void}
 */
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

// === Messages ===

/**
 * 设置 AI 思考状态的视觉指示
 * @param {Object} dom - DOM 元素引用集合
 * @param {boolean} isThinking - AI 是否正在思考
 * @returns {void}
 */
export function setAIThinking(dom, isThinking) {
    dom.aiThinking.classList.toggle('hidden', !isThinking);
    document.body.classList.toggle('ai-active', isThinking);
}

/**
 * 显示浮动消息提示
 * 自动在 3 秒后隐藏
 * @param {Object} dom - DOM 元素引用集合
 * @param {string} text - 消息文本
 * @param {'info'|'success'|'error'} [type='info'] - 消息类型
 * @returns {void}
 */
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

// === Result ===

/**
 * 显示游戏结果覆盖层
 * @param {Object} dom - DOM 元素引用集合
 * @param {{ badge: string, title: string, detail: string, moves: number, lastMove: string, variant: string }} summary - 结果摘要对象
 * @returns {void}
 */
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

/**
 * 隐藏游戏结果覆盖层
 * @param {Object} dom - DOM 元素引用集合
 * @returns {void}
 */
export function hideResultOverlay(dom) {
    dom.result.overlay.classList.add('hidden');
    dom.result.overlay.classList.remove('result-win', 'result-draw', 'result-resign');
    dom.result.overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('result-open');
}

function getBoardPhase(moveCount, gameOver) {
    const phase = gameOver ? 'GameOver' : moveCount < 8 ? 'Opening' : moveCount < 24 ? 'Midgame' : 'Endgame';
    return {
        label: i18n.t(`phase${phase}Label`),
        pill: i18n.t(`phase${phase}Pill`),
        title: i18n.t(`phase${phase}Title`),
        subtitle: i18n.t(`phase${phase}Subtitle`),
        blackSpotlight: i18n.t(`phase${phase}BlackSpotlight`),
        whiteSpotlight: i18n.t(`phase${phase}WhiteSpotlight`),
        finishedSpotlight: i18n.t(`phase${phase}FinishedSpotlight`),
        momentumTitle: i18n.t(`phase${phase}MomentumTitle`),
        momentumNote: i18n.t(`phase${phase}MomentumNote`)
    };
}
