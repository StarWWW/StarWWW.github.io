// SES EFEKTLERİ — hepsi Web Audio ile o an sentezlenir: dosya yok, indirme yok, 8-bit/çiptün tadında
// (kare, üçgen, sinüs dalga + filtreli gürültü). Üst bardaki hoparlör düğmesi ya da terminalde `ses` ile açılıp kapanır;
// tercih çerez izniyle saklanır (izin yoksa sadece bu ziyarette). Müzikten bağımsız kendi ses düzeyi var.
//
// Kullanım: API.sfx.play('click') · API.sfx.loop('spray') → { stop() } · <button data-sfx="toggle"> (data-sfx="none" = sessiz)
import { API, store } from './util.js';

const KEY = 'star.sfx';
const VOL = 0.3;
let enabled = store.get(KEY, true) !== false;
let ctx = null; let out = null; let noiseBuf = null;

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch { return null; }
    out = ctx.createGain();
    out.gain.value = VOL;
    // kare dalgaların sert tepeleri kulak tırmalamasın + aynı anda çok ses binerse patlamasın
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7500;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 6; comp.attack.value = 0.002; comp.release.value = 0.12;
    out.connect(lp).connect(comp).connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}
// tarayıcılar sesi ilk dokunuştan önce başlatmaz: ilk etkileşimde hazırla
['pointerdown', 'keydown', 'touchend'].forEach((ev) => window.addEventListener(ev, () => { if (enabled) ensure(); }, { capture: true, passive: true }));

// ---------- yapı taşları ----------
// tek ton: f → f2 kayar; a = atak, d = süre; vib = titreşim (Hz sapması), vibHz = hızı
function tone({ type = 'square', f = 440, f2 = 0, at = 0, d = 0.08, v = 0.3, a = 0.004, vib = 0, vibHz = 6, pts = null, detune = 0 }) {
  const t0 = ctx.currentTime + at;
  const o = ctx.createOscillator();
  o.type = type; o.detune.value = detune;
  o.frequency.setValueAtTime(f, t0);
  if (pts) pts.forEach(([ft, fv]) => o.frequency.linearRampToValueAtTime(fv, t0 + ft));
  else if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + d);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(v, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  if (vib) {
    const l = ctx.createOscillator(); const lg = ctx.createGain();
    l.frequency.value = vibHz; lg.gain.value = vib;
    l.connect(lg).connect(o.frequency);
    l.start(t0); l.stop(t0 + d + 0.05);
  }
  o.connect(g).connect(out);
  o.start(t0); o.stop(t0 + d + 0.05);
}
// filtreli gürültü: tıkırtı, fısıltı, patlama, rüzgâr
function hiss({ at = 0, d = 0.1, v = 0.3, type = 'bandpass', f = 3000, f2 = 0, q = 1, a = 0.003 }) {
  const t0 = ctx.currentTime + at;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  s.playbackRate.value = 0.8 + Math.random() * 0.4;
  const fl = ctx.createBiquadFilter();
  fl.type = type; fl.Q.value = q;
  fl.frequency.setValueAtTime(f, t0);
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t0 + d);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(v, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  s.connect(fl).connect(g).connect(out);
  s.start(t0, Math.random() * 0.5); s.stop(t0 + d + 0.05);
}
const arp = (notes, { type = 'square', step = 0.06, d = 0.09, v = 0.16, at = 0 } = {}) => notes.forEach((f, i) => tone({ type, f, at: at + i * step, d, v }));
const jitter = (f, p = 0.04) => f * (1 + (Math.random() * 2 - 1) * p);

// ---------- sesler ----------
const SOUNDS = {
  // arayüz
  click: () => { tone({ type: 'square', f: jitter(880, 0.02), f2: 620, d: 0.045, v: 0.14 }); tone({ type: 'triangle', f: 440, d: 0.05, v: 0.22 }); },
  hover: () => tone({ type: 'triangle', f: jitter(1760, 0.03), d: 0.028, v: 0.06 }),
  toggleOn: () => { tone({ type: 'square', f: 660, d: 0.05, v: 0.13 }); tone({ type: 'square', f: 990, at: 0.055, d: 0.08, v: 0.13 }); },
  toggleOff: () => { tone({ type: 'square', f: 990, d: 0.05, v: 0.13 }); tone({ type: 'square', f: 660, at: 0.055, d: 0.08, v: 0.13 }); },
  select: () => { tone({ type: 'square', f: 784, d: 0.04, v: 0.13 }); tone({ type: 'square', f: 1175, at: 0.04, d: 0.07, v: 0.12 }); },
  open: () => { tone({ type: 'square', f: 220, f2: 880, d: 0.12, v: 0.1 }); hiss({ f: 1200, f2: 4200, d: 0.12, v: 0.1, q: 0.8 }); },
  close: () => { tone({ type: 'square', f: 880, f2: 220, d: 0.12, v: 0.1 }); hiss({ f: 4200, f2: 1200, d: 0.12, v: 0.08, q: 0.8 }); },
  slide: () => hiss({ f: 1800, f2: 3200, d: 0.08, v: 0.14, q: 1.4 }),
  toast: () => { tone({ type: 'triangle', f: 988, d: 0.08, v: 0.16 }); tone({ type: 'triangle', f: 1318, at: 0.05, d: 0.1, v: 0.12 }); },
  copy: () => { tone({ type: 'square', f: 1318, d: 0.05, v: 0.12 }); tone({ type: 'square', f: 1760, at: 0.06, d: 0.09, v: 0.12 }); },
  success: () => arp([523, 659, 784, 1046], { step: 0.055, d: 0.09, v: 0.13 }),
  error: () => { tone({ type: 'square', f: 196, d: 0.14, v: 0.14 }); tone({ type: 'square', f: 185, d: 0.14, v: 0.14 }); tone({ type: 'square', f: 147, at: 0.16, d: 0.18, v: 0.14 }); },
  whoosh: () => hiss({ f: 400, f2: 3500, d: 0.3, v: 0.3, q: 0.8, a: 0.08 }),
  whooshUp: () => { hiss({ f: 600, f2: 5200, d: 0.35, v: 0.25, q: 0.9, a: 0.06 }); tone({ type: 'sine', f: 300, f2: 1300, d: 0.35, v: 0.08 }); },
  // terminal
  type: () => { hiss({ type: 'highpass', f: 2600, d: 0.018, v: 0.22 }); tone({ type: 'square', f: jitter(1600, 0.1), d: 0.012, v: 0.04 }); },
  enter: () => { tone({ type: 'square', f: 1318, d: 0.05, v: 0.12 }); tone({ type: 'square', f: 1760, at: 0.05, d: 0.08, v: 0.1 }); },
  // mod: hap yutma (DRUG) / ayılma (REAL)
  pillDrug: () => {
    hiss({ type: 'lowpass', f: 900, d: 0.06, v: 0.3 });                       // yutkunma
    tone({ type: 'sine', f: 880, f2: 110, at: 0.05, d: 0.75, v: 0.22, vib: 40, vibHz: 9 });
    tone({ type: 'triangle', f: 440, f2: 55, at: 0.05, d: 0.8, v: 0.12, vib: 20, vibHz: 5 });
    hiss({ f: 300, f2: 4000, at: 0.1, d: 0.6, v: 0.12, q: 2 });
  },
  pillReal: () => { tone({ type: 'triangle', f: 220, f2: 880, d: 0.22, v: 0.2 }); tone({ type: 'square', f: 1318, at: 0.2, d: 0.09, v: 0.1 }); },
  // oyun rafı
  caseOpen: () => {
    hiss({ f: 1600, q: 2.5, d: 0.035, v: 0.45 });                              // plastik klak
    tone({ type: 'triangle', f: 190, f2: 120, d: 0.07, v: 0.28 });
    tone({ type: 'sine', f: 280, f2: 900, at: 0.18, d: 0.55, v: 0.05, vib: 12, vibHz: 30 }); // disk dönüyor
  },
  caseClose: () => { hiss({ f: 1300, q: 2.5, d: 0.035, v: 0.45 }); tone({ type: 'triangle', f: 160, f2: 90, d: 0.08, v: 0.28 }); },
  flip: () => hiss({ f: 700, f2: 2600, d: 0.22, v: 0.25, q: 1, a: 0.05 }),
  // duvar
  shake: () => [0, 0.07, 0.14].forEach((at) => { hiss({ f: 3800, q: 6, at, d: 0.03, v: 0.35 }); tone({ type: 'square', f: jitter(2400, 0.1), at, d: 0.015, v: 0.05 }); }),
  // footer odası
  lamp: () => { hiss({ type: 'highpass', f: 3000, d: 0.015, v: 0.35 }); tone({ type: 'square', f: 2200, d: 0.012, v: 0.06 }); },
  beep: () => { tone({ type: 'square', f: 1000, d: 0.08, v: 0.11 }); tone({ type: 'square', f: 1500, at: 0.1, d: 0.06, v: 0.1 }); },
  meow: () => {
    tone({ type: 'square', f: 600, d: 0.42, v: 0.1, pts: [[0.13, 980], [0.42, 470]], vib: 18, vibHz: 9 });
    tone({ type: 'triangle', f: 1200, d: 0.4, v: 0.06, pts: [[0.13, 1960], [0.4, 940]] });
  },
  meowBig: () => { SOUNDS.meow(); tone({ type: 'square', f: 700, at: 0.45, d: 0.55, v: 0.1, pts: [[0.6, 1300], [1.0, 520]], vib: 30, vibHz: 11 }); arp([1568, 2093, 2637, 3136, 2637, 3136], { type: 'triangle', step: 0.07, d: 0.1, v: 0.07, at: 0.5 }); },
  creak: () => { tone({ type: 'sawtooth', f: 95, f2: 170, d: 0.5, v: 0.06, vib: 30, vibHz: 23 }); },
  twinkle: () => arp([1568, 2093, 2637, 3136], { type: 'triangle', step: 0.05, d: 0.12, v: 0.09 }),
  ufo: () => { tone({ type: 'sine', f: 520, d: 1.1, v: 0.12, vib: 180, vibHz: 7 }); tone({ type: 'square', f: 260, d: 1.1, v: 0.025, vib: 90, vibHz: 7 }); },
  bye: () => arp([784, 659, 523], { type: 'square', step: 0.08, d: 0.1, v: 0.1 }),
  // DRUG sırları
  secret: () => {
    arp([784, 988, 1175, 1568, 1976], { type: 'square', step: 0.05, d: 0.1, v: 0.11 });
    arp([784, 988, 1175, 1568, 1976], { type: 'triangle', step: 0.05, d: 0.14, v: 0.07, at: 0.16 }); // yankı
  },
  bigSecret: () => { SOUNDS.secret(); arp([523, 659, 784, 1046, 1318, 1568, 2093], { type: 'square', step: 0.07, d: 0.16, v: 0.1, at: 0.35 }); },
  splat: () => { hiss({ type: 'lowpass', f: 1800, f2: 280, d: 0.2, v: 0.5 }); tone({ type: 'square', f: 300, f2: 60, d: 0.12, v: 0.12 }); },
  thud: () => { tone({ type: 'sine', f: 140, f2: 38, d: 0.32, v: 0.55 }); hiss({ type: 'lowpass', f: 500, d: 0.16, v: 0.4 }); },
  glitch: () => { for (let i = 0; i < 7; i++) tone({ type: Math.random() < 0.5 ? 'square' : 'sawtooth', f: 150 + Math.random() * 1800, at: i * 0.035, d: 0.03, v: 0.06 }); },
  rain: () => { for (let i = 0; i < 14; i++) tone({ type: 'square', f: 900 + Math.random() * 1400, at: i * 0.045, d: 0.025, v: 0.035 }); },
  melt: () => { tone({ type: 'sine', f: 220, f2: 50, d: 2.8, v: 0.14, vib: 7, vibHz: 3 }); tone({ type: 'triangle', f: 330, f2: 70, d: 2.6, v: 0.06, vib: 9, vibHz: 2 }); },
  reform: () => { tone({ type: 'sine', f: 80, f2: 520, d: 0.45, v: 0.12 }); hiss({ f: 300, f2: 3200, d: 0.4, v: 0.15, q: 1 }); },
  eyes: () => { tone({ type: 'sine', f: 330, d: 0.9, v: 0.09, vib: 4, vibHz: 5 }); tone({ type: 'sine', f: 349, d: 0.9, v: 0.08 }); hiss({ f: 6000, d: 0.5, v: 0.05, q: 3 }); },
  invert: () => { tone({ type: 'square', f: 440, d: 0.05, v: 0.12 }); tone({ type: 'square', f: 220, at: 0.05, d: 0.08, v: 0.12 }); },
  acid: () => { tone({ type: 'sawtooth', f: 110, d: 1.2, v: 0.06, vib: 60, vibHz: 4 }); tone({ type: 'square', f: 165, d: 1.2, v: 0.04, vib: 80, vibHz: 6 }); },
  // sayfayı yok et
  shoot: () => { hiss({ f: 2400, f2: 900, d: 0.07, v: 0.18, q: 1.2 }); tone({ type: 'square', f: jitter(700, 0.08), f2: 380, d: 0.05, v: 0.05 }); },
  lob: () => tone({ type: 'square', f: 520, f2: 260, d: 0.12, v: 0.08 }),
  swing: () => hiss({ f: 500, f2: 1600, d: 0.12, v: 0.25, q: 1, a: 0.02 }),
  hit: () => { hiss({ type: 'lowpass', f: 1400, d: 0.07, v: 0.4 }); tone({ type: 'square', f: jitter(160, 0.1), f2: 70, d: 0.08, v: 0.14 }); },
  break: () => { hiss({ f: 2200, f2: 500, d: 0.22, v: 0.45, q: 0.7 }); tone({ type: 'square', f: jitter(320, 0.15), f2: 60, d: 0.16, v: 0.12 }); },
  boom: () => { hiss({ type: 'lowpass', f: 2200, f2: 120, d: 0.55, v: 0.7, a: 0.002 }); tone({ type: 'sine', f: 120, f2: 30, d: 0.5, v: 0.45 }); },
  dash: () => hiss({ f: 900, f2: 3600, d: 0.14, v: 0.22, q: 1.2, a: 0.01 }),
  hurt: () => { tone({ type: 'square', f: 300, f2: 90, d: 0.2, v: 0.16 }); hiss({ type: 'lowpass', f: 900, d: 0.12, v: 0.3 }); },
  rankUp: () => arp([659, 880, 1175], { type: 'square', step: 0.045, d: 0.08, v: 0.11 }),
  achievement: () => arp([1046, 1318, 1568, 2093], { type: 'triangle', step: 0.06, d: 0.14, v: 0.12 }),
  bossDown: () => { SOUNDS.boom(); arp([392, 523, 659, 784, 1046, 1318], { type: 'square', step: 0.09, d: 0.16, v: 0.1, at: 0.4 }); },
  rewind: () => { tone({ type: 'sawtooth', f: 900, f2: 120, d: 0.9, v: 0.07, vib: 40, vibHz: 18 }); hiss({ f: 5000, f2: 800, d: 0.9, v: 0.12, q: 1 }); },
};

// aynı ses art arda çok sık gelirse (yağmur gibi çoğalmasın) atla
const lastAt = new Map();
const GAP = { hover: 45, type: 25, hit: 40, break: 35, shoot: 40, click: 30 };
function play(name) {
  if (!enabled || document.hidden) return;
  const fn = SOUNDS[name];
  if (!fn || !ensure()) return;
  const now = performance.now();
  if (now - (lastAt.get(name) || 0) < (GAP[name] ?? 20)) return;
  lastAt.set(name, now);
  try { fn(); } catch (err) { console.warn('[sfx]', name, err); }
}

// sürekli sesler (sprey): { stop() } döner
function loop(name) {
  if (!enabled || document.hidden || !ensure()) return { stop() {}, set() {} };
  if (name !== 'spray') return { stop() {}, set() {} };
  const t0 = ctx.currentTime;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 5200; bp.Q.value = 0.6;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1600;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.16, t0 + 0.05);
  s.connect(bp).connect(hp).connect(g).connect(out);
  s.start(t0);
  let done = false;
  return {
    // hızlı hareket = daha yüksek, parlak fısıltı
    set(speed = 0) { if (done) return; const k = Math.min(1, speed); g.gain.setTargetAtTime(0.1 + k * 0.12, ctx.currentTime, 0.05); bp.frequency.setTargetAtTime(4200 + k * 2600, ctx.currentTime, 0.05); },
    stop() { if (done) return; done = true; const t = ctx.currentTime; g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(0.0001, t, 0.04); s.stop(t + 0.3); },
  };
}

// ---------- aç / kapa ----------
const listeners = new Set();
function setEnabled(on) {
  on = Boolean(on);
  if (!on && enabled) play('toggleOff'); // kapanırken son bir ses
  enabled = on;
  store.set(KEY, enabled);
  if (enabled) play('toggleOn');
  listeners.forEach((fn) => fn(enabled));
}

// hoparlör simgesi (piksel)
const ICON = `<svg viewBox="0 0 14 12" width="21" height="18" shape-rendering="crispEdges" aria-hidden="true">
  <path d="M1 4h3v4H1zM4 3h1v6H4zM5 2h1v8H5zM6 1h1v10H6z" fill="currentColor"/>
  <g class="sfx-w"><path d="M9 4h1v4H9zM11 2h1v8h-1zM10 3h1v1h-1zM10 8h1v1h-1zM12 1h1v1h-1zM12 10h1v1h-1z" fill="currentColor"/></g>
  <g class="sfx-x"><path d="M9 3h1v1H9zM10 4h1v1h-1zM11 5h1v2h-1zM12 4h1v1h-1zM13 3h1v1h-1zM10 7h1v1h-1zM9 8h1v1H9zM12 7h1v1h-1zM13 8h1v1h-1z" fill="currentColor"/></g>
</svg>`;

export function initSfx({ label = () => '' } = {}) {
  // genel tıklama sesi: düğme ve bağlantılar (özel sesi olanlar data-sfx ile kendi sesini seçer, "none" = sessiz)
  document.addEventListener('click', (e) => {
    const el = e.target.closest?.('[data-sfx], button, a[href], [role="tab"], [role="button"], summary, label[for], input[type="checkbox"], input[type="radio"]');
    if (!el || el.disabled) return;
    const name = el.dataset.sfx || 'click';
    if (name !== 'none') play(name);
  }, true);
  // üzerine gelince hafif tık (sadece fareyle, sadece belirgin öğelerde)
  let lastHover = null;
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse') return;
    const el = e.target.closest?.('.nav a, .btn, .pill, .lang button, .sfx-btn, .contact, .case, .item, .foot-nav a, .mm-ctrl button, .mm-grip, .lib-play, .chip, .inv2-sort button, .sec-link');
    if (!el || el === lastHover) return;
    lastHover = el;
    play('hover');
  });
  document.addEventListener('pointerout', (e) => { if (lastHover && !lastHover.contains(e.relatedTarget)) lastHover = null; });

  // üst bardaki düğme
  const btn = document.getElementById('sfxToggle');
  if (btn) {
    btn.innerHTML = ICON;
    const paint = () => {
      btn.setAttribute('aria-pressed', String(enabled));
      btn.setAttribute('aria-label', label(enabled));
      btn.title = label(enabled);
    };
    paint();
    listeners.add(paint);
    btn.addEventListener('click', () => setEnabled(!enabled));
    API.sfxPaint = paint;
  }

  API.sfx = {
    play,
    loop,
    enabled: () => enabled,
    set: setEnabled,
    toggle: () => setEnabled(!enabled),
    list: () => Object.keys(SOUNDS),
  };
}
