// Esc during a game: a timed game is thrown away and it's back to the settings; an endless run
// ends and saves; the daily challenge (one try a day) ignores it; a quant test is thrown away.
import { browser, check, done, answerMany, sleep } from './lib.mjs';

const b = await browser();
const saved = () => b.ev(`fetch('api/scores').then(r => r.json()).then(l => l.length)`);
const settingsShown = () => b.ev(`getComputedStyle(document.querySelector('#settings')).display !== 'none' && getComputedStyle(document.querySelector('#game')).display === 'none'`);

// ---- a timed game ----
await b.go('play.html');
check('the settings say what Esc does', /Esc during a game quits without saving/.test(await b.text('#custom-note')), await b.text('#custom-note'));
await b.click('#start'); await b.until('running');
await answerMany(b, 3);
await b.key('Escape');
check('Esc in a timed game goes back to the settings', await settingsShown());
check('…ready to start again', await b.ev(`document.activeElement === document.querySelector('#start')`));
await sleep(300);
check('…and saves nothing', (await saved()) === 0);
await b.click('#start'); await b.until('running');
check('a new game starts cleanly after quitting', (await b.text('#score')) === '0');
await b.key('Escape');

// ---- an endless run ----
await b.ev(`document.querySelector('#duration').value = '0'; document.querySelector('#duration').dispatchEvent(new Event('input'))`);
await b.click('#start'); await b.until('running');
await answerMany(b, 4);
await b.key('Escape');
await b.until(`/record|Saved/.test(document.querySelector('#saved').textContent)`);
check('Esc in an endless run ends and saves it', (await saved()) === 1);

// ---- the daily challenge ----
await b.go('play.html');
await b.until(`document.querySelector('#daily-acts button')`);
await b.click('#daily-acts button'); await b.until('running');
await b.key('Escape');
check('Esc does nothing in the daily challenge', await b.ev('running') && !(await settingsShown()));

// ---- a quant test ----
await b.go('optiver.html');
await b.click('#start'); await b.until('running');
await b.key('Escape');
check('Esc in a quant test goes back to the settings', await settingsShown() && !(await b.ev('running')));
await sleep(300);
check('…and saves nothing', (await saved()) === 1);

check('no errors in the pages', b.errors.length === 0, b.errors);
b.close();
done();
