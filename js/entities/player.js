/*
 * PROJECT: VOID-CIRCUIT
 *
 * entities/enemy.自機クラス
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */
class Player extends Entity {
constructor(game, x, y) {
        super(x, y, 32, 32);
        this.speed = 5;
        this.alive = true;
        this.invincibleTimer = 0;

        // ★ 修正ポイント：AssetManagerから画像を取得
        const fileName = "player.webp"; // または "player.webp"
        this.image = game.assets.get(fileName);
        
        // すでに preloadAssets で読み込み済みなので、即座に true にできる
        this.isLoaded = !!this.image;
    }

    /** プレイヤーの入力と状態に応じて位置を更新する */
    update(input, cw, ch) {
        if (!this.alive) return;
        if (this.invincibleTimer > 0) this.invincibleTimer--;

        // キーボード操作
        if (input.isPressed('ArrowUp') && this.y > 0) this.y -= this.speed;
        if (input.isPressed('ArrowDown') && this.y < ch - this.height) this.y += this.speed;
        if (input.isPressed('ArrowLeft') && this.x > 0) this.x -= this.speed;
        if (input.isPressed('ArrowRight') && this.x < cw - this.width) this.x += this.speed;

        // タッチ操作（バウンド慣性付き）
        if (input.isTouching && input.touchX !== null) {
            this.handleTouchMove(input.touchX, input.touchY, cw, ch);
        }
    }

    /** タッチ入力時の慣性付き移動を計算する */
    handleTouchMove(tx, ty, cw, ch) {
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

    /** プレイヤーを描画する（無敵状態では点滅する） */
    draw(ctx) {
        if (!this.alive) return;    // 死んでたら非表示
        if (this.invincibleTimer > 0 && Math.floor(this.invincibleTimer / 5) % 2 === 0) return;        // 点滅

        if (this.isLoaded) {
            ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
        } else {
            ctx.fillStyle = '#0FF';
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
    }

    setInvincible(frames) { this.invincibleTimer = frames; }
    get isInvincible() { return this.invincibleTimer > 0; }
}

/**
 * 弾クラス（自機用）
 */
class Bullet {
    // 第3引数に vx を追加（デフォルトは0）
    constructor(x, y, vx = 0) {
        this.x = x;
        this.y = y;
        this.vx = vx; // 横方向の速度
        this.vy = -7; // 縦方向の速度（上へ）
        this.width = 4;
        this.height = 10;
        this.active = true;
    }

    update(game) {
        this.x += this.vx; // 横に動かす
        this.y += this.vy; // 縦に動かす

        // 画面外に出たら消す
        if (this.y < -20 || this.x < -20 || this.x > game.width + 20) {
            this.active = false;
        }
    }

    draw(ctx) {
        ctx.fillStyle = '#FF0';
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}
