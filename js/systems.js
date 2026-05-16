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
        this.currentBgmFileName = "";
        this.fadeInterval = null;
        this.bgms = {};
        this.sounds = {};

        // 起動時は空っぽにしておく
        this.DYNAMIC_BGM_LIST = []; 
        this.CONFIG = {
            SE: {
                shot:      { file: 'shot.ogg',      vol: 0.3 },
                changeWp:  { file: 'changeWp.ogg',  vol: 0.8 },
                explosion: { file: 'explosion.ogg', vol: 0.3 },
                hitHurt:   { file: 'hitHurt.ogg',   vol: 0.5 },
                powerUp:   { file: 'powerUp.ogg',   vol: 0.7 },                
            }
        };
        this.seKeys = Object.keys(this.CONFIG.SE);
    }

    /** Controllerから動的に構築されたBGMリストを受け取る */
    setDynamicBGMList(list) {
        this.DYNAMIC_BGM_LIST = list; 
    }

    /** SE初期化 */
    initAudio() {
        this.seKeys.forEach(key => {
            const conf = this.CONFIG.SE[key];
            const audio = new Audio(this.basePath + conf.file);
            audio.crossOrigin = "anonymous";
            audio.volume = conf.vol;
            this.sounds[key] = audio;
        });
    }
    
    /** 起動時のSEプリロード */
    async preloadAll() {
        const loadAud = (a) => new Promise(r => {
            if (!a || a.readyState >= 3) return r();
            a.addEventListener('canplaythrough', r, { once: true });
            a.addEventListener('error', () => r(), { once: true });
            a.load();
            setTimeout(r, 3000);
        });
        await Promise.all([
            ...Object.values(this.sounds).map(loadAud)
        ]);
        console.log("[Audio] System SE Preload complete.");
    }

    /** ステージ開始時に呼ばれる、特定のBGMの動的ロード */
    async loadStageBGM(fileName) {
        if (!fileName) return null;
        
        // すでに一度読み込んだことがあるBGMならキャッシュを返す
        if (this.bgms[fileName]) {
            return this.bgms[fileName];
        }
        
        return new Promise((resolve) => {
            const audio = new Audio(this.basePath + fileName);
            audio.crossOrigin = "anonymous";
            audio.loop = true;
            audio.volume = 0.7;

            let isResolved = false;

            // 読み込み完了を待つ
            audio.addEventListener('canplaythrough', () => {
                if (isResolved) return;
                isResolved = true;
                this.bgms[fileName] = audio; // キャッシュに保存
                resolve(audio);
            }, { once: true });

            audio.addEventListener('error', () => {
                if (isResolved) return;
                isResolved = true;
                console.error(`[Audio] Failed to load BGM: ${fileName}`);
                resolve(null);
            }, { once: true });

            audio.load();

            // 【バグ修正】5秒タイムアウト時はキャッシュに壊れたデータを入れずに null を返す
            setTimeout(() => {
                if (isResolved) return;
                isResolved = true;
                console.warn(`[Audio] BGM load timeout: ${fileName}`);
                resolve(null);
            }, 5000);
        });
    }

    /** BGMの再生（ファイル名指定） */
    playBGM(fileName) {
        if (!fileName) return;

        // 同じ曲が既に流れている場合は何もしない（ボス戦後のループ時などのため）
        if (this.currentBgmFileName === fileName && this.currentBgm && !this.currentBgm.paused) {
            return;
        }

        this.resetBGM(); // 既存のBGMを完全停止

        this.currentBgm = this.bgms[fileName];
        this.currentBgmFileName = fileName;

        if (this.currentBgm) {
            this.currentBgm.currentTime = 0; // 再生直前に確実に頭出しを行う
            this.currentBgm.volume = 0.7;
            this.currentBgm.play().catch(e => console.warn("Autoplay blocked or audio not ready", e));
        } else {
            console.warn(`[Audio] BGM "${fileName}" is not loaded yet. Call loadStageBGM first.`);
        }
    }

    /** BGMリセット */
    resetBGM() {
        if (this.fadeInterval) {
            clearInterval(this.fadeInterval);
            this.fadeInterval = null;
        }
        // 動的にロードされた全BGMを安全に停止
        Object.values(this.bgms).forEach(b => {
            b.pause();
            b.volume = 0.7;
        });
        this.currentBgm = null;
        this.currentBgmFileName = "";
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

    /**
     * 【大改修】同一SEの重なり再生に対応した内部メソッド
     */
    _playSE(key) {
        const baseAudio = this.sounds[key];
        if (baseAudio) {
            // 元のAudioオブジェクトを複製（クローン）して同時発音数を無限化する
            const clone = baseAudio.cloneNode(true);
            clone.volume = baseAudio.volume; // 音量を引き継ぐ
            clone.play().catch(() => {});
            
            // 再生終了後にメモリから解放されるようにする
            clone.addEventListener('ended', () => {
                clone.remove();
            }, { once: true });
        }
    }

    playShot() { this._playSE('shot'); }
    playChangeWp() { this._playSE('changeWp'); }
    playExplosion() { this._playSE('explosion'); }
    playHitSound() { this._playSE('hitHurt'); }
    playPowerUp() { this._playSE('powerUp'); }

    // Sound Test Helpers
    get bgmCount() { return this.DYNAMIC_BGM_LIST.length; }
    get seCount() { return this.seKeys.length; }
    getBGMName(idx) { return this.DYNAMIC_BGM_LIST[idx]?.displayName.toUpperCase() || "NONE"; }
    getSEName(idx) { return this.seKeys[idx]?.toUpperCase() || "NONE"; }
    
    async playBGMByIndex(idx) {
        const bgmData = this.DYNAMIC_BGM_LIST[idx];
        if (!bgmData) return;

        const fileName = bgmData.fileName;
        await this.loadStageBGM(fileName);
        this.playBGM(fileName);
    }
    playSEByIndex(idx) { this._playSE(this.seKeys[idx]); }
}