/*
 * PROJECT: VOID-CIRCUIT
 *
 * entities/scenario.js シナリオ管理
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */

/**
 * ScenarioManager 敵キャラシナリオ管理
 */
export class ScenarioManager {
    constructor() {
        this.REQUIRED_VERSION = 0.3;
        this.reset();
    }

    get length() { return this._scenario.length; }

    /** YAMLシナリオファイルをロード */
    async loadScenario(path) {
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
            this.kv = data.kv || "";
            // 敵データの抽出とソート
            this._scenario =  data.scenario.sort((a, b) => a.frame - b.frame);
            
            console.log(`[System] YAML Scenario "${path}" loaded. (${this._scenario.length} events)`);
            return true;
        } catch (e) {
            console.error("[System] Scenario Load Failed:", e);
            return false;
        }
    }

async loadStageResources(stageNum, assetManager, audioManager, assetBase) {
    const fileName = `stage-${stageNum}/scenario.yaml`;
    const scenarioPath = `${assetBase}${fileName}`;
    
    // ✨ 新しいロードが始まるので、前回の残ったエラーをクリアする
    this.lastError = null; 

    try {
        // 1. シナリオYAML自体のロード
        const loadSuccess = await this.loadScenario(scenarioPath);
        // 💡 どこで落ちたか分かりやすくするため、エラーメッセージを具体的に記載
        if (!loadSuccess) throw new Error(`Failed to load scenario file: "${fileName}"`);

        // 2. scenario配下から出現する敵の種類を自動スキャン
        const enemyData = this._scenario; 
        const enemyTypes = enemyData.map(e => e.type).filter(Boolean);
        const uniqueTypes = [...new Set(enemyTypes)];

        // 敵の基本画像を配列化 (boss_01 -> enemy_boss_01.webp)
        const imagesToPreload = uniqueTypes.map(type => `enemy_${type}.webp`);

        // 3. YAML直書きの固有追加アセットをマージ
        if (Array.isArray(this.preloadAssets)) {
            imagesToPreload.push(...this.preloadAssets);
        }

        // 4. キービジュアル画像の追加
        if (this.kv) {
            const kvPath = typeof this.kv === 'object' ? this.kv.path : this.kv;
            if (kvPath) {
                imagesToPreload.push(kvPath);
            }
        }

        // 5. 既存の AssetManager を使って一括プリロードを実行
        const finalImages = [...new Set(imagesToPreload)];
        if (finalImages.length > 0) {
            try {
                await assetManager.preload(finalImages); 
            } catch (assetError) {
                // 💡 画像ロード自体のエラーをラップして原因を絞り込む
                throw new Error(`Image asset preload failed. (Check files: ${finalImages.slice(0, 3).join(', ')}...)`);
            }
        }

        // 6. 既存の AudioManager を使ってBGMをロード
        if (this.bgm) {
            try {
                await audioManager.loadStageBGM(this.bgm);
            } catch (audioError) {
                throw new Error(`BGM load failed: "${this.bgm}"`);
            }
        }            

        // 7. 既存の AudioManager を使ってシステムSEを一括プリロード
        if (audioManager && typeof audioManager.preloadSE === 'function') {
            try {
                await audioManager.preloadSE();
            } catch (seError) {
                throw new Error(`SE preload failed. Check audio system.`);
            }
        }

        return true;
    } catch (error) {
        console.error(`[ScenarioManager] Failed to load resources for stage ${stageNum}:`, error);
        
        // ✨ ここで catch した error のメッセージをインスタンスに保存します！
        this.lastError = error.message; 
        
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
        if (this.isFinished || this._scenario.length === 0) return;

        // シナリオ内フレームを進める
        this.currentScenarioFrame++;

        // 現在のインデックスから、指定フレームに到達したイベントを処理
        while (
            this.currentIndex < this._scenario.length && 
            this._scenario[this.currentIndex].frame <= this.currentScenarioFrame
        ) {
            const data = this._scenario[this.currentIndex];

            // 特殊イベント「LOOP_END」の判定
            if (data.type === 'LOOP_END') {
                // ループ実行：フレームとインデックスを戻す
                this.currentScenarioFrame = data.returnTo || 0;
                this.currentIndex = this._findStartIndexForFrame(this.currentScenarioFrame);
                console.log(`[System] Scenario looping back to frame: ${this.currentScenarioFrame}`);
                continue; // 巻き戻した後の最初の敵を即座に判定するためにループ継続
            }

            // 通常の敵生成
            this.spawnEnemy(data, game);
            this.currentIndex++;
        }

        if (this.currentIndex >= this._scenario.length) {
            this.isFinished = true;
        }
    }

    /** 指定フレームまで巻き戻した際の、最適な currentIndex を探す */
    _findStartIndexForFrame(targetFrame) {
        let index = 0;
        while (index < this._scenario.length && this._scenario[index].frame < targetFrame) {
            index++;
        }
        return index;
    }

    /** 現在のインデックスから先に向かって、最初の LOOP_END を探す */
    skipToAfterLoop() {
        for (let i = this.currentIndex; i < this._scenario.length; i++) {
            if (this._scenario[i].type === 'LOOP_END') {
                this.currentIndex = i + 1;
                this.currentScenarioFrame = this._scenario[i].frame;
                return;
            }
        }
    }

    /** リセット */
    reset() {
        this._scenario = [];
        this.stageName = "";
        this.bgm = "";
        this.kv = "";

        this.currentIndex = 0;
        this.currentScenarioFrame = 0;
        this.isFinished = false;
        
        this.speedMultiplier = 1.0;
        this.fireRateMultiplier = 1.0;
        
        this.version = "0.0"    

        this.lastError = null;
    }

    /** 敵インスタンスの動的生成 */
    spawnEnemy(data, game) {
        const bType = data.bulletType || 'aim';
        const hp = data.hp || 1;
        const x = data.x ?? Math.random() * game.width;
        const y = data.y ?? -32; // 基本は画面外上部
        
        // ボス専用パラメータの自動逆算ロジック
        if (data.type && data.type.includes('boss')) {
            const minTime = (hp / 2) * 8; 
            if (!data.timeLimit) {
                data.timeLimit = Math.floor(minTime * 4);
            }
            if (!data.timeLimit || isNaN(data.timeLimit)) {
                data.timeLimit = 3600;
            }
            if (!data.timeMultiplier) {
                data.timeMultiplier = Math.floor(hp * 3.33);
            }
        }

        // 重複生成防止
        if (data.spawned) return;
        const enemy = createEnemyInstance(data.type, game, x, y, bType, data);

        // 🚨 ボス系エンティティが生成された場合の共通演出トリガー
        if (data.type && data.type.includes('boss')) {
            game.startBossBattle(); // スクロール停止、警告演出、タイムボーナスカウント開始
            data.spawned = true;    // 無限ループ時でもボス自体が何匹も湧かないようにガード
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
