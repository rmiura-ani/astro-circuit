/**
 * ゲーム全体を統括するメインクラス
 */
class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.width = 320;
        this.height = 480;
        this.version = "0.23";

        // GitHub上の資産ベースURL
        this.assetBase = "https://void-circuit-assets.ani-net.com/";

        // サブシステムの初期化
        this.input = new InputManager(this.canvas);
        this.audio = new AudioManager(this.assetBase);
        this.stars = new Starfield(this.width, this.height);
        this.config = new ConfigManager(this);

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

        // 難易度ごとのパラメータ例
        this.difficultyParams = {
            'EASY':     { enemySpeed: 0.8, fireRate: 0.5 },
            'NORMAL':   { enemySpeed: 1.0, fireRate: 1.0 },
            'HARD':     { enemySpeed: 1.3, fireRate: 2.0 },
            'VERY HARD': { enemySpeed: 1.5, fireRate: 3.0 }
        };
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
                if (!a || !a.src) return r(); // aがundefinedの場合のガードも追加
                a.oncanplaythrough = () => r();
                a.onerror = () => r();
                a.load();
                setTimeout(r, 5000); // タイムアウト保険
            });

            // SEとBGMの両方を配列にまとめて Promise.all に渡す
            const sePromises = Object.values(this.audio.sounds).map(s => loadAud(s));
            const bgmPromises = Object.values(this.audio.bgms).map(b => loadAud(b)); // ★ここを追加

            await Promise.all([
                loadImg(this.assetBase + "player.jfif"),
                loadImg(this.assetBase + "enemy.jfif"),
                ...bgmPromises, // ★this.audio.bgm から変更
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
        // --- 1. まず「設定ボタン」単体のイベントを最初に登録する ---
        const configBtn = document.getElementById('config-open-btn');
        if (configBtn) {
            configBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // 親（start-screen）へのクリック伝播を完全に止める
                this.config.open(); // ★委託
            });
        }

        // --- 2. 画面全体のクリック・キー操作（proceed） ---
        const proceed = () => {
            // 設定画面が開いているなら、何もしない（設定画面内のクリックは別で処理）
            if (this.isConfigMode) return;

            // クレジット中ならタイトルへ
            if (this.isShowingCredits) {
                this.backToTitle();
                return;
            }

            // ゲーム実行中なら何もしない
            if (this.isRunning) return;

            // プレイヤーが死んでいる場合のリトライ待ち
            if (this.player && !this.player.alive) {
                if (this.gameOverTimer < 30) return; 
            }

            // タイトル画面等ならゲーム開始
            if (this.isLoaded) {
                this.stopIdleTimer();
                this.start();
            }
        };

        // マウス・タップ：start-screenをクリックした時
        document.getElementById('start-screen').addEventListener('click', proceed);

        // キーボード
        window.addEventListener('keydown', (e) => {
            // 1. 設定画面が開いている場合：設定画面の入力処理へ
            if (this.config.isMode) {
                this.config.handleInput(e);
                return; // 他の処理をスキップ
            }

            // 2. 設定画面が閉じていて「KeyC」が押された場合：設定画面を開く
            if (e.code === 'KeyC') {
                this.config.open();
                return;
            }

            // 3. Z / Space が押された場合：ゲーム開始などの進行処理
            if (e.code === 'Space' || e.code === 'KeyZ') {
                proceed();
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
        this.idleTimeout = setTimeout(() => this.showCredits(), 10000);
    }

    stopIdleTimer() {
        if (this.idleTimeout) clearTimeout(this.idleTimeout);
    }

    // クレジット表示
    showCredits() {
        this.isShowingCredits = true;
        document.getElementById('title-content').style.display = 'none';
        document.getElementById('config-open-btn').style.display = 'none';
        const screen = document.getElementById('credit-screen');
        screen.style.display = 'block';
        screen.classList.add('scrolling');
    }

    // タイトルに戻る
    backToTitle() {
        this.isShowingCredits = false;
        const screen = document.getElementById('credit-screen');
        screen.style.display = 'none';
        screen.classList.remove('scrolling');
        document.getElementById('title-content').style.display = 'block';
        document.getElementById('config-open-btn').style.display = 'block';
        this.startIdleTimer();
    }

    // サウンドテスト
    playBackSoundTest() {
        this.audio.playSEByIndex(this.soundTestIndex);
    }

    start() {
        document.getElementById('start-screen').style.display = 'none';
        document.getElementById('hi-score-display').classList.remove('counter-stop');
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
                this.score += 20;   // 弾打ちしたら加点弱め
                this.updateScoreUI();
            }else{
                if (this.frame % 5 === 0) {
                    this.score += 30;   // 生きてたら加点
                    this.updateScoreUI();
                }
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
                    if (e.y < 20) return;
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

                                this.createExplosion(e.x + 16, e.y + 16, e);
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

    createExplosion(x, y, enemy) {
        const hp = enemy.maxHp || 1;
        
        // --- 1. パーティクル生成 ---
        const count = 10 + (hp * 2);
        const type = hp >= 10 ? 'boss' : 'enemy';
        const speedMultiplier = 1 + (hp * 0.01);

        for (let i = 0; i < count; i++) {
            const vx = (Math.random() - 0.5) * 10 * speedMultiplier;
            const vy = (Math.random() - 0.5) * 10 * speedMultiplier;
            this.particles.push(new Particle(x, y, type, vx, vy));
        }

        // --- 2. 爆発音の制御 ---
        // 1回目の音は即座に鳴らす
        this.audio.playExplosion();

        // 強敵（HP10以上）なら、時間差でもう一発鳴らす
        if (hp >= 10) {
            setTimeout(() => {
                // ゲームがまだ続いていれば鳴らす（念のため）
                if (this.audio) this.audio.playExplosion();
            }, 200);
            
            // さらにHPが50以上の超強敵なら、0.4秒後にもう一発追加しても面白いですよ！
            if (hp >= 50) {
                setTimeout(() => {
                    if (this.audio) this.audio.playExplosion();
                }, 400);
            }
        }
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
            this.ctx.font = '16px "Press Start 2P", cursive';
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
            this.ctx.font = '16px "Press Start 2P", cursive';
            this.ctx.fillStyle = '#0FF';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('STAGE 1 CLEAR', 160, 240);
            if (this.clearTimer > 300) this.endSession("CONGRATULATIONS!");
        }
    }

    resize() {
        const canvas = this.ctx.canvas;
        const windowRatio = window.innerWidth / window.innerHeight;
        const gameRatio = this.width / this.height; // 320 / 480 = 0.66...

        if (windowRatio < gameRatio) {
            // 画面が縦長すぎる場合（スマホなど）：幅を100%に
            canvas.style.width = '100vw';
            canvas.style.height = 'auto';
        } else {
            // 画面が横長すぎる場合（タブレット・PC）：高さを100%に
            canvas.style.height = '100vh';
            canvas.style.width = 'auto';
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

    loop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.loop());
    }
}

// 起動
const game = new Game();
game.init().then(() => game.loop());