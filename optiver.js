// The 80-in-8 test (optiver.html): 80 questions in 8 minutes, answered with Enter and marked right
// minus wrong, with Tab to skip. Kept out of the page so the page's security policy can refuse
// inline scripts.
const $ = s => document.querySelector(s);
const MODE = 'o80', SECONDS = 480, COUNT = 80;
const input = $('#answer');
let qs = [], idx = 0, rights = 0, wrongs = 0, skips = 0, log = [], shownAt = 0, prevLen = 0, fixes = 0;
let startAt = 0, timer = 0, running = false, history = [];

const rand = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
const pick = list => list[Math.floor(Math.random() * list.length)];
// Numbers are built from whole hundredths and printed without float noise: 3.40 → "3.4".
const fmt = x => String(Number(x.toFixed(4)));
const hund = n => fmt(n / 100);  // hundredths → text

// Each kind returns [question, answer, kind]. The kinds match the tracker's breakdown colors.
const KINDS = [
  // whole numbers
  [12, () => { const a = rand(100, 999), b = rand(100, 999); return [`${a} + ${b}`, a + b, 'add']; }],
  [12, () => { const a = rand(300, 999), b = rand(100, a - 50); return [`${a} − ${b}`, a - b, 'sub']; }],
  [16, () => {
    if (Math.random() < 0.6) { const a = rand(12, 99), b = rand(3, 9); return [`${a} × ${b}`, a * b, 'mul']; }
    const a = rand(11, 25), b = rand(11, 39); return [`${a} × ${b}`, a * b, 'mul'];
  }],
  [12, () => { const d = rand(3, 19), q = rand(6, 60); return [`${d * q} ÷ ${d}`, q, 'div']; }],
  // decimals
  [18, () => {
    const kind = rand(0, 3);
    if (kind === 0) {  // tenths × tenths: 3.4 × 2.5
      const x = rand(11, 99), y = pick([2, 4, 5, 12, 15, 25, 35, 45]);
      return [`${hund(x * 10)} × ${hund(y * 10)}`, x * y / 100, 'dec'];
    }
    if (kind === 1) {  // hundredths + tenths: 12.75 + 6.5
      const a = rand(101, 4999), b = rand(11, 499) * 10;
      return [`${hund(a)} + ${hund(b)}`, (a + b) / 100, 'dec'];
    }
    if (kind === 2) {  // a decimal take-away: 24.6 − 7.85
      const a = rand(50, 499) * 10, b = rand(101, a - 100);
      return [`${hund(a)} − ${hund(b)}`, (a - b) / 100, 'dec'];
    }
    const y = pick([2, 4, 5, 8, 12, 15, 25]), k = rand(3, 40);  // 7.2 ÷ 0.8 = 9
    return [`${hund(y * k * 10)} ÷ ${hund(y * 10)}`, k, 'dec'];
  }],
  // percentages: 12% of 850, 2.5% of 360
  [16, () => {
    if (Math.random() < 0.7) { const p = pick([5, 10, 12, 15, 20, 25, 30, 35, 40, 45, 60, 75]), n = rand(2, 90) * 10; return [`${p}% of ${n}`, p * n / 100, 'pct']; }
    const p10 = pick([25, 75, 125, 175]), n = rand(1, 24) * 40;  // 2.5%, 7.5%, 12.5%, 17.5%
    return [`${fmt(p10 / 10)}% of ${n}`, p10 * n / 1000, 'pct'];
  }],
  // brackets
  [14, () => {
    const kind = rand(0, 2);
    if (kind === 0) {  // (160 − 17) ÷ 11
      const c = rand(3, 15), total = c * rand(5, 40);
      if (Math.random() < 0.5) { const b = rand(5, 60); return [`(${total + b} − ${b}) ÷ ${c}`, total / c, 'mix']; }
      const a = rand(Math.min(10, total - 1), total - 1); return [`(${a} + ${total - a}) ÷ ${c}`, total / c, 'mix'];
    }
    if (kind === 1) { const a = rand(12, 60), b = rand(11, 39), c = rand(3, 9); return [`(${a} + ${b}) × ${c}`, (a + b) * c, 'mix']; }
    const a = rand(12, 49), b = rand(3, 9), c = rand(11, 99); return [`${a} × ${b} − ${c}`, a * b - c, 'mix'];
  }],
];
const TOTAL_WEIGHT = KINDS.reduce((t, [w]) => t + w, 0);
function makeQuestion() {
  let r = Math.random() * TOTAL_WEIGHT;
  for (const [w, make] of KINDS) { if ((r -= w) < 0) return make(); }
  return KINDS[0][1]();
}
function makeTest() {
  const out = [];
  while (out.length < COUNT) {
    const [q, a, o] = makeQuestion();
    if (a > 0 && (!out.length || out[out.length - 1].q !== q)) out.push({ q, a: Number(a.toFixed(4)), o });
  }
  return out;
}

// The launcher's personal-best line reads this.
function readSettings() { return { mode: MODE, duration: SECONDS, tracked: true }; }

const clock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
function tick() {
  const left = Math.max(0, Math.ceil((startAt + SECONDS * 1000 - performance.now()) / 1000));
  $('#secs').textContent = clock(left);
  if (left === 0) finish();
}
function show() {
  $('#question').textContent = qs[idx].q;
  $('#qnum').textContent = idx + 1;
  input.value = '';
  prevLen = 0; fixes = 0;
  shownAt = performance.now();
}
function tally() { $('#rights').textContent = rights; $('#wrongs').textContent = wrongs; }

function start() {
  qs = makeTest();
  idx = rights = wrongs = skips = 0;
  log = [];
  tally();
  $('#settings').style.display = 'none';
  $('#game').style.display = 'block';
  $('#end').style.display = 'none';
  $('#play').style.display = 'contents';
  $('#hint').hidden = false;
  $('#misses').hidden = true;
  input.disabled = false;
  show();
  input.focus();
  running = true;
  startAt = performance.now();
  tick();
  timer = setInterval(tick, 100);
}

// Enter answers (right or wrong, it moves on); Tab skips.
function answer(result, given = '') {
  const q = qs[idx];
  log.push({ q: q.q, a: fmt(q.a), o: q.o, g: given.slice(0, 12), r: result, c: fixes, t: Math.round(performance.now() - shownAt) });
  if (result === 'y') rights++; else if (result === 'n') wrongs++; else skips++;
  tally();
  if (++idx >= qs.length) return finish();
  show();
}
input.addEventListener('keydown', e => {
  if (!running) return;
  if (e.key === 'Tab') { e.preventDefault(); answer('s'); return; }
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const raw = input.value.trim().replace(',', '.').replace('−', '-');
  if (!raw) return;
  const v = /^-?(\d+\.?\d*|\.\d+)$/.test(raw) ? Number(raw) : NaN;
  answer(Number.isFinite(v) && Math.abs(v - qs[idx].a) < 1e-9 ? 'y' : 'n', raw);
});
input.addEventListener('input', () => {
  if (input.value.length < prevLen) fixes++;
  prevLen = input.value.length;
});

function finish() {
  if (!running) return;
  running = false;
  clearInterval(timer);
  input.disabled = true;
  const elapsed = Math.min(SECONDS, Math.max(1, Math.round((performance.now() - startAt) / 1000)));
  const score = Math.max(0, rights - wrongs), left = COUNT - log.length;
  $('#play').style.display = 'none';
  $('#hint').hidden = true;
  $('#final').textContent = score;
  $('#split').innerHTML = `<span class="r">${rights} right</span> · <span class="w">${wrongs} wrong</span> · ${skips} skipped${left ? ` · ${left} not reached` : ''}`;
  const done = log.filter(q => q.r !== 's').length;
  $('#pace').textContent = done ? `${(elapsed / done).toFixed(1)} s per answer · ${clock(elapsed)}` : '';
  $('#end').style.display = 'block';
  // the wrong ones, with what was typed and the answer
  const misses = log.filter(q => q.r === 'n');
  const list = $('#miss-list');
  list.replaceChildren(...misses.map(m => {
    const li = document.createElement('li'), q = document.createElement('span'), a = document.createElement('span'), got = document.createElement('span');
    q.textContent = `${m.q} =`;
    got.className = 'got'; got.textContent = m.g;
    a.append(got, document.createTextNode(m.a));
    li.append(q, a);
    return li;
  }));
  $('#misses').hidden = !misses.length;
  save(score, elapsed);
  setTimeout(() => $('#again').focus(), 700);
}

async function save(score, elapsed) {
  const saved = $('#saved');
  saved.className = 'saved';
  if (!log.length) { saved.textContent = 'Nothing answered: not saved.'; return; }
  const same = history.filter(g => g.mode === MODE && g.seconds === SECONDS);
  const prevBest = same.reduce((m, g) => Math.max(m, g.score), 0);
  saved.textContent = 'Saving…';
  try {
    const r = await fetch('api/game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Zetamac': '1' },
      body: new URLSearchParams({ score, elapsed, detail: JSON.stringify(log), seconds: SECONDS, mode: MODE }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error);
    if (Array.isArray(data)) history = data;
    const mine = history[history.length - 1];  // the server appends, so the newest row is this game
    if (same.length && score > prevBest) {
      saved.className = 'saved pb';
      saved.textContent = `New personal best! (was ${prevBest})`;
    } else {
      saved.textContent = same.length ? `Saved · personal best ${Math.max(prevBest, score)}` : 'Saved: your first 80 in 8.';
    }
    if (mine) saved.insertAdjacentHTML('beforeend', ` · <a href="./#game=${encodeURIComponent(mine.ts)}">See breakdown</a>`);
  } catch {
    saved.innerHTML = (window.ZM_WEB ? 'Couldn’t save in this browser.' : 'Couldn’t save — is <code>./zetamac tracker</code> running?') + ' <a href="#" id="retry">Retry</a>';
    $('#retry').onclick = e => { e.preventDefault(); save(score, elapsed); };
  }
}

$('#start').addEventListener('click', start);
$('#again').addEventListener('click', e => { e.preventDefault(); start(); });
$('#change').addEventListener('click', e => {
  e.preventDefault();
  $('#game').style.display = 'none';
  $('#settings').style.display = 'block';
  $('#start').focus();
});

fetch('api/scores').then(r => r.json()).then(d => { if (Array.isArray(d)) history = d; }).catch(() => {});
$('#start').focus();
