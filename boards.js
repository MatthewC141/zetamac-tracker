// The leaderboard's boards, in order, for every page that lists them (the leaderboard, profiles,
// the account page). `key` is "mode|seconds" for boards of saved games; the daily challenge and
// the duel ladder have boards of their own. `team` is the board's colour (theme.css).
window.ZM_BOARDS = (() => {
  const list = [
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
  for (const b of list) {
    if (b.daily || b.elo) continue;
    const [mode, seconds] = b.key.split('|');
    b.mode = mode; b.seconds = Number(seconds);
  }
  return {
    list,
    saved: list.filter(b => b.mode),  // the boards of saved games (bests, places, percentiles)
    get: key => list.find(b => b.key === key),
    keyOf: (mode, seconds) => `${mode}|${seconds}`,
  };
})();
