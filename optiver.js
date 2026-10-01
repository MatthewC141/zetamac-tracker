// The quant tests (optiver.html): 80 in 8 (80 questions in 8 minutes), and sequences, fractions
// and estimation (4 minutes each). Each answer is typed and sent with Enter, marked right minus
// wrong, with Tab to skip. The questions come from problems.js. Kept out of the page so the page's
// security policy can refuse inline scripts.
const $ = s => document.querySelector(s);
const P = window.ZM_PROBLEMS;
const input = $('#answer');
let test = 'o80', qs = [], idx = 0, rights = 0, wrongs = 0, skips = 0, log = [], shownAt = 0, prevLen = 0, fixes = 0;
let startAt = 0, timer = 0, running = false, history = [];
const T = () => P.TESTS[test];

// What each test asks, for the start screen.
const LEDES = {
  o80: '80 questions in 8 minutes, about 6 seconds each. Type the answer and press Enter; there’s no second try.',
  seq: '30 sequences in 4 minutes, 8 seconds each. Type the number that comes next and press Enter.',
  frac: '60 questions in 4 minutes, 4 seconds each: fractions to decimals and percents, and back. Type the answer and press Enter.',
  est: '40 questions in 4 minutes, 6 seconds each. Anything within 5% of the true answer is right, so round boldly.',
};
// An estimation answer is shown to three significant figures; everything else in full.
const shown = p => (p.tol ? String(Number(p.a.toPrecision(3))) : P.fmt(p.a));

// The launcher's personal-best line reads this.
function readSettings() { return { mode: test, duration: T().seconds, tracked: true }; }

function pickTest(t) {
  if (!P.TESTS[t]) t = 'o80';
  test = t;
  const box = document.querySelector(`input[name=test][value="${t}"]`);
  if (box) box.checked = true;
  $('#lede').textContent = LEDES[t];
  $('#est-note').hidden = t !== 'est';
  $('#custom-note').dataset.default = `Saves to your tracker and the ${T().name} leaderboard.`;
  document.title = T().name;
  try { localStorage.setItem('zm-test', t); } catch {}
  $('#settings').dispatchEvent(new Event('change'));  // the launcher's rows and best line follow
}
document.querySelectorAll('input[name=test]').forEach(r => r.addEventListener('change', () => pickTest(r.value)));
let first = location.hash.slice(1);
try { if (!P.TESTS[first]) first = localStorage.getItem('zm-test'); } catch {}
pickTest(first);

const clock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
function tick() {
  const left = Math.max(0, Math.ceil((startAt + T().seconds * 1000 - performance.now()) / 1000));
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
  qs = P.list(test, (Math.random() * 2 ** 31) | 0, T().count);
  idx = rights = wrongs = skips = 0;
  log = [];
  tally();
  $('#qtotal').textContent = T().count;
  $('#sign').textContent = T().sign;
  input.inputMode = test === 'seq' ? 'numeric' : 'decimal';
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
  log.push({ q: q.q, a: shown(q), o: q.o, g: given.slice(0, 12), r: result, c: fixes, t: Math.round(performance.now() - shownAt) });
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
  submit();
});
// A typed number: "1,037" is a thousand and thirty-seven, "8,5" is 8.5, and a trailing % is fine.
function readNumber(raw) {
  let s = raw.replace(/\s+/g, '').replace('−', '-').replace(/%$/, '');
  s = /^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s) ? s.replaceAll(',', '') : s.replace(',', '.');
  return /^-?(\d+\.?\d*|\.\d+)$/.test(s) ? Number(s) : NaN;
}
// The same for the on-screen Enter button and Skip link (phones), keeping the keyboard up.
function submit() {
  const raw = input.value.trim();
  if (!raw) return;
  answer(P.isRight(qs[idx], readNumber(raw)) ? 'y' : 'n', raw);
}
for (const el of [$('#go'), $('#skip')]) el.addEventListener('mousedown', e => e.preventDefault());
$('#go').addEventListener('click', () => { if (running) { submit(); input.focus(); } });
$('#skip').addEventListener('click', e => { e.preventDefault(); if (running) { answer('s'); input.focus(); } });
input.addEventListener('input', () => {
  if (input.value.length < prevLen) fixes++;
  prevLen = input.value.length;
});

function finish() {
  if (!running) return;
  running = false;
  clearInterval(timer);
  input.disabled = true;
  const elapsed = Math.min(T().seconds, Math.max(1, Math.round((performance.now() - startAt) / 1000)));
  const score = Math.max(0, rights - wrongs), left = T().count - log.length;
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
    q.textContent = `${m.q} ${T().sign}`;
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
  const saved = $('#saved'), mode = test, seconds = T().seconds;
  saved.className = 'saved';
  if (!log.length) { saved.textContent = 'Nothing answered: not saved.'; return; }
  const same = history.filter(g => g.mode === mode && g.seconds === seconds);
  const prevBest = same.reduce((m, g) => Math.max(m, g.score), 0);
  saved.textContent = 'Saving…';
  try {
    const r = await fetch('api/game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Zetamac': '1' },
      body: new URLSearchParams({ score, elapsed, detail: JSON.stringify(log), seconds, mode }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error);
    if (Array.isArray(data)) history = data;
    const mine = history[history.length - 1];  // the server appends, so the newest row is this game
    if (same.length && score > prevBest) {
      saved.className = 'saved pb';
      saved.textContent = `New personal best! (was ${prevBest})`;
    } else {
      saved.textContent = same.length ? `Saved · personal best ${Math.max(prevBest, score)}` : `Saved: your first ${P.TESTS[mode].name} test.`;
    }
    if (mine?.detail) saved.insertAdjacentHTML('beforeend', ` · <a href="./#game=${encodeURIComponent(mine.ts)}">See breakdown</a>`);
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
