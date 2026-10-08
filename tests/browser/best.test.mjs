// "When you play best" on the progress page (dash-best.js): off until switched on, remembered,
// and its averages by time of day and by game of the sitting.
import { browser, check, done } from './lib.mjs';

const b = await browser();
await b.go('');
await b.ev(`localStorage.setItem('zm-welcome-seen', '1')`);
await b.go('', 1200);
check('it starts switched off, saying what it would show', !(await b.ev(`document.querySelector('#best-on').checked`)) &&
  await b.shown('#best-off') && !(await b.shown('#best')));

// Four days: a lone 8 am game scoring 40, and an evening sitting of three games, 3 minutes apart,
// scoring 50, 60 and 65. Plus a hand-logged score, which has no real time and is left out.
const pad = n => String(n).padStart(2, '0');
const scores = [];
for (let d = 1; d <= 4; d++) {
  const date = `2026-09-${pad(d)}`;
  const game = (time, score) => scores.push({ ts: `${date}T${time}`, date, score, seconds: 120, source: 'game', mode: 'standard', elapsed: 0 });
  game('08:00:00', 40); game('18:00:00', 50); game('18:03:00', 60); game('18:06:00', 65);
}
scores.push({ ts: '2026-09-05T12:00:00', date: '2026-09-05', score: 99, seconds: 120, source: 'manual', mode: 'standard', elapsed: 0 });
await b.ev(`fetch('api/import', { method: 'POST', body: ${JSON.stringify(JSON.stringify({ app: 'zetamac-tracker', scores }))} }).then(r => r.ok)`);

await b.go('', 1200);
await b.click('#best-on');
check('switching it on shows it', await b.shown('#best') && !(await b.shown('#best-off')));
const text = await b.text('#best');
check('it names the best time of day', /You score best in the evening: 58 on average over 12 games\./.test(text), text);
check('it names the warm-up', /You warm up: your 3rd game of a sitting averages 20 more than your first\./.test(text), text);
check('the best bar of each view stands out', (await b.ev(`[...document.querySelectorAll('.best-bars li.is-best .best-label')].map(e => e.textContent).join()`)) === 'Evening,3rd game');
check('hand-logged scores are left out', /Morning\s*\S*\s*40\s*4 games/.test(text) && !/99/.test(text), text);

await b.go('', 1200);
check('the switch is remembered', await b.ev(`document.querySelector('#best-on').checked`) && await b.shown('#best'));
await b.click('#best-on');
check('switching it off hides it again', !(await b.shown('#best')) && await b.shown('#best-off'));

// ---- the rules, on small made-up lists ----
const best = list => b.ev(`playBest(${JSON.stringify(list)})`);
const g = (ts, score, mode = 'standard', seconds = 120) => ({ ts, score, mode, seconds, source: 'game' });
const warm = await best([g('2026-09-01T09:00:00', 30, 'sq99h'), g('2026-09-01T09:04:00', 50)]);
check('a different game earlier in the sitting makes the next one a 2nd game', warm.byGame[1].n === 1 && warm.byGame[0].n === 0, warm.byGame);
const apart = await best([g('2026-09-01T09:00:00', 50), g('2026-09-01T09:31:00', 50)]);
check('games more than 30 minutes apart are separate sittings', apart.byGame[0].n === 2, apart.byGame);
const night = await best([g('2026-09-01T23:30:00', 50), g('2026-09-02T02:00:00', 50)]);
check('late games count as night, either side of midnight', night.byTime[3].n === 2, night.byTime);
check('30-second games are left out', (await best([g('2026-09-01T09:00:00', 15, 'standard', 30)])).n === 0);

check('no errors in the page', b.errors.length === 0, b.errors);
b.close();
done();
