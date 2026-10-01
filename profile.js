// A player's public profile (profile.html#name): their best game on each leaderboard board, their
// duel rank and past seasons, and how many games they played each day of the last 13 weeks.
// Private accounts have no profile. Reads the public profile function through cloud.js.
(() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cloud = window.ZM_CLOUD, M = window.ZM_MATCHES;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const clock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const pad = n => String(n).padStart(2, '0');
  const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseDate = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const dateText = s => { const d = parseDate(s); return `${MONTHS[d.getMonth()]} ${d.getDate()}${d.getFullYear() === new Date().getFullYear() ? '' : `, ${d.getFullYear()}`}`; };
  // The same boards as the leaderboard, in its order.
  const BOARDS = [
    ['standard|120', 'Arithmetic', '2:00', 't-arith'], ['standard|30', 'Arithmetic', '0:30', 't-arith'],
    ['mixed|120', 'Combined operations', '2:00', 't-mix'], ['o80|480', '80 in 8', '8:00', 't-o80'],
    ['seq|240', 'Sequences', '4:00', 't-seq'], ['frac|240', 'Fractions', '4:00', 't-frac'], ['est|240', 'Estimation', '4:00', 't-est'],
    ['sq99h|120', 'Two-digit squares', '2:00', 't-sq'], ['sq999h|120', 'Three-digit squares', '2:00', 't-sq'],
    ['standard|0', 'Arithmetic', 'Endless', 't-end'],
  ];
  const state = (text, html = false) => { $('#pf').hidden = true; $('#state').hidden = false; $('#state')[html ? 'innerHTML' : 'textContent'] = text; };

  $('#find').addEventListener('submit', e => {
    e.preventDefault();
    const n = $('#find-name').value.trim();
    if (n) location.hash = encodeURIComponent(n);
  });

  async function load() {
    let name = '';
    try { name = decodeURIComponent(location.hash.slice(1)); } catch {}
    if (!name) {
      const me = cloud?.user()?.name;
      if (me) { location.replace(`#${encodeURIComponent(me)}`); return; }
      document.title = 'Player';
      return state('Type a player’s name above, or open one from the <a href="leaderboard.html">leaderboard</a>.', true);
    }
    if (!window.ZM_WEB || !cloud?.ready) return state('Profiles live on the website version of the tracker.');
    if (!cloud.nameOk(name)) return state('Names are 3 to 20 letters, digits or underscores.');
    state('Loading…');
    let p;
    try { p = await cloud.profile(name); } catch (err) { return state(`Couldn’t load this profile: ${err.message}`); }
    if (!p) return state(`No player called ${name}, or their account is private.`);
    render(p);
  }

  function render(p) {
    document.title = `${p.username} · Zetamac`;
    $('#state').hidden = true;
    $('#pf').hidden = false;
    $('#p-name').textContent = p.username;
    const joined = parseDate(p.joined);
    const mine = cloud.user()?.name?.toLowerCase() === p.username.toLowerCase();
    $('#p-meta').textContent = `Playing since ${MONTHS[joined.getMonth()]} ${joined.getFullYear()}${mine ? ' · this is you' : ''}`;

    // Duel rank: shown once placed. Past seasons: the rank each one peaked at.
    const r = p.rating;
    $('#p-rank').hidden = !r;
    if (r) {
      const k = M.rank(r.elo);
      $('#p-rank').className = `rank rk-${k.tier}`;
      $('#p-rank-name').textContent = k.name;
      $('#p-elo').textContent = r.elo;
      $('#p-record').textContent = `· ${r.wins}–${r.losses}${r.draws ? `–${r.draws}` : ''} this season · peak ${r.peak}`;
    }
    $('#p-seasons').innerHTML = (p.seasons || []).map(s => {
      const k = M.rank(s.peak);
      return `<li class="rk-${k.tier}"><span>${esc(s.season.replace('-', ' '))}</span><b>${k.name}</b></li>`;
    }).join('');
    $('#p-seasons').hidden = !(p.seasons || []).length;

    // Bests, in the leaderboard's order.
    const best = new Map((p.bests || []).map(b => [`${b.mode}|${b.seconds}`, b]));
    $('#bests').innerHTML = BOARDS.filter(([k]) => best.has(k)).map(([k, name, len, team]) => {
      const b = best.get(k);
      const small = k === 'standard|0' ? `in ${clock(b.elapsed)}` : Number.isInteger(b.wrongs) ? `${b.wrongs} wrong` : '';
      return `<li class="${team}"><span class="stripe"></span><span class="who">${name}<small>${len}</small></span>` +
        `<span class="figure">${b.score}${small ? `<small>${small}</small>` : ''}</span><span class="date">${dateText(b.date)}</span></li>`;
    }).join('') || '<li style="display:block;border:0"><p class="msg">No leaderboard games yet.</p></li>';

    heat(p.days || {});
  }

  // 13 weeks of squares, one a day, shaded by how many games were played.
  function heat(days) {
    const svg = $('#heat'), weeks = 13, cell = 15, gap = 3, left = 26, top = 16, pitch = cell + gap;
    const end = new Date(); end.setHours(0, 0, 0, 0);
    const start = new Date(end); start.setDate(end.getDate() - (weeks - 1) * 7 - end.getDay());
    const counts = Object.values(days).filter(n => n > 0).sort((a, b) => a - b);
    const cut = p => counts[Math.min(counts.length - 1, Math.floor(p * counts.length))];
    const cuts = counts.length ? [cut(0.25), cut(0.5), cut(0.75)] : [];
    let h = '', total = 0, played = 0, lastMonth = -1;
    [['Mon', 1], ['Wed', 3], ['Fri', 5]].forEach(([l, r]) => { h += `<text x="0" y="${top + r * pitch + cell * 0.8}">${l}</text>`; });
    for (let d = new Date(start), i = 0; d <= end; d.setDate(d.getDate() + 1), i++) {
      const col = Math.floor(i / 7), row = d.getDay(), n = days[dayKey(d)] || 0;
      if (row === 0 && d.getMonth() !== lastMonth && d.getDate() <= 7) {
        lastMonth = d.getMonth();
        if (col < weeks - 1) h += `<text x="${left + col * pitch}" y="10">${MONTHS[lastMonth]}</text>`;
      }
      if (n) { total += n; played++; }
      const level = n ? 1 + cuts.filter(c => n > c).length : 0;
      h += `<rect x="${left + col * pitch}" y="${top + row * pitch}" width="${cell}" height="${cell}" rx="3" fill="var(--heat-${level})"><title>${n ? `${n} game${n === 1 ? '' : 's'}` : 'No games'} · ${MONTHS[d.getMonth()]} ${d.getDate()}</title></rect>`;
    }
    const W = left + weeks * pitch, H = top + 7 * pitch;
    svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('aria-label', `${total} games on ${played} days in the last 13 weeks`);
    svg.innerHTML = h;
    $('#heat-sum').innerHTML = `<b>${total}</b> games on <b>${played}</b> ${played === 1 ? 'day' : 'days'}`;
  }

  addEventListener('hashchange', load);
  load();
})();
