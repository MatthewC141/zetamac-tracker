// The public boards: all time and this week, the squares cutoff, and ties.
import { fresh, check, done } from './lib.mjs';
import { arithLog } from '../shared/games.mjs';

const t = await fresh();
const { as, save } = t;
const [A, B, C] = [await t.user('alex'), await t.user('bea'), await t.user('cal')];
const g = (seed, n, extra = {}) => ({ score: n, detail: arithLog(extra.mode || 'standard', seed, n, 1800), ...extra });

await save(C, g(1, 60, { date: '2026-01-05' }));
await save(C, g(2, 50));
await save(A, g(3, 45));
await save(B, g(4, 45));
const all = (await as(null, `select username, score from leaderboard where mode = 'standard' and seconds = 120 order by score desc, username`)).rows;
const wk = (await as(null, `select username, score from leaderboard_week where mode = 'standard' and seconds = 120 order by score desc, username`)).rows;
check('all time: each player’s best', JSON.stringify(all) === JSON.stringify([{ username: 'cal', score: 60 }, { username: 'alex', score: 45 }, { username: 'bea', score: 45 }]), all);
check('this week: only games since Monday', wk[0].username === 'cal' && wk[0].score === 50 && wk.length === 3, wk);

await save(A, g(5, 30, { mode: 'sq99h', date: '2026-09-20' }));
await save(B, g(6, 20, { mode: 'sq99h' }));
const sq = (await as(null, `select username from leaderboard where mode = 'sq99h'`)).rows.map(r => r.username);
check('squares boards start on 1 October 2026', sq.join() === 'bea', sq);

await save(A, g(7, 40, { seconds: 0, elapsed: 80 }));
await save(B, g(8, 40, { seconds: 0, elapsed: 70 }));
const en = (await as(null, `select username, elapsed from leaderboard where mode = 'standard' and seconds = 0`)).rows;
check('endless runs keep their length for the tie-break', en.length === 2 && en.every(r => r.elapsed > 0), en);

// ---- the board functions the pages use ----
const { rpc, db } = t;  // (as and save come from above)
const more = [];
for (let i = 0; i < 6; i++) more.push(await t.user('p' + i + 'xx'));
for (const [i, u] of more.entries()) await save(u, g(20 + i, 10 + 5 * i));  // 10, 15 … 35
const bd = await rpc(null, 'board', { p_mode: 'standard', p_seconds: 120, p_name: 'bea', p_limit: 3 });
check('a board comes with its total and first rows, best first', bd.total === 9 && bd.rows.map(r => r.username).join() === 'cal,alex,bea', bd);
check('players level on a board share a place', bd.rows[1].place === 2 && bd.rows[2].place === 2 && bd.rows[2].pos === 3);
const far = await rpc(null, 'board', { p_mode: 'standard', p_seconds: 120, p_name: 'p1xx', p_limit: 3 });
check('…and a player further down gets the rows around them', far.around.map(r => r.username).join() === 'p3xx,p2xx,p1xx,p0xx', far.around);
check('the board shows names and figures only', Object.keys(bd.rows[0]).sort().join() === 'date,elapsed,place,pos,score,username,wrongs', Object.keys(bd.rows[0]));
const every = await rpc(null, 'boards', { p_name: 'p3xx' });
const arith = every.find(x => x.mode === 'standard' && x.seconds === 120);
check('every board at a glance: total, leader, your place and who is next ahead', arith.total === 9 && arith.leader.username === 'cal' && arith.me.place === 6 && arith.me.ahead.username === 'p4xx', arith);
check('…on every board with players', every.length === 3 && every.some(x => x.mode === 'sq99h') && every.some(x => x.seconds === 0));
const week = (await rpc(null, 'boards', { p_week: true })).find(x => x.mode === 'standard' && x.seconds === 120);
check('the week version leaves out older games', week.leader.score === 50);
const st = await rpc(null, 'standing', { p_mode: 'standard', p_seconds: 120, p_score: 40, p_name: 'p0xx' });
check('standing: how many others a score beats', st.beats === 5 && st.of === 8, st);
check('standing: nothing with fewer than 5 others', (await rpc(null, 'standing', { p_mode: 'sq99h', p_seconds: 120, p_score: 40 })) === null);
const pr = await rpc(null, 'profile', { p_name: 'alex' });
check('a profile carries each best’s standing', pr.bests.find(x => x.mode === 'standard' && x.seconds === 120).standing.of === 8);

// ---- the error log ----
await rpc(null, 'log_error', { p_page: 'play.html', p_message: 'x'.repeat(900), p_detail: 'stack' });
const logged = (await db.query('select page, length(message) n from client_errors')).rows;
check('anyone can report an error, trimmed to size', logged.length === 1 && logged[0].n === 500);
check('nobody can read the reports through the site', !!(await t.err(() => as(null, 'select * from client_errors'))) && !!(await t.err(() => t.as(more[0], 'select * from client_errors'))));
for (let i = 0; i < 70; i++) await rpc(null, 'log_error', { p_page: 'x', p_message: 'flood' });
check('at most 60 reports a minute are kept', (await db.query('select count(*)::int n from client_errors')).rows[0].n === 60);

done();
