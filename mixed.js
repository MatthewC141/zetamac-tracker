// The combined-operations game (mixed.html): problems that chain two steps, like (5 + 2) × (15 + 9).
// The questions come from problems.js and the game loop is game.js. Kept out of the page so the
// page's security policy can refuse inline scripts.
const $ = s => document.querySelector(s);
const MODE = 'mixed';
const SHAPES = window.ZM_PROBLEMS.MIXED_KINDS;  // the four kinds (problems.js); each has a switch on the start screen
let lastText = '';

function readSettings() {
  const shapes = SHAPES.filter(s => $(`#${s}-on`).checked);
  if (!shapes.length) return { error: 'Pick at least one kind of problem.' };
  const duration = parseInt($('#duration').value, 10);
  const tracked = shapes.length === SHAPES.length && [120, 30, 0].includes(duration);
  return { shapes, duration, tracked, mode: MODE };
}

function updateNote() {
  const s = readSettings();
  $('#custom-note').textContent = s.error ? s.error
    : !s.tracked ? 'Some problems switched off: this game won’t be saved to your tracker. (Tracked: all four on.)'
    : s.duration === 0 ? 'No timer. Press Esc or Stop when you’re done; your run counts toward your endless record.' : '';
}
document.querySelectorAll('#settings input, #settings select').forEach(el => el.addEventListener('input', updateNote));

// What the shared game loop (game.js) needs from this game.
const GAME = {
  next(cfg) {
    let p;
    do p = window.ZM_PROBLEMS.mixed(cfg.shapes); while (p.q === lastText);
    lastText = p.q;
    return p;
  },
  untracked: 'Some problems switched off: not saved to your tracker.',
  label: cfg => `Combined${cfg.duration === 30 ? ', 30 s' : cfg.duration === 0 ? ', endless' : ''}`,
};
