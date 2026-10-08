// The arithmetic game (play.html): its settings, its questions and the daily challenge. The game
// loop itself is game.js. Kept out of the page so the page's security policy can refuse inline scripts.
const $ = s => document.querySelector(s);
const DEFAULTS = window.ZM_PROBLEMS.ARITH_DEFAULTS;  // zetamac's ranges
const num = id => parseInt($('#' + id).value, 10);

function readSettings() {
  const ops = ['add', 'sub', 'mul', 'div'].filter(o => $(`#${o}-on`).checked);
  const r = {};
  for (const k in DEFAULTS) r[k] = num(k);
  const ranged = (a, b) => Number.isFinite(r[a]) && Number.isFinite(r[b]) && r[a] <= r[b];
  if (!ops.length) return { error: 'Pick at least one operation.' };
  for (const [lo, hi] of [['add-a-lo', 'add-a-hi'], ['add-b-lo', 'add-b-hi'], ['mul-a-lo', 'mul-a-hi'], ['mul-b-lo', 'mul-b-hi']])
    if (!ranged(lo, hi)) return { error: 'Each range needs a low number that is not above the high number.' };
  if ((ops.includes('div')) && r['mul-a-lo'] <= 0 && r['mul-a-hi'] >= 0) return { error: 'Division ranges can’t include 0.' };
  const duration = parseInt($('#duration').value, 10);
  const defaultRanges = ops.length === 4 && Object.keys(DEFAULTS).every(k => r[k] === DEFAULTS[k]);
  const tracked = defaultRanges && [120, 30, 0].includes(duration);
  return { ops, r, duration, tracked, mode: 'standard' };
}

function updateNote() {
  const s = readSettings();
  $('#custom-note').textContent = s.error ? s.error
    : s.tracked ? (s.duration === 30 ? 'Saved to the 30-second section of your tracker. Esc during a game quits without saving.'
      : s.duration === 0 ? 'No timer. Press Esc or Stop when you’re done; your run counts toward your endless record.' : 'Esc during a game quits without saving.')
    : 'Custom settings: this game won’t be saved to your tracker. (Tracked: default ranges at 120, 30 seconds or endless.)';
}
document.querySelectorAll('#settings input, #settings select').forEach(el => el.addEventListener('input', updateNote));


// The next question: the day's list for the daily challenge, or a random one from the ranges.
const nextQuestion = cfg => (cfg.daily ? cfg.daily[cfg.at++] : window.ZM_PROBLEMS.arith(cfg.r, cfg.ops));  // (the daily is the same for everyone)

// What the shared game loop (game.js) needs from this game.
const GAME = {
  next: nextQuestion,
  untracked: 'Custom settings: not saved to your tracker.',
  begin(cfg) { $('#again').hidden = !!cfg.daily; },  // the daily challenge is one try
  saved(cfg, { final, prevBest, same }) {
    if (cfg.daily) return { html: `Today’s challenge saved · ${daily.streak(history)}-day streak · <a href="leaderboard.html#daily">See today’s board</a>` };
    const label = cfg.duration === 30 ? '30-second ' : cfg.duration === 0 ? 'endless ' : '';
    const proj = cfg.duration === 30 ? ` · projects to ${final * 4} in 2 minutes` : '';
    if (cfg.duration === 0 && final > prevBest) return { pb: true, text: same.length ? `New longest endless run! (was ${prevBest})` : 'First endless run saved — that’s your record to beat.' };
    if (same.length && final > prevBest) return { pb: true, text: `New ${label}personal best! (was ${prevBest})${proj}` };
    return { text: `Saved · ${label}personal best ${Math.max(prevBest, final)}${proj}` };
  },
  afterSave(cfg) { if (cfg.daily) daily.render(); },
  finished(cfg, log) {
    if (!cfg.tracked) { $('#summary').textContent = ''; return; }  // custom ranges don't compare with your usual
    $('#summary').replaceChildren(...zmSummary.lines(log, recentLogs).map(line => Object.assign(document.createElement('p'), { textContent: line })));
    recentLogs = [log.slice(), ...recentLogs].slice(0, RECENT);
  },
  loaded() { daily.render(); loadRecentLogs(); },
};

// The question logs of your last few Arithmetic games (daily challenges included), newest first,
// for the summary under the score. Fetched once when the page opens; each game played adds its own.
const RECENT = 10;
let recentLogs = [];
async function loadRecentLogs() {
  const recent = history.filter(g => (g.mode === 'standard' || g.mode === 'daily') && g.detail).slice(-RECENT);
  if (!recent.length) return;
  try {
    const { details } = await (await fetch(`api/details?ts=${recent.map(g => encodeURIComponent(g.ts)).join(',')}`)).json();
    recentLogs = recent.map(g => details?.[g.ts]).filter(Array.isArray).reverse();
  } catch {}  // without them the summary names the slowest question instead
}

// ---- the daily challenge ----
// Everyone gets the same 2 minutes of zetamac arithmetic each calendar day (problems.js builds it
// from the date), and only the first try counts. The card on the start screen offers it, or says
// how it went: the score, the place on today's board (signed in), and the streak of days played.
const daily = (() => {
  const pad = n => String(n).padStart(2, '0');
  const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => dayKey(new Date());
  const mineToday = list => list.find(g => g.mode === 'daily' && g.date === today());
  // Days in a row with a daily challenge, up to today (or yesterday, if today's is still to play).
  function streak(list) {
    const days = new Set(list.filter(g => g.mode === 'daily').map(g => g.date));
    const d = new Date();
    if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
    let n = 0;
    while (days.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  const card = $('#daily'), text = $('#daily-text'), acts = $('#daily-acts');
  const ordinal = n => { const v = n % 100; return n + (['th', 'st', 'nd', 'rd'][(v - 20) % 10] || ['th', 'st', 'nd', 'rd'][v] || 'th'); };
  async function render() {
    if (!window.ZM_PROBLEMS) return;
    card.hidden = false;
    const done = mineToday(history), n = streak(history);
    $('#daily-streak').textContent = n ? `${n}-day streak` : '';
    const shared = window.ZM_WEB && window.ZM_CLOUD?.ready && window.ZM_CLOUD.user();
    if (!done) {
      text.textContent = shared ? 'Today’s 2 minutes of arithmetic: the same questions for everyone, one try.'
        : window.ZM_WEB ? 'Today’s 2 minutes of arithmetic, one try. Sign in to get the same questions as everyone and a place on today’s board.'
        : 'Today’s 2 minutes of arithmetic, one try.';
      acts.innerHTML = '<button type="button" id="daily-go">Play today’s</button><a class="btn" href="leaderboard.html#daily">Today’s board</a>';
      $('#daily-go').addEventListener('click', play);
      return;
    }
    text.innerHTML = `Today: <b>${done.score}</b> · back tomorrow for a new set`;
    acts.innerHTML = '<a class="btn" href="leaderboard.html#daily">Today’s board</a>';
    const cloud = window.ZM_CLOUD;
    if (!window.ZM_WEB || !cloud?.ready || !cloud.user()) return;
    try {
      const board = await cloud.daily(today()), me = cloud.user().name.toLowerCase();
      const at = board.findIndex(r => r.username.toLowerCase() === me);
      // Tied scores share a place.
      if (at >= 0) text.innerHTML = `Today: <b>${done.score}</b> · ${ordinal(board.findIndex(r => r.score === board[at].score) + 1)} of ${board.length} · back tomorrow for a new set`;
    } catch {}
  }
  // Signed in on the website, the day's questions come from the database as the try starts (so no
  // one can see them early) and the result goes on the board. Otherwise the set is built from the
  // date here: the same daily habit, but this browser's own set and no board. Only the first try
  // counts: a try started before (and left unsaved, after a reload say) is offered as practice.
  async function play() {
    if (mineToday(history)) return render();
    const date = today(), P = window.ZM_PROBLEMS, cloud = window.ZM_CLOUD;
    let seed = P.daySeed(date);
    const go = () => start({ ops: ['add', 'sub', 'mul', 'div'], r: { ...DEFAULTS }, duration: 120, tracked: true, mode: 'daily', daily: P.list('daily', seed, 500), at: 0 });
    if (window.ZM_WEB && cloud?.ready && cloud.user()) {
      $('#daily-go').disabled = true;
      try {
        const r = await cloud.rest('rpc/daily_start', { method: 'POST', body: { p_date: date } });
        seed = r.seed;
        if (r.tries > 1) {
          text.textContent = 'You started today’s challenge earlier, so another try is practice: it won’t go on the board.';
          acts.innerHTML = '<button type="button" id="daily-go">Play it as practice</button><a class="btn" href="leaderboard.html#daily">Today’s board</a>';
          $('#daily-go').addEventListener('click', go);
          return;
        }
      } catch { text.textContent = 'Couldn’t reach the server for today’s questions, so this one is a practice set and won’t go on the board.'; }
    }
    go();
  }
  return { render, streak };
})();
