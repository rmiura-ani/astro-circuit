/*
 * PROJECT: VOID-CIRCUIT
 *
 * entities/enemy.js　敵クラス（基本形）
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */

class Enemy extends Entity {
    constructor(game, x, y, bulletType, hp = 1) {
        super(x, y, 32, 32);
        this.bulletType = bulletType || 'aim';
        this.speed = 2;
        this.hp = hp;
        this.maxHp = hp;
        this.shootTimer = Math.random() * 60;
        this.baseShootInterval = 120; 
        this.fireRateMultiplier = 1.0;
        
        this.image = game.assets.get(this.imageName);
        // すでに倉庫に画像があるかどうかで判定する
        this.isLoaded = !!this.image; 
        this.loadError = !this.isLoaded; // 倉庫になければエラー扱い
        if (this.loadError) {
            console.warn(`[Asset Error] Failed to find: ${this.imageName}`);
        }
    }
    get imageName() { return "enemy_straight.webp"; }

    /** 敵の移動と攻撃を管理する */
    update(game) {
        this.y += this.speed;
        if (this.y > 480) {
            this.active = false;
            return;
        }
        if (this.active) {
            const isInFiringRange = this.y > 20 && this.y < 475;
            if (isInFiringRange) {
                this.shootTimer++;
                const currentInterval = this.baseShootInterval / this.fireRateMultiplier;
                if (this.shootTimer >= currentInterval) {
                    this.shoot(game);
                    this.shootTimer = 0;
                }
            }
        }
    }

    /** 指定の弾種で弾を発射する */
    shoot(game) {
        // ★ 修正：発射の基準点を「画像の中心」に完全移行
        const bx = this.x + this.width / 2;
        const by = this.y + this.height / 2; 

        // プレイヤーへの角度計算（ターゲットも中心を狙う）
        const targetX = game.player.x + game.player.width / 2;
        const targetY = game.player.y + game.player.height / 2;
        const angle = Math.atan2(targetY - by, targetX - bx);

        // 弾を生成する補助関数
        const spawn = (vx, vy) => game.entities.push(new EnemyBullet(bx, by, vx, vy));

        switch (this.bulletType) {
            case 'eight-way':
                for (let i = 0; i < 8; i++) {
                    const a = (Math.PI * 2 / 8) * i;
                    // 中心から全方位に均等に飛ばす
                    spawn(Math.cos(a) * 3, Math.sin(a) * 3);
                }
                break;
                
            case 'straight':
                spawn(0, 4);
                break;
                
            case 'triple':
                [-0.3, 0, 0.3].forEach(off => 
                    spawn(Math.cos(angle + off) * 3, Math.sin(angle + off) * 3)
                );
                break;
                
            case 'aim':
            default:
                spawn(Math.cos(angle) * 4, Math.sin(angle) * 4);
                break;
        }
    }

    /** ダメージを受けたときの状態を更新する */
    takeDamage(amount) {
        this.hp -= amount;
        if (this.hp <= 0) {
            this.active = false;
            return true;
        }
        return false;
    }

    /** 敵を描画する */
    draw(ctx , isInvincibleCheat = false) {
        ctx.save();

        if (this.isLoaded && !this.loadError) {
            // 1. 画像が正常に読み込めている場合
            ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
        } else {
            // 2. 読み込み中、またはエラー（404等）の場合
            // 仮の■（プレースホルダー）を描画
            ctx.fillStyle = this.loadError ? '#F00' : '#444'; // エラーなら赤、読み込み中ならグレー
            ctx.strokeStyle = '#FFF';
            ctx.lineWidth = 2;
            
            // 四角形を描画
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.strokeRect(this.x, this.y, this.width, this.height);

            // エラー時のみ、中に「×」を表示してデバッグしやすくする
            if (this.loadError) {
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(this.x + this.width, this.y + this.height);
                ctx.moveTo(this.x + this.width, this.y);
                ctx.lineTo(this.x, this.y + this.height);
                ctx.stroke();
            }
        }
        if (isInvincibleCheat) {
            ctx.strokeStyle = 'lime';
            const hw = this.hitWidth || this.width;
            const hh = this.hitHeight || this.height;
            ctx.strokeRect(
                this.x + (this.width - hw) / 2, 
                this.y + (this.height - hh) / 2, 
                hw, hh
            );
        }

        ctx.restore();
    }

    // 通常演出（特殊演出は各クラスで上書き）
    onDie(game) {
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;
        game.createExplosion(centerX, centerY, this);
    }
}


/**
 * 敵の弾クラス
 */
class EnemyBullet extends Entity {
    constructor(x, y, vx, vy) {
        super(x, y, 4, 4); // 判定は 4x4
        this.vx = vx;
        this.vy = vy;
        this.renderRadius = 3; // 見た目の半径は 3（直径6）
    }
    /** 敵弾の移動更新と画面外判定 */
    update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.isOutOfBounds()) this.active = false;
    }
    /** 敵弾を描画する */
    draw(ctx) {
        ctx.fillStyle = '#F0F';
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.renderRadius, 0, Math.PI * 2);
        ctx.fill();
    }
}
