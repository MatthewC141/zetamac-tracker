// Games recorded on the real zetamac site by the browser extension: saved with source 'zetamac',
// checked like games played here, and shown on the Arithmetic boards with where they came from.
import { fresh, check, done } from './lib.mjs';
import { arithLog } from '../shared/games.mjs';

const t = await fresh();
const { as, err, save, rpc } = t;
const A = await t.user('zed'), B = await t.user('yan');

const real = await save(A, { score: 40, source: 'zetamac', detail: arithLog('standard', 21, 40, 2500) });
check('a recorded zetamac game with its question log counts', real.verified === true);
check('a recorded 30-second zetamac game counts', (await save(A, { score: 12, seconds: 30, source: 'zetamac', detail: arithLog('standard', 22, 12, 2000) })).verified === true);
check('a zetamac game whose log does not match its score never counts',
  (await save(A, { score: 41, source: 'zetamac', detail: arithLog('standard', 23, 40, 2500) })).verified === false);
check('a zetamac game with answers faster than 150 ms never counts',
  (await save(A, { score: 30, source: 'zetamac', detail: arithLog('standard', 24, 30, 100) })).verified === false);
check('a zetamac game with questions outside the default ranges never counts',
  (await save(A, { score: 1, source: 'zetamac', detail: [{ q: '150 + 3', a: 153, o: 'add', c: 0, t: 2000 }] })).verified === false);

const refused = async (name, row) => check(name, !!(await err(() => save(A, row))));
await refused('zetamac games are only Arithmetic games', { score: 10, source: 'zetamac', mode: 'sq99h', detail: arithLog('sq99h', 25, 10, 3000) });
await refused('zetamac games are never endless', { score: 10, seconds: 0, elapsed: 60, source: 'zetamac', detail: arithLog('standard', 26, 10, 3000) });
await refused('unknown sources are still refused', { score: 10, source: 'phone' });

await save(B, { score: 35, detail: arithLog('standard', 27, 35, 2500) });
const rows = (await as(null, `select username, score, source from leaderboard where mode = 'standard' and seconds = 120 order by score desc`)).rows;
check('the board shows where each best was played',
  JSON.stringify(rows) === JSON.stringify([{ username: 'zed', score: 40, source: 'zetamac' }, { username: 'yan', score: 35, source: 'game' }]), rows);
const board = await rpc(null, 'board', { p_mode: 'standard', p_seconds: 120 });
check("a board's rows say where each best was played", board.rows.map(r => r.source).join() === 'zetamac,game', board.rows);

done();
