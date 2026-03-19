import { Game } from './Game.js';

window.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
    game.start();
    // Expose globally for debugging and touch controls
    window.__game = game;
    window.gameInstance = game;
});
