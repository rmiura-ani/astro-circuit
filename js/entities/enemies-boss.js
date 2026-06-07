/*
 * PROJECT: VOID-CIRCUIT
 *
 * entities/enemies-boss.js - ボス敵クラス定義および自動レジストリ登録
 *
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */
"use strict";

// =================================================================
// STAGE-1 ボス: アイアン・ヴェイン防衛コア
// =================================================================
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

    /**
     * 動的生成用ファクトリメソッド
     */
    static create(game, x, y, bType, data = {}) {
        return new BossEnemy_01(game, x, y, data.hp, data.timeLimit, data.timeMultiplier);
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
// クラス定義直後にレジストリへ登録
if (typeof ENEMY_REGISTRY !== 'undefined') {
    ENEMY_REGISTRY.set('boss_01', BossEnemy_01);
}


// =================================================================
// STAGE-2 ボス: 碧琥珀の潜航母艦
// =================================================================
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

    /**
     * 動的生成用ファクトリメソッド
     */
    static create(game, x, y, bType, data = {}) {
        return new BossEnemy_02(game, x, y, data.hp, data.timeLimit, data.timeMultiplier);
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
if (typeof ENEMY_REGISTRY !== 'undefined') {
    ENEMY_REGISTRY.set('boss_02', BossEnemy_02);
}


// =================================================================
// STAGE-3 ボス: 蒼穹龍神（Soukyu Ryujin）
// =================================================================
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

    /**
     * 動的生成用ファクトリメソッド
     */
    static create(game, x, y, bType, data = {}) {
        return new BossEnemy_03(game, x, y, data.hp, data.timeLimit, data.timeMultiplier);
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
if (typeof ENEMY_REGISTRY !== 'undefined') {
    ENEMY_REGISTRY.set('boss_03', BossEnemy_03);
}


// =================================================================
// STAGE-4 ボス: 地上絵守護神（Ancient Golem）
// =================================================================
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

    /**
     * 動的生成用ファクトリメソッド
     */
    static create(game, x, y, bType, data = {}) {
        return new BossEnemy_04(game, x, y, data.hp, data.timeLimit, data.timeMultiplier);
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
if (typeof ENEMY_REGISTRY !== 'undefined') {
    ENEMY_REGISTRY.set('boss_04', BossEnemy_04);
}


// =================================================================
// STAGE-5 ボス: 生体DNAコア（Planetary Pulse）
// =================================================================
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

    /**
     * 動的生成用ファクトリメソッド
     */
    static create(game, x, y, bType, data = {}) {
        return new BossEnemy_05(game, x, y, data.hp, data.timeLimit, data.timeMultiplier);
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
if (typeof ENEMY_REGISTRY !== 'undefined') {
    ENEMY_REGISTRY.set('boss_05', BossEnemy_05);
}


// =================================================================
// STAGE-6 ボス: 超巨大空中戦艦（Burning Dread）
// =================================================================
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

    /**
     * 動的生成用ファクトリメソッド
     */
    static create(game, x, y, bType, data = {}) {
        return new BossEnemy_06(game, x, y, data.hp, data.timeLimit, data.timeMultiplier);
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
if (typeof ENEMY_REGISTRY !== 'undefined') {
    ENEMY_REGISTRY.set('boss_06', BossEnemy_06);
}


// =================================================================
// STAGE-7 ボス: 最終要塞機械心臓（Absolute Core）
// =================================================================
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

    /**
     * 動的生成用ファクトリメソッド
     */
    static create(game, x, y, bType, data = {}) {
        return new BossEnemy_07(game, x, y, data.hp, data.timeLimit, data.timeMultiplier);
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
if (typeof ENEMY_REGISTRY !== 'undefined') {
    ENEMY_REGISTRY.set('boss_07', BossEnemy_07);
}