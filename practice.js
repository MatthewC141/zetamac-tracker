// The practice drills (practice.html). Kept out of the page so the page's security policy can refuse inline scripts.
const $ = s => document.querySelector(s);
const MODE_NAMES = { 'sub-borrow': 'Subtraction with borrowing', 'sub-easy': 'Subtraction without borrowing' };
const input = $('#answer');
let log = [], current = null, prevLen = 0, startAt = 0, cfg, last = '', answer = '', score = 0, endAt = 0, timer = 0, running = false, history = [];

const rand = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));

// A zetamac subtraction problem is (a + b) – a = b with a, b in 2–100. "Borrowing" means the ones
// digit being subtracted (a) is bigger than the ones digit of the number it's subtracted from (a + b).
const needsBorrow = (top, sub) => sub % 10 > top % 10;

function subtraction(drill) {
  for (;;) {
    const a = rand(2, 100), b = rand(2, 100), top = a + b;
    if (needsBorrow(top, a) === (drill === 'sub-borrow')) return { text: `${top} – ${a}`, answer: b };
  }
}

function readSettings() {
  const mode = document.querySelector('input[name=drill]:checked').value;
  const duration = parseInt($('#duration').value, 10);
  return { mode, duration, tracked: [120, 30, 0].includes(duration) };
}

function updateNote() {
  const s = readSettings();
  $('#custom-note').textContent = s.duration === 0 ? 'No timer. Press Esc or Stop when you’re done.' : '';
}
document.querySelectorAll('#settings input, #settings select').forEach(el => el.addEventListener('input', updateNote));

function nextProblem() {
  let p;
  do p = subtraction(cfg.mode); while (p.text === last);
  last = p.text;
  $('#question').textContent = p.text;
  answer = String(p.answer);
  input.value = '';
  prevLen = 0;
  current = { q: p.text, a: p.answer, o: 'sub', c: 0, shownAt: performance.now() };
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
