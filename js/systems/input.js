/*
 * PROJECT: VOID-CIRCUIT
 *
 * systems.js
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */

/**
 * InputManager: 入力統合管理
 * キーボード、マウス、タッチの入力を正規化して保持します。
 */
class InputManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.keys = new Set(); // Setを使って重複を防止
        this.touchX = null;
        this.touchY = null;
        this.isTouching = false;

        this._setupEventListeners();
    }

    _setupEventListeners() {
        // キーボード
        window.addEventListener('keydown', (e) => this.keys.add(e.code));
        window.addEventListener('keyup', (e) => this.keys.delete(e.code));

        const updatePos = (e) => this._handleCoordinate(e);

        // マウス
        this.canvas.addEventListener('mousedown', (e) => { this.isTouching = true; updatePos(e); });
        window.addEventListener('mousemove', (e) => { if (this.isTouching) updatePos(e); });
        window.addEventListener('mouseup', () => { this.isTouching = false; });

        // タッチ (iOS/Android 向け最適化)
        const touchOptions = { passive: false };
        this.canvas.addEventListener('touchstart', (e) => {
            this.isTouching = true;
            updatePos(e);
            if (e.cancelable) e.preventDefault();
        }, touchOptions);

        this.canvas.addEventListener('touchmove', (e) => {
            updatePos(e);
            if (e.cancelable) e.preventDefault();
        }, touchOptions);

        this.canvas.addEventListener('touchend', () => { this.isTouching = false; });
    }

    _handleCoordinate(e) {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        // 論理サイズと実表示サイズの比率を計算
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        this.touchX = (clientX - rect.left) * scaleX;
        this.touchY = (clientY - rect.top) * scaleY;
    }

    isPressed(keyCode) { return this.keys.has(keyCode); }
}