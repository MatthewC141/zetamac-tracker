// The leaderboard (leaderboard.html): where you stand on every board, and any board's full
// classification. Reads the public leaderboard view through cloud.js.
(() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cloud = window.ZM_CLOUD;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const clock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const BOARDS = [
    { key: 'standard|120', name: 'Arithmetic', len: '2:00', team: 't-arith' },
    { key: 'standard|30', name: 'Arithmetic', len: '0:30', team: 't-arith' },
    { key: 'mixed|120', name: 'Combined operations', len: '2:00', team: 't-mix' },
    { key: 'o80|480', name: '80 in 8', len: '8:00', team: 't-o80', play: 'an 80-in-8 test' },
    { key: 'sq99h|120', name: 'Two-digit squares', len: '2:00', team: 't-sq' },
    { key: 'sq999h|120', name: 'Three-digit squares', len: '2:00', team: 't-sq' },
    { key: 'standard|0', name: 'Arithmetic', len: 'Endless', team: 't-end', endless: true },
  ];
  let chosen = BOARDS[0].key;
  try { const k = localStorage.getItem('zm-board'); if (BOARDS.some(b => b.key === k)) chosen = k; } catch {}
  let byBoard = new Map();
  const me = () => cloud?.user()?.name?.toLowerCase() || null;

  const user = cloud?.user();
  if (user) { $('#acct-link').textContent = user.name; }
  $('#join').hidden = !(window.ZM_WEB && cloud?.ready && !user);

  const dateText = s => { const [y, m, d] = s.split('-').map(Number); return `${MONTHS[m - 1]} ${d}${y === new Date().getFullYear() ? '' : `, ${y}`}`; };
  const figure = (b, r) => b.endless ? `${r.score}<small>in ${clock(r.elapsed)}</small>` : `${r.score}`;
  const behind = (b, r, top) => (r === top ? 'P1' : `−${top.score - r.score}`);
  // Players tied on the same figure share a place.
  const places = list => list.map((r, i) => (i && list[i - 1].score === r.score && (list[i - 1].elapsed === r.elapsed) ? null : i + 1))
    .map((p, i, arr) => { let k = i; while (arr[k] === null) k--; return arr[k]; });

  function renderBoards() {
    const mine = me();
    $('#stand-sub').textContent = mine ? `as ${cloud.user().name}` : 'the leader on each board';
    $('#boards').innerHTML = BOARDS.map(b => {
      const list = byBoard.get(b.key) || [];
      const at = mine ? list.findIndex(r => r.username.toLowerCase() === mine) : -1;
      const pl = places(list);
      let line, place;
      if (at >= 0) {
        const r = list[at], ahead = list.slice(0, at).reverse().find(x => x.score > r.score);
        line = ahead ? `PB <b>${r.score}</b> · ${ahead.score - r.score + 1} to pass ${esc(ahead.username)}` : `PB <b>${r.score}</b> · leading`;
        place = `<span class="place${pl[at] === 1 ? ' p1' : ''}"><b>P${pl[at]}</b><span>of ${list.length}</span></span>`;
      } else {
        line = list.length ? `Leader ${esc(list[0].username)} · <b>${list[0].score}</b>` : 'No one yet';
        place = `<span class="place none"><b>—</b><span>${list.length ? `${list.length} on board` : 'open'}</span></span>`;
      }
      return `<li><button type="button" class="board ${b.team}" data-key="${b.key}" aria-pressed="${b.key === chosen}">` +
        `<span class="stripe"></span><span><span class="name">${b.name}<small>${b.len}</small></span><span class="line">${line}</span></span>${place}</button></li>`;
    }).join('');
  }

  function renderTower(animate = false) {
    const b = BOARDS.find(x => x.key === chosen), list = byBoard.get(b.key) || [], mine = me();
    $('#b-title').innerHTML = `${b.name}<small>${b.len}</small>`;
    $('#b-sub').textContent = list.length ? `${list.length} ${list.length === 1 ? 'player' : 'players'} · ${b.endless ? 'questions answered' : 'best score'}` : '';
    const tower = $('#tower');
    const pl = places(list);
    tower.innerHTML = list.length ? list.map((r, i) => {
      const you = mine && r.username.toLowerCase() === mine;
      const ahead = you && list.slice(0, i).reverse().find(x => x.score > r.score);
      return `<li class="${b.team}${you ? ' me' : ''}"><span class="pos">${pl[i]}</span><span class="stripe"></span>` +
        `<span class="who">${esc(r.username)}${you ? '<span class="you">You</span>' : ''}${ahead ? `<span class="to-pass">${ahead.score - r.score + 1} to pass ${esc(ahead.username)}</span>` : ''}</span>` +
        `<span class="figure${pl[i] === 1 ? ' p1' : ''}">${figure(b, r)}</span><span class="gap">${behind(b, r, list[0])}</span><span class="date">${dateText(r.date)}</span></li>`;
    }).join('') : `<li class="empty-row"><p class="empty">No one on this board yet. Play ${b.play || (b.endless ? 'an endless run' : `a ${b.len} ${b.name.toLowerCase()} game`)} on the site while signed in to set the first mark.</p></li>`;
    if (animate && !reduceMotion.matches) { tower.classList.remove('enter'); void tower.offsetWidth; tower.classList.add('enter'); }
    const row = tower.querySelector('li.me');
    if (animate && row && innerWidth > 900) row.scrollIntoView({ block: 'nearest', behavior: reduceMotion.matches ? 'auto' : 'smooth' });
  }

  $('#boards').addEventListener('click', e => {
    const btn = e.target.closest('.board');
    if (!btn) return;
    chosen = btn.dataset.key;
    try { localStorage.setItem('zm-board', chosen); } catch {}
    renderBoards();
    renderTower(true);
    if (innerWidth <= 900) $('#tower').closest('.panel').scrollIntoView({ block: 'start', behavior: reduceMotion.matches ? 'auto' : 'smooth' });
  });

  async function load() {
    if (!cloud?.ready) {
      $('#b-title').textContent = 'Leaderboard';
      $('#tower').innerHTML = '<li class="empty-row"><p class="empty">The leaderboard isn’t switched on for this copy of the site yet.</p></li>';
      renderBoards();
      return;
    }
    try {
      const rows = await cloud.leaderboard();
      byBoard = new Map(BOARDS.map(b => [b.key, []]));
      for (const r of rows) {
        const list = byBoard.get(`${r.mode}|${r.seconds}`);
        if (list && typeof r.username === 'string' && Number.isInteger(r.score)) list.push(r);
      }
      for (const [k, list] of byBoard) list.sort((a, b) => b.score - a.score || (k.endsWith('|0') ? a.elapsed - b.elapsed : 0) || (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      renderBoards();
      renderTower();
    } catch (err) {
      $('#b-title').textContent = 'Leaderboard';
      $('#tower').innerHTML = `<li class="empty-row"><p class="empty">Couldn’t load the leaderboard: ${esc(err.message)}</p></li>`;
    }
  }
  renderBoards();
  load();
  window.addEventListener('focus', load);
})();
