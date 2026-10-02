// The practice drills (practice.html): the drills and their questions; the game loop is game.js. Kept out of the page so the page's security policy can refuse inline scripts.
const $ = s => document.querySelector(s);
const MODE_NAMES = { 'sub-borrow': 'Subtraction with borrowing', 'sub-easy': 'Subtraction without borrowing', drill: 'Weak-spot drill' };
const P = window.ZM_PROBLEMS;
let last = '';

const rand = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));

// A zetamac subtraction problem is (a + b) – a = b with a, b in 2–100. "Borrowing" means the ones
// digit being subtracted (a) is bigger than the ones digit of the number it's subtracted from (a + b).
const needsBorrow = (top, sub) => sub % 10 > top % 10;

function subtraction(drill) {
  for (;;) {
    const a = rand(2, 100), b = rand(2, 100), top = a + b;
    if (needsBorrow(top, a) === (drill === 'sub-borrow')) return { text: `${top} – ${a}`, answer: b };
  }
}

function readSettings() {
  const mode = document.querySelector('input[name=drill]:checked')?.value || 'sub-borrow';
  const duration = parseInt($('#duration').value, 10);
  return { mode, duration, tracked: [120, 30, 0].includes(duration) };
}

function updateNote() {
  const s = readSettings();
  $('#custom-note').textContent = s.duration === 0 ? 'No timer. Press Esc or Stop when you’re done.' : '';
}
document.querySelectorAll('#settings input, #settings select').forEach(el => el.addEventListener('input', updateNote));

// What the shared game loop (game.js) needs from this game.
const GAME = {
  next(cfg) {
    let p, tries = 0;  // (a drill with one question left to review may have to repeat it)
    do p = cfg.mode === 'drill' ? weak.next() : { ...subtraction(cfg.mode), o: 'sub' }; while (p.text === last && ++tries < 20);
    last = p.text;
    return { q: p.text, a: p.answer, o: p.o, review: p.review };
  },
  // Right as soon as it's typed: the exact answer, or (decimals) the same number written another way.
  right: (v, answer) => v === answer || (/^-?\d*\.?\d+$/.test(v) && !answer.includes(' ') && Number(v) === Number(answer) && !/^0\d/.test(v)),
  answered(q, t) { if (q.review) weak.answered(q.review, t); },
  untracked: 'Only 120-second, 30-second and endless games save to your tracker.',
  label: cfg => `${MODE_NAMES[cfg.mode]}${cfg.duration === 30 ? ', 30 s' : cfg.duration === 0 ? ', endless' : ''}`,
};

// ---- your weak spots ----
// A drill built from your own games: the slowest kinds of arithmetic question in your last 10
// timed games (like "× 7" or "– borrow", from the tracker's weak spots), the 80-in-8 kinds you miss
// most, and a review of exact questions you were slow on (twice your game's median) or got wrong.
// A review question stays in until you've answered it quickly twice in drills (at or under your
// usual time for that operation), so it keeps coming back until it's automatic.
const weak = (() => {
  const RECENT = 10, TOP = 4;
  let types = [], kinds = [], review = [], quick = {};
  const median = ts => { const s = [...ts].sort((a, b) => a - b), m = s.length / 2; return s.length % 2 ? s[Math.floor(m)] : (s[m - 1] + s[m]) / 2; };
  const KIND_NAMES = { add: 'addition', sub: 'subtraction', mul: 'multiplication', div: 'division', dec: 'decimals', pct: 'percentages', mix: 'brackets' };
  // A logged question, checked before it's used (logs come back as the game sent them).
  const clean = q => q && typeof q.q === 'string' && q.q.length <= 40 && Number.isFinite(Number(q.t)) &&
    { q: q.q, a: String(q.a ?? ''), o: /^[a-z]{1,8}$/.test(q.o) ? q.o : 'other', t: Number(q.t), r: ['y', 'n', 's'].includes(q.r) ? q.r : 'y' };
  async function build() {
    const games = await (await fetch('api/scores')).json();
    if (!Array.isArray(games)) return;
    const newest = list => [...list].sort((a, b) => (b.ts > a.ts ? 1 : b.ts < a.ts ? -1 : 0));
    const arith = newest(games.filter(g => ['standard', 'daily'].includes(g.mode) && g.seconds > 0 && g.detail)).slice(0, RECENT);
    const tests = newest(games.filter(g => g.mode === 'o80' && g.detail)).slice(0, 3);
    const drills = newest(games.filter(g => g.mode === 'drill' && g.detail)).slice(0, 30);
    const logOf = async g => ({ ts: g.ts, qs: ((await (await fetch(`api/detail?ts=${encodeURIComponent(g.ts)}`)).json()).questions || []).map(clean).filter(Boolean) });
    const [A, T, D] = await Promise.all([arith, tests, drills].map(list => Promise.all(list.map(g => logOf(g).catch(() => ({ ts: g.ts, qs: [] }))))));

    // Slowest kinds of arithmetic question (3 answers or more), and each operation's usual time.
    const byFact = {}, byOp = {};
    for (const g of A) for (const q of g.qs) {
      const f = P.factOf(q);
      if (f) (byFact[f] ||= []).push(q.t);
      (byOp[q.o] ||= []).push(q.t);
    }
    types = Object.entries(byFact).filter(([, ts]) => ts.length >= 3).map(([k, ts]) => [k, ts.reduce((a, b) => a + b, 0) / ts.length])
      .sort((a, b) => b[1] - a[1]).slice(0, TOP).map(([k]) => k);
    for (const [o, ts] of Object.entries(byOp)) quick[o] = median(ts);
    // 80 in 8: the kinds answered wrong most often (under 90% right), at most two.
    const acc = {};
    for (const g of T) for (const q of g.qs) if (q.r !== 's') { const a = (acc[q.o] ||= { y: 0, n: 0, ts: [] }); q.r === 'n' ? a.n++ : (a.y++, a.ts.push(q.t)); }
    kinds = Object.entries(acc).filter(([o, a]) => KIND_NAMES[o] && a.y / (a.y + a.n) < 0.9).sort((a, b) => a[1].y / (a[1].y + a[1].n) - b[1].y / (b[1].y + b[1].n)).slice(0, 2).map(([o]) => o);
    for (const [o, a] of Object.entries(acc)) if (a.ts.length) quick[`o80:${o}`] = median(a.ts);
    // Review: slow arithmetic answers and 80-in-8 misses, newest first, unless drilled away since.
    const seen = new Map();
    for (const g of A) { const m = median(g.qs.map(q => q.t)); for (const q of g.qs) if (q.t >= 2 * m && q.t >= 1500 && !seen.has(q.q)) seen.set(q.q, { q: q.q, a: q.a, o: q.o, ts: g.ts, quickKey: q.o }); }
    for (const g of T) for (const q of g.qs) if (q.r === 'n' && !seen.has(q.q)) seen.set(q.q, { q: q.q, a: q.a, o: q.o, ts: g.ts, quickKey: `o80:${q.o}` });
    const fastSince = (item) => D.filter(d => d.ts > item.ts).flatMap(d => d.qs).filter(q => q.q === item.q && q.t <= (quick[item.quickKey] ?? 3000)).length;
    review = [...seen.values()].filter(item => fastSince(item) < 2).slice(0, 24).map(item => ({ ...item, hits: 0 }));
  }

  // The next drill question: about 2 in 5 from the review list, the rest new questions of your slow kinds.
  function next() {
    const all = [...types, ...kinds.map(k => `o80:${k}`)];
    let open = review.filter(r => r.hits < 2);
    if (!open.length && !all.length) open = review;  // only reviews, all done: keep going over them
    if (open.length && (Math.random() < 0.4 || !all.length)) {
      const r = open[Math.floor(Math.random() * open.length)];
      return { text: r.q, answer: r.a, o: r.o, review: r };
    }
    const k = all[Math.floor(Math.random() * all.length)];
    if (k.startsWith('o80:')) { const p = P.one('o80', k.slice(4)); return { text: p.q, answer: P.fmt(p.a), o: p.o }; }
    const p = P.ofFact(k);
    return { text: p.q, answer: p.a, o: p.o };
  }
  // A review question answered: quick enough counts toward retiring it for this run.
  function answered(r, t) { if (t <= (quick[r.quickKey] ?? 3000)) r.hits++; }
  const ready = () => types.length + kinds.length + review.length > 0;

  function describe() {
    const row = $('#drill-row'), box = row.querySelector('input'), detail = $('#drill-detail');
    box.disabled = !ready();
    row.classList.toggle('unavailable', !ready());
    if (!ready()) {
      detail.textContent = 'Play a few 2-minute games first: this drill builds itself from your slowest kinds of question.';
      if (box.checked) document.querySelector('input[name=drill][value="sub-borrow"]').click();
      return;
    }
    const parts = [...types, ...kinds.map(k => KIND_NAMES[k])];
    detail.textContent = `${parts.join(' · ')}${review.length ? `${parts.length ? ', and ' : ''}${review.length} question${review.length === 1 ? '' : 's'} to review` : ''}`;
  }
  return { build, next, answered, describe };
})();

// Arriving from the tracker's "Drill these" (practice.html#weak) picks the drill.
let wanted = location.hash === '#weak' ? 'drill' : null;
try { wanted ||= localStorage.getItem('zm-drill'); } catch {}
const pickDrill = v => { const b = document.querySelector(`input[name=drill][value="${v}"]`); if (b && !b.disabled && !b.checked) b.click(); };
document.querySelectorAll('input[name=drill]').forEach(b => b.addEventListener('change', () => { try { localStorage.setItem('zm-drill', b.value); } catch {} }));
if (!document.querySelector('input[name=drill]:checked')) document.querySelector('input[name=drill][value="sub-borrow"]').checked = true;
weak.build().catch(() => {}).then(() => { weak.describe(); if (wanted) pickDrill(wanted); });
