// SAYFAYI YOK ET — sayfanın kendi elemanlarını hedef alan serbest uçuşlu yıkım oyunu.
import { spriteCanvas, spriteSVG } from '../sprites.js';
import { API, store, esc } from '../util.js';
import { getLang } from '../i18n.js';
import { getSupabase } from '../supabase.js';

const L = (tr, en) => (getLang() === 'en' ? en : tr);

const RANKS = [
  { l: 'D', tr: 'DOODLE', en: 'DOODLE', at: 0, mult: 1, c: '#9BADB7' },
  { l: 'C', tr: 'CRASH', en: 'CRASH', at: 80, mult: 1.25, c: '#5FCDE4' },
  { l: 'B', tr: 'BRUTAL', en: 'BRUTAL', at: 180, mult: 1.5, c: '#639BFF' },
  { l: 'A', tr: 'ANARŞİ', en: 'ANARCHY', at: 320, mult: 2, c: '#FBF236' },
  { l: 'S', tr: 'SPREY', en: 'SPRAYED', at: 500, mult: 2.5, c: '#DF7126' },
  { l: 'SS', tr: 'SSEGFAULT', en: 'SSEGFAULT', at: 720, mult: 3, c: '#D77BBA' },
  { l: 'SSS', tr: 'SSSUDO', en: 'SSSUDO', at: 980, mult: 4, c: '#AC3232' },
  { l: 'C.O.W.', tr: 'HİÇBİR ANLAMI YOK', en: 'MEANS NOTHING', at: 1300, mult: 5, c: '#99E550', hidden: true },
];
const STYLE_CAP = 1500;

const ACH = [
  ['ilk', 'İLK KAN', 'FIRST BLOOD', 'ilk şeyi kır', 'break your first thing'],
  ['proje', 'PROJELERİ YAKTIN', 'BURNED THE PROJECTS', 'projeler bölümünü tamamen yok et', 'wipe out the projects section'],
  ['boss', '404 BULUNDU', '404 FOUND', 'boss\'u yen', 'defeat the boss'],
  ['pasif', 'PASİFİST', 'PACIFIST', '60 sn hiçbir şey kırma', 'break nothing for 60 seconds'],
  ['cow', 'C.O.W.', 'C.O.W.', 'gizli rütbeye ulaş', 'reach the hidden rank'],
  ['sanat', 'DUVAR SANATÇISI', 'WALL ARTIST', '25 şeyi spreyle yok et', 'destroy 25 things with spray'],
  ['glitch', 'GLITCH USTASI', 'GLITCH MASTER', '×5 glitch zinciri', 'a ×5 glitch chain'],
  ['cekic', 'ÇEKİÇ ZAMANI', 'HAMMER TIME', '40 çekiç vuruşu', '40 hammer hits'],
  ['dokun', 'DOKUNULMAZ', 'UNTOUCHABLE', 'hasar almadan boss\'u yen', 'beat the boss without taking damage'],
  ['hiz', 'HIZ TRENİ', 'SPEEDRUN', '3 dakikadan kısa sürede bitir', 'finish in under 3 minutes'],
  ['bug', 'BUG AVCISI', 'BUG HUNTER', '30 bug öldür', 'kill 30 bugs'],
  ['kombo', 'KOMBO KRALI', 'COMBO KING', '×30 kombo', 'a ×30 combo'],
];

const WEAPONS = [
  { sprite: 'spray', scale: 3, tr: 'SPREY BOMBASI', en: 'SPRAY BOMB', rate: 0.26 },
  { sprite: 'gbomb', scale: 4, tr: 'GLITCH BOMBASI', en: 'GLITCH BOMB', rate: 0.5, ammoMax: 3, recharge: 6 },
  { sprite: 'hammer', scale: 4, tr: 'PİKSEL ÇEKİÇ', en: 'PIXEL HAMMER', rate: 0.42 },
];
const PAINT = ['#99E550', '#DF7126', '#D77BBA', '#5FCDE4', '#FBF236'];
const RGBC = ['#D77BBA', '#5FCDE4', '#99E550', '#FFFFFF'];
const CELL = 160;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const fmtScore = (n) => String(Math.floor(n)).padStart(7, '0').replace(/(\d)(?=(\d{3})+$)/g, '$1 ');
const fmtTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

let G = null;
API.gameRunning = () => Boolean(G);

let cssReady = null;
function loadCSS() {
  if (!cssReady) {
    cssReady = new Promise((res) => {
      const l = document.createElement('link');
      l.rel = 'stylesheet'; l.href = 'css/game.css';
      l.onload = res; l.onerror = res;
      document.head.append(l);
    });
  }
  return cssReady;
}

export async function startGame() {
  if (G) return;
  await loadCSS();
  G = new Game();
  G.start();
  // test kancası: sadece yerel geliştirmede (yayındaki sitede çalışmaz)
  if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) && new URLSearchParams(location.search).has('debug')) window.__game = G;
}

class Game {
  constructor() {
    this.touch = matchMedia('(pointer: coarse)').matches;
    this.startScroll = scrollY;
    this.prevSB = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'auto';
    this.dpr = Math.min(2, devicePixelRatio || 1);
    this.time = 0;
    this.last = 0;
    this.keys = new Set();
    this.mouse = { x: innerWidth / 2, y: innerHeight / 2, down: false };
    this.touchDir = { x: 0, y: 0 };
    this.touchFire = false;
    this.projectiles = []; this.particles = []; this.splats = []; this.bugs = []; this.bullets = []; this.pending = [];
    this.order = [];
    this.score = 0; this.combo = 0; this.comboT = 0; this.bestCombo = 0; this.lastKill = -9;
    this.style = 0; this.rankIdx = 0; this.peakRank = 0; this.feed = []; this.fresh = new Map();
    this.weapon = 0; this.cool = [0, 0, 0]; this.ammo = WEAPONS[1].ammoMax; this.recharge = 0;
    this.shots = 0; this.hits = 0;
    this.st = { kills: 0, spray: 0, hammer: 0, bugs: 0, chain: 0, dmg: 0 };
    this.lastDestroy = 0;
    this.spawnT = 6;
    this.boss = null; this.bossDone = false;
    this.shake = 0; this.swing = null;
    this.over = false; this.running = false;
    this.ach = store.get('star.ach', {}) || {};
    this.newAch = [];
    this.collect();
    this.player = { x: innerWidth / 2 + scrollX, y: scrollY + innerHeight * 0.5, vx: 0, vy: 0, hp: 100, inv: 1, dashT: 0, dashCd: 0, face: 1, trail: [] };
    this.build();
  }

  // ---------- hedefler ----------
  collect() {
    const els = [...document.querySelectorAll('main [data-d], footer [data-d]')];
    this.targets = []; this.grid = new Map(); this.sections = new Map();
    let total = 0;
    for (const el of els) {
      if (el.querySelector('[data-d]')) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
      const x = r.left + scrollX; const y = r.top + scrollY; const w = r.width; const h = r.height;
      const bg = cs.backgroundColor;
      const color = bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent' ? bg : cs.color;
      const text = el.tagName === 'IMG' || el.tagName === 'CANVAS' ? '' : (el.textContent || '').replace(/\s+/g, '').slice(0, 60);
      const area = w * h;
      const hp = clamp(Math.round(Math.sqrt(area) / 30), 1, 14);
      const sec = el.closest('section, footer')?.id || 'x';
      const tg = { el, x, y, w, h, area, hp, max: hp, dead: false, sec, color, text, seed: (Math.random() * 1e9) | 0, glitched: false, prevVis: el.style.visibility, flash: 0 };
      this.targets.push(tg);
      total += area;
      if (!this.sections.has(sec)) this.sections.set(sec, { total: 0, left: 0 });
      const s = this.sections.get(sec); s.total++; s.left++;
      for (let cx = Math.floor(x / CELL); cx <= Math.floor((x + w) / CELL); cx++) {
        for (let cy = Math.floor(y / CELL); cy <= Math.floor((y + h) / CELL); cy++) {
          const k = `${cx},${cy}`;
          if (!this.grid.has(k)) this.grid.set(k, []);
          this.grid.get(k).push(tg);
        }
      }
    }
    this.totalArea = total || 1;
    this.destroyed = 0;
    this.docW = document.documentElement.scrollWidth;
    this.docH = document.documentElement.scrollHeight;
  }

  near(x, y, r) {
    const out = new Set();
    for (let cx = Math.floor((x - r) / CELL); cx <= Math.floor((x + r) / CELL); cx++) {
      for (let cy = Math.floor((y - r) / CELL); cy <= Math.floor((y + r) / CELL); cy++) {
        const a = this.grid.get(`${cx},${cy}`);
        if (a) for (const tg of a) if (!tg.dead) out.add(tg);
      }
    }
    return out;
  }

  at(x, y) {
    const a = this.grid.get(`${Math.floor(x / CELL)},${Math.floor(y / CELL)}`);
    if (!a) return null;
    for (const tg of a) if (!tg.dead && x >= tg.x && x <= tg.x + tg.w && y >= tg.y && y <= tg.y + tg.h) return tg;
    return null;
  }

  static dist(tg, x, y) {
    const dx = Math.max(tg.x - x, 0, x - (tg.x + tg.w));
    const dy = Math.max(tg.y - y, 0, y - (tg.y + tg.h));
    return Math.hypot(dx, dy);
  }

  // ---------- arayüz ----------
  build() {
    const root = document.createElement('div');
    root.className = `g-root${this.touch ? ' touch' : ''}`;
    root.setAttribute('role', 'application');
    root.setAttribute('aria-label', L('Sayfayı yok et oyunu', 'Destroy the page game'));
    const ladder = RANKS.map((r, i) => `<span data-r="${i}" class="${r.hidden ? 'hid' : ''}" style="--rc:${r.c}">${r.hidden ? '???' : r.l} ${r.hidden ? '' : (getLang() === 'en' ? r.en : r.tr)}</span>`).join('');
    root.innerHTML = `
      <canvas class="g-cv"></canvas>
      <div class="g-hud">
        <div class="g-panel g-tl">
          <div class="g-hp"><span class="lbl">${L('ŞARJ', 'POWER')}</span><span class="g-batt"><span class="cells">${'<i></i>'.repeat(10)}</span><span class="nub"></span></span><span class="num">100</span></div>
          <div class="g-weapons">${WEAPONS.map((w, i) => `<div class="g-w" data-w="${i}"><span class="k">${i + 1}</span><span class="a"></span>${spriteSVG(w.sprite, w.scale)}<span class="n">${L(w.tr, w.en)}</span><span class="cd"></span></div>`).join('')}</div>
        </div>
        <div class="g-tc">
          <div class="g-tc-row">
            <div class="g-panel g-destr" style="position:relative"><div class="top"><span>${L('YIKIM', 'DESTRUCTION')}</span><b>%0</b></div><div class="bar"><i></i><u></u></div></div>
            <div class="g-score"><span>${L('SKOR', 'SCORE')}</span><b>0 000 000</b></div>
          </div>
          <div class="g-boss" hidden><div><div class="t"><span style="display:flex;align-items:center;gap:8px">${spriteSVG('skull', 2)} BOSS: 404 — ${L('SAYFA BULUNAMADI', 'PAGE NOT FOUND')}</span><em>${L('UYANDI!', 'AWAKE!')}</em></div><div class="hpb"><i style="width:100%"></i></div></div></div>
        </div>
        <div class="g-panel g-style"><div class="hd"><span>${L('STİL', 'STYLE')}</span><b class="mult">×1</b></div><div class="g-rank"><span class="l">D</span><span class="nm">DOODLE</span></div><div class="g-drain"><i></i></div><ul class="g-feed"></ul><div class="g-ladder">${ladder}</div></div>
        <div class="g-combo" hidden><b>×0</b><span>${L('KOMBO', 'COMBO')}</span></div>
        <div class="g-toasts"></div>
        <div class="g-help"><span><b>WASD</b> ${L('UÇ', 'FLY')}</span><span><b>${L('FARE', 'MOUSE')}</b> ${L('NİŞAN', 'AIM')}</span><span><b>${L('SOL TIK', 'L-CLICK')}</b> ${L('ATEŞ', 'FIRE')}</span><span><b>1 2 3</b> ${L('SİLAH', 'WEAPON')}</span><span><b>SHIFT</b> ${L('ATIL', 'DASH')}</span><span><b>ESC</b> ${L('BİTİR', 'END')}</span></div>
        <div class="g-touch"><div class="g-stick"><i></i></div><div class="g-tbtns"><button type="button" data-tw="0">1</button><button type="button" data-tw="1">2</button><button type="button" data-tw="2">3</button><button type="button" data-dash style="grid-column:span 2">${L('ATIL', 'DASH')}</button><button type="button" data-esc>ESC</button><button type="button" class="fire" data-fire>${L('ATEŞ', 'FIRE')}</button></div></div>
      </div>`;
    document.body.append(root);
    this.root = root;
    this.cv = root.querySelector('.g-cv');
    this.ctx = this.cv.getContext('2d');
    const q = (s) => root.querySelector(s);
    this.ui = {
      cells: [...root.querySelectorAll('.g-batt .cells i')], hpNum: q('.g-hp .num'),
      weapons: [...root.querySelectorAll('.g-w')], destrB: q('.g-destr b'), destrI: q('.g-destr .bar i'), score: q('.g-score b'),
      boss: q('.g-boss'), bossI: q('.g-boss .hpb i'), mult: q('.g-style .mult'), rankL: q('.g-rank .l'), rankN: q('.g-rank .nm'),
      drain: q('.g-drain i'), feed: q('.g-feed'), ladder: [...root.querySelectorAll('.g-ladder span')], style: q('.g-style'),
      combo: q('.g-combo'), comboB: q('.g-combo b'), toasts: q('.g-toasts'), hud: q('.g-hud'),
    };
    this.sprites = {
      jet: spriteCanvas('jet', 4), flame: spriteCanvas('flame', 4), flame2: spriteCanvas('flame2', 4),
      bug: spriteCanvas('bug', 4), bug2: spriteCanvas('bug2', 4), bigbug: spriteCanvas('bug', 6), bigbug2: spriteCanvas('bug2', 6),
      spray: spriteCanvas('spray', 2), gbomb: spriteCanvas('gbomb', 3), cross: spriteCanvas('cross', 4),
    };
  }

  // ---------- olaylar ----------
  bind() {
    this.onKey = (e) => {
      if (this.over) { if (e.key === 'Escape' && e.type === 'keydown' && this.overEl) { e.preventDefault(); this.rewind(false); } return; }
      const k = e.code;
      const game = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'Space', 'Digit1', 'Digit2', 'Digit3', 'KeyQ', 'KeyE', 'Escape', 'Backquote', 'PageUp', 'PageDown', 'Home', 'End'];
      if (!game.includes(k)) return;
      e.preventDefault(); e.stopPropagation();
      if (e.type === 'keyup') { this.keys.delete(k); return; }
      if (e.repeat && !k.startsWith('Arrow') && !k.startsWith('Key')) return;
      this.keys.add(k);
      if (k === 'Escape') this.end('quit');
      if (k === 'Digit1' || k === 'Digit2' || k === 'Digit3') this.setWeapon(Number(k.slice(-1)) - 1);
      if (k === 'KeyQ') this.setWeapon((this.weapon + 2) % 3);
      if (k === 'KeyE') this.setWeapon((this.weapon + 1) % 3);
      if (k === 'ShiftLeft' || k === 'ShiftRight') this.dash();
    };
    this.onMove = (e) => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; };
    this.onDown = (e) => { if (this.over || e.pointerType === 'touch') return; if (e.button === 0) this.mouse.down = true; };
    this.onUp = (e) => { if (e.button === 0) this.mouse.down = false; };
    this.onWheel = (e) => { if (!this.over) { e.preventDefault(); this.setWeapon((this.weapon + (e.deltaY > 0 ? 1 : 2)) % 3); } };
    this.onResize = () => this.resize();
    this.onCtx = (e) => e.preventDefault();
    window.addEventListener('keydown', this.onKey, true);
    window.addEventListener('keyup', this.onKey, true);
    this.root.addEventListener('pointermove', this.onMove);
    this.root.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointerup', this.onUp);
    this.root.addEventListener('wheel', this.onWheel, { passive: false });
    this.root.addEventListener('contextmenu', this.onCtx);
    window.addEventListener('resize', this.onResize);

    if (this.touch) {
      const stick = this.root.querySelector('.g-stick');
      const knob = stick.querySelector('i');
      const moveStick = (e) => {
        const r = stick.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2); const dy = e.clientY - (r.top + r.height / 2);
        const m = Math.min(1, Math.hypot(dx, dy) / 50) || 0;
        const a = Math.atan2(dy, dx);
        this.touchDir = { x: Math.cos(a) * m, y: Math.sin(a) * m };
        knob.style.transform = `translate(${Math.cos(a) * m * 42}px, ${Math.sin(a) * m * 42}px)`;
      };
      stick.addEventListener('pointerdown', (e) => { stick.setPointerCapture?.(e.pointerId); moveStick(e); });
      stick.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType === 'touch') moveStick(e); });
      const stop = () => { this.touchDir = { x: 0, y: 0 }; knob.style.transform = ''; };
      stick.addEventListener('pointerup', stop); stick.addEventListener('pointercancel', stop);
      const btns = this.root.querySelector('.g-tbtns');
      btns.addEventListener('pointerdown', (e) => {
        const b = e.target.closest('button'); if (!b) return;
        e.preventDefault();
        if (b.dataset.fire != null) this.touchFire = true;
        if (b.dataset.tw != null) this.setWeapon(Number(b.dataset.tw));
        if (b.dataset.dash != null) this.dash();
        if (b.dataset.esc != null) this.end('quit');
      });
      const release = (e) => { if (e.target.closest?.('[data-fire]') || e.type === 'pointercancel') this.touchFire = false; };
      btns.addEventListener('pointerup', release); btns.addEventListener('pointercancel', release); btns.addEventListener('pointerleave', () => { this.touchFire = false; });
    }
  }

  unbind() {
    window.removeEventListener('keydown', this.onKey, true);
    window.removeEventListener('keyup', this.onKey, true);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('resize', this.onResize);
  }

  resize() {
    this.W = innerWidth; this.H = innerHeight;
    this.cv.width = Math.round(this.W * this.dpr); this.cv.height = Math.round(this.H * this.dpr);
  }

  start() {
    this.resize();
    this.bind();
    this.running = true;
    this.setWeapon(0);
    this.banner(L('SAYFAYI YOK ET!', 'DESTROY THE PAGE!'), 1600);
    this.raf = requestAnimationFrame(this.frame);
  }

  frame = (now) => {
    if (!this.running) return;
    const dt = Math.min(0.033, (now - (this.last || now)) / 1000);
    this.last = now;
    if (!this.over) this.update(dt);
    else this.updateFx(dt);
    this.draw();
    this.raf = requestAnimationFrame(this.frame);
  };

  // ---------- güncelleme ----------
  setWeapon(i) {
    this.weapon = i;
    this.ui.weapons.forEach((w, j) => w.classList.toggle('on', j === i));
  }

  aim() {
    const p = this.player;
    if (!this.touch) return { x: this.mouse.x + scrollX, y: this.mouse.y + scrollY };
    let best = null; let bd = 620;
    const consider = (x, y) => { const d = Math.hypot(x - p.x, y - p.y); if (d < bd) { bd = d; best = { x, y }; } };
    if (this.boss) consider(this.boss.x, this.boss.y);
    this.bugs.forEach((b) => consider(b.x, b.y));
    if (!best) this.near(p.x, p.y, 420).forEach((tg) => consider(tg.x + tg.w / 2, tg.y + tg.h / 2));
    return best || { x: p.x + p.face * 200, y: p.y };
  }

  dash() {
    const p = this.player;
    if (p.dashCd > 0 || this.over) return;
    let dx = (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0) + this.touchDir.x;
    let dy = (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0) - (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) + this.touchDir.y;
    if (!dx && !dy) { dx = p.face; }
    const m = Math.hypot(dx, dy) || 1;
    p.vx = (dx / m) * 1150; p.vy = (dy / m) * 1150;
    p.dashT = 0.18; p.dashCd = 0.7; p.inv = Math.max(p.inv, 0.28);
    const close = this.bugs.some((b) => Math.hypot(b.x - p.x, b.y - p.y) < 70) || this.bullets.some((b) => Math.hypot(b.x - p.x, b.y - p.y) < 60);
    if (close) this.addStyle(L('SON ANDA KAÇIŞ', 'CLOSE CALL'), 35);
  }

  update(dt) {
    this.time += dt;
    const p = this.player;
    const k = this.keys;
    let ax = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0) + this.touchDir.x;
    let ay = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) + this.touchDir.y;
    const am = Math.hypot(ax, ay);
    if (am > 1) { ax /= am; ay /= am; }
    p.vx += ax * 2600 * dt; p.vy += ay * 2600 * dt;
    const maxV = p.dashT > 0 ? 1150 : 540;
    const v = Math.hypot(p.vx, p.vy);
    if (v > maxV) { p.vx *= maxV / v; p.vy *= maxV / v; }
    const drag = Math.exp(-(am ? 2.2 : 4.5) * dt);
    p.vx *= drag; p.vy *= drag;
    p.x = clamp(p.x + p.vx * dt, 24, this.docW - 24);
    p.y = clamp(p.y + p.vy * dt, 24, this.docH - 24);
    p.dashT -= dt; p.dashCd -= dt; p.inv -= dt;
    if (p.dashT > 0) { p.trail.push({ x: p.x, y: p.y, t: 0.18 }); }
    p.trail.forEach((tr) => { tr.t -= dt; });
    p.trail = p.trail.filter((tr) => tr.t > 0);

    const target = clamp(p.y - this.H * 0.5, 0, this.docH - this.H);
    const cur = scrollY;
    const ny = cur + (target - cur) * Math.min(1, dt * 7);
    if (Math.abs(ny - cur) > 0.5) window.scrollTo(0, ny);

    const a = this.aim();
    p.face = a.x < p.x ? -1 : 1;

    for (let i = 0; i < 3; i++) this.cool[i] -= dt;
    if (this.ammo < WEAPONS[1].ammoMax) {
      this.recharge += dt;
      if (this.recharge >= WEAPONS[1].recharge) { this.ammo++; this.recharge = 0; }
    }
    if ((this.mouse.down || this.touchFire || k.has('Space')) && this.cool[this.weapon] <= 0) this.fire(a);

    this.fresh.forEach((v2, key) => this.fresh.set(key, Math.min(1, v2 + dt * 0.12)));

    this.updateProjectiles(dt);
    this.updateBugs(dt);
    if (this.boss) this.updateBoss(dt);
    this.updateBullets(dt);
    this.updateFx(dt);

    for (let i = this.pending.length - 1; i >= 0; i--) {
      const pe = this.pending[i];
      pe.t -= dt;
      if (pe.t <= 0) { this.pending.splice(i, 1); pe.fn(); }
    }

    this.comboT -= dt;
    if (this.comboT <= 0 && this.combo) this.combo = 0;

    this.style = Math.max(0, this.style - (5 + this.rankIdx * 5) * dt);
    this.updateRank();

    if (!this.ach.pasif && this.time - this.lastDestroy > 60) this.unlock('pasif');

    const destr = this.destroyed / this.totalArea;
    if (destr > 0.2 && !this.bossDone) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnT = Math.max(2.4, 7 - destr * 6);
        const side = Math.random() < 0.5 ? -1 : 1;
        this.spawnBug(scrollX + (side < 0 ? 10 : this.W - 10), scrollY + rand(80, this.H - 80), Math.random() < 0.2);
      }
    }
    if (!this.boss && !this.bossDone && destr >= 0.8) this.spawnBoss();

    this.hudT = (this.hudT || 0) - dt;
    if (this.hudT <= 0) { this.hudT = 0.08; this.hud(); }
  }

  updateFx(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const q = this.particles[i];
      q.life -= dt;
      if (q.life <= 0) { this.particles.splice(i, 1); continue; }
      q.vy += (q.g ?? 900) * dt;
      q.x += q.vx * dt; q.y += q.vy * dt;
      q.r += (q.vr || 0) * dt;
    }
    if (this.particles.length > 1600) this.particles.splice(0, this.particles.length - 1600);
    this.shake = Math.max(0, this.shake - dt * 30);
    if (this.swing) { this.swing.t -= dt; if (this.swing.t <= 0) this.swing = null; }
    this.targets.forEach((tg) => { if (tg.flash > 0) tg.flash -= dt; });
  }

  fire(a) {
    const p = this.player;
    const w = this.weapon;
    const dx = a.x - p.x; const dy = a.y - p.y;
    const m = Math.hypot(dx, dy) || 1;
    const ux = dx / m; const uy = dy / m;
    if (w === 0) {
      this.cool[0] = WEAPONS[0].rate;
      this.shots++;
      this.projectiles.push({ type: 'spray', x: p.x + ux * 26, y: p.y + uy * 26 - 6, vx: ux * 920 + p.vx * 0.35, vy: uy * 920 + p.vy * 0.35, g: 650, life: 1.3, color: pick(PAINT), rot: 0 });
    } else if (w === 1) {
      if (this.ammo <= 0) { this.cool[1] = 0.3; return; }
      this.ammo--; this.cool[1] = WEAPONS[1].rate; this.shots++;
      this.projectiles.push({ type: 'glitch', x: p.x + ux * 26, y: p.y + uy * 26, vx: ux * 640 + p.vx * 0.3, vy: uy * 640 + p.vy * 0.3, g: 320, life: 1.1, fuse: -1, rot: 0 });
    } else {
      this.cool[2] = WEAPONS[2].rate; this.shots++;
      const cx = p.x + ux * 46; const cy = p.y + uy * 46;
      this.swing = { t: 0.16, ang: Math.atan2(uy, ux) };
      const dashing = p.dashT > 0;
      const dmg = dashing ? 14 : 7;
      let hit = 0; const killed = [];
      this.near(cx, cy, 80).forEach((tg) => {
        if (Game.dist(tg, cx, cy) > 80) return;
        hit++;
        if (this.damage(tg, dmg, 'hammer')) killed.push(tg);
      });
      for (let i = this.bugs.length - 1; i >= 0; i--) {
        const b = this.bugs[i];
        if (Math.hypot(b.x - cx, b.y - cy) < 90) { hit++; this.killBug(i, 'hammer'); }
      }
      if (this.boss && this.inBoss(cx, cy, 70)) { hit++; this.damageBoss(dashing ? 8 : 5); }
      if (hit) {
        this.hits++; this.st.hammer += hit; this.shake = Math.max(this.shake, 6);
        if (this.st.hammer >= 40) this.unlock('cekic');
        for (let i = 0; i < 10; i++) this.particles.push({ x: cx, y: cy, vx: rand(-260, 260), vy: rand(-320, 80), life: 0.4, s: 5, color: '#FBF236', r: 0 });
      }
      if (killed.length) {
        this.addStyle(dashing ? L('ATILIŞLI ÇEKİÇ', 'DASH HAMMER') : L('ÇEKİÇLE PARÇALADIN', 'HAMMERED'), dashing ? 30 : 18);
        this.multiKill(killed.length);
      }
    }
  }

  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      if (pr.fuse >= 0) {
        pr.fuse -= dt;
        if (pr.fuse <= 0) { this.projectiles.splice(i, 1); this.glitchBlast(pr.x, pr.y, 150, 0, { n: 0 }); }
        continue;
      }
      pr.vy += pr.g * dt; pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.life -= dt; pr.rot += dt * 12;
      const hitT = this.at(pr.x, pr.y);
      const hitB = this.bugs.findIndex((b) => Math.hypot(b.x - pr.x, b.y - pr.y) < 26);
      const hitBoss = this.boss && this.inBoss(pr.x, pr.y, 0);
      const out = pr.x < 0 || pr.x > this.docW || pr.y < 0 || pr.y > this.docH;
      if (hitT || hitB >= 0 || hitBoss || pr.life <= 0 || out) {
        if (pr.type === 'spray') { this.projectiles.splice(i, 1); this.sprayBlast(pr.x, pr.y, pr.color, hitBoss); }
        else { pr.fuse = 0.45; pr.vx = 0; pr.vy = 0; if (hitBoss) this.damageBoss(4); }
      }
    }
  }

  sprayBlast(x, y, color, hitBoss) {
    const R = 95;
    const killed = [];
    let any = false;
    this.near(x, y, R).forEach((tg) => {
      const d = Game.dist(tg, x, y);
      if (d > R) return;
      any = true;
      if (this.damage(tg, Math.ceil(4 * (1 - (d / R) * 0.6)), 'spray')) killed.push(tg);
    });
    for (let i = this.bugs.length - 1; i >= 0; i--) if (Math.hypot(this.bugs[i].x - x, this.bugs[i].y - y) < R) { any = true; this.killBug(i, 'spray'); }
    if (hitBoss || (this.boss && this.inBoss(x, y, R * 0.6))) { any = true; this.damageBoss(4); }
    if (any) this.hits++;
    this.addSplat(x, y, color, rand(46, 74));
    for (let i = 0; i < 24; i++) {
      const a = rand(0, Math.PI * 2); const s = rand(120, 460);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120, life: rand(0.4, 0.9), s: rand(3, 7), color, r: 0 });
    }
    this.shake = Math.max(this.shake, 4);
    if (killed.length) {
      if (Math.hypot(this.player.vx, this.player.vy) > 380) this.addStyle(L('HAVADA SPREY', 'MIDAIR SPRAY'), 20);
      this.multiKill(killed.length);
    }
  }

  glitchBlast(x, y, R, depth, chain) {
    const killed = [];
    this.near(x, y, R).forEach((tg) => {
      if (Game.dist(tg, x, y) > R) return;
      if (!tg.glitched) { tg.glitched = true; tg.el.classList.add('g-glitched'); }
      if (this.damage(tg, depth ? 3 : 6, 'glitch')) killed.push(tg);
    });
    for (let i = this.bugs.length - 1; i >= 0; i--) if (Math.hypot(this.bugs[i].x - x, this.bugs[i].y - y) < R) this.killBug(i, 'glitch');
    if (this.boss && this.inBoss(x, y, R * 0.6)) this.damageBoss(depth ? 3 : 8);
    if (!depth) this.hits++;
    for (let i = 0; i < (depth ? 14 : 40); i++) {
      const a = rand(0, Math.PI * 2); const s = rand(40, depth ? 220 : 380);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: -40, life: rand(0.3, 0.8), s: rand(4, 9), color: pick(RGBC), r: 0, sq: true });
    }
    this.shake = Math.max(this.shake, depth ? 3 : 7);
    if (killed.length) {
      chain.n += killed.length;
      if (depth < 6) {
        killed.forEach((tg) => this.pending.push({ t: 0.12, fn: () => this.glitchBlast(tg.x + tg.w / 2, tg.y + tg.h / 2, 70, depth + 1, chain) }));
      }
      this.multiKill(killed.length);
    }
    if (depth === 0) {
      this.pending.push({
        t: 1.2,
        fn: () => {
          if (chain.n >= 2) this.addStyle(`${L('GLITCH ZİNCİRİ', 'GLITCH CHAIN')} ×${chain.n}`, 12 * chain.n);
          this.st.chain = Math.max(this.st.chain, chain.n);
          if (chain.n >= 5) this.unlock('glitch');
        },
      });
    }
  }

  addSplat(x, y, color, r) {
    const blobs = [];
    const n = 7 + Math.floor(Math.random() * 6);
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2); const d = rand(0, r);
      blobs.push([Math.cos(a) * d, Math.sin(a) * d, rand(4, r * 0.45)]);
    }
    const drips = [];
    for (let i = 0; i < 3; i++) drips.push([rand(-r * 0.6, r * 0.6), rand(r * 0.3, r * 1.2), rand(3, 6)]);
    this.splats.push({ x, y, r, color, blobs, drips });
    if (this.splats.length > 220) this.splats.shift();
  }

  damage(tg, dmg, src) {
    if (tg.dead) return false;
    tg.hp -= dmg;
    tg.flash = 0.08;
    if (tg.hp <= 0) { this.destroyTarget(tg, src); return true; }
    return false;
  }

  destroyTarget(tg, src) {
    tg.dead = true;
    tg.el.style.visibility = 'hidden';
    tg.el.classList.remove('g-glitched');
    this.order.push(tg);
    this.destroyed += tg.area;
    this.lastDestroy = this.time;
    this.st.kills++;
    if (src === 'spray') { this.st.spray++; if (this.st.spray >= 25) this.unlock('sanat'); }
    this.unlock('ilk');

    this.combo = this.time - this.lastKill < 2.5 ? this.combo + 1 : 1;
    this.lastKill = this.time; this.comboT = 2.5;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    if (this.combo >= 30) this.unlock('kombo');
    if (this.combo > 1) { this.ui.combo.classList.remove('bump'); void this.ui.combo.offsetWidth; this.ui.combo.classList.add('bump'); }

    const base = 50 + tg.area / 40;
    this.score += base * RANKS[this.rankIdx].mult * (1 + Math.min(this.combo, 50) * 0.05);
    this.addStyle(L('PARÇALADIN', 'SMASHED'), 8);

    const s = this.sections.get(tg.sec);
    if (s) {
      s.left--;
      if (s.left === 0 && s.total > 1) {
        const names = { top: L('GİRİŞ', 'ENTRY'), oda: L('ODA', 'ROOM'), projeler: L('PROJELER', 'PROJECTS'), envanter: L('ENVANTER', 'INVENTORY'), raf: L('RAF', 'SHELF'), muzik: L('MÜZİK', 'MUSIC'), duvar: L('DUVAR', 'WALL'), iletisim: L('İLETİŞİM', 'CONTACT') };
        this.addStyle(`${L('BÖLÜM TEMİZLENDİ', 'SECTION CLEARED')}: ${names[tg.sec] || tg.sec}`, 60);
        this.score += 2000 * RANKS[this.rankIdx].mult;
        if (tg.sec === 'projeler') this.unlock('proje');
      }
    }

    this.debris(tg, src);
    if (!this.boss && Math.random() < 0.1 + (this.destroyed / this.totalArea) * 0.15) {
      this.spawnBug(tg.x + tg.w / 2, tg.y + tg.h / 2, Math.random() < 0.15);
    }
  }

  debris(tg, src) {
    const n = clamp(Math.round(Math.sqrt(tg.area) / 9), 6, 34);
    const cols = src === 'glitch' ? RGBC : [tg.color, tg.color, '#222034', pick(PAINT)];
    for (let i = 0; i < n; i++) {
      const x = tg.x + Math.random() * tg.w; const y = tg.y + Math.random() * tg.h;
      if (src === 'glitch') {
        this.particles.push({ x, y, vx: rand(-60, 60), vy: rand(-160, -40), g: -60, life: rand(0.5, 1.2), s: rand(3, 8), color: pick(cols), r: 0, sq: true });
      } else {
        this.particles.push({ x, y, vx: rand(-240, 240), vy: rand(-380, -60), life: rand(0.9, 1.8), s: rand(4, 13), color: pick(cols), r: rand(0, 6), vr: rand(-10, 10) });
      }
    }
    if (tg.text) {
      const chars = [...tg.text];
      for (let i = 0; i < Math.min(6, chars.length); i++) {
        this.particles.push({ x: tg.x + Math.random() * tg.w, y: tg.y + tg.h / 2, vx: rand(-200, 200), vy: rand(-360, -120), life: rand(1, 1.6), s: rand(16, 30), color: tg.color, r: 0, vr: rand(-6, 6), ch: pick(chars) });
      }
    }
  }

  multiKill(n) {
    if (n >= 5) this.addStyle(L('KATLİAM', 'MASSACRE'), 80);
    else if (n === 3 || n === 4) this.addStyle(L('ÜÇLÜ KIRIM', 'TRIPLE BREAK'), 45);
    else if (n === 2) this.addStyle(L('ÇİFT KIRIM', 'DOUBLE BREAK'), 25);
  }

  // ---------- düşmanlar ----------
  spawnBug(x, y, merge = false) {
    if (this.bugs.length > 24) return;
    this.bugs.push({ x, y, vx: 0, vy: 0, merge, hp: merge ? 2 : 1, t: Math.random() * 10, sp: rand(110, 175) });
  }

  killBug(i, src) {
    const b = this.bugs[i];
    if (!b) return;
    b.hp--;
    if (b.hp > 0 && !b.merge) return;
    this.bugs.splice(i, 1);
    this.st.bugs++;
    if (this.st.bugs >= 30) this.unlock('bug');
    this.score += (b.merge ? 600 : 250) * RANKS[this.rankIdx].mult;
    this.addStyle(b.merge ? L('MERGE ÇÖZÜLDÜ', 'MERGE RESOLVED') : L('BUG EZİLDİ', 'BUG SQUASHED'), b.merge ? 30 : 15);
    for (let k = 0; k < 14; k++) this.particles.push({ x: b.x, y: b.y, vx: rand(-200, 200), vy: rand(-260, 40), life: 0.6, s: rand(3, 6), color: pick(['#AC3232', '#D77BBA', '#222034']), r: 0, sq: true });
    if (b.merge && src !== 'split') { this.spawnBug(b.x - 20, b.y, false); this.spawnBug(b.x + 20, b.y, false); }
  }

  updateBugs(dt) {
    const p = this.player;
    for (const b of this.bugs) {
      b.t += dt;
      const dx = p.x - b.x; const dy = p.y - b.y;
      const d = Math.hypot(dx, dy) || 1;
      b.vx += ((dx / d) * b.sp - b.vx) * dt * 2.5;
      b.vy += ((dy / d) * b.sp - b.vy) * dt * 2.5;
      b.x += (b.vx + Math.cos(b.t * 6) * 40) * dt;
      b.y += (b.vy + Math.sin(b.t * 7) * 40) * dt;
      if (d < (b.merge ? 34 : 26)) this.hurt(8, b.x, b.y);
    }
  }

  spawnBoss() {
    const p = this.player;
    this.boss = { x: clamp(p.x + 260, 200, this.docW - 200), y: clamp(p.y + 240, 220, this.docH - 200), w: 240, h: 200, hp: 80, max: 80, t: 0, fireT: 1.6, spawnT: 5, flash: 0 };
    this.ui.boss.hidden = false;
    this.banner(L('!! 404 UYANDI !!', '!! 404 IS AWAKE !!'), 2000);
    this.shake = 12;
  }

  inBoss(x, y, pad) {
    const b = this.boss;
    return b && x > b.x - b.w / 2 - pad && x < b.x + b.w / 2 + pad && y > b.y - b.h / 2 - pad && y < b.y + b.h / 2 + pad;
  }

  updateBoss(dt) {
    const b = this.boss; const p = this.player;
    b.t += dt; b.flash -= dt;
    const tx = p.x + Math.sin(b.t * 0.7) * 260;
    const ty = p.y - 60 + Math.cos(b.t * 0.9) * 140;
    b.x += clamp(tx - b.x, -1, 1) * Math.min(Math.abs(tx - b.x), 110 * dt);
    b.y += clamp(ty - b.y, -1, 1) * Math.min(Math.abs(ty - b.y), 90 * dt);
    const rage = b.hp < b.max / 2;
    b.fireT -= dt;
    if (b.fireT <= 0) {
      b.fireT = rage ? 1.05 : 1.6;
      const n = rage ? 7 : 5;
      const base = Math.atan2(p.y - b.y, p.x - b.x);
      for (let i = 0; i < n; i++) {
        const a = base + (i - (n - 1) / 2) * 0.16;
        this.bullets.push({ x: b.x, y: b.y + 20, vx: Math.cos(a) * 290, vy: Math.sin(a) * 290, life: 4 });
      }
    }
    b.spawnT -= dt;
    if (b.spawnT <= 0) { b.spawnT = rage ? 4.5 : 6.5; this.spawnBug(b.x - 60, b.y, false); this.spawnBug(b.x + 60, b.y, rage); }
    if (this.inBoss(p.x, p.y, -10)) this.hurt(15, b.x, b.y);
  }

  damageBoss(d) {
    const b = this.boss;
    if (!b) return;
    b.hp -= d; b.flash = 0.1;
    this.score += 200 * RANKS[this.rankIdx].mult;
    this.addStyle(L('BOSS VURUŞU', 'BOSS HIT'), 6);
    if (b.hp <= 0) {
      const { x, y } = b;
      this.boss = null; this.bossDone = true; this.bullets = [];
      this.ui.boss.hidden = true;
      this.score += 25000 * RANKS[this.rankIdx].mult;
      this.addStyle(L('404 YENİLDİ', '404 DEFEATED'), 200);
      this.unlock('boss');
      if (this.st.dmg === 0) this.unlock('dokun');
      if (this.time < 180) this.unlock('hiz');
      for (let i = 0; i < 160; i++) {
        const a = rand(0, Math.PI * 2); const s = rand(100, 700);
        this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 200, life: rand(0.8, 2), s: rand(5, 16), color: pick(['#AC3232', '#FFFFFF', '#222034', '#FBF236']), r: rand(0, 6), vr: rand(-10, 10) });
      }
      for (let i = 0; i < 6; i++) this.addSplat(x + rand(-120, 120), y + rand(-80, 80), pick(PAINT), rand(50, 90));
      this.shake = 20;
      this.banner(L('404 YENİLDİ!', '404 DEFEATED!'), 1600);
      this.pending.push({ t: 1.8, fn: () => this.end('win') });
    }
  }

  updateBullets(dt) {
    const p = this.player;
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const u = this.bullets[i];
      u.x += u.vx * dt; u.y += u.vy * dt; u.life -= dt;
      if (Math.hypot(u.x - p.x, u.y - p.y) < 22) { this.bullets.splice(i, 1); this.hurt(10, u.x, u.y); continue; }
      if (u.life <= 0) this.bullets.splice(i, 1);
    }
  }

  hurt(dmg, fx, fy) {
    const p = this.player;
    if (p.inv > 0 || this.over) return;
    p.hp -= dmg; p.inv = 0.9;
    this.st.dmg += dmg;
    const dx = p.x - fx; const dy = p.y - fy; const d = Math.hypot(dx, dy) || 1;
    p.vx += (dx / d) * 600; p.vy += (dy / d) * 600;
    this.addStyle(L('HASAR ALINDI', 'DAMAGE TAKEN'), -60);
    this.shake = 10;
    if (p.hp <= 0) { p.hp = 0; this.end('dead'); }
  }

  // ---------- stil ----------
  addStyle(name, pts) {
    let gain = pts;
    if (pts > 0) {
      const f = this.fresh.get(name) ?? 1;
      gain = pts * f;
      this.fresh.set(name, Math.max(0.3, f * 0.72));
    }
    this.style = clamp(this.style + gain, 0, STYLE_CAP);
    this.feed.unshift({ txt: `${pts < 0 ? '−' : '+'} ${name}`, neg: pts < 0, t: this.time });
    if (this.feed.length > 7) this.feed.length = 7;
    this.feedDirty = true;
    this.updateRank();
  }

  updateRank() {
    let idx = 0;
    RANKS.forEach((r, i) => { if (this.style >= r.at) idx = i; });
    if (idx !== this.rankIdx) {
      const up = idx > this.rankIdx;
      this.rankIdx = idx;
      if (up) { this.ui.rankL.classList.remove('bump'); void this.ui.rankL.offsetWidth; this.ui.rankL.classList.add('bump'); }
      if (idx > this.peakRank) this.peakRank = idx;
      if (idx === RANKS.length - 1) this.unlock('cow');
    }
  }

  unlock(id) {
    if (this.ach[id]) return;
    this.ach[id] = Date.now();
    this.newAch.push(id);
    store.set('star.ach', this.ach);
    const a = ACH.find((x) => x[0] === id);
    if (!a) return;
    const el = document.createElement('div');
    el.className = 'g-ach';
    el.innerHTML = `${spriteSVG('trophy', 4)}<div><div class="s">${L('BAŞARIM AÇILDI', 'ACHIEVEMENT UNLOCKED')}</div><b>${esc(L(a[1], a[2]))}</b><i>${esc(L(a[3], a[4]))}</i></div>`;
    this.ui.toasts.append(el);
    setTimeout(() => el.remove(), 3600);
  }

  banner(text, ms) {
    const el = document.createElement('div');
    el.className = 'g-banner';
    el.textContent = text;
    this.ui.hud.append(el);
    setTimeout(() => el.remove(), ms);
  }

  hud() {
    const p = this.player;
    const cells = Math.ceil(p.hp / 10);
    this.ui.cells.forEach((c, i) => { c.className = i < cells ? (cells <= 3 ? 'low' : 'on') : ''; });
    this.ui.hpNum.textContent = Math.ceil(p.hp);
    this.ui.weapons.forEach((w, i) => {
      const a = w.querySelector('.a');
      if (i === 0) a.textContent = '∞';
      if (i === 1) a.textContent = `×${this.ammo}`;
      const cd = w.querySelector('.cd');
      const frac = i === 1 && this.ammo === 0 ? 1 - this.recharge / WEAPONS[1].recharge : Math.max(0, this.cool[i] / WEAPONS[i].rate);
      cd.style.height = `${Math.round(frac * 100)}%`;
    });
    const d = Math.min(100, Math.floor((this.destroyed / this.totalArea) * 100));
    this.ui.destrB.textContent = `%${d}`;
    this.ui.destrI.style.width = `${d}%`;
    this.ui.score.textContent = fmtScore(this.score);
    if (this.boss) this.ui.bossI.style.width = `${Math.max(0, (this.boss.hp / this.boss.max) * 100)}%`;
    const r = RANKS[this.rankIdx];
    this.ui.style.style.setProperty('--rc', r.c);
    this.ui.rankL.textContent = r.l;
    this.ui.rankN.textContent = getLang() === 'en' ? r.en : r.tr;
    this.ui.mult.textContent = `×${r.mult}`;
    const next = RANKS[this.rankIdx + 1];
    const frac = next ? (this.style - r.at) / (next.at - r.at) : this.style / STYLE_CAP;
    this.ui.drain.style.width = `${clamp(frac * 100, 0, 100)}%`;
    this.ui.ladder.forEach((s, i) => {
      s.classList.toggle('on', i === this.rankIdx);
      if (RANKS[i].hidden && i <= this.peakRank) s.textContent = `${RANKS[i].l}`;
    });
    if (this.feedDirty) {
      this.feedDirty = false;
      this.ui.feed.innerHTML = this.feed.map((f) => `<li class="${f.neg ? 'neg' : ''}">${esc(f.txt)}</li>`).join('');
    }
    [...this.ui.feed.children].forEach((li, i) => { li.style.opacity = String(clamp(1 - (this.time - this.feed[i].t) / 6, 0.25, 1)); });
    this.ui.combo.hidden = this.combo < 2;
    this.ui.comboB.textContent = `×${this.combo}`;
  }

  // ---------- çizim ----------
  draw() {
    const c = this.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.W, this.H);
    const sx = (Math.random() - 0.5) * this.shake; const sy = (Math.random() - 0.5) * this.shake;
    c.translate(-scrollX + sx, -scrollY + sy);
    const top = scrollY - 120; const bot = scrollY + this.H + 120;

    for (const s of this.splats) {
      if (s.y < top || s.y > bot) continue;
      c.fillStyle = s.color;
      c.globalAlpha = 0.88;
      c.beginPath(); c.arc(s.x, s.y, s.r * 0.55, 0, Math.PI * 2); c.fill();
      for (const [bx, by, br] of s.blobs) { c.beginPath(); c.arc(s.x + bx, s.y + by, br, 0, Math.PI * 2); c.fill(); }
      for (const [dx, len, w] of s.drips) { c.fillRect(s.x + dx - w / 2, s.y, w, len); c.beginPath(); c.arc(s.x + dx, s.y + len, w * 0.9, 0, Math.PI * 2); c.fill(); }
      c.globalAlpha = 1;
    }

    c.strokeStyle = '#222034';
    c.lineWidth = 2;
    for (const tg of this.targets) {
      if (tg.dead || tg.hp >= tg.max || tg.y + tg.h < top || tg.y > bot) continue;
      const dmg = 1 - tg.hp / tg.max;
      let seed = tg.seed;
      const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
      const lines = 1 + Math.floor(dmg * 5);
      for (let l = 0; l < lines; l++) {
        let x = tg.x + rnd() * tg.w; let y = tg.y + rnd() * tg.h;
        c.beginPath(); c.moveTo(x, y);
        for (let s2 = 0; s2 < 4; s2++) { x += (rnd() - 0.5) * Math.min(60, tg.w * 0.5); y += (rnd() - 0.5) * Math.min(40, tg.h * 0.6); c.lineTo(clamp(x, tg.x, tg.x + tg.w), clamp(y, tg.y, tg.y + tg.h)); }
        c.stroke();
      }
      if (tg.flash > 0) { c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(tg.x, tg.y, tg.w, tg.h); }
    }

    for (const q of this.particles) {
      if (q.y < top || q.y > bot) continue;
      c.globalAlpha = Math.min(1, q.life * 2);
      c.fillStyle = q.color;
      if (q.ch) {
        c.save(); c.translate(q.x, q.y); c.rotate(q.r);
        c.font = `900 ${q.s}px Archivo, sans-serif`;
        c.fillText(q.ch, -q.s / 3, q.s / 3);
        c.restore();
      } else if (q.r) {
        c.save(); c.translate(q.x, q.y); c.rotate(q.r);
        c.fillRect(-q.s / 2, -q.s / 2, q.s, q.s);
        c.strokeStyle = '#222034'; c.lineWidth = 1.5; c.strokeRect(-q.s / 2, -q.s / 2, q.s, q.s);
        c.restore();
      } else {
        c.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s);
      }
    }
    c.globalAlpha = 1;

    for (const b of this.bugs) {
      const img = b.merge ? (Math.floor(b.t * 8) % 2 ? this.sprites.bigbug : this.sprites.bigbug2) : (Math.floor(b.t * 8) % 2 ? this.sprites.bug : this.sprites.bug2);
      c.drawImage(img, b.x - img.width / 2, b.y - img.height / 2);
      if (b.merge) {
        c.font = '10px Silkscreen, monospace';
        const label = 'MERGE CONFLICT';
        const w = c.measureText(label).width + 10;
        c.fillStyle = '#AC3232'; c.fillRect(b.x - w / 2, b.y + 32, w, 16);
        c.strokeStyle = '#222034'; c.strokeRect(b.x - w / 2, b.y + 32, w, 16);
        c.fillStyle = '#fff'; c.fillText(label, b.x - w / 2 + 5, b.y + 44);
      }
    }

    c.font = '10px Silkscreen, monospace';
    for (const u of this.bullets) {
      c.fillStyle = '#AC3232'; c.fillRect(u.x - 16, u.y - 9, 32, 18);
      c.strokeStyle = '#222034'; c.lineWidth = 2; c.strokeRect(u.x - 16, u.y - 9, 32, 18);
      c.fillStyle = '#fff'; c.fillText('404', u.x - 11, u.y + 4);
    }

    if (this.boss) this.drawBoss(c);

    for (const pr of this.projectiles) {
      const img = pr.type === 'spray' ? this.sprites.spray : this.sprites.gbomb;
      c.save(); c.translate(pr.x, pr.y); c.rotate(pr.fuse >= 0 ? 0 : pr.rot);
      if (pr.fuse >= 0 && Math.floor(this.time * 20) % 2) c.globalAlpha = 0.4;
      c.drawImage(img, -img.width / 2, -img.height / 2);
      c.restore();
    }

    const p = this.player;
    for (const tr of p.trail) {
      c.globalAlpha = tr.t * 2.5;
      this.drawPlayer(c, tr.x, tr.y, true);
    }
    c.globalAlpha = 1;
    if (!(p.inv > 0 && Math.floor(this.time * 18) % 2 && p.dashT <= 0)) this.drawPlayer(c, p.x, p.y, false);

    if (this.swing) {
      const a = this.swing.ang; const prog = 1 - this.swing.t / 0.16;
      c.strokeStyle = '#FBF236'; c.lineWidth = 10;
      c.beginPath(); c.arc(p.x, p.y, 62, a - 1.2 + prog * 0.6, a + 0.4 + prog * 0.8); c.stroke();
      c.strokeStyle = '#222034'; c.lineWidth = 3;
      c.beginPath(); c.arc(p.x, p.y, 70, a - 1.2 + prog * 0.6, a + 0.4 + prog * 0.8); c.stroke();
    }

    if (!this.touch && !this.over) {
      const ax = this.mouse.x + scrollX; const ay = this.mouse.y + scrollY;
      c.setLineDash([6, 8]); c.strokeStyle = 'rgba(34,32,52,.45)'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(ax, ay); c.stroke(); c.setLineDash([]);
      const cr = this.sprites.cross;
      c.drawImage(cr, ax - cr.width / 2, ay - cr.height / 2);
    }
  }

  drawPlayer(c, x, y, ghost) {
    const p = this.player;
    const img = this.sprites.jet;
    c.save();
    c.translate(x, y);
    if (p.face < 0) c.scale(-1, 1);
    c.drawImage(img, -img.width / 2, -img.height / 2);
    if (!ghost) {
      const fl = Math.floor(this.time * 14) % 2 ? this.sprites.flame : this.sprites.flame2;
      c.drawImage(fl, -fl.width / 2, img.height / 2 - 2);
    }
    c.restore();
  }

  drawBoss(c) {
    const b = this.boss; const p = this.player;
    const x = b.x - b.w / 2; const y = b.y - b.h / 2;
    const jx = Math.sin(b.t * 30) * 2;
    c.save();
    c.translate(jx, 0);
    c.fillStyle = '#222034'; c.fillRect(x + 12, y + 12, b.w, b.h);
    c.fillStyle = '#222034'; c.fillRect(x, y, b.w, 34);
    c.fillStyle = '#F2EEE3'; c.font = '13px Silkscreen, monospace'; c.fillText('404.html', x + 10, y + 22);
    ['#DF7126', '#FBF236', '#AC3232'].forEach((col, i) => { c.fillStyle = col; c.fillRect(x + b.w - 66 + i * 20, y + 10, 14, 14); });
    c.fillStyle = b.flash > 0 ? '#FFFFFF' : '#AC3232';
    c.fillRect(x, y + 34, b.w, b.h - 34);
    c.strokeStyle = '#222034'; c.lineWidth = 6; c.strokeRect(x, y, b.w, b.h);
    c.fillStyle = '#fff'; c.font = '700 40px Silkscreen, monospace';
    c.fillText('404', x + b.w / 2 - 54, y + 78);
    const ex = clamp((p.x - b.x) / 300, -1, 1) * 8; const ey = clamp((p.y - b.y) / 300, -1, 1) * 8;
    [[x + 50, y + 96], [x + b.w - 98, y + 96]].forEach(([eX, eY], i) => {
      c.fillStyle = '#fff'; c.fillRect(eX, eY, 48, 42);
      c.strokeStyle = '#222034'; c.lineWidth = 4; c.strokeRect(eX, eY, 48, 42);
      c.fillStyle = '#222034'; c.fillRect(eX + 15 + ex, eY + 12 + ey, 18, 18);
      c.save(); c.translate(eX + 24, eY - 10); c.rotate(i ? -0.35 : 0.35); c.fillRect(-30, -5, 60, 10); c.restore();
    });
    c.fillStyle = '#222034'; c.fillRect(x + 60, y + 152, b.w - 120, 32);
    c.fillStyle = '#fff';
    for (let i = 0; i < 6; i++) {
      const tx = x + 64 + i * ((b.w - 128) / 6);
      c.beginPath(); c.moveTo(tx, y + 152); c.lineTo(tx + 10, y + 166); c.lineTo(tx + 20, y + 152); c.fill();
    }
    c.restore();
  }

  // ---------- oyun sonu ----------
  end(reason) {
    if (this.over) return;
    this.over = true;
    this.mouse.down = false; this.touchFire = false;
    this.reason = reason;
    this.hud();
    this.root.style.cursor = 'auto';
    this.showResults();
  }

  async showResults() {
    const destr = Math.min(100, Math.floor((this.destroyed / this.totalArea) * 100));
    const rank = RANKS[this.peakRank];
    const title = this.reason === 'win' ? L('SAYFA<br>YOK EDİLDİ.', 'PAGE<br>DESTROYED.') : this.reason === 'dead' ? L('ŞARJ<br>BİTTİ.', 'OUT OF<br>POWER.') : L('OYUN<br>BIRAKILDI.', 'GAME<br>ABANDONED.');
    const quips = {
      0: L('ısınma turuydu herhalde.', 'just warming up, right?'), 1: L('fena başlangıç değil.', 'not a bad start.'), 2: L('sayfa korkmaya başladı.', 'the page is getting nervous.'),
      3: L('anarşi seviyesine ulaştın.', 'you reached anarchy.'), 4: L('her yer boya.', 'paint everywhere.'), 5: L('sistem çöktü. sen çökerttin.', 'system crashed. you crashed it.'),
      6: L('root yetkisi alındı.', 'root access granted.'), 7: L('hiçbir anlamı yok. ama sen oradasın.', 'it means nothing. but you got there.'),
    };
    const accuracy = this.shots ? Math.round((this.hits / this.shots) * 100) : 0;
    const achGrid = ACH.map(([id, tr, en]) => `<div class="${this.ach[id] ? `got${this.newAch.includes(id) ? ' new' : ''}` : 'no'}">${spriteSVG(this.ach[id] ? 'trophy' : 'lock', this.ach[id] ? 4 : 5)}<span>${esc(this.ach[id] ? L(tr, en) : '???')}</span></div>`).join('');
    const got = ACH.filter(([id]) => this.ach[id]).length;
    this.final = { score: Math.floor(this.score), rank: rank.l, destruction: destr, best_combo: this.bestCombo, duration_s: Math.round(this.time) };

    const el = document.createElement('div');
    el.className = 'g-over';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', L('Oyun sonu', 'Game over'));
    el.innerHTML = `
      <div class="g-osd l">◀◀ ${L('GERİ SAR', 'REWIND')}<span class="blink">_</span></div>
      <div class="g-osd r">SP ${fmtTime(this.time)}</div>
      <div class="g-over-in">
        <section>
          <h2>${title}</h2>
          <div class="g-final" style="--rc:${rank.c}"><span class="l">${rank.l}</span><div><small>${L('NİHAİ RÜTBE (ZİRVE)', 'FINAL RANK (PEAK)')}</small><b>${esc(getLang() === 'en' ? rank.en : rank.tr)}</b><i>${esc(quips[this.peakRank])}</i></div></div>
          <dl class="g-stats">
            <div><dt>${L('SKOR', 'SCORE')}</dt><dd>${fmtScore(this.score)}</dd></div>
            <div><dt>${L('YIKIM', 'DESTRUCTION')}</dt><dd>%${destr}</dd></div>
            <div><dt>${L('EN İYİ KOMBO', 'BEST COMBO')}</dt><dd>×${this.bestCombo}</dd></div>
            <div><dt>${L('SÜRE', 'TIME')}</dt><dd>${fmtTime(this.time)}</dd></div>
            <div><dt>BOSS</dt><dd>${this.bossDone ? '404 ✓' : '—'}</dd></div>
            <div><dt>${L('İSABET', 'ACCURACY')}</dt><dd>%${accuracy}</dd></div>
          </dl>
          <div class="g-achs"><div class="px">${L('BAŞARIMLAR', 'ACHIEVEMENTS')} — ${got}/${ACH.length}</div><div class="g-achs-grid">${achGrid}</div></div>
        </section>
        <section class="g-lb">
          <div class="g-lb-h"><span>${L('SKOR TABLOSU', 'LEADERBOARD')}</span><b class="lb-mode"></b></div>
          <form class="g-name">
            <label for="gName">${L('ADINI GİR (3 HARF)', 'ENTER NAME (3 LETTERS)')}</label>
            <div class="g-name-row"><input id="gName" maxlength="3" autocomplete="off" spellcheck="false" value="${esc(store.get('star.arcade', ''))}"><button type="submit" class="btn btn-ink">${L('KAYDET', 'SAVE')}</button></div>
          </form>
          <ol class="lb-list"><li class="dim"><span>…</span></li></ol>
        </section>
        <div class="g-over-btns">
          <button type="button" class="btn btn-acc" data-rw>◀◀ ${L('GERİ SAR — SAYFAYI ONAR', 'REWIND — FIX THE PAGE')}</button>
          <button type="button" class="btn" data-again>${L('BİR DAHA', 'AGAIN')}</button>
          <span class="hand">${L('her şey VHS gibi geri sarılıp yerine döner.', 'everything rewinds back into place, VHS style.')}</span>
        </div>
      </div>`;
    this.root.append(el);
    this.overEl = el;
    el.querySelector('[data-rw]').addEventListener('click', () => this.rewind(false));
    el.querySelector('[data-again]').addEventListener('click', () => this.rewind(true));
    const input = el.querySelector('#gName');
    input.addEventListener('input', () => { input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3); });
    el.querySelector('.g-name').addEventListener('submit', (e) => { e.preventDefault(); this.saveScore(input.value); });
    setTimeout(() => (input.value ? el.querySelector('[data-rw]') : input).focus(), 50);
    this.loadBoard();
  }

  async loadBoard(me) {
    const list = this.overEl?.querySelector('.lb-list');
    if (!list) return;
    const sb = await getSupabase();
    let rows = [];
    this.overEl.querySelector('.lb-mode').textContent = sb ? L('● CANLI', '● LIVE') : L('○ YEREL', '○ LOCAL');
    if (sb) {
      const { data } = await sb.from('scores').select('id,name,score,rank').order('score', { ascending: false }).limit(10);
      rows = data || [];
    } else {
      rows = (store.get('star.scores', []) || []).sort((a, b) => b.score - a.score).slice(0, 10);
    }
    if (!rows.length) { list.innerHTML = `<li class="dim"><span></span><span></span><span>${L('ilk sen ol', 'be the first')}</span><span></span></li>`; return; }
    list.innerHTML = rows.map((r, i) => `<li class="${me && r.id === me ? 'me' : ''}${i === 9 ? ' dim' : ''}"><span>${String(i + 1).padStart(2, '0')}</span><span>${esc(r.name)}</span><span>${fmtScore(r.score)}${me && r.id === me ? L(' ← SEN', ' ← YOU') : ''}</span><span>${esc(r.rank)}</span></li>`).join('');
  }

  async saveScore(name) {
    if (this.saved) return;
    name = (name || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
    if (name.length !== 3) { this.overEl.querySelector('#gName').focus(); return; }
    store.set('star.arcade', name);
    this.saved = true;
    const btn = this.overEl.querySelector('.g-name button');
    btn.disabled = true;
    const row = { ...this.final, name };
    const sb = await getSupabase();
    let id = null;
    if (sb) {
      const { data, error } = await sb.from('scores').insert(row).select('id').single();
      if (error) { console.warn('[skor]', error); this.saved = false; btn.disabled = false; return; }
      id = data.id;
    } else {
      id = `l${Date.now()}`;
      const all = store.get('star.scores', []) || [];
      all.push({ ...row, id });
      store.set('star.scores', all.sort((a, b) => b.score - a.score).slice(0, 50));
    }
    btn.textContent = '✓';
    this.loadBoard(id);
  }

  rewind(again) {
    if (this.rewinding) return;
    this.rewinding = true;
    this.overEl?.remove();
    this.ui.hud.style.display = 'none';
    const fx = document.createElement('div');
    fx.className = 'g-rewind';
    fx.innerHTML = `<b>◀◀ ${L('GERİ SAR', 'REWIND')}</b>`;
    this.root.append(fx);
    const list = this.order.slice().reverse();
    const startY = scrollY;
    const dur = clamp(list.length * 14, 700, 1800);
    const t0 = performance.now();
    const totalSplats = this.splats.length;
    let done = 0;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      const want = Math.floor(k * list.length);
      for (; done < want; done++) {
        const tg = list[done];
        tg.el.style.visibility = tg.prevVis;
        tg.el.classList.add('g-restore');
        setTimeout(() => tg.el.classList.remove('g-restore'), 400);
      }
      this.splats.length = Math.floor(totalSplats * (1 - k));
      this.particles.length = Math.floor(this.particles.length * 0.9);
      this.bugs = []; this.bullets = []; this.projectiles = []; this.boss = null;
      window.scrollTo(0, startY + (this.startScroll - startY) * k);
      if (k < 1) next();
      else this.cleanup(again);
    };
    // sekme arka plandaysa rAF durur; geri sarma yine de bitsin
    const next = () => (document.hidden ? setTimeout(() => step(performance.now()), 50) : requestAnimationFrame(step));
    next();
  }

  cleanup(again) {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.unbind();
    this.targets.forEach((tg) => { tg.el.style.visibility = tg.prevVis; tg.el.classList.remove('g-glitched'); });
    this.root.remove();
    document.documentElement.style.scrollBehavior = this.prevSB;
    G = null;
    API.fx?.thaw?.();
    if (again) setTimeout(() => startGame(), 60);
  }
}
