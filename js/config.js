/*
 * PROJECT: VOID-CIRCUIT
 *
 * config.js
 *
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */

/**
 * 設定画面（BIOS風）を管理するクラス
 */
class ConfigManager {
    constructor(sc) {
        this.sc = sc;
        this.isMode = false;
        this.currentIndex = 0;
        this.debugCCount = 0;

        // --- 選択肢の定義 ---
        this.OPTIONS = {
            difficulty: ['EASY', 'NORMAL', 'HARD', 'VERY HARD'],
            lives: [1, 2, 3, 5],
            extend: [3000000, 5000000, 10000000, 'NONE']
        };

        // --- 設定値（OPTIONSから取得） ---
        this.difficulty = this.OPTIONS.difficulty[1]; // 'NORMAL'
        this.lives      = this.OPTIONS.lives[2];      // 3
        this.extend     = this.OPTIONS.extend[1];     // 5,000,000        
        this.soundTestIndex = 0;
        this.bgmTestIndex = 0;
        this.isInvincibleCheat = false;

        // --- DOM要素 ---
        this.screenEl = document.getElementById('config-screen');
        this.startScreenEl = document.getElementById('start-screen');
        this.items = [];

        this.resetConfirmed = false;
        
        // ピークホールド（イコライザーの頂点の粒）を維持するメモリ配列
        this.peaks = new Array(32).fill(0);

        // BGMが現在テスト再生中かどうかのフラグ
        this.isBGMPlaying = false;
    }

    /** 設定画面を開く */
    async open() {
        this.isMode = true;
        this.startScreenEl.style.display = 'none';
        this.screenEl.style.display = 'flex';
        
        // 最新のDOM状態を取得
        this.items = Array.from(document.querySelectorAll('.config-item'));
        
        // イベントの登録
        this.setupMouseEvents();
        
        this.isBGMPlaying = false; // 初期状態は停止
        this.refreshAllDisplay();
        this.updateSelection();

        if (this.sc.audio) {
            this.sc.audio.resetBGM();
            // オーディオリスナー登録（曲が終了したときの自動次曲遷移用）
            this.setupAudioEndedListener();
        }

        await this.buildDynamicSoundTestList();
        this.refreshAllDisplay();

        const eqCanvas = document.getElementById('eq-overlay-canvas');
        if (eqCanvas) {
            this.eqCtx = eqCanvas.getContext('2d');
            this.startLoop(); // 👈 ループ自体は裏でスタンバイさせておく
        }
    }

    /** 設定画面を閉じる */
    close() {
        this.isMode = false;
        this.screenEl.style.display = 'none';
        this.startScreenEl.style.display = 'flex';
        
        if (this.sc.audio) {
            this.sc.audio.resetBGM();
            // リスナーのクリーンアップ（ゲーム本編への干渉を防ぐ）
            if (this.sc.audio.bgmNode) {
                this.sc.audio.bgmNode.onended = null;
            }
        }
        this.isBGMPlaying = false;
        this.peaks.fill(0);

        // イコライザー枠を非表示にする
        const eqContainer = document.getElementById('eq-container');
        if (eqContainer) {
            eqContainer.style.opacity = '0';
            eqContainer.style.display = 'none';
        }

        if (this.loopId) {
            cancelAnimationFrame(this.loopId);
            this.loopId = null;
        }
    }

    /** BGM終了時の自動次曲遷移リスナーを設定 */
    setupAudioEndedListener() {
        if (!this.sc.audio) return;        
        this.sc.audio.onBGMEnded = () => {
            if (!this.isMode || !this.isBGMPlaying) return;
            this.playNextBGMAutomated();
        };
    }

    /** 自動で次の曲へ移行（7面の次は1面） */
    playNextBGMAutomated() {
        const len = this.sc.audio.bgmCount;
        if (len <= 0) return;

        // 次の曲へ（7面の次は1面、つまり登録数を超えたら0へループ）
        this.bgmTestIndex = (this.bgmTestIndex + 1) % len;
        
        // 自動再生を継続
        this.isBGMPlaying = true;
        if (this.sc.audio) {
            this.sc.audio.playBGMByIndex(this.bgmTestIndex);
            // 新しく作られたNodeに再度終了イベントが走るよう、AudioManager側で this.onBGMEnded が呼ばれる設計を想定
        }

        const item = this.items.find(i => i.dataset.setting === 'bgm');
        if (item) this.refreshDisplay(item);
    }

    /** 動的にサウンドリストを構築 */
    async buildDynamicSoundTestList() {
        const totalStages = 7; // 総ステージ数
        const metaPromises = [];
        const base = this.sc.assetBase || "";

        for (let i = 1; i <= totalStages; i++) {
            if (this.sc.ScenarioManager) {
                metaPromises.push(this.sc.ScenarioManager.peekStageMeta(i, base));
            }
        }

        const results = await Promise.all(metaPromises);
        
        const validBgmList = results
            .filter(meta => meta && meta.bgm)
            .map(meta => ({
                fileName: meta.bgm,
                displayName: `ST-${meta.stageNum}: ${meta.name}`
            }));

        if (this.sc.audio) {
            this.sc.audio.setDynamicBGMList(validBgmList);
        }
    }

    /** キー入力処理 */
    handleInput(e) {
        if (!this.isMode) return;

        switch (e.code) {
            case 'ArrowUp':
                this.currentIndex = (this.currentIndex - 1 + this.items.length) % this.items.length;
                this.updateSelection();
                break;
            case 'ArrowDown':
                this.currentIndex = (this.currentIndex + 1) % this.items.length;
                this.updateSelection();
                break;
            case 'ArrowLeft':
            case 'ArrowRight':
                this.handleValueChange(e.code === 'ArrowRight');
                break;
            case 'KeyZ':
            case 'Space':
                this.handleAction();
                break;
            case 'KeyC':
                this.handleCheatCommand();
                break;
        }
    }

    /** 値の変更処理 (左右キー) */
    handleValueChange(isRight) {
        const item = this.items[this.currentIndex];
        if (!item) return;
        const setting = item.dataset.setting;

        if (this.OPTIONS[setting]) {
            const options = this.OPTIONS[setting];
            let idx = options.indexOf(this[setting]);
            idx = isRight ? (idx + 1) % options.length : (idx - 1 + options.length) % options.length;
            this[setting] = options[idx];
        } else if (setting === 'sound') {
            const len = this.sc.audio.seCount;
            if (len > 0) {
                this.soundTestIndex = isRight ? (this.soundTestIndex + 1) % len : (this.soundTestIndex - 1 + len) % len;
            }
        } else if (setting === 'bgm') {
            const len = this.sc.audio.bgmCount;
            if (len > 0) {
                // 左右キーを押した場合は曲の切り替え（再生状態であればそのまま新曲を再生）
                this.bgmTestIndex = isRight ? (this.bgmTestIndex + 1) % len : (this.bgmTestIndex - 1 + len) % len;
                if (this.isBGMPlaying) {
                    if (this.sc.audio) this.sc.audio.playBGMByIndex(this.bgmTestIndex);
                }
            }
        }

        this.refreshDisplay(item);
    }

    /** 決定時のアクション (Z/Space または クリック) */
    handleAction() {
        const item = this.items[this.currentIndex];
        if (!item) return;
        const setting = item.dataset.setting;

        if (setting === 'sound') this.playBackSoundTest();
        if (setting === 'bgm') {
            // BGM TEST時は決定キーで「再生/停止」をトグル
            this.toggleBGMTest();
        }
        if (setting === 'reset_score') {
            if (!this.resetConfirmed) {
                this.resetConfirmed = true;
                if (this.sc.audio) this.sc.audio.playHitSound();
                item.classList.add('danger');
                const valEl = item.querySelector('.value');
                if (valEl) valEl.innerText = "SURE?";
            } else {
                this.executeHighScoreReset();
                this.resetConfirmed = false;
                item.classList.remove('danger');
            }
        } else {
            this.cancelResetConfirm();
        }

        if (setting === 'exit') { 
            this.saveConfig(); 
            this.close(); 
        }
    }

    /** 「リセットしていい？」の解除 */
    cancelResetConfirm() {
        this.resetConfirmed = false;
        this.items.forEach(item => {
            item.classList.remove('danger');
            if (item.dataset.setting === 'reset_score') {
                const valEl = item.querySelector('.value');
                if (valEl) valEl.innerText = "EXECUTE";
            }
        });
    }

    /** ハイスコアリセット */
    executeHighScoreReset() {
        if (this.sc.audio) this.sc.audio.playExplosion();
        if (this.sc.visualEffectWarning) this.sc.visualEffectWarning();
        this.sc.resetHighScore();

        const valEl = this.items[this.currentIndex].querySelector('.value');
        if (valEl) {
            valEl.innerText = "PURGED!!";
            valEl.style.color = "#0FF";
            setTimeout(() => {
                valEl.innerText = "EXECUTE";
                valEl.style.color = "";
            }, 2000);
        }
    }

    /** 無敵設定（裏コマンド） */
    handleCheatCommand() {
        this.debugCCount++;
        if (this.debugCCount < 7) return;
        this.debugCCount = 0;

        this.isInvincibleCheat = !this.isInvincibleCheat;
        if (this.isInvincibleCheat) {
            if (this.sc.audio) this.sc.audio.playPowerUp();
            this.screenEl.style.color = "#FFD700";
            this.screenEl.style.textShadow = "0 0 10px #FFF";
        } else {
            if (this.sc.audio) this.sc.audio.playExplosion();
            this.screenEl.style.color = "";
            this.screenEl.style.textShadow = "";
        }
    }

    /** 描画（全部） */
    refreshAllDisplay() {
        this.items.forEach(item => this.refreshDisplay(item));
    }

    /** 描画（アイテム） */
    refreshDisplay(item) {
        const setting = item.dataset.setting;
        const valEl = item.querySelector('.value');
        if (!valEl) return;

        if (this.OPTIONS[setting]) {
            valEl.innerText = this[setting];
        } else if (setting === 'sound') {
            valEl.innerText = `< ${this.sc.audio.getSEName(this.soundTestIndex)} >`;
        } else if (setting === 'bgm') {
            const audio = this.sc.audio;
            if (!audio || audio.bgmCount === 0) {
                valEl.innerText = "< LOADING... >";
            } else {
                valEl.innerText = `< ${audio.getBGMName(this.bgmTestIndex)} >`;
            }
        }
    }

    /** 選択 */
    updateSelection() {
        this.items.forEach((item, index) => {
            item.classList.toggle('active', index === this.currentIndex);
        });
        if (this.resetConfirmed) this.cancelResetConfirm();
        this.debugCCount = 0;
    }

    /** マウスイベントハンドラ セットアップ */
    setupMouseEvents() {
        this.items.forEach((item, index) => {
            item.onclick = null;
            item.onmouseenter = null;

            item.onclick = (e) => {
                e.stopPropagation();
                if (this.currentIndex !== index) {
                    this.currentIndex = index;
                    this.updateSelection();
                }
                const setting = item.dataset.setting;
                
                // 🛠 【核心の修正】BGM項目のクリック処理
                if (setting === 'bgm') {
                    if (!this.isBGMPlaying) {
                        // 1. 停止中の場合は「現在の曲を再生」
                        this.isBGMPlaying = true;
                        if (this.sc.audio) this.sc.audio.playBGMByIndex(this.bgmTestIndex);
                        this.showEqualizerContainer();
                    } else {
                        // 2. 再生中の場合は「インデックスを進めて次の曲を再生」
                        const len = this.sc.audio ? this.sc.audio.bgmCount : 0;
                        if (len > 0) {
                            this.bgmTestIndex = (this.bgmTestIndex + 1) % len;
                            if (this.sc.audio) this.sc.audio.playBGMByIndex(this.bgmTestIndex);
                        }
                    }
                    this.refreshDisplay(item);

                } else if (this.OPTIONS[setting] || setting === 'sound') {
                    this.handleValueChange(true);
                    if (setting === 'sound') this.playBackSoundTest();
                    if (this.sc.audio) this.sc.audio.playHitSound();
                } else {
                    this.handleAction();
                }
            };

            item.onmouseenter = () => {
                if (this.currentIndex !== index) {
                    this.currentIndex = index;
                    this.updateSelection();
                }
            };
        });
    }

    playBackSoundTest() { if (this.sc.audio) this.sc.audio.playSEByIndex(this.soundTestIndex); }

    /** BGMの再生・停止をトグル制御する関数（キーボード操作用） */
    toggleBGMTest() {
        if (!this.sc.audio) return;

        this.isBGMPlaying = !this.isBGMPlaying;

        if (this.isBGMPlaying) {
            this.sc.audio.playBGMByIndex(this.bgmTestIndex);
            this.showEqualizerContainer();
        } else {
            this.sc.audio.resetBGM();
        }

        const item = this.items.find(i => i.dataset.setting === 'bgm');
        if (item) this.refreshDisplay(item);
    }

    /** イコライザーコンテナを表示するヘルパー */
    showEqualizerContainer() {
        const eqContainer = document.getElementById('eq-container');
        if (eqContainer) {
            eqContainer.style.display = 'block';
            setTimeout(() => { eqContainer.style.opacity = '1'; }, 10);
        }
    }

    drawEqualizer(ctx, x, y) {
        if (!this.sc.audio || !this.sc.audio.getByteFrequencyData) return;
        const rawData = this.sc.audio.getByteFrequencyData();
        if (!rawData) return;

        const targetIndices = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        const activeCount = targetIndices.length; 
        const canvasWidth = ctx.canvas.width;
        const maxHeight = ctx.canvas.height;
        const barGap = 4; 
        const barWidth = (canvasWidth - (barGap * (activeCount - 1))) / activeCount;

        ctx.save();
        for (let i = 0; i < activeCount; i++) {
            const rawIdx = targetIndices[i];
            let rawValue = rawData[rawIdx];
            let processedValue = ((rawValue - 140 + (rawIdx * 6)) * 2);
            processedValue = Math.max(0, Math.min(255, processedValue));
            let barHeight = (processedValue / 255) * maxHeight;

            if (rawValue > 10) {
                barHeight = Math.max(2, Math.min(maxHeight - 4, barHeight));
            } else {
                barHeight = 1;
            }

            ctx.fillStyle = `rgb(255, ${150 + (i * 7.5)}, 0)`;
            const barX = x + i * (barWidth + barGap);
            const barY = y + maxHeight - barHeight;

            if (barHeight > 0) ctx.fillRect(barX, barY, barWidth, barHeight);

            if (barHeight >= this.peaks[i]) {
                this.peaks[i] = barHeight;
            } else {
                this.peaks[i] = Math.max(0, this.peaks[i] - 0.45); 
            }

            if (this.peaks[i] > 0) {
                ctx.fillStyle = "rgba(255, 255, 220, 0.95)";
                ctx.fillRect(barX, y + maxHeight - this.peaks[i], barWidth, 2);
            }

            ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
            for (let h = 0; h < maxHeight; h += 4) {
                ctx.fillRect(barX, y + h, barWidth + 1, 1);
            }
        }
        ctx.restore();
    }

    saveConfig() {
        const configData = { difficulty: this.difficulty, lives: this.lives, extend: this.extend };
        localStorage.setItem('void_circuit_config', JSON.stringify(configData));
    }

    loadConfig() {
        const saved = localStorage.getItem('void_circuit_config');
        if (!saved) return;
        try {
            const data = JSON.parse(saved);
            this.difficulty = this.OPTIONS.difficulty.includes(data.difficulty) ? data.difficulty : this.OPTIONS.difficulty[1];
            this.lives = this.OPTIONS.lives.includes(data.lives) ? data.lives : this.OPTIONS.lives[2];
            this.extend = this.OPTIONS.extend.includes(data.extend) ? data.extend : this.OPTIONS.extend[1];
            this.refreshAllDisplay();
        } catch (e) {
            console.error("Config corruption detected. Resetting to defaults.", e);
        }
    }

    startLoop() {
        if (!this.isMode || !this.eqCtx) return;
        this.eqCtx.clearRect(0, 0, this.eqCtx.canvas.width, this.eqCtx.canvas.height);
        this.drawEqualizer(this.eqCtx, 0, 0);
        this.loopId = requestAnimationFrame(() => this.startLoop());
    }
}