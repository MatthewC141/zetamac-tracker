// The progress dashboard, part 3 of 8: weak spots, the timing tower of question kinds.
// ---------- first viewport: weak spots (the timing tower) ----------
// Arithmetic operations ranked by seconds per question, slowest first. Sector colors follow live
// timing: purple = fastest operation, green = faster than in the previous window, yellow = slower.
const OPS = ['add', 'sub', 'mul', 'div'];
const OP_CODES = { add: 'ADD', sub: 'SUB', mul: 'MUL', div: 'DIV' };
let weakWindow = '10';
try { weakWindow = localStorage.getItem('zm-weak') || weakWindow; } catch {}
if (!['1', '10', 'all', 'picked'].includes(weakWindow)) weakWindow = '10';
// Games picked in Results (Pick) to show here together, by timestamp; remembered per browser.
const picked = new Set();
try { for (const ts of JSON.parse(localStorage.getItem('zm-picked') || '[]')) if (typeof ts === 'string') picked.add(ts); } catch {}
const savePicked = () => { try { localStorage.setItem('zm-picked', JSON.stringify([...picked])); } catch {} };
// How many of the slowest questions to list: 5, 10, 20 or all.
let slowCount = '5';
try { slowCount = localStorage.getItem('zm-slow-count') || slowCount; } catch {}
if (!['5', '10', '20', 'all'].includes(slowCount)) slowCount = '5';
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
// The slowest questions of the last game, or of the games picked in Results, each with a × to leave
// it out: "what if" that question had never come up. On a timed game its time goes to the rest of
// that game at your average pace there, so the score that would have been = score − questions left
// out + their time ÷ that pace; with several games, the line gives their average. On an endless run
// (no clock) it says how much shorter the run would have been. × all leaves out every listed one.
const whatIf = { id: null, out: new Set(), logs: [], games: [] };
const wiKey = (gi, i) => `${gi}:${i}`;
function slowestHTML(logs, games) {
  const id = games.map(g => g.ts).join(',');
  if (whatIf.id !== id) whatIf.out = new Set();  // other games start clear
  Object.assign(whatIf, { id, logs, games });
  const all = logs.flatMap((log, gi) => log.map((q, i) => ({ q, gi, i }))).sort((a, b) => b.q.t - a.q.t);
  if (!all.length) return '';
  const slow = slowCount === 'all' ? all : all.slice(0, Number(slowCount));
  const many = games.length > 1, allOut = slow.every(x => whatIf.out.has(wiKey(x.gi, x.i)));
  const when = g => `${dateLabel(parseDate(g.date))}${g.source === 'game' ? ` ${g.ts.slice(11, 16)}` : ''}`;
  return `<div id="wi-box"><div class="facts-head"><h3>Slowest questions in ${many ? `these ${games.length} games` : 'this game'}</h3>` +
    `<div class="facts-tools"><div class="seg" role="group" aria-label="Slowest questions to list">${['5', '10', '20', 'all'].map(c =>
      `<button type="button" data-slow-count="${c}" aria-pressed="${slowCount === c}">${c === 'all' ? `All ${all.length}` : c}</button>`).join('')}</div>` +
    `<div class="seg"><button type="button" class="wi-all" aria-pressed="${allOut}">${allOut ? 'Put all back' : '× all'}</button></div></div></div>` +
    `<ol class="tower facts slowq wi">${slow.map(({ q, gi, i }, n) => { const out = whatIf.out.has(wiKey(gi, i));
      return `<li class="op-${esc(q.o)}${out ? ' out' : ''}" data-k="${wiKey(gi, i)}"><span class="pos">${n + 1}</span><span class="stripe"></span>` +
      `<span class="fact-name">${esc(q.q)} = ${esc(q.a)}${many ? `<small class="wi-when">${esc(when(games[gi]))}</small>` : ''}</span>` +
      `<span class="track" aria-hidden="true"><i style="transform:scaleX(${(q.t / all[0].q.t).toFixed(3)})"></i></span>` +
      `<span class="time">${secs2(q.t)}<small>s</small></span><span class="gap">${q.c ? `${q.c} fix${q.c === 1 ? '' : 'es'}` : ''}</span>` +
      `<button type="button" class="wi-x" aria-pressed="${out}" aria-label="Leave out ${esc(q.q)}" title="What if this question never came up?">×</button></li>`; }).join('')}</ol>` +
    `<p class="wi-line" aria-live="polite">${whatIfLine()}</p></div>`;
}
function whatIfLine() {
  const { out, logs, games } = whatIf;
  const timed = games.some(g => g.seconds > 0);
  if (!out.size) return timed ? 'Press × on a question to see what you’d have scored if it never came up.' : 'Press × on a question to see how much quicker your run would have been without it.';
  const k = out.size, these = k === 1 ? 'that question' : `these ${k} questions`;
  // each game on its own: its left-out time, at its own pace on what's left
  let freedEndless = 0, emptied = false;
  const per = games.map((g, gi) => {
    const log = logs[gi], gone = log.map((q, i) => out.has(wiKey(gi, i)));
    const n = gone.filter(Boolean).length, rest = log.filter((_, i) => !gone[i]);
    const freed = log.reduce((t, q, i) => t + (gone[i] ? q.t : 0), 0);
    if (n && !rest.length) emptied = true;
    const pace = rest.length ? rest.reduce((t, q) => t + q.t, 0) / rest.length : 0;
    if (!(g.seconds > 0)) { freedEndless += freed; return null; }
    return { score: g.score, gain: n && pace ? freed / pace - n : 0, freed, pace, n };
  });
  if (emptied) return 'Leave at least one question of each game in to work out its pace.';
  const timedGames = per.filter(Boolean);
  const sign = x => `<span class="${x >= 0 ? 'up' : 'down'}">(${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(1)})</span>`;
  const endlessNote = freedEndless ? `${timedGames.length ? 'Your endless runs' : `Without ${these}: your run${games.length > 1 ? 's' : ''}`} would have been <b>${secs2(freedEndless)} s</b> shorter.` : '';
  if (!timedGames.some(x => x.n)) return endlessNote;
  if (games.length === 1) {
    const x = timedGames[0];
    return `Without ${these}: about <b>${Math.round(x.score + x.gain)}</b> instead of ${x.score} ${sign(x.gain)}` +
      `<small>Their ${secs2(x.freed)} s spent at your pace on the rest of this game, ${secs2(x.pace)} s a question.</small>`;
  }
  const before = timedGames.reduce((t, x) => t + x.score, 0) / timedGames.length;
  const gain = timedGames.reduce((t, x) => t + x.gain, 0) / timedGames.length;
  return `Without ${these}: an average of about <b>${(before + gain).toFixed(1)}</b> instead of ${before.toFixed(1)} across ${plural(timedGames.length, 'timed game')} ${sign(gain)}` +
    `<small>Each game’s left-out time spent at your pace on the rest of that game.${endlessNote ? ` ${endlessNote.replace(/<\/?b>/g, '')}` : ''}</small>`;
}
const redrawSlowest = () => { const box = $('#wi-box'); if (box) box.outerHTML = slowestHTML(whatIf.logs, whatIf.games); };
$('#weak').addEventListener('click', e => {
  const x = e.target.closest('.wi-x'), all = e.target.closest('.wi-all'), count = e.target.closest('[data-slow-count]');
  if (x) {
    const li = x.closest('li'), k = li.dataset.k;
    whatIf.out.has(k) ? whatIf.out.delete(k) : whatIf.out.add(k);
    li.classList.toggle('out', whatIf.out.has(k));
    x.setAttribute('aria-pressed', whatIf.out.has(k));
    const listed = [...document.querySelectorAll('#wi-box .slowq li')].map(r => r.dataset.k), allOut = listed.every(k2 => whatIf.out.has(k2));
    const btn = $('#wi-box .wi-all');
    btn.textContent = allOut ? 'Put all back' : '× all';
    btn.setAttribute('aria-pressed', allOut);
    $('#wi-box .wi-line').innerHTML = whatIfLine();
  } else if (all) {
    const listed = [...document.querySelectorAll('#wi-box .slowq li')].map(r => r.dataset.k);
    const allOut = listed.every(k => whatIf.out.has(k));
    for (const k of listed) allOut ? whatIf.out.delete(k) : whatIf.out.add(k);
    redrawSlowest();
    $('#wi-box .wi-all')?.focus();
  } else if (count) {
    slowCount = count.dataset.slowCount;
    try { localStorage.setItem('zm-slow-count', slowCount); } catch {}
    redrawSlowest();
  }
});

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
  // Picked: the games ticked in Results (Pick), on their own.
  const mine = timed.filter(g => picked.has(g.ts));
  const pick = $('[data-window="picked"]');
  pick.hidden = !picked.size;
  pick.textContent = `Picked · ${mine.length}`;
  if (weakWindow === 'picked' && !mine.length) {
    el.innerHTML = `<p class="empty-state">No ${o80 ? '80-in-8 tests' : 'arithmetic games'} picked. In Results, press Pick and tick the games to look at together.</p>`;
    return;
  }
  const n = weakWindow === 'all' ? timed.length : Number(weakWindow);
  const cur = weakWindow === 'picked' ? mine : timed.slice(0, n);
  const prev = weakWindow === 'all' || weakWindow === 'picked' ? [] : timed.slice(n, n + 10);
  const load = list => getDetails(list.map(g => g.ts)).catch(() => list.map(() => []));
  const [logs, prevLogs] = await Promise.all([load(cur), load(prev)]);
  const qs = logs.flat(), prevQs = prevLogs.flat();
  if (run !== weakRun) return;  // a newer render started while these loaded
  if (o80) return renderWeakO80(el, qs, prevQs, cur, prev);

  const now = avgBy(qs, q => (has(OP_CODES, q.o) ? q.o : null)), before = avgBy(prevQs, q => (has(OP_CODES, q.o) ? q.o : null));
  const rows = OPS.filter(o => now[o]).map(o => ({ op: o, ...now[o] })).sort((a, b) => b.avg - a.avg);
  if (!rows.length) { el.innerHTML = emptyMsg; return; }
  const fastest = Math.min(...rows.map(r => r.avg)), slowest = rows[0].avg;
  const sector = r => r.avg === fastest ? 's-purple' : before[r.op] ? (r.avg < before[r.op].avg ? 's-green' : 's-yellow') : '';

  // Remember where each row was so the new order can slide into place.
  const was = new Map([...el.querySelectorAll('.tower li[data-op]')].map(li => [li.dataset.op, { top: li.getBoundingClientRect().top, sector: li.dataset.sector }]));
  el.innerHTML =
    `<ol class="tower">${rows.map((r, i) => `<li class="op-${r.op} ${sector(r)}" data-op="${r.op}" data-sector="${sector(r)}">` +
      `<span class="pos">${i + 1}</span><span class="stripe"></span>` +
      `<span class="code" title="${OP_NAMES[r.op]}">${OP_CODES[r.op]}</span>` +
      `<span class="track" aria-hidden="true"><i style="transform:scaleX(${((r.avg / slowest * 100).toFixed(1)) / 100})"></i></span>` +
      `<span class="time">${secs2(r.avg)}<small>s</small></span>` +
      `<span class="gap">${r.avg === fastest ? 'Fastest' : `+${secs2(r.avg - fastest)}`}</span></li>`).join('')}</ol>` +
    `<div class="tower-note"><span>Seconds per question · ${plural(qs.length, 'question')} from ${weakWindow === 'picked' ? `${plural(cur.length, 'picked game')} · <button type="button" class="link-btn" data-clear-picks>Clear picks</button>` : plural(cur.length, 'game')}${prev.length ? `, compared with the ${prev.length === 1 ? 'game' : plural(prev.length, 'game')} before` : ''}</span>` +
    `<span class="key"><span class="s-purple">Fastest</span>${prev.length ? '<span class="s-green">Faster</span><span class="s-yellow">Slower</span>' : weakWindow !== 'all' && weakWindow !== 'picked' ? '<span>Faster / slower colors start after your next timed game</span>' : ''}</span></div>` +
    DRILL + factsHTML(qs) + (weakWindow === '1' || weakWindow === 'picked' ? slowestHTML(logs, cur) : '');

  renderHeatmap();  // the calendar beside the tower sizes itself to the tower's new height
  if (reduceMotion.matches) return;
  for (const li of el.querySelectorAll('.tower li[data-op]')) {  // (only the operation rows slide; the lists below have no op)
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

document.querySelectorAll('[data-window]').forEach(b => b.addEventListener('click', () => setWeakWindow(b.dataset.window)));
function setWeakWindow(w) {
  weakWindow = w;
  try { localStorage.setItem('zm-weak', weakWindow); } catch {}
  renderWeak();
}
$('#weak').addEventListener('click', e => {
  if (!e.target.closest('[data-clear-picks]')) return;
  picked.clear(); savePicked();
  renderRecent();
  setWeakWindow('10');
});
