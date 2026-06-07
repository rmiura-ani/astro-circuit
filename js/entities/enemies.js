/*
 * PROJECT: VOID-CIRCUIT
 *
 * entities/enemy.js　敵クラス
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */
"use strict";

// =================================================================
// 1. StraightEnemy (直進型)
// =================================================================
class StraightEnemy extends Enemy {
    get imageName() { return "enemy_straight.webp"; }
    
    constructor(game, x, y, bulletType) {
        super(game, x, y, bulletType, 1); // HP=1
        this.speed = 2.5; 
    }

    /**
     * 動的生成用ファクトリメソッド
     */
    static create(game, x, y, bType, data = {}) {
        return new StraightEnemy(game, x, y, bType);
    }
}
// クラス定義の直後にレジストリへ登録
if (typeof ENEMY_REGISTRY !== 'undefined') {
    ENEMY_REGISTRY.set('straight', StraightEnemy);
}


// =================================================================
// 2. SineEnemy (サイン波移動型)
// =================================================================
class SineEnemy extends Enemy {
    get imageName() { return "enemy_sine.webp"; }

    constructor(game, x, y, bulletType, phase = 0) {
        super(game, x, y, bulletType);
        this.baseX = x;
        this.phase = phase;
        this.amplitude = 50;
        this.frequency = 0.05;
    }

    /**
     * 動的生成用ファクトリメソッド
     */
    static create(game, x, y, bType, data = {}) {
        const phase = data.phase !== undefined ? data.phase : 0;
        return new SineEnemy(game, x, y, bType, phase);
    }

    update(game) {
        super.update(game);
        this.x = this.baseX + Math.sin(this.phase) * this.amplitude;
        this.phase += this.frequency;
    }
}
if (typeof ENEMY_REGISTRY !== 'undefined') {
    ENEMY_REGISTRY.set('sine', SineEnemy);
}


// =================================================================
// 3. StationaryEnemy (固定砲台型)
// =================================================================
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

    /**
     * 動的生成用ファクトリメソッド
     */
    static create(game, x, y, bType, data = {}) {
        const hp = data.hp !== undefined ? data.hp : 1;
        const stopY = data.stopY !== undefined ? data.stopY : 100;
        const waitTime = data.waitTime !== undefined ? data.waitTime : 120;
        return new StationaryEnemy(game, x, y, bType, hp, stopY, waitTime);
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
if (typeof ENEMY_REGISTRY !== 'undefined') {
    ENEMY_REGISTRY.set('stationary', StationaryEnemy);
}


// =================================================================
// 4. AssaultEnemy (突撃型)
// =================================================================
class AssaultEnemy extends Enemy {
    get imageName() { return "enemy_assault.webp"; }

    constructor(game, x, y, bulletType) {
        super(game, x, y, bulletType, 1);
        this.state = 'FALL'; 
        this.vx = 0;
        this.vy = 3.0;
    }

    /**
     * 動的生成用ファクトリメソッド
     */
    static create(game, x, y, bType, data = {}) {
        return new AssaultEnemy(game, x, y, bType);
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
                if (game.sc.audio) game.sc.audio.playShot(); 
            }
        }

        if (this.y > game.height + 50 || this.x < -50 || this.x > game.width + 50) {
            this.active = false;
        }
    }
}
if (typeof ENEMY_REGISTRY !== 'undefined') {
    ENEMY_REGISTRY.set('assault', AssaultEnemy);
}


// =================================================================
// 5. HunterEnemy (ハンター追従型)
// =================================================================
class HunterEnemy extends Enemy {
    get imageName() { return "enemy_hunter.webp"; }

    constructor(game, x, y, bulletType) {
        super(game, x, y, bulletType, 2); 
        this.speedY = 1.0; 
        this.speedX = 1.5; 
        this.timer = 0;
    }

    /**
     * 動的生成用ファクトリメソッド
     */
    static create(game, x, y, bType, data = {}) {
        return new HunterEnemy(game, x, y, bType);
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
if (typeof ENEMY_REGISTRY !== 'undefined') {
    ENEMY_REGISTRY.set('hunter', HunterEnemy);
}


// =================================================================
// 6. ShieldEnemy (高耐久・盾型)
// =================================================================
class ShieldEnemy extends Enemy {
    get imageName() { return "enemy_shield.webp"; }

    constructor(game, x, y, bulletType) {
        super(game, x, y, bulletType, 5); 
        this.speedY = 0.6; 
    }

    /**
     * 動的生成用ファクトリメソッド
     */
    static create(game, x, y, bType, data = {}) {
        return new ShieldEnemy(game, x, y, bType);
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
if (typeof ENEMY_REGISTRY !== 'undefined') {
    ENEMY_REGISTRY.set('shield', ShieldEnemy);
}


// =================================================================
// 7. ScoutEnemy (Uターン偵察型)
// =================================================================
class ScoutEnemy extends Enemy {
    get imageName() { return "enemy_scout.webp"; }

    constructor(game, x, y, bulletType, isLeftToRight = true) {
        super(game, x, y, bulletType, 1);
        this.timer = 0;
        this.isLeft = isLeftToRight;
        this.x = isLeftToRight ? -32 : game.width + 32; 
        this.y = 80;
    }

    /**
     * 動的生成用ファクトリメソッド
     */
    static create(game, x, y, bType, data = {}) {
        const isLeftToRight = data.isLeftToRight !== undefined ? data.isLeftToRight : true;
        return new ScoutEnemy(game, x, y, bType, isLeftToRight);
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
if (typeof ENEMY_REGISTRY !== 'undefined') {
    ENEMY_REGISTRY.set('scout', ScoutEnemy);
}


// =================================================================
// [STAGE-2] 21. CrystalEnemy (ジグザグ移動・クリスタル型)
// =================================================================
class CrystalEnemy extends Enemy {
    get imageName() { return "enemy_crystal.webp"; }

    constructor(game, x, y, bulletType, stopY = 150, waitTime = 60) {
        super(game, x, y, bulletType, 2); // クリスタルらしくHPは少し固めの2
        this.stopY = stopY;
        this.waitTime = waitTime;
        this.timer = 0;
        
        // 状態管理: 'DIAGONAL_IN' (斜め降下) -> 'STOP' (停止・射撃) -> 'DIAGONAL_OUT' (斜め離脱)
        this.state = 'DIAGONAL_IN'; 
        
        // 侵入時の左右ベクトル（画面の左右どちらにいるかで自動決定）
        this.vx = (x < game.width / 2) ? 1.5 : -1.5;
        this.vy = 2.0;
    }

    /**
     * 動的生成用ファクトリメソッド
     */
    static create(game, x, y, bType, data = {}) {
        const stopY = data.stopY !== undefined ? data.stopY : 150;
        const waitTime = data.waitTime !== undefined ? data.waitTime : 60;
        return new CrystalEnemy(game, x, y, bType, stopY, waitTime);
    }

    update(game) {
        if (!this.active) return;

        switch (this.state) {
            case 'DIAGONAL_IN':
                this.x += this.vx;
                this.y += this.vy;
                
                // 指定のY座標まで斜めに降りたら停止状態へ
                if (this.y >= this.stopY) {
                    this.state = 'STOP';
                }
                break;

            case 'STOP':
                this.timer++;
                
                // 停止の瞬間にすかさず弾を撃つ
                if (this.timer === 1) {
                    this.shoot(game);
                }

                // 一定時間停止したら、再度斜め移動（離脱）を開始
                if (this.timer >= this.waitTime) {
                    this.state = 'DIAGONAL_OUT';
                    // 離脱時は、進入時とは反対の横方向ベクトルに変えてジグザグにする
                    this.vx = -this.vx; 
                    this.vy = 1.5;
                }
                break;

            case 'DIAGONAL_OUT':
                this.x += this.vx;
                this.y += this.vy;

                // 画面外に出たら消滅
                if (this.y > game.height + 50 || this.x < -50 || this.x > game.width + 50) {
                    this.active = false;
                }
                break;
        }
    }
}
if (typeof ENEMY_REGISTRY !== 'undefined') {
    ENEMY_REGISTRY.set('crystal', CrystalEnemy);
}


// =================================================================
// 🆕 [STAGE-2] 22. SkimmerEnemy (水面ホバー型・スキマー)
// =================================================================
class SkimmerEnemy extends Enemy {
    get imageName() { return "enemy_skimmer.webp"; }

    constructor(game, x, y, bulletType, stopY = 240, slideSpeed = 4.0) {
        super(game, x, y, bulletType, 2); // 画面を広く使うため、少し粘るHP=2
        this.stopY = stopY;
        this.slideSpeed = slideSpeed;
        
        this.state = 'DESCEND'; // 'DESCEND' (高速降下) -> 'SLIDE' (横滑り往復射撃)
        this.dir = (x < game.width / 2) ? 1 : -1; // 出現位置に応じて初期の横移動方向を決定
        this.timer = 0;
    }

    /**
     * 動的生成用ファクトリメソッド
     * YAMLから水面ライン(stopY)やスライド速度(slideSpeed)を調整可能
     */
    static create(game, x, y, bType, data = {}) {
        const stopY = data.stopY !== undefined ? data.stopY : 240; // 画面中央付近を想定
        const slideSpeed = data.slideSpeed !== undefined ? data.slideSpeed : 4.0;
        return new SkimmerEnemy(game, x, y, bType, stopY, slideSpeed);
    }

    update(game) {
        if (!this.active) return;

        switch (this.state) {
            case 'DESCEND':
                // 水面ラインまで高速降下 (通常のStationary等より速い)
                this.y += 5.0;
                if (this.y >= this.stopY) {
                    this.y = this.stopY;
                    this.state = 'SLIDE';
                }
                break;

            case 'SLIDE':
                this.timer++;
                
                // 横方向に高速スライド移動
                this.x += this.slideSpeed * this.dir;

                // 画面端（マージン40px）に到達したら反転
                if (this.x < 40) {
                    this.x = 40;
                    this.dir = 1;
                } else if (this.x > game.width - 40) {
                    this.x = game.width - 40;
                    this.dir = -1;
                }

                // 一定間隔で下方向に「水しぶき弾（扇状3WAY）」を撃ち込む
                // 既存の射撃レート倍率を考慮。デフォルトで約40フレーム毎
                const interval = Math.max(15, 40 / this.fireRateMultiplier);
                if (this.timer % Math.floor(interval) === 0) {
                    this.shootSplash3Way(game);
                }
                break;
        }
    }

    /**
     * 下方向への扇状3WAY（水しぶき弾）の発射ロジック
     */
    shootSplash3Way(game) {
        if (typeof EnemyBullet === 'undefined') return;
        if (game.sc && game.sc.audio) game.sc.audio.playShot(); // 必要に応じてSE再生

        const bulletSpeed = 3.5;
        // 真下（90度 = PI/2）を基準に、左右に約20度（0.35ラジアン）の傾きを持たせる
        const baseAngle = Math.PI / 2;
        const spreadAngle = 0.35; 
        const angles = [baseAngle - spreadAngle, baseAngle, baseAngle + spreadAngle];

        angles.forEach(angle => {
            const vx = Math.cos(angle) * bulletSpeed;
            const vy = Math.sin(angle) * bulletSpeed;
            
            // 既存の弾生成ロジックの引数(x, y, vx, vy)に合わせてインスタンス化
            // ※既存のthis.shoot()が(game)のみで内部処理している場合、
            //  ここに game.entities.push(new EnemyBullet(...)) を直接流し込みます
            game.entities.push(new EnemyBullet(this.x, this.y, vx, vy));
        });
    }
}
if (typeof ENEMY_REGISTRY !== 'undefined') {
    ENEMY_REGISTRY.set('skimmer', SkimmerEnemy);
}


// =================================================================
// 🆕 [STAGE-2] 23. DiverEnemy (潜水急浮上型・ダイバー)
// =================================================================
class DiverEnemy extends Enemy {
    get imageName() { return "enemy_diver.webp"; }

    constructor(game, x, y, bulletType, jumpHeight = 350) {
        // 初期Yは画面最下部（game.height + 32）からスタートさせる仕様
        // タイムラインで y: 0 と指定されても強制的に下から出すガードを配置
        const startY = game ? game.height + 32 : y;
        super(game, x, startY, bulletType, 1); // 一撃離脱なのでHP=1
        
        this.baseX = x;
        this.hasShot = false; // 頂点での一発を管理するフラグ

        // 物理パラメータ（放物線運動）
        // 規定のジャンプ高度（画面下部からの引き算）に到達するような初期初速と重力を計算
        this.vy = -7.5; // 上向きの初速（負のベクトル）
        this.gravity = 0.15; // 毎フレーム加算される重力
        
        // 浮上時に少しだけ横移動（xが左側なら右へ、右側なら左へ緩やかにシフト）
        this.vx = (x < (game ? game.width / 2 : 240)) ? 0.8 : -0.8;
    }

    /**
     * 動的生成用ファクトリメソッド
     */
    static create(game, x, y, bType, data = {}) {
        return new DiverEnemy(game, x, y, bType);
    }

    update(game) {
        if (!this.active) return;

        // 位置の更新（放物線運動）
        this.x += this.vx;
        this.y += this.vy;
        this.vy += this.gravity; // 重力加速度で徐々に減速 → 落下へ

        // 【頂点の判定】上方向への速度(vyが負)がゼロに近づいた（または超えた）瞬間
        if (!this.hasShot && this.vy >= 0) {
            this.shootAim(game);
            this.hasShot = true;
        }

        // 頂点を過ぎて再び画面下に消えていったら消滅
        // 浮上直後に即消えないよう、vyがプラス（落下中）である条件も併用
        if (this.vy > 0 && this.y > game.height + 50) {
            this.active = false;
        }
    }

    /**
     * 自機狙い弾（aim）を1発だけ放つロジック
     */
    shootAim(game) {
        if (typeof EnemyBullet === 'undefined') return;
        if (!game.player || !game.player.alive) return;

        // 自機へのベクトルを計算
        const dx = game.player.x - this.x;
        const dy = game.player.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0) {
            const bulletSpeed = 4.0; // 予習用なので、見てからかわせる適度な高速弾
            const vx = (dx / dist) * bulletSpeed;
            const vy = (dy / dist) * bulletSpeed;

            game.entities.push(new EnemyBullet(this.x, this.y, vx, vy));
            if (game.sc && game.sc.audio) game.sc.audio.playShot();
        }
    }
}
if (typeof ENEMY_REGISTRY !== 'undefined') {
    ENEMY_REGISTRY.set('diver', DiverEnemy);
}

// =================================================================
// 🆕 8. RockEnemy (高速落下・岩石型) 
// =================================================================
class RockEnemy extends Enemy {
    get imageName() { return "enemy_rock.webp"; }

    constructor(game, x, y, speedY = 6.0) {
        super(game, x, y, 'none', 1); // 弾は撃たない('none')、仕様通りHP=1
        this.speedY = speedY;
    }

    /**
     * 動的生成用ファクトリメソッド
     */
    static create(game, x, y, bType, data = {}) {
        const speedY = data.speedY !== undefined ? data.speedY : 6.0;
        return new RockEnemy(game, x, y, speedY);
    }

    update(game) {
        if (!this.active) return;
        
        this.y += this.speedY;

        // 画面外（下部）へ消えたら非アクティブ化
        if (this.y > game.height + 50) this.active = false;
    }
}
if (typeof ENEMY_REGISTRY !== 'undefined') {
    ENEMY_REGISTRY.set('rock', RockEnemy);
}


// =================================================================
// 🆕 9. WormEnemy / WormSegment (連結エネミー)
// =================================================================
/**
 * 連結エネミーの「頭部」クラス
 * タイムライン（YAML）からはこの Head が生成されます
 */
class WormEnemy extends Enemy {
    get imageName() { return "enemy_worm_head.webp"; }

    constructor(game, x, y, bulletType, length = 5) {
        super(game, x, y, bulletType, 1); // 頭部のHP=1
        this.speedY = 1.0;
        this.segments = []; // 胴体・お尻パーツの参照リスト
        
        // コンストラクタ内で連なる胴体パーツを動的に生成
        if (game && game.entities) {
            for (let i = 1; i < length; i++) {
                // 初期位置は頭部の少し上にずらして配置
                const seg = new WormSegment(game, x, y - (i * 24), this, i === length - 1);
                this.segments.push(seg);
                game.entities.push(seg); // ゲームのエンティティリストへ登録
            }
        }
    }

    /**
     * 動的生成用ファクトリメソッド
     * YAMLの data.length から連結数を指定可能（デフォルト5節）
     */
    static create(game, x, y, bType, data = {}) {
        const length = data.length !== undefined ? data.length : 5;
        return new WormEnemy(game, x, y, bType, length);
    }

    update(game) {
        if (!this.active) return;
        
        this.y += this.speedY;

        // 画面外へ消えたら自身を消滅
        if (this.y > game.height + 50) this.active = false;
    }

    /**
     * 頭部が撃破された時の処理（オーバーライド）
     * 頭を撃たれたら、連なっている全パーツを巻き込んで爆破（連鎖爆破）
     */
    takeDamage(amount) {
        const isDead = super.takeDamage(amount);
        if (isDead) {
            // 残っている全セグメントを強制的に撃破状態にする
            this.segments.forEach(seg => {
                if (seg.active) {
                    seg.forceDestroy();
                }
            });
        }
        return isDead;
    }

    /**
     * 胴体が破壊された時に、頭部側からリストを詰めて「縮める」ための内部処理
     */
    removeSegment(targetSeg) {
        this.segments = this.segments.filter(seg => seg !== targetSeg);
        
        // 残ったパーツの追従インデックスを再計算し、隙間を詰めて縮める
        this.segments.forEach((seg, index) => {
            seg.reindex(index + 1);
        });
    }
}
if (typeof ENEMY_REGISTRY !== 'undefined') {
    ENEMY_REGISTRY.set('worm', WormEnemy);
}

/**
 * 連結エネミーの「胴体・お尻」パーツ用クラス（内部補助クラス）
 */
class WormSegment extends Enemy {
    get imageName() { 
        return this.isTail ? "enemy_worm_tail.webp" : "enemy_worm_body.webp"; 
    }

    constructor(game, x, y, headRef, index, isTail = false) {
        super(game, x, y, 'none', 1); // 胴体は弾を撃たない、HP=1
        this.head = headRef;         // 親（頭部）への参照
        this.index = index;          // 頭から何番目か
        this.isTail = isTail;        // 末尾パーツフラグ
    }

    update(game) {
        if (!this.active) return;

        // 原則として、親（頭部）が消滅したら自分も消える
        if (!this.head || !this.head.active) {
            this.active = false;
            return;
        }

        // 頭部の位置を基準に、自分のインデックス分だけ上に綺麗に追従させる
        this.x = this.head.x;
        this.y = this.head.y - (this.index * 24);
    }

    /**
     * 胴体部が直接撃たれて破壊された場合の処理
     */
    takeDamage(amount) {
        const isDead = super.takeDamage(amount);
        if (isDead && this.head) {
            // 親（頭部）に対して、自分が破壊されたことを通知（縮小化処理を依頼）
            this.head.removeSegment(this);
        }
        return isDead;
    }

    /**
     * 頭部がやられた時に、上から連鎖的に爆破されるための強制破壊メソッド
     */
    forceDestroy() {
        this.active = false;
        // ※必要に応じて、ここに個別の爆発エフェクト生成やスコア加算ロジックを挿入
        if (this.game && typeof Explosion !== 'undefined') {
            this.game.entities.push(new Explosion(this.x, this.y));
        }
    }

    /**
     * 隙間が詰まった時にインデックスを修正するメソッド
     */
    reindex(newIndex) {
        this.index = newIndex;
    }
}


// =================================================================
// 🆕 11. MineDebrisEnemy (炭鉱の浮遊物・無敵障害物)
// =================================================================
class MineDebrisEnemy extends Enemy {
    get imageName() { return "enemy_mine_debris.webp"; }

    constructor(game, x, y, speedY = 1.2) {
        // 弾は撃たない('none')、絶対に壊れないようHPは巨大な値(Infinity)を設定
        super(game, x, y, 'none', Infinity);
        this.speedY = speedY;
    }

    /**
     * 動的生成用ファクトリメソッド
     */
    static create(game, x, y, bType, data = {}) {
        const speedY = data.speedY !== undefined ? data.speedY : 1.2;
        return new MineDebrisEnemy(game, x, y, speedY);
    }

    /**
     * ダメージ処理を完全無効化（殺せない仕様のガード句）
     */
    takeDamage(amount) {
        // 何点撃ち込まれても常に死亡判定は false（破壊不可）
        // ※撃ち込み点数を入れたい、ピキピキと火花エフェクトを出したい場合はここに記述
        return false;
    }

    update(game) {
        if (!this.active) return;

        // ふわふわとゆっくり降下してくる
        this.y += this.speedY;

        // 画面外に去ったら安全に消去
        if (this.y > game.height + 50) this.active = false;
    }
}
if (typeof ENEMY_REGISTRY !== 'undefined') {
    ENEMY_REGISTRY.set('debris', MineDebrisEnemy);
}