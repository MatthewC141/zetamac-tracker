// The lines under the score after an Arithmetic game: which operation cost the most time compared
// with your recent games, and which went best. Uses the same per-operation seconds as the progress
// page's weak spots. Before there's enough to compare with, it names the game's slowest question.
window.zmSummary = (() => {
  const NAMES = { add: 'addition', sub: 'subtraction', mul: 'multiplication', div: 'division' };
  const secs = ms => (ms / 1000).toFixed(1);
  // Differences under this many milliseconds a question read as "about the same".
  const NOTICEABLE = 100;

  const byOperation = questions => {
    const m = {};
    for (const { o, t } of questions) {
      if (!NAMES[o] || typeof t !== 'number') continue;
      (m[o] ||= { n: 0, sum: 0 });
      m[o].n++; m[o].sum += t;
    }
    for (const o in m) m[o].avg = m[o].sum / m[o].n;
    return m;
  };

  // `log` is this game's questions; `pastGames` the question logs of recent games, newest first.
  function lines(log, pastGames) {
    if (!log.length) return [];
    const today = byOperation(log), usual = byOperation(pastGames.flat());
    // An operation is compared only with a few answers both today and before.
    const compared = Object.keys(today).filter(o => today[o].n >= 2 && usual[o]?.n >= 5)
      .map(o => ({ o, n: today[o].n, avg: today[o].avg, diff: today[o].avg - usual[o].avg }));
    if (!compared.length) {
      const slowest = log.reduce((a, b) => (b.t > a.t ? b : a));
      return [`Slowest question: ${slowest.q}, ${secs(slowest.t)} s.`];
    }
    const since = pastGames.length === 1 ? 'your last game' : `your last ${pastGames.length} games`;
    const worst = compared.reduce((a, b) => (b.diff > a.diff ? b : a));
    const best = compared.reduce((a, b) => (b.diff < a.diff ? b : a));
    const out = [];
    if (worst.diff >= NOTICEABLE) {
      const lost = Math.round(worst.diff * worst.n / 1000);
      const name = NAMES[worst.o];
      out.push(`${name[0].toUpperCase()}${name.slice(1)} cost you most: ${secs(worst.avg)} s a question, ${secs(worst.diff)} s slower than ${since}${lost >= 1 ? ` (about ${lost} s lost)` : ''}.`);
    } else {
      out.push(`Nothing was slower than ${since}.`);
    }
    if (best !== worst && best.diff <= -NOTICEABLE)
      out.push(`Best today: ${NAMES[best.o]}, ${secs(best.avg)} s a question, ${secs(-best.diff)} s quicker than usual.`);
    return out;
  }

  return { lines };
})();
