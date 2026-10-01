// The full match history, a second view of the Duel page (duel.html#history): your record, how
// you do on each kind of problem, and every finished match, newest first, 50 at a time.
(() => {
  const $ = s => document.querySelector(s);
  const cloud = window.ZM_CLOUD, M = window.ZM_MATCHES;
  if (!window.ZM_WEB || !cloud?.ready || !$('#history-view')) return;
  const PAGE = 50;
  let all = [], game = 'all', shown = PAGE;
  const group = g => M.GAMES[g] || 'Duel';  // squares matches group by range, whichever number set

  function renderList() {
    const list = game === 'all' ? all : all.filter(m => group(m.game) === game);
    $('#list').innerHTML = list.slice(0, shown).map(M.row).join('');
    $('#list-sub').textContent = list.length ? `${list.length} ${list.length === 1 ? 'match' : 'matches'}` : '';
    $('#note').textContent = all.length ? (list.length ? '' : 'No matches with these problems yet.') : 'No matches yet. Find one from the Duel page and it shows up here.';
    $('#more').hidden = list.length <= shown;
    $('#more').textContent = `Show more (${Math.min(PAGE, list.length - shown)} of ${list.length - shown} left)`;
  }

  function render() {
    const { won, lost, draw } = M.record(all);
    $('#rec-w').textContent = won; $('#rec-l').textContent = lost; $('#rec-d').textContent = draw;
    $('#rate').innerHTML = all.length ? `Won <b>${Math.round(won / all.length * 100)}%</b> of ${all.length} ${all.length === 1 ? 'match' : 'matches'}` : '';
    const groups = [...new Set(all.map(m => group(m.game)))];
    $('#by').innerHTML = groups.map(g => {
      const r = M.record(all.filter(m => group(m.game) === g));
      return `<li><span>${g}</span><span><b>${r.won}–${r.lost}</b>${r.draw ? `<small>${r.draw} drawn</small>` : ''}</span></li>`;
    }).join('') || '<li><span>No matches yet</span></li>';
    $('#filter').hidden = groups.length < 2;
    if (!groups.includes(game)) game = 'all';
    $('#filter').innerHTML = ['all', ...groups].map(g => `<button type="button" data-game="${g}" aria-pressed="${g === game}">${g === 'all' ? 'All' : g}</button>`).join('');
    renderList();
  }

  // Your rating after each ranked match, oldest first, with the ranks' lines behind it. A new
  // season (the rating moved halfway back to 1000) breaks the line. Past seasons are listed under it
  // with the rank each one peaked at.
  function renderRating(you) {
    const ranked = all.filter(m => m.ranked && Number.isInteger(m.elo) && Number.isInteger(m.delta)).reverse();
    const box = $('#rating-box');
    box.hidden = !ranked.length && !you.seasons.length;
    if (box.hidden) return;
    $('#rating-sub').textContent = `Season ${M.seasonName(you.season)} · peak ${you.peak}`;
    $('#seasons').innerHTML = you.seasons.map(x => { const k = M.rank(x.peak); return `<li class="rk-${k.tier}"><span>${M.seasonName(x.season)}</span><b>${k.name}</b></li>`; }).join('');
    const svg = $('#rating-graph');
    if (ranked.length < 2) { svg.style.display = 'none'; return; }
    svg.style.display = '';
    const pts = ranked.map(m => ({ before: m.elo, after: m.elo + m.delta }));
    const W = svg.clientWidth || 360, H = 170, pad = { l: 8, r: 70, t: 10, b: 10 };
    const vals = pts.flatMap(p => [p.before, p.after]);
    const lo = Math.min(...vals) - 20, hi = Math.max(...vals) + 20;
    const X = i => pad.l + (i / pts.length) * (W - pad.l - pad.r);
    const Y = v => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
    let h = '';
    for (const [min, name] of M.RANKS) if (min > lo && min < hi) h += `<line class="band" x1="${pad.l}" x2="${W - pad.r}" y1="${Y(min)}" y2="${Y(min)}"/><text x="${W - pad.r + 6}" y="${Y(min) + 4}">${name}</text>`;
    let d = `M${X(0)},${Y(pts[0].before)}`;
    pts.forEach((p, i) => { if (i && p.before !== pts[i - 1].after) d += `M${X(i)},${Y(p.before)}`; d += `L${X(i + 1)},${Y(p.after)}`; });
    h += `<path class="line" d="${d}"/>`;
    const peak = pts.reduce((b, p, i) => (p.after > pts[b].after ? i : b), 0);
    h += `<circle class="pt" cx="${X(pts.length)}" cy="${Y(pts[pts.length - 1].after)}" r="3.5"/><circle class="peak" cx="${X(peak + 1)}" cy="${Y(pts[peak].after)}" r="4"><title>Peak ${pts[peak].after}</title></circle>`;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('aria-label', `Rating over ${pts.length} ranked matches: from ${pts[0].before} to ${pts[pts.length - 1].after}, peak ${pts[peak].after}`);
    svg.innerHTML = h;
  }

  $('#filter').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    game = b.dataset.game; shown = PAGE;
    $('#filter').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
    renderList();
  });
  $('#more').addEventListener('click', () => { shown += PAGE; renderList(); });

  // Switching views: the lobby and this history share the page.
  const brand = document.querySelector('.lt-brand span');
  function open() {
    if (!cloud.user()) return;
    // From a finished match's screen: back to the page first (mid-match, the link waits).
    if ($('#game').style.display === 'block') {
      if ($('#end').style.display !== 'block') return;
      $('#lobby').click();
    }
    $('#lobby-view').hidden = true;
    $('#history-view').hidden = false;
    brand.textContent = 'Duel history';
    document.title = 'Duel History';
    shown = PAGE;
    $('#note').textContent = 'Loading your matches…';
    Promise.all([M.load(), M.mine().catch(() => null)]).then(([list, you]) => { all = list; render(); if (you) renderRating(you); })
      .catch(err => { $('#note').textContent = `Couldn’t load your matches: ${err.message || 'try again.'}`; });
    scrollTo(0, 0);
  }
  function close() {
    $('#history-view').hidden = true;
    $('#lobby-view').hidden = false;
    brand.textContent = 'Duel';
    document.title = 'Duel';
    if (location.hash === '#history') history.replaceState(null, '', location.pathname);
  }
  $('#history-back').addEventListener('click', e => { e.preventDefault(); close(); $('#start')?.focus(); });
  const follow = () => { if (location.hash === '#history') open(); else if (!$('#history-view').hidden) close(); };
  addEventListener('hashchange', follow);
  follow();
})();
