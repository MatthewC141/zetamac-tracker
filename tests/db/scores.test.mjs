// Accounts, saving games, what counts for the leaderboard, private accounts and deleting an account.
import { fresh, check, done } from './lib.mjs';
import { arithLog } from '../shared/games.mjs';

const t = await fresh();
const { db, as, rpc, err, save, utc } = t;

// ---- accounts ----
const A = await t.user('alex'), B = await t.user('Bea_2');
check('sign-up makes a profile with the name as typed', (await db.query('select username from profiles where id = $1', [B])).rows[0].username === 'Bea_2');
check('names must be 3 to 20 letters, digits or underscores', /3 to 20/.test(await err(() => t.user('a b'))));
check('a name is taken whatever its capitals', !!(await err(() => t.user('ALEX'))));
check('the sign-in address must be the one the site makes from the name', /through the site/.test(await err(() =>
  db.query(`insert into auth.users (email, raw_user_meta_data) values ('real@example.com', '{"username":"realname"}')`))));
check("names can't be changed", /can.t be changed/.test(await err(() => db.query(`update auth.users set email = 'x@users.zetamac-tracker.invalid' where id = $1`, [A]))));
check('a player reads only their own profile', (await as(A, 'select username from profiles')).rows.map(r => r.username).join() === 'alex');
check('signed out: no profiles at all', !!(await err(() => as(null, 'select * from profiles'))));

// ---- saving ----
const good = await save(A, { score: 30, detail: arithLog('standard', 1, 30) });
check('a real 2-minute game counts', good.verified === true);
check('a hand-logged score never counts', (await save(A, { score: 60, source: 'manual' })).verified === false);
check('a game without its question log never counts', (await save(A, { score: 40 })).verified === false);
check('a score that does not match the log never counts', (await save(A, { score: 31, detail: arithLog('standard', 2, 30) })).verified === false);
check('answers faster than 150 ms never count', (await save(A, { score: 20, detail: arithLog('standard', 3, 20, 100) })).verified === false);
check('more time than the game had never counts', (await save(A, { score: 90, detail: arithLog('standard', 4, 90, 1500) })).verified === false);
check('a 30-second game counts within 30 s', (await save(A, { score: 15, seconds: 30, detail: arithLog('standard', 5, 15, 1800) })).verified === true);
check('an endless run counts within its own length', (await save(A, { score: 40, seconds: 0, elapsed: 70, detail: arithLog('standard', 6, 40, 1600) })).verified === true);
check('an endless run longer than it lasted never counts', (await save(A, { score: 40, seconds: 0, elapsed: 30, detail: arithLog('standard', 7, 40, 1600) })).verified === false);
check('a game of 0 never counts', (await save(A, { score: 0, detail: [] })).verified === false);
check('squares and combined games count too', (await save(A, { score: 20, mode: 'sq99h', detail: arithLog('sq99h', 8, 20, 3000) })).verified === true &&
  (await save(A, { score: 20, mode: 'mixed', detail: arithLog('mixed', 9, 20, 3000) })).verified === true);
check('a weak-spot drill saves', !!(await save(A, { score: 12, mode: 'drill', detail: arithLog('standard', 10, 12) })));

const refused = async (name, row) => check(name, !!(await err(() => save(A, row))));
await refused('a timed game over 500 is refused', { score: 501, detail: null });
await refused('unknown game modes are refused', { score: 10, mode: 'chess' });
await refused('unknown lengths are refused', { score: 10, seconds: 45 });
await refused('a date that does not match the timestamp is refused', { score: 10, date: '2026-01-01', ts: '2026-01-02T10:00:00' });
await refused('a log with more than 5,000 answers is refused', { score: 6000, seconds: 0, elapsed: 9000, detail: Array.from({ length: 5001 }, () => ({ q: '2 + 2', a: 4, t: 900 })) });
await refused('a log with oversized entries is refused', { score: 2, detail: [{ q: 'x'.repeat(5000), a: 1, t: 900 }, { q: '2 + 2', a: 4, t: 900 }] });
check('the same game saved twice is refused the second time', !!(await err(() => as(A, `insert into scores (ts, date, score, seconds, source, mode) select ts, date, score, seconds, source, mode from scores where id = $1`, [good.id]))));

// ---- what a player can touch ----
check("a player can't set verified themselves", !!(await err(() => as(A, `insert into scores (ts, date, score, seconds, source, mode, verified) values ('${utc}T23:00:00', '${utc}', 99, 120, 'game', 'standard', true)`))));
check("a player can't save as someone else", !!(await err(() => as(A, `insert into scores (user_id, ts, date, score, seconds, source, mode) values ('${B}', '${utc}T23:00:01', '${utc}', 9, 120, 'game', 'standard')`))));
check("scores can't be edited", !!(await err(() => as(A, 'update scores set score = 99'))));
check("players see only their own scores", (await as(B, 'select count(*)::int n from scores')).rows[0].n === 0);
check('signed out: no scores', !!(await err(() => as(null, 'select * from scores'))));
await as(B, 'delete from scores');
check("a player can't delete someone else's scores", (await db.query('select count(*)::int n from scores where user_id = $1', [A])).rows[0].n > 0);

// ---- the leaderboard view ----
const lb = (await as(null, `select username, score from leaderboard where mode = 'standard' and seconds = 120`)).rows;
check('the board holds each player’s best counted game', JSON.stringify(lb) === JSON.stringify([{ username: 'alex', score: 30 }]), lb);
check('the board shows names, figures and where each game was played', Object.keys((await as(null, 'select * from leaderboard limit 1')).rows[0]).join() === 'username,mode,seconds,score,elapsed,date,wrongs,source');
check('drills stay off the board', (await as(null, `select count(*)::int n from leaderboard where mode = 'drill'`)).rows[0].n === 0);

// ---- private accounts ----
check('set_private hides every score', (await rpc(A, 'set_private', { p_private: true })) === true &&
  (await as(null, `select count(*)::int n from leaderboard`)).rows[0].n === 0);
check('…and switching it off brings them back', (await rpc(A, 'set_private', { p_private: false })) === false &&
  (await as(null, `select count(*)::int n from leaderboard`)).rows[0].n > 0);
check('signed out: set_private refused', !!(await err(() => rpc(null, 'set_private', { p_private: true }))));

// ---- limits ----
await db.query(`insert into scores (user_id, ts, date, score, seconds, source, mode, created_at)
  select $1, to_char(timestamp '2026-01-01' + n * interval '1 second', 'YYYY-MM-DD"T"HH24:MI:SS'), '2026-01-01', 1, 120, 'manual', 'standard', now() from generate_series(1, 1000) n`, [B]);
check('1,000 saves an hour is the most', /Too many saves/.test(await err(() => save(B, { score: 5 }))));

// ---- deleting an account ----
await rpc(B, 'delete_me');
check('delete_me removes the login, profile and every score', (await db.query('select count(*)::int n from auth.users where id = $1', [B])).rows[0].n === 0 &&
  (await db.query('select count(*)::int n from scores where user_id = $1', [B])).rows[0].n === 0);

done();
