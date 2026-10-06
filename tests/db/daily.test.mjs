// The daily challenge: the day's seed from the database, one try, a 4-minute window, its board.
import { fresh, check, done } from './lib.mjs';
import { arithLog } from '../shared/games.mjs';

const t = await fresh();
const { db, as, rpc, err, save, utc } = t;
const [A, B, C, D, P] = [await t.user('alex'), await t.user('bea'), await t.user('cal'), await t.user('dora'), await t.user('pria')];
await rpc(P, 'set_private', { p_private: true });
const tomorrow = (await db.query(`select ((now() at time zone 'utc')::date + 1)::text d`)).rows[0].d;
const later = (await db.query(`select ((now() at time zone 'utc')::date + 2)::text d`)).rows[0].d;

// Today's questions, as the page builds them from the seed the database hands out.
const daily = (seed, n, t = 1500) => arithLog('daily', seed, n, t);

check('a daily with no start never counts', (await save(C, { mode: 'daily', score: 30, detail: daily(1, 30) })).verified === false);
const a = await rpc(A, 'daily_start', { p_date: utc }), b = await rpc(B, 'daily_start', { p_date: utc });
check('everyone gets the same seed for a day', Number.isInteger(a.seed) && a.seed === b.seed && a.tries === 1);
check('another day has another seed', (await rpc(A, 'daily_start', { p_date: tomorrow })).seed !== a.seed);
check('a day further ahead is refused', /isn’t open/.test(await err(() => rpc(A, 'daily_start', { p_date: later }))));
check('signed out: no seed', !!(await err(() => rpc(null, 'daily_start', { p_date: utc }))));
check("players can't read the secret or the starts", !!(await err(() => as(A, 'select * from daily_salt'))) && !!(await err(() => as(A, 'select * from daily_starts'))));

check('a first try saved in time counts', (await save(A, { mode: 'daily', score: 40, detail: daily(a.seed, 40) })).verified === true);
check('a second daily the same day is dropped quietly', (await save(A, { mode: 'daily', score: 70, detail: daily(a.seed, 70, 1200) })) === undefined);
check('…so there is one a day in the table', (await db.query(`select count(*)::int n from scores where user_id = $1 and mode = 'daily'`, [A])).rows[0].n === 1);
check('the daily challenge is always 2:00', !!(await err(() => save(B, { mode: 'daily', seconds: 30, score: 10 }))));

const d1 = await rpc(D, 'daily_start', { p_date: utc }), d2 = await rpc(D, 'daily_start', { p_date: utc });
check('starting again keeps the first start and counts the try', d2.started === d1.started && d2.tries === 2 && d2.seed === d1.seed);
check('a second try never counts, even straight away', (await save(D, { mode: 'daily', score: 50, detail: daily(d1.seed, 50) })).verified === false);

const c = await rpc(C, 'daily_start', { p_date: tomorrow });
await db.query(`update daily_starts set started_at = now() - interval '6 minutes' where user_id = $1 and day = $2`, [C, tomorrow]);
check('a result saved long after the start never counts', (await save(C, { mode: 'daily', date: tomorrow, score: 30, detail: daily(c.seed, 30) })).verified === false);
check("an old day's challenge never counts", (await save(B, { mode: 'daily', date: '2026-01-02', score: 30, detail: daily(a.seed, 30) })).verified === false);

await save(B, { mode: 'daily', score: 55, detail: daily(b.seed, 55, 1800) });
await rpc(P, 'daily_start', { p_date: utc });
await save(P, { mode: 'daily', score: 60, detail: daily(a.seed, 60, 1800) });
const board = (await as(null, `select username, score from daily_board where date = $1 order by score desc`, [utc])).rows;
check("today's board: each player's one result, no private accounts", JSON.stringify(board) === JSON.stringify([{ username: 'bea', score: 55 }, { username: 'alex', score: 40 }]), board);
check('dailies stay off the all-time board', (await as(null, `select count(*)::int n from leaderboard where mode = 'daily'`)).rows[0].n === 0);

done();
