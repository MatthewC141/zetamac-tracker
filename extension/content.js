// Records a game on arithmetic.zetamac.com question by question, the way Zetamach's own game
// does (each question, its answer, kind, corrections and time), and hands it to the service
// worker to save. zetamac's default settings are Zetamach's Arithmetic game, so only those
// settings at 30 seconds or 2 minutes are recorded; anything else says so instead.
//
// Runs from the start of the page so it sees the first question appear. zetamac takes an answer
// the moment it's right and shows the next question, so a question's time runs from the previous
// right answer (or the first question appearing) to its own right answer, as zetamac times it.
(() => {
  const DEFAULTS = { add: true, sub: true, mul: true, div: true, add_left_min: 2, add_left_max: 100, add_right_min: 2, add_right_max: 100,
    mul_left_min: 2, mul_left_max: 12, mul_right_min: 2, mul_right_max: 100 };
  const OPS = { '+': ['add', (x, y) => x + y], '–': ['sub', (x, y) => x - y], '×': ['mul', (x, y) => x * y], '÷': ['div', (x, y) => x / y] };

  // The game's settings, from the page's own init({...}) call: { seconds } when it can be
  // recorded, or { why } when it can't.
  function readSettings() {
    for (const script of document.querySelectorAll('script')) {
      const m = /\binit\((\{[^)]*\})\)/.exec(script.textContent);
      if (!m) continue;
      let o;
      try { o = JSON.parse(m[1]); } catch { break; }
      const seconds = o.duration || 120;  // zetamac's own default
      if (Object.entries(DEFAULTS).some(([k, v]) => o[k] !== v)) return { why: 'only zetamac’s default settings are saved' };
      if (seconds !== 30 && seconds !== 120) return { why: 'only 30- and 120-second games are saved' };
      return { seconds };
    }
    return { why: 'couldn’t read this game’s settings' };
  }

  // "54 – 17" → { q, a, o }, or null for anything that isn't a zetamac question.
  function parseQuestion(text) {
    const m = /^(\d+) ([+–×÷]) (\d+)$/.exec(text.trim());
    if (!m) return null;
    const [o, work] = OPS[m[2]], x = Number(m[1]), y = Number(m[3]);
    return { q: `${x} ${m[2]} ${y}`, a: work(x, y), o };
  }

  const pad = n => String(n).padStart(2, '0');
  const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const stamp = d => `${dateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

  // A small note in the corner of zetamac's page saying what's happening with this game.
  let badge = null;
  function say(text, link) {
    if (!document.body) return;
    if (!badge) {
      badge = document.createElement('div');
      badge.setAttribute('role', 'status');
      badge.style.cssText = 'position:fixed;right:16px;bottom:16px;max-width:340px;padding:8px 12px;font:14px/1.4 -apple-system,system-ui,sans-serif;' +
        'color:#222;background:#fff;border:1px solid #ccc;border-radius:6px;box-shadow:0 1px 4px rgba(0,0,0,.12);z-index:2147483647';
      document.body.append(badge);
    }
    badge.textContent = `Zetamach · ${text}`;
    if (link) {
      const a = document.createElement('a');
      a.href = link.href;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = link.text;
      badge.append(' · ', a);
    }
  }

  // null until the first question appears; then { off } or the game being recorded.
  let game = null;

  function questionShown(text) {
    if (!game) {
      const settings = readSettings();
      game = settings.why ? { off: true } : { seconds: settings.seconds, log: [], current: null, typedLength: 0, nextShownAt: null, over: false };
      say(settings.why ? `not recording: ${settings.why}` : 'recording this game');
    }
    if (game.off || game.over) return;
    const question = parseQuestion(text);
    if (!question) { game.off = true; say('stopped recording: a question it didn’t recognise'); return; }
    game.current = { ...question, c: 0, shownAt: game.nextShownAt ?? performance.now() };
    game.nextShownAt = null;
    game.typedLength = 0;
  }

  // Runs before zetamac's own handler, so it sees the answer before the next question replaces it.
  function typed(event) {
    if (!game?.current || game.off || game.over || !event.target.matches?.('#game .answer')) return;
    const value = event.target.value;
    // A shorter value than last time means the player deleted something: count it as a correction.
    if (value.length < game.typedLength) game.current.c++;
    game.typedLength = value.length;
    if (value.trim() !== String(game.current.a)) return;
    const now = performance.now();
    const { q, a, o, c, shownAt } = game.current;
    game.log.push({ q, a, o, c, t: Math.round(now - shownAt) });
    game.current = null;
    game.nextShownAt = now;
  }

  async function finished() {
    game.over = true;
    if (!game.log.length) { say('nothing to save: no answers'); return; }
    const now = new Date();
    const row = { ts: stamp(now), date: dateKey(now), score: game.log.length, seconds: game.seconds, detail: game.log };
    say('saving…');
    try {
      const result = await chrome.runtime.sendMessage({ type: 'game', row });
      if (result?.saved) {
        say(`saved ${row.score} to your account${result.verified ? ' · counts for the leaderboard' : ''}`,
          { href: `${ZM_CONFIG.site}#game=${encodeURIComponent(row.ts)}`, text: 'See it' });
      } else {
        say(result?.reason || 'couldn’t save this game');
      }
    } catch {
      say('couldn’t reach the extension; reload the extension and play again');
    }
  }

  new MutationObserver(records => {
    for (const r of records) {
      const el = r.target.nodeType === Node.ELEMENT_NODE ? r.target : r.target.parentElement;
      if (r.type === 'attributes' && el.matches('#game .answer') && el.disabled && game && !game.off && !game.over) finished();
      else if (r.type !== 'attributes' && el?.closest('#game .problem')) questionShown(el.closest('.problem').textContent);
    }
  }).observe(document, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['disabled'] });
  document.addEventListener('input', typed, true);
})();
