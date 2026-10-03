// YouTube eşleştirme — şarkının tamamını herkese çalmak (ve ses ayarı yapabilmek) için
// gömülebilir resmi YouTube yüklemesini bulur.
//
//  { id }                          → herkese açık. tracks tablosundaki şarkıyı arar ve bulduğu youtube_id'yi kaydeder.
//                                    Sadece youtube_id'si henüz boş (null) olan şarkılar için arama yapılır,
//                                    sonuç kalıcıdır: her şarkı en fazla bir kez aranır.
//  { title, artist, duration_ms }  → sadece adminler (Kontrol Odası'nda şarkı eklerken / düzeltirken).
//
// YOUTUBE_API_KEY gizli değişkeni varsa resmi YouTube Data API kullanılır, yoksa anahtarsız arama sayfası okunur.
// Seçim: "Sanatçı - Topic" kanalı, süre uyumu, başlık/sanatçı eşleşmesi; canlı/cover/remix/slowed elenir.
// Gömülmeye kapalı videolar YouTube oEmbed ile ayıklanır.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

type Want = { title: string; artist: string; duration_ms?: number | null };
type Cand = { id: string; title: string; channel: string; secs: number | null };

const norm = (s: string) => String(s || '').toLocaleLowerCase('tr').replace(/ı/g, 'i').normalize('NFKD')
  .replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const toSecs = (s?: string) => {
  if (!s) return null;
  const p = s.split(':').map(Number);
  return p.some(Number.isNaN) ? null : p.reduce((a, b) => a * 60 + b, 0);
};
const isoSecs = (s?: string) => {
  const m = String(s || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  return m ? (Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0)) : null;
};
// deno-lint-ignore no-explicit-any
const runs = (x: any) => (x?.runs ?? []).map((r: { text: string }) => r.text).join('') || x?.simpleText || '';

// deno-lint-ignore no-explicit-any
function walk(o: any, out: Cand[]) {
  if (!o || typeof o !== 'object' || out.length >= 15) return;
  const v = o.videoRenderer;
  if (v?.videoId) {
    out.push({ id: v.videoId, title: runs(v.title), channel: runs(v.ownerText) || runs(v.longBylineText), secs: toSecs(v.lengthText?.simpleText) });
    return;
  }
  for (const k in o) walk(o[k], out);
}

async function scrape(q: string): Promise<Cand[]> {
  const url = `https://www.youtube.com/results?${new URLSearchParams({ search_query: q, hl: 'en', gl: 'TR' })}`;
  const r = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9,tr;q=0.8',
      Cookie: 'SOCS=CAI; CONSENT=YES+cb',
    },
  });
  if (!r.ok) throw new Error(`youtube ${r.status}`);
  const data = extractJson(await r.text(), 'ytInitialData');
  if (!data) throw new Error('youtube_parse');
  const out: Cand[] = [];
  walk(data, out);
  return out;
}

// sayfadaki "ytInitialData = {...}" nesnesini parantez sayarak çıkarır (metin içindeki } karakterleri sorun olmaz)
function extractJson(html: string, name: string) {
  let at = html.indexOf(name);
  while (at >= 0) {
    const start = html.indexOf('{', at);
    const eq = html.slice(at + name.length, start);
    if (start > 0 && /^["'\]]*\s*=\s*$/.test(eq)) {
      let depth = 0; let str = false; let esc = false;
      for (let i = start; i < html.length; i++) {
        const c = html[i];
        if (str) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') str = false; continue; }
        if (c === '"') str = true;
        else if (c === '{') depth++;
        else if (c === '}' && --depth === 0) { try { return JSON.parse(html.slice(start, i + 1)); } catch { break; } }
      }
    }
    at = html.indexOf(name, at + name.length);
  }
  return null;
}

async function viaApi(q: string, key: string): Promise<Cand[]> {
  const p = new URLSearchParams({ part: 'snippet', type: 'video', videoEmbeddable: 'true', maxResults: '10', q, key });
  const r = await fetch(`https://www.googleapis.com/youtube/v3/search?${p}`);
  if (!r.ok) throw new Error(`YouTube API ${r.status}`);
  const items = (await r.json()).items ?? [];
  const ids = items.map((i: { id: { videoId: string } }) => i.id.videoId).filter(Boolean);
  if (!ids.length) return [];
  const d = await (await fetch(`https://www.googleapis.com/youtube/v3/videos?${new URLSearchParams({ part: 'contentDetails,snippet', id: ids.join(','), key })}`)).json();
  // deno-lint-ignore no-explicit-any
  return (d.items ?? []).map((v: any) => ({ id: v.id, title: v.snippet.title, channel: v.snippet.channelTitle, secs: isoSecs(v.contentDetails?.duration) }));
}

const HARD = /\b(live|canli|konser|concert|cover|remix|karaoke|slowed|reverb|speed ?up|sped ?up|8d|nightcore|instrumental|altyapi|backing|reaction|tepki|hours?|saat|but|major key|minor key|bass boosted|mashup)\b/;
const SOFT = /\b(lyrics?|sozleri|lyric video|klip|ceviri|translation|altyazi)\b/;

function score(c: Cand, w: Want) {
  const ct = norm(c.title); const ch = norm(c.channel).replace(/ topic$/, '');
  const tt = norm(w.title); const a = norm(String(w.artist || '').split(',')[0]);
  let s = 0;
  const own = Boolean(a && ch && (ch.includes(a) || a.includes(ch)));
  if (/ - Topic$/.test(c.channel)) s += 3;
  s += own ? 3 : -1;
  if (tt && ct.includes(tt)) s += 3;
  else if (tt && tt.split(' ').filter((x) => x.length > 2).every((x) => ct.includes(x))) s += 1;
  if (a && ct.includes(a)) s += 1;
  const hard = ct.match(HARD)?.[0];
  if (hard && !tt.includes(hard)) s -= 5;
  const soft = ct.match(SOFT)?.[0];
  if (soft && !tt.includes(soft)) s -= 1;
  const want = w.duration_ms ? Math.round(w.duration_ms / 1000) : null;
  if (want && c.secs) { const d = Math.abs(want - c.secs); s += d <= 3 ? 4 : d <= 8 ? 2 : d <= 20 ? 0 : -3; }
  return s;
}

async function embeddable(id: string) {
  try {
    const r = await fetch(`https://www.youtube.com/oembed?${new URLSearchParams({ format: 'json', url: `https://www.youtube.com/watch?v=${id}` })}`);
    return r.ok;
  } catch { return false; }
}

async function find(w: Want) {
  const q = `${String(w.artist || '').split(',')[0]} ${w.title}`.trim().slice(0, 120);
  const key = Deno.env.get('YOUTUBE_API_KEY');
  let list: Cand[] = [];
  if (key) list = await viaApi(q, key).catch(() => []);
  if (!list.length) list = await scrape(q).catch(() => scrape(q));
  const ranked = list.map((c) => ({ ...c, score: score(c, w) })).filter((c) => c.score >= 4).sort((a, b) => b.score - a.score).slice(0, 4);
  for (const c of ranked) if (await embeddable(c.id)) return c;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  let body: { id?: string | number; title?: string; artist?: string; duration_ms?: number } = {};
  try { body = await req.json(); } catch { /* boş */ }
  const url = Deno.env.get('SUPABASE_URL')!;

  try {
    // herkese açık: veritabanındaki bir şarkı
    if (body.id != null) {
      const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const { data: tr, error } = await db.from('tracks').select('id,title,artist,duration_ms,youtube_id').eq('id', body.id).maybeSingle();
      if (error) throw error;
      if (!tr) return json({ error: 'şarkı yok' }, 404);
      if (tr.youtube_id !== null) return json({ youtube_id: tr.youtube_id || null, cached: true });
      const best = await find(tr);
      await db.from('tracks').update({ youtube_id: best?.id ?? '' }).eq('id', tr.id).is('youtube_id', null);
      return json(best ? { youtube_id: best.id, title: best.title, channel: best.channel } : { youtube_id: null });
    }

    // serbest arama: sadece adminler
    if (body.title) {
      const sb = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return json({ error: 'giriş gerekli' }, 401);
      const { data: admin } = await sb.from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
      if (!admin) return json({ error: 'yetki yok' }, 403);
      const best = await find({ title: body.title, artist: body.artist || '', duration_ms: body.duration_ms ?? null });
      return json(best ? { youtube_id: best.id, title: best.title, channel: best.channel } : { youtube_id: null });
    }

    return json({ error: 'id ya da title gerekli' }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
