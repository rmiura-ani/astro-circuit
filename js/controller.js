/*
 * PROJECT: VOID-CIRCUIT
 *
 * controller.js - System Administration & Scene Control
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */
import { InputManager } from './systems/input.js';
import { AudioManager } from './systems/audio.js';
import { ConfigManager } from './config/config.js';
import { Game } from './game.js';

/**
 * SystemController: ゲーム全体のライフサイクル・システム統合管理
 */
export class SystemController {
    constructor() {
        this.VERSION = "0.59";
        this.canvas = document.getElementById('game-canvas');

        // URLパラメータの解析（GitHub上の別ブランチやタグをテストするため）
        const urlParams = new URLSearchParams(window.location.search);
        const tag = urlParams.get('tag');
        const branch = urlParams.get('branch') || 'main'
        const refPath = tag ? `tags/${tag}` : `heads/${branch}`;
        const githubBase = `https://raw.githubusercontent.com/rmiura-ani/void-circuit-assets/refs/${refPath}/`;

        // 【優先切替】ローカルなら指定されたローカルパスを強制適用、本番ならGitHub
        const LOCAL_ASSET_ROOT = "../void-circuit-assets/";
        const isLocal = ["localhost", "127.0.0.1"].includes(location.hostname);
        if (isLocal) {
            this.assetBase = LOCAL_ASSET_ROOT;
            this.tag = 'local' 
        } else {
            this.assetBase = githubBase;
            this.tag = tag ? `${tag}` : `${branch}`;
        }
        // パスが必ずスラッシュ（/）で終わるように補正
        if (!this.assetBase.endsWith("/")) {
            this.assetBase += "/";
        }

        console.log(`[System] Asset Base Path determined: "${this.assetBase}" (Local Mode: ${isLocal})`);

        // サブシステムの初期化
        this.input = new InputManager(this.canvas);
        this.audio = new AudioManager(this.assetBase);
        this.config = new ConfigManager(this);
        this.config.loadConfig();
        
        this.game = null; 
        this.isShowingCredits = false;
        this.idleTimeout = null;
    }

    // --- プロパティ ---
    set highScore(val) {
        const scoreBound = Math.min(val, 99999990);
        localStorage.setItem('void_circuit_highscore', scoreBound);
        
        const hiScoreEl = document.getElementById('hi-score-display');
        if (hiScoreEl) {
            hiScoreEl.classList.add('counter-stop');
            hiScoreEl.innerText = `HI-SCORE: ${scoreBound.toString().padStart(8, '0')}`;
        }
    }
    
    get highScore() { 
        return parseInt(localStorage.getItem('void_circuit_highscore')) || 0; 
    }

    /** ハイスコアリセット */
    resetHighScore() {
        this.highScore = 0;
        localStorage.removeItem('void_circuit_highscore');
    }

    /** 初期化 */
    async init() {
        document.getElementById('version-display').innerText = this.VERSION;
        document.getElementById('config-open-btn').style.display = 'none';

        try {
            // ハイスコア（ストレージから呼び出して表示）
            const loadHighScore = this.highScore;
            this.highScore = loadHighScore;
            
            this.setStartMessage("Click or [Z]Key to Start", "#0FF");
            document.getElementById('config-open-btn').style.display = 'block';

            this.setupGlobalEvents();
            this.startIdleTimer();
        } catch (e) {
            console.error("[System] Init Failed:", e);
            this.setStartMessage("❌ ERROR: Failed to Load Assets", "#F44");
        }
        Analytics.logGameLaunch(this.VERSION);
    }

    /** main.js から呼ばれる起動エントリーポイント */ 
    startLoop() {
        const loop = () => {
            this.update(); // 自身のアップデート処理へ
            this.draw();   // 自身の描画処理へ
            
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    /** システム全体の更新処理 */
    update() {
        if (this.game && this.game.isRunning) {
            this.game.update();
        }
    }

    /** システム全体の描画処理 */
    draw() {
        if (this.game && this.game.isRunning) {
            this.game.draw();
        }
    }
    
    /** イベントリスナー セットアップ */
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
            if (e.code === 'KeyC' && (!this.game || !this.game.isRunning) && !this.isShowingCredits) {
                this.stopIdleTimer();
                this.config.open();
            }
            if (['Space', 'KeyZ'].includes(e.code)) this.handleProceed('KEYBOARD');
             if (this.config && this.config.isInvincibleCheat) {
                const keyNum = parseInt(e.key, 10);
                if (keyNum >= 1 && keyNum <= 7) {
                    this.handleProceed('KEYBOARD', keyNum);
                }
            }
        });

        const credits = document.getElementById('credit-screen');
        if (credits) {
            credits.onanimationend = () => {
                setTimeout(() => { if (this.isShowingCredits) this.backToTitle(); }, 5000);
            };
        }
    }

    /** 実行ハンドラ */
    handleProceed(type, stage = 1) {
        if (this.config.isMode || (this.game && this.game.isRunning)) return;
        if (this.isShowingCredits) return this.backToTitle();
        
        // ゲームオーバー直後の連打防止
        if (this.game && this.game.player && !this.game.player.alive && this.game.gameOverTimer < 30) return;

        this.stopIdleTimer();
        if (!this.game) this.game = new Game(this);
        this.game.start(type === 'MOUSE' ? 'MOUSE' : 'KEYBOARD', stage);
    }

    // --- 画面遷移系 ---
    /** タイトル => クレジット表示のタイマー */
    startIdleTimer() {
        this.stopIdleTimer();
        this.idleTimeout = setTimeout(() => this.showCredits(), 15000);
    }
    
    stopIdleTimer() { 
        if (this.idleTimeout) clearTimeout(this.idleTimeout); 
    }
    
    /** クレジット表示 */
    showCredits() {
        this.isShowingCredits = true;
        document.getElementById('title-content').style.display = 'none';
        document.getElementById('config-open-btn').style.display = 'none';
        const screen = document.getElementById('credit-screen');
        if (screen) {
            screen.style.display = 'block';
            screen.classList.add('scrolling');
        }
    }

    /** タイトルに戻る */
    backToTitle() {
        this.isShowingCredits = false;
        const screen = document.getElementById('credit-screen');
        if (screen) {
            screen.style.display = 'none';
            screen.classList.remove('scrolling');
        }
        document.getElementById('title-content').style.display = 'block';
        document.getElementById('config-open-btn').style.display = 'block';
        this.startIdleTimer();
    }

    /** スタート・リザルト表示 */ 
    showStartScreen(msg, isNew) {
        if (!this.game) return;

        const missionCode = this.getMissionCode(false);
        const spawned = this.game.stats?.enemiesSpawned || 0;
        const killed = this.game.stats?.enemiesKilled || 0;
        const fired = this.game.stats?.shotsFired || 0;
        const hit = this.game.stats?.shotsHit || 0;

        const killRate = spawned > 0 ? Math.floor((killed / spawned) * 100) : 0;
        const accuracy = fired > 0 ? ((hit / fired) * 100).toFixed(3) : "0.000";

        const statsHtml = `
            <div class="mission-header">MISSION: ${missionCode}</div>
            <div class="stats-container">
                <div class="stats-row">
                    <span class="stats-label">KILLS:</span>
                    <span class="stats-value">${killed} / ${spawned} (${killRate}%)</span>
                </div>
                <div class="stats-row">
                    <span class="stats-label">HIT RATE:</span>
                    <span class="stats-value">${accuracy}%</span>
                </div>
            </div>
        `;
        
        const pEl = document.querySelector('#start-screen p');
        if (pEl) {
            pEl.innerHTML = `<div class="result-msg">${msg}</div>${statsHtml}${isNew ? '<div class="new-record">★ NEW HI-SCORE !! ★</div>' : ''}<br>RETRY OPERATION?`;
        }
        document.getElementById('start-screen').style.display = 'flex';

        this.setupShareButton();
    }

    /** スタートメッセージ */ 
    setStartMessage(text, color) {
        const el = document.querySelector('#start-screen p');
        if (el) {
            el.innerHTML = text;
            el.style.color = color;
            el.style.animation = "none";
        }
    }

    /** X へのシェアボタン表示 */ 
    setupShareButton() {
        const btn = document.getElementById('share-btn');
        if (!btn) return;
        btn.style.display = 'block';
        btn.onclick = (e) => {
            e.stopPropagation();
            window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(this.generateShareText())}`, '_blank');
        };
    }

    /** シェア用文言 */ 
    generateShareText() {
        const scoreVal = this.game ? this.game.score : 0;
        return `PROJECT: VOID-CIRCUIT v${this.VERSION}\n` +
               `----------------------------\n` +
               `■ SCORE  : ${scoreVal.toLocaleString()}\n` +
               `■ MISSION: ${this.getMissionCode(true)}\n` +
               `----------------------------\n` +
               `作戦完了。虚無の回路を突破せよ。\n\n` +
               `https://void-circuit.ani-net.com\n` +
               `#VoidCircuit #80年代STG #IndieGame`;
    }

    /** ミッション名導出（未定義エラーへのセーフティを追加） */ 
    getMissionCode(isShare = false) {
        const r = this.game?.sessionRecord;
        if (!r) return `VC-${this.VERSION}-INIT`;

        const diffMap = { 'EASY':'EZ', 'NORMAL':'NM', 'HARD':'HD', 'VERY HARD':'VH' };
        const diffStr = diffMap[r.difficulty] || 'U';
        const cheatStr = r.cheatUsed ? (isShare ? '(CHEAT)' : '(CHT)') : '';
        const extendStr = r.extend === 'NONE' ? 'OFF' : `${(r.extend/1000000)}M`;
        const livesStr = `${r.lives}L`;
        const missionName = r.missionName.toUpperCase();

        // 操作モード判定
        let controlSuffix = '-MK';
        if (r.inputMode === 'MOUSE') controlSuffix = '-M';
        if (r.inputMode === 'KEYBOARD') controlSuffix = '-K';

        return `${missionName}-${diffStr}${cheatStr}-${livesStr}-${extendStr}${controlSuffix}`;
    }
}