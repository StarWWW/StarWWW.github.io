// Spotify şarkı arama + şarkı detayı + 30 sn önizleme.
//
//  1) { q }        Arama: Spotify Web API (gizli değişkenler SPOTIFY_CLIENT_ID + SPOTIFY_CLIENT_SECRET gerekir;
//                  Şubat 2026'dan beri Spotify geliştirici uygulamaları için uygulama sahibinin Premium olması şart). Sadece adminler.
//  2) { track }    Link/kimlik: bilgileri herkese açık embed sayfasından çeker, albüm adı / parça no / türü iTunes'tan
//                  tamamlar. Anahtar gerektirmez. Sadece adminler.
//  3) { preview }  Herkese açık: tracks tablosundaki şarkının Spotify önizleme (30 sn MP3) adresini embed sayfasından
//                  bulup preview_url'ye kaydeder. Her şarkı için bir kez çalışır; sitedeki çalar bunu çalar.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

type Track = {
  spotify_id: string; spotify_url: string; title: string; artist: string; album: string | null;
  track_number: number | null; track_count: number | null; year: number | null; genre: string | null;
  duration_ms: number | null; artwork_url: string | null; explicit: boolean; preview_url: string | null;
};
const isSpPreview = (u: unknown) => /^https:\/\/p\.scdn\.co\//.test(String(u ?? ''));

let token: { value: string; until: number } | null = null;
async function spotifyToken(): Promise<string | null> {
  const id = Deno.env.get('SPOTIFY_CLIENT_ID');
  const secret = Deno.env.get('SPOTIFY_CLIENT_SECRET');
  if (!id || !secret) return null;
  if (token && Date.now() < token.until) return token.value;
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${btoa(`${id}:${secret}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  if (!r.ok) throw new Error(`Spotify token: ${r.status} ${await r.text()}`);
  const d = await r.json();
  token = { value: d.access_token, until: Date.now() + (d.expires_in - 60) * 1000 };
  return token.value;
}

async function api(path: string, tk: string) {
  const r = await fetch(`https://api.spotify.com/v1${path}`, { headers: { Authorization: `Bearer ${tk}` } });
  if (!r.ok) throw new Error(`Spotify ${path.split('?')[0]}: ${r.status} ${await r.text()}`);
  return r.json();
}

// deno-lint-ignore no-explicit-any
function fromApi(t: any): Track {
  return {
    spotify_id: t.id,
    spotify_url: t.external_urls?.spotify ?? `https://open.spotify.com/track/${t.id}`,
    title: t.name,
    artist: (t.artists ?? []).map((a: { name: string }) => a.name).join(', '),
    album: t.album?.name ?? null,
    track_number: t.track_number ?? null,
    track_count: t.album?.total_tracks ?? null,
    year: t.album?.release_date ? Number(String(t.album.release_date).slice(0, 4)) : null,
    genre: null,
    duration_ms: t.duration_ms ?? null,
    artwork_url: t.album?.images?.[0]?.url ?? null,
    explicit: Boolean(t.explicit),
    preview_url: isSpPreview(t.preview_url) ? t.preview_url : null,
  };
}

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

// iTunes'tan albüm adı, parça numarası ve tür tamamlama (en yakın eşleşme)
async function itunesFill(t: Track): Promise<Track> {
  try {
    const q = new URLSearchParams({ term: `${t.title} ${t.artist.split(',')[0]}`, entity: 'song', limit: '15', country: 'TR' });
    const d = await (await fetch(`https://itunes.apple.com/search?${q}`)).json();
    let best = null; let score = -1;
    for (const r of d.results ?? []) {
      let s = 0;
      if (norm(r.trackName) === norm(t.title)) s += 3; else if (norm(r.trackName).includes(norm(t.title))) s += 1;
      if (norm(r.artistName).includes(norm(t.artist.split(',')[0]))) s += 2;
      if (t.duration_ms && Math.abs((r.trackTimeMillis ?? 0) - t.duration_ms) < 3000) s += 2;
      if (s > score) { score = s; best = r; }
    }
    if (best && score >= 4) {
      return {
        ...t,
        album: t.album ?? best.collectionName ?? null,
        track_number: t.track_number ?? best.trackNumber ?? null,
        track_count: t.track_count ?? best.trackCount ?? null,
        year: t.year ?? (best.releaseDate ? Number(best.releaseDate.slice(0, 4)) : null),
        genre: t.genre ?? best.primaryGenreName ?? null,
      };
    }
  } catch { /* tamamlama isteğe bağlı */ }
  return t;
}

// herkese açık embed sayfasındaki şarkı verisi (önizleme adresi dahil)
async function embedEntity(id: string) {
  const r = await fetch(`https://open.spotify.com/embed/track/${id}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!r.ok) throw new Error(`Spotify embed ${r.status}`);
  const m = (await r.text()).match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('Spotify sayfası okunamadı');
  const e = JSON.parse(m[1])?.props?.pageProps?.state?.data?.entity;
  if (!e || e.type !== 'track') throw new Error('Bu bir Spotify şarkı linki değil');
  return e;
}
const previewOf = (e: { audioPreview?: { url?: string } }) => (isSpPreview(e?.audioPreview?.url) ? e.audioPreview!.url! : null);

// Anahtarsız yol: embed sayfasındaki veriden
async function fromEmbed(id: string): Promise<Track> {
  const e = await embedEntity(id);
  const imgs = e.visualIdentity?.image ?? [];
  const big = imgs.slice().sort((a: { maxWidth: number }, b: { maxWidth: number }) => (b.maxWidth ?? 0) - (a.maxWidth ?? 0))[0];
  return itunesFill({
    spotify_id: e.id,
    spotify_url: `https://open.spotify.com/track/${e.id}`,
    title: e.name ?? e.title,
    artist: (e.artists ?? []).map((a: { name: string }) => a.name).join(', '),
    album: null, track_number: null, track_count: null,
    year: e.releaseDate?.isoString ? Number(e.releaseDate.isoString.slice(0, 4)) : null,
    genre: null,
    duration_ms: e.duration ?? null,
    artwork_url: big?.url ?? null,
    explicit: Boolean(e.isExplicit),
    preview_url: previewOf(e),
  });
}

function parseId(input: string): string | null {
  const s = String(input || '').trim();
  const m = s.match(/(?:open\.spotify\.com\/(?:intl-[a-z]{2}\/)?track\/|spotify:track:)([A-Za-z0-9]{22})/);
  if (m) return m[1];
  return /^[A-Za-z0-9]{22}$/.test(s) ? s : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  let body: { q?: string; offset?: number; track?: string; preview?: number | string } = {};
  try { body = await req.json(); } catch { /* boş */ }

  // herkese açık: şarkının Spotify önizlemesini bul ve kaydet ('' = Spotify'da önizlemesi yok)
  if (body.preview != null) {
    try {
      const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const { data: tr, error } = await db.from('tracks').select('id,spotify_id,preview_url').eq('id', body.preview).maybeSingle();
      if (error) throw error;
      if (!tr) return json({ error: 'şarkı yok' }, 404);
      if (isSpPreview(tr.preview_url) || tr.preview_url === '') return json({ preview_url: tr.preview_url || null, cached: true });
      if (!tr.spotify_id) return json({ preview_url: null });
      const pv = previewOf(await embedEntity(tr.spotify_id));
      await db.from('tracks').update({ preview_url: pv ?? '' }).eq('id', tr.id);
      return json({ preview_url: pv });
    } catch (e) {
      return json({ error: String(e) }, 500);
    }
  }

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return json({ error: 'giriş gerekli' }, 401);
  const { data: admin } = await sb.from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
  if (!admin) return json({ error: 'yetki yok' }, 403);

  try {
    if (body.q) {
      const tk = await spotifyToken();
      if (!tk) return json({ error: 'no_credentials' }, 200);
      const p = new URLSearchParams({ q: String(body.q).slice(0, 100), type: 'track', market: 'TR', limit: '10', offset: String(Math.max(0, Number(body.offset) || 0)) });
      const d = await api(`/search?${p}`, tk);
      return json({ results: (d.tracks?.items ?? []).map(fromApi), total: d.tracks?.total ?? 0 });
    }

    if (body.track) {
      const id = parseId(body.track);
      if (!id) return json({ error: 'Geçerli bir Spotify şarkı linki değil' }, 400);
      const tk = await spotifyToken().catch(() => null);
      if (tk) {
        const raw = await api(`/tracks/${id}?market=TR`, tk);
        const t = fromApi(raw);
        if (!t.preview_url) t.preview_url = await embedEntity(id).then(previewOf).catch(() => null);
        const artistId = raw.artists?.[0]?.id;
        if (artistId) {
          const a = await api(`/artists/${artistId}`, tk).catch(() => null);
          if (a?.genres?.length) t.genre = a.genres.slice(0, 2).join(', ');
        }
        return json(await itunesFill(t));
      }
      return json(await fromEmbed(id));
    }

    return json({ error: 'q ya da track gerekli' }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
