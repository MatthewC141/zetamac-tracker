// The leaderboard (leaderboard.html): where you stand on every board, and any board's
// classification, all time or this week. The database works out the boards (cloud.js → boards,
// board), so the page fetches only what it shows: the first 100 of a board, and you with the
// players either side of you when you're further down. Names open each player's profile.
(() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cloud = window.ZM_CLOUD, B = window.ZM_BOARDS;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const day = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }), dayYear = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const clock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const pad = n => String(n).padStart(2, '0');
  const todayKey = () => { const n = new Date(); return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`; };
  let today = todayKey();  // moved on by load() when a tab stays open past midnight
  const TOP = 100;  // rows of a board shown before skipping down to yours

  let chosen = B.list[0].key, week = false, showOpen = false;
  try { const k = localStorage.getItem('zm-board'); if (B.get(k)) chosen = k; week = localStorage.getItem('zm-board-week') === '1'; } catch {}
  // The link carries what's showing (leaderboard.html#board=o80|480&when=week), so it can be shared.
  // #daily is the short link to today's challenge board.
  let viewDay = today;  // the daily board's day
  const readURL = () => {
    const q = new URLSearchParams(location.hash.slice(1));
    if (location.hash === '#daily') chosen = 'daily';
    if (B.get(q.get('board'))) chosen = q.get('board');
    if (q.has('when')) week = q.get('when') === 'week';
    viewDay = /^\d{4}-\d{2}-\d{2}$/.test(q.get('day') || '') && q.get('day') <= today ? q.get('day') : today;
  };
  readURL();
  addEventListener('hashchange', () => { readURL(); load(true); });  // a link opened on this page
  const syncURL = () => {
    const q = new URLSearchParams();
    if (chosen !== B.list[0].key) q.set('board', chosen);
    if (week) q.set('when', 'week');
    if (chosen === 'daily' && viewDay !== today) q.set('day', viewDay);
    history.replaceState(null, '', `${q}` ? `#${q}` : location.pathname);
  };
  const shiftDay = (s, n) => { const [y, m, d] = s.split('-').map(Number), t = new Date(y, m - 1, d + n); return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`; };

  // What's loaded: each saved-game board's summary (size, leader, your place), the duel ladder and
  // daily boards in full (they're short), and the chosen board's rows.
  let summary = new Map(), ladder = [], daily = new Map(), shown = null, loaded = false;
  const me = () => cloud?.user()?.name || null;
  const mine = n => !!me() && n.toLowerCase() === me().toLowerCase();

  const user = cloud?.user();
  if (user) { $('#acct-link').textContent = user.name; }
  $('#join').hidden = !(window.ZM_WEB && cloud?.ready && !user);

  const dateText = s => { const [y, m, d] = s.split('-').map(Number); return (y === new Date().getFullYear() ? day : dayYear).format(new Date(y, m - 1, d)); };
  const RANK = window.ZM_MATCHES?.rank;
  const timed = b => !b.daily && !b.elo;  // boards the week switch applies to
  // The figure, with what breaks ties: the endless run's time, a test's wrong answers and time, a rating's rank.
  const figure = (b, r) => b.endless ? `${r.score}<small>in ${clock(r.elapsed)}</small>`
    : b.elo ? `${r.score}<small>${RANK ? RANK(r.score).name : ''}</small>`
    : b.test && Number.isInteger(r.wrongs) ? `${r.score}<small>${r.wrongs} wrong${r.elapsed ? ` · ${clock(r.elapsed)}` : ''}</small>` : `${r.score}`;
  const nameLink = n => `<a href="profile.html#${encodeURIComponent(n)}">${esc(n)}</a>`;

  // The duel ladder and daily boards come whole: places (ties share one) and positions here.
  const ranked = list => list.map((r, i) => ({ ...r, pos: i + 1 })).map((r, i, all) => ({ ...r, place: i && all[i - 1].score === r.score ? null : i + 1 }))
    .map((r, i, all) => { let k = i; while (all[k].place === null) k--; return { ...r, place: all[k].place }; });
  // A whole list as the board view: the first rows, and you with your neighbours when further down.
  const asBoard = list => {
    const rows = ranked(list), at = rows.findIndex(r => mine(r.username));
    return { total: rows.length, rows: rows.slice(0, TOP), around: at >= TOP ? rows.slice(at - 2, at + 3) : [] };
  };
  // A board's line in the list on the left: your place and who's next, or the leader.
  function standing(b) {
    if (b.daily || b.elo) {
      const rows = ranked(b.elo ? ladder : daily.get(today) || []), at = rows.findIndex(r => mine(r.username));
      const r = rows[at], ahead = at > 0 ? rows.slice(0, at).reverse().find(x => x.score > r.score) : null;
      return { total: rows.length, leader: rows[0], me: r && { place: r.place, score: r.score, ahead } };
    }
    return summary.get(b.key) || { total: 0 };
  }

  function renderBoards() {
    $('#stand-sub').textContent = me() ? `as ${me()}` : 'the leader on each board';
    document.querySelectorAll('#when button').forEach(btn => btn.setAttribute('aria-pressed', (btn.dataset.when === 'week') === week));
    // Boards no one is on yet fold into one row (the chosen one always shows), so the live ones lead.
    const open = B.list.filter(b => !standing(b).total && b.key !== chosen);
    const fold = loaded && open.length > 1 && !showOpen;
    $('#boards').innerHTML = B.list.filter(b => !fold || !open.includes(b)).map(b => {
      const s = standing(b);
      let line, place;
      if (s.me) {
        const what = b.elo ? `Rating <b>${s.me.score}</b>${RANK ? ` · ${RANK(s.me.score).name}` : ''}` : b.daily ? `Today <b>${s.me.score}</b>` : `${week && timed(b) ? 'Week best' : 'PB'} <b>${s.me.score}</b>`;
        line = s.me.ahead ? `${what} · ${s.me.ahead.score - s.me.score + 1} to pass ${esc(s.me.ahead.username)}` : `${what} · leading`;
        place = `<span class="place${s.me.place === 1 ? ' p1' : ''}"><b>P${s.me.place}</b><span>of ${s.total}</span></span>`;
      } else {
        line = s.total ? `Leader ${esc(s.leader.username)} · <b>${s.leader.score}</b>` : b.daily ? 'No one yet today' : week && timed(b) ? 'No one yet this week' : 'No one yet';
        place = `<span class="place none"><b>—</b><span>${s.total ? `${s.total} on board` : 'open'}</span></span>`;
      }
      return `<li><button type="button" class="board ${b.team}" data-key="${b.key}" aria-pressed="${b.key === chosen}">` +
        `<span class="stripe"></span><span><span class="name">${b.name}<small>${b.len}${week && timed(b) ? ' · week' : ''}</small></span><span class="line">${line}</span></span>${place}</button></li>`;
    }).join('') + (loaded && open.length > 1 ? `<li><button type="button" class="open-boards" aria-expanded="${showOpen}">${showOpen ? 'Hide open boards' : `${open.length} open boards`}<small>${showOpen ? '' : open.map(b => b.name + (b.len === '2:00' ? '' : ` ${b.len}`)).join(' · ')}</small></button></li>` : '');
  }

  function renderTower(animate = false) {
    const b = B.get(chosen), view = shown || { total: 0, rows: [], around: [] };
    $('#b-title').innerHTML = `${b.name}<small>${b.daily ? (viewDay === today ? 'Today' : dateText(viewDay)) : b.len}${week && timed(b) ? ' · this week' : ''}</small>`;
    $('#day-step').hidden = !b.daily;
    $('#day-next').disabled = viewDay >= today;
    $('#b-sub').textContent = view.total ? `${view.total} ${view.total === 1 ? 'player' : 'players'} · ${b.endless ? 'questions answered' : b.elo ? 'rating · ranked duels, this season' : b.daily ? 'one try each, the same questions for everyone' : b.test ? 'best score · ties: fewer wrong, then faster' : 'best score'}` : '';
    const top = view.rows[0];
    const row = r => {
      const you = mine(r.username);
      const all = [...view.rows, ...view.around], ahead = you && all.filter(x => x.pos < r.pos && x.score > r.score).sort((x, y) => y.pos - x.pos)[0];
      return `<li class="${b.team}${you ? ' me' : ''}"><span class="pos">${r.place}</span><span class="stripe"></span>` +
        `<span class="who">${nameLink(r.username)}${you ? '<span class="you">You</span>' : ''}${ahead ? `<span class="to-pass">${ahead.score - r.score + 1} to pass ${esc(ahead.username)}</span>` : ''}</span>` +
        `<span class="figure${r.place === 1 ? ' p1' : ''}">${figure(b, r)}</span><span class="gap">${r === top ? 'P1' : `−${top.score - r.score}`}</span><span class="date">${b.elo ? `${r.wins}–${r.losses}` : b.daily ? '' : dateText(r.date)}</span></li>`;
    };
    const skipped = view.around.length ? view.around[0].pos - view.rows.length - 1 : 0;
    const tower = $('#tower');
    tower.innerHTML = view.total ? view.rows.map(row).join('') +
      (view.around.length ? `<li class="skip-row">${skipped > 0 ? `${skipped} more` : ''}</li>${view.around.map(row).join('')}` : '') +
      (!view.around.length && view.total > view.rows.length ? `<li class="skip-row">and ${view.total - view.rows.length} more</li>` : '')
      : `<li class="empty-row"><p class="empty">${b.daily ? (viewDay === today ? 'No one has played today’s challenge yet' : 'No one played that day’s challenge') : week && timed(b) ? 'No one on this board this week yet' : 'No one on this board yet'}${b.daily && viewDay !== today ? '.' : `. Play ${b.play || (b.endless ? 'an endless run' : `a ${b.len} ${b.name.toLowerCase()} game`)} on the site while signed in to set the first mark.`}</p></li>`;
    if (animate && !reduceMotion.matches) { tower.classList.remove('enter'); void tower.offsetWidth; tower.classList.add('enter'); }
    const meRow = tower.querySelector('li.me');
    if (animate && meRow && innerWidth > 900) meRow.scrollIntoView({ block: 'nearest', behavior: reduceMotion.matches ? 'auto' : 'smooth' });
  }

  // The chosen board's rows: fetched for a saved-game board, from the lists for the others.
  async function fetchShown() {
    const b = B.get(chosen);
    if (b.elo) return asBoard(ladder);
    if (b.daily) {
      if (!daily.has(viewDay)) {
        try { daily.set(viewDay, (await cloud.daily(viewDay)).filter(r => typeof r.username === 'string' && Number.isInteger(r.score))); }
        catch { daily.set(viewDay, []); }
      }
      return asBoard(daily.get(viewDay));
    }
    const r = await cloud.board(b.mode, b.seconds, week && timed(b), me(), TOP);
    const clean = list => (Array.isArray(list) ? list : []).filter(x => typeof x.username === 'string' && Number.isInteger(x.score));
    return { total: r?.total | 0, rows: clean(r?.rows), around: clean(r?.around) };
  }
  async function showChosen(animate) {
    const want = chosen;
    const view = await fetchShown();
    if (want !== chosen) return;  // another board was picked meanwhile
    shown = view;
    renderTower(animate);
  }

  $('#boards').addEventListener('click', e => {
    if (e.target.closest('.open-boards')) { showOpen = !showOpen; renderBoards(); return; }
    const btn = e.target.closest('.board');
    if (!btn) return;
    chosen = btn.dataset.key;
    if (chosen !== 'daily') viewDay = today;
    try { localStorage.setItem('zm-board', chosen); } catch {}
    syncURL();
    renderBoards();
    showChosen(true).catch(fail);
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
  $('#day-step').addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    viewDay = shiftDay(viewDay, Number(btn.dataset.day));
    syncURL();
    showChosen(true).catch(fail);
  });

  function fail(err) {
    $('#b-title').textContent = 'Leaderboard';
    $('#tower').innerHTML = `<li class="empty-row"><p class="empty">Couldn’t load the leaderboard: ${esc(err.message)}</p></li>`;
  }
  async function load(animate = false) {
    const t = todayKey();
    if (t !== today) { if (viewDay === today) viewDay = t; today = t; daily.delete(t); }
    if (!cloud?.ready) {
      $('#b-title').textContent = 'Leaderboard';
      $('#tower').innerHTML = '<li class="empty-row"><p class="empty">The leaderboard isn’t switched on for this copy of the site yet.</p></li>';
      renderBoards();
      return;
    }
    try {
      const [boards, lad, day] = await Promise.all([cloud.boards(week, me()), cloud.ladder().catch(() => []), cloud.daily(today).catch(() => [])]);
      summary = new Map((Array.isArray(boards) ? boards : []).map(x => [B.keyOf(x.mode, x.seconds), x]));
      ladder = lad.filter(r => typeof r.username === 'string' && Number.isInteger(r.elo)).map(r => ({ username: r.username, score: r.elo, elapsed: 0, wins: r.wins | 0, losses: r.losses | 0 }));
      daily.set(today, day.filter(r => typeof r.username === 'string' && Number.isInteger(r.score)));
      loaded = true;
      renderBoards();
      await showChosen(animate);
    } catch (err) { fail(err); }
  }
  renderBoards();
  load();
  window.addEventListener('focus', () => load());
})();
