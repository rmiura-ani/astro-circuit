/**
 * ゲーム全体を統括するメインクラス
 */
class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.width = 320;
        this.height = 480;
        this.version = "0.25";

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
        this.currentLives = 0;
        this.score = 0;
        this.highScore = 0;
        this.isInvincibleCheat = false;
        this.cheatUsedInSession = false;

        this.idleTimeout = null;
        this.entities = [];
        this.particles = [];
        this.player = null;
        this.enemyManager = null;

        // 難易度ごとのパラメータ
        this.difficultyParams = {
            'EASY':     { enemySpeed: 0.8, fireRate: 0.7 },
            'NORMAL':   { enemySpeed: 1.0, fireRate: 1.0 },
            'HARD':     { enemySpeed: 1.1, fireRate: 1.5 },
            'VERY HARD': { enemySpeed: 1.3, fireRate: 2.0 }
        };
    }

    /**
     * 初期化：アセット読み込みとシナリオ準備
     */
    async init() {
        const messageEl = document.querySelector('#start-screen p');
        document.getElementById('version-display').innerText = this.version;

        try {
            const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
            const path = isLocal ? './scenario.json' : this.assetBase + 'scenario.json';

            const res = await fetch(path);
            if (!res.ok) throw new Error("Fetch failed");

            let scenarioData;
            try {
                scenarioData = await res.json();
            } catch (parseError) {
                messageEl.innerText = "⚠️ SCENARIO ERROR: Check JSON Syntax";
                messageEl.style.color = "#FF4444";
                return;
            }
            this.enemyManager = new EnemyManager(scenarioData);
            this.enemyManager.scenarioPath = path;

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
            messageEl.innerText = "Click or [Z]Key to Start";
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
        // 1. マウス系の登録
        this.setupMouseEvents();
        // 2. キーボード系の登録
        this.setupKeyboardEvents();

        // クレジット終了時のイベント
        const credits = document.getElementById('credit-screen');
        credits.onanimationend = () => {
            setTimeout(() => { if (this.isShowingCredits) this.backToTitle(); }, 5000);
        };
    }

    /**
     * ゲームの進行（開始・リトライ・戻る）を一括管理
     */
    handleProceed() {
        if (this.config.isMode) return;
        if (this.isRunning) return;

        if (this.isShowingCredits) {
            this.backToTitle();
            return;
        }

        if (this.player && !this.player.alive && this.gameOverTimer < 30) return;

        if (this.isLoaded) {
            this.stopIdleTimer();
            this.start();
        }
    }

    /**
     * マウス・タップイベント
     */
    setupMouseEvents() {
        // 画面クリックで進行
        document.getElementById('start-screen').addEventListener('click', () => {
            this.handleProceed();
        });

        // 設定を開く
        const configBtn = document.getElementById('config-open-btn');
        if (configBtn) {
            configBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.stopIdleTimer();
                this.config.open();
            });
        }

        // 設定を閉じる (SAVE AND EXIT)
        const exitItem = document.querySelector('.config-item[data-setting="exit"]');
        if (exitItem) {
            exitItem.addEventListener('click', () => {
                this.startIdleTimer();
                this.config.close();
            });
        }
    }

    /**
     * キーボードイベント
     */
    setupKeyboardEvents() {
        window.addEventListener('keydown', (e) => {
            // 設定画面中
            if (this.config.isMode) {
                this.config.handleInput(e);
                if (!this.config.isMode) this.startIdleTimer(); // 閉じたら再開
                return;
            }

            // キーによる設定オープン
            if (e.code === 'KeyC' && !this.isRunning && !this.isShowingCredits) {
                this.stopIdleTimer();
                this.config.open();
                return;
            }

            // 進行（Z/Space）
            if (e.code === 'Space' || e.code === 'KeyZ') {
                this.handleProceed();
            }

            // ゲーム中断（ECS）
            if (e.key === 'Escape'　 && this.isRunning) {
                this.escCount = (this.escCount || 0) + 1;
                
                // 画面全体を一瞬赤くして「警告」を表現する演出を追加
                const container = document.getElementById('game-container');
                if (container) {
                    // 警告演出：一瞬だけ赤く光らせ、セピア調で「異常事態」を表現
                    container.style.transition = "filter 0.1s";
                    container.style.filter = "brightness(1.2) sepia(1) saturate(5) hue-rotate(-50deg)";
                    
                    setTimeout(() => { 
                        container.style.filter = ""; 
                    }, 150);
                }

                if (this.escCount >= 2) {
                    this.escCount = 0;
                    this.currentLives = 1;
                    this.onPlayerMiss();
                } else {
                    // 1秒以内に2回目が来なければカウントリセット
                    setTimeout(() => { this.escCount = 0; }, 1000);
                }
            }
        });
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

    start() {
        document.getElementById('start-screen').style.display = 'none';
        document.getElementById('hi-score-display').classList.remove('counter-stop');

        // 難易度設定を反映
        const level = this.config.difficulty; // 'EASY', 'NORMAL' など
        const params = this.difficultyParams[level];
        if (this.enemyManager) {
            this.enemyManager.setDifficulty(params);
        }

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
        this.hasExtended = false; // エクステンド済みフラグ
        this.hasCounterStopped = false; // カンスト
        this.extendThreshold = this.config.extend;
        this.gameOverTimer = 0;
        this.currentLives = this.config.lives;
        this.clearTimer = 0;
        this.isCleared = false;
        this.enemyManager.reset();
        this.audio.resetBGM();

        this.updateLivesUI(); // 残機表示を更新する関数（後述）を呼ぶ
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
        const px = this.player.x + 16, py = this.player.y + 16;

        this.entities.forEach(e => {
            // 自機が敵や敵弾に当たったか
            if (this.player.alive && !this.player.isInvincible && !this.isInvincibleCheat){
                if (e instanceof Enemy || e instanceof EnemyBullet) {
                    const dx = px - (e.x + e.width / 2), dy = py - (e.y + e.height / 2);
                    if (Math.sqrt(dx * dx + dy * dy) < 10) {
                        this.onPlayerMiss();
                    }
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
 
    onPlayerMiss() {
        if (!this.player.alive) return; // 二重処理防止

        this.player.alive = false;

        // 派手な爆発パーティクル
        this.audio.playExplosion();
        for (let i = 0; i < 30; i++) this.particles.push(new Particle(this.player.x + 16, this.player.y + 16, 'player'));

        // 残機を減らす
        this.currentLives--;
        this.updateLivesUI();

        if (this.currentLives > 0) {
            // まだ残機がある：1.5秒後にリスポーン
            setTimeout(() => {
                this.respawnPlayer();
            }, 1500);
        } else {
            // 残機なし：BGM停止してゲームオーバーへ
            this.audio.fadeOutBGM();
        } 
    }

    respawnPlayer() {
        this.player.x = this.width / 2 - 16;
        this.player.y = this.height - 80;
        this.player.alive = true;

        // 復活直後の無敵時間
        this.player.setInvincible(180);
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
        if (!this.player.alive && this.currentLives <= 0) {
            this.gameOverTimer++;
            this.ctx.font = '16px "Press Start 2P", cursive';
            this.ctx.fillStyle = 'rgba(255,0,0,0.5)';
            this.ctx.fillRect(0, 180, 320, 100);   
            this.ctx.fillStyle = '#FFF';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('GAME OVER', 160, 230);
            if (this.gameOverTimer === 180) this.endSession("GAME OVER");
        }

        // STAGE CLEAR
        if (this.isCleared) {
            this.clearTimer++;
            this.ctx.font = '16px "Press Start 2P", cursive';
            this.ctx.fillStyle = '#0FF';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('STAGE 1 CLEAR', 160, 240);
            if (this.clearTimer === 301) this.endSession("CONGRATULATIONS!");
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
        if (!this.isRunning && this.gameOverTimer > 182) return; // すでに終了処理済みなら無視
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

            const rawPath = this.enemyManager.scenarioPath || 'UNKNOWN';
            const opName = rawPath.split('/').pop().replace('.json', '').toUpperCase();

            let opLevel;
            opLevel = {
                'EASY': 'E',
                'NORMAL': 'N',
                'HARD': 'H',
                'VERY HARD': 'VH'
            }[this.config.difficulty] || 'UN';
            if (this.cheatUsedInSession) { opLevel = opLevel +'(CHEAT)'; }


            // エクステンド設定をコードネームに変換
            const extendCfg = this.config.extend === 'NONE' 
                ? 'OFF' 
                : `${(this.config.extend / 1000).toLocaleString()}k`; // 1000で割るのが一般的（300kなど）

            // 投稿テキストの組み立て
            const postText = `PROJECT: VOID-CIRCUIT v${this.version}
----------------------------
■ SCORE  : ${this.score.toLocaleString()}
■ MISSION: ${opName}-${opLevel}-${extendCfg}
----------------------------
作戦完了。虚無の回路を突破せよ。

https://void-circuit.ani-net.com

#VoidCircuit #80年代STG #IndieGame #SunoAI`;

            // ★ ここを text ではなく postText に修正
            const encodedText = encodeURIComponent(postText);
            window.open(`https://twitter.com/intent/tweet?text=${encodedText}`, '_blank');
        };
        
        this.startIdleTimer();
    }

    updateScoreUI() {
        const MAX_SCORE = 99999990;
        
        // スコアが上限に達したかどうかの判定
        if (this.score >= MAX_SCORE) {
            this.score = MAX_SCORE; // 値を固定

            // ★初めてカンストした瞬間にだけ音を鳴らす
            if (!this.hasCounterStopped) {
                this.audio.playPowerUp(); // 勝利のファンファーレ！
                this.hasCounterStopped = true; // フラグを立てて二度目を防止
            }
        }

        const scoreEl = document.getElementById('score-display');
        const hiScoreEl = document.getElementById('hi-score-display');

        if (scoreEl) {
            scoreEl.innerText = `SCORE: ${this.score.toString().padStart(8, '0')}`;
            
            // カンスト演出（金色にするなど）の適用
            if (this.score >= MAX_SCORE) {
                scoreEl.classList.add('counter-stop');
            } else {
                scoreEl.classList.remove('counter-stop');
            }
        }    

        // ハイスコアの表示
        if (hiScoreEl) {
            hiScoreEl.innerText = `HI-SCORE: ${this.highScore.toString().padStart(8, '0')}`;
        }

        // エクステンド判定
        if (this.hasExtended || this.extendThreshold === 'NONE') return;
        if (this.score >= this.extendThreshold) {
            this.currentLives++;         // 残機増加
            this.audio.playPowerUp(); 
            this.updateLivesUI(true);        // 残機表示を即更新            
            this.hasExtended = true;     // 1回限定フラグを立てる
        }
    }

    updateLivesUI(shouldBlink = false) {
        const livesEl = document.getElementById('lives-display');
        if (!livesEl) return;

        const stockCount = Math.max(0, this.currentLives - 1);
        const icon = "🚀"; // SF風にロケットを選択

        if (stockCount === 0) {
            livesEl.innerText = ""; // 残機0（最後の1機）の時は何も表示しない（お好みで）
        } else if (stockCount <= 3) {
            livesEl.innerText = icon.repeat(stockCount);
        } else {
            // P2フォントが適用されると "x4" がカチッとしたドット文字になります
            livesEl.innerText = `${icon}x${stockCount}`;
        }
        // エクステンド時のチカチカ演出
        if (shouldBlink) {
            livesEl.classList.add('extend-blink');
            
            // 2秒後に点滅を止める
            setTimeout(() => {
                livesEl.classList.remove('extend-blink');
            }, 2000);
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