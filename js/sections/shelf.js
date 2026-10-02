import { getGames } from '../data.js';
import { esc, API } from '../util.js';
import { t, getLang, onLang } from '../i18n.js';
import { pixelate, isDark } from '../pixelate.js';

const TILT = [-2, 1, 0, -1.5, 2, -1, 1.5, -0.5];

export function fmtDate(iso, style = 'short') {
  if (!iso) return '—';
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return String(iso);
  return new Intl.DateTimeFormat(getLang() === 'en' ? 'en-GB' : 'tr-TR', { day: 'numeric', month: style, year: 'numeric' }).format(d);
}
const year = (iso) => (iso ? String(iso).slice(0, 4) : '');
const list = (a) => (Array.isArray(a) ? a.filter(Boolean).join(' · ') : (a || '—')) || '—';

export async function initShelf() {
  const shelf = document.getElementById('shelf');
  const detail = document.getElementById('cartDetail');
  if (!shelf) return;

  let games = [];
  try { games = await getGames(); } catch (err) { console.warn('[shelf]', err); }
  let sel = Math.max(0, games.findIndex((g) => g.now_playing));

  const nowGame = games.find((g) => g.now_playing);
  const st = document.getElementById('stGame');
  if (st) st.textContent = nowGame ? nowGame.name : '—';

  function cart(g, i) {
    const color = g.color || '#AC3232';
    const lift = g.now_playing ? 'translateY(-26px)' : `rotate(${TILT[i % TILT.length]}deg)`;
    const genre = (Array.isArray(g.genres) ? g.genres[0] : g.genres) || '';
    return `<button type="button" class="cart${isDark(color) ? ' dark' : ''}" role="listitem" data-i="${i}" data-d style="--c:${esc(color)};transform:${lift}" aria-label="${esc(g.name)}">
      <span class="cart-body"></span>
      <span class="cart-label"><span class="cart-cover">${g.cover_url ? `<img alt="" data-cover="${esc(g.cover_url)}">` : `<span class="cart-ini" aria-hidden="true">${esc(g.name.trim().charAt(0).toLocaleUpperCase('tr'))}</span>`}</span>
      <span class="cart-txt"><span class="nm">${esc(g.name)}</span><span class="gn">${esc([genre, year(g.released)].filter(Boolean).join(' · '))}</span></span></span>
      <span class="cart-grip"></span>
      ${g.now_playing ? `<span class="cart-now">${esc(t('gm.now'))}</span>` : ''}
    </button>`;
  }

  function showDetail(i) {
    const g = games[i];
    if (!g) { detail.innerHTML = ''; return; }
    sel = i;
    shelf.querySelectorAll('.cart').forEach((c) => c.classList.toggle('on', Number(c.dataset.i) === i));
    const statusKey = `st.${g.status || 'oynadım'}`;
    detail.innerHTML = `<div class="cd-bar"><span>${esc(t('gm.detail'))}</span><span class="acc">${esc(t('gm.auto'))}</span></div>
      <div class="cd-in" style="--c:${esc(g.color || '#AC3232')}">
        <div class="cd-cover">${g.cover_url ? '<img alt="" id="cdCover">' : '<span style="display:block;aspect-ratio:460/215"></span>'}</div>
        <div class="cd-main">
          <div class="brut cd-name">${esc(g.name)}</div>
          <dl class="term cd-dl">
            <dt>${esc(t('gm.dev'))}</dt><dd>${esc(list(g.developers))}</dd>
            <dt>${esc(t('gm.pub'))}</dt><dd>${esc(list(g.publishers))}</dd>
            <dt>${esc(t('gm.rel'))}</dt><dd>${esc(fmtDate(g.released))}</dd>
            <dt>${esc(t('gm.genre'))}</dt><dd>${esc(list(g.genres))}</dd>
            <dt>${esc(t('gm.plat'))}</dt><dd>${esc(list(g.platforms))}</dd>
            ${g.metacritic ? `<dt>${esc(t('gm.meta'))}</dt><dd>${esc(g.metacritic)}</dd>` : ''}
          </dl>
          <div class="cd-chips"><span class="st">${esc(t('gm.status'))}: ${esc(t(statusKey))}</span>${g.store_url ? `<a href="${esc(g.store_url)}" target="_blank" rel="noopener">${esc(t('gm.store'))}</a>` : ''}</div>
          ${g.note ? `<p class="hand cd-note">${esc(t('gm.note'))}: "${esc(g.note)}"</p>` : ''}
        </div>
      </div>`;
    if (g.cover_url) pixelate(g.cover_url, 64, 30).then((src) => { const im = document.getElementById('cdCover'); if (im && src) im.src = src; });
  }

  function render() {
    if (!games.length) { shelf.innerHTML = `<p class="empty-note">${esc(t('gm.empty'))}</p>`; detail.innerHTML = ''; return; }
    shelf.innerHTML = games.map(cart).join('');
    shelf.querySelectorAll('img[data-cover]').forEach((im) => {
      pixelate(im.dataset.cover, 40, 24).then((src) => { if (src) im.src = src; });
    });
    showDetail(sel);
  }

  shelf.addEventListener('mouseover', (e) => { const c = e.target.closest('.cart'); if (c) showDetail(Number(c.dataset.i)); });
  shelf.addEventListener('focusin', (e) => { const c = e.target.closest('.cart'); if (c) showDetail(Number(c.dataset.i)); });
  shelf.addEventListener('click', (e) => { const c = e.target.closest('.cart'); if (c) showDetail(Number(c.dataset.i)); });

  render();
  onLang(render);
  API.games = { list: () => games, now: () => nowGame };
}
