// The squares game (squares.html): its settings and questions; the game loop is game.js. Kept out of the page so the page's security policy can refuse inline scripts.
const $ = s => document.querySelector(s);
// The game uses the harder number sets (saved as sq99h and sq999h; problems.js has the pools).
const MODE_NAMES = { sq99h: 'Two-digit squares', sq999h: 'Three-digit squares' };
let pool = [], last = 0;

function readSettings() {
  const range = document.querySelector('input[name=range]:checked').value;
  const duration = parseInt($('#duration').value, 10);
  return { range, duration, mode: `sq${range}h`, tracked: [120, 30, 0].includes(duration) };
}

function updateNote() {
  const s = readSettings();
  $('#custom-note').textContent = !s.tracked ? 'Only 120-second, 30-second and endless games save to your tracker.'
    : s.duration === 0 ? 'No timer. Press Esc or Stop when you’re done; your run counts toward your endless record.' : '';
}
document.querySelectorAll('#settings input, #settings select').forEach(el => el.addEventListener('input', updateNote));

// What the shared game loop (game.js) needs from this game.
const GAME = {
  begin(cfg) { pool = window.ZM_PROBLEMS.squarePool(cfg.mode); },
  next() {
    let n;
    do n = pool[Math.floor(Math.random() * pool.length)]; while (n === last && pool.length > 1);
    last = n;
    return window.ZM_PROBLEMS.square(n);
  },
  untracked: 'Only 120-second, 30-second and endless games save to your tracker.',
  label: cfg => `${MODE_NAMES[cfg.mode]}${cfg.duration === 30 ? ', 30 s' : cfg.duration === 0 ? ', endless' : ''}`,
};
