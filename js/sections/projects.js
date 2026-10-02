import { getRepos, getProjectsConfig } from '../data.js';
import { esc, reducedMotion } from '../util.js';
import { t, onLang } from '../i18n.js';

const TILE = { 2: '#CBDBFC', 4: '#9BADB7', 8: '#5FCDE4', 16: '#639BFF', 32: '#99E550', 64: '#6ABE30', 128: '#FBF236', 256: '#DF7126', 512: '#D77BBA', 1024: '#AC3232', 2048: '#FFFFFF' };

export function init2048() {
  const el = document.getElementById('g2048');
  if (!el) return;
  let board = [2, 4, 8, 16, 256, 128, 64, 32, 512, 1024, 2048, 0, 4, 0, 2, 8];
  const render = (pop = -1) => {
    el.innerHTML = board.map((v, i) => {
      const style = `background:${v ? TILE[v] : '#3F3F74'};${v === 1024 ? 'color:#fff;' : ''}${v === 2048 ? 'box-shadow:4px 4px 0 #D77BBA;' : ''}`;
      return `<span class="${v >= 1000 ? 'big' : ''}${i === pop ? ' pop' : ''}" style="${style}">${v || ''}</span>`;
    }).join('');
  };
  render();
  if (reducedMotion()) return;
  let visible = false;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(el);
  setInterval(() => {
    if (!visible || document.hidden) return;
    const empty = board.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
    if (empty.length < 2) {
      board = board.map((v) => (v === 2048 || Math.random() > 0.35 ? v : 0));
      render();
      return;
    }
    const i = empty[Math.floor(Math.random() * empty.length)];
    board[i] = Math.random() < 0.85 ? 2 : 4;
    render(i);
  }, 1600);
}

export async function initRepos() {
  const box = document.getElementById('repoList');
  if (!box) return;
  const head = box.firstElementChild.outerHTML;
  let rows = null;
  let failed = false;

  const render = () => {
    const tail = `<div class="dim" style="margin-top:8px">${esc(t('repo.note'))}</div>`
      + '<div><span class="acc">star@oda</span>:<span class="cy">~/repos</span>$ <span class="blink">█</span></div>';
    if (failed) { box.innerHTML = `${head}<div class="dim">${esc(t('repo.err'))}</div>`; return; }
    if (!rows) return;
    const list = rows.length
      ? rows.map((r) => `<div class="repo-row" data-d><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.name)}/</a><span>${esc(r.lang || '—')}</span><span>★ ${r.stars}</span><span>${esc(r.desc || '')}</span></div>`).join('')
      : `<div class="dim">${esc(t('repo.none'))}</div>`;
    box.innerHTML = head + list + tail;
  };

  try {
    const [all, cfg] = await Promise.all([getRepos(), getProjectsConfig()]);
    const hide = new Set((cfg.hideRepos || []).map((s) => s.toLowerCase()));
    rows = all.filter((r) => !r.fork && !hide.has(r.name.toLowerCase()));
  } catch (err) {
    console.warn('[repos]', err);
    failed = true;
  }
  render();
  onLang(render);
}
