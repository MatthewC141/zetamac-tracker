// Accounts: signing up through the page, moving this browser's games in, games saving to the
// account (and counting for the board), the daily challenge's one try, going private, logging out
// and back in, and deleting the account.
import { browser, check, done, answerMany, sleep, sql, uniq } from './lib.mjs';

const b = await browser();
await b.go('');
await b.ev(`localStorage.setItem('zm-welcome-seen', '1')`);

// two games while signed out
await b.go('play.html');
for (let i = 0; i < 2; i++) {
  await b.click(i ? '#again' : '#start'); await b.until('running');
  await answerMany(b, 6 + i);
  await b.ev('finish()');
  await b.until(`/Saved|personal best/.test(document.querySelector('#saved').textContent)`);
}

// ---- signing up ----
const name = uniq('acct');
await b.go('account.html');
check('the form offers to move this browser’s games', /Move this browser’s 2 games/.test(await b.text('#move-text')));
await b.ev(`document.querySelector('#name').value = ${JSON.stringify(name)}; document.querySelector('#name').dispatchEvent(new Event('input'))`);
await b.ev(`document.querySelector('#pass').value = 'short'; document.querySelector('#pass2').value = 'short'; document.querySelector('#form').requestSubmit()`);
check('a short password is refused', /8 characters/.test(await b.text('#msg')));
await b.ev(`document.querySelector('#pass').value = 'password1234'; document.querySelector('#pass2').value = 'password9999'; document.querySelector('#form').requestSubmit()`);
check("passwords that don't match are refused", /don’t match/.test(await b.text('#msg')));
await b.ev(`document.querySelector('#pass2').value = 'password1234'; document.querySelector('#form').requestSubmit()`);
await b.until(`location.pathname.endsWith('/zetamac-tracker/')`, 10000);
await sleep(1200);
check('signing up lands on the dashboard with a welcome', new RegExp(`Welcome, ${name}.*Moved 2 games`).test(await b.text('#flash')), await b.text('#flash'));
check('this browser’s games moved out of it', await b.ev('ZM_LOCAL.count()') === 0);
const rows = await sql(`select score, verified from scores s join profiles p on p.id = s.user_id where p.username = $1 order by score`, [name]);
check('…into the account, counting for the board', rows.length === 2 && rows.every(r => r.verified), rows);
check('the header button shows the name', (await b.text('#acct-btn')) === name);

// ---- playing signed in ----
await b.go('play.html');
await b.click('#start'); await b.until('running');
await answerMany(b, 9);
await b.ev('finish()');
await b.until(`/Saved|personal best/.test(document.querySelector('#saved').textContent)`);
check('a game signed in saves to the account', (await sql(`select count(*)::int n from scores s join profiles p on p.id = s.user_id where p.username = $1`, [name]))[0].n === 3);
for (const page of ['squares.html', 'mixed.html', 'practice.html']) {
  await b.go(page);
  await b.click('#start'); await b.until('running');
  await answerMany(b, 6);
  await b.ev('finish()');
  await b.until(`/Saved|personal best|record/.test(document.querySelector('#saved').textContent)`);
}
const kinds = await sql(`select mode, verified from scores s join profiles p on p.id = s.user_id where p.username = $1 and mode <> 'standard' order by mode`, [name]);
check('squares, combined and practice games pass the database’s answer checks', kinds.length === 3 && kinds.every(k => k.verified), kinds);
for (const test of ['o80', 'est']) {
  await b.go(`optiver.html#${test}`);
  await b.click('#start'); await b.until('running');
  for (let i = 0; i < 6; i++) {
    await sleep(250);
    const right = await b.ev(`(q => q.tol ? String(Number(q.a.toPrecision(3))) : ZM_PROBLEMS.fmt(q.a))(qs[idx])`);
    await b.ev(`document.querySelector('#answer').focus()`);
    await b.type(i === 2 ? '1' : i === 4 ? '' : right);
    await b.key(i === 4 ? 'Tab' : 'Enter');
  }
  await b.ev('finish()');
  await b.until(`/Saved|first|personal best/.test(document.querySelector('#saved').textContent)`);
}
const tests = await sql(`select mode, score, verified from scores s join profiles p on p.id = s.user_id where p.username = $1 and mode in ('o80', 'est') order by mode`, [name]);
check('quant tests (right, wrong and skipped answers) pass the answer checks', tests.length === 2 && tests.every(k => k.verified), tests);

const batch = await b.ev(`fetch('api/scores').then(r => r.json()).then(l => fetch('api/details?ts=' + l.filter(g => g.detail).map(g => encodeURIComponent(g.ts)).join(','))).then(r => r.json())`);
check('signed in, several games’ logs come back in one request', Object.keys(batch.details).length >= 6 && Object.values(batch.details).every(Array.isArray), Object.keys(batch.details).length);

// ---- the daily challenge, signed in ----
await b.go('play.html');
check('signed in, the daily is everyone’s set', /same questions for everyone/.test(await b.text('#daily-text')));
await b.click('#daily-go');
await b.until('running');
const first = await b.text('#question');
await answerMany(b, 5);
await b.ev('finish()');
await b.until(`/challenge saved/.test(document.querySelector('#saved').textContent)`);
const d = await sql(`select score, verified from scores s join profiles p on p.id = s.user_id where p.username = $1 and mode = 'daily'`, [name]);
check('the first try counts for today’s board', d.length === 1 && d[0].verified === true && d[0].score === 5, d);
await b.go('play.html', 1500);
check('…and the card shows the place on today’s board', /Today: 5 · 1st of 1/.test(await b.text('#daily-text')), await b.text('#daily-text'));

// a second browser for the same account: the daily was started, so another try is practice
const c = await browser();
await c.go('account.html');
await c.ev(`localStorage.setItem('zm-welcome-seen', '1')`);
await c.ev(`ZM_CLOUD.logIn(${JSON.stringify(name)}, 'password1234')`);
await sql(`delete from scores where mode = 'daily'`);
await c.go('play.html', 1500);
await c.click('#daily-go');
await c.until(`/started today’s challenge earlier/.test(document.querySelector('#daily-text').textContent)`);
check('starting again warns that it is practice', (await c.text('#daily-go')) === 'Play it as practice');
await c.click('#daily-go'); await c.until('running');
check('…with the same questions', (await c.text('#question')) === first);
await answerMany(c, 7);
await c.ev('finish()');
await c.until(`/challenge saved/.test(document.querySelector('#saved').textContent)`);
const d2 = await sql(`select verified from scores where mode = 'daily'`);
check('…and it stays off the board', d2.length === 1 && d2[0].verified === false, d2);
c.close();

// ---- private ----
await b.go('account.html', 1500);
check('the account page lists where you stand', /Arithmetic/.test(await b.text('#places')), await b.text('#places'));
await b.click('#private');
await b.until(`/private/.test(document.querySelector('#in-msg').textContent)`);
check('going private takes every score off the board', (await sql(`select count(*)::int n from leaderboard where username = $1`, [name]))[0].n === 0);
await b.click('#private');
await b.until(`/back on/.test(document.querySelector('#in-msg').textContent)`);

// ---- out and back in ----
await b.click('#logout'); await sleep(1200);
check('logging out shows the forms again', await b.shown('#out') && !(await b.ev('ZM_CLOUD.user()')));
await b.go('', 1200);
check('signed out, the dashboard is this browser’s (empty again)', /No 2-minute arithmetic games yet/.test(await b.text('#score')));
await b.go('account.html?mode=login', 800);
await b.ev(`document.querySelector('#name').value = ${JSON.stringify(name.toUpperCase())}; document.querySelector('#pass').value = 'password1234'; document.querySelector('#form').requestSubmit()`);
await b.until(`location.pathname.endsWith('/zetamac-tracker/')`, 10000);
check('logging in with other capitals keeps the real name', await b.ev('ZM_CLOUD.user().name') === name);
await sleep(1200);
check('…and the dashboard shows the account’s games', /9/.test(await b.text('#score')));

// ---- deleting ----
await b.go('account.html', 1200);
b.promptText = name;
await b.click('#delete');
await sleep(1500);
check('deleting asks for the name, then removes everything', (await sql(`select count(*)::int n from profiles where username = $1`, [name]))[0].n === 0 && !(await b.ev('ZM_CLOUD.user()')));

check('no page errors', b.errors.length === 0, b.errors);
b.close();
done();
