/*
 * PROJECT: VOID-CIRCUIT
 *
 * entities/base.js
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */

class AssetManager {
    constructor() {
        this.imageCache = {};
    }

    async loadImages(assetBase) {
        const imagesToLoad = {
            'player.webp': assetBase + 'player.webp',
            'enemy_straight.webp': assetBase + 'enemy_straight.webp',
            'enemy_sine.webp': assetBase + 'enemy_sine.webp',
            'enemy_stationary.webp': assetBase + 'enemy_stationary.webp',
            'enemy_boss_01.webp': assetBase + 'enemy_boss_01.webp'
        };

        const loadImg = (key, url) => new Promise(r => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                this.imageCache[key] = img;
                r(img);
            };
            img.onerror = () => {
                console.error(`Image load failed: ${url}`);
                r(null);
            };
            img.src = url;
        });

        await Promise.all(
            Object.entries(imagesToLoad).map(([key, url]) => loadImg(key, url))
        );
        console.log("[Assets] All images preloaded.");
    }

    get(key) {
        return this.imageCache[key];
    }
}

/**
 * 全エンティティの基底クラス
 */
class Entity {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.active = true;
    }

    // 画面外判定（上下左右の余白指定可能）
    isOutOfBounds(cw = 320, ch = 480, margin = 50) {
        return (this.y > ch + margin || this.y < -margin || 
                this.x > cw + margin || this.x < -margin);
    }
}

/**
 * 演出用パーティクル
 */
class Particle extends Entity {
    constructor(x, y, type = 'enemy') {
        super(x, y, 2, 2);
        this.type = type;
        const angle = Math.random() * Math.PI * 2;
        const speed = (type === 'player') ? Math.random() * 8 + 2 : Math.random() * 6;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = (type === 'player') ? 100 : 20;
        this.maxLife = this.life;
        this.size = (type === 'player') ? Math.random() * 4 + 2 : 2;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.type === 'player') {
            this.vx *= 0.96; this.vy *= 0.96; this.size *= 0.98;
        }
        this.life--;
        if (this.life <= 0) this.active = false;
    }

    /** パーティクルを描画する */
    draw(ctx) {
        const ratio = this.life / this.maxLife;
        ctx.save();
        
        if (this.type === 'player') {
            ctx.fillStyle = `rgba(255, ${Math.floor(255 * ratio)}, ${Math.floor(100 * ratio)}, ${ratio})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        } 
        else if (this.type === 'boss') {
            ctx.shadowBlur = 10 * ratio;
            ctx.shadowColor = '#0FF';
            ctx.fillStyle = `rgba(${Math.floor(100 + 155 * (1 - ratio))}, 255, 255, ${ratio})`;
            ctx.translate(this.x, this.y);
            ctx.rotate(Math.PI / 4);
            ctx.fillRect(-this.size / 2, -this.size / 2, this.size * 1.5, this.size * 1.5);
        } 
        else {
            ctx.fillStyle = `rgba(255, 255, 100, ${ratio})`;
            ctx.fillRect(this.x, this.y, this.size, this.size);
        }
        
        ctx.restore();
    }
}