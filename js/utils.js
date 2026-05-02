/**
 * シナリオ管理：フレーム数に応じて敵を生成・制御する
 */
class EnemyManager {
    constructor(scenario) { 
        this.scenario = scenario; 
        this.enemySpeedMultiplier = 1.0;
        this.fireRateMultiplier = 1.0;
        this.currentIndex = 0; 
        this.scenarioPath = '';
        this.isFinished = false; 
    }
    
    /**
     * 難易度設定の反映
     */
    setDifficulty(params) {
        this.enemySpeedMultiplier = params.enemySpeed || 1.0;
        this.fireRateMultiplier = params.fireRate || 1.0;
        console.log(`[System] Difficulty applied: Speed x${this.enemySpeedMultiplier}, Fire x${this.fireRateMultiplier}`);
    }
    
    /**
     * 毎フレームの監視と敵の生成
     */
    update(frame, game) {
        if (this.isFinished) return;

        // すべての敵を出し切ったかチェック
        if (this.currentIndex >= this.scenario.length) {
            this.isFinished = true;
            return;
        }

        // 指定フレームに到達した敵を生成（whileで同一フレーム内の複数出現に対応）
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
        const x = data.x ?? 160; // 座標指定がない場合は中央
        const y = -32;

        let enemy;

        // 1. タイプ別にインスタンスを作成
        switch (data.type) {
            case 'sine':
                enemy = new SineEnemy(assetBase, x, y, bType, data.phase || 0);
                if (data.amplitude) enemy.amplitude = data.amplitude;
                if (data.frequency) enemy.frequency = data.frequency;
                break;

            case 'stationary':
                enemy = new StationaryEnemy(
                    assetBase, x, y, bType, hp, 
                    data.stopY || 100, 
                    data.waitTime || 180
                );
                break;

            default:
                // 通常の直線移動敵
                enemy = new Enemy(assetBase, x, y, bType, hp);
                break;
        }

        // 2. 共通パラメータの適用（難易度補正）
        this.applyEnemyParams(enemy, data);

        // 3. ゲームに追加
        game.entities.push(enemy);
    }

    /**
     * 生成された敵に速度や倍率を適用する
     */
    applyEnemyParams(enemy, data) {
        // 移動速度：データの個別指定を優先し、難易度倍率をかける
        const baseSpeed = data.speed ?? enemy.speed; 
        enemy.speed = baseSpeed * this.enemySpeedMultiplier;

        // 発射レート
        enemy.fireRateMultiplier = this.fireRateMultiplier;

        // 追加のHP補正（もしデータにあれば上書き）
        if (data.hp) {
            enemy.hp = data.hp;
            enemy.maxHp = data.hp;
        }
    }

    /**
     * リトライ・ステージ切り替え時に進行状況をリセット
     */
    reset() {
        this.currentIndex = 0;
        this.isFinished = false;
        console.log("[System] Scenario Reset.");
    }
}