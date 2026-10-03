// ENVANTER — RPG envanteri: nadirlik renkleri, detay paneli, yetenek haritası, kuşanılanlar.
import { getSkills } from '../data.js';
import { esc, API, nameLang } from '../util.js';
import { t, onLang, getLang } from '../i18n.js';
import { spriteSVG } from '../sprites.js';

export const CATS = [['diller', 'sk.c.diller'], ['web', 'sk.c.web'], ['veri', 'sk.c.veri2'], ['arac', 'sk.c.arac2'], ['oyun', 'sk.c.oyun2']];
const ICON = { diller: 'term', web: 'globe', veri: 'db', arac: 'wrench', oyun: 'brush' };
const CATCOL = { diller: 'var(--acid)', web: 'var(--cyan)', veri: 'var(--orange)', arac: 'var(--steel)', oyun: 'var(--pink)' };
const SHORT = { diller: ['DİL', 'LANG'], web: ['WEB', 'WEB'], veri: ['VERİ', 'DATA'], arac: ['ARAÇ', 'TOOL'], oyun: ['SANAT', 'ART'] };

const longest = (name) => Math.max(...name.split(/[\s/]+/).map((w) => w.length), 1);
// detay panelindeki isim kelime ortasından bölünmesin: en uzun kelimeye göre punto
const fitSize = (name) => Math.max(18, Math.min(34, Math.floor(232 / (0.7 * longest(name)))));

const dec = (n) => (getLang() === 'en' ? n.toFixed(1) : n.toFixed(1).replace('.', ','));
export const rarity = (lv) => (!lv ? 0 : lv <= 2 ? 1 : lv <= 4 ? 2 : lv <= 6 ? 3 : lv <= 8 ? 4 : 5);
const catName = (k) => t(CATS.find(([c]) => c === k)?.[1] || k);

export async function initSkills() {
  const $ = (id) => document.getElementById(id);
  const tabs = $('skTabs');
  const grid = $('skGrid');
  const inspect = $('skInspect');
  if (!tabs || !grid) return;

  let skills = [];
  try { skills = (await getSkills()).map((s) => ({ ...s, level: Number(s.level) || 0 })); } catch (err) { console.warn('[skills]', err); }
  let cur = 'all';
  let sort = 'lv';
  let sel = null;

  const rated = () => skills.filter((s) => s.level > 0);
  const byLv = (a, b) => (b.level - a.level) || a.name.localeCompare(b.name, 'tr');
  const byAz = (a, b) => a.name.localeCompare(b.name, 'tr');
  const view = () => (cur === 'all' ? skills : skills.filter((s) => s.category === cur)).slice().sort(sort === 'lv' ? byLv : byAz);

  // ---------- sol panel ----------
  function renderSide() {
    const r = rated();
    const total = skills.reduce((a, s) => a + s.level, 0);
    const max = skills.length * 10 || 1;
    $('skXp').textContent = `${total} / ${max}`;
    $('skXpBar').style.width = `${(total / max) * 100}%`;
    const avg = r.length ? (r.reduce((a, s) => a + s.level, 0) / r.length) : 0;
    const top = r.slice().sort(byLv)[0];
    $('skStats').innerHTML = [
      [t('sk.st.items'), skills.length],
      [t('sk.st.rated'), `${r.length} / ${skills.length}`],
      [t('sk.st.avg'), r.length ? dec(avg) : '—'],
      [t('sk.st.top'), top ? `${top.name} · ${top.level}` : '—'],
    ].map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');

    $('skEquip').innerHTML = CATS.map(([k]) => {
      const best = r.filter((s) => s.category === k).sort(byLv)[0];
      return `<li class="eq${best ? ` r${rarity(best.level)}` : ' empty'}" style="--cc:${CATCOL[k]}">
        <span class="eq-ico">${spriteSVG(ICON[k], 3)}</span>
        <span class="eq-txt"><span class="px eq-slot">${esc(t(`sk.eq.${k}`))}</span><span class="eq-nm">${best ? esc(best.name) : esc(t('sk.eq.empty'))}</span></span>
        <span class="px eq-lv">${best ? `LV ${best.level}` : '—'}</span></li>`;
    }).join('');

    renderRadar();
  }

  function renderRadar() {
    const svg = $('skRadar');
    svg.setAttribute('viewBox', '0 0 330 250');
    const cx = 165; const cy = 130; const R = 86;
    const en = document.documentElement.lang === 'en' ? 1 : 0;
    const pt = (i, v) => {
      const a = (-90 + i * 72) * Math.PI / 180;
      return [cx + Math.cos(a) * R * (v / 10), cy + Math.sin(a) * R * (v / 10)];
    };
    const poly = (v) => CATS.map((_, i) => pt(i, typeof v === 'function' ? v(i) : v).map((n) => n.toFixed(1)).join(',')).join(' ');
    const vals = CATS.map(([k]) => {
      const l = rated().filter((s) => s.category === k);
      return l.length ? l.reduce((a, s) => a + s.level, 0) / l.length : 0;
    });
    const any = vals.some((v) => v > 0);
    let out = '';
    [2, 4, 6, 8, 10].forEach((v) => { out += `<polygon class="rg${v === 10 ? ' rg-out' : ''}" points="${poly(v)}"/>`; });
    CATS.forEach((_, i) => { const [x, y] = pt(i, 10); out += `<line class="ra" x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`; });
    out += `<polygon class="rv-poly" points="${poly((i) => vals[i])}"/>`;
    CATS.forEach(([k], i) => {
      const [x, y] = pt(i, vals[i]);
      out += `<rect class="rp" x="${(x - 4).toFixed(1)}" y="${(y - 4).toFixed(1)}" width="8" height="8" style="fill:${CATCOL[k]}"/>`;
      const [lx, ly] = pt(i, 11.9);
      const anchor = Math.abs(lx - cx) < 8 ? 'middle' : lx < cx ? 'end' : 'start';
      out += `<text class="rl" x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}" text-anchor="${anchor}">${esc(SHORT[k][en])}<tspan class="rlv" dx="5">${vals[i] ? dec(vals[i]) : '–'}</tspan></text>`;
    });
    if (!any) out += `<text class="rl rl-empty" x="${cx}" y="${cy + 4}" text-anchor="middle">${esc(t('sk.radarEmpty'))}</text>`;
    svg.innerHTML = out;
  }

  // ---------- sekmeler + ızgara ----------
  function renderTabs() {
    const items = [['all', 'sk.all', skills.length], ...CATS.map(([k, key]) => [k, key, skills.filter((s) => s.category === k).length])];
    tabs.innerHTML = items.map(([k, key, n]) => `<button type="button" role="tab" id="sktab-${k}" aria-controls="skGrid" aria-selected="${k === cur}" tabindex="${k === cur ? 0 : -1}" data-cat="${k}" style="--cc:${CATCOL[k] || 'var(--paper)'}"><span>${esc(t(key))}</span><b>${n}</b></button>`).join('');
    grid.setAttribute('aria-labelledby', `sktab-${cur}`);
    document.querySelectorAll('.inv2-sort [data-sort]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.sort === sort)));
  }

  function renderGrid() {
    const list = view();
    if (!list.length) { grid.innerHTML = `<p class="empty-note" style="grid-column:1/-1">${esc(t('sk.empty'))}</p>`; return; }
    if (!sel || !list.some((s) => s.name === sel)) sel = list[0].name;
    grid.innerHTML = list.map((s, k) => {
      const r = rarity(s.level);
      return `<button type="button" class="item r${r} rv" data-rv="pop" style="--i:${k};--cc:${CATCOL[s.category]}" data-name="${esc(s.name)}" tabindex="${s.name === sel ? 0 : -1}" aria-pressed="${s.name === sel}" aria-label="${esc(`${s.name}, ${s.level ? `LV ${s.level}` : t('sk.r0')}, ${t(`sk.r${r}`)}`)}" data-d>
        <span class="item-cat" aria-hidden="true"></span>
        <span class="item-ico" aria-hidden="true">${spriteSVG(ICON[s.category], 3)}</span>
        <span class="item-nm${longest(s.name) > 9 ? ' long' : ''}" lang="${nameLang(s.name)}">${esc(s.name)}</span>
        <span class="item-lv">${s.level || '?'}</span>
        <span class="item-pips" aria-hidden="true">${Array.from({ length: 10 }, (_, i) => `<i class="${i < s.level ? 'on' : ''}"></i>`).join('')}</span>
      </button>`;
    }).join('');
    renderInspect();
  }

  function renderInspect() {
    const s = skills.find((x) => x.name === sel);
    if (!s) { inspect.innerHTML = `<p class="px inspect-empty">${esc(t('sk.in.pick'))}</p>`; return; }
    const r = rarity(s.level);
    const inCat = rated().filter((x) => x.category === s.category).sort(byLv);
    const rank = s.level ? inCat.findIndex((x) => x.name === s.name) + 1 : 0;
    inspect.className = `inspect r${r}`;
    inspect.style.setProperty('--cc', CATCOL[s.category]);
    inspect.innerHTML = `
      <div class="in-top">
        <span class="in-ico" aria-hidden="true">${spriteSVG(ICON[s.category], 6)}</span>
        <span class="px in-rar">${esc(t(`sk.r${r}`))}</span>
      </div>
      <div class="brut in-nm" lang="${nameLang(s.name)}" style="font-size:${fitSize(s.name)}px">${esc(s.name)}</div>
      <dl class="term in-dl">
        <dt>${esc(t('sk.in.class'))}</dt><dd><i class="in-dot"></i>${esc(catName(s.category))}${rank ? ` · #${rank}/${inCat.length}` : ''}</dd>
        <dt>${esc(t('sk.in.level'))}</dt><dd>${s.level ? `${s.level} / 10` : '?'}</dd>
      </dl>
      <div class="in-segs" aria-hidden="true">${Array.from({ length: 10 }, (_, i) => `<i class="${i < s.level ? 'on' : ''}" style="--j:${i}"></i>`).join('')}</div>
      <p class="hand in-flav">“${esc(t(`sk.f.${s.category}`))}”</p>
      ${s.level ? '' : `<p class="px in-note">${esc(t('sk.in.unrated'))}</p>`}`;
  }

  function renderRarity() {
    $('skRarity').innerHTML = [1, 2, 3, 4, 5, 0].map((r) => `<span class="rar r${r}"><i></i>${esc(t(`sk.r${r}`))}${r ? ` <b>${[0, '1–2', '3–4', '5–6', '7–8', '9–10'][r]}</b>` : ''}</span>`).join('');
  }

  function renderAll() { renderTabs(); renderGrid(); renderSide(); renderRarity(); }

  // ---------- olaylar ----------
  const pick = (name, focus) => {
    if (!name) return;
    sel = name;
    grid.querySelectorAll('.item').forEach((b) => {
      const on = b.dataset.name === name;
      b.setAttribute('aria-pressed', String(on));
      b.tabIndex = on ? 0 : -1;
      if (on && focus) b.focus();
    });
    renderInspect();
  };
  grid.addEventListener('click', (e) => pick(e.target.closest('.item')?.dataset.name));
  grid.addEventListener('mouseover', (e) => { const b = e.target.closest('.item'); if (b && b.dataset.name !== sel) pick(b.dataset.name); });
  grid.addEventListener('focusin', (e) => { const b = e.target.closest('.item'); if (b && b.dataset.name !== sel) pick(b.dataset.name); });
  grid.addEventListener('keydown', (e) => {
    const items = [...grid.querySelectorAll('.item')];
    const i = items.findIndex((b) => b.dataset.name === sel);
    if (i < 0) return;
    const cols = Math.max(1, Math.round(grid.clientWidth / items[0].offsetWidth));
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols, Home: -i, End: items.length - 1 - i }[e.key];
    if (step == null) return;
    e.preventDefault();
    const j = Math.max(0, Math.min(items.length - 1, i + step));
    pick(items[j].dataset.name, true);
  });

  tabs.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    cur = b.dataset.cat;
    sel = null;
    renderTabs(); renderGrid();
    tabs.querySelector(`[data-cat="${cur}"]`)?.focus();
  });
  tabs.addEventListener('keydown', (e) => {
    const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (!(e.key in keys)) return;
    e.preventDefault();
    const order = ['all', ...CATS.map(([k]) => k)];
    cur = order[(order.indexOf(cur) + keys[e.key] + order.length) % order.length];
    sel = null;
    renderTabs(); renderGrid();
    tabs.querySelector(`[data-cat="${cur}"]`)?.focus();
  });
  document.querySelector('.inv2-sort')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-sort]');
    if (!b || b.dataset.sort === sort) return;
    sort = b.dataset.sort;
    renderTabs(); renderGrid();
  });

  renderAll();
  onLang(renderAll);
  API.skills = { list: () => skills };
}
