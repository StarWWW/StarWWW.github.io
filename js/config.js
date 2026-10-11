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

  // Sitedeki yaş (hero, karakter kartı, LVL çıkartması, şerit, terminal) buradan hesaplanır: 'YYYY-AA-GG'.
  // Boşsa ageFallback kullanılır.
  birthDate: '2005-07-24',
  ageFallback: 21,
};

export const hasSupabase = () => Boolean(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);

// Yaş: doğum gününde (Türkiye saatiyle) bir artar
export function age(now = Date.now()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(CONFIG.birthDate || '');
  if (!m) return CONFIG.ageFallback;
  const d = new Date(now + CONFIG.tzOffsetHours * 3600000);
  const [y, mo, da] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const beforeBirthday = d.getUTCMonth() + 1 < mo || (d.getUTCMonth() + 1 === mo && d.getUTCDate() < da);
  return d.getUTCFullYear() - y - (beforeBirthday ? 1 : 0);
}
