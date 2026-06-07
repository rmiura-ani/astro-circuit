/*
 * PROJECT: VOID-CIRCUIT
 *
 * UI・演出管理コンポーネント (game-ui.js)
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */

export class GameUIManager {
    constructor(game) {
        this.game = game;
        this.resetGameUIState();
    }

// 🚀 ゲーム開始時・リトライ時に呼び出し、UI全体の表示や演出状態を初期化する
    resetGameUIState() {
        // --- A. 【game.jsから引っ越し】ゲーム開始時の画面要素のトグル ---
        const startScreen = document.getElementById('start-screen');
        if (startScreen) startScreen.style.display = 'none';

        const livesDisplay = document.getElementById('lives-display');
        if (livesDisplay) livesDisplay.style.display = 'block';

        const weaponContainer = document.getElementById('weapon-container');
        if (weaponContainer) weaponContainer.style.display = 'block';

        const scoreEl = document.getElementById('score-display');
        if (scoreEl) scoreEl.classList.remove('counter-stop');

        const hiScoreEl = document.getElementById('hi-score-display');
        if (hiScoreEl) hiScoreEl.classList.remove('counter-stop');


        // --- B. エンディング演出関連のリセット（既存のロジック） ---
        this._endingPhase = 0;
        this._endingTimer = 0;
        this._endingKvAlpha = 0;
        this.game.isEnding = false;

        const domKv = document.getElementById('fullscreen-kv');
        const warpPlayer = document.getElementById('fullscreen-warp-player');
        
        if (domKv) {
            domKv.style.display = 'none';
            domKv.style.opacity = '0';
        }
        if (warpPlayer) {
            warpPlayer.style.opacity = '1';
            warpPlayer.classList.remove('trigger-warp');
        }
    }

 updateScoreUI() {
        // カンストの上限値を共通定義
        const MAX_DISPLAY_SCORE = 99999990;

        // --- 1. プレイヤーの現在スコア表示 ---
        const scoreEl = document.getElementById('score-display');
        if (scoreEl) {
            const displayScore = Math.min(this.game.score, MAX_DISPLAY_SCORE);
            scoreEl.innerText = `SCORE: ${displayScore.toString().padStart(8, '0')}`;
            
            // カンストに達し、かつ「まだ音が鳴っていない瞬間」だけ一度だけ実行
            if (this.game.score >= MAX_DISPLAY_SCORE && !this.game.hasCounterStopped) {
                scoreEl.classList.add('counter-stop');
                if (this.game.sc.audio) this.game.sc.audio.playPowerUp();
                this.game.hasCounterStopped = true;
            }
            // 💡 毎フレームの else { remove } はゲーム開始時のリセットに任せたので、丸ごと削除！
        }

        // --- 2. ハイスコア側の表示制御 ---
        const hiScoreEl = document.getElementById('hi-score-display');
        if (hiScoreEl) {
            const currentHi = this.game.sc.highScore; 
            const displayHiScore = Math.min(currentHi, MAX_DISPLAY_SCORE);
            
            hiScoreEl.innerText = `HI-SCORE: ${displayHiScore.toString().padStart(8, '0')}`;
            
            // ハイスコア側も、カンストした時だけクラスを付与
            // （ゲーム開始時に白に戻っているため、超えた瞬間だけ付ければOK）
            if (currentHi >= MAX_DISPLAY_SCORE) {
                hiScoreEl.classList.add('counter-stop');
            }
        }
        
        // --- 3. エクステンド処理 ---
        if (!this.game.hasExtended && this.game.extendThreshold !== 'NONE' && this.game.score >= this.game.extendThreshold) {
            this.game.currentLives++;
            if (this.game.sc.audio) this.game.sc.audio.playPowerUp();
            this.game.hasExtended = true;
            this.triggerExtendBlink();
        }
    }

    triggerExtendBlink() {
        const el = document.getElementById('lives-display');
        el?.classList.add('extend-blink');
        setTimeout(() => el?.classList.remove('extend-blink'), 2000);
    }

    updateLivesUI() {
        const el = document.getElementById('lives-display');
        if (!el) return;
        const count = Math.max(0, this.game.currentLives - 1);
        const icon = "🚀";
        el.innerText = count === 0 ? "" : (count <= 3 ? icon.repeat(count) : `${icon}x${count}`);
    }

    visualEffectWarning() {
        const container = document.getElementById('game-container');
        if (!container) return;
        container.style.transition = "filter 0.1s";
        container.style.filter = "brightness(1.2) sepia(1) saturate(5) hue-rotate(-50deg)";
        setTimeout(() => { container.style.filter = ""; }, 150);
    }

    updateDebugInfo() {
        const debugEl = document.getElementById('debug-info');
        if (!debugEl || !this.game.isInvincibleCheat) {
            if (debugEl) debugEl.style.display = 'none';
            return;
        }
        debugEl.style.display = 'block';
        
        document.getElementById('debug-frame').innerText = this.game.frame;
        document.getElementById('debug-scn-frame').innerText = this.game.scenario.currentScenarioFrame;
        document.getElementById('debug-index').innerText = `${this.game.scenario.currentIndex} / ${this.game.scenario.length}`;

        const bonusEl = document.getElementById('debug-bonus-time');
        const boss = this.game.entities.find(e => e.isBoss); 
        
        if (boss && this.game.bossStartTime > 0 && bonusEl) {
            const elapsed = this.game.frame - this.game.bossStartTime;
            const remaining = Math.max(0, boss.timeLimit - elapsed);
            bonusEl.innerText = `${remaining}F (${(remaining / GAME_CONFIG.FPS).toFixed(2)}s)`;
            bonusEl.style.color = remaining < 600 ? "#f00" : "#0ff"; 
        } else if (bonusEl) {
            bonusEl.innerText = "---";
            bonusEl.style.color = "#888";
        }        
        document.getElementById('debug-load').innerText = this.game.entities.length + this.game.particles.length;

        // 🌟 ここから追記：SPAWN と KILL の数値を画面に反映
        const spawnEl = document.getElementById('debug-spawn');
        if (spawnEl) spawnEl.innerText = this.game.stats.enemiesSpawned;

        const killEl = document.getElementById('debug-kill');
        if (killEl) killEl.innerText = this.game.stats.enemiesKilled;
    }

    drawOverlayMessages(ctx) {
        ctx.save();
        ctx.font = '16px "Press Start 2P", cursive';
        ctx.textAlign = 'center';

        // ---------------------------------------------------------------
        // 🌟 【最優先】ステージ7（最終）クリア・エンディング演出割り込み（HTML完全移行版）
        // ---------------------------------------------------------------
        if (this.game.isEnding) {
            const domKv = document.getElementById('fullscreen-kv');
            const container = document.getElementById('game-container');
            const warpPlayer = document.getElementById('fullscreen-warp-player');
            
            if (this._endingPhase === 0) {
                this._endingPhase = 1;
                this._endingTimer = 0;

                // 🚀 1. ゲーム本体（Canvas含む）をまるごと非表示にして虚無バグを完全遮断！
                if (container) container.style.display = 'none';

                // 🚀 2. フルスクリーンHTMLを発動して画像と文字、自機をON
                if (domKv) {
                    const kvPath = `${this.game.sc.assetBase}ending/kv.png`;
                    domKv.style.backgroundImage = `url('${kvPath}')`;
                    domKv.style.display = 'flex'; // 中央配置レイアウトを起動
                    
                    setTimeout(() => { domKv.style.opacity = '1'; }, 50);
                }

                // 🚀 3. 【修正】HTML側の自機に、動的に正しいアセットパスをセットする！
                if (warpPlayer) {
                    // システムのassetBaseをベースに、自機の画像パスを組み立て
                    const playerImgPath = `${this.game.sc.assetBase}player.webp`; // もし階層が違う場合は調整してください
                    warpPlayer.src = playerImgPath;

                    warpPlayer.classList.add('trigger-warp');
                }
            }

            this._endingTimer++;

            // ■ PHASE 1: 自機が下からシュッと入ってくる（1秒間＝60F）
            if (this._endingPhase === 1) {
                if (this._endingTimer >= 60) {
                    this._endingPhase = 2;
                }
            }

            // ■ PHASE 2: 静寂と余韻。Imagen 3とクリアの文字をじっくり魅せる（4.5秒間＝270F）
            if (this._endingPhase === 2) {
                if (this._endingTimer >= 330) { // 60 + 270
                    this._endingPhase = 3;
                }
            }

            // ■ PHASE 3: 自機が音速を超えて上部へワープ（0.5秒間＝30F。CSSの5.5s発火と完全同期）
            if (this._endingPhase === 3) {
                if (this._endingTimer >= 360) { // 330 + 30
                    this._endingPhase = 4;
                    this._endingTimer = 0; 
                }
            }

            // ■ PHASE 4: 自機が去ったあとの「3秒間（180F）」の静かなる宇宙の余韻
            if (this._endingPhase === 4) {
                // ⏳ 【変更】1秒（60F）経ったら、じわ〜っとフェードアウトを開始！
                //（CSSの transition: opacity 1.0s によって、120Fの時点で完全に真っ黒になります）
                if (this._endingTimer === 60) {
                    if (domKv) domKv.style.opacity = '0';
                }

                // ⏳ 3秒（180F）経ったら次の画面へ。
                //（120Fで消えきっているので、120F〜180Fの「丸々1秒間」が完全な黒画面の余韻になります）
                if (this._endingTimer >= 180) {
                    this._endingPhase = 5; 
                    
                    // 次のプレイのために内部状態を完全リセット
                    this.resetGameUIState();
                    
                    // ゲーム容器をクレジット表示のために確実に復活させる
                    if (container) container.style.display = 'block';
                    
                    console.log("[Ending] Full HTML-Ending completed. Dark room luxury finished. To Credits.");
                    
                    // 次の画面へセッション終了を通知
                    this.game.endSession("ALL STAGES CLEARED!");
                }
            }

            return; // 🛑 Canvas側の描画処理は1文字たりとも通さない
        }

        // ---------------------------------------------------------------
        // 🌌 2. 通常の道中開始時：KV演出 (既存のロジックを維持 / STAGE 1〜6)
        // ---------------------------------------------------------------
        let kvPath = null;
        let kvDuration = 180;
        if (this.game.scenario.kv) {
            if (typeof this.game.scenario.kv === 'object') {
                kvPath = this.game.scenario.kv.path;
                kvDuration = this.game.scenario.kv.duration || 180;
            } else {
                kvPath = this.game.scenario.kv;
            }
        }

        if (this.game.frame > 0 && this.game.frame < kvDuration) {
            let textAlpha = 1.0;
            if (this.game.frame <= 30) textAlpha = this.game.frame / 30;
            else if (this.game.frame > (kvDuration - 30)) textAlpha = (kvDuration - this.game.frame) / 30;

            if (kvPath && this.game.assets) {
                const kvImage = this.game.assets.get?.(kvPath) || this.game.assets[kvPath];
                if (kvImage && kvImage.complete) {
                    ctx.save();
                    const progress = this.game.frame / kvDuration;
                    let kvAlpha = 1.0;
                    if (this.game.frame <= 25) kvAlpha = this.game.frame / 25;
                    else if (this.game.frame > (kvDuration - 45)) kvAlpha = Math.max(0, (kvDuration - this.game.frame) / 45);

                    const baseWidth = GAME_CONFIG.WIDTH;
                    const baseHeight = kvImage.height * (GAME_CONFIG.WIDTH / kvImage.width);
                    const scale = 1.12 - (progress * 0.12); 
                    const drawWidth = baseWidth * scale;
                    const drawHeight = baseHeight * scale;
                    const drawX = (GAME_CONFIG.WIDTH - drawWidth) / 2;
                    const drawY = (GAME_CONFIG.HEIGHT * 0.35) - (drawHeight / 2);

                    ctx.save();
                    ctx.globalCompositeOperation = 'source-over';
                    ctx.globalAlpha = kvAlpha * 0.6;
                    ctx.fillStyle = '#000000';
                    ctx.fillRect(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT);
                    ctx.restore();

                    ctx.globalCompositeOperation = 'screen';
                    ctx.globalAlpha = Math.max(0, kvAlpha);
                    ctx.drawImage(kvImage, drawX, drawY, drawWidth, drawHeight);
                    ctx.restore();
                }
            }

            const textCenterY = GAME_CONFIG.HEIGHT * 0.65;
            ctx.font = '16px "Press Start 2P", cursive';
            ctx.fillStyle = `rgba(0, 255, 255, ${textAlpha})`;
            ctx.fillText(`STAGE ${this.game.currentStageNum}`, GAME_CONFIG.WIDTH / 2, textCenterY);
            
            ctx.font = '11px "Press Start 2P", cursive';
            ctx.fillStyle = `rgba(255, 255, 255, ${textAlpha})`;
            ctx.fillText(this.game.scenario.stageName, GAME_CONFIG.WIDTH / 2, textCenterY + 30);
        }

        // 💀 3. ゲームオーバー演出 (通常時のみ)
        if (!this.game.player.alive && this.game.currentLives <= 0) {
            ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
            ctx.fillRect(0, GAME_CONFIG.HEIGHT / 2 - 50, GAME_CONFIG.WIDTH, 100);
            ctx.fillStyle = '#FFF';
            ctx.fillText('GAME OVER', GAME_CONFIG.WIDTH / 2, GAME_CONFIG.HEIGHT / 2);
        }

        // 🌟 4. 通常のステージクリア演出 (STAGE 1〜6用)
        if (this.game.isCleared) {
            const stageNameStr = this.game.scenario.stageName; 
            ctx.fillStyle = '#0FF';
            ctx.fillText(`STAGE ${this.game.currentStageNum} CLEAR`, GAME_CONFIG.WIDTH / 2, GAME_CONFIG.HEIGHT / 2);            
            ctx.font = '10px "Press Start 2P", cursive';
            ctx.fillStyle = '#FFF';
            ctx.fillText(stageNameStr, GAME_CONFIG.WIDTH / 2, GAME_CONFIG.HEIGHT / 2 + 30);
        }

        ctx.restore();
    }
}