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
        this.enemyManager = controller.enemyManager;
        this.canvas = controller.canvas;
        this.ctx = this.canvas.getContext('2d');
        this.width = 320;
        this.height = 480;

        this.stars = new Starfield(this.width, this.height);
        
        // 内部状態
        this._score = 0;
        this._lives = controller.config.lives;
        this._weaponMode = 'STRAIGHT';
        this.stats = { enemiesSpawned: 0, enemiesKilled: 0, shotsFired: 0, shotsHit: 0 };
        this.isInvincibleCheat = false;

        this.sessionRecord = null;

        this.isRunning = false;
        this.isCleared = false;
        this.frame = 0;
        this.isBossActive = false;
        this.gameOverTimer = 0;
        this.clearTimer = 0;
        this.escCount = 0;
        this.escTimer = null;
        
        this.assets = controller.assets;
        this.entities = [];
        this.particles = [];
        this.scoreTexts = [];
        this.player = null;

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
                this.sc.audio.playPowerUp();
                this.hasCounterStopped = true;
            }
        }
        if (!this.hasExtended && this.extendThreshold !== 'NONE' && this.score >= this.extendThreshold) {
            this.currentLives++;
            this.sc.audio.playPowerUp();
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
    /** ゲーム開始 */
    start(initialInputMode) {
        document.getElementById('start-screen').style.display = 'none';
        document.getElementById('hi-score-display').classList.remove('counter-stop');
        document.getElementById('weapon-container').style.display = 'block';

        const diffParams = {
            'EASY': { enemySpeed: 0.8, fireRate: 0.7 },
            'NORMAL': { enemySpeed: 1.0, fireRate: 1.0 },
            'HARD': { enemySpeed: 1.1, fireRate: 1.5 },
            'VERY HARD': { enemySpeed: 1.3, fireRate: 2.0 }
        };
        this.enemyManager.setDifficulty(diffParams[this.sc.config.difficulty]);
        
        this.reset();
        window.addEventListener('keydown', this._boundKeyDown);
        window.addEventListener('mousedown', this._boundMouseDown);
        this.sessionRecord.inputMode = initialInputMode;

        this.isRunning = true;
        this.sc.audio.playBGM('stage1');

        Analytics.logLevelStart(this.sessionRecord);
    }

    /** 初期化 */
    reset() {
        this.score = 0;
        this.currentLives = this.sc.config.lives;
        this.weaponMode = 'STRAIGHT';
        this.stats = { enemiesSpawned: 0, enemiesKilled: 0, shotsFired: 0, shotsHit: 0 };
        this.isInvincibleCheat = this.sc.config.isInvincibleCheat;

        this.sessionRecord = {
            missionName: this.enemyManager.scenarioName,
            difficulty: this.sc.config.difficulty,
            extend: this.sc.config.extend,
            lives: this.sc.config.lives,
            inputMode: "NONE",
            cheatUsed: this.sc.config.isInvincibleCheat
        };        

        this.isCleared = false;
        this.frame = 0;    
        this.isBossActive = false;
        this.gameOverTimer = 0;
        this.clearTimer = 0;
        this.escCount = 0;
        this.escTimer = null;

        this.entities = [];
        this.particles = [];
        this.scoreTexts = [];
        this.player = new Player(this, this.width / 2 - 16, this.height - 80);

        this.enemyManager.reset();
        this.sc.audio.resetBGM();
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
        if (this.escTimer) {
            clearTimeout(this.escTimer);
        }

        this.escCount++;
        this.visualEffectWarning();

        if (this.escCount >= 2) {
            this.escCount = 0;
            this.escTimer = null; // リセット
            
            // 確実にリザルトへ送る
            this.currentLives = 0;
            this.gameOverTimer = 180;
            this.onPlayerMiss(); // 爆発演出
            this.sc.audio.fadeOutBGM(3000);
            this.endSession("EMERGENCY EXIT");
        } else {
            // 1秒以内に2回目が来なければカウントを戻す
            this.escTimer = setTimeout(() => {
                this.escCount = 0;
                this.escTimer = null;
            }, 1000);
        }
    }

    /** ESC連打のVF */
    visualEffectWarning() {
        const container = document.getElementById('game-container');
        if (!container) return;
        container.style.transition = "filter 0.1s";
        container.style.filter = "brightness(1.2) sepia(1) saturate(5) hue-rotate(-50deg)";
        setTimeout(() => { container.style.filter = ""; }, 150);
    }

    /** 表示更新 */
    update() {
        this.stars.update();
        if (!this.isRunning) return;

        this.frame++;
        this.player.update(this.sc.input, this.width, this.height);
        this.enemyManager.update(this.frame, this);

        if (this.player.alive) {
            this.handlePlayerShooting();
            this.checkCollisions();
            this.checkClearCondition();
            this.updateInputMode();
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
        this.scoreTexts.forEach((st, index) => {
            st.update();
            if (st.isDead) this.scoreTexts.splice(index, 1);
        });
    }

    /** デバッグ用フレーム・シナリオ表示 */
    updateDebugInfo() {
        const debugEl = document.getElementById('debug-info');
        if (this.isInvincibleCheat) {
            debugEl.style.display = 'block';
            document.getElementById('debug-frame').innerText = this.frame;
            document.getElementById('debug-index').innerText = `${this.enemyManager.currentIndex} / ${this.enemyManager.scenario.length}`;
            const loadEl = document.getElementById('debug-load');
            if (loadEl) loadEl.innerText = this.entities.length + this.particles.length;
        } else {
            debugEl.style.display = 'none';
        }
    }

    /** キーボードかマウスかどちらで遊んでいるかを記録 */
    updateInputMode() {
        if (this.sessionRecord.inputMode === 'BOTH') return;
        const isKeyActive = (this.sc.input.isPressed('KeyZ') || this.sc.input.isPressed('Space') || this.sc.input.isPressed('ArrowUp'));
        if (this.sessionRecord.inputMode === 'KEYBOARD' && this.sc.input.isTouching) this.sessionRecord.inputMode = 'BOTH';
        else if (this.sessionRecord.inputMode === 'MOUSE' && isKeyActive) this.sessionRecord.inputMode = 'BOTH';
    }

    /** 武器選択 */
    toggleWeapon() {
        this.weaponMode = (this.weaponMode === 'STRAIGHT') ? 'WIDE' : 'STRAIGHT';
        this.sc.audio.playChangeWp();
    }

    /** ショット */
    handlePlayerShooting() {
        const isFiring = this.sc.input.isPressed('KeyZ') || this.sc.input.isPressed('Space') || this.sc.input.isTouching;
        if (isFiring) {
            if (this.weaponMode === 'STRAIGHT') {
                if (this.frame % 8 === 0) {
                    this.entities.push(new Bullet(this.player.x + 8, this.player.y, 0));
                    this.entities.push(new Bullet(this.player.x + 20, this.player.y, 0));
                    this.stats.shotsFired += 2; // 2発分カウント
                    this.sc.audio.playShot();
                }
            } else {
                if (this.frame % 12 === 0) {
                    this.entities.push(new Bullet(this.player.x + 14, this.player.y, 0));
                    this.entities.push(new Bullet(this.player.x + 14, this.player.y, -3.5));
                    this.entities.push(new Bullet(this.player.x + 14, this.player.y, 3.5));
                    this.stats.shotsFired += 3; // 3発分カウント
                    this.sc.audio.playShot();
                }
            }
        }
        if (this.player.alive && !this.isBossActive && this.frame % 5 === 0 ) this.score += isFiring ? 20 : 30;   // 生存ボーナス（ボス戦のぞき）
    }

    /** 判定 */
    checkCollisions() {
        if (this.player.alive && !this.player.isInvincible && !this.isInvincibleCheat) {
            const px = this.player.x + 16, py = this.player.y + 16;
            for (const e of this.entities) {
                if (e instanceof Enemy || e instanceof EnemyBullet) {
                    const dx = px - (e.x + e.width/2), dy = py - (e.y + e.height/2);
                    if (dx*dx + dy*dy < 100) {
                        this.onPlayerMiss();
                        return;
                    }
                }
            }
        }

        const currentEnemies = this.entities.filter(e => e instanceof Enemy && e.active);
        const currentBullets = this.entities.filter(b => b instanceof Bullet && b.active);

        currentEnemies.forEach(enemy => {
            if (enemy.y + enemy.height < 30) return;
            currentBullets.forEach(bullet => {
                if (!bullet.active || !enemy.active) return;
                if (this.isHit(bullet, enemy)) {
                    bullet.active = false;
                    this.stats.shotsHit++;
                    
                    if (enemy.takeDamage(1)) {
                        const amount = 50 * enemy.maxHp * (enemy.maxHp + 1);
                        this.score += amount
                        this.stats.enemiesKilled++;
                        this.scoreTexts.push(new ScoreText(enemy.x, enemy.y, amount, amount >= 5000 ? "#ff0" : "#fff"));

                        // 個別演出
                        if (typeof enemy.onDie === 'function') {
                            enemy.onDie(this); // gameインスタンス(this)を渡す
                        }

                        // 爆発エフェクトの発生位置を「敵の中心」に修正
                        const centerX = enemy.x + enemy.width / 2;
                        const centerY = enemy.y + enemy.height / 2;
                        this.createExplosion(centerX, centerY, enemy);
                        
                    } else {
                        // --- 敵に弾が当たったが、まだ生きている時の処理 ---
                        this.score += 10;
                        this.sc.audio.playHitSound();
                        this.particles.push(new Particle(bullet.x, bullet.y));
                    }
                }
            });
        });
    }

    isHit(r1, r2) {
        // 判定に使うサイズを決定（hitWidthがあれば優先、なければ通常のサイズ）
        const w1 = r1.hitWidth || r1.width;
        const h1 = r1.hitHeight || r1.height;
        const w2 = r2.hitWidth || r2.width;
        const h2 = r2.hitHeight || r2.height;

        // それぞれの中心座標を計算
        const r1cx = r1.x + r1.width / 2;
        const r1cy = r1.y + r1.height / 2;
        const r2cx = r2.x + r2.width / 2;
        const r2cy = r2.y + r2.height / 2;

        // 中心からの距離ベースで判定
        return Math.abs(r1cx - r2cx) < (w1 + w2) / 2 &&
            Math.abs(r1cy - r2cy) < (h1 + h2) / 2;
    }

    /** 爆発エフェクト */
    createExplosion(x, y, enemy) {
        const hp = enemy.maxHp || 1;
        const count = 10 + (hp * 2);
        const type = hp >= 10 ? 'boss' : 'enemy';

        for (let i = 0; i < count; i++) {
            this.particles.push(new Particle(x, y, type));
        }

        this.sc.audio.playExplosion();
        if (hp >= 10) setTimeout(() => this.sc.audio.playExplosion(), 200);
        if (hp >= 50) setTimeout(() => this.sc.audio.playExplosion(), 400);
    }

    /** ステージクリア判定 */
    checkClearCondition() {
        if (this.enemyManager.isFinished && this.entities.filter(e => e instanceof Enemy).length === 0) {
            if (!this.isCleared) {
                this.isCleared = true;
                this.sc.audio.fadeOutBGM(3000);
            }
        }
    }

    /** ミス */
    onPlayerMiss() {
        if (!this.player.alive) return;
        this.player.alive = false;
        this.sc.audio.playExplosion();
        for (let i = 0; i < 30; i++) this.particles.push(new Particle(this.player.x + 16, this.player.y + 16, 'player'));
        this.currentLives--;
        if (this.currentLives > 0) setTimeout(() => this.respawnPlayer(), 1500);
        else this.sc.audio.fadeOutBGM();
    }

    /** リスポーン */
    respawnPlayer() {
        this.player.x = this.width / 2 - 16;
        this.player.y = this.height - 80;
        this.player.alive = true;
        this.player.setInvincible(180);
    }

    /** 描画 */
    draw() {
        // 1. 背景
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.width, this.height);
        this.stars.draw(this.ctx);

        if (!this.player) return;

        // 1. スコアテキスト
        this.scoreTexts.forEach(st => st.draw(this.ctx));

        // 2. 弾やエフェクト（一番下）
        this.entities.forEach(e => {
            if (e instanceof Bullet || e instanceof EnemyBullet) e.draw(this.ctx);
        });
        this.particles.forEach(p => p.draw(this.ctx));

        // 3. 雑魚敵（弾の上、ボスの下）
        this.entities.forEach(e => {
            if (e instanceof Enemy && !(e instanceof BossEnemy)) e.draw(this.ctx, this.isInvincibleCheat);
        });

        // 4. ボス（敵の中で一番上）
        this.entities.forEach(e => {
            if (e instanceof BossEnemy) e.draw(this.ctx, this.isInvincibleCheat);
        });

        // 5. 自機とUI（最前面）
        this.player.draw(this.ctx);
        this.drawOverlayMessages();
    }

    /** Overlayメッセージ(GAME OVER等） */
    drawOverlayMessages() {
        this.ctx.font = '16px "Press Start 2P", cursive';
        this.ctx.textAlign = 'center';
        if (!this.player.alive && this.currentLives <= 0) {
            this.gameOverTimer++;
            this.ctx.fillStyle = 'rgba(255,0,0,0.5)';
            this.ctx.fillRect(0, 180, 320, 100);
            this.ctx.fillStyle = '#FFF';
            this.ctx.fillText('GAME OVER', 160, 230);
            if (this.gameOverTimer > 180) this.endSession("GAME OVER");
        }
        if (this.isCleared) {
            this.clearTimer++;
            this.ctx.fillStyle = '#0FF';
            this.ctx.fillText('STAGE 1 CLEAR', 160, 240);
            if (this.clearTimer > 301) this.endSession("CONGRATULATIONS!");
        }
    }

    /** ゲーム終了 */
    endSession(msg) {
        if (!this.isRunning && this.gameOverTimer > 182) return;

        this.isRunning = false;
        Analytics.logLevelEnd(this.stats, this.sessionRecord, this.isCleared);

        const isNew = this.score > this.sc.highScore && this.score > 0;
        if (isNew) {
            this.sc.highScore = this.score;
            Analytics.logAchievement('HI_SCORE_BREAK');
        }
        document.getElementById('weapon-container').style.display = 'none';
        this.sc.showStartScreen(msg, isNew);
        this.sc.startIdleTimer();
    }
}

// 起動コード
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