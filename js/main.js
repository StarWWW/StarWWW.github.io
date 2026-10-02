import { $, $$, API, copyText, toast, store, reducedMotion } from './util.js';
import { applyI18n, setLang, t, onLang } from './i18n.js';
import { hydrateSprites, spriteURI, spriteSVG } from './sprites.js';
import { init2048, initRepos } from './sections/projects.js';
import { initSkills } from './sections/skills.js';
import { initShelf } from './sections/shelf.js';
import { initMusic } from './sections/music.js';
import { initWall } from './sections/wall.js';
import { initGuestbook } from './sections/guestbook.js';
import { initTerminal } from './terminal.js';

// ---------- mod: REAL / DRUG ----------
function setMode(mode, announce = true) {
  const html = document.documentElement;
  const next = mode === 'drug' ? 'drug' : 'real';
  if (html.dataset.mode === next && announce) return;
  if (announce && !reducedMotion()) {
    html.classList.add('mode-flash');
    setTimeout(() => html.classList.remove('mode-flash'), 180);
  }
  html.dataset.mode = next;
  try { localStorage.setItem('star.mode', next); } catch { /* yok */ }
  $$('.mode-name').forEach((el) => { el.textContent = next.toUpperCase(); });
  const btn = $('#modeToggle');
  btn.setAttribute('aria-pressed', String(next === 'drug'));
  document.querySelector('meta[name="theme-color"]').content = next === 'drug' ? '#000000' : '#222034';
  if (announce) toast(t(next === 'drug' ? 'mode.drug' : 'mode.real'), 1400);
}
API.setMode = setMode;

// ---------- ticker ----------
function buildTicker() {
  const words = document.documentElement.lang === 'en'
    ? ['STAR', '21 Y/O', 'COMPUTER ENGINEERING', 'ULTRATURK', 'PIXEL ART', 'EVERY HELLO COMES WITH A GOODBYE', '↑↑↓↓←→←→BA']
    : ['STAR', '21 YAŞ', 'BİLGİSAYAR MÜHENDİSLİĞİ', 'ULTRATURK', 'PIXEL ART', 'EVERY HELLO COMES WITH A GOODBYE', '↑↑↓↓←→←→BA'];
  const spark = spriteSVG('sparkle', 2);
  const one = words.map((w) => `<span>${w}</span><span class="spr">${spark}</span>`).join('');
  $('#ticker').innerHTML = one + one;
}

// ---------- gezinme ----------
function initNav() {
  const links = $$('.nav a');
  const map = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      const a = map.get(e.target.id);
      if (a && e.isIntersecting) { links.forEach((l) => l.classList.remove('on')); a.classList.add('on'); }
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  map.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });

  const menu = $('#menuBtn');
  const mnav = $('#mobileNav');
  menu.addEventListener('click', () => {
    const open = mnav.hidden;
    mnav.hidden = !open;
    menu.setAttribute('aria-expanded', String(open));
    menu.textContent = open ? '✕' : '≡';
  });
  mnav.addEventListener('click', (e) => {
    if (e.target.closest('a')) { mnav.hidden = true; menu.setAttribute('aria-expanded', 'false'); menu.textContent = '≡'; }
  });
}

// ---------- konami + oyun ----------
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
let gameMod = null;
let gameLoading = false;
async function startGame() {
  if (gameLoading || API.gameRunning?.()) return;
  gameLoading = true;
  try {
    gameMod = gameMod || await import('./game/game.js');
    API.terminal?.close();
    gameMod.startGame();
  } catch (err) {
    console.error('[oyun]', err);
  } finally {
    gameLoading = false;
  }
}
API.startGame = startGame;

function initKonami() {
  let pos = 0;
  document.addEventListener('keydown', (e) => {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    pos = e.code === KONAMI[pos] ? pos + 1 : (e.code === KONAMI[0] ? 1 : 0);
    if (pos === KONAMI.length) { pos = 0; startGame(); }
  });
  let lastClick = 0;
  $('#ctaGame').addEventListener('click', () => {
    const touch = matchMedia('(pointer: coarse)').matches || innerWidth < 640;
    if (touch || Date.now() - lastClick < 4000) { startGame(); return; }
    lastClick = Date.now();
    toast(t('konami.hint'), 3600);
  });
}

// ---------- admin ----------
let adminMod = null;
async function openAdmin() {
  adminMod = adminMod || await import('./admin.js');
  adminMod.openAdmin();
}
API.openAdmin = openAdmin;
API.adminLogout = async () => { adminMod = adminMod || await import('./admin.js'); return adminMod.logout(); };

// ---------- imleçler ----------
function initCursors() {
  if (matchMedia('(pointer: coarse)').matches) return;
  const root = document.documentElement.style;
  root.setProperty('--cur', `url("${spriteURI('cursor', 2)}") 0 0, auto`);
  root.setProperty('--cur-spray', `url("${spriteURI('spray', 3)}") 12 3, crosshair`);
}

// ---------- başlat ----------
function boot() {
  applyI18n();
  hydrateSprites();
  buildTicker();
  onLang(buildTicker);
  setMode(document.documentElement.dataset.mode, false);
  initCursors();
  initNav();

  $('#modeToggle').addEventListener('click', () => setMode(document.documentElement.dataset.mode === 'drug' ? 'real' : 'drug'));
  $$('[data-lang]').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));
  $('#copyDiscord').addEventListener('click', () => copyText('stariscrazy').then(() => toast(t('ft.copied'))));
  $('#ctaTerm').addEventListener('click', () => API.terminal?.open());
  $('#ctaSpray').addEventListener('click', () => API.wall?.focus());

  initTerminal();
  initKonami();
  init2048();
  initRepos();
  initSkills();
  initShelf();
  initMusic();
  initWall();
  initGuestbook();

  // GitHub girişinden dönüş: ?admin&code=... (ya da hata: ?error_description=... / #error_description=...)
  const qs = new URLSearchParams(location.search);
  if (location.hash === '#admin' || qs.has('admin') || qs.has('code') || /error_description=/.test(location.search + location.hash)) openAdmin();
  window.addEventListener('hashchange', () => { if (location.hash === '#admin') openAdmin(); });

  store.set('star.visits', (store.get('star.visits', 0) || 0) + 1);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
