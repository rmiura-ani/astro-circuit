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

/**
 * AudioManager: サウンドライフサイクル管理
 */
class AudioManager {
    constructor(basePath) {
        this.basePath = basePath;

        this.currentBgm = null;
        this.fadeInterval = null;
        this.sounds = {};
        this.bgms = {};
        
        this.CONFIG = {
            BGM: { 'stage1': 'bgm-stage1.ogg' },
            SE: {
                shot:      { file: 'shot.ogg',      vol: 0.3 },
                changeWp:  { file: 'changeWp.ogg',  vol: 0.8 },
                explosion: { file: 'explosion.ogg', vol: 0.3 },
                hitHurt:   { file: 'hitHurt.ogg',   vol: 0.5 },
                powerUp:   { file: 'powerUp.ogg',   vol: 0.7 },                
            }
        };

        this.bgmKeys = Object.keys(this.CONFIG.BGM);
        this.seKeys = Object.keys(this.CONFIG.SE);
    }

    async preloadAll() {
        const loadAud = (a) => new Promise(r => {
            if (!a || a.readyState >= 3) return r();
            a.addEventListener('canplaythrough', r, { once: true });
            a.addEventListener('error', () => r(), { once: true });
            a.load();
            setTimeout(r, 3000); // タイムアウト短縮
        });

        await Promise.all([
            ...Object.values(this.bgms).map(loadAud),
            ...Object.values(this.sounds).map(loadAud)
        ]);
        console.log("[Audio] Preload complete.");
    }

    initAudio() {
        this.bgmKeys.forEach(key => {
            const audio = new Audio(this.basePath + this.CONFIG.BGM[key]);
            audio.crossOrigin = "anonymous";
            audio.loop = true;
            audio.volume = 0.7;
            this.bgms[key] = audio;
        });

        this.seKeys.forEach(key => {
            const conf = this.CONFIG.SE[key];
            const audio = new Audio(this.basePath + conf.file);
            audio.crossOrigin = "anonymous";
            audio.volume = conf.vol;
            this.sounds[key] = audio;
        });
    }

    playBGM(key) {
        this.resetBGM(); // 既存のBGMとフェードをクリア
        this.currentBgm = this.bgms[key];
        if (this.currentBgm) {
            this.currentBgm.currentTime = 0;
            this.currentBgm.volume = 0.7;
            this.currentBgm.play().catch(e => console.warn("Autoplay blocked"));
        }
    }

    resetBGM() {
        if (this.fadeInterval) {
            clearInterval(this.fadeInterval);
            this.fadeInterval = null;
        }
        Object.values(this.bgms).forEach(b => {
            b.pause();
            b.currentTime = 0;
            b.volume = 0.7;
        });
        this.currentBgm = null;
    }

    fadeOutBGM(duration = 2000) {
        if (!this.currentBgm || this.fadeInterval) return;

        const target = this.currentBgm;
        const intervalTime = 50;
        const steps = duration / intervalTime;
        const volStep = target.volume / steps;

        this.fadeInterval = setInterval(() => {
            if (target.volume > volStep) {
                target.volume -= volStep;
            } else {
                target.volume = 0;
                target.pause();
                clearInterval(this.fadeInterval);
                this.fadeInterval = null;
            }
        }, intervalTime);
    }

    _playSE(key) {
        const s = this.sounds[key];
        if (s) {
            s.currentTime = 0;
            s.play().catch(() => {});
        }
    }

    // SE Shortcut Methods
    playShot() { this._playSE('shot'); }
    playChangeWp() { this._playSE('changeWp'); }
    playExplosion() { this._playSE('explosion'); }
    playHitSound() { this._playSE('hitHurt'); }
    playPowerUp() { this._playSE('powerUp'); }

    // Sound Test Helpers
    get bgmCount() { return this.bgmKeys.length; }
    get seCount() { return this.seKeys.length; }
    getBGMName(idx) { return this.bgmKeys[idx]?.toUpperCase() || "NONE"; }
    getSEName(idx) { return this.seKeys[idx]?.toUpperCase() || "NONE"; }
    playBGMByIndex(idx) { this.playBGM(this.bgmKeys[idx]); }
    playSEByIndex(idx) { this._playSE(this.seKeys[idx]); }
}
