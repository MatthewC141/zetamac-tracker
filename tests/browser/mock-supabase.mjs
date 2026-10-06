// A stand-in for the parts of Supabase the site uses, running the real schema.sql on PGlite:
// sign-up and log-in (auth), table and view reads and the database functions (the REST API),
// inserting and deleting scores, and Realtime broadcast (websocket and HTTP). For tests only.
// POST /__sql runs SQL as the database owner, so tests can set up state (move a clock, etc.).
import http from 'node:http';
import crypto from 'node:crypto';
import { fresh } from '../db/lib.mjs';

export const KEY = 'test-anon-key';

export async function startMock(port) {
  const t = await fresh();
  const { db } = t;
  const accounts = new Map();  // email → { id, hash, name }
  const tokens = new Map();    // access or refresh token → user id
  const hash = p => crypto.createHash('sha256').update(p).digest('hex');
  const session = acc => {
    const access = 'a-' + crypto.randomUUID(), refresh = 'r-' + crypto.randomUUID();
    tokens.set(access, acc.id); tokens.set(refresh, acc.id);
    return { access_token: access, refresh_token: refresh, expires_in: 3600, token_type: 'bearer', user: { id: acc.id } };
  };
  let queue = Promise.resolve();  // PGlite runs one thing at a time
  const serial = fn => (queue = queue.then(fn, fn));
  const as = (uid, text, params) => serial(() => t.as(uid, text, params));
  const owner = (text, params) => serial(() => db.query(text, params));

  const RELATIONS = new Set(['scores', 'profiles', 'leaderboard', 'leaderboard_week', 'daily_board', 'ladder', 'match_messages', 'matches', 'ratings']);
  const ident = s => { if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw new Error(`bad name ${s}`); return `"${s}"`; };
  // PostgREST filters: col=eq.x, is.null|true|false, in.(a,b), gt/gte/lt/lte.
  function where(params) {
    const conds = [], vals = [];
    for (const [k, v] of params) {
      if (['select', 'order', 'offset', 'limit', 'on_conflict'].includes(k)) continue;
      const [op, ...rest] = v.split('.'), val = rest.join('.');
      const col = ident(k);
      if (op === 'eq') { vals.push(val); conds.push(`${col}::text = $${vals.length}`); }
      else if (op === 'is') conds.push(`${col} is ${val === 'true' ? 'true' : val === 'false' ? 'false' : 'null'}`);
      else if (op === 'in') { const list = val.replace(/^\(|\)$/g, '').split(',').map(x => x.replace(/^"|"$/g, '')); vals.push(list); conds.push(`${col}::text = any($${vals.length})`); }
      else if (['gt', 'gte', 'lt', 'lte'].includes(op)) { vals.push(val); conds.push(`${col}::text ${{ gt: '>', gte: '>=', lt: '<', lte: '<=' }[op]} $${vals.length}`); }
      else throw new Error(`filter ${op} not supported here`);
    }
    return { sql: conds.length ? ' where ' + conds.join(' and ') : '', vals };
  }
  const plain = row => {
    for (const [k, v] of Object.entries(row)) {
      if (v instanceof Date) row[k] = k === 'date' || k === 'day' ? v.toISOString().slice(0, 10) : v.toISOString();
      else if (typeof v === 'bigint') row[k] = Number(v);
    }
    if (typeof row.id === 'string' && /^\d+$/.test(row.id)) row.id = Number(row.id);
    return row;
  };

  // ---- Realtime: topic → set of sockets ----
  const topics = new Map();
  const frame = text => {  // a server-to-client text frame
    const data = Buffer.from(text), n = data.length;
    const head = n < 126 ? Buffer.from([0x81, n]) : n < 65536 ? Buffer.from([0x81, 126, n >> 8, n & 255]) : null;
    if (!head) throw new Error('frame too big');
    return Buffer.concat([head, data]);
  };
  const deliver = (topic, event, payload, except) => {
    for (const sock of topics.get(topic) || []) {
      if (sock === except || sock.destroyed) continue;
      sock.write(frame(JSON.stringify({ topic, event: 'broadcast', payload: { type: 'broadcast', event, payload }, ref: null })));
    }
  };
  const broadcasts = [];  // every broadcast seen, for the tests

  const server = http.createServer(async (req, res) => {
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'apikey, authorization, content-type, prefer', 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS' });
      res.end(body === undefined ? '' : JSON.stringify(body));
    };
    if (req.method === 'OPTIONS') return send(204);
    const url = new URL(req.url, 'http://x');
    let body = '';
    for await (const c of req) body += c;
    const json = body ? JSON.parse(body) : null;
    if (url.pathname === '/__sql') {
      try { return send(200, (await owner(json.sql, json.params || [])).rows.map(plain)); } catch (e) { return send(400, { message: e.message }); }
    }
    if (url.pathname === '/__broadcasts') return send(200, broadcasts);
    if (req.headers.apikey !== KEY) return send(401, { message: 'Invalid API key' });
    const uid = tokens.get((req.headers.authorization || '').replace('Bearer ', '')) || null;
    try {
      if (url.pathname === '/auth/v1/signup') {
        if (accounts.has(json.email)) return send(422, { code: 422, msg: 'User already registered' });
        if ((json.password || '').length < 6) return send(422, { msg: 'Password should be at least 6 characters.' });
        let id;
        try { id = (await owner(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`, [json.email, JSON.stringify(json.data || {})])).rows[0].id; }
        catch (e) { return send(500, { msg: e.message }); }
        const acc = { id, hash: hash(json.password), name: json.data?.username };
        accounts.set(json.email, acc);
        return send(200, session(acc));
      }
      if (url.pathname === '/auth/v1/token') {
        if (url.searchParams.get('grant_type') === 'password') {
          const acc = accounts.get(json.email);
          if (!acc || acc.hash !== hash(json.password)) return send(400, { error: 'invalid_grant', error_description: 'Invalid login credentials' });
          return send(200, session(acc));
        }
        const id = tokens.get(json.refresh_token), acc = [...accounts.values()].find(a => a.id === id);
        return acc ? send(200, session(acc)) : send(400, { error: 'invalid_grant', error_description: 'Invalid Refresh Token' });
      }
      if (url.pathname === '/auth/v1/logout') return send(204);
      if (url.pathname === '/realtime/v1/api/broadcast') {
        for (const m of json.messages || []) { broadcasts.push(m); deliver(`realtime:${m.topic}`, m.event, m.payload); }
        return send(202);
      }
      const m = /^\/rest\/v1\/rpc\/([a-z_]+)$/.exec(url.pathname);
      if (m && req.method === 'POST') {
        const args = json || {}, keys = Object.keys(args);
        keys.forEach(ident);
        const r = await as(uid, `select public.${ident(m[1])}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')}) r`, keys.map(k => args[k]));
        if (m[1] === 'delete_me') for (const [k, v] of accounts) if (v.id === uid) accounts.delete(k);
        const v = r.rows[0].r;
        return send(200, v instanceof Date ? v.toISOString() : v);
      }
      const table = url.pathname.replace('/rest/v1/', '');
      if (!RELATIONS.has(table)) return send(404, { message: 'not found' });
      if (req.method === 'GET') {
        const cols = (url.searchParams.get('select') || '*').split(',').map(c => (c === '*' ? '*' : ident(c))).join(',');
        const w = where(url.searchParams);
        const order = (url.searchParams.get('order') || '').split(',').filter(Boolean).map(o => { const [c, d] = o.split('.'); return `${ident(c)} ${d === 'desc' ? 'desc' : 'asc'}`; });
        const lim = Math.min(Number(url.searchParams.get('limit') || 1000), 1000), off = Number(url.searchParams.get('offset') || 0) | 0;
        const r = await as(uid, `select ${cols} from public.${ident(table)}${w.sql}${order.length ? ' order by ' + order.join(',') : ''} limit ${lim} offset ${off}`, w.vals);
        return send(200, r.rows.map(plain));
      }
      if (req.method === 'POST' && table === 'scores') {
        if (!uid) return send(401, { message: 'permission denied' });
        const out = [];
        for (const r of Array.isArray(json) ? json : [json]) {
          const q = await as(uid, `insert into scores (ts, date, score, seconds, source, mode, elapsed, detail) values ($1,$2,$3,$4,$5,$6,$7,$8)
            on conflict (user_id, ts, score, seconds, mode, source) do nothing returning id, ts, verified`,
            [r.ts, r.date, r.score, r.seconds, r.source, r.mode, r.elapsed ?? 0, r.detail == null ? null : JSON.stringify(r.detail)]);
          out.push(...q.rows.map(plain));
        }
        return send(201, out);
      }
      if (req.method === 'DELETE' && table === 'scores') {
        const w = where(url.searchParams);
        await as(uid, `delete from scores${w.sql}`, w.vals);
        return send(204);
      }
      send(405, { message: 'method not allowed' });
    } catch (err) {
      send(400, { message: err.message });
    }
  });

  // Realtime websocket: join a topic, heartbeat, and broadcast to the others on it.
  server.on('upgrade', (req, sock) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname !== '/realtime/v1/websocket' || url.searchParams.get('apikey') !== KEY) return sock.destroy();
    const accept = crypto.createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
    sock.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    let buf = Buffer.alloc(0);
    const joined = new Set();
    sock.on('data', chunk => {
      buf = Buffer.concat([buf, chunk]);
      for (;;) {
        if (buf.length < 2) return;
        const op = buf[0] & 15, masked = buf[1] & 128;
        let n = buf[1] & 127, at = 2;
        if (n === 126) { if (buf.length < 4) return; n = buf.readUInt16BE(2); at = 4; }
        else if (n === 127) { if (buf.length < 10) return; n = Number(buf.readBigUInt64BE(2)); at = 10; }
        const mask = masked ? buf.subarray(at, at + 4) : null;
        if (masked) at += 4;
        if (buf.length < at + n) return;
        const data = Buffer.from(buf.subarray(at, at + n));
        if (mask) for (let i = 0; i < n; i++) data[i] ^= mask[i % 4];
        buf = buf.subarray(at + n);
        if (op === 8) { sock.end(); return; }
        if (op === 9) { sock.write(Buffer.from([0x8a, 0])); continue; }
        if (op !== 1) continue;
        const msg = JSON.parse(data.toString());
        const reply = (status = 'ok') => sock.write(frame(JSON.stringify({ topic: msg.topic, event: 'phx_reply', payload: { status, response: {} }, ref: msg.ref })));
        if (msg.event === 'phx_join') { (topics.get(msg.topic) || topics.set(msg.topic, new Set()).get(msg.topic)).add(sock); joined.add(msg.topic); reply(); }
        else if (msg.event === 'phx_leave') { topics.get(msg.topic)?.delete(sock); joined.delete(msg.topic); reply(); }
        else if (msg.event === 'heartbeat') reply();
        else if (msg.event === 'broadcast') { broadcasts.push({ topic: msg.topic.replace(/^realtime:/, ''), event: msg.payload?.event }); deliver(msg.topic, msg.payload?.event, msg.payload?.payload, sock); }
      }
    });
    const leave = () => { for (const tp of joined) topics.get(tp)?.delete(sock); };
    sock.on('close', leave); sock.on('error', leave);
  });

  await new Promise(r => server.listen(port, '127.0.0.1', r));
  return { port, close: () => new Promise(r => { server.closeAllConnections?.(); server.close(r); }) };
}
