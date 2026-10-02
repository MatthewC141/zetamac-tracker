// The combined-operations game (mixed.html): problems that chain two steps, like (5 + 2) × (15 + 9).
// (The game loop is game.js.) Kept out of the page so the page's security policy can refuse inline scripts.
const $ = s => document.querySelector(s);
const MODE = 'mixed';
const SHAPES = ['both', 'one', 'prod', 'div'];
let lastText = '';

const rand = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
const coin = () => Math.random() < 0.5;

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

// v written as a bracket: a sum (7 → 5 + 2) or a difference (7 → 15 – 8). Both parts are at least 1,
// and a sum's parts stay under 100 where v allows.
function bracket(v) {
  if (v >= 2 && coin()) {
    const a = rand(Math.max(1, v - 99), v - 1);
    return `(${a} + ${v - a})`;
  }
  const b = v < 13 ? rand(2, 9) : rand(2, 30);
  return `(${v + b} – ${b})`;
}

// Each problem is [text, answer]. The multiplying ones use zetamac's multiplication sizes
// (2–12 by 2–100), so the last step is one you'd see in the arithmetic game.
const MAKE = {
  // (5 + 2) × (15 + 9): both factors hidden in brackets.
  both() {
    const m = rand(2, 12), n = rand(2, 100);
    const [l, r] = coin() ? [m, n] : [n, m];
    return [`${bracket(l)} × ${bracket(r)}`, m * n];
  },
  // (13 – 4) × 23: one factor in a bracket, the other plain.
  one() {
    const m = rand(2, 12), n = rand(2, 100);
    const hideSmall = coin(), [shown, hidden] = hideSmall ? [n, m] : [m, n];
    return coin() ? [`${bracket(hidden)} × ${shown}`, m * n] : [`${shown} × ${bracket(hidden)}`, m * n];
  },
  // (7 × 8) + (6 × 14), or the same with – (bigger product first, so the answer stays positive).
  prod() {
    let p = [rand(2, 12), rand(2, 20)], q = [rand(2, 12), rand(2, 20)];
    const add = coin();
    if (!add) {
      while (p[0] * p[1] === q[0] * q[1]) q = [rand(2, 12), rand(2, 20)];
      if (p[0] * p[1] < q[0] * q[1]) [p, q] = [q, p];
    }
    const side = ([a, b]) => (coin() ? `(${a} × ${b})` : `(${b} × ${a})`);
    return [`${side(p)} ${add ? '+' : '–'} ${side(q)}`, add ? p[0] * p[1] + q[0] * q[1] : p[0] * p[1] - q[0] * q[1]];
  },
  // (84 + 12) ÷ 8: a bracket that comes out to a multiple of the divisor.
  div() {
    const d = rand(2, 12), n = rand(2, 50);
    return [`${bracket(d * n)} ÷ ${d}`, n];
  },
};

// What the shared game loop (game.js) needs from this game.
const GAME = {
  next(cfg) {
    let text, value;
    do [text, value] = MAKE[cfg.shapes[Math.floor(Math.random() * cfg.shapes.length)]](); while (text === lastText);
    lastText = text;
    return { q: text, a: value, o: 'mix' };
  },
  untracked: 'Some problems switched off: not saved to your tracker.',
  label: cfg => `Combined${cfg.duration === 30 ? ', 30 s' : cfg.duration === 0 ? ', endless' : ''}`,
};
