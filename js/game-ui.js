/*
 * PROJECT: VOID-CIRCUIT
 *
 * UI・演出管理コンポーネント (game-ui.js)
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */

export class GameUIManager {
    constructor(game) {
        this.game = game;
    }

    updateScoreUI() {
        const scoreEl = document.getElementById('score-display');
        if (scoreEl) {
            scoreEl.innerText = `SCORE: ${this.game.score.toString().padStart(8, '0')}`;
            if (this.game.score >= 99999990 && !this.game.hasCounterStopped) {
                scoreEl.classList.add('counter-stop');
                if (this.game.sc.audio) this.game.sc.audio.playPowerUp();
                this.game.hasCounterStopped = true;
            }
        }
        
        if (!this.game.hasExtended && this.game.extendThreshold !== 'NONE' && this.game.score >= this.game.extendThreshold) {
            this.game.currentLives++;
            if (this.game.sc.audio) this.game.sc.audio.playPowerUp();
            this.game.hasExtended = true;
            this.triggerExtendBlink();
        }
    }

    triggerExtendBlink() {
        const el = document.getElementById('lives-display');
        el?.classList.add('extend-blink');
        setTimeout(() => el?.classList.remove('extend-blink'), 2000);
    }

    updateLivesUI() {
        const el = document.getElementById('lives-display');
        if (!el) return;
        const count = Math.max(0, this.game.currentLives - 1);
        const icon = "🚀";
        el.innerText = count === 0 ? "" : (count <= 3 ? icon.repeat(count) : `${icon}x${count}`);
    }

    visualEffectWarning() {
        const container = document.getElementById('game-container');
        if (!container) return;
        container.style.transition = "filter 0.1s";
        container.style.filter = "brightness(1.2) sepia(1) saturate(5) hue-rotate(-50deg)";
        setTimeout(() => { container.style.filter = ""; }, 150);
    }

    updateDebugInfo() {
        const debugEl = document.getElementById('debug-info');
        if (!debugEl || !this.game.isInvincibleCheat) {
            if (debugEl) debugEl.style.display = 'none';
            return;
        }
        debugEl.style.display = 'block';
        
        document.getElementById('debug-frame').innerText = this.game.frame;
        document.getElementById('debug-scn-frame').innerText = this.game.scenario.currentScenarioFrame;
        document.getElementById('debug-index').innerText = `${this.game.scenario.currentIndex} / ${this.game.scenario.length}`;

        const bonusEl = document.getElementById('debug-bonus-time');
        const boss = this.game.entities.find(e => e.isBoss); 
        
        if (boss && this.game.bossStartTime > 0 && bonusEl) {
            const elapsed = this.game.frame - this.game.bossStartTime;
            const remaining = Math.max(0, boss.timeLimit - elapsed);
            bonusEl.innerText = `${remaining}F (${(remaining / GAME_CONFIG.FPS).toFixed(2)}s)`;
            bonusEl.style.color = remaining < 600 ? "#f00" : "#0ff"; 
        } else if (bonusEl) {
            bonusEl.innerText = "---";
            bonusEl.style.color = "#888";
        }        
        document.getElementById('debug-load').innerText = this.game.entities.length + this.game.particles.length;
    }

    drawOverlayMessages(ctx) {
        ctx.save();
        ctx.font = '16px "Press Start 2P", cursive';
        ctx.textAlign = 'center';

        let kvPath = null;
        let kvDuration = 180;

        if (this.game.scenario.kv) {
            if (typeof this.game.scenario.kv === 'object') {
                kvPath = this.game.scenario.kv.path;
                kvDuration = this.game.scenario.kv.duration || 180;
            } else {
                kvPath = this.game.scenario.kv;
            }
        }

        if (this.game.frame > 0 && this.game.frame < kvDuration) {
            let textAlpha = 1.0;
            if (this.game.frame <= 30) textAlpha = this.game.frame / 30;
            else if (this.game.frame > (kvDuration - 30)) textAlpha = (kvDuration - this.game.frame) / 30;

            if (kvPath && this.game.assets) {
                const kvImage = this.game.assets.get?.(kvPath) || this.game.assets[kvPath];
                if (kvImage && kvImage.complete) {
                    ctx.save();
                    const progress = this.game.frame / kvDuration;
                    let kvAlpha = 1.0;
                    if (this.game.frame <= 25) kvAlpha = this.game.frame / 25;
                    else if (this.game.frame > (kvDuration - 45)) kvAlpha = Math.max(0, (kvDuration - this.game.frame) / 45);

                    const baseWidth = GAME_CONFIG.WIDTH;
                    const baseHeight = kvImage.height * (GAME_CONFIG.WIDTH / kvImage.width);
                    const scale = 1.12 - (progress * 0.12); 
                    const drawWidth = baseWidth * scale;
                    const drawHeight = baseHeight * scale;
                    const drawX = (GAME_CONFIG.WIDTH - drawWidth) / 2;
                    const drawY = (GAME_CONFIG.HEIGHT * 0.35) - (drawHeight / 2);

                    ctx.globalCompositeOperation = 'screen';
                    ctx.globalAlpha = Math.max(0, kvAlpha);

                    if (kvAlpha > 0) {
                        ctx.save();
                        ctx.globalCompositeOperation = 'source-over';
                        ctx.globalAlpha = kvAlpha * 0.6;
                        ctx.fillStyle = '#000000';
                        ctx.fillRect(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT);
                        ctx.restore();
                    }

                    ctx.drawImage(kvImage, drawX, drawY, drawWidth, drawHeight);
                    ctx.globalCompositeOperation = 'source-over';
                    ctx.restore();
                }
            }

            const textCenterY = GAME_CONFIG.HEIGHT * 0.65;
            ctx.font = '16px "Press Start 2P", cursive';
            ctx.fillStyle = `rgba(0, 255, 255, ${textAlpha})`;
            ctx.fillText(`STAGE ${this.game.currentStageNum}`, GAME_CONFIG.WIDTH / 2, textCenterY);
            
            ctx.font = '11px "Press Start 2P", cursive';
            ctx.fillStyle = `rgba(255, 255, 255, ${textAlpha})`;
            ctx.fillText(this.game.scenario.stageName, GAME_CONFIG.WIDTH / 2, textCenterY + 30);
        }

        // ゲームオーバー演出
        if (!this.game.player.alive && this.game.currentLives <= 0) {
            ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
            ctx.fillRect(0, GAME_CONFIG.HEIGHT / 2 - 50, GAME_CONFIG.WIDTH, 100);
            ctx.fillStyle = '#FFF';
            ctx.fillText('GAME OVER', GAME_CONFIG.WIDTH / 2, GAME_CONFIG.HEIGHT / 2);
        }

        // ステージクリア演出
        if (this.game.isCleared) {
            const stageNameStr = this.ScenarioManager.stageName; 
            ctx.fillStyle = '#0FF';
            ctx.fillText(`STAGE ${this.currentStageNum} CLEAR`, GAME_CONFIG.WIDTH / 2, GAME_CONFIG.HEIGHT / 2);            
            ctx.font = '10px "Press Start 2P", cursive';
            ctx.fillStyle = '#FFF';
            ctx.fillText(stageNameStr, GAME_CONFIG.WIDTH / 2, GAME_CONFIG.HEIGHT / 2 + 30);
        }

        ctx.restore();
    }
}