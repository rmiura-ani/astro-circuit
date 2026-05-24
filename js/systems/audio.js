/*
 * PROJECT: VOID-CIRCUIT
 *
 * audio.js
 * * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
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

        // 🔊 【新設】マスターボリュームの％管理 (0.0 〜 1.0)
        this.seVolume = 0.8;   // デフォルト 80%
        this.bgmVolume = 0.7;  // デフォルト 70%

        // BGMテスト用の再生終了時コールバックを保持するプロパティ
        this.onBGMEnded = null;

        // 🎛️ EQの設定値をAudioManager自身で一元管理
        this.eqSettings = {
            low: 0,
            mid: 0,
            high: 0
        };

        // 🏛️ 空間アコースティックプリセットの定義
        this.ROOM_PRESETS = {
            0: { name: "1.NORMAL",  delayTime: 0.0,  feedback: 0.0, reverbWet: 0.0, echoWet: 0.0, desc: "DRY SOUND" },
            1: { name: "2.CP-01 ", delayTime: 0.03, feedback: 0.35, reverbWet: 0.3, echoWet: 0.15, desc: "METALLIC SHORT ECHO" },
            2: { name: "3.GALAXY",   delayTime: 0.4,  feedback: 0.4, reverbWet: 0.0, echoWet: 0.35, desc: "DEEP SPACE DELAY" },
            3: { name: "4.IND-ST", delayTime: 0.22,  feedback: 0.3, reverbWet: 0.35, echoWet: 0.25, desc: "HEAVY INDUSTRIAL REVERB" }
        };
        this.currentPresetId = 0; // デフォルトは NORMAL

        // 起動時は空っぽにしておく
        this.DYNAMIC_BGM_LIST = []; 
        this.CONFIG = {
            SE: {
                shot:      { file: 'shot.ogg',       vol: 0.3 },
                changeWp:  { file: 'changeWp.ogg',   vol: 0.8 },
                explosion: { file: 'explosion.ogg',  vol: 0.3 },
                hitSound:  { file: 'hitHurt.ogg',    vol: 0.5 },
                powerUp:   { file: 'powerUp.ogg',    vol: 0.7 },                
            }
        };
        this.seKeys = Object.keys(this.CONFIG.SE);
        
        this.audioCtx = null;
        this.analyser = null;

        // EQ ノード
        this.eqLow = null;
        this.eqMid = null;
        this.eqHigh = null;

        // 🎛️ エフェクト（DSP）ノード群
        this.dryNode = null;       // 原音用ゲイン
        this.echoNode = null;      // エコー（ディレイ）ノード
        this.echoFeedback = null;  // エコーの跳ね返り量ゲイン
        this.echoWetNode = null;   // エコーの出力ブレンドゲイン
        this.reverbNodes = [];     // 疑似残響を作るためのマルチタップディレイ配列
        this.reverbWetNode = null; // リバーブの出力ブレンドゲイン
        
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

    /** 🔄 【新設】SEマスター音量の変更メソッド (Configから叩かれる) */
    setSEVolume(volume) {
        this.seVolume = volume;
        // 既存のベースSE音源すべての実音量を【掛け算】で再計算して適用
        this.seKeys.forEach(key => {
            if (this.sounds[key]) {
                const baseVol = this.CONFIG.SE[key].vol;
                this.sounds[key].volume = baseVol * this.seVolume;
            }
        });
        console.log(`[Audio] Master SE Volume -> ${Math.round(volume * 100)}%`);
    }

    /** 🔄 【新設】BGMマスター音量の変更メソッド (Configから叩かれる) */
    setBGMVolume(volume) {
        this.bgmVolume = volume;
        // 現在流れているBGMがあれば、即座に【掛け算】して反映
        if (this.currentBgm) {
            this.currentBgm.volume = 0.7 * this.bgmVolume; // ベースボリューム0.7に掛け算
        }
        console.log(`[Audio] Master BGM Volume -> ${Math.round(volume * 100)}%`);
    }

    /** SE初期化 */
    initAudio() {
        this.seKeys.forEach(key => {
            const conf = this.CONFIG.SE[key];
            const audio = new Audio(this.basePath + conf.file);
            audio.crossOrigin = "anonymous";
            // 🌟 初期化時にも【マスター音量 × 固有音量】を掛け算してセット
            audio.volume = conf.vol * this.seVolume;
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
            // 🌟 ロード時も【ベース 0.7 × マスター音量】を掛け算
            audio.volume = 0.7 * this.bgmVolume;

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

        // 同じ曲が既に流れている場合は何もしない
        if (this.currentBgmFileName === fileName && this.currentBgm && !this.currentBgm.paused) {
            return;
        }

        this.resetBGM(); // 既存のBGMを完全停止

        this.currentBgm = this.bgms[fileName];
        this.currentBgmFileName = fileName;

        if (this.currentBgm) {
            this.currentBgm.currentTime = 0; // 再生直前に確実に頭出しを行う
            // 🌟 再生開始時も【ベース 0.7 × マスター音量】を掛け算
            this.currentBgm.volume = 0.7 * this.bgmVolume;
            
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
            
            // イコライザー(EQ)フィルター群
            this.eqLow = this.audioCtx.createBiquadFilter();
            this.eqLow.type = 'lowshelf';
            this.eqLow.frequency.value = 200; // 200Hz以下

            this.eqMid = this.audioCtx.createBiquadFilter();
            this.eqMid.type = 'peaking';
            this.eqMid.frequency.value = 1000; // 1kHzを中心
            this.eqMid.Q.value = 1.0;          // 帯域の鋭さ

            this.eqHigh = this.audioCtx.createBiquadFilter();
            this.eqHigh.type = 'highshelf';
            this.eqHigh.frequency.value = 5000; // 5kHz以上

            // 🎛️ エフェクト（空間音響）ノードの構築
            this.dryNode = this.audioCtx.createGain();
            this.dryNode.gain.value = 1.0;

            // エコーノード群
            this.echoNode = this.audioCtx.createDelay(2.0); // 最大ディレイタイム 2秒
            this.echoFeedback = this.audioCtx.createGain();
            this.echoWetNode = this.audioCtx.createGain();
            
            // エコー内の内部ループ配線
            this.echoNode.connect(this.echoFeedback);
            this.echoFeedback.connect(this.echoNode);
            this.echoNode.connect(this.echoWetNode);

            // リバーブノード群（軽量マルチタップ・ディレイ・アレイ）
            this.reverbWetNode = this.audioCtx.createGain();
            const delayTimes = [0.011, 0.015, 0.023, 0.037, 0.043, 0.059]; // 素数で散らして濃密な残響を作る
            this.reverbNodes = delayTimes.map(t => {
                const d = this.audioCtx.createDelay();
                d.delayTime.value = t;
                const g = this.audioCtx.createGain();
                g.gain.value = 0.65; // 反射の減衰
                
                // ループを作って跳ね返らせる
                d.connect(g);
                g.connect(d);
                g.connect(this.reverbWetNode);
                return d;
            });
        }

        const now = this.audioCtx.currentTime;

        // 新しい曲がブリッジされるたび、記憶しているEQ設定値を即座に再注入する
        if (this.eqLow)  this.eqLow.gain.setValueAtTime(this.eqSettings.low, now);
        if (this.eqMid)  this.eqMid.gain.setValueAtTime(this.eqSettings.mid, now);
        if (this.eqHigh) this.eqHigh.gain.setValueAtTime(this.eqSettings.high, now);

        // 🏛️ 現在選択されている空間プリセットのエフェクト値を再注入
        this.applyRoomPresetValues(now);

        // ブラウザの自動再生ガードをすり抜ける保険
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }

        // 2. このAudio要素用の「仲介ノード」が未生成なら作る（二重生成エラー防止策）
        if (!this.mediaSources.has(audioElement)) {
            const sourceNode = this.audioCtx.createMediaElementSource(audioElement);
            sourceNode.disconnect();

            // 【配線ルート】
            // [Source] -> [EQ Low->Mid->High] -> [分岐点]
            sourceNode.connect(this.eqLow);
            this.eqLow.connect(this.eqMid);
            this.eqMid.connect(this.eqHigh);

            // 分岐点からエフェクトへ
            // 1. ドライ（直進音ルート）
            this.eqHigh.connect(this.dryNode);
            this.dryNode.connect(this.analyser);

            // 2. エコー（ディレイ成分ルート）
            this.eqHigh.connect(this.echoNode);
            this.echoWetNode.connect(this.analyser);

            // 3. リバーブ（残響成分ルート）
            this.reverbNodes.forEach(dNode => {
                this.eqHigh.connect(dNode);
            });
            this.reverbWetNode.connect(this.analyser);

            // 最終集約：[Analyser] -> [スピーカー(destination)]
            this.analyser.connect(this.audioCtx.destination);
            
            // キャッシュに保存して再利用
            this.mediaSources.set(audioElement, sourceNode);
        }
    }

    /** 記憶しているプリセットの内部数値を物理ノードに流し込む */
    applyRoomPresetValues(time) {
        if (!this.audioCtx) return;
        const p = this.ROOM_PRESETS[this.currentPresetId];
        if (!p) return;

        // エコーパラメータ反映
        this.echoNode.delayTime.setValueAtTime(p.delayTime, time);
        this.echoFeedback.gain.setValueAtTime(p.feedback, time);
        this.echoWetNode.gain.setValueAtTime(p.echoWet, time);

        // リバーブパラメータ反映
        this.reverbWetNode.gain.setValueAtTime(p.reverbWet, time);

        // 原音（Dry）のバランス調整（残響が深いときは原音をわずかに下げて包囲感を出す）
        const dryVol = p.reverbWet > 0.5 ? 0.8 : 1.0;
        this.dryNode.gain.setValueAtTime(dryVol, time);
    }

    /**
     * 空間アコースティックプリセットを切り替える
     * @param {number} presetId - 0: NORMAL, 1: COCKPIT, 2: SPACE, 3: FACTORY
     */
    setAudioRoomPreset(presetId) {
        if (this.ROOM_PRESETS[presetId] === undefined) return;
        this.currentPresetId = presetId;

        if (this.audioCtx) {
            const now = this.audioCtx.currentTime;
            this.applyRoomPresetValues(now);
        }
        console.log(`[Audio] Room Preset Changed -> ${this.ROOM_PRESETS[presetId].name}`);
    }

    /** 3バンドEQのゲインを変更 */
    setEQGain(band, value) {
        if (!this.audioCtx) return;
        
        if (this.eqSettings[band] !== undefined) {
            this.eqSettings[band] = value;
        }
        
        const now = this.audioCtx.currentTime;
        if (band === 'low' && this.eqLow) {
            this.eqLow.gain.setValueAtTime(value, now);
        } else if (band === 'mid' && this.eqMid) {
            this.eqMid.gain.setValueAtTime(value, now);
        } else if (band === 'high' && this.eqHigh) {
            this.eqHigh.gain.setValueAtTime(value, now);
        }
    }

    /** BGMリセット */
    resetBGM() {
        if (this.fadeInterval) {
            clearInterval(this.fadeInterval);
            this.fadeInterval = null;
        }
        Object.values(this.bgms).forEach(b => {
            b.pause();
            b.volume = 0.7 * this.bgmVolume; // 🌟 リセット時も掛け算の状態を維持
            b.onended = null;
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
            const clone = baseAudio.cloneNode(true);
            // 🌟 クローン再生する際も、現在の掛け算済みの最新音量をそのまま引き継ぐ
            clone.volume = baseAudio.volume;
            clone.play().catch(() => {});
            
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
    get roomPresetCount() { return Object.keys(this.ROOM_PRESETS).length; } 
    
    getBGMName(idx) { return this.DYNAMIC_BGM_LIST[idx]?.displayName.toUpperCase() || "NONE"; }
    getSEName(idx) { return this.seKeys[idx]?.toUpperCase() || "NONE"; }
    getRoomPresetName(idx) { return this.ROOM_PRESETS[idx]?.name || "UNKNOWN"; } 
    
    async playBGMByIndex(idx) {
        const bgmData = this.DYNAMIC_BGM_LIST[idx];
        if (!bgmData) return;
        const fileName = bgmData.fileName;
        
        await this.loadStageBGM(fileName);
        
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