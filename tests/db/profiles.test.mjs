// Public profiles: bests on each board, rating, past seasons and games a day.
import { fresh, check, done } from './lib.mjs';
import { arithLog, testLog, P } from '../shared/games.mjs';

const t = await fresh();
const { db, rpc, save, utc } = t;
const [A, B] = [await t.user('alex'), await t.user('pria')];
await save(A, { score: 45, detail: arithLog('standard', 1, 45, 2500) });
const f = testLog('frac', 3, (p, i) => (i < 30 ? (i % 10 === 1 ? '-1' : P.fmt(p.a)) : undefined));
await save(A, { mode: 'frac', seconds: 240, score: f.score, elapsed: 200, detail: f.detail });
await save(A, { score: 20, source: 'manual' });
await rpc(B, 'set_private', { p_private: true });

const pr = await rpc(null, 'profile', { p_name: 'ALEX' });
check('anyone can open a profile, any capitals', pr.username === 'alex');
check('bests come from the board, with wrong answers on tests', pr.bests.some(b => b.mode === 'standard' && b.score === 45) && pr.bests.some(b => b.mode === 'frac' && b.wrongs === 3), pr.bests);
check('games a day include hand-logged ones', pr.days[utc] === 3, pr.days);
check('no rating before placements', pr.rating === null);
check('profiles carry no account ids', !JSON.stringify(pr).includes(A));
check('private accounts have no profile', (await rpc(null, 'profile', { p_name: 'pria' })) === null);
check('no such player: no profile', (await rpc(null, 'profile', { p_name: 'zzz_nobody' })) === null);
await db.query(`insert into season_peaks (user_id, season, peak, elo) values ($1, '2026-Q3', 1240, 1200)`, [A]);
check('past seasons show their peak', (await rpc(null, 'profile', { p_name: 'alex' })).seasons[0].peak === 1240);

done();
