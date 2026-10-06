// A fresh database for each test file: PGlite (Postgres in-process) with the roles and auth
// schema Supabase provides, then the project's schema.sql. Helpers act as a given player (or
// signed out), like requests through Supabase's API would.
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const SCHEMA = fs.readFileSync(ROOT + 'schema.sql', 'utf8');

let pass = 0, fail = 0;
export const check = (name, ok, extra = '') => {
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${!ok && extra ? `  ${typeof extra === 'string' ? extra : JSON.stringify(extra)}` : ''}`);
};
export const done = () => { console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); };

// The parts of Supabase the schema relies on: the anon and authenticated roles, and auth.users
// with auth.uid() read from the request's claims.
export const SUPABASE = `
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public to anon, authenticated; grant usage on schema auth to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
`;

export async function fresh(sql = SCHEMA) {
  const db = new PGlite();
  await db.exec(SUPABASE);
  if (sql) await db.exec(sql);
  const t = { db };
  // Runs SQL as a player (a user id) or signed out (null), as Supabase's API would.
  t.as = async (uid, text, params) => {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid || ''}', false); set role ${uid ? 'authenticated' : 'anon'};`);
    try { return await db.query(text, params); } finally { await db.exec('reset role'); }
  };
  t.rpc = async (uid, fn, args = {}) => {
    const keys = Object.keys(args);
    const r = await t.as(uid, `select public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')}) r`, keys.map(k => args[k]));
    return r.rows[0].r;
  };
  t.err = async (fn) => { try { await fn(); return null; } catch (e) { return e.message; } };
  t.user = async name => (await db.query(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
    [`${name.toLowerCase()}@users.zetamac-tracker.invalid`, JSON.stringify({ username: name })])).rows[0].id;
  t.utc = (await db.query(`select (now() at time zone 'utc')::date::text d`)).rows[0].d;
  let k = 0;
  // Saves a game as a player; returns the saved row (or undefined when the database drops it).
  t.save = async (uid, row) => {
    const date = row.date || t.utc;
    const ts = row.ts || `${date}T${String(Math.floor(k / 3600) % 24).padStart(2, '0')}:${String(Math.floor(k / 60) % 60).padStart(2, '0')}:${String(k % 60).padStart(2, '0')}`;
    k++;
    const r = await t.as(uid, `insert into scores (ts, date, score, seconds, source, mode, elapsed, detail) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id, verified`,
      [ts, date, row.score, row.seconds ?? 120, row.source || 'game', row.mode || 'standard', row.elapsed ?? 0, row.detail == null ? null : JSON.stringify(row.detail)]);
    return r.rows[0];
  };
  return t;
}
