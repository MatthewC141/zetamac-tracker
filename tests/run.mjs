// Runs the tests: `node run.mjs` (everything), `node run.mjs db`, `node run.mjs browser`, and an
// optional name filter (`node run.mjs browser duel`). Each test file runs on its own and prints
// PASS/FAIL lines. Browser tests get a fresh stand-in database, a test copy of the site and a
// scratch local tracker with an empty score file; nothing touches the real scores.csv.
// Screenshots go to tests/shots/ when ZM_SHOTS=1.
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.join(HERE, '..');
const [kind = 'all', filter = ''] = process.argv.slice(2);
const list = dir => fs.readdirSync(path.join(HERE, dir)).filter(f => f.endsWith('.test.mjs') && f.includes(filter)).map(f => path.join(HERE, dir, f));

function run(file, env = {}) {
  return new Promise(resolve => {
    const started = Date.now();
    const p = spawn(process.execPath, [file], { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    p.stdout.on('data', d => { out += d; });
    p.stderr.on('data', d => { out += d; });
    const timer = setTimeout(() => { out += '\nFAIL timed out after 5 minutes'; p.kill(); }, 300000);
    p.on('close', code => {
      clearTimeout(timer);
      const fails = out.split('\n').filter(l => l.startsWith('FAIL') || /Error|at .*:\d+:\d+/.test(l) && code);
      const passes = (out.match(/^PASS/gm) || []).length;
      console.log(`${code === 0 ? 'ok  ' : 'FAIL'} ${path.relative(HERE, file)}  ${passes} passed${fails.length ? `, ${fails.filter(l => l.startsWith('FAIL')).length} failed` : ''}  (${((Date.now() - started) / 1000).toFixed(1)} s)`);
      if (code !== 0) console.log(out.split('\n').filter(l => !l.startsWith('PASS')).map(l => '     ' + l).join('\n'));
      resolve(code === 0);
    });
  });
}

let ok = true;
if (kind === 'all' || kind === 'db') {
  console.log('Database');
  const files = list('db');
  const results = await Promise.all(files.map(f => run(f)));
  ok = results.every(Boolean) && ok;
}
if (kind === 'all' || kind === 'browser') {
  console.log('Website');
  const { startMock } = await import('./browser/mock-supabase.mjs');
  const { buildSite, serveStatic } = await import('./browser/lib.mjs');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zm-test-'));
  const shots = process.env.ZM_SHOTS ? path.join(HERE, 'shots') : '';
  if (shots) fs.mkdirSync(shots, { recursive: true });
  // The local tracker (zetamac.cpp), built if needed, run on an empty scratch copy.
  if (!fs.existsSync(path.join(ROOT, 'zetamac'))) execSync('make', { cwd: ROOT, stdio: 'ignore' });
  for (const file of list('browser')) {
    const mock = await startMock(0 || 8820 + Math.floor(Math.random() * 100));
    const mockOrigin = `http://127.0.0.1:${mock.port}`;
    const site = buildSite(tmp, mockOrigin);
    const sitePort = 8700 + Math.floor(Math.random() * 90);
    const web = await serveStatic(tmp, sitePort);
    const home = fs.mkdtempSync(path.join(tmp, 'tracker-'));
    for (const f of fs.readdirSync(site)) fs.cpSync(path.join(site, f), path.join(home, f), { recursive: true });
    const trackerPort = 8600 + Math.floor(Math.random() * 90);
    const tracker = spawn(path.join(ROOT, 'zetamac'), ['tracker', String(trackerPort)], { env: { ...process.env, ZETAMAC_HOME: home, ZETAMAC_NO_OPEN: '1' }, stdio: 'ignore' });
    await new Promise(r => setTimeout(r, 400));
    ok = (await run(file, { ZM_BASE: `http://zm.test:${sitePort}/zetamac-tracker/`, ZM_MOCK: mockOrigin, ZM_TRACKER: `http://127.0.0.1:${trackerPort}/`, ZM_TRACKER_HOME: home, ZM_SHOTS: shots })) && ok;
    tracker.kill(); web.close(); await mock.close();
  }
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(ok ? '\nAll tests passed.' : '\nSome tests failed.');
process.exit(ok ? 0 : 1);
