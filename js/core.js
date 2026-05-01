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
    }

    initAudio() {
        // BGMの設定
        this.bgm = new Audio();
        this.bgm.crossOrigin = "anonymous"; 
        this.bgm.src = this.assetBase + "bgm-stage1.mp3";
        this.bgm.loop = true;
        this.bgm.volume = 0.4;

        // SEの設定
        this.sounds = {
            shot: new Audio(),
            explosion: new Audio(),
            hitHurt: new Audio()
        };
        
        Object.keys(this.sounds).forEach(key => {
            const s = this.sounds[key];
            s.crossOrigin = "anonymous";
            s.src = this.assetBase + `${key}.wav`;
            s.volume = (key === 'shot') ? 0.3 : 0.5;
        });
    }

    playBGM() { this.bgm?.play().catch(() => {}); }
    
    fadeOutBGM(duration = 2000) {
        if (!this.bgm) return;
        const startVolume = this.bgm.volume;
        const step = startVolume / (duration / 50);
        const interval = setInterval(() => {
            if (this.bgm.volume > step) {
                this.bgm.volume -= step;
            } else {
                this.bgm.volume = 0;
                this.bgm.pause();
                clearInterval(interval);
            }
        }, 50);
    }

    resetBGM() {
        if (!this.bgm) return;
        this.bgm.currentTime = 0;
        this.bgm.volume = 0.4;
    }

    // SE再生
    playShot() { this._playSound('shot'); }
    playExplosion() { this._playSound('explosion'); }
    playHitSound(){ this._playSound('hitHurt'); }

    _playSound(key) {
        const s = this.sounds[key];
        if (s) {
            s.currentTime = 0;
            s.play().catch(() => {});
        }
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
            if (s.y > this.height) s.y = 0; 
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