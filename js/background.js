/*
 * PROJECT: VOID-CIRCUIT
 *
 * background.js
 *
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */
"use strict";

// ==========================================
// 1. 各ステージ背景の基底（ベース）クラス
// ==========================================
class StageBackground {
    constructor(width, height, color) {
        this.width = width;
        this.height = height;
        this.color = color;
        this.frameTimer = 0;
        this.stars = this.initStars(60); // デフォルトの星
    }

    initStars(count) {
        let stars = [];
        for (let i = 0; i < count; i++) {
            stars.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                speed: Math.random() * 2.0 + 0.5, 
                size: Math.random() * 1.5
            });
        }
        return stars;
    }

    updateStars(starsArray = this.stars) {
        starsArray.forEach(s => {
            s.y += s.speed;
            if (s.y > this.height) {
                s.y = -10;
                s.x = Math.random() * this.width;
            }
        });
    }

    drawStars(ctx, starsArray = this.stars, maxAlpha = 0.4) {
        ctx.fillStyle = "#FFFFFF";
        starsArray.forEach(s => {
            const alpha = (s.speed / 2.5) * maxAlpha;
            ctx.globalAlpha = alpha;
            ctx.fillRect(s.x, s.y, s.size, s.size);
        });
        ctx.globalAlpha = 1.0;
    }

    update(frame) {
        this.frameTimer = frame;
        this.updateStars();
    }

    drawBaseGradient(ctx, topColor, bottomColor) {
        const grad = ctx.createLinearGradient(0, 0, 0, this.height);
        grad.addColorStop(0, topColor);    
        grad.addColorStop(1, bottomColor); 
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, this.width, this.height);
    }
}

// ==========================================
// 2. 各ステージ固有の派生（継承）クラス
// ==========================================

// --- STAGE-1: Iron Vein ---
class Stage1Background extends StageBackground {
    constructor(width, height) {
        super(width, height, "#000000");
        this.stage1Stars = this.initStars(120);
        this.stage1Stars.forEach((s, idx) => {
            if (idx % 3 === 0) {
                s.speed = Math.random() * 3.5 + 2.0; 
                s.size = Math.random() * 1.5 + 1.5;   
            }
        });
    }

    update(frame) {
        this.frameTimer = frame;
        this.updateStars(this.stage1Stars); 
    }

    draw(ctx) {
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, this.width, this.height);
        this.drawStars(ctx, this.stage1Stars, 0.6);
    }
}

// --- STAGE-2: Emerald Aqua ---
class Stage2Background extends StageBackground {
    constructor(width, height) {
        super(width, height, "#D0F0F0");
        this.ripples = [];
        this.glitters = []; 
        this.aquaStars = this.initStars(50);
        this.aquaStars.forEach(s => {
            s.speed = Math.random() * 2.5 + 1.5; 
        });
        
        for(let i=0; i<12; i++) {
            this.glitters.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                size: Math.random() * 2 + 2,
                speed: Math.random() * 0.2 + 0.1,
                phase: Math.random() * Math.PI
            });
        }
    }

    update(frame) {
        this.frameTimer = frame;
        this.updateStars(this.aquaStars);

        this.glitters.forEach(g => {
            g.y -= g.speed;
            g.phase += 0.04;
            if (g.y < -10) {
                g.y = this.height + 10;
                g.x = Math.random() * this.width;
            }
        });

        if (frame % 20 === 0) {
            this.ripples.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                radius: 1,
                maxRadius: Math.random() * 40 + 20,
                alpha: 0.4
            });
        }
        this.ripples.forEach((r, idx) => {
            r.radius += 0.5;
            r.alpha = 0.4 * (1.0 - (r.radius / r.maxRadius));
            if (r.alpha <= 0) this.ripples.splice(idx, 1);
        });
    }

    draw(ctx) {
        this.drawBaseGradient(ctx, "#0B1D20", "#6A9A9A");
        this.drawStars(ctx, this.aquaStars, 0.4);

        this.glitters.forEach(g => {
            const alpha = Math.abs(Math.sin(g.phase)) * 0.25;
            ctx.fillStyle = `rgba(210, 255, 255, ${alpha})`;
            ctx.fillRect(g.x, g.y, g.size, g.size);
        });

        ctx.strokeStyle = "rgba(180, 240, 240, 0.25)";
        ctx.lineWidth = 1;
        this.ripples.forEach(r => {
            ctx.globalAlpha = r.alpha;
            ctx.beginPath();
            ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
            ctx.stroke();
        });
        ctx.globalAlpha = 1.0;
    }
}

// --- STAGE-3: Cloud Palace ---
class Stage3Background extends StageBackground {
    constructor(width, height) {
        super(width, height, "#FFF5E1");
        this.cloudTiles = [];
        for (let i = 0; i < 10; i++) {
            this.cloudTiles.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                speed: Math.random() * 4 + 3,
                size: Math.random() * 20 + 10
            });
        }
    }

    update(frame) {
        super.update(frame);
        this.cloudTiles.forEach(c => {
            c.y += c.speed;
            if (c.y > this.height) {
                c.y = -30;
                c.x = Math.random() * this.width;
            }
        });
    }

    draw(ctx) {
        this.drawBaseGradient(ctx, "#211A10", "#C6B79B");
        this.drawStars(ctx);
        
        ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
        this.cloudTiles.forEach(c => {
            ctx.fillRect(c.x, c.y, c.size, c.size * 0.5);
        });
    }
}

// --- STAGE-4: Ancient Logic ---
class Stage4Background extends StageBackground {
    constructor(width, height) {
        super(width, height, "#F5E6D3");
        this.hazeOffset = 0;
        this.wallScrollY = 0;
    }

    update(frame) {
        super.update(frame);
        this.hazeOffset += 0.05;
        this.wallScrollY += 8;
    }

    draw(ctx) {
        this.drawBaseGradient(ctx, "#211B12", "#93836C");

        ctx.fillStyle = "rgba(210, 180, 140, 0.06)";
        for (let y = 0; y < this.height; y += 2) {
            const xOffset = Math.sin(y * 0.03 + this.hazeOffset) * 12;
            ctx.fillRect(xOffset, y, this.width, 1);
        }

        const wallWidth = 12;
        ctx.fillStyle = "rgba(45, 38, 28, 0.4)"; 
        ctx.fillRect(0, 0, wallWidth, this.height);
        ctx.fillRect(this.width - wallWidth, 0, wallWidth, this.height);

        ctx.fillStyle = "rgba(147, 131, 108, 0.3)"; 
        const step = 48; 
        const offsetY = this.wallScrollY % step;

        for (let y = -step; y < this.height + step; y += step) {
            const currentY = y + offsetY;
            ctx.fillRect(0, currentY, wallWidth - 4, 6);
            ctx.fillRect(0, currentY + 20, wallWidth - 8, 3);
            ctx.fillRect(this.width - wallWidth + 4, currentY, wallWidth - 4, 6);
            ctx.fillRect(this.width - wallWidth + 8, currentY + 20, wallWidth - 8, 3);
        }
    }
}

// --- STAGE-5: Planetary Pulse ---
class Stage5Background extends StageBackground {
    constructor(width, height) {
        super(width, height, "#E8DFF5");
        this.pulseAlpha = 0;
        this.pulseStars = this.initStars(80);
        this.pulseStars.forEach(s => {
            s.speed = Math.random() * 0.8 + 0.3; 
            s.size = Math.random() * 1.5;
        });
    }

    update(frame) {
        this.frameTimer = frame;
        this.updateStars(this.pulseStars);
        this.pulseAlpha = Math.sin(frame * 0.03) * 0.08 + 0.20;
    }

    draw(ctx) {
        this.drawBaseGradient(ctx, "#11071A", "#251433");
        ctx.fillStyle = `rgba(140, 100, 190, ${this.pulseAlpha})`;
        ctx.fillRect(0, 0, this.width, this.height);
        this.drawStars(ctx, this.pulseStars, 0.3);
    }
}

// --- STAGE-6: Burning Orbit ---
class Stage6Background extends StageBackground {
    constructor(width, height) {
        super(width, height, "#FFE0D0");
        this.warshipY = -300;
        this.orbitStars = this.initStars(90);
        this.orbitStars.forEach(s => {
            s.speed = Math.random() * 4.0 + 2.5; 
            s.size = Math.random() * 2.0 + 0.5;
        });
    }

    update(frame) {
        this.frameTimer = frame;
        this.warshipY += 0.4;
        if (this.warshipY > this.height) this.warshipY = -300;

        this.orbitStars.forEach(s => {
            s.y += s.speed;       
            s.x += s.speed * 0.4; 
            
            if (s.y > this.height || s.x > this.width) {
                s.y = -10;
                s.x = Math.random() * this.width - (this.width * 0.2); 
            }
        });
    }

    draw(ctx) {
        this.drawBaseGradient(ctx, "#0C0500", "#7F3010");
        this.drawStars(ctx, this.orbitStars, 0.5);

        ctx.fillStyle = "rgba(40, 20, 10, 0.2)";
        ctx.beginPath();
        ctx.moveTo(this.width * 0.1, this.warshipY);
        ctx.lineTo(this.width * 0.9, this.warshipY + 40);
        ctx.lineTo(this.width * 0.8, this.warshipY + 200);
        ctx.lineTo(this.width * 0.2, this.warshipY + 160);
        ctx.closePath();
        ctx.fill();
    }
}

// --- STAGE-7: Absolute Core（スクロール同期・完全消滅修正版） ---
class Stage7Background extends StageBackground {
    constructor(width, height) {
        super(width, height, "#202020");
        
        // 7面専用：中枢を漂う100機の高輝度ドット粒子
        this.coreStars = this.initStars(100);
        this.coreStars.forEach(s => {
            s.speed = Math.random() * 0.4 + 0.15; 
            s.size = Math.random() * 1.0 + 1.5;   // 最低サイズ1.5px保証
        });

        this.fortressScrollY = 0;
    }

    update(frame) {
        this.frameTimer = frame;
        this.updateStars(this.coreStars);
        this.fortressScrollY += 0.6; // 重厚な低速スクロール
    }

    draw(ctx) {
        // LAYER 1: 【最奥】宇宙要塞の深層グラデーション
        this.drawBaseGradient(ctx, "#0A0A0A", "#1C1C1C");
        
        // LAYER 2: 【奥】100%純白の高輝度な星流（電子のチリ）
        ctx.fillStyle = "#FFFFFF";
        this.coreStars.forEach(s => {
            ctx.globalAlpha = (s.speed / 0.55) * 0.5 + 0.4;
            ctx.fillRect(s.x, s.y, s.size, s.size);
        });
        ctx.globalAlpha = 1.0; 

        // LAYER 3: 【中】不透明な漆黒の要塞構造物シルエット（星を完全に遮蔽）
        this.drawFortressStructures(ctx);

        // LAYER 4: 【手前】サイバーグリッド線（最前面レイヤー）
        ctx.strokeStyle = "rgba(0, 180, 180, 0.12)"; 
        ctx.lineWidth = 0.5;

        const vanishX = this.width / 2;
        const vanishY = this.height / 2;

        for (let angle = 0; angle < Math.PI; angle += Math.PI / 6) {
            const x1 = vanishX + Math.cos(angle) * this.width;
            const y1 = vanishY + Math.sin(angle) * this.height;
            const x2 = vanishX - Math.cos(angle) * this.width;
            const y2 = vanishY - Math.sin(angle) * this.height;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }
    }

    // 不透明なソリッドカラーで、星を完全に遮る要塞構造を描画（境界値バグ完全修正版）
    drawFortressStructures(ctx) {
        const colorMain = "#040404";      
        const colorLine = "#121C1C";      
        const colorDetail = "rgba(0, 210, 210, 0.25)"; 

        ctx.fillStyle = colorMain; 
        ctx.strokeStyle = colorLine;
        ctx.lineWidth = 1;

        // 【バグ対策の核心】
        // 要塞全体の縦幅（マップの高さ）を 1000px と定義。
        // ループの総長さを「画面の高さ ＋ マップの高さ」にすることで、
        // すべての構造物が画面の一番下を完全に通り抜けて消えるまで、絶対にリセットが起きません。
        const mapHeight = 1000;
        const loopLength = this.height + mapHeight;
        const currentScroll = this.fortressScrollY % loopLength;

        // 巨大マップ全体の基準となるトップ座標（画面の上の隠れた位置からスタート）
        const mapTopY = -mapHeight + currentScroll;

        // ==================================================
        // レイヤーA: 画面左側（巨大隔壁パーツ / マップ内のY座標: 50px地点に配置）
        // ==================================================
        let yA = mapTopY + 50;
        if (yA < this.height && yA + 220 > 0) {
            ctx.fillStyle = colorMain; 
            ctx.fillRect(0, yA, 50, 220); 
            ctx.strokeRect(0, yA, 50, 220);

            // 装甲プレートの横スリット
            ctx.strokeStyle = "#0F1616";
            for (let l = 20; l < 220; l += 40) {
                ctx.beginPath();
                ctx.moveTo(0, yA + l); ctx.lineTo(50, yA + l);
                ctx.stroke();
            }
            
            // 突き出たメカパーツ＆大型トラス
            ctx.fillStyle = colorMain;
            ctx.fillRect(50, yA + 60, 15, 80);
            ctx.strokeStyle = colorLine;
            ctx.beginPath();
            ctx.moveTo(50, yA + 60); ctx.lineTo(75, yA + 80); ctx.lineTo(50, yA + 100);
            ctx.moveTo(50, yA + 100); ctx.lineTo(75, yA + 120); ctx.lineTo(50, yA + 140);
            ctx.stroke();
        }

        // ==================================================
        // レイヤーB: 画面中央奥（基盤を走るフラット配線ダクト）
        // ==================================================
        ctx.fillStyle = "#060606";
        ctx.fillRect(this.width * 0.35, 0, 30, this.height); 
        ctx.fillStyle = colorLine;
        ctx.fillRect(this.width * 0.38, 0, 1, this.height);  
        ctx.fillRect(this.width * 0.42, 0, 1, this.height);

        // ==================================================
        // レイヤーC: 画面右側（放熱フィンとインジケーターパネル / マップ内のY座標: 450px地点に配置）
        // ==================================================
        let yC = mapTopY + 450;
        if (yC < this.height && yC + 300 > 0) {
            ctx.fillStyle = colorMain;
            ctx.fillRect(this.width - 65, yC, 65, 300);
            ctx.strokeRect(this.width - 65, yC, 65, 300);

            // 放熱フィン（溝）
            ctx.fillStyle = "#0F1616";
            for (let f = 10; f < 120; f += 8) {
                ctx.fillRect(this.width - 60, yC + f, 25, 2); 
            }

            // 凸凹したトランスユニット
            ctx.fillStyle = colorMain;
            ctx.fillRect(this.width - 80, yC + 140, 15, 50);
            ctx.strokeRect(this.width - 80, yC + 140, 15, 50);
            ctx.fillRect(this.width - 75, yC + 200, 10, 40);
            ctx.strokeRect(this.width - 75, yC + 200, 10, 40);
            
            // インジケーター明滅
            const blink = Math.abs(Math.sin(this.frameTimer * 0.02)) * 0.15 + 0.15;
            ctx.fillStyle = `rgba(0, 210, 210, ${blink})`;
            for(let row = 0; row < 4; row++) {
                ctx.fillRect(this.width - 30, yC + 150 + (row * 15), 5, 5);
                ctx.fillRect(this.width - 18, yC + 150 + (row * 15), 5, 5);
            }
        }

        // ==================================================
        // レイヤーD: 画面全域（要塞連絡ブリッジ / マップ内のY座標: 850px地点に配置）
        // ==================================================
        let yD = mapTopY + 850;
        if (yD < this.height && yD + 24 > 0) {
            ctx.fillStyle = colorMain;
            ctx.fillRect(0, yD, this.width, 24); 
            ctx.strokeStyle = colorLine;
            ctx.strokeRect(-10, yD, this.width + 20, 24);
            
            // ブリッジ上の補強フレームリブ
            ctx.fillStyle = "#080E0E";
            for (let x = 20; x < this.width; x += 32) {
                ctx.fillRect(x, yD, 3, 24);
            }
        }
    }
}

// ==========================================
// 3. 全体を統括するマネージャークラス
// ==========================================
class BackgroundManager {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.currentBackground = null;
        this.setup("#000000", 1);
    }

    setup(color, stageNum) {
        switch (stageNum) {
            case 1: this.currentBackground = new Stage1Background(this.width, this.height); break;
            case 2: this.currentBackground = new Stage2Background(this.width, this.height); break;
            case 3: this.currentBackground = new Stage3Background(this.width, this.height); break;
            case 4: this.currentBackground = new Stage4Background(this.width, this.height); break;
            case 5: this.currentBackground = new Stage5Background(this.width, this.height); break;
            case 6: this.currentBackground = new Stage6Background(this.width, this.height); break;
            case 7: this.currentBackground = new Stage7Background(this.width, this.height); break;
            default: this.currentBackground = new StageBackground(this.width, this.height, color); break;
        }
    }

    update(frame) { if (this.currentBackground) this.currentBackground.update(frame); }
    draw(ctx) { if (this.currentBackground) this.currentBackground.draw(ctx); }
}