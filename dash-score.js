// The progress dashboard, part 4 of 9: the 2-minute score panel, where your best stands on the
// leaderboard, and the quant tests' line.
// ---------- first viewport: 2-minute score against the target ----------
// Interview readiness: an interview is one try, so what counts is the score you reach on an
// ordinary day, not your best. "Ready at R" means R or more in at least 80% of your last 10
// games; it's compared with the same figure for the 10 games before those. Scores oldest first.
const READY_WINDOW = 10, READY_MIN = 5, READY_SHARE = 0.8;
function readiness(scores) {
  const floorOf = list => {
    const needed = Math.ceil(READY_SHARE * list.length);
    return { score: [...list].sort((a, b) => b - a)[needed - 1], needed, of: list.length };
  };
  const recent = scores.slice(-READY_WINDOW), before = scores.slice(-2 * READY_WINDOW, -READY_WINDOW);
  if (recent.length < READY_MIN) return { short: READY_MIN - recent.length };
  const now = floorOf(recent);
  return { ...now, change: before.length >= READY_MIN ? now.score - floorOf(before).score : null };
}
function readinessLine(r) {
  if (r.short) return `Play ${plural(r.short, 'more 2-minute game')} to see the score you’d be ready to make in an interview.`;
  const change = r.change === null ? '' : r.change > 0 ? ` · up ${r.change} on the ${READY_WINDOW} before` : r.change < 0 ? ` · down ${-r.change} on the ${READY_WINDOW} before` : ` · same as the ${READY_WINDOW} before`;
  return `<b>Interview-ready at ${r.score}:</b> ${r.score} or more in ${r.needed} of your last ${r.of} games${change}`;
}

function renderScore() {
  const el = $('#score');
  const full = allGames.filter(g => (g.mode || 'standard') === 'standard' && g.seconds === 120)
    .sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : a.i - b.i));
  if (!full.length) {
    el.innerHTML = '<p class="empty-state">No 2-minute arithmetic games yet. Play one and your score shows up here.</p>';
    return;
  }
  const weekAgo = addDays(today(), -6);
  const week = full.filter(g => parseDate(g.date) >= weekAgo);
  const head = week.length ? Math.max(...week.map(g => g.score)) : full[full.length - 1].score;
  const pb = Math.max(...full.map(g => g.score));
  const last = full[full.length - 1];

  // The last 10 games and their average: purple = a new best at the time, green = at or above
  // that average, yellow = below it.
  const SECTORS = [['s-purple', 'New best'], ['s-green', 'Above avg'], ['s-yellow', 'Below avg']];
  const last10 = full.slice(-10), avg = last10.reduce((t, g) => t + g.score, 0) / last10.length;
  const recent = last10.map(g => {
    const bestBefore = full.slice(0, full.indexOf(g)).reduce((m, x) => Math.max(m, x.score), -1);
    return { g, cls: g.score > bestBefore ? 's-purple' : g.score >= avg ? 's-green' : 's-yellow' };
  });
  const lastCls = recent[recent.length - 1].cls;
  const lastNote = last.score >= pb ? 'your personal best' : `${pb - last.score} off your best of ${pb}`;

  el.innerHTML =
    `<div class="sb-figs">` +
      `<div class="sb-fig main"><span class="lbl">${week.length ? 'Best this week' : 'Latest game'}</span><b>${head}</b></div>` +
      `<div class="sb-fig last ${lastCls}"><span class="lbl">Last game</span><b>${last.score}</b>` +
        `<small>${esc(shortDate(parseDate(last.date)))} · ${lastNote}</small>` +
        `<span class="sb-avg"><b>${round1(avg)}</b> average of your last ${last10.length}</span></div>` +
    `</div>` +
    `<p class="sb-ready" title="An interview is one try: this is the score you reach in at least 8 of every 10 games, not your best">${readinessLine(readiness(full.map(g => g.score)))}</p>` +
    `<p class="sb-pct" hidden></p>` +
    `<div class="sb-laps-head"><h3>${recent.length === 1 ? 'Last game' : `Last ${recent.length} games`}</h3>` +
      `<span class="key">${SECTORS.map(([cls, label]) => `<span class="${cls}">${label}</span>`).join('')}</span></div>` +
    `<ol class="laps">${recent.map(r => `<li class="${r.cls}" title="${longDate(parseDate(r.g.date))}">${r.g.score}<small>${esc(shortDate(parseDate(r.g.date)))}</small></li>`).join('')}</ol>`;
  renderStanding(pb);
}

// Where the 2-minute best stands among everyone on the website's leaderboard. Website only, and
// only once the board has enough players to make a percentage mean something.
async function renderStanding(pb) {
  const cloud = window.ZM_CLOUD;
  if (!window.ZM_WEB || !cloud?.ready) return;
  let s;
  try { s = await cloud.standing('standard', 120, pb, cloud.user()?.name); } catch { return; }
  const el = $('#score .sb-pct');
  if (!s || !el) return;
  el.innerHTML = `Your best of <b>${pb}</b> · ${esc(cloud.standingText(s))} on the <a href="leaderboard.html">leaderboard</a>`;
  el.hidden = false;
}

// The quant tests at the foot of the score panel, one line each: best and latest, with a link to
// the test's chart.
function renderO80Line() {
  const el = $('#o80-line');
  const lines = Object.entries(TESTS).map(([mode, [name, secs]]) => {
    const tests = allGames.filter(g => g.mode === mode && g.seconds === secs).sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
    if (!tests.length) return '';
    const best = Math.max(...tests.map(g => g.score)), last = tests[tests.length - 1];
    return `<span class="t-line"><span class="lbl t-${mode}">${name}</span><span><b>${best}</b>best</span>` +
      `<span><b>${last.score}</b>last · ${esc(shortDate(parseDate(last.date)))}</span>` +
      `<span>${plural(tests.length, 'test')}</span><a href="#" data-chart="${mode}">Chart</a></span>`;
  }).join('');
  el.hidden = !lines;
  el.innerHTML = lines;
}
$('#o80-line').addEventListener('click', e => {
  const link = e.target.closest('[data-chart]');
  if (!link) return;
  e.preventDefault();
  const pick = $('#chart-game');
  pick.value = link.dataset.chart;
  pick.dispatchEvent(new Event('change'));
  $('#chart').closest('.panel').scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
});
