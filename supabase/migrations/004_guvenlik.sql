-- =========================================================
-- 004 — güvenlik sıkılaştırması
-- Supabase > SQL Editor > New query: bu dosyanın TAMAMINI yapıştır > RUN. Tekrar çalıştırmak güvenlidir.
-- Mevcut veriye dokunmaz; sadece bundan sonra yazılanlara kural koyar.
-- =========================================================

-- ---------- 1) ziyaretçi rolleri sadece ihtiyaç duyduğu işi yapabilsin ----------
-- Supabase varsayılan olarak anon / authenticated rollerine tablolarda HER yetkiyi verir. Satırları RLS korur,
-- ama TRUNCATE gibi RLS'in kapsamadığı yetkiler de o paketin içinde. Sadece sitenin gerçekten kullandıkları kalsın.
revoke all on all tables in schema public from anon, authenticated;

-- okuma (satır bazında yine RLS karar verir)
grant select on public.tracks, public.games, public.skills, public.wall_strokes, public.wall_buffs, public.guestbook, public.scores
  to anon, authenticated;
grant select on public.admins to authenticated;

-- herkese açık ekleme: sadece sitenin gönderdiği sütunlar (created_at gibi alanlar elle yazılamaz)
grant insert (id, client_id, color, size, points, drips) on public.wall_strokes to anon, authenticated;
grant insert (id, name, message) on public.guestbook to anon, authenticated;
grant insert (name, score, rank, destruction, best_combo, duration_s) on public.scores to anon, authenticated;

-- Kontrol Odası (ayrıca RLS'teki is_admin() şartı geçerli: giriş yapan herkes değil, sadece admins tablosundakiler)
grant insert, update, delete on public.tracks, public.games, public.skills to authenticated;
grant insert on public.wall_buffs to authenticated;
grant delete on public.wall_strokes, public.guestbook, public.scores to authenticated;

-- ---------- 2) duvar: çizgi verisi doğrulansın + toplam hız sınırı ----------
-- Noktalar 0–1 aralığında [x, y] çiftleri olmalı. Uç değerli tek bir kayıt, duvarı açan herkesin tarayıcısını
-- kilitleyebilirdi; site de ayrıca kontrol ediyor ama asıl kapı burası.
create or replace function public.wall_guard() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare p jsonb;
begin
  new.created_at := now();
  if new.client_id is null then
    raise exception 'client_id gerekli';
  end if;
  if octet_length(new.points::text) > 16000 or octet_length(new.drips::text) > 1000 then
    raise exception 'çizgi çok büyük';
  end if;
  for p in select value from jsonb_array_elements(new.points) loop
    if jsonb_typeof(p) <> 'array' or jsonb_array_length(p) <> 2
       or jsonb_typeof(p -> 0) <> 'number' or jsonb_typeof(p -> 1) <> 'number'
       or (p ->> 0)::numeric not between 0 and 1 or (p ->> 1)::numeric not between 0 and 1 then
      raise exception 'geçersiz nokta';
    end if;
  end loop;
  for p in select value from jsonb_array_elements(new.drips) loop
    if jsonb_typeof(p) <> 'array' or jsonb_array_length(p) <> 3
       or jsonb_typeof(p -> 0) <> 'number' or jsonb_typeof(p -> 1) <> 'number' or jsonb_typeof(p -> 2) <> 'number'
       or (p ->> 0)::numeric not between 0 and 1 or (p ->> 1)::numeric not between 0 and 1
       or (p ->> 2)::numeric not between 0 and 0.2 then
      raise exception 'geçersiz damla';
    end if;
  end loop;
  -- kişi başı (tarayıcı kimliği)
  if (select count(*) from public.wall_strokes
      where client_id = new.client_id and created_at > now() - interval '1 minute') >= 60 then
    raise exception 'yavaş! sprey kutun soğusun';
  end if;
  -- herkes toplamda: kimliğini her seferinde değiştiren bir bot da duvarı dolduramasın
  if (select count(*) from public.wall_strokes where created_at > now() - interval '1 minute') >= 600 then
    raise exception 'duvar çok kalabalık, biraz bekle';
  end if;
  return new;
end $$;
drop trigger if exists wall_guard on public.wall_strokes;
create trigger wall_guard before insert on public.wall_strokes for each row execute function public.wall_guard();

-- ---------- 3) defter: görünmez / yön değiştiren karakter yok, aynı not tekrar asılamaz ----------
-- (kontrol karakterleri, sıfır genişlikli karakterler ve metni ters çeviren RTL/LTR işaretleri)
alter table public.guestbook drop constraint if exists guestbook_clean_text;
alter table public.guestbook add constraint guestbook_clean_text check (
  btrim(name) <> '' and btrim(message) <> ''
  and name !~ '[[:cntrl:]­​-‏‪-‮⁠-⁩﻿]'
  and message !~ '[[:cntrl:]­​-‏‪-‮⁠-⁩﻿]'
) not valid;

create or replace function public.book_guard() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  new.created_at := now();
  if (select count(*) from public.guestbook where created_at > now() - interval '1 minute') >= 20 then
    raise exception 'defter çok kalabalık, biraz bekle';
  end if;
  if exists (select 1 from public.guestbook
             where lower(message) = lower(new.message) and created_at > now() - interval '1 hour') then
    raise exception 'bu not zaten asılı';
  end if;
  return new;
end $$;

alter function public.score_guard() set search_path = public, pg_temp;

-- ---------- 4) içerik: renk gerçekten renk, linkler gerçekten web adresi ----------
-- (javascript: / data: gibi adresler hiçbir yoldan kaydedilemesin)
alter table public.games drop constraint if exists games_safe_values;
alter table public.games add constraint games_safe_values check (
  color ~ '^#[0-9A-Fa-f]{6}$'
  and coalesce(cover_url, '') ~ '^(https?://|$)'
  and coalesce(box_url, '') ~ '^(https?://|$)'
  and coalesce(store_url, '') ~ '^(https?://|$)'
) not valid;

alter table public.tracks drop constraint if exists tracks_safe_urls;
alter table public.tracks add constraint tracks_safe_urls check (
  coalesce(artwork_url, '') ~ '^(https?://|$)'
  and coalesce(preview_url, '') ~ '^(https?://|$)'
  and coalesce(spotify_url, '') ~ '^(https?://|$)'
  and coalesce(store_url, '') ~ '^(https?://|$)'
) not valid;

-- ---------- kontrol ----------
-- Çalıştırdıktan sonra Supabase > Advisors > Security Advisor'da uyarı kalmamalı.
-- RLS'i açık olmayan bir tablo varsa burada görünür (boş dönmeli):
select tablename from pg_tables where schemaname = 'public' and not rowsecurity;
