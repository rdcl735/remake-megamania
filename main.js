import Game from './game.js';

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('game-canvas');
    const hud = {
        score: document.getElementById('score'),
        highScore: document.getElementById('high-score'),
        livesIcons: document.getElementById('lives-icons'),
        fuelBar: document.getElementById('fuel-bar'),
        overlay: document.getElementById('overlay'),
        menuTitle: document.getElementById('menu-title'),
        menuSubtitle: document.getElementById('menu-subtitle'),
        gameOverStats: document.getElementById('game-over-stats'),
        finalScore: document.getElementById('final-score')
    };

    // Initialize Game
    const game = new Game(canvas, hud);

    // Initial HUD update
    game.updateHUD();

    console.log('Megalomania Remake Initialized');
});
