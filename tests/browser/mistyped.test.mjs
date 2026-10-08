// Facts you mistype: the kinds of question you most often corrected, listed under weak spots
// (dash-weak.js) and added to the weak-spot drill with the exact questions you corrected
// (practice.js), from the shared rule in problems.js.
import { browser, check, done } from './lib.mjs';

const b = await browser();
await b.go('');
await b.ev(`localStorage.setItem('zm-welcome-seen', '1')`);
await b.go('', 1000);

// ---- the rule ----
const q = (text, o, c, t = 2000) => ({ q: text, a: 0, o, c, t });
const kinds = await b.ev(`ZM_PROBLEMS.correctedKinds(${JSON.stringify([
  q('7 × 12', 'mul', 1), q('7 × 30', 'mul', 3), q('7 × 44', 'mul', 0), q('7 × 5', 'mul', 0),
  q('8 × 20', 'mul', 1), q('8 × 21', 'mul', 0), q('8 × 22', 'mul', 0),
  q('9 × 20', 'mul', 0), q('9 × 21', 'mul', 0), q('9 × 22', 'mul', 0),
  q('6 × 20', 'mul', 2), q('6 × 21', 'mul', 0),
])})`);
check('kinds are ranked by the share of answers corrected', kinds.map(k => k.kind).join() === '× 7,× 8', kinds);
check('an answer counts once however many digits were deleted', kinds[0].fixed === 2 && kinds[0].n === 4 && kinds[0].rate === 0.5, kinds[0]);
check('never-corrected kinds and kinds with under 3 answers are left out', !kinds.some(k => k.kind === '× 9' || k.kind === '× 6'));

// ---- a game: × 7 quick but often corrected; four slower kinds that are never corrected ----
const log = [
  ...[12, 30, 44, 5, 61, 18].map((n, i) => ({ q: `7 × ${n}`, a: 7 * n, o: 'mul', c: i < 3 ? 1 : 0, t: 1000 })),
  ...[20, 21, 22, 23].map(n => ({ q: `8 × ${n}`, a: 8 * n, o: 'mul', c: 0, t: 3000 })),
  ...[8, 9, 10, 11].map(n => ({ q: `${6 * n} ÷ 6`, a: n, o: 'div', c: 0, t: 3200 })),
  ...[[58, 37], [49, 26], [68, 15], [77, 18]].map(([x, y]) => ({ q: `${x} + ${y}`, a: x + y, o: 'add', c: 0, t: 2800 })),
  ...[[52, 17], [63, 28], [41, 19], [70, 35]].map(([x, y]) => ({ q: `${x} – ${y}`, a: x - y, o: 'sub', c: 0, t: 2900 })),
];
const game = { ts: '2026-10-01T10:00:00', date: '2026-10-01', score: log.length, seconds: 120, source: 'game', mode: 'standard', elapsed: 0, detail: log };
await b.ev(`fetch('api/import', { method: 'POST', body: ${JSON.stringify(JSON.stringify({ app: 'zetamac-tracker', scores: [game] }))} }).then(r => r.ok)`);

await b.go('', 1500);
await b.until(`document.querySelector('.corrected')`);
const listed = await b.ev(`[...document.querySelectorAll('.corrected li')].map(li => li.innerText.replace(/\\s+/g, ' ').trim())`);
check('weak spots list the most corrected kind', listed.length === 1 && listed[0] === '× 7 corrected 3 of 6 answers 50% Trick', listed);

await b.go('practice.html', 1500);
await b.until(`/to review/.test(document.querySelector('#drill-detail').textContent)`);
check('the weak-spot drill adds the often-corrected kind after the slowest ones, with the corrected questions to review',
  (await b.text('#drill-detail')) === '÷ 6 · × 8 · – borrow · + carry · × 7, and 3 questions to review', await b.text('#drill-detail'));

check('no errors in the pages', b.errors.length === 0, b.errors);
b.close();
done();
