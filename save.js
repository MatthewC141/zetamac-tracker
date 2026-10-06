// Saving a finished game, for every game page (game.js, optiver.js): sends it to the tracker,
// says on the end screen how it went (`line` gets { final, prevBest, same } and returns the words:
// { text | html, pb }), links its question-by-question breakdown, and offers a retry if it couldn't
// save. Resolves to the tracker's scores after the save (the retry's, if one was needed).
window.zmSave = async function save(el, game, history, line) {
  const { mode, seconds, score, elapsed, log } = game;
  const same = history.filter(g => g.seconds === seconds && (g.mode || 'standard') === mode);
  const prevBest = same.reduce((m, g) => Math.max(m, g.score), 0);
  el.className = 'saved';
  el.textContent = 'Saving…';
  try {
    const r = await fetch('api/game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Zetamac': '1' },
      body: new URLSearchParams({ score, elapsed, detail: JSON.stringify(log), seconds, mode }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error);
    const list = Array.isArray(data) ? data : history;
    const mine = list[list.length - 1];  // the tracker appends, so the newest row is this game
    const words = line({ final: score, prevBest, same });
    if (words.pb) el.className = 'saved pb';
    if (words.html) el.innerHTML = words.html; else el.textContent = words.text;
    if (mine?.detail && log.length) el.insertAdjacentHTML('beforeend', ` · <a href="./#game=${encodeURIComponent(mine.ts)}">See breakdown</a>`);
    return list;
  } catch {
    el.innerHTML = (window.ZM_WEB ? 'Couldn’t save in this browser.' : 'Couldn’t save — is <code>./zetamac tracker</code> running?') + ' <a href="#" class="retry">Retry</a>';
    return new Promise(resolve => {
      el.querySelector('.retry').onclick = e => { e.preventDefault(); resolve(save(el, game, history, line)); };
    });
  }
};
