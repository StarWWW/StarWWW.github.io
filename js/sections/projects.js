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
      ? rows.map((r, k) => `<div class="repo-row rv" style="--i:${k}" data-d><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.name)}/</a><span>${esc(r.lang || '—')}</span><span>★ ${r.stars}</span><span>${esc(r.desc || '')}</span></div>`).join('')
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

// UltraTurk kartı: ULTRAKILL'in açılış ekranı. Satırlar oyundaki VCR fontuyla tek tek yazılır,
// sonra bozulma efektiyle Türkçe (UltraTurk'ün kendi çevirisi) ile İngilizce orijinal arasında gidip gelir.
const UT_LINES = {
  tr: ['İNSANLIK ÖLDÜ.', 'YAKITIN KAN.', 'CEHENNEM DOLU.'],
  en: ['MANKIND IS DEAD.', 'BLOOD IS FUEL.', 'HELL IS FULL.'],
};
const GLITCH = '█▓▒░#%&@$*+=?!<>/\ĞÜŞİÖÇ';
export function initUltraturkIntro() {
  const box = document.getElementById('utLines');
  const tag = document.getElementById('utLang');
  if (!box) return;
  const spans = [...box.children];
  let lang = 'tr';
  let timer = 0;
  let running = false;
  const wait = (ms) => new Promise((r) => { timer = setTimeout(r, ms); });
  const paintTag = () => { if (tag) tag.textContent = t(lang === 'tr' ? 'pr.ut.tr' : 'pr.ut.en'); };
  function setStatic() {
    box.lang = 'tr';
    spans.forEach((s, i) => { s.textContent = UT_LINES.tr[i]; s.classList.remove('typing'); });
    lang = 'tr';
    paintTag();
  }
  async function glitchOut() {
    for (let k = 0; k < 6 && running; k++) {
      spans.forEach((s) => { s.textContent = [...s.textContent].map((ch) => (ch === ' ' || Math.random() < 0.5 ? ch : GLITCH[(Math.random() * GLITCH.length) | 0])).join(''); });
      box.classList.toggle('glitch', k % 2 === 0);
      await wait(55);
    }
    box.classList.remove('glitch');
    spans.forEach((s) => { s.textContent = ''; });
  }
  async function typeIn(lines) {
    for (let i = 0; i < spans.length && running; i++) {
      spans[i].classList.add('typing');
      for (let c = 1; c <= lines[i].length && running; c++) {
        spans[i].textContent = lines[i].slice(0, c);
        await wait(lines[i][c - 1] === ' ' ? 30 : 55);
      }
      spans[i].classList.remove('typing');
      await wait(320);
    }
  }
  async function loop() {
    while (running) {
      await glitchOut();
      if (!running) break;
      lang = lang === 'tr' ? 'en' : 'tr';
      box.lang = lang;
      paintTag();
      await typeIn(UT_LINES[lang]);
      await wait(lang === 'tr' ? 3400 : 2600);
    }
  }
  setStatic();
  onLang(paintTag);
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !reducedMotion()) {
      if (!running) { running = true; loop(); }
    } else if (running) {
      running = false;
      clearTimeout(timer);
      setStatic();
    }
  }, { threshold: 0.4 }).observe(box);
}

