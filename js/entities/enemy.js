/*
 * PROJECT: VOID-CIRCUIT
 *
 * entities/enemy.js　敵クラス
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */

// ==========================================
// 1. 敵キャラ、ボスキャラの基底（ベース）クラス
// ==========================================

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
        if (this.isOutOfBounds(50, true)) { this.active = false; return; }
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
        // 発射の基準点を「画像の中心」に
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
                    spawn(Math.cos(a) * 3, Math.sin(a) * 3); // 中心から全方位に均等に飛ばす
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

        // 当たり判定スキップと完全に同じ条件（画面外、または上部のHUDエリア内）
        if (
            this.y + this.height < GAME_CONFIG.UI_HEADER_HEIGHT ||
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
    onDie(game, soundoff = false) {
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;
        game.collisions.createExplosion(centerX, centerY, this, soundoff);
    }
}


class BossEnemy extends Enemy {
    constructor(game, x, y, hp, timeLimit, timeMultiplier) {
        const bulletType = "aim";
        super(game, x, y, bulletType, hp);
        this.timeLimit = timeLimit;
        this.timeMultiplier = timeMultiplier;
    }
}


// ==========================================
// 2. 戦略性を広げる個性派ザコクラス群
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
                if (this.isOutOfBounds(50, true)) this.active = false;
                break;
        }
    }
}

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

        if (this.state === 'FALL' && game.player && game.player.alive) {
            if (this.y >= game.player.y - 150) {
                this.state = 'CHARGE';
                const dx = game.player.x - this.x;
                const dy = game.player.y - this.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                this.vx = (dx / dist) * 6.5; 
                this.vy = (dy / dist) * 6.5;
                if (game.sc.audio) game.sc.audio.playHitSound(); 
            }
        }

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
        super(game, x, y, bulletType, 2); 
        this.speedY = 1.0; 
        this.speedX = 1.5; 
        this.timer = 0;
    }

    update(game) {
        if (!this.active) return;
        this.timer++;

        this.y += this.speedY;

        if (game.player && game.player.alive) {
            const targetX = game.player.x;
            if (this.x < targetX) this.x += this.speedX;
            else if (this.x > targetX) this.x -= this.speedX;
        }

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
        super(game, x, y, bulletType, 5); 
        this.speedY = 0.6; 
    }

    takeDamage(amount) {
        const isDead = super.takeDamage(amount);
        if (!isDead && this.game) {
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
        this.x = isLeftToRight ? -32 : game.width + 32; 
        this.y = 80;
    }

    update(game) {
        if (!this.active) return;
        this.timer += 0.04;

        if (this.isLeft) {
            this.x += 3.5;
        } else {
            this.x -= 3.5;
        }
        this.y = 80 + Math.sin(this.timer) * 120;

        if (Math.abs(this.timer - Math.PI/2) < 0.05 && !this.hasShot) {
            this.shoot(game); 
            this.hasShot = true;
        }

        if (this.x < -60 || this.x > game.width + 60) this.active = false;
    }
}

// ==========================================
// 3.  各ステージのボス実体
// ==========================================

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

    draw(ctx, isInvincibleCheat = false) {
        ctx.save();
        if (this.state === 'ATTACK_02') {
            ctx.filter = 'hue-rotate(150deg) saturate(2) brightness(1.2)';
        }
        super.draw(ctx, isInvincibleCheat);
        ctx.restore(); 
    }

    onDie(game) {
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                game.collisions.createExplosion(this.x + Math.random() * this.width, this.y + Math.random() * this.height, { maxHp: 50 });
            }, i * 200);
        }
    }
}

/**
 * STAGE-2 ボス: 碧琥珀の潜航母艦
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

        this.state = 'APPEAR'; 
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
                this.x = this.baseX + Math.sin(this.timer * 0.03) * 80;
                if (this.timer % 30 === 0) {
                    this.bulletType = 'aim';
                    this.shoot(game);
                }
                if (this.timer > 300) {
                    this.state = 'DIVE';
                    this.timer = 0;
                }
                break;

            case 'DIVE':
                this.alpha -= 0.02;
                if (this.alpha <= 0.2) {
                    this.alpha = 0.2;
                    this.isInvincible = true; 
                    this.x = Math.random() * (game.width - this.width);
                    this.state = 'SURFACE';
                    this.timer = 0;
                }
                break;

            case 'SURFACE':
                if (this.timer > 120) {
                    this.alpha += 0.04;
                    if (this.alpha >= 1.0) {
                        this.alpha = 1.0;
                        this.isInvincible = false; 
                        this.state = 'ATTACK_NORMAL';
                        this.timer = 0;
                        this.bulletType = 'eight-way';
                        this.shoot(game);
                    }
                }
                break;
        }
    }

    draw(ctx, isInvincibleCheat = false) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        if (this.isInvincible) {
            ctx.filter = 'blur(3px) brightness(0.6) saturate(0.5) hue-rotate(200deg)';
        }
        super.draw(ctx, isInvincibleCheat);
        ctx.restore();
    }

    onDie(game) {
        for (let i = 0; i < 8; i++) {
            setTimeout(() => {
                game.collisions.createExplosion(this.x + Math.random() * this.width, this.y + Math.random() * this.height, { maxHp: 80 });
            }, i * 150);
        }
    }
}

/**
 * STAGE-3 ボス: 蒼穹龍神（Soukyu Ryujin）
 * 特徴: 165BPMのハイスピードメタル、ファンファーレと同調した、激しいS字蛇行と高速突進を仕掛けるアグレッシブ龍。
 */
class BossEnemy_03 extends BossEnemy {
    get imageName() { return "enemy_boss_03.webp"; }

    constructor(game, x, y, hp, timeLimit, timeMultiplier) {
        y = -160;
        super(game, x, y, hp, timeLimit, timeMultiplier);
        this.isBoss = true;
        this.width = 160;
        this.height = 128;
        this.hitWidth = 120;
        this.hitHeight = 90;

        this.state = 'APPEAR';
        this.timer = 0;
        this.baseX = x;
    }

    update(game) {
        if (!this.active) return;
        this.timer++;

        switch (this.state) {
            case 'APPEAR':
                this.y += 1.5; // 高速進入
                if (this.y >= 60) {
                    this.state = 'SINE_DRIVE';
                    this.timer = 0;
                }
                break;

            case 'SINE_DRIVE':
                // メタルなベースラインに合わせた高速な∞の字（ないし大きなS字）運動
                this.x = this.baseX + Math.sin(this.timer * 0.06) * 100;
                this.y = 60 + Math.cos(this.timer * 0.03) * 30;

                if (this.timer % 24 === 0) {
                    this.bulletType = 'triple';
                    this.shoot(game);
                }

                // 400Fごとに、ブラススタブ炸裂を思わせる急降下体当たり突撃を発動
                if (this.timer > 400) {
                    this.state = 'DRAGON_CHARGE';
                    this.timer = 0;
                }
                break;

            case 'DRAGON_CHARGE':
                // 画面下部へ一気に牙を剥いて突撃
                this.y += 6.0;
                if (this.timer % 10 === 0) {
                    this.bulletType = 'eight-way';
                    this.shoot(game);
                }
                if (this.y >= 320) {
                    this.state = 'RETREAT';
                    this.timer = 0;
                }
                break;

            case 'RETREAT':
                // 定位置（上空）へと滑らかに戻っていく
                this.y -= 3.0;
                this.x += (this.baseX - this.x) * 0.05;
                if (this.y <= 60) {
                    this.y = 60;
                    this.state = 'SINE_DRIVE';
                    this.timer = 0;
                }
                break;
        }
    }

    onDie(game) {
        for (let i = 0; i < 12; i++) {
            setTimeout(() => {
                game.collisions.createExplosion(this.x + Math.random() * this.width, this.y + Math.random() * this.height, { maxHp: 100 });
            }, i * 100);
        }
    }
}

/**
 * STAGE-4 ボス: 地上絵守護神（Ancient Golem）
 * 特徴: トライバルテクノとラスタスクロール（砂塵）。幾何学的な位置停止（フォーメーション）と、ビット反射弾。
 */
class BossEnemy_04 extends BossEnemy {
    get imageName() { return "enemy_boss_04.webp"; }

    constructor(game, x, y, hp, timeLimit, timeMultiplier) {
        y = -128;
        super(game, x, y, hp, timeLimit, timeMultiplier);
        this.isBoss = true;
        this.width = 128;
        this.height = 128;
        this.hitWidth = 100;
        this.hitHeight = 100;

        this.state = 'APPEAR';
        this.timer = 0;
        this.baseX = x;
        this.points = [
            {x: x - 80, y: 50},
            {x: x + 80, y: 120},
            {x: x, y: 80}
        ];
        this.targetPointIndex = 0;
    }

    update(game) {
        if (!this.active) return;
        this.timer++;

        switch (this.state) {
            case 'APPEAR':
                this.y += 0.8;
                if (this.y >= 50) {
                    this.state = 'PATROL_PATTERN';
                    this.timer = 0;
                }
                break;

            case 'PATROL_PATTERN':
                // 幾何学的な遺跡の地上絵をなぞるように、ターゲット座標へ向けてカクカクと移動
                const target = this.points[this.targetPointIndex];
                const dx = target.x - this.x;
                const dy = target.y - this.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist > 4) {
                    this.x += (dx / dist) * 2.0;
                    this.y += (dy / dist) * 2.0;
                } else {
                    // 到着したら次の一歩、および強力なサークル古代弾幕
                    this.targetPointIndex = (this.targetPointIndex + 1) % this.points.length;
                    this.bulletType = 'eight-way';
                    this.shoot(game);
                }

                if (this.timer % 35 === 0) {
                    this.bulletType = 'triple';
                    this.shoot(game);
                }
                break;
        }
    }

    onDie(game) {
        for (let i = 0; i < 10; i++) {
            setTimeout(() => {
                game.collisions.createExplosion(this.x + Math.random() * this.width, this.y + Math.random() * this.height, { maxHp: 120 });
            }, i * 120);
        }
    }
}

/**
 * STAGE-5 ボス: 生体DNAコア（Planetary Pulse）
 * 特徴: サイケデリック、バイオレットのパルス明滅。HPの減少に伴って「細胞分裂（ビットを飛ばす）」を行う。
 */
class BossEnemy_05 extends BossEnemy {
    get imageName() { return "enemy_boss_05.webp"; }

    constructor(game, x, y, hp, timeLimit, timeMultiplier) {
        y = -128;
        super(game, x, y, hp, timeLimit, timeMultiplier);
        this.isBoss = true;
        this.width = 110;
        this.height = 110;
        this.hitWidth = 90;
        this.hitHeight = 90;

        this.state = 'APPEAR';
        this.timer = 0;
        this.baseX = x;
        this.hasSplit = false;
    }

    update(game) {
        if (!this.active) return;
        this.timer++;

        switch (this.state) {
            case 'APPEAR':
                this.y += 0.6;
                if (this.y >= 60) {
                    this.state = 'PULSE_WAVE';
                    this.timer = 0;
                }
                break;

            case 'PULSE_WAVE':
                // 呼吸するようにゆったり上下左右に揺れる
                this.x = this.baseX + Math.sin(this.timer * 0.02) * 60;
                this.y = 60 + Math.cos(this.timer * 0.04) * 20;

                // 粘着質なシンセアルペジオと同調した連射弾
                if (this.timer % 15 === 0) {
                    this.bulletType = 'aim';
                    this.shoot(game);
                }

                // 🧬 ギミック: HPが半分を切ると、おぞましい細胞分裂エフェクトとともに弾幕が常時激化
                if (!this.hasSplit && this.hp < this.maxHp / 2) {
                    this.hasSplit = true;
                    this.fireRateMultiplier = 2.0; // 攻撃速度が2倍へ昇華
                    if (game.sc.audio) game.sc.audio.playHitSound();
                }

                if (this.hasSplit && this.timer % 40 === 0) {
                    this.bulletType = 'eight-way';
                    this.shoot(game);
                }
                break;
        }
    }

    draw(ctx, isInvincibleCheat = false) {
        ctx.save();
        // 分裂（暴走）後は不気味な紫色に輝き、激しく脈動（スケール変化）する
        if (this.hasSplit) {
            const scale = 1.0 + Math.sin(this.timer * 0.2) * 0.06;
            ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
            ctx.scale(scale, scale);
            ctx.translate(-(this.x + this.width / 2), -(this.y + this.height / 2));
            ctx.filter = 'hue-rotate(280deg) saturate(2.5) brightness(1.1)';
        }
        super.draw(ctx, isInvincibleCheat);
        ctx.restore();
    }

    onDie(game) {
        for (let i = 0; i < 14; i++) {
            setTimeout(() => {
                game.collisions.createExplosion(this.x + Math.random() * this.width, this.y + Math.random() * this.height, { maxHp: 110 });
            }, i * 90);
        }
    }
}

/**
 * STAGE-6 ボス: 超巨大空中戦艦（Burning Dread）
 * 特徴: 激しいスラッシュメタルベース、大気圏の赤熱。画面上部をほぼ完全に埋める要塞級ボス。主砲群の破壊による発狂モード。
 */
class BossEnemy_06 extends BossEnemy {
    get imageName() { return "enemy_boss_06.webp"; }

    constructor(game, x, y, hp, timeLimit, timeMultiplier) {
        y = -180;
        super(game, x, y, hp, timeLimit, timeMultiplier);
        this.isBoss = true;
        this.width = 240; // 圧倒的巨体
        this.height = 140;
        this.hitWidth = 200;
        this.hitHeight = 100;

        this.state = 'APPEAR';
        this.timer = 0;
        this.baseX = x - 50; // 中心に収まるように補正
        this.x = this.baseX;
    }

    update(game) {
        if (!this.active) return;
        this.timer++;

        switch (this.state) {
            case 'APPEAR':
                this.y += 0.4; // 巨大ゆえに重々しく進入
                if (this.y >= 20) {
                    this.state = 'HEAVY_BOMBARD';
                    this.timer = 0;
                }
                break;

            case 'HEAVY_BOMBARD':
                // メタルのリフに合わせ、細かく激しくブレる（主砲の反動を表現）
                this.x = this.baseX + Math.sin(this.timer * 0.1) * 15;

                // 左砲門・右砲門・中央主砲からの波状弾幕
                if (this.timer % 30 === 0) {
                    this.bulletType = 'triple';
                    this.shoot(game);
                }

                // HPが30%以下になると対空全開（発狂モード）
                if (this.hp < this.maxHp * 0.3) {
                    this.state = 'OVERDRIVE';
                }
                break;

            case 'OVERDRIVE':
                this.x = this.baseX + Math.sin(this.timer * 0.2) * 30; // 激しい狂い揺れ
                if (this.timer % 12 === 0) {
                    this.bulletType = 'eight-way';
                    this.shoot(game);
                }
                if (this.timer % 20 === 0) {
                    this.bulletType = 'straight';
                    this.shoot(game);
                }
                break;
        }
    }

    draw(ctx, isInvincibleCheat = false) {
        ctx.save();
        if (this.state === 'OVERDRIVE') {
            ctx.filter = 'saturate(3) contrast(1.5) brightness(1.3)'; // 炎上・真っ赤に過熱
        }
        super.draw(ctx, isInvincibleCheat);
        ctx.restore();
    }

    onDie(game) {
        // 巨大戦艦崩壊の、鳴り止まない大誘爆演出
        for (let i = 0; i < 24; i++) {
            setTimeout(() => {
                game.collisions.createExplosion(this.x + Math.random() * this.width, this.y + Math.random() * this.height, { maxHp: 150 });
            }, i * 80);
        }
    }
}

/**
 * STAGE-7 ボス: 最終要塞機械心臓（Absolute Core）
 * 特徴: 荘厳なFMオルガン。最終形態への「完全形態変化（トランスフォーム）」をサポートする神。
 */
class BossEnemy_07 extends BossEnemy {
    get imageName() { return "enemy_boss_07_phase1.webp"; }

    constructor(game, x, y, hp, timeLimit, timeMultiplier) {
        y = -160;
        super(game, x, y, hp, timeLimit, timeMultiplier);
        this.isBoss = true;
        this.width = 160;
        this.height = 160;
        this.hitWidth = 120;
        this.hitHeight = 120;

        this.state = 'APPEAR';
        this.timer = 0;
        this.baseX = x;
        this.formPhase = 1; // 1: 第一形態, 2: 最終形態
    }

    update(game) {
        if (!this.active) return;
        this.timer++;

        switch (this.state) {
            case 'APPEAR':
                this.y += 0.5;
                if (this.y >= 30) {
                    this.state = 'CORE_PHASE_1';
                    this.timer = 0;
                }
                break;

            case 'CORE_PHASE_1':
                // 画面中央に絶対君臨。グリッド線の流れの中で静かに威圧弾幕を放つ
                this.x = this.baseX + Math.sin(this.timer * 0.01) * 30;

                if (this.timer % 40 === 0) {
                    this.bulletType = 'eight-way';
                    this.shoot(game);
                }
                if (this.timer % 25 === 0) {
                    this.bulletType = 'aim';
                    this.shoot(game);
                }

                // ⚡ ギミック：HPが半分を切ると、BGMのサビ展開に完全に同期して【最終形態に完全変形】
                if (this.hp < this.maxHp / 2) {
                    this.formPhase = 2;
                    this.state = 'TRANSFORM_演出';
                    this.timer = 0;
                }
                break;

            case 'TRANSFORM_演出':
                // 変形中の2秒間は、ボスが激しくフラッシュして全画面を圧倒（無敵・攻撃停止）
                this.isInvincible = true;
                this.x = this.baseX + Math.sin(this.timer * 0.5) * 4; // 高速振動
                
                if (this.timer > 120) {
                    this.isInvincible = false;
                    this.state = 'FINAL_OVERLORD';
                    this.timer = 0;
                    // 画像アセットのリロード（倉庫から最終形態のグラフィックを引き出す）
                    this.image = game.assets.get("enemy_boss_07_phase2.webp") || this.image;
                }
                break;

            case 'FINAL_OVERLORD':
                // 機械心臓の最終暴走。全方位8方向×2重、および極限の3WAYをノンストップ掃射
                this.x = this.baseX + Math.sin(this.timer * 0.04) * 80;
                this.y = 30 + Math.cos(this.timer * 0.03) * 15;

                if (this.timer % 15 === 0) {
                    this.bulletType = 'eight-way';
                    this.shoot(game);
                }
                if (this.timer % 10 === 0) {
                    this.bulletType = 'triple';
                    this.shoot(game);
                }
                break;
        }
    }

    draw(ctx, isInvincibleCheat = false) {
        ctx.save();
        if (this.state === 'TRANSFORM_演出') {
            // 変形フラッシュ：モノクロ化＋超高輝度
            ctx.filter = `contrast(3) brightness(${2.0 + Math.sin(this.timer * 0.8) * 1.0})`;
        } else if (this.formPhase === 2) {
            // 最終形態：禍々しいネオンレッドのエフェクト
            ctx.filter = 'hue-rotate(0deg) saturate(3) contrast(1.3) drop-shadow(0px 0px 15px #F00)';
        }
        super.draw(ctx, isInvincibleCheat);
        ctx.restore();
    }

    onDie(game) {
        // 機械心臓が完全停止。ゲーム全体の画面を震撼させるグランドフィナーレの大爆発
        for (let i = 0; i < 40; i++) {
            setTimeout(() => {
                game.collisions.createExplosion(
                    this.x - 20 + Math.random() * (this.width + 40), 
                    this.y - 20 + Math.random() * (this.height + 40), 
                    { maxHp: 200 }
                );
            }, i * 60);
        }
    }
}


// ==========================================
// 4. 敵タイプに応じたインスタンス生成ファクトリ
// ==========================================

/**
 * 敵タイプに応じたインスタンスを生成して返す
 * @param {string} type 敵のタイプ名 ('sine', 'boss_03' など)
 * @param {Object} game ゲームメインの参照
 * @param {number} x 生成X座標
 * @param {number} y 生成Y座標
 * @param {string} bType 弾のタイプ
 * @param {Object} data YAMLから読み込んだ生データ（個別パラメータ抽出用）
 * @returns {Enemy} 生成された敵のインスタンス
 */
function createEnemyInstance(type, game, x, y, bType, data) {
    switch (type) {
        case 'sine':
            const sineEnemy = new SineEnemy(game, x, y, bType, data.phase || 0);
            if (data.amplitude) sineEnemy.amplitude = data.amplitude;
            if (data.frequency) sineEnemy.frequency = data.frequency;
            return sineEnemy;

        case 'stationary':
            return new StationaryEnemy(
                game, x, y, bType, data.hp || 1, 
                data.stopY || 120, 
                data.waitTime || 180
            );

        case 'assault':
            return new AssaultEnemy(game, x, y, bType);

        case 'hunter':
            return new HunterEnemy(game, x, y, bType);

        case 'shield':
            return new ShieldEnemy(game, x, y, bType);

        case 'scout':
            const isLeftToRight = data.isLeft !== undefined ? data.isLeft : true;
            return new ScoutEnemy(game, x, y, bType, isLeftToRight);

        // 各ステージの個性豊かなボス・ルーティング群
        case 'boss_01':
            return new BossEnemy_01(game, x, y, data.hp, data.timeLimit, data.timeMultiplier);

        case 'boss_02':
            return new BossEnemy_02(game, x, y, data.hp, data.timeLimit, data.timeMultiplier);

        case 'boss_03':
            return new BossEnemy_03(game, x, y, data.hp, data.timeLimit, data.timeMultiplier);

        case 'boss_04':
            return new BossEnemy_04(game, x, y, data.hp, data.timeLimit, data.timeMultiplier);

        case 'boss_05':
            return new BossEnemy_05(game, x, y, data.hp, data.timeLimit, data.timeMultiplier);

        case 'boss_06':
            return new BossEnemy_06(game, x, y, data.hp, data.timeLimit, data.timeMultiplier);

        case 'boss_07':
            return new BossEnemy_07(game, x, y, data.hp, data.timeLimit, data.timeMultiplier);

        case 'straight':
        default:
            return new StraightEnemy(game, x, y, bType, data.hp || 1);
    }
}