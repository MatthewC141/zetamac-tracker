// Drives headless Chrome over the DevTools protocol (no extra packages), and serves a copy of the
// site pointed at the stand-in database. The site is reached as http://zm.test:PORT/zetamac-tracker/
// (a name Chrome maps to this machine), so it runs in website mode as it does on GitHub Pages.
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const CHROME = process.env.CHROME || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium']
  .find(p => fs.existsSync(p));

let pass = 0, fail = 0;
export const check = (name, ok, extra = '') => {
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${!ok && extra !== '' ? `  ${typeof extra === 'string' ? extra : JSON.stringify(extra)}` : ''}`);
};
export const done = () => { console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); };

// The environment the runner sets: where the site, the stand-in database and the scratch tracker are.
export const ENV = { base: process.env.ZM_BASE, mock: process.env.ZM_MOCK, tracker: process.env.ZM_TRACKER, shots: process.env.ZM_SHOTS };

// A copy of the project for the test site: cloud.js points at the stand-in database, and the
// pages' security policy lets them reach it.
export function buildSite(dir, mockOrigin) {
  const site = path.join(dir, 'zetamac-tracker');
  fs.rmSync(site, { recursive: true, force: true });
  const files = execSync('git ls-files --cached --others --exclude-standard', { cwd: ROOT, encoding: 'utf8' }).split('\n')
    .filter(f => f && !f.startsWith('tests/') && !f.startsWith('details/') && f !== 'scores.csv' && fs.existsSync(path.join(ROOT, f)));
  for (const f of files) { fs.mkdirSync(path.dirname(path.join(site, f)), { recursive: true }); fs.copyFileSync(path.join(ROOT, f), path.join(site, f)); }
  const cloud = path.join(site, 'cloud.js');
  fs.writeFileSync(cloud, fs.readFileSync(cloud, 'utf8')
    .replace(/const SUPABASE_URL = '[^']*';/, `const SUPABASE_URL = '${mockOrigin}';`)
    .replace(/const SUPABASE_KEY = '[^']*';/, `const SUPABASE_KEY = 'test-anon-key';`));
  const ws = mockOrigin.replace(/^http/, 'ws');
  for (const f of fs.readdirSync(site).filter(f => f.endsWith('.html'))) {
    const p = path.join(site, f);
    fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/connect-src 'self'[^;"]*/, `connect-src 'self' ${mockOrigin} ${ws}`));
  }
  return site;
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
export function serveStatic(dir, port) {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(dir, p);
    if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => server.listen(port, '127.0.0.1', () => r(server)));
}

// One headless Chrome with its own profile. `width` × `height` is the window.
let nextPort = 9300 + Math.floor(Math.random() * 400);
export async function browser({ width = 1352, height = 878, base = ENV.base } = {}) {
  const port = nextPort++, profile = fs.mkdtempSync(path.join(os.tmpdir(), 'zm-chrome-'));
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--window-size=${width},${height}`,
    '--host-resolver-rules=MAP zm.test 127.0.0.1', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' });
  let target;
  for (let i = 0; i < 80 && !target; i++) {
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page'); } catch {}
    if (!target) await sleep(150);
  }
  if (!target) throw new Error('Chrome did not start');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0;
  const waiting = new Map(), errors = [], dialogs = [];
  let b = null;  // (events can arrive before it's made)
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error' && !/Failed to load resource|net::ERR/.test(m.params.entry.text)) errors.push(m.params.entry.text);
    if (m.method === 'Network.requestWillBeSent') b?.onRequest?.(m.params.request.url);
    if (m.method) b?.onEvent?.(m);
    if (m.method === 'Page.javascriptDialogOpening') { dialogs.push(m.params.message); send('Page.handleJavaScriptDialog', { accept: true, promptText: b?.promptText ?? '' }); }
    if (waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
  };
  const send = (method, params = {}) => new Promise(r => { waiting.set(++id, r); ws.send(JSON.stringify({ id, method, params })); }).then(m => m.result);
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  b = {
    errors, dialogs, send, promptText: null,
    // Runs an expression in the page (awaits promises) and returns its value.
    ev: async expr => {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      if (r?.exceptionDetails) throw new Error('in page: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
      return r?.result?.value;
    },
    go: async (page = '', wait = 900) => { await send('Page.navigate', { url: base + page }); await sleep(wait); },
    // Waits until the expression is truthy (or throws after `ms`).
    until: async (expr, ms = 8000) => {
      const end = Date.now() + ms;
      for (;;) {
        try { const v = await b.ev(expr); if (v) return v; } catch {}
        if (Date.now() > end) throw new Error(`timed out waiting for ${expr}`);
        await sleep(100);
      }
    },
    text: sel => b.ev(`document.querySelector(${JSON.stringify(sel)})?.innerText.replace(/\\s+/g, ' ').trim() ?? null`),
    click: sel => b.ev(`(el => { if (!el) throw new Error('no ${sel.replace(/'/g, '')}'); el.click(); return true; })(document.querySelector(${JSON.stringify(sel)}))`),
    shown: sel => b.ev(`(el => !!el && !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length) && getComputedStyle(el).visibility !== 'hidden')(document.querySelector(${JSON.stringify(sel)}))`),
    // Types into the focused element the way a keyboard would (each character an input event).
    type: async text => { for (const ch of text) await send('Input.insertText', { text: ch }); },
    key: async (key, code = key) => { for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: { Enter: 13, Escape: 27, Tab: 9 }[key] || 0 }); },
    shot: async (name, full = false) => {
      if (!ENV.shots) return;
      const opts = full ? { captureBeyondViewport: true, clip: await b.ev(`({ x: 0, y: 0, width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, scale: 1 })`) } : {};
      fs.writeFileSync(path.join(ENV.shots, `${name}.png`), Buffer.from((await send('Page.captureScreenshot', opts)).data, 'base64'));
    },
    noSideScroll: () => b.ev('document.documentElement.scrollWidth <= innerWidth'),
    close: () => { try { ws.close(); } catch {} chrome.kill(); setTimeout(() => fs.rmSync(profile, { recursive: true, force: true }), 500); },
  };
  return b;
}

// Answers the question showing in a zetamac-style game (arithmetic, squares, combined, practice).
export const answerShown = b => b.ev(`(() => {
  const q = document.querySelector('#question').textContent.replaceAll('×', '*').replaceAll('÷', '/').replaceAll('–', '-').replace(/(\\d+)²/, '$1*$1');
  const a = Function('return ' + q)(), input = document.querySelector('#answer');
  input.value = String(a); input.dispatchEvent(new Event('input')); return a;
})()`);
export async function answerMany(b, n, gap = 200) { for (let i = 0; i < n; i++) { await sleep(gap); await answerShown(b); } }

// SQL against the stand-in database, as its owner (setting up state for a test).
export const sql = async (text, params = []) => {
  const r = await fetch(`${ENV.mock}/__sql`, { method: 'POST', body: JSON.stringify({ sql: text, params }) });
  const d = await r.json();
  if (!r.ok) throw new Error(d.message);
  return d;
};
// Signs a new account up in the page (through the site's own cloud.js).
export const signUp = (b, name, pass = 'password1234') => b.ev(`ZM_CLOUD.signUp(${JSON.stringify(name)}, ${JSON.stringify(pass)}).then(s => s.name)`);
export const uniq = prefix => prefix + Math.random().toString(36).slice(2, 8);
export const localDay = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
