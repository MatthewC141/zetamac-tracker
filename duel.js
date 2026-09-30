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
  const ruleText = m => `${P.NAMES[m.game]} · ${m.rule === 'race' ? `race to ${m.goal}, 2:00 limit` : `most answered in ${clock(m.seconds)}`}`;

  function lobby(message = '', isError = false) {
    stopPolling();
    match = null; waitStart = 0;
    show('st-lobby');
    $('#msg').textContent = message;
    $('#msg').className = `d-msg${isError ? ' err' : ''}`;
    loadRecord();
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
  async function loadRecord() {
    try {
      const rows = await cloud.rest('matches?select=p1,p2,winner&status=eq.done&order=created_at.desc&limit=1000');
      const id = cloud.user()?.id;
      let w = 0, l = 0, d = 0;
      for (const r of rows) {
        const seat = r.p1 === id ? 1 : r.p2 === id ? 2 : 0;
        if (!seat) continue;
        if (r.winner === 0) d++; else if (r.winner === seat) w++; else l++;
      }
      $('#record').innerHTML = w + l + d ? `Record <b>${w}</b> W · <b>${l}</b> L${d ? ` · <b>${d}</b> D` : ''}` : '';
    } catch { $('#record').textContent = ''; }
  }

  async function queue() {
    if ($('#st-lobby').hidden) return;
    try { enter(await call('mm_queue', { p_game: game() })); } catch (err) { fail(err); }
  }
  $('#start').addEventListener('click', queue);
  const showPick = () => { $('#pick-name').textContent = P.NAMES[game()]; };
  document.querySelectorAll('input[name=game]').forEach(r => r.addEventListener('change', showPick));
  showPick();
  $('#create').addEventListener('click', async () => {
    try { enter(await call('mm_create', { p_game: game(), p_rule: rule() })); } catch (err) { fail(err); }
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

  // ---- following a match ----
  function stopPolling() { clearInterval(poller); poller = 0; }
  function enter(m) {
    match = m;
    me = m.p1 === cloud.user().id ? 1 : 2;
    stopPolling();
    poller = setInterval(poll, 1000);
    update(m);
  }
  async function poll() {
    if (!match || sending) return;
    try { update(await call('mm_poll', { p_id: match.id })); } catch (err) { if (!playing) fail(err); }
  }
  function update(m) {
    if (!m || m.id !== match?.id) return;
    match = m;
    if (m.status === 'cancelled') return lobby('That match was closed.');
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
      $('#q-sub').textContent = `${P.NAMES[m.game]}. The match starts as soon as someone else looks for the same problems.`;
    } else {
      show('st-code');
      $('#my-code').textContent = m.code;
      $('#code-sub').textContent = `${ruleText(m)}. Send the code or the link to your opponent; the match starts when they join.`;
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
    $('#f-sub').textContent = ruleText(m) + '.';
    qs = P.list(m.game, m.seed, m.rule === 'race' ? m.goal : 600);
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
    $('#again').textContent = match.is_public ? 'Find another' : 'New code';
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
    const line = (name, s, ms, done) => m.rule === 'race' && s >= m.goal && done ? `${name} ${s} in ${secs(ms)} s` : `${name} ${s}`;
    $('#detail').textContent = `${line('You', mine(m, 'score'), mine(m, 'ms'), mine(m, 'done'))} · ${line(them(m), theirs(m, 'score'), theirs(m, 'ms'), theirs(m, 'done'))}`;
    setTimeout(() => $('#again').focus(), 700);
  }

  function backToLobby() {
    finished = false; playing = false;
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
    if (m?.is_public) { document.querySelector(`input[name=game][value="${m.game}"]`)?.click(); queue(); }
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
