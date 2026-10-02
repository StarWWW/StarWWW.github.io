-- =========================================================
-- 002 — Spotify desteği
-- Supabase > SQL Editor > New query: yapıştır > RUN. Tekrar çalıştırmak güvenlidir.
-- =========================================================

alter table public.tracks add column if not exists spotify_id text;
alter table public.tracks add column if not exists spotify_url text;
alter table public.tracks add column if not exists explicit boolean not null default false;
create unique index if not exists tracks_spotify_id_key on public.tracks (spotify_id);

-- Başlangıç şarkılarını Spotify'a bağla (kapaklar da Spotify'ınkiyle değişir)
update public.tracks set spotify_id = '1J03Vp93ybKIxfzYI4YJtL', spotify_url = 'https://open.spotify.com/track/1J03Vp93ybKIxfzYI4YJtL',
  artwork_url = 'https://i.scdn.co/image/ab67616d0000b27344ae29b7d531186cfc7c5113', track_count = 100
  where itunes_id = 6813343186;
update public.tracks set spotify_id = '607Rub0edH75AmHEIsuw8N', spotify_url = 'https://open.spotify.com/track/607Rub0edH75AmHEIsuw8N',
  artwork_url = 'https://i.scdn.co/image/ab67616d0000b273db6b8ae97f69fee1d432334d'
  where itunes_id = 1467259940;
update public.tracks set spotify_id = '28m7pzLSESOtre5vyI5cEk', spotify_url = 'https://open.spotify.com/track/28m7pzLSESOtre5vyI5cEk',
  artwork_url = 'https://i.scdn.co/image/ab67616d0000b27357aacd72d8f523ddab7b5e48'
  where itunes_id = 1691909949;
update public.tracks set spotify_id = '7CMVo848b9LsUtVavIoiXC', spotify_url = 'https://open.spotify.com/track/7CMVo848b9LsUtVavIoiXC',
  artwork_url = 'https://i.scdn.co/image/ab67616d0000b27344ae29b7d531186cfc7c5113', track_count = 100
  where itunes_id = 1528217884;
