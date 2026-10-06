// The leaderboard, profiles and percentiles, on a board filled by players who save real games
// through the API.
import { browser, check, done, sleep, sql, signUp, ENV, localDay } from './lib.mjs';
import { arithLog, testLog, P } from '../shared/games.mjs';

const H = { apikey: 'test-anon-key', 'Content-Type': 'application/json' };
async function player(name, games) {
  const s = await (await fetch(`${ENV.mock}/auth/v1/signup`, { method: 'POST', headers: H,
    body: JSON.stringify({ email: `${name.toLowerCase()}@users.zetamac-tracker.invalid`, password: 'password1234', data: { username: name } }) })).json();
  const day = localDay();
  const rows = games.map((g, i) => ({ ts: `${g.date || day}T0${i % 10}:00:0${i % 10}`, date: g.date || day, source: 'game', elapsed: 0, seconds: 120, mode: 'standard', ...g }));
  const r = await fetch(`${ENV.mock}/rest/v1/scores`, { method: 'POST', headers: { ...H, Authorization: `Bearer ${s.access_token}` }, body: JSON.stringify(rows) });
  return { token: s.access_token, saved: await r.json() };
}
const arith = (seed, n, extra = {}) => ({ score: n, detail: arithLog(extra.mode || 'standard', seed, n, 1200), ...extra });

// eight players on Arithmetic 2:00 (20 to 90), a few on other boards
const names = ['ann', 'ben', 'cyd', 'dot', 'eli', 'fay', 'gus', 'hal'];
for (const [i, n] of names.entries()) await player(n, [arith(i + 1, 20 + 10 * i), ...(i < 3 ? [arith(50 + i, 10 + i, { seconds: 30 })] : [])]);
const f = testLog('frac', 4, (p, i) => (i < 20 ? (i === 5 ? '-1' : P.fmt(p.a)) : undefined));
await player('quinn', [{ mode: 'frac', seconds: 240, elapsed: 200, score: f.score, detail: f.detail }, arith(60, 45, { date: '2026-01-05' })]);
check('the seeded games count', (await sql(`select count(*)::int n from scores where verified`))[0].n === 13);

const b = await browser();
await b.go('');
await b.ev(`localStorage.setItem('zm-welcome-seen', '1')`);

// ---- the leaderboard, signed out ----
await b.go('leaderboard.html', 1500);
check('the leader of each board is listed', /Leader hal · 90/.test(await b.text('#boards')), await b.text('#boards'));
const tower = await b.ev(`[...document.querySelectorAll('#tower li')].map(li => li.querySelector('.who')?.innerText.trim())`);
check('the chosen board lists everyone, best first', tower.length === 9 && tower[0] === 'hal' && tower.at(-1) === 'ann', tower);
await b.ev(`document.querySelector('#boards [data-key="frac|240"]').click()`);
await sleep(400);
check('a test board shows wrong answers', /1 wrong/.test(await b.text('#tower')), await b.text('#tower'));
check('choosing a board puts it in the link', /board=frac%7C240|board=frac\|240/.test(await b.ev('location.hash')));
await b.go('leaderboard.html#board=standard%7C30&when=week', 1500);
check('a shared link opens that board and week', /0:30/.test(await b.text('#b-title')) && /this week/.test(await b.text('#b-title')), await b.text('#b-title'));
await b.go('leaderboard.html#board=standard%7C120', 1500);
await b.click('#when [data-when="week"]'); await sleep(800);
check('this week leaves out older games', !(await b.text('#tower')).includes('quinn'));
await b.click('#when [data-when="all"]'); await sleep(800);
check('all time puts them back', (await b.text('#tower')).includes('quinn'));
await b.shot('boards-leaderboard');

// ---- profiles ----
await b.ev(`document.querySelector('#tower a[href*="profile"]').click()`);
await b.until(`location.pathname.endsWith('profile.html')`);
await sleep(1200);
check('a name opens their profile', (await b.text('#p-name')) === 'hal');
check('the profile lists bests with a percentile', /Better than 100% of 8 players|Higher than all 8 other players/.test(await b.text('#bests')), await b.text('#bests'));
await b.go('profile.html#zzz_nobody', 1200);
check('no such player', /No player called zzz_nobody/.test(await b.text('#state')));

// ---- the dashboard's percentile ----
const me = 'pat' + Math.random().toString(36).slice(2, 6);
await b.go('account.html', 600);
await signUp(b, me);
await player('xtra', [arith(99, 70)]);
await b.ev(`fetch('api/game', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Zetamac': '1' }, body: new URLSearchParams({ score: 65, seconds: 120, mode: 'standard', elapsed: 0, detail: ${JSON.stringify(JSON.stringify(arithLog('standard', 77, 65, 1700)))} }) })`);
await b.go('', 1800);
check('the dashboard says where your best stands', /Your best of 65 · Better than 60% of 10 players/.test(await b.text('#score .sb-pct')), await b.text('#score .sb-pct'));

// ---- the daily board ----
await sql(`insert into daily_starts (user_id, day) select id, $1::date from profiles where username in ('ann', 'ben')`, [localDay()]);
await b.go('leaderboard.html#daily', 1500);
check('the daily board starts on today', /Today/.test(await b.text('#b-title')) && await b.ev(`document.querySelector('#day-next').disabled`));
await b.click('#day-step [data-day="-1"]'); await sleep(800);
check('stepping back shows an earlier day', !/Today/.test(await b.text('#b-title')) && /day=/.test(await b.ev('location.hash')));

// ---- a long board: the top 100, then you and your neighbours ----
for (let i = 0; i < 110; i++) {
  const n = 66 + (i % 30), name = `bulk${String(i).padStart(3, '0')}`;
  await sql(`with u as (insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id)
    insert into scores (user_id, ts, date, score, seconds, source, mode, elapsed, detail) select id, $3, $4, $5, 120, 'game', 'standard', 0, $6 from u`,
    [`${name}@users.zetamac-tracker.invalid`, JSON.stringify({ username: name }), `${localDay()}T01:02:03`, localDay(), n, JSON.stringify(arithLog('standard', 900 + i, n, 1000))]);
}
await b.go('leaderboard.html#board=standard%7C120', 2000);
const lines = await b.ev(`[...document.querySelectorAll('#tower li')].map(li => li.className.includes('skip-row') ? 'skip:' + li.textContent : li.className.includes('me') ? 'me' : 'row')`);
check('a long board shows the first 100, then you with the players either side', lines.slice(0, 100).every(l => l === 'row') && /^skip:\d+ more$/.test(lines[100]) && lines.length === 106 && lines[103] === 'me', lines.slice(98));
check('…and your place in the list on the left', /P1\d\d/.test(await b.text('#boards')), await b.text('#boards'));

check('no page errors', b.errors.length === 0, b.errors);
b.close();
done();
