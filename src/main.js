import { Game } from './game.js';

const game = new Game();
window.__game = game; // handy for debugging in the console
game.init().catch((err) => {
  console.error(err);
  const p = document.querySelector('#screen-loading .small');
  if (p) p.textContent = `Something tripped over something: ${err.message}`;
});
