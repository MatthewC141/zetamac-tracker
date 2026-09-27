// Website mode. On a static host such as GitHub Pages there is no tracker server, so this answers
// the pages' /api/* requests itself and keeps scores in the visitor's own browser (localStorage).
// Every visitor starts with an empty tracker and nobody sees anyone else's scores. It follows the
// same rules as the C++ server (zetamac.cpp). Opened from ./zetamac tracker, it does nothing.
(() => {
  if (['127.0.0.1', 'localhost'].includes(location.hostname)) return;
  window.ZM_WEB = true;

  const SCORES = 'zm-web-scores';
  const DETAIL = 'zm-web-detail:';  // + timestamp → that game's question log (JSON text)
  const MODES = new Set(['standard', 'sq99', 'sq99h', 'sq999', 'sq999h', 'sub-borrow', 'sub-easy', 'guided']);

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
  const parseSeconds = s => (!s || s === '120' ? 120 : s === '30' ? 30 : 0);
  const parseMode = s => (!s ? 'standard' : MODES.has(s) ? s : '');

  const load = () => {
    try {
      const list = JSON.parse(localStorage.getItem(SCORES) || '[]');
      return Array.isArray(list) ? list.filter(e => e && typeof e.ts === 'string' && validDate(e.date)) : [];
    } catch { return []; }
  };
  const store = list => localStorage.setItem(SCORES, JSON.stringify(list));
  const hasDetail = ts => { try { return localStorage.getItem(DETAIL + ts) !== null; } catch { return false; } };
  const view = list => list.map((e, i) => ({ i, ...e, detail: hasDetail(e.ts) }));

  const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const fail = (status, error) => reply(status, { error });

  const entry = (score, date, source, seconds, mode) => {
    const now = new Date();
    return { ts: date === dateKey(now) ? stamp(now) : `${date}T12:00:00`, date, score, seconds, source, mode, elapsed: 0 };
  };

  function handle(route, method, url, body) {
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
    const form = new URLSearchParams(body || '');
    const get = k => form.get(k) || '';
    const list = load();

    if (route === 'scores') {  // a score logged by hand
      const score = parseInt6(get('score'));
      const date = form.has('date') ? get('date') : dateKey(new Date());
      if (score === null || score > 500) return fail(400, 'Score must be a whole number from 0 to 500.');
      if (!validDate(date)) return fail(400, 'Date must be YYYY-MM-DD.');
      if (date > dateKey(new Date())) return fail(400, 'That date is in the future.');
      const seconds = parseSeconds(get('seconds'));
      if (!seconds) return fail(400, 'Game length must be 30 or 120 seconds.');
      const mode = parseMode(get('mode'));
      if (!mode) return fail(400, 'Unknown game mode.');
      list.push(entry(score, date, 'manual', seconds, mode));
      store(list);
      return reply(200, view(list));
    }
    if (route === 'game') {  // a finished round, always today; seconds=0 is an endless run
      const endless = get('seconds') === '0';
      const score = parseInt6(get('score'));
      if (score === null || score > (endless ? 999999 : 500)) return fail(400, 'Score is out of range.');
      const seconds = endless ? 0 : parseSeconds(get('seconds'));
      if (!endless && !seconds) return fail(400, 'Game length must be 30 or 120 seconds.');
      const elapsed = endless ? parseInt6(get('elapsed')) : 0;
      if (elapsed === null) return fail(400, 'Endless runs need an elapsed time in seconds.');
      const mode = parseMode(get('mode'));
      if (!mode) return fail(400, 'Unknown game mode.');
      const e = entry(score, dateKey(new Date()), 'game', seconds, mode);
      e.elapsed = elapsed;
      list.push(e);
      store(list);
      const detail = get('detail');
      if (detail.length >= 2 && detail.length <= 2000000 && detail[0] === '[' && detail.at(-1) === ']') {
        try { localStorage.setItem(DETAIL + e.ts, detail); } catch {}  // the score still counts if the log doesn't fit
      }
      return reply(200, view(list));
    }
    if (route === 'delete') {
      const index = parseInt6(get('index'));
      if (index === null || index >= list.length) return fail(400, 'No such entry.');
      if (get('ts') !== list[index].ts) return fail(409, 'Scores changed since the page loaded — refresh and try again.');
      localStorage.removeItem(DETAIL + list[index].ts);
      list.splice(index, 1);
      store(list);
      return reply(200, view(list));
    }
    return fail(404, 'not found');
  }

  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    const m = url.origin === location.origin && url.pathname.match(/\/api\/(scores|game|delete|detail)$/);
    if (!m) return realFetch(input, init);
    try {
      return handle(m[1], (init.method || 'GET').toUpperCase(), url, init.body);
    } catch {
      return fail(500, 'Couldn’t save in this browser. Storage may be full or blocked (private windows can block it).');
    }
  };
})();
