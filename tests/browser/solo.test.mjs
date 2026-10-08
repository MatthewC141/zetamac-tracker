// Signed out on the website: every game saves in this browser and shows on the dashboard.
import { browser, check, done, answerMany, answerShown, sleep, sql } from './lib.mjs';

const b = await browser();
await b.go('');
await b.ev(`localStorage.setItem('zm-welcome-seen', '1')`);

// ---- a first visit ----
await b.go('');
check('a first visit shows the empty score panel', /No 2-minute arithmetic games yet/.test(await b.text('#score')));
check('the tab and the header say Zetamach', /Zetamach/.test(await b.ev('document.title')) && (await b.text('.zh-mark')) === 'Zetamach');

// ---- arithmetic ----
await b.go('play.html');
await b.click('#start');
await b.until('running');
const q0 = await b.text('#question');
check('a screen reader hears the question in words', (await b.text('#sr-say')) === q0.replace('×', 'times').replace('÷', 'divided by').replace('–', 'minus').replace('+', 'plus'), [q0, await b.text('#sr-say')]);
check('…from a region nobody sees', await b.ev(`(r => r.width <= 1 && r.height <= 1)(document.querySelector('#sr-say').getBoundingClientRect())`));
await answerMany(b, 12);
check('right answers count the moment they are typed', (await b.text('#score')) === '12');
await b.ev('finish()');
await b.until(`/Saved|personal best/.test(document.querySelector('#saved').textContent)`);
check('a 2-minute game saves and links its breakdown', /See breakdown/.test(await b.text('#saved')));
check('the result is read out', (await b.text('#sr-say')) === 'Time. You scored 12.');
check('the game screen stays zetamac white', await b.ev(`getComputedStyle(document.body).backgroundColor`) === 'rgb(255, 255, 255)');
await b.click('#again'); await b.until('running');
await answerMany(b, 15);
await b.ev('finish()');
await b.until(`/personal best/i.test(document.querySelector('#saved').textContent)`);
check('beating it says new personal best', /New personal best! \(was 12\)/.test(await b.text('#saved')));

// a save that fails offers a retry, and the retry saves it once
await b.click('#again'); await b.until('running');
await answerMany(b, 3);
await b.ev(`(() => { const real = window.fetch; let first = true; window.fetch = (u, o) => (String(u).includes('api/game') && first ? (first = false, Promise.reject(new TypeError('offline'))) : real(u, o)); })()`);
const n0 = await b.ev(`fetch('api/scores').then(r => r.json()).then(l => l.length)`);
await b.ev('finish()');
await b.until(`/Retry/.test(document.querySelector('#saved').textContent)`);
check('a save that fails says so and offers a retry', /Couldn’t save/.test(await b.text('#saved')));
await b.ev(`document.querySelector('#saved .retry').click()`);
await b.until(`/Saved|personal best/.test(document.querySelector('#saved').textContent)`);
check('…and the retry saves it, once', await b.ev(`fetch('api/scores').then(r => r.json()).then(l => l.length)`) === n0 + 1);

// ---- the daily challenge, signed out ----
await b.go('play.html');
check('the daily card offers today’s set', /one try/.test(await b.text('#daily-text')));
await b.click('#daily-go');
await b.until('running');
check('the daily is one try (no Try again)', await b.ev(`document.querySelector('#again').hidden`));
await b.key('Escape'); await sleep(200);
check('Esc doesn’t throw away the daily’s one try', await b.ev('running') && await b.shown('#game'));
await answerMany(b, 5);
await b.ev('finish()');
await b.until(`/challenge saved/.test(document.querySelector('#saved').textContent)`);
await b.go('play.html');
check('…then the card shows the result', /Today: 5/.test(await b.text('#daily-text')));
const again = await b.ev(`fetch('api/game', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Zetamac': '1' }, body: 'score=9&seconds=120&mode=daily&elapsed=0&detail=[]' }).then(async r => [r.status, (await r.json()).error])`);
check('a second daily the same day is refused', again[0] === 400 && /already played/.test(again[1]), again);

// ---- squares, combined, practice ----
for (const [page, name] of [['squares.html', 'squares'], ['mixed.html', 'combined'], ['practice.html', 'practice']]) {
  await b.go(page);
  await b.click('#start');
  await b.until('running');
  await answerMany(b, 4);
  await b.ev('finish()');
  await b.until(`/Saved|personal best|record/.test(document.querySelector('#saved').textContent)`);
  check(`${name} saves`, /Saved|personal best|record/.test(await b.text('#saved')), await b.text('#saved'));
}
await b.go('squares.html');
await b.click('#start'); await b.until('running');
const sq = [];
for (let i = 0; i < 40; i++) { sq.push(Number((await b.text('#question')).replace('²', ''))); await answerShown(b); await sleep(20); }
await b.ev('finish()');
check('squares never ask numbers ending in 0 or 5, or 1–20', sq.every(n => n % 5 !== 0 && n > 20), sq);

// ---- Esc quits a timed game, saving nothing ----
await b.go('play.html');
const saved = () => b.ev(`fetch('api/scores').then(r => r.json()).then(l => l.length)`);
const beforeEsc = await saved();
await b.click('#start'); await b.until('running');
await answerMany(b, 2);
await b.key('Escape'); await sleep(400);
check('Esc in a timed game goes back to the start screen', await b.shown('#settings') && !(await b.shown('#game')) && !(await b.ev('running')));
check('…saving nothing', (await saved()) === beforeEsc);
check('…with Start ready for the next go', await b.ev(`document.activeElement === document.querySelector('#start')`));
await b.click('#start'); await b.until('running');
check('a new game starts cleanly after it', (await b.text('#score')) === '0' && (await b.text('#secs')) !== '0');
await answerMany(b, 2);
await b.ev('finish()');
await b.until(`/Saved|personal best/.test(document.querySelector('#saved').textContent)`);
await b.key('Escape'); await sleep(200);
check('Esc on the end screen goes back too', await b.shown('#settings') && (await saved()) === beforeEsc + 1);

// ---- endless ----
await b.go('play.html');
await b.ev(`(s => { s.value = '0'; s.dispatchEvent(new Event('input')); s.dispatchEvent(new Event('change')); })(document.querySelector('#duration'))`);
await b.click('#start'); await b.until('running');
await answerMany(b, 3);
await b.key('Escape');
await b.until(`/endless/i.test(document.querySelector('#saved').textContent)`);
check('an endless run ends with Esc and saves', /endless run/i.test(await b.text('#saved')), await b.text('#saved'));
await b.key('Escape'); await sleep(200);
check('…and a second Esc goes back to the start screen', await b.shown('#settings') && !(await b.shown('#game')));


// ---- a quant test ----
await b.go('optiver.html');
await b.click('#start'); await b.until('running');
const marks = [];
for (let i = 0; i < 6; i++) {
  const right = await b.ev(`(() => { const q = qs[idx]; return q.tol ? String(Number(q.a.toPrecision(3))) : ZM_PROBLEMS.fmt(q.a); })()`);
  await b.ev(`document.querySelector('#answer').focus()`);
  await b.type(i === 3 ? '1' : right);
  await b.key('Enter');
  marks.push(i);
  await sleep(150);
}
await b.key('Tab');
await b.ev('finish()');
await b.until(`/Saved|first/.test(document.querySelector('#saved').textContent)`);
check('a quant test marks right minus wrong', (await b.text('#final')) === '4' && /5 right · 1 wrong · 1 skipped/.test(await b.text('#split')), [await b.text('#final'), await b.text('#split')]);
await b.key('Escape'); await sleep(200);
check('Esc on a quant test’s end screen goes back', await b.shown('#settings') && !(await b.shown('#game')));
const t0 = await b.ev(`fetch('api/scores').then(r => r.json()).then(l => l.length)`);
await b.click('#start'); await b.until('running');
await b.key('Escape'); await sleep(300);
check('Esc mid-test quits back to the start screen, saving nothing', await b.shown('#settings') && !(await b.ev('running')) &&
  (await b.ev(`fetch('api/scores').then(r => r.json()).then(l => l.length)`)) === t0);

// ---- the dashboard ----
await b.go('', 1500);
check('the score panel shows the best this week', /15/.test(await b.text('#score .sb-fig.main')));
const rows = await b.ev(`document.querySelectorAll('#recent > tr:not(.detail-row)').length`);
check('the results list every game', rows >= 9, rows);
await b.ev(`document.querySelector('#recent tr.has-detail').click()`);
await b.until(`document.querySelector('#recent .detail-row .bd-stats')`);
check('a game opens its question-by-question breakdown', !!(await b.ev(`document.querySelector('#recent .detail-row .bd-list tr')`)));
await b.ev(`document.querySelector('#recent .detail-row .bd-replay').click()`);
await b.until(`document.querySelector('#replay').open`);
check('a game can be replayed', !!(await b.text('#rp-q')));
await b.ev(`document.querySelector('#rp-close').click()`);
// what if the slowest question of the last game had never come up
const lastGame = `(async () => {
  const games = await fetch('api/scores').then(r => r.json());
  const last = games.filter(g => (g.mode === 'standard' || g.mode === 'daily') && g.detail).sort((a, b) => (b.ts > a.ts ? 1 : -1))[0];
  const qs = (await fetch('api/detail?ts=' + encodeURIComponent(last.ts)).then(r => r.json())).questions;
  const slowest = Math.max(...qs.map(q => q.t)), rest = qs.filter(q => q.t !== slowest);
  const pace = rest.reduce((t, q) => t + q.t, 0) / rest.length;
  return { seconds: last.seconds, score: last.score, would: Math.round(last.score - 1 + slowest / pace), freed: (slowest / 1000).toFixed(2) };
})()`;
await b.ev(`document.querySelector('[data-window="1"]').click()`);
await b.until(`document.querySelector('#weak .wi-x')`);
let want = await b.ev(lastGame);
check('the last game here is an endless run', want.seconds === 0);
await b.ev(`document.querySelector('#weak .slowq li .wi-x').click()`);
check('an endless run: leaving its slowest question out says how much shorter the run would have been',
  (await b.text('#weak .wi-line')).startsWith(`Without that question: your run would have been ${want.freed} s shorter`), [await b.text('#weak .wi-line'), want]);
// a newer 2-minute game, then the same on it
await b.ev(`fetch('api/game', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Zetamac': '1' },
  body: new URLSearchParams({ score: 30, seconds: 120, mode: 'standard', elapsed: 0, detail: JSON.stringify(ZM_PROBLEMS.list('standard', 3, 30).map((p, i) => ({ q: p.q, a: p.a, o: p.o, c: 0, t: i === 7 ? 9000 : i === 2 ? 6000 : 2500 }))) }) })`);
await b.go('', 1800);
await b.until(`document.querySelector('#weak .wi-x')`);
want = await b.ev(lastGame);
check('the last game is now the 2-minute one, and starts with nothing left out', want.seconds === 120 && /^Press ×/.test(await b.text('#weak .wi-line')));
await b.ev(`document.querySelector('#weak .slowq li .wi-x').click()`);
const line = await b.text('#weak .wi-line');
check('leaving out its slowest question (9 s) shows the score at your pace without it: 30 − 1 + 9 ÷ 2.63 ≈ 32',
  line.startsWith(`Without that question: about ${want.would} instead of 30`) && want.would === 32, [line, want]);
check('…and marks the row', await b.ev(`document.querySelector('#weak .slowq li').classList.contains('out') && document.querySelector('#weak .slowq li .wi-x').getAttribute('aria-pressed') === 'true'`));
await b.ev(`document.querySelectorAll('#weak .slowq li .wi-x')[1].click()`);
check('two left out add up: 30 − 2 + 15 ÷ 2.5 = 34', /^Without these 2 questions: about 34 instead of 30 \(\+4\.0\)/.test(await b.text('#weak .wi-line')), await b.text('#weak .wi-line'));
await b.ev(`document.querySelector('#weak .wi-line').scrollIntoView({ block: 'end' })`);
await b.shot('solo-what-if');
const phone = await browser({ width: 390, height: 844 });
await phone.go(''); await phone.ev(`localStorage.setItem('zm-welcome-seen', '1'); localStorage.setItem('zm-weak', '1')`);
await phone.ev(`localStorage.setItem('zm-web-scores', ${JSON.stringify(await b.ev(`localStorage.getItem('zm-web-scores')`))}); Object.entries(${JSON.stringify(await b.ev(`Object.fromEntries(Object.entries(localStorage).filter(([k]) => k.startsWith('zm-web-detail:')))`))}).forEach(([k, v]) => localStorage.setItem(k, v))`);
await phone.go('', 1800);
await phone.until(`document.querySelector('#weak .wi-x')`);
await phone.ev(`document.querySelector('#weak .slowq li .wi-x').click(); document.querySelector('#weak .wi-line').scrollIntoView({ block: 'end' })`);
check('on a phone the rows and the × fit, with no sideways scroll', await phone.noSideScroll() && await phone.ev(`(r => r.right <= innerWidth)(document.querySelector('#weak .slowq li .wi-x').getBoundingClientRect())`));
await phone.shot('solo-what-if-390');
phone.close();
await b.ev(`document.querySelectorAll('#weak .slowq li .wi-x').forEach(x => x.getAttribute('aria-pressed') === 'true' && x.click())`);
check('putting them back clears it', /^Press ×/.test(await b.text('#weak .wi-line')));
// how many to list, and × all
await b.click('#wi-box [data-slow-count="10"]');
check('the list can show 10', await b.ev(`document.querySelectorAll('#wi-box .slowq li').length`) === 10);
await b.click('#wi-box [data-slow-count="all"]');
check('…or every question of the game', await b.ev(`document.querySelectorAll('#wi-box .slowq li').length`) === 30 && (await b.text('#wi-box [data-slow-count="all"]')) === 'All 30');
await b.click('#wi-box [data-slow-count="5"]');
await b.click('#wi-box .wi-all');
check('× all leaves out every listed question at once', await b.ev(`document.querySelectorAll('#wi-box .slowq li.out').length`) === 5 &&
  /^Without these 5 questions: about \d+ instead of 30/.test(await b.text('#wi-box .wi-line')) && (await b.text('#wi-box .wi-all')) === 'Put all back', await b.text('#wi-box .wi-line'));
await b.click('#wi-box .wi-all');
check('…and Put all back clears them', await b.ev(`document.querySelectorAll('#wi-box .slowq li.out').length`) === 0 && (await b.text('#wi-box .wi-all')) === '× all');

// picking games from Results to look at together
const games = await b.ev(`fetch('api/scores').then(r => r.json())`);
const g30 = games.find(g => g.score === 30 && g.seconds === 120 && g.detail), g12 = games.find(g => g.score === 12 && g.seconds === 120 && g.detail);
check('Pick is hidden until asked for', !(await b.shown('#recent .pick-game')));
await b.click('#pick-toggle');
check('Pick shows a tick box on games Weak spots can show', await b.shown('#recent .pick-game'));
for (const g of [g30, g12]) await b.ev(`document.querySelector('#recent .pick-game[data-ts="${g.ts}"]').click()`);
await b.until(`document.querySelector('[data-window="picked"]').getAttribute('aria-pressed') === 'true' && /these 2 games/.test(document.querySelector('#wi-box h3')?.textContent)`);
check('ticking games switches Weak spots to them', (await b.text('[data-window="picked"]')) === 'Picked · 2' && /from 2 picked games/.test(await b.text('#weak .tower-note')));
check('…each question labelled with its game', await b.ev(`document.querySelectorAll('#wi-box .slowq .wi-when').length`) === 5);
await b.ev(`document.querySelector('#wi-box .slowq li .wi-x').click()`);
check('leaving one out gives the average across the picked games: (30 + 12) / 2 = 21.0 → 22.2',
  /^Without that question: an average of about 22\.2 instead of 21\.0 across 2 timed games \(\+1\.2\)/.test(await b.text('#wi-box .wi-line')), await b.text('#wi-box .wi-line'));
await sleep(800); await b.ev(`document.querySelector('#wi-box').scrollIntoView({ block: 'center' })`); await b.shot('solo-picked');
await b.go('', 1500);
check('picks are remembered', (await b.text('[data-window="picked"]')) === 'Picked · 2');
await b.ev(`document.querySelector('[data-clear-picks]').click()`);
await b.until(`document.querySelector('[data-window="picked"]').hidden`);
check('Clear picks empties them and goes back to the last 10 games', await b.ev(`document.querySelector('[data-window="10"]').getAttribute('aria-pressed')`) === 'true');
await b.ev(`document.querySelector('[data-window="10"]').click()`);
await b.shot('solo-dashboard', true);

// ---- logging a score by hand ----
await b.ev(`(f => { f.querySelector('#f-score').value = '52'; f.requestSubmit(); })(document.querySelector('#add'))`);
await b.until(`/Logged 52/.test(document.querySelector('#f-msg').textContent)`);
check('a score logged by hand is added', /Logged 52/.test(await b.text('#f-msg')));
check('a date in the future is refused', /future/.test(await b.ev(`fetch('api/scores', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Zetamac': '1' }, body: 'score=5&date=2999-01-01' }).then(r => r.json()).then(d => d.error)`)));

// ---- export and import ----
const file = await b.ev(`JSON.stringify(ZM_LOCAL.exportFile())`);
const count = JSON.parse(file).scores.length;
check('export holds every game, with question logs', count >= 10 && JSON.parse(file).scores.some(s => Array.isArray(s.detail)), count);
const imp = await b.ev(`fetch('api/import', { method: 'POST', headers: { 'X-Zetamac': '1' }, body: ${JSON.stringify(file)} }).then(r => r.json())`);
check('importing the same file again adds nothing', imp.added === 0 && imp.skipped === count, imp);

// ---- deleting ----
const before = await b.ev(`fetch('api/scores').then(r => r.json()).then(l => l.length)`);
await b.ev(`document.querySelector('#edit-toggle')?.click()`);
await b.ev(`document.querySelector('#recent .del').click()`);
await b.until(`fetch('api/scores').then(r => r.json()).then(l => l.length === ${before - 1})`);
check('a score can be deleted (after a confirm)', b.dialogs.some(d => /Delete this score/.test(d)));

check('no page errors', b.errors.length === 0, b.errors);

// an error in one of the site's own scripts is reported to the error log, once
await b.go('play.html');
await b.ev(`setTimeout(() => window.zmSave(null, {}, [], null), 0); setTimeout(() => window.zmSave(null, {}, [], null), 50)`);
await sleep(1200);
const logged = await sql(`select page, message, detail from client_errors`);
check('a page error reaches the error log, once, with where it happened', logged.length === 1 && logged[0].page === 'play.html' && /save\.js/.test(logged[0].detail), logged);
b.close();
done();
