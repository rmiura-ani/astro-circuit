/*
 * PROJECT: VOID-CIRCUIT
 *
 * main.js
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */

/**
 * ゲーム全体を統括するメインクラス
 */
class Game {
    constructor() {
        // --- 基本設定 ---
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.width = 320;
        this.height = 480;
        this.version = "0.32";
        this.assetBase = "https://void-circuit-assets.ani-net.com/";

        // --- サブシステム ---
        this.input = new InputManager(this.canvas);
        this.audio = new AudioManager(this.assetBase);
        this.stars = new Starfield(this.width, this.height);
        this.config = new ConfigManager(this);
        this.config.loadConfig();

        // --- ゲーム内部状態 ---
        this._score = 0;
        this._lives = this.config.lives;
        this.highScore = parseInt(localStorage.getItem('void_circuit_highscore')) || 0;
        
        // 統計データ
        this.stats = {
            enemiesSpawned: 0,
            enemiesKilled: 0,
            shotsFired: 0,
            shotsHit: 0
        };

        // セッション記録（リザルト/シェア用）
        this.sessionRecord = null;

        this.inputMode = 'NONE'; // NONE, KEYBOARD, MOUSE, BOTH
        this.isRunning = false;
        this.isLoaded = false;
        this.isShowingCredits = false;
        this.isCleared = false;
        this.isInvincibleCheat = false;
        this.isBgmFading = false;
        this.weaponMode = 'STRAIGHT';

        this.frame = 0;
        this.gameOverTimer = 0;
        this.clearTimer = 0;
        this.escCount = 0;

        this.entities = [];
        this.particles = [];
        this.player = null;
        this.enemyManager = null;
        this.idleTimeout = null;

        this.difficultyParams = {
            'EASY':      { enemySpeed: 0.8, fireRate: 0.7 },
            'NORMAL':    { enemySpeed: 1.0, fireRate: 1.0 },
            'HARD':      { enemySpeed: 1.1, fireRate: 1.5 },
            'VERY HARD': { enemySpeed: 1.3, fireRate: 2.0 }
        };
    }

    // --- Getter/Setter ---
    set score(val) {
        const MAX_SCORE = 99999990;
        this._score = Math.min(val, MAX_SCORE);
        this.updateScoreUI();
    }
    get score() { return this._score; }

    set currentLives(val) {
        this._lives = val;
        this.updateLivesUI();
    }
    get currentLives() { return this._lives; }

    // --- ミッション文字列生成 (集約ロジック) ---
    getMissionCode(isShare = false) {
        const r = this.sessionRecord || {
            missionName: "UNKNOWN",
            difficulty: this.config.difficulty,
            extend: this.config.extend,
            inputMode: this.inputMode,
            cheatUsed: this.isInvincibleCheat
        };

        const diffMap = { 'EASY':'E', 'NORMAL':'N', 'HARD':'H', 'VERY HARD':'VH' };
        const diffStr = diffMap[r.difficulty] || 'U';
        const cheatStr = r.cheatUsed ? (isShare ? '(CHEAT)' : '(CHT)') : '';
        const extendStr = r.extend === 'NONE' ? 'OFF' : `${(r.extend/1000)}k`;
        const livesStr = `L${r.lives}`; // ★ -L3 などの表記を作成

        // 操作モード判定
        let controlSuffix = '-MK';
        if (r.inputMode === 'MOUSE') controlSuffix = '-M';
        if (r.inputMode === 'KEYBOARD') controlSuffix = '-K';

        return `${r.missionName}-${diffStr}${cheatStr}-${livesStr}-${extendStr}${controlSuffix}`;
    }

    /** 初期化 */
    async init() {
        document.getElementById('version-display').innerText = this.version;
        document.getElementById('config-open-btn').style.display = 'none';

        try {
            const isLocal = ["localhost", "127.0.0.1"].includes(location.hostname);
            const path = isLocal ? './scenario.json' : this.assetBase + 'scenario.json';

            const res = await fetch(path);
            if (!res.ok) throw new Error("Fetch failed");
            const scenarioData = await res.json();

            this.enemyManager = new EnemyManager(scenarioData);
            this.enemyManager.scenarioPath = path;

            this.audio.initAudio();
            await this.preloadAssets();

            this.isLoaded = true;
            this.updateScoreUI();
            this.setStartMessage("Click or [Z]Key to Start", "#0FF");
            document.getElementById('config-open-btn').style.display = 'block';

            this.setupEvents();
            this.startIdleTimer();
        } catch (e) {
            console.error(e);
            this.setStartMessage("❌ ERROR: Failed to Load Assets", "#F44");
        }
    }

    async preloadAssets() {
        const loadAud = (a) => new Promise(r => {
            if (!a || !a.src || a.readyState >= 3) return r();
            a.addEventListener('canplaythrough', r, { once: true });
            a.addEventListener('error', r, { once: true });
            a.load();
            setTimeout(r, 5000);
        });

        const loadImg = (url) => new Promise(r => {
            const img = new Image();
            img.onload = () => r(img);
            img.onerror = () => r(null);
            img.src = url;
        });

        const bgmPromises = Object.values(this.audio.bgms).map(loadAud);
        const sePromises = Object.values(this.audio.sounds).map(loadAud);
        const imagesToLoad = [
            this.assetBase + 'player.png',
            this.assetBase + 'enemy_straight.png',
            this.assetBase + 'enemy_sine.png',
            this.assetBase + 'enemy_station.png'
        ];
        const imgPromises = imagesToLoad.map(url => loadImg(url));

        await Promise.all([...bgmPromises, ...sePromises, ...imgPromises]);
    }

    setStartMessage(text, color) {
        const el = document.querySelector('#start-screen p');
        el.innerHTML = text;
        el.style.color = color;
        el.style.animation = "none";
    }

    /** イベント登録 */
    setupEvents() {
        document.getElementById('start-screen').addEventListener('click', () => this.handleProceed('MOUSE'));
        document.getElementById('config-open-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.stopIdleTimer();
            this.config.open();
        });

        window.addEventListener('mousedown', (e) => {
            if (this.isRunning && this.player && this.player.alive && e.target !== this.canvas) {
                if (e.target !== this.canvas) {
                    this.toggleWeapon();
                }
            }
        });

        window.addEventListener('keydown', (e) => this.handleKeyDown(e));

        const credits = document.getElementById('credit-screen');
        credits.onanimationend = () => {
            setTimeout(() => { if (this.isShowingCredits) this.backToTitle(); }, 5000);
        };
    }

    handleKeyDown(e) {
        if (this.config.isMode) {
            this.config.handleInput(e);
            return;
        }
        if (e.code === 'KeyC' && !this.isRunning && !this.isShowingCredits) {
            this.stopIdleTimer();
            this.config.open();
        }
        if (e.code === 'KeyX' && this.isRunning) this.toggleWeapon();
        if (['Space', 'KeyZ'].includes(e.code)) this.handleProceed('KEYBOARD');
        if (e.key === 'Escape' && this.isRunning) this.handleEmergencyEscape();
    }

    handleEmergencyEscape() {
        this.escCount++;
        this.visualEffectWarning();
        if (this.escCount >= 2) {
            this.escCount = 0;
            this.currentLives = 1;
            this.onPlayerMiss();
        } else {
            setTimeout(() => { this.escCount = 0; }, 1000);
        }
    }

    visualEffectWarning() {
        const container = document.getElementById('game-container');
        if (!container) return;
        container.style.transition = "filter 0.1s";
        container.style.filter = "brightness(1.2) sepia(1) saturate(5) hue-rotate(-50deg)";
        setTimeout(() => { container.style.filter = ""; }, 150);
    }

    /** ゲーム制御 */
    start() {
        document.getElementById('start-screen').style.display = 'none';
        document.getElementById('hi-score-display').classList.remove('counter-stop');
        document.getElementById('weapon-container').style.display = 'block';

        this.enemyManager?.setDifficulty(this.difficultyParams[this.config.difficulty]);
        this.reset();
        this.isRunning = true;
        this.audio.playBGM('stage1');
    }

    reset() {
        this.player = new Player(this.assetBase, this.width / 2 - 16, this.height - 80);
        this.entities = [];
        this.particles = [];
        this.frame = 0;
        this.score = 0;
        this.currentLives = this.config.lives;

        // 手順 A: 開始時セッションレコードの保存
        const rawPath = this.enemyManager.scenarioPath || 'UNKNOWN';
        this.sessionRecord = {
            missionName: rawPath.split('/').pop().replace('.json', '').toUpperCase(),
            difficulty: this.config.difficulty,
            extend: this.config.extend,
            lives: this.config.lives,
            inputMode: this.inputMode, // その時点のモードを記録
            cheatUsed: this.isInvincibleCheat
        };

        this.stats = {
            enemiesSpawned: 0,
            enemiesKilled: 0,
            shotsFired: 0,
            shotsHit: 0
        };

        this.hasExtended = false;
        this.hasCounterStopped = false;
        this.extendThreshold = this.config.extend;
        this.gameOverTimer = 0;
        this.clearTimer = 0;
        this.isCleared = false;
        this.isBgmFading = false;
        this.enemyManager.reset();
        this.audio.resetBGM();
        this.weaponMode = 'STRAIGHT';
        this.updateWeaponUI();
    }

    update() {
        this.stars.update();
        if (!this.isRunning) return;

        this.frame++;
        this.player.update(this.input, this.width, this.height);
        this.enemyManager.update(this.frame, this);

        if (this.player.alive) {
            this.handlePlayerShooting();
            this.checkCollisions();
            this.checkClearCondition();
        }
        this.updateDebugInfo();
        this.updateEntities();

        if (this.inputMode !== 'BOTH') {
            const isMouseActive = this.input.isTouching;
            const isKeyActive = (this.input.isPressed('KeyZ') || this.input.isPressed('Space') || 
                                this.input.isPressed('ArrowUp') || this.input.isPressed('KeyX')); // Xキー(武器換装)も判定に含める

            if (this.inputMode === 'KEYBOARD' && isMouseActive) {
                this.inputMode = 'BOTH';
            } else if (this.inputMode === 'MOUSE' && isKeyActive) {
                this.inputMode = 'BOTH';
            }
            
            // セッション記録にもリアルタイム反映（リザルト用）
            if (this.sessionRecord) {
                this.sessionRecord.inputMode = this.inputMode;
            }
        }
    }

    updateWeaponUI() {
        const displayEl = document.getElementById('weapon-display');
        const hintEl = document.getElementById('weapon-hint');
        if (displayEl) {
            displayEl.innerText = `WEAPON: ${this.weaponMode}`;
            displayEl.className = (this.weaponMode === 'WIDE') ? 'mode-wide' : '';
        }
        if (hintEl) hintEl.innerText = '[X]Key OR TAP SIDE-UI TO CHANGE';
    }

    toggleWeapon() {
        this.weaponMode = (this.weaponMode === 'STRAIGHT') ? 'WIDE' : 'STRAIGHT';
        this.audio.playChangeWp();
        this.updateWeaponUI();
    }

    handlePlayerShooting() {
        const isFiring = this.input.isPressed('KeyZ') || this.input.isPressed('Space') || this.input.isTouching;
        if (isFiring) {
            if (this.weaponMode === 'STRAIGHT') {
                if (this.frame % 8 === 0) {
                    this.entities.push(new Bullet(this.player.x + 8, this.player.y, 0));
                    this.entities.push(new Bullet(this.player.x + 20, this.player.y, 0));
                    this.stats.shotsFired++;
                    this.audio.playShot();
                }
            } else {
                if (this.frame % 12 === 0) {
                    this.entities.push(new Bullet(this.player.x + 14, this.player.y, 0));
                    this.entities.push(new Bullet(this.player.x + 14, this.player.y, -3.5));
                    this.entities.push(new Bullet(this.player.x + 14, this.player.y, 3.5));
                    this.stats.shotsFired++;
                    this.audio.playShot();
                }
            }
        }
        if (this.frame % 5 === 0) this.score += isFiring ? 20 : 30;
    }

    updateEntities() {
        [...this.entities, ...this.particles].forEach(e => e.update(this));
        this.entities = this.entities.filter(e => e.active);
        this.particles = this.particles.filter(e => e.active);
    }

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
            if (enemy.y < 20) return;
            currentBullets.forEach(bullet => {
                if (!bullet.active || !enemy.active) return;
                if (this.isHit(bullet, enemy)) {
                    bullet.active = false;
                    this.stats.shotsHit++;
                    if (enemy.takeDamage(1)) {
                        this.score += 50 * enemy.maxHp * (enemy.maxHp + 1);
                        this.stats.enemiesKilled++;
                        this.createExplosion(enemy.x + 16, enemy.y + 16, enemy);
                    } else {
                        this.score += 10;
                        this.audio.playHitSound();
                        this.particles.push(new Particle(bullet.x, bullet.y));
                    }
                }
            });
        });
    }

    isHit(r1, r2) {
        return r1.x < r2.x + r2.width && r1.x + r1.width > r2.x &&
               r1.y < r2.y + r2.height && r1.y + r1.height > r2.y;
    }

    checkClearCondition() {
        if (this.enemyManager.isFinished && this.entities.filter(e => e instanceof Enemy).length === 0) {
            if (!this.isCleared) {
                this.isCleared = true;
                this.audio.fadeOutBGM(3000);
            }
        }
    }

    createExplosion(x, y, enemy) {
        const hp = enemy.maxHp || 1;
        const count = 10 + (hp * 2);
        const type = hp >= 10 ? 'boss' : 'enemy';

        for (let i = 0; i < count; i++) {
            this.particles.push(new Particle(x, y, type));
        }

        this.audio.playExplosion();
        if (hp >= 10) setTimeout(() => this.audio.playExplosion(), 200);
        if (hp >= 50) setTimeout(() => this.audio.playExplosion(), 400);
    }

    onPlayerMiss() {
        if (!this.player.alive) return;
        this.player.alive = false;
        this.audio.playExplosion();
        for (let i = 0; i < 30; i++) this.particles.push(new Particle(this.player.x + 16, this.player.y + 16, 'player'));
        this.currentLives--;
        if (this.currentLives > 0) setTimeout(() => this.respawnPlayer(), 1500);
        else this.audio.fadeOutBGM();
    }

    respawnPlayer() {
        this.player.x = this.width / 2 - 16;
        this.player.y = this.height - 80;
        this.player.alive = true;
        this.player.setInvincible(180);
    }

    draw() {
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.width, this.height);
        this.stars.draw(this.ctx);
        if (!this.player) return;
        this.entities.forEach(e => e.draw(this.ctx));
        this.particles.forEach(p => p.draw(this.ctx));
        this.player.draw(this.ctx);
        this.drawOverlayMessages();
    }

    drawOverlayMessages() {
        this.ctx.font = '16px "Press Start 2P", cursive';
        this.ctx.textAlign = 'center';
        if (!this.player.alive && this.currentLives <= 0) {
            this.gameOverTimer++;
            this.ctx.fillStyle = 'rgba(255,0,0,0.5)';
            this.ctx.fillRect(0, 180, 320, 100);
            this.ctx.fillStyle = '#FFF';
            this.ctx.fillText('GAME OVER', 160, 230);
            if (this.gameOverTimer === 180) this.endSession("GAME OVER");
        }
        if (this.isCleared) {
            this.clearTimer++;
            this.ctx.fillStyle = '#0FF';
            this.ctx.fillText('STAGE 1 CLEAR', 160, 240);
            if (this.clearTimer === 301) this.endSession("CONGRATULATIONS!");
        }
    }

    endSession(msg) {
        if (!this.isRunning && this.gameOverTimer > 182) return;
        this.isRunning = false;
        const isNew = this.score > this.highScore && this.score > 0;
        if (isNew) {
            this.highScore = this.score;
            localStorage.setItem('void_circuit_highscore', this.highScore);
            document.getElementById('hi-score-display').classList.add('counter-stop');
            this.updateScoreUI();
        }
        document.getElementById('weapon-container').style.display = 'none';
        this.showStartScreen(msg, isNew);
        this.setupShareButton();
        this.startIdleTimer();
    }

    showStartScreen(msg, isNew) {
        const missionCode = this.getMissionCode(false);
        const accuracy = this.stats.shotsFired > 0 ? Math.floor((this.stats.shotsHit / this.stats.shotsFired) * 100) : 0;
        const statsHtml = `
            <div class="mission-header">MISSION: ${missionCode}</div>
            <div class="stats-container">
                <div class="stats-row"><span class="stats-label">KILLS:</span><span class="stats-value">${this.stats.enemiesKilled} / ${this.stats.enemiesSpawned}</span></div>
                <div class="stats-row"><span class="stats-label">HIT RATE:</span><span class="stats-value">${accuracy}%</span></div>
            </div>
        `;
        const pEl = document.querySelector('#start-screen p');
        pEl.innerHTML = `<div class="result-msg">${msg}</div>${statsHtml}${isNew ? '<div class="new-record">★ NEW HI-SCORE !! ★</div>' : ''}<br>RETRY OPERATION?`;
        document.getElementById('start-screen').style.display = 'flex';
    }

    setupShareButton() {
        const btn = document.getElementById('share-btn');
        btn.style.display = 'block';
        btn.onclick = (e) => {
            e.stopPropagation();
            window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(this.generateShareText())}`, '_blank');
        };
    }

    generateShareText() {
        return `PROJECT: VOID-CIRCUIT v${this.version}\n` +
               `----------------------------\n` +
               `■ SCORE  : ${this.score.toLocaleString()}\n` +
               `■ MISSION: ${this.getMissionCode(true)}\n` +
               `----------------------------\n` +
               `作戦完了。虚無の回路を突破せよ。\n\n` +
               `https://void-circuit.ani-net.com\n` +
               `#VoidCircuit #80年代STG #IndieGame`;
    }

    updateScoreUI() {
        const scoreEl = document.getElementById('score-display');
        const hiScoreEl = document.getElementById('hi-score-display');
        if (scoreEl) {
            scoreEl.innerText = `SCORE: ${this.score.toString().padStart(8, '0')}`;
            if (this.score >= 99999990 && !this.hasCounterStopped) {
                scoreEl.classList.add('counter-stop');
                this.audio.playPowerUp();
                this.hasCounterStopped = true;
            }
        }
        if (hiScoreEl) hiScoreEl.innerText = `HI-SCORE: ${this.highScore.toString().padStart(8, '0')}`;
        if (!this.hasExtended && this.extendThreshold !== 'NONE' && this.score >= this.extendThreshold) {
            this.currentLives++;
            this.audio.playPowerUp();
            this.hasExtended = true;
            this.triggerExtendBlink();
        }
    }

    updateDebugInfo() {
        const debugEl = document.getElementById('debug-info');
        if (this.isInvincibleCheat) {
            if (this.sessionRecord) this.sessionRecord.cheatUsed = true;
            debugEl.style.display = 'block';
            document.getElementById('debug-frame').innerText = this.frame;
            document.getElementById('debug-index').innerText = `${this.enemyManager.currentIndex} / ${this.enemyManager.scenario.length}`;
            const loadEl = document.getElementById('debug-load');
            if (loadEl) loadEl.innerText = this.entities.length + this.particles.length;
        } else {
            debugEl.style.display = 'none';
        }
    }

    updateLivesUI() {
        const el = document.getElementById('lives-display');
        if (!el) return;
        const count = Math.max(0, this.currentLives - 1);
        const icon = "🚀";
        el.innerText = count === 0 ? "" : (count <= 3 ? icon.repeat(count) : `${icon}x${count}`);
    }

    triggerExtendBlink() {
        const el = document.getElementById('lives-display');
        el?.classList.add('extend-blink');
        setTimeout(() => el?.classList.remove('extend-blink'), 2000);
    }

    handleProceed(type) {
        if (this.config.isMode || this.isRunning) return;
        if (this.isShowingCredits) return this.backToTitle();
        if (this.player && !this.player.alive && this.gameOverTimer < 30) return;
        if (this.isLoaded) {
            this.inputMode = (type === 'MOUSE') ? 'MOUSE' : 'KEYBOARD';
            this.stopIdleTimer();
            this.start();
        }
    }

    startIdleTimer() {
        this.stopIdleTimer();
        this.idleTimeout = setTimeout(() => this.showCredits(), 10000);
    }
    stopIdleTimer() { if (this.idleTimeout) clearTimeout(this.idleTimeout); }
    showCredits() {
        this.isShowingCredits = true;
        document.getElementById('title-content').style.display = 'none';
        document.getElementById('config-open-btn').style.display = 'none';
        const screen = document.getElementById('credit-screen');
        screen.style.display = 'block';
        screen.classList.add('scrolling');
    }
    backToTitle() {
        this.isShowingCredits = false;
        document.getElementById('credit-screen').style.display = 'none';
        document.getElementById('credit-screen').classList.remove('scrolling');
        document.getElementById('title-content').style.display = 'block';
        document.getElementById('config-open-btn').style.display = 'block';
        this.startIdleTimer();
    }
    loop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.loop());
    }
}

const game = new Game();
game.init().then(() => game.loop());