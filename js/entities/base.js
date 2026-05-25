/*
 * PROJECT: VOID-CIRCUIT
 *
 * entities/base.js アセット管理、エンティティベース、パーティクル
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */

/**
 * 全エンティティの基底クラス
 */
/**
 * 全エンティティの基底クラス
 */
class Entity {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.active = true;
    }

    /**
     * 画面外および座標異常の共通判定
     * @param {number} margin 通常エンティティの画面外許容マージン
     * @param {boolean} isEnemy 敵固有のトリッキーな移動（左右・上への一時アウト）を許容するか
     * @returns {boolean} 排除すべき対象（画面外・異常値）ならtrue
     */
    isOutOfBounds(margin, isEnemy = false) {
        // 🛑 【最優先セーフティ】座標が NaN になったら無条件で即時排除
        if (isNaN(this.x) || isNaN(this.y)) {
            return true;
        }

        // 🛑 【敵専用ロジック】トリッキーな動きをする敵の場合
        if (isEnemy) {
            // 1. 下方向に完全に突き抜けたら消滅（既存の仕様を維持）
            if (this.y > GAME_CONFIG.HEIGHT) {
                return true;
            }

            // 2. 画面外から戻ってくる動きを許容しつつ、
            //    絶対に戻ってこれない宇宙の彼方（3000px）に暴走した場合は強制排除
            const ABSOLUTE_LIMIT = 3000;
            if (this.x < -ABSOLUTE_LIMIT || this.x > ABSOLUTE_LIMIT || this.y < -ABSOLUTE_LIMIT) {
                return true;
            }

            // 左右や上方向の通常のはみ出しは戻ってくる可能性があるので、ここではまだ false（画面内扱い）にする
            return false;
        }

        // 🛑 【通常ロジック】自機、自機弾、敵弾などは四方のマージンを越えたら即消滅
        return (
            this.y > GAME_CONFIG.HEIGHT + margin || 
            this.y < -margin || 
            this.x > GAME_CONFIG.WIDTH + margin || 
            this.x < -margin
        );
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
        if (this.isOutOfBounds(50)) this.active = false;
    }
    /** 敵弾を描画する */
    draw(ctx) {
        ctx.fillStyle = '#F0F';
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.renderRadius, 0, Math.PI * 2);
        ctx.fill();
    }
}

/**
 * 演出用パーティクル
 */
class Particle extends Entity {
    constructor(x, y, type = 'enemy') {
        super(x, y, 2, 2);
        this.type = type;
        const angle = Math.random() * Math.PI * 2;
        const speed = (type === 'player') ? Math.random() * 8 + 2 : Math.random() * 6;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = (type === 'player') ? 100 : 20;
        this.maxLife = this.life;
        this.size = (type === 'player') ? Math.random() * 4 + 2 : 2;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.type === 'player') {
            this.vx *= 0.96; this.vy *= 0.96; this.size *= 0.98;
        }
        this.life--;
        if (this.life <= 0) this.active = false;
    }

    /** パーティクルを描画する */
    draw(ctx) {
        const ratio = this.life / this.maxLife;
        ctx.save();
        
        if (this.type === 'player') {
            ctx.fillStyle = `rgba(255, ${Math.floor(255 * ratio)}, ${Math.floor(100 * ratio)}, ${ratio})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        } 
        else if (this.type === 'boss') {
            ctx.shadowBlur = 10 * ratio;
            ctx.shadowColor = '#0FF';
            ctx.fillStyle = `rgba(${Math.floor(100 + 155 * (1 - ratio))}, 255, 255, ${ratio})`;
            ctx.translate(this.x, this.y);
            ctx.rotate(Math.PI / 4);
            ctx.fillRect(-this.size / 2, -this.size / 2, this.size * 1.5, this.size * 1.5);
        } 
        else {
            ctx.fillStyle = `rgba(255, 255, 100, ${ratio})`;
            ctx.fillRect(this.x, this.y, this.size, this.size);
        }
        
        ctx.restore();
    }
}

/**
 * スコアテキスト：画面上に浮かび上がる得点演出
 */
class ScoreText {
    constructor(x, y, score, color = "#fff") {
        this.x = x;
        this.y = y;
        this.opacity = 1.0;
        this.isDead = false;

        // --- 【大改修】データの整形とカンマ区切りの一元化 ---
        // scoreが配列ならそのまま使い、数値や単一文字列なら配列に包む
        const rawLines = Array.isArray(score) ? score : [score];
        
        // 配列の中身を走査し、純粋な数値（number）があればここでカンマ区切り文字列に変換する
        this.lines = rawLines.map(line => 
            (typeof line === 'number') ? line.toLocaleString() : String(line)
        );

        // 判定用の平滑化文字列を作成
        const flatScore = this.lines.join(" ");
        const numScore = typeof score === 'number' ? score : 0;

        // --- 表示タイプの特定 ---
        let displayType = "NORMAL";
        if (flatScore.includes("BONUS")) {
            displayType = "BONUS";
        } else if (numScore >= 500000) {
            displayType = "BOSS_KILLED";
        } else if (numScore >= 10000) {
            displayType = "MEDIUM_KILLED";
        }

        switch (displayType) {
            case "BONUS":
                this.color = "#0FF";     // シアン
                this.fontSize = 16;      // 最大
                this.maxLife = 120;      // 最長
                this.speed = 0.8;
                this.isBonus = true;
                break;

            case "BOSS_KILLED":
                this.color = "#ff0";     // ゴールド
                this.fontSize = 16;
                this.maxLife = 120;
                this.speed = 0.8;        // スッと勢いよく飛び出す
                this.isBonus = false;
                break;

            case "MEDIUM_KILLED":
                this.color = "#f0f";     // マゼンタ
                this.fontSize = 11;
                this.maxLife = 60;
                this.speed = 0.5;        // 標準的な速度
                this.isBonus = false;
                break;

            default: // NORMAL
                this.color = color;      // 指定色
                this.fontSize = 8;
                this.maxLife = 60;
                this.speed = 0.5;
                this.isBonus = false;
                break;
        }

        this.life = this.maxLife;
        this.isBig = (displayType === "BONUS" || displayType === "BOSS_KILLED");
    }

    update() {
        this.y -= this.speed;        
        this.life--;
        this.opacity = this.life / this.maxLife;
        if (this.life <= 0) this.isDead = true;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.opacity;

        ctx.font = `${this.fontSize}px 'Press Start 2P'`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle"; 
        
        ctx.strokeStyle = "#000";
        ctx.lineWidth = (this.isBig || this.isBonus) ? 4 : 2;
        ctx.fillStyle = this.color;

        // --- 複数行描画の処理（すでにコンストラクタで整形済みなのでシンプルに） ---
        const lineHeight = this.fontSize * 1.4;

        this.lines.forEach((text, index) => {
            // 中心からの相対Y座標を計算
            const drawY = this.y + (index - (this.lines.length - 1) / 2) * lineHeight;
            ctx.strokeText(text, this.x, drawY);
            ctx.fillText(text, this.x, drawY);
        });

        ctx.restore();
    }
}

/**
 * AssetManager: 画像アセットの完全動的オンデマンドロード管理
 */
class AssetManager {
    constructor(basePath) {
        this.basePath = basePath;
        this.imageCache = {};      // ロード完了した Image オブジェクトのキャッシュ
        this.loadingPromises = {}; // 二重ロードを防ぐための、現在ロード中のPromise
    }

    /**
     * 画像をオンデマンドで取得・ロードする
     * @param {string} key 画像のファイル名 (例: 'enemy_assault.webp')
     * @returns {HTMLImageElement|null} ロード済みの画像。まだロード中ならnullか仮の画像を返す
     */
    get(key) {
        if (!key) return null;

        // 1. すでにキャッシュにある場合は、それを即座に返す（毎フレームの描画処理用）
        if (this.imageCache[key]) {
            return this.imageCache[key];
        }
        if (!key || key.includes("LOOP") || key.includes("BOSS_TRIGGER") || !key.includes(".")) {
            return Promise.resolve(null);
        }
        // 2. まだロードが始まっていない初見の画像の場合、非同期ロードを裏で開始する
        if (!this.loadingPromises[key]) {
            const url = `${this.basePath}${key}`;

            this.loadingPromises[key] = new Promise(resolve => {
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.onload = () => {
                    this.imageCache[key] = img; // キャッシュに格納
                    console.log(`[Assets]  Ready: ${key}`);
                    resolve(img);
                };
                img.onerror = () => {
                    console.error(`[Assets] ❌ Load failed: ${url}`);
                    // エラー時は二重ロード防止を解除し、次回リトライ可能にする
                    this.loadingPromises[key] = null;
                    resolve(null);
                };
                img.src = url;
            });
        }

        // 3. ロード中の場合は、一瞬だけ null が返る（ゲームループは止まらない）
        // ※ 完全にロードされるまでの数フレーム間、透明になるか白丸で代用されます
        return null; 
    }

    /** 自機など、ゲーム開始時に「絶対に最初から画面にいないと困るもの」だけを
     * 事前にロードしておきたい場合に使用するセーフティメソッド *\
     */
    async preload(keys) {
        // すべてを get() に丸投げして、そのロード完了を待つ
        await Promise.all(keys.map(key => {
            this.get(key);
            return this.loadingPromises[key] || Promise.resolve();
        }));
        console.log("[Assets] Core images preloaded.");
    }
}