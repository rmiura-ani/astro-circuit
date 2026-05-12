/*
 * PROJECT: VOID-CIRCUIT
 *
 * config.js
 * * Copyright (c) 2026 あに。部長 / Ryo Miura
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

        // --- 設定値（初期値） ---
        this.difficulty = 'NORMAL';
        this.lives = 3;
        this.extend = 500000;
        this.isInvincibleCheat = false;
        
        // --- 選択肢の定義 ---
        this.OPTIONS = {
            difficulty: ['EASY', 'NORMAL', 'HARD', 'VERY HARD'],
            lives: [1, 2, 3, 5],
            extend: [300000, 500000, 1000000, 'NONE']
        };

        this.soundTestIndex = 0;
        this.bgmTestIndex = 0;

        // --- DOM要素 ---
        this.screenEl = document.getElementById('config-screen');
        this.startScreenEl = document.getElementById('start-screen');
        this.items = [];

        this.resetConfirmed = false;
    }

    /** 設定画面を開く */
    open() {
        this.isMode = true;
        this.startScreenEl.style.display = 'none';
        this.screenEl.style.display = 'flex';
        
        // 最新のDOM状態を取得
        this.items = Array.from(document.querySelectorAll('.config-item'));
        
        // イベントの登録（二重登録防止のため一回解除してから登録）
        this.setupMouseEvents();
        
        this.refreshAllDisplay();
        this.updateSelection();

        if (this.sc.audio) this.sc.audio.resetBGM();
    }

    /** 設定画面を閉じる */
    close() {
        this.isMode = false;
        this.screenEl.style.display = 'none';
        this.startScreenEl.style.display = 'flex';
        if (this.sc.audio) this.sc.audio.resetBGM();
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

    /** 値の変更処理 */
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
            this.soundTestIndex = isRight ? (this.soundTestIndex + 1) % len : (this.soundTestIndex - 1 + len) % len;
        } else if (setting === 'bgm') {
            const len = this.sc.audio.bgmCount;
            this.bgmTestIndex = isRight ? (this.bgmTestIndex + 1) % len : (this.bgmTestIndex - 1 + len) % len;
        }

        this.refreshDisplay(item);
    }

    /** 決定時のアクション */
    handleAction() {
        const item = this.items[this.currentIndex];
        const setting = item.dataset.setting;

        if (setting === 'sound') this.playBackSoundTest();
        if (setting === 'bgm') this.playBackBGMTest();

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

    refreshAllDisplay() {
        this.items.forEach(item => this.refreshDisplay(item));
    }

    refreshDisplay(item) {
        const setting = item.dataset.setting;
        const valEl = item.querySelector('.value');
        if (!valEl) return;

        if (this.OPTIONS[setting]) {
            valEl.innerText = this[setting];
        } else if (setting === 'sound') {
            valEl.innerText = `< ${this.sc.audio.getSEName(this.soundTestIndex)} >`;
        } else if (setting === 'bgm') {
            valEl.innerText = `< ${this.sc.audio.getBGMName(this.bgmTestIndex)} >`;
        }
    }

    updateSelection() {
        this.items.forEach((item, index) => {
            item.classList.toggle('active', index === this.currentIndex);
        });
        if (this.resetConfirmed) this.cancelResetConfirm();
        this.debugCCount = 0;
    }

    setupMouseEvents() {
        this.items.forEach((item, index) => {
            // 前回のイベントをクリアして二重登録を防ぐ
            item.onclick = null;
            item.onmouseenter = null;

            item.onclick = (e) => {
                e.stopPropagation();
                if (this.currentIndex !== index) {
                    this.currentIndex = index;
                    this.updateSelection();
                }
                const setting = item.dataset.setting;
                if (this.OPTIONS[setting] || setting === 'sound' || setting === 'bgm') {
                    this.handleValueChange(true);
                    if (setting === 'sound') this.playBackSoundTest();
                    if (setting === 'bgm') this.playBackBGMTest();
                    if (this.sc.audio && setting !== 'bgm' && setting !== 'sound') {
                        if (this.sc.audio) this.sc.audio.playHitSound();
                    }
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

    playBackSoundTest() { this.sc.audio.playSEByIndex(this.soundTestIndex); }
    playBackBGMTest() { this.sc.audio.playBGMByIndex(this.bgmTestIndex); }

    saveConfig() {
        const configData = {
            difficulty: this.difficulty,
            lives: this.lives,
            extend: this.extend
        };
        localStorage.setItem('void_circuit_config', JSON.stringify(configData));
    }

    loadConfig() {
        const saved = localStorage.getItem('void_circuit_config');
        if (saved) {
            const data = JSON.parse(saved);
            this.difficulty = data.difficulty || 'NORMAL';
            this.lives = data.lives || 3;
            this.extend = data.extend || 500000;
            this.refreshAllDisplay();
        }
    }
}