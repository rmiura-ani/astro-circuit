/*
 * PROJECT: VOID-CIRCUIT
 *
 * game.js
 * 
* Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */

/**
 * ゲーム全体を統括するメインクラス
 */
class Game {
    constructor(controller) {
        this.sc = controller; // SystemControllerへの参照
        this.ScenarioManager = controller.ScenarioManager;
        this.canvas = controller.canvas;
        this.ctx = this.canvas.getContext('2d');
        this.width = GAME_CONFIG.WIDTH;
        this.height = GAME_CONFIG.HEIGHT;
        this.background = new BackgroundManager(this.width, this.height);
        this.assets = controller.assets;

        // 内部状態
        this._score = 0;
        this._lives = controller.config.lives;

        this.isRunning = false;

        this.reset();

        // イベントリスナーの保持（破棄用）
        this._boundKeyDown = (e) => this.handleKeyDown(e);
        this._boundMouseDown = (e) => this.handleMouseDown(e);
    }

    // --- スコア制御 ---
    set score(val) {
        this._score = Math.min(val, 99999990);
        this.updateScoreUI();
    }
    get score() { return this._score; }

    updateScoreUI() {
        const scoreEl = document.getElementById('score-display');
        if (scoreEl) {
            scoreEl.innerText = `SCORE: ${this.score.toString().padStart(8, '0')}`;
            if (this.score >= 99999990 && !this.hasCounterStopped) {
                scoreEl.classList.add('counter-stop');
                if (this.sc.audio) this.sc.audio.playPowerUp();
                this.hasCounterStopped = true;
            }
        }
        
        if (!this.hasExtended && this.extendThreshold !== 'NONE' && this.score >= this.extendThreshold) {
            this.currentLives++;
            if (this.sc.audio) this.sc.audio.playPowerUp();
            this.hasExtended = true;
            this.triggerExtendBlink();
        }
    }

    triggerExtendBlink() {
        const el = document.getElementById('lives-display');
        el?.classList.add('extend-blink');
        setTimeout(() => el?.classList.remove('extend-blink'), 2000);
    }

    // --- ライフ制御 ---
    set currentLives(val) {
        this._lives = val;
        this.updateLivesUI();
    }
    get currentLives() { return this._lives; }

    updateLivesUI() {
        const el = document.getElementById('lives-display');
        if (!el) return;
        const count = Math.max(0, this.currentLives - 1);
        const icon = "🚀";
        el.innerText = count === 0 ? "" : (count <= 3 ? icon.repeat(count) : `${icon}x${count}`);
    }


    // --- ゲームフロー ---
    /** 初期化 */
    reset() {
        this._score = 0;
        this.currentLives   = this.sc.config.lives;
        this.stats = { enemiesSpawned: 0, enemiesKilled: 0, shotsFired: 0, shotsHit: 0 };
        this.isInvincibleCheat = this.sc.config.isInvincibleCheat;

        this.extendThreshold = this.sc.config.extend; 
        this.hasExtended = false;
        this.hasCounterStopped = false;

        this.sessionRecord = {
            missionName: this.ScenarioManager.scenarioName,
            difficulty: this.sc.config.difficulty,
            extend: this.sc.config.extend,
            lives: this.sc.config.lives,
            inputMode: "NONE",
            cheatUsed: this.sc.config.isInvincibleCheat
        };        

        this.currentStageNum = 1;
        this.isCleared = false;
        this.frame = 0;    
        this.isBossActive = false;
        this.bossStartTime = 0;
        this.postBossTimer = 0;
        this.gameOverTimer = 0;
        this.clearTimer = 0;
        this.respawnTimer = 0;
        this.escCount = 0;
        this.escTimer = null;

        this.entities = [];
        this.particles = [];
        this.scoreTexts = [];
        this.player = new Player(this, this.sc.input, 0, 0);
        this.player.x = GAME_CONFIG.WIDTH / 2 - this.player.halfWidth;
        this.player.y = GAME_CONFIG.HEIGHT - GAME_CONFIG.PLAYER_SPAWN_Y_OFFSET ;

        this.ScenarioManager.reset();
        if (this.sc.audio) this.sc.audio.resetBGM();
    }

    /** ゲーム開始 */
    async start(initialInputMode, startStage = 1) {
        document.getElementById('start-screen').style.display = 'none';
        
        const hiScoreDisplay = document.getElementById('hi-score-display');
        if (hiScoreDisplay) hiScoreDisplay.classList.remove('counter-stop');

        const livesDisplay = document.getElementById('lives-display');
        if (livesDisplay) livesDisplay.style.display = 'block';

        const weaponContainer = document.getElementById('weapon-container');
        if (weaponContainer) weaponContainer.style.display = 'block';

        const diffParams = {
            'EASY': { enemySpeed: 0.8, fireRate: 0.7 },
            'NORMAL': { enemySpeed: 1.0, fireRate: 1.0 },
            'HARD': { enemySpeed: 1.1, fireRate: 1.5 },
            'VERY HARD': { enemySpeed: 1.3, fireRate: 2.0 }
        };
        this.ScenarioManager.setDifficulty(diffParams[this.sc.config.difficulty]);
        
        this.reset();

        window.removeEventListener('keydown', this._boundKeyDown);
        window.removeEventListener('mousedown', this._boundMouseDown);
        window.addEventListener('keydown', this._boundKeyDown);
        window.addEventListener('mousedown', this._boundMouseDown);
        
        this.sessionRecord.inputMode = initialInputMode;

        await this.initStage(startStage);
        Analytics.logLevelStart(this.sessionRecord);
        this.isRunning = true;
    }

    /** ステージ情報を動的にセットアップ */
    async initStage(stageNum) {
        this.currentStageNum = stageNum;
        this.isBossActive = false;
        this.bossStartTime = 0;
        this.postBossTimer = 0; 
        this.isCleared = false;
        this.clearTimer = 0;

        const success = await this.sc.loadStageAssets(stageNum);        
        if (success) {
            this.background.setup(this.ScenarioManager.bgColor, stageNum); 
            if (this.sc.audio) this.sc.audio.playBGM(this.ScenarioManager.bgm);
            
            if (this.sessionRecord) {
                this.sessionRecord.missionName = this.ScenarioManager.scenarioName;
            }
            console.log(`Stage ${stageNum} "${this.ScenarioManager.stageName}" Started.`);
        } else {
            this.endSession("LOAD ERROR");
        }
    }

    /** キー入力 */
    handleKeyDown(e) {
        if (!this.isRunning) return;
        if (e.key === 'Escape') this.handleEmergencyEscape();
    }

    /** マウス入力 */
    handleMouseDown(e) {
        // 必要に応じて、サイドUIクリック時の換装ロジックをPlayer側に直接叩かせるためここは空に
    }

    /** ESC連打でゲーム終了 */
    handleEmergencyEscape() {
        if (this.escTimer) clearTimeout(this.escTimer);

        this.escCount++;
        this.visualEffectWarning();

        if (this.escCount >= 2) {
            this.escCount = 0;
            this.escTimer = null;
            
            this.currentLives = 0;
            this.gameOverTimer = 180;
            if (this.player.alive) this.onPlayerMiss(); 
            if (this.sc.audio) this.sc.audio.fadeOutBGM(1000);
            this.endSession("EMERGENCY EXIT");
        } else {
            this.escTimer = setTimeout(() => {
                this.escCount = 0;
                this.escTimer = null;
            }, 1000);
        }
    }

    /** ESC連打の視覚効果 */
    visualEffectWarning() {
        const container = document.getElementById('game-container');
        if (!container) return;
        container.style.transition = "filter 0.1s";
        container.style.filter = "brightness(1.2) sepia(1) saturate(5) hue-rotate(-50deg)";
        setTimeout(() => { container.style.filter = ""; }, 150);
    }

     /** メインループ表示更新 */
    update() {
        this.background.update(this.frame);
        if (!this.isRunning) return;

        this.frame++;
        this.player.update(GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT);
        this.ScenarioManager.update(this.frame, this);

        if (this.player.alive) {
            this.checkCollisions();
            this.checkClearCondition();
            this.updateInputMode();
            
            // 💡 スコアかすり・撃ち込み得点の同期
            const isFiring = this.sc.input.isPressed('KeyZ') || this.sc.input.isPressed('Space') || this.sc.input.isTouching;
            if (this.frame % 5 === 0 && !this.isBossActive) {
                    this.score += isFiring ? 20 : 30;   
            }
        }
        
        if (!this.player.alive && this.currentLives > 0) {
            this.respawnTimer++;
            if (this.respawnTimer > GAME_CONFIG.PLAYER_SPAWN_WAIT_TIME) { 
                this.respawnPlayer();
                this.respawnTimer = 0;
            }
        }
        if (!this.player.alive && this.currentLives <= 0) {
            this.gameOverTimer++;
            if (this.gameOverTimer > 180) {
                this.endSession("GAME OVER");
            }
        }
        this.updateEntities();
        this.updateScoreTexts();
        this.updateDebugInfo();
    }

    /** エンティティ更新 */
    updateEntities() {
        [...this.entities, ...this.particles].forEach(e => e.update(this));
        this.entities = this.entities.filter(e => e.active);
        this.particles = this.particles.filter(e => e.active);
    }

    /** 敵スコアテキスト更新 */
    updateScoreTexts() {
        for (let i = this.scoreTexts.length - 1; i >= 0; i--) {
            this.scoreTexts[i].update();
            if (this.scoreTexts[i].isDead) {
                this.scoreTexts.splice(i, 1);
            }
        }
    }

    /** デバッグ用表示の更新 */
    updateDebugInfo() {
        const debugEl = document.getElementById('debug-info');
        if (!debugEl || !this.isInvincibleCheat) {
            if (debugEl) debugEl.style.display = 'none';
            return;
        }

        debugEl.style.display = 'block';
        
        const dFrame = document.getElementById('debug-frame');
        const dScnFrame = document.getElementById('debug-scn-frame');
        const dIndex = document.getElementById('debug-index');
        
        if (dFrame) dFrame.innerText = this.frame;
        if (dScnFrame) dScnFrame.innerText = this.ScenarioManager.currentScenarioFrame;
        if (dIndex) dIndex.innerText = `${this.ScenarioManager.currentIndex} / ${this.ScenarioManager.scenario.length}`;

        // タイムボーナス残量の計算
        const bonusEl = document.getElementById('debug-bonus-time');
        const boss = this.entities.find(e => e.isBoss); 
        
        if (boss && this.bossStartTime > 0 && bonusEl) {
            const elapsed = this.frame - this.bossStartTime;
            const remaining = Math.max(0, boss.timeLimit - elapsed);
            const seconds = (remaining / GAME_CONFIG.FPS).toFixed(2); 
            
            bonusEl.innerText = `${remaining}F (${seconds}s)`;
            bonusEl.style.color = remaining < 600 ? "#f00" : "#0ff"; 
        } else if (bonusEl) {
            bonusEl.innerText = "---";
            bonusEl.style.color = "#888";
        }        
        const loadEl = document.getElementById('debug-load');
        if (loadEl) loadEl.innerText = this.entities.length + this.particles.length;
    }

    /** 操作モードの動的記録 */
    updateInputMode() {
        if (this.sessionRecord.inputMode === 'BOTH') return;
        const isKeyActive = (this.sc.input.isPressed('KeyZ') || this.sc.input.isPressed('Space') || this.sc.input.isPressed('ArrowUp'));
        if (this.sessionRecord.inputMode === 'KEYBOARD' && this.sc.input.isTouching) this.sessionRecord.inputMode = 'BOTH';
        else if (this.sessionRecord.inputMode === 'MOUSE' && isKeyActive) this.sessionRecord.inputMode = 'BOTH';
    }

    /** 衝突判定メイン */
    checkCollisions() {
        if (!this.player.alive) return;

        const enemies = [];
        const enemyBullets = [];
        const playerBullets = [];

        for (const e of this.entities) {
            if (!e.active) continue;
            if (e instanceof Enemy) enemies.push(e);
            else if (e instanceof EnemyBullet) enemyBullets.push(e);
            else if (e instanceof Bullet) playerBullets.push(e);
        }

        // 自機の当たり判定（自機 vs 敵、自機 vs 敵弾）
        if (!this.player.isInvincible) {
            const px = this.player.x + this.player.halfWidth;
            const py = this.player.y + this.player.halfHeight;
            const hitRadiusSq = this.player.hitRadiusSq;

            for (const e of enemies) {
                if (this.isCircleHit(px, py, hitRadiusSq, e)) {
                    this.onPlayerMiss();
                    return; 
                }
            }
            for (const eb of enemyBullets) {
                if (this.isCircleHit(px, py, hitRadiusSq, eb)) {
                    this.onPlayerMiss();
                    return;
                }
            }
        }

        // 敵の当たり判定（敵 vs 自機弾）
        for (const enemy of enemies) {
            if (
                enemy.y + enemy.height < GAME_CONFIG.UI_HEADER_HEIGHT ||            
                enemy.y >= GAME_CONFIG.HEIGHT ||          
                enemy.x + enemy.width <= 0 ||             
                enemy.x >= GAME_CONFIG.WIDTH              
            ) {
                continue;
            }

            for (const pBullet of playerBullets) {
                if (!pBullet.active) continue;

                if (this.isHit(pBullet, enemy)) {
                    pBullet.active = false;
                    this.stats.shotsHit++;

                    if (enemy.takeDamage(1)) {
                        this.stats.enemiesKilled++;
                        this.calculateAttachScore(enemy);
                        if (typeof enemy.onDie === 'function') enemy.onDie(this);
                        if (enemy.isBoss) this.ScenarioManager.skipToAfterLoop();
                    } else {
                        const amount = 10;
                        this.score += amount;
                        if (this.sc.audio) this.sc.audio.playHitSound();
                        this.particles.push(new Particle(pBullet.x, pBullet.y));
                        
                        if (enemy.isBoss) {
                            const scatterX = (Math.random() - 0.5) * 10;
                            const scatterY = (Math.random() - 0.5) * 10;
                            this.scoreTexts.push(new ScoreText(pBullet.x + scatterX, pBullet.y + scatterY, `+${amount}`, "#0FF"));
                        }
                    }
                }
            }
        }
    }

    /** 円形判定のヘルパー（自機用。ボス戦だと甘いかも） */
    isCircleHit(px, py, radiusSq, target) {
        const tx = target.x + target.width / 2;
        const ty = target.y + target.height / 2;
        const dx = px - tx;
        const dy = py - ty;
        return (dx * dx + dy * dy) < radiusSq;
    }

    /** 矩形判定のヘルパー */
    isHit(r1, r2) {
        // hitWidth / hitHeight が無ければ、通常の width / height を使う
        const w1 = r1.hitWidth ?? r1.width;
        const h1 = r1.hitHeight ?? r1.height;
        const w2 = r2.hitWidth ?? r2.width;
        const h2 = r2.hitHeight ?? r2.height;

        // それぞれの「中心」を基準にする場合（画像の中央に判定を配置）
        // ※ 毎回割り算をしないよう、あらかじめ端の座標を計算します
        const r1Left = r1.x + (r1.width - w1) / 2;
        const r1Top  = r1.y + (r1.height - h1) / 2;
        const r2Left = r2.x + (r2.width - w2) / 2;
        const r2Top  = r2.y + (r2.height - h2) / 2;

        // 4つの方向で重なりがあるかをチェック（1つでも満たさなければ当たっていない）
        return r1Left < r2Left + w2 &&
            r1Left + w1 > r2Left &&
            r1Top < r2Top + h2 &&
            r1Top + h1 > r2Top;
        }

    /** 得点追加 */
    calculateAttachScore(enemy){
        const maxHp = enemy.maxHp || 1;
        const amount = 100 * maxHp * (maxHp + 1);  
        this.score += amount;
        console.log(amount);

        const centerX = enemy.x + (enemy.width || 32) / 2;
        let centerY = enemy.isBoss ? enemy.y + ((enemy.height || 64) * 0.8) : enemy.y + (enemy.height || 32) / 2;
        
        this.scoreTexts.push(new ScoreText(centerX, centerY, amount));

        if (enemy.isBoss){
            const elapsed = this.frame - this.bossStartTime;
            const limit = enemy.timeLimit || 3600;
            const maxBonus = amount * 0.25;
            const decayRate = maxBonus / limit;
            const rawBonus = Math.max(0, maxBonus - (elapsed * decayRate));
            const bonus = Math.floor(rawBonus / 100) * 100;
            if (bonus > 0) {
                this.score += bonus;
                this.scoreTexts.push(new ScoreText(GAME_CONFIG.WIDTH / 2, GAME_CONFIG.HEIGHT / 2, ["TIME BONUS", bonus.toLocaleString()], "#0FF"));
            }
        }
    }

    /** 爆発エフェクト */
    createExplosion(x, y, enemy) {
        const hp = enemy.maxHp || 1;
        const count = 10 + (hp * 2);
        const type = enemy.isBoss ? 'boss' : 'enemy';

        for (let i = 0; i < count; i++) {
            this.particles.push(new Particle(x, y, type));
        }

        if (this.sc.audio) {
            this.sc.audio.playExplosion();
            if (hp >= 10) setTimeout(() => this.sc.audio.playExplosion(), 200);
            if (hp >= 50) setTimeout(() => this.sc.audio.playExplosion(), 400);
        }
    }

    /** ボス戦スタート */
    startBossBattle() {
        this.isBossActive = true;
        this.bossStartTime = this.frame;
    }

    /** ステージクリア判定 */
    checkClearCondition() {
        if (this.frame < 180) return;

        const hasEnemies = this.entities.some(e => e instanceof Enemy);
        const isEnemyAllKilled = this.ScenarioManager.isFinished && !hasEnemies;

        if (isEnemyAllKilled && !this.isCleared) {
            this.postBossTimer++;

            const isEffectsFinished = (this.particles.length === 0 && this.scoreTexts.length === 0);
            const isTimeout = (this.postBossTimer >= 150);

            if (isEffectsFinished || isTimeout) {
                this.isCleared = true;
                this.clearTimer = 0; 
                if (this.sc.audio) this.sc.audio.fadeOutBGM(3000); 
                console.log(`[System] All effects finished at frame ${this.postBossTimer}. Stage Cleared.`);
            }
        }

        if (this.isCleared) {
            this.clearTimer++;
            if (this.clearTimer === 180) { 
                this.goToNextStage();
            }        
        }
    }

    /** 次ステージへ */
    goToNextStage() {
        if (this.currentStageNum < 7) {
            this.currentStageNum++;
            this.isCleared = false;
            this.clearTimer = 0;
            this.frame = 0; 
            this.initStage(this.currentStageNum);
        } else {
            this.endSession("ALL STAGES CLEARED!");
        }
    }

    /** 被弾ミス */
    onPlayerMiss() {
        if (!this.player.alive) return;

        if (this.sc.audio) this.sc.audio.playExplosion();
        const px = this.player.x + this.player.halfWidth;
        const py = this.player.y + this.player.halfHeight;
        for (let i = 0; i < 30; i++) {
            this.particles.push(new Particle(px, py, 'player'));
        }

        if (this.isInvincibleCheat){
            this.player.setInvincible();
            return; //無敵
        }
        this.player.alive = false;
        this.respawnTimer = 0;      
        this.currentLives--;
        if (this.currentLives <= 0 && this.sc.audio) {
            this.sc.audio.fadeOutBGM();
        }
    }

    /** リスポーン */
    respawnPlayer() {
        this.player.x = GAME_CONFIG.WIDTH / 2 - this.player.halfWidth;
        this.player.y = GAME_CONFIG.HEIGHT - GAME_CONFIG.PLAYER_SPAWN_Y_OFFSET;
        this.player.alive = true;
        this.player.setInvincible();
    }

    /** 描画マスタ */
    draw() {
        // 1. 背景のクリアと描画
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.width, this.height);
        this.background.draw(this.ctx);
        
        if (!this.player) return;

        // 2. 弾やエフェクト（一番下）
        this.entities.forEach(e => { if (e instanceof Bullet || e instanceof EnemyBullet) e.draw(this.ctx); });
        this.particles.forEach(p => p.draw(this.ctx));

        // 3. 雑魚敵（弾の上、ボスの下：isBossプロパティで正確に選別）
        this.entities.forEach(e => { if (e instanceof Enemy && !e.isBoss) e.draw(this.ctx, this.isInvincibleCheat); });

        // 4. ボス（敵の中で一番上）
        this.entities.forEach(e => { if (e instanceof Enemy && e.isBoss) e.draw(this.ctx, this.isInvincibleCheat); });

        // 5. 撃破スコアテキスト
        this.scoreTexts.forEach(st => st.draw(this.ctx));
        
        // 6. 自機
        this.player.draw(this.ctx);

        // 7. UI（オーバーレイメッセージ）
        this.drawOverlayMessages();
    }

    /** Overlayメッセージ */
    drawOverlayMessages() {
        this.ctx.save();
        this.ctx.font = '16px "Press Start 2P", cursive';
        this.ctx.textAlign = 'center';

        // --- 💡 [改修] 新しい形式からパスと演出時間を抽出 ---
        let kvPath = null;
        let kvDuration = 180;

        if (this.ScenarioManager.kv) {
            if (typeof this.ScenarioManager.kv === 'object') {
                kvPath = this.ScenarioManager.kv.path;
                kvDuration = this.ScenarioManager.kv.duration || 180;
            } else {
                // 万が一、古い記述（文字列だけ）が残っていても動くようにケア
                kvPath = this.ScenarioManager.kv;
            }
        }

        if (this.frame > 0 && this.frame < kvDuration) {
            
            // 1. 文字用のアルファ計算 (最初と最後の30Fでフェード)
            let textAlpha = 1.0;
            if (this.frame <= 30) textAlpha = this.frame / 30;
            else if (this.frame > (kvDuration - 30)) textAlpha = (kvDuration - this.frame) / 30;

            // 2. KV画像の演出描画
            if (kvPath && this.assets) {
                const kvImage = this.assets.get?.(kvPath) || this.assets[kvPath];
                
                if (kvImage && kvImage.complete) {
                    this.ctx.save();

                    // 進捗率の計算
                    const progress = this.frame / kvDuration;

                    // 画像用アルファ (最初の25Fでイン、ラスト45Fでアウト)
                    let kvAlpha = 1.0;
                    if (this.frame <= 25) kvAlpha = this.frame / 25;
                    else if (this.frame > (kvDuration - 45)) kvAlpha = Math.max(0, (kvDuration - this.frame) / 45);

                    // 横幅フィットの計算
                    const baseWidth = GAME_CONFIG.WIDTH;
                    const baseHeight = kvImage.height * (GAME_CONFIG.WIDTH / kvImage.width);

                    // じわじわ等倍に収束するズーム演出
                    const scale = 1.12 - (progress * 0.12); 
                    const drawWidth = baseWidth * scale;
                    const drawHeight = baseHeight * scale;
                    
                    // 自機を避けるための上部寄せ配置
                    const drawX = (GAME_CONFIG.WIDTH - drawWidth) / 2;
                    const drawY = (GAME_CONFIG.HEIGHT * 0.35) - (drawHeight / 2);

                    // スクリーン合成＆シネマティック暗転
                    this.ctx.globalCompositeOperation = 'screen';
                    this.ctx.globalAlpha = Math.max(0, kvAlpha);

                    if (kvAlpha > 0) {
                        this.ctx.save();
                        this.ctx.globalCompositeOperation = 'source-over';
                        this.ctx.globalAlpha = kvAlpha * 0.6;
                        this.ctx.fillStyle = '#000000';
                        this.ctx.fillRect(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT);
                        this.ctx.restore();
                    }

                    this.ctx.drawImage(kvImage, drawX, drawY, drawWidth, drawHeight);
                    this.ctx.globalCompositeOperation = 'source-over';
                    this.ctx.restore();
                }
            }

            // 3. タイトルテキストの描画 (画面下部、自機より上の安全圏)
            const textCenterY = GAME_CONFIG.HEIGHT * 0.65;

            this.ctx.font = '16px "Press Start 2P", cursive';
            this.ctx.fillStyle = `rgba(0, 255, 255, ${textAlpha})`;
            this.ctx.fillText(`STAGE ${this.currentStageNum}`, GAME_CONFIG.WIDTH / 2, textCenterY);
            
            this.ctx.font = '11px "Press Start 2P", cursive';
            this.ctx.fillStyle = `rgba(255, 255, 255, ${textAlpha})`;
            this.ctx.fillText(this.ScenarioManager.stageName, GAME_CONFIG.WIDTH / 2, textCenterY + 30);
        }

        // （ゲームオーバー、クリア処理は省略）
        this.ctx.restore();
    }

    /** ゲーム終了 */
    endSession(msg) {
        if (!this.isRunning && this.gameOverTimer > 182) return;
        this.isRunning = false;
        
        window.removeEventListener('keydown', this._boundKeyDown);
        window.removeEventListener('mousedown', this._boundMouseDown);

        Analytics.logLevelEnd(this.stats, this.sessionRecord, this.isCleared);

        const isNew = this.score > this.sc.highScore && this.score > 0;
        if (isNew) {
            this.sc.highScore = this.score;
            Analytics.logAchievement('HI_SCORE_BREAK');
        }
        
        const weaponContainer = document.getElementById('weapon-container');
        if (weaponContainer) weaponContainer.style.display = 'none';
        
        this.sc.showStartScreen(msg, isNew);
        this.sc.startIdleTimer();
    }
}

// 起動コード（グローバルループ）
const sys = new SystemController();
sys.init().then(() => {
    const loop = () => {
        if (sys.game && sys.game.isRunning) {
            sys.game.update();
            sys.game.draw();
        }
        requestAnimationFrame(loop);
    };
    loop();
});