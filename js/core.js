/**
 * 入力管理：キーボードとタッチの両方に対応
 */
class InputManager {
    constructor(canvas) {
        this.keys = {};
        this.touchX = null;
        this.touchY = null;
        this.isTouching = false;

        // キーボード
        window.addEventListener('keydown', (e) => this.keys[e.code] = true);
        window.addEventListener('keyup', (e) => this.keys[e.code] = false);

        // タッチ / マウス共通処理
        const handleTouch = (e) => {
            if (!canvas) return; // キャンバスがない時は無視
            const rect = canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            this.touchX = (clientX - rect.left) * (canvas.width / rect.width);
            this.touchY = (clientY - rect.top) * (canvas.height / rect.height);
        };

        canvas.addEventListener('mousedown', (e) => { this.isTouching = true; handleTouch(e); });
        window.addEventListener('mousemove', (e) => { if (this.isTouching) handleTouch(e); });
        window.addEventListener('mouseup', () => { this.isTouching = false; });

        canvas.addEventListener('touchstart', (e) => { 
            this.isTouching = true; 
            handleTouch(e); 
            if(e.cancelable) e.preventDefault(); 
        }, {passive: false});
        canvas.addEventListener('touchmove', (e) => { 
            handleTouch(e); 
            if(e.cancelable) e.preventDefault(); 
        }, {passive: false});
        canvas.addEventListener('touchend', () => { this.isTouching = false; });
    }
    isPressed(keyCode) { return !!this.keys[keyCode]; }
}

/**
 * オーディオ管理
 */
class AudioManager {
    constructor(assetBase) {
        this.assetBase = assetBase;
        this.bgm = null;
        this.sounds = {};
        this.bgms = {}; // BGM用のコンテナ
        this.seKeys = [];
        this.bgmKeys = []; // BGMのキーリスト
    }

    initAudio() {
        // BGMの設定
        const bgmFiles = {
            'stage1': 'bgm-stage1.mp3'
        };
        const soundVolumes = {
            shot: 0.3,
            explosion: 0.3,
            hitHurt: 0.5,
            powerUp: 0.7
            // 今後新しいSEが増えても、ここに追加するだけでOK
        };

        Object.keys(bgmFiles).forEach(key => {
            const audio = new Audio();
            audio.crossOrigin = "anonymous";
            audio.src = this.assetBase + bgmFiles[key];
            audio.loop = true;
            audio.volume = 0.7;
            this.bgms[key] = audio;
        });
        this.bgmKeys = Object.keys(this.bgms);
        
        // SEの設定
        this.sounds = {
            shot: new Audio(),
            explosion: new Audio(),
            hitHurt: new Audio(),
            powerUp: new Audio()
        };

        Object.keys(this.sounds).forEach(key => {
            const s = this.sounds[key];
            s.crossOrigin = "anonymous";
            s.src = this.assetBase + `${key}.wav`;
            
            // 設定があればそれを使い、なければデフォルト（0.5）にする
            s.volume = soundVolumes[key] !== undefined ? soundVolumes[key] : 0.5;
        });        

        this.seKeys = Object.keys(this.sounds);
    }

    playBGM(key) {
        this.stopAllBGM();
        this.currentBgm = this.bgms[key];
        if (this.currentBgm) {
            this.currentBgm.currentTime = 0;
            this.currentBgm.play().catch(() => {});
        }
    }

    stopAllBGM() {
        Object.values(this.bgms).forEach(b => {
            b.pause();
        });
    }

    // --- サウンドテスト用：BGMをインデックスで再生 ---
    playBGMByIndex(index) {
        const key = this.bgmKeys[index];
        this.playBGM(key);
    }

    get bgmCount() { return this.bgmKeys.length; }
    getBGMName(index) { return this.bgmKeys[index] ? this.bgmKeys[index].toUpperCase() : "NONE"; }

    // フェードアウト
    fadeOutBGM(duration = 2000) {
        // currentBgm（今鳴っている曲）がなければ何もしない
        if (!this.currentBgm) return;

        const targetBgm = this.currentBgm; // 途中で曲が変わっても大丈夫なように保持
        const startVolume = targetBgm.volume;
        const step = startVolume / (duration / 50);

        const interval = setInterval(() => {
            if (targetBgm.volume > step) {
                targetBgm.volume -= step;
            } else {
                targetBgm.volume = 0;
                targetBgm.pause();
                clearInterval(interval);
                // フェードアウトが終わったら現在のBGM参照をクリア
                if (this.currentBgm === targetBgm) this.currentBgm = null;
            }
        }, 50);
    }

    // リセット
    resetBGM() {
        // 全てのBGMを停止して音量を戻しておく
        Object.values(this.bgms).forEach(b => {
            b.pause();
            b.currentTime = 0;
            b.volume = 0.7; // initAudioで設定したデフォルト値
        });
        this.currentBgm = null;
    }

    // SE再生
    playShot() { this._playSound('shot'); }
    playExplosion() { this._playSound('explosion'); }
    playHitSound(){ this._playSound('hitHurt'); }
    playPowerUp(){ this._playSound('powerUp'); }

    _playSound(key) {
        const s = this.sounds[key];
        if (s) {
            s.currentTime = 0;
            s.play().catch(() => {});
        }
    }

    playSEByIndex(index) {
        const key = this.seKeys[index];
        if (key) {
            this._playSound(key);
        }
    }

    get seCount() {
        return this.seKeys.length;
    }
    getSEName(index) {
        return this.seKeys[index] ? this.seKeys[index].toUpperCase() : "NONE";
    }
}

/**
 * 背景：星が流れるエフェクト
 */
class Starfield {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.starsLayer1 = this.createStars(40, 1);
        this.starsLayer2 = this.createStars(20, 3);
    }
    createStars(count, speed) {
        const stars = [];
        for (let i = 0; i < count; i++) {
            stars.push({ 
                x: Math.random() * this.width, 
                y: Math.random() * this.height, 
                speed: speed + (Math.random() * 0.5) 
            });
        }
        return stars;
    }
    update() {
        const move = (stars) => stars.forEach(s => { 
            s.y += s.speed; 
            if (s.y > this.height) s.y = -2; 
        });
        move(this.starsLayer1);
        move(this.starsLayer2);
    }
    draw(ctx) {
        ctx.fillStyle = '#888'; 
        this.starsLayer1.forEach(s => ctx.fillRect(s.x, s.y, 1, 1));
        ctx.fillStyle = '#FFF'; 
        this.starsLayer2.forEach(s => ctx.fillRect(s.x, s.y, 2, 2));
    }
}