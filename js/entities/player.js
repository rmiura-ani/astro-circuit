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
    constructor(game, input, x, y) {
        super(x, y, 32, 32);
        this.game = game;
        this.input = input;
        this.speed = 5;
        this.alive = true;
        this._invincibleTimer = 0;

        this.weaponMode = 'STRAIGHT';      // 'STRAIGHT' または 'WIDE'
        this.shotCooldown = 0;             // 連射制限用クールダウンタイマー
        this.weaponSwitchReady = true;     // Xキーの押しっぱなしによる高速連打防止フラグ

        const fileName = "player.webp";
        this.image = game.assets.get(fileName);
        this.isLoaded = !!this.image;

        this.input.getAndResetCanvasOutClick()     // 1回読み捨て
    }

    setInvincible(frames) { this._invincibleTimer = frames; }
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

        // 3. 武器換装とショット自動生成の内部処理（引数から game を外す）
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
                this.game.weaponMode = this.weaponMode; // this.game を使用
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
            // 発射の基準点を自機の先端に設定
            const bx = this.x + this.width / 2;
            const by = this.y;

            if (this.weaponMode === 'STRAIGHT') {
                // 【STRAIGHT】: 8フレーム間隔で正面へ強力な2連射
                this.game.entities.push(new Bullet(bx - 8, by, 0)); // this.game を使用
                this.game.entities.push(new Bullet(bx + 4, by, 0)); 
                this.game.stats.shotsFired += 2; 
                this.shotCooldown = 8; // 8Fの硬直
            } else if (this.weaponMode === 'WIDE') {
                // 【WIDE】: 12フレーム間隔で扇状に広がる3方向拡散ショット
                this.game.entities.push(new Bullet(bx - 2, by, 0));    // this.game を使用
                this.game.entities.push(new Bullet(bx - 2, by, -3.5)); 
                this.game.entities.push(new Bullet(bx - 2, by, 3.5));  
                this.game.stats.shotsFired += 3; 
                this.shotCooldown = 12; // 12F의硬直
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
class Bullet {
    constructor(x, y, vx = 0) {
        this.x = x;
        this.y = y;
        this.vx = vx;  
        this.vy = -7;  
        this.width = 4;
        this.height = 10;
        this.active = true;
    }

    update(game) {
        this.x += this.vx; 
        this.y += this.vy; 

        if (this.y < -20 || this.x < -20 || this.x > game.width + 20) {
            this.active = false;
        }
    }

    draw(ctx) {
        ctx.fillStyle = '#FF0';
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}