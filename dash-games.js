// The progress dashboard, part 5 of 8: the results table, each game's question-by-question
// breakdown, logging a score by hand, deleting, and opening a game from a link.
// ---------- recent games ----------
function renderRecent() {
  const sorted = [...allGames].sort((a, b) => (b.ts > a.ts ? 1 : b.ts < a.ts ? -1 : b.i - a.i));
  // personal-best markers, in chronological order, tracked separately per game length
  const pbs = new Set();
  const best = {};
  [...sorted].reverse().forEach(g => {
    const k = `${g.mode || 'standard'}/${g.seconds}`;
    if (g.score > (best[k] ?? 0)) { best[k] = g.score; pbs.add(g.i); }  // a 0 is never a personal best
  });
  const f = recentFilter;
  const shown = sorted
    .filter(g => f.game === 'all' || (g.mode || 'standard') === f.game)
    .filter(g => f.len === 'all' || g.seconds === Number(f.len));
  // `sorted` is newest first; the other orders keep newest-first among ties.
  if (f.sort === 'old') shown.reverse();
  else if (f.sort === 'high') shown.sort((a, b) => b.score - a.score);
  else if (f.sort === 'low') shown.sort((a, b) => a.score - b.score);
  $('#r-count').textContent = `${plural(shown.length, 'game')}${shown.length > 100 ? ', showing 100' : ''} · open a game with an arrow to see every question's time`;
  const rows = shown.slice(0, 100).map(g => {
    const d = parseDate(g.date);
    const time = g.source === 'game' ? esc(g.ts.slice(11, 16)) : '<span class="src">logged</span>';
    const chev = '<span class="chev"></span>';
    return `<tr${g.detail ? ` class="has-detail" data-ts="${esc(g.ts)}" tabindex="0" aria-expanded="false"` : ''}><td>${chev}${dateLabel(d)}</td><td>${time}</td>` +
      `<td class="num">${has(SQ_MODES, g.mode) ? `<span class="len sq">${SQ_MODES[g.mode]}</span>` : ''}${has(PRACTICE_MODES, g.mode) ? `<span class="len pr">${PRACTICE_TAGS[g.mode]}</span>` : ''}${g.mode === 'mixed' ? '<span class="len mx">Combined</span>' : ''}${isTest(g.mode) ? `<span class="len o8">${TESTS[g.mode][0]}</span>` : ''}${g.daily ? '<span class="len dy">Daily</span>' : ''}${g.seconds === 30 ? '<span class="len">30 s</span>' : ''}${g.seconds === 0 ? `<span class="len end">Endless ${clock(g.elapsed || 0)}</span>` : ''}<b>${g.score}</b>${pbs.has(g.i) ? '<span class="pb">PB</span>' : ''}</td>` +
      `<td class="num editcol"><button class="del" title="Delete this score" aria-label="Delete score ${g.score} on ${esc(g.date)}" data-i="${g.i}" data-ts="${esc(g.ts)}"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 2l8 8M10 2l-8 8"/></svg></button></td></tr>`;
  });
  $('#recent').innerHTML = rows.join('') || `<tr><td colspan="4" class="src" style="padding:16px 6px">${allGames.length ? 'No games match these filters.' : 'No games yet.'}</td></tr>`;
  // Re-open whatever was expanded before a re-render.
  for (const ts of [...openGames]) {
    const tr = $(`#recent tr[data-ts="${CSS.escape(ts)}"]`);
    if (tr) expandGame(tr); else openGames.delete(ts);
  }
}

// Recent-games filter and sort, remembered per browser.
const recentFilter = { game: 'all', len: 'all', sort: 'new' };
try {
  const saved = JSON.parse(localStorage.getItem('zm-recent') || '{}');
  for (const k of Object.keys(recentFilter)) if (typeof saved?.[k] === 'string') recentFilter[k] = saved[k];
} catch {}
for (const [key, id] of [['game', '#r-game'], ['len', '#r-len'], ['sort', '#r-sort']]) {
  const el = $(id);
  if ([...el.options].some(o => o.value === recentFilter[key])) el.value = recentFilter[key];
  else recentFilter[key] = el.value;
  el.addEventListener('change', () => {
    recentFilter[key] = el.value;
    try { localStorage.setItem('zm-recent', JSON.stringify(recentFilter)); } catch {}
    renderRecent();
  });
}

// ---------- per-question breakdown (expands under a recent game) ----------
const OP_NAMES = { add: 'Addition', sub: 'Subtraction', mul: 'Multiplication', div: 'Division', sq: 'Squares', mix: 'Combined', dec: 'Decimals', pct: 'Percentages', seq: 'Sequences', frac: 'Fractions', est: 'Estimation' };
const detailCache = new Map();
const openGames = new Set();
const secs = ms => (ms / 1000).toFixed(ms < 10000 ? 2 : 1);

// Question logs are stored as the game sent them, so each field is coerced to its expected type
// before anything renders it.
const cleanLog = raw => (Array.isArray(raw) ? raw : []).filter(q => q && typeof q === 'object').map(q => ({
  q: String(q.q ?? ''), a: String(q.a ?? ''),
  o: /^[a-z]{1,8}$/.test(q.o) ? q.o : 'other',
  c: Math.max(0, Math.floor(Number(q.c) || 0)), t: Math.max(0, Number(q.t) || 0),
  // The quant tests mark each question right (y), wrong (n) or skipped (s), with what was typed.
  r: ['y', 'n', 's'].includes(q.r) ? q.r : 'y', g: String(q.g ?? '').slice(0, 12),
}));
async function getDetail(ts) {
  if (!detailCache.has(ts)) detailCache.set(ts, cleanLog((await api(`api/detail?ts=${encodeURIComponent(ts)}`)).questions));
  return detailCache.get(ts);
}
// Several games' logs in one request (api/details), for the panels that read many at once.
async function getDetails(list) {
  const want = list.filter(ts => !detailCache.has(ts));
  for (let k = 0; k < want.length; k += 100) {
    const part = want.slice(k, k + 100);
    const got = (await api(`api/details?ts=${part.map(encodeURIComponent).join(',')}`)).details || {};
    for (const ts of part) detailCache.set(ts, cleanLog(got[ts]));
  }
  return list.map(ts => detailCache.get(ts) || []);
}

function breakdownHTML(qs, sortSlow) {
  // Timings count answered questions; a skip (80 in 8) is listed but isn't a time to answer.
  const answered = qs.filter(q => q.r !== 's');
  const times = (answered.length ? answered : qs).map(q => q.t);
  const sorted = [...times].sort((a, b) => a - b);
  const total = times.reduce((a, b) => a + b, 0);
  const mid = sorted.length / 2;
  const median = sorted.length % 2 ? sorted[Math.floor(mid)] : (sorted[mid - 1] + sorted[mid]) / 2;
  const corrections = qs.reduce((n, q) => n + (q.c || 0), 0);
  const stats = [
    [secs(total / qs.length) + ' s', 'average'],
    [secs(median) + ' s', 'median'],
    [secs(sorted[0]) + ' s', 'fastest'],
    [secs(sorted[sorted.length - 1]) + ' s', 'slowest'],
  ];
  // average per operation, slowest first
  const byOp = {};
  for (const q of answered) (byOp[q.o] ||= []).push(q.t);
  const ops = Object.entries(byOp).map(([o, t]) => [o, t.reduce((a, b) => a + b, 0) / t.length, t.length]).sort((a, b) => b[1] - a[1]);

  // bar chart: one bar per question, in the order they were answered
  const W = 520, H = 130, m = { l: 26, r: 4, t: 6, b: 16 };
  const top = Math.max(1, Math.ceil(sorted[sorted.length - 1] / 1000));
  const step = top <= 4 ? 1 : top <= 10 ? 2 : 5;
  const bw = (W - m.l - m.r) / qs.length;
  const Y = ms => m.t + (1 - ms / (top * 1000)) * (H - m.t - m.b);
  let svg = '';
  for (let v = 0; v <= top; v += step) svg += `<line class="gridline" x1="${m.l}" x2="${W - m.r}" y1="${Y(v * 1000)}" y2="${Y(v * 1000)}"/><text x="${m.l - 4}" y="${Y(v * 1000) + 3}" text-anchor="end">${v}s</text>`;
  qs.forEach((q, i) => {
    const x = m.l + i * bw, y = Y(q.t);
    const tip = `#${i + 1}  ${q.q} = ${q.a}  ·  ${secs(q.t)} s${q.r === 'n' ? `  ·  wrong (typed ${q.g})` : q.r === 's' ? '  ·  skipped' : ''}${q.c ? `  ·  ${plural(q.c, 'correction')}` : ''}`;
    svg += `<rect class="op-${esc(q.o)}" x="${x + Math.min(1, bw * 0.15)}" y="${y}" width="${Math.max(0.6, bw - Math.min(2, bw * 0.3))}" height="${H - m.b - y}"><title>${esc(tip)}</title></rect>`;
  });
  svg += `<text x="${m.l}" y="${H - 3}">#1</text><text x="${W - m.r}" y="${H - 3}" text-anchor="end">#${qs.length}</text>`;

  // question list, colored against this game's own median
  const rows = qs.map((q, i) => ({ ...q, n: i + 1 }));
  if (sortSlow) rows.sort((a, b) => b.t - a.t);
  const cls = t => t >= median * 2 ? 'slow' : t <= median * 0.6 ? 'fast' : '';
  const shown = q => q.r === 'n' ? `${esc(q.q)} = <s class="miss" title="Typed">${esc(q.g)}</s> ${esc(q.a)}`
    : `${esc(q.q)} = ${esc(q.a)}${q.r === 's' ? ' <span class="src">skipped</span>' : ''}`;
  const list = rows.map(q => `<tr><td class="src">${q.n}</td><td>${shown(q)}</td><td class="num ${cls(q.t)}">${secs(q.t)} s</td><td class="num src">${q.c ? `${q.c} fix${q.c === 1 ? '' : 'es'}` : ''}</td></tr>`).join('');

  return `<div class="bd-stats">${stats.map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('')}</div>` +
    `<div class="bd-ops">${ops.map(([o, avg, n]) => `<span><i class="op-${esc(o)}"></i>${(has(OP_NAMES, o) ? OP_NAMES[o] : esc(o))} <b>${secs(avg)} s</b> avg · ${n}</span>`).join('')}` +
    `<span>${plural(corrections, 'correction')}</span>` +
    (qs.some(q => q.r !== 'y') ? `<span>${qs.filter(q => q.r === 'y').length} right · ${qs.filter(q => q.r === 'n').length} wrong · ${qs.filter(q => q.r === 's').length} skipped</span>` : '') + `</div>` +
    `<svg class="bd-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Seconds per question, in order">${svg}</svg>` +
    `<div class="bd-list-head"><span>Every question · red = over 2× your median, green = quick</span><span><button class="bd-replay" type="button">Replay</button> <button class="bd-sort" data-slow="${sortSlow ? 1 : 0}">${sortSlow ? 'Show in order' : 'Sort slowest first'}</button></span></div>` +
    `<div class="bd-list"><table><tbody>${list}</tbody></table></div>`;
}

async function expandGame(tr, sortSlow = false) {
  const ts = tr.dataset.ts;
  let row = tr.nextElementSibling;
  if (!row || !row.classList.contains('detail-row')) {
    row = document.createElement('tr');
    row.className = 'detail-row';
    row.innerHTML = '<td colspan="4"><span class="src">Loading…</span></td>';
    tr.after(row);
  }
  tr.classList.add('open');
  tr.setAttribute('aria-expanded', 'true');
  openGames.add(ts);
  try {
    const qs = await getDetail(ts);
    row.firstElementChild.innerHTML = qs.length ? breakdownHTML(qs, sortSlow) : '<span class="src">No questions were answered in this game.</span>';
  } catch (err) {
    row.firstElementChild.innerHTML = `<span class="src">${esc(err.message)}</span>`;
  }
}

function collapseGame(tr) {
  const row = tr.nextElementSibling;
  if (row && row.classList.contains('detail-row')) row.remove();
  tr.classList.remove('open');
  tr.setAttribute('aria-expanded', 'false');
  openGames.delete(tr.dataset.ts);
}

const toggleGame = tr => tr.classList.contains('open') ? collapseGame(tr) : expandGame(tr);

$('#f-date').value = dateKey(today());
$('#f-date').max = dateKey(today());
$('#add').addEventListener('submit', async e => {
  e.preventDefault();
  const msg = $('#f-msg');
  try {
    const seconds = $('#f-len').value, mode = $('#f-mode').value;
    setGames(await api('api/scores', { date: $('#f-date').value, score: $('#f-score').value, seconds, mode }));
    msg.className = 'msg ok';
    const kind = `${has(SQ_MODES, mode) ? `${SQ_MODES[mode].toLowerCase()}, ` : ''}${seconds === '30' ? '30 seconds' : '2 minutes'}`;
    msg.textContent = `Logged ${$('#f-score').value} (${kind}) for ${shortDate(parseDate($('#f-date').value))}.`;
    $('#f-score').value = '';
    $('#f-score').focus();
    render();
  } catch (err) {
    msg.className = 'msg err';
    msg.textContent = err.message;
  }
});

$('#recent').addEventListener('click', async e => {
  const rp = e.target.closest('.bd-replay');
  if (rp) {
    const ts = rp.closest('tr.detail-row').previousElementSibling.dataset.ts;
    const g = allGames.find(x => x.ts === ts);
    return replay.open(await getDetail(ts), g);
  }
  const sort = e.target.closest('.bd-sort');
  if (sort) return expandGame(sort.closest('tr.detail-row').previousElementSibling, sort.dataset.slow !== '1');
  const game = e.target.closest('tr.has-detail');
  if (game && !e.target.closest('.del')) return toggleGame(game);
  const b = e.target.closest('.del');
  if (!b || !confirm('Delete this score?')) return;
  try {
    setGames(await api('api/delete', { index: b.dataset.i, ts: b.dataset.ts }));
    render();
  } catch (err) {
    alert(err.message);
    load();
  }
});

$('#edit-toggle').addEventListener('click', e => {
  const on = $('.recent-scroll').classList.toggle('editing');
  e.target.setAttribute('aria-pressed', on);
  e.target.textContent = on ? 'Done' : 'Edit';
});

$('#recent').addEventListener('keydown', e => {
  const game = e.target.closest('tr.has-detail');
  if (game && e.target === game && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggleGame(game); }
});

// Arriving from a game's "See breakdown" link (/#game=<timestamp>): open that game.
async function openFromHash() {
  const m = location.hash.match(/^#game=(.+)$/);
  if (!m) return;
  let ts;
  try { ts = decodeURIComponent(m[1]); } catch { return; }  // a mangled link just opens the page
  const find = () => $(`#recent tr[data-ts="${CSS.escape(ts)}"]`);
  let tr = find();
  if (!tr) {  // hidden by the filters: show everything, newest first
    Object.assign(recentFilter, { game: 'all', len: 'all', sort: 'new' });
    $('#r-game').value = 'all'; $('#r-len').value = 'all'; $('#r-sort').value = 'new';
    renderRecent();
    tr = find();
  }
  if (!tr) return;
  if (!tr.classList.contains('open')) await expandGame(tr);
  tr.scrollIntoView({ block: 'start', behavior: 'smooth' });
}
window.addEventListener('hashchange', openFromHash);
