// The account page (account.html): sign up or log in with a name and password (no email), then
// move this browser's scores in, log out, or delete the account. Uses cloud.js and store.js.
(() => {
  const $ = s => document.querySelector(s);
  const cloud = window.ZM_CLOUD;
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  let mode = 'up';

  // Accounts need the website version and a configured database.
  if (!window.ZM_WEB || !cloud?.ready) {
    $('#off').hidden = false;
    if (!window.ZM_WEB) {
      $('#off-text').innerHTML = 'The tracker on your computer keeps its scores in <code>scores.csv</code>. To sign up, open the <a href="https://matthewc141.github.io/zetamac-tracker/account.html">website version</a>; you can bring your history with you using Export on your dashboard.';
    } else {
      $('#off-title').textContent = 'Accounts aren’t switched on yet.';
      $('#off-text').textContent = 'This copy of the site isn’t connected to a database. Your scores still save in this browser.';
    }
    return;
  }

  const localCount = () => window.ZM_LOCAL?.count() || 0;

  // Moves this browser's games into the account (duplicates skipped), then clears them here.
  async function moveLocal() {
    const n = localCount();
    if (!n) return 0;
    const r = await fetch('api/import', { method: 'POST', headers: { 'X-Zetamac': '1' }, body: JSON.stringify(window.ZM_LOCAL.exportFile()) });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Couldn’t move your games.');
    window.ZM_LOCAL.clear();
    return data.added;
  }

  // ---- signed out ----
  function setMode(m) {
    mode = m;
    const up = m === 'up';
    $('#t-up').setAttribute('aria-selected', up);
    $('#t-in').setAttribute('aria-selected', !up);
    $('#confirm-field').hidden = !up;
    $('#pass').autocomplete = up ? 'new-password' : 'current-password';
    $('#pass-hint').hidden = !up;
    $('#name-hint').hidden = !up;
    $('#submit-word').textContent = up ? 'Sign up' : 'Log in';
    $('#form-title').textContent = up ? 'Put your name on the board.' : 'Welcome back.';
    $('#form-lede').textContent = up
      ? 'A name and a password, no email. Your scores save to your account, so they’re the same on every device, and your best games go on the leaderboard.'
      : 'Log in with your name and password to get your scores and your places on the leaderboard.';
    $('#msg').textContent = '';
    const n = localCount();
    $('#move-field').hidden = !n;
    $('#move-text').textContent = `Move this browser’s ${plural(n, 'game')} into the account`;
  }
  $('#t-up').addEventListener('click', () => setMode('up'));
  $('#t-in').addEventListener('click', () => setMode('in'));
  $('.mode').addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { setMode(mode === 'up' ? 'in' : 'up'); $(mode === 'up' ? '#t-up' : '#t-in').focus(); }
  });

  // The name writes itself into the preview row.
  $('#name').addEventListener('input', () => {
    const v = $('#name').value.trim();
    document.querySelectorAll('[data-preview]').forEach(el => { el.textContent = v || 'your name'; el.classList.toggle('empty', !v); });
    $('#name').setAttribute('aria-invalid', v && !cloud.nameOk(v) ? 'true' : 'false');
  });

  $('#form').addEventListener('submit', async e => {
    e.preventDefault();
    const msg = $('#msg'), name = $('#name').value.trim(), pass = $('#pass').value;
    msg.className = 'msg err';
    if (!cloud.nameOk(name)) { msg.textContent = mode === 'up' ? 'Names are 3 to 20 letters, digits or underscores.' : 'That name and password don’t match.'; return $('#name').focus(); }
    if (mode === 'up' && pass.length < 8) { msg.textContent = 'Pick a password of 8 characters or more.'; return $('#pass').focus(); }
    if (mode === 'up' && pass !== $('#pass2').value) { msg.textContent = 'The two passwords don’t match.'; return $('#pass2').focus(); }
    $('#submit').disabled = true;
    msg.className = 'msg'; msg.textContent = mode === 'up' ? 'Making your account…' : 'Logging in…';
    try {
      if (mode === 'up') await cloud.signUp(name, pass); else await cloud.logIn(name, pass);
      let moved = 0;
      if (!$('#move-field').hidden && $('#move').checked) moved = await moveLocal();
      const news = `${mode === 'up' ? 'Welcome' : 'Welcome back'}, ${cloud.user().name}. ${moved ? `Moved ${plural(moved, 'game')} from this browser into your account. ` : ''}Your games now save to your account.`;
      try { sessionStorage.setItem('zm-flash', news); } catch {}
      location.href = './';
    } catch (err) {
      msg.className = 'msg err'; msg.textContent = err.message;
    } finally {
      $('#submit').disabled = false;
    }
  });

  // ---- signed in ----
  async function showIn(note = '') {
    $('#out').hidden = true;
    $('#in').hidden = false;
    $('#me-name').textContent = cloud.user().name;
    showPlaces();
    const im = $('#in-msg');
    im.className = note ? 'msg ok' : 'msg'; im.textContent = note;
    const n = localCount();
    $('#move-row').hidden = !n;
    $('#move-count').textContent = `${plural(n, 'game')} saved here before you signed in.`;
    try {
      const r = await fetch('api/scores');
      const rows = await r.json();
      if (!r.ok) throw new Error(rows.error);
      const played = rows.filter(g => g.source === 'game').length;
      $('#me-sub').textContent = `Signed in · ${plural(rows.length, 'game')} in your account${rows.length ? `, ${played} played on the site` : ''}.`;
    } catch (err) {
      $('#me-sub').textContent = err.message || 'Couldn’t load your games.';
    }
  }
  // Where you stand on each board you're on.
  const BOARDS = [
    ['standard|120', 'Arithmetic', '2:00', 't-arith'], ['standard|30', 'Arithmetic', '0:30', 't-arith'],
    ['sq99|120', 'Two-digit squares', '2:00', 't-sq'], ['sq99h|120', 'Two-digit squares, hard', '2:00', 't-sq'],
    ['sq999|120', 'Three-digit squares', '2:00', 't-sq'], ['sq999h|120', 'Three-digit squares, hard', '2:00', 't-sq'],
    ['standard|0', 'Arithmetic', 'Endless', 't-end'],
  ];
  async function showPlaces() {
    const me = cloud.user().name.toLowerCase();
    try {
      const rows = await cloud.leaderboard();
      const mine = BOARDS.map(([key, name, len, team]) => {
        const list = rows.filter(r => `${r.mode}|${r.seconds}` === key).sort((a, b) => b.score - a.score || (key.endsWith('|0') ? a.elapsed - b.elapsed : 0));
        const at = list.findIndex(r => r.username.toLowerCase() === me);
        if (at < 0) return null;
        const place = list.findIndex(r => r.score === list[at].score) + 1;  // ties share a place
        return `<li class="${team}"><span class="pos">P${place}</span><span class="stripe"></span><span class="who board-name">${name}<small>${len}</small></span><span class="figure${place === 1 ? ' p1' : ''}">${list[at].score}<small>of ${list.length}</small></span></li>`;
      }).filter(Boolean);
      $('#places').innerHTML = mine.join('');
      $('#places-note').textContent = mine.length ? 'Your best game on each board. Only games played on the site count.'
        : 'Not on any board yet. Play a game on the site while signed in and your best score posts itself.';
    } catch (err) {
      $('#places-note').textContent = `Couldn’t load the leaderboard: ${err.message}`;
    }
  }

  $('#move-now').addEventListener('click', async () => {
    const im = $('#in-msg');
    im.className = 'msg'; im.textContent = 'Moving…';
    try { const n = await moveLocal(); showIn(`Moved ${plural(n, 'game')} into your account.`); }
    catch (err) { im.className = 'msg err'; im.textContent = err.message; }
  });
  $('#logout').addEventListener('click', async () => {
    await cloud.logOut();
    location.reload();
  });
  $('#delete').addEventListener('click', async () => {
    const name = cloud.user().name;
    const typed = prompt(`This deletes your account, your leaderboard places and every score in it. Type your name (${name}) to confirm.`);
    if (typed === null) return;
    const im = $('#in-msg');
    if (typed.trim().toLowerCase() !== name.toLowerCase()) { im.className = 'msg err'; im.textContent = 'The name didn’t match, so nothing was deleted.'; return; }
    try { await cloud.deleteAccount(); location.reload(); }
    catch (err) { im.className = 'msg err'; im.textContent = err.message; }
  });

  if (cloud.user()) showIn();
  else { $('#out').hidden = false; setMode(new URLSearchParams(location.search).get('mode') === 'login' ? 'in' : 'up'); }
})();
