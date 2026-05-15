/*
 * PROJECT: VOID-CIRCUIT
 *
 * entities/enemies.js　各種派生敵クラス
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */

class StraightEnemy extends Enemy {
    get imageName() { return "enemy_straight.webp"; }
    
    constructor(game, x, y, bulletType) {
        super(game, x, y, bulletType, 1); // HP=1
        this.speed = 2.5; // 少し速めにするなど個性を出せる
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
    /** サイン波移動を加算して敵の位置を更新する */
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

    /** 停止・発射・退却を管理する敵の状態更新 */
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

/**
 * ボスクラス：多段階攻撃と特殊演出を持つ
 */
class BossEnemy extends Enemy {
    constructor(game, x, y, hp, timeLimit, timeMultiplier) {
        const bulletType = "aim";
        super(game, x, y, bulletType, hp);
        this.timeLimit = timeLimit;
        this.timeMultiplier = timeMultiplier;
    }
}

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

        this.state = 'APPEAR'; // APPEAR, ATTACK_01, ATTACK_02, EXPLODE
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
                // 上からゆっくり降りてくる
                this.y += 0.5;
                if (this.y >= 40) {
                    this.state = 'ATTACK_01';
                    this.timer = 0;
                }
                break;

            case 'ATTACK_01':
                // 左右にゆらゆら動きながら狙い撃ち
                this.x = this.baseX + Math.sin(this.timer * 0.02) * this.moveRange;
                if (this.timer % 40 === 0) this.shoot(game);
                
                // HPが半分以下で第2フェーズへ
                if (this.hp < this.maxHp / 2) {
                    this.state = 'ATTACK_02';
                }
                break;

            case 'ATTACK_02':
                // 中央に陣取って8方向弾を連射
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

    // ボス専用の爆発演出（何度も爆発する）
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
