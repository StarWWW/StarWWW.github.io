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

// supabase-js (~220 KB) olmadan düz istekler: sayfa açılırken içerik okumak ve önizleme fonksiyonunu çağırmak için.
// Kütüphane sadece canlı bağlantı ya da yazma gerektiğinde (duvar, defter, oyun skoru, Kontrol Odası) yüklenir.
function request(path, opts = {}, ms = 9000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  const headers = { apikey: CONFIG.supabaseAnonKey, Authorization: `Bearer ${CONFIG.supabaseAnonKey}`, ...opts.headers };
  return fetch(`${CONFIG.supabaseUrl}${path}`, { ...opts, headers, signal: ctl.signal }).finally(() => clearTimeout(t));
}

// Sadece okuma (RLS yine geçerli): restSelect('tracks', 'select=*&order=sort.asc')
export async function restSelect(table, query, ms) {
  const r = await request(`/rest/v1/${table}?${query}`, { headers: { Accept: 'application/json' } }, ms);
  if (!r.ok) throw new Error(`${table}: ${r.status}`);
  return r.json();
}

// Edge Function çağrısı; hata gövdesindeki mesajı da döndürür
export async function callFunction(name, body, ms = 12000) {
  const r = await request(`/functions/v1/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, ms);
  let data = null;
  try { data = await r.json(); } catch { /* gövde yok */ }
  if (!r.ok || data?.error) throw new Error(data?.error || `${name}: ${r.status}`);
  return data;
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
