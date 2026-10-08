// Signing in to Zetamach and saving recorded games, for the service worker and the popup. It works
// like the website's cloud.js: the same name-only accounts, and every game goes through the
// database's own checks before it can reach the leaderboard. The extension keeps its own session
// (the website's refresh token can't be shared: using it would sign the website out). The session
// and games waiting to save live in chrome.storage.local, which only this extension can read.
globalThis.ZM_ACCOUNT = (() => {
  const { supabaseUrl, supabaseKey } = ZM_CONFIG;
  const store = chrome.storage.local;
  const nameOk = s => /^[A-Za-z0-9_]{3,20}$/.test(s);
  // No email: each name signs in with an address that can never receive mail (as on the website).
  const emailFor = name => `${name.toLowerCase()}@users.zetamac-tracker.invalid`;

  const plainError = (status, body) => {
    const m = String(body?.msg || body?.message || body?.error_description || body?.error || '');
    if (/invalid login credentials/i.test(m)) return 'That name and password don’t match.';
    if (status === 429) return 'Too many tries. Wait a minute and try again.';
    return m || `Something went wrong (${status}). Try again.`;
  };

  async function call(path, { method = 'GET', body, token, headers = {} } = {}) {
    const r = await fetch(supabaseUrl + path, {
      method,
      headers: { apikey: supabaseKey, 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await r.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch {}
    if (!r.ok) throw Object.assign(new Error(plainError(r.status, data)), { status: r.status });
    return data;
  }

  const session = async () => (await store.get('session')).session || null;
  async function keep(data, name) {
    const s = { access: data.access_token, refresh: data.refresh_token, expires: Date.now() + (data.expires_in - 60) * 1000, name };
    await store.set({ session: s });
    return s;
  }

  // A valid access token, renewed when it's about to run out (or was turned down), or null when
  // signed out. If the session can't be renewed, the extension signs out.
  let renewing = null;
  async function token(force = false) {
    const s = await session();
    if (!s) return null;
    if (!force && Date.now() < s.expires) return s.access;
    renewing ||= (async () => {
      try {
        return (await keep(await call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: s.refresh } }), s.name)).access;
      } catch (err) {
        if (err.status >= 400 && err.status < 500) { await store.remove('session'); return null; }
        throw err;
      } finally {
        renewing = null;
      }
    })();
    return renewing;
  }

  async function logIn(name, password) {
    name = name.trim();
    if (!nameOk(name) || !password) throw new Error('That name and password don’t match.');
    const data = await call('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: emailFor(name), password } });
    // The name as it was signed up (its capitals); the typed name is the same name if this fails.
    let real = name;
    try {
      const rows = await call(`/rest/v1/profiles?select=username&id=eq.${encodeURIComponent(data.user?.id || '')}`, { token: data.access_token });
      if (rows?.[0]?.username?.toLowerCase() === name.toLowerCase()) real = rows[0].username;
    } catch {}
    return (await keep(data, real)).name;
  }

  async function logOut() {
    const s = await session();
    await store.remove('session');
    if (s) { try { await call('/auth/v1/logout', { method: 'POST', token: s.access }); } catch {} }
  }

  // ---- games waiting to save ----
  const waiting = async () => (await store.get('pending')).pending || [];
  const forget = async ts => store.set({ pending: (await waiting()).filter(row => row.ts !== ts) });

  // Saves one game; a token the database turns down is renewed once and the save retried.
  async function insert(row, access) {
    const send = t => call('/rest/v1/scores?on_conflict=user_id,ts,score,seconds,mode,source&select=ts,verified', {
      method: 'POST', token: t, headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
      body: [{ ...row, source: 'zetamac', mode: 'standard', elapsed: 0 }],
    });
    try { return await send(access); } catch (err) {
      if (err.status !== 401) throw err;
      const renewed = await token(true);
      if (!renewed) throw Object.assign(new Error('signed out'), { signedOut: true });
      return send(renewed);
    }
  }

  // Tries every waiting game, oldest first. Returns { signedOut } or { results: { ts: outcome } }.
  // A game the database refuses outright is dropped (retrying can't help); one that couldn't reach
  // the database waits for the next try.
  async function flushOnce() {
    const list = await waiting();
    if (!list.length) return { results: {} };
    let access = await token();
    if (!access) return { signedOut: true };
    const results = {};
    for (const row of list) {
      try {
        const [saved] = await insert(row, access);
        results[row.ts] = { saved: true, verified: saved?.verified ?? null };
        await forget(row.ts);
      } catch (err) {
        if (err.signedOut) return { signedOut: true, results };
        if (err.status >= 400 && err.status < 500) {
          results[row.ts] = { saved: false, reason: `Zetamach refused this game: ${err.message}` };
          await forget(row.ts);
        } else {
          results[row.ts] = { saved: false, reason: 'couldn’t reach Zetamach; it will save the next time you’re online' };
        }
      }
      access = (await token()) || access;
    }
    return { results };
  }
  // One flush at a time, so a game finishing during a retry is never sent twice at once.
  let queue = Promise.resolve();
  const flush = () => (queue = queue.then(flushOnce, flushOnce));

  // Keeps only the fields a recorded game has, so nothing else reaches the database.
  const tidy = ({ ts, date, score, seconds, detail }) => ({ ts, date, score, seconds, detail });

  async function save(row) {
    const game = tidy(row);
    await store.set({ pending: [...(await waiting()).filter(r => r.ts !== game.ts), game] });
    const { signedOut, results } = await flush();
    const outcome = results?.[game.ts];
    if (outcome) return outcome;
    if (signedOut) return { saved: false, reason: 'sign in with the Zetamach button in Chrome’s toolbar to save this game (it will wait until you do)' };
    return { saved: false, reason: 'couldn’t save yet; it will try again in a few minutes' };
  }

  return {
    logIn, logOut, save, flush,
    status: async () => ({ name: (await session())?.name || null, waiting: (await waiting()).length }),
  };
})();
