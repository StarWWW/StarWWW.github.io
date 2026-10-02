// İçerik kaynakları: Supabase ayarlıysa oradan, değilse /data/*.json'dan.
import { CONFIG } from './config.js';
import { getSupabase } from './supabase.js';

async function json(path) {
  const r = await fetch(path, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

async function fromDb(table, order, fallbackPath) {
  const sb = await getSupabase();
  if (sb) {
    let q = sb.from(table).select('*');
    for (const [col, asc] of order) q = q.order(col, { ascending: asc, nullsFirst: false });
    const { data, error } = await q;
    if (!error && data) return data;
    console.warn(`[data] ${table} okunamadı, yedek dosyaya düşülüyor`, error);
  }
  return json(fallbackPath);
}

export const getTracks = () => fromDb('tracks', [['sort', true], ['created_at', true]], 'data/music.json');
export const getGames = () => fromDb('games', [['sort', true], ['created_at', true]], 'data/games.json');
export const getSkills = () => fromDb('skills', [['sort', true], ['name', true]], 'data/skills.json');
export const getProjectsConfig = () => json('data/projects.json').catch(() => ({ hideRepos: [] }));

export async function getRepos() {
  const key = 'star.repos.v1';
  try {
    const c = JSON.parse(sessionStorage.getItem(key) || 'null');
    if (c && Date.now() - c.at < 10 * 60 * 1000) return c.data;
  } catch { /* yok */ }
  const r = await fetch(`https://api.github.com/users/${CONFIG.githubUser}/repos?per_page=100&sort=updated`);
  if (!r.ok) throw new Error(`GitHub ${r.status}`);
  const data = (await r.json()).map((x) => ({
    name: x.name, url: x.html_url, lang: x.language, stars: x.stargazers_count, fork: x.fork, desc: x.description, homepage: x.homepage, pushed: x.pushed_at,
  }));
  try { sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), data })); } catch { /* kota */ }
  return data;
}
