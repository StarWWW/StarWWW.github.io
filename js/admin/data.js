// KONTROL ODASI — sayfaların ortak sorguları: özet sayılar, duvarın son sıfırlanması, şüpheli skorlar, Edge Function çağrısı.
import { weekStart } from '../spray.js';
import { isSpPreview, L } from './ui.js';

export const DAY = 864e5;
export const OLD_WEEKS = 12; // gizlilik politikası: 12 haftadan eski duvar çizgileri silinir

// Duvarın şu anki dönemi: bu haftanın pazartesisi ya da daha yeni bir elle buff
export async function wallSince(sb) {
  const { data } = await sb.from('wall_buffs').select('at').order('at', { ascending: false }).limit(1);
  const last = data?.[0]?.at ? Date.parse(data[0].at) : 0;
  return new Date(Math.max(weekStart(), last || 0)).toISOString();
}

// Saniye başına puan medyanın çok üstündeyse ya da süre yoksa şüpheli
export function flagScores(rows) {
  const pps = rows.filter((r) => r.duration_s >= 10).map((r) => r.score / r.duration_s).sort((a, b) => a - b);
  const median = pps.length ? pps[Math.floor(pps.length / 2)] : 0;
  const out = new Map();
  rows.forEach((r) => {
    if (r.score > 0 && !(r.duration_s > 0)) out.set(r.id, L('süre kaydı yok', 'no duration recorded'));
    else if (r.score > 0 && r.duration_s < 8) out.set(r.id, L(`${r.duration_s} sn'de ${r.score} puan`, `${r.score} points in ${r.duration_s}s`));
    else if (pps.length >= 5 && median > 0 && r.score / r.duration_s > median * 6) out.set(r.id, L(`saniyede ${Math.round(r.score / r.duration_s)} puan (normali ~${Math.round(median)})`, `${Math.round(r.score / r.duration_s)} pts/s (typical ~${Math.round(median)})`));
  });
  return out;
}

// Edge Function çağrısı: hata gövdesindeki mesajı da okur
export async function callFn(sb, name, body) {
  const t0 = performance.now();
  const { data, error } = await sb.functions.invoke(name, { body });
  const ms = Math.round(performance.now() - t0);
  if (!error) return { ok: !data?.error, status: 200, data, msg: data?.error || '', ms };
  let msg = error.message || String(error);
  let status = 0;
  try { status = error.context?.status || 0; msg = (await error.context?.json())?.error || msg; } catch { /* gövde yok */ }
  return { ok: false, status, data: null, msg, ms };
}

// Pano + menü rozetleri için tek seferde sayılar
export async function summary(sb) {
  const since = await wallSince(sb);
  const dayAgo = new Date(Date.now() - DAY).toISOString();
  const old = new Date(Date.now() - OLD_WEEKS * 7 * DAY).toISOString();
  const head = (t) => sb.from(t).select('id', { count: 'exact', head: true });
  const [tr, gm, sk, wl, wlDay, wlOld, gb, gbDay, sc] = await Promise.all([
    sb.from('tracks').select('id,title,spotify_id,preview_url'),
    sb.from('games').select('id,name,status,now_playing,box_url,steam_appid,store_url,cover_url'),
    sb.from('skills').select('id,level'),
    head('wall_strokes').gte('created_at', since),
    head('wall_strokes').gte('created_at', dayAgo),
    head('wall_strokes').lt('created_at', old),
    head('guestbook'),
    head('guestbook').gte('created_at', dayAgo),
    sb.from('scores').select('id,name,score,rank,duration_s,created_at').order('score', { ascending: false }).limit(100),
  ]);
  const tracks = tr.data || [];
  const games = gm.data || [];
  const skills = sk.data || [];
  const scores = sc.data || [];
  const flags = flagScores(scores);
  return {
    since,
    tracks: tracks.length,
    previews: tracks.filter((x) => isSpPreview(x.preview_url)).length,
    previewTodo: tracks.filter((x) => x.spotify_id && !isSpPreview(x.preview_url) && x.preview_url !== '').length,
    games: games.length,
    nowPlaying: games.find((g) => g.now_playing)?.name || '',
    noBox: games.filter((g) => !g.box_url && !g.steam_appid && !/\/app\/\d+/.test(g.store_url || '') && !/\/apps\/\d+\//.test(g.cover_url || '')).length,
    skills: skills.length,
    rated: skills.filter((s) => s.level > 0).length,
    wall: wl.count ?? 0,
    wallDay: wlDay.count ?? 0,
    wallOld: wlOld.count ?? 0,
    notes: gb.count ?? 0,
    notesDay: gbDay.count ?? 0,
    scores: scores.length,
    top: scores[0] || null,
    suspicious: flags.size,
  };
}
