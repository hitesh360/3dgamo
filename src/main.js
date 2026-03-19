import { Game } from './Game.js';

window.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
    game.start();
    // Expose globally for debugging
    window.__game = game;
});
