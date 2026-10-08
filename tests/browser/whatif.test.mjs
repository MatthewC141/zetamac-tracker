// What if: crossing out slow questions in the last game (weak spots, "Last game") shows the score
// you'd likely have had, their time spent at the game's own pace on the rest (dash-weak.js).
import { browser, check, done } from './lib.mjs';

const b = await browser();
await b.go('');
await b.ev(`localStorage.setItem('zm-welcome-seen', '1')`);
await b.go('', 800);

// ---- the rule ----
const q = (t, text = '2 + 3') => ({ q: text, a: 5, o: 'add', c: 0, t });
const ten = [...Array(9)].map(() => q(2000)).concat([q(8000, '84 ÷ 7')]);
const one = await b.ev(`whatIf(${JSON.stringify(ten)}, new Set([9]))`);
check('a crossed-out question gives its time back at the game’s pace', one.estimate === 13 && one.score === 10 && one.count === 1, one);
check('nothing crossed out, nothing to say', (await b.ev(`whatIf(${JSON.stringify(ten)}, new Set())`)) === null);
const two = await b.ev(`whatIf(${JSON.stringify(ten)}, new Set([8, 9]))`);
check('several can be crossed out together', two.count === 2 && two.estimate === 8 + 10000 / 2000, two);

// ---- on the page ----
const game = (ts, seconds, log, elapsed = 0) => ({ ts, date: ts.slice(0, 10), score: log.length, seconds, source: 'game', mode: 'standard', elapsed, detail: log });
const importGames = list => b.ev(`fetch('api/import', { method: 'POST', body: ${JSON.stringify(JSON.stringify({ app: 'zetamac-tracker', scores: list }))} }).then(r => r.ok)`);
await importGames([game('2026-10-01T10:00:00', 120, ten)]);
await b.go('', 1200);
await b.click('[data-window="1"]');
await b.until(`document.querySelector('.slowq [data-leave-out]')`);
check('the last game’s slowest questions each have a ✕', (await b.ev(`document.querySelectorAll('.slowq [data-leave-out]').length`)) === 5);
check('the slowest is first', /84 ÷ 7/.test(await b.text('.slowq li')));
await b.click('.slowq [data-leave-out]');
check('crossing it out shows the likely score', (await b.text('#whatif-line')) ===
  'Without that question: about 13.0 instead of 10 (+3.0). The 8.00 s it took, at your 2.00 s a question, buys about 4.0 more answers.', await b.text('#whatif-line'));
check('…and marks it crossed out', await b.ev(`document.querySelector('.slowq li').classList.contains('left-out') && document.querySelector('.slowq [data-leave-out]').getAttribute('aria-pressed') === 'true'`));
await b.click('.slowq [data-leave-out]');
check('pressing ✕ again brings it back', /Cross out a question/.test(await b.text('#whatif-line')) && !(await b.ev(`document.querySelector('.slowq li').classList.contains('left-out')`)));

await importGames([game('2026-10-02T10:00:00', 0, ten, 30)]);
await b.go('', 1200);
await b.until(`document.querySelector('.slowq')`);
check('an endless run has no ✕, since time doesn’t limit its score', (await b.ev(`document.querySelectorAll('.slowq [data-leave-out]').length`)) === 0 && !(await b.ev(`document.querySelector('#whatif-line')`)));

check('no errors in the page', b.errors.length === 0, b.errors);
b.close();
done();
