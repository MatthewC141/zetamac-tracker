// The tracker on your computer (./zetamac tracker), run on an empty scratch copy: games save to
// its scores.csv, the dashboard reads them back, and the server only answers its own pages.
import fs from 'node:fs';
import path from 'node:path';
import { browser, check, done, answerMany } from './lib.mjs';

const T = process.env.ZM_TRACKER, HOME = process.env.ZM_TRACKER_HOME;
check('the scratch tracker starts with no scores', !fs.existsSync(path.join(HOME, 'scores.csv')) || fs.readFileSync(path.join(HOME, 'scores.csv'), 'utf8').trim().split('\n').length <= 1);

const b = await browser({ base: T });
await b.go('play.html');
check('opened from the tracker, the site is not in website mode', (await b.ev('!!window.ZM_WEB')) === false);
await b.click('#start'); await b.until('running');
await answerMany(b, 6);
await b.ev('finish()');
await b.until(`/Saved|personal best/.test(document.querySelector('#saved').textContent)`);
const csv = fs.readFileSync(path.join(HOME, 'scores.csv'), 'utf8').trim().split('\n');
check('the game is a row in scores.csv', csv.length === 2 && /,6,120,game,standard,/.test(csv[1]), csv);
check('…with its question log beside it', fs.readdirSync(path.join(HOME, 'details')).length === 1);
await b.go('', 1500);
check('the dashboard reads it back', /6/.test(await b.text('#score .sb-fig.main')));

// more games, then count the requests for question logs: one batch, not one a game
await b.go('play.html');
for (let i = 0; i < 3; i++) {
  await b.click(i ? '#again' : '#start'); await b.until('running');
  await answerMany(b, 4);
  await b.ev('finish()');
  await b.until(`/Saved|personal best/.test(document.querySelector('#saved').textContent)`);
}
const urls = [];
await b.send('Network.enable');
b.onRequest = u => urls.push(u);
await b.go('practice.html', 1500);
check('the practice page reads every game’s log in one request', urls.filter(u => /api\/details\?/.test(u)).length === 1 && !urls.some(u => /api\/detail\?/.test(u)), urls.filter(u => /api/.test(u)));
urls.length = 0;
await b.go('', 1500);
check('the dashboard does the same', urls.filter(u => /api\/details\?/.test(u)).length <= 1 && !urls.some(u => /api\/detail\?/.test(u)), urls.filter(u => /api/.test(u)));

const status = async (p, opts) => (await fetch(T + p, opts)).status;
check('a save without the page’s header is refused', await status('api/game', { method: 'POST', body: 'score=5&seconds=120' }) === 403);
check('scores.csv itself is not served', (await status('scores.csv')) === 404);
check('unknown files are not served', (await status('zetamac.cpp')) === 404 && (await status('../etc/passwd')) === 404);
check('no page errors', b.errors.length === 0, b.errors);
b.close();
done();
