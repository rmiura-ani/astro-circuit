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
        this._weaponMode = 'STRAIGHT';

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

    // --- 武器制御 ---
    set weaponMode(val) {
        this._weaponMode = val;
        this.updateWeaponUI();
    }
    get weaponMode() { return this._weaponMode; }

    updateWeaponUI() {
        const displayEl = document.getElementById('weapon-display');
        const hintEl = document.getElementById('weapon-hint');
        if (displayEl) {
            displayEl.innerText = `WEAPON: ${this.weaponMode}`;
            displayEl.className = (this.weaponMode === 'WIDE') ? 'mode-wide' : '';
        }
        if (hintEl) hintEl.innerText = '[X]Key OR TAP SIDE-UI TO CHANGE';
    }

    // --- ゲームフロー ---
    /** 初期化 */
    reset() {
        this._score = 0;
        this._lives = this.sc.config.lives;
        this._weaponMode = 'STRAIGHT';
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
        this.player = new Player(this, GAME_CONFIG.WIDTH / 2 - 16, GAME_CONFIG.HEIGHT - 80);

        this.ScenarioManager.reset();
        if (this.sc.audio) this.sc.audio.resetBGM();
    }

    /** ゲーム開始 */
    async start(initialInputMode, startStage = 1) {
        document.getElementById('start-screen').style.display = 'none';
        
        const hiScoreDisplay = document.getElementById('hi-score-display');
        if (hiScoreDisplay) hiScoreDisplay.classList.remove('counter-stop');
        
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
            
            // セッションレコードの更新
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
        if (e.code === 'KeyX') this.toggleWeapon();
        if (e.key === 'Escape') this.handleEmergencyEscape();
    }

    /** マウス入力 */
    handleMouseDown(e) {
        if (this.isRunning && this.player?.alive && e.target !== this.canvas) {
            this.toggleWeapon();
        }
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

    /** 表示更新 */
    update() {
        this.background.update(this.frame);
        if (!this.isRunning) return;

        this.frame++;
        this.player.update(this.sc.input, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT);
        this.ScenarioManager.update(this.frame, this);

        if (this.player.alive) {
            this.handlePlayerShooting();
            this.checkCollisions();
            this.checkClearCondition();
            this.updateInputMode();
        }
        
        if (!this.player.alive && this.currentLives > 0) {
            this.respawnTimer++;
            if (this.respawnTimer > 90) { 
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

    /** 武器選択 */
    toggleWeapon() {
        this.weaponMode = (this.weaponMode === 'STRAIGHT') ? 'WIDE' : 'STRAIGHT';
        if (this.sc.audio) this.sc.audio.playChangeWp();
    }

    /** ショット */
    handlePlayerShooting() {
        const isFiring = this.sc.input.isPressed('KeyZ') || this.sc.input.isPressed('Space') || this.sc.input.isTouching;
        if (isFiring) {
            if (this.weaponMode === 'STRAIGHT') {
                if (this.frame % 8 === 0) {
                    this.entities.push(new Bullet(this.player.x + 8, this.player.y, 0));
                    this.entities.push(new Bullet(this.player.x + 20, this.player.y, 0));
                    this.stats.shotsFired += 2; 
                    if (this.sc.audio) this.sc.audio.playShot();
                }
            } else {
                if (this.frame % 12 === 0) {
                    this.entities.push(new Bullet(this.player.x + 14, this.player.y, 0));
                    this.entities.push(new Bullet(this.player.x + 14, this.player.y, -3.5));
                    this.entities.push(new Bullet(this.player.x + 14, this.player.y, 3.5));
                    this.stats.shotsFired += 3; 
                    if (this.sc.audio) this.sc.audio.playShot();
                }
            }
        }
        if (this.player.alive && !this.isBossActive && this.frame % 5 === 0 ) this.score += isFiring ? 20 : 30;   
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
        if (!this.player.isInvincible && !this.isInvincibleCheat) {
            const px = this.player.x + 16;
            const py = this.player.y + 16;
            const PLAYER_HIT_RADIUS_SQ = 100; 

            for (const e of enemies) {
                if (this.isCircleHit(px, py, PLAYER_HIT_RADIUS_SQ, e)) {
                    this.onPlayerMiss();
                    return; 
                }
            }
            for (const eb of enemyBullets) {
                if (this.isCircleHit(px, py, PLAYER_HIT_RADIUS_SQ, eb)) {
                    this.onPlayerMiss();
                    return;
                }
            }
        }

        // 敵の当たり判定（敵 vs 自機弾）
        for (const enemy of enemies) {
            // 画面外（上部すぎ）の敵は判定をスキップ
            if (enemy.y + enemy.height < 0) continue;

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

    /** 円形判定のヘルパー（中心座標と半径の2乗で比較）*/
    isCircleHit(px, py, radiusSq, target) {
        const tx = target.x + (target.width || 32) / 2;
        const ty = target.y + (target.height || 32) / 2;
        const dx = px - tx;
        const dy = py - ty;
        return (dx * dx + dy * dy) < radiusSq;
    }

    /** あたり判定詳細 */
    isHit(r1, r2) {
        const w1 = r1.hitWidth || r1.width || 8;
        const h1 = r1.hitHeight || r1.height || 8;
        const w2 = r2.hitWidth || r2.width || 32;
        const h2 = r2.hitHeight || r2.height || 32;

        const r1cx = r1.x + (r1.width || 8) / 2;
        const r1cy = r1.y + (r1.height || 8) / 2;
        const r2cx = r2.x + (r2.width || 32) / 2;
        const r2cy = r2.y + (r2.height || 32) / 2;

        return Math.abs(r1cx - r2cx) < (w1 + w2) / 2 &&
            Math.abs(r1cy - r2cy) < (h1 + h2) / 2;
    }

    /** 得点追加（敵撃破） */
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
            const multiplier = enemy.timeMultiplier || 100;

            const bonus = Math.max(0, (limit - elapsed) * multiplier);
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

    /** ステージクリア判定（爆発や得点演出の終了を待つ） */
    checkClearCondition() {
        if (this.frame < 180) return;

        const hasEnemies = this.entities.some(e => e instanceof Enemy);
        const isEnemyAllKilled = this.ScenarioManager.isFinished && !hasEnemies;

        if (isEnemyAllKilled && !this.isCleared) {
            this.postBossTimer++;

            // クリアの成立条件：
            // 条件A: 画面上の爆発エフェクトも、スコアテキストもすべて消え去って静寂が訪れた
            // 条件B (セーフティ): 撃破から150フレーム（約2.5秒）が経過した
            const isEffectsFinished = (this.particles.length === 0 && this.scoreTexts.length === 0);
            const isTimeout = (this.postBossTimer >= 150);

            if (isEffectsFinished || isTimeout) {
                this.isCleared = true;
                this.clearTimer = 0; // ここからSTAGE CLEAR文字表示用のタイマーがスタート
                if (this.sc.audio) this.sc.audio.fadeOutBGM(3000); // BGMフェードアウト開始
                console.log(`[System] All effects finished at frame ${this.postBossTimer}. Stage Cleared.`);
            }
        }

        if (this.isCleared) {
            this.clearTimer++;
            if (this.clearTimer === 180) { // STAGE CLEAR表示から3秒後に次へ
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
        this.player.alive = false;
        this.respawnTimer = 0; // タイマー初期化
        
        if (this.sc.audio) this.sc.audio.playExplosion();
        for (let i = 0; i < 30; i++) {
            this.particles.push(new Particle(this.player.x + 16, this.player.y + 16, 'player'));
        }
        
        this.currentLives--;
        if (this.currentLives <= 0 && this.sc.audio) {
            this.sc.audio.fadeOutBGM();
        }
    }

    /** リスポーン */
    respawnPlayer() {
        this.player.x = GAME_CONFIG.WIDTH / 2 - 16;
        this.player.y = GAME_CONFIG.HEIGHT - 80;
        this.player.alive = true;
        this.player.setInvincible(180);
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

        // ステージ開始時のタイトル表示
        if (this.frame > 0 && this.frame < 180) {
            let alpha = 1.0;

            if (this.frame <= 30) {
                alpha = this.frame / 30;
            } else if (this.frame > 120) {
                alpha = (180 - this.frame) / 60;
            }

            this.ctx.font = '14px "Press Start 2P", cursive';
            this.ctx.fillStyle = `rgba(0, 255, 255, ${alpha})`;
            this.ctx.fillText(`STAGE ${this.currentStageNum}`, GAME_CONFIG.WIDTH / 2, GAME_CONFIG.HEIGHT / 2 - 10);
            this.ctx.font = '10px "Press Start 2P", cursive';
            this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            this.ctx.fillText(this.ScenarioManager.stageName, GAME_CONFIG.WIDTH / 2, GAME_CONFIG.HEIGHT / 2 + 20);
        }

        // ゲームオーバー演出
        if (!this.player.alive && this.currentLives <= 0) {
            this.ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
            this.ctx.fillRect(0, GAME_CONFIG.HEIGHT / 2 - 50, GAME_CONFIG.WIDTH, 100);
            this.ctx.fillStyle = '#FFF';
            this.ctx.fillText('GAME OVER', GAME_CONFIG.WIDTH / 2, GAME_CONFIG.HEIGHT / 2);
        }

        // ステージクリア演出（【バグ修正】文字列のプロパティ参照バグを駆除）
        if (this.isCleared) {
            const stageNameStr = this.ScenarioManager.stageName; 
            
            this.ctx.fillStyle = '#0FF';
            this.ctx.fillText(`STAGE ${this.currentStageNum} CLEAR`, GAME_CONFIG.WIDTH / 2, GAME_CONFIG.HEIGHT / 2);            
            this.ctx.font = '10px "Press Start 2P", cursive';
            this.ctx.fillStyle = '#FFF';
            this.ctx.fillText(stageNameStr, GAME_CONFIG.WIDTH / 2, GAME_CONFIG.HEIGHT / 2 + 30);
        }
        this.ctx.restore();
    }

    /** ゲーム終了 */
    endSession(msg) {
        if (!this.isRunning && this.gameOverTimer > 182) return;

        this.isRunning = false;
        
        // リスナーのクリーンアップ
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