-- Database for accounts and the leaderboard (Supabase). Paste the whole file into the project's
-- SQL editor and run it once; running it again is safe.
--
-- Accounts use Supabase Auth with a username and password. There is no email: the site signs in
-- with <name>@users.zetamac-tracker.invalid, an address that can never receive mail, so turn off
-- "Confirm email" (Authentication → Sign In / Providers → Email).
--
-- Security model: every table has row level security, and each role is granted only what the site
-- uses. Players read, add and delete only their own scores and can't edit them. Whether a game
-- counts for the leaderboard ("verified") is decided here by a trigger, never by the browser. The
-- public can read only the leaderboard view: names and personal bests.

-- ---- players -------------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  created_at timestamptz not null default now()
);
create unique index if not exists profiles_username_lower on public.profiles (lower(username));
-- A private account keeps every score off the leaderboard (set with set_private below).
alter table public.profiles add column if not exists private boolean not null default false;
alter table public.profiles enable row level security;
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles for select to authenticated using (id = (select auth.uid()));

-- A profile is made with each new account, from the name given at sign-up. The account's sign-in
-- address must be the one the site derives from that name, so one account can't hold two names
-- (or block a name it doesn't use), and real email addresses aren't accepted.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare name text := new.raw_user_meta_data ->> 'username';
begin
  if name is null or name !~ '^[A-Za-z0-9_]{3,20}$' then
    raise exception 'Names are 3 to 20 letters, digits or underscores.';
  end if;
  if lower(coalesce(new.email, '')) <> lower(name) || '@users.zetamac-tracker.invalid' then
    raise exception 'Sign up through the site.';
  end if;
  insert into public.profiles (id, username) values (new.id, name);
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- A name's sign-in address never changes (that would move the name to another account).
create or replace function public.keep_email() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.email is distinct from old.email then
    raise exception 'Names can''t be changed.';
  end if;
  return new;
end $$;
drop trigger if exists on_auth_user_email on auth.users;
create trigger on_auth_user_email before update of email on auth.users
  for each row execute function public.keep_email();

-- ---- scores --------------------------------------------------------------------------------
-- The same fields as scores.csv, plus the game's question log (detail) and whether it counts.
create table if not exists public.scores (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  ts text not null check (ts ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$'),
  date date not null,
  score int not null check (score between 0 and 999999),
  seconds int not null,
  source text not null check (source in ('game', 'manual')),
  mode text not null,
  elapsed int not null default 0 check (elapsed between 0 and 999999),
  detail jsonb check (detail is null or (jsonb_typeof(detail) = 'array' and pg_column_size(detail) < 2000000)),
  has_detail boolean generated always as (detail is not null) stored,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, ts, score, seconds, mode, source)
);
-- Rules added after the first version (kept separate so running this file upgrades an existing table).
alter table public.scores drop constraint if exists scores_ts_date;
alter table public.scores add constraint scores_ts_date check (left(ts, 10) = date::text);
alter table public.scores drop constraint if exists scores_timed_max;
alter table public.scores add constraint scores_timed_max check (seconds = 0 or score <= 500);
-- Games: zetamac arithmetic ('standard'), the daily challenge (arithmetic on everyone's same
-- questions for the day), squares, practice drills ('sub-borrow', 'sub-easy', and 'drill' for
-- your weak spots), combined operations, and the quant tests (marked right minus wrong).
alter table public.scores drop constraint if exists scores_mode_check;
alter table public.scores add constraint scores_mode_check
  check (mode in ('standard', 'daily', 'sq99', 'sq99h', 'sq999', 'sq999h', 'sub-borrow', 'sub-easy', 'drill', 'guided', 'mixed', 'o80', 'seq', 'frac', 'est'));
-- Game lengths: endless (0), 30 s and 2 minutes; each quant test has its own fixed length and
-- question count (80 in 8: 80 in 8:00; sequences 30, fractions 60 and estimation 40 in 4:00).
-- The daily challenge is always 2 minutes.
alter table public.scores drop constraint if exists scores_seconds_check;
alter table public.scores add constraint scores_seconds_check check (case mode
  when 'o80' then seconds = 480 when 'seq' then seconds = 240 when 'frac' then seconds = 240 when 'est' then seconds = 240
  when 'daily' then seconds = 120 else seconds in (0, 30, 120) end);
alter table public.scores drop constraint if exists scores_o80_length;
alter table public.scores drop constraint if exists scores_test_length;
alter table public.scores add constraint scores_test_length check (score <= case mode
  when 'o80' then 80 when 'seq' then 30 when 'frac' then 60 when 'est' then 40 else 999999 end);
alter table public.scores drop constraint if exists scores_detail_len;
alter table public.scores add constraint scores_detail_len check (detail is null or jsonb_array_length(detail) <= 5000);
-- A question takes about 75 bytes in the log; 200 each leaves plenty of room. Measured before
-- compression, so a log can't hide one giant entry by making it repetitive. (Not checked against
-- rows saved before this rule.)
alter table public.scores drop constraint if exists scores_detail_size;
alter table public.scores add constraint scores_detail_size
  check (detail is null or octet_length(detail::text) <= 200 * jsonb_array_length(detail) + 2) not valid;
create index if not exists scores_user_ts on public.scores (user_id, ts);
create index if not exists scores_user_created on public.scores (user_id, created_at);
create index if not exists scores_board on public.scores (mode, seconds, score desc) where verified;
create index if not exists scores_daily on public.scores (date, score desc) where mode = 'daily' and verified;
alter table public.scores enable row level security;
drop policy if exists "read own scores" on public.scores;
drop policy if exists "add own scores" on public.scores;
drop policy if exists "delete own scores" on public.scores;
create policy "read own scores" on public.scores for select to authenticated using (user_id = (select auth.uid()));
create policy "add own scores" on public.scores for insert to authenticated with check (user_id = (select auth.uid()));
create policy "delete own scores" on public.scores for delete to authenticated using (user_id = (select auth.uid()));
-- No update policy: a saved score can't be changed, only deleted.

-- Only what the site uses: the public gets nothing from the tables (it reads the leaderboard view);
-- players may read and delete rows, and add rows by these columns only (so a player can't set
-- "verified", the owner or the saved time themselves).
revoke all on public.scores, public.profiles from anon, authenticated;
grant select, delete on public.scores to authenticated;
grant insert (ts, date, score, seconds, source, mode, elapsed, detail) on public.scores to authenticated;
grant select on public.profiles to authenticated;

-- ---- the daily challenge's questions --------------------------------------------------------
-- The day's questions are built in the browser from a seed, and the seed comes from here: it's
-- made from the date and a secret only the database holds, and handed out when a signed-in player
-- starts their one try (daily_start), so no one can build a day's questions ahead of time. A
-- result only counts if it's saved within 4 minutes of that start, and only on the first try:
-- starting again (after a reload, say) hands back the same questions, so later tries never count.
create table if not exists public.daily_salt (
  id boolean primary key default true check (id),
  salt text not null default md5(random()::text || clock_timestamp()::text)
);
insert into public.daily_salt default values on conflict do nothing;
create table if not exists public.daily_starts (
  user_id uuid not null references auth.users on delete cascade,
  day date not null,
  started_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.daily_starts add column if not exists tries int not null default 1;
alter table public.daily_salt enable row level security;
alter table public.daily_starts enable row level security;
revoke all on public.daily_salt, public.daily_starts from anon, authenticated;
create or replace function public.daily_start(p_date date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare utc date := (now() at time zone 'utc')::date; t timestamptz; n int;
begin
  if auth.uid() is null then raise exception 'Sign in to play the daily challenge with everyone.'; end if;
  if p_date is null or p_date < utc - 1 or p_date > utc + 1 then raise exception 'That day’s challenge isn’t open.'; end if;
  insert into public.daily_starts as d (user_id, day) values (auth.uid(), p_date)
    on conflict (user_id, day) do update set tries = d.tries + 1
    returning started_at, tries into t, n;
  return jsonb_build_object('started', t, 'tries', n, 'seed', private.daily_seed(p_date));
end $$;
revoke execute on function public.daily_start(date) from public, anon;
grant execute on function public.daily_start(date) to authenticated;
-- Whether that player started that day's challenge once, in the last 4 minutes (the score check
-- asks this; players can't read the starts table themselves).
create or replace function public.daily_started(p_user uuid, p_day date) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.daily_starts d where d.user_id = p_user and d.day = p_day
                 and d.tries = 1 and d.started_at > now() - interval '4 minutes');
$$;
revoke execute on function public.daily_started(uuid, date) from public, anon;
grant execute on function public.daily_started(uuid, date) to authenticated;

-- ---- checking the answers in a game's log ---------------------------------------------------
-- These live in their own schema, which the site's API doesn't serve: the score check below calls
-- them while saving a game, and nothing else can.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;
-- A question as the games write it ("54 + 87", "(13 – 4) × 23", "12% of 850", "Quarters in 0.75",
-- "√5,476", …) worked out here, or null if it isn't one. Only digits, operators, brackets and
-- sqrt reach the calculation, so nothing else can run.
create or replace function private.zm_eval(p_q text) returns numeric
language plpgsql immutable set search_path = '' as $$
declare s text := btrim(coalesce(p_q, '')); m text[]; r numeric; prev text;
begin
  if length(s) = 0 or length(s) > 40 then return null; end if;
  s := replace(replace(replace(replace(s, '×', '*'), '÷', '/'), '–', '-'), '−', '-');
  loop prev := s; s := regexp_replace(s, '(\d),(\d{3})', '\1\2', 'g'); exit when s = prev; end loop;  -- 98,000
  m := regexp_match(s, '^(\S+)% of (\S+)$');
  if m is not null then s := format('(%s) / 100 * (%s)', m[1], m[2]); end if;
  m := regexp_match(s, '^(\d+)/(\d+) in %$');
  if m is not null then s := format('%s / %s * 100', m[1], m[2]); end if;
  m := regexp_match(s, '^([A-Za-z-]+) in (\S+)$');
  if m is not null then
    s := format('(%s) * %s', m[2], case m[1] when 'Halves' then 2 when 'Quarters' then 4 when 'Fifths' then 5 when 'Eighths' then 8 when 'Tenths' then 10
      when 'Sixteenths' then 16 when 'Twentieths' then 20 when 'Twenty-fifths' then 25 when 'Fortieths' then 40 end);
  end if;
  m := regexp_match(s, '^(\d+) (\d+)/(\d+)$');  -- a mixed number: 2 3/8
  if m is not null then s := format('(%s + %s / %s)', m[1], m[2], m[3]); end if;
  s := regexp_replace(s, '√(\d+)', 'sqrt(\1)', 'g');
  s := regexp_replace(s, '(\d+)²', '(\1 * \1)', 'g');
  if regexp_replace(s, 'sqrt', '', 'g') !~ '^[0-9. +*/()-]+$' then return null; end if;
  execute 'select (' || regexp_replace(s, '(\d+(\.\d+)?)', '\1::numeric', 'g') || ')::numeric' into r;
  return r;
exception when others then return null;
end $$;

-- A typed answer read the way the quant tests read it: "1,037", "8,5" (a decimal comma), "40%".
create or replace function private.zm_num(p_g text) returns numeric
language sql immutable set search_path = '' as $$
  select case when s ~ '^-?(\d+\.?\d*|\.\d+)$' then s::numeric end
  from (select case when t ~ '^-?\d{1,3}(,\d{3})+(\.\d+)?$' then replace(t, ',', '') else regexp_replace(t, ',', '.') end s
        from (select regexp_replace(replace(regexp_replace(coalesce(p_g, ''), '\s+', '', 'g'), '−', '-'), '%$', '') t) a) b;
$$;

-- The daily challenge's questions, built from the day's seed exactly as problems.js builds them
-- (its small seeded generator, mulberry32, in 32-bit steps), so a daily's log can be checked
-- question by question against the day's set.
create or replace function private.zm_daily_list(p_seed int, p_n int) returns text[]
language plpgsql immutable set search_path = '' as $$
declare
  m32 constant bigint := 4294967295; s bigint := p_seed::bigint & 4294967295; t bigint; u bigint;
  out text[] := '{}'; q text; op int; a int; b int;
begin
  while coalesce(array_length(out, 1), 0) < least(p_n, 600) loop
    -- op, then the two numbers; each draw is one step of the generator
    for i in 1..3 loop
      s := (s + 1831565813) & m32;
      t := ((((s # (s >> 15))::numeric * ((1 | s))::numeric) % 4294967296)::bigint);
      t := ((t + ((((t # (t >> 7))::numeric * ((61 | t))::numeric) % 4294967296)::bigint)) & m32) # t;
      u := (t # (t >> 14)) & m32;
      if i = 1 then op := ((u * 4) >> 32)::int;
      elsif i = 2 then a := case when op < 2 then 2 + ((u * 99) >> 32)::int else 2 + ((u * 11) >> 32)::int end;
      else b := 2 + ((u * 99) >> 32)::int; end if;
    end loop;
    q := case op when 0 then a || ' + ' || b when 1 then (a + b) || ' – ' || a when 2 then a || ' × ' || b else (a * b) || ' ÷ ' || a end;
    if coalesce(array_length(out, 1), 0) = 0 or out[array_length(out, 1)] <> q then out := out || q; end if;
  end loop;
  return out;
end $$;

-- Whether every answer in a game's log holds up: each question worked out to the logged answer and
-- in the game's own number ranges (zetamac's defaults, the squares sets), the daily challenge's
-- questions the day's own in order, and on the quant tests each mark (right, wrong or skipped)
-- matching what was typed. The drills, which mix kinds and never reach the board, aren't checked.
create or replace function private.answers_hold(p_mode text, p_detail jsonb, p_seed int) returns boolean
language plpgsql stable set search_path = '' as $$
declare q jsonb; m text[]; x int; y int; truth numeric; g numeric; shown numeric; i int := 0; day text[];
begin
  if p_mode = 'drill' or p_mode = 'guided' then return true; end if;
  if p_mode = 'daily' then day := private.zm_daily_list(p_seed, jsonb_array_length(p_detail)); end if;
  for q in select value from jsonb_array_elements(p_detail) loop
    i := i + 1;
    if p_mode in ('o80', 'seq', 'frac', 'est') then
      if coalesce(q ->> 'r', '') not in ('y', 'n', 's') then return false; end if;
      if q ->> 'r' = 's' then continue; end if;
      shown := private.zm_num(q ->> 'a');
      truth := case when p_mode = 'seq' then shown else private.zm_eval(q ->> 'q') end;
      g := private.zm_num(q ->> 'g');
      if truth is null or shown is null or truth <= 0 then return false; end if;
      if p_mode = 'est' then
        if abs(shown - truth) > 0.005 * truth then return false; end if;
        if (q ->> 'r' = 'y') <> (g is not null and abs(g - truth) <= 0.05 * truth) then return false; end if;
      else
        if round(truth, 4) <> shown then return false; end if;
        if (q ->> 'r' = 'y') <> (g is not null and abs(g - round(truth, 4)) < 0.000000001) then return false; end if;
      end if;
      continue;
    end if;
    if p_mode = 'daily' and (day[i] is null or q ->> 'q' <> day[i]) then return false; end if;
    truth := private.zm_eval(q ->> 'q');
    if truth is null or jsonb_typeof(q -> 'a') not in ('number', 'string') or truth <> (q ->> 'a')::numeric then return false; end if;
    if p_mode in ('standard', 'daily', 'sub-borrow', 'sub-easy') then
      m := regexp_match(q ->> 'q', '^(\d+) ([+–×÷]) (\d+)$');
      if m is null then return false; end if;
      x := m[1]::int; y := m[3]::int;
      if not (case m[2]
          when '+' then p_mode in ('standard', 'daily') and x between 2 and 100 and y between 2 and 100
          when '–' then y between 2 and 100 and x - y between 2 and 100
            and (p_mode in ('standard', 'daily') or (p_mode = 'sub-borrow') = (y % 10 > x % 10))
          when '×' then p_mode in ('standard', 'daily') and x between 2 and 12 and y between 2 and 100
          else p_mode in ('standard', 'daily') and y between 2 and 12 and x % y = 0 and x / y between 2 and 100 end) then
        return false;
      end if;
    elsif p_mode in ('sq99', 'sq99h', 'sq999', 'sq999h') then
      m := regexp_match(q ->> 'q', '^(\d+)²$');
      if m is null then return false; end if;
      x := m[1]::int;
      if not (case when p_mode like 'sq99%' and p_mode not like 'sq999%' then x between 1 and 99 else x between 100 and 999 end)
         or (p_mode in ('sq99h', 'sq999h') and (x % 5 = 0 or (p_mode = 'sq99h' and x <= 20))) then
        return false;
      end if;
    end if;
  end loop;
  return true;
exception when others then return false;
end $$;
-- The day's seed (the secret salt is out of players' reach, so the score check asks this).
create or replace function private.daily_seed(p_date date) returns int
language sql stable security definer set search_path = '' as $$
  select ('x' || substr(md5(salt || p_date::text), 1, 8))::bit(32)::int from public.daily_salt;
$$;
revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

-- Each save is checked here. First, limits that keep one account from filling the database: 20,000
-- games and 50 MB of question logs in all, and 1,000 saves or 25 MB of logs an hour (plenty for
-- importing years of history). Then whether the
-- game counts for the leaderboard: it was played in the browser game, scored at least a point, and
-- its question log holds up, with one entry per point scored, every answer timed at 150 ms or more,
-- and the times adding up to no more than the game's length (the run's length for endless).
-- The quant tests are marked right minus wrong, so their logs hold every question answered or
-- skipped (at most the test's count, each marked r = y, n or s) and the score must be rights
-- minus wrongs. Every answer must hold up too (private.answers_hold: right, in the game's ranges,
-- and for the daily challenge the day's own questions). Hand-logged scores never count.
-- The daily challenge is played once a day: a second one for the same day is dropped without an
-- error (so a batch of imported games still saves the rest), and it counts only on a date within
-- a day of the database's own (time zones).
create or replace function public.check_score() returns trigger
language plpgsql set search_path = '' as $$
declare n int; bad int; total numeric; fastest numeric; rights int; wrongs int; utc date := (now() at time zone 'utc')::date;
begin
  if new.mode = 'daily' and exists (select 1 from public.scores where user_id = new.user_id and mode = 'daily' and date = new.date) then
    return null;
  end if;
  if (select count(*) from public.scores where user_id = new.user_id) >= 20000 then
    raise exception 'This account has reached its limit of 20,000 games.';
  end if;
  if (select count(*) from public.scores where user_id = new.user_id and created_at > now() - interval '1 hour') >= 1000 then
    raise exception 'Too many saves in the last hour. Try again later.';
  end if;
  if new.detail is not null then
    if (select coalesce(sum(pg_column_size(detail)), 0) from public.scores where user_id = new.user_id) + pg_column_size(new.detail) > 50000000 then
      raise exception 'This account has reached its limit of 50 MB of question timings.';
    end if;
    if (select coalesce(sum(pg_column_size(detail)), 0) from public.scores where user_id = new.user_id and created_at > now() - interval '1 hour') > 25000000 then
      raise exception 'Too many question timings saved in the last hour. Try again later.';
    end if;
  end if;
  new.verified := false;
  if new.source <> 'game' or new.mode = 'guided' or new.detail is null or new.date > utc + 1
     or (new.mode = 'daily' and (new.date < utc - 1 or not public.daily_started(new.user_id, new.date))) then
    return new;
  end if;
  n := jsonb_array_length(new.detail);
  select count(*) filter (where coalesce(jsonb_typeof(q -> 't'), '') <> 'number') into bad
    from jsonb_array_elements(new.detail) q;
  if new.mode in ('o80', 'seq', 'frac', 'est') then
    if new.score = 0 or n > (case new.mode when 'o80' then 80 when 'seq' then 30 when 'frac' then 60 else 40 end) or bad > 0 then
      return new;
    end if;
    select count(*) filter (where q ->> 'r' = 'y'), count(*) filter (where q ->> 'r' = 'n'),
           coalesce(sum((q ->> 't')::numeric), 0), coalesce(min((q ->> 't')::numeric) filter (where q ->> 'r' <> 's'), 150)
      into rights, wrongs, total, fastest from jsonb_array_elements(new.detail) q;
    new.verified := new.score = greatest(0, rights - wrongs) and fastest >= 150
      and new.elapsed between 1 and new.seconds and total <= new.elapsed * 1000 + 2000
      and private.answers_hold(new.mode, new.detail, null);
    return new;
  end if;
  if new.score = 0 or n <> new.score or bad > 0 then return new; end if;
  select coalesce(sum((q ->> 't')::numeric), 0), coalesce(min((q ->> 't')::numeric), 150)
    into total, fastest from jsonb_array_elements(new.detail) q;
  new.verified := fastest >= 150 and case
    when new.seconds > 0 then total <= new.seconds * 1000 + 2000
    else new.elapsed > 0 and total <= new.elapsed * 1000 + 2000 end
    and private.answers_hold(new.mode, new.detail, case when new.mode = 'daily' then private.daily_seed(new.date) end);
  return new;
end $$;
drop trigger if exists scores_check on public.scores;
create trigger scores_check before insert on public.scores
  for each row execute function public.check_score();

-- ---- leaderboard ---------------------------------------------------------------------------
-- Each player's best verified game per board: names and figures only, readable by anyone. On the
-- quant tests' boards a tie on score goes to fewer wrong answers, then the faster finish.
-- leaderboard_week is the same for games played this week (from Monday), and daily_board is every
-- daily challenge result, one a player a day. The squares boards count games from 1 October 2026,
-- when numbers ending in 0 left the squares game (earlier games were on an easier set).
create or replace function public.wrongs_in(p_mode text, p_detail jsonb) returns int
language sql immutable set search_path = '' as $$
  select case when p_mode in ('o80', 'seq', 'frac', 'est') then (select count(*)::int from jsonb_array_elements(p_detail) q where q ->> 'r' = 'n') end;
$$;
create or replace view public.leaderboard with (security_invoker = false) as
  select distinct on (s.user_id, s.mode, s.seconds)
    p.username, s.mode, s.seconds, s.score, s.elapsed, s.date, public.wrongs_in(s.mode, s.detail) as wrongs
  from public.scores s join public.profiles p on p.id = s.user_id
  where s.verified and not p.private and s.mode not in ('daily', 'drill')
    and not (s.mode in ('sq99h', 'sq999h') and s.date < date '2026-10-01')
  order by s.user_id, s.mode, s.seconds, s.score desc, wrongs asc nulls last, s.elapsed asc, s.ts asc;
create or replace view public.leaderboard_week with (security_invoker = false) as
  select distinct on (s.user_id, s.mode, s.seconds)
    p.username, s.mode, s.seconds, s.score, s.elapsed, s.date, public.wrongs_in(s.mode, s.detail) as wrongs
  from public.scores s join public.profiles p on p.id = s.user_id
  where s.verified and not p.private and s.mode not in ('daily', 'drill')
    and not (s.mode in ('sq99h', 'sq999h') and s.date < date '2026-10-01')
    and s.date >= date_trunc('week', now() at time zone 'utc')::date
  order by s.user_id, s.mode, s.seconds, s.score desc, wrongs asc nulls last, s.elapsed asc, s.ts asc;
create or replace view public.daily_board with (security_invoker = false) as
  select p.username, s.date, s.score
  from public.scores s join public.profiles p on p.id = s.user_id
  where s.mode = 'daily' and s.verified and not p.private;
revoke all on public.leaderboard, public.leaderboard_week, public.daily_board from public;
grant select on public.leaderboard, public.leaderboard_week, public.daily_board to anon, authenticated;

-- The boards in order, worked out here so a page fetches only what it shows. Places follow the
-- leaderboard's rules: best score, then on endless the faster run, on the quant tests fewer wrong
-- answers and then the faster finish; players level on all of that share a place.
create or replace function private.board_rows(p_week boolean, p_mode text default null, p_seconds int default null)
returns table (username text, mode text, seconds int, score int, elapsed int, date date, wrongs int, place bigint, pos bigint, total bigint)
language sql stable set search_path = '' as $$
  select l.*,
    rank() over (partition by l.mode, l.seconds order by l.score desc, case when l.seconds = 0 then l.elapsed end, l.wrongs nulls last,
                 case when l.mode in ('o80', 'seq', 'frac', 'est') then nullif(l.elapsed, 0) end nulls last),
    row_number() over (partition by l.mode, l.seconds order by l.score desc, case when l.seconds = 0 then l.elapsed end, l.wrongs nulls last,
                 case when l.mode in ('o80', 'seq', 'frac', 'est') then nullif(l.elapsed, 0) end nulls last, l.date, l.username),
    count(*) over (partition by l.mode, l.seconds)
  from (select * from public.leaderboard where not coalesce(p_week, false)
        union all select * from public.leaderboard_week where coalesce(p_week, false)) l
  where (p_mode is null or l.mode = p_mode) and (p_seconds is null or l.seconds = p_seconds);
$$;
revoke execute on function private.board_rows(boolean, text, int) from public, anon, authenticated;  -- only through the functions below

-- One board: its first rows (100 at most), how many are on it, and the named player's row with the
-- players either side of it when it's further down.
create or replace function public.board(p_mode text, p_seconds int, p_week boolean default false, p_name text default null, p_limit int default 100)
returns jsonb language sql stable security definer set search_path = '' as $$
  with b as (select * from private.board_rows(p_week, p_mode, p_seconds)),
       me as (select pos from b where lower(username) = lower(coalesce(p_name, '')) limit 1)
  select jsonb_build_object(
    'total', coalesce((select max(total) from b), 0),
    'rows', coalesce((select jsonb_agg(to_jsonb(b) - 'mode' - 'seconds' - 'total' order by pos) from b where pos <= least(greatest(coalesce(p_limit, 100), 1), 200)), '[]'::jsonb),
    'around', coalesce((select jsonb_agg(to_jsonb(b) - 'mode' - 'seconds' - 'total' order by b.pos) from b, me
                        where b.pos between me.pos - 2 and me.pos + 2 and b.pos > least(greatest(coalesce(p_limit, 100), 1), 200)), '[]'::jsonb));
$$;

-- Every board at a glance: how many are on it, its leader, and the named player's place with the
-- nearest player ahead (for "3 to pass bea").
create or replace function public.boards(p_week boolean default false, p_name text default null)
returns jsonb language sql stable security definer set search_path = '' as $$
  with b as (select * from private.board_rows(p_week)),
       me as (select * from b where lower(username) = lower(coalesce(p_name, '')))
  select coalesce(jsonb_agg(jsonb_build_object(
    'mode', k.mode, 'seconds', k.seconds, 'total', k.total,
    'leader', (select jsonb_build_object('username', username, 'score', score) from b where b.mode = k.mode and b.seconds = k.seconds and pos = 1),
    'me', (select jsonb_build_object('place', me.place, 'score', me.score, 'elapsed', me.elapsed, 'wrongs', me.wrongs, 'ahead',
             (select jsonb_build_object('username', a.username, 'score', a.score) from b a
              where a.mode = me.mode and a.seconds = me.seconds and a.score > me.score order by a.score, a.pos desc limit 1))
           from me where me.mode = k.mode and me.seconds = k.seconds))), '[]'::jsonb)
  from (select distinct mode, seconds, total from b) k;
$$;

-- Where a score stands on a board: how many other players' bests it beats, out of how many (the
-- named player left out). Null with fewer than 5 others, when a percentage would mean little.
create or replace function public.standing(p_mode text, p_seconds int, p_score int, p_name text default null)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when count(*) >= 5 then jsonb_build_object('beats', count(*) filter (where score < p_score), 'of', count(*)) end
  from public.leaderboard where mode = p_mode and seconds = p_seconds and lower(username) <> lower(coalesce(p_name, ''));
$$;
revoke execute on function public.board(text, int, boolean, text, int), public.boards(boolean, text), public.standing(text, int, int, text) from public;
grant execute on function public.board(text, int, boolean, text, int), public.boards(boolean, text), public.standing(text, int, int, text) to anon, authenticated;

-- ---- deleting an account -------------------------------------------------------------------
-- Removes the signed-in player's login, profile and every score.
create or replace function public.delete_me() returns void
language sql security definer set search_path = '' as $$
  delete from auth.users where id = auth.uid();
$$;
revoke execute on function public.delete_me() from public, anon;
grant execute on function public.delete_me() to authenticated;

-- ---- private accounts ----------------------------------------------------------------------
-- Players can't edit their profile directly (the name is fixed); this switches only the privacy flag.
create or replace function public.set_private(p_private boolean) returns boolean
language sql security definer set search_path = '' as $$
  update public.profiles set private = coalesce(p_private, false) where id = auth.uid() returning private;
$$;
revoke execute on function public.set_private(boolean) from public, anon;
grant execute on function public.set_private(boolean) to authenticated;

-- ---- 1v1 matches ---------------------------------------------------------------------------
-- Two signed-in players get the same questions (built in each browser from the match's seed) and
-- the same clock. "race": first to answer all `goal` questions wins; if time runs out first, more
-- answered wins. "clock": more answered in `seconds` wins. Either way a tie goes to whoever reached
-- that score first. Players can only read their own matches; every change goes through the
-- functions below, which check each update against the clock and decide the winner themselves.
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  code text unique,                       -- private matches: what the second player types
  is_public boolean not null,
  rule text not null check (rule in ('race', 'clock')),
  game text not null check (game in ('standard', 'mixed', 'sq99', 'sq99h', 'sq999', 'sq999h')),
  goal int not null,                      -- race: questions to answer (clock: 0)
  seconds int not null,
  seed int not null default floor(random() * 2147483647)::int,
  p1 uuid references auth.users on delete set null,
  p2 uuid references auth.users on delete set null,
  p1_name text not null,
  p2_name text,
  status text not null default 'waiting' check (status in ('waiting', 'live', 'done', 'cancelled')),
  starts_at timestamptz,
  p1_score int not null default 0, p2_score int not null default 0,
  p1_ms int not null default 0, p2_ms int not null default 0,  -- when each reached their score (ms after the start)
  p1_done boolean not null default false, p2_done boolean not null default false,
  winner int check (winner in (0, 1, 2)),  -- 1 or 2 = that player, 0 = a draw
  seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists matches_queue on public.matches (game, created_at) where status = 'waiting' and is_public;
create index if not exists matches_p1 on public.matches (p1, created_at);
create index if not exists matches_p2 on public.matches (p2, created_at);
-- Added later: ranked duels, "any problems" in the unranked queue, and rematches.
alter table public.matches add column if not exists ranked boolean not null default false;
alter table public.matches add column if not exists p1_elo int;    -- ranked: each player's rating when the match started
alter table public.matches add column if not exists p2_elo int;
alter table public.matches add column if not exists p1_delta int;  -- ranked: each player's rating change
alter table public.matches add column if not exists p2_delta int;
alter table public.matches add column if not exists rematch_code text;  -- a rematch offered after this match
alter table public.matches add column if not exists rematch_by int;     -- by which player (1 or 2)
-- A challenge: a private match made for one named player, who sees it on their Duel page.
alter table public.matches add column if not exists invitee uuid references auth.users on delete set null;
create index if not exists matches_invitee on public.matches (invitee) where status = 'waiting';
alter table public.matches drop constraint if exists matches_game_check;
alter table public.matches add constraint matches_game_check
  check (game in ('standard', 'mixed', 'sq99', 'sq99h', 'sq999', 'sq999h', 'any'));  -- 'any' only while waiting
alter table public.matches enable row level security;
drop policy if exists "read own matches" on public.matches;
create policy "read own matches" on public.matches for select to authenticated
  using ((select auth.uid()) in (p1, p2));
revoke all on public.matches from anon, authenticated;
grant select on public.matches to authenticated;

-- Ranked duels: each player's Elo rating (everyone starts at 1000). Only the database changes it,
-- when a ranked match is settled. Players read their own row; the ladder view shows everyone who
-- has played their 5 placement matches, except private accounts.
create table if not exists public.ratings (
  user_id uuid primary key references auth.users on delete cascade,
  elo int not null default 1000,
  games int not null default 0,
  wins int not null default 0,
  losses int not null default 0,
  draws int not null default 0,
  peak int not null default 1000,
  updated_at timestamptz not null default now()
);
alter table public.ratings enable row level security;
drop policy if exists "read own rating" on public.ratings;
create policy "read own rating" on public.ratings for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.ratings from anon, authenticated;
grant select on public.ratings to authenticated;

-- Seasons: one a quarter (2026-Q4 and so on). When a new one starts, each rating moves halfway
-- back to 1000 and the season's wins and losses start over; the season that ended is kept in
-- season_peaks with its highest rating (the badge for the best rank reached). Ratings roll over
-- the next time the player is rated or opens Duel (mm_roll); until then everything that shows a
-- rating shows the rolled-over figure (mm_elo).
alter table public.ratings add column if not exists season text;
create or replace function public.season_now() returns text
language sql stable set search_path = '' as $$ select to_char(now() at time zone 'utc', 'YYYY-"Q"Q'); $$;
update public.ratings set season = public.season_now() where season is null;
alter table public.ratings alter column season set default public.season_now();
create or replace function public.mm_elo(p_elo int, p_season text) returns int
language sql stable set search_path = '' as $$
  select case when p_season = public.season_now() then p_elo else 1000 + round((p_elo - 1000) / 2.0)::int end;
$$;
create table if not exists public.season_peaks (
  user_id uuid not null references auth.users on delete cascade,
  season text not null,
  peak int not null,
  elo int not null,
  primary key (user_id, season)
);
alter table public.season_peaks enable row level security;
drop policy if exists "read own seasons" on public.season_peaks;
create policy "read own seasons" on public.season_peaks for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.season_peaks from anon, authenticated;
grant select on public.season_peaks to authenticated;
create or replace function public.mm_roll(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.ratings; s text := public.season_now();
begin
  select * into r from public.ratings where user_id = p_user for update;
  if not found or r.season = s then return; end if;
  if r.wins + r.losses + r.draws > 0 then
    insert into public.season_peaks (user_id, season, peak, elo) values (p_user, r.season, r.peak, r.elo) on conflict do nothing;
  end if;
  update public.ratings set elo = public.mm_elo(r.elo, r.season), peak = public.mm_elo(r.elo, r.season),
    wins = 0, losses = 0, draws = 0, season = s where user_id = p_user;
end $$;

drop view if exists public.ladder;
create view public.ladder with (security_invoker = false) as
  select p.username, public.mm_elo(r.elo, r.season) as elo, r.games,
    case when r.season = public.season_now() then r.wins else 0 end as wins,
    case when r.season = public.season_now() then r.losses else 0 end as losses,
    case when r.season = public.season_now() then r.draws else 0 end as draws,
    case when r.season = public.season_now() then r.peak else public.mm_elo(r.elo, r.season) end as peak
  from public.ratings r join public.profiles p on p.id = r.user_id
  where r.games >= 5 and not p.private;
revoke all on public.ladder from public;
grant select on public.ladder to anon, authenticated;

create or replace function public.mm_rating(p_user uuid) returns int
language sql stable security definer set search_path = '' as $$
  select coalesce((select public.mm_elo(elo, season) from public.ratings where user_id = p_user), 1000);
$$;

-- Your rating for the Duel page (rolled into this season first) and your past seasons.
create or replace function public.mm_me() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  perform public.mm_roll(auth.uid());
  return jsonb_build_object(
    'season', public.season_now(),
    'rating', (select to_jsonb(r) - 'user_id' from public.ratings r where r.user_id = auth.uid()),
    'seasons', coalesce((select jsonb_agg(jsonb_build_object('season', season, 'peak', peak, 'elo', elo) order by season desc)
                         from public.season_peaks where user_id = auth.uid()), '[]'::jsonb));
end $$;

-- What the functions hand back: the match, plus the database's clock so both browsers can agree
-- when the match starts.
create or replace function public.mm_out(m public.matches) returns jsonb
language sql stable set search_path = '' as $$
  select to_jsonb(m) || jsonb_build_object('server_now', clock_timestamp());
$$;

-- Decides a live match once it can be decided: both players are done, the time plus a few
-- seconds' grace is up, or (in a race) someone finished and the other had 3 seconds to report
-- an earlier finish.
create or replace function public.mm_settle(m public.matches) returns public.matches
language plpgsql security definer set search_path = '' as $$
declare since int; w int; mid uuid := m.id; r1 int; r2 int; g1 int; g2 int; e1 numeric; s1 numeric; d1 int := 0; d2 int := 0;
begin
  if m.status <> 'live' then return m; end if;
  since := (extract(epoch from clock_timestamp() - m.starts_at) * 1000)::int;
  if not ((m.p1_done and m.p2_done) or since > m.seconds * 1000 + 5000
          or (m.rule = 'race' and ((m.p1_done and since > m.p1_ms + 3000) or (m.p2_done and since > m.p2_ms + 3000)))) then
    return m;
  end if;
  w := case
    when m.p1_score > m.p2_score then 1
    when m.p2_score > m.p1_score then 2
    when m.p1_score = 0 then 0
    when m.p1_ms < m.p2_ms then 1
    when m.p2_ms < m.p1_ms then 2
    else 0 end;
  -- Only one caller settles a match (the other finds it already done), so a rating moves once.
  update public.matches set status = 'done', winner = w where id = mid and status = 'live' returning * into m;
  if not found then
    select * into m from public.matches where id = mid;
    return m;
  end if;
  -- Ranked: Elo. Placement matches (the first 5) move a rating faster. The same two players only
  -- move each other's ratings in their first 3 ranked matches of a day, so two accounts can't farm.
  if m.ranked and m.p1 is not null and m.p2 is not null
     and (select count(*) from public.matches x where x.ranked and x.status = 'done' and x.id <> mid
          and x.created_at > now() - interval '1 day'
          and ((x.p1 = m.p1 and x.p2 = m.p2) or (x.p1 = m.p2 and x.p2 = m.p1))) < 3 then
    insert into public.ratings (user_id) values (m.p1), (m.p2) on conflict (user_id) do nothing;
    perform public.mm_roll(m.p1);
    perform public.mm_roll(m.p2);
    select elo, games into r1, g1 from public.ratings where user_id = m.p1 for update;
    select elo, games into r2, g2 from public.ratings where user_id = m.p2 for update;
    e1 := 1 / (1 + power(10, (r2 - r1) / 400.0));
    s1 := case w when 1 then 1 when 2 then 0 else 0.5 end;
    d1 := round((case when g1 < 5 then 40 else 24 end) * (s1 - e1));
    d2 := round((case when g2 < 5 then 40 else 24 end) * ((1 - s1) - (1 - e1)));
    update public.ratings set elo = elo + d1, games = games + 1, wins = wins + (w = 1)::int, losses = losses + (w = 2)::int,
      draws = draws + (w = 0)::int, peak = greatest(peak, elo + d1), updated_at = now() where user_id = m.p1;
    update public.ratings set elo = elo + d2, games = games + 1, wins = wins + (w = 2)::int, losses = losses + (w = 1)::int,
      draws = draws + (w = 0)::int, peak = greatest(peak, elo + d2), updated_at = now() where user_id = m.p2;
  end if;
  if m.ranked then
    update public.matches set p1_delta = d1, p2_delta = d2 where id = mid returning * into m;
  end if;
  return m;
end $$;

create or replace function public.mm_name() returns text
language sql stable security definer set search_path = '' as $$
  select username from public.profiles where id = auth.uid();
$$;

-- Leaves any match you're still waiting in, and keeps one account from flooding the table.
create or replace function public.mm_ready() returns text
language plpgsql security definer set search_path = '' as $$
declare nm text := public.mm_name();
begin
  if auth.uid() is null or nm is null then raise exception 'Sign in to play 1v1.'; end if;
  update public.matches set status = 'cancelled' where p1 = auth.uid() and status = 'waiting';
  if (select count(*) from public.matches where p1 = auth.uid() and created_at > now() - interval '1 hour') >= 120 then
    raise exception 'Too many matches in the last hour. Try again later.';
  end if;
  return nm;
end $$;

-- Public queue. Public matches are always a race to 25 with a 2:00 limit.
--  - Ranked: always arithmetic; pairs you with the waiting player whose rating is closest to yours.
--  - Unranked: pairs you with someone who picked the same problems, or 'any'. Two 'any' players get
--    arithmetic; 'any' with a specific choice gets that choice.
drop function if exists public.mm_queue(text);
create or replace function public.mm_queue(p_game text, p_ranked boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare nm text := public.mm_ready(); m public.matches; my int := public.mm_rating(auth.uid()); v_ranked boolean := coalesce(p_ranked, false); g text := p_game;
begin
  if v_ranked then g := 'standard'; end if;
  if g not in ('standard', 'mixed', 'sq99', 'sq99h', 'sq999', 'sq999h', 'any') then raise exception 'Unknown game.'; end if;
  if v_ranked then
    select * into m from public.matches
      where is_public and ranked and status = 'waiting' and p1 <> auth.uid() and seen_at > now() - interval '6 seconds'
      order by abs(coalesce(p1_elo, 1000) - my), created_at limit 1 for update skip locked;
  else
    select * into m from public.matches
      where is_public and not ranked and status = 'waiting' and p1 <> auth.uid() and seen_at > now() - interval '6 seconds'
        and (g = 'any' or game in (g, 'any'))
      order by created_at limit 1 for update skip locked;
  end if;
  if found then
    update public.matches set p2 = auth.uid(), p2_name = nm, p2_elo = case when v_ranked then my end, status = 'live',
      starts_at = clock_timestamp() + interval '6 seconds',
      game = case when game <> 'any' then game when g <> 'any' then g else 'standard' end
      where id = m.id returning * into m;
  else
    insert into public.matches (is_public, ranked, rule, game, goal, seconds, p1, p1_name, p1_elo)
      values (true, v_ranked, 'race', g, 25, 120, auth.uid(), nm, case when v_ranked then my end) returning * into m;
  end if;
  return public.mm_out(m);
end $$;

-- A six-character code no match has used.
create or replace function public.mm_code() returns text
language plpgsql set search_path = '' as $$
declare c text;
begin
  loop
    select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '') into c from generate_series(1, 6);
    exit when not exists (select 1 from public.matches where code = c);
  end loop;
  return c;
end $$;

-- Private match: a six-character code for a friend to type.
create or replace function public.mm_create(p_game text, p_rule text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare nm text := public.mm_ready(); m public.matches; c text;
begin
  if p_game not in ('standard', 'mixed', 'sq99', 'sq99h', 'sq999', 'sq999h') then raise exception 'Unknown game.'; end if;
  if p_rule not in ('race', 'clock') then raise exception 'Unknown rule.'; end if;
  c := public.mm_code();
  insert into public.matches (code, is_public, rule, game, goal, seconds, p1, p1_name)
    values (c, false, p_rule, p_game, case when p_rule = 'race' then 25 else 0 end, 120, auth.uid(), nm) returning * into m;
  return public.mm_out(m);
end $$;

create or replace function public.mm_join(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare nm text := public.mm_ready(); m public.matches;
begin
  select * into m from public.matches where code = upper(trim(p_code)) and not is_public for update;
  if not found then raise exception 'No match has that code. Check it and try again.'; end if;
  if m.p1 = auth.uid() then raise exception 'That’s your own code. Send it to your opponent.'; end if;
  if m.status <> 'waiting' or m.seen_at < now() - interval '6 seconds' then raise exception 'That match has already started or closed. Ask for a new code.'; end if;
  if m.invitee is not null and m.invitee <> auth.uid() then raise exception 'That challenge is for another player.'; end if;
  update public.matches set p2 = auth.uid(), p2_name = nm, status = 'live', starts_at = clock_timestamp() + interval '6 seconds'
    where id = m.id returning * into m;
  return public.mm_out(m);
end $$;

-- Challenges: a private match for one named player. It waits like a code match (the challenger's
-- page keeps it open), and the other player sees it on their Duel page (mm_invites) to accept
-- (mm_join with its code) or decline.
create or replace function public.mm_challenge(p_name text, p_game text, p_rule text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare nm text; m public.matches; v_to uuid; v_name text;
begin
  if p_game not in ('standard', 'mixed', 'sq99', 'sq99h', 'sq999', 'sq999h') then raise exception 'Unknown game.'; end if;
  if p_rule not in ('race', 'clock') then raise exception 'Unknown rule.'; end if;
  select id, username into v_to, v_name from public.profiles where lower(username) = lower(btrim(coalesce(p_name, '')));
  if not found then raise exception 'No player has that name.'; end if;
  if v_to = auth.uid() then raise exception 'That’s your own name.'; end if;
  nm := public.mm_ready();
  insert into public.matches (code, is_public, rule, game, goal, seconds, p1, p1_name, p2_name, invitee)
    values (public.mm_code(), false, p_rule, p_game, case when p_rule = 'race' then 25 else 0 end, 120, auth.uid(), nm, v_name, v_to) returning * into m;
  return public.mm_out(m);
end $$;

create or replace function public.mm_invites() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'code', code, 'from', p1_name, 'game', game, 'rule', rule, 'goal', goal, 'seconds', seconds) order by created_at desc), '[]'::jsonb)
  from (select * from public.matches where invitee = auth.uid() and status = 'waiting' and seen_at > now() - interval '6 seconds'
        order by created_at desc limit 5) x;
$$;

create or replace function public.mm_decline(p_id uuid) returns void
language sql security definer set search_path = '' as $$
  update public.matches set status = 'cancelled' where id = p_id and invitee = auth.uid() and status = 'waiting';
$$;

-- A ghost to race while the queue is empty: a real saved 2-minute arithmetic game that reached 25,
-- replayed answer by answer. Your own best, or a game by the player nearest your rating (never a
-- private account's). Only the first 25 questions and their times are handed out.
create or replace function public.mm_ghost(p_mine boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_user uuid; s public.scores; my int := public.mm_rating(auth.uid());
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if coalesce(p_mine, false) then
    v_user := auth.uid();
  else
    select x.user_id into v_user from (
      select distinct s2.user_id from public.scores s2 join public.profiles p on p.id = s2.user_id
      where s2.mode = 'standard' and s2.seconds = 120 and s2.verified and s2.score >= 25 and s2.user_id <> auth.uid() and not p.private) x
    order by abs(public.mm_rating(x.user_id) - my), random() limit 1;
    if not found then return null; end if;
  end if;
  select * into s from public.scores where user_id = v_user and mode in ('standard', 'daily') and seconds = 120 and verified and score >= 25
    order by case when coalesce(p_mine, false) then score end desc nulls last, random() limit 1;
  if not found then return null; end if;
  return jsonb_build_object('name', (select username from public.profiles where id = v_user), 'mine', v_user = auth.uid(),
    'score', s.score, 'date', s.date, 'rating', public.mm_rating(v_user),
    'log', (select jsonb_agg(jsonb_build_object('q', q -> 'q', 'a', q -> 'a', 't', q -> 't') order by i)
            from jsonb_array_elements(s.detail) with ordinality as e(q, i) where i <= 25));
end $$;

-- Polled about once a second by both players: keeps a waiting match open, and settles a match
-- whose time is up.
create or replace function public.mm_poll(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare m public.matches;
begin
  select * into m from public.matches where id = p_id and auth.uid() in (p1, p2);
  if not found then raise exception 'Match not found.'; end if;
  if m.status = 'waiting' then
    update public.matches set seen_at = now() where id = m.id returning * into m;
  end if;
  return public.mm_out(public.mm_settle(m));
end $$;

-- Rematch: either player, once a match is over. The first to ask opens a private match with the
-- same problems and rule (always unranked) and offers it on the old match; the other player's
-- Rematch joins it. Asking again returns your own offer.
create or replace function public.mm_rematch(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare nm text; old public.matches; m public.matches; c text; seat int;
begin
  select * into old from public.matches where id = p_id and auth.uid() in (p1, p2) for update;
  if not found then raise exception 'Match not found.'; end if;
  if old.status <> 'done' then raise exception 'The match isn’t over yet.'; end if;
  if old.p1 is null or old.p2 is null then raise exception 'Your opponent’s account is gone.'; end if;
  seat := case when old.p1 = auth.uid() then 1 else 2 end;
  if old.rematch_code is not null then
    select * into m from public.matches where code = old.rematch_code for update;
    if found and m.status = 'waiting' and m.seen_at > now() - interval '6 seconds' then
      if old.rematch_by = seat then return public.mm_out(m); end if;  -- your own offer, still open
      nm := public.mm_ready();
      update public.matches set p2 = auth.uid(), p2_name = nm, status = 'live', starts_at = clock_timestamp() + interval '6 seconds'
        where id = m.id returning * into m;
      return public.mm_out(m);
    end if;
  end if;
  nm := public.mm_ready();
  c := public.mm_code();
  insert into public.matches (code, is_public, rule, game, goal, seconds, p1, p1_name)
    values (c, false, old.rule, old.game, old.goal, old.seconds, auth.uid(), nm) returning * into m;
  update public.matches set rematch_code = c, rematch_by = seat where id = old.id;
  return public.mm_out(m);
end $$;

create or replace function public.mm_cancel(p_id uuid) returns void
language sql security definer set search_path = '' as $$
  update public.matches set status = 'cancelled' where id = p_id and p1 = auth.uid() and status = 'waiting';
$$;

-- A player's progress: their score so far and when they reached it (ms after the start). Scores
-- only go up, never past the race's goal, never faster than 150 ms an answer, and never ahead of
-- the database's own clock (with 2 seconds' allowance for the network).
create or replace function public.mm_score(p_id uuid, p_score int, p_ms int, p_done boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare m public.matches; me int; since int;
begin
  select * into m from public.matches where id = p_id and auth.uid() in (p1, p2) for update;
  if not found then raise exception 'Match not found.'; end if;
  if m.status <> 'live' then return public.mm_out(m); end if;
  me := case when m.p1 = auth.uid() then 1 else 2 end;
  since := (extract(epoch from clock_timestamp() - m.starts_at) * 1000)::int;
  if since < 0 or since > m.seconds * 1000 + 5000 then return public.mm_out(public.mm_settle(m)); end if;
  if (me = 1 and m.p1_done) or (me = 2 and m.p2_done) then return public.mm_out(public.mm_settle(m)); end if;
  if p_score < (case me when 1 then m.p1_score else m.p2_score end)
     or p_ms < (case me when 1 then m.p1_ms else m.p2_ms end)
     or p_ms > since + 2000 or p_ms > m.seconds * 1000
     or p_score * 150 > p_ms + 150
     or (m.rule = 'race' and p_score > m.goal)
     or (p_done and m.rule = 'race' and p_score < m.goal and since < m.seconds * 1000 - 2000)
     or (p_done and m.rule = 'clock' and since < m.seconds * 1000 - 2000) then
    raise exception 'That update doesn''t fit the match clock.';
  end if;
  if me = 1 then
    update public.matches set p1_score = p_score, p1_ms = p_ms, p1_done = p_done where id = m.id returning * into m;
  else
    update public.matches set p2_score = p_score, p2_ms = p_ms, p2_done = p_done where id = m.id returning * into m;
  end if;
  return public.mm_out(public.mm_settle(m));
end $$;

revoke execute on function public.mm_out(public.matches), public.mm_settle(public.matches), public.mm_name(), public.mm_ready(), public.mm_rating(uuid), public.mm_roll(uuid), public.mm_code() from public, anon, authenticated;
revoke execute on function public.mm_queue(text, boolean), public.mm_create(text, text), public.mm_join(text), public.mm_poll(uuid), public.mm_cancel(uuid), public.mm_score(uuid, int, int, boolean), public.mm_rematch(uuid),
  public.mm_me(), public.mm_challenge(text, text, text), public.mm_invites(), public.mm_decline(uuid), public.mm_ghost(boolean) from public, anon;
grant execute on function public.mm_queue(text, boolean), public.mm_create(text, text), public.mm_join(text), public.mm_poll(uuid), public.mm_cancel(uuid), public.mm_score(uuid, int, int, boolean), public.mm_rematch(uuid),
  public.mm_me(), public.mm_challenge(text, text, text), public.mm_invites(), public.mm_decline(uuid), public.mm_ghost(boolean) to authenticated;

-- ---- after a duel: quick chat ---------------------------------------------------------------
-- The two players can talk once the match is over: short messages (a "gg", an emoji), readable
-- only by the players of that match, added only through mm_say.
create table if not exists public.match_messages (
  id bigint generated always as identity primary key,
  match_id uuid not null references public.matches on delete cascade,
  seat int not null check (seat in (1, 2)),
  body text not null check (char_length(body) between 1 and 120),
  created_at timestamptz not null default now()
);
create index if not exists match_messages_match on public.match_messages (match_id, id);
alter table public.match_messages enable row level security;
drop policy if exists "read own match messages" on public.match_messages;
create policy "read own match messages" on public.match_messages for select to authenticated
  using (exists (select 1 from public.matches m where m.id = match_id and (select auth.uid()) in (m.p1, m.p2)));
revoke all on public.match_messages from anon, authenticated;
grant select on public.match_messages to authenticated;

create or replace function public.mm_say(p_id uuid, p_text text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare m public.matches; v_seat int; v_body text := btrim(regexp_replace(coalesce(p_text, ''), '[[:cntrl:]]', ' ', 'g')); msg public.match_messages;
begin
  select * into m from public.matches where id = p_id and auth.uid() in (p1, p2);
  if not found then raise exception 'Match not found.'; end if;
  if m.status <> 'done' then raise exception 'Chat opens when the match is over.'; end if;
  if char_length(v_body) = 0 then raise exception 'Say something first.'; end if;
  if char_length(v_body) > 120 then raise exception 'Keep it under 120 characters.'; end if;
  v_seat := case when m.p1 = auth.uid() then 1 else 2 end;
  if (select count(*) from public.match_messages where match_id = m.id and match_messages.seat = v_seat and created_at > now() - interval '30 seconds') >= 8 then
    raise exception 'Slow down a little.';
  end if;
  if (select count(*) from public.match_messages where match_id = m.id and match_messages.seat = v_seat) >= 60 then
    raise exception 'That’s the most messages for one match.';
  end if;
  insert into public.match_messages (match_id, seat, body) values (m.id, v_seat, v_body) returning * into msg;
  return to_jsonb(msg);
end $$;
revoke execute on function public.mm_say(uuid, text) from public, anon;
grant execute on function public.mm_say(uuid, text) to authenticated;

-- ---- public profiles -----------------------------------------------------------------------
-- profile.html#name: a player's bests on each board (with where each stands), duel rating and past
-- seasons, and how many games they played each day of the last 13 weeks. Private accounts have no profile.
create or replace function public.profile(p_name text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_id uuid; v_name text; v_joined timestamptz;
begin
  select id, username, created_at into v_id, v_name, v_joined from public.profiles
    where lower(username) = lower(btrim(coalesce(p_name, ''))) and not private;
  if not found then return null; end if;
  return jsonb_build_object(
    'username', v_name, 'joined', v_joined::date,
    'bests', coalesce((select jsonb_agg(jsonb_build_object('mode', mode, 'seconds', seconds, 'score', score, 'elapsed', elapsed, 'wrongs', wrongs, 'date', date,
                                                         'standing', public.standing(mode, seconds, score, v_name)))
                       from public.leaderboard where username = v_name), '[]'::jsonb),
    'rating', (select jsonb_build_object('elo', elo, 'games', games, 'wins', wins, 'losses', losses, 'draws', draws, 'peak', peak)
               from public.ladder where username = v_name),
    'seasons', coalesce((select jsonb_agg(jsonb_build_object('season', season, 'peak', peak) order by season desc)
                         from public.season_peaks where user_id = v_id), '[]'::jsonb),
    'days', coalesce((select jsonb_object_agg(d, n) from (select date::text d, count(*) n from public.scores
                       where user_id = v_id and date > (now() at time zone 'utc')::date - 98 and mode <> 'guided' group by date) x), '{}'::jsonb));
end $$;
revoke execute on function public.profile(text) from public;
grant execute on function public.profile(text) to anon, authenticated;

-- ---- errors from the site ------------------------------------------------------------------
-- When a page hits an error, it reports it here (log_error), so problems show up without anyone
-- having to write in. Read them in the Supabase table editor (client_errors); nobody else can.
-- Kept small: short fields, at most 60 reports a minute from everyone together, the newest 5,000.
create table if not exists public.client_errors (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  page text not null,
  message text not null,
  detail text,
  agent text,
  user_id uuid references auth.users on delete set null
);
alter table public.client_errors enable row level security;
revoke all on public.client_errors from anon, authenticated;
create or replace function public.log_error(p_page text, p_message text, p_detail text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.client_errors where at > now() - interval '1 minute') >= 60 then return; end if;
  insert into public.client_errors (page, message, detail, agent, user_id)
    values (left(coalesce(p_page, ''), 200), left(coalesce(nullif(btrim(p_message), ''), 'unknown'), 500), left(p_detail, 2000),
            left(nullif(current_setting('request.headers', true), '')::json ->> 'user-agent', 300), auth.uid());
  delete from public.client_errors where id <= (select id from public.client_errors order by id desc offset 5000 limit 1);
end $$;
revoke execute on function public.log_error(text, text, text) from public;
grant execute on function public.log_error(text, text, text) to anon, authenticated;
