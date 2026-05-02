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
 * 弾クラス（自機用）
 */
class Bullet extends Entity {
    constructor(x, y) {
        super(x, y, 4, 12);
        this.speed = 8;
    }
    update() {
        this.y -= this.speed;
        if (this.y < -20) this.active = false;
    }
    draw(ctx) {
        ctx.fillStyle = '#FF0';
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}

/**
 * 敵の弾クラス
 */
class EnemyBullet extends Entity {
    constructor(x, y, vx, vy) {
        super(x, y, 6, 6);
        this.vx = vx;
        this.vy = vy;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.isOutOfBounds()) this.active = false;
    }
    draw(ctx) {
        ctx.fillStyle = '#F0F';
        ctx.beginPath();
        ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
        ctx.fill();
    }
}

/**
 * 敵クラス（基本形）
 */
class Enemy extends Entity {
    constructor(assetBase, x, y, bulletType, hp = 1) {
        super(x, y, 32, 32);
        this.bulletType = bulletType || 'aim';
        this.speed = 2;
        this.hp = hp;
        this.maxHp = hp;
        this.shootTimer = Math.random() * 60;
        this.baseShootInterval = 120; 
        this.fireRateMultiplier = 1.0;

        this.image = new Image();
        this.image.crossOrigin = "anonymous";
        this.image.src = assetBase + "enemy.jfif";
        this.isLoaded = false;
        this.image.onload = () => this.isLoaded = true;
    }

    update(game) {
        this.y += this.speed;
        if (this.y > 480) this.active = false;

        if (this.active) {
            this.shootTimer++;
            const currentInterval = this.baseShootInterval / this.fireRateMultiplier;
            if (this.shootTimer >= currentInterval) {
                this.shoot(game);
                this.shootTimer = 0;
            }
        }
    }

    shoot(game) {
        const bx = this.x + this.width / 2;
        const by = this.y + this.height;
        const targetX = game.player.x + 16;
        const targetY = game.player.y + 16;
        const angle = Math.atan2(targetY - by, targetX - bx);

        const spawn = (vx, vy) => game.entities.push(new EnemyBullet(bx, by, vx, vy));

        switch (this.bulletType) {
            case 'straight':
                spawn(0, 4);
                break;
            case 'triple':
                [-0.3, 0, 0.3].forEach(off => spawn(Math.cos(angle + off) * 3, Math.sin(angle + off) * 3));
                break;
            case 'eight-way':
                for (let i = 0; i < 8; i++) {
                    const a = (Math.PI * 2 / 8) * i;
                    spawn(Math.cos(a) * 3, Math.sin(a) * 3);
                }
                break;
            case 'aim':
            default:
                spawn(Math.cos(angle) * 4, Math.sin(angle) * 4);
                break;
        }
    }

    takeDamage(amount) {
        this.hp -= amount;
        if (this.hp <= 0) {
            this.active = false;
            return true;
        }
        return false;
    }

    draw(ctx) {
        if (!this.isLoaded) return;
        ctx.save();
        ctx.globalAlpha = (this.y < 20) ? 0.5 : 1.0;
        ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
        ctx.restore();
    }
}

/**
 * 各種派生敵クラス
 */
class SineEnemy extends Enemy {
    constructor(assetBase, x, y, bulletType, phase = 0) {
        super(assetBase, x, y, bulletType);
        this.baseX = x;
        this.phase = phase;
        this.amplitude = 50;
        this.frequency = 0.05;
    }
    update(game) {
        super.update(game);
        this.x = this.baseX + Math.sin(this.phase) * this.amplitude;
        this.phase += this.frequency;
    }
}

class StationaryEnemy extends Enemy {
    constructor(assetBase, x, y, bulletType, hp = 1, stopY = 100, waitTime = 120) {
        super(assetBase, x, y, bulletType, hp);
        this.stopY = stopY;
        this.waitTime = waitTime;
        this.timer = 0;
        this.state = 'MOVE_IN';
    }

    update(game) {
        if (!this.active) return;

        switch (this.state) {
            case 'MOVE_IN':
                this.y += 2;
                if (this.y >= this.stopY) this.state = 'STOP';
                break;

            case 'STOP':
                this.timer++;
                if (!this.baseX) this.baseX = this.x; 
                this.x = this.baseX + Math.sin(this.timer * 0.2) * 2;

                const interval = Math.max(10, 30 / this.fireRateMultiplier);
                if (this.timer % Math.floor(interval) === 0) this.shoot(game);

                if (this.timer >= this.waitTime) this.state = 'MOVE_OUT';
                break;

            case 'MOVE_OUT':
                this.y -= 3;
                if (this.y < -50) this.active = false;
                break;
        }
    }
}

/**
 * 自機クラス
 */
class Player extends Entity {
    constructor(assetBase, x, y) {
        super(x, y, 32, 32);
        this.speed = 5;
        this.alive = true;
        this.invincibleTimer = 0;

        this.image = new Image();
        this.image.crossOrigin = "anonymous";
        this.image.src = assetBase + "player.jfif";
        this.isLoaded = false;
        this.image.onload = () => this.isLoaded = true;
    }

    update(input, cw, ch) {
        if (!this.alive) return;
        if (this.invincibleTimer > 0) this.invincibleTimer--;

        // キーボード操作
        if (input.isPressed('ArrowUp') && this.y > 0) this.y -= this.speed;
        if (input.isPressed('ArrowDown') && this.y < ch - this.height) this.y += this.speed;
        if (input.isPressed('ArrowLeft') && this.x > 0) this.x -= this.speed;
        if (input.isPressed('ArrowRight') && this.x < cw - this.width) this.x += this.speed;

        // タッチ操作（バウンド慣性付き）
        if (input.isTouching && input.touchX !== null) {
            this.handleTouchMove(input.touchX, input.touchY, cw, ch);
        }
    }

    handleTouchMove(tx, ty, cw, ch) {
        const targetX = tx - this.width / 2;
        const targetY = ty - this.height / 2;
        let vx = (targetX - this.x) * 0.2;
        let vy = (targetY - this.y) * 0.2;
        
        this.x += vx;
        this.y += vy;

        const bounce = 0.6;
        const limitX = cw - this.width / 2, limitY = ch - this.height / 2;
        const minPos = -this.width / 2;

        if (this.x < minPos) { this.x = minPos; this.x += Math.abs(vx) * bounce; }
        else if (this.x > limitX) { this.x = limitX; this.x -= Math.abs(vx) * bounce; }
        if (this.y < minPos) { this.y = minPos; this.y += Math.abs(vy) * bounce; }
        else if (this.y > limitY) { this.y = limitY; this.y -= Math.abs(vy) * bounce; }
    }

    draw(ctx) {
        if (!this.alive) return;
        // 点滅
        if (this.invincibleTimer > 0 && Math.floor(this.invincibleTimer / 5) % 2 === 0) return;

        if (this.isLoaded) {
            ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
        } else {
            ctx.fillStyle = '#0FF';
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
    }

    setInvincible(frames) { this.invincibleTimer = frames; }
    get isInvincible() { return this.invincibleTimer > 0; }
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