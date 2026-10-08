// Oyun arama: RAWG (tüm platformlar) + Steam (Türkçe tür adları, kapak, mağaza linki).
// Sadece admins tablosundaki kullanıcılar kullanabilir; RAWG anahtarı burada gizli kalır.
// Gizli değişken: RAWG_KEY  (https://rawg.io/apidocs)
import { createClient } from 'jsr:@supabase/supabase-js@2';

const RAWG = 'https://api.rawg.io/api';
// Tarayıcıdan sadece site (ve yerel geliştirme) çağırabilsin
const ORIGINS = new Set(['https://starwww.dev', 'http://localhost:8080', 'http://127.0.0.1:8080']);
const corsOf = (req: Request) => {
  const origin = req.headers.get('Origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ORIGINS.has(origin) ? origin : 'https://starwww.dev',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
};
const responder = (req: Request) => {
  const cors = corsOf(req);
  return {
    cors,
    json: (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } }),
  };
};

type Named = { name: string };
const names = (a?: Named[]) => (a ?? []).map((x) => x.name);
const platforms = (g: { parent_platforms?: { platform: Named }[] }) => (g.parent_platforms ?? []).map((p) => p.platform.name);

Deno.serve(async (req) => {
  const { cors, json } = responder(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST gerekli' }, 405);

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return json({ error: 'giriş gerekli' }, 401);
  const { data: admin } = await sb.from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
  if (!admin) return json({ error: 'yetki yok' }, 403);

  const key = Deno.env.get('RAWG_KEY');
  if (!key) return json({ error: 'RAWG_KEY tanımlı değil' }, 500);

  let body: { q?: string; id?: number } = {};
  try { body = await req.json(); } catch { /* boş */ }

  try {
    if (body.q) {
      const r = await fetch(`${RAWG}/games?${new URLSearchParams({ key, search: String(body.q).slice(0, 80), page_size: '12' })}`);
      const d = await r.json();
      return json({
        results: (d.results ?? []).map((g: Record<string, unknown>) => ({
          id: g.id, name: g.name, released: g.released, cover: g.background_image,
          platforms: platforms(g as never), genres: names(g.genres as Named[]),
        })),
      });
    }

    if (body.id) {
      const id = Number(body.id);
      if (!Number.isSafeInteger(id) || id <= 0) return json({ error: 'geçersiz id' }, 400);
      const [g, st] = await Promise.all([
        fetch(`${RAWG}/games/${id}?key=${key}`).then((r) => r.json()),
        fetch(`${RAWG}/games/${id}/stores?key=${key}`).then((r) => r.json()).catch(() => ({})),
      ]);
      const steamUrl: string | undefined = (st.results ?? []).map((s: { url: string }) => s.url).find((u: string) => /store\.steampowered\.com\/app\/\d+/.test(u));
      const steamId = steamUrl ? Number(steamUrl.match(/app\/(\d+)/)![1]) : null;
      let out = {
        rawg_id: g.id, name: g.name, released: g.released,
        developers: names(g.developers), publishers: names(g.publishers), genres: names(g.genres), platforms: platforms(g),
        metacritic: g.metacritic ?? null, cover_url: g.background_image ?? '', store_url: steamUrl ?? g.website ?? '', steam_appid: steamId,
        box_url: '',
      };
      // Dikey kutu kapağı (Steam kütüphane görseli, 600x900) — varsa
      if (steamId) {
        const box = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${steamId}/library_600x900.jpg`;
        const head = await fetch(box, { method: 'HEAD' }).catch(() => null);
        if (head?.ok) out.box_url = box;
      }
      if (steamId) {
        const sd = await fetch(`https://store.steampowered.com/api/appdetails?appids=${steamId}&l=turkish&cc=tr`).then((r) => r.json()).catch(() => null);
        const x = sd?.[steamId]?.success ? sd[steamId].data : null;
        if (x) {
          out = {
            ...out,
            genres: x.genres?.length ? x.genres.map((k: { description: string }) => k.description) : out.genres,
            developers: x.developers?.length ? x.developers : out.developers,
            publishers: x.publishers?.length ? x.publishers : out.publishers,
            cover_url: x.header_image || out.cover_url,
            metacritic: x.metacritic?.score ?? out.metacritic,
            store_url: `https://store.steampowered.com/app/${steamId}/`,
          };
        }
      }
      return json(out);
    }

    return json({ error: 'q veya id gerekli' }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
