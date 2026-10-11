-- =========================================================
-- 005 — duvar: daha sıkı toplam sınır + duvar başına tavan
-- Supabase > SQL Editor > New query: bu dosyanın TAMAMINI yapıştır > RUN. Tekrar çalıştırmak güvenlidir.
-- Mevcut çizgilere dokunmaz.
--
-- Neden: tarayıcı kimliğini her seferinde değiştiren bir bot dakikada 600 çizgi atabiliyordu (çizgi başına
-- ortalama ~4,6 KB). Her ziyaretçi o haftanın bütün çizgilerini indirdiği ve canlı yayın her çizgiyi herkese
-- ilettiği için birkaç saatte veritabanı kotası ve ziyaretçilerin tarayıcısı dolabilirdi.
--   · herkes toplamda dakikada en fazla 150 çizgi (eskisi 600)
--   · bir duvarda (pazartesi 00:00 TSİ'den ya da son buff'tan beri) en fazla 2000 çizgi
--     (en kalabalık gün 53 çizgiydi). Duvar dolarsa Kontrol Odası'ndan BUFF atınca sayaç sıfırlanır.
-- =========================================================

create or replace function public.wall_guard() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare
  p jsonb;
  since timestamptz;
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
  if (select count(*) from public.wall_strokes where created_at > now() - interval '1 minute') >= 150 then
    raise exception 'duvar çok kalabalık, biraz bekle';
  end if;
  -- bu duvar: son pazartesi 00:00 (Türkiye saati) ya da son buff, hangisi yeniyse
  since := greatest(
    date_trunc('week', now() at time zone 'Europe/Istanbul') at time zone 'Europe/Istanbul',
    coalesce((select max(at) from public.wall_buffs), '-infinity'::timestamptz)
  );
  if (select count(*) from public.wall_strokes where created_at >= since) >= 2000 then
    raise exception 'duvar bu hafta doldu';
  end if;
  return new;
end $$;

drop trigger if exists wall_guard on public.wall_strokes;
create trigger wall_guard before insert on public.wall_strokes for each row execute function public.wall_guard();
