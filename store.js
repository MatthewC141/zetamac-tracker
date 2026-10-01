// Website mode. On a static host such as GitHub Pages there is no tracker server, so this answers
// the pages' /api/* requests itself. Signed out, scores stay in the visitor's own browser
// (localStorage): every visitor starts with an empty tracker and nobody sees anyone else's scores.
// Signed in (cloud.js), the same requests go to the player's account instead, so their scores
// follow them between devices. Both follow the rules of the C++ server (zetamac.cpp). Opened from
// ./zetamac tracker, it does nothing.
(() => {
  // Never run inside another site's frame (GitHub Pages can't send X-Frame-Options): hide the page
  // and take over the whole tab instead, so no one can dress it up and trick a click.
  if (window.top !== window.self) {
    document.documentElement.style.display = 'none';
    try { window.top.location = location.href; } catch {}
    return;
  }
  if (['127.0.0.1', 'localhost'].includes(location.hostname)) return;
  window.ZM_WEB = true;

  const SCORES = 'zm-web-scores';
  const DETAIL = 'zm-web-detail:';  // + timestamp → that game's question log (JSON text)
  const MODES = new Set(['standard', 'daily', 'sq99', 'sq99h', 'sq999', 'sq999h', 'sub-borrow', 'sub-easy', 'drill', 'guided', 'mixed', 'o80', 'seq', 'frac', 'est']);
  // The quant tests: each has a fixed length and question count (its highest score).
  const TESTS = { o80: [480, 80], seq: [240, 30], frac: [240, 60], est: [240, 40] };

  const pad = n => String(n).padStart(2, '0');
  const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const stamp = d => `${dateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  const validDate = s => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const [y, m, d] = s.split('-').map(Number);
    const t = new Date(y, m - 1, d);
    return t.getFullYear() === y && t.getMonth() === m - 1 && t.getDate() === d;
  };
  const parseInt6 = s => (/^\d{1,6}$/.test(s || '') ? Number(s) : null);
  const parseSeconds = s => (!s || s === '120' ? 120 : s === '30' ? 30 : s === '480' ? 480 : s === '240' ? 240 : 0);
  const parseMode = s => (!s ? 'standard' : MODES.has(s) ? s : '');
  // Each quant test has its own length and highest score, and no other game uses those lengths.
  // The daily challenge is always 2 minutes.
  const lengthFits = (mode, seconds, score) => (TESTS[mode] ? seconds === TESTS[mode][0] && score <= TESTS[mode][1]
    : mode === 'daily' ? seconds === 120 : seconds !== 480 && seconds !== 240);

  // Saved rows are read back as untrusted: a row is kept only if every field has the shape the
  // server itself would write, and only those fields are kept, so nothing else reaches the page.
  const whole = (v, max) => Number.isInteger(v) && v >= 0 && v <= max;
  const validRow = e => e && typeof e === 'object' &&
    typeof e.ts === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(e.ts) && validDate(e.date) &&
    whole(e.score, e.seconds ? 500 : 999999) && [0, 30, 120, 240, 480].includes(e.seconds) && whole(e.elapsed, 999999) &&
    e.ts.slice(0, 10) === e.date && (e.source === 'game' || e.source === 'manual') && MODES.has(e.mode) &&
    (e.seconds === 0 ? !TESTS[e.mode] && e.mode !== 'daily' : lengthFits(e.mode, e.seconds, e.score));
  const fields = ({ ts, date, score, seconds, source, mode, elapsed }) => ({ ts, date, score, seconds, source, mode, elapsed });

  const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const fail = (status, error) => reply(status, { error });
  class Refused extends Error {}  // a request the rules turn down (answered 400, like the server)

  const entry = (score, date, source, seconds, mode) => {
    const now = new Date();
    return { ts: date === dateKey(now) ? stamp(now) : `${date}T12:00:00`, date, score, seconds, source, mode, elapsed: 0 };
  };

  // A new score from a POST, checked as the server checks it. Returns { e, detail } or throws Refused.
  function newScore(route, form) {
    const get = k => form.get(k) || '';
    if (route === 'scores') {  // a score logged by hand
      const score = parseInt6(get('score'));
      const date = form.has('date') ? get('date') : dateKey(new Date());
      if (score === null || score > 500) throw new Refused('Score must be a whole number from 0 to 500.');
      if (!validDate(date)) throw new Refused('Date must be YYYY-MM-DD.');
      if (date > dateKey(new Date())) throw new Refused('That date is in the future.');
      const seconds = parseSeconds(get('seconds'));
      if (!seconds) throw new Refused('Game length must be 30 or 120 seconds.');
      const mode = parseMode(get('mode'));
      if (!mode) throw new Refused('Unknown game mode.');
      if (!lengthFits(mode, seconds, score)) throw new Refused('That game length doesn’t fit that game.');
      return { e: entry(score, date, 'manual', seconds, mode), detail: null };
    }
    // a finished round, always today; seconds=0 is an endless run
    const endless = get('seconds') === '0';
    const score = parseInt6(get('score'));
    if (score === null || score > (endless ? 999999 : 500)) throw new Refused('Score is out of range.');
    const seconds = endless ? 0 : parseSeconds(get('seconds'));
    if (!endless && !seconds) throw new Refused('Game length must be 30 or 120 seconds.');
    const mode = parseMode(get('mode'));
    if (!mode) throw new Refused('Unknown game mode.');
    if (endless ? TESTS[mode] || mode === 'daily' : !lengthFits(mode, seconds, score)) throw new Refused('That game length doesn’t fit that game.');
    // How long it took, in seconds: an endless run's length, or a quant test's (its tie-break).
    const elapsed = endless ? parseInt6(get('elapsed')) : TESTS[mode] ? Math.min(seconds, parseInt6(get('elapsed')) ?? 0) : 0;
    if (elapsed === null) throw new Refused('Endless runs need an elapsed time in seconds.');
    const e = entry(score, dateKey(new Date()), 'game', seconds, mode);
    e.elapsed = elapsed;
    const d = get('detail');
    const detail = d.length >= 2 && d.length <= 2000000 && d[0] === '[' && d.at(-1) === ']' ? d : null;
    return { e, detail };
  }

  // Rows from an export file, checked like every other row. Returns [{ e, detail }] or throws Refused.
  function importRows(body) {
    let data;
    try { data = JSON.parse(body || ''); } catch { throw new Refused('That file isn’t a tracker export.'); }
    if (!data || data.app !== 'zetamac-tracker' || !Array.isArray(data.scores)) throw new Refused('That file isn’t a tracker export.');
    return data.scores.slice(0, 100000).map(raw => {
      const e = raw && fields({ ...raw, elapsed: raw.elapsed ?? 0 });
      if (!validRow(e)) return null;
      const detail = Array.isArray(raw.detail) && e.source === 'game' ? JSON.stringify(raw.detail) : null;
      return { e, detail: detail && detail.length <= 2000000 ? detail : null };
    });
  }
  const sameKey = e => `${e.ts}|${e.score}|${e.seconds}|${e.mode}|${e.source}`;

  // ---- this browser (signed out) ----
  const load = () => {
    try {
      const list = JSON.parse(localStorage.getItem(SCORES) || '[]');
      return Array.isArray(list) ? list.filter(validRow).map(fields) : [];
    } catch { return []; }
  };
  const store = list => localStorage.setItem(SCORES, JSON.stringify(list));
  const hasDetail = ts => { try { return localStorage.getItem(DETAIL + ts) !== null; } catch { return false; } };
  const view = list => list.map((e, i) => ({ i, ...e, detail: hasDetail(e.ts) }));

  function local(route, method, url, body) {
    if (method === 'GET' && route === 'scores') return reply(200, view(load()));
    if (method === 'GET' && route === 'detail') {
      const ts = url.searchParams.get('ts') || '';
      const raw = localStorage.getItem(DETAIL + ts);
      if (raw === null) return fail(404, 'No question-by-question data for this game.');
      let questions = [];
      try { questions = JSON.parse(raw); } catch {}
      return reply(200, { ts, questions });
    }
    if (method !== 'POST') return fail(404, 'not found');
    const list = load();
    if (route === 'scores' || route === 'game') {
      const { e, detail } = newScore(route, new URLSearchParams(body || ''));
      if (e.mode === 'daily' && list.some(x => x.mode === 'daily' && x.date === e.date)) throw new Refused('You’ve already played today’s challenge.');
      list.push(e);
      store(list);
      if (detail) { try { localStorage.setItem(DETAIL + e.ts, detail); } catch {} }  // the score still counts if the log doesn't fit
      return reply(200, view(list));
    }
    if (route === 'delete') {
      const form = new URLSearchParams(body || '');
      const index = parseInt6(form.get('index'));
      if (index === null || index >= list.length) throw new Refused('No such entry.');
      if (form.get('ts') !== list[index].ts) return fail(409, 'Scores changed since the page loaded — refresh and try again.');
      // Only games have question logs; a hand-logged score with the same timestamp must not take one.
      if (list[index].source === 'game') localStorage.removeItem(DETAIL + list[index].ts);
      list.splice(index, 1);
      store(list);
      return reply(200, view(list));
    }
    if (route === 'import') {  // a file exported from any copy of the tracker: merged in, duplicates skipped
      const seen = new Set(list.map(sameKey));
      let added = 0, skipped = 0;
      for (const row of importRows(body)) {
        if (!row || seen.has(sameKey(row.e))) { skipped++; continue; }
        seen.add(sameKey(row.e));
        list.push(row.e);
        added++;
        if (row.detail && !hasDetail(row.e.ts)) { try { localStorage.setItem(DETAIL + row.e.ts, row.detail); } catch {} }
      }
      list.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
      store(list);
      return reply(200, { added, skipped, scores: view(list) });
    }
    return fail(404, 'not found');
  }

  // ---- the player's account (signed in) ----
  const cloud = () => window.ZM_CLOUD?.ready && window.ZM_CLOUD.user() ? window.ZM_CLOUD : null;
  // Offline: games finished without a connection wait here ({ uid, e, detail } each) and go up
  // the next time a page opens online, or the connection comes back. The account's scores as last
  // seen are kept too, so the tracker still shows them (with the waiting games) while offline.
  const PENDING = 'zm-pending', SEEN = 'zm-account-seen';
  const offline = err => !err.status && !err.signedOut;  // the request never reached the database
  const readJSON = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch { return d; } };
  const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const pendingFor = uid => readJSON(PENDING, []).filter(p => p && p.uid === uid && validRow(p.e));
  const seenView = c => {
    const seen = readJSON(SEEN, null), uid = c.user().id;
    const rows = seen?.uid === uid && Array.isArray(seen.rows) ? seen.rows.filter(validRow) : [];
    return [...rows, ...pendingFor(uid).map(p => p.e)].map((e, i) => ({ i, ...fields(e), detail: false }));
  };
  async function flushPending() {
    const c = cloud();
    if (!c || !navigator.onLine) return;
    const uid = c.user().id, mine = pendingFor(uid);
    if (!mine.length) return;
    try {
      await insertRows(c, mine.map(({ e, detail }) => ({ e, detail })));
      writeJSON(PENDING, readJSON(PENDING, []).filter(p => !mine.some(m => m.e.ts === p.e?.ts && m.uid === p.uid)));
    } catch {}
  }
  const COLS = 'id,ts,date,score,seconds,source,mode,elapsed,has_detail';
  async function accountRows(c) {  // every row, 1000 at a time (the database's page size)
    const rows = [];
    for (let from = 0; ; from += 1000) {
      const page = await c.rest(`scores?select=${COLS}&order=ts.asc,id.asc&offset=${from}&limit=1000`);
      rows.push(...page);
      if (page.length < 1000) return rows;
    }
  }
  const accountView = rows => rows.map((r, i) => ({ i, ts: r.ts, date: r.date, score: r.score, seconds: r.seconds, source: r.source, mode: r.mode, elapsed: r.elapsed, detail: r.has_detail }));
  const insertRows = (c, rows) => c.rest('scores?on_conflict=user_id,ts,score,seconds,mode,source', {
    method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
    body: rows.map(({ e, detail }) => {
      // A log the database wouldn't keep is dropped and the score still saves: unreadable, over
      // 5,000 answers, or over its 200 bytes a question (checked with room for the database's own
      // spacing), since one refused log would otherwise fail the whole batch.
      let log = null;
      try { log = detail ? JSON.parse(detail) : null; } catch {}
      const fits = Array.isArray(log) && log.length <= 5000 && new TextEncoder().encode(JSON.stringify(log)).length <= 180 * log.length;
      return { ...e, detail: fits ? log : null };
    }),
  });

  async function account(c, route, method, url, body) {
    if (method === 'GET' && route === 'scores') {
      await flushPending();
      const rows = await accountRows(c);
      writeJSON(SEEN, { uid: c.user().id, rows: rows.map(r => fields(r)) });
      return reply(200, accountView(rows));
    }
    if (method === 'GET' && route === 'detail') {
      const ts = url.searchParams.get('ts') || '';
      if (!/^[\d:T-]{19}$/.test(ts)) return fail(400, 'Bad game timestamp.');
      const [row] = await c.rest(`scores?select=detail&ts=eq.${encodeURIComponent(ts)}&source=eq.game&has_detail=is.true&limit=1`);
      if (!row) return fail(404, 'No question-by-question data for this game.');
      return reply(200, { ts, questions: Array.isArray(row.detail) ? row.detail : [] });
    }
    if (method !== 'POST') return fail(404, 'not found');
    if (route === 'scores' || route === 'game') {
      const row = newScore(route, new URLSearchParams(body || ''));
      try {
        await insertRows(c, [row]);
      } catch (err) {
        if (!offline(err)) throw err;
        writeJSON(PENDING, [...readJSON(PENDING, []), { uid: c.user().id, ...row }]);
        return reply(200, seenView(c));
      }
      return reply(200, accountView(await accountRows(c)));
    }
    if (route === 'delete') {
      const form = new URLSearchParams(body || '');
      const rows = await accountRows(c);
      const index = parseInt6(form.get('index'));
      if (index === null || index >= rows.length) throw new Refused('No such entry.');
      if (form.get('ts') !== rows[index].ts) return fail(409, 'Scores changed since the page loaded — refresh and try again.');
      await c.rest(`scores?id=eq.${rows[index].id}`, { method: 'DELETE' });
      rows.splice(index, 1);
      return reply(200, accountView(rows));
    }
    if (route === 'import') {
      const rows = importRows(body);
      const good = rows.filter(Boolean);
      let added = 0;
      // A batch at a time, kept small enough that long question logs fit in one request.
      for (let k = 0; k < good.length;) {
        const batch = [];
        let size = 0;
        while (k < good.length && batch.length < 200 && (size === 0 || size + (good[k].detail?.length || 0) < 1500000)) {
          size += good[k].detail?.length || 0;
          batch.push(good[k++]);
        }
        added += (await insertRows(c, batch)).length;
      }
      return reply(200, { added, skipped: rows.length - added, scores: accountView(await accountRows(c)) });
    }
    return fail(404, 'not found');
  }

  // This browser's own games (for moving them into an account), and clearing them afterwards.
  window.ZM_LOCAL = {
    exportFile() {
      const scores = load().map(e => {
        let detail;
        try { detail = JSON.parse(localStorage.getItem(DETAIL + e.ts) || 'null') ?? undefined; } catch {}
        return { ...e, ...(detail && { detail }) };
      });
      return { app: 'zetamac-tracker', version: 1, exported: new Date().toISOString(), scores };
    },
    count: () => load().length,
    clear() {
      for (const e of load()) localStorage.removeItem(DETAIL + e.ts);
      localStorage.removeItem(SCORES);
    },
  };

  addEventListener('online', flushPending);
  setTimeout(flushPending, 0);  // once this page's scripts are in (cloud.js loads first)

  // Install on a phone and play offline: a service worker keeps the pages for when there's no
  // connection (pages always come from the network when there is one).
  if ('serviceWorker' in navigator && window.isSecureContext) {
    addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    const m = url.origin === location.origin && url.pathname.match(/\/api\/(scores|game|delete|detail|import)$/);
    if (!m) return realFetch(input, init);
    const method = (init.method || 'GET').toUpperCase(), c = cloud();
    try {
      return c ? await account(c, m[1], method, url, init.body) : local(m[1], method, url, init.body);
    } catch (err) {
      if (err instanceof Refused) return fail(400, err.message);
      // Signed out mid-session (the sign-in ran out): carry on in this browser, so a finished game
      // is never lost. The account page offers to move it in after logging back in.
      // (Only for saving a game or score, and for reads; never for an import, which moves games out
      // of this browser and must fail rather than land back here.)
      if (err.signedOut && (method === 'GET' || m[1] === 'game' || m[1] === 'scores')) {
        try { return local(m[1], method, url, init.body); } catch (e2) { if (e2 instanceof Refused) return fail(400, e2.message); }
      }
      // Offline and signed in: the tracker shows the account as last seen, plus games waiting to go up.
      if (c && offline(err) && method === 'GET' && m[1] === 'scores') return reply(200, seenView(c));
      return fail(500, c ? `Couldn’t reach your account: ${err.message}` : 'Couldn’t save in this browser. Storage may be full or blocked (private windows can block it).');
    }
  };
})();
