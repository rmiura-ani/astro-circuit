/*
 * PROJECT: VOID-CIRCUIT
 *
 * entities/base.js アセット管理、シナリオ管理、エンティティベース、パーティクル
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */

/**
 * ScenarioManager 敵キャラシナリオ管理
 */
class ScenarioManager {
    constructor() {
        this.REQUIRED_VERSION = 0.2;
        this.reset();
    }

    /** YAMLシナリオファイルをロード */
    async loadScenario(path, scenarioName) {
        try {
            const res = await fetch(path);
            if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
            
            // YAML形式でロード
            const yamlText = await res.text();
            const data = jsyaml.load(yamlText);            
            if (!data) throw new Error("YAML parse failed or empty.");

            // バージョンチェック
            this.version = data.version || "0.1";
            if (parseFloat(this.version) < this.REQUIRED_VERSION) {
                console.warn(`[Warning] Scenario v${this.version} is outdated.`);
            }

            this.reset();

            // メタデータの抽出
            this.stageName = data.name || "Unknown Stage";
            this.bgm = data.bgm || "";
            this.bgColor = data.bgColor || "#000000";

            // 敵データの抽出とソート
            // data.enemies があればそれを、なければデータ自体を配列として扱う
            const rawEnemies = Array.isArray(data.enemies) ? data.enemies : (Array.isArray(data) ? data : []);
            this.scenario = rawEnemies.sort((a, b) => a.frame - b.frame);
            
            this.scenarioName = scenarioName;

            console.log(`[System] YAML Scenario "${path}" loaded. (${this.scenario.length} events)`);
            return true;
        } catch (e) {
            console.error("[System] Scenario Load Failed:", e);
            return false;
        }
    }

    /** サウンドテスト用：特定のステージのYAMLからBGM名とステージ名だけをピンポイントで取得する */
    async peekStageMeta(stageNum, assetBase) {
        const fileName = `stage-${stageNum}/scenario.yaml`;
        const scenarioPath = `${assetBase}${fileName}`;
        try {
            const res = await fetch(scenarioPath);
            if (!res.ok) return null;
            
            const yamlText = await res.text();
            const data = jsyaml.load(yamlText);
            if (!data) return null;

            return {
                stageNum: stageNum,
                name: data.name || `STAGE ${stageNum}`,
                bgm: data.bgm || ""
            };
        } catch (e) {
            console.warn(`[Scenario] Failed to peek meta for stage ${stageNum}`);
            return null;
        }
    }

    /** 難易度設定の適用 */
    setDifficulty(params) {
        this.speedMultiplier = params.enemySpeed || 1.0;
        this.fireRateMultiplier = params.fireRate || 1.0;
    }

    /** 更新 */
    update(gameFrame, game) {
        if (this.isFinished || this.scenario.length === 0) return;

        // シナリオ内フレームを進める
        this.currentScenarioFrame++;

        // 現在のインデックスから、指定フレームに到達したイベントを処理
        while (
            this.currentIndex < this.scenario.length && 
            this.scenario[this.currentIndex].frame <= this.currentScenarioFrame
        ) {
            const data = this.scenario[this.currentIndex];

            // 特殊イベント「LOOP_END」の判定
            if (data.type === 'LOOP_END') {
                // ループ実行：フレームとインデックスを戻す
                this.currentScenarioFrame = data.returnTo || 0;
                this.currentIndex = this.findStartIndexForFrame(this.currentScenarioFrame);
                console.log(`[System] Scenario looping back to frame: ${this.currentScenarioFrame}`);
                continue; // 巻き戻した後の最初の敵を即座に判定するためにループ継続
            }

            // 通常の敵生成
            this.spawnEnemy(data, game);
            this.currentIndex++;
        }

        if (this.currentIndex >= this.scenario.length) {
            this.isFinished = true;
        }
    }

    /** 指定フレームまで巻き戻した際の、最適な currentIndex を探す */
    findStartIndexForFrame(targetFrame) {
        let index = 0;
        while (index < this.scenario.length && this.scenario[index].frame < targetFrame) {
            index++;
        }
        return index;
    }

    /** 現在のインデックスから先に向かって、最初の LOOP_END を探す */
    skipToAfterLoop() {
        for (let i = this.currentIndex; i < this.scenario.length; i++) {
            if (this.scenario[i].type === 'LOOP_END') {
                // LOOP_END の次のイベントまでインデックスを飛ばす
                this.currentIndex = i + 1;
                
                // シナリオ内の内部時計も、その LOOP_END のフレームまで進める
                this.currentScenarioFrame = this.scenario[i].frame;
                
                console.log(`[System] Boss defeated! Skipped to scenario frame: ${this.currentScenarioFrame}`);
                return;
            }
        }
    } 

    /** リセット */
    reset() {
        this.scenario = [];
        this.stageName = "";
        this.bgm = "";
        this.bgColor = "#000000";
        this.scenarioName = "UNKNOWN";

        this.currentIndex = 0;
        this.currentScenarioFrame = 0;
        this.isFinished = false;
        
        this.speedMultiplier = 1.0;
        this.fireRateMultiplier = 1.0;
        
        this.version = "0.0"    
    }

    /** 敵インスタンスの動的生成 */
    spawnEnemy(data, game) {
        const bType = data.bulletType || 'aim';
        const hp = data.hp || 1;
        const x = data.x ?? Math.random() * game.width;
        const y = data.y ?? -32; // 基本は画面外上部
        let timeLimit = data.timeLimit;
        let timeMultiplier = data.timeMultiplier;
        if (data.type.includes('boss')) {
            const minTime = (hp / 2) * 8; 
            if (!timeLimit) timeLimit = Math.floor(minTime * 4);
            if (!timeMultiplier) timeMultiplier = Math.floor(hp * 3.33); 
        }

        if (data.spawned) return;

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

            case 'boss_01':
                enemy = new BossEnemy_01(game, x, y, hp, timeLimit, timeMultiplier);
                game.startBossBattle();
                data.spawned = true;
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
 * ScenarioManager 敵キャラ画像管理
 */
class AssetManager {
    constructor(basePath) {
        this.basePath = basePath;
        this.imageCache = {};
    }

    async loadImages() {
        const imagesToLoad = {
            'player.webp': this.basePath + 'player.webp',
            'enemy_straight.webp': this.basePath + 'enemy_straight.webp',
            'enemy_sine.webp': this.basePath + 'enemy_sine.webp',
            'enemy_stationary.webp': this.basePath + 'enemy_stationary.webp',
            'enemy_boss_01.webp': this.basePath + 'enemy_boss_01.webp'
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
