// The answer checks: every question in a log worked out and in range, the daily challenge's
// questions the day's own, and the quant tests' marks matching what was typed.
import { fresh, check, done } from './lib.mjs';
import { arithLog, testLog, P } from '../shared/games.mjs';

const t = await fresh();
const { db, rpc, save, utc } = t;
const one = async (text, params) => (await db.query(text, params)).rows[0].r;

// ---- the database builds the same daily questions as the browser ----
const seeds = [1, -5, 0, 2147483647, -2147483648, 12345, ...Array.from({ length: 6 }, () => (Math.random() * 2 ** 32 | 0))];
let same = true, bad = null;
for (const seed of seeds) {
  const mine = await one('select private.zm_daily_list($1, 300) r', [seed]);
  const theirs = P.list('daily', seed, 300).map(p => p.q);
  if (JSON.stringify(mine) !== JSON.stringify(theirs)) { same = false; bad = { seed, mine: mine.slice(0, 4), theirs: theirs.slice(0, 4) }; break; }
}
check('the daily set built in the database matches the browser’s, seed for seed', same, bad);

// ---- every kind of question works out to its answer ----
let wrong = [];
for (const game of ['standard', 'mixed', 'sq99h', 'sq999h', 'sq99', 'o80', 'frac', 'est']) {
  const qs = P.list(game, 99, game === 'est' || game === 'frac' ? 400 : 250);
  const r = (await db.query(`select q, private.zm_eval(q) v from unnest($1::text[]) q`, [qs.map(p => p.q)])).rows;
  r.forEach((row, i) => {
    const want = qs[i].a, got = row.v === null ? null : Number(row.v);
    const ok = got !== null && (qs[i].tol ? Math.abs(got - want) <= 1e-4 * Math.max(1, want) : Math.abs(got - want) < 1e-6);  // estimates are kept to 4 places
    if (!ok && wrong.length < 5) wrong.push([game, row.q, want, row.v]);
  });
}
check('the database works out every kind of question (2,500 of them)', wrong.length === 0, wrong);
const junk = (await db.query(`select private.zm_eval(q) v from unnest(array['1; drop table scores', 'pg_sleep(5)', '', '2 + ', 'select 1']) q`)).rows;
check('anything that isn’t a question works out to nothing', junk.every(r => r.v === null), junk);

const nums = [['1,037', 1037], ['8,5', 8.5], ['40%', 40], [' 12 ', 12], ['−3', -3], ['.5', 0.5], ['1,25', 1.25], ['abc', null], ['', null]];
const read = (await db.query(`select private.zm_num(g) v from unnest($1::text[]) with ordinality u(g, i) order by i`, [nums.map(n => n[0])])).rows.map(r => r.v);
check('typed answers are read as the tests read them', read.every((v, i) => (v === null ? null : Number(v)) === nums[i][1]), read);

// ---- honest games still count; made-up logs don't ----
const A = await t.user('alex');
const log = (n, seed = 1) => arithLog('standard', seed, n, 1500);
check('an honest game counts', (await save(A, { score: 20, detail: log(20) })).verified === true);
const cases = [
  ['a wrong answer in the log', l => { l[3].a += 1; }],
  ['a made-up question', l => { l[0] = { ...l[0], q: '2 + 3', a: 6 }; }],
  ['numbers outside zetamac’s ranges', l => { l[1] = { ...l[1], q: '150 + 3', a: 153 }; }],
  ['a multiplication bigger than 12 × 100', l => { l[2] = { ...l[2], q: '13 × 5', a: 65 }; }],
  ['a division that isn’t a times-table one', l => { l[2] = { ...l[2], q: '84 ÷ 42', a: 2 }; }],
  ['a question that isn’t arithmetic', l => { l[2] = { ...l[2], q: 'hello', a: 1 }; }],
];
for (const [name, edit] of cases) {
  const l = log(20, 7); edit(l);
  check(`never counts: ${name}`, (await save(A, { score: 20, detail: l })).verified === false);
}
const sq = arithLog('sq99h', 3, 15, 2500);
check('squares: an honest game counts', (await save(A, { mode: 'sq99h', score: 15, detail: sq })).verified === true);
check('squares: an easy number (25², 15²) never counts', (await save(A, { mode: 'sq99h', score: 15, detail: [...sq.slice(0, 14), { q: '25²', a: 625, o: 'sq', c: 0, t: 2500 }] })).verified === false &&
  (await save(A, { mode: 'sq99h', score: 15, detail: [...sq.slice(0, 14), { q: '15²', a: 225, o: 'sq', c: 0, t: 2500 }] })).verified === false);
check('combined: an honest game counts, a wrong answer doesn’t', (await save(A, { mode: 'mixed', score: 10, detail: arithLog('mixed', 5, 10, 3000) })).verified === true &&
  (await save(A, { mode: 'mixed', score: 10, detail: arithLog('mixed', 6, 10, 3000).map((q, i) => (i === 4 ? { ...q, a: q.a + 1 } : q)) })).verified === false);
const sub = Array.from({ length: 10 }, (_, i) => ({ q: `${50 + (i % 5)} – ${17 + (i % 3)}`, a: 50 + (i % 5) - 17 - (i % 3), o: 'sub', c: 0, t: 2000 }));  // 50–54 take 17–19: always a borrow
check('borrowing practice: only borrowing questions count', (await save(A, { mode: 'sub-borrow', score: 10, detail: sub })).verified === true &&
  (await save(A, { mode: 'sub-borrow', score: 10, detail: sub.map((q, i) => (i ? q : { ...q, q: '68 – 13', a: 55 })) })).verified === false);

// ---- the daily challenge: the day's questions, in order ----
const B = await t.user('bea'), C = await t.user('cal'), D = await t.user('dee');
const seed = (await rpc(B, 'daily_start', { p_date: utc })).seed;
await rpc(C, 'daily_start', { p_date: utc }); await rpc(D, 'daily_start', { p_date: utc });
check("today's questions count", (await save(B, { mode: 'daily', score: 25, detail: arithLog('daily', seed, 25) })).verified === true);
check('other questions never count', (await save(C, { mode: 'daily', score: 25, detail: arithLog('daily', seed + 1, 25) })).verified === false);
const shuffled = arithLog('daily', seed, 25); [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
check("the day's questions out of order never count", (await save(D, { mode: 'daily', score: 25, detail: shuffled })).verified === false);

// ---- quant tests: the marks must match what was typed ----
const right = p => (p.tol ? String(Number(p.a.toPrecision(3))) : P.fmt(p.a));
for (const game of ['o80', 'frac', 'est', 'seq']) {
  const len = game === 'o80' ? 480 : 240;
  const g = testLog(game, 11, (p, i) => (i < 20 ? (i === 6 ? '-7' : i === 9 ? '' : right(p)) : undefined), 3000);
  check(`${game}: an honest test counts`, (await save(A, { mode: game, seconds: len, elapsed: 200, score: g.score, detail: g.detail })).verified === true);
  const flipped = g.detail.map((q, i) => (i === 6 ? { ...q, r: 'y' } : q));  // a wrong answer marked right
  check(`${game}: a wrong answer marked right never counts`, (await save(A, { mode: game, seconds: len, elapsed: 200, score: g.score + 2, detail: flipped })).verified === false);
  if (game !== 'seq') {
    const faked = g.detail.map((q, i) => (i === 0 ? { ...q, a: String(Number(q.a) * 2), g: String(Number(q.a) * 2) } : q));  // a made-up answer key
    check(`${game}: a made-up answer key never counts`, (await save(A, { mode: game, seconds: len, elapsed: 200, score: g.score, detail: faked })).verified === false);
  }
}

done();
