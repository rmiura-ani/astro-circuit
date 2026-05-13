/*
 * PROJECT: VOID-CIRCUIT
 *
 * utils.js
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */

/**
 * Starfield: 背景演出
 * 
 */
class Starfield {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.layers = [
            { count: 40, size: 1, speed: 1.0, color: '#888', stars: [] },
            { count: 20, size: 2, speed: 3.0, color: '#FFF', stars: [] }
        ];
        
        this.layers.forEach(layer => {
            for (let i = 0; i < layer.count; i++) {
                layer.stars.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    s: layer.speed + (Math.random() * 0.5)
                });
            }
        });
    }

    update() {
        this.layers.forEach(layer => {
            layer.stars.forEach(s => {
                s.y += s.s;
                if (s.y > this.height) s.y = -layer.size;
            });
        });
    }

    draw(ctx) {
        this.layers.forEach(layer => {
            ctx.fillStyle = layer.color;
            ctx.beginPath();
            layer.stars.forEach(s => {
                ctx.rect(s.x, s.y, layer.size, layer.size);
            });
            ctx.fill();
        });
    }
}
