// Sitenin tek ayar dosyası. Supabase alanları boşken site yine çalışır:
// duvar, defter ve skor tablosu sadece ziyaretçinin kendi tarayıcısında tutulur.
export const CONFIG = {
  githubUser: 'StarWWW',
  discord: 'stariscrazy',

  // Supabase > Project Settings > API
  supabaseUrl: '',      // örn. https://abcdefgh.supabase.co
  supabaseAnonKey: '',  // "anon public" anahtarı (herkese açık olması normaldir)

  // Oyun araması yapan Edge Function'ın adı (supabase/functions/game-search)
  gameSearchFn: 'game-search',

  // Duvarın haftalık buff'ı Pazartesi 00:00 Türkiye saatiyle (UTC+3, yaz saati yok)
  tzOffsetHours: 3,
};

export const hasSupabase = () => Boolean(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);
