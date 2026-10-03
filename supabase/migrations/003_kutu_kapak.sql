-- =========================================================
-- 003 — oyun kutusu (DVD) kapakları + sadece Spotify önizlemeleri
-- Supabase > SQL Editor > New query: yapıştır > RUN. Tekrar çalıştırmak güvenlidir.
-- =========================================================

-- Oyunların dikey kutu kapağı
alter table public.games add column if not exists box_url text;

-- Steam kimliği olmayanlara mağaza/kapak linkinden çıkar
update public.games set steam_appid = substring(coalesce(nullif(store_url, ''), cover_url) from '/apps?/([0-9]+)')::int
  where steam_appid is null and coalesce(nullif(store_url, ''), cover_url) ~ '/apps?/[0-9]+';

-- Steam oyunlarına dikey kutu kapağı (Kontrol Odası > Oyun Ekle > KAPAK ile değiştirilebilir)
update public.games set box_url = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/' || steam_appid || '/library_600x900.jpg'
  where steam_appid is not null and (box_url is null or box_url = '');

-- Çalar sadece Spotify'ın 30 sn önizlemesini çalar: eski iTunes önizlemelerini boşalt,
-- "spotify" fonksiyonu Spotify'ınkini bulup kendisi doldurur.
update public.tracks set preview_url = null
  where spotify_id is not null and preview_url is not null and preview_url not like 'https://p.scdn.co/%';

-- Önceki sürümün YouTube sütunu (artık kullanılmıyor)
alter table public.tracks drop column if exists youtube_id;
