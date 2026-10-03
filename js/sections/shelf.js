// OYUN RAFI — gerçek oyun kutuları. Tıklayınca kutu dönerek öne gelir, arkası okunur, disk dışarı kayar.
import { getGames } from '../data.js';
import { esc, API, reducedMotion, mulberry32, hashStr, nameLang } from '../util.js';
import { t, getLang, onLang } from '../i18n.js';
import { isDark } from '../pixelate.js';
import { spriteSVG } from '../sprites.js';

const SHELF_RY = 26; // raftaki kutuların açısı (sırtı görünsün)
const EASE = 'cubic-bezier(.16,1,.3,1)';

export function fmtDate(iso, style = 'short') {
  if (!iso) return '—';
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return String(iso);
  return new Intl.DateTimeFormat(getLang() === 'en' ? 'en-GB' : 'tr-TR', { day: 'numeric', month: style, year: 'numeric' }).format(d);
}
const year = (iso) => (iso ? String(iso).slice(0, 4) : '');
const list = (a) => (Array.isArray(a) ? a.filter(Boolean).join(' · ') : (a || '—')) || '—';
const first = (a) => (Array.isArray(a) ? a[0] : a) || '';
const pad = (n) => String(n).padStart(3, '0');
const stKey = (g) => `st.${g.status || 'oynadım'}`;
const colorOf = (g) => g.color || '#AC3232';
// Kutu kapağı: kayıtlı box_url, yoksa Steam kimliğinden dikey kapak (library_600x900)
const steamId = (g) => g.steam_appid || String(g.store_url || '').match(/store\.steampowered\.com\/app\/(\d+)/)?.[1] || String(g.cover_url || '').match(/steam\/apps\/(\d+)\//)?.[1];
const boxOf = (g) => g.box_url || (steamId(g) ? `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${steamId(g)}/library_600x900.jpg` : '');

// ---------- kutu parçaları ----------
function coverGen(g) {
  const lg = nameLang(g.name);
  const words = g.name.toLocaleUpperCase(lg).split(/\s+/).filter(Boolean);
  const fs = Math.min(15, Math.floor((84 / (0.86 * Math.max(...words.map((w) => w.length), 1))) * 10) / 10);
  const icon = /minecraft/i.test(g.name) ? `<span class="cg-ico">${spriteSVG('grass', 8)}</span>` : `<span class="cg-ini px" aria-hidden="true">${esc(words[0]?.charAt(0) || '?')}</span>`;
  return `<span class="cover-gen" aria-hidden="true">
    <span class="cg-pat"></span>${icon}
    <span class="cg-title brut" lang="${lg}" style="font-size:${fs}cqw">${words.map((w) => `<span>${esc(w)}</span>`).join('')}</span>
    <span class="cg-sub px">${esc([first(g.genres), year(g.released)].filter(Boolean).join(' · '))}</span>
    <span class="cg-ed px">STAR EDITION</span>
  </span>`;
}
const art = (g) => `${coverGen(g)}${boxOf(g) ? `<img class="case-img" src="${esc(boxOf(g))}" alt="" decoding="async" draggable="false">` : ''}`;
const frontHTML = (g) => `<span class="case-band px"><b>PC</b><span>DVD-ROM</span><i>${spriteSVG('star', 2)}</i></span><span class="case-art">${art(g)}</span><span class="case-gloss" aria-hidden="true"></span>`;
const spineHTML = (g) => `<span class="sp-band px">PC</span><span class="sp-title brut" lang="${nameLang(g.name)}">${esc(g.name)}</span><span class="sp-logo">${spriteSVG('star', 2)}</span>`;

function barcode(seed) {
  const rnd = mulberry32(hashStr(seed));
  let x = 0; let bars = '';
  while (x < 94) {
    const w = 1 + Math.floor(rnd() * 3);
    if (rnd() > 0.42) bars += `<rect x="${x}" width="${w}" height="30"/>`;
    x += w + 1;
  }
  const d = String(hashStr(`${seed}#`)).padEnd(12, '7').slice(0, 12);
  return `<svg viewBox="0 0 96 30" preserveAspectRatio="none" aria-hidden="true">${bars}</svg><span>8 ${d.slice(0, 6)} ${d.slice(6)}</span>`;
}

function backHTML(g, i) {
  const rows = [['gm.dev', list(g.developers)], ['gm.pub', list(g.publishers)], ['gm.rel', fmtDate(g.released, 'long')], ['gm.genre', list(g.genres)], ['gm.plat', list(g.platforms)]];
  return `<div class="bk${g.note ? ' has-note' : ''}">
    <div class="bk-top px"><span>STAR-${pad(i + 1)}</span><span>PC DVD-ROM</span></div>
    <div class="bk-shot"><span class="bk-shot-ph brut" lang="${nameLang(g.name)}">${esc(g.name)}</span>${g.cover_url ? `<img src="${esc(g.cover_url)}" alt="" decoding="async" draggable="false">` : ''}</div>
    <div class="bk-name brut" lang="${nameLang(g.name)}">${esc(g.name)}</div>
    <dl class="bk-dl">${rows.map(([k, v]) => `<dt>${esc(t(k))}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
    <div class="bk-row">
      <span class="bk-st px">${esc(t('gm.status'))}: ${esc(t(stKey(g)))}</span>
      ${g.metacritic ? `<span class="bk-mc" title="Metacritic"><b>${esc(g.metacritic)}</b><small>META</small></span>` : ''}
    </div>
    ${g.note ? `<p class="hand bk-note" title="${esc(g.note)}">${esc(t('gm.note'))}: “${esc(g.note)}”</p>` : ''}
    <div class="bk-foot">
      <span class="bk-bar">${barcode(g.name)}</span>
      ${g.store_url ? `<a class="bk-store px" href="${esc(g.store_url)}" target="_blank" rel="noopener">${esc(t('gm.store'))}</a>` : ''}
    </div>
    <p class="bk-legal">${esc(t('gm.legal'))}</p>
  </div>`;
}

const discHTML = (g) => `<span class="disc-spin">
  <span class="disc-label">${coverGen(g)}${boxOf(g) ? `<img src="${esc(boxOf(g))}" alt="" draggable="false">` : ''}</span>
  <span class="disc-ring px">${esc(g.name)} · ${esc(t('gm.disc'))} · STAR EDITION ·</span>
  <span class="disc-hole"></span></span>`;

export async function initShelf() {
  const shelf = document.getElementById('shelf');
  const nowEl = document.getElementById('shelfNow');
  const countEl = document.getElementById('gmCount');
  if (!shelf) return;

  let games = [];
  try { games = await getGames(); } catch (err) { console.warn('[shelf]', err); }
  const nowGame = () => games.find((g) => g.now_playing);

  const paintStatus = () => {
    const st = document.getElementById('stGame');
    if (st) st.textContent = nowGame()?.name || t('gm.break');
  };

  // kırık kapak görseli → tasarlanmış kapak kalır
  const onImgErr = (e) => { if (e.target.tagName === 'IMG' && e.target.closest('.case-art, .bk-shot, .disc-label, .sn-art')) e.target.remove(); };
  document.addEventListener('error', onImgErr, true);

  // ---------- raf ----------
  function caseHTML(g, i) {
    return `<div class="case-slot rv" data-rv="drop" role="listitem" style="--i:${i}">
      <button type="button" class="case${isDark(colorOf(g)) ? ' dark' : ''}${g.now_playing ? ' is-now' : ''}" data-i="${i}" style="--c:${esc(colorOf(g))}" aria-label="${esc(t('gm.open', { n: g.name }))}" data-cursor="${esc(t('gm.flip'))}">
        <span class="case-3d">
          <span class="case-face case-spine">${spineHTML(g)}</span>
          <span class="case-face case-front">${frontHTML(g)}</span>
        </span>
        <span class="case-shadow" aria-hidden="true"></span>
        ${g.now_playing ? `<span class="case-now px" aria-hidden="true">${esc(t('gm.now'))}!</span>` : ''}
        <span class="case-tag px" aria-hidden="true">${esc(t(stKey(g)))}</span>
      </button>
    </div>`;
  }

  function renderNow() {
    if (!nowEl) return;
    const i = Math.max(0, games.findIndex((g) => g.now_playing));
    const g = games[i];
    if (!g) { nowEl.innerHTML = ''; return; }
    nowEl.innerHTML = `<div class="sn-bar px"><span>${g.now_playing ? '<i class="blink">●</i> ' : ''}${esc(t(g.now_playing ? 'gm.nowCard' : 'gm.lastAdded'))}</span><span>STAR-${pad(i + 1)}</span></div>
      <div class="sn-in${isDark(colorOf(g)) ? ' dark' : ''}" style="--c:${esc(colorOf(g))}">
        <span class="sn-art case-art">${art(g)}</span>
        <div class="sn-main">
          <div class="brut sn-name" lang="${nameLang(g.name)}">${esc(g.name)}</div>
          <p class="px sn-meta">${esc([list(g.genres), year(g.released)].filter(Boolean).join(' · '))}</p>
          <dl class="term sn-dl">
            <dt>${esc(t('gm.dev'))}</dt><dd>${esc(list(g.developers))}</dd>
            <dt>${esc(t('gm.status'))}</dt><dd>${esc(t(stKey(g)))}</dd>
          </dl>
          ${g.note ? `<p class="hand sn-note">${esc(t('gm.note'))}: “${esc(g.note)}”</p>` : ''}
          <button type="button" class="btn sn-open" data-open="${i}" data-magnetic>${esc(t('gm.open', { n: g.name }))} <span aria-hidden="true">↻</span></button>
        </div>
      </div>`;
  }

  function render() {
    if (countEl) countEl.textContent = t('gm.count', { n: games.length });
    if (!games.length) { shelf.innerHTML = `<p class="empty-note">${esc(t('gm.empty'))}</p>`; if (nowEl) nowEl.innerHTML = ''; return; }
    shelf.innerHTML = games.map(caseHTML).join('');
    if (cur >= 0) shelf.querySelector(`.case[data-i="${cur}"]`)?.classList.add('away');
    renderNow();
    paintStatus();
    edges();
  }

  // kaydırma ipuçları + fareyle sürükleyerek kaydırma
  const edges = () => {
    shelf.classList.toggle('can-l', shelf.scrollLeft > 4);
    shelf.classList.toggle('can-r', shelf.scrollLeft + shelf.clientWidth < shelf.scrollWidth - 4);
  };
  shelf.addEventListener('scroll', edges, { passive: true });
  window.addEventListener('resize', edges);

  let drag = null;
  let suppressClick = false;
  shelf.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || shelf.scrollWidth <= shelf.clientWidth) return;
    drag = { x: e.clientX, sl: shelf.scrollLeft, moved: false };
  });
  window.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) > 6) { drag.moved = true; shelf.classList.add('dragging'); }
    if (drag.moved) shelf.scrollLeft = drag.sl - dx;
  });
  window.addEventListener('pointerup', () => {
    if (drag?.moved) { suppressClick = true; setTimeout(() => { suppressClick = false; }, 0); }
    drag = null;
    shelf.classList.remove('dragging');
  });
  shelf.addEventListener('click', (e) => {
    const c = e.target.closest('.case');
    if (!c) return;
    if (suppressClick) { e.preventDefault(); return; }
    open(Number(c.dataset.i), c);
  });
  nowEl?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-open]');
    if (!b) return;
    const i = Number(b.dataset.open);
    open(i, shelf.querySelector(`.case[data-i="${i}"]`) || b);
  });

  // ---------- kutu görüntüleyici ----------
  let v = null; let fly; let box; let ang = 0; let cur = -1; let busy = false; let lastFocus = null;
  const el = (id) => v.querySelector(`#${id}`);

  function build() {
    v = document.createElement('div');
    v.className = 'cv';
    v.id = 'caseViewer';
    v.hidden = true;
    v.setAttribute('role', 'dialog');
    v.setAttribute('aria-modal', 'true');
    v.innerHTML = `<div class="cv-bg" data-close></div>
      <div class="cv-top px"><span id="cvIdx"></span><span id="cvTitle" class="cv-title"></span><span id="cvFace" class="cv-face-l"></span></div>
      <div class="cv-stage" data-close>
        <div class="cv-fly"><div class="cv-float">
          <div class="cv-disc" id="cvDisc"></div>
          <div class="cv-box" id="cvBox" data-cursor="↻">
            <div class="cv-face case-front" id="cvFront"></div>
            <div class="cv-face cv-back" id="cvBack"></div>
            <div class="cv-face case-spine cv-spine" id="cvSpine"></div>
            <div class="cv-face cv-edge"></div>
            <div class="cv-face cv-cap cv-cap-t"></div>
            <div class="cv-face cv-cap cv-cap-b"></div>
          </div>
        </div></div>
      </div>
      <div class="cv-ui">
        <button type="button" class="btn cv-nav" id="cvPrev">←</button>
        <button type="button" class="btn btn-acc" id="cvFlip" aria-pressed="false"></button>
        <button type="button" class="btn btn-ink" id="cvClose"></button>
        <button type="button" class="btn cv-nav" id="cvNext">→</button>
      </div>
      <p class="cv-keys px" id="cvKeys"></p>`;
    document.body.appendChild(v);
    fly = v.querySelector('.cv-fly');
    box = el('cvBox');

    v.addEventListener('click', (e) => { if (e.target.hasAttribute('data-close')) close(); });
    el('cvClose').addEventListener('click', close);
    el('cvFlip').addEventListener('click', () => turn(180));
    el('cvPrev').addEventListener('click', () => go(-1));
    el('cvNext').addEventListener('click', () => go(1));
    v.addEventListener('keydown', onKey);
    v.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
    window.addEventListener('resize', () => { if (!v.hidden) size(); });

    // kutuyu fareyle/parmakla döndür; dokunup bırakınca çevir
    box.addEventListener('pointerdown', (e) => {
      if (busy || e.button > 0 || e.target.closest('a')) return;
      const x0 = e.clientX; const a0 = ang; let moved = false;
      box.classList.add('grab');
      const mv = (ev) => {
        const dx = ev.clientX - x0;
        if (Math.abs(dx) > 5) moved = true;
        if (!moved) return;
        ang = a0 + dx * 0.55;
        paintAng();
      };
      const up = () => {
        window.removeEventListener('pointermove', mv);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        box.classList.remove('grab');
        ang = moved ? Math.round(ang / 180) * 180 : a0 + 180;
        paintAng();
      };
      window.addEventListener('pointermove', mv);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    });
  }

  const isBack = () => { const a = ((ang % 360) + 360) % 360; return a > 90 && a < 270; };
  function paintAng() {
    box.style.transform = `rotateY(${ang}deg)`;
    const back = isBack();
    v.classList.toggle('flipped', back);
    el('cvFace').textContent = t(back ? 'gm.back' : 'gm.front');
    el('cvFlip').setAttribute('aria-pressed', String(back));
  }
  const turn = (d) => { if (!busy) { ang += d; paintAng(); } };

  function size() {
    const W = Math.round(Math.max(150, Math.min(340, window.innerWidth * (window.innerWidth < 640 ? 0.7 : 0.6), (window.innerHeight - 210) / 1.5)));
    v.style.setProperty('--cw', `${W}px`);
    v.style.setProperty('--ch', `${Math.round(W * 1.5)}px`);
    v.style.setProperty('--cd', `${Math.max(12, Math.round(W * 0.075))}px`);
  }

  function labels() {
    el('cvFlip').textContent = `${t('gm.flip')} ↻`;
    el('cvClose').textContent = `${t('gm.close')} ✕`;
    el('cvPrev').setAttribute('aria-label', t('gm.prev'));
    el('cvNext').setAttribute('aria-label', t('gm.next'));
    el('cvKeys').textContent = t('gm.keys');
    paintAng();
  }

  function fill(i) {
    const g = games[i];
    cur = i;
    v.style.setProperty('--c', colorOf(g));
    v.classList.toggle('dark', isDark(colorOf(g)));
    v.setAttribute('aria-label', g.name);
    el('cvFront').innerHTML = frontHTML(g);
    el('cvBack').innerHTML = backHTML(g, i);
    el('cvSpine').innerHTML = spineHTML(g);
    el('cvDisc').innerHTML = discHTML(g);
    el('cvIdx').textContent = `${String(i + 1).padStart(2, '0')} / ${String(games.length).padStart(2, '0')}`;
    el('cvTitle').textContent = g.name;
    el('cvTitle').lang = nameLang(g.name);
    shelf.querySelectorAll('.case.away').forEach((c) => c.classList.remove('away'));
    shelf.querySelector(`.case[data-i="${i}"]`)?.classList.add('away');
  }

  // raftaki kutudan görüntüleyicideki yerine giden dönüşüm
  function flipFrom(src) {
    const a = src.getBoundingClientRect();
    const b = fly.getBoundingClientRect();
    if (!a.width || !b.width) return null;
    const s = a.width / b.width;
    return `translate(${(a.left + a.width / 2) - (b.left + b.width / 2)}px, ${(a.top + a.height / 2) - (b.top + b.height / 2)}px) scale(${s})`;
  }
  const inView = (r) => r.width && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;

  async function open(i, src) {
    if (busy || !games[i]) return;
    if (!v) build();
    busy = true;
    lastFocus = document.activeElement;
    const rm = reducedMotion();
    size();
    fill(i);
    ang = 0;
    box.style.transform = '';
    labels();
    v.hidden = false;
    v.classList.remove('disc-out');
    document.documentElement.classList.add('cv-open');
    API.fx?.stopScroll?.();
    void v.offsetWidth;
    v.classList.add('open');
    const from = src && !rm ? flipFrom(src.querySelector('.case-3d') || src) : null;
    try {
      if (from) {
        const spin = [{ transform: `rotateY(${SHELF_RY}deg) rotateX(0deg)` }, { transform: 'rotateY(200deg) rotateX(14deg)', offset: 0.55 }, { transform: 'rotateY(360deg) rotateX(0deg)' }];
        box.animate(spin, { duration: 1050, easing: EASE });
        await fly.animate([{ transform: from }, { transform: 'none' }], { duration: 1050, easing: EASE }).finished;
      } else {
        await fly.animate([{ opacity: 0, transform: 'scale(.94)' }, { opacity: 1, transform: 'none' }], { duration: rm ? 180 : 420, easing: EASE }).finished;
      }
    } catch { /* iptal */ }
    v.classList.add('disc-out');
    el('cvClose').focus({ preventScroll: true });
    busy = false;
  }

  async function close() {
    if (!v || v.hidden || busy) return;
    busy = true;
    const rm = reducedMotion();
    const src = shelf.querySelector(`.case[data-i="${cur}"]`);
    v.classList.remove('disc-out');
    v.classList.remove('open');
    const target = src && !rm && inView(src.getBoundingClientRect()) ? flipFrom(src.querySelector('.case-3d')) : null;
    try {
      if (target) {
        const end = Math.round((ang - SHELF_RY) / 360) * 360 + SHELF_RY - (isBack() ? 0 : 360);
        box.animate([{ transform: `rotateY(${ang}deg)` }, { transform: `rotateY(${end}deg)` }], { duration: 700, easing: EASE, fill: 'forwards' });
        await fly.animate([{ transform: 'none' }, { transform: target }], { duration: 700, easing: EASE, fill: 'forwards' }).finished;
      } else {
        await fly.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(.94)' }], { duration: rm ? 150 : 300, easing: 'ease-in', fill: 'forwards' }).finished;
      }
    } catch { /* iptal */ }
    v.hidden = true;
    fly.getAnimations().forEach((a) => a.cancel());
    box.getAnimations().forEach((a) => a.cancel());
    src?.classList.remove('away');
    cur = -1;
    document.documentElement.classList.remove('cv-open');
    API.fx?.startScroll?.();
    (src || lastFocus)?.focus?.({ preventScroll: true });
    busy = false;
  }

  async function go(d) {
    if (busy || games.length < 2) return;
    busy = true;
    const rm = reducedMotion();
    const n = (cur + d + games.length) % games.length;
    v.classList.remove('disc-out');
    try {
      await fly.animate([{ transform: 'none', opacity: 1 }, { transform: `perspective(1200px) translateX(${-d * 90}px) rotateY(${-d * 50}deg)`, opacity: 0 }], { duration: rm ? 120 : 240, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' }).finished;
      fill(n);
      ang = 0;
      box.style.transition = 'none';
      paintAng();
      void box.offsetWidth;
      box.style.transition = '';
      fly.getAnimations().forEach((a) => a.cancel());
      await fly.animate([{ transform: `perspective(1200px) translateX(${d * 90}px) rotateY(${d * 50}deg)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: rm ? 150 : 520, easing: EASE }).finished;
    } catch { /* iptal */ }
    v.classList.add('disc-out');
    shelf.querySelector(`.case[data-i="${n}"]`)?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: rm ? 'auto' : 'smooth' });
    busy = false;
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1); return; }
    if ((e.key === ' ' || e.key.toLowerCase() === 'f') && !e.target.closest('button, a')) { e.preventDefault(); turn(180); return; }
    if (e.key === 'Tab') {
      const f = [...v.querySelectorAll('button, a[href]')].filter((x) => x.offsetParent !== null || x.closest('.cv-back'));
      if (!f.length) return;
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  }

  render();
  onLang(() => {
    render();
    if (v && !v.hidden && cur >= 0) { const a = ang; fill(cur); ang = a; labels(); }
  });
  API.games = { list: () => games, now: nowGame, open: (i) => open(i, shelf.querySelector(`.case[data-i="${i}"]`)) };
}
