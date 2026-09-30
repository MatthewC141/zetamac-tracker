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
    $('#lobby-view').hidden = true;
    $('#history-view').hidden = false;
    brand.textContent = 'Duel history';
    document.title = 'Duel History';
    shown = PAGE;
    $('#note').textContent = 'Loading your matches…';
    M.load().then(list => { all = list; render(); })
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
