// The leaderboard (leaderboard.html): where you stand on every board, and any board's full
// classification, all time or this week. Reads the public leaderboard views through cloud.js.
// Names open each player's profile (profile.html#name).
(() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cloud = window.ZM_CLOUD;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const day = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }), dayYear = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const clock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const pad = n => String(n).padStart(2, '0');
  const now = new Date(), today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  // `daily` and `elo` boards don't change with the week switch: today's challenge, and ratings.
  const BOARDS = [
    { key: 'standard|120', name: 'Arithmetic', len: '2:00', team: 't-arith' },
    { key: 'daily', name: 'Daily challenge', len: 'Today', team: 't-daily', daily: true, play: 'today’s challenge on the Arithmetic page' },
    { key: 'standard|30', name: 'Arithmetic', len: '0:30', team: 't-arith' },
    { key: 'mixed|120', name: 'Combined operations', len: '2:00', team: 't-mix' },
    { key: 'o80|480', name: '80 in 8', len: '8:00', team: 't-o80', test: true, play: 'an 80-in-8 test' },
    { key: 'seq|240', name: 'Sequences', len: '4:00', team: 't-seq', test: true, play: 'a sequences test' },
    { key: 'frac|240', name: 'Fractions', len: '4:00', team: 't-frac', test: true, play: 'a fractions test' },
    { key: 'est|240', name: 'Estimation', len: '4:00', team: 't-est', test: true, play: 'an estimation test' },
    { key: 'elo', name: 'Duel rating', len: 'Ranked', team: 't-rank', elo: true, play: 'your 5 placement matches in ranked duels' },
    { key: 'sq99h|120', name: 'Two-digit squares', len: '2:00', team: 't-sq' },
    { key: 'sq999h|120', name: 'Three-digit squares', len: '2:00', team: 't-sq' },
    { key: 'standard|0', name: 'Arithmetic', len: 'Endless', team: 't-end', endless: true },
  ];
  let chosen = BOARDS[0].key, week = false, showOpen = false;
  try { const k = localStorage.getItem('zm-board'); if (BOARDS.some(b => b.key === k)) chosen = k; week = localStorage.getItem('zm-board-week') === '1'; } catch {}
  // The link carries what's showing (leaderboard.html#board=o80|480&when=week), so it can be shared.
  // #daily is the short link to today's challenge board.
  let viewDay = today;  // the daily board's day
  const past = new Map();  // other days' daily boards, as they're looked at
  const readURL = () => {
    const q = new URLSearchParams(location.hash.slice(1));
    if (location.hash === '#daily') chosen = 'daily';
    if (BOARDS.some(b => b.key === q.get('board'))) chosen = q.get('board');
    if (q.has('when')) week = q.get('when') === 'week';
    viewDay = /^\d{4}-\d{2}-\d{2}$/.test(q.get('day') || '') && q.get('day') <= today ? q.get('day') : today;
  };
  readURL();
  addEventListener('hashchange', () => { readURL(); load(true); });  // a link opened on this page
  const syncURL = () => {
    const q = new URLSearchParams();
    if (chosen !== BOARDS[0].key) q.set('board', chosen);
    if (week) q.set('when', 'week');
    if (chosen === 'daily' && viewDay !== today) q.set('day', viewDay);
    history.replaceState(null, '', `${q}` ? `#${q}` : location.pathname);
  };
  const shiftDay = (s, n) => { const [y, m, d] = s.split('-').map(Number), t = new Date(y, m - 1, d + n); return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`; };
  let byBoard = new Map(), loaded = false;
  const me = () => cloud?.user()?.name?.toLowerCase() || null;

  const user = cloud?.user();
  if (user) { $('#acct-link').textContent = user.name; }
  $('#join').hidden = !(window.ZM_WEB && cloud?.ready && !user);

  const dateText = s => { const [y, m, d] = s.split('-').map(Number); return (y === new Date().getFullYear() ? day : dayYear).format(new Date(y, m - 1, d)); };
  const RANK = window.ZM_MATCHES?.rank;
  const timed = b => !b.daily && !b.elo;  // boards the week switch applies to
  // The figure, with what breaks ties on each board: the endless run's time, a test's wrong
  // answers and time, and a rating's rank.
  const figure = (b, r) => b.endless ? `${r.score}<small>in ${clock(r.elapsed)}</small>`
    : b.elo ? `${r.score}<small>${RANK ? RANK(r.score).name : ''}</small>`
    : b.test && Number.isInteger(r.wrongs) ? `${r.score}<small>${r.wrongs} wrong${r.elapsed ? ` · ${clock(r.elapsed)}` : ''}</small>` : `${r.score}`;
  const behind = (b, r, top) => (r === top ? 'P1' : `−${top.score - r.score}`);
  // Players tied on the same figure share a place.
  const places = list => list.map((r, i) => (i && list[i - 1].score === r.score && list[i - 1].elapsed === r.elapsed && (list[i - 1].wrongs ?? null) === (r.wrongs ?? null) ? null : i + 1))
    .map((p, i, arr) => { let k = i; while (arr[k] === null) k--; return arr[k]; });
  const nameLink = n => `<a href="profile.html#${encodeURIComponent(n)}">${esc(n)}</a>`;

  function renderBoards() {
    const mine = me();
    $('#stand-sub').textContent = mine ? `as ${cloud.user().name}` : 'the leader on each board';
    document.querySelectorAll('#when button').forEach(b => b.setAttribute('aria-pressed', (b.dataset.when === 'week') === week));
    // Boards no one is on yet fold into one row (the chosen one always shows), so the live ones lead.
    const open = BOARDS.filter(b => !(byBoard.get(b.key) || []).length && b.key !== chosen);
    const fold = loaded && open.length > 1 && !showOpen;
    $('#boards').innerHTML = BOARDS.filter(b => !fold || !open.includes(b)).map(b => {
      const list = byBoard.get(b.key) || [];
      const at = mine ? list.findIndex(r => r.username.toLowerCase() === mine) : -1;
      const pl = places(list);
      let line, place;
      if (at >= 0) {
        const r = list[at], ahead = list.slice(0, at).reverse().find(x => x.score > r.score);
        const what = b.elo ? `Rating <b>${r.score}</b>${RANK ? ` · ${RANK(r.score).name}` : ''}` : b.daily ? `Today <b>${r.score}</b>` : `${week && timed(b) ? 'Week best' : 'PB'} <b>${r.score}</b>`;
        line = ahead ? `${what} · ${ahead.score - r.score + 1} to pass ${esc(ahead.username)}` : `${what} · leading`;
        place = `<span class="place${pl[at] === 1 ? ' p1' : ''}"><b>P${pl[at]}</b><span>of ${list.length}</span></span>`;
      } else {
        line = list.length ? `Leader ${esc(list[0].username)} · <b>${list[0].score}</b>` : b.daily ? 'No one yet today' : week && timed(b) ? 'No one yet this week' : 'No one yet';
        place = `<span class="place none"><b>—</b><span>${list.length ? `${list.length} on board` : 'open'}</span></span>`;
      }
      return `<li><button type="button" class="board ${b.team}" data-key="${b.key}" aria-pressed="${b.key === chosen}">` +
        `<span class="stripe"></span><span><span class="name">${b.name}<small>${b.len}${week && timed(b) ? ' · week' : ''}</small></span><span class="line">${line}</span></span>${place}</button></li>`;
    }).join('') + (loaded && open.length > 1 ? `<li><button type="button" class="open-boards" aria-expanded="${showOpen}">${showOpen ? 'Hide open boards' : `${open.length} open boards`}<small>${showOpen ? '' : open.map(b => b.name + (b.len === '2:00' ? '' : ` ${b.len}`)).join(' · ')}</small></button></li>` : '');
  }

  function renderTower(animate = false) {
    const b = BOARDS.find(x => x.key === chosen), mine = me();
    const list = (b.daily && viewDay !== today ? past.get(viewDay) : byBoard.get(b.key)) || [];
    $('#b-title').innerHTML = `${b.name}<small>${b.daily ? (viewDay === today ? 'Today' : dateText(viewDay)) : b.len}${week && timed(b) ? ' · this week' : ''}</small>`;
    $('#day-step').hidden = !b.daily;
    $('#day-next').disabled = viewDay >= today;
    $('#b-sub').textContent = list.length ? `${list.length} ${list.length === 1 ? 'player' : 'players'} · ${b.endless ? 'questions answered' : b.elo ? 'rating · ranked duels, this season' : b.daily ? 'one try each, the same questions for everyone' : b.test ? 'best score · ties: fewer wrong, then faster' : 'best score'}` : '';
    const tower = $('#tower');
    const pl = places(list);
    tower.innerHTML = list.length ? list.map((r, i) => {
      const you = mine && r.username.toLowerCase() === mine;
      const ahead = you && list.slice(0, i).reverse().find(x => x.score > r.score);
      return `<li class="${b.team}${you ? ' me' : ''}"><span class="pos">${pl[i]}</span><span class="stripe"></span>` +
        `<span class="who">${nameLink(r.username)}${you ? '<span class="you">You</span>' : ''}${ahead ? `<span class="to-pass">${ahead.score - r.score + 1} to pass ${esc(ahead.username)}</span>` : ''}</span>` +
        `<span class="figure${pl[i] === 1 ? ' p1' : ''}">${figure(b, r)}</span><span class="gap">${behind(b, r, list[0])}</span><span class="date">${b.elo ? `${r.wins}–${r.losses}` : b.daily ? '' : dateText(r.date)}</span></li>`;
    }).join('') : `<li class="empty-row"><p class="empty">${b.daily ? (viewDay === today ? 'No one has played today’s challenge yet' : 'No one played that day’s challenge') : week && timed(b) ? 'No one on this board this week yet' : 'No one on this board yet'}${b.daily && viewDay !== today ? '.' : `. Play ${b.play || (b.endless ? 'an endless run' : `a ${b.len} ${b.name.toLowerCase()} game`)} on the site while signed in to set the first mark.`}</p></li>`;
    if (animate && !reduceMotion.matches) { tower.classList.remove('enter'); void tower.offsetWidth; tower.classList.add('enter'); }
    const row = tower.querySelector('li.me');
    if (animate && row && innerWidth > 900) row.scrollIntoView({ block: 'nearest', behavior: reduceMotion.matches ? 'auto' : 'smooth' });
  }

  $('#boards').addEventListener('click', e => {
    if (e.target.closest('.open-boards')) { showOpen = !showOpen; renderBoards(); return; }
    const btn = e.target.closest('.board');
    if (!btn) return;
    chosen = btn.dataset.key;
    try { localStorage.setItem('zm-board', chosen); } catch {}
    syncURL();
    renderBoards();
    renderTower(true);
    if (innerWidth <= 900) $('#tower').closest('.panel').scrollIntoView({ block: 'start', behavior: reduceMotion.matches ? 'auto' : 'smooth' });
  });
  $('#when').addEventListener('click', e => {
    const btn = e.target.closest('[data-when]');
    if (!btn || (btn.dataset.when === 'week') === week) return;
    week = btn.dataset.when === 'week';
    try { localStorage.setItem('zm-board-week', week ? '1' : '0'); } catch {}
    syncURL();
    load(true);
  });
  // The daily board steps back through earlier days (and forward again, up to today).
  async function showDay(d) {
    viewDay = d;
    syncURL();
    if (viewDay !== today && !past.has(viewDay)) {
      try { past.set(viewDay, (await cloud.daily(viewDay)).filter(r => typeof r.username === 'string' && Number.isInteger(r.score)).map(r => ({ username: r.username, score: r.score, elapsed: 0 }))); }
      catch { past.set(viewDay, []); }
    }
    renderTower(true);
  }
  $('#day-step').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b && !b.disabled) showDay(shiftDay(viewDay, Number(b.dataset.day)));
  });

  async function load(animate = false) {
    if (!cloud?.ready) {
      $('#b-title').textContent = 'Leaderboard';
      $('#tower').innerHTML = '<li class="empty-row"><p class="empty">The leaderboard isn’t switched on for this copy of the site yet.</p></li>';
      renderBoards();
      return;
    }
    try {
      const [rows, ladder, day] = await Promise.all([cloud.leaderboard(week), cloud.ladder().catch(() => []), cloud.daily(today).catch(() => [])]);
      byBoard = new Map(BOARDS.map(b => [b.key, []]));
      for (const r of rows) {
        const list = byBoard.get(`${r.mode}|${r.seconds}`);
        if (list && typeof r.username === 'string' && Number.isInteger(r.score)) list.push(r);
      }
      for (const r of ladder) {
        if (typeof r.username === 'string' && Number.isInteger(r.elo))
          byBoard.get('elo').push({ username: r.username, score: r.elo, elapsed: 0, wins: r.wins | 0, losses: r.losses | 0 });
      }
      loaded = true;
      for (const r of day) if (typeof r.username === 'string' && Number.isInteger(r.score)) byBoard.get('daily').push({ username: r.username, score: r.score, elapsed: 0 });
      // Ties: endless by the faster run; tests by fewer wrong, then faster; then the earlier date.
      const big = v => (Number.isInteger(v) && v > 0 ? v : Infinity);
      for (const [k, list] of byBoard) {
        const test = BOARDS.find(b => b.key === k)?.test;
        list.sort((a, b) => b.score - a.score || (k.endsWith('|0') ? a.elapsed - b.elapsed : 0)
          || (test ? (a.wrongs ?? Infinity) - (b.wrongs ?? Infinity) || big(a.elapsed) - big(b.elapsed) : 0)
          || (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      }
      renderBoards();
      if (chosen === 'daily' && viewDay !== today) await showDay(viewDay); else renderTower(animate);
    } catch (err) {
      $('#b-title').textContent = 'Leaderboard';
      $('#tower').innerHTML = `<li class="empty-row"><p class="empty">Couldn’t load the leaderboard: ${esc(err.message)}</p></li>`;
    }
  }
  renderBoards();
  load();
  window.addEventListener('focus', () => load());
})();
