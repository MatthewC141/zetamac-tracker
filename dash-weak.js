// The progress dashboard, part 3 of 8: weak spots, the timing tower of question kinds.
// ---------- first viewport: weak spots (the timing tower) ----------
// Arithmetic operations ranked by seconds per question, slowest first. Sector colors follow live
// timing: purple = fastest operation, green = faster than in the previous window, yellow = slower.
const OPS = ['add', 'sub', 'mul', 'div'];
const OP_CODES = { add: 'ADD', sub: 'SUB', mul: 'MUL', div: 'DIV' };
let weakWindow = '10';
try { weakWindow = localStorage.getItem('zm-weak') || weakWindow; } catch {}
if (!['1', '10', 'all'].includes(weakWindow)) weakWindow = '10';
let weakRun = 0;
// Which game the weak spots show: arithmetic, or the 80-in-8 test (its question kinds and accuracy).
let weakGame = 'standard';
try { weakGame = localStorage.getItem('zm-weak-game') === 'o80' ? 'o80' : 'standard'; } catch {}
const O80_KINDS = ['add', 'sub', 'mul', 'div', 'dec', 'pct', 'mix'];
const O80_CODES = { add: 'ADD', sub: 'SUB', mul: 'MUL', div: 'DIV', dec: 'DEC', pct: 'PCT', mix: 'BRK' };
const O80_NAMES = { add: 'Addition', sub: 'Subtraction', mul: 'Multiplication', div: 'Division', dec: 'Decimals', pct: 'Percentages', mix: 'Brackets' };


// The kind of question inside an operation, read from its text: "54 + 87" → "+ carry" (problems.js).
const factOf = window.ZM_PROBLEMS.factOf;

const avgBy = (list, keyOf) => {
  const m = {};
  for (const q of list) {
    const k = keyOf(q);
    if (k == null) continue;
    (m[k] ||= { op: q.o, sum: 0, n: 0 });
    m[k].sum += q.t; m[k].n++;
  }
  for (const k in m) m[k].avg = m[k].sum / m[k].n;
  return m;
};
const secs2 = ms => (ms / 1000).toFixed(2);

// Slowest question types: the top 6, or every × and ÷ fact from 2 to 12; outliers optionally dropped.
let factsAll = false, factsTrim = false;
try { factsAll = localStorage.getItem('zm-facts-all') === '1'; factsTrim = localStorage.getItem('zm-facts-trim') === '1'; } catch {}
const TABLE = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

// Drops answers far slower than usual for their operation: above Q3 + 1.5 × IQR (Tukey's fence)
// of that operation's times in the window. Operations with fewer than 4 answers are kept whole.
function trimOutliers(list) {
  const byOp = {};
  for (const q of list) (byOp[q.o] ||= []).push(q.t);
  const fence = {};
  for (const [o, ts] of Object.entries(byOp)) {
    if (ts.length < 4) continue;
    const s = [...ts].sort((a, b) => a - b), at = p => s[Math.floor(p * (s.length - 1))];
    fence[o] = at(.75) + 1.5 * (at(.75) - at(.25));
  }
  return list.filter(q => !(q.o in fence) || q.t <= fence[q.o]);
}

// A type needs this many answers to be ranked; fewer is shown dimmed, below the ranked ones.
const MIN_FACT = 3;
const factRow = (f, i, top) => {
  const ranked = f.n >= MIN_FACT;
  return `<li class="op-${f.op}${ranked ? '' : ' none'}"><span class="pos">${ranked ? i + 1 : ''}</span><span class="stripe"></span>` +
    `<span class="fact-name">${esc(f.k)}</span><span class="track" aria-hidden="true"><i style="transform:scaleX(${(ranked ? (f.avg / top * 100).toFixed(1) : 0) / 100})"></i></span>` +
    `<span class="time">${f.n ? `${secs2(f.avg)}<small>s</small>` : '—'}</span><span class="gap">${!f.n ? 'none yet' : ranked ? plural(f.n, 'q') : 'too few'}</span></li>`;
};

function factsHTML(qs) {
  const used = factsTrim ? trimOutliers(qs) : qs;
  const dropped = qs.length - used.length;
  const avg = avgBy(used, factOf);
  const head = `<div class="facts-head"><h3>Slowest question types</h3>` +
    `<div class="facts-tools"><div class="seg" role="group" aria-label="Question types to show">` +
      `<button type="button" data-facts="top" aria-pressed="${!factsAll}">Top 6</button><button type="button" data-facts="all" aria-pressed="${factsAll}" title="Carrying and borrowing for + and –, and every × and ÷ fact from 2 to 12">All facts</button></div>` +
    `<div class="seg"><button type="button" data-facts="trim" aria-pressed="${factsTrim}" title="Leave out answers far slower than your usual for that operation">Exclude outliers</button></div></div></div>`;
  const note = `<p class="facts-note">Seconds per question · types with fewer than ${MIN_FACT} answers aren’t ranked${factsTrim ? ` · ${dropped ? `${plural(dropped, 'unusually slow answer')} left out` : 'no outliers in this window'}, far slower than your usual for that operation` : ''}</p>`;
  if (!factsAll) {
    const top = Object.entries(avg).filter(([, f]) => f.n >= MIN_FACT).map(([k, f]) => ({ k, ...f })).sort((a, b) => b.avg - a.avg).slice(0, 6);
    if (!top.length) return '';
    return head + `<ol class="tower facts">${top.map((f, i) => factRow(f, i, top[0].avg)).join('')}</ol>` + note;
  }
  // Every type, one column per operation, slowest first; types not seen yet sit at the bottom.
  // Addition and subtraction split by carrying and borrowing; × and ÷ by the 2–12 fact.
  const col = (op, rows, title, cls = '') => {
    const list = rows.map(([key, label]) => ({ op, n: 0, avg: 0, ...avg[key], k: label }))
      .sort((a, b) => (b.n >= MIN_FACT) - (a.n >= MIN_FACT) || (b.n > 0) - (a.n > 0) || b.avg - a.avg);
    const top = Math.max(...list.filter(f => f.n >= MIN_FACT).map(f => f.avg), 1);
    return `<div class="facts-col ${cls}"><h4>${title}</h4><ol class="tower facts">${list.map((f, i) => factRow(f, i, top)).join('')}</ol></div>`;
  };
  const table = sign => TABLE.map(n => [`${sign} ${n}`, `${sign} ${n}`]);
  return head + `<div class="facts-all">` +
    col('add', [['+ carry', 'Carry'], ['+ no carry', 'No carry']], 'Addition', 'words') +
    col('sub', [['– borrow', 'Borrow'], ['– no borrow', 'No borrow']], 'Subtraction', 'words') +
    col('mul', table('×'), 'Multiplication') + col('div', table('÷'), 'Division') + `</div>` + note;
}

// "Last game" also lists that game's five slowest questions, exactly as they came up.
function slowestHTML(qs) {
  const slow = [...qs].sort((a, b) => b.t - a.t).slice(0, 5);
  if (!slow.length) return '';
  return `<div class="facts-head"><h3>Slowest questions in this game</h3></div><ol class="tower facts slowq">${slow.map((q, i) =>
    `<li class="op-${esc(q.o)}"><span class="pos">${i + 1}</span><span class="stripe"></span><span class="fact-name">${esc(q.q)} = ${esc(q.a)}</span>` +
    `<span class="track" aria-hidden="true"><i style="transform:scaleX(${(q.t / slow[0].t).toFixed(3)})"></i></span>` +
    `<span class="time">${secs2(q.t)}<small>s</small></span><span class="gap">${q.c ? `${q.c} fix${q.c === 1 ? '' : 'es'}` : ''}</span></li>`).join('')}</ol>`;
}

async function renderWeak() {
  const run = ++weakRun;
  const el = $('#weak');
  document.querySelectorAll('[data-window]').forEach(b => b.setAttribute('aria-pressed', b.dataset.window === weakWindow));
  // The 80-in-8 switch shows once there's a test with its question log.
  const hasO80 = allGames.some(g => g.mode === 'o80' && g.detail);
  $('#weak-game').hidden = !hasO80;
  const game = hasO80 ? weakGame : 'standard';
  document.querySelectorAll('[data-weak-game]').forEach(b => b.setAttribute('aria-pressed', b.dataset.weakGame === game));
  const o80 = game === 'o80';
  const timed = allGames.filter(g => (g.mode || 'standard') === game && g.detail).sort((a, b) => (b.ts > a.ts ? 1 : b.ts < a.ts ? -1 : 0));
  const emptyMsg = '<p class="empty-state">No question timings yet. Play a round on the <a href="play.html">Play</a> page and each operation will be ranked here by its time per question, slowest first.</p>';
  if (!timed.length) { el.innerHTML = emptyMsg; return; }
  // Last game is compared with the 10 games before it; last 10 with the 10 before those.
  const n = weakWindow === 'all' ? timed.length : Number(weakWindow);
  const cur = timed.slice(0, n);
  const prev = weakWindow === 'all' ? [] : timed.slice(n, n + 10);
  const load = async list => (await getDetails(list.map(g => g.ts)).catch(() => [])).flat();
  const [qs, prevQs] = await Promise.all([load(cur), load(prev)]);
  if (run !== weakRun) return;  // a newer render started while these loaded
  if (o80) return renderWeakO80(el, qs, prevQs, cur, prev);

  const now = avgBy(qs, q => (has(OP_CODES, q.o) ? q.o : null)), before = avgBy(prevQs, q => (has(OP_CODES, q.o) ? q.o : null));
  const rows = OPS.filter(o => now[o]).map(o => ({ op: o, ...now[o] })).sort((a, b) => b.avg - a.avg);
  if (!rows.length) { el.innerHTML = emptyMsg; return; }
  const fastest = Math.min(...rows.map(r => r.avg)), slowest = rows[0].avg;
  const sector = r => r.avg === fastest ? 's-purple' : before[r.op] ? (r.avg < before[r.op].avg ? 's-green' : 's-yellow') : '';

  // Remember where each row was so the new order can slide into place.
  const was = new Map([...el.querySelectorAll('.tower li')].map(li => [li.dataset.op, { top: li.getBoundingClientRect().top, sector: li.dataset.sector }]));
  el.innerHTML =
    `<ol class="tower">${rows.map((r, i) => `<li class="op-${r.op} ${sector(r)}" data-op="${r.op}" data-sector="${sector(r)}">` +
      `<span class="pos">${i + 1}</span><span class="stripe"></span>` +
      `<span class="code" title="${OP_NAMES[r.op]}">${OP_CODES[r.op]}</span>` +
      `<span class="track" aria-hidden="true"><i style="transform:scaleX(${((r.avg / slowest * 100).toFixed(1)) / 100})"></i></span>` +
      `<span class="time">${secs2(r.avg)}<small>s</small></span>` +
      `<span class="gap">${r.avg === fastest ? 'Fastest' : `+${secs2(r.avg - fastest)}`}</span></li>`).join('')}</ol>` +
    `<div class="tower-note"><span>Seconds per question · ${plural(qs.length, 'question')} from ${plural(cur.length, 'game')}${prev.length ? `, compared with the ${prev.length === 1 ? 'game' : plural(prev.length, 'game')} before` : ''}</span>` +
    `<span class="key"><span class="s-purple">Fastest</span>${prev.length ? '<span class="s-green">Faster</span><span class="s-yellow">Slower</span>' : weakWindow !== 'all' ? '<span>Faster / slower colors start after your next timed game</span>' : ''}</span></div>` +
    DRILL + factsHTML(qs) + (weakWindow === '1' ? slowestHTML(qs) : '');

  renderHeatmap();  // the calendar beside the tower sizes itself to the tower's new height
  if (reduceMotion.matches) return;
  for (const li of el.querySelectorAll('.tower li')) {
    const old = was.get(li.dataset.op);
    if (!old) continue;
    const dy = old.top - li.getBoundingClientRect().top;
    if (dy) li.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 650, easing: 'cubic-bezier(.16, 1, .3, 1)' });
    if (old.sector !== li.dataset.sector) {  // a new color: a brief glow, then the class comes off
      li.classList.add('lit');
      li.addEventListener('animationend', () => li.classList.remove('lit'), { once: true });
    }
  }
}

// A practice run made of these: Practice's "Your weak spots" drill.
const DRILL = '<a class="drill-cta" href="practice.html#weak"><span><b>Drill these</b>Your slowest kinds of question, and the exact ones you were slow on or missed, until they’re quick</span></a>';

// The 80-in-8 test's weak spots: each kind of question by seconds per answer (skips don't count),
// with its accuracy beside it (right out of answered; under 85% is marked), then the most missed.
function renderWeakO80(el, qs, prevQs, cur, prev) {
  const answered = list => list.filter(q => q.r !== 's');
  const now = avgBy(answered(qs), q => (has(O80_CODES, q.o) ? q.o : null)), before = avgBy(answered(prevQs), q => (has(O80_CODES, q.o) ? q.o : null));
  const acc = {};
  for (const q of answered(qs)) { const a = (acc[q.o] ||= { y: 0, n: 0 }); q.r === 'n' ? a.n++ : a.y++; }
  const rows = O80_KINDS.filter(o => now[o]).map(o => ({ op: o, ...now[o], acc: acc[o].y / (acc[o].y + acc[o].n) })).sort((a, b) => b.avg - a.avg);
  if (!rows.length) { el.innerHTML = '<p class="empty-state">No answered questions in these tests yet.</p>'; return; }
  const fastest = Math.min(...rows.map(r => r.avg)), slowest = rows[0].avg;
  const sector = r => r.avg === fastest ? 's-purple' : before[r.op] ? (r.avg < before[r.op].avg ? 's-green' : 's-yellow') : '';
  const pct = v => `${Math.round(v * 100)}%`;
  const missed = rows.filter(r => r.acc < 1).sort((a, b) => a.acc - b.acc);
  const wrongs = answered(qs).filter(q => q.r === 'n').length, total = answered(qs).length;
  el.innerHTML =
    `<ol class="tower">${rows.map((r, i) => `<li class="op-${r.op} ${sector(r)}" data-op="${r.op}" data-sector="${sector(r)}">` +
      `<span class="pos">${i + 1}</span><span class="stripe"></span>` +
      `<span class="code" title="${O80_NAMES[r.op]}">${O80_CODES[r.op]}</span>` +
      `<span class="track" aria-hidden="true"><i style="transform:scaleX(${((r.avg / slowest * 100).toFixed(1)) / 100})"></i></span>` +
      `<span class="time">${secs2(r.avg)}<small>s</small></span>` +
      `<span class="gap acc${r.acc < 0.85 ? ' low' : ''}" title="Right, out of those answered">${pct(r.acc)}</span></li>`).join('')}</ol>` +
    `<div class="tower-note"><span>Seconds per answer and accuracy · ${plural(total, 'answer')} from ${plural(cur.length, 'test')}${prev.length ? `, compared with the ${prev.length === 1 ? 'test' : plural(prev.length, 'test')} before` : ''} · skips left out</span>` +
    `<span class="key"><span class="s-purple">Fastest</span>${prev.length ? '<span class="s-green">Faster</span><span class="s-yellow">Slower</span>' : ''}</span></div>` +
    DRILL + `<div class="facts-head"><h3>Most missed</h3></div>` +
    (missed.length ? `<ol class="tower facts">${missed.map((r, i) => `<li class="op-${r.op}"><span class="pos">${i + 1}</span><span class="stripe"></span>` +
      `<span class="fact-name">${O80_NAMES[r.op]}</span><span class="track" aria-hidden="true"><i style="transform:scaleX(${(((1 - r.acc) * 100).toFixed(1)) / 100})"></i></span>` +
      `<span class="time">${pct(1 - r.acc)}<small> wrong</small></span><span class="gap">${acc[r.op].n} of ${acc[r.op].y + acc[r.op].n}</span></li>`).join('')}</ol>`
      : '<p class="facts-note">Nothing missed in these tests.</p>') +
    `<p class="facts-note">${wrongs ? `${plural(wrongs, 'wrong answer')} in all · each one costs a point on top of the one you didn’t get` : 'Every answer right'}</p>`;
  renderHeatmap();
}

$('#weak-game').addEventListener('click', e => {
  const b = e.target.closest('[data-weak-game]');
  if (!b) return;
  weakGame = b.dataset.weakGame;
  try { localStorage.setItem('zm-weak-game', weakGame); } catch {}
  renderWeak();
});

$('#weak').addEventListener('click', e => {
  const b = e.target.closest('[data-facts]');
  if (!b) return;
  if (b.dataset.facts === 'trim') factsTrim = !factsTrim;
  else factsAll = b.dataset.facts === 'all';
  try { localStorage.setItem('zm-facts-all', factsAll ? '1' : '0'); localStorage.setItem('zm-facts-trim', factsTrim ? '1' : '0'); } catch {}
  renderWeak();
});

document.querySelectorAll('[data-window]').forEach(b => b.addEventListener('click', () => {
  weakWindow = b.dataset.window;
  try { localStorage.setItem('zm-weak', weakWindow); } catch {}
  renderWeak();
}));
