-- Başlangıç içeriği: data/*.json dosyalarındakilerin aynısı.
-- schema.sql'den SONRA, sadece bir kez çalıştır (tablolar boşken).

insert into public.tracks (itunes_id, spotify_id, spotify_url, explicit, title, artist, album, track_number, track_count, year, genre, duration_ms, artwork_url, preview_url, store_url, sort) values
  (6813343186, '1J03Vp93ybKIxfzYI4YJtL', 'https://open.spotify.com/track/1J03Vp93ybKIxfzYI4YJtL', false, 'Megalovania', 'Toby Fox', 'Undertale Soundtrack', 100, 100, 2015, 'Soundtrack', 156000, 'https://i.scdn.co/image/ab67616d0000b27344ae29b7d531186cfc7c5113', 'https://p.scdn.co/mp3-preview/929f178f45d3e58a7c9811a5752e939455e74914', 'https://music.apple.com/tr/album/megalovania/6813342945?i=6813343186', 0),
  (1467259940, '607Rub0edH75AmHEIsuw8N', 'https://open.spotify.com/track/607Rub0edH75AmHEIsuw8N', false, 'Travelers', 'Andrew Prahlow', 'Outer Wilds (Original Soundtrack)', 20, 28, 2019, 'Soundtrack', 210190, 'https://i.scdn.co/image/ab67616d0000b273db6b8ae97f69fee1d432334d', 'https://p.scdn.co/mp3-preview/b4e3af0d2eae4147c80c79580e4dce952864f3de', 'https://music.apple.com/tr/album/travelers/1467259296?i=1467259940', 1),
  (1691909949, '28m7pzLSESOtre5vyI5cEk', 'https://open.spotify.com/track/28m7pzLSESOtre5vyI5cEk', false, 'The Fire Is Gone (For Piano, Saxophone and Trumpet)', 'Heaven Pierce Her', 'Ultrakill: Infinite Hyperdeath (Original Game Soundtrack)', 1, 19, 2020, 'Soundtrack', 160056, 'https://i.scdn.co/image/ab67616d0000b27357aacd72d8f523ddab7b5e48', 'https://p.scdn.co/mp3-preview/dd7399156fa87b820bcc16d8ad6caa01c625dab3', 'https://music.apple.com/tr/album/the-fire-is-gone-for-piano-saxophone-and-trumpet/1691909937?i=1691909949', 2),
  (1528217884, '7CMVo848b9LsUtVavIoiXC', 'https://open.spotify.com/track/7CMVo848b9LsUtVavIoiXC', false, 'Hopes and Dreams', 'Toby Fox', 'Undertale Soundtrack', 87, 100, 2015, 'Soundtrack', 181286, 'https://i.scdn.co/image/ab67616d0000b27344ae29b7d531186cfc7c5113', 'https://p.scdn.co/mp3-preview/4fd3e5d77116893a29fbca398633cd8528584a40', 'https://music.apple.com/tr/album/hopes-and-dreams/1528217465?i=1528217884', 3)
on conflict (itunes_id) do nothing;

insert into public.games (name, released, developers, publishers, genres, platforms, metacritic, cover_url, box_url, store_url, steam_appid, color, status, now_playing, note, sort) values
  ('ULTRAKILL', '2020-09-03', array['Arsi "Hakita" Patala']::text[], array['New Blood Interactive']::text[], array['Aksiyon', 'Bağımsız']::text[], array['Windows']::text[], null, 'https://cdn.akamai.steamstatic.com/steam/apps/1229490/header.jpg', 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1229490/library_600x900.jpg', 'https://store.steampowered.com/app/1229490/', 1229490, '#AC3232', 'oynuyorum', true, '', 0),
  ('Undertale', '2015-09-15', array['tobyfox']::text[], array['tobyfox']::text[], array['Bağımsız', 'RYO']::text[], array['Windows', 'macOS', 'Linux']::text[], 92, 'https://cdn.akamai.steamstatic.com/steam/apps/391540/header.jpg', 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/391540/library_600x900.jpg', 'https://store.steampowered.com/app/391540/', 391540, '#222034', 'oynadım', false, '', 1),
  ('Outer Wilds', '2019-05-28', array['Mobius Digital']::text[], array['Annapurna Interactive']::text[], array['Aksiyon', 'Macera']::text[], array['Windows']::text[], 85, 'https://cdn.akamai.steamstatic.com/steam/apps/753640/header.jpg', 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/753640/library_600x900.jpg', 'https://store.steampowered.com/app/753640/', 753640, '#DF7126', 'oynadım', false, '', 2),
  ('Cyberpunk 2077', '2020-12-10', array['CD PROJEKT RED']::text[], array['CD PROJEKT RED']::text[], array['RYO']::text[], array['Windows', 'macOS']::text[], 86, 'https://cdn.akamai.steamstatic.com/steam/apps/1091500/header.jpg', 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1091500/library_600x900.jpg', 'https://store.steampowered.com/app/1091500/', 1091500, '#FBF236', 'oynadım', false, '', 3),
  ('Minecraft', '2011-11-18', array['Mojang Studios']::text[], array['Mojang Studios', 'Xbox Game Studios']::text[], array['Sandbox', 'Hayatta kalma']::text[], array['Windows', 'macOS', 'Linux', 'Konsol', 'Mobil']::text[], null, '', '', 'https://www.minecraft.net/', null, '#6ABE30', 'oynadım', false, '', 4),
  ('League of Legends', '2009-10-27', array['Riot Games']::text[], array['Riot Games']::text[], array['MOBA']::text[], array['Windows', 'macOS']::text[], null, '', '', 'https://www.leagueoflegends.com/', null, '#639BFF', 'oynadım', false, '', 5),
  ('VALORANT', '2020-06-02', array['Riot Games']::text[], array['Riot Games']::text[], array['Taktik FPS']::text[], array['Windows']::text[], null, '', '', 'https://playvalorant.com/', null, '#D77BBA', 'oynadım', false, '', 6);

insert into public.skills (name, category, level, sort) values
  ('C', 'diller', 0, 0),
  ('C++', 'diller', 0, 1),
  ('C#', 'diller', 0, 2),
  ('Java', 'diller', 0, 3),
  ('Python', 'diller', 0, 4),
  ('JavaScript', 'diller', 0, 5),
  ('TypeScript', 'diller', 0, 6),
  ('SQL', 'diller', 0, 7),
  ('Bash', 'diller', 0, 8),
  ('Lua', 'diller', 0, 9),
  ('PHP', 'diller', 0, 10),
  ('Go', 'diller', 0, 11),
  ('Rust', 'diller', 0, 12),
  ('Kotlin', 'diller', 0, 13),
  ('Assembly', 'diller', 0, 14),
  ('Dart', 'diller', 0, 15),
  ('HTML', 'web', 0, 16),
  ('CSS', 'web', 0, 17),
  ('React', 'web', 0, 18),
  ('Node.js', 'web', 0, 19),
  ('Tailwind', 'web', 0, 20),
  ('Vite', 'web', 0, 21),
  ('.NET', 'web', 0, 22),
  ('PostgreSQL', 'veri', 0, 23),
  ('SQLite', 'veri', 0, 24),
  ('MongoDB', 'veri', 0, 25),
  ('Supabase', 'veri', 0, 26),
  ('Firebase', 'veri', 0, 27),
  ('Git', 'arac', 0, 28),
  ('GitHub', 'arac', 0, 29),
  ('Linux', 'arac', 0, 30),
  ('Docker', 'arac', 0, 31),
  ('VS Code', 'arac', 0, 32),
  ('Visual Studio', 'arac', 0, 33),
  ('Postman', 'arac', 0, 34),
  ('Figma', 'arac', 0, 35),
  ('Unity', 'oyun', 0, 36),
  ('Godot', 'oyun', 0, 37),
  ('Aseprite', 'oyun', 0, 38),
  ('Blender', 'oyun', 0, 39),
  ('Photoshop', 'oyun', 0, 40),
  ('BepInEx', 'oyun', 0, 41),
  ('Çeviri / Lokalizasyon', 'oyun', 0, 42);
