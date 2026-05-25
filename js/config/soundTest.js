/*
 * PROJECT: VOID-CIRCUIT
 *
 * soundTest.js
 *
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
*/
import { ScenarioManager } from './../systems/scenario.js';

/**
 * SoundTestManager: 設定画面内のサウンドテスト（BGM/SE）ロジックを専門に管理
 */
export class SoundTestManager {
    constructor(sc) {
        this.sc = sc;
        this.soundTestIndex = 0;
        this.bgmTestIndex = 0;
        this.roomPresetIndex = 0;   // 📻【新設】空間プリセット用の選択インデックス
        this.isBGMPlaying = false;
        this.onIndexChanged = null; // UI側に更新を通知するコールバック
        this.peaks = new Array(32).fill(0);
    }

         /** 動的にサウンドリストを構築 */
        async buildDynamicSoundTestList() {
            const totalStages = 7; 
            const metaPromises = [];
            const base = this.sc.assetBase || "";

            // ✨ その場で ScenarioManager を生成して使い捨てる
            const scenario = new ScenarioManager();

            // 1. STAGE-1 から 7 までのメタデータ（BGM名など）を非同期で一斉に取得
            for (let i = 1; i <= totalStages; i++) {
                metaPromises.push(scenario.peekStageMeta(i, base));
            }

            const results = await Promise.all(metaPromises); 
            
            // 2. 取得できたデータから、BGMが設定されているものだけを抽出してリスト化
            const validBgmList = results
                .map((meta, index) => ({ meta, stageNum: index + 1 })) // 💡 元のループ順からステージ番号を紐付け
                .filter(item => item.meta && item.meta.bgm)
                .map(item => ({
                    stageNumber: item.stageNum, // 💡 ここでステージ番号を明示的に保持！
                    fileName: item.meta.bgm,
                    displayName: `${item.meta.name}`
                }));

            if (validBgmList.length === 0) {
                console.warn("[SoundTest] WARNING: No stage YAMLs returned valid BGM data.");
                return;
            }

            // 3. 抽出したBGMファイルをその場で一括して「同期ロード」
            if (!this.sc.audio) {
                console.error("[SoundTest] ERROR: Audio manager (this.sc.audio) is missing!");
                return;
            }

            try {
                // Promise.all で全曲のロードを並列で走らせ、すべて完了するのを待つ
                const loadPromises = validBgmList.map(bgm => this.sc.audio.loadStageBGM(bgm.fileName));
                await Promise.all(loadPromises);
            } catch (error) {
                console.error("[SoundTest] CRITICAL: One or more files failed to load via loadStageBGM:", error);
            }

            // 4. オーディオマネージャー側に動的リストを認識させる
            this.sc.audio.setDynamicBGMList(validBgmList);            
            this.bgmList = validBgmList;
        }

    /** 補助メソッド：現在のステージ表記＋曲名を識別子として取得 */
    _getCurrentBgmName() {
        if (this.bgmList && this.bgmList[this.bgmTestIndex]) {
            const current = this.bgmList[this.bgmTestIndex];
            return `Stage-${current.stageNumber} [${current.fileName}]`;
        }
        return `Unknown_BGM_${this.bgmTestIndex}`;
    }

    /** SEの選択インデックスを変更 */
    changeSEIndex(isRight) {
        if (!this.sc.audio) return;
        const len = this.sc.audio.seCount;
        if (len > 0) {
            this.soundTestIndex = isRight ? (this.soundTestIndex + 1) % len : (this.soundTestIndex - 1 + len) % len;
        }
    }

    /** BGMの選択インデックスを変更 */
    changeBGMIndex(isRight) {
        if (!this.sc.audio) return;
        const len = this.sc.audio.bgmCount;
        if (len > 0) {
            this.bgmTestIndex = isRight ? (this.bgmTestIndex + 1) % len : (this.bgmTestIndex - 1 + len) % len;
            if (this.isBGMPlaying) {
                this.sc.audio.playBGMByIndex(this.bgmTestIndex);
                Analytics.logBgmTestPlay(this._getCurrentBgmName());
            }
        }
    }

    /** 📻【新設】空間アコースティックプリセットの選択インデックスを変更 */
    changeRoomPresetIndex(isRight) {
        if (!this.sc.audio) return;
        const len = this.sc.audio.roomPresetCount;
        if (len > 0) {
            this.roomPresetIndex = isRight ? (this.roomPresetIndex + 1) % len : (this.roomPresetIndex - 1 + len) % len;
            
            // オーディオマネージャー側のノードへリアルタイムに数値を注入
            this.sc.audio.setAudioRoomPreset(this.roomPresetIndex);
        }
    }

    /** SEの再生 */
    playSE() {
        if (this.sc.audio) {
            this.sc.audio.playSEByIndex(this.soundTestIndex);
        }
    }

    /** BGMの再生・停止をトグル制御 */
    toggleBGM(onToggleOnCallback) {
        if (!this.sc.audio) return;

        this.isBGMPlaying = !this.isBGMPlaying;

        if (this.isBGMPlaying) {
            this.sc.audio.playBGMByIndex(this.bgmTestIndex);
            Analytics.logBgmTestPlay(this._getCurrentBgmName());

            if (typeof onToggleOnCallback === 'function') {
                onToggleOnCallback(); // イコライザー表示用コールバック
            }
        } else {
            this.sc.audio.resetBGM();
        }
    }

    /** BGM終了時の自動次曲遷移リスナーを設定 */
    setupAudioEndedListener(isModeActive) {
        if (!this.sc.audio) return;        
        this.sc.audio.resetBGM();
        this.sc.audio.onBGMEnded = () => {
            // 設定画面が閉じている、または再生停止中なら何もしない
            if (!isModeActive || !this.isBGMPlaying) return;
            this.playNextBGMAutomated();
        };
    }

    /** 自動で次の曲へ移行 */
    playNextBGMAutomated() {
        if (!this.sc.audio) return;
        const len = this.sc.audio.bgmCount;
        if (len <= 0) return;

        this.bgmTestIndex = (this.bgmTestIndex + 1) % len;
        this.isBGMPlaying = true;
        this.sc.audio.playBGMByIndex(this.bgmTestIndex);
        Analytics.logBgmTestPlay(this._getCurrentBgmName());

        // UI側に「曲が変わったから描画更新して！」と通知
        if (typeof this.onIndexChanged === 'function') {
            this.onIndexChanged();
        }
    }

    /** 状態の強制リセット */
    stopAndReset() {
        if (this.sc.audio) {
            this.sc.audio.resetBGM();
            if (this.sc.audio.bgmNode) {
                this.sc.audio.bgmNode.onended = null;
            }
        }
        this.isBGMPlaying = false;
        this.peaks.fill(0);
    }

    /** EQ（Low/Mid/High）のゲイン値をリアルタイムに変更 */
    changeEQGain(setting, isRight) {
        if (!this.sc.audio) return;

        const step = isRight ? 1 : -1;
        const targetBand = setting.replace('eq_', ''); // 'low', 'mid', 'high' を抽出

        // オーディオマネージャーから現在の値を取得して計算
        const currentVal = this.sc.audio.eqSettings[targetBand];
        const newVal = Math.max(-10, Math.min(15, currentVal + step));

        // 値を反映
        this.sc.audio.setEQGain(targetBand, newVal);
    }

    /** イコライザーの描画ロジック（0 dB基準・空間エフェクト連動強化版） */
    drawEqualizer(ctx, x, y, currentSetting) {
        if (!this.sc.audio || !this.sc.audio.getByteFrequencyData) return;

        const rawData = this.sc.audio.getByteFrequencyData();
        if (!rawData) return;

        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        const targetIndices = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        const activeCount = targetIndices.length; 
        const canvasWidth = ctx.canvas.width;
        const maxHeight = ctx.canvas.height;
        const barGap = 4; 
        const barWidth = (canvasWidth - (barGap * (activeCount - 1))) / activeCount;

        // --- 🎛️ EQゲイン値の取得 ---
        const eqSettings = this.sc.audio.eqSettings || { low: 0, mid: 0, high: 0 };
        
        // 🚀 0 dBを基準とし、マイナスは0にカット（0 ～ 15 の純粋なブースト量を見る）
        const lowBoost  = Math.max(0, eqSettings.low);  // 0 ～ 15
        const midBoost  = Math.max(0, eqSettings.mid);  // 0 ～ 15
        const highBoost = Math.max(0, eqSettings.high); // 0 ～ 15

        // 1. 【色相 (Hue)】の決定（0 dB基準の純色ブレンド）
        let currentHue = 130; // 基準は完璧な「緑 (130)」
        const totalBoost = lowBoost + midBoost + highBoost;

        if (totalBoost > 0) {
            // 各色の純粋な目標値（オレンジ=20、緑=130、水色=195）
            const targetHue = ((lowBoost * 20) + (midBoost * 130) + (highBoost * 195)) / totalBoost;
            
            // ブーストの最大値を使って、中間色（緑）を吹き飛ばすキレ味を加算
            const maxBoost = Math.max(lowBoost, midBoost, highBoost);
            const shiftRatio = Math.pow(maxBoost / 15, 0.5); // 0.5乗でさらに急激に変化
            
            // 完全にその色が主役なら、ターゲットの色へ強力に固定
            currentHue = 130 * (1 - shiftRatio) + targetHue * shiftRatio;
        }

        // 2. 【彩度・輝度】の決定
        const lfFull = Math.max(0, eqSettings.low + 10);
        const mfFull = Math.max(0, eqSettings.mid + 10);
        const hfFull = Math.max(0, eqSettings.high + 10);
        const maxFullFactor = Math.max(lfFull, mfFull, hfFull); // 0 ～ 25

        // 彩度（ビビッドさ）：ツマミを上げるほど純色に近づく
        const currentSaturation = 75 + (maxFullFactor / 25) * 25; // 75% ～ 100%

        // 📻【アップデート】現在のオーディオ部屋（空間エフェクト）の残響の深さに応じて、液晶のベース輝度を底上げする
        let fxLightnessBonus = 0;
        if (this.sc.audio.ROOM_PRESETS && this.sc.audio.ROOM_PRESETS[this.roomPresetIndex]) {
            const p = this.sc.audio.ROOM_PRESETS[this.roomPresetIndex];
            // リバーブやエコーの深さに比例して最大12%の明るさボーナスを加算（空間の「空気の濃さ」を視覚化）
            fxLightnessBonus = Math.max(p.reverbWet, p.echoWet) * 12;
        }

        // 輝度（明るさ）：絞ると暗く、盛ると眩しく、エフェクトがかかると空間がブワッと光る
        const baseLightness = 30 + (maxFullFactor / 25) * 40; // 30% ～ 70%
        const currentLightness = Math.min(82, baseLightness + fxLightnessBonus); // 眩しすぎないよう82%でキャップ

        // 全バーで共通して使うスタイルを設定
        const barStyle = `hsl(${Math.floor(currentHue)}, ${Math.floor(currentSaturation)}%, ${Math.floor(currentLightness)}%)`;

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

            // 🎨 磨き上げられた純色統一カラーで塗りつぶし
            ctx.fillStyle = barStyle;

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
}