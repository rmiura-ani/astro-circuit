/*
 * PROJECT: VOID-CIRCUIT
 *
 * controller.js - System Administration & Scene Control
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */
class SystemController {
    constructor() {
        this.VERSION = "0.37";
        this.canvas = document.getElementById('game-canvas');
        
        // サブシステムの初期化
        this.input = new InputManager(this.canvas);
        this.audio = new AudioManager();
        this.assets = new AssetManager();
        this.config = new ConfigManager(this);
        this.config.loadConfig();
        this.enemyManager = new EnemyManager();

        this.game = null; 
        this.isLoaded = false;
        this.isShowingCredits = false;
        this.idleTimeout = null;
    }

    set highScore(val) {
        const highScore = Math.min(val, 99999990);
        localStorage.setItem('void_circuit_highscore', highScore);
        const hiScoreEl = document.getElementById('hi-score-display');
        document.getElementById('hi-score-display').classList.add('counter-stop');
        if (hiScoreEl) hiScoreEl.innerText = `HI-SCORE: ${highScore.toString().padStart(8, '0')}`;
    }
    get highScore() { return parseInt(localStorage.getItem('void_circuit_highscore')) || 0; }

    resetHighScore() {
        this.highScore = 0;
        localStorage.removeItem('void_circuit_highscore');
    }

    async init() {
        document.getElementById('version-display').innerText = this.VERSION;
        document.getElementById('config-open-btn').style.display = 'none';

        try {
            // ブランチ名をもとに assetBase を決定
            const urlParams = new URLSearchParams(window.location.search);
            const branch = urlParams.get('branch') || 'main';
            this.assetBase = `https://raw.githubusercontent.com/rmiura-ani/void-circuit-assets/refs/heads/${branch}/`;

            // 各種アセット読み込み
            this.audio.initAudio(this.assetBase);
            await Promise.all([this.audio.preloadAll(), this.assets.loadImages(this.assetBase)]);
            const isLocal = ["localhost", "127.0.0.1"].includes(location.hostname);
            const scenarioPath = isLocal ? './scenario.json' : assetBase + 'scenario.json';
            const scenarioName = isLocal ? 'LOCAL' : branch.toUpperCase;
            this.enemyManager.loadScenario(scenarioPath, scenarioName);

            // ハイスコア（ストレージから呼び出して表示）
            this.highScore = this.highScore;
            
            this.isLoaded = true;
            this.setStartMessage("Click or [Z]Key to Start", "#0FF");
            document.getElementById('config-open-btn').style.display = 'block';

            this.setupGlobalEvents();
            this.startIdleTimer();
        } catch (e) {
            console.error(e);
            this.setStartMessage("❌ ERROR: Failed to Load Assets", "#F44");
        }
    }

    setupGlobalEvents() {
        document.getElementById('start-screen').addEventListener('click', () => this.handleProceed('MOUSE'));
        document.getElementById('config-open-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.stopIdleTimer();
            this.config.open();
        });

        window.addEventListener('keydown', (e) => {
            if (this.config.isMode) {
                this.config.handleInput(e);
                return;
            }
            if (e.code === 'KeyC' && !this.game?.isRunning && !this.isShowingCredits) {
                this.stopIdleTimer();
                this.config.open();
            }
            if (['Space', 'KeyZ'].includes(e.code)) this.handleProceed('KEYBOARD');
        });

        const credits = document.getElementById('credit-screen');
        credits.onanimationend = () => {
            setTimeout(() => { if (this.isShowingCredits) this.backToTitle(); }, 5000);
        };
    }

    handleProceed(type) {
        if (this.config.isMode || (this.game && this.game.isRunning)) return;
        if (this.isShowingCredits) return this.backToTitle();
        // ゲームオーバー直後の連打防止
        if (this.game && !this.game.player.alive && this.game.gameOverTimer < 30) return;

        if (this.isLoaded) {
            this.stopIdleTimer();
            if (!this.game) this.game = new Game(this);
            this.game.start(this.assetBase, type === 'MOUSE' ? 'MOUSE' : 'KEYBOARD');
        }
    }

    setStartMessage(text, color) {
        const el = document.querySelector('#start-screen p');
        if (el) {
            el.innerHTML = text;
            el.style.color = color;
            el.style.animation = "none";
        }
    }

    // --- 画面遷移系 ---
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

    showStartScreen(msg, isNew) {
        const missionCode = this.getMissionCode(false);
        const accuracy = this.game.stats.shotsFired > 0 ? Math.floor((this.game.stats.shotsHit / this.game.stats.shotsFired) * 100) : 0;
        const statsHtml = `
            <div class="mission-header">MISSION: ${missionCode}</div>
            <div class="stats-container">
                <div class="stats-row"><span class="stats-label">KILLS:</span><span class="stats-value">${this.game.stats.enemiesKilled} / ${this.game.stats.enemiesSpawned}</span></div>
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
        return `PROJECT: VOID-CIRCUIT v${this.VERSION}\n` +
               `----------------------------\n` +
               `■ SCORE  : ${this.gamescore.toLocaleString()}\n` +
               `■ MISSION: ${this.getMissionCode(true)}\n` +
               `----------------------------\n` +
               `作戦完了。虚無の回路を突破せよ。\n\n` +
               `https://void-circuit.ani-net.com\n` +
               `#VoidCircuit #80年代STG #IndieGame`;
    }

    getMissionCode(isShare = false) {
        const r = this.game.sessionRecord;
        const diffMap = { 'EASY':'E', 'NORMAL':'N', 'HARD':'H', 'VERY HARD':'VH' };
        const diffStr = diffMap[r.difficulty] || 'U';
        const cheatStr = r.cheatUsed ? (isShare ? '(CHEAT)' : '(CHT)') : '';
        const extendStr = r.extend === 'NONE' ? 'OFF' : `${(r.extend/1000)}k`;
        const livesStr = `L${r.lives}`; // ★ -L3 などの表記を作成
        const missionName = r.missionName;

        // 操作モード判定
        let controlSuffix = '-MK';
        if (r.inputMode === 'MOUSE') controlSuffix = '-M';
        if (r.inputMode === 'KEYBOARD') controlSuffix = '-K';

        return `${missionName}-${diffStr}${cheatStr}-${livesStr}-${extendStr}${controlSuffix}`;
    }
}