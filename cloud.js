// Accounts and the leaderboard, through the project's Supabase database (see schema.sql). The
// URL and public key below are meant to be public: what each visitor can read or change is decided
// by the database's own rules, not by this file. Leave them empty to run without accounts.
(() => {
  const SUPABASE_URL = 'https://ktjcczwwpzzigwfbsynq.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_3iaOg9pYNOgsEnqM8CIQrg_tEBQf_n1';

  // The website's address, for the links from the tracker on your computer to the website version.
  // (With your own domain: change it here, and og:image in each page's head.)
  window.ZM_SITE = 'https://matthewc141.github.io/zetamac-tracker/';

  const SESSION = 'zm-session';
  const nameOk = s => /^[A-Za-z0-9_]{3,20}$/.test(s);
  // No email: each name signs in with an address that can never receive mail.
  const emailFor = name => `${name.toLowerCase()}@users.zetamac-tracker.invalid`;

  const read = () => { try { return JSON.parse(localStorage.getItem(SESSION) || 'null'); } catch { return null; } };
  const write = s => { try { s ? localStorage.setItem(SESSION, JSON.stringify(s)) : localStorage.removeItem(SESSION); } catch {} };

  const plainError = (status, body) => {
    const m = String(body?.msg || body?.message || body?.error_description || body?.error || '');
    if (/already registered|already exists/i.test(m)) return 'That name is taken. Pick another.';
    if (/invalid login credentials/i.test(m)) return 'That name and password don’t match.';
    if (/Names are 3 to 20/i.test(m)) return 'Names are 3 to 20 letters, digits or underscores.';
    if (/password/i.test(m) && /least|short|weak/i.test(m)) return 'Pick a longer password (8 characters or more).';
    if (status === 429) return 'Too many tries. Wait a minute and try again.';
    return m || `Something went wrong (${status}). Try again.`;
  };

  async function call(path, { method = 'GET', body, token, headers = {} } = {}) {
    const r = await fetch(SUPABASE_URL + path, {
      method,
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await r.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch {}
    if (!r.ok) throw Object.assign(new Error(plainError(r.status, data)), { status: r.status });
    return data;
  }

  // The name shown is always the account's fixed username, never the account's editable metadata.
  const keep = (data, name) => {
    const s = { access: data.access_token, refresh: data.refresh_token, expires: Date.now() + (data.expires_in - 60) * 1000, id: data.user?.id, name };
    write(s);
    return s;
  };

  // A valid access token for the signed-in player, renewed when it's about to run out (or when the
  // database turned the current one down). Requests that need a renewal at the same moment share
  // one. If the session can't be renewed, the player is signed out and the error says so.
  let renewing = null;
  async function token(force = false) {
    const s = read();
    if (!s) throw Object.assign(new Error('You’re signed out.'), { signedOut: true });
    if (!force && Date.now() < s.expires) return s.access;
    renewing ||= (async () => {
      try {
        return keep(await call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: s.refresh } }), s.name).access;
      } catch (err) {
        if (err.status >= 400 && err.status < 500) { write(null); err.signedOut = true; }
        throw err;
      } finally {
        renewing = null;
      }
    })();
    return renewing;
  }

  // The Realtime connection behind listen() (Phoenix's websocket protocol, as Supabase speaks it).
  const listeners = new Map();  // topic → set of callbacks
  let socket = null, beat = 0, ref = 0, retry = 1000;
  const send = (topic, event, payload) => socket?.readyState === 1 && socket.send(JSON.stringify({ topic, event, payload, ref: String(++ref) }));
  const join = topic => send(`realtime:${topic}`, 'phx_join', { config: { broadcast: { self: false }, presence: { key: '' }, postgres_changes: [], private: false }, access_token: SUPABASE_KEY });
  function connect() {
    if (socket || !SUPABASE_URL || typeof WebSocket === 'undefined') return;
    socket = new WebSocket(`${SUPABASE_URL.replace(/^http/, 'ws')}/realtime/v1/websocket?apikey=${encodeURIComponent(SUPABASE_KEY)}&vsn=1.0.0`);
    socket.onopen = () => {
      retry = 1000;
      for (const topic of listeners.keys()) join(topic);
      beat = setInterval(() => send('phoenix', 'heartbeat', {}), 25000);
    };
    socket.onmessage = e => {
      let m;
      try { m = JSON.parse(e.data); } catch { return; }
      if (m.event !== 'broadcast') return;
      for (const fn of listeners.get(String(m.topic).replace(/^realtime:/, '')) || []) { try { fn(m.payload?.payload); } catch {} }
    };
    socket.onclose = () => {
      clearInterval(beat); socket = null;
      if ([...listeners.values()].some(set => set.size)) setTimeout(connect, retry = Math.min(retry * 2, 60000));
    };
  }

  window.ZM_CLOUD = {
    ready: !!(SUPABASE_URL && SUPABASE_KEY),
    nameOk,
    user: () => { const s = read(); return s && { id: s.id, name: s.name }; },
    async signUp(name, password) {
      if (!nameOk(name)) throw new Error('Names are 3 to 20 letters, digits or underscores.');
      const data = await call('/auth/v1/signup', { method: 'POST', body: { email: emailFor(name), password, data: { username: name } } });
      if (!data?.access_token) throw new Error('The account was made but not signed in. Try logging in.');
      return keep(data, name);
    },
    async logIn(name, password) {
      if (!nameOk(name)) throw new Error('That name and password don’t match.');
      const data = await call('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: emailFor(name), password } });
      // The username as it was signed up (its capitals), from the profile the leaderboard uses. The
      // sign-in address can't change, so the typed name is the same name if that lookup fails.
      let real = name;
      try {
        const rows = await call(`/rest/v1/profiles?select=username&id=eq.${encodeURIComponent(data.user?.id || '')}`, { token: data.access_token });
        if (rows?.[0]?.username && rows[0].username.toLowerCase() === name.toLowerCase()) real = rows[0].username;
      } catch {}
      return keep(data, real);
    },
    async logOut() {
      const s = read();
      write(null);
      if (s) { try { await call('/auth/v1/logout', { method: 'POST', token: s.access }); } catch {} }
    },
    async deleteAccount() {
      await call('/rest/v1/rpc/delete_me', { method: 'POST', token: await token(), body: {} });
      write(null);
    },
    // Signed-in database calls (rows are limited to the player's own by the database). A token the
    // database refuses is renewed once and the call retried.
    async rest(path, opts = {}) {
      try {
        return await call(`/rest/v1/${path}`, { ...opts, token: await token() });
      } catch (err) {
        if (err.status !== 401) throw err;
        return call(`/rest/v1/${path}`, { ...opts, token: await token(true) });
      }
    },
    // Public: the leaderboard, worked out by the database (schema.sql) so a page fetches only
    // what it shows. boards(): every board's size, leader, and the named player's place with the
    // player just ahead. board(): one board's first rows, and the rows around the named player
    // when they're further down. Both all time, or this week (from Monday).
    boards: (week = false, name = null) => call('/rest/v1/rpc/boards', { method: 'POST', body: { p_week: week, p_name: name } }),
    board: (mode, seconds, week = false, name = null, limit = 100) =>
      call('/rest/v1/rpc/board', { method: 'POST', body: { p_mode: mode, p_seconds: seconds, p_week: week, p_name: name, p_limit: limit } }),
    // Public: where a score stands on a board, as { beats, of }: how many other players' bests it's
    // higher than, out of how many (the named player left out). Null with fewer than 5 others.
    standing: (mode, seconds, score, name = null) =>
      call('/rest/v1/rpc/standing', { method: 'POST', body: { p_mode: mode, p_seconds: seconds, p_score: score, p_name: name } }),
    // Realtime (Supabase's broadcast channels): a nudge from one page to another, used to tell a
    // player a challenge is waiting. Nudges carry nothing and anyone can send one, so a page that
    // gets one only re-asks the database (mm_invites), which has the truth. listen() keeps one
    // connection per page (heartbeat, reconnect), and calls `fn` for each nudge on that topic.
    listen(topic, fn) {
      (listeners.get(topic) || listeners.set(topic, new Set()).get(topic)).add(fn);
      connect();
      if (socket?.readyState === 1) join(topic);
      return () => listeners.get(topic)?.delete(fn);
    },
    ping: topic => fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ topic, event: 'ping', payload: {} }] }),
    }).catch(() => {}),
    inviteTopic: name => `invites:${String(name).toLowerCase()}`,
    // An error on a page, reported to the database's error log (schema.sql: log_error).
    logError: (page, message, detail) => call('/rest/v1/rpc/log_error', { method: 'POST', body: { p_page: page, p_message: message, p_detail: detail } }).catch(() => {}),
    // "Better than 84% of 52 players", or the top of the board.
    standingText: s => s.beats === s.of ? `Higher than all ${s.of} other players`
      : `Better than ${Math.floor(100 * s.beats / s.of)}% of ${s.of} players`,
    // Public: one day's daily-challenge results, best first.
    daily: date => call(`/rest/v1/daily_board?select=username,score&date=eq.${encodeURIComponent(date)}&order=score.desc&limit=1000`),
    // Public: a player's profile (null for no such player, or a private account).
    profile: name => call('/rest/v1/rpc/profile', { method: 'POST', body: { p_name: name } }),
    // Public: ranked duel ratings of everyone past their placement matches.
    ladder: () => call('/rest/v1/ladder?select=username,elo,games,wins,losses,draws&order=elo.desc&limit=1000'),
  };
})();
