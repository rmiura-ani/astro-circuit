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

        this.soundTest = new SoundTestManager(sc);
        this.soundTest.onIndexChanged = () => this.refreshAllDisplay();

        // --- 選択肢・内部パラメータの定義 ---
        this.OPTIONS = {
            difficulty: ['EASY', 'NORMAL', 'HARD', 'VERY HARD'],
            lives: [1, 2, 3, 5],
            extend: [3000000, 5000000, 10000000, 'NONE']
        };

        // --- 設定値 ---
        this.difficulty = this.OPTIONS.difficulty[1]; // 'NORMAL'
        this.lives      = this.OPTIONS.lives[2];      // 3
        this.extend     = this.OPTIONS.extend[1];     // 5,000,000        
        this.isInvincibleCheat = false;

        // --- DOM要素 ---
        this.screenEl = document.getElementById('config-screen');
        this.startScreenEl = document.getElementById('start-screen');
        this.items = [];

        this.resetConfirmed = false;
    }

    /** 設定画面を開く */
    async open() {
        this.isMode = true;
        this.startScreenEl.style.display = 'none';
        this.screenEl.style.display = 'flex';
        
        this.items = Array.from(document.querySelectorAll('.config-item'));
        this.setupMouseEvents();
        
        this.refreshAllDisplay();
        this.updateSelection();
        this.soundTest.setupAudioEndedListener(this.isMode);

        // 動的リスト構築も委託
        await this.soundTest.buildDynamicSoundTestList();
        this.refreshAllDisplay();

        const eqCanvas = document.getElementById('eq-overlay-canvas');
        if (eqCanvas) {
            this.eqCtx = eqCanvas.getContext('2d');
            this.startLoop();
        }
    }

    /** 設定画面を閉じる */
    close() {
        this.isMode = false;
        this.screenEl.style.display = 'none';
        this.startScreenEl.style.display = 'flex';
        
        // --- ⚙️ BGMモードクラスを確実に剥がす ---
        this.screenEl.classList.remove('bgm-testing-mode');

        this.soundTest.stopAndReset();

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

    /** キー入力処理 */
    handleInput(e) {
        if (!this.isMode) return;

        // 🚀 現在画面に見えている（有効な）アイテムだけを抽出
        const visibleItems = this.items.filter(item => {
            return window.getComputedStyle(item).display !== 'none' && 
                   window.getComputedStyle(item).opacity !== '0';
        });

        if (visibleItems.length === 0) return;

        // 現在選択中のアイテムが、見えているリストの中で何番目かを探す
        let currentVisibleIdx = visibleItems.indexOf(this.items[this.currentIndex]);
        if (currentVisibleIdx === -1) currentVisibleIdx = 0;

        switch (e.code) {
            case 'ArrowUp':
                currentVisibleIdx = (currentVisibleIdx - 1 + visibleItems.length) % visibleItems.length;
                // 全体リスト側のインデックスに変換して同期
                this.currentIndex = this.items.indexOf(visibleItems[currentVisibleIdx]);
                this.updateSelection();
                break;
            case 'ArrowDown':
                currentVisibleIdx = (currentVisibleIdx + 1) % visibleItems.length;
                // 全体リスト側のインデックスに変換して同期
                this.currentIndex = this.items.indexOf(visibleItems[currentVisibleIdx]);
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

    /** 値の変更処理 (左右キー / マウスクリック) */
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
            this.soundTest.changeSEIndex(isRight); // 委託
        } else if (setting === 'bgm') {
            this.soundTest.changeBGMIndex(isRight); // 委託
        } else if (setting === 'audio_room') {
            this.soundTest.changeRoomPresetIndex(isRight); // 📻【追加】空間エフェクトインデックス変更を委託
        } else if (setting === 'eq_low' || setting === 'eq_mid' || setting === 'eq_high') {
            this.soundTest.changeEQGain(setting, isRight);
        }
        this.refreshDisplay(item);
    }

    /** 決定時のアクション */
    handleAction() {
        const item = this.items[this.currentIndex];
        if (!item) return;
        const setting = item.dataset.setting;

        if (setting === 'sound') {
            this.soundTest.playSE(); // 委託
        }
        if (setting === 'bgm') {
            this.toggleBGMAndTransform();
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
            valEl.innerText = `< ${this.sc.audio.getSEName(this.soundTest.soundTestIndex)} >`;
        } else if (setting === 'bgm') {
            const audio = this.sc.audio;
            if (!audio || audio.bgmCount === 0) {
                valEl.innerText = "< LOADING... >";
            } else {
                valEl.innerText = `< ${audio.getBGMName(this.soundTest.bgmTestIndex)} >`;
            }
        } else if (setting === 'audio_room') {
            // 📻【追加】オーディオマネージャー側からアコースティックプリセット文字列をバインド
            const audio = this.sc.audio;
            if (!audio || !audio.getRoomPresetName) {
                valEl.innerText = "< NOT READY >";
            } else {
                valEl.innerText = `< ${audio.getRoomPresetName(this.soundTest.roomPresetIndex)} >`;
            }
        } else if (setting === 'eq_low' || setting === 'eq_mid' || setting === 'eq_high') {
            const targetBand = setting.replace('eq_', '');
            const val = this.sc.audio ? this.sc.audio.eqSettings[targetBand] : 0;
            const sign = val > 0 ? "+" : "";
            valEl.innerText = `${sign}${val} dB`;
        }
    }

    /** 選択 */
    updateSelection() {
        // 🚀 もし選択中の項目が非表示（ゴースト）になっていたら、安全な項目にカーソルを避難させる
        const currentItem = this.items[this.currentIndex];
        if (currentItem && (window.getComputedStyle(currentItem).display === 'none' || window.getComputedStyle(currentItem).opacity === '0')) {
            // 代替として「BGM TEST」の項目を探してそこにカーソルを合わせる
            const bgmItemIdx = this.items.findIndex(item => item.dataset.setting === 'bgm');
            if (bgmItemIdx !== -1) this.currentIndex = bgmItemIdx;
        }

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
                
                if (setting === 'bgm') {
                    this.toggleBGMAndTransform();
                    this.refreshDisplay(item);
                } else if (this.OPTIONS[setting] || setting === 'sound' || setting === 'audio_room' || setting.startsWith('eq_')) {
                    this.handleValueChange(true);
                    if (this.sc.audio) this.sc.audio.playHitSound();
                } else {
                    this.handleAction();
                }
            };

            item.onmouseenter = () => {
                // 🚀 隠れている項目はマウスホバーも完全に無視する
                if (window.getComputedStyle(item).display === 'none' || window.getComputedStyle(item).opacity === '0') return;

                if (this.currentIndex !== index) {
                    this.currentIndex = index;
                    this.updateSelection();
                }
            };
        });
    }

    /** BGMテストの再生・停止と画面のトランスフォームを制御 */
    toggleBGMAndTransform() {
        // 🚀 コールバックで自分自身（ConfigManager）の表示関数を渡す
        this.soundTest.toggleBGM(() => this.showEqualizerContainer());

        // 再生状態に合わせてCSSクラスをつけ外しし、画面を変形させる
        if (this.soundTest.isBGMPlaying) {
            this.screenEl.classList.add('bgm-testing-mode');
        } else {
            this.screenEl.classList.remove('bgm-testing-mode');
            // 停止時は即座にEQコンテナを非表示にする
            const eqContainer = document.getElementById('eq-container');
            if (eqContainer) {
                eqContainer.style.opacity = '0';
                eqContainer.style.display = 'none';
            }
        }
    }

    /** イコライザーコンテナを表示するヘルパー */
    showEqualizerContainer() {
        const eqContainer = document.getElementById('eq-container');
        if (eqContainer) {
            eqContainer.style.display = 'block';
            setTimeout(() => { eqContainer.style.opacity = '1'; }, 10);
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

    saveConfig() {
        const configData = { 
            difficulty: this.difficulty, 
            lives: this.lives, 
            extend: this.extend,
        };
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
        const currentItem = this.items[this.currentIndex];
        const currentSetting = currentItem ? currentItem.dataset.setting : '';
        this.soundTest.drawEqualizer(this.eqCtx, 0, 0, currentSetting);
        this.loopId = requestAnimationFrame(() => this.startLoop());
    }
}