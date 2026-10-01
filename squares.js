// The squares game (squares.html). Kept out of the page so the page's security policy can refuse inline scripts.
const $ = s => document.querySelector(s);
// The game uses the harder number sets (saved as sq99h and sq999h); sq99 and sq999 are older
// games from before, when every number could come up.
const MODE_NAMES = { sq99h: 'Two-digit squares', sq999h: 'Three-digit squares' };
const input = $('#answer');
let log = [], current = null, prevLen = 0, startAt = 0, cfg, pool = [], last = 0, answer = '', score = 0, endAt = 0, timer = 0, running = false, history = [];

// Numbers that can come up: none ending in 5 (x5² is a trick) and, for two-digit squares,
// nothing from 1 to 20, which most people already know by heart.
function buildPool(range) {
  const [lo, hi] = range === '99' ? [21, 99] : [100, 999];
  const out = [];
  for (let n = lo; n <= hi; n++) {
    if (n % 10 === 5) continue;
    out.push(n);
  }
  return out;
}

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

function nextProblem() {
  let n;
  do n = pool[Math.floor(Math.random() * pool.length)]; while (n === last && pool.length > 1);
  last = n;
  $('#question').textContent = `${n}²`;
  answer = String(n * n);
  input.value = '';
  prevLen = 0;
  current = { q: `${n}²`, a: n * n, o: 'sq', c: 0, shownAt: performance.now() };
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
  cfg = readSettings();
  pool = buildPool(cfg.range);
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
  if (!cfg.tracked) { saved.textContent = 'Only 120-second, 30-second and endless games save to your tracker.'; return; }
  if (cfg.duration === 0 && final === 0) { saved.textContent = 'Empty run: not saved.'; return; }
  const same = history.filter(g => g.seconds === cfg.duration && g.mode === cfg.mode);
  const prevBest = same.reduce((m, g) => Math.max(m, g.score), 0);
  saved.textContent = 'Saving…';
  try {
    const r = await fetch('api/game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Zetamac': '1' },
      body: new URLSearchParams({ score: final, elapsed, detail: JSON.stringify(log), seconds: cfg.duration, mode: cfg.mode }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error);
    if (Array.isArray(data)) history = data;
    const mine = history[history.length - 1];  // the server appends, so the newest row is this game
    const label = `${MODE_NAMES[cfg.mode]}${cfg.duration === 30 ? ', 30 s' : cfg.duration === 0 ? ', endless' : ''}`;
    if (cfg.duration === 0 && final > prevBest) {
      saved.className = 'saved pb';
      saved.textContent = same.length ? `New longest endless run! (was ${prevBest}) · ${label}` : `First endless run saved — that’s your record to beat. · ${label}`;
    } else if (same.length && final > prevBest) {
      saved.className = 'saved pb';
      saved.textContent = `New personal best! (was ${prevBest}) · ${label}`;
    } else {
      saved.textContent = `Saved · personal best ${Math.max(prevBest, final)} · ${label}`;
    }
    if (mine?.detail && log.length) saved.insertAdjacentHTML('beforeend', ` · <a href="./#game=${encodeURIComponent(mine.ts)}">See breakdown</a>`);
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
