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
  seconds int not null check (seconds in (0, 30, 120, 480)),
  source text not null check (source in ('game', 'manual')),
  mode text not null check (mode in ('standard', 'sq99', 'sq99h', 'sq999', 'sq999h', 'sub-borrow', 'sub-easy', 'guided', 'mixed', 'o80')),
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
alter table public.scores drop constraint if exists scores_mode_check;
alter table public.scores add constraint scores_mode_check
  check (mode in ('standard', 'sq99', 'sq99h', 'sq999', 'sq999h', 'sub-borrow', 'sub-easy', 'guided', 'mixed', 'o80'));
-- Game lengths: endless (0), 30 s, 2 minutes, and 8 minutes for the 80-in-8 test only.
alter table public.scores drop constraint if exists scores_seconds_check;
alter table public.scores add constraint scores_seconds_check
  check (seconds in (0, 30, 120) or (seconds = 480 and mode = 'o80'));
alter table public.scores drop constraint if exists scores_o80_length;
alter table public.scores add constraint scores_o80_length check (mode <> 'o80' or (seconds = 480 and score <= 80));
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

-- Each save is checked here. First, limits that keep one account from filling the database: 20,000
-- games and 50 MB of question logs in all, and 1,000 saves or 25 MB of logs an hour (plenty for
-- importing years of history). Then whether the
-- game counts for the leaderboard: it was played in the browser game, scored at least a point, and
-- its question log holds up, with one entry per point scored, every answer timed at 150 ms or more,
-- and the times adding up to no more than the game's length (the run's length for endless).
-- The 80-in-8 test is marked right minus wrong, so its log holds every question answered or
-- skipped (at most 80, each marked r = y, n or s) and the score must be rights minus wrongs.
-- Hand-logged scores never count.
create or replace function public.check_score() returns trigger
language plpgsql set search_path = '' as $$
declare n int; bad int; total numeric; fastest numeric; rights int; wrongs int;
begin
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
  if new.source <> 'game' or new.mode = 'guided' or new.detail is null
     or new.date > (now() at time zone 'utc')::date + 1 then
    return new;
  end if;
  n := jsonb_array_length(new.detail);
  select count(*) filter (where coalesce(jsonb_typeof(q -> 't'), '') <> 'number') into bad
    from jsonb_array_elements(new.detail) q;
  if new.mode = 'o80' then
    if new.seconds <> 480 or new.score = 0 or n > 80 or bad > 0 then return new; end if;
    select count(*) filter (where q ->> 'r' = 'y'), count(*) filter (where q ->> 'r' = 'n'),
           coalesce(sum((q ->> 't')::numeric), 0), coalesce(min((q ->> 't')::numeric) filter (where q ->> 'r' <> 's'), 150)
      into rights, wrongs, total, fastest from jsonb_array_elements(new.detail) q;
    new.verified := new.score = greatest(0, rights - wrongs) and fastest >= 150
      and new.elapsed between 1 and 480 and total <= new.elapsed * 1000 + 2000;
    return new;
  end if;
  if new.score = 0 or n <> new.score or bad > 0 then return new; end if;
  select coalesce(sum((q ->> 't')::numeric), 0), coalesce(min((q ->> 't')::numeric), 150)
    into total, fastest from jsonb_array_elements(new.detail) q;
  new.verified := fastest >= 150 and case
    when new.seconds > 0 then total <= new.seconds * 1000 + 2000
    else new.elapsed > 0 and total <= new.elapsed * 1000 + 2000 end;
  return new;
end $$;
drop trigger if exists scores_check on public.scores;
create trigger scores_check before insert on public.scores
  for each row execute function public.check_score();

-- ---- leaderboard ---------------------------------------------------------------------------
-- Each player's best verified game per board: names and figures only, readable by anyone. On the
-- 80-in-8 board a tie on score goes to fewer wrong answers, then the faster finish.
create or replace view public.leaderboard with (security_invoker = false) as
  select distinct on (s.user_id, s.mode, s.seconds)
    p.username, s.mode, s.seconds, s.score, s.elapsed, s.date,
    case when s.mode = 'o80' then (select count(*)::int from jsonb_array_elements(s.detail) q where q ->> 'r' = 'n') end as wrongs
  from public.scores s join public.profiles p on p.id = s.user_id
  where s.verified and not p.private
  order by s.user_id, s.mode, s.seconds, s.score desc, wrongs asc nulls last, s.elapsed asc, s.ts asc;
revoke all on public.leaderboard from public;
grant select on public.leaderboard to anon, authenticated;

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
create or replace view public.ladder with (security_invoker = false) as
  select p.username, r.elo, r.games, r.wins, r.losses, r.draws, r.peak
  from public.ratings r join public.profiles p on p.id = r.user_id
  where r.games >= 5 and not p.private;
revoke all on public.ladder from public;
grant select on public.ladder to anon, authenticated;

create or replace function public.mm_rating(p_user uuid) returns int
language sql stable security definer set search_path = '' as $$
  select coalesce((select elo from public.ratings where user_id = p_user), 1000);
$$;

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

-- Private match: a six-character code for a friend to type.
create or replace function public.mm_create(p_game text, p_rule text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare nm text := public.mm_ready(); m public.matches; c text;
begin
  if p_game not in ('standard', 'mixed', 'sq99', 'sq99h', 'sq999', 'sq999h') then raise exception 'Unknown game.'; end if;
  if p_rule not in ('race', 'clock') then raise exception 'Unknown rule.'; end if;
  loop
    select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '') into c from generate_series(1, 6);
    exit when not exists (select 1 from public.matches where code = c);
  end loop;
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
  update public.matches set p2 = auth.uid(), p2_name = nm, status = 'live', starts_at = clock_timestamp() + interval '6 seconds'
    where id = m.id returning * into m;
  return public.mm_out(m);
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
  loop
    select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '') into c from generate_series(1, 6);
    exit when not exists (select 1 from public.matches where code = c);
  end loop;
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

revoke execute on function public.mm_out(public.matches), public.mm_settle(public.matches), public.mm_name(), public.mm_ready(), public.mm_rating(uuid) from public, anon, authenticated;
revoke execute on function public.mm_queue(text, boolean), public.mm_create(text, text), public.mm_join(text), public.mm_poll(uuid), public.mm_cancel(uuid), public.mm_score(uuid, int, int, boolean), public.mm_rematch(uuid) from public, anon;
grant execute on function public.mm_queue(text, boolean), public.mm_create(text, text), public.mm_join(text), public.mm_poll(uuid), public.mm_cancel(uuid), public.mm_score(uuid, int, int, boolean), public.mm_rematch(uuid) to authenticated;

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
