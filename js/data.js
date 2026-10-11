// İçerik kaynakları: Supabase ayarlıysa oradan, değilse /data/*.json'dan.
import { CONFIG, hasSupabase } from './config.js';
import { restSelect } from './supabase.js';

const fetchT = (url, opts = {}, ms = 10000) => {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  return fetch(url, { ...opts, signal: ctl.signal }).finally(() => clearTimeout(t));
};

async function json(path) {
  const r = await fetchT(path, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

// Sayfa açılırken supabase-js yüklenmesin diye düz istekle okunur (bkz. supabase.js > restSelect)
async function fromDb(table, order, fallbackPath) {
  if (hasSupabase()) {
    try {
      const ord = order.map(([col, asc]) => `${col}.${asc ? 'asc' : 'desc'}.nullslast`).join(',');
      const data = await restSelect(table, `select=*&order=${ord}`);
      if (Array.isArray(data)) return data;
    } catch (err) {
      console.warn(`[data] ${table}: ${err.message} — yedek dosyaya düşülüyor`);
    }
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
  const r = await fetchT(`https://api.github.com/users/${CONFIG.githubUser}/repos?per_page=100&sort=updated`, {}, 8000);
  if (!r.ok) throw new Error(`GitHub ${r.status}`);
  const data = (await r.json()).map((x) => ({
    name: x.name, url: x.html_url, lang: x.language, stars: x.stargazers_count, fork: x.fork, desc: x.description, homepage: x.homepage, pushed: x.pushed_at,
  }));
  try { sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), data })); } catch { /* kota */ }
  return data;
}
