/*
 * PROJECT: VOID-CIRCUIT
 *
 * entities/enemies.js 各種派生敵クラス (v0.45 拡張版)
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */

// ==========================================
// 1. 既存の基本敵クラス
// ==========================================

class StraightEnemy extends Enemy {
    get imageName() { return "enemy_straight.webp"; }
    
    constructor(game, x, y, bulletType) {
        super(game, x, y, bulletType, 1); // HP=1
        this.speed = 2.5; 
    }
}

class SineEnemy extends Enemy {
    get imageName() { return "enemy_sine.webp"; }

    constructor(game, x, y, bulletType, phase = 0) {
        super(game, x, y, bulletType);
        this.baseX = x;
        this.phase = phase;
        this.amplitude = 50;
        this.frequency = 0.05;
    }

    update(game) {
        super.update(game);
        this.x = this.baseX + Math.sin(this.phase) * this.amplitude;
        this.phase += this.frequency;
    }
}

class StationaryEnemy extends Enemy {
    get imageName() { return "enemy_stationary.webp"; }

    constructor(game, x, y, bulletType, hp = 1, stopY = 100, waitTime = 120) {
        super(game, x, y, bulletType, hp);
        this.baseX = x;
        this.stopY = stopY;
        this.waitTime = waitTime;
        this.timer = 0;
        this.state = 'MOVE_IN';
    }

    update(game) {
        if (!this.active) return;

        switch (this.state) {
            case 'MOVE_IN':
                this.y += 2;
                if (this.y >= this.stopY) this.state = 'STOP';
                break;

            case 'STOP':
                this.timer++;
                this.x = this.baseX + Math.sin(this.timer * 0.2) * 2;

                const interval = Math.max(10, 30 / this.fireRateMultiplier);
                if (this.timer % Math.floor(interval) === 0) this.shoot(game);

                if (this.timer >= this.waitTime) this.state = 'MOVE_OUT';
                break;

            case 'MOVE_OUT':
                this.y -= 3;
                if (this.y < -50) this.active = false;
                break;
        }
    }
}

// ==========================================
// 2. 【新規追加】戦略性を広げる個性派ザコクラス群
// ==========================================

/**
 * AssaultEnemy: 直進後、自機の高度に合わせて急激に軌道修正して体当たりを狙う突撃型
 */
class AssaultEnemy extends Enemy {
    get imageName() { return "enemy_assault.webp"; }

    constructor(game, x, y, bulletType) {
        super(game, x, y, bulletType, 1);
        this.state = 'FALL'; // FALL, CHARGE
        this.vx = 0;
        this.vy = 3.0;
    }

    update(game) {
        if (!this.active) return;

        this.x += this.vx;
        this.y += this.vy;

        // 自機との距離を監視（ある程度近づいたらロックオンして突撃）
        if (this.state === 'FALL' && game.player && game.player.alive) {
            if (this.y >= game.player.y - 150) {
                this.state = 'CHARGE';
                // 自機の方向へのベクトルを計算して猛加速
                const dx = game.player.x - this.x;
                const dy = game.player.y - this.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                this.vx = (dx / dist) * 6.5; // 超高速突撃
                this.vy = (dy / dist) * 6.5;
                if (game.sc.audio) game.sc.audio.playHitSound(); // 警告音代わりに
            }
        }

        // 画面外処理
        if (this.y > game.height + 50 || this.x < -50 || this.x > game.width + 50) {
            this.active = false;
        }
    }
}

/**
 * HunterEnemy: 常に自機のX座標を執拗に追従しながらゆっくり降下してくるハンター型
 */
class HunterEnemy extends Enemy {
    get imageName() { return "enemy_hunter.webp"; }

    constructor(game, x, y, bulletType) {
        super(game, x, y, bulletType, 2); // 少し硬め
        this.speedY = 1.0; // 降りてくるのは遅い
        this.speedX = 1.5; // 横移動で自機を追う
        this.timer = 0;
    }

    update(game) {
        if (!this.active) return;
        this.timer++;

        this.y += this.speedY;

        // ターゲット（自機）の方向へジわじわ寄る
        if (game.player && game.player.alive) {
            const targetX = game.player.x;
            if (this.x < targetX) this.x += this.speedX;
            else if (this.x > targetX) this.x -= this.speedX;
        }

        // 一定間隔でいやらしく自機依存弾を撃つ
        if (this.timer % 80 === 0) {
            this.shoot(game);
        }

        if (this.y > game.height + 50) this.active = false;
    }
}

/**
 * ShieldEnemy: 高耐久の盾。正面から弾を受けると「撃ち返し（カウンター）」を発生させる
 */
class ShieldEnemy extends Enemy {
    get imageName() { return "enemy_shield.webp"; }

    constructor(game, x, y, bulletType) {
        super(game, x, y, bulletType, 5); // 圧倒的タフさ
        this.speedY = 0.6; // じりじりと進軍
    }

    // ダメージ処理をオーバーライドして「撃ち返し」のロジックを仕込む
    takeDamage(amount) {
        const isDead = super.takeDamage(amount);
        
        // まだ生きている場合、撃たれた火花演出のついでに弾を撃ち返す！
        if (!isDead && this.game) {
            // カウンター弾を生成（EnemyBulletクラスを想定、なければgameのentitiesへ直接push）
            if (typeof EnemyBullet !== 'undefined') {
                this.game.entities.push(new EnemyBullet(this.x + this.width/2, this.y + this.height, 0, 3));
            }
        }
        return isDead;
    }
}

/**
 * ScoutEnemy: 画面外からUの字を描いて索敵し、弾を撒いて上部へ去っていく偵察型
 */
class ScoutEnemy extends Enemy {
    get imageName() { return "enemy_scout.webp"; }

    constructor(game, x, y, bulletType, isLeftToRight = true) {
        super(game, x, y, bulletType, 1);
        this.timer = 0;
        this.isLeft = isLeftToRight;
        this.x = isLeftToRight ? -32 : game.width + 32; // 画面外からスタート
        this.y = 80;
    }

    update(game) {
        if (!this.active) return;
        this.timer += 0.04;

        // パラメータ曲線によるUターン移動の表現
        if (this.isLeft) {
            this.x += 3.5;
        } else {
            this.x -= 3.5;
        }
        // Y座標はサイン波の谷（Uの字）を作る
        this.y = 80 + Math.sin(this.timer) * 120;

        if (Math.abs(this.timer - Math.PI/2) < 0.05 && !this.hasShot) {
            this.shoot(game); // 一番底に沈み込んだ瞬間に狙い撃ち
            this.hasShot = true;
        }

        // 画面外へ抜けたら消滅
        if (this.x < -60 || this.x > game.width + 60) this.active = false;
    }
}

// ==========================================
// 3. ボスクラスの基底 & 各ステージのボス実体
// ==========================================

class BossEnemy extends Enemy {
    constructor(game, x, y, hp, timeLimit, timeMultiplier) {
        const bulletType = "aim";
        super(game, x, y, bulletType, hp);
        this.timeLimit = timeLimit;
        this.timeMultiplier = timeMultiplier;
    }
}

/**
 * STAGE-1 ボス: アイアン・ヴェイン防衛コア
 */
class BossEnemy_01 extends BossEnemy {
    get imageName() { return "enemy_boss_01.webp"; }

    constructor(game, x, y, hp, timeLimit, timeMultiplier) {
        y = -128;
        super(game, x, y, hp, timeLimit, timeMultiplier);
        this.isBoss = true;
        this.width = 128;
        this.height = 128;
        this.hitWidth = 96; 
        this.hitHeight = 96;

        this.state = 'APPEAR'; 
        this.timer = 0;
        this.baseX = x;
        this.moveRange = 100;
        this.speed = 1.0;
    }

    update(game) {
        if (!this.active) return;
        this.timer++;

        switch (this.state) {
            case 'APPEAR':
                this.y += 0.5;
                if (this.y >= 40) {
                    this.state = 'ATTACK_01';
                    this.timer = 0;
                }
                break;

            case 'ATTACK_01':
                this.x = this.baseX + Math.sin(this.timer * 0.02) * this.moveRange;
                if (this.timer % 40 === 0) this.shoot(game);
                
                if (this.hp < this.maxHp / 2) {
                    this.state = 'ATTACK_02';
                }
                break;

            case 'ATTACK_02':
                this.x += (this.baseX - this.x) * 0.05;
                if (this.timer % 20 === 0) {
                    this.bulletType = 'eight-way';
                    this.shoot(game);
                }
                break;
        }
    }

    draw(ctx) {
        ctx.save();
        if (this.state === 'ATTACK_02') {
            ctx.filter = 'hue-rotate(150deg) saturate(2) brightness(1.2)';
        }
        super.draw(ctx);
        ctx.restore(); 
    }

    onDie(game) {
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                game.createExplosion(
                    this.x + Math.random() * this.width, 
                    this.y + Math.random() * this.height, 
                    { maxHp: 50 }
                );
            }, i * 200);
        }
    }
}

/**
 * STAGE-2 ボス: 【新規】碧琥珀の潜航母艦（Emerald Leviathan）
 * 特徴: 潜航状態（半透明化＋無敵）になり、浮上した瞬間に凶悪なスクリュー魚雷弾幕を撒く
 */
class BossEnemy_02 extends BossEnemy {
    get imageName() { return "enemy_boss_02.webp"; }

    constructor(game, x, y, hp, timeLimit, timeMultiplier) {
        y = -128;
        super(game, x, y, hp, timeLimit, timeMultiplier);
        this.isBoss = true;
        this.width = 140;
        this.height = 96;
        this.hitWidth = 110;
        this.hitHeight = 70;

        this.state = 'APPEAR'; // APPEAR, ATTACK_NORMAL, DIVE, SURFACE
        this.timer = 0;
        this.baseX = x;
        this.alpha = 1.0; 
    }

    update(game) {
        if (!this.active) return;
        this.timer++;

        switch (this.state) {
            case 'APPEAR':
                this.y += 0.8;
                if (this.y >= 50) {
                    this.state = 'ATTACK_NORMAL';
                    this.timer = 0;
                }
                break;

            case 'ATTACK_NORMAL':
                // 通常巡航：左右に動きながらワイドに撃つ
                this.x = this.baseX + Math.sin(this.timer * 0.03) * 80;
                if (this.timer % 30 === 0) {
                    this.bulletType = 'aim';
                    this.shoot(game);
                }
                // 300フレームごとに潜航モードへ切り替え
                if (this.timer > 300) {
                    this.state = 'DIVE';
                    this.timer = 0;
                }
                break;

            case 'DIVE':
                // 🌊 潜航演出：徐々に透明になり、当たり判定（無敵化）を消滅させる
                this.alpha -= 0.02;
                if (this.alpha <= 0.2) {
                    this.alpha = 0.2;
                    this.isInvincible = true; // 無敵フラグをゲーム側で見るための設定
                    
                    // 潜航中にこっそりX座標を大移動（別の場所から浮上させる）
                    this.x = Math.random() * (game.width - this.width);
                    this.state = 'SURFACE';
                    this.timer = 0;
                }
                break;

            case 'SURFACE':
                // 🌊 浮上演出：潜航完了後、2秒潜ったのちにパッと姿を現す
                if (this.timer > 120) {
                    this.alpha += 0.04;
                    if (this.alpha >= 1.0) {
                        this.alpha = 1.0;
                        this.isInvincible = false; // 無敵解除
                        this.state = 'ATTACK_NORMAL';
                        this.timer = 0;

                        // 浮上直後の強襲：全方位、またはヘビーな魚雷弾をプレゼント
                        this.bulletType = 'eight-way';
                        this.shoot(game);
                    }
                }
                break;
        }
    }

    draw(ctx) {
        ctx.save();
        // 潜航深度に合わせたアルファ値の適用、およびエフェクト
        ctx.globalAlpha = this.alpha;
        if (this.isInvincible) {
            // 潜っている間は青くブレさせ、潜航中であることを表現
            ctx.filter = 'blur(3px) brightness(0.6) saturate(0.5) hue-rotate(200deg)';
        }
        super.draw(ctx);
        ctx.restore();
    }

    onDie(game) {
        // ボス2用の大爆発：水しぶきを連想させる派手な断末魔
        for (let i = 0; i < 8; i++) {
            setTimeout(() => {
                game.createExplosion(
                    this.x + Math.random() * this.width, 
                    this.y + Math.random() * this.height, 
                    { maxHp: 80 }
                );
            }, i * 150);
        }
    }
}