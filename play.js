// The arithmetic game (play.html). Kept out of the page so the page's security policy can refuse inline scripts.
const $ = s => document.querySelector(s);
const DEFAULTS = {
  'add-a-lo': 2, 'add-a-hi': 100, 'add-b-lo': 2, 'add-b-hi': 100,
  'mul-a-lo': 2, 'mul-a-hi': 12, 'mul-b-lo': 2, 'mul-b-hi': 100,
};
const input = $('#answer');
let log = [], current = null, prevLen = 0, startAt = 0, cfg, answer = '', score = 0, endAt = 0, timer = 0, running = false, history = [];

const rand = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
const num = id => parseInt($('#' + id).value, 10);

function readSettings() {
  const ops = ['add', 'sub', 'mul', 'div'].filter(o => $(`#${o}-on`).checked);
  const r = {};
  for (const k in DEFAULTS) r[k] = num(k);
  const ranged = (a, b) => Number.isFinite(r[a]) && Number.isFinite(r[b]) && r[a] <= r[b];
  if (!ops.length) return { error: 'Pick at least one operation.' };
  for (const [lo, hi] of [['add-a-lo', 'add-a-hi'], ['add-b-lo', 'add-b-hi'], ['mul-a-lo', 'mul-a-hi'], ['mul-b-lo', 'mul-b-hi']])
    if (!ranged(lo, hi)) return { error: 'Each range needs a low number that is not above the high number.' };
  if ((ops.includes('div')) && r['mul-a-lo'] <= 0 && r['mul-a-hi'] >= 0) return { error: 'Division ranges can’t include 0.' };
  const duration = parseInt($('#duration').value, 10);
  const guided = !!$('#guided')?.checked;  // guided mode's switch is off the start screen for now
  // Guided games are saved separately, so they may leave operations out.
  const defaultRanges = (guided || ops.length === 4) && Object.keys(DEFAULTS).every(k => r[k] === DEFAULTS[k]);
  const tracked = defaultRanges && [120, 30, 0].includes(duration);
  return { ops, r, duration, tracked, guided, mode: guided ? 'guided' : 'standard' };
}

function updateNote() {
  const s = readSettings();
  $('#custom-note').textContent = s.error ? s.error
    : s.tracked ? (s.duration === 30 ? 'Saved to the 30-second section of your tracker.'
      : s.duration === 0 ? 'No timer. Press Esc or Stop when you’re done; your run counts toward your endless record.' : '')
    : 'Custom settings: this game won’t be saved to your tracker. (Tracked: default ranges at 120, 30 seconds or endless.)';
}
document.querySelectorAll('#settings input, #settings select').forEach(el => el.addEventListener('input', updateNote));


// ---- Guided mode ----
// What to picture for each kind of problem. Each guide gets the problem and what's typed so far:
//   p = { op, x, y, answer, text }   e.g. 83 – 47 → { op: 'sub', x: 83, y: 47, answer: 36, text: '83 – 47' }
//   typed = the answer box's current contents ('' at first)
// and returns HTML for the guide area, or null for an empty area. It's re-run on every keystroke,
// so a guide can move on as the answer is typed. An op with no guide shows a placeholder.
const GUIDES = {
  add: p => stackGuide(p.x, p.y, '+'),
  sub: p => stackGuide(p.x, p.y, '–'),
  mul: p => ((p.x === 11 || p.y === 11) && elevenGuide(p.x === 11 ? p.y : p.x)) || splitGuide(p.x, p.y),
  div: p => p.y === 11 ? longDivisionGuide(p.x, p.y) : divisionGuide(p.x, p.y),
};

// Two numbers stacked by place value with the sign and a blank answer row under them:
//    5 4
//  + 8 7
//  ─────
function stackGuide(top, bottom, sign) {
  const a = String(top), b = String(bottom);
  const width = Math.max(a.length, b.length);
  const row = s => [...s.padStart(width, ' ')].map(d => `<span class="gd">${d.trim()}</span>`).join('');
  return `<div class="ggrid" style="grid-template-columns: repeat(${width + 1}, auto)">` +
    '<span class="gd"></span>' + row(a) +
    `<span class="gd sign">${sign}</span>` + row(b) +
    '<span class="grule"></span></div>';
}

// Written long-division setup, d ) n, with the answer space above the bar left blank.
function longDivisionGuide(n, d) {
  return `<div class="ldiv"><span class="ldiv-d">${d}</span><span class="ldiv-n">${n}</span></div>`;
}

// n ÷ d: put n on top and, under it, the biggest round multiple of d that fits (434 ÷ 7 → 420,
// which is 7 × 60), so the gap between them (14 = 7 × 2) is what's left to divide. If the answer
// is itself a round number (120 ÷ 3 = 40), that multiple would give it away, so step down one ten
// (90, which is 3 × 30). When there's no round multiple left to take off, there's no guide.
function divisionGuide(n, d) {
  let tens = Math.floor(n / d / 10) * 10;
  if (d * tens === n) tens -= 10;
  if (tens <= 0) return null;
  return `<div class="gcap">${n} ÷ ${d} — ${d * tens} is ${d} × ${tens}</div>` + stackGuide(n, d * tens, '–');
}

// m × n with n two digits: split n into tens and ones, multiply each by m, and add. 7 × 43 →
// 7 × 40 = 280 on top, 7 × 3 = 21 below. Nothing to split (both one digit), or a round n
// (7 × 40, 7 × 100), means no guide.
function splitGuide(x, y) {
  const n = Math.max(x, y), m = Math.min(x, y);
  if (n < 10 || n > 99 || n % 10 === 0) return null;
  const tens = n - n % 10, ones = n % 10;
  return `<div class="gcap">${m} × ${tens} on top, ${m} × ${ones} below</div>` + stackGuide(m * tens, m * ones, '+');
}

// Two-digit n × 11: spread n out with a 0 in the middle (43 → 403), then write the sum of its
// digits under the 0 (4 + 3 = 7), carrying into the hundreds column when it's 10 or more
// (58 → 508, with 13 under it). 403 + 70 is the answer; the answer row is left blank on purpose.
// Other sizes of n (one digit, or 100) don't fit this pattern, so they get no guide.
function elevenGuide(n) {
  if (n < 10 || n > 99) return null;
  const first = Math.floor(n / 10), last = n % 10, sum = first + last;
  const cell = (v, cls = '') => `<span class="gd ${cls}">${v}</span>`;
  const top = [first, 0, last];
  const bottom = sum < 10 ? ['', sum, ''] : [Math.floor(sum / 10), sum % 10, ''];
  return `<div class="gcap">${n} × 11 — spread it out, then add ${first} + ${last} under the 0</div>` +
    '<div class="ggrid" style="grid-template-columns: repeat(4, auto)">' +
    cell('') + top.map(v => cell(v)).join('') +
    cell('+', 'sign') + bottom.map(v => cell(v, v === '' ? '' : 'overlap')).join('') +
    '<span class="grule"></span></div>';
}
const OP_LABELS = { add: 'addition', sub: 'subtraction', mul: 'multiplication', div: 'division' };
let problem = null;

// Guide colors: one per operation, can be switched off or changed; remembered per browser.
const GUIDE_COLOR_DEFAULTS = { add: '#1a8a3a', sub: '#d0342c', mul: '#1f5fd6', div: '#e07b00' };
const guideColors = { on: true, ...GUIDE_COLOR_DEFAULTS };
try {
  const saved = JSON.parse(localStorage.getItem('zm-guide-colors') || '{}');
  if (typeof saved?.on === 'boolean') guideColors.on = saved.on;
  for (const op in GUIDE_COLOR_DEFAULTS) if (/^#[0-9a-f]{6}$/i.test(saved?.[op])) guideColors[op] = saved[op];
} catch {}

function applyGuideColors() {
  const g = $('#guide');
  for (const op in GUIDE_COLOR_DEFAULTS) {
    g.style.setProperty(`--c-${op}`, guideColors[op]);
    $(`#gc-${op}`).value = guideColors[op];
    $(`#gc-${op}`).disabled = !guideColors.on;
  }
  g.classList.toggle('no-color', !guideColors.on);
  $('#gc-on').checked = guideColors.on;
  try { localStorage.setItem('zm-guide-colors', JSON.stringify(guideColors)); } catch {}
}
// Guided mode is taken off the start screen for now; its code stays so the option can come back
// by restoring the #guided row and the #guide-colors panel in play.html.
if ($('#guided')) {
for (const op in GUIDE_COLOR_DEFAULTS) $(`#gc-${op}`).addEventListener('input', e => { guideColors[op] = e.target.value; applyGuideColors(); });
$('#gc-on').addEventListener('change', e => { guideColors.on = e.target.checked; applyGuideColors(); });
$('#gc-reset').addEventListener('click', e => { e.preventDefault(); Object.assign(guideColors, { on: true, ...GUIDE_COLOR_DEFAULTS }); applyGuideColors(); });
// The color options only matter in guided mode.
const showGuideColors = () => { $('#guide-colors').hidden = !$('#guided').checked; };
$('#guided').addEventListener('change', showGuideColors);
showGuideColors();
applyGuideColors();
}

function renderGuide() {
  if (!cfg.guided || !problem) return;
  const guide = GUIDES[problem.op];
  $('#guide').dataset.op = problem.op;
  $('#guide').innerHTML = guide
    ? (guide(problem, input.value) ?? '')
    : `<span class="guide-empty">Guide for ${OP_LABELS[problem.op]} isn’t set up yet.</span>`;
}

function nextProblem() {
  if (cfg.daily) {  // the day's list, the same for everyone
    const p = cfg.daily[cfg.at++];
    $('#question').textContent = p.q;
    answer = String(p.a);
    input.value = '';
    prevLen = 0;
    current = { q: p.q, a: p.a, o: p.o, c: 0, shownAt: performance.now() };
    problem = null;
    return;
  }
  const { r, ops } = cfg;
  const op = ops[Math.floor(Math.random() * ops.length)];
  let q;
  if (op === 'add' || op === 'sub') {
    const a = rand(r['add-a-lo'], r['add-a-hi']), b = rand(r['add-b-lo'], r['add-b-hi']);
    q = op === 'add' ? [`${a} + ${b}`, a + b, a, b] : [`${a + b} – ${a}`, b, a + b, a];
  } else {
    let a = rand(r['mul-a-lo'], r['mul-a-hi']);
    while (op === 'div' && a === 0) a = rand(r['mul-a-lo'], r['mul-a-hi']);
    const b = rand(r['mul-b-lo'], r['mul-b-hi']);
    q = op === 'mul' ? [`${a} × ${b}`, a * b, a, b] : [`${a * b} ÷ ${a}`, b, a * b, a];
  }
  $('#question').textContent = q[0];
  answer = String(q[1]);
  input.value = '';
  prevLen = 0;
  current = { q: q[0], a: q[1], o: op, c: 0, shownAt: performance.now() };
  problem = { op, x: q[2], y: q[3], answer: q[1], text: q[0] };
  renderGuide();
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

function start(s = readSettings()) {
  if (s.error) { updateNote(); return; }
  cfg = s;
  score = 0;
  log = [];
  $('#score').textContent = 0;
  $('#settings').style.display = 'none';
  $('#game').style.display = 'block';
  $('#game').classList.toggle('guided', cfg.guided);
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
  $('#again').hidden = !!cfg.daily;  // the daily challenge is one try
  tick();
  timer = setInterval(tick, 50);
}

input.addEventListener('input', () => {
  if (!running) return;
  // A shorter value than last time means the player deleted something: count it as a correction.
  if (input.value.length < prevLen) current.c++;
  prevLen = input.value.length;
  renderGuide();
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
  if (!cfg.tracked) { saved.textContent = 'Custom settings: not saved to your tracker.'; return; }
  if (cfg.duration === 0 && final === 0) { saved.textContent = 'Empty run: not saved.'; return; }
  const hidden = cfg.mode === 'guided';  // guided games are saved, but hidden from the tracker for now
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
    if (hidden) { saved.textContent = 'Saved · guided games are hidden from your tracker for now'; return; }
    if (cfg.daily) {
      saved.innerHTML = `Today’s challenge saved · ${daily.streak(history)}-day streak · <a href="leaderboard.html#daily">See today’s board</a>`;
      if (mine?.detail && log.length) saved.insertAdjacentHTML('beforeend', ` · <a href="./#game=${encodeURIComponent(mine.ts)}">See breakdown</a>`);
      daily.render();
      return;
    }
    const label = cfg.duration === 30 ? '30-second ' : cfg.duration === 0 ? 'endless ' : '';
    const proj = cfg.duration === 30 ? ` · projects to ${final * 4} in 2 minutes` : '';
    if (cfg.duration === 0 && final > prevBest) {
      saved.className = 'saved pb';
      saved.textContent = same.length ? `New longest endless run! (was ${prevBest})` : 'First endless run saved — that’s your record to beat.';
    } else if (same.length && final > prevBest) {
      saved.className = 'saved pb';
      saved.textContent = `New ${label}personal best! (was ${prevBest})${proj}`;
    } else {
      saved.textContent = `Saved · ${label}personal best ${Math.max(prevBest, final)}${proj}`;
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

// ---- the daily challenge ----
// Everyone gets the same 2 minutes of zetamac arithmetic each calendar day (problems.js builds it
// from the date), and only the first try counts. The card on the start screen offers it, or says
// how it went: the score, the place on today's board (signed in), and the streak of days played.
const daily = (() => {
  const pad = n => String(n).padStart(2, '0');
  const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => dayKey(new Date());
  const mineToday = list => list.find(g => g.mode === 'daily' && g.date === today());
  // Days in a row with a daily challenge, up to today (or yesterday, if today's is still to play).
  function streak(list) {
    const days = new Set(list.filter(g => g.mode === 'daily').map(g => g.date));
    const d = new Date();
    if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
    let n = 0;
    while (days.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  const card = $('#daily'), text = $('#daily-text'), acts = $('#daily-acts');
  const ordinal = n => { const v = n % 100; return n + (['th', 'st', 'nd', 'rd'][(v - 20) % 10] || ['th', 'st', 'nd', 'rd'][v] || 'th'); };
  async function render() {
    if (!window.ZM_PROBLEMS) return;
    card.hidden = false;
    const done = mineToday(history), n = streak(history);
    $('#daily-streak').textContent = n ? `${n}-day streak` : '';
    if (!done) {
      text.textContent = 'Today’s 2 minutes of arithmetic: the same questions for everyone, one try.';
      acts.innerHTML = '<button type="button" id="daily-go">Play today’s</button><a class="btn" href="leaderboard.html#daily">Today’s board</a>';
      $('#daily-go').addEventListener('click', play);
      return;
    }
    text.innerHTML = `Today: <b>${done.score}</b> · back tomorrow for a new set`;
    acts.innerHTML = '<a class="btn" href="leaderboard.html#daily">Today’s board</a>';
    const cloud = window.ZM_CLOUD;
    if (!window.ZM_WEB || !cloud?.ready || !cloud.user()) return;
    try {
      const board = await cloud.daily(today()), me = cloud.user().name.toLowerCase();
      const at = board.findIndex(r => r.username.toLowerCase() === me);
      // Tied scores share a place.
      if (at >= 0) text.innerHTML = `Today: <b>${done.score}</b> · ${ordinal(board.findIndex(r => r.score === board[at].score) + 1)} of ${board.length} · back tomorrow for a new set`;
    } catch {}
  }
  function play() {
    if (mineToday(history)) return render();
    const date = today();
    start({ ops: ['add', 'sub', 'mul', 'div'], r: { ...DEFAULTS }, duration: 120, tracked: true, guided: false, mode: 'daily',
            daily: window.ZM_PROBLEMS.list('daily', window.ZM_PROBLEMS.daySeed(date), 500), at: 0 });
  }
  return { render, streak };
})();

fetch('api/scores').then(r => r.json()).then(d => { if (Array.isArray(d)) history = d; daily.render(); }).catch(() => daily.render());
$('#start').focus();
