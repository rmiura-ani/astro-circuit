/**
 * 弾クラス（自機用）
 */
class Bullet {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 4;
        this.height = 12;
        this.speed = 8;
        this.active = true;
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
class EnemyBullet {
    constructor(x, y, vx, vy) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.width = 6;
        this.height = 6;
        this.active = true;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.y > 500 || this.y < -50 || this.x > 350 || this.x < -50) {
            this.active = false;
        }
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
class Enemy {
    constructor(assetBase, x, y, bulletType, hp = 1) {
        this.x = x;
        this.y = y;
        this.bulletType = bulletType || 'aim';
        this.width = 32;
        this.height = 32;
        this.speed = 2;
        this.hp = hp;
        this.maxHp = hp;
        this.active = true;
        this.shootTimer = Math.random() * 60;

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
            if (this.shootTimer > 120) {
                this.shoot(game);
                this.shootTimer = 0;
            }
        }
    }

    shoot(game) {
        const bx = this.x + this.width / 2;
        const by = this.y + this.height;
        const dx = (game.player.x + 16) - bx;
        const dy = (game.player.y + 16) - by;
        const baseAngle = Math.atan2(dy, dx);

        switch (this.bulletType) {
            case 'straight':
                game.entities.push(new EnemyBullet(bx, by, 0, 4));
                break;
            case 'triple':
                [-0.3, 0, 0.3].forEach(offset => {
                    game.entities.push(new EnemyBullet(bx, by, Math.cos(baseAngle + offset) * 3, Math.sin(baseAngle + offset) * 3));
                });
                break;
            case 'eight-way':
                for (let i = 0; i < 8; i++) {
                    // 360度(2*PI)を8分割した角度を計算
                    const angle = (Math.PI * 2 / 8) * i; 
                    const speed = 3;
                    game.entities.push(new EnemyBullet(
                        bx, 
                        by, 
                        Math.cos(angle) * speed, 
                        Math.sin(angle) * speed
                    ));
                }
                break;
            case 'aim':
            default:
                game.entities.push(new EnemyBullet(bx, by, Math.cos(baseAngle) * 4, Math.sin(baseAngle) * 4));
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
        if (this.isLoaded) {
            ctx.save();
            // 画面上部は無敵のため
            if (this.y < 20) {
                ctx.globalAlpha = 0.5;
            } else {
                ctx.globalAlpha = 1.0;
            }            
            ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
            ctx.restore();
        }
    }
}

/**
 * サインカーブ移動する敵
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
        this.stopY = stopY;       // 停止するY座標
        this.waitTime = waitTime; // 停止するフレーム数（60 = 約1秒）
        this.timer = 0;           // 経過時間計測用
        this.state = 'MOVE_IN';   // 状態管理: MOVE_IN, STOP, MOVE_OUT
    }

    update(game) {
        if (!this.active) return;

        switch (this.state) {
            case 'MOVE_IN':
                // 目標地点まで下降
                this.y += 2;
                if (this.y >= this.stopY) {
                    this.state = 'STOP';
                }
                break;

            case 'STOP':
                // 停止して攻撃
                this.timer++;

                if (!this.baseX) this.baseX = this.x; 
                this.x = this.baseX + Math.sin(this.timer * 0.2) * 2; // 2px幅で揺れる

                // 停止中、一定間隔で弾を撃つ（例：30フレームごと）
                if (this.timer % 30 === 0) {
                    this.shoot(game);
                }

                // 待ち時間を過ぎたら撤退モードへ
                if (this.timer >= this.waitTime) {
                    this.state = 'MOVE_OUT';
                }
                break;

            case 'MOVE_OUT':
                // 上（または画面外）へ去っていく
                this.y -= 3;
                if (this.y < -50) {
                    this.active = false; // 画面外に出たら消去
                }
                break;
        }
    }
}

/**
 * 自機クラス（半身出し＆バウンド処理搭載）
 */
class Player {
    constructor(assetBase, x, y) {
        this.x = x;
        this.y = y;
        this.width = 32;
        this.height = 32;
        this.speed = 5;
        this.alive = true;

        this.image = new Image();
        this.image.crossOrigin = "anonymous";
        this.image.src = assetBase + "player.jfif";
        this.isLoaded = false;
        this.image.onload = () => this.isLoaded = true;
    }

    update(input, cw, ch) {
        if (!this.alive) return;

        // キーボード移動
        if (input.isPressed('ArrowUp') && this.y > 0) this.y -= this.speed;
        if (input.isPressed('ArrowDown') && this.y < ch - this.height) this.y += this.speed;
        if (input.isPressed('ArrowLeft') && this.x > 0) this.x -= this.speed;
        if (input.isPressed('ArrowRight') && this.x < cw - this.width) this.x += this.speed;

        // タッチ移動（半身出しバウンド）
        if (input.isTouching && input.touchX !== null) {
            const targetX = input.touchX - this.width / 2;
            const targetY = input.touchY - this.height / 2;

            let vx = (targetX - this.x) * 0.2;
            let vy = (targetY - this.y) * 0.2;
            this.x += vx;
            this.y += vy;

            const bounce = 0.6;
            const minX = -this.width / 2, maxX = cw - this.width / 2;
            const minY = -this.height / 2, maxY = ch - this.height / 2;

            if (this.x < minX) { this.x = minX; this.x += Math.abs(vx) * bounce; }
            else if (this.x > maxX) { this.x = maxX; this.x -= Math.abs(vx) * bounce; }
            if (this.y < minY) { this.y = minY; this.y += Math.abs(vy) * bounce; }
            else if (this.y > maxY) { this.y = maxY; this.y -= Math.abs(vy) * bounce; }
        }
    }

    draw(ctx) {
        if (!this.alive) return;
        if (this.isLoaded) ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
        else { ctx.fillStyle = '#0FF'; ctx.fillRect(this.x, this.y, this.width, this.height); }
    }
}

/**
 * 爆発パーティクル
 */
class Particle {
    constructor(x, y, type = 'enemy') {
        this.x = x;
        this.y = y;
        this.type = type;
        this.active = true;

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
        
        if (this.type === 'player') {
            // 自機：赤〜オレンジの円形爆発
            ctx.fillStyle = `rgba(255, ${Math.floor(255 * ratio)}, ${Math.floor(100 * ratio)}, ${ratio})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        } 
        else if (this.type === 'boss') {
            // ★ 強敵用：青白い光（シアン）から白へ変化し、光り輝く（グロー効果）
            ctx.save();
            ctx.shadowBlur = 10 * ratio; // 粒子の周りを光らせる
            ctx.shadowColor = '#0FF';
            ctx.fillStyle = `rgba(${Math.floor(100 + 155 * (1 - ratio))}, 255, 255, ${ratio})`;
            
            // 少し回転させて菱形に描画するとさらにカッコいいです
            ctx.translate(this.x, this.y);
            ctx.rotate(Math.PI / 4);
            ctx.fillRect(-this.size / 2, -this.size / 2, this.size * 1.5, this.size * 1.5);
            ctx.restore();
        } 
        else {
            // 通常の敵：黄色いスクエア粒子
            ctx.fillStyle = `rgba(255, 255, 100, ${ratio})`;
            ctx.fillRect(this.x, this.y, this.size, this.size);
        }
        
}
}