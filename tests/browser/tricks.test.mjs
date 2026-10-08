// "Learn the trick": weak spots link your slowest operations and most-corrected kinds to their Guide
// tabs (dash-weak.js), and the Guide tags the tabs of your two slowest operations (guide.js).
import { browser, check, done } from './lib.mjs';

const b = await browser();
await b.go('');
await b.ev(`localStorage.setItem('zm-welcome-seen', '1')`);

// Division slowest, then subtraction; × 7 quick but often corrected.
const log = [
  ...[12, 30, 44, 5, 61, 18].map((n, i) => ({ q: `7 × ${n}`, a: 7 * n, o: 'mul', c: i < 3 ? 1 : 0, t: 1000 })),
  ...[8, 9, 10, 11].map(n => ({ q: `${6 * n} ÷ 6`, a: n, o: 'div', c: 0, t: 3200 })),
  ...[[58, 37], [49, 26], [68, 15], [77, 18]].map(([x, y]) => ({ q: `${x} + ${y}`, a: x + y, o: 'add', c: 0, t: 2800 })),
  ...[[52, 17], [63, 28], [41, 19], [70, 35]].map(([x, y]) => ({ q: `${x} – ${y}`, a: x - y, o: 'sub', c: 0, t: 2900 })),
];
const game = { ts: '2026-10-01T10:00:00', date: '2026-10-01', score: log.length, seconds: 120, source: 'game', mode: 'standard', elapsed: 0, detail: log };
await b.ev(`fetch('api/import', { method: 'POST', body: ${JSON.stringify(JSON.stringify({ app: 'zetamac-tracker', scores: [game] }))} }).then(r => r.ok)`);

await b.go('', 1500);
await b.until(`document.querySelector('.trick-line')`);
check('weak spots offer the tricks for the two slowest operations', (await b.text('.trick-line')) === 'Learn the trick: Division · Subtraction', await b.text('.trick-line'));
check('…linked to their Guide tabs', (await b.ev(`[...document.querySelectorAll('.trick-line a')].map(a => a.getAttribute('href')).join()`)) === 'guide.html#div,guide.html#sub');
check('a most-corrected kind links to its operation’s tricks', (await b.ev(`document.querySelector('.corrected a.trick').getAttribute('href')`)) === 'guide.html#mul');

await b.click('.trick-line a');
await b.until(`location.pathname.endsWith('guide.html')`);
await b.until(`document.querySelector('#tab-div')?.getAttribute('aria-selected') === 'true'`);
check('following a link opens that Guide tab', true);
const flagged = await b.ev(`[...document.querySelectorAll('.bay')].filter(t => t.querySelector('.bay-flag')).map(t => t.dataset.bay).join()`);
check('the Guide tags your two slowest operations', flagged === 'sub,div', flagged);

await b.ev(`localStorage.removeItem('zm-slow-ops')`);
await b.go('guide.html', 800);
check('with nothing known yet, no tab is tagged', (await b.ev(`document.querySelectorAll('.bay-flag').length`)) === 0);

check('no errors in the pages', b.errors.length === 0, b.errors);
b.close();
done();
