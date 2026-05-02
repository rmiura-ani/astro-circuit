/**
 * 入力管理：キーボード、マウス、タッチを統合
 */
class InputManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.keys = {};
        this.touchX = null;
        this.touchY = null;
        this.isTouching = false;

        this.setupEventListeners();
    }

    setupEventListeners() {
        // キーボード
        window.addEventListener('keydown', (e) => this.keys[e.code] = true);
        window.addEventListener('keyup', (e) => this.keys[e.code] = false);

        // マウス/タッチ共通：座標計算をメソッド化
        const updatePos = (e) => this.handleCoordinate(e);

        // マウス
        this.canvas.addEventListener('mousedown', (e) => { this.isTouching = true; updatePos(e); });
        window.addEventListener('mousemove', (e) => { if (this.isTouching) updatePos(e); });
        window.addEventListener('mouseup', () => { this.isTouching = false; });

        // タッチ
        this.canvas.addEventListener('touchstart', (e) => {
            this.isTouching = true;
            updatePos(e);
            if (e.cancelable) e.preventDefault();
        }, { passive: false });

        this.canvas.addEventListener('touchmove', (e) => {
            updatePos(e);
            if (e.cancelable) e.preventDefault();
        }, { passive: false });

        this.canvas.addEventListener('touchend', () => { this.isTouching = false; });
    }

    handleCoordinate(e) {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        // スケーリングを考慮した座標変換
        this.touchX = (clientX - rect.left) * (this.canvas.width / rect.width);
        this.touchY = (clientY - rect.top) * (this.canvas.height / rect.height);
    }

    isPressed(keyCode) { return !!this.keys[keyCode]; }
}

/**
 * オーディオ管理：BGMとSEのライフサイクルを制御
 */
class AudioManager {
    constructor(assetBase) {
        this.assetBase = assetBase;
        this.currentBgm = null;
        this.sounds = {};
        this.bgms = {};
        
        // 設定定義（ここを増やすだけで自動ロードされる）
        this.CONFIG = {
            BGM: { 'stage1': 'bgm-stage1.mp3' },
            SE: {
                shot:      { file: 'shot.wav',      vol: 0.3 },
                explosion: { file: 'explosion.wav', vol: 0.3 },
                hitHurt:   { file: 'hitHurt.wav',   vol: 0.5 },
                powerUp:   { file: 'powerUp.wav',   vol: 0.7 }
            }
        };

        this.bgmKeys = Object.keys(this.CONFIG.BGM);
        this.seKeys = Object.keys(this.CONFIG.SE);
    }

    initAudio() {
        // BGMロード
        this.bgmKeys.forEach(key => {
            const audio = new Audio(this.assetBase + this.CONFIG.BGM[key]);
            audio.crossOrigin = "anonymous";
            audio.loop = true;
            audio.volume = 0.7;
            this.bgms[key] = audio;
        });

        // SEロード
        this.seKeys.forEach(key => {
            const conf = this.CONFIG.SE[key];
            const audio = new Audio(this.assetBase + conf.file);
            audio.crossOrigin = "anonymous";
            audio.volume = conf.vol;
            this.sounds[key] = audio;
        });
    }

    /** BGM再生 */
    playBGM(key) {
        this.stopAllBGM();
        this.currentBgm = this.bgms[key];
        if (this.currentBgm) {
            this.currentBgm.currentTime = 0;
            this.currentBgm.volume = 0.7; // フェード後などを考慮してリセット
            this.currentBgm.play().catch(() => {});
        }
    }

    stopAllBGM() {
        Object.values(this.bgms).forEach(b => {
            b.pause();
            b.currentTime = 0;
        });
    }

    resetBGM() {
        this.stopAllBGM();
        this.currentBgm = null;
    }

    fadeOutBGM(duration = 2000) {
        if (!this.currentBgm) return;

        const target = this.currentBgm;
        const startVol = target.volume;
        const intervalTime = 50;
        const steps = duration / intervalTime;
        const volStep = startVol / steps;

        const timer = setInterval(() => {
            if (target.volume > volStep) {
                target.volume -= volStep;
            } else {
                target.volume = 0;
                target.pause();
                clearInterval(timer);
            }
        }, intervalTime);
    }

    /** SE再生 */
    _playSE(key) {
        const s = this.sounds[key];
        if (s) {
            s.currentTime = 0;
            s.play().catch(() => {});
        }
    }

    // ショートカットメソッド
    playShot() { this._playSE('shot'); }
    playExplosion() { this._playSE('explosion'); }
    playHitSound() { this._playSE('hitHurt'); }
    playPowerUp() { this._playSE('powerUp'); }

    // サウンドテスト用
    playBGMByIndex(idx) { this.playBGM(this.bgmKeys[idx]); }
    playSEByIndex(idx) { this._playSE(this.seKeys[idx]); }

    get bgmCount() { return this.bgmKeys.length; }
    get seCount() { return this.seKeys.length; }
    getBGMName(idx) { return this.bgmKeys[idx]?.toUpperCase() || "NONE"; }
    getSEName(idx) { return this.seKeys[idx]?.toUpperCase() || "NONE"; }
}

/**
 * 背景：多重スクロールする星屑
 */
class Starfield {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        // Layer1: 遠くの星（遅い・小さい）、Layer2: 近くの星（速い・大きい）
        this.layers = [
            { count: 40, size: 1, speed: 1.0, color: '#888', stars: [] },
            { count: 20, size: 2, speed: 3.0, color: '#FFF', stars: [] }
        ];
        
        this.layers.forEach(layer => {
            for (let i = 0; i < layer.count; i++) {
                layer.stars.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    s: layer.speed + (Math.random() * 0.5)
                });
            }
        });
    }

    update() {
        this.layers.forEach(layer => {
            layer.stars.forEach(s => {
                s.y += s.s;
                if (s.y > this.height) s.y = -layer.size;
            });
        });
    }

    draw(ctx) {
        this.layers.forEach(layer => {
            ctx.fillStyle = layer.color;
            layer.stars.forEach(s => {
                ctx.fillRect(s.x, s.y, layer.size, layer.size);
            });
        });
    }
}