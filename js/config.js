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
 * 設定画面（BIOS風）を管理するクラス (v0.25 Refactored)
 */
class ConfigManager {
    constructor(game) {
        this.game = game;
        this.isMode = false;
        this.currentIndex = 0;
        this.debugCCount = 0;

        // --- 設定値（初期値） ---
        this.difficulty = 'NORMAL';
        this.lives = 3;
        this.extend = 500000;
        
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
        this.items = []; // open時に取得

        this.resetConfirmed = false; // リセットの確認状態を保持
    }

    /** 設定画面を開く */
    open() {
        this.isMode = true;
        this.startScreenEl.style.display = 'none';
        this.screenEl.style.display = 'flex';
        
        // 最新のDOM状態を取得してイベント登録
        this.items = Array.from(document.querySelectorAll('.config-item'));
        this.setupMouseEvents();
        
        // 現在の値に合わせて表示を初期化
        this.refreshAllDisplay();
        this.updateSelection();

        this.game.audio.resetBGM();
    }

    /** 設定画面を閉じる */
    close() {
        this.isMode = false;
        this.screenEl.style.display = 'none';
        this.startScreenEl.style.display = 'flex';
        this.game.audio.resetBGM();
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
        const setting = item.dataset.setting;

        if (this.OPTIONS[setting]) {
            // 通常設定項目 (Difficulty, Lives, Extend)
            const options = this.OPTIONS[setting];
            let idx = options.indexOf(this[setting]);
            idx = isRight ? (idx + 1) % options.length : (idx - 1 + options.length) % options.length;
            this[setting] = options[idx];
        } else if (setting === 'sound') {
            // SEテスト
            const len = this.game.audio.seCount;
            this.soundTestIndex = isRight ? (this.soundTestIndex + 1) % len : (this.soundTestIndex - 1 + len) % len;
        } else if (setting === 'bgm') {
            // BGMテスト
            const len = this.game.audio.bgmCount;
            this.bgmTestIndex = isRight ? (this.bgmTestIndex + 1) % len : (this.bgmTestIndex - 1 + len) % len;
        }

        this.refreshDisplay(item);
    }

    /** 決定ボタン（Z/Space/Click）時のアクション */
    handleAction() {
        const item = this.items[this.currentIndex];
        const setting = item.dataset.setting;

        if (setting === 'sound') this.playBackSoundTest();
        if (setting === 'bgm') this.playBackBGMTest();

        // --- HI-SCORE RESET 2段階処理 ---
        if (setting === 'reset_score') {
            if (!this.resetConfirmed) {
                // 1段階目：確認状態へ
                this.resetConfirmed = true;
                this.game.audio.playHitSound();
                item.classList.add('danger');
                const valEl = item.querySelector('.value');
                if (valEl) valEl.innerText = "SURE?";
            } else {
                // 2段階目：実行！
                this.executeHighScoreReset();
                this.resetConfirmed = false;
                item.classList.remove('danger');
            }
        } else {
            // 他の項目でアクションが起きたら確認状態を解除
            this.cancelResetConfirm();
        }

        if (setting === 'exit') { 
            this.saveConfig(); 
            this.close(); 
        }
    }

    /** 確認状態のキャンセル処理 */
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

    /** ハイスコアを物理的に削除する */
    executeHighScoreReset() {
        this.game.audio.playExplosion(); // 破壊音！
        this.game.visualEffectWarning(); // 画面を赤くフラッシュさせる

        localStorage.removeItem('void_circuit_highscore');
        this.game.highScore = 0;
        this.game.updateScoreUI();

        const valEl = this.items[this.currentIndex].querySelector('.value');
        if (valEl) {
            valEl.innerText = "PURGED!!";
            valEl.style.color = "#0FF"; // 完了後はシアン色に
            setTimeout(() => {
                valEl.innerText = "EXECUTE";
                valEl.style.color = "";
            }, 2000);
        }
        console.log("SYSTEM: HI-SCORE DATA PURGED.");
    }

    /** チートコマンド（Cキー7回） */
    handleCheatCommand() {
        this.debugCCount++;
        if (this.debugCCount < 7) return;

        this.debugCCount = 0; // カウントリセット
        this.game.isInvincibleCheat = !this.game.isInvincibleCheat;

        if (this.game.updateDebugInfo) this.game.updateDebugInfo();

        if (this.game.isInvincibleCheat) {
            this.game.cheatUsedInSession = true;
            this.game.audio.playPowerUp();
            this.screenEl.style.color = "#FFD700";
            this.screenEl.style.textShadow = "0 0 10px #FFF";
            console.log("CHEAT: ENABLED (Invincible)");
        } else {
            this.game.audio.playExplosion();
            this.screenEl.style.color = "";
            this.screenEl.style.textShadow = "";
            console.log("CHEAT: DISABLED");
        }
    }

    /** 表示の全更新 */
    refreshAllDisplay() {
        this.items.forEach(item => this.refreshDisplay(item));
    }

    /** 特定項目の表示更新 */
    refreshDisplay(item) {
        const setting = item.dataset.setting;
        const valEl = item.querySelector('.value');
        if (!valEl) return;

        if (this.OPTIONS[setting]) {
            valEl.innerText = this[setting];
        } else if (setting === 'sound') {
            valEl.innerText = `< ${this.game.audio.getSEName(this.soundTestIndex)} >`;
        } else if (setting === 'bgm') {
            valEl.innerText = `< ${this.game.audio.getBGMName(this.bgmTestIndex)} >`;
        }
    }

    /** 選択枠の更新 */
    updateSelection() {
        this.items.forEach((item, index) => {
            item.classList.toggle('active', index === this.currentIndex);
        });
        if (this.resetConfirmed) {
            this.cancelResetConfirm();
        }
    }

    /** マウスイベントの登録 */
    setupMouseEvents() {
        this.items.forEach((item, index) => {
            item.onclick = (e) => {
                e.stopPropagation();
                
                // すでに選択されている項目をもう一度クリックした場合、または新規選択
                if (this.currentIndex === index) {
                    this.handleAction(); // 2回目なら実行、1回目ならSURE?へ
                } else {
                    this.currentIndex = index;
                    this.updateSelection();
                    // 項目が変わった直後のクリックなら1段階目として扱う
                    this.handleAction(); 
                }
            };

            item.onmouseenter = () => {
                if (this.currentIndex !== index) {
                    this.currentIndex = index;
                    this.updateSelection(); // ここで自動的に cancelResetConfirm が走る
                }
            };
        });
    }

    // --- オーディオ実行ヘルパー ---
    playBackSoundTest() { this.game.audio.playSEByIndex(this.soundTestIndex); }
    playBackBGMTest() { this.game.audio.playBGMByIndex(this.bgmTestIndex); }

    // 保存用メソッド
    saveConfig() {
        const configData = {
            difficulty: this.difficulty,
            lives: this.lives,
            extend: this.extend
        };
        localStorage.setItem('void_circuit_config', JSON.stringify(configData));
    }

    // 読み込み用メソッド
    loadConfig() {
        const saved = localStorage.getItem('void_circuit_config');
        if (saved) {
            const data = JSON.parse(saved);
            this.difficulty = data.difficulty || 'NORMAL';
            this.lives = data.lives || 3;
            this.extend = data.extend || 500000;
            this.refreshAllDisplay(); // メニューの表示を同期
        }
    }
}