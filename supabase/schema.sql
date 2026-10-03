-- =========================================================
-- STAR // DİJİTAL ODA — Supabase şeması
-- Supabase > SQL Editor > New query: bu dosyanın TAMAMINI yapıştır > RUN.
-- Tekrar çalıştırmak güvenlidir.
-- =========================================================

create extension if not exists pgcrypto;

-- ---------- yöneticiler ----------
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
drop policy if exists "admin kendini görür" on public.admins;
create policy "admin kendini görür" on public.admins for select using (auth.uid() = user_id);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------- içerik: müzik, oyunlar, yetenekler ----------
create table if not exists public.tracks (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  itunes_id bigint unique,
  spotify_id text unique,
  spotify_url text,
  youtube_id text,
  explicit boolean not null default false,
  title text not null,
  artist text not null,
  album text,
  track_number int,
  track_count int,
  year int,
  genre text,
  duration_ms int,
  artwork_url text,
  preview_url text,
  store_url text,
  sort int not null default 0
);

create table if not exists public.games (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name text not null,
  released date,
  developers text[] not null default '{}',
  publishers text[] not null default '{}',
  genres text[] not null default '{}',
  platforms text[] not null default '{}',
  metacritic int,
  cover_url text,
  box_url text,
  store_url text,
  steam_appid int,
  rawg_id int,
  color text not null default '#AC3232',
  status text not null default 'oynadım' check (status in ('oynuyorum', 'oynadım', 'bitirdim', 'bıraktım', 'favori')),
  now_playing boolean not null default false,
  note text check (char_length(note) <= 200),
  sort int not null default 0
);

create table if not exists public.skills (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 40),
  category text not null check (category in ('diller', 'web', 'veri', 'arac', 'oyun')),
  level smallint not null default 0 check (level between 0 and 10),
  sort int not null default 0
);

do $$
declare t text;
begin
  foreach t in array array['tracks', 'games', 'skills'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "herkes okur" on public.%I', t);
    execute format('drop policy if exists "admin yazar" on public.%I', t);
    execute format('create policy "herkes okur" on public.%I for select using (true)', t);
    execute format('create policy "admin yazar" on public.%I for all using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- ---------- ortak sprey duvarı ----------
create table if not exists public.wall_strokes (
  id uuid primary key,
  created_at timestamptz not null default now(),
  client_id uuid,
  color text not null check (color in ('#99E550', '#DF7126', '#D77BBA', '#5FCDE4', '#FBF236', '#AC3232', '#FFFFFF', '#222034')),
  size smallint not null check (size in (10, 22, 40)),
  points jsonb not null check (jsonb_typeof(points) = 'array' and jsonb_array_length(points) between 1 and 600),
  drips jsonb not null default '[]' check (jsonb_typeof(drips) = 'array' and jsonb_array_length(drips) <= 12)
);
create index if not exists wall_strokes_created_idx on public.wall_strokes (created_at);
create index if not exists wall_strokes_client_idx on public.wall_strokes (client_id, created_at);

create table if not exists public.wall_buffs (
  id bigint generated always as identity primary key,
  at timestamptz not null default now()
);

-- ---------- ziyaretçi defteri ----------
create table if not exists public.guestbook (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 24),
  message text not null check (char_length(message) between 1 and 140)
);
create index if not exists guestbook_created_idx on public.guestbook (created_at desc);

-- ---------- oyun skor tablosu ----------
create table if not exists public.scores (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name text not null check (name ~ '^[A-Z0-9]{3}$'),
  score int not null check (score between 0 and 50000000),
  rank text not null check (rank in ('D', 'C', 'B', 'A', 'S', 'SS', 'SSS', 'C.O.W.')),
  destruction smallint check (destruction between 0 and 100),
  best_combo smallint check (best_combo between 0 and 9999),
  duration_s int check (duration_s between 0 and 36000)
);
create index if not exists scores_score_idx on public.scores (score desc);

-- herkes okur + herkes ekler (kısıtlar yukarıdaki CHECK'lerde), sadece admin siler
do $$
declare t text;
begin
  foreach t in array array['wall_strokes', 'guestbook', 'scores'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "herkes okur" on public.%I', t);
    execute format('drop policy if exists "herkes ekler" on public.%I', t);
    execute format('drop policy if exists "admin siler" on public.%I', t);
    execute format('create policy "herkes okur" on public.%I for select using (true)', t);
    execute format('create policy "herkes ekler" on public.%I for insert with check (true)', t);
    execute format('create policy "admin siler" on public.%I for delete using (public.is_admin())', t);
  end loop;
end $$;

alter table public.wall_buffs enable row level security;
drop policy if exists "herkes okur" on public.wall_buffs;
drop policy if exists "admin buff'lar" on public.wall_buffs;
create policy "herkes okur" on public.wall_buffs for select using (true);
create policy "admin buff'lar" on public.wall_buffs for insert with check (public.is_admin());

-- ---------- hız sınırları + sunucu saati ----------
create or replace function public.wall_guard() returns trigger language plpgsql as $$
begin
  new.created_at := now();
  if new.client_id is not null and (
    select count(*) from public.wall_strokes
    where client_id = new.client_id and created_at > now() - interval '1 minute'
  ) >= 60 then
    raise exception 'yavaş! sprey kutun soğusun';
  end if;
  return new;
end $$;
drop trigger if exists wall_guard on public.wall_strokes;
create trigger wall_guard before insert on public.wall_strokes for each row execute function public.wall_guard();

create or replace function public.book_guard() returns trigger language plpgsql as $$
begin
  new.created_at := now();
  if (select count(*) from public.guestbook where created_at > now() - interval '1 minute') >= 20 then
    raise exception 'defter çok kalabalık, biraz bekle';
  end if;
  return new;
end $$;
drop trigger if exists book_guard on public.guestbook;
create trigger book_guard before insert on public.guestbook for each row execute function public.book_guard();

create or replace function public.score_guard() returns trigger language plpgsql as $$
begin
  new.created_at := now();
  if (select count(*) from public.scores where created_at > now() - interval '1 minute') >= 30 then
    raise exception 'skor tablosu çok kalabalık';
  end if;
  return new;
end $$;
drop trigger if exists score_guard on public.scores;
create trigger score_guard before insert on public.scores for each row execute function public.score_guard();

-- ---------- gerçek zamanlı yayın ----------
do $$
declare t text;
begin
  foreach t in array array['wall_strokes', 'wall_buffs', 'guestbook'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ---------- (isteğe bağlı) 12 haftadan eski çizgileri temizle ----------
-- Database > Extensions > pg_cron'u aç, sonra:
-- select cron.schedule('duvar-temizlik', '0 4 * * 1', $$ delete from public.wall_strokes where created_at < now() - interval '12 weeks' $$);
