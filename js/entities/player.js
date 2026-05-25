/*
 * PROJECT: VOID-CIRCUIT
 *
 * entities/enemy.自機クラス
 *
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */
/**
 * プレイヤーが操作する自機クラス
 */
class Player extends Entity {
    // --- 調整用定数（マジックナンバーの共通管理） ---
    static START_WIDTH = 32;       // 自機の幅
    static START_HEIGHT = 32;      // 自機の高さ
    static DEFAULT_SPEED = 5;      // 移動速度
    static HIT_RADIUS = 10; // 当たり判定の半径
    
    static CD_STRAIGHT = 8;        // STRAIGHT時の連射クールダウン(フレーム)
    static CD_WIDE = 12;           // WIDE時の連射クールダウン(フレーム)
    

    constructor(game, input, x, y) {
        super(x, y, Player.START_WIDTH, Player.START_HEIGHT);
        this.halfWidth = this.width / 2;
        this.halfHeight = this.height / 2;
        this.hitRadiusSq = Player.HIT_RADIUS * Player.HIT_RADIUS;
        
        this.game = game;
        this.input = input;
        this.speed = Player.DEFAULT_SPEED;
        this.alive = true;
        this._invincibleTimer = 0;

        this.weaponMode = 'STRAIGHT';      // 'STRAIGHT' または 'WIDE'
        this.shotCooldown = 0;             // 連射制限用クールダウンタイマー
        this.weaponSwitchReady = true;     // Xキーの押しっぱなしによる高速連打防止フラグ

        this.image = new Image();;
        this.image.onload = () => {
            this.isLoaded = true;
        };
        this.image.src = `${game.sc.assetBase}player.webp`;
        this.input.getAndResetCanvasOutClick();     // 1回読み捨て
    }

    get centerX() { return this.x + this.halfWidth; }
    get centerY() { return this.y + this.halfHeight; }    

    setInvincible(frames = GAME_CONFIG.PLAYER_SPAWN_INVINCIBLE_TIME) { this._invincibleTimer = frames; }
    get isInvincible() { return this._invincibleTimer > 0; }
    
    // --- 武器制御 ---
    set weaponMode(val) {
        this._weaponMode = val;
        this._updateWeaponUI();
    }
    get weaponMode() { return this._weaponMode; }

    _updateWeaponUI() {
        const weaponContainer = document.getElementById('weapon-container');
        const displayEl = document.getElementById('weapon-display');
        const hintEl = document.getElementById('weapon-hint');
        if (displayEl) {
            displayEl.innerText = `WEAPON: ${this.weaponMode}`;
            displayEl.className = (this.weaponMode === 'WIDE') ? 'mode-wide' : '';
        }
        if (hintEl) hintEl.innerText = '[X]Key OR TAP SIDE-UI TO CHANGE';
        if (weaponContainer) weaponContainer.style.display = 'block';
    }

    /** プレイヤーの入力と状態に応じて位置・武器・射撃を一括更新する */
    update(cw, ch) {
        if (!this.alive) return;
        if (this._invincibleTimer > 0) this._invincibleTimer--;

        // ショット用のクールダウンタイマーを進める
        if (this.shotCooldown > 0) this.shotCooldown--;

        // 1. キーボード操作による移動
        if (this.input.isPressed('ArrowUp') && this.y > 0) this.y -= this.speed;
        if (this.input.isPressed('ArrowDown') && this.y < ch - this.height) this.y += this.speed;
        if (this.input.isPressed('ArrowLeft') && this.x > 0) this.x -= this.speed;
        if (this.input.isPressed('ArrowRight') && this.x < cw - this.width) this.x += this.speed;

        // 2. タッチ操作による移動（スマートフォン等の慣性付き移動）
        if (this.input.isTouching && this.input.touchX !== null) {
            this._handleTouchMove(this.input.touchX, this.input.touchY, cw, ch);
        }

        // 3. 武器換装とショット自動生成の内部処理
        this._handleWeaponSwitch(this.input);
        this._handleShooting(this.input);
    }

    /** 武器換装ロジック（Xキー）*/
    _handleWeaponSwitch(input) {
        if (!this.game.isRunning || !this.alive ) return;
        const isKeyboardTrigger = input.isPressed('KeyX') || input.isPressed('x') || input.isPressed('X');
        const isMouseTrigger = input.getAndResetCanvasOutClick(); 
        if (isKeyboardTrigger || isMouseTrigger) {
            if (this.weaponSwitchReady) {
                this.weaponMode = (this.weaponMode === 'STRAIGHT') ? 'WIDE' : 'STRAIGHT';
                this.game.weaponMode = this.weaponMode; 
                if (this.game.sc && this.game.sc.audio) this.game.sc.audio.playChangeWp();                 
                this.weaponSwitchReady = false; // キーが離されるまでロック
            }
        } else {
            this.weaponSwitchReady = true; // キーが離されたらロック解除
        }
    }

    /** ショット発射ロジック（Zキー / スペース / タッチ入力対応） */
    _handleShooting(input) {
        const isFiring = input.isPressed('KeyZ') || input.isPressed('Space') || input.isTouching;
        
        if (isFiring && this.shotCooldown === 0) {
            // 発射の基準点（自機の横方向の中心、および上端）を動的に計算
            const centerX = this.x + this.width / 2;
            const topY = this.y;

            if (this.weaponMode === 'STRAIGHT') {
                // 【STRAIGHT】: 正面へ強力な2連射
                // 弾の幅(4)を考慮し、中心から左右に均等に並ぶようオフセットを計算
                const offset = 6; 
                this.game.entities.push(new Bullet(centerX - offset, topY, 0)); 
                this.game.entities.push(new Bullet(centerX + (offset - Bullet.DEFAULT_WIDTH), topY, 0)); 
                
                this.game.stats.shotsFired += 2; 
                this.shotCooldown = Player.CD_STRAIGHT; 
            } else if (this.weaponMode === 'WIDE') {
                // 【WIDE】: 3方向拡散ショット
                // 中央の弾がちょうど自機の真ん中から出るよう、弾の幅の半分(Bullet.DEFAULT_WIDTH / 2)を引く
                const halfBulletW = Bullet.DEFAULT_WIDTH / 2;
                const bulletStartX = centerX - halfBulletW;

                this.game.entities.push(new Bullet(bulletStartX, topY, 0));    
                this.game.entities.push(new Bullet(bulletStartX, topY, -3.5)); 
                this.game.entities.push(new Bullet(bulletStartX, topY, 3.5));  
                
                this.game.stats.shotsFired += 3; 
                this.shotCooldown = Player.CD_WIDE; 
            }

            // ショットSEの再生
            if (this.game.sc && this.game.sc.audio) {
                this.game.sc.audio.playShot();
            }
        }
    }

    /** タッチ入力時の慣性付き移動を計算する */
    _handleTouchMove(tx, ty, cw, ch) {
        const targetX = tx - this.width / 2;
        const targetY = ty - this.height / 2;
        let vx = (targetX - this.x) * 0.2;
        let vy = (targetY - this.y) * 0.2;
        
        this.x += vx;
        this.y += vy;

        const bounce = 0.6;
        const limitX = cw - this.width / 2, limitY = ch - this.height / 2;
        const minPos = -this.width / 2;

        if (this.x < minPos) { this.x = minPos; this.x += Math.abs(vx) * bounce; }
        else if (this.x > limitX) { this.x = limitX; this.x -= Math.abs(vx) * bounce; }
        if (this.y < minPos) { this.y = minPos; this.y += Math.abs(vy) * bounce; }
        else if (this.y > limitY) { this.y = limitY; this.y -= Math.abs(vy) * bounce; }
    }

    /** プレイヤーを描画する（無敵状態では点滅する）*/
    draw(ctx) {
        if (!this.alive) return; 
        if (this._invincibleTimer > 0 && Math.floor(this._invincibleTimer / 5) % 2 === 0) return; // 高速点滅演出

        if (this.isLoaded) {
            ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
        } else {
            ctx.fillStyle = '#0FF';
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
    }
}

/**
 * 弾クラス（自機用）
 */
class Bullet extends Entity {
    // 弾の基本性能を定数化
    static DEFAULT_WIDTH = 4;
    static DEFAULT_HEIGHT = 10;
    static DEFAULT_VY = -7;

    constructor(x, y, vx = 0) {
        super(x, y, Bullet.DEFAULT_WIDTH, Bullet.DEFAULT_HEIGHT);

        this.vx = vx;  
        this.vy = Bullet.DEFAULT_VY;  

        this.halfWidth = this.width / 2;
        this.halfHeight = this.height / 2;
    }

    update(game) {
        this.x += this.vx; 
        this.y += this.vy; 

        if (this.isOutOfBounds(20)) {
            this.active = false;
        }
    }

    draw(ctx) {
        ctx.fillStyle = '#FF0';
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}