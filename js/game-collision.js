/*
 * PROJECT: VOID-CIRCUIT
 *
 * 物理・衝突判定管理コンポーネント (game-collision.js)
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */
class GameCollisionManager {
    constructor(game) {
        this.game = game;
    }

    check() {
        if (!this.game.player.alive) return;

        const enemies = [];
        const enemyBullets = [];
        const playerBullets = [];

        for (const e of this.game.entities) {
            if (!e.active) continue;
            if (e instanceof Enemy) enemies.push(e);
            else if (e instanceof EnemyBullet) enemyBullets.push(e);
            else if (e instanceof Bullet) playerBullets.push(e);
        }

        // 自機の当たり判定
        if (!this.game.player.isInvincible) {
            const px = this.game.player.x + this.game.player.halfWidth;
            const py = this.game.player.y + this.game.player.halfHeight;
            const hitRadiusSq = this.game.player.hitRadiusSq;

            for (const e of enemies) {
                if (this._isCircleHit(px, py, hitRadiusSq, e)) {
                    this.game.onPlayerMiss();
                    return; 
                }
            }
            for (const eb of enemyBullets) {
                if (this._isCircleHit(px, py, hitRadiusSq, eb)) {
                    this.game.onPlayerMiss();
                    return;
                }
            }
        }

        // 敵の当たり判定（vs 自機弾）
        for (const enemy of enemies) {
            if (
                enemy.y + enemy.height < GAME_CONFIG.UI_HEADER_HEIGHT ||            
                enemy.y >= GAME_CONFIG.HEIGHT ||          
                enemy.x + enemy.width <= 0 ||             
                enemy.x >= GAME_CONFIG.WIDTH              
            ) {
                continue;
            }

            for (const pBullet of playerBullets) {
                if (!pBullet.active) continue;

                if (this._isHit(pBullet, enemy)) {
                    pBullet.active = false;
                    this.game.stats.shotsHit++;

                    if (enemy.takeDamage(1)) {
                        this.game.stats.enemiesKilled++;
                        this._calculateAttachScore(enemy);
                        if (typeof enemy.onDie === 'function') enemy.onDie(this.game);
                        if (enemy.isBoss) this.game.scenario.skipToAfterLoop();
                    } else {
                        const amount = 10;
                        this.game.score += amount;
                        if (this.game.sc.audio) this.game.sc.audio.playHitSound();
                        this.game.particles.push(new Particle(pBullet.x, pBullet.y));
                        
                        if (enemy.isBoss) {
                            const scatterX = (Math.random() - 0.5) * 10;
                            const scatterY = (Math.random() - 0.5) * 10;
                            this.game.scoreTexts.push(new ScoreText(pBullet.x + scatterX, pBullet.y + scatterY, `+${amount}`, "#0FF"));
                        }
                    }
                }
            }
        }
    }

    _isCircleHit(px, py, radiusSq, target) {
        const tx = target.x + target.width / 2;
        const ty = target.y + target.height / 2;
        const dx = px - tx;
        const dy = py - ty;
        return (dx * dx + dy * dy) < radiusSq;
    }

    _isHit(r1, r2) {
        const w1 = r1.hitWidth ?? r1.width;
        const h1 = r1.hitHeight ?? r1.height;
        const w2 = r2.hitWidth ?? r2.width;
        const h2 = r2.hitHeight ?? r2.height;

        const r1Left = r1.x + (r1.width - w1) / 2;
        const r1Top  = r1.y + (r1.height - h1) / 2;
        const r2Left = r2.x + (r2.width - w2) / 2;
        const r2Top  = r2.y + (r2.height - h2) / 2;

        return r1Left < r2Left + w2 &&
               r1Left + w1 > r2Left &&
               r1Top < r2Top + h2 &&
               r1Top + h1 > r2Top;
    }

    _calculateAttachScore(enemy){
        const maxHp = enemy.maxHp || 1;
        const amount = 100 * maxHp * (maxHp + 1);  
        this.game.score += amount;

        const centerX = enemy.x + enemy.width / 2;
        let centerY = enemy.isBoss ? enemy.y + (enemy.height * 0.8) : enemy.y + enemy.height / 2;
        
        this.game.scoreTexts.push(new ScoreText(centerX, centerY, amount));

        if (enemy.isBoss){
            const elapsed = this.game.frame - this.game.bossStartTime;
            const limit = enemy.timeLimit || 3600;
            const maxBonus = amount * 0.25;
            const decayRate = maxBonus / limit;
            const rawBonus = Math.max(0, maxBonus - (elapsed * decayRate));
            const bonus = Math.floor(rawBonus / 100) * 100;
            if (bonus > 0) {
                this.game.score += bonus;
                this.game.scoreTexts.push(new ScoreText(GAME_CONFIG.WIDTH / 2, GAME_CONFIG.HEIGHT / 2, ["TIME BONUS", bonus.toLocaleString()], "#0FF"));
            }
        }
    }

    createExplosion(x, y, enemy) {
        const hp = enemy.maxHp || 1;
        const count = 10 + (hp * 2);
        const type = enemy.isBoss ? 'boss' : 'enemy';

        for (let i = 0; i < count; i++) {
            this.game.particles.push(new Particle(x, y, type));
        }

        if (this.game.sc.audio) {
            this.game.sc.audio.playExplosion();
            if (hp >= 10) setTimeout(() => this.game.sc.audio.playExplosion(), 200);
            if (hp >= 50) setTimeout(() => this.game.sc.audio.playExplosion(), 400);
        }
    }
}