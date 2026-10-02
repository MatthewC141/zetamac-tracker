// The game loop the solo games share (arithmetic, squares, combined, practice): the clock, taking
// an answer the moment it's right, the end screen and saving. Loaded after the game's own script,
// which supplies readSettings(), updateNote() and GAME:
//   GAME.next(cfg)             the next question: { q, a, o } (text, answer, kind)
//   GAME.untracked             what the end screen says when the settings don't save
//   GAME.label(cfg)            the game's name on the saved line, or
//   GAME.saved(cfg, result)    the whole saved line: { text | html, pb }
//   GAME.begin(cfg), GAME.right(typed, answer), GAME.answered(question, ms),
//   GAME.afterSave(cfg), GAME.loaded()   optional hooks
const input = $('#answer');
let log = [], current = null, prevLen = 0, startAt = 0, cfg, answer = '', score = 0, endAt = 0, timer = 0, running = false, history = [];

const clock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function nextProblem() {
  const p = GAME.next(cfg);
  $('#question').textContent = p.q;
  answer = String(p.a);
  input.value = '';
  prevLen = 0;
  current = { q: p.q, a: p.a, o: p.o, c: 0, shownAt: performance.now(), review: p.review };
}

function tick() {
  if (cfg.duration === 0) {  // endless: count up instead of down
    $('#secs').textContent = clock(Math.floor((performance.now() - startAt) / 1000));
    return;
  }
  const left = Math.max(0, Math.ceil((endAt - performance.now()) / 1000));
  $('#secs').textContent = left;
  if (left === 0) finish();
}

function start(s = readSettings()) {
  if (s.error) { updateNote(); return; }
  cfg = s;
  GAME.begin?.(cfg);
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
  const typed = input.value.trim();
  if (GAME.right ? GAME.right(typed, answer) : typed === answer) {
    const t = Math.round(performance.now() - current.shownAt);
    GAME.answered?.(current, t);
    log.push({ ...current, t, shownAt: undefined, review: undefined });
    score++;
    $('#score').textContent = score;
    nextProblem();
  }
});

// The saved line most games use: a new best, or the best so far, then the game's name.
function savedLine(cfg, { final, prevBest, same }) {
  const label = GAME.label(cfg);
  if (cfg.duration === 0 && final > prevBest)
    return { pb: true, text: same.length ? `New longest endless run! (was ${prevBest}) · ${label}` : `First endless run saved — that’s your record to beat. · ${label}` };
  if (same.length && final > prevBest) return { pb: true, text: `New personal best! (was ${prevBest}) · ${label}` };
  return { text: `Saved · personal best ${Math.max(prevBest, final)} · ${label}` };
}

async function save(final, elapsed) {
  const saved = $('#saved');
  saved.className = 'saved';
  if (!cfg.tracked) { saved.textContent = GAME.untracked; return; }
  if (cfg.duration === 0 && final === 0) { saved.textContent = 'Empty run: not saved.'; return; }
  const same = history.filter(g => g.seconds === cfg.duration && (g.mode || 'standard') === cfg.mode);
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
    const line = (GAME.saved || savedLine)(cfg, { final, prevBest, same });
    if (line.pb) saved.className = 'saved pb';
    if (line.html) saved.innerHTML = line.html; else saved.textContent = line.text;
    if (mine?.detail && log.length) saved.insertAdjacentHTML('beforeend', ` · <a href="./#game=${encodeURIComponent(mine.ts)}">See breakdown</a>`);
    GAME.afterSave?.(cfg);
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

$('#start').addEventListener('click', () => start());
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

fetch('api/scores').then(r => r.json()).then(d => { if (Array.isArray(d)) history = d; }).catch(() => {}).then(() => GAME.loaded?.());
updateNote();
$('#start').focus();
