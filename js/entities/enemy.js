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
    draw(ctx, isInvincibleCheat = false) {
        ctx.save();

        // 当たり判定スキップと完全に同じ条件（画面外、または上部30pxのHUDエリア内）
        if (
            this.y + this.height < 30 ||
            this.y >= GAME_CONFIG.HEIGHT ||
            this.x + this.width <= 0 ||
            this.x >= GAME_CONFIG.WIDTH
        ) {
            if (Math.floor(Date.now() / 33) % 2 === 0) {
                ctx.globalAlpha = 0.15;
            } else {
                ctx.globalAlpha = 0.60;
            }
        }

        if (this.isLoaded && !this.loadError) {
            // 1. 画像が正常に読み込めている場合
            ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
        } else {
            // 2. 読み込み中、またはエラー（404等）の場合
            ctx.fillStyle = this.loadError ? '#F00' : '#444';
            ctx.strokeStyle = '#FFF';
            ctx.lineWidth = 2;
            
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.strokeRect(this.x, this.y, this.width, this.height);

            if (this.loadError) {
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(this.x + this.width, this.y + this.height);
                ctx.moveTo(this.x + this.width, this.y);
                ctx.lineTo(this.x, this.y + this.height);
                ctx.stroke();
            }
        }

        // チート用のヒットボックス（ライム色の枠）描画
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