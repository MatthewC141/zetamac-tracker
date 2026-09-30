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
  seconds int not null check (seconds in (0, 30, 120)),
  source text not null check (source in ('game', 'manual')),
  mode text not null check (mode in ('standard', 'sq99', 'sq99h', 'sq999', 'sq999h', 'sub-borrow', 'sub-easy', 'guided', 'mixed')),
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
  check (mode in ('standard', 'sq99', 'sq99h', 'sq999', 'sq999h', 'sub-borrow', 'sub-easy', 'guided', 'mixed'));
alter table public.scores drop constraint if exists scores_detail_len;
alter table public.scores add constraint scores_detail_len check (detail is null or jsonb_array_length(detail) <= 5000);
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
-- games in all and 1,000 saves an hour (plenty for importing years of history). Then whether the
-- game counts for the leaderboard: it was played in the browser game, scored at least a point, and
-- its question log holds up, with one entry per point scored, every answer timed at 150 ms or more,
-- and the times adding up to no more than the game's length (the run's length for endless).
-- Hand-logged scores never count.
create or replace function public.check_score() returns trigger
language plpgsql set search_path = '' as $$
declare n int; bad int; total numeric; fastest numeric;
begin
  if (select count(*) from public.scores where user_id = new.user_id) >= 20000 then
    raise exception 'This account has reached its limit of 20,000 games.';
  end if;
  if (select count(*) from public.scores where user_id = new.user_id and created_at > now() - interval '1 hour') >= 1000 then
    raise exception 'Too many saves in the last hour. Try again later.';
  end if;
  new.verified := false;
  if new.source <> 'game' or new.mode = 'guided' or new.detail is null
     or new.date > (now() at time zone 'utc')::date + 1 then
    return new;
  end if;
  n := jsonb_array_length(new.detail);
  select count(*) filter (where coalesce(jsonb_typeof(q -> 't'), '') <> 'number') into bad
    from jsonb_array_elements(new.detail) q;
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
-- Each player's best verified game per board: names and figures only, readable by anyone.
create or replace view public.leaderboard with (security_invoker = false) as
  select distinct on (s.user_id, s.mode, s.seconds)
    p.username, s.mode, s.seconds, s.score, s.elapsed, s.date
  from public.scores s join public.profiles p on p.id = s.user_id
  where s.verified
  order by s.user_id, s.mode, s.seconds, s.score desc, s.elapsed asc, s.ts asc;
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
