import { getSkills } from '../data.js';
import { esc, API } from '../util.js';
import { t, onLang } from '../i18n.js';

export const CATS = [['diller', 'sk.c.diller'], ['web', 'sk.c.web'], ['veri', 'sk.c.veri2'], ['arac', 'sk.c.arac2'], ['oyun', 'sk.c.oyun2']];
const CATCOL = { diller: 'var(--acid)', web: 'var(--cyan)', veri: 'var(--orange)', arac: 'var(--steel)', oyun: 'var(--pink)' };

export async function initSkills() {
  const tabs = document.getElementById('skTabs');
  const bars = document.getElementById('skBars');
  const slots = document.getElementById('skSlots');
  const head = document.getElementById('skHead');
  const count = document.getElementById('skCount');
  if (!tabs) return;

  let skills = [];
  try { skills = await getSkills(); } catch (err) { console.warn('[skills]', err); }
  let cur = 'diller';

  const byLevel = (a, b) => (b.level - a.level) || a.name.localeCompare(b.name, 'tr');

  function render() {
    const rated = skills.filter((s) => Number(s.level) > 0);
    tabs.innerHTML = CATS.map(([k, key]) => {
      const n = rated.filter((s) => s.category === k).length;
      return `<button type="button" role="tab" id="sktab-${k}" aria-controls="skBars" aria-selected="${k === cur}" tabindex="${k === cur ? 0 : -1}" data-cat="${k}" data-d><span class="arr">${esc(t(key))}</span><span>${n}</span></button>`;
    }).join('');
    bars.setAttribute('aria-labelledby', `sktab-${cur}`);

    const inCat = rated.filter((s) => s.category === cur).sort(byLevel);
    const catName = t(CATS.find(([k]) => k === cur)[1]);
    head.textContent = `${catName} — ${inCat.length}`;
    bars.innerHTML = inCat.length
      ? inCat.map((s) => `<div class="sk-row" data-d><span class="sk-name">${esc(s.name)}</span><span class="segs" aria-hidden="true">${Array.from({ length: 10 }, (_, i) => `<i class="${i < s.level ? 'on' : ''}"></i>`).join('')}</span><span class="sk-lv">LV ${s.level}</span></div>`).join('')
      : `<p class="empty-note" style="grid-column:1/-1">${esc(t('sk.empty'))}</p>`;

    const others = rated.filter((s) => s.category !== cur).sort(byLevel);
    slots.innerHTML = others.length
      ? others.map((s) => `<div class="slot" data-d title="${esc(s.name)} — LV ${s.level}"><span class="cat" style="background:${CATCOL[s.category] || 'var(--steel)'}"></span><span class="nm">${esc(s.name)}</span><span class="lv">${s.level}</span></div>`).join('')
      : `<p class="empty-note" style="grid-column:1/-1">${esc(t('sk.invEmpty'))}</p>`;
    count.textContent = t('sk.count', { n: rated.length });
  }

  tabs.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    cur = b.dataset.cat;
    render();
    tabs.querySelector(`[data-cat="${cur}"]`)?.focus();
  });
  tabs.addEventListener('keydown', (e) => {
    const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
    if (!(e.key in keys)) return;
    e.preventDefault();
    const i = CATS.findIndex(([k]) => k === cur);
    cur = CATS[(i + keys[e.key] + CATS.length) % CATS.length][0];
    render();
    tabs.querySelector(`[data-cat="${cur}"]`)?.focus();
  });

  render();
  onLang(render);
  API.skills = { list: () => skills };
}
