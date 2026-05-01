/**
 * ゲーム全体を統括するメインクラス
 */
class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.width = 320;
        this.height = 480;
        this.version = "0.15";

        // GitHub上の資産ベースURL
        this.assetBase = "https://void-circuit-assets.ani-net.com/";

        // サブシステムの初期化
        this.input = new InputManager(this.canvas);
        this.audio = new AudioManager(this.assetBase);
        this.stars = new Starfield(this.width, this.height);

        // ゲーム状態
        this.isRunning = false;
        this.isLoaded = false;
        this.isShowingCredits = false;
        this.gameOverTimer = 0;
        this.isCleared = false;
        this.clearTimer = 0;
        this.frame = 0;
        this.score = 0;
        this.highScore = 0;

        this.idleTimeout = null;
        this.entities = [];
        this.particles = [];
        this.player = null;
        this.enemyManager = null;
    }

    /**
     * 初期化：アセット読み込みとシナリオ準備
     */
    async init() {
        const messageEl = document.querySelector('#start-screen p');
        document.getElementById('version-display').innerText = this.version;

        try {
            // 1. シナリオ読み込み (ローカル優先)
            let scenarioData;
            const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
            const path = isLocal ? './scenario.json' : this.assetBase + 'scenario.json';

            const res = await fetch(path);
            if (!res.ok) throw new Error("Fetch failed");

            try {
                scenarioData = await res.json();
            } catch (parseError) {
                messageEl.innerText = "⚠️ SCENARIO ERROR: Check JSON Syntax";
                messageEl.style.color = "#FF4444";
                return;
            }

            this.enemyManager = new EnemyManager(scenarioData);

            // 2. オーディオ準備
            this.audio.initAudio();

            // 3. アセットのプリロード
            const loadImg = (src) => new Promise(r => { 
                const i = new Image(); i.crossOrigin = "anonymous"; i.src = src; i.onload = () => r(i); i.onerror = () => r(null);
            });
            const loadAud = (a) => new Promise(r => {
                if (!a.src) return r();
                a.oncanplaythrough = () => r();
                a.onerror = () => r();
                a.load();
                setTimeout(r, 5000); // タイムアウト保険
            });

            const sePromises = Object.values(this.audio.sounds).map(s => loadAud(s));
            await Promise.all([
                loadImg(this.assetBase + "player.jfif"),
                loadImg(this.assetBase + "enemy.jfif"),
                loadAud(this.audio.bgm),
                ...sePromises
            ]);

            // ロード完了したら「Click to Start」を出す
            this.isLoaded = true;
            messageEl.innerText = "Click to Start";
            messageEl.style.color = "#0FF";
            messageEl.style.animation = "none";

            // 4. イベント登録 & 放置タイマー開始
            this.setupEvents();
            this.startIdleTimer();

        } catch (e) {
            console.error(e);
            messageEl.innerText = "❌ ERROR: Failed to Load Assets";
            messageEl.style.color = "#FF4444";
        }
    }

    setupEvents() {
        // 共通の開始処理
        const handleStart = () => {
            if (!this.isLoaded || this.isRunning) return;
            
            this.stopIdleTimer();
            this.start();
        };

        // 1. クリック（またはタップ）でスタート
        document.getElementById('start-screen').addEventListener('click', handleStart);

        // 2. キーボードでスタート（スペースキーとZキーに対応）
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space' || e.code === 'KeyZ') {
                // クレジット表示中やタイトル画面なら開始
                if (!this.isRunning) {
                    handleStart();
                }
            }
        });

        // クレジット終了時のイベント
        const credits = document.getElementById('credit-screen');
        credits.onanimationend = () => {
            setTimeout(() => { if (this.isShowingCredits) this.backToTitle(); }, 5000);
        };
    }

    startIdleTimer() {
        this.stopIdleTimer();
        this.idleTimeout = setTimeout(() => this.showCredits(), 5000);
    }

    stopIdleTimer() {
        if (this.idleTimeout) clearTimeout(this.idleTimeout);
    }

    // クレジット表示
    showCredits() {
        this.isShowingCredits = true;
        document.getElementById('title-content').style.display = 'none';
        const credits = document.getElementById('credit-screen');
        credits.style.display = 'block';
        credits.classList.add('scrolling');
    }

    // タイトルに戻る
    backToTitle() {
        this.isShowingCredits = false;
        const credits = document.getElementById('credit-screen');
        credits.style.display = 'none';
        credits.classList.remove('scrolling');
        document.getElementById('title-content').style.display = 'block';
        this.startIdleTimer();
    }

    start() {
        document.getElementById('start-screen').style.display = 'none';
        document.getElementById('hi-score-display').classList.remove('counter-stop');
        this.reset();
        this.isRunning = true;
        this.audio.playBGM();
    }

    reset() {
        this.player = new Player(this.assetBase, this.width / 2 - 16, this.height - 80);
        this.entities = [];
        this.particles = [];
        this.frame = 0;
        this.score = 0;
        this.gameOverTimer = 0;
        this.clearTimer = 0;
        this.isCleared = false;
        this.enemyManager.reset();
        this.audio.resetBGM();
    }

    update() {
        this.stars.update();
        if (!this.isRunning) return;

        this.frame++;
        this.player.update(this.input, this.width, this.height);
        this.enemyManager.update(this.frame, this);

        if (this.player.alive) { 
            // 自機ショット
            // Zキー、スペースキー または 画面タッチ で発射
            const isFiring = this.input.isPressed('KeyZ') || this.input.isPressed('Space') || this.input.isTouching;
            if (isFiring && this.frame % 10 === 0) {
                this.entities.push(new Bullet(this.player.x + 14, this.player.y));
                this.audio.playShot();       
                this.score += 10;   // 弾打ちしたら加点弱め
                this.updateScoreUI();
            }else{
                this.score += 30;   // 生きてたら加点
                this.updateScoreUI();
            }
            this.checkCollisions();

            // クリア判定
            if (this.enemyManager.isFinished && this.entities.filter(e => e instanceof Enemy).length === 0 && this.player.alive) {
                this.isCleared = true;
            }
        }
        // 全エンティティ更新
        [...this.entities, ...this.particles].forEach(e => e.update(this));
        this.entities = this.entities.filter(e => e.active);
        this.particles = this.particles.filter(e => e.active);
    }

    checkCollisions() {
        if (!this.player.alive) return;
        const px = this.player.x + 16, py = this.player.y + 16;

        this.entities.forEach(e => {
            // 自機が敵や敵弾に当たったか
            if (e instanceof Enemy || e instanceof EnemyBullet) {
                const dx = px - (e.x + e.width / 2), dy = py - (e.y + e.height / 2);
                if (Math.sqrt(dx * dx + dy * dy) < 10) {
                    this.triggerGameOver();
                }
            }
            // 敵が自機ショットに当たったか
            if (e instanceof Enemy) {
                this.entities.forEach(b => {
                    if (b instanceof Bullet) {
                        if (b.x < e.x + e.width && b.x + b.width > e.x && 
                            b.y < e.y + e.height && b.y + b.height > e.y) {
                            
                            b.active = false; // 弾は消える

                            // 敵に1ダメージ与え、撃破されたかチェック
                            const isDestroyed = e.takeDamage(1);

                            if (isDestroyed) {
                                // （例：100, 300, 600, 1000... と増えていく形）
                                const scoreGain = 50 * e.maxHp * (e.maxHp + 1);
                                this.score += scoreGain;
                                this.updateScoreUI();
                                console.log(scoreGain);
                                
                                this.audio.playExplosion();
                                // ★ HP 10以上の強敵ボーナス演出
                                if (e.maxHp >= 10) {
                                    setTimeout(() => {// 0.2秒(200ms)だけ遅らせて2回目のドカン！
                                        this.audio.playExplosion();
                                    }, 200);

                                    // パーティクルも派手目に
                                    for (let i = 0; i < 32; i++) this.particles.push(new Particle(e.x + 16, e.y + 16));
                                }else{
                                    for (let i = 0; i < 8; i++) this.particles.push(new Particle(e.x + 16, e.y + 16));
                                }
                            } else {
                                this.audio.playHitSound();
                                for (let i = 0; i < 2; i++) this.particles.push(new Particle(b.x, b.y));
                            }
                        }
                    }
                });
            }
        });
    }

    triggerGameOver() {
        this.player.alive = false;
        this.audio.fadeOutBGM();
        this.audio.playExplosion();
        for (let i = 0; i < 30; i++) this.particles.push(new Particle(this.player.x + 16, this.player.y + 16, 'player'));
    }

    draw() {
        // 1. 背景の塗りつぶしと星空の描画（ここは常に動かしたい）
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.width, this.height);
        this.stars.draw(this.ctx);

        // 2. プレイヤーが存在しない（＝ゲーム開始前）なら、ここで処理を切り上げる
        if (!this.player) {
            return; 
        }

        this.entities.forEach(e => e.draw(this.ctx));
        this.particles.forEach(p => p.draw(this.ctx));
        this.player.draw(this.ctx);

        // GAME OVER
        if (!this.player.alive) {
            this.gameOverTimer++;
            this.ctx.fillStyle = 'rgba(255,0,0,0.5)';
            this.ctx.fillRect(0, 180, 320, 100);   
            this.ctx.fillStyle = '#FFF';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('GAME OVER', 160, 230);
            if (this.gameOverTimer > 180) this.endSession("GAME OVER");
        }

        // STAGE CLEAR
        if (this.isCleared) {
            this.clearTimer++;
            this.ctx.fillStyle = '#0FF';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('STAGE 1 CLEAR', 160, 240);
            if (this.clearTimer > 300) this.endSession("CONGRATULATIONS!");
        }
    }

    updateScoreUI() {
        const MAX_SCORE = 99999990;
        this.score = this.score > MAX_SCORE ? MAX_SCORE : this.score;
        
        const scoreEl = document.getElementById('score-display');
        const hiScoreEl = document.getElementById('hi-score-display');

        if (scoreEl) {
            scoreEl.innerText = `SCORE: ${this.score.toString().padStart(8, '0')}`;
            if (this.score >= MAX_SCORE) {
                scoreEl.classList.add('counter-stop');
            } else {
                scoreEl.classList.remove('counter-stop');
            }
        }        
        if (hiScoreEl) {
            hiScoreEl.innerText = `HI-SCORE: ${this.highScore.toString().padStart(8, '0')}`;
        }
    }

    endSession(msg) {
        this.isRunning = false;
        this.isShowingCredits = false;

        // ハイスコアを保存
        const isNewRecord = this.score >= this.highScore && this.score > 0;
        if (isNewRecord) {
                this.highScore = this.score;
            localStorage.setItem('void_circuit_highscore', this.highScore);
            document.getElementById('hi-score-display').classList.add('counter-stop');
            this.updateScoreUI();
        }
        let hiScoreMsg = isNewRecord 
            ? `<br><br><span style="color: #ffff00; font-size: 1.2em; animation: blink 0.5s infinite;">★ NEW HI-SCORE !! ★</span>` 
            : "";
        const startScreen = document.getElementById('start-screen');
        startScreen.style.display = 'flex';
        startScreen.querySelector('p').innerHTML = `
                ${msg}${hiScoreMsg}<br><br>
                RETRY OPERATION?
            `;

        // シェアボタンを表示してイベント登録
        const shareBtn = document.getElementById('share-btn');
        shareBtn.style.display = 'block';
        shareBtn.onclick = (e) => {
            e.stopPropagation();
            const text = encodeURIComponent(`PROJECT: VOID-CIRCUIT v${this.version}
スコア: ${this.score}
作戦完了。虚無の回路を突破せよ。

https://void-circuit.ani-net.com

#VoidCircuit #80年代STG #IndieGame #SunoAI`);
            window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
        };
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