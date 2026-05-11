/*
 * PROJECT: VOID-CIRCUIT
 *
 * enemy-managers.js
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */
/**
 * EnemyManager: シナリオ管理
 * フレーム数に基づいて敵の生成スケジュールを制御します。
 */
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
        this.displayName = "UNKNOWN";
    }

    /**
     * JSONシナリオファイルをロード
     */
    async loadScenario(path, branchName) {
        try {
            const res = await fetch(path);
            if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
            
            const data = await res.json();
            
            // バージョンチェック
            this.version = data.version || "0.1";
            if (parseFloat(this.version) < this.REQUIRED_VERSION) {
                console.error(`[Warning] Scenario v${this.version} is outdated.`);
            }

            this.displayName = branchName.toUpperCase();
            
            // フレーム順にソート（データがバラバラでも動くように）
            this.scenario = (data.enemies || data || []).sort((a, b) => a.frame - b.frame);
            
            this.reset();
            console.log(`[System] Scenario "${this.displayName}" loaded.`);
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

