// The quant tests (80 in 8, sequences, fractions, estimation): marked right minus wrong.
import { fresh, check, done } from './lib.mjs';
import { testLog, P } from '../shared/games.mjs';

const t = await fresh();
const { as, err, save } = t;
const A = await t.user('alex');
const right = p => (p.tol ? String(Number(p.a.toPrecision(3))) : P.fmt(p.a));

for (const [game, len] of [['o80', 480], ['seq', 240], ['frac', 240], ['est', 240]]) {
  const n = P.TESTS[game].count;
  // most right, a few wrong, one skipped, the rest not reached
  const g = testLog(game, 7, (p, i) => (i < n - 8 ? (i % 9 === 4 ? String(Math.round(p.a) + 17) : i === 2 ? '' : right(p)) : undefined), 2000);
  const r = await save(A, { mode: game, seconds: len, score: g.score, elapsed: len - 10, detail: g.detail });
  check(`${game}: a fair test counts (${g.score})`, r.verified === true);
  check(`${game}: the score must be right minus wrong`, (await save(A, { mode: game, seconds: len, score: g.score + 1, elapsed: len - 10, detail: g.detail })).verified === false);
  check(`${game}: longer than its length never counts`, (await save(A, { mode: game, seconds: len, score: g.score, elapsed: len + 60, detail: g.detail })).verified === false);
  check(`${game}: more than its question count is refused`, !!(await err(() => save(A, { mode: game, seconds: len, score: n + 1 }))));
}
check('the tests have fixed lengths', !!(await err(() => save(A, { mode: 'frac', seconds: 120, score: 10 }))) && !!(await err(() => save(A, { mode: 'standard', seconds: 240, score: 10 }))));
const w = (await as(null, `select mode, wrongs from leaderboard where mode in ('o80', 'seq', 'frac', 'est') order by mode`)).rows;
check('the test boards carry wrong answers', w.length === 4 && w.every(r => r.wrongs > 0), w);

done();
