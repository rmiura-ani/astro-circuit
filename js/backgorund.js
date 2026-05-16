/*
 * PROJECT: VOID-CIRCUIT
 *
 * background.js
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */

class BackgroundManager {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.color = "#000000";
        this.stageNum = 1;
        
        // STAGE-1 用の星
        this.stars = this.initStars(50);
        
        // 演出用のタイマーや一時的な数値
        this.pulsePhase = 0; 
    }

    initStars(count) {
        let stars = [];
        for (let i = 0; i < count; i++) {
            stars.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                speed: Math.random() * 2 + 0.5, // 多重スクロール用
                size: Math.random() * 2
            });
        }
        return stars;
    }

    /**
     * ステージ開始時に呼ばれるセットアップ
     */
    setup(color, stageNum) {
        this.color = color;
        this.stageNum = stageNum;
        this.pulsePhase = 0; // タイマーリセット
    }

    update(frame) {
        // 全ステージ共通：星を流す（STAGE-1の3層スクロールを意識）
        this.stars.forEach(s => {
            s.y += s.speed;
            if (s.y > this.height) {
                s.y = -10;
                s.x = Math.random() * this.width;
            }
        });

        // STAGE-5: Planetary Pulse 用の計算
        if (this.stageNum === 5) {
            this.pulsePhase = Math.sin(frame * 0.05) * 0.2 + 0.8; // 呼吸するような変化
        }
    }

    draw(ctx) {
        // 1. 背景色の塗りつぶし
        if (this.stageNum === 5) {
            // STAGE-5: バイオレット背景のパルス演出
            ctx.fillStyle = `rgba(232, 223, 245, ${this.pulsePhase})`; // #E8DFF5ベース
            ctx.fillRect(0, 0, this.width, this.height);
        } else {
            ctx.fillStyle = this.color;
            ctx.fillRect(0, 0, this.width, this.height);
        }

        // 2. 星流（Starfield）の描画
        ctx.fillStyle = "#FFF";
        this.stars.forEach(s => {
            // 遠い星ほど暗く（擬似的な奥行き）
            const alpha = s.speed / 2.5;
            ctx.globalAlpha = alpha;
            ctx.fillRect(s.x, s.y, s.size, s.size);
        });
        ctx.globalAlpha = 1.0;

        // 3. 特殊演出（STAGE-4: 砂塵など）
        if (this.stageNum === 4) {
            this.drawSandHaze(ctx);
        }
    }

    drawSandHaze(ctx) {
        // ここにラスタスクロール的な砂塵のドット演出を記述
    }
}