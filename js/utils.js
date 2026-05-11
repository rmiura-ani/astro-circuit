/*
 * PROJECT: VOID-CIRCUIT
 *
 * util.js
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */

/**
 * シナリオ管理：フレーム数に応じて敵を生成・制御する
 */
class EnemyManager {
    constructor(scenario) { 
        this.scenario = scenario.sort((a, b) => a.frame - b.frame);
        this.enemySpeedMultiplier = 1.0;
        this.fireRateMultiplier = 1.0;
        this.currentIndex = 0; 
        this.isFinished = false; 
    }
    
    setDifficulty(params) {
        this.enemySpeedMultiplier = params.enemySpeed || 1.0;
        this.fireRateMultiplier = params.fireRate || 1.0;
        console.log(`[System] Difficulty applied: Speed x${this.enemySpeedMultiplier}, Fire x${this.fireRateMultiplier}`);
    }
    
    update(frame, game) {
        if (this.isFinished) return;

        if (this.currentIndex >= this.scenario.length) {
            this.isFinished = true;
            return;
        }

        while (
            this.currentIndex < this.scenario.length && 
            this.scenario[this.currentIndex].frame === frame
        ) {
            this.spawnEnemy(this.scenario[this.currentIndex], game);
            this.currentIndex++;
        }
    }

    /**
     * データに基づいて個別の敵インスタンスを生成
     */
    spawnEnemy(data, game) {
        const { assetBase } = game;
        const bType = data.bulletType || 'aim';
        const hp = data.hp || 1;
        const x = data.x ?? 160;
        const y = -32;

        let enemy;

        // ★修正ポイント：entities.js の新しいサブクラスを呼び出す
        switch (data.type) {
            case 'sine':
                enemy = new SineEnemy(assetBase, x, y, bType, data.phase || 0);
                if (data.amplitude) enemy.amplitude = data.amplitude;
                if (data.frequency) enemy.frequency = data.frequency;
                break;

            case 'stationary':
                enemy = new StationaryEnemy(
                    assetBase, x, y, bType, hp, 
                    data.stopY || 120, 
                    data.waitTime || 180
                );
                break;

            case 'straight':
            default:
                // デフォルトを StraightEnemy にすることで、専用画像が読み込まれる
                enemy = new StraightEnemy(assetBase, x, y, bType);
                break;
        }

        // 共通パラメータの適用（難易度補正）
        this.applyEnemyParams(enemy, data);

        game.stats.enemiesSpawned++;
        game.entities.push(enemy);
    }

    /**
     * 生成された敵に速度や倍率を適用する
     */
    applyEnemyParams(enemy, data) {
        // 1. HPの設定（データに指定があれば上書き）
        if (data.hp !== undefined) {
            enemy.hp = data.hp;
            enemy.maxHp = data.hp;
        }

        // 2. 移動速度：データの個別指定を優先し、難易度倍率をかける
        const baseSpeed = data.speed ?? enemy.speed; 
        enemy.speed = baseSpeed * this.enemySpeedMultiplier;

        // 3. 発射レート
        enemy.fireRateMultiplier = this.fireRateMultiplier;
    }

    reset() {
        this.currentIndex = 0;
        this.isFinished = false;
        console.log("[System] Scenario Reset.");
    }
}