-- Başlangıç içeriği: data/*.json dosyalarındakilerin aynısı.
-- schema.sql'den SONRA, sadece bir kez çalıştır (tablolar boşken).

insert into public.tracks (itunes_id, title, artist, album, track_number, track_count, year, genre, duration_ms, artwork_url, preview_url, store_url, sort) values
  (6813343186, 'Megalovania', 'Toby Fox', 'Undertale Soundtrack', 100, 101, 2015, 'Soundtrack', 156000, 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/68/72/02/6872023b-49d0-1a44-e824-c898bb62c7a3/841787181533.png/600x600bb.jpg', 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/ff/9d/27/ff9d270c-81b2-df99-80f5-5b87048ae88f/mzaf_16037815512034579723.plus.aac.p.m4a', 'https://music.apple.com/tr/album/megalovania/6813342945?i=6813343186', 0),
  (1467259940, 'Travelers', 'Andrew Prahlow', 'Outer Wilds (Original Soundtrack)', 20, 28, 2019, 'Soundtrack', 210190, 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/87/af/e2/87afe22c-d532-53b5-a9f6-43abf37363ce/859732734925_cover.jpg/600x600bb.jpg', 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/4d/28/48/4d2848df-10c9-b11b-57ec-2ad2a20441b1/mzaf_3803094667132234958.plus.aac.p.m4a', 'https://music.apple.com/tr/album/travelers/1467259296?i=1467259940', 1),
  (1691909949, 'The Fire Is Gone (For Piano, Saxophone and Trumpet)', 'Heaven Pierce Her', 'Ultrakill: Infinite Hyperdeath (Original Game Soundtrack)', 1, 19, 2020, 'Soundtrack', 160056, 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/b2/6e/6d/b26e6d47-a18b-a9cf-2f32-d16c89b9c0b4/859774675231_cover.jpg/600x600bb.jpg', 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/47/bc/f1/47bcf191-f833-247e-eacb-77fc399b861d/mzaf_6744313195644889590.plus.aac.p.m4a', 'https://music.apple.com/tr/album/the-fire-is-gone-for-piano-saxophone-and-trumpet/1691909937?i=1691909949', 2),
  (1528217884, 'Hopes and Dreams', 'Toby Fox', 'Undertale Soundtrack', 87, 101, 2015, 'Soundtrack', 181286, 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/d3/21/9f/d3219f8b-c2ff-2498-0e87-eb57873b6eca/841787181533.png/600x600bb.jpg', 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/c8/0c/ef/c80cef70-2fdc-c316-9a46-828e3df18b5c/mzaf_8946137353949873377.plus.aac.p.m4a', 'https://music.apple.com/tr/album/hopes-and-dreams/1528217465?i=1528217884', 3)
on conflict (itunes_id) do nothing;

insert into public.games (name, released, developers, publishers, genres, platforms, metacritic, cover_url, store_url, color, status, now_playing, note, sort) values
  ('ULTRAKILL', '2020-09-03', array['Arsi "Hakita" Patala']::text[], array['New Blood Interactive']::text[], array['Aksiyon', 'Bağımsız']::text[], array['Windows']::text[], null, 'https://cdn.akamai.steamstatic.com/steam/apps/1229490/header.jpg', 'https://store.steampowered.com/app/1229490/', '#AC3232', 'oynuyorum', true, '', 0),
  ('Undertale', '2015-09-15', array['tobyfox']::text[], array['tobyfox']::text[], array['Bağımsız', 'RYO']::text[], array['Windows', 'macOS', 'Linux']::text[], 92, 'https://cdn.akamai.steamstatic.com/steam/apps/391540/header.jpg', 'https://store.steampowered.com/app/391540/', '#222034', 'oynadım', false, '', 1),
  ('Outer Wilds', '2019-05-28', array['Mobius Digital']::text[], array['Annapurna Interactive']::text[], array['Aksiyon', 'Macera']::text[], array['Windows']::text[], 85, 'https://cdn.akamai.steamstatic.com/steam/apps/753640/header.jpg', 'https://store.steampowered.com/app/753640/', '#DF7126', 'oynadım', false, '', 2),
  ('Cyberpunk 2077', '2020-12-10', array['CD PROJEKT RED']::text[], array['CD PROJEKT RED']::text[], array['RYO']::text[], array['Windows', 'macOS']::text[], 86, 'https://cdn.akamai.steamstatic.com/steam/apps/1091500/header.jpg', 'https://store.steampowered.com/app/1091500/', '#FBF236', 'oynadım', false, '', 3),
  ('Minecraft', '2011-11-18', array['Mojang Studios']::text[], array['Mojang Studios', 'Xbox Game Studios']::text[], array['Sandbox', 'Hayatta kalma']::text[], array['Windows', 'macOS', 'Linux', 'Konsol', 'Mobil']::text[], null, '', 'https://www.minecraft.net/', '#6ABE30', 'oynadım', false, '', 4),
  ('League of Legends', '2009-10-27', array['Riot Games']::text[], array['Riot Games']::text[], array['MOBA']::text[], array['Windows', 'macOS']::text[], null, '', 'https://www.leagueoflegends.com/', '#639BFF', 'oynadım', false, '', 5),
  ('VALORANT', '2020-06-02', array['Riot Games']::text[], array['Riot Games']::text[], array['Taktik FPS']::text[], array['Windows']::text[], null, '', 'https://playvalorant.com/', '#D77BBA', 'oynadım', false, '', 6);

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
