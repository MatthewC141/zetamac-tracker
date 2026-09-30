// Your finished duels, for the Duel page's recent matches and its full history view
// (duel.html#history). The database only ever returns the signed-in player's own matches.
window.ZM_MATCHES = (() => {
  const cloud = window.ZM_CLOUD;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const GAMES = { standard: 'Arithmetic', mixed: 'Combined', sq99: 'Two-digit squares', sq99h: 'Two-digit squares', sq999: 'Three-digit squares', sq999h: 'Three-digit squares' };
  const COLS = 'id,created_at,is_public,rule,game,goal,seconds,p1,p2,p1_name,p2_name,winner,p1_score,p2_score,p1_ms,p2_ms,p1_done,p2_done';

  // Every finished match, newest first, from your side: { won, lost, draw, you, them, ... }.
  async function load() {
    const me = cloud.user()?.id, out = [];
    for (let from = 0; ; from += 1000) {
      const rows = await cloud.rest(`matches?select=${COLS}&status=eq.done&order=created_at.desc&offset=${from}&limit=1000`);
      for (const m of rows) {
        const seat = m.p1 === me ? 1 : m.p2 === me ? 2 : 0;
        if (!seat) continue;
        const o = 3 - seat;
        out.push({
          id: m.id, at: new Date(m.created_at), game: m.game, rule: m.rule, goal: m.goal, isPublic: m.is_public,
          them: m[`p${o}_name`] || 'Deleted player',
          result: m.winner === 0 ? 'draw' : m.winner === seat ? 'won' : 'lost',
          you: m[`p${seat}_score`], theirs: m[`p${o}_score`],
          ms: m.rule === 'race' && m[`p${seat}_done`] && m[`p${seat}_score`] >= m.goal ? m[`p${seat}_ms`] : null,
        });
      }
      if (rows.length < 1000) return out;
    }
  }

  const record = list => ({
    won: list.filter(m => m.result === 'won').length,
    lost: list.filter(m => m.result === 'lost').length,
    draw: list.filter(m => m.result === 'draw').length,
  });

  const when = d => {
    const now = new Date(), same = d.toDateString() === now.toDateString();
    const time = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
    return same ? `Today ${time}` : `${MONTHS[d.getMonth()]} ${d.getDate()}${d.getFullYear() === now.getFullYear() ? '' : `, ${d.getFullYear()}`}`;
  };
  const ruleText = m => (m.rule === 'race' ? `race to ${m.goal}` : '2:00');
  const LETTER = { won: 'W', lost: 'L', draw: 'D' }, WORD = { won: 'Won', lost: 'Lost', draw: 'Draw' };

  // One row: result, opponent, what was played, the score (yours first) and when.
  const row = m => `<li class="mh-row mh-${m.result}">` +
    `<span class="mh-res" title="${WORD[m.result]}"><b>${LETTER[m.result]}</b></span><span class="lt-stripe"></span>` +
    `<span class="mh-body"><span class="mh-them">vs ${esc(m.them)}</span><span class="mh-what">${esc(GAMES[m.game] || 'Duel')} · ${ruleText(m)}${m.isPublic ? '' : ' · private'}</span></span>` +
    `<span class="mh-score"><b>${m.you}–${m.theirs}</b>${m.ms != null ? `<small>in ${(m.ms / 1000).toFixed(2)} s</small>` : ''}</span>` +
    `<span class="mh-when">${when(m.at)}</span></li>`;

  return { load, record, row, GAMES };
})();
