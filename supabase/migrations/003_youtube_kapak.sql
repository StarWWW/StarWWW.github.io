-- =========================================================
-- 003 — YouTube ile çalma (ses kontrolü) + oyun kutusu kapakları
-- Supabase > SQL Editor > New query: yapıştır > RUN. Tekrar çalıştırmak güvenlidir.
-- =========================================================

-- Şarkının YouTube karşılığı: varsa çalar YouTube'dan çalar (herkese tam şarkı + ses ayarı)
alter table public.tracks add column if not exists youtube_id text;

update public.tracks set youtube_id = '0FCvzsVlXpQ' where spotify_id = '1J03Vp93ybKIxfzYI4YJtL' or itunes_id = 6813343186;
update public.tracks set youtube_id = 'z34enKCqRGk' where spotify_id = '607Rub0edH75AmHEIsuw8N' or itunes_id = 1467259940;
update public.tracks set youtube_id = '917xijnpJVw' where spotify_id = '28m7pzLSESOtre5vyI5cEk' or itunes_id = 1691909949;
update public.tracks set youtube_id = 'HA3Ks8NLS-Y' where spotify_id = '7CMVo848b9LsUtVavIoiXC' or itunes_id = 1528217884;

-- Oyunların dikey kutu (DVD) kapağı
alter table public.games add column if not exists box_url text;

-- Steam kimliği olmayanlara mağaza/kapak linkinden çıkar
update public.games set steam_appid = substring(coalesce(nullif(store_url, ''), cover_url) from '/apps?/([0-9]+)')::int
  where steam_appid is null and coalesce(nullif(store_url, ''), cover_url) ~ '/apps?/[0-9]+';
-- Steam oyunlarına dikey kutu kapağı (Kontrol Odası > Oyun Ekle > KAPAK ile değiştirilebilir)
update public.games set box_url = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/' || steam_appid || '/library_600x900.jpg'
  where steam_appid is not null and (box_url is null or box_url = '');
