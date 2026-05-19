/**
 * 交互处理器
 * 处理射线检测、坐标转换、点击和悬停事件
 */

import * as THREE from 'three';
import { RENDER_CONFIG, worldToBoard } from '../config/renderConfig.js';

// 点击与拖拽区分阈值（像素）
const DRAG_THRESHOLD = 5;

export class InteractionHandler {
    constructor(sceneManager, options = {}) {
        this.sceneManager = sceneManager;
        this.camera = sceneManager.camera;
        this.scene = sceneManager.scene;
        this.renderer = sceneManager.renderer;
        this.config = options.config || RENDER_CONFIG;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.boardPlane = null;

        // 交互状态
        this.isDragging = false;
        this.isTouchDevice = false;
        this.dragStartPos = { x: 0, y: 0 };
        this.touchStartTime = 0;
        this.enabled = true;

        // 回调
        this.onCellClick = null;
        this.onCellHover = null;
        this.onCellLeave = null;

        // 当前悬停的格子
        this.currentHoverCell = null;
        this.boundHandleMouseDown = this.handleMouseDown.bind(this);
        this.boundHandleClick = this.handleClick.bind(this);
        this.boundHandleMouseMove = this.handleMouseMove.bind(this);
        this.boundHandleTouchStart = this.handleTouchStart.bind(this);
        this.boundHandleTouchEnd = this.handleTouchEnd.bind(this);
        this.boundHandleTouchMove = this.handleTouchMove.bind(this);

        this.init();
    }

    /**
     * 初始化交互
     */
    init() {
        this.createBoardPlane();
        this.detectTouchDevice();
        this.bindEvents();
    }

    /**
     * 创建用于射线检测的平面
     */
    createBoardPlane() {
        const { thickness } = this.config.board;
        // 创建一个水平面，用于射线检测
        const planeGeometry = new THREE.PlaneGeometry(100, 100);
        const planeMaterial = new THREE.MeshBasicMaterial({ visible: false });
        this.boardPlane = new THREE.Mesh(planeGeometry, planeMaterial);
        this.boardPlane.rotation.x = -Math.PI / 2;
        this.boardPlane.position.y = thickness / 2;
        this.boardPlane.name = 'interactionPlane';
        this.scene.add(this.boardPlane);
    }

    /**
     * 检测触摸设备
     */
    detectTouchDevice() {
        this.isTouchDevice = 'ontouchstart' in window ||
            navigator.maxTouchPoints > 0 ||
            navigator.msMaxTouchPoints > 0;
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        const domElement = this.renderer.domElement;

        // 鼠标事件
        domElement.addEventListener('mousedown', this.boundHandleMouseDown);
        domElement.addEventListener('click', this.boundHandleClick);
        domElement.addEventListener('mousemove', this.boundHandleMouseMove);

        // 触摸事件
        domElement.addEventListener('touchstart', this.boundHandleTouchStart, { passive: true });
        domElement.addEventListener('touchend', this.boundHandleTouchEnd, { passive: true });
        domElement.addEventListener('touchmove', this.boundHandleTouchMove, { passive: true });

        // 阻止右键菜单
        domElement.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    handleMouseDown(event) {
        this.dragStartPos = { x: event.clientX, y: event.clientY };
        this.isDragging = false;
    }

    /**
     * 更新棋盘大小（用于坐标转换）
     * @param {number} size 棋盘大小
     */
    updateBoardSize(size) {
        this.boardSize = size;
    }

    setEnabled(enabled) {
        this.enabled = enabled;
        if (!enabled) {
            this.clearHover();
        }
    }

    /**
     * 获取鼠标在归一化设备坐标中的位置
     * @param {MouseEvent|Touch} event
     */
    updateMousePosition(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        const clientX = event.clientX;
        const clientY = event.clientY;

        this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    }

    /**
     * 处理点击事件
     * @param {MouseEvent} event
     */
    handleClick(event) {
        if (!this.enabled) {
            return;
        }

        // 如果是拖拽，忽略点击
        if (this.isDragging) {
            this.isDragging = false;
            return;
        }

        const cell = this.getCellFromEvent(event);
        if (cell && this.onCellClick) {
            this.onCellClick(cell.row, cell.col);
        }
    }

    /**
     * 处理鼠标移动
     * @param {MouseEvent} event
     */
    handleMouseMove(event) {
        if (!this.enabled) {
            this.clearHover();
            return;
        }

        // 检测拖拽
        if (event.buttons > 0) {
            const dx = event.clientX - this.dragStartPos.x;
            const dy = event.clientY - this.dragStartPos.y;
            if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
                this.isDragging = true;
            }
            return;
        }

        // 悬停检测
        const cell = this.getCellFromEvent(event);
        if (cell) {
            if (!this.currentHoverCell ||
                this.currentHoverCell.row !== cell.row ||
                this.currentHoverCell.col !== cell.col) {
                // 离开旧格子
                if (this.currentHoverCell && this.onCellLeave) {
                    this.onCellLeave(this.currentHoverCell.row, this.currentHoverCell.col);
                }
                // 进入新格子
                this.currentHoverCell = cell;
                if (this.onCellHover) {
                    this.onCellHover(cell.row, cell.col);
                }
            }
        } else {
            // 离开棋盘
            if (this.currentHoverCell && this.onCellLeave) {
                this.onCellLeave(this.currentHoverCell.row, this.currentHoverCell.col);
            }
            this.currentHoverCell = null;
        }

        this.dragStartPos = { x: event.clientX, y: event.clientY };
    }

    /**
     * 处理触摸开始
     * @param {TouchEvent} event
     */
    handleTouchStart(event) {
        if (!this.enabled) {
            return;
        }

        if (event.touches.length === 1) {
            const touch = event.touches[0];
            this.dragStartPos = { x: touch.clientX, y: touch.clientY };
            this.touchStartTime = Date.now();
            this.isDragging = false;
        }
    }

    /**
     * 处理触摸结束
     * @param {TouchEvent} event
     */
    handleTouchEnd(event) {
        if (!this.enabled) {
            return;
        }

        const touchDuration = Date.now() - this.touchStartTime;

        // 短暂触摸且非拖拽视为点击
        if (!this.isDragging && touchDuration < 300) {
            const touch = event.changedTouches[0];
            const fakeEvent = { clientX: touch.clientX, clientY: touch.clientY };
            const cell = this.getCellFromEvent(fakeEvent);

            if (cell && this.onCellClick) {
                this.onCellClick(cell.row, cell.col);
            }
        }

        this.isDragging = false;
    }

    /**
     * 处理触摸移动
     * @param {TouchEvent} event
     */
    handleTouchMove(event) {
        if (!this.enabled) {
            return;
        }

        if (event.touches.length === 1) {
            const touch = event.touches[0];
            const dx = touch.clientX - this.dragStartPos.x;
            const dy = touch.clientY - this.dragStartPos.y;

            if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
                this.isDragging = true;
            }
        }
    }

    /**
     * 从事件获取棋盘格子
     * @param {MouseEvent|Touch} event
     * @returns {{row: number, col: number} | null}
     */
    getCellFromEvent(event) {
        this.updateMousePosition(event);
        this.raycaster.setFromCamera(this.mouse, this.camera);

        const intersects = this.raycaster.intersectObject(this.boardPlane);

        if (intersects.length > 0) {
            const point = intersects[0].point;
            const { cellSize } = this.config.board;

            if (this.boardSize) {
                return worldToBoard(point.x, point.z, this.boardSize, cellSize);
            }
        }

        return null;
    }

    /**
     * 清除当前悬停状态
     */
    clearHover() {
        if (this.currentHoverCell && this.onCellLeave) {
            this.onCellLeave(this.currentHoverCell.row, this.currentHoverCell.col);
        }
        this.currentHoverCell = null;
    }

    /**
     * 销毁
     */
    dispose() {
        const domElement = this.renderer.domElement;
        domElement.removeEventListener('mousedown', this.boundHandleMouseDown);
        domElement.removeEventListener('click', this.boundHandleClick);
        domElement.removeEventListener('mousemove', this.boundHandleMouseMove);
        domElement.removeEventListener('touchstart', this.boundHandleTouchStart);
        domElement.removeEventListener('touchend', this.boundHandleTouchEnd);
        domElement.removeEventListener('touchmove', this.boundHandleTouchMove);

        if (this.boardPlane) {
            this.scene.remove(this.boardPlane);
            this.boardPlane.geometry.dispose();
            this.boardPlane.material.dispose();
        }
    }
}
