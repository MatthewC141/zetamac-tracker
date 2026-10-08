// The Chrome extension (extension/): recording a game on a stand-in zetamac page (fixtures/), then
// saving it to an account on the stand-in database, where it counts like a game played on the site.
// Chrome's extension APIs are stood in: messages are captured and storage is kept in memory.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { browser, check, done, sleep, ENV, ROOT, serveStatic, sql, uniq } from './lib.mjs';

// The stand-in pages and the extension, side by side, with the extension pointed at the stand-ins.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zm-ext-'));
for (const from of [path.join(ROOT, 'extension'), path.join(ROOT, 'tests/browser/fixtures')])
  for (const f of fs.readdirSync(from)) fs.copyFileSync(path.join(from, f), path.join(dir, f));
fs.writeFileSync(path.join(dir, 'config.js'), `globalThis.ZM_CONFIG = ${JSON.stringify({ supabaseUrl: ENV.mock, supabaseKey: 'test-anon-key', site: ENV.base })};`);
const port = 8500 + Math.floor(Math.random() * 90);
const server = await serveStatic(dir, port);
const b = await browser({ base: `http://127.0.0.1:${port}/` });

const CHROME_STUB = `
  window.sent = [];
  const memory = {};
  window.chrome = {
    storage: { local: {
      get: async key => ({ [key]: structuredClone(memory[key]) }),
      set: async items => { Object.assign(memory, structuredClone(items)); },
      remove: async key => { delete memory[key]; },
    } },
    runtime: { sendMessage: async message => { sent.push(message); return { saved: true, verified: true }; } },
  };`;
const read = f => fs.readFileSync(path.join(dir, f), 'utf8');
// What the manifest loads at document_start on zetamac's game pages.
await b.send('Page.addScriptToEvaluateOnNewDocument', { source: [CHROME_STUB, read('config.js'), read('content.js')].join('\n;\n') });
const badge = () => b.ev(`document.querySelector('[role=status]')?.textContent ?? ''`);
const answerShown = () => b.ev(`(() => {
  const q = document.querySelector('#game .problem').textContent.replace('×', '*').replace('÷', '/').replace('–', '-');
  return String(Function('return ' + q)());
})()`);
const backspace = async () => {
  for (const type of ['rawKeyDown', 'keyUp']) await b.send('Input.dispatchKeyEvent', { type, key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
};

// ---- recording a game ----
await b.go('zetamac-default.html?end=5000', 400);
check('says it is recording a game with the default settings', /recording this game/.test(await badge()), await badge());
const typedAnswers = [];
for (let i = 0; i < 5; i++) {
  await sleep(300);
  const answer = await answerShown();
  if (i === 1) { await b.type('9'); await backspace(); }  // a slip, deleted
  await b.type(answer);
  typedAnswers.push(answer);
}
await b.until('sent.length === 1', 8000);
const { type, row } = await b.ev('sent[0]');
check('sends the game to the extension when the clock runs out', type === 'game' && row.score === 5 && row.seconds === 30, row);
check('keeps every question with its answer and kind',
  row.detail.length === 5 && row.detail.every((d, i) => /^\d+ [+–×÷] \d+$/.test(d.q) && String(d.a) === typedAnswers[i] && ['add', 'sub', 'mul', 'div'].includes(d.o)), row.detail);
check('times each question', row.detail.every(d => d.t >= 250 && d.t < 3000), row.detail.map(d => d.t));
check('counts a deleted slip as a correction', row.detail.map(d => d.c).join() === '0,1,0,0,0', row.detail.map(d => d.c));
check('stamps the game with the local date and time', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(row.ts) && row.ts.startsWith(row.date), row.ts);
check('says it saved, with a link to the game on Zetamach',
  /saved 5 to your account · counts for the leaderboard/.test(await badge()) &&
  (await b.ev(`document.querySelector('[role=status] a').href`)) === `${ENV.base}#game=${encodeURIComponent(row.ts)}`, await badge());

// ---- other settings ----
await b.go('zetamac-custom.html?end=1500', 400);
check('says it won’t record custom settings', /not recording: only zetamac’s default settings/.test(await badge()), await badge());
await b.type(await answerShown());
await sleep(1600);
check('…and sends nothing', (await b.ev('sent.length')) === 0);

// ---- saving to an account ----
const name = uniq('zm'), password = 'password1234';
const signup = await fetch(`${ENV.mock}/auth/v1/signup`, { method: 'POST', headers: { apikey: 'test-anon-key', 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: `${name}@users.zetamac-tracker.invalid`, password, data: { username: name } }) });
check('(made a test account)', signup.ok);
await b.go('popup.html', 500);
check('the popup asks to sign in', await b.shown('#signed-out') && !(await b.shown('#signed-in')));
await b.ev(`ZM_ACCOUNT.save(${JSON.stringify(row)})`).then(r => check('signed out, a game waits and says how to save it', r.saved === false && /sign in/.test(r.reason), r));
await b.ev('show()');  // as when the popup is opened after the game
check('the popup shows the waiting game', /1 game is waiting to save/.test(await b.text('#waiting')), await b.text('#waiting'));
await b.ev(`document.querySelector('#name').value = ${JSON.stringify(name)}; document.querySelector('#password').value = 'wrong-password'`);
await b.click('#sign-in');
await b.until(`!document.querySelector('#error').hidden`);
check('a wrong password says so', /don’t match/.test(await b.text('#error')), await b.text('#error'));
await b.ev(`document.querySelector('#password').value = ${JSON.stringify(password)}`);
await b.click('#sign-in');
await b.until(`!document.querySelector('#signed-in').hidden`);
check('signing in shows the name', (await b.text('#who')) === name);
await b.ev('ZM_ACCOUNT.flush()');  // what the service worker does when the popup says it signed in
const saved = await sql(`select s.source, s.mode, s.seconds, s.score, s.verified from scores s join profiles p on p.id = s.user_id where p.username = $1`, [name]);
check('after signing in the waiting game saves as a zetamac game that counts',
  JSON.stringify(saved) === JSON.stringify([{ source: 'zetamac', mode: 'standard', seconds: 30, score: 5, verified: true }]), saved);
check('…and nothing is left waiting', (await b.ev('ZM_ACCOUNT.status()')).waiting === 0);
const again = await b.ev(`ZM_ACCOUNT.save(${JSON.stringify(row)})`);
check('saving the same game twice keeps one copy', again.saved === true &&
  (await sql(`select count(*)::int n from scores s join profiles p on p.id = s.user_id where p.username = $1`, [name]))[0].n === 1);
const board = await sql(`select username, score, source from leaderboard where mode = 'standard' and seconds = 30 and username = $1`, [name]);
check('it is on the Arithmetic 0:30 board, marked as played on zetamac', board[0]?.source === 'zetamac' && board[0]?.score === 5, board);

// ---- on the website ----
const site = await browser();
await site.go('account.html', 600);
await site.ev(`ZM_CLOUD.logIn(${JSON.stringify(name)}, ${JSON.stringify(password)})`);
await site.go('', 1800);
check('the progress page lists the game with a zetamac tag', /zetamac/.test(await site.text('#recent tr.has-detail')), await site.text('#recent tr.has-detail'));
await site.ev(`document.querySelector('#recent tr.has-detail').click()`);
await site.until(`document.querySelectorAll('#recent .detail-row .bd-list tr').length >= 5`);
check('…and opens its question-by-question breakdown', true);
await site.go('leaderboard.html#board=standard%7C30', 1500);
check('the leaderboard marks the best as played on zetamac', /on zetamac/.test(await site.text('#tower')), await site.text('#tower'));
check('no errors on the website', site.errors.length === 0, site.errors);
site.close();

await b.click('#sign-out');
await b.until(`!document.querySelector('#signed-out').hidden`);
check('signing out shows the sign-in form again', (await b.ev('ZM_ACCOUNT.status()')).name === null);

check('no errors in the pages', b.errors.length === 0, b.errors);
b.close();
server.close();
fs.rmSync(dir, { recursive: true, force: true });
done();
