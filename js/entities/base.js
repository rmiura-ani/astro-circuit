/*
 * PROJECT: VOID-CIRCUIT
 *
 * entities/base.js アセット管理、シナリオ管理、エンティティベース、パーティクル
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */

class AssetManager {
    constructor() {
        this.imageCache = {};
    }

    async loadImages(assetBase) {
        const imagesToLoad = {
            'player.webp': assetBase + 'player.webp',
            'enemy_straight.webp': assetBase + 'enemy_straight.webp',
            'enemy_sine.webp': assetBase + 'enemy_sine.webp',
            'enemy_stationary.webp': assetBase + 'enemy_stationary.webp',
            'enemy_boss_01.webp': assetBase + 'enemy_boss_01.webp'
        };

        const loadImg = (key, url) => new Promise(r => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                this.imageCache[key] = img;
                r(img);
            };
            img.onerror = () => {
                console.error(`Image load failed: ${url}`);
                r(null);
            };
            img.src = url;
        });

        await Promise.all(
            Object.entries(imagesToLoad).map(([key, url]) => loadImg(key, url))
        );
        console.log("[Assets] All images preloaded.");
    }

    get(key) {
        return this.imageCache[key];
    }
}

class EnemyManager {
    constructor() {
        this.REQUIRED_VERSION = 0.1;
        this.scenario = [];
        this.currentIndex = 0;
        this.isFinished = false;
        
        // 難易度によるグローバル倍率
        this.speedMultiplier = 1.0;
        this.fireRateMultiplier = 1.0;
        
        this.version = "0.0";
        this.scenarioName = "UNKNOWN";
    }

    /**
     * JSONシナリオファイルをロード
     */
    async loadScenario(path, scenarioName) {
        try {
            const res = await fetch(path);
            if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);            
            const data = await res.json();
            
            // バージョンチェック
            this.version = data.version || "0.1";
            if (parseFloat(this.version) < this.REQUIRED_VERSION) {
                console.error(`[Warning] Scenario v${this.version} is outdated.`);
            }
            
            // フレーム順にソート（データがバラバラでも動くように）
            this.scenario = (data.enemies || data || []).sort((a, b) => a.frame - b.frame);
            
            this.scenarioName = scenarioName;

            this.reset();
            console.log(`[System] Scenario "${path}" loaded.`);
        } catch (e) {
            console.error("[System] Scenario Load Failed:", e);
        }
    }

    /**
     * 難易度設定の適用
     */
    setDifficulty(params) {
        this.speedMultiplier = params.enemySpeed || 1.0;
        this.fireRateMultiplier = params.fireRate || 1.0;
    }

    /**
     * 毎フレームの更新処理
     */
    update(frame, game) {
        if (this.isFinished || this.scenario.length === 0) return;

        // 指定フレームに到達した敵をすべて生成
        while (
            this.currentIndex < this.scenario.length && 
            this.scenario[this.currentIndex].frame <= frame
        ) {
            this.spawnEnemy(this.scenario[this.currentIndex], game);
            this.currentIndex++;
        }

        if (this.currentIndex >= this.scenario.length) {
            this.isFinished = true;
        }
    }

    /**
     * 敵インスタンスの動的生成
     */
    spawnEnemy(data, game) {
        const bType = data.bulletType || 'aim';
        const hp = data.hp || 1;
        const x = data.x ?? Math.random() * game.width;
        const y = data.y ?? -32; // 基本は画面外上部

        let enemy;

        // 敵タイプに応じたクラス生成
        switch (data.type) {
            case 'sine':
                enemy = new SineEnemy(game, x, y, bType, data.phase || 0);
                if (data.amplitude) enemy.amplitude = data.amplitude;
                if (data.frequency) enemy.frequency = data.frequency;
                break;

            case 'stationary':
                enemy = new StationaryEnemy(
                    game, x, y, bType, hp, 
                    data.stopY || 120, 
                    data.waitTime || 180
                );
                break;

            case 'boss':
                enemy = new BossEnemy(game, x, y, bType, hp);
                break;

            case 'straight':
            default:
                enemy = new StraightEnemy(game, x, y, bType, hp);
                break;
        }

        // 難易度と個別パラメータの適用
        this._applyDifficultyParams(enemy, data);

        game.stats.enemiesSpawned++;
        game.entities.push(enemy);
    }

    _applyDifficultyParams(enemy, data) {
        // HPの上書き
        if (data.hp !== undefined) {
            enemy.hp = data.hp;
            enemy.maxHp = data.hp;
        }

        // 移動速度：(データ指定速度 or クラス既定速度) × 難易度倍率
        const baseSpeed = data.speed ?? enemy.speed; 
        enemy.speed = baseSpeed * this.speedMultiplier;

        // 射撃レート
        enemy.fireRateMultiplier = this.fireRateMultiplier;
    }

    reset() {
        this.currentIndex = 0;
        this.isFinished = false;
    }
}

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

    // 画面外判定（上下左右の余白指定可能）
    isOutOfBounds(cw = 320, ch = 480, margin = 50) {
        return (this.y > ch + margin || this.y < -margin || 
                this.x > cw + margin || this.x < -margin);
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
 * スコアテキスト
 */
class ScoreText {
    constructor(x, y, score, color = "#fff") {
        this.x = x;
        this.y = y;
        this.score = score;
        this.color = color;
        this.opacity = 1.0;
        this.life = 60; // 表示フレーム数（約1秒）
        this.isDead = false;
    }

    update() {
        this.y -= 0.5;    // ゆっくり上昇
        this.life--;
        this.opacity = this.life / 60; // 徐々に透明に
        if (this.life <= 0) this.isDead = true;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.fillStyle = this.color;
        ctx.font = "8px 'Press Start 2P'"; // レトロなフォント
        ctx.textAlign = "center";
        ctx.fillText(this.score, this.x, this.y);
        ctx.restore();
    }
}