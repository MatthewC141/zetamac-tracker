// "All facts" with "Exclude outliers" on (dash-weak.js): a fact whose only answers were left out as
// outliers says so, rather than "none yet" as if it had never come up. (Reported by Matthew: a slow
// 9 × 82 was the game's slowest question, yet × 9 read "none yet".)
import { browser, check, done } from './lib.mjs';

const b = await browser();
await b.go('');
await b.ev(`localStorage.setItem('zm-welcome-seen', '1'); localStorage.setItem('zm-weak', '1'); localStorage.setItem('zm-facts-all', '1'); localStorage.setItem('zm-facts-trim', '1')`);

const mul = (x, y, t) => ({ q: `${x} × ${y}`, a: x * y, o: 'mul', c: 0, t });
const log = [mul(6, 20, 1500), mul(6, 21, 1600), mul(5, 30, 1400), mul(5, 31, 1500), mul(4, 40, 1600), mul(4, 41, 1500), mul(3, 50, 1400), mul(9, 82, 5840)];
const game = { ts: '2026-10-01T10:00:00', date: '2026-10-01', score: log.length, seconds: 120, source: 'game', mode: 'standard', elapsed: 0, detail: log };
await b.ev(`fetch('api/import', { method: 'POST', body: ${JSON.stringify(JSON.stringify({ app: 'zetamac-tracker', scores: [game] }))} }).then(r => r.ok)`);

await b.go('', 1500);
await b.until(`document.querySelector('.facts-all')`);
const row = label => b.ev(`[...document.querySelectorAll('.facts-all .tower li')].find(li => li.querySelector('.fact-name').textContent === ${JSON.stringify(label)})?.innerText.replace(/\\s+/g, ' ').trim()`);
check('the outlier is left out', /1 unusually slow answer left out/.test(await b.text('.facts-note')), await b.text('.facts-note'));
check('a fact whose only answer was left out says so, not "none yet"', /left out/.test(await row('× 9')) && !/none yet/.test(await row('× 9')), await row('× 9'));
check('a fact that never came up still says "none yet"', /none yet/.test(await row('× 7')), await row('× 7'));

await b.click('[data-facts="trim"]');
await b.until(`!/left out/.test(document.querySelector('.facts-note').textContent)`);
check('with outliers kept, × 9 shows its time', /5\.84/.test(await row('× 9')), await row('× 9'));

check('no errors in the page', b.errors.length === 0, b.errors);
b.close();
done();
