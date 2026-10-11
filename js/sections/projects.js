import { getRepos, getProjectsConfig } from '../data.js';
import { esc, reducedMotion } from '../util.js';
import { t, onLang } from '../i18n.js';

// Taş renkleri: 2048 laboratuvarıyla aynı DB32 paleti (koyu taşlarda beyaz yazı)
const TILE = { 2: '#CBDBFC', 4: '#9BADB7', 8: '#5FCDE4', 16: '#639BFF', 32: '#99E550', 64: '#6ABE30', 128: '#FBF236', 256: '#DF7126', 512: '#D77BBA', 1024: '#AC3232', 2048: '#FFFFFF', 4096: '#76428A', 8192: '#3F3F74' };
const DARK = new Set([1024, 4096, 8192]);

// ---------- karttaki mini 2048: gerçek kurallar + küçük bir yapay zekâ ----------
// Asıl yapay zekâ (eğitilmiş N-Tuple ağı) /2048/ laboratuvarında. Bu kart onu hafifçe taklit eder:
// "yılan" sıralı ağırlıklarla (büyük taşlar sol üst köşede, zikzak dizilsin) iki hamle ileri bakan expectimax.
const SNAKE = [15, 14, 13, 12, 8, 9, 10, 11, 7, 6, 5, 4, 0, 1, 2, 3].map((k) => 4 ** k);
const LINES = [0, 1, 2, 3].map((dir) => [0, 1, 2, 3].map((k) => [0, 1, 2, 3].map((j) => (
  dir === 0 ? j * 4 + k : dir === 1 ? k * 4 + 3 - j : dir === 2 ? (3 - j) * 4 + k : k * 4 + j))));

// dir: 0 yukarı, 1 sağ, 2 aşağı, 3 sol → { b, gain, merged } ya da hamle geçersizse null
function slide(b, dir) {
  const out = b.slice();
  let gain = 0; let moved = false; const merged = [];
  for (const idx of LINES[dir]) {
    const vals = idx.map((i) => b[i]).filter(Boolean);
    const row = [];
    for (let i = 0; i < vals.length; i++) {
      if (vals[i] === vals[i + 1]) { row.push(vals[i] * 2); gain += vals[i] * 2; merged.push(idx[row.length - 1]); i++; } else row.push(vals[i]);
    }
    idx.forEach((cell, j) => { const v = row[j] || 0; if (out[cell] !== v) moved = true; out[cell] = v; });
  }
  return moved ? { b: out, gain, merged } : null;
}
const heur = (b) => b.reduce((s, v, i) => s + v * SNAKE[i], 0) + b.filter((v) => !v).length * 4 ** 10;
function chance(b, depth) {
  const empty = b.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
  if (!empty.length) return heur(b);
  let sum = 0;
  for (const i of empty) {
    for (const [v, p] of [[2, 0.9], [4, 0.1]]) {
      const nb = b.slice(); nb[i] = v;
      sum += p * (depth > 0 ? best(nb, depth - 1).score : heur(nb));
    }
  }
  return sum / empty.length;
}
function best(b, depth) {
  let top = { dir: -1, score: -Infinity };
  for (let dir = 0; dir < 4; dir++) {
    const r = slide(b, dir);
    if (!r) continue;
    const score = chance(r.b, depth);
    if (score > top.score) top = { dir, score };
  }
  return top.dir < 0 ? { dir: -1, score: heur(b) } : top;
}
function spawn(b) {
  const empty = b.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
  if (!empty.length) return -1;
  const i = empty[Math.floor(Math.random() * empty.length)];
  b[i] = Math.random() < 0.9 ? 2 : 4;
  return i;
}

export function init2048() {
  const el = document.getElementById('g2048');
  if (!el) return;
  const pts = document.getElementById('g2048Pts');
  let board = [2, 4, 8, 16, 256, 128, 64, 32, 512, 1024, 2048, 0, 4, 0, 2, 8]; // hareket kapalıyken görünen vitrin
  let score = 0;
  const render = (pop = []) => {
    el.innerHTML = board.map((v, i) => {
      const style = `background:${v ? TILE[v] || '#000' : '#3F3F74'};${DARK.has(v) || v > 8192 ? 'color:#fff;' : ''}${v === 2048 ? 'box-shadow:4px 4px 0 #D77BBA;' : ''}`;
      return `<span class="${v >= 1000 ? 'big' : ''}${pop.includes(i) ? ' pop' : ''}" style="${style}">${v || ''}</span>`;
    }).join('');
    if (pts) pts.textContent = score.toLocaleString('tr-TR');
  };
  render();
  if (reducedMotion()) return;

  const fresh = () => { board = Array(16).fill(0); score = 0; spawn(board); spawn(board); render(); };
  fresh();
  let visible = false;
  let pauseUntil = 0;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(el);
  setInterval(() => {
    if (!visible || document.hidden || reducedMotion() || Date.now() < pauseUntil) return;
    const empties = board.filter((v) => !v).length;
    const { dir } = best(board, empties > 5 ? 0 : 1); // tahta doldukça bir hamle daha derine bak
    const r = dir >= 0 ? slide(board, dir) : null;
    if (!r) { pauseUntil = Date.now() + 2600; setTimeout(fresh, 2400); return; } // oyun bitti: kısa ara, yeni oyun
    board = r.b;
    score += r.gain;
    const born = spawn(board);
    render(born >= 0 ? r.merged.concat(born) : r.merged);
  }, 420);
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

