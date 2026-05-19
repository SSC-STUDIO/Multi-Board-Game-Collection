/** 沉浸式 HUD 控制器：管理桌面端沉浸式 UI 模式的鼠标跟踪/区域显隐 @module app/controllers/ImmersiveHudManager */

import { i18n } from '../../utils/i18n.js';

const IMMERSIVE_REGION_KEYS = ['top', 'left', 'right', 'bottom'];

/**
 * 沉浸式 HUD 管理器
 * 控制沉浸式 UI 模式下各个 HUD 区域（上/左/右/下）的显隐状态，
 * 通过鼠标位置或焦点事件自动切换区域可见性
 */
export class ImmersiveHudManager {
    /**
     * @param {import('../GomokuApp.js').GomokuApp} app - 应用主实例
     */
    constructor(app) {
        this.app = app;
    }

    /**
     * 检测当前设备是否支持沉浸式 UI（需非触摸设备、非纯触屏、宽屏 > 960px）
     * @returns {boolean} 是否支持沉浸式 UI
     */
    isImmersiveUiCapable() {
        const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
        const hoverless = window.matchMedia?.('(hover: none)').matches ?? false;
        return !coarsePointer && !hoverless && window.innerWidth > 960;
    }

    /**
     * 检测当前设备是否支持悬停交互（非触摸设备）
     * @returns {boolean} 是否支持悬停交互
     */
    isDesktopHoverUi() {
        const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
        const hoverless = window.matchMedia?.('(hover: none)').matches ?? false;
        return !coarsePointer && !hoverless && window.innerWidth > 960;
    }

    /**
     * 沉浸式 UI 当前是否激活（需启用、设备支持且游戏界面可见）
     * @returns {boolean} 沉浸式 UI 是否激活
     */
    isImmersiveUiActive() {
        return this.app.immersiveUiEnabled
            && this.app.immersiveUiCapable
            && !this.app.dom.sections.game.classList.contains('hidden');
    }

    /**
     * 刷新沉浸式 UI 切换按钮的状态和标签
     */
    refreshImmersiveToggle() {
        const button = this.app.dom.controls.immersiveToggle;
        const card = this.app.dom.hud.immersiveCard;
        if (!button) return;

        const available = this.app.immersiveUiCapable;
        const label = available
            ? i18n.t(this.app.immersiveUiEnabled ? 'immersiveUiOn' : 'immersiveUiOff')
            : i18n.t('immersiveUiUnavailable');

        this.app.settings.setButtonLabel(button, label);
        button.disabled = !available;
        button.setAttribute('aria-label', label);
        button.setAttribute('aria-pressed', this.app.immersiveUiEnabled ? 'true' : 'false');

        if (card) {
            card.classList.toggle('hidden', !available);
            if (!available) {
                card.textContent = i18n.t('immersiveUiUnavailable');
            }
        }

        const availableCards = this.app.dom.hud.left || this.app.dom.hud.right;
        if (availableCards) {
            availableCards.classList.toggle('panel-block-disabled', !available);
        }
    }

    /**
     * 切换沉浸式 UI 的启用/禁用状态
     */
    toggleImmersiveUi() {
        if (!this.app.immersiveUiCapable) {
            this.app.sound.play('error');
            return;
        }
        this.app.immersiveUiEnabled = !this.app.immersiveUiEnabled;
        this.app.settings.persistImmersiveUiPreference();
        if (this.app.immersiveUiEnabled) {
            this.app.sound.play('toggleOn');
            this.setImmersiveRegions({ top: true, left: true, right: true, bottom: true });
        } else {
            this.app.sound.play('toggleOff');
        }
        this.refreshImmersiveToggle();
        this.refreshImmersiveUi();
    }

    /**
     * 处理鼠标移动事件，更新沉浸式 UI 区域可见性
     * @param {MouseEvent} event - 鼠标事件对象
     */
    handleImmersivePointer(event) {
        this.app.lastImmersivePointer = { x: event.clientX, y: event.clientY };
        if (!this.isImmersiveUiActive()) return;
        this.updateImmersiveRects();
        this.updateImmersiveRegionsFromPoint(this.app.lastImmersivePointer);
    }

    /**
     * 处理焦点进入事件，根据焦点所在的 HUD 区域更新可见性
     * @param {FocusEvent} event - 焦点事件对象
     */
    handleImmersiveFocusIn(event) {
        if (!this.isImmersiveUiActive()) return;
        const target = event.target;
        this.setImmersiveRegions({
            top: Boolean(target.closest('.hud-top, .lang-switch')),
            left: Boolean(target.closest('.hud-left')),
            right: Boolean(target.closest('.hud-right')),
            bottom: Boolean(target.closest('.hud-bottom'))
        });
    }

    /**
     * 刷新沉浸式 UI 状态：更新 body class、根据指针位置或强制参数设置区域可见性
     * @param {{ forceAll?: boolean }} [options] - 选项
     * @param {boolean} [options.forceAll=false] - 是否强制显示所有区域
     */
    refreshImmersiveUi({ forceAll = false } = {}) {
        const active = this.isImmersiveUiActive();
        document.body.classList.toggle('immersive-ui-enabled', active);
        if (!active) {
            this.setImmersiveRegions({ top: true, left: true, right: true, bottom: true });
            return;
        }
        if (document.body.classList.contains('match-entering')) return;
        this.updateImmersiveRects();
        if (forceAll || !this.app.lastImmersivePointer) {
            this.setImmersiveRegions({ top: true, left: true, right: true, bottom: true });
            return;
        }
        this.updateImmersiveRegionsFromPoint(this.app.lastImmersivePointer);
    }

    /** 更新各 HUD 区域的边界矩形缓存 */
    updateImmersiveRects() {
        this.app.immersiveUiRects = {
            top: this.app.dom.hud.top?.getBoundingClientRect() ?? null,
            left: this.app.dom.hud.left?.getBoundingClientRect() ?? null,
            right: this.app.dom.hud.right?.getBoundingClientRect() ?? null,
            bottom: this.app.dom.hud.bottom?.getBoundingClientRect() ?? null,
            lang: this.app.dom.hud.langSwitch?.getBoundingClientRect() ?? null
        };
    }

    /**
     * 根据鼠标坐标点更新沉浸式区域可见性
     * @param {{ x: number, y: number }} point - 鼠标坐标
     */
    updateImmersiveRegionsFromPoint(point) {
        if (!point) {
            this.setImmersiveRegions({ top: true, left: true, right: true, bottom: true });
            return;
        }
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const edgeLeft = Math.max(152, Math.min(260, viewportWidth * 0.18));
        const edgeRight = viewportWidth - Math.max(168, Math.min(280, viewportWidth * 0.2));
        const edgeTop = Math.max(88, Math.min(146, viewportHeight * 0.14));
        const edgeBottom = viewportHeight - Math.max(92, Math.min(142, viewportHeight * 0.14));
        const regions = {
            top: point.y <= edgeTop
                || this.isPointNearRect(point, this.app.immersiveUiRects.top, 24)
                || this.isPointNearRect(point, this.app.immersiveUiRects.lang, 18),
            left: point.x <= edgeLeft
                || this.isPointNearRect(point, this.app.immersiveUiRects.left, 28),
            right: point.x >= edgeRight
                || this.isPointNearRect(point, this.app.immersiveUiRects.right, 28),
            bottom: point.y >= edgeBottom
                || this.isPointNearRect(point, this.app.immersiveUiRects.bottom, 22)
        };
        if (!this.app.dom.placement.panel.classList.contains('hidden')) {
            regions.bottom = true;
        }
        this.setImmersiveRegions(regions);
    }

    /**
     * 检测点是否靠近某个矩形区域（含内边距扩展）
     * @param {{ x: number, y: number }} point - 检测点坐标
     * @param {DOMRect|null} rect - 目标矩形
     * @param {number} [padding=20] - 外扩内边距像素
     * @returns {boolean} 点是否在矩形附近
     */
    isPointNearRect(point, rect, padding = 20) {
        if (!rect) return false;
        return point.x >= rect.left - padding
            && point.x <= rect.right + padding
            && point.y >= rect.top - padding
            && point.y <= rect.bottom + padding;
    }

    /**
     * 设置各沉浸式区域的可见性状态并同步到 body class
     * @param {{ top: boolean, left: boolean, right: boolean, bottom: boolean }} regions - 各区域显隐状态
     */
    setImmersiveRegions(regions) {
        IMMERSIVE_REGION_KEYS.forEach((region) => {
            const active = Boolean(regions[region]);
            this.app.immersiveUiRegions[region] = active;
            document.body.classList.toggle(`immersive-${region}-active`, active);
        });
    }
}
