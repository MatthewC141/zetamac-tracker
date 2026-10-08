// The progress dashboard (index.html), part 1 of 9: the games loaded from the tracker, and what
// the other parts share (names of the games, dates, the range picked, small helpers). The parts are
// plain scripts loaded in order (index.html); dashboard.js, the last, wires up the page and loads it.
const $ = s => document.querySelector(s);
const DAY = 864e5;
const EPOCH = new Date(2000, 0, 1);
const RANGES = { '1m': 30, '3m': 91, '1y': 365, all: null };
const RANGE_SHORT = { '1m': '1 mo', '3m': '3 mo', '1y': '1 yr', all: 'all time' };
const RANGE_NAMES = { '1m': 'past month', '3m': 'past 3 months', '1y': 'past year', all: 'all time' };
// Dates are written the way the visitor's own locale writes them.
const fmt = opts => { const f = new Intl.DateTimeFormat(undefined, opts); return d => f.format(d); };
const monthName = fmt({ month: 'short' });

let allGames = [], games = [], sprints = [], endless = [];  // everything / chosen game at 120 s / chosen game at 30 s / endless runs
// sq99h and sq999h are the squares games; sq99 and sq999 are older games from when every number could come up.
const SQ_MODES = { sq99h: 'Two-digit squares', sq999h: 'Three-digit squares', sq99: 'Two-digit squares, all numbers', sq999: 'Three-digit squares, all numbers' };
const PRACTICE_MODES = { 'sub-borrow': 'Subtraction with borrowing', 'sub-easy': 'Subtraction without borrowing', drill: 'Weak-spot drill' };
const PRACTICE_TAGS = { 'sub-borrow': 'Borrowing practice', 'sub-easy': 'No-borrow practice', drill: 'Weak-spot drill' };
// The quant tests: each a fixed length, marked right minus wrong.
const TESTS = { o80: ['80 in 8', 480], seq: ['Sequences', 240], frac: ['Fractions', 240], est: ['Estimation', 240] };
const isTest = m => has(TESTS, m);
// Games that are saved but not shown anywhere on the dashboard (yet).
const HIDDEN_MODES = new Set(['guided']);
// Table lookups by own key only, so a stray name like "toString" never matches a mode.
const has = (table, key) => typeof key === 'string' && Object.hasOwn(table, key);
const modeName = m => has(SQ_MODES, m) ? SQ_MODES[m] : has(PRACTICE_MODES, m) ? PRACTICE_MODES[m] : m === 'mixed' ? 'Combined operations' : isTest(m) ? TESTS[m][0] : 'Arithmetic';
// The length that counts as a full game: a quant test's own length, 2 minutes for everything else.
const mainSeconds = m => (isTest(m) ? TESTS[m][1] : 120);
const mainLabel = m => (isTest(m) ? `${TESTS[m][0]} test` : '2-minute game');
// The game the stat tiles and score chart show (a mode key, e.g. 'standard' or 'sq99h').
let chartGame = 'standard';
try { chartGame = localStorage.getItem('zm-chart-game') || chartGame; } catch {}
let range = '3m';
try { range = localStorage.getItem('zm-range') || range; } catch {}
if (!has(RANGES, range)) range = '3m';

const parseDate = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const dateKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const today = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
const dayIdx = d => Math.round((d - EPOCH) / DAY);
const shortDate = fmt({ month: 'short', day: 'numeric' });
const withYear = fmt({ month: 'short', day: 'numeric', year: 'numeric' });
const dateLabel = d => (d.getFullYear() === new Date().getFullYear() ? shortDate(d) : withYear(d));
const longDate = fmt({ weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
const round1 = v => Math.round(v * 10) / 10;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function startOf(r = range) {
  const days = RANGES[r];
  if (days) return addDays(today(), -(days - 1));
  if (!games.length) return addDays(today(), -29);
  let min = games[0].date;
  for (const g of games) if (g.date < min) min = g.date;
  const d = parseDate(min);
  return d < addDays(today(), -6) ? d : addDays(today(), -6);
}

function byDay(list) {
  const map = new Map();
  for (const g of list) {
    let d = map.get(g.date);
    if (!d) map.set(g.date, d = { key: g.date, date: parseDate(g.date), best: 0, sum: 0, n: 0 });
    d.best = Math.max(d.best, g.score);
    d.sum += g.score;
    d.n++;
  }
  return [...map.values()].sort((a, b) => a.date - b.date);
}

function streak() {
  const played = new Set(allGames.map(g => g.date));
  let d = today();
  if (!played.has(dateKey(d))) d = addDays(d, -1);
  let n = 0;
  while (played.has(dateKey(d))) { n++; d = addDays(d, -1); }
  return n;
}

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

// ---------- data ----------
function setGames(list) {
  // Rows are rendered into the page, so only well-formed ones are used: whole-number figures and
  // text fields that are text. (Both the server and store.js already write rows this way.)
  const whole = v => Number.isInteger(v) && v >= 0;
  list = list.filter(g => g && whole(g.i) && whole(g.score) && whole(g.seconds) && whole(g.elapsed ?? 0) &&
    typeof g.ts === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(g.date) && typeof (g.mode ?? '') === 'string' && typeof (g.source ?? '') === 'string');
  list = list.filter(g => !HIDDEN_MODES.has(g.mode));  // each row keeps its server index `i`
  // The daily challenge is a 2-minute arithmetic game like any other (tagged Daily in Results).
  list = list.map(g => (g.mode === 'daily' ? { ...g, mode: 'standard', daily: true } : g));
  allGames = list;
  // games / sprints: the chosen game's 2-minute and 30-second scores, for the tiles and chart.
  const chosen = list.filter(g => (g.mode || 'standard') === chartGame);
  games = chosen.filter(g => g.seconds === mainSeconds(chartGame));
  sprints = chosen.filter(g => g.seconds === 30);
  endless = list.filter(g => g.seconds === 0);
}

async function api(path, form) {
  const opts = form ? {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Zetamac': '1' },
    body: new URLSearchParams(form),
  } : {};
  const r = await fetch(path, opts);
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Request failed');
  return data;
}
