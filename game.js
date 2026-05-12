import { getSprite, COLORS, SFX } from './assets.js';

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 500;
const PLAYER_Y_POS = CANVAS_HEIGHT * 7 / 8;
const PLAYER_SPEED = 4;
const BULLET_SPEED = 6;
const MAX_BULLETS = 2;
const FUEL_DRAIN_RATE = 0.05; // Per frame (roughly 3 units per second at 60fps)
const INITIAL_FUEL = 100;
const WAVE_RECHARGE_BONUS = 50;

const ENEMY_TYPES = ['hamburger', 'cookie', 'iron', 'bowtie', 'diamond'];
const ENEMY_COLORS = [COLORS.CYAN, COLORS.MAGENTA, COLORS.LIME, COLORS.YELLOW, COLORS.WHITE];

class Game {
    constructor(canvas, hud) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.hud = hud;
        
        this.canvas.width = CANVAS_WIDTH;
        this.canvas.height = CANVAS_HEIGHT;
        
        this.reset();
        this.bindEvents();
    }

    reset() {
        this.state = 'MENU';
        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('megalomania-highscore')) || 0;
        this.lives = 3;
        this.fuel = INITIAL_FUEL;
        this.level = 0;
        this.levelLoop = 0;
        
        this.player = {
            x: CANVAS_WIDTH / 2 - 16,
            y: PLAYER_Y_POS,
            w: 32,
            h: 32,
            dir: 0
        };
        
        this.bullets = [];
        this.enemies = [];
        this.enemyProjectiles = [];
        this.particles = [];
        
        this.keys = {};
        this.lastTime = 0;
        this.enemySpawnTimer = 0;
        this.waveCleared = false;
        
        this.updateHUD();
    }

    start() {
        this.state = 'PLAYING';
        this.fuel = INITIAL_FUEL;
        this.spawnWave();
        requestAnimationFrame((t) => this.loop(t));
    }

    bindEvents() {
        // Keyboard Events
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if (this.state === 'MENU' && e.code === 'Space') {
                this.handleInteraction();
            }
            if (this.state === 'PLAYING' && e.code === 'Space') {
                this.shoot();
            }
        });
        
        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        // Mobile Touch Events
        const zoneLeft = document.getElementById('touch-zone-left');
        const zoneRight = document.getElementById('touch-zone-right');
        const btnShootSpecial = document.getElementById('btn-shoot-special');
        const overlay = document.getElementById('overlay');

        const handleTouch = (code, isDown) => {
            this.keys[code] = isDown;
            if (isDown) this.handleInteraction();
        };

        zoneLeft.addEventListener('touchstart', (e) => { e.preventDefault(); handleTouch('ArrowLeft', true); });
        zoneLeft.addEventListener('touchend', (e) => { e.preventDefault(); handleTouch('ArrowLeft', false); });
        
        zoneRight.addEventListener('touchstart', (e) => { e.preventDefault(); handleTouch('ArrowRight', true); });
        zoneRight.addEventListener('touchend', (e) => { e.preventDefault(); handleTouch('ArrowRight', false); });

        btnShootSpecial.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handleInteraction();
            if (this.state === 'PLAYING') this.shootSpecial();
        });

        // Overlay touch to start
        overlay.addEventListener('touchstart', (e) => {
            if (this.state === 'MENU') {
                this.handleInteraction();
            }
        });
    }

    handleInteraction() {
        if (this.state === 'MENU') {
            this.start();
            this.hud.overlay.classList.add('hidden');
        }
        // Unlock audio
        SFX.unlock();
    }

    shootSpecial() {
        // Shoot 5 projectiles in a burst/spread
        // We bypass the MAX_BULLETS limit for this special shot but add a small fuel cost or just let it be powerful
        for (let i = 0; i < 5; i++) {
            this.bullets.push({
                x: (this.player.x + this.player.w / 2 - 2) + (i - 2) * 8, // Spread
                y: this.player.y - (i * 5), // Staggered slightly
                w: 4,
                h: 12
            });
        }
        SFX.shoot(); // Single sound or triple? Single is cleaner for a burst
        this.fuel -= 1; // Small cost for special shot
    }

    spawnWave() {
        const typeIndex = this.level % ENEMY_TYPES.length;
        const type = ENEMY_TYPES[typeIndex];
        const color = ENEMY_COLORS[typeIndex];
        const speedMultiplier = 1 + (this.levelLoop * 0.2) + (this.level * 0.05);
        
        this.enemies = [];
        for (let i = 0; i < 8; i++) {
            this.enemies.push({
                x: (i * 45) + 40,
                y: -40 - (i * 10),
                w: 24,
                h: 24,
                type: type,
                color: color,
                speedX: speedMultiplier * 1.5,
                speedY: speedMultiplier * 0.3,
                amplitude: 30,
                baseX: (i * 45) + 40,
                phase: i * 0.5,
                health: 1,
                points: (this.level + 1) * 100
            });
        }
        this.waveCleared = false;
    }

    shoot() {
        if (this.bullets.length < MAX_BULLETS) {
            this.bullets.push({
                x: this.player.x + this.player.w / 2 - 2,
                y: this.player.y,
                w: 4,
                h: 12
            });
            SFX.shoot();
        }
    }

    update(dt) {
        if (this.state !== 'PLAYING') return;

        // Player Movement
        if (this.keys['ArrowLeft'] || this.keys['KeyA']) {
            this.player.x -= PLAYER_SPEED;
        } else if (this.keys['ArrowRight'] || this.keys['KeyD']) {
            this.player.x += PLAYER_SPEED;
        }
        
        // Boundaries
        this.player.x = Math.max(0, Math.min(CANVAS_WIDTH - this.player.w, this.player.x));

        // Fuel Drain
        this.fuel -= FUEL_DRAIN_RATE;
        if (this.fuel <= 0) {
            this.die();
        }
        
        if (this.fuel < 20) {
            this.lowEnergyTimer = (this.lowEnergyTimer || 0) + dt;
            if (this.lowEnergyTimer > 1000) {
                SFX.lowEnergy();
                this.lowEnergyTimer = 0;
            }
        } else {
            this.lowEnergyTimer = 0;
        }

        // Bullets
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            b.y -= BULLET_SPEED;
            if (b.y < -b.h) {
                this.bullets.splice(i, 1);
            }
        }

        // Enemies
        let allDead = true;
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            if (e.health <= 0) continue;
            allDead = false;

            // S-Pattern Movement
            e.phase += 0.05;
            e.x = e.baseX + Math.sin(e.phase) * e.amplitude;
            e.y += e.speedY;

            // Loop screen
            if (e.y > CANVAS_HEIGHT) {
                e.y = -e.h;
            }

            // Collision with bullets
            for (let j = this.bullets.length - 1; j >= 0; j--) {
                const b = this.bullets[j];
                // Coyote collision: enemy hitbox is smaller
                const hitPadding = 4;
                if (b.x < e.x + e.w - hitPadding &&
                    b.x + b.w > e.x + hitPadding &&
                    b.y < e.y + e.h - hitPadding &&
                    b.y + b.h > e.y + hitPadding) {
                    
                    e.health = 0;
                    this.bullets.splice(j, 1);
                    this.score += e.points;
                    this.createExplosion(e.x + e.w/2, e.y + e.h/2, e.color);
                    SFX.explosion();
                    this.updateHUD();
                }
            }

            // Collision with player
            if (this.player.x < e.x + e.w - 4 &&
                this.player.x + this.player.w > e.x + 4 &&
                this.player.y < e.y + e.h - 4 &&
                this.player.y + this.player.h > e.y + 4) {
                this.die();
            }

            // Random enemy shots
            if (Math.random() < 0.005 + (this.level * 0.001)) {
                this.enemyProjectiles.push({
                    x: e.x + e.w/2,
                    y: e.y + e.h,
                    w: 4,
                    h: 10,
                    color: e.color
                });
            }
        }

        // Enemy Projectiles
        for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
            const p = this.enemyProjectiles[i];
            p.y += 3 + (this.levelLoop * 0.5);
            
            if (p.y > CANVAS_HEIGHT) {
                this.enemyProjectiles.splice(i, 1);
                continue;
            }

            if (p.x < this.player.x + this.player.w &&
                p.x + p.w > this.player.x &&
                p.y < this.player.y + this.player.h &&
                p.y + p.h > this.player.y) {
                this.die();
            }
        }

        // Wave Completion
        if (allDead && !this.waveCleared) {
            this.waveCleared = true;
            this.level++;
            if (this.level % ENEMY_TYPES.length === 0) {
                this.levelLoop++;
            }
            
            // Recharge and bonus points
            const fuelBonus = Math.floor(this.fuel * 10);
            this.score += fuelBonus;
            this.fuel = INITIAL_FUEL;
            
            setTimeout(() => {
                this.spawnWave();
                this.updateHUD();
            }, 1000);
        }

        // Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.02;
            if (p.life <= 0) this.particles.splice(i, 1);
        }

        this.updateHUD();
    }

    die() {
        this.lives--;
        this.createExplosion(this.player.x + this.player.w/2, this.player.y + this.player.h/2, COLORS.CYAN);
        SFX.explosion();
        
        if (this.lives <= 0) {
            this.gameOver();
        } else {
            this.state = 'RESPAWNING';
            setTimeout(() => {
                this.fuel = INITIAL_FUEL;
                this.player.x = CANVAS_WIDTH / 2 - 16;
                this.state = 'PLAYING';
                this.enemyProjectiles = [];
            }, 1500);
        }
        this.updateHUD();
    }

    gameOver() {
        this.state = 'GAME_OVER';
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('megalomania-highscore', this.highScore);
        }
        
        this.hud.overlay.classList.remove('hidden');
        this.hud.menuTitle.innerText = 'GAME OVER';
        this.hud.gameOverStats.classList.remove('hidden');
        this.hud.finalScore.innerText = this.score;
        this.hud.menuSubtitle.innerText = 'PRESS SPACE TO RESTART';
        
        // Wait for key to restart
        const restart = (e) => {
            if (e.code === 'Space') {
                window.removeEventListener('keydown', restart);
                this.reset();
                this.start();
                this.hud.overlay.classList.add('hidden');
                this.hud.gameOverStats.classList.add('hidden');
            }
        };
        setTimeout(() => window.addEventListener('keydown', restart), 500);
    }

    createExplosion(x, y, color) {
        for (let i = 0; i < 15; i++) {
            this.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 6,
                vy: (Math.random() - 0.5) * 6,
                life: 1.0,
                color: color
            });
        }
    }

    updateHUD() {
        this.hud.score.innerText = this.score.toString().padStart(6, '0');
        this.hud.highScore.innerText = this.highScore.toString().padStart(6, '0');
        this.hud.fuelBar.style.width = `${Math.max(0, this.fuel)}%`;
        
        if (this.fuel < 20) {
            this.hud.fuelBar.classList.add('low-fuel');
        } else {
            this.hud.fuelBar.classList.remove('low-fuel');
        }

        // Lives
        this.hud.livesIcons.innerHTML = '';
        for (let i = 0; i < this.lives; i++) {
            const icon = document.createElement('div');
            icon.className = 'life-icon';
            this.hud.livesIcons.appendChild(icon);
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Grid Background (Retro feel)
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        this.ctx.lineWidth = 1;
        for (let x = 0; x < CANVAS_WIDTH; x += 40) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, CANVAS_HEIGHT);
            this.ctx.stroke();
        }
        for (let y = 0; y < CANVAS_HEIGHT; y += 40) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(CANVAS_WIDTH, y);
            this.ctx.stroke();
        }

        // Player
        if (this.state !== 'RESPAWNING' || Math.floor(Date.now() / 100) % 2 === 0) {
            const playerSprite = getSprite('player', COLORS.CYAN);
            this.ctx.drawImage(playerSprite, this.player.x, this.player.y, this.player.w, this.player.h);
            
            // Player glow
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = COLORS.CYAN;
        }

        // Bullets
        this.ctx.fillStyle = COLORS.WHITE;
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = COLORS.WHITE;
        for (const b of this.bullets) {
            this.ctx.fillRect(b.x, b.y, b.w, b.h);
        }

        // Enemies
        this.ctx.shadowBlur = 10;
        for (const e of this.enemies) {
            if (e.health <= 0) continue;
            const sprite = getSprite(e.type, e.color);
            this.ctx.shadowColor = e.color;
            this.ctx.drawImage(sprite, e.x, e.y, e.w, e.h);
        }

        // Enemy Projectiles
        for (const p of this.enemyProjectiles) {
            this.ctx.fillStyle = p.color;
            this.ctx.shadowColor = p.color;
            this.ctx.fillRect(p.x, p.y, p.w, p.h);
        }

        // Particles
        this.ctx.shadowBlur = 0;
        for (const p of this.particles) {
            this.ctx.globalAlpha = p.life;
            this.ctx.fillStyle = p.color;
            this.ctx.fillRect(p.x, p.y, 3, 3);
        }
        this.ctx.globalAlpha = 1.0;
    }

    loop(time) {
        const dt = time - this.lastTime;
        this.lastTime = time;

        this.update(dt);
        this.draw();

        if (this.state !== 'GAME_OVER') {
            requestAnimationFrame((t) => this.loop(t));
        }
    }
}

export default Game;
