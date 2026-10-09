import { $, $$, API, copyText, toast, store } from './util.js';
import { applyI18n, setLang, t, onLang } from './i18n.js';
import { hydrateSprites, spriteURI, spriteSVG } from './sprites.js';
import { init2048, initRepos, initUltraturkIntro } from './sections/projects.js';
import { initSkills } from './sections/skills.js';
import { initShelf } from './sections/shelf.js';
import { initMusic } from './sections/music.js';
import { initWall } from './sections/wall.js';
import { initGuestbook } from './sections/guestbook.js';
import { initTerminal } from './terminal.js';
import { initFx } from './fx.js';
import { initConsent } from './consent.js';
import { initFooter } from './sections/footer.js';
import { initDrug } from './drug.js';
import { initSfx } from './sfx.js';

// ---------- mod: REAL / DRUG ----------
// DRUG avatarı (animasyonlu WebP) sadece gerekince yüklenir; REAL modda hiç indirilmez
function loadDrugAvatar() {
  const im = $('.av-drug');
  if (im && !im.getAttribute('src') && im.dataset.src) im.src = im.dataset.src;
}

function setMode(mode, announce = true) {
  const html = document.documentElement;
  const next = mode === 'drug' ? 'drug' : 'real';
  if (html.dataset.mode === next && announce) return;
  html.dataset.mode = next;
  if (next === 'drug') loadDrugAvatar();
  store.set('star.mode', next);
  $$('.mode-name').forEach((el) => { el.textContent = next.toUpperCase(); });
  const btn = $('#modeToggle');
  btn.setAttribute('aria-pressed', String(next === 'drug'));
  document.querySelector('meta[name="theme-color"]').content = next === 'drug' ? '#000000' : '#222034';
  if (announce) { API.sfx?.play(next === 'drug' ? 'pillDrug' : 'pillReal'); toast(t(next === 'drug' ? 'mode.drug' : 'mode.real'), 1400, { sound: false }); }
}
API.setMode = setMode;

// ---------- ticker ----------
function buildTicker() {
  const words = document.documentElement.lang === 'en'
    ? ['STAR', '21 Y/O', 'COMPUTER ENGINEERING', 'ULTRATURK', 'ULTRAKILL TURKISH DUB', 'PIXEL ART', 'GAMER', 'MUSIC ADDICT', 'EVERY HELLO COMES WITH A GOODBYE']
    : ['STAR', '21 YAŞ', 'BİLGİSAYAR MÜHENDİSLİĞİ', 'ULTRATURK', 'ULTRAKILL TÜRKÇE DUBLAJ', 'PIXEL ART', 'OYUNCU', 'MÜZİK BAĞIMLISI', 'EVERY HELLO COMES WITH A GOODBYE'];
  // DRUG modunda araya gizli mesajlar karışır
  const secret = document.documentElement.dataset.mode === 'drug' ? (API.drug?.tickerWords?.() || []) : [];
  const all = secret.length ? words.flatMap((w, i) => (secret[i] ? [w, secret[i]] : [w])) : words;
  const spark = spriteSVG('sparkle', 2);
  const one = all.map((w) => `<span${secret.includes(w) ? ' class="tk-secret"' : ''}>${w}</span><span class="spr">${spark}</span>`).join('');
  $('#ticker').innerHTML = one + one;
}
API.buildTicker = buildTicker;

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
    API.fx?.freeze();
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
  // klavyesi olmayanlar için gizli kapı: LVL 21 çıkartmasına art arda 5 kez dokun
  const sticker = $('.lvl-sticker');
  let taps = [];
  sticker?.addEventListener('click', () => {
    const now = Date.now();
    taps = taps.filter((x) => now - x < 2500).concat(now);
    sticker.classList.remove('poke');
    void sticker.offsetWidth;
    sticker.classList.add('poke');
    if (taps.length >= 5) { taps = []; startGame(); }
  });
}

// ---------- admin ----------
let adminMod = null;
async function openAdmin() {
  try {
    adminMod = adminMod || await import('./admin.js');
  } catch (err) {
    // genelde yeni yayından hemen sonra önbellekte kalan eski bir dosya
    console.error('[kontrol odası]', err);
    toast(document.documentElement.lang === 'en' ? 'Control room failed to load — reload the page with Ctrl+F5.' : 'Kontrol Odası yüklenemedi — sayfayı Ctrl+F5 ile yenile.', 6000);
    return;
  }
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
  initConsent();
  initSfx({ label: (on) => t(on ? 'sfx.on' : 'sfx.off') });
  onLang(() => API.sfxPaint?.());
  applyI18n();
  hydrateSprites();
  buildTicker();
  onLang(buildTicker);
  setMode(document.documentElement.dataset.mode, false);
  initCursors();
  initNav();

  const flipMode = () => {
    const next = document.documentElement.dataset.mode === 'drug' ? 'real' : 'drug';
    if (API.fx?.pixelSwap) API.fx.pixelSwap(() => setMode(next)); else setMode(next);
  };
  API.flipMode = flipMode;
  $('#modeToggle').addEventListener('click', flipMode);
  ['pointerenter', 'focus'].forEach((ev) => $('#modeToggle').addEventListener(ev, loadDrugAvatar, { once: true }));
  $$('[data-lang]').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));
  $('#copyDiscord').addEventListener('click', () => copyText('stariscrazy').then(() => { API.sfx?.play('copy'); toast(t('ft.copied'), 2600, { sound: false }); }));
  $('#ctaTerm').addEventListener('click', () => API.terminal?.open());
  $('#ctaSpray').addEventListener('click', () => API.wall?.focus());

  initTerminal();
  initKonami();
  init2048();
  initUltraturkIntro();
  initRepos();
  initSkills();
  initShelf();
  initMusic();
  initWall();
  initGuestbook();
  initFooter();
  initDrug();

  // GitHub girişinden dönüş: ?admin&code=... (ya da hata: ?error_description=... / #error_description=...)
  const qs = new URLSearchParams(location.search);
  if (location.hash === '#admin' || qs.has('admin') || qs.has('code') || /error_description=/.test(location.search + location.hash)) openAdmin();
  window.addEventListener('hashchange', () => { if (location.hash === '#admin') openAdmin(); });

  store.set('star.visits', (store.get('star.visits', 0) || 0) + 1);
  initFx();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
