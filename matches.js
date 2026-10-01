// Your finished duels, for the Duel page's recent matches and its full history view
// (duel.html#history). The database only ever returns the signed-in player's own matches.
window.ZM_MATCHES = (() => {
  const cloud = window.ZM_CLOUD;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const GAMES = { standard: 'Arithmetic', mixed: 'Combined', sq99: 'Two-digit squares', sq99h: 'Two-digit squares', sq999: 'Three-digit squares', sq999h: 'Three-digit squares' };
  const COLS = 'id,created_at,is_public,ranked,rule,game,goal,seconds,p1,p2,p1_name,p2_name,winner,p1_score,p2_score,p1_ms,p2_ms,p1_done,p2_done,p1_elo,p2_elo,p1_delta,p2_delta';

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
          ranked: !!m.ranked, delta: Number.isInteger(m[`p${seat}_delta`]) ? m[`p${seat}_delta`] : null,
          elo: Number.isInteger(m[`p${seat}_elo`]) ? m[`p${seat}_elo`] : null,  // ranked: your rating going in
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
    `<span class="mh-body"><span class="mh-them">vs ${esc(m.them)}</span><span class="mh-what">${m.ranked ? `<b class="mh-ranked">Ranked${m.delta != null ? ` ${m.delta >= 0 ? '+' : '−'}${Math.abs(m.delta)}` : ''}</b> · ` : ''}${esc(GAMES[m.game] || 'Duel')} · ${ruleText(m)}${m.isPublic ? '' : ' · private'}</span></span>` +
    `<span class="mh-score"><b>${m.you}–${m.theirs}</b>${m.ms != null ? `<small>in ${(m.ms / 1000).toFixed(2)} s</small>` : ''}</span>` +
    `<span class="mh-when">${when(m.at)}</span></li>`;

  // Ranked duels: tiers with three divisions each, then Quant at the top. Everyone starts at 1000.
  const RANKS = [
    [1700, 'Quant', 'quant'],
    [1550, 'Diamond I', 'diamond'], [1450, 'Diamond II', 'diamond'], [1350, 'Diamond III', 'diamond'],
    [1300, 'Platinum I', 'platinum'], [1250, 'Platinum II', 'platinum'], [1200, 'Platinum III', 'platinum'],
    [1150, 'Gold I', 'gold'], [1100, 'Gold II', 'gold'], [1050, 'Gold III', 'gold'],
    [1000, 'Silver I', 'silver'], [950, 'Silver II', 'silver'], [900, 'Silver III', 'silver'],
    [850, 'Bronze I', 'bronze'], [800, 'Bronze II', 'bronze'], [-Infinity, 'Bronze III', 'bronze'],
  ];
  const PLACEMENT = 5;  // ranked matches before a rank shows
  // { name, tier, next }: the rank for a rating, and the rating the next rank starts at (null at Quant).
  function rank(elo) {
    const i = RANKS.findIndex(([min]) => elo >= min);
    return { name: RANKS[i][1], tier: RANKS[i][2], next: i > 0 ? RANKS[i - 1][0] : null };
  }
  // Your own rating this season (the database only lets you read your own, and rolls it into a new
  // season first), with your past seasons: { elo, games, wins, …, season, seasons: [{ season, peak }] }.
  // A new player is 1000 with no games.
  async function mine() {
    const r = await cloud.rest('rpc/mm_me', { method: 'POST', body: {} });
    return { elo: 1000, games: 0, wins: 0, losses: 0, draws: 0, peak: 1000, ...(r?.rating || {}), season: r?.season || '', seasons: r?.seasons || [] };
  }
  const seasonName = s => String(s || '').replace('-', ' ');  // "2026-Q4" → "2026 Q4"

  return { load, record, row, GAMES, rank, mine, PLACEMENT, RANKS, seasonName };
})();
