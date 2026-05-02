/**
 * シナリオ管理：フレーム数に応じて敵を生成する
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
    
    setDifficulty(params) {
        this.enemySpeedMultiplier = params.enemySpeed;
        this.fireRateMultiplier = params.fireRate;
        console.log(`Difficulty set to: Speed x${this.enemySpeedMultiplier}, Fire x${this.fireRateMultiplier}`);
    }
    
    /**
     * 毎フレーム呼び出され、出現タイミングが来た敵を game.entities に追加する
     */
    update(frame, game) {
        // すべての敵を出し切ったかチェック
        if (this.currentIndex >= this.scenario.length) {
            this.isFinished = true;
            return;
        }

        // 現在のフレームに一致する敵をすべて生成
        while (
            this.currentIndex < this.scenario.length && 
            this.scenario[this.currentIndex].frame === frame
        ) {
            const data = this.scenario[this.currentIndex];
            const bType = data.bulletType || 'aim';
            const hp = data.hp || 1;
            const assetBase = game.assetBase; // gameオブジェクトからパスを取得
            
            let enemy;
            if (data.type === 'sine') {
                // サインカーブ敵（phaseやamplitudeをオプションで指定可能に）
                enemy = new SineEnemy(assetBase, data.x, -32, bType, data.phase || 0);
                if (data.amplitude) enemy.amplitude = data.amplitude;
                if (data.frequency) enemy.frequency = data.frequency;
                if (data.hp) enemy.hp = data.hp;
                } else if (data.type === 'stationary') {
                // 上からきて止まる敵 (stopY　や waitTimeをオプションで指定可能に）
                enemy = new StationaryEnemy(
                    assetBase, 
                    data.x, 
                    -32, 
                    bType, 
                    hp, 
                    data.stopY || 100, 
                    data.waitTime || 180
                );
            } else {
                // 通常の直線移動敵
                enemy = new Enemy(assetBase, data.x, -32, bType, hp);
            }

            // --- 難易度パラメータの反映 ---
            // 1. 移動速度の反映（data.speed があればそれに倍率を、なければデフォルトに倍率を）
            if (data.speed) {
                enemy.speed = data.speed * this.enemySpeedMultiplier;
            } else {
                enemy.speed *= this.enemySpeedMultiplier;
            }
            // 2. 発射レートの反映
            enemy.fireRateMultiplier = this.fireRateMultiplier;

            game.entities.push(enemy);
            this.currentIndex++;
        }
    }

    /**
     * リトライ時に進行状況をリセットする
     */
    reset() {
        this.currentIndex = 0;
        this.isFinished = false;
    }
}