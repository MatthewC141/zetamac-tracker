// The progress dashboard (index.html). Kept out of the page so the page's security policy can refuse inline scripts.
const $ = s => document.querySelector(s);
const DAY = 864e5;
const EPOCH = new Date(2000, 0, 1);
const RANGES = { '1m': 30, '3m': 91, '1y': 365, all: null };
const RANGE_SHORT = { '1m': '1 mo', '3m': '3 mo', '1y': '1 yr', all: 'all time' };
const RANGE_NAMES = { '1m': 'past month', '3m': 'past 3 months', '1y': 'past year', all: 'all time' };
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

let allGames = [], games = [], sprints = [], endless = [];  // everything / chosen game at 120 s / chosen game at 30 s / endless runs
const SQ_MODES = { sq99: 'Two-digit', sq99h: 'Two-digit hard', sq999: 'Three-digit', sq999h: 'Three-digit hard' };
const PRACTICE_MODES = { 'sub-borrow': 'Subtraction with borrowing', 'sub-easy': 'Subtraction without borrowing' };
const PRACTICE_TAGS = { 'sub-borrow': 'Borrowing practice', 'sub-easy': 'No-borrow practice' };
// Games that are saved but not shown anywhere on the dashboard (yet).
const HIDDEN_MODES = new Set(['guided']);
// Table lookups by own key only, so a stray name like "toString" never matches a mode.
const has = (table, key) => typeof key === 'string' && Object.hasOwn(table, key);
const modeName = m => has(SQ_MODES, m) ? `${SQ_MODES[m]} squares` : has(PRACTICE_MODES, m) ? PRACTICE_MODES[m] : 'Arithmetic';
// The game the stat tiles and score chart show (a mode key, e.g. 'standard' or 'sq99').
let chartGame = 'standard';
try { chartGame = localStorage.getItem('zm-chart-game') || chartGame; } catch {}
let range = '3m';
try { range = localStorage.getItem('zm-range') || range; } catch {}
if (!has(RANGES, range)) range = '3m';

const parseDate = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const dateKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const today = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
const dayIdx = d => Math.round((d - EPOCH) / DAY);
const shortDate = d => `${MONTHS[d.getMonth()]} ${d.getDate()}`;
const dateLabel = d => d.getFullYear() === new Date().getFullYear() ? shortDate(d) : `${shortDate(d)}, ${d.getFullYear()}`;
const longDate = d => `${d.toLocaleDateString(undefined, { weekday: 'short' })} ${shortDate(d)}, ${d.getFullYear()}`;
const round1 = v => Math.round(v * 10) / 10;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function startOf(r = range) {
  const days = RANGES[r];
  if (days) return addDays(today(), -(days - 1));
  if (!games.length) return addDays(today(), -29);
  let min = games[0].date;
  for (const g of games) if (g.date < min) min = g.date;
  const d = parseDate(min);
  return d < addDays(today(), -6) ? d : addDays(today(), -6);
}

function byDay(list) {
  const map = new Map();
  for (const g of list) {
    let d = map.get(g.date);
    if (!d) map.set(g.date, d = { key: g.date, date: parseDate(g.date), best: 0, sum: 0, n: 0 });
    d.best = Math.max(d.best, g.score);
    d.sum += g.score;
    d.n++;
  }
  return [...map.values()].sort((a, b) => a.date - b.date);
}

function streak() {
  const played = new Set(allGames.map(g => g.date));
  let d = today();
  if (!played.has(dateKey(d))) d = addDays(d, -1);
  let n = 0;
  while (played.has(dateKey(d))) { n++; d = addDays(d, -1); }
  return n;
}

// ---------- stats ----------
function renderStats() {
  const from = startOf();
  const inRange = games.filter(g => parseDate(g.date) >= from);
  const days = byDay(inRange);
  const allBest = games.reduce((m, g) => Math.max(m, g.score), 0);
  const rangeBest = inRange.reduce((m, g) => Math.max(m, g.score), 0);
  const avg = inRange.length ? inRange.reduce((s, g) => s + g.score, 0) / inRange.length : 0;

  // Compare the average over the last 7 days vs the 7 days before that.
  const t = today();
  const w1 = games.filter(g => parseDate(g.date) > addDays(t, -7));
  const w0 = games.filter(g => { const d = parseDate(g.date); return d > addDays(t, -14) && d <= addDays(t, -7); });
  const mean = l => l.reduce((s, g) => s + g.score, 0) / l.length;
  let delta = '';
  if (w1.length && w0.length) {
    const diff = round1(mean(w1) - mean(w0));
    delta = `<span class="${diff >= 0 ? 'up' : 'down'}">${diff >= 0 ? '+' : ''}${diff}</span> vs prior week`;
  }
  const s = streak();
  const r = RANGE_SHORT[range];
  const items = [
    ...(chartGame === 'standard' ? [] : [[allBest || '—', `all-time best (${plural(games.length, '2-minute game')})`], [rangeBest || '—', `best · ${r}`]]),
    [inRange.length ? round1(avg) : '—', `average · ${r}`],
    [w1.length ? round1(mean(w1)) : '—', `last 7 days${delta ? ` (${delta})` : ''}`],
    [inRange.length, `games on ${plural(days.length, 'day')} · ${r}`],
    [s, `day${s === 1 ? '' : 's'} streak`],
  ];
  $('#stats').innerHTML = items.map(([v, l]) => `<span><b>${v}</b>${l}</span>`).join('');
}

// ---------- chart ----------
function niceStep(span) {
  for (const s of [1, 2, 5, 10, 20, 25, 50, 100]) if (span / s <= 6) return s;
  return 200;
}

// Draws a score chart. `series` are lines ({cls, ptCls, pts: [[Date, value]]}), `dots` are
// individual games ([Date, value]), and `tipFor(day)` gives the hover text for a played day.
// Lines the viewer has switched off with the legend buttons ('best', 'proj', 'games').
const chartHidden = new Set();
try { for (const k of JSON.parse(localStorage.getItem('zm-hidden') || '[]')) chartHidden.add(k); } catch {}

// Draws a score chart. `series` are lines ({key, cls, ptCls, pts: [[Date, value]]}), `dots` are
// individual games ([Date, value]), and `tipFor(day)` gives the hover text for a played day.
// The x-axis runs from the first to the last played day, so the newest data sits at the right edge.
function drawChart(svg, tip, { days, series, dots, tipFor, tipY, empty, target }) {
  const W = svg.clientWidth || 800, H = svg.clientHeight || 320;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const m = { l: 34, r: 10, t: 12, b: 24 }, inset = 8;
  svg.onmousemove = svg.onmouseleave = null;
  tip.style.opacity = 0;

  if (!days.length) {
    svg.innerHTML = `<text class="empty" x="${W / 2}" y="${H / 2}" text-anchor="middle">${empty}</text>`;
    return;
  }

  const shown = series.filter(s => !chartHidden.has(s.key));
  const shownDots = chartHidden.has('games') ? [] : dots;
  let values = [...shownDots.map(p => p[1]), ...shown.flatMap(s => s.pts.map(p => p[1]))];
  if (!values.length) values = [...dots.map(p => p[1]), ...series.flatMap(s => s.pts.map(p => p[1]))];  // keep the axes when everything is off
  const showTarget = target && !chartHidden.has('target');
  if (showTarget) values.push(target);
  let lo = Math.max(0, Math.floor((Math.min(...values) - 4) / 5) * 5);
  let hi = Math.ceil((Math.max(...values) + 4) / 5) * 5;
  if (hi - lo < 10) hi = lo + 10;
  const step = niceStep(hi - lo);
  lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;

  const last = days[days.length - 1].date;
  const x1 = dayIdx(last), x0 = Math.min(dayIdx(days[0].date), x1 - 1);  // one day of data still gets some room
  const span = x1 - x0, first = addDays(last, -span);
  const X = d => m.l + inset + (dayIdx(d) - x0) / span * (W - m.l - m.r - inset * 2);
  const Y = v => m.t + (1 - (v - lo) / (hi - lo)) * (H - m.t - m.b);
  let h = '';

  for (let v = lo; v <= hi; v += step) {
    h += `<line class="gridline" x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}"/>`;
    h += `<text x="${m.l - 6}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`;
  }

  // x ticks: counted back from the newest day for short spans, month starts for long ones.
  const ticks = [];
  if (span <= 60) {
    const every = span <= 10 ? 1 : span <= 21 ? 3 : 7;
    for (let d = last; d >= first; d = addDays(d, -every)) ticks.push([d, shortDate(d)]);
  } else {
    for (let d = new Date(first.getFullYear(), first.getMonth() + 1, 1); d <= last; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
      ticks.push([d, d.getMonth() === 0 ? String(d.getFullYear()) : MONTHS[d.getMonth()]]);
    }
  }
  ticks.sort((a, b) => a[0] - b[0]);
  const thin = Math.max(1, Math.ceil(ticks.length / Math.max(2, Math.floor((W - m.l) / 70))));
  // Thin from the right so the newest tick always shows.
  ticks.forEach(([d, label], i) => {
    if ((ticks.length - 1 - i) % thin) return;
    h += `<text x="${X(d)}" y="${H - 6}" text-anchor="middle">${label}</text>`;
  });
  h += `<line class="axis" x1="${m.l}" x2="${W - m.r}" y1="${H - m.b}" y2="${H - m.b}"/>`;
  if (showTarget) {
    h += `<line class="target" x1="${m.l}" x2="${W - m.r}" y1="${Y(target)}" y2="${Y(target)}"/>`;
    h += `<text class="target-label" x="${m.l + inset}" y="${Y(target) - 6}">TARGET ${target}</text>`;
  }

  // individual games, jittered a little within their day so repeats don't stack
  const perDay = new Map();
  for (const [d, v] of shownDots) {
    const k = (perDay.get(+d) || 0) + 1; perDay.set(+d, k);
    const jitter = span > 120 ? 0 : ((k * 37) % 7 - 3) * 0.8;
    h += `<circle class="game" cx="${X(d) + jitter}" cy="${Y(v)}" r="2.4"/>`;
  }

  const ptR = days.length > 120 ? 2 : 3.2;
  for (const s of shown) {
    // A gap of more than a week breaks the line rather than drawing data that doesn't exist.
    if (s.pts.length > 1 || !s.ptCls) h += `<path class="${s.cls}" d="${s.pts.map(([d, v], i) => `${i && dayIdx(d) - dayIdx(s.pts[i - 1][0]) <= 7 ? 'L' : 'M'}${X(d)},${Y(v)}`).join('')}"/>`;
    if (s.square) for (const [d, v] of s.pts) h += `<rect class="${s.ptCls}" x="${X(d) - ptR - 1}" y="${Y(v) - ptR - 1}" width="${ptR * 2 + 2}" height="${ptR * 2 + 2}"/>`;
    else if (s.ptCls) for (const [d, v, pb] of s.pts) h += `<circle class="${s.ptCls}${pb ? ' pb-pt' : ''}" cx="${X(d)}" cy="${Y(v)}" r="${pb ? ptR + 1 : ptR}"/>`;
  }
  h += `<line class="guide" y1="${m.t}" y2="${H - m.b}" x1="-10" x2="-10"/>`;
  svg.innerHTML = h;

  const guide = svg.querySelector('.guide');
  const hide = () => { tip.style.opacity = 0; guide.setAttribute('x1', -10); guide.setAttribute('x2', -10); };
  svg.onmousemove = e => {
    const r = svg.getBoundingClientRect();
    const mx = (e.clientX - r.left) * (W / r.width);
    let best = null, dist = Infinity;
    days.forEach((d, i) => { const dx = Math.abs(X(d.date) - mx); if (dx < dist) { dist = dx; best = i; } });
    if (best === null || dist > 40) return hide();
    const d = days[best];
    const x = X(d.date);
    guide.setAttribute('x1', x); guide.setAttribute('x2', x);
    tip.innerHTML = tipFor(d);
    tip.style.left = `${Math.min(Math.max(x * r.width / W, 110), r.width - 110)}px`;
    tip.style.top = `${Math.max(Y(tipY(d)), 40) * r.height / H}px`;
    tip.style.opacity = 1;
  };
  svg.onmouseleave = hide;
}

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

// A 30-second score scaled to a full 2-minute game.
const PROJECT = 120 / 30;
// The 2-minute arithmetic score the player is training toward (trading-firm screens).
const TARGET = 80;

function renderChart() {
  $('#legend [data-series="target"]').hidden = chartGame !== 'standard';
  document.querySelectorAll('.tabs button[data-range]').forEach(b => b.setAttribute('aria-pressed', b.dataset.range === range));
  $('#chart-title').innerHTML = `${esc(modeName(chartGame))} <span class="h-note">${RANGE_NAMES[range]}</span>`;
  const from = startOf();
  const fullIn = games.filter(g => parseDate(g.date) >= from);
  const shortIn = sprints.filter(g => parseDate(g.date) >= from);
  const fullDays = byDay(fullIn), shortDays = byDay(shortIn);
  // Days whose best set a new personal best at the time (over all history, not just this range).
  const pbDays = new Set();
  let runningBest = -1;
  for (const d of byDay(games)) if (d.best > runningBest) { runningBest = d.best; pbDays.add(d.key); }

  // One entry per played day for hover, merging 2-minute and 30-second games.
  const merged = new Map();
  for (const d of fullDays) merged.set(d.key, { key: d.key, date: d.date, full: d });
  for (const d of shortDays) merged.set(d.key, { ...(merged.get(d.key) || { key: d.key, date: d.date }), short: d });
  const days = [...merged.values()].sort((a, b) => a.date - b.date);

  drawChart($('#chart'), $('#tip'), {
    days,
    series: [
      { key: 'proj', cls: 'proj', ptCls: 'proj-pt', square: true, pts: shortDays.map(d => [d.date, d.best * PROJECT]) },
      { key: 'best', cls: 'best', ptCls: 'best-pt', pts: fullDays.map(d => [d.date, d.best, pbDays.has(d.key)]) },
    ],
    dots: fullIn.map(g => [parseDate(g.date), g.score]),
    tipFor: d => [
      longDate(d.date),
      d.full ? `<b>${d.full.best}</b> best${pbDays.has(d.key) ? ' · new personal best' : ''} · ${round1(d.full.sum / d.full.n)} avg · ${plural(d.full.n, 'game')}` : '',
      d.short ? `30 s: <b>${d.short.best}</b> best → ${d.short.best * PROJECT} projected · ${plural(d.short.n, 'game')}` : '',
    ].filter(Boolean).join('<br>'),
    tipY: d => d.full ? d.full.best : d.short.best * PROJECT,
    target: chartGame === 'standard' ? TARGET : null,
    empty: has(PRACTICE_MODES, chartGame)
      ? `No timed runs in the ${RANGE_NAMES[range]} yet. Endless runs show in the Practice and Endless sections below.`
      : `No 2-minute or 30-second games in the ${RANGE_NAMES[range]} yet.`,
  });
}

// ---------- practice drills ----------
// Seconds per question: a timed game's length, or an endless run's elapsed time, over its score.
function secPerQuestion(list) {
  let time = 0, qs = 0;
  for (const g of list) {
    if (!g.score) continue;
    time += g.seconds || g.elapsed || 0;
    qs += g.score;
  }
  return qs ? `${(time / qs).toFixed(2)} s` : '—';
}

function renderPractice() {
  const weekAgo = addDays(today(), -6);
  $('#practice-rows').innerHTML = Object.entries(PRACTICE_MODES).map(([mode, name]) => {
    const list = allGames.filter(g => g.mode === mode);
    const best = secs => list.filter(g => g.seconds === secs).reduce((m, g) => Math.max(m, g.score), 0) || '—';
    return `<tr><td class="lead">${name}</td><td class="num" data-label="Games">${list.length}</td><td class="num" data-label="Best 2 min">${best(120)}</td><td class="num" data-label="Best 30 s">${best(30)}</td>` +
      `<td class="num" data-label="Longest endless">${best(0)}</td><td class="num" data-label="Avg per question"><b>${secPerQuestion(list)}</b></td>` +
      `<td class="num" data-label="Last 7 days">${secPerQuestion(list.filter(g => parseDate(g.date) >= weekAgo))}</td></tr>`;
  }).join('');
}

// ---------- endless runs ----------
const clock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const gameName = g => modeName(g.mode);
const pace = g => g.elapsed && g.score ? `${(g.elapsed / g.score).toFixed(2)} s` : '—';

function renderEndless() {
  const longest = list => list.reduce((b, g) => (!b || g.score > b.score ? g : b), null);
  const record = (label, g) => g && `<div><span>${label}</span><b>${g.score}</b><em>in ${clock(g.elapsed || 0)} · ${shortDate(parseDate(g.date))}${has(SQ_MODES, g.mode) ? ` · ${SQ_MODES[g.mode]}` : ''}</em></div>`;
  const total = endless.reduce((n, g) => n + g.score, 0);
  $('#endless-stats').innerHTML = endless.length ? [
    record('Longest run · Arithmetic', longest(endless.filter(g => (g.mode || 'standard') === 'standard'))),
    record('Longest run · Squares', longest(endless.filter(g => has(SQ_MODES, g.mode)))),
    record('Longest run · Practice', longest(endless.filter(g => has(PRACTICE_MODES, g.mode)))),
    `<div><span>Questions answered</span><b>${total}</b><em>across ${plural(endless.length, 'run')}</em></div>`,
  ].filter(Boolean).join('') : '';

  const top = [...endless].sort((a, b) => b.score - a.score || (a.elapsed || 0) - (b.elapsed || 0)).slice(0, 10);
  $('#endless-runs').innerHTML = top.map((g, i) => {
    const d = parseDate(g.date);
    return `<tr><td class="rank" data-label="#">${i + 1}</td><td data-label="Date">${dateLabel(d)}</td><td class="lead">${gameName(g)}</td>` +
      `<td class="num" data-label="Questions"><b>${g.score}</b></td><td class="num" data-label="Time">${clock(g.elapsed || 0)}</td><td class="num" data-label="Sec per problem">${pace(g)}</td></tr>`;
  }).join('') || '<tr><td colspan="6" class="src" style="padding:16px 6px">No endless runs yet. Choose “Endless” as the duration on the Play or Squares page.</td></tr>';
}

// ---------- heatmap (past year, one square per day) ----------
function renderHeatmap() {
  const end = today();
  // Squares grow to fill the panel's height when it is stretched beside the tower, then as many
  // whole weeks as fit the width (up to a year) end with this week.
  const left = 26, top = 16, gap = 3;
  const svg = $('#heat');
  svg.setAttribute('height', 0);
  const room = svg.parentElement.clientWidth || 900;
  const tall = Math.floor((svg.parentElement.clientHeight - top) / 7) - gap;
  const size = Math.max(10, Math.min(24, tall));
  const weeks = Math.max(8, Math.min(53, Math.floor((room - left) / (size + gap))));
  const start = addDays(end, -(weeks - 1) * 7 - end.getDay());
  // Shade by standard-game score (30-second games projected); squares-only days get the lightest shade.
  const std = allGames.filter(g => (g.mode || 'standard') === 'standard' && g.seconds > 0);
  const days = new Map(byDay(std.map(g => g.seconds === 30 ? { ...g, score: g.score * PROJECT } : g)).map(d => [d.key, d]));
  const sqDays = new Map(byDay(allGames.filter(g => (g.mode || 'standard') !== 'standard' || g.seconds === 0)).map(d => [d.key, d]));
  const yearBests = [...days.values()].filter(d => d.date >= start).map(d => d.best).sort((a, b) => a - b);
  const q = p => yearBests[Math.min(yearBests.length - 1, Math.floor(p * yearBests.length))];
  const cuts = yearBests.length ? [q(0.25), q(0.5), q(0.75)] : [];
  const level = v => 1 + cuts.filter(c => v > c).length;

  // Fill the panel's width; below 10px a cell stops being readable, so narrow panels show fewer weeks.
  const cell = Math.max(10, Math.min(tall > 10 ? size : 20, Math.floor((room - left) / weeks) - gap));
  const W = left + weeks * (cell + gap), H = top + 7 * (cell + gap);
  svg.setAttribute('width', W); svg.setAttribute('height', H);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  let h = '';
  [['Mon', 1], ['Wed', 3], ['Fri', 5]].forEach(([l, r]) => { h += `<text x="0" y="${top + r * (cell + gap) + cell * .8}">${l}</text>`; });
  let lastMonth = -1, played = 0;
  for (let d = start, i = 0; d <= end; d = addDays(d, 1), i++) {
    const col = Math.floor(i / 7), row = d.getDay();
    const x = left + col * (cell + gap), y = top + row * (cell + gap);
    if (row === 0 && d.getMonth() !== lastMonth && d.getDate() <= 7) {
      lastMonth = d.getMonth();
      if (col < weeks - 1) h += `<text x="${x}" y="10">${MONTHS[lastMonth]}</text>`;
    }
    const info = days.get(dateKey(d)), sq = sqDays.get(dateKey(d));
    if (info || sq) played++;
    const fill = info ? `var(--heat-${level(info.best)})` : sq ? 'var(--heat-1)' : 'var(--heat-0)';
    const parts = [];
    if (info) parts.push(`best ${round1(info.best)}, ${plural(info.n, 'game')}`);
    if (sq) parts.push(`${plural(sq.n, 'squares, practice or endless game')}`);
    const title = parts.length ? `${longDate(d)}: ${parts.join(' · ')}` : `${longDate(d)}: not played`;
    h += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${fill}"><title>${title}</title></rect>`;
  }
  svg.innerHTML = h;
  $('#heat-title').innerHTML = `Days played <span class="h-note">${played} in the last ${weeks >= 52 ? 'year' : Math.round(weeks / 4.35) + ' months'}</span>`;
  const sc = svg.parentElement; sc.scrollLeft = sc.scrollWidth;
}

// ---------- recent games ----------
function renderRecent() {
  const sorted = [...allGames].sort((a, b) => (b.ts > a.ts ? 1 : b.ts < a.ts ? -1 : b.i - a.i));
  // personal-best markers, in chronological order, tracked separately per game length
  const pbs = new Set();
  const best = {};
  [...sorted].reverse().forEach(g => {
    const k = `${g.mode || 'standard'}/${g.seconds}`;
    if (g.score > (best[k] ?? -1)) { best[k] = g.score; pbs.add(g.i); }
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
      `<td class="num">${has(SQ_MODES, g.mode) ? `<span class="len sq">${SQ_MODES[g.mode]} squares</span>` : ''}${has(PRACTICE_MODES, g.mode) ? `<span class="len pr">${PRACTICE_TAGS[g.mode]}</span>` : ''}${g.seconds === 30 ? '<span class="len">30 s</span>' : ''}${g.seconds === 0 ? `<span class="len end">Endless ${clock(g.elapsed || 0)}</span>` : ''}<b>${g.score}</b>${pbs.has(g.i) ? '<span class="pb">PB</span>' : ''}</td>` +
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

// ---------- first viewport: weak spots (the timing tower) ----------
// Arithmetic operations ranked by seconds per question, slowest first. Sector colors follow live
// timing: purple = fastest operation, green = faster than in the previous window, yellow = slower.
const OPS = ['add', 'sub', 'mul', 'div'];
const OP_CODES = { add: 'ADD', sub: 'SUB', mul: 'MUL', div: 'DIV' };
let weakWindow = '10';
try { weakWindow = localStorage.getItem('zm-weak') || weakWindow; } catch {}
if (!['1', '10', 'all'].includes(weakWindow)) weakWindow = '10';
let weakRun = 0;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

// The kind of question inside an operation, read from its text: "54 + 87" → "+ with a carry".
function factOf(q) {
  const m = /^(\d+) (\+|–|×|÷) (\d+)$/.exec(q.q || '');
  if (!m) return null;
  const a = Number(m[1]), b = Number(m[3]);
  if (q.o === 'add') return a % 10 + b % 10 >= 10 ? '+ with a carry' : '+ no carry';
  if (q.o === 'sub') return b % 10 > a % 10 ? '– with a borrow' : '– no borrow';
  if (q.o === 'mul') return `× ${a <= 12 ? a : b}`;
  if (q.o === 'div') return `÷ ${b}`;
  return null;
}

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
    `<span class="fact-name">${esc(f.k)}</span><span class="track" aria-hidden="true"><i style="width:${ranked ? (f.avg / top * 100).toFixed(1) : 0}%"></i></span>` +
    `<span class="time">${f.n ? `${secs2(f.avg)}<small>s</small>` : '—'}</span><span class="gap">${!f.n ? 'none yet' : ranked ? plural(f.n, 'q') : 'too few'}</span></li>`;
};

function factsHTML(qs) {
  const used = factsTrim ? trimOutliers(qs) : qs;
  const dropped = qs.length - used.length;
  const avg = avgBy(used, factOf);
  const head = `<div class="facts-head"><h3>Slowest question types</h3>` +
    `<div class="facts-tools"><div class="seg" role="group" aria-label="Question types to show">` +
      `<button type="button" data-facts="top" aria-pressed="${!factsAll}">Top 6</button><button type="button" data-facts="all" aria-pressed="${factsAll}" title="Every × and ÷ fact from 2 to 12">All facts</button></div>` +
    `<div class="seg"><button type="button" data-facts="trim" aria-pressed="${factsTrim}" title="Leave out answers far slower than your usual for that operation">Exclude outliers</button></div></div></div>`;
  const note = `<p class="facts-note">Seconds per question · types with fewer than ${MIN_FACT} answers aren’t ranked${factsTrim ? ` · ${dropped ? `${plural(dropped, 'unusually slow answer')} left out` : 'no outliers in this window'}, far slower than your usual for that operation` : ''}</p>`;
  if (!factsAll) {
    const top = Object.entries(avg).filter(([, f]) => f.n >= MIN_FACT).map(([k, f]) => ({ k, ...f })).sort((a, b) => b.avg - a.avg).slice(0, 6);
    if (!top.length) return '';
    return head + `<ol class="tower facts">${top.map((f, i) => factRow(f, i, top[0].avg)).join('')}</ol>` + note;
  }
  // Every fact, one column per operation, slowest first; facts not seen yet sit at the bottom.
  const col = (op, sign, title) => {
    const list = TABLE.map(n => ({ k: `${sign} ${n}`, op, n: 0, avg: 0, ...avg[`${sign} ${n}`] }))
      .sort((a, b) => (b.n >= MIN_FACT) - (a.n >= MIN_FACT) || (b.n > 0) - (a.n > 0) || b.avg - a.avg);
    const top = Math.max(...list.filter(f => f.n >= MIN_FACT).map(f => f.avg), 1);
    return `<div class="facts-col"><h4>${title}</h4><ol class="tower facts">${list.map((f, i) => factRow(f, i, top)).join('')}</ol></div>`;
  };
  return head + `<div class="facts-all">${col('mul', '×', 'Multiplication')}${col('div', '÷', 'Division')}</div>` + note;
}

async function renderWeak() {
  const run = ++weakRun;
  const el = $('#weak');
  document.querySelectorAll('[data-window]').forEach(b => b.setAttribute('aria-pressed', b.dataset.window === weakWindow));
  const timed = allGames.filter(g => (g.mode || 'standard') === 'standard' && g.detail).sort((a, b) => (b.ts > a.ts ? 1 : b.ts < a.ts ? -1 : 0));
  const emptyMsg = '<p class="empty-state">No question timings yet. Play a round on the <a href="play.html">Play</a> page and each operation will be ranked here by its time per question, slowest first.</p>';
  if (!timed.length) { el.innerHTML = emptyMsg; return; }
  // Last game is compared with the 10 games before it; last 10 with the 10 before those.
  const n = weakWindow === 'all' ? timed.length : Number(weakWindow);
  const cur = timed.slice(0, n);
  const prev = weakWindow === 'all' ? [] : timed.slice(n, n + 10);
  const load = async list => (await Promise.all(list.map(g => getDetail(g.ts).catch(() => [])))).flat();
  const [qs, prevQs] = await Promise.all([load(cur), load(prev)]);
  if (run !== weakRun) return;  // a newer render started while these loaded

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
      `<span class="track" aria-hidden="true"><i style="width:${(r.avg / slowest * 100).toFixed(1)}%"></i></span>` +
      `<span class="time">${secs2(r.avg)}<small>s</small></span>` +
      `<span class="gap">${r.avg === fastest ? 'Fastest' : `+${secs2(r.avg - fastest)}`}</span></li>`).join('')}</ol>` +
    `<div class="tower-note"><span>Seconds per question · ${plural(qs.length, 'question')} from ${plural(cur.length, 'game')}${prev.length ? `, compared with the ${prev.length === 1 ? 'game' : plural(prev.length, 'game')} before` : ''}</span>` +
    `<span class="key"><span class="s-purple">Fastest</span>${prev.length ? '<span class="s-green">Faster</span><span class="s-yellow">Slower</span>' : weakWindow !== 'all' ? '<span>Faster / slower colors start after your next timed game</span>' : ''}</span></div>` +
    factsHTML(qs);

  renderHeatmap();  // the calendar beside the tower sizes itself to the tower's new height
  if (reduceMotion.matches) return;
  for (const li of el.querySelectorAll('.tower li')) {
    const old = was.get(li.dataset.op);
    if (!old) continue;
    const dy = old.top - li.getBoundingClientRect().top;
    if (dy) li.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 650, easing: 'cubic-bezier(.16, 1, .3, 1)' });
    if (old.sector !== li.dataset.sector) li.classList.add('flash');
  }
}

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

// ---------- first viewport: 2-minute score against the target ----------
function renderScore() {
  const el = $('#score');
  const full = allGames.filter(g => (g.mode || 'standard') === 'standard' && g.seconds === 120)
    .sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : a.i - b.i));
  if (!full.length) {
    el.innerHTML = '<p class="empty-state">No 2-minute arithmetic games yet. Play one and your score will sit here against the 80 target.</p>';
    return;
  }
  const weekAgo = addDays(today(), -6);
  const week = full.filter(g => parseDate(g.date) >= weekAgo);
  const head = week.length ? Math.max(...week.map(g => g.score)) : full[full.length - 1].score;
  const pb = Math.max(...full.map(g => g.score));
  const last5 = full.slice(-5), avg5 = last5.reduce((s, g) => s + g.score, 0) / last5.length;
  const gap = TARGET - head;
  const scale = Math.max(100, pb + 5);
  const pct = v => `${Math.min(100, v / scale * 100).toFixed(1)}%`;

  // Last 10 games as laps: purple = a new best at the time, green = beat the 5 before it, yellow = didn't.
  const laps = full.slice(-10).map(g => {
    const k = full.indexOf(g), before = full.slice(0, k), recent = before.slice(-5);
    const bestBefore = before.reduce((m, x) => Math.max(m, x.score), -1);
    const recentAvg = recent.length ? recent.reduce((s, x) => s + x.score, 0) / recent.length : null;
    const cls = g.score > bestBefore ? 's-purple' : recentAvg == null ? '' : g.score >= recentAvg ? 's-green' : 's-yellow';
    return `<li class="${cls}" title="${longDate(parseDate(g.date))}">${g.score}<small>${shortDate(parseDate(g.date))}</small></li>`;
  });

  el.innerHTML =
    `<div class="score-main"><div class="big" aria-label="${week.length ? 'Best this week' : 'Latest game'}: ${head}">${head}</div>` +
    `<div class="big-side"><span class="lbl">${week.length ? 'Best this week' : 'Latest game'}</span>` +
    `<span class="togo ${gap <= 0 ? 'made' : ''}">${gap > 0 ? `${gap} to go` : 'Target made'}</span>` +
    `<span class="form-avg"><b>${round1(avg5)}</b> last-5 average</span></div></div>` +
    `<div class="rail" aria-hidden="true"><div class="rail-scale"><span>0</span><span>${scale}</span></div><div class="rail-track"></div>` +
    `<div class="rail-fill" style="width:${pct(head)}"></div><div class="rail-pb" style="left:${pct(pb)}" title="Personal best ${pb}"></div>` +
    `<div class="rail-mark" style="left:${pct(TARGET)}"></div><span class="rail-label" style="left:${pct(TARGET)}">TARGET ${TARGET}</span></div>` +
    `<div class="laps-head"><h3>Last ${laps.length} games</h3><span class="key"><span class="s-purple">New best</span><span class="s-green">Up on form</span><span class="s-yellow">Down</span></span></div>` +
    `<ol class="laps">${laps.join('')}</ol>`;
}

// ---------- per-question breakdown (expands under a recent game) ----------
const OP_NAMES = { add: 'Addition', sub: 'Subtraction', mul: 'Multiplication', div: 'Division', sq: 'Squares' };
const detailCache = new Map();
const openGames = new Set();
const secs = ms => (ms / 1000).toFixed(ms < 10000 ? 2 : 1);

async function getDetail(ts) {
  // Question logs are stored as the game sent them, so each field is coerced to its expected
  // type before anything renders it.
  if (!detailCache.has(ts)) {
    const raw = (await api(`api/detail?ts=${encodeURIComponent(ts)}`)).questions;
    detailCache.set(ts, (Array.isArray(raw) ? raw : []).filter(q => q && typeof q === 'object').map(q => ({
      q: String(q.q ?? ''), a: String(q.a ?? ''),
      o: /^[a-z]{1,8}$/.test(q.o) ? q.o : 'other',
      c: Math.max(0, Math.floor(Number(q.c) || 0)), t: Math.max(0, Number(q.t) || 0),
    })));
  }
  return detailCache.get(ts);
}

function breakdownHTML(qs, sortSlow) {
  const times = qs.map(q => q.t);
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
  for (const q of qs) (byOp[q.o] ||= []).push(q.t);
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
    const tip = `#${i + 1}  ${q.q} = ${q.a}  ·  ${secs(q.t)} s${q.c ? `  ·  ${plural(q.c, 'correction')}` : ''}`;
    svg += `<rect class="op-${esc(q.o)}" x="${x + Math.min(1, bw * 0.15)}" y="${y}" width="${Math.max(0.6, bw - Math.min(2, bw * 0.3))}" height="${H - m.b - y}"><title>${esc(tip)}</title></rect>`;
  });
  svg += `<text x="${m.l}" y="${H - 3}">#1</text><text x="${W - m.r}" y="${H - 3}" text-anchor="end">#${qs.length}</text>`;

  // question list, colored against this game's own median
  const rows = qs.map((q, i) => ({ ...q, n: i + 1 }));
  if (sortSlow) rows.sort((a, b) => b.t - a.t);
  const cls = t => t >= median * 2 ? 'slow' : t <= median * 0.6 ? 'fast' : '';
  const list = rows.map(q => `<tr><td class="src">${q.n}</td><td>${esc(q.q)} = ${esc(q.a)}</td><td class="num ${cls(q.t)}">${secs(q.t)} s</td><td class="num src">${q.c ? `${q.c} fix${q.c === 1 ? '' : 'es'}` : ''}</td></tr>`).join('');

  return `<div class="bd-stats">${stats.map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('')}</div>` +
    `<div class="bd-ops">${ops.map(([o, avg, n]) => `<span><i class="op-${esc(o)}"></i>${(has(OP_NAMES, o) ? OP_NAMES[o] : esc(o))} <b>${secs(avg)} s</b> avg · ${n}</span>`).join('')}` +
    `<span>${plural(corrections, 'correction')}</span></div>` +
    `<svg class="bd-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Seconds per question, in order">${svg}</svg>` +
    `<div class="bd-list-head"><span>Every question · red = over 2× your median, green = quick</span><button class="bd-sort" data-slow="${sortSlow ? 1 : 0}">${sortSlow ? 'Show in order' : 'Sort slowest first'}</button></div>` +
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

function render() {
  renderWeak(); renderScore();
  renderStats(); renderChart(); renderPractice(); renderEndless(); renderHeatmap(); renderRecent();
  const t = today();
  $('#session-date').textContent = `${t.toLocaleDateString(undefined, { weekday: 'short' })} ${t.getDate()} ${MONTHS[t.getMonth()]}`;
  $('#updated').innerHTML = `<b>${allGames.length}</b> games logged`;
  syncAccount();
}

// ---------- data ----------
function setGames(list) {
  // Rows are rendered into the page, so only well-formed ones are used: whole-number figures and
  // text fields that are text. (Both the server and store.js already write rows this way.)
  const whole = v => Number.isInteger(v) && v >= 0;
  list = list.filter(g => g && whole(g.i) && whole(g.score) && whole(g.seconds) && whole(g.elapsed ?? 0) &&
    typeof g.ts === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(g.date) && typeof (g.mode ?? '') === 'string' && typeof (g.source ?? '') === 'string');
  list = list.filter(g => !HIDDEN_MODES.has(g.mode));  // each row keeps its server index `i`
  allGames = list;
  // games / sprints: the chosen game's 2-minute and 30-second scores, for the tiles and chart.
  const chosen = list.filter(g => (g.mode || 'standard') === chartGame);
  games = chosen.filter(g => g.seconds === 120);
  sprints = chosen.filter(g => g.seconds === 30);
  endless = list.filter(g => g.seconds === 0);
}

async function api(path, form) {
  const opts = form ? {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Zetamac': '1' },
    body: new URLSearchParams(form),
  } : {};
  const r = await fetch(path, opts);
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function load() {
  try {
    setGames(await api('api/scores'));
    $('#banner').style.display = 'none';
  } catch {
    $('#banner').style.display = 'block';
  }
  render();
}

document.querySelectorAll('.tabs button[data-range]').forEach(b => b.addEventListener('click', () => {
  range = b.dataset.range;
  try { localStorage.setItem('zm-range', range); } catch {}
  renderStats(); renderChart();
}));
document.querySelectorAll('#legend button').forEach(b => {
  b.setAttribute('aria-pressed', !chartHidden.has(b.dataset.series));
  b.addEventListener('click', () => {
    const key = b.dataset.series;
    chartHidden.has(key) ? chartHidden.delete(key) : chartHidden.add(key);
    b.setAttribute('aria-pressed', !chartHidden.has(key));
    try { localStorage.setItem('zm-hidden', JSON.stringify([...chartHidden])); } catch {}
    renderChart();
  });
});
if ([...$('#chart-game').options].some(o => o.value === chartGame)) $('#chart-game').value = chartGame;
else chartGame = 'standard';
$('#chart-game').addEventListener('change', e => {
  chartGame = e.target.value;
  try { localStorage.setItem('zm-chart-game', chartGame); } catch {}
  setGames(allGames);
  renderStats(); renderChart();
});

// A note carried over from the account page (after signing up or logging in).
try {
  const flash = sessionStorage.getItem('zm-flash');
  if (flash) { $('#flash').textContent = flash; $('#flash').hidden = false; sessionStorage.removeItem('zm-flash'); }
} catch {}
// On the website: the account button (kept in step with the sign-in, which can run out).
const syncAccount = () => {
  if (!window.ZM_WEB || !window.ZM_CLOUD?.ready) return;
  const u = window.ZM_CLOUD.user();
  $('#acct-btn').hidden = false;
  $('#acct-btn').textContent = u ? u.name : 'Sign up';
};
syncAccount();
// On the website, scores live only in this browser; say so where scores go in.
if (window.ZM_WEB) $('#log-note').textContent = window.ZM_CLOUD?.user()
  ? `For scores from the zetamac website. Games played here save to your account (${window.ZM_CLOUD.user().name})`
  : 'For scores from the zetamac website. Games played here save themselves, in this browser only; clearing site data erases them';
$('#f-date').value = dateKey(today());
$('#f-date').max = dateKey(today());
$('#add').addEventListener('submit', async e => {
  e.preventDefault();
  const msg = $('#f-msg');
  try {
    const seconds = $('#f-len').value, mode = $('#f-mode').value;
    setGames(await api('api/scores', { date: $('#f-date').value, score: $('#f-score').value, seconds, mode }));
    msg.className = 'msg ok';
    const kind = `${has(SQ_MODES, mode) ? `${SQ_MODES[mode].toLowerCase()} squares, ` : ''}${seconds === '30' ? '30 seconds' : '2 minutes'}`;
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

// ---------- moving scores between copies of the tracker ----------
// Export: every score with its question log, as one JSON file. Import (website only): merges a file in.
if (window.ZM_WEB) {
  $('#import-label').hidden = false;
  $('#move-note').textContent = 'Bring your history over: export it from the tracker on your computer (./zetamac tracker), then import the file here. Export also makes a backup of this browser’s scores.';
}
$('#export').addEventListener('click', async () => {
  const msg = $('#move-msg');
  msg.className = 'msg'; msg.textContent = 'Gathering your games…';
  try {
    const rows = await api('api/scores');
    const scores = [];
    for (const g of rows) {
      const { ts, date, score, seconds, source, mode, elapsed } = g;
      const row = { ts, date, score, seconds, source, mode, elapsed };
      if (g.detail) { try { row.detail = (await api(`api/detail?ts=${encodeURIComponent(ts)}`)).questions; } catch {} }
      scores.push(row);
    }
    const file = new Blob([JSON.stringify({ app: 'zetamac-tracker', version: 1, exported: new Date().toISOString(), scores })], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = `zetamac-scores-${dateKey(today())}.json`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    msg.className = 'msg ok'; msg.textContent = `Exported ${plural(scores.length, 'game')}.`;
  } catch (err) {
    msg.className = 'msg err'; msg.textContent = `Couldn’t export: ${err.message}`;
  }
});
$('#import').addEventListener('change', async e => {
  const file = e.target.files[0], msg = $('#move-msg');
  e.target.value = '';
  if (!file) return;
  if (file.size > 50e6) { msg.className = 'msg err'; msg.textContent = 'That file is too big to be a tracker export (over 50 MB).'; return; }
  msg.className = 'msg'; msg.textContent = 'Importing…';
  try {
    const r = await fetch('api/import', { method: 'POST', headers: { 'X-Zetamac': '1' }, body: await file.text() });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Import failed');
    detailCache.clear();
    setGames(data.scores);
    render();
    msg.className = 'msg ok';
    msg.textContent = `Imported ${plural(data.added, 'game')}${data.skipped ? ` · ${data.skipped} already here or unreadable, skipped` : ''}.`;
  } catch (err) {
    msg.className = 'msg err'; msg.textContent = err.message;
  }
});

$('#edit-toggle').addEventListener('click', e => {
  const on = $('.recent-scroll').classList.toggle('editing');
  e.target.setAttribute('aria-pressed', on);
  e.target.textContent = on ? 'Done' : 'Edit';
});

let resizeTimer;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { renderChart(); renderHeatmap(); }, 100); });
window.addEventListener('focus', load);
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

// ---------- collapsible sections (Practice, Endless runs), remembered per browser ----------
const folded = new Set();
try { for (const k of JSON.parse(localStorage.getItem('zm-folded') || '[]')) folded.add(k); } catch {}
document.querySelectorAll('.collapsible').forEach(panel => {
  const btn = panel.querySelector('.fold'), key = panel.dataset.panel;
  const apply = () => {
    panel.classList.toggle('folded', folded.has(key));
    btn.setAttribute('aria-expanded', !folded.has(key));
  };
  btn.addEventListener('click', () => {
    folded.has(key) ? folded.delete(key) : folded.add(key);
    try { localStorage.setItem('zm-folded', JSON.stringify([...folded])); } catch {}
    apply();
  });
  apply();
});

// Practice and endless runs share a panel; which view shows is remembered.
let drillView = 'practice';
try { drillView = localStorage.getItem('zm-drill-view') || drillView; } catch {}
const showDrillView = () => {
  if (!['practice', 'endless'].includes(drillView)) drillView = 'practice';
  $('#practice-view').hidden = drillView !== 'practice';
  $('#endless-view').hidden = drillView !== 'endless';
  document.querySelectorAll('[data-drill-view]').forEach(b => b.setAttribute('aria-pressed', b.dataset.drillView === drillView));
};
document.querySelectorAll('[data-drill-view]').forEach(b => b.addEventListener('click', () => {
  drillView = b.dataset.drillView;
  try { localStorage.setItem('zm-drill-view', drillView); } catch {}
  showDrillView();
}));
showDrillView();

// ---------- custom dropdowns ----------
// Wraps a <select> in a button + listbox that always opens next to the button. The select keeps
// working as before: setting .value updates the button, and picking an option fires 'change'.
function enhanceSelect(sel) {
  const wrap = document.createElement('div');
  wrap.className = 'dd';
  sel.before(wrap);
  wrap.append(sel);
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'dd-btn';
  btn.setAttribute('aria-haspopup', 'listbox');
  btn.setAttribute('aria-expanded', 'false');
  const labelEl = sel.id && document.querySelector(`label[for="${sel.id}"]`) || sel.closest('label');
  if (labelEl) btn.setAttribute('aria-label', labelEl.firstChild.textContent.trim());
  btn.innerHTML = '<span></span>';
  const menu = document.createElement('div');
  menu.className = 'dd-menu';
  menu.setAttribute('role', 'listbox');
  menu.hidden = true;
  wrap.append(btn, menu);

  const opts = [];
  for (const node of sel.children) {
    const group = node.tagName === 'OPTGROUP' ? node : null;
    if (group) menu.insertAdjacentHTML('beforeend', `<div class="dd-group" role="presentation">${esc(group.label)}</div>`);
    for (const o of group ? group.children : [node]) {
      const el = document.createElement('div');
      el.className = 'dd-opt';
      el.setAttribute('role', 'option');
      el.textContent = o.textContent;
      el.dataset.value = o.value;
      menu.append(el);
      opts.push(el);
    }
  }

  let active = -1;
  const sync = () => {
    btn.firstChild.textContent = sel.selectedOptions[0]?.textContent || '';
    for (const el of opts) el.setAttribute('aria-selected', el.dataset.value === sel.value);
  };
  // Keep the button in step when code sets sel.value directly.
  const desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  Object.defineProperty(sel, 'value', { get() { return desc.get.call(this); }, set(v) { desc.set.call(this, v); sync(); } });

  const setActive = i => {
    opts[active]?.classList.remove('active');
    active = Math.max(0, Math.min(opts.length - 1, i));
    opts[active].classList.add('active');
    opts[active].scrollIntoView({ block: 'nearest' });
  };
  const open = () => {
    for (const other of document.querySelectorAll('.dd.open')) other.closeDD?.();
    menu.hidden = false;
    menu.style.maxHeight = 'none';
    // Open downward unless there's clearly more room above.
    const r = btn.getBoundingClientRect(), natural = menu.scrollHeight;
    const below = innerHeight - r.bottom - 12, above = r.top - 12;
    const up = natural > below && above > below;
    wrap.classList.toggle('up', up);
    menu.style.maxHeight = `${Math.max(120, Math.min(natural, up ? above : below))}px`;
    wrap.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
    setActive(opts.findIndex(el => el.dataset.value === sel.value));
    btn.focus({ preventScroll: true });  // Safari doesn't focus buttons on click; the keys below need it
  };
  const close = (focus = false) => {
    menu.hidden = true;
    wrap.classList.remove('open', 'up');
    btn.setAttribute('aria-expanded', 'false');
    if (focus) btn.focus();
  };
  wrap.closeDD = close;
  const choose = el => {
    close(true);
    if (el.dataset.value === sel.value) return;
    sel.value = el.dataset.value;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  };

  btn.addEventListener('click', () => (menu.hidden ? open() : close()));
  // preventDefault: inside a <label>, a click would otherwise also be forwarded to the hidden select.
  menu.addEventListener('click', e => { e.preventDefault(); const el = e.target.closest('.dd-opt'); if (el) choose(el); });
  menu.addEventListener('mousemove', e => { const i = opts.indexOf(e.target.closest('.dd-opt')); if (i >= 0 && i !== active) setActive(i); });
  wrap.addEventListener('keydown', e => {
    if (menu.hidden) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key) && e.target === btn) { e.preventDefault(); open(); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(opts.length - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(opts[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); close(true); }
    else if (e.key === 'Tab') close();
  });
  document.addEventListener('mousedown', e => { if (!wrap.contains(e.target)) close(); });
  sync();
}

document.querySelectorAll('main select').forEach(enhanceSelect);
window.addEventListener('resize', () => document.querySelectorAll('.dd.open').forEach(d => d.closeDD()));
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.querySelectorAll('.dd.open').forEach(d => d.closeDD(true));
});

load().then(openFromHash);

// ---------- first-visit welcome (three steps; "How it works" reopens it) ----------
(() => {
  const dlg = $('#welcome');
  const steps = [...dlg.querySelectorAll('.w-step')];
  const track = [...dlg.querySelectorAll('.w-track li')];
  const btn = name => dlg.querySelector(`[data-w="${name}"]:not(#w-look)`);
  let at = 0;
  if (window.ZM_WEB) $('#w-store').textContent = window.ZM_CLOUD?.user()
    ? 'Every game you play saves itself to your account, so your tracker is the same on every device.'
    : 'Every game you play saves itself here, in this browser only. Sign up (no email) to keep your scores on every device and get on the leaderboard.';

  const show = (i, dir = 1) => {
    at = Math.max(0, Math.min(steps.length - 1, i));
    steps.forEach((s, k) => { s.hidden = k !== at; s.classList.remove('enter'); });
    steps[at].style.setProperty('--from', `${dir * 18}px`);
    void steps[at].offsetWidth;
    steps[at].classList.add('enter');
    track.forEach((li, k) => { li.classList.toggle('done', k < at); k === at ? li.setAttribute('aria-current', 'step') : li.removeAttribute('aria-current'); });
    dlg.setAttribute('aria-labelledby', `w-title-${at}`);
    $('#w-count').textContent = `${at + 1} of ${steps.length}`;
    const last = at === steps.length - 1;
    // Back keeps its place on step one (invisible), so the buttons never move under a finger.
    btn('back').classList.toggle('is-placeholder', at === 0);
    btn('back').disabled = at === 0;
    btn('next').hidden = last;
    $('#w-look').hidden = !last;
    $('#w-play').hidden = !last;
    (last ? $('#w-play') : btn('next')).focus();
  };
  const seen = () => { try { localStorage.setItem('zm-welcome-seen', '1'); } catch {} };
  const open = () => { show(0); dlg.showModal(); show(0); demo.start(); };
  dlg.addEventListener('close', () => { seen(); demo.stop(); });
  dlg.addEventListener('click', e => {
    const w = e.target.closest('[data-w]')?.dataset.w;
    if (w === 'next') show(at + 1, 1);
    else if (w === 'back') show(at - 1, -1);
    else if (w === 'close') dlg.close();
    else if (e.target === dlg) dlg.close();  // a click on the backdrop
  });
  $('#w-play').addEventListener('click', seen);
  dlg.addEventListener('keydown', e => {
    if (e.target.closest('a, button') && (e.key === 'Enter' || e.key === ' ')) return;
    if (e.key === 'ArrowRight') show(at + 1, 1);
    else if (e.key === 'ArrowLeft') show(at - 1, -1);
  });
  $('#help-open').addEventListener('click', open);

  // The example round on step one: a problem is typed out and taken the moment it's right.
  const demo = (() => {
    const probs = [['47 + 38', '85'], ['9 × 64', '576'], ['132 – 57', '75'], ['378 ÷ 7', '54'], ['86 + 29', '115']];
    let timer = 0, running = false;
    const typed = $('#w-typed'), prob = $('#w-prob'), score = $('#w-score');
    const run = (i, n) => {
      const [q, a] = probs[i % probs.length];
      prob.textContent = q; typed.textContent = ''; typed.classList.remove('ok');
      let k = 0;
      const type = () => {
        if (!running) return;
        typed.textContent = a.slice(0, ++k);
        if (k < a.length) { timer = setTimeout(type, 170); return; }
        typed.classList.add('ok'); score.textContent = n + 1;
        timer = setTimeout(() => run(i + 1, n + 1), 650);
      };
      timer = setTimeout(type, 500);
    };
    return {
      start() {
        running = true; clearTimeout(timer);
        if (reduceMotion.matches) { prob.textContent = '47 + 38'; typed.textContent = '85'; typed.classList.add('ok'); score.textContent = '1'; return; }
        score.textContent = '0'; run(0, 0);
      },
      stop() { running = false; clearTimeout(timer); },
    };
  })();

  let first = false;
  try { first = !localStorage.getItem('zm-welcome-seen'); } catch {}
  if (first) open();
})();
