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
        
        // ボス専用パラメータの自動逆算ロジック
        let timeLimit = data.timeLimit;
        let timeMultiplier = data.timeMultiplier;
        if (data.type && data.type.includes('boss')) {
            const minTime = (hp / 2) * 8; 
            if (!timeLimit) timeLimit = Math.floor(minTime * 4); // 最速の4倍を制限時間に
            if (!timeMultiplier) timeMultiplier = Math.floor(hp * 3.33); 
        }

        // 重複生成防止
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

            // --- 🚨 【新規ザコ追加】個性豊かなメンバーたち ---
            case 'assault':
                enemy = new AssaultEnemy(game, x, y, bType);
                break;

            case 'hunter':
                enemy = new HunterEnemy(game, x, y, bType);
                break;

            case 'shield':
                enemy = new ShieldEnemy(game, x, y, bType);
                break;

            case 'scout':
                // YAML側から左右のスタート方向(isLeft)を指定可能に。デフォルトはtrue(左から右)
                const isLeftToRight = data.isLeft !== undefined ? data.isLeft : true;
                enemy = new ScoutEnemy(game, x, y, bType, isLeftToRight);
                break;

            // --- 🚨 【ボス関連】共通処理をまとめつつ分岐 ---
            case 'boss_01':
                enemy = new BossEnemy_01(game, x, y, hp, timeLimit, timeMultiplier);
                break;

            case 'boss_02':
                enemy = new BossEnemy_02(game, x, y, hp, timeLimit, timeMultiplier);
                break;

            case 'straight':
            default:
                enemy = new StraightEnemy(game, x, y, bType, hp);
                break;
        }

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
