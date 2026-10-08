// The summary under the score after an Arithmetic game: which operation cost the most time
// compared with your recent games, and which went best (summary.js, wired up in play.js).
import { browser, check, done, answerMany } from './lib.mjs';

const b = await browser();
await b.go('play.html');

// ---- the wording, from made-up games ----
const q = (o, t, text = '2 + 2') => ({ q: text, a: 4, o, c: 0, t });
const lines = (log, past) => b.ev(`zmSummary.lines(${JSON.stringify(log)}, ${JSON.stringify(past)})`);
const past = [[...Array(5)].map(() => q('div', 2300)).concat([...Array(5)].map(() => q('add', 1400)))];
check('with nothing to compare, it names the slowest question',
  JSON.stringify(await lines([q('add', 1200), q('div', 6240, '91 ÷ 7')], [])) === JSON.stringify(['Slowest question: 91 ÷ 7, 6.2 s.']));
const both = await lines([q('div', 3100), q('div', 3100), q('div', 3100), q('add', 1200), q('add', 1200)], past);
check('it names the operation that cost the most and the one that went best', JSON.stringify(both) === JSON.stringify([
  'Division cost you most: 3.1 s a question, 0.8 s slower than your last game (about 2 s lost).',
  'Best today: addition, 1.2 s a question, 0.2 s quicker than usual.']), both);
const fine = await lines([q('div', 2000), q('div', 2000), q('add', 1400), q('add', 1400)], [past[0], past[0]]);
check('when nothing was slower it says so', JSON.stringify(fine) === JSON.stringify(['Nothing was slower than your last 2 games.', 'Best today: division, 2.0 s a question, 0.3 s quicker than usual.']), fine);
check('an operation answered only once today isn’t judged',
  JSON.stringify(await lines([q('div', 9000), q('add', 1400), q('add', 1400)], past)) === JSON.stringify(['Nothing was slower than your last game.']));
check('an empty game says nothing', (await lines([], past)).length === 0);

// ---- after real games ----
const play = async n => {
  await b.click('#start'); await b.until('running');
  await answerMany(b, n, 60);
  await b.ev('finish()');
  await b.until(`/Saved|personal best/.test(document.querySelector('#saved').textContent)`);
};
await play(40);
check('the first game names its slowest question', /^Slowest question: \d+ [+–×÷] \d+, \d+\.\d s\.$/.test(await b.text('#summary')), await b.text('#summary'));
await b.click('#again'); await b.until('running');
await answerMany(b, 40, 60);
await b.ev('finish()');
await b.until(`document.querySelector('#summary').textContent`);
check('the next game compares with the last one', /than your last game/.test(await b.text('#summary')), await b.text('#summary'));
await b.go('play.html', 1200);  // a fresh page reads earlier games' logs back from the tracker
await play(20);
check('a new visit compares with the games saved before', /than your last 2 games/.test(await b.text('#summary')), await b.text('#summary'));

// ---- custom settings ----
await b.go('play.html');
await b.ev(`document.querySelector('#add-a-hi').value = 50; document.querySelector('#add-a-hi').dispatchEvent(new Event('input'))`);
await play(5).catch(() => {});
check('custom settings show no summary', (await b.text('#summary')) === '', await b.text('#summary'));

check('no errors in the page', b.errors.length === 0, b.errors);
b.close();
done();
