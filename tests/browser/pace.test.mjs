// Pacing within a 2-minute game (dash-games.js, dash-weak.js): right answers per 30-second quarter,
// in a game's breakdown and averaged under weak spots.
import { browser, check, done } from './lib.mjs';

const b = await browser();
await b.go('');
await b.ev(`localStorage.setItem('zm-welcome-seen', '1')`);
await b.go('', 1000);

// A game that answers 19, 18, 17 and then 14 questions in its four quarters.
const run = (n, t) => Array.from({ length: n }, () => ({ q: '2 + 3', a: 5, o: 'add', c: 0, t }));
const fading = [...run(19, 1500), ...run(18, 1700), ...run(17, 1750), ...run(14, 2100)];

// ---- the rule ----
check('answers are counted in the quarter they were made', JSON.stringify(await b.ev(`paceOf(${JSON.stringify(fading)})`)) === '[19,18,17,14]');
check('a slower last quarter reads as fading', (await b.ev('paceTrend([19, 18, 17, 14])')) === 'you fade: the last 30 s is 26% below the first');
check('a faster one reads as speeding up', (await b.ev('paceTrend([10, 11, 12, 12])')) === 'you speed up: the last 30 s is 20% above the first');
check('within 10% is an even pace', (await b.ev('paceTrend([20, 18, 19, 19])')) === 'an even pace');
check('an answer right on the buzzer counts in the last quarter', JSON.stringify(await b.ev(`paceOf(${JSON.stringify(run(1, 120000))})`)) === '[0,0,0,1]');
check('a log covering under 90 of the 120 seconds is too incomplete to judge', !(await b.ev(`paceable(${JSON.stringify(run(10, 2000))})`)) && await b.ev(`paceable(${JSON.stringify(fading)})`));
check('wrong answers on a test don’t count', JSON.stringify(await b.ev(`paceOf([{ t: 1000, r: 'n' }, { t: 1000, r: 'y' }])`)) === '[1,0,0,0]');

// ---- on the page ----
const games = [
  { ts: '2026-09-01T10:00:00', date: '2026-09-01', score: fading.length, seconds: 120, source: 'game', mode: 'standard', elapsed: 0, detail: fading },
  { ts: '2026-09-02T10:00:00', date: '2026-09-02', score: 40, seconds: 120, source: 'game', mode: 'standard', elapsed: 0, detail: run(40, 2900) },
  { ts: '2026-09-03T10:00:00', date: '2026-09-03', score: 10, seconds: 30, source: 'game', mode: 'standard', elapsed: 0, detail: run(10, 2900) },
];
await b.ev(`fetch('api/import', { method: 'POST', body: ${JSON.stringify(JSON.stringify({ app: 'zetamac-tracker', scores: games }))} }).then(r => r.ok)`);
await b.go('', 1500);
await b.until(`document.querySelector('.pace-line')`);
// 40 answers of 2.9 s: 10, 10, 11, 9 a quarter; averaged with 19, 18, 17, 14.
check('weak spots average the pace of the 2-minute games (30-second ones left out)',
  /Answers per 30 s, averaged over 2 2-minute games: 14\.5 · 14\.0 · 14\.0 · 11\.5 · you fade: the last 30 s is 21% below the first/.test(await b.text('.pace-line')), await b.text('.pace-line'));
await b.ev(`document.querySelector('#recent tr.has-detail[data-ts="2026-09-01T10:00:00"]').click()`);
await b.until(`document.querySelector('.bd-pace')`);
check('a game’s breakdown shows its own pace', (await b.text('.bd-pace')) === 'Answers per 30 s: 19 · 18 · 17 · 14 · you fade: the last 30 s is 26% below the first', await b.text('.bd-pace'));
await b.ev(`document.querySelector('#recent tr.has-detail[data-ts="2026-09-03T10:00:00"]').click()`);
await b.until(`document.querySelectorAll('.detail-row').length === 2`);
check('a 30-second game’s breakdown has no pace line', (await b.ev(`document.querySelectorAll('.bd-pace').length`)) === 1);

check('no errors in the page', b.errors.length === 0, b.errors);
b.close();
done();
