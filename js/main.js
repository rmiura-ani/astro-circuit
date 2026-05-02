/**
 * ゲーム全体を統括するメインクラス (v0.25 Refactored)
 */
class Game {
    constructor() {
        // --- 設定・定数 ---
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.width = 320;
        this.height = 480;
        this.version = "0.25";
        this.assetBase = "https://void-circuit-assets.ani-net.com/";

        // --- サブシステム ---
        this.input = new InputManager(this.canvas);
        this.audio = new AudioManager(this.assetBase);
        this.stars = new Starfield(this.width, this.height);
        this.config = new ConfigManager(this);
        this.config.loadConfig();

        // --- ゲーム内部状態（プライベート変数風） ---
        this._score = 0;
        this._lives = this.config.lives;
        this.highScore = parseInt(localStorage.getItem('void_circuit_highscore')) || 0;
        
        this.isRunning = false;
        this.isLoaded = false;
        this.isShowingCredits = false;
        this.isCleared = false;
        this.isInvincibleCheat = false;
        this.isBgmFading = false;
        this.cheatUsedInSession = false;

        this.frame = 0;
        this.gameOverTimer = 0;
        this.clearTimer = 0;
        this.escCount = 0;

        this.entities = [];
        this.particles = [];
        this.player = null;
        this.enemyManager = null;
        this.idleTimeout = null;

        // 難易度テーブル
        this.difficultyParams = {
            'EASY':      { enemySpeed: 0.8, fireRate: 0.7 },
            'NORMAL':    { enemySpeed: 1.0, fireRate: 1.0 },
            'HARD':      { enemySpeed: 1.1, fireRate: 1.5 },
            'VERY HARD': { enemySpeed: 1.3, fireRate: 2.0 }
        };
    }

    // --- プロパティ Setter (値をいじるとUIが勝手に変わる) ---
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

    /** 初期化 */
    async init() {
        const messageEl = document.querySelector('#start-screen p');
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
            if (!a || !a.src) return r();
            a.oncanplaythrough = () => r();
            a.onerror = () => r();
            a.load();
            setTimeout(r, 5000);
        });

        const bgmPromises = Object.values(this.audio.bgms).map(loadAud);
        const sePromises = Object.values(this.audio.sounds).map(loadAud);
        
        // 画像は簡易的にロード（Enemyクラス等で個別にloadイベントがあるため最低限）
        await Promise.all([...bgmPromises, ...sePromises]);
    }

    setStartMessage(text, color) {
        const el = document.querySelector('#start-screen p');
        el.innerText = text;
        el.style.color = color;
        el.style.animation = "none";
    }

    /** イベント登録 */
    setupEvents() {
        // 開始/クリック系
        document.getElementById('start-screen').addEventListener('click', () => this.handleProceed());
        
        // 設定ボタン
        document.getElementById('config-open-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.stopIdleTimer();
            this.config.open();
        });

        // キーボード
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));

        // クレジット終了検知
        const credits = document.getElementById('credit-screen');
        credits.onanimationend = () => {
            setTimeout(() => { if (this.isShowingCredits) this.backToTitle(); }, 5000);
        };
    }

    handleKeyDown(e) {
        if (this.config.isMode) {
            this.config.handleInput(e);
            if (!this.config.isMode) this.startIdleTimer();
            return;
        }

        if (e.code === 'KeyC' && !this.isRunning && !this.isShowingCredits) {
            this.stopIdleTimer();
            this.config.open();
        }

        if (['Space', 'KeyZ'].includes(e.code)) this.handleProceed();

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
        this.hasExtended = false;
        this.hasCounterStopped = false;
        this.extendThreshold = this.config.extend;
        this.gameOverTimer = 0;
        this.clearTimer = 0;
        this.isCleared = false;
        this.isBgmFading = false;
        this.enemyManager.reset();
        this.audio.resetBGM();
    }

    /** メインループ */
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

        this.updateEntities();
    }

    handlePlayerShooting() {
        const isFiring = this.input.isPressed('KeyZ') || this.input.isPressed('Space') || this.input.isTouching;
        if (isFiring && this.frame % 10 === 0) {
            this.entities.push(new Bullet(this.player.x + 14, this.player.y));
            this.audio.playShot();
            this.score += 20;
        } else if (this.frame % 5 === 0) {
            this.score += 30; // 生存ボーナス
        }
    }

    updateEntities() {
        [...this.entities, ...this.particles].forEach(e => e.update(this));
        this.entities = this.entities.filter(e => e.active);
        this.particles = this.particles.filter(e => e.active);
    }

    checkCollisions() {
        // 1. プレイヤーの被弾
        if (this.player.alive && !this.player.isInvincible && !this.isInvincibleCheat) {
            const px = this.player.x + 16, py = this.player.y + 16;
            for (const e of this.entities) {
                if (e instanceof Enemy || e instanceof EnemyBullet) {
                    const dx = px - (e.x + e.width/2), dy = py - (e.y + e.height/2);
                    if (Math.sqrt(dx*dx + dy*dy) < 10) {
                        this.onPlayerMiss();
                        return;
                    }
                }
            }
        }

        // 2. 敵の被弾
        this.entities.filter(e => e instanceof Enemy).forEach(enemy => {
            if (enemy.y < 20) return;
            this.entities.filter(b => b instanceof Bullet).forEach(bullet => {
                if (this.isHit(bullet, enemy)) {
                    bullet.active = false;
                    if (enemy.takeDamage(1)) {
                        const scoreGain = 50 * enemy.maxHp * (enemy.maxHp + 1);
                        this.score += scoreGain;
                        console.log(`Score:+${scoreGain}`);
                        this.createExplosion(enemy.x + 16, enemy.y + 16, enemy);
                    } else {
                        this.audio.playHitSound();
                        this.particles.push(new Particle(bullet.x, bullet.y));
                    }
                }
            });
        });
    }

    isHit(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width && rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height && rect1.y + rect1.height > rect2.y;
    }

    checkClearCondition() {
        if (this.enemyManager.isFinished && 
            this.entities.filter(e => e instanceof Enemy).length === 0) {
            if (!this.isCleared) {
                this.isCleared = true;
                this.audio.fadeOutBGM(3000); // 3秒かけてフェード
            }
        }
    }

    /** 演出・エフェクト */
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
        if (this.currentLives > 0) {
            setTimeout(() => this.respawnPlayer(), 1500);
        } else {
            this.audio.fadeOutBGM();
        }
    }

    respawnPlayer() {
        this.player.x = this.width / 2 - 16;
        this.player.y = this.height - 80;
        this.player.alive = true;
        this.player.setInvincible(180);
    }

    /** 描画系 */
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

    /** セッション終了・シェア */
    endSession(msg) {
        if (!this.isRunning && this.gameOverTimer > 182) return;
        this.isRunning = false;

        const isNewRecord = this.score > this.highScore && this.score > 0;
        if (isNewRecord) {
            this.highScore = this.score;
            localStorage.setItem('void_circuit_highscore', this.highScore);
            document.getElementById('hi-score-display').classList.add('counter-stop');
            this.updateScoreUI();
        }

        this.showStartScreen(msg, isNewRecord);
        this.setupShareButton();
        this.startIdleTimer();
    }

    showStartScreen(msg, isNew) {
        const hiMsg = isNew ? `<br><br><span class="new-record">★ NEW HI-SCORE !! ★</span>` : "";
        const screen = document.getElementById('start-screen');
        screen.style.display = 'flex';
        screen.querySelector('p').innerHTML = `${msg}${hiMsg}<br><br>RETRY OPERATION?`;
    }

    setupShareButton() {
        const btn = document.getElementById('share-btn');
        btn.style.display = 'block';
        btn.onclick = (e) => {
            e.stopPropagation();
            const text = this.generateShareText();
            window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
        };
    }

    generateShareText() {
        const rawPath = this.enemyManager.scenarioPath || 'UNKNOWN';
        const opName = rawPath.split('/').pop().replace('.json', '').toUpperCase();
        const difficulty = { 'EASY':'E', 'NORMAL':'N', 'HARD':'H', 'VERY HARD':'VH' }[this.config.difficulty];
        const cheat = this.cheatUsedInSession ? '(CHEAT)' : '';
        const extend = this.config.extend === 'NONE' ? 'OFF' : `${(this.config.extend/1000)}k`;

        return `PROJECT: VOID-CIRCUIT v${this.version}\n` +
               `----------------------------\n` +
               `■ SCORE  : ${this.score.toLocaleString()}\n` +
               `■ MISSION: ${opName}-${difficulty}${cheat}-${extend}\n` +
               `----------------------------\n` +
               `作戦完了。虚無の回路を突破せよ。\n\n` +
               `https://void-circuit.ani-net.com\n` +
               `#VoidCircuit #80年代STG #IndieGame`;
    }

    /** UI更新 */
    updateScoreUI() {
        const scoreEl = document.getElementById('score-display');
        const hiScoreEl = document.getElementById('hi-score-display');
        if (scoreEl) {
            scoreEl.innerText = `SCORE: ${this.score.toString().padStart(8, '0')}`;
            if (this.score >= 99999990) {
                scoreEl.classList.add('counter-stop');
                if (!this.hasCounterStopped) {
                    this.audio.playPowerUp();
                    this.hasCounterStopped = true;
                }
            }
        }
        if (hiScoreEl) hiScoreEl.innerText = `HI-SCORE: ${this.highScore.toString().padStart(8, '0')}`;

        // エクステンド判定
        if (!this.hasExtended && this.extendThreshold !== 'NONE' && this.score >= this.extendThreshold) {
            this.currentLives++;
            this.audio.playPowerUp();
            this.hasExtended = true;
            this.triggerExtendBlink();
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

    /** その他管理 */
    handleProceed() {
        if (this.config.isMode || this.isRunning) return;
        if (this.isShowingCredits) return this.backToTitle();
        if (this.player && !this.player.alive && this.gameOverTimer < 30) return;
        
        if (this.isLoaded) {
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
        const screen = document.getElementById('credit-screen');
        screen.style.display = 'none';
        screen.classList.remove('scrolling');
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

// 起動
const game = new Game();
game.init().then(() => game.loop());