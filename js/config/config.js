/*
 * PROJECT: VOID-CIRCUIT
 *
 * config.js
 *
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */
import { SoundTestManager } from './soundTest.js';

/**
 * 設定画面（BIOS風）を管理するクラス
 */
export class ConfigManager {
    constructor(sc) {
        this.sc = sc;
        this.isMode = false;
        this.currentIndex = 0;
        this.debugCCount = 0;

        this.soundTest = new SoundTestManager(sc);
        this.soundTest.onIndexChanged = () => this.refreshAllDisplay();

        this.OPTIONS = {
            difficulty: ['EASY', 'NORMAL', 'HARD', 'VERY HARD'],
            lives: [1, 2, 3, 5],
            extend: [3000000, 5000000, 10000000, 'NONE']
        };

        this.difficulty = this.OPTIONS.difficulty[1];
        this.lives      = this.OPTIONS.lives[2];
        this.extend     = this.OPTIONS.extend[1];        
        this.isInvincibleCheat = false;

        this.screenEl = document.getElementById('config-screen');
        this.startScreenEl = document.getElementById('start-screen');
        this.items = [];
        this.resetConfirmed = false;
    }

/** 設定画面を開く */
    async open() {
        this.isMode = true;
        
        // 🚀 先にデータを構築して画面の裏でリストをパッと確定させておく
        this.items = Array.from(document.querySelectorAll('.config-item'));
        await this.soundTest.buildDynamicSoundTestList();
        
        // 🚀 表示される前に描画を一度走らせ、最初から「正しい行間」にしておく
        this.refreshAllDisplay();
        this.updateSelection();
        this.setupMouseEvents();
        this.soundTest.setupAudioEndedListener(this.isMode);

        // ✨ すべての準備が整ってから初めて画面をパッと出す
        this.startScreenEl.style.display = 'none';
        this.screenEl.style.display = 'flex';

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
        
        this.screenEl.classList.remove('bgm-testing-mode');

        // 🛑 安全のため、オーディオを破棄する「前」に描画ループを完全に止める
        if (this.loopId) {
            cancelAnimationFrame(this.loopId);
            this.loopId = null;
        }

        this.soundTest.stopAndReset();

        const eqContainer = document.getElementById('eq-container');
        if (eqContainer) {
            eqContainer.style.opacity = '0';
            eqContainer.style.display = 'none';
        }
    }

    /** キー入力処理 */
    handleInput(e) {
        if (!this.isMode) return;

        // 🚀 画面に見えている有効なアイテムだけを抽出（ここで完全制御）
        const visibleItems = this.items.filter(item => {
            return window.getComputedStyle(item).display !== 'none' && 
                   window.getComputedStyle(item).opacity !== '0';
        });

        if (visibleItems.length === 0) return;

        let currentVisibleIdx = visibleItems.indexOf(this.items[this.currentIndex]);
        if (currentVisibleIdx === -1) currentVisibleIdx = 0;

        switch (e.code) {
            case 'ArrowUp':
                currentVisibleIdx = (currentVisibleIdx - 1 + visibleItems.length) % visibleItems.length;
                this.currentIndex = this.items.indexOf(visibleItems[currentVisibleIdx]);
                this.updateSelection();
                break;
            case 'ArrowDown':
                currentVisibleIdx = (currentVisibleIdx + 1) % visibleItems.length;
                this.currentIndex = this.items.indexOf(visibleItems[currentVisibleIdx]);
                this.updateSelection();
                break;
            case 'ArrowLeft':
            case 'ArrowRight':
                this.handleValueChange(e.code === 'ArrowRight');
                break;
            case 'Space':
            case 'KeyZ':
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
        } else if (setting === 'se_vol' && this.sc.audio) {
        // audioManager側が「0.0 〜 1.0」で保持していると仮定し、10%（0.1）ずつ増減
            let vol = this.sc.audio.seVolume ?? 0.8; 
            vol = isRight ? (vol + 0.1) : (vol - 0.1);
            
            // 浮動小数点数の丸め誤差対策をしつつループ処理（0.0 〜 1.0）
            if (vol > 1.05) vol = 0.0;
            if (vol < -0.05) vol = 1.0;
            vol = Math.max(0, Math.min(1, Math.round(vol * 10) / 10));

            // audioManager 側の変数更新 & 音量反映メソッドの実行
            this.sc.audio.seVolume = vol;
            if (this.sc.audio.setSEVolume) this.sc.audio.setSEVolume(vol);
        } else if (setting === 'bgm_vol' && this.sc.audio) {
            let vol = this.sc.audio.bgmVolume ?? 0.7;
            vol = isRight ? (vol + 0.1) : (vol - 0.1);
            
            if (vol > 1.05) vol = 0.0;
            if (vol < -0.05) vol = 1.0;
            vol = Math.max(0, Math.min(1, Math.round(vol * 10) / 10));

            this.sc.audio.bgmVolume = vol;
            if (this.sc.audio.setBGMVolume) this.sc.audio.setBGMVolume(vol);
        } else if (setting === 'sound') {
            this.soundTest.changeSEIndex(isRight); 
        } else if (setting === 'bgm') {
            this.soundTest.changeBGMIndex(isRight); 
        } else if (setting === 'audio_room') {
            this.soundTest.changeRoomPresetIndex(isRight); 
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

        if (setting === 'sound') this.soundTest.playSE(); 
        if (setting === 'bgm') this.toggleBGMAndTransform();
        
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
        const audio = this.sc.audio;

        const wrapArrows = (text) => {
            // 💡 スタイルの共通定義（上下 10px、左右 14px ほど透明なアタリ判定を広げる）
            const btnStyle = `
                cursor: pointer; 
                padding: 10px 14px; 
                margin: -10px -14px; 
                user-select: none; 
                display: inline-block;
                font-weight: bold;
            `.replace(/\s+/g, ' '); // 1行にまとめる

            return `<span class="arrow-btn left-arrow" style="${btnStyle}"> ◀ </span>` +
                `<span class="inner-val" style="padding: 0 12px; display: inline-block; min-width: 80px; text-align: center;">${text}</span>` +
                `<span class="arrow-btn right-arrow" style="${btnStyle}"> ▶ </span>`;
        };

        if (this.OPTIONS[setting]) {
            valEl.innerHTML = wrapArrows(this[setting]);
        } else if (setting === 'se_vol') {
            const vol = audio ? Math.round((audio.seVolume ?? 0.8) * 100) : 80;
            const txt = vol === 0 ? "MUTED" : (vol === 100 ? "MAX" : `${vol}%`);
            valEl.innerHTML = wrapArrows(txt);
        } else if (setting === 'bgm_vol') {
            const vol = audio ? Math.round((audio.bgmVolume ?? 0.7) * 100) : 70;
            const txt = vol === 0 ? "MUTED" : (vol === 100 ? "MAX" : `${vol}%`);
            valEl.innerHTML = wrapArrows(txt);
        } else if (setting === 'sound') {
            valEl.innerHTML = wrapArrows(audio ? audio.getSEName(this.soundTest.soundTestIndex) : "---");
        } else if (setting === 'bgm') {
            const titleEl = document.querySelector('.bgm-title');
            if (!audio || audio.bgmCount === 0) {
                valEl.innerHTML = wrapArrows("LOADING...");
                if (titleEl) titleEl.innerText = "Please wait...";
            } else {
                const bgmID = `STAGE-${this.soundTest.bgmTestIndex + 1}`;
                valEl.innerHTML = wrapArrows(bgmID);
                if (titleEl) titleEl.innerText = audio.getBGMName(this.soundTest.bgmTestIndex);
            }            
        } else if (setting === 'audio_room') {
            if (!audio || !audio.getRoomPresetName) {
                valEl.innerHTML = wrapArrows("NOT READY");
            } else {
                valEl.innerHTML = wrapArrows(audio.getRoomPresetName(this.soundTest.roomPresetIndex));
            }
        } else if (setting === 'eq_low' || setting === 'eq_mid' || setting === 'eq_high') {
            const targetBand = setting.replace('eq_', '');
            const val = audio ? audio.eqSettings[targetBand] : 0;
            const sign = val > 0 ? "+" : "";
            valEl.innerHTML = wrapArrows(`${sign}${val} dB`);
        }
    }
    
    /** 選択状態の更新（冗長な強制bgm変更をカットして軽量化） */
    updateSelection() {
        this.items.forEach((item, index) => {
            item.classList.toggle('active', index === this.currentIndex);
        });
        if (this.resetConfirmed) this.cancelResetConfirm();
        this.debugCCount = 0;
    }

    /** マウスイベントセットアップ */
    setupMouseEvents() {
        this.items.forEach((item, index) => {
            item.onclick = (e) => {
                e.stopPropagation();
                if (this.currentIndex !== index) {
                    this.currentIndex = index;
                    this.updateSelection();
                }
                const setting = item.dataset.setting;
                const isLeftArrow = e.target.classList.contains('left-arrow');
                const isRightArrow = e.target.classList.contains('right-arrow');

                if (isLeftArrow || isRightArrow) {
                    // ◀ または ▶ がジャストでタップされた場合
                    this.handleValueChange(isRightArrow);
                    if (this.sc.audio) this.sc.audio.playHitSound();
                    if (setting === 'sound') this.soundTest.playSE();
                } else {
                    // 🚀 矢印以外の場所（行全体）がタップされた場合
                    if (setting === 'bgm') {
                        // BGM行は従来どおり再生/停止のトグル
                        this.toggleBGMAndTransform();
                        this.refreshDisplay(item);
                    } else if (setting === 'eq_low' || setting === 'eq_mid' || setting === 'eq_high') {
                        // ✨ 【修正】EQもゼロリセットではなく、右方向（値が増える）へ動かす
                        this.handleValueChange(true); 
                        if (this.sc.audio) this.sc.audio.playHitSound();
                    } else if (this.OPTIONS[setting] || setting === 'audio_room' || setting === 'se_vol' || setting === 'bgm_vol') {
                        // その他の設定項目も右方向へ進める
                        this.handleValueChange(true);
                        if (this.sc.audio) this.sc.audio.playHitSound();
                    } else {
                        // EXIT や RESET_SCORE などのアクションを実行
                        this.handleAction();
                    }
                }
            };

            item.onmouseenter = () => {
                if (window.getComputedStyle(item).display === 'none' || window.getComputedStyle(item).opacity === '0') return;
                if (this.currentIndex !== index) {
                    this.currentIndex = index;
                    this.updateSelection();
                }
            };
        });
    }

    /** BGMテスト再生制御 */
    toggleBGMAndTransform() {
        this.soundTest.toggleBGM(() => this.showEqualizerContainer());

        if (this.soundTest.isBGMPlaying) {
            this.screenEl.classList.add('bgm-testing-mode');
        } else {
            this.screenEl.classList.remove('bgm-testing-mode');
            const eqContainer = document.getElementById('eq-container');
            if (eqContainer) {
                eqContainer.style.opacity = '0';
                eqContainer.style.display = 'none';
            }
        }
    }

    showEqualizerContainer() {
        const eqContainer = document.getElementById('eq-container');
        if (eqContainer) {
            eqContainer.style.display = 'block';
            setTimeout(() => { eqContainer.style.opacity = '1'; }, 10);
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