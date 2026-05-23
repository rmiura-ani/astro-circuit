/*
 * PROJECT: VOID-CIRCUIT
 *
 * audio.js
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 *
 * [Modified] 2026: Added 'onBGMEnded' callback hook and non-loop toggles for Sound Test.
 */

/**
 * AudioManager: サウンドライフサイクル管理
 */
class AudioManager {
    constructor(basePath) {
        this.basePath = basePath;
        this.currentBgm = null;
        this.currentBgmFileName = "";
        this.fadeInterval = null;
        this.bgms = {};
        this.sounds = {};

        // BGMテスト用の再生終了時コールバックを保持するプロパティ
        this.onBGMEnded = null;

        // 起動時は空っぽにしておく
        this.DYNAMIC_BGM_LIST = []; 
        this.CONFIG = {
            SE: {
                shot:      { file: 'shot.ogg',      vol: 0.3 },
                changeWp:  { file: 'changeWp.ogg',  vol: 0.8 },
                explosion: { file: 'explosion.ogg', vol: 0.3 },
                hitSound:  { file: 'hitHurt.ogg',   vol: 0.5 },
                powerUp:   { file: 'powerUp.ogg',   vol: 0.7 },                
            }
        };
        this.seKeys = Object.keys(this.CONFIG.SE);
        
        this.audioCtx = null;
        this.analyser = null;
        this.mediaSources = new Map(); // 各Audio要素とSourceNodeの紐付けキャッシュ

        // 例: keyが 'shot' なら、this.playShot という関数を自動で生み出す
        Object.keys(this.CONFIG.SE).forEach(key => {
            const methodName = 'play' + key.charAt(0).toUpperCase() + key.slice(1);
            this[methodName] = () => this._playSE(key);
        });
    }

    /** Controllerから動的に構築されたBGMリストを受け取る */
    setDynamicBGMList(list) {
        this.DYNAMIC_BGM_LIST = list; 
    }

    /** SE初期化 */
    initAudio() {
        this.seKeys.forEach(key => {
            const conf = this.CONFIG.SE[key];
            const audio = new Audio(this.basePath + conf.file);
            audio.crossOrigin = "anonymous";
            audio.volume = conf.vol;
            this.sounds[key] = audio;
        });
    }
    
    /** 起動時のSEプリロード */
    async preloadAll() {
        const loadAud = (a) => new Promise(r => {
            if (!a || a.readyState >= 3) return r();
            a.addEventListener('canplaythrough', r, { once: true });
            a.addEventListener('error', () => r(), { once: true });
            a.load();
            setTimeout(r, 3000);
        });
        await Promise.all([
            ...Object.values(this.sounds).map(loadAud)
        ]);
        console.log("[Audio] System SE Preload complete.");
    }

    /** ステージ開始時に呼ばれる、特定のBGMの動的ロード */
    async loadStageBGM(fileName) {
        if (!fileName) return null;
        
        // すでに一度読み込んだことがあるBGMならキャッシュを返す
        if (this.bgms[fileName]) {
            return this.bgms[fileName];
        }
        
        return new Promise((resolve) => {
            const audio = new Audio(this.basePath + fileName);
            audio.crossOrigin = "anonymous";
            audio.loop = true; // ゲーム本編は標準でループ再生
            audio.volume = 0.7;

            let isResolved = false;

            // 読み込み完了を待つ
            audio.addEventListener('canplaythrough', () => {
                if (isResolved) return;
                isResolved = true;
                this.bgms[fileName] = audio; // キャッシュに保存
                resolve(audio);
            }, { once: true });

            audio.addEventListener('error', () => {
                if (isResolved) return;
                isResolved = true;
                console.error(`[Audio] Failed to load BGM: ${fileName}`);
                resolve(null);
            }, { once: true });

            audio.load();

            setTimeout(() => {
                if (isResolved) return;
                isResolved = true;
                console.warn(`[Audio] BGM load timeout: ${fileName}`);
                resolve(null);
            }, 5000);
        });
    }

    /** BGMの再生（ファイル名指定） */
    playBGM(fileName) {
        if (!fileName) return;

        // 同じ曲が既に流れている場合は何もしない（ボス戦後のループ時などのため）
        if (this.currentBgmFileName === fileName && this.currentBgm && !this.currentBgm.paused) {
            return;
        }

        this.resetBGM(); // 既存のBGMを完全停止

        this.currentBgm = this.bgms[fileName];
        this.currentBgmFileName = fileName;

        if (this.currentBgm) {
            this.currentBgm.currentTime = 0; // 再生直前に確実に頭出しを行う
            this.currentBgm.volume = 0.7;
            
            // Audioタグの音声を Web Audio API の解析土管へバイパス接続する
            this.setupAnalyserBridge(this.currentBgm);

            // 曲の再生が終了した時のイベントハンドラを設定
            this.currentBgm.onended = () => {
                console.log(`[Audio] BGM ended: ${this.currentBgmFileName}`);
                if (typeof this.onBGMEnded === 'function') {
                    this.onBGMEnded();
                }
            };

            this.currentBgm.play().catch(e => console.warn("Autoplay blocked or audio not ready", e));
        } else {
            console.warn(`[Audio] BGM "${fileName}" is not loaded yet. Call loadStageBGM first.`);
        }
    }

    /** Audio要素をWeb Audio APIのアナライザーノードへブリッジする */
    setupAnalyserBridge(audioElement) {
        // 1. 司令塔(AudioContext)がまだなければ生成
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioCtx.createAnalyser();
            this.analyser.fftSize = 64; // 32本のスペクトラムバー用
        }

        // ブラウザの自動再生ガードをすり抜ける保険
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }

        // 2. このAudio要素用の「仲介ノード」が未生成なら作る（二重生成エラー防止策）
        if (!this.mediaSources.has(audioElement)) {
            const sourceNode = this.audioCtx.createMediaElementSource(audioElement);
            
            // 【重要】Audioタグ ➔ アナライザー ➔ スピーカー(destination) の順に直列繋ぎ
            sourceNode.connect(this.analyser);
            this.analyser.connect(this.audioCtx.destination);
            
            // キャッシュに保存して再利用
            this.mediaSources.set(audioElement, sourceNode);
        }
    }

    /** BGMリセット */
    resetBGM() {
        if (this.fadeInterval) {
            clearInterval(this.fadeInterval);
            this.fadeInterval = null;
        }
        // 動的にロードされた全BGMを安全に停止
        Object.values(this.bgms).forEach(b => {
            b.pause();
            b.volume = 0.7;
            b.onended = null; // リスナーの重複・漏れ防止のクリーンアップ
        });
        this.currentBgm = null;
        this.currentBgmFileName = "";
    }

    /** BGMフェードアウト */
    fadeOutBGM(duration = 2000) {
        if (!this.currentBgm || this.fadeInterval) return;

        const target = this.currentBgm;
        const intervalTime = 50;
        const steps = duration / intervalTime;
        const volStep = target.volume / steps;

        this.fadeInterval = setInterval(() => {
            if (target.volume > volStep) {
                target.volume -= volStep;
            } else {
                target.volume = 0;
                target.pause();
                target.onended = null;
                clearInterval(this.fadeInterval);
                this.fadeInterval = null;
            }
        }, intervalTime);
    }

    _playSE(key) {
        const baseAudio = this.sounds[key];
        if (baseAudio) {
            // 元のAudioオブジェクトを複製（クローン）して同時発音数を無限化する
            const clone = baseAudio.cloneNode(true);
            clone.volume = baseAudio.volume; // 音量を引き継ぐ
            clone.play().catch(() => {});
            
            // 再生終了後にメモリから解放されるようにする
            clone.addEventListener('ended', () => {
                clone.pause();
                clone.src = "";
                clone.remove();
            }, { once: true });
        }
    }

    // Sound Test Helpers
    get bgmCount() { return this.DYNAMIC_BGM_LIST.length; }
    get seCount() { return this.seKeys.length; }
    getBGMName(idx) { return this.DYNAMIC_BGM_LIST[idx]?.displayName.toUpperCase() || "NONE"; }
    getSEName(idx) { return this.seKeys[idx]?.toUpperCase() || "NONE"; }
    
    async playBGMByIndex(idx) {
        const bgmData = this.DYNAMIC_BGM_LIST[idx];
        if (!bgmData) return;
        const fileName = bgmData.fileName;
        
        await this.loadStageBGM(fileName);
        
        // サウンドテストの時は自動移行させたいので、一時的に個別ループをOFFにする
        if (this.bgms[fileName]) {
            this.bgms[fileName].loop = false;
        }
        
        this.playBGM(fileName);
    }
    
    getByteFrequencyData() {
        if (!this.analyser) return null;
        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(dataArray);
        return dataArray;
    }
    
    playSEByIndex(idx) { this._playSE(this.seKeys[idx]); }
}