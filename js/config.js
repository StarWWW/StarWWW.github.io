// Sitenin tek ayar dosyası. Supabase alanları boşken site yine çalışır:
// duvar, defter ve skor tablosu sadece ziyaretçinin kendi tarayıcısında tutulur.
export const CONFIG = {
  githubUser: 'StarWWW',
  discord: 'stariscrazy',

  // Supabase > Project Settings > API
  supabaseUrl: 'https://rchpyllhmjhcojbyhqxs.supabase.co',      // örn. https://abcdefgh.supabase.co
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjaHB5bGxobWpoY29qYnlocXhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5NTI5MTQsImV4cCI6MjEwNjUyODkxNH0.3Vs2CgQ4sO8g2bHpghyd_s4ye3Ip0ZKLLYhV0iZWfJw',  // "anon public" anahtarı (herkese açık olması normaldir)

  // Oyun araması yapan Edge Function'ın adı (supabase/functions/game-search)
  gameSearchFn: 'game-search',

  // Duvarın haftalık buff'ı Pazartesi 00:00 Türkiye saatiyle (UTC+3, yaz saati yok)
  tzOffsetHours: 3,
};

export const hasSupabase = () => Boolean(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);
