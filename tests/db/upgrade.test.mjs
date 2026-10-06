// schema.sql is pasted into Supabase as a whole, again after every change: it has to run twice
// in a row, and upgrade the database that's live (the last committed schema.sql) keeping its data.
import { execSync } from 'node:child_process';
import { fresh, check, done, SCHEMA, ROOT } from './lib.mjs';
import { arithLog } from '../shared/games.mjs';

const t = await fresh(SCHEMA);
await t.db.exec(SCHEMA);
check('schema.sql runs twice in a row', true);

let live = null;
try { live = execSync('git show HEAD:schema.sql', { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch {}
if (live === null) {
  check('no committed schema.sql to upgrade from (skipped)', true);
} else {
  const u = await fresh(live);
  const A = await u.user('alex');
  await u.save(A, { score: 40, detail: arithLog('standard', 1, 40) });
  await u.save(A, { score: 12, source: 'manual' });
  const before = (await u.db.query('select count(*)::int n, sum(score)::int s from scores')).rows[0];
  let ok = true, msg = '';
  try { await u.db.exec(SCHEMA); } catch (e) { ok = false; msg = e.message; }
  check('upgrades the committed (live) schema', ok, msg);
  const after = (await u.db.query('select count(*)::int n, sum(score)::int s from scores')).rows[0];
  check('…keeping every score', JSON.stringify(before) === JSON.stringify(after), [before, after]);
  check('…and the board still reads', (await u.as(null, 'select count(*)::int n from leaderboard')).rows[0].n >= 1);
}

done();
