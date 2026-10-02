import { CONFIG, hasSupabase } from './config.js';

let clientPromise = null;

// supabase-js sadece ayarlıysa ve ilk ihtiyaçta yüklenir
export function getSupabase() {
  if (!hasSupabase()) return Promise.resolve(null);
  if (!clientPromise) {
    clientPromise = import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm')
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
