// Duels between two browsers: the ranked queue, a race to 25, the result and rating, chat, a
// rematch, a challenge by name and a ghost race.
import { browser, check, done, answerMany, sleep, sql, signUp, uniq } from './lib.mjs';
const PLAYING = `document.querySelector('#game').style.display === 'block' && !document.querySelector('#answer').disabled && document.querySelector('#play').style.display !== 'none'`;

const X = await browser(), Y = await browser();
const nx = uniq('xx'), ny = uniq('yy');
for (const [b, n] of [[X, nx], [Y, ny]]) { await b.go('account.html', 500); await b.ev(`localStorage.setItem('zm-welcome-seen', '1')`); await signUp(b, n); await b.go('duel.html', 1200); }
check('signed in, the lobby shows', await X.shown('#st-lobby') && await Y.shown('#st-lobby'));

// ---- ranked: X wins a race to 25 ----
for (const b of [X, Y]) await b.ev(`document.querySelector('input[name=queue][value=ranked]').click()`);
await X.click('#start');
await X.until(`!document.querySelector('#st-queue').hidden`);
check('searching shows the queue', /Ranked/.test(await X.text('#q-sub')));
await Y.click('#start');
await Promise.all([X.until(`!document.querySelector('#st-found').hidden`), Y.until(`!document.querySelector('#st-found').hidden`)]);
check('both are paired and see each other', (await X.text('#f-them')) === ny && (await Y.text('#f-them')) === nx);
await Promise.all([X.until(PLAYING, 14000), Y.until(PLAYING, 14000)]);
check('both get the same first question', (await X.text('#question')) === (await Y.text('#question')));
await answerMany(Y, 5, 250);
await sleep(1500);
check("the opponent's progress shows live", (await X.text('#n-them')) === '5/25', await X.text('#n-them'));
await answerMany(X, 25, 180);
await Promise.all([X.until(`document.querySelector('#end').style.display === 'block'`, 15000), Y.until(`document.querySelector('#end').style.display === 'block'`, 15000)]);
check('the winner sees the win, the loser the loss', (await X.text('#result')) === 'You win' && (await Y.text('#result')) === `${nx} wins`);
check('ranked shows the rating change', /Rating 1000 → 1020/.test(await X.text('#elo-line')) && /Rating 1000 → 980/.test(await Y.text('#elo-line')), [await X.text('#elo-line'), await Y.text('#elo-line')]);

// ---- chat ----
await X.ev(`document.querySelector('#say').value = 'gg wp'; document.querySelector('#say-form').requestSubmit()`);
await Y.until(`/gg wp/.test(document.querySelector('#msgs').textContent)`, 6000);
check('chat reaches the other player', true);

// ---- rematch ----
await Y.click('#rematch');
await X.until(`/wants a rematch/.test(document.querySelector('#rematch-note').textContent)`, 8000);
check('a rematch offer shows to the other player', true);
await X.click('#rematch');
await Promise.all([X.until(`!document.querySelector('#st-found').hidden || document.querySelector('#game').style.display === 'block'`, 8000),
  Y.until(`!document.querySelector('#st-found').hidden || document.querySelector('#game').style.display === 'block'`, 8000)]);
check('accepting starts the rematch for both', true);
await Promise.all([X.until(PLAYING, 14000), Y.until(PLAYING, 14000)]);
await answerMany(Y, 25, 180);
await Promise.all([X.until(`document.querySelector('#end').style.display === 'block'`, 15000), Y.until(`document.querySelector('#end').style.display === 'block'`, 15000)]);
check('the rematch is unranked and decided', (await Y.text('#result')) === 'You win' && !(await X.text('#elo-line')));
for (const b of [X, Y]) await b.click('#lobby');

// ---- a challenge by name ----
await X.ev(`document.querySelector('input[name=queue][value=unranked]').click()`);
await X.ev(`document.querySelector('#rival').value = ${JSON.stringify(ny)}; document.querySelector('#challenge-form').requestSubmit()`);
await X.until(`!document.querySelector('#st-code').hidden`);
check('the challenger waits on the challenge', new RegExp(ny).test(await X.text('#code-sub')));
const sent = Date.now();
await Y.until(`!document.querySelector('#invites').hidden`, 8000);
check('the challenged player sees it in their lobby within moments (a Realtime nudge, not polling)', new RegExp(`${nx} challenged you`).test(await Y.text('#invites')) && Date.now() - sent < 3000, Date.now() - sent);
const pings = await (await fetch(`${process.env.ZM_MOCK}/__broadcasts`)).json();
check('…nudged on their own topic', pings.some(p => p.topic === `invites:${ny}` && p.event === 'ping'), pings);
check('the Duel tab is marked on their other pages too', await Y.ev(`document.querySelector('.zh-nav a[href="duel.html"]').hasAttribute('data-invites')`));
await X.click('[data-cancel]');
await Y.until(`document.querySelector('#invites').hidden`, 3000);
check('taking the challenge back clears it from their lobby at once', true);
await X.ev(`document.querySelector('#rival').value = ${JSON.stringify(ny)}; document.querySelector('#challenge-form').requestSubmit()`);
await X.until(`!document.querySelector('#st-code').hidden`);
await Y.until(`!document.querySelector('#invites').hidden`, 3000);
await Y.ev(`document.querySelector('#invites .acts .d-btn.quiet').click()`);
await X.until(`!document.querySelector('#st-lobby').hidden && /declined/.test(document.querySelector('#msg').textContent)`, 8000);
check('declining tells the challenger', true);

// ---- a ghost race ----
const log = await X.ev(`JSON.stringify(ZM_PROBLEMS.list('standard', 5, 30).map(p => ({ q: p.q, a: p.a, o: p.o, c: 0, t: 1500 })))`);
await X.ev(`fetch('api/game', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Zetamac': '1' }, body: new URLSearchParams({ score: 30, seconds: 120, mode: 'standard', elapsed: 0, detail: ${JSON.stringify(log)} }) })`);
await X.ev(`document.querySelector('[data-ghost="mine"]').click()`);
await X.until(PLAYING, 14000);
check('racing your own best uses its questions', (await X.text('#question')) === JSON.parse(log)[0].q);
await answerMany(X, 25, 160);
await X.until(`document.querySelector('#end').style.display === 'block'`, 8000);
check('beating the ghost wins', (await X.text('#result')) === 'You win');
check('a ghost race saves nothing', (await sql(`select count(*)::int n from scores`))[0].n === 1);

check('no page errors', !X.errors.length && !Y.errors.length, [...X.errors, ...Y.errors]);
X.close(); Y.close();
done();
