// FOOTER SAHNESİ — star'ın odası, gece. Her şey canvas'a piksel piksel çizilir (1 sahne pikseli = S ekran pikseli),
// böylece hiçbir ekran genişliğinde esneyip bozulmaz: oda ortada sabit durur, duvar iki yana uzar.
// Tıklanabilir: lamba (ışık), monitör (terminal), hoparlör (müzik), pencere (kayan yıldız), kedi, karakter, EXIT kapısı (başa dön).
import { API, reducedMotion, mulberry32 } from '../util.js';
import { spriteCanvas } from '../sprites.js';

const H = 72;      // sahne yüksekliği (sahne pikseli)
const FLOOR = 58;  // zeminin başladığı satır
const FPS = 8;     // piksel sanat hissi için düşük kare hızı

// 3x5 piksel yazı
const FONT = {
  A: ['111', '101', '111', '101', '101'], B: ['110', '101', '110', '101', '110'], C: ['111', '100', '100', '100', '111'],
  E: ['111', '100', '110', '100', '111'], G: ['111', '100', '101', '101', '111'], I: ['111', '010', '010', '010', '111'],
  M: ['101', '111', '111', '101', '101'], O: ['111', '101', '101', '101', '111'], P: ['111', '101', '111', '100', '100'],
  S: ['111', '100', '111', '001', '111'], T: ['111', '010', '010', '010', '010'], U: ['101', '101', '101', '101', '111'],
  V: ['101', '101', '101', '101', '010'], X: ['101', '101', '010', '101', '101'], Y: ['101', '101', '010', '010', '010'],
  Z: ['111', '001', '010', '100', '111'], '!': ['010', '010', '010', '000', '010'], ' ': ['000', '000', '000', '000', '000'],
};

const PALETTES = {
  real: {
    wall: '#29273f', wall2: '#2e2c47', ceil: '#1c1a2d', base: '#17152a', floor: '#5a3528', floor2: '#4d2d22', seam: '#2e1a14',
    frame: '#847E87', frameD: '#5b5664', sky: '#151431', sky2: '#24225a', moon: '#F2EEE3', moonD: '#CBDBFC', star: '#FFFFFF', city: '#100f22', cityW: '#FBF236',
    curtain: '#AC3232', curtainD: '#7a2730', desk: '#8F563B', deskD: '#663931', crt: '#9BADB7', crtD: '#6b7882', screen: '#0b0a12', text: '#99E550',
    lamp: '#DF7126', lampD: '#9a4d1b', bulb: '#FBF236', light: '255,200,96', warm: ['rgb(74,48,12)', 'rgb(42,27,6)', 'rgb(20,13,3)'], door: '#663931', doorD: '#4a2a22', knob: '#FBF236', exit: '#99E550', exitBg: '#10300f',
    rug: '#3F3F74', rug2: '#5a5aa8', cat: '#9BADB7', catD: '#5f6c75', poster: '#AC3232', paper: '#F2EEE3', ink: '#222034', mug: '#F2EEE3', speaker: '#3F3F74',
    plant: '#6ABE30', plantD: '#4B692F', pot: '#DF7126', tag: '#D77BBA', glow: '95,205,228', night: '8,6,20',
    bulbs: ['#99E550', '#D77BBA', '#5FCDE4', '#FBF236', '#DF7126'],
  },
  drug: {
    wall: '#07060d', wall2: '#0c1909', ceil: '#000000', base: '#000000', floor: '#0d0b16', floor2: '#120f1f', seam: '#1d3a12',
    frame: '#99E550', frameD: '#4B692F', sky: '#000000', sky2: '#0c1a08', moon: '#D77BBA', moonD: '#76428A', star: '#5FCDE4', city: '#05040a', cityW: '#99E550',
    curtain: '#5FCDE4', curtainD: '#2c6f80', desk: '#3F3F74', deskD: '#222034', crt: '#5FCDE4', crtD: '#2c6f80', screen: '#000000', text: '#D77BBA',
    lamp: '#99E550', lampD: '#4B692F', bulb: '#D77BBA', light: '215,123,186', warm: ['rgb(64,22,48)', 'rgb(36,12,28)', 'rgb(18,6,14)'], door: '#222034', doorD: '#0b0a12', knob: '#99E550', exit: '#FF2A2A', exitBg: '#2a0505',
    rug: '#76428A', rug2: '#D77BBA', cat: '#99E550', catD: '#4B692F', poster: '#5FCDE4', paper: '#000000', ink: '#99E550', mug: '#D77BBA', speaker: '#76428A',
    plant: '#D77BBA', plantD: '#76428A', pot: '#5FCDE4', tag: '#99E550', glow: '153,229,80', night: '0,0,0',
    bulbs: ['#99E550', '#D77BBA', '#5FCDE4', '#FF2A2A', '#FBF236'],
  },
};
const GAME_FALLBACK = ['#AC3232', '#DF7126', '#5FCDE4', '#FBF236', '#D77BBA', '#6ABE30', '#639BFF'];

export function initRoom(canvas) {
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  const wrap = canvas.parentElement;
  let W = 200; let S = 3; let L = null;
  let frame = 0; let timer = 0; let running = false;
  let lampOn = true;
  let lastPointer = Date.now();
  const bubbles = [];          // { who, text, until }
  const particles = [];        // nota / buhar / z
  let shooting = null;         // kayan yıldız
  let lines = [];              // monitördeki kod satırları
  const rnd = mulberry32(7);
  const hot = [];              // tıklanabilir alanlar

  const P = () => PALETTES[document.documentElement.dataset.mode === 'drug' ? 'drug' : 'real'];
  const rect = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, w | 0, h | 0); };
  const px = (x, y, c) => rect(x, y, 1, 1, c);
  const textW = (s) => s.length * 4 - 1;
  function text(s, x, y, c) {
    [...s].forEach((ch, i) => {
      const g = FONT[ch] || FONT[' '];
      g.forEach((row, yy) => [...row].forEach((b, xx) => { if (b === '1') px(x + i * 4 + xx, y + yy, c); }));
    });
  }

  // ---------- yerleşim ----------
  function layout() {
    const compact = W < 214;
    const blocks = compact ? ['win', 'desk', 'char', 'door'] : ['win', 'shelf', 'desk', 'char', 'door'];
    const widths = { win: 44, shelf: 36, desk: 64, char: 18, door: 24 };
    const gap = 6;
    const total = blocks.reduce((a, b) => a + widths[b], 0) + gap * (blocks.length - 1);
    let x = Math.floor((W - total) / 2);
    const out = { compact, start: x };
    blocks.forEach((b) => { out[b] = x; x += widths[b] + gap; });
    out.end = x - gap;
    // pencere içindeki yıldızlar ve şehir: her yerleşimde aynı kalsın
    const r = mulberry32(42);
    out.stars = Array.from({ length: 9 }, () => [7 + Math.floor(r() * 28), 12 + Math.floor(r() * 13), Math.floor(r() * 30)]).filter(([sx, sy]) => !(sx > 22 && sy < 21));
    out.city = [];
    for (let cx = 7; cx < 37;) { const w = 3 + Math.floor(r() * 4); out.city.push([cx, 29 + Math.floor(r() * 4), w]); cx += w; }
    out.seams = Array.from({ length: Math.ceil(W / 9) + 2 }, () => Math.floor(r() * 9));
    L = out;
  }

  function resize() {
    const cw = wrap.clientWidth || 320;
    S = cw < 640 ? 2 : 3;
    W = Math.ceil(cw / S);
    canvas.width = W; canvas.height = H;
    canvas.style.width = `${W * S}px`;
    canvas.style.height = `${H * S}px`;
    layout();
    if (!lines.length) for (let i = 0; i < 5; i++) lines.push(3 + Math.floor(rnd() * 14));
    draw();
  }

  // ---------- parçalar ----------
  function drawWall(c) {
    rect(0, 0, W, FLOOR, c.wall);
    for (let x = 3; x < W; x += 6) rect(x, 2, 1, FLOOR - 4, c.wall2);
    rect(0, 0, W, 2, c.ceil);
    rect(0, FLOOR - 2, W, 2, c.base);
    // zemin: tahtalar
    rect(0, FLOOR, W, H - FLOOR, c.floor);
    for (let y = FLOOR + 4; y < H; y += 5) rect(0, y, W, 1, c.floor2);
    L.seams.forEach((o, i) => { const x = i * 9 + o; const row = i % 3; rect(x, FLOOR + row * 5, 1, 4, c.seam); });
  }

  function drawStringLights(c) {
    // duvarın üstünde, bütün genişlik boyunca sarkan yılbaşı ışıkları
    const span = 48;
    for (let x = 0; x < W; x++) {
      const y = 4 + Math.round(3 * Math.sin(Math.PI * ((x % span) / span)));
      px(x, y, c.ceil);
      if (x % 6 === 3) {
        const col = c.bulbs[Math.floor(x / 6) % c.bulbs.length];
        const on = ((frame >> 2) + Math.floor(x / 6)) % 4 !== 0;
        px(x, y + 1, on ? col : c.wall2);
        if (on) px(x, y + 2, col);
      }
    }
  }

  function drawExtras(c) {
    // geniş ekranda odanın iki yanı boş kalmasın
    if (L.start > 40) {
      const gx = L.start - 34;
      [...'BYE'].forEach((ch, i) => {
        const g = FONT[ch];
        g.forEach((row, yy) => [...row].forEach((b, xx) => { if (b === '1') rect(gx + i * 8 + xx * 2, 24 + yy * 2, 2, 2, c.tag); }));
      });
      [[gx + 1, 34, 4], [gx + 9, 34, 2], [gx + 18, 34, 5]].forEach(([x, y, l]) => rect(x, y, 1, l, c.tag));
      rect(L.start - 18, FLOOR - 9, 3, 4, c.frameD); px(L.start - 17, FLOOR - 8, c.ink);
    }
    if (W - L.end > 40) {
      const fx = L.end + 14;
      rect(fx, 18, 15, 15, c.paper); rect(fx + 1, 19, 13, 13, c.speaker);
      ctx.drawImage(spriteCanvas('star', 1), fx + 3, 21);
      rect(L.end + 8, 30, 2, 3, c.paper);
    }
  }

  function drawWindow(c) {
    const x = L.win;
    rect(x - 1, 8, 46, 1, c.frameD);
    rect(x + 5, 10, 34, 28, c.frame);
    rect(x + 7, 12, 30, 12, c.sky);
    rect(x + 7, 24, 30, 12, c.sky2);
    for (let i = 0; i < 30; i += 2) px(x + 7 + i + ((24 % 2) ? 1 : 0), 24, c.sky);
    // ay
    const mx = x + 29; const my = 16;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (dx * dx + dy * dy <= 10) px(mx + dx, my + dy, c.moon);
    px(mx - 1, my - 1, c.moonD); px(mx + 1, my + 1, c.moonD); px(mx + 2, my - 1, c.moonD);
    // yıldızlar (göz kırpar)
    L.stars.forEach(([sx, sy, ph]) => { if ((frame + ph) % 30 < 24) px(x + sx, sy, c.star); });
    // kayan yıldız
    if (shooting) {
      const t = shooting.t;
      for (let k = 0; k < 4; k++) px(x + 35 - t - k, 13 + Math.floor((t + k) / 2), k === 0 ? c.star : c.moonD);
      shooting.t += 2;
      if (shooting.t > 26) shooting = null;
    }
    // şehir silüeti
    L.city.forEach(([cx, top, w]) => {
      const ww = Math.min(w, 37 - cx);
      if (ww <= 0) return;
      rect(x + cx, top, ww, 36 - top, c.city);
      for (let yy = top + 1; yy < 35; yy += 2) for (let xx = 0; xx < ww - 1; xx += 2) if ((cx * 7 + yy * 3 + xx) % 5 === 0) px(x + cx + xx, yy, c.cityW);
    });
    // kasa çıtaları
    rect(x + 21, 12, 2, 24, c.frame);
    rect(x + 7, 23, 30, 1, c.frame);
    rect(x + 3, 38, 38, 2, c.frame);
    rect(x + 3, 40, 38, 1, c.frameD);
    // perdeler
    [[x, 0], [x + 39, 1]].forEach(([cx, side]) => {
      rect(cx, 9, 5, 32, c.curtain);
      rect(cx + (side ? 1 : 3), 9, 1, 32, c.curtainD);
      rect(cx + (side ? 3 : 1), 12, 1, 26, c.curtainD);
      rect(cx, 26, 5, 1, c.frameD);
    });
    hot.push({ id: 'window', x: x + 5, y: 10, w: 34, h: 28 });
  }

  function drawCat(c) {
    const x = L.win + 6; const y = FLOOR - 5;
    px(x + 2, y, c.catD); px(x + 6, y, c.catD);
    rect(x + 1, y + 1, 8, 1, c.cat);
    rect(x, y + 2, 10, 2, c.cat);
    rect(x + 1, y + 4, 8, 1, c.cat);
    px(x + 2, y + 2, c.catD); px(x + 3, y + 2, c.catD);
    const up = (frame >> 3) % 3 === 0;
    if (up) { px(x + 10, y + 3, c.catD); px(x + 11, y + 2, c.catD); px(x + 11, y + 1, c.catD); } else { px(x + 10, y + 4, c.catD); px(x + 11, y + 4, c.catD); px(x + 12, y + 3, c.catD); }
    hot.push({ id: 'cat', x: x - 1, y: y - 2, w: 14, h: 8 });
    if (!running) return;
    if (frame % 24 === 0) particles.push({ k: 'z', x: x + 4, y: y - 2, life: 16 });
  }

  function drawShelf(c) {
    if (L.shelf == null) return;
    const x = L.shelf;
    rect(x, 24, 36, 2, c.desk);
    rect(x + 3, 26, 1, 3, c.deskD); rect(x + 32, 26, 1, 3, c.deskD);
    const games = (API.games?.list?.() || []).map((g) => g.color).filter(Boolean);
    const cols = games.length ? games : GAME_FALLBACK;
    for (let i = 0; i < 7; i++) {
      const hgt = 9 + ((i * 5) % 4);
      rect(x + 2 + i * 4, 24 - hgt, 3, hgt, cols[i % cols.length]);
      px(x + 3 + i * 4, 24 - hgt + 2, c.paper);
    }
    // saksı + bitki
    rect(x + 30, 20, 4, 4, c.pot);
    px(x + 31, 16, c.plant); px(x + 32, 15, c.plant); px(x + 30, 17, c.plant); px(x + 33, 17, c.plantD);
    rect(x + 31, 17, 2, 3, c.plant); px(x + 29, 18, c.plantD); px(x + 34, 18, c.plant);
    // UltraTurk afişi
    rect(x + 7, 30, 22, 20, c.paper);
    rect(x + 8, 31, 20, 18, c.poster);
    ctx.drawImage(spriteCanvas('skull', 1), x + 13, 33);
    text('UT', x + 14, 43, c.paper);
  }

  function drawDesk(c) {
    const x = L.desk;
    // halı
    rect(x + 18, FLOOR + 3, (L.char + 20) - (x + 18), 4, c.rug);
    for (let i = x + 20; i < L.char + 18; i += 4) rect(i, FLOOR + 4, 2, 2, c.rug2);
    // masa
    rect(x, 40, 64, 2, c.desk);
    rect(x, 42, 64, 2, c.deskD);
    rect(x + 1, 44, 2, FLOOR - 44, c.deskD);
    rect(x + 61, 44, 2, FLOOR - 44, c.deskD);
    rect(x + 44, 44, 16, 7, c.deskD);
    rect(x + 45, 45, 14, 5, c.desk);
    px(x + 52, 47, c.knob);
    // hoparlör
    rect(x + 2, 33, 5, 7, c.speaker);
    px(x + 4, 35, c.crt); px(x + 3, 37, c.crt); px(x + 4, 37, c.crt); px(x + 5, 37, c.crt); px(x + 4, 38, c.crt);
    hot.push({ id: 'speaker', x: x + 1, y: 30, w: 8, h: 11 });
    // CRT monitör
    rect(x + 10, 20, 26, 18, c.crt);
    rect(x + 35, 21, 1, 17, c.crtD);
    rect(x + 10, 37, 26, 1, c.crtD);
    rect(x + 19, 38, 8, 2, c.crtD);
    px(x + 33, 35, frame % 16 < 12 ? c.exit : c.crtD);
    hot.push({ id: 'monitor', x: x + 10, y: 20, w: 26, h: 20 });
    // klavye
    rect(x + 12, 38, 22, 2, c.crtD);
    for (let i = 0; i < 20; i += 2) px(x + 13 + i, 38, c.crt);
    // kupa + buhar
    rect(x + 38, 36, 4, 4, c.mug);
    px(x + 42, 37, c.mug); px(x + 42, 38, c.mug);
    rect(x + 39, 36, 2, 1, c.deskD);
    if (running && frame % 5 === 0) particles.push({ k: 'steam', x: x + 39 + (frame % 2), y: 34, life: 7 });
    // lamba
    rect(x + 48, 38, 6, 2, c.lampD);
    px(x + 50, 37, c.lampD); px(x + 50, 36, c.lampD); px(x + 51, 35, c.lampD); px(x + 51, 34, c.lampD); px(x + 52, 33, c.lampD);
    rect(x + 51, 29, 7, 3, c.lamp);
    rect(x + 52, 28, 5, 1, c.lamp);
    px(x + 54, 32, lampOn ? c.bulb : c.lampD);
    hot.push({ id: 'lamp', x: x + 47, y: 26, w: 13, h: 15 });
    // müzik çalıyorsa notalar
    if (running && API.music?.isPlaying?.() && frame % 6 === 0) particles.push({ k: 'note', x: x + 4, y: 30, life: 14, col: c.bulbs[(frame / 6) % c.bulbs.length | 0] });
  }

  function drawScreen(c) {
    // ekran içeriği ışık kapalıyken de parlasın diye ayrı çizilir
    const x = L.desk;
    rect(x + 13, 23, 20, 11, c.screen);
    if (running && frame % 6 === 0) { lines.shift(); lines.push(2 + Math.floor(rnd() * 16)); }
    lines.forEach((w, i) => rect(x + 14, 24 + i * 2, Math.min(w, 18), 1, i === 0 ? c.exit : c.text));
    if ((frame >> 2) % 2 === 0) rect(x + 14 + Math.min(lines[lines.length - 1], 17) + 1, 32, 1, 1, c.paper);
  }

  function drawDoor(c) {
    const x = L.door;
    rect(x, 18, 24, FLOOR - 18, c.frameD);
    rect(x + 2, 20, 20, FLOOR - 20, c.door);
    rect(x + 5, 23, 14, 12, c.doorD);
    rect(x + 5, 38, 14, 15, c.doorD);
    rect(x + 6, 24, 12, 10, c.door);
    rect(x + 6, 39, 12, 13, c.door);
    px(x + 18, 37, c.knob); px(x + 19, 37, c.knob);
    hot.push({ id: 'door', x, y: 8, w: 24, h: FLOOR - 8 });
  }

  function drawExit(c) {
    const x = L.door;
    const flick = running && rnd() < 0.04;
    rect(x + 3, 10, 18, 7, c.exitBg);
    rect(x + 3, 10, 18, 1, c.exit); rect(x + 3, 16, 18, 1, c.exit); rect(x + 3, 10, 1, 7, c.exit); rect(x + 20, 10, 1, 7, c.exit);
    if (!flick) text('EXIT', x + 5, 11, c.exit);
    // kapı aralığından sızan ışık
    rect(x + 2, FLOOR - 1, 20, 1, `rgba(${c.glow},.55)`);
  }

  function drawChar(c) {
    const x = L.char + 1;
    const bob = running && (frame >> 2) % 2 === 0 ? -1 : 0;
    ctx.drawImage(spriteCanvas('jet', 1), x, FLOOR - 19 + bob);
    hot.push({ id: 'char', x: x - 1, y: FLOOR - 21, w: 18, h: 21 });
    const idle = Date.now() - lastPointer > 20000;
    if (!bubbles.some((b) => b.who === 'char') && running) {
      if (idle) bubbles.push({ who: 'char', text: 'ZZZ', until: frame + 24 });
      else if (frame % 72 === 8) bubbles.push({ who: 'char', text: 'BYE!', until: frame + 24 });
    }
  }

  function drawBubble(b, c) {
    const w = textW(b.text) + 4;
    let bx; let by;
    if (b.who === 'cat') { bx = L.win + 2; by = FLOOR - 16; } else { bx = L.char + 9 - Math.floor(w / 2); by = FLOOR - 32; }
    bx = Math.max(1, Math.min(W - w - 1, bx));
    rect(bx, by, w, 9, c.ink === '#99E550' ? '#000000' : '#F2EEE3');
    rect(bx, by, w, 1, c.ink); rect(bx, by + 8, w, 1, c.ink); rect(bx, by, 1, 9, c.ink); rect(bx + w - 1, by, 1, 9, c.ink);
    const tx = b.who === 'cat' ? bx + 5 : bx + Math.floor(w / 2);
    px(tx, by + 9, c.ink); px(tx + 1, by + 9, c.ink); px(tx, by + 10, c.ink);
    text(b.text, bx + 2, by + 2, c.ink === '#99E550' ? '#99E550' : '#222034');
  }

  function drawParticles(c) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      if (p.k === 'steam') { px(p.x + ((p.life % 3) - 1), p.y, `rgba(242,238,227,${0.12 * p.life})`); p.y -= 1; }
      if (p.k === 'note') { const col = p.col || c.text; px(p.x, p.y, col); px(p.x + 1, p.y, col); px(p.x + 1, p.y - 1, col); px(p.x + 1, p.y - 2, col); px(p.x + 2, p.y - 2, col); p.y -= 1; p.x += (p.life % 4 === 0 ? 1 : 0); }
      if (p.k === 'z') { if (p.life % 2) { px(p.x, p.y, c.paper); px(p.x + 1, p.y, c.paper); px(p.x, p.y + 1, c.paper); px(p.x + 1, p.y + 1, c.paper); } p.y -= 0.5; p.x += 0.3; }
      if (running) p.life -= 1;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function drawLight(c) {
    // gece karanlığı + lamba ışığı
    rect(0, 0, W, H, `rgba(${c.night},${lampOn ? 0.16 : 0.5})`);
    if (lampOn) {
      // sıcak ışık: renkler alttaki piksellere EKLENİR (lighter), böylece her şey sarı-turuncuya boyanır, gri kalmaz
      const bx = L.desk + 54; const by = 32;
      ctx.globalCompositeOperation = 'lighter';
      for (let dy = -10; dy <= 10; dy++) {
        for (let dx = -14; dx <= 14; dx++) {
          const d = Math.hypot(dx / 14, dy / 10);
          if (d >= 1) continue;
          const band = d < 0.4 ? 0 : d < 0.72 ? 1 : 2;
          if (d > 0.86 && (dx + dy) % 2) continue;
          px(bx + dx, by + dy, c.warm[band]);
        }
      }
      rect(bx - 1, by, 3, 1, c.warm[0]);
      rect(bx - 9, 40, 19, 1, c.warm[0]);
      rect(bx - 6, 41, 13, 1, c.warm[1]);
      rect(bx - 14, FLOOR, 29, 2, c.warm[2]);
      ctx.globalCompositeOperation = 'source-over';
    }
    // monitör ışıması
    rect(L.desk + 8, 18, 30, 24, `rgba(${c.glow},${lampOn ? 0.05 : 0.1})`);
  }

  // ---------- çizim ----------
  function draw() {
    if (!L) return;
    const c = P();
    hot.length = 0;
    ctx.clearRect(0, 0, W, H);
    drawWall(c);
    drawExtras(c);
    drawWindow(c);
    drawShelf(c);
    drawDoor(c);
    drawDesk(c);
    drawCat(c);
    drawChar(c);
    drawLight(c);
    // ışık kapalıyken de parlayanlar
    drawStringLights(c);
    drawScreen(c);
    drawExit(c);
    drawParticles(c);
    for (let i = bubbles.length - 1; i >= 0; i--) {
      if (bubbles[i].until < frame) { bubbles.splice(i, 1); continue; }
      drawBubble(bubbles[i], c);
    }
  }

  function tick() { frame += 1; draw(); }
  function start() {
    if (running) return;
    if (reducedMotion()) { draw(); return; }
    running = true;
    timer = setInterval(tick, 1000 / FPS);
  }
  function stop() { running = false; clearInterval(timer); timer = 0; draw(); }

  // ---------- etkileşim ----------
  const at = (e) => {
    const r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) * W) / r.width, ((e.clientY - r.top) * H) / r.height];
  };
  const hit = (x, y) => hot.find((h) => x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h);
  canvas.addEventListener('pointermove', (e) => {
    lastPointer = Date.now();
    const h = hit(...at(e));
    canvas.style.cursor = h ? 'pointer' : '';
    canvas.title = h ? ({ lamp: 'ışık', monitor: 'terminal', speaker: 'müzik', window: 'dilek tut', cat: 'kedi', char: 'star', door: 'EXIT → başa dön' }[h.id] || '') : '';
  });
  canvas.addEventListener('click', (e) => {
    lastPointer = Date.now();
    const h = hit(...at(e));
    if (!h) return;
    const say = (who, t) => { for (let i = bubbles.length - 1; i >= 0; i--) if (bubbles[i].who === who) bubbles.splice(i, 1); bubbles.push({ who, text: t, until: frame + 20 }); };
    if (h.id === 'lamp') lampOn = !lampOn;
    else if (h.id === 'monitor') API.terminal?.open?.();
    else if (h.id === 'speaker') API.music?.toggle?.();
    else if (h.id === 'window') shooting = { t: 0 };
    else if (h.id === 'cat') say('cat', 'MIYAV');
    else if (h.id === 'char') say('char', ['CYA!', 'GG!', 'BYE!'][Math.floor(Math.random() * 3)]);
    else if (h.id === 'door') { if (API.fx?.scrollTo) API.fx.scrollTo('#top'); else window.scrollTo({ top: 0 }); }
    draw();
    // animasyonlar kapalıyken (FX: AZ) baloncuk ve kayan yıldız kendiliğinden kaybolsun
    if (!running) setTimeout(() => { bubbles.length = 0; shooting = null; draw(); }, 2200);
  });

  new ResizeObserver(() => resize()).observe(wrap);
  new MutationObserver(() => draw()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-mode', 'data-motion'] });
  resize();
  return { start, stop, draw };
}
