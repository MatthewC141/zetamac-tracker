// The progress dashboard, part 2 of 8: the stat tiles, the score chart, the practice and endless
// tables, and the year of games played (the heatmap).
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
    ...(chartGame === 'standard' ? [] : [[allBest || '—', `all-time best (${plural(games.length, mainLabel(chartGame))})`], [rangeBest || '—', `best · ${r}`]]),
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
      ticks.push([d, d.getMonth() === 0 ? String(d.getFullYear()) : monthName(d)]);
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



// A 30-second score scaled to a full 2-minute game.
const PROJECT = 120 / 30;
// The 2-minute arithmetic score the player is training toward (trading-firm screens).
const TARGET = 80;

function renderChart() {
  $('#legend [data-series="target"]').hidden = chartGame !== 'standard';
  // A quant test has one length, so its legend names the test and drops the 30-second line.
  const test = isTest(chartGame) ? TESTS[chartGame][0] : null;
  $('#legend [data-series="best"]').textContent = test ? `${test} daily best` : '2-minute daily best';
  $('#legend [data-series="games"]').textContent = test ? `Individual ${test} tests` : 'Individual 2-minute games';
  $('#legend [data-series="proj"]').hidden = !!test;
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
  const record = (label, g) => g && `<div><span>${label}</span><b>${g.score}</b><em>in ${clock(g.elapsed || 0)} · ${shortDate(parseDate(g.date))}${has(SQ_MODES, g.mode) ? ` · ${SQ_MODES[g.mode].replace(' squares', '')}` : ''}</em></div>`;
  const total = endless.reduce((n, g) => n + g.score, 0);
  $('#endless-stats').innerHTML = endless.length ? [
    record('Longest run · Arithmetic', longest(endless.filter(g => (g.mode || 'standard') === 'standard'))),
    record('Longest run · Squares', longest(endless.filter(g => has(SQ_MODES, g.mode)))),
    record('Longest run · Combined', longest(endless.filter(g => g.mode === 'mixed'))),
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
let heatDays = [];  // one entry per square, for the hover card
function renderHeatmap() {
  const end = today();
  // The last 3 months: 13 weeks ending with this one. Squares grow to fill the panel's height
  // when it is stretched beside the tower, as far as the width allows.
  const left = 26, top = 16, gap = 3, weeks = 13;
  const svg = $('#heat');
  svg.setAttribute('height', 0);
  const room = svg.parentElement.clientWidth || 900;
  const tall = Math.floor((svg.parentElement.clientHeight - top) / 7) - gap;
  const wide = Math.floor((room - left) / weeks) - gap;
  const cell = Math.max(10, Math.min(28, wide, tall > 10 ? tall : wide));
  const pitch = cell + gap;
  const start = addDays(end, -(weeks - 1) * 7 - end.getDay());
  // Shade by standard-game score (30-second games projected); squares-only days get the lightest shade.
  const std = allGames.filter(g => (g.mode || 'standard') === 'standard' && g.seconds > 0);
  const days = new Map(byDay(std.map(g => g.seconds === 30 ? { ...g, score: g.score * PROJECT } : g)).map(d => [d.key, d]));
  const sqDays = new Map(byDay(allGames.filter(g => (g.mode || 'standard') !== 'standard' || g.seconds === 0)).map(d => [d.key, d]));
  const yearBests = [...days.values()].filter(d => d.date >= start).map(d => d.best).sort((a, b) => a - b);
  const q = p => yearBests[Math.min(yearBests.length - 1, Math.floor(p * yearBests.length))];
  const cuts = yearBests.length ? [q(0.25), q(0.5), q(0.75)] : [];
  const level = v => 1 + cuts.filter(c => v > c).length;
  // What was played each day, for the hover card: games by kind, and the day's arithmetic best.
  const kind = g => g.seconds === 0 ? 'endless' : isTest(g.mode) ? TESTS[g.mode][0].toLowerCase() : (g.mode || 'standard') === 'standard' ? 'arithmetic'
    : has(SQ_MODES, g.mode) ? 'squares' : has(PRACTICE_MODES, g.mode) ? 'practice' : g.mode === 'mixed' ? 'combined' : null;
  const perDay = new Map();
  for (const g of allGames) {
    const k = kind(g);
    if (!k) continue;
    const day = perDay.get(g.date) || perDay.set(g.date, { n: 0, kinds: new Map(), best: {} }).get(g.date);
    day.n++;
    day.kinds.set(k, (day.kinds.get(k) || 0) + 1);
    if (k === 'arithmetic') day.best[g.seconds] = Math.max(day.best[g.seconds] ?? 0, g.score);
  }
  heatDays = [];

  const W = left + weeks * pitch, H = top + 7 * pitch;
  svg.setAttribute('width', W); svg.setAttribute('height', H);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  let h = '';
  [['Mon', 1], ['Wed', 3], ['Fri', 5]].forEach(([l, r]) => { h += `<text x="0" y="${top + r * pitch + cell * .8}">${l}</text>`; });
  let lastMonth = -1, played = 0;
  for (let d = start, i = 0; d <= end; d = addDays(d, 1), i++) {
    const col = Math.floor(i / 7), row = d.getDay();
    const x = left + col * (cell + gap), y = top + row * (cell + gap);
    if (row === 0 && d.getMonth() !== lastMonth && d.getDate() <= 7) {
      lastMonth = d.getMonth();
      if (col < weeks - 1) h += `<text x="${x}" y="10">${monthName(d)}</text>`;
    }
    const info = days.get(dateKey(d)), sq = sqDays.get(dateKey(d));
    if (info || sq) played++;
    const fill = info ? `var(--heat-${level(info.best)})` : sq ? 'var(--heat-1)' : 'var(--heat-0)';
    // Only days with games answer to hovering; empty days are just squares.
    const day = perDay.get(dateKey(d));
    if (day) heatDays.push({ date: d, day });
    h += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${fill}"${day ? ` data-i="${heatDays.length - 1}"` : ' class="none"'}></rect>`;
  }
  svg.innerHTML = h;
  const games = heatDays.reduce((n, c) => n + c.day.n, 0);
  $('#heat-title').innerHTML = `Games played <span class="h-note">${games} in the last 3 months</span>`;
  svg.setAttribute('aria-label', `Games played: ${games} in the last 3 months, on ${plural(played, 'day')}. Hover or tap a day for its games.`);
  const sc = svg.parentElement; sc.scrollLeft = sc.scrollWidth;
}

// Hover a played day (or tap it) for a card with how many games were played and of which kinds.
// The card waits 0.3 s on each day before it appears, and moving to another day starts the
// wait over.
{
  const svg = $('#heat'), tip = $('#heat-tip'), panel = svg.closest('.heat-panel');
  const DELAY = 300;
  let showTimer = 0;
  const hide = () => { clearTimeout(showTimer); showTimer = 0; tip.style.opacity = 0; };
  const show = rect => {
    const cell = heatDays[Number(rect.dataset.i)];
    if (!cell || !rect.isConnected) return hide();
    const day = cell.day, order = ['arithmetic', 'squares', 'combined', 'practice', '80 in 8', 'sequences', 'fractions', 'estimation', 'endless'];
    // Arithmetic shows its real best: the 2-minute one, or the 0:30 one if that's all there was.
    const best = day.best[120] != null ? `, best ${day.best[120]}` : day.best[30] != null ? `, best ${day.best[30]} in 0:30` : '';
    const lines = order.filter(k => day.kinds.has(k)).map(k => `<span>${day.kinds.get(k)} ${k}${k === 'arithmetic' ? best : ''}</span>`).join('');
    tip.innerHTML = `<b>${plural(day.n, 'game')}</b> · ${esc(longDate(cell.date))}${lines}`;
    const r = rect.getBoundingClientRect(), p = panel.getBoundingClientRect();
    tip.style.left = `${Math.min(Math.max(r.left + r.width / 2 - p.left, 100), p.width - 100)}px`;
    tip.style.top = `${r.top - p.top - 6}px`;
    tip.style.opacity = 1;
  };
  svg.addEventListener('pointerover', e => {
    const rect = e.target.closest('rect[data-i]');
    if (!rect) return;
    hide();
    if (e.pointerType === 'mouse') showTimer = setTimeout(() => show(rect), DELAY);
    else show(rect);  // a tap shows it at once
  });
  svg.addEventListener('pointerout', e => { if (e.pointerType === 'mouse' && e.target.closest('rect[data-i]')) hide(); });
  document.addEventListener('pointerdown', e => { if (!e.target.closest('#heat rect[data-i]')) hide(); });
  svg.closest('.heat-scroll').addEventListener('scroll', hide, { passive: true });
}
