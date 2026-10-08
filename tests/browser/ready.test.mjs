// Interview readiness on the 2-minute score panel (dash-score.js): the score reached in at least
// 8 of the last 10 games, and how it moved against the 10 before.
import { browser, check, done } from './lib.mjs';

const b = await browser();
await b.go('');
await b.ev(`localStorage.setItem('zm-welcome-seen', '1')`);
await b.go('', 1000);

// ---- the rule ----
const ready = scores => b.ev(`readiness(${JSON.stringify(scores)})`);
const ten = [60, 62, 64, 66, 68, 70, 72, 58, 61, 65];
const r = await ready(ten);
check('ready at the score reached in 8 of the last 10', r.score === 61 && r.needed === 8 && r.of === 10, r);
check('…with nothing to compare until there are 5 games before those', r.change === null);
const moved = await ready([50, 52, 54, 51, 53, 55, 49, 50, 52, 54, ...ten]);
check('it compares with the 10 games before', moved.change === 61 - 50, moved);
check('only the last 10 count', (await ready([99, 99, 99, ...ten])).score === 61);
const few = await ready([60, 61, 62]);
check('with under 5 games it says how many more are needed', few.short === 2, few);
check('with 5 games it needs 4 of them', (await ready([40, 50, 60, 70, 80])).score === 50);

// ---- on the page ----
const pad = n => String(n).padStart(2, '0');
const game = (d, score) => ({ ts: `2026-09-${pad(d)}T10:00:00`, date: `2026-09-${pad(d)}`, score, seconds: 120, source: 'game', mode: 'standard', elapsed: 0 });
const importGames = list => b.ev(`fetch('api/import', { method: 'POST', body: ${JSON.stringify(JSON.stringify({ app: 'zetamac-tracker', scores: list }))} }).then(r => r.ok)`);
await importGames([game(1, 60), game(2, 61), game(3, 62)]);
await b.go('', 1000);
check('the panel asks for more games at first', /Play 2 more 2-minute games to see the score you’d be ready to make/.test(await b.text('.sb-ready')), await b.text('.sb-ready'));
await importGames(ten.map((s, i) => game(10 + i, s)));
await b.go('', 1000);
check('then it shows the interview-ready score', (await b.text('.sb-ready')) === 'Interview-ready at 61: 61 or more in 8 of your last 10 games', await b.text('.sb-ready'));

check('no errors in the page', b.errors.length === 0, b.errors);
b.close();
done();
