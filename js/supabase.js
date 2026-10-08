import { CONFIG, hasSupabase } from './config.js';

// supabase-js sitenin kendi kopyasından yüklenir (js/vendor, sabit sürüm 2.117.1): CDN'de ya da npm'de bir şey
// değişse bile tarayıcı sadece bu dosyayı çalıştırır, dışarıdan betik gelmez (CSP: script-src 'self').
// Güncellemek için: npm pack @supabase/supabase-js@SÜRÜM → package/dist/umd/supabase.js dosyasını
// js/vendor/supabase.esm.js olarak kopyala ve sonuna şu satırı ekle: export const createClient = supabase.createClient;
const loadLib = () => import('./vendor/supabase.esm.js');

let clientPromise = null;

// supabase-js sadece ayarlıysa ve ilk ihtiyaçta yüklenir
export function getSupabase() {
  if (!hasSupabase()) return Promise.resolve(null);
  if (!clientPromise) {
    clientPromise = loadLib()
      .then(({ createClient }) => createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, {
        auth: { persistSession: true, detectSessionInUrl: true, flowType: 'pkce' },
        realtime: { params: { eventsPerSecond: 20 } },
      }))
      .catch((err) => { console.warn('[supabase] yüklenemedi:', err); return null; });
  }
  return clientPromise;
}

// Tüm satırları 1000'lik sayfalarla çeker
export async function selectAll(query, pageSize = 1000) {
  const out = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await query().range(from, from + pageSize - 1);
    if (error) throw error;
    out.push(...data);
    if (data.length < pageSize) return out;
  }
}
