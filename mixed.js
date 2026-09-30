// The combined-operations game (mixed.html): problems that chain two steps, like (5 + 2) × (15 + 9).
// Kept out of the page so the page's security policy can refuse inline scripts.
const $ = s => document.querySelector(s);
const MODE = 'mixed';
const SHAPES = ['both', 'one', 'prod', 'div'];
const input = $('#answer');
let log = [], current = null, prevLen = 0, startAt = 0, cfg, answer = '', lastText = '', score = 0, endAt = 0, timer = 0, running = false, history = [];

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

function nextProblem() {
  let shape, text, value;
  do {
    shape = cfg.shapes[Math.floor(Math.random() * cfg.shapes.length)];
    [text, value] = MAKE[shape]();
  } while (text === lastText);
  lastText = text;
  $('#question').textContent = text;
  answer = String(value);
  input.value = '';
  prevLen = 0;
  current = { q: text, a: value, o: 'mix', c: 0, shownAt: performance.now() };
}

const clock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function tick() {
  if (cfg.duration === 0) {  // endless: count up instead of down
    $('#secs').textContent = clock(Math.floor((performance.now() - startAt) / 1000));
    return;
  }
  const left = Math.max(0, Math.ceil((endAt - performance.now()) / 1000));
  $('#secs').textContent = left;
  if (left === 0) finish();
}

function start() {
  const s = readSettings();
  if (s.error) { updateNote(); return; }
  cfg = s;
  score = 0;
  log = [];
  $('#score').textContent = 0;
  $('#settings').style.display = 'none';
  $('#game').style.display = 'block';
  $('#end').style.display = 'none';
  $('#play').style.display = 'contents';
  input.disabled = false;
  nextProblem();
  input.focus();
  running = true;
  startAt = performance.now();
  endAt = startAt + cfg.duration * 1000;
  $('#clock-label').textContent = cfg.duration === 0 ? 'Time:' : 'Seconds left:';
  $('#stop').hidden = cfg.duration !== 0;
  tick();
  timer = setInterval(tick, 50);
}

input.addEventListener('input', () => {
  if (!running) return;
  // A shorter value than last time means the player deleted something: count it as a correction.
  if (input.value.length < prevLen) current.c++;
  prevLen = input.value.length;
  if (input.value.trim() === answer) {
    log.push({ ...current, t: Math.round(performance.now() - current.shownAt), shownAt: undefined });
    score++;
    $('#score').textContent = score;
    nextProblem();
  }
});

async function save(final, elapsed) {
  const saved = $('#saved');
  saved.className = 'saved';
  if (!cfg.tracked) { saved.textContent = 'Some problems switched off: not saved to your tracker.'; return; }
  if (cfg.duration === 0 && final === 0) { saved.textContent = 'Empty run: not saved.'; return; }
  const same = history.filter(g => g.seconds === cfg.duration && g.mode === MODE);
  const prevBest = same.reduce((m, g) => Math.max(m, g.score), 0);
  saved.textContent = 'Saving…';
  try {
    const r = await fetch('api/game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Zetamac': '1' },
      body: new URLSearchParams({ score: final, elapsed, detail: JSON.stringify(log), seconds: cfg.duration, mode: MODE }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error);
    if (Array.isArray(data)) history = data;
    const mine = history[history.length - 1];  // the server appends, so the newest row is this game
    const label = `Combined${cfg.duration === 30 ? ', 30 s' : cfg.duration === 0 ? ', endless' : ''}`;
    if (cfg.duration === 0 && final > prevBest) {
      saved.className = 'saved pb';
      saved.textContent = same.length ? `New longest endless run! (was ${prevBest}) · ${label}` : `First endless run saved — that’s your record to beat. · ${label}`;
    } else if (same.length && final > prevBest) {
      saved.className = 'saved pb';
      saved.textContent = `New personal best! (was ${prevBest}) · ${label}`;
    } else {
      saved.textContent = `Saved · personal best ${Math.max(prevBest, final)} · ${label}`;
    }
    if (mine && log.length) saved.insertAdjacentHTML('beforeend', ` · <a href="./#game=${encodeURIComponent(mine.ts)}">See breakdown</a>`);
  } catch {
    saved.innerHTML = (window.ZM_WEB ? 'Couldn’t save in this browser.' : 'Couldn’t save — is <code>./zetamac tracker</code> running?') + ' <a href="#" id="retry">Retry</a>';
    $('#retry').onclick = e => { e.preventDefault(); save(final, elapsed); };
  }
}

function finish() {
  clearInterval(timer);
  running = false;
  const elapsed = Math.max(1, Math.round((performance.now() - startAt) / 1000));
  $('#stop').hidden = true;
  $('#pace').textContent = cfg.duration === 0
    ? `${clock(elapsed)} · ${score ? `${((performance.now() - startAt) / 1000 / score).toFixed(2)} s per problem` : 'no problems answered'}`
    : '';
  input.disabled = true;
  $('#play').style.display = 'none';
  $('#final').textContent = score;
  $('#end').style.display = 'block';
  save(score, elapsed);
  // Short pause so keys mashed at the buzzer don't trigger "Try again".
  setTimeout(() => $('#again').focus(), 700);
}

$('#start').addEventListener('click', start);
$('#stop').addEventListener('click', e => { e.preventDefault(); if (running) finish(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && running && cfg.duration === 0) finish();
});
$('#again').addEventListener('click', e => { e.preventDefault(); start(); });
$('#change').addEventListener('click', e => {
  e.preventDefault();
  $('#game').style.display = 'none';
  $('#settings').style.display = 'block';
  $('#start').focus();
});

fetch('api/scores').then(r => r.json()).then(d => { if (Array.isArray(d)) history = d; }).catch(() => {});
updateNote();
$('#start').focus();
