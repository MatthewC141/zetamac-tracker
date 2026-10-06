// Duels: the public queue, private codes, challenges, the match clock and winner, ranked ratings
// and seasons, rematches, ghosts and the chat after a match.
import { fresh, check, done } from './lib.mjs';
import { arithLog } from '../shared/games.mjs';

const t = await fresh();
const { db, as, rpc, err, save } = t;
const [A, B, C, D, E] = [await t.user('alex'), await t.user('bea'), await t.user('cal'), await t.user('dee'), await t.user('eve')];
const back = (id, ms) => db.query(`update matches set starts_at = clock_timestamp() - ($2 || ' milliseconds')::interval where id = $1`, [id, String(ms)]);
const rating = async uid => (await db.query('select elo, games, wins, losses, peak from ratings where user_id = $1', [uid])).rows[0];
async function ranked(win, lose) {  // a ranked race to the end: `win` finishes, the other reaches 10
  const m = await rpc(win, 'mm_queue', { p_game: 'standard', p_ranked: true });
  await rpc(lose, 'mm_queue', { p_game: 'standard', p_ranked: true });
  await back(m.id, 40000);
  await rpc(lose, 'mm_score', { p_id: m.id, p_score: 10, p_ms: 20000, p_done: false });
  await rpc(win, 'mm_score', { p_id: m.id, p_score: 25, p_ms: 30000, p_done: true });
  await back(m.id, 40000);
  return rpc(win, 'mm_poll', { p_id: m.id });
}

// ---- the public queue ----
const q1 = await rpc(A, 'mm_queue', { p_game: 'standard' });
check('the first searcher waits', q1.status === 'waiting' && q1.is_public && q1.rule === 'race' && q1.goal === 25 && q1.server_now);
const q2 = await rpc(B, 'mm_queue', { p_game: 'standard' });
check('the second is paired: same match, live, a start a few seconds out', q2.id === q1.id && q2.status === 'live' && q2.p2_name === 'bea' && !!q2.starts_at);
check('both read the match; nobody else can', !!(await rpc(A, 'mm_poll', { p_id: q1.id })) && /not found/.test(await err(() => rpc(C, 'mm_poll', { p_id: q1.id }))));
check('signed out: no duels', !!(await err(() => rpc(null, 'mm_queue', { p_game: 'standard' }))));

// ---- the clock ----
check('no score before the start', (await rpc(A, 'mm_score', { p_id: q1.id, p_score: 1, p_ms: 500, p_done: false })).p1_score === 0);
await back(q1.id, 10000);
check('a score that fits the clock is kept', (await rpc(A, 'mm_score', { p_id: q1.id, p_score: 5, p_ms: 9000, p_done: false })).p1_score === 5);
check('scores never go down', /doesn't fit/.test(await err(() => rpc(A, 'mm_score', { p_id: q1.id, p_score: 4, p_ms: 9500, p_done: false }))));
check('nothing faster than 150 ms an answer', /doesn't fit/.test(await err(() => rpc(A, 'mm_score', { p_id: q1.id, p_score: 30, p_ms: 9800, p_done: false }))));
check('never ahead of the database clock', /doesn't fit/.test(await err(() => rpc(A, 'mm_score', { p_id: q1.id, p_score: 8, p_ms: 30000, p_done: false }))));
check('a race is done only at its goal', /doesn't fit/.test(await err(() => rpc(A, 'mm_score', { p_id: q1.id, p_score: 6, p_ms: 9900, p_done: true }))));
await back(q1.id, 40000);
await rpc(B, 'mm_score', { p_id: q1.id, p_score: 12, p_ms: 30000, p_done: false });
await rpc(A, 'mm_score', { p_id: q1.id, p_score: 25, p_ms: 35000, p_done: true });
await back(q1.id, 45000);
const w = await rpc(B, 'mm_poll', { p_id: q1.id });
check('the first to the goal wins once the other had time to answer', w.status === 'done' && w.winner === 1, w);

// ---- private codes ----
const pc = await rpc(C, 'mm_create', { p_game: 'sq99h', p_rule: 'clock' });
check('a private match has a six-character code', /^[A-Z2-9]{6}$/.test(pc.code) && !pc.is_public && pc.rule === 'clock' && pc.goal === 0);
check("you can't join your own code", /your own code/.test(await err(() => rpc(C, 'mm_join', { p_code: pc.code }))));
check('codes are read in any case', (await rpc(D, 'mm_join', { p_code: pc.code.toLowerCase() })).status === 'live');
check('a started match takes no one else', /already started/.test(await err(() => rpc(E, 'mm_join', { p_code: pc.code }))));
check('no such code', /No match has that code/.test(await err(() => rpc(E, 'mm_join', { p_code: 'ZZZZZZ' }))));
const left = await rpc(E, 'mm_create', { p_game: 'standard', p_rule: 'race' });
await db.query(`update matches set seen_at = now() - interval '10 seconds' where id = $1`, [left.id]);
check('a code its maker left closes', /already started or closed/.test(await err(() => rpc(A, 'mm_join', { p_code: left.code }))));
await rpc(E, 'mm_cancel', { p_id: left.id });

// ---- challenges by name ----
const ch = await rpc(A, 'mm_challenge', { p_name: 'BEA', p_game: 'sq99h', p_rule: 'clock' });
check('challenge a player by name, any capitals', ch.status === 'waiting' && ch.invitee === B && ch.p2_name === 'bea');
check('no such player', /No player has that name/.test(await err(() => rpc(A, 'mm_challenge', { p_name: 'nobody_here', p_game: 'standard', p_rule: 'race' }))));
check("you can't challenge yourself", /your own name/.test(await err(() => rpc(A, 'mm_challenge', { p_name: 'alex', p_game: 'standard', p_rule: 'race' }))));
const inv = await rpc(B, 'mm_invites');
check('the challenged player sees it; nobody else does', inv.length === 1 && inv[0].from === 'alex' && inv[0].code === ch.code && (await rpc(C, 'mm_invites')).length === 0);
check('nobody else can take it with the code', /another player/.test(await err(() => rpc(C, 'mm_join', { p_code: ch.code }))));
check('accepting starts it and clears the invite', (await rpc(B, 'mm_join', { p_code: ch.code })).status === 'live' && (await rpc(B, 'mm_invites')).length === 0);
const ch2 = await rpc(C, 'mm_challenge', { p_name: 'dee', p_game: 'standard', p_rule: 'race' });
await rpc(E, 'mm_decline', { p_id: ch2.id });
check("someone else can't decline it", (await db.query('select status from matches where id = $1', [ch2.id])).rows[0].status === 'waiting');
await rpc(D, 'mm_decline', { p_id: ch2.id });
check('declining closes it for the challenger', (await rpc(C, 'mm_poll', { p_id: ch2.id })).status === 'cancelled');

// ---- ranked ----
const r = await ranked(C, D);
check('placement win +20, loss −20', r.p1_delta === 20 && r.p2_delta === -20, r);
check('ratings stored', (await rating(C)).elo === 1020 && (await rating(D)).elo === 980);
await rpc(D, 'mm_poll', { p_id: r.id });
check('settling again changes nothing', (await rating(C)).elo === 1020);
check('ratings are private and read-only', (await as(C, 'select count(*)::int n from ratings')).rows[0].n === 1 &&
  (await as(C, `update ratings set elo = 3000`).then(x => x.affectedRows === 0, () => true)) && !!(await err(() => as(null, 'select * from ratings'))));
await ranked(C, D); await ranked(C, D);
const before = (await rating(C)).elo, m4 = await ranked(C, D);
check('the same two players move ratings in 3 ranked matches a day at most', (await rating(C)).elo === before && m4.p1_delta === 0);
await ranked(A, E);
await db.query(`update ratings set games = 5 where user_id in ($1, $2)`, [A, E]);  // placements done (the daily cap stops a pair at 3)
const lad = (await as(null, 'select username from ladder order by elo desc')).rows.map(x => x.username);
check('the ladder shows players after 5 placement matches', lad.join() === 'alex,eve', lad);

// ---- seasons ----
const season = (await db.query('select public.season_now() s')).rows[0].s;
await db.query(`update ratings set season = '2020-Q1', elo = 1300, peak = 1340, wins = 9 where user_id = $1`, [A]);
const me = await rpc(A, 'mm_me');
check('a new season moves the rating halfway back to 1000', me.rating.elo === 1150 && me.rating.wins === 0 && me.rating.season === season);
check('…keeping the old season and its peak', me.seasons.length === 1 && me.seasons[0].season === '2020-Q1' && me.seasons[0].peak === 1340 && me.seasons[0].elo === 1300, me.seasons);

// ---- unranked "any" ----
const a1 = await rpc(A, 'mm_queue', { p_game: 'any' }), a2 = await rpc(B, 'mm_queue', { p_game: 'sq99h' });
check("'any' then a choice: the match uses the choice", a2.id === a1.id && a2.game === 'sq99h');

// ---- rematch ----
const off = await rpc(A, 'mm_rematch', { p_id: q1.id });
check('rematch: a private match with the same problems and rule', off.status === 'waiting' && !off.is_public && off.game === q1.game);
check('the other player accepts it', (await rpc(B, 'mm_rematch', { p_id: q1.id })).id === off.id);
check('no rematch for someone else', !!(await err(() => rpc(C, 'mm_rematch', { p_id: q1.id }))));

// ---- chat ----
check('chat opens when the match is over', /when the match is over/.test(await err(() => rpc(C, 'mm_say', { p_id: pc.id, p_text: 'hi' }))));
const said = await rpc(A, 'mm_say', { p_id: q1.id, p_text: '  gg  ' });
check('players can talk after a match', said.body === 'gg' && said.seat === 1);
check('only the two players read it', (await as(B, `select count(*)::int n from match_messages`)).rows[0].n === 1 && (await as(C, `select count(*)::int n from match_messages`)).rows[0].n === 0);
check('long messages are refused', /under 120/.test(await err(() => rpc(A, 'mm_say', { p_id: q1.id, p_text: 'x'.repeat(121) }))));

// ---- ghosts ----
check('no game of 25 yet: no ghost', (await rpc(D, 'mm_ghost', { p_mine: true })) === null);
await save(A, { score: 30, detail: arithLog('standard', 1, 30, 3000) });
await save(A, { score: 45, detail: arithLog('standard', 2, 45, 2500) });
const g1 = await rpc(A, 'mm_ghost', { p_mine: true });
check('your own ghost is your best game, first 25 answers', g1.mine && g1.score === 45 && g1.log.length === 25 && g1.log[0].t === 2500);
const g2 = await rpc(B, 'mm_ghost', { p_mine: false });
check("another player's ghost is a real saved game", g2 && !g2.mine && g2.name === 'alex');

done();
