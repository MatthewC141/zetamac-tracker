// Duels (duel.html), one player against another. The database pairs players, keeps the clock and decides the winner
// (see "1v1 matches" in schema.sql); this page shows the lobby, plays the questions both players
// share (problems.js), and reports each correct answer.
(() => {
  const $ = s => document.querySelector(s);
  const cloud = window.ZM_CLOUD;
  const P = window.ZM_PROBLEMS;
  const clock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const secs = ms => (ms / 1000).toFixed(2);
  const STATES = ['st-off', 'st-need', 'st-lobby', 'st-queue', 'st-code', 'st-found'];
  const show = id => STATES.forEach(s => { $('#' + s).hidden = s !== id; });

  let match = null, me = 0, offset = 0, bestRtt = Infinity, poller = 0, waitStart = 0;
  // The match being played.
  let qs = [], idx = 0, score = 0, lastMs = 0, startPerf = 0, timer = 0, playing = false, finished = false, sending = false, queued = false;

  if (!window.ZM_WEB || !cloud?.ready) return show('st-off');
  if (!cloud.user()) return show('st-need');

  const rpc = (name, body) => cloud.rest(`rpc/${name}`, { method: 'POST', body });
  const game = () => document.querySelector('input[name=game]:checked').value;
  const rule = () => document.querySelector('input[name=rule]:checked').value;
  const them = m => (me === 1 ? m.p2_name : m.p1_name) || 'Opponent';
  const mine = (m, k) => m[`p${me}_${k}`], theirs = (m, k) => m[`p${3 - me}_${k}`];
  const ruleText = m => `${m.ghost ? 'Ghost race · ' : m.ranked ? 'Ranked · ' : ''}${P.NAMES[m.game]} · ${m.rule === 'race' ? `race to ${m.goal}, 2:00 limit` : `most answered in ${clock(m.seconds)}`}`;
  const M = window.ZM_MATCHES;
  const ranked = () => document.querySelector('input[name=queue]:checked').value === 'ranked';

  function lobby(message = '', isError = false) {
    stopPolling();
    match = null; waitStart = 0;
    show('st-lobby');
    $('#msg').textContent = message;
    $('#msg').className = `d-msg${isError ? ' err' : ''}`;
    loadRecord();
    loadRank();
    loadInvites();
    $('#ghost-msg').textContent = '';
  }

  // Your rank card: placement games first, then your rank, rating and the next rank's rating.
  async function loadRank() {
    try {
      const r = await M.mine(), card = $('#rank-card');
      const placing = r.games < M.PLACEMENT, k = M.rank(r.elo);
      card.className = `d-rank rk-${placing ? 'none' : k.tier}`;
      $('#rank-name').textContent = placing ? 'Unranked' : k.name;
      const record = `${r.wins}–${r.losses}${r.draws ? `–${r.draws}` : ''} this season`;
      $('#rank-note').textContent = placing ? `Placement: ${r.games} of ${M.PLACEMENT} matches played`
        : `${k.next ? `${k.next - r.elo} to ${M.rank(k.next).name}` : 'The top rank'} · ${record}`;
      $('#rank-card').title = `Season ${M.seasonName(r.season)} · ratings move halfway back to 1000 when a new season starts each quarter`;
      $('#rank-elo').textContent = r.elo;
      card.hidden = false;
    } catch {}
  }
  function fail(err) {
    if (err?.signedOut || !cloud.user()) return show('st-need');
    lobby(err?.message || 'Something went wrong. Try again.', true);
  }

  // The database's clock, from the round trip with the shortest delay seen so far.
  async function call(name, body) {
    const t0 = Date.now();
    const m = await rpc(name, body);
    const t1 = Date.now();
    if (m?.server_now && t1 - t0 < bestRtt) { bestRtt = t1 - t0; offset = Date.parse(m.server_now) - (t0 + t1) / 2; }
    return m;
  }

  // ---- lobby ----
  // Your record, and your last five matches (All matches shows the rest, duel.html#history).
  async function loadRecord() {
    try {
      const list = await window.ZM_MATCHES.load();
      const { won, lost, draw } = window.ZM_MATCHES.record(list);
      $('#record').innerHTML = list.length ? `Record <b>${won}</b> W · <b>${lost}</b> L${draw ? ` · <b>${draw}</b> D` : ''}` : '';
      $('#mh-list').innerHTML = list.slice(0, 5).map(window.ZM_MATCHES.row).join('');
      $('#mh-note').textContent = list.length ? '' : 'No matches yet. Find one above, or send a friend a code.';
      $('#mh-all').textContent = list.length > 5 ? `All ${list.length} matches` : 'All matches';
      $('#mh-all').hidden = !list.length;
      $('#mh-panel').hidden = false;
    } catch { $('#record').textContent = ''; }
  }

  async function queue() {
    if ($('#st-lobby').hidden || $('#lobby-view').hidden) return;  // not in the lobby (or looking at the history)
    try { enter(await call('mm_queue', { p_game: ranked() ? 'standard' : game(), p_ranked: ranked() })); } catch (err) { fail(err); }
  }
  $('#start').addEventListener('click', queue);
  // Ranked is always arithmetic, so the problem list locks; unranked can pick any row.
  const showPick = () => {
    const r = ranked();
    $('#rank-card').style.display = r ? '' : 'none';
    $('#games-title').closest('.lt-panel').classList.toggle('locked', r);
    $('#games-sub').textContent = r ? 'ranked is always arithmetic' : 'both players get the same questions';
    $('#pick-name').textContent = r ? 'Arithmetic' : P.NAMES[game()];
    document.querySelector('.d-change').hidden = r;
    $('#queue-text').textContent = r
      ? 'A rated race to 25 with 2:00 on the clock, against the searching player closest to your rating. Wins raise it; losses lower it.'
      : game() === 'any' ? 'A race to 25 against whoever’s searching, on their choice of problems (or arithmetic), with 2:00 on the clock.'
      : 'A race to 25 against whoever else is looking for the same problems (or any), with 2:00 on the clock.';
    try { localStorage.setItem('zm-queue', r ? 'ranked' : 'unranked'); } catch {}
  };
  try { if (localStorage.getItem('zm-queue') === 'unranked') document.querySelector('input[name=queue][value=unranked]').checked = true; } catch {}
  document.querySelectorAll('input[name=game], input[name=queue]').forEach(r => r.addEventListener('change', showPick));
  showPick();
  // A private match needs a set of problems: "any" means arithmetic.
  $('#create').addEventListener('click', async () => {
    try { enter(await call('mm_create', { p_game: game() === 'any' ? 'standard' : game(), p_rule: rule() })); } catch (err) { fail(err); }
  });
  $('#join-form').addEventListener('submit', async e => {
    e.preventDefault();
    const code = $('#code').value.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) { $('#msg').className = 'd-msg err'; $('#msg').textContent = 'Codes are six letters and digits.'; return $('#code').focus(); }
    try { enter(await call('mm_join', { p_code: code })); } catch (err) { fail(err); $('#code').focus(); }
  });
  // Enter in the code box joins; it doesn't start a public search.
  $('#code').addEventListener('keydown', e => { if (e.key === 'Enter') e.stopPropagation(); });
  $('#code').addEventListener('input', () => { $('#code').value = $('#code').value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
  document.querySelectorAll('[data-cancel]').forEach(b => b.addEventListener('click', cancel));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && match?.status === 'waiting') cancel(); });
  async function cancel() {
    const m = match;
    lobby();
    if (m) { try { await rpc('mm_cancel', { p_id: m.id }); } catch {} }
  }
  $('#copy').addEventListener('click', async () => {
    const url = new URL(`duel.html#join=${match.code}`, location.href).href;
    try { await navigator.clipboard.writeText(url); $('#copy').textContent = 'Copied'; }
    catch { $('#copy').textContent = 'Copy failed'; }
    setTimeout(() => { $('#copy').textContent = 'Copy link'; }, 1600);
  });

  // ---- challenges by name ----
  // Sent: a private match for that player, waiting like a code match. Received: listed at the top
  // of the lobby (checked every few seconds while it shows), to accept or decline.
  $('#challenge-form').addEventListener('submit', async e => {
    e.preventDefault();
    const name = $('#rival').value.trim();
    if (!cloud.nameOk(name)) { $('#msg').className = 'd-msg err'; $('#msg').textContent = 'Names are 3 to 20 letters, digits or underscores.'; return $('#rival').focus(); }
    try { enter(await call('mm_challenge', { p_name: name, p_game: game() === 'any' ? 'standard' : game(), p_rule: rule() })); } catch (err) { fail(err); $('#rival').focus(); }
  });
  $('#rival').addEventListener('keydown', e => { if (e.key === 'Enter') e.stopPropagation(); });
  async function loadInvites() {
    const box = $('#invites');
    if ($('#st-lobby').hidden || $('#lobby-view').hidden) return;
    let list = [];
    try { list = await rpc('mm_invites', {}); } catch { return; }
    if ($('#st-lobby').hidden) return;
    box.replaceChildren(...(Array.isArray(list) ? list : []).map(inv => {
      const li = document.createElement('li'), body = document.createElement('span'), who = document.createElement('b'), what = document.createElement('small');
      who.textContent = `${inv.from} challenged you`;
      what.textContent = `${P.NAMES[inv.game] || 'Duel'} · ${inv.rule === 'race' ? `race to ${inv.goal}` : `most in ${clock(inv.seconds)}`}`;
      body.append(who, what);
      const acts = document.createElement('span'), yes = document.createElement('button'), no = document.createElement('button');
      acts.className = 'acts';
      yes.className = 'd-btn'; yes.type = 'button'; yes.textContent = 'Accept';
      no.className = 'd-btn quiet'; no.type = 'button'; no.textContent = 'Decline';
      yes.addEventListener('click', async () => { try { enter(await call('mm_join', { p_code: inv.code })); } catch (err) { fail(err); } });
      no.addEventListener('click', async () => { li.remove(); box.hidden = !box.children.length; try { await rpc('mm_decline', { p_id: inv.id }); } catch {} });
      acts.append(yes, no);
      const stripe = document.createElement('span');
      stripe.className = 'lt-stripe';
      li.append(stripe, body, acts);
      return li;
    }));
    box.hidden = !box.children.length;
  }
  setInterval(loadInvites, 3000);

  // ---- ghosts: a saved game to race while nobody's searching ----
  // After 20 seconds in the queue, a ghost race is offered: your own best 2-minute game, or one by
  // the player nearest your rating, replayed answer by answer on its own questions. Nothing is
  // saved and the database plays no part once the game is fetched.
  const GHOST_AFTER = 20000;
  let ghostLog = null, ghostTimes = [];
  document.querySelectorAll('[data-ghost]').forEach(b => b.addEventListener('click', async () => {
    const msg = $('#ghost-msg');
    msg.textContent = '';
    let g;
    try { g = await rpc('mm_ghost', { p_mine: b.dataset.ghost === 'mine' }); } catch (err) { msg.textContent = err.message; return; }
    // The log is checked before use: 25 questions, each with text, a numeric answer and a time.
    const log = Array.isArray(g?.log) ? g.log.filter(q => typeof q?.q === 'string' && q.q.length <= 40 && Number.isFinite(Number(q.a)) && Number.isFinite(Number(q.t)) && q.t >= 0) : [];
    if (log.length < 25) {
      msg.textContent = b.dataset.ghost === 'mine' ? 'You need a 2-minute arithmetic game of 25 or more, played on the site, to race your best.' : 'No other player’s game to race yet.';
      return;
    }
    const waiting = match;
    if (waiting) { stopPolling(); rpc('mm_cancel', { p_id: waiting.id }).catch(() => {}); }
    raceGhost({ name: g.mine ? 'Your best' : String(g.name || 'Ghost'), score: g.score, rating: g.rating, log: log.slice(0, 25).map(q => ({ q: q.q, a: Number(q.a), t: Number(q.t) })) });
  }));
  function raceGhost(g) {
    ghostLog = g;
    let sum = 0;
    ghostTimes = g.log.map(q => (sum += q.t));
    const startsAt = new Date(Date.now() + offset + 5000).toISOString();
    enter({ id: `ghost-${Date.now()}`, ghost: true, status: 'live', is_public: false, ranked: false, rule: 'race', game: 'standard', goal: 25, seconds: 120,
            p1: cloud.user().id, p2: null, p1_name: cloud.user().name, p2_name: g.name, starts_at: startsAt,
            p1_score: 0, p2_score: 0, p1_ms: 0, p2_ms: 0, p1_done: false, p2_done: false, winner: null });
  }
  // The ghost's progress at this moment, and the result once either side has finished (or time's up).
  function ghostTick() {
    if (!match?.ghost || !playing && !finished) return;
    const t = elapsed(), n = ghostTimes.filter(x => x <= t).length;
    if (n !== match.p2_score) {
      match.p2_score = n; match.p2_ms = ghostTimes[n - 1] || 0;
      if (n >= match.goal) match.p2_done = true;
      showOpponent(match);
    }
    if (match.status !== 'live') return;
    const meDone = match.p1_done, timeUp = t > match.seconds * 1000;
    if (match.p2_done || meDone || timeUp) {
      const w = match.p1_score > match.p2_score ? 1 : match.p2_score > match.p1_score ? 2
        : match.p1_score === 0 ? 0 : match.p1_ms < match.p2_ms ? 1 : match.p2_ms < match.p1_ms ? 2 : 0;
      update({ ...match, status: 'done', winner: w });
    }
  }

  // ---- following a match ----
  function stopPolling() { clearInterval(poller); poller = 0; }
  function enter(m) {
    match = m;
    me = m.p1 === cloud.user().id ? 1 : 2;
    stopPolling();
    poller = m.ghost ? setInterval(ghostTick, 50) : setInterval(poll, 1000);
    update(m);
  }
  async function poll() {
    if (!match || sending) return;
    try { update(await call('mm_poll', { p_id: match.id })); } catch (err) { if (!playing) fail(err); }
  }
  function update(m) {
    if (!m || m.id !== match?.id) return;
    match = m;
    if (m.status === 'cancelled') return lobby(m.invitee && me === 1 ? `${m.p2_name} declined the challenge.` : 'That match was closed.');
    if (m.status === 'waiting') return showWaiting(m);
    if (m.status === 'live' && !playing && !finished) return countdown(m);
    if (playing || finished) showOpponent(m);
    if (m.status === 'done') {
      if (!playing && !finished) return lobby('That match is already over.');
      result(m);
    }
  }

  function showWaiting(m) {
    if (!waitStart) waitStart = Date.now();
    if (m.is_public) {
      show('st-queue');
      $('#q-clock').textContent = clock(Math.floor((Date.now() - waitStart) / 1000));
      $('#q-sub').textContent = `${m.ranked ? 'Ranked · ' : ''}${P.NAMES[m.game]}. The match starts as soon as someone else looks for the same problems.`;
      $('#ghost-offer').hidden = Date.now() - waitStart < GHOST_AFTER;
    } else {
      show('st-code');
      $('#my-code').textContent = m.code;
      $('#code-sub').textContent = m.invitee
        ? `${ruleText(m)}. ${m.p2_name} sees your challenge on their Duel page; the match starts when they accept.`
        : `${ruleText(m)}. Send the code or the link to your opponent; the match starts when they join.`;
    }
  }

  // Both players are in: five lights, one a second, then lights out and the first question.
  let counting = false;
  function countdown(m) {
    waitStart = 0;
    if (counting) return;
    counting = true;
    show('st-found');
    $('#f-me').textContent = cloud.user().name;
    $('#f-them').textContent = them(m);
    // Ranked: each player's rank from their rating when the match started.
    for (const [el, elo] of [[$('#f-me-rank'), mine(m, 'elo')], [$('#f-them-rank'), theirs(m, 'elo')]]) {
      const k = m.ranked && Number.isInteger(elo) ? M.rank(elo) : null;
      el.textContent = k ? `${k.name} · ${elo}` : '';
      el.className = `f-rank${k ? ` rk-${k.tier}` : ''}`;
    }
    $('#f-sub').textContent = ruleText(m) + (m.ghost && Number.isInteger(ghostLog?.score) ? `. Their game scored ${ghostLog.score} in 2:00.` : '.');
    qs = m.ghost ? ghostLog.log.map(q => ({ q: q.q, a: q.a })) : P.list(m.game, m.seed, m.rule === 'race' ? m.goal : 600);
    const startsAt = Date.parse(m.starts_at) - offset;  // this browser's clock
    startPerf = performance.now() + (startsAt - Date.now());
    const lights = [...document.querySelectorAll('.d-found .lt-lights i')];
    const step = () => {
      const left = (startPerf - performance.now()) / 1000;
      if (left <= 0) { counting = false; return begin(); }
      lights.forEach((l, i) => l.classList.toggle('on', left <= 5 - i));
      $('#f-count').textContent = `Starts in ${Math.ceil(left)}`;
      setTimeout(step, 50);
    };
    step();
  }

  // ---- playing ----
  const input = $('#answer');
  function begin() {
    playing = true; finished = false; idx = 0; score = 0; lastMs = 0;
    $('#settings').style.display = 'none';
    $('#game').style.display = 'block';
    $('#end').style.display = 'none';
    $('#held').style.display = 'none';
    $('#play').style.display = 'contents';
    $('#clock-label').textContent = 'Seconds left:';
    $('#vs-me').textContent = cloud.user().name;
    $('#vs-them').textContent = them(match);
    $('#again').textContent = match.ghost ? 'Find a player' : match.is_public ? 'Find another' : 'New code';
    showOpponent(match);
    drawMine();
    input.disabled = false;
    input.value = '';
    ask();
    input.focus();
    timer = setInterval(tick, 50);
    tick();
  }
  function ask() {
    $('#question').textContent = qs[idx].q;
    input.value = '';
  }
  const elapsed = () => Math.max(0, Math.round(performance.now() - startPerf));
  function tick() {
    const left = Math.max(0, Math.ceil((match.seconds * 1000 - elapsed()) / 1000));
    $('#secs').textContent = left;
    if (left === 0 && playing) stop(true);
  }
  function drawMine() {
    const goal = match.rule === 'race' ? match.goal : null;
    $('#progress').textContent = goal ? `Question ${Math.min(score + 1, goal)} of ${goal}` : `Score: ${score}`;
    $('#n-me').textContent = goal ? `${score}/${goal}` : score;
    $('#bar-me').style.transform = `scaleX(${bar(score) / 100})`;
    showLead();
  }
  // Race bars fill toward the goal; clock bars are scaled to whoever's ahead.
  function bar(n) {
    if (match.rule === 'race') return Math.min(100, (n / match.goal) * 100);
    const top = Math.max(score, theirs(match, 'score') || 0, 1);
    return (n / top) * 100;
  }
  function showOpponent(m) {
    const n = theirs(m, 'score') || 0, done = theirs(m, 'done');
    $('#n-them').textContent = m.rule === 'race' ? `${n}/${m.goal}` : n;
    $('#n-them').classList.toggle('done', !!done && m.rule === 'race' && n >= m.goal);
    $('#bar-them').style.transform = `scaleX(${bar(n) / 100})`;
    if (m.rule === 'clock') $('#bar-me').style.transform = `scaleX(${bar(score) / 100})`;
    showLead();
  }
  // "+3" beside whoever's ahead.
  function showLead() {
    const d = score - (theirs(match, 'score') || 0);
    $('#lead-me').textContent = d > 0 ? `+${d}` : '';
    $('#lead-them').textContent = d < 0 ? `+${-d}` : '';
  }

  input.addEventListener('input', () => {
    if (!playing) return;
    if (input.value.trim() !== String(qs[idx].a)) return;
    score++; idx++; lastMs = elapsed();
    drawMine();
    if (match.rule === 'race' && score >= match.goal) return stop(false);
    if (idx >= qs.length) qs.push(...P.list(match.game, match.seed + qs.length, 200));
    ask();
    send(false);
  });

  // Reports the latest score; one request at a time, and the newest score goes next.
  // A failed final report is retried until the match is decided.
  async function send(done) {
    if (match?.ghost) {  // a ghost race keeps its own score
      Object.assign(match, { p1_score: score, p1_ms: lastMs, p1_done: done && score >= match.goal });
      return;
    }
    if (sending) { queued = true; return; }
    sending = true;
    const id = match.id;
    try {
      const m = await call('mm_score', { p_id: id, p_score: score, p_ms: lastMs, p_done: done });
      sending = false;
      update(m);
    } catch {
      sending = false;
      if (done && match?.id === id && match.status !== 'done') { setTimeout(() => send(true), 1000); return; }
    }
    if (queued && match?.id === id) { queued = false; send(finished); }
  }

  function stop(timeUp) {
    playing = false; finished = true;
    clearInterval(timer);
    input.disabled = true;
    $('#play').style.display = 'none';
    $('#held').style.display = 'block';
    $('#held').textContent = timeUp ? `Time. Waiting for the result…` : `Done in ${secs(lastMs)} s. Waiting for ${them(match)}…`;
    if (sending) queued = true; else send(true);
  }

  function result(m) {
    if (playing) {  // the match was decided while this player was still going (their opponent finished the race)
      playing = false; finished = true;
      clearInterval(timer);
      input.disabled = true;
    }
    stopPolling();
    clearInterval(timer);
    $('#clock-label').textContent = 'Match over';
    $('#secs').textContent = '';
    $('#progress').textContent = '';
    $('#play').style.display = 'none';
    $('#held').style.display = 'none';
    $('#end').style.display = 'block';
    const won = m.winner === me, draw = m.winner === 0;
    const r = $('#result');
    r.className = `result ${draw ? '' : won ? 'win' : 'lose'}`;
    r.textContent = draw ? 'Draw' : won ? 'You win' : `${them(m)} wins`;
    $('#res-sub').textContent = ruleText(m);
    showElo(m);
    standings(m);
    rematchOffer = null;
    showRematch(m);
    if (!m.ghost) openChat(m);
    setTimeout(() => $('#again').focus(), 700);
  }

  // Both players side by side. A race also shows the finish time and the pace each player was on,
  // projected to a 2-minute game (25 in 40 s is a pace of 75).
  function standings(m) {
    const race = m.rule === 'race';
    const pace = (n, ms) => (n > 0 && ms > 0 ? Math.round(n / ms * 120000) : null);
    const cell = (text, cls = '') => { const td = document.createElement('td'); td.textContent = text; if (cls) td.className = cls; return td; };
    const table = $('#standings');
    table.replaceChildren();
    const head = document.createElement('tr');
    for (const h of ['', race ? 'Answered' : 'Score', ...(race ? ['Time', '2:00 pace'] : [])]) { const th = document.createElement('th'); th.textContent = h; head.append(th); }
    table.append(head);
    for (const seat of [me, 3 - me]) {
      const n = m[`p${seat}_score`], ms = m[`p${seat}_ms`], finishedRace = race && n >= m.goal && m[`p${seat}_done`];
      const tr = document.createElement('tr');
      if (seat === me) tr.className = 'me';
      tr.append(cell(seat === me ? cloud.user().name : them(m), m.winner === seat ? 'win' : ''));
      tr.append(cell(race ? `${n}/${m.goal}` : String(n)));
      if (race) {
        tr.append(cell(finishedRace ? `${secs(ms)} s` : '—', finishedRace ? '' : 'dim'));
        const p = pace(n, ms);
        tr.append(cell(p == null ? '—' : String(p), p == null ? 'dim' : ''));
      }
      table.append(tr);
    }
  }

  // Ranked: your rating before and after, and a line when it crosses into a new rank.
  function showElo(m) {
    const line = $('#elo-line');
    line.replaceChildren();
    const d = mine(m, 'delta'), before = mine(m, 'elo');
    if (!m.ranked || !Number.isInteger(d) || !Number.isInteger(before)) return;
    const after = before + d, change = document.createElement('span');
    change.className = d > 0 ? 'up' : d < 0 ? 'down' : '';
    change.textContent = d ? `${d > 0 ? '+' : '−'}${Math.abs(d)}` : '±0';
    line.append(`Rating ${before} → ${after} (`, change, ')');
    if (!d && m.winner !== 0) line.append(' · you’ve played each other 3 times in ranked today, so this one didn’t count');
    // During placements the rank isn't shown yet, so say how far along they are; after that, a
    // line when the rating crosses into a new rank (the fifth placement match reveals it).
    const id = m.id;
    M.mine().then(r => {
      if (match?.id !== id) return;
      const k0 = M.rank(before), k1 = M.rank(after), note = document.createElement('span');
      note.className = 'rankup';
      if (r.games < M.PLACEMENT) note.textContent = `Placement: ${r.games} of ${M.PLACEMENT}`;
      else if (r.games === M.PLACEMENT) note.textContent = `Placed: ${k1.name}!`;
      else if (k0.name !== k1.name) note.textContent = after > before ? `Up to ${k1.name}!` : `Down to ${k1.name}`;
      else return;
      if (after < before || r.games < M.PLACEMENT) note.style.color = 'inherit';
      line.append(note);
    }).catch(() => {});
  }

  // ---- rematch ----
  // Either player can offer one; it's a private match with the same problems and rule, and the
  // other player's Rematch accepts it. Both screens poll the finished match to see offers.
  let rematchOffer = null;  // your own open offer (a waiting match)
  function showRematch(old) {
    const note = $('#rematch-note'), link = $('#rematch');
    note.replaceChildren();
    const theirs = old.rematch_code && old.rematch_by && old.rematch_by !== me && !rematchOffer;
    if (old.ghost) {
      link.textContent = 'Race again';
      link.hidden = false;
      return;
    }
    if (rematchOffer) {
      link.textContent = 'Cancel rematch';
      note.append(`Rematch offered. Waiting for ${them(old)}…`);
    } else if (theirs) {
      link.textContent = 'Accept rematch';
      const b = document.createElement('b');
      b.textContent = `${them(old)} wants a rematch`;
      note.append(b);
    } else {
      link.textContent = 'Rematch';
    }
    link.hidden = !old.p1 || !old.p2;
  }
  function startRematch(r) {
    rematchOffer = null;
    closeChat();
    finished = false; playing = false;
    $('#game').style.display = 'none';
    $('#settings').style.display = 'block';
    $('#history-view').hidden = true; $('#lobby-view').hidden = false;
    enter(r);
  }
  $('#rematch').addEventListener('click', async e => {
    e.preventDefault();
    const old = match;
    if (!old) return;
    if (old.ghost) { finished = false; playing = false; $('#game').style.display = 'none'; $('#settings').style.display = 'block'; return raceGhost(ghostLog); }
    const note = $('#rematch-note');
    try {
      if (rematchOffer) {
        const r = rematchOffer;
        rematchOffer = null;
        showRematch(old);
        await rpc('mm_cancel', { p_id: r.id });
        return;
      }
      const r = await call('mm_rematch', { p_id: old.id });
      if (r.status === 'live') return startRematch(r);
      rematchOffer = r;
      showRematch(old);
    } catch (err) { note.textContent = err.message || 'Couldn’t start a rematch.'; }
  });

  // ---- chat after the match ----
  let chatTimer = 0, chatId = null, seen = 0;
  function openChat(m) {
    if (chatId === m.id) return;
    closeChat();
    chatId = m.id; seen = 0;
    $('#msgs').replaceChildren();
    $('#chat-msg').textContent = '';
    $('#say').placeholder = `Say something to ${them(m)}`;
    $('#chat').hidden = false;
    loadChat();
    chatTimer = setInterval(loadChat, 2000);
  }
  function closeChat() { clearInterval(chatTimer); chatTimer = 0; chatId = null; $('#chat').hidden = true; }
  async function loadChat() {
    if (!chatId) return;
    const id = chatId;
    try {
      const rows = await cloud.rest(`match_messages?select=id,seat,body&match_id=eq.${encodeURIComponent(id)}&order=id.asc`);
      if (id !== chatId) return;
      for (const r of rows) if (r.id > seen) { addLine(r); seen = r.id; }
      // Rematch offers: the finished match shows the other player's; your own offer is watched
      // (which also keeps it open) until it starts or is closed.
      const old = await call('mm_poll', { p_id: id });
      if (id !== chatId) return;
      match = old;
      if (rematchOffer) {
        const r = await call('mm_poll', { p_id: rematchOffer.id });
        if (r.status === 'live') return startRematch(r);
        if (r.status !== 'waiting') rematchOffer = null;
      }
      showRematch(old);
    } catch {}
  }
  function addLine(r) {
    const list = $('#msgs'), li = document.createElement('li'), who = document.createElement('span');
    const mineMsg = r.seat === me;
    li.className = mineMsg ? 'mine' : '';
    who.className = 'from';
    who.textContent = mineMsg ? 'You' : them(match);
    // <bdi> keeps a message's own text direction to itself (it can't flip the name beside it).
    const body = document.createElement('bdi');
    body.textContent = r.body;
    li.append(who, ' ', body);
    list.append(li);
    list.scrollTop = list.scrollHeight;
  }
  async function say(text) {
    const body = text.trim();
    if (!body || !chatId) return;
    const note = $('#chat-msg');
    note.textContent = '';
    try {
      await cloud.rest('rpc/mm_say', { method: 'POST', body: { p_id: chatId, p_text: body } });
      await loadChat();
      return true;
    } catch (err) { note.textContent = err.message || 'Couldn’t send that.'; return false; }
  }
  $('#quick').addEventListener('click', e => { const b = e.target.closest('button'); if (b) say(b.textContent); });
  $('#say-form').addEventListener('submit', async e => {
    e.preventDefault();
    if (await say($('#say').value)) $('#say').value = '';
  });

  function backToLobby() {
    finished = false; playing = false;
    closeChat();
    if (rematchOffer) { rpc('mm_cancel', { p_id: rematchOffer.id }).catch(() => {}); rematchOffer = null; }
    $('#game').style.display = 'none';
    $('#settings').style.display = 'block';
    lobby();
    $('#start').focus();
  }
  $('#lobby').addEventListener('click', e => { e.preventDefault(); backToLobby(); });
  $('#again').addEventListener('click', async e => {
    e.preventDefault();
    const m = match;
    backToLobby();
    if (m?.ghost) queue();
    else if (m?.is_public) {  // the same kind of search again
      document.querySelector(`input[name=queue][value="${m.ranked ? 'ranked' : 'unranked'}"]`)?.click();
      if (!m.ranked) document.querySelector(`input[name=game][value="${m.game}"]`)?.click();
      queue();
    }
    else if (m) {
      document.querySelector(`input[name=game][value="${m.game}"]`)?.click();
      document.querySelector(`input[name=rule][value="${m.rule}"]`)?.click();
      $('#create').click();
    }
  });

  // A shared link (duel.html#join=CODE) fills in the code and joins, also when it's opened in a
  // tab that already shows this page (only the #part changes, so the page doesn't reload).
  function joinFromLink() {
    const shared = /^#join=([A-Za-z0-9]{6})$/.exec(location.hash);
    if (!shared) return;
    history.replaceState(null, '', location.pathname);
    if (playing || counting) return;  // mid-match: the link waits
    if ($('#settings').style.display === 'none') backToLobby(); else lobby();
    $('#code').value = shared[1].toUpperCase();
    $('#join-form').requestSubmit();
  }
  addEventListener('hashchange', joinFromLink);
  lobby();
  $('#start').focus();
  joinFromLink();
})();
