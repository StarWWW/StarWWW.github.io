// SES EFEKTLERİ — dosya yok: her ses o an Web Audio ile katman katman sentezlenir.
//
// Motor
//   • her ses bir "voice": kendi seviyesi, stereo konumu (tıklanan şey ekranın neresindeyse oradan duyulur),
//     yankı (oda) ve bant yankısı (echo) payı vardır
//   • ortak hat: yankı + echo → tını düzeltme → (DRUG: koro + daha çok yankı) → kompresör → sınırlayıcı
//   • yapı taşları: zarflı osilatör (NES tipi darbe dalgası, unison, filtre zarfı, vibrato, tremolo, distorsiyon),
//     renkli gürültü (beyaz / pembe / kahverengi / kırık), FM çan, davul (kick), ünlü formantlı ses (kedi)
//   • melodik sesler aynı majör pentatonik gamdan → üst üste binince bile uyumlu; üzerine gelme sesleri gamda yürür
//   • her çalışta küçük perde/ses farkı (makineli tüfek gibi tekrar etmesin), aynı anda çok ses binerse hafifler atlanır
//
// Kullanım: API.sfx.play('click', { x }) · API.sfx.loop('spray') → { set(hız, x), stop() } · API.sfx.volume(0-10)
//           <button data-sfx="toggle"> (data-sfx="none" = sessiz)
import { API, store } from './util.js';

const KEY = 'star.sfx';
const VKEY = 'star.sfxVol';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const isDrug = () => document.documentElement.dataset.mode === 'drug';

let enabled = store.get(KEY, true) !== false;
let level = clamp(Number(store.get(VKEY, 7)) || 0, 0, 10);
let ctx = null; let bus = null;
const buf = {}; const waves = {}; const curves = {};
let active = 0;

// ---------- müzik: majör pentatonik (do re mi sol la) ----------
const PENTA = [0, 2, 4, 7, 9];
const C5 = 523.25;
const note = (deg, base = C5) => base * 2 ** ((Math.floor(deg / 5) * 12 + PENTA[((deg % 5) + 5) % 5]) / 12);
const semi = (f, n) => f * 2 ** (n / 12);

// ---------- hazırlık ----------
const volFor = (lv) => (lv / 10) ** 1.5 * 0.85;

function makeNoise() {
  const n = ctx.sampleRate * 2;
  const mk = () => ctx.createBuffer(1, n, ctx.sampleRate);
  const white = mk(); const pink = mk(); const brown = mk(); const crush = mk();
  const w = white.getChannelData(0); const p = pink.getChannelData(0); const b = brown.getChannelData(0); const c = crush.getChannelData(0);
  let b0 = 0; let b1 = 0; let b2 = 0; let b3 = 0; let b4 = 0; let b5 = 0; let b6 = 0; let br = 0; let hold = 0;
  for (let i = 0; i < n; i++) {
    const x = Math.random() * 2 - 1;
    w[i] = x;
    // pembe gürültü (Paul Kellet)
    b0 = 0.99886 * b0 + x * 0.0555179; b1 = 0.99332 * b1 + x * 0.0750759; b2 = 0.969 * b2 + x * 0.153852;
    b3 = 0.8665 * b3 + x * 0.3104856; b4 = 0.55 * b4 + x * 0.5329522; b5 = -0.7616 * b5 - x * 0.016898;
    p[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + x * 0.5362) * 0.11; b6 = x * 0.115926;
    // kahverengi (derin uğultu)
    br = (br + 0.02 * x) / 1.02; b[i] = br * 3.5;
    // kırık (bitcrush): örnek tutma, 8 seviye
    if (i % 14 === 0) hold = Math.round(x * 4) / 4;
    c[i] = hold;
  }
  Object.assign(buf, { white, pink, brown, crush });
}

// yankı: kararan kuyruklu, erken yansımalı stereo oda
function makeIR(sec, decay) {
  const rate = ctx.sampleRate; const len = Math.floor(rate * sec);
  const ir = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      lp += (0.6 - 0.5 * t) * ((Math.random() * 2 - 1) - lp);
      d[i] = i < rate * 0.011 ? 0 : lp * (1 - t) ** decay;
    }
    [0.013, 0.019, 0.029, 0.041, 0.057].forEach((s, j) => { const k = Math.floor((s + ch * 0.0027) * rate); if (k < len) d[k] += 0.7 / (j + 1.4); });
  }
  return ir;
}

// NES tipi darbe dalgası (görev oranı: .125 / .25 / .5)
function pulse(duty) {
  if (waves[duty]) return waves[duty];
  const N = 48; const re = new Float32Array(N); const im = new Float32Array(N);
  for (let n = 1; n < N; n++) { re[n] = Math.sin(2 * Math.PI * n * duty) / (Math.PI * n); im[n] = (1 - Math.cos(2 * Math.PI * n * duty)) / (Math.PI * n); }
  waves[duty] = ctx.createPeriodicWave(re, im);
  return waves[duty];
}

function driveCurve(k) {
  const key = Math.round(k * 10);
  if (curves[key]) return curves[key];
  const n = 1024; const c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(x * (1 + k * 6)) / Math.tanh(1 + k * 6); }
  curves[key] = c;
  return c;
}

function build() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  try { ctx = new AC({ latencyHint: 'interactive' }); } catch { return false; }
  makeNoise();
  const g = (v = 1) => { const n = ctx.createGain(); n.gain.value = v; return n; };
  const dry = g(); const sum = g();
  // oda yankısı
  const verbIn = g(); const verbBoost = g(1); const verb = ctx.createConvolver(); verb.buffer = makeIR(2.1, 2.8);
  const verbOut = g(0.85);
  verbIn.connect(verbBoost).connect(verb).connect(verbOut).connect(sum);
  // bant yankısı (karanlıklaşan tekrarlar)
  const echoIn = g(); const dl = ctx.createDelay(1); dl.delayTime.value = 0.21; const fb = g(0.36);
  const dlLp = ctx.createBiquadFilter(); dlLp.type = 'lowpass'; dlLp.frequency.value = 2800;
  const echoOut = g(0.55);
  echoIn.connect(dl); dl.connect(dlLp); dlLp.connect(fb); fb.connect(dl); dlLp.connect(echoOut); echoOut.connect(sum);
  dry.connect(sum);
  // tını: çok alçak uğultuyu ve kulak tırmalayan tizi biraz kes
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 32;
  const shelf = ctx.createBiquadFilter(); shelf.type = 'highshelf'; shelf.frequency.value = 8500; shelf.gain.value = -4;
  sum.connect(hp).connect(shelf);
  // DRUG: iki salınan gecikmeli koro
  const chorusMix = g(0);
  [[0.43, 0.012, -0.8], [0.31, 0.017, 0.8]].forEach(([hz, base, pan]) => {
    const d = ctx.createDelay(0.05); d.delayTime.value = base;
    const lfo = ctx.createOscillator(); lfo.frequency.value = hz; const lg = g(0.004);
    lfo.connect(lg).connect(d.delayTime); lfo.start();
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    shelf.connect(d).connect(p).connect(chorusMix);
  });
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -20; comp.knee.value = 8; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.18;
  const lim = ctx.createDynamicsCompressor();
  lim.threshold.value = -2.5; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.06;
  const master = g(volFor(level));
  shelf.connect(comp); chorusMix.connect(comp);
  comp.connect(lim).connect(master).connect(ctx.destination);
  bus = { dry, verbIn, echoIn, master, chorusMix, verbBoost };
  const applyMode = () => {
    const t = ctx.currentTime; const d = isDrug();
    chorusMix.gain.setTargetAtTime(d ? 0.6 : 0, t, 0.3);
    verbBoost.gain.setTargetAtTime(d ? 2 : 1, t, 0.3);
  };
  applyMode();
  new MutationObserver(applyMode).observe(document.documentElement, { attributes: true, attributeFilter: ['data-mode'] });
  return true;
}

function ensure() {
  if (!ctx && !build()) return null;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}
// tarayıcılar sesi ilk dokunuştan önce başlatmaz: ilk etkileşimde hazırla
['pointerdown', 'keydown', 'touchend'].forEach((ev) => window.addEventListener(ev, () => { if (enabled) ensure(); }, { capture: true, passive: true }));

// ---------- ses (voice) ----------
// pan: -1 sol … 1 sağ · wet: oda yankısı · echo: bant yankısı · dur: en uzun parçanın süresi (temizlik için)
function voice({ pan = 0, wet = 0.1, echo = 0, gain = 1, dur = 0.5 } = {}) {
  const t = ctx.currentTime + 0.005;
  const inp = ctx.createGain(); inp.gain.value = gain * rnd(0.88, 1);
  const p = ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1);
  inp.connect(p); p.connect(bus.dry);
  const extra = [];
  if (wet) { const s = ctx.createGain(); s.gain.value = wet; p.connect(s); s.connect(bus.verbIn); extra.push(s); }
  if (echo) { const s = ctx.createGain(); s.gain.value = echo; p.connect(s); s.connect(bus.echoIn); extra.push(s); }
  active++;
  setTimeout(() => { active--; try { inp.disconnect(); p.disconnect(); extra.forEach((n) => n.disconnect()); } catch { /* zaten bitti */ } }, (dur + 0.6) * 1000);
  // her çalışta küçük perde farkı (sent)
  return { t, in: inp, pan: p, hum: rnd(-14, 14), drug: isDrug() };
}

// genlik zarfı: a = atak, hold = tepe süresi, d = toplam süre (sonunda ~sessiz)
function env(param, t0, { a = 0.003, d = 0.2, peak = 0.3, hold = 0, curve = 'exp' }) {
  param.setValueAtTime(0.0001, t0);
  if (curve === 'lin') param.linearRampToValueAtTime(peak, t0 + a);
  else param.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + a);
  if (hold) param.setValueAtTime(peak, t0 + a + hold);
  param.exponentialRampToValueAtTime(0.0001, t0 + Math.max(a + hold + 0.005, d));
}

function freqPath(p, t0, { f, f2, glide, pts }) {
  p.setValueAtTime(f, t0);
  if (pts) pts.forEach(([ft, fv, lin]) => (lin === false ? p.exponentialRampToValueAtTime(fv, t0 + ft) : p.linearRampToValueAtTime(fv, t0 + ft)));
  else if (f2) p.exponentialRampToValueAtTime(Math.max(16, f2), t0 + glide);
}

function lfo(v, target, { rate = 6, depth = 10, at = 0, d = 1, type = 'sine' }) {
  const t0 = v.t + at;
  const l = ctx.createOscillator(); l.type = type; l.frequency.value = rate;
  const lg = ctx.createGain(); lg.gain.setValueAtTime(0, t0); lg.gain.linearRampToValueAtTime(depth, t0 + Math.min(0.15, d / 3));
  l.connect(lg).connect(target);
  l.start(t0); l.stop(t0 + d + 0.1);
}

function filt(t0, d, lp) {
  const fl = ctx.createBiquadFilter();
  fl.type = lp.type || 'lowpass'; fl.Q.value = lp.q ?? 0.8;
  fl.frequency.setValueAtTime(lp.f, t0);
  if (lp.pts) lp.pts.forEach(([ft, fv]) => fl.frequency.exponentialRampToValueAtTime(fv, t0 + ft));
  else if (lp.f2) fl.frequency.exponentialRampToValueAtTime(lp.f2, t0 + (lp.t ?? d));
  return fl;
}

function shaper(k) { const s = ctx.createWaveShaper(); s.curve = driveCurve(k); s.oversample = '2x'; return s; }

// zarflı osilatör
function osc(v, o) {
  const { type = 'sine', duty, f = 440, f2, glide, pts, at = 0, a = 0.003, d = 0.15, peak = 0.2, hold = 0, curve, detune = 0,
    uni = 1, spread = 14, vib, trem, lp, drive, wob = true, panTo } = o;
  const t0 = v.t + at;
  const amp = ctx.createGain();
  env(amp.gain, t0, { a, d, peak: peak / Math.sqrt(uni), hold, curve });
  let head = amp; // kaynakların bağlanacağı ilk düğüm
  if (drive) { const s = shaper(drive); s.connect(head); head = s; }
  if (lp) { const fl = filt(t0, d, lp); fl.connect(head); head = fl; }
  if (trem) { const tg = ctx.createGain(); tg.gain.value = 1 - trem.depth; lfo(v, tg.gain, { rate: trem.rate, depth: trem.depth, at, d }); tg.connect(head); head = tg; }
  let tail = amp;
  if (panTo != null) { const pp = ctx.createStereoPanner(); pp.pan.setValueAtTime(clamp(v.pan.pan.value, -1, 1), t0); pp.pan.linearRampToValueAtTime(clamp(panTo, -1, 1), t0 + d); amp.connect(pp); tail = pp; }
  tail.connect(v.in);
  for (let u = 0; u < uni; u++) {
    const s = ctx.createOscillator();
    if (duty) s.setPeriodicWave(pulse(duty)); else s.type = type;
    s.detune.value = detune + v.hum + (uni > 1 ? (u / (uni - 1) - 0.5) * spread * 2 : 0);
    freqPath(s.frequency, t0, { f, f2, glide: glide ?? d, pts });
    if (vib) lfo(v, s.frequency, { rate: vib.rate, depth: vib.depth, at: at + (vib.delay || 0), d });
    if (v.drug && wob) lfo(v, s.frequency, { rate: rnd(4, 7), depth: f * 0.018, at, d }); // DRUG: her şey hafif yalpalar
    s.connect(head);
    s.start(t0); s.stop(t0 + d + 0.05);
  }
}

// renkli gürültü, filtreli
function noise(v, o) {
  const { color = 'white', at = 0, a = 0.002, d = 0.1, peak = 0.3, hold = 0, type = 'bandpass', f = 2000, f2, ft, q = 1, rate = 1, drive, panTo, curve } = o;
  const t0 = v.t + at;
  const s = ctx.createBufferSource();
  s.buffer = buf[color] || buf.white;
  s.loop = true;
  s.playbackRate.value = rate * 2 ** (v.hum / 1200);
  const amp = ctx.createGain();
  env(amp.gain, t0, { a, d, peak, hold, curve });
  let node = s;
  if (type !== 'none') { const fl = filt(t0, d, { type, f, f2, q, t: ft }); node.connect(fl); node = fl; }
  if (drive) { const sh = shaper(drive); node.connect(sh); node = sh; }
  node.connect(amp);
  let tail = amp;
  if (panTo != null) { const pp = ctx.createStereoPanner(); pp.pan.setValueAtTime(clamp(v.pan.pan.value, -1, 1), t0); pp.pan.linearRampToValueAtTime(clamp(panTo, -1, 1), t0 + d); amp.connect(pp); tail = pp; }
  tail.connect(v.in);
  s.start(t0, Math.random() * 1.2);
  s.stop(t0 + d + 0.05);
}

// FM çan: oran = tını (3.5 cam, 4 marimba, 1.4 boru çan), indeks = parlaklık (zamanla söner)
function bell(v, { f = 880, at = 0, a = 0.002, d = 0.9, peak = 0.15, ratio = 3.5, index = 5, idxD = 0.3, pan }) {
  const t0 = v.t + at;
  const car = ctx.createOscillator(); const mod = ctx.createOscillator(); const mg = ctx.createGain(); const amp = ctx.createGain();
  car.frequency.value = f; mod.frequency.value = f * ratio;
  car.detune.value = v.hum; mod.detune.value = v.hum;
  mg.gain.setValueAtTime(index * f, t0); mg.gain.exponentialRampToValueAtTime(Math.max(1, index * f * 0.04), t0 + idxD);
  env(amp.gain, t0, { a, d, peak });
  mod.connect(mg).connect(car.frequency);
  if (v.drug) lfo(v, car.frequency, { rate: rnd(4, 6.5), depth: f * 0.02, at, d });
  let tail = amp;
  if (pan != null) { const pp = ctx.createStereoPanner(); pp.pan.value = clamp(pan, -1, 1); amp.connect(pp); tail = pp; }
  car.connect(amp); tail.connect(v.in);
  car.start(t0); mod.start(t0); car.stop(t0 + d + 0.05); mod.stop(t0 + d + 0.05);
}

// davul / darbe: perdesi hızla düşen sinüs + tık
function kick(v, { f = 150, f2 = 45, at = 0, d = 0.3, peak = 0.5, click = 0.25, drive = 0 }) {
  osc(v, { type: 'sine', f, f2, glide: d * 0.45, at, d, peak, drive, wob: false });
  if (click) noise(v, { at, d: 0.008, peak: click, type: 'highpass', f: 3000 });
}

// tel / pluck: testere + kare, hızla kapanan rezonanslı filtre
function pluck(v, { f = 440, at = 0, d = 0.35, peak = 0.14, bright = 5200, q = 5 }) {
  osc(v, { type: 'sawtooth', f, at, d, peak, a: 0.002, lp: { f: bright, f2: Math.max(f * 1.2, 300), t: d * 0.6, q } });
  osc(v, { duty: 0.25, f: f * 2, at, d: d * 0.5, peak: peak * 0.35, lp: { f: bright * 0.8, f2: f * 2, t: d * 0.4, q: 1 } });
}

// ünlü formantlı ses (kedi): kaynak + paralel bant geçiren filtreler, ünlüler zamanla değişir
function formant(v, { at = 0, d = 0.5, peak = 0.2, f0 = 520, pitch, vowels, breath = 0.03 }) {
  const t0 = v.t + at;
  const src = ctx.createOscillator(); src.type = 'sawtooth';
  freqPath(src.frequency, t0, { f: f0, pts: pitch });
  lfo(v, src.frequency, { rate: 7, depth: f0 * 0.025, at: at + 0.1, d });
  if (v.drug) lfo(v, src.frequency, { rate: 5, depth: f0 * 0.05, at, d });
  const amp = ctx.createGain();
  env(amp.gain, t0, { a: 0.04, hold: d * 0.45, d, peak });
  [[0, 1], [1, 0.55], [2, 0.25]].forEach(([k, gn]) => {
    const fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.Q.value = 9 - k * 2;
    vowels.forEach(([ft, F], i) => (i === 0 ? fl.frequency.setValueAtTime(F[k], t0) : fl.frequency.linearRampToValueAtTime(F[k], t0 + ft)));
    const g = ctx.createGain(); g.gain.value = gn * 3;
    src.connect(fl).connect(g).connect(amp);
  });
  amp.connect(v.in);
  src.start(t0); src.stop(t0 + d + 0.05);
  if (breath) noise(v, { color: 'pink', at, d, a: 0.05, peak: breath, type: 'bandpass', f: 3200, q: 0.8 });
}

// çok sayıda minik ses (parıltı, cam kırığı, damla)
function grains(n, span, fn) { for (let i = 0; i < n; i++) fn(i, Math.random() * span); }

// ---------- sesler ----------
const SOUNDS = {
  // ===== arayüz =====
  click(o) {
    const v = voice({ pan: o.pan, wet: 0.05, dur: 0.12 });
    noise(v, { type: 'highpass', f: 4800, d: 0.01, peak: 0.32 });                          // tık
    osc(v, { duty: 0.25, f: rnd(1180, 1320), f2: 760, glide: 0.028, d: 0.05, peak: 0.13, lp: { f: 5200, f2: 1500, q: 2 } }); // gövde
    osc(v, { type: 'sine', f: 200, f2: 105, d: 0.06, peak: 0.2, wob: false });             // tok alt
  },
  hover(o) {
    const v = voice({ pan: o.pan, wet: 0.2, dur: 0.25, gain: 0.9 });
    bell(v, { f: note(o.deg ?? 0, 1046.5), d: 0.2, peak: 0.055, ratio: 4, index: 2.4, idxD: 0.05 });
    noise(v, { type: 'highpass', f: 7500, d: 0.006, peak: 0.04 });
  },
  toggleOn(o) {
    const v = voice({ pan: o.pan, wet: 0.18, dur: 0.6 });
    noise(v, { type: 'highpass', f: 3200, d: 0.008, peak: 0.3 });
    noise(v, { type: 'bandpass', f: 1800, q: 3, at: 0.03, d: 0.012, peak: 0.22 });
    osc(v, { type: 'sine', f: 230, f2: 140, d: 0.07, peak: 0.16, wob: false });
    bell(v, { f: note(4), at: 0.02, d: 0.35, peak: 0.08, ratio: 4, index: 3, idxD: 0.06 });
    bell(v, { f: note(7), at: 0.085, d: 0.45, peak: 0.08, ratio: 4, index: 3, idxD: 0.06 });
  },
  toggleOff(o) {
    const v = voice({ pan: o.pan, wet: 0.15, dur: 0.6 });
    noise(v, { type: 'highpass', f: 2600, d: 0.008, peak: 0.26 });
    noise(v, { type: 'bandpass', f: 1300, q: 3, at: 0.03, d: 0.012, peak: 0.2 });
    bell(v, { f: note(7), at: 0.02, d: 0.3, peak: 0.07, ratio: 4, index: 2.5, idxD: 0.05 });
    bell(v, { f: note(2), at: 0.085, d: 0.4, peak: 0.07, ratio: 4, index: 2.5, idxD: 0.05 });
  },
  select(o) {
    const v = voice({ pan: o.pan, wet: 0.16, dur: 0.4 });
    const f = note(o.deg ?? 4);
    noise(v, { type: 'highpass', f: 4200, d: 0.008, peak: 0.22 });
    pluck(v, { f, d: 0.3, peak: 0.12, bright: 6200, q: 6 });
    bell(v, { f: f * 2, at: 0.02, d: 0.25, peak: 0.04, ratio: 4, index: 2 });
  },
  open(o) { // CRT açılıyor
    const v = voice({ pan: o.pan, wet: 0.22, dur: 0.7 });
    kick(v, { f: 95, f2: 42, d: 0.16, peak: 0.32, click: 0.15 });
    noise(v, { type: 'bandpass', f: 3200, q: 0.7, a: 0.004, hold: 0.06, d: 0.38, peak: 0.1 });   // parazit
    noise(v, { color: 'brown', type: 'lowpass', f: 500, d: 0.18, peak: 0.22 });
    osc(v, { duty: 0.5, f: 220, f2: 990, glide: 0.13, d: 0.16, peak: 0.06, lp: { f: 3600, q: 1 } });
    osc(v, { type: 'sine', f: 14200, f2: 15100, a: 0.05, d: 0.55, peak: 0.008, wob: false });     // tüp vızıltısı
  },
  close(o) { // CRT kapanıyor
    const v = voice({ pan: o.pan, wet: 0.2, dur: 0.5 });
    osc(v, { type: 'sine', f: 1900, f2: 55, glide: 0.22, d: 0.24, peak: 0.12 });
    osc(v, { duty: 0.125, f: 950, f2: 40, glide: 0.18, d: 0.2, peak: 0.04, lp: { f: 3000, f2: 300 } });
    noise(v, { type: 'highpass', f: 5000, d: 0.05, peak: 0.12 });
    kick(v, { f: 80, f2: 40, at: 0.14, d: 0.12, peak: 0.18, click: 0 });
  },
  slide(o) {
    const v = voice({ pan: o.pan, wet: 0.12, dur: 0.3 });
    noise(v, { color: 'pink', type: 'bandpass', f: 800, f2: 3400, q: 1.3, a: 0.035, d: 0.16, peak: 0.85, panTo: (o.pan || 0) + 0.4 });
    noise(v, { type: 'bandpass', f: 2400, q: 4, at: 0.14, d: 0.014, peak: 0.3 });
  },
  toast(o) {
    const v = voice({ pan: o.pan ?? 0.1, wet: 0.28, dur: 1 });
    bell(v, { f: note(2, 784), d: 0.55, peak: 0.1, ratio: 4, index: 3.2, idxD: 0.05 });
    bell(v, { f: note(4, 784), at: 0.075, d: 0.7, peak: 0.085, ratio: 4, index: 3.2, idxD: 0.05 });
  },
  copy(o) {
    const v = voice({ pan: o.pan, wet: 0.3, echo: 0.12, dur: 1.2 });
    bell(v, { f: note(7, 1046.5), d: 0.9, peak: 0.09, ratio: 3.5, index: 4.5 });
    bell(v, { f: note(9, 1046.5), at: 0.06, d: 1, peak: 0.08, ratio: 3.5, index: 4.5 });
    grains(4, 0.25, (i, at) => bell(v, { f: note(12 + i, 1046.5), at: 0.1 + at, d: 0.2, peak: 0.018, ratio: 5, index: 2, pan: rnd(-0.6, 0.6) }));
  },
  success(o) {
    const v = voice({ pan: o.pan, wet: 0.3, echo: 0.18, dur: 1.8 });
    [0, 2, 4, 5].forEach((dg, i) => pluck(v, { f: note(dg), at: i * 0.06, d: 0.35, peak: 0.1 }));
    [0, 2, 4].forEach((dg) => bell(v, { f: note(dg + 5), at: 0.26, d: 1.3, peak: 0.05, ratio: 3.5, index: 3 }));
  },
  error(o) {
    const v = voice({ pan: o.pan, wet: 0.1, dur: 0.6 });
    osc(v, { duty: 0.125, f: 233, d: 0.13, peak: 0.12, lp: { f: 2200 }, drive: 0.4 });
    osc(v, { duty: 0.125, f: 220, d: 0.13, peak: 0.12, lp: { f: 2200 } });
    osc(v, { duty: 0.125, f: 175, at: 0.15, d: 0.24, peak: 0.12, lp: { f: 1800 }, drive: 0.4 });
    osc(v, { duty: 0.125, f: 165, at: 0.15, d: 0.24, peak: 0.12, lp: { f: 1800 } });
    noise(v, { color: 'brown', type: 'lowpass', f: 600, d: 0.12, peak: 0.25 });
  },
  whoosh(o) {
    const p = o.pan || 0;
    const v = voice({ pan: p - 0.6, wet: 0.2, dur: 0.6 });
    noise(v, { color: 'pink', type: 'bandpass', f: 300, f2: 3400, q: 0.9, a: 0.1, d: 0.42, peak: 0.65, panTo: p + 0.6 });
    noise(v, { type: 'highpass', f: 6500, at: 0.1, a: 0.08, d: 0.26, peak: 0.05 });
  },
  whooshUp(o) {
    const v = voice({ pan: o.pan, wet: 0.25, echo: 0.1, dur: 0.9 });
    noise(v, { color: 'pink', type: 'bandpass', f: 450, f2: 6500, q: 1, a: 0.06, d: 0.42, peak: 0.55 });
    osc(v, { type: 'sine', f: 260, f2: 1400, d: 0.4, peak: 0.05 });
    bell(v, { f: note(9, 1568), at: 0.33, d: 0.55, peak: 0.05, ratio: 3.5, index: 3 });
  },

  // ===== terminal: mekanik klavye =====
  type(o) {
    const deep = o.k === 'deep';
    const v = voice({ pan: (o.pan || 0) + rnd(-0.12, 0.12), wet: 0.04, dur: 0.1 });
    noise(v, { type: 'highpass', f: rnd(3200, 4200), d: 0.007, peak: rnd(0.18, 0.28) });                        // tık
    noise(v, { type: 'bandpass', f: deep ? rnd(800, 1000) : rnd(1500, 2300), q: 3, a: 0.001, d: 0.03, peak: 0.2 }); // gövde
    osc(v, { type: 'sine', f: deep ? 170 : rnd(330, 430), f2: deep ? 110 : 210, d: 0.025, peak: deep ? 0.12 : 0.06, wob: false });
  },
  enter(o) {
    SOUNDS.type({ ...o, k: 'deep' });
    const v = voice({ pan: o.pan, wet: 0.2, dur: 0.4 });
    bell(v, { f: note(4, 1046.5), at: 0.03, d: 0.28, peak: 0.05, ratio: 4, index: 2.5 });
  },

  // ===== REAL ↔ DRUG =====
  pillDrug(o) {
    const v = voice({ pan: o.pan, wet: 0.45, echo: 0.25, dur: 2.2 });
    noise(v, { color: 'brown', type: 'lowpass', f: 520, d: 0.1, peak: 0.5 });                         // yutkunma
    osc(v, { type: 'sine', f: 250, f2: 120, d: 0.11, peak: 0.22, wob: false });
    osc(v, { type: 'sawtooth', f: 660, f2: 70, glide: 0.95, at: 0.08, d: 1.05, peak: 0.07, uni: 3, spread: 28, lp: { f: 4200, f2: 260, q: 9 }, vib: { rate: 7, depth: 22 } }); // gerçeklik eriyor
    osc(v, { type: 'sine', f: 880, f2: 55, glide: 1.1, at: 0.08, d: 1.15, peak: 0.12, vib: { rate: 9, depth: 40 } });
    noise(v, { type: 'bandpass', f: 1800, f2: 9000, q: 3, at: 0.15, a: 0.75, d: 0.92, peak: 0.13, curve: 'lin' }); // ters zil
    grains(8, 0.5, (i, at) => bell(v, { f: note(10 + ((Math.random() * 8) | 0)), at: 0.85 + at, d: 0.5, peak: 0.03, ratio: 3.5, index: 4, pan: rnd(-0.8, 0.8) }));
  },
  pillReal(o) {
    const v = voice({ pan: o.pan, wet: 0.25, dur: 1.1 });
    noise(v, { color: 'pink', type: 'bandpass', f: 3200, f2: 500, q: 1.2, a: 0.01, d: 0.22, peak: 0.25 });
    osc(v, { type: 'triangle', f: 220, f2: 880, d: 0.25, peak: 0.13 });
    noise(v, { type: 'highpass', f: 3500, at: 0.21, d: 0.008, peak: 0.3 });
    bell(v, { f: note(4, 1046.5), at: 0.21, d: 0.7, peak: 0.09, ratio: 3.5, index: 3 });
    bell(v, { f: note(7, 1046.5), at: 0.28, d: 0.8, peak: 0.08, ratio: 3.5, index: 3 });
  },

  // ===== oyun rafı: DVD kutusu =====
  caseOpen(o) {
    const v = voice({ pan: o.pan, wet: 0.15, dur: 1.3 });
    noise(v, { type: 'bandpass', f: 2700, q: 6, d: 0.022, peak: 0.5 });                    // mandal
    noise(v, { type: 'bandpass', f: 1350, q: 4, at: 0.006, d: 0.03, peak: 0.32 });
    osc(v, { type: 'triangle', f: 215, f2: 140, d: 0.07, peak: 0.2, wob: false });
    noise(v, { color: 'pink', type: 'bandpass', f: 850, f2: 1500, q: 9, at: 0.05, a: 0.02, d: 0.13, peak: 0.07 }); // menteşe
    osc(v, { type: 'sawtooth', f: 85, f2: 430, glide: 0.7, at: 0.17, a: 0.08, d: 0.95, peak: 0.03, lp: { f: 500, f2: 2400, q: 2 }, trem: { rate: 24, depth: 0.5 } }); // disk dönmeye başlar
    osc(v, { type: 'sine', f: 170, f2: 640, glide: 0.7, at: 0.17, a: 0.08, d: 0.95, peak: 0.028 });
  },
  caseClose(o) {
    const v = voice({ pan: o.pan, wet: 0.14, dur: 0.4 });
    noise(v, { type: 'bandpass', f: 2300, q: 5, d: 0.02, peak: 0.55 });
    noise(v, { type: 'bandpass', f: 1700, q: 5, at: 0.018, d: 0.02, peak: 0.36 });
    kick(v, { f: 165, f2: 70, d: 0.1, peak: 0.28, click: 0 });
    noise(v, { color: 'brown', type: 'lowpass', f: 650, d: 0.07, peak: 0.2 });
  },
  flip(o) {
    const v = voice({ pan: (o.pan || 0) - 0.3, wet: 0.14, dur: 0.4 });
    noise(v, { color: 'pink', type: 'bandpass', f: 600, f2: 2800, q: 0.8, a: 0.05, d: 0.24, peak: 0.5, panTo: (o.pan || 0) + 0.3 });
    noise(v, { type: 'bandpass', f: 2100, q: 4, at: 0.22, d: 0.015, peak: 0.32 });
  },

  // ===== duvar =====
  shake(o) { // sprey kutusundaki bilye
    const v = voice({ pan: o.pan, wet: 0.12, dur: 0.6 });
    [0, 0.032, 0.07, 0.1, 0.22, 0.252, 0.29, 0.32].forEach((at) => {
      noise(v, { type: 'bandpass', f: rnd(3800, 4800), q: 14, at, d: 0.03, peak: rnd(0.4, 0.62) });
      bell(v, { f: rnd(3000, 3500), at, d: 0.05, peak: 0.02, ratio: 1.41, index: 1.5, idxD: 0.02 });
    });
  },

  // ===== footer odası =====
  lamp(o) {
    const v = voice({ pan: o.pan, wet: 0.12, dur: 0.5 });
    noise(v, { type: 'highpass', f: 2600, d: 0.006, peak: 0.4 });
    noise(v, { type: 'bandpass', f: 1500, q: 3, at: 0.012, d: 0.02, peak: 0.25 });
    if (o.k === 'on') osc(v, { type: 'sawtooth', f: 120, at: 0.02, a: 0.03, d: 0.38, peak: 0.016, lp: { f: 420 } }); // ampul vızıltısı
  },
  beep(o) {
    const v = voice({ pan: o.pan, wet: 0.12, dur: 0.4 });
    kick(v, { f: 70, f2: 40, d: 0.1, peak: 0.15, click: 0.03 });
    osc(v, { duty: 0.5, f: 1000, at: 0.02, d: 0.08, peak: 0.08, lp: { f: 4000 } });
    osc(v, { duty: 0.5, f: 1500, at: 0.12, d: 0.07, peak: 0.07, lp: { f: 4000 } });
  },
  meow(o) {
    const v = voice({ pan: o.pan, wet: 0.16, dur: 0.6 });
    // m → i → a → u (ünlü formantları F1/F2/F3)
    formant(v, { d: 0.5, peak: 0.13, f0: 560, pitch: [[0.12, 820], [0.22, 870], [0.5, 560]],
      vowels: [[0, [300, 1250, 2700]], [0.08, [330, 2300, 3000]], [0.22, [820, 1250, 2700]], [0.42, [420, 800, 2400]]] });
  },
  meowBig(o) {
    SOUNDS.meow(o);
    const v = voice({ pan: o.pan, wet: 0.3, echo: 0.2, dur: 1.8 });
    formant(v, { at: 0.48, d: 0.75, peak: 0.17, f0: 640, pitch: [[0.15, 1040], [0.4, 1100], [0.75, 600]],
      vowels: [[0, [320, 1300, 2700]], [0.1, [340, 2400, 3000]], [0.3, [860, 1300, 2700]], [0.62, [420, 780, 2400]]] });
    grains(10, 0.8, (i, at) => bell(v, { f: note(10 + ((Math.random() * 7) | 0)), at: 0.55 + at, d: 0.35, peak: 0.025, ratio: 3.5, index: 3, pan: rnd(-0.7, 0.7) }));
  },
  creak(o) { // kapı: yapış-kay sürtünmesi, ahşap rezonansı
    const v = voice({ pan: o.pan, wet: 0.22, dur: 1 });
    const src = { type: 'sawtooth', f: 22, pts: [[0.12, 31], [0.24, 19], [0.36, 36], [0.5, 24], [0.62, 41]], a: 0.04, d: 0.7, peak: 0.95, wob: false };
    osc(v, { ...src, lp: { type: 'bandpass', f: 390, q: 12 } });
    osc(v, { ...src, peak: 0.65, lp: { type: 'bandpass', f: 1150, q: 10 } });
    noise(v, { color: 'pink', type: 'bandpass', f: 700, q: 3, a: 0.1, d: 0.6, peak: 0.06 });
    noise(v, { type: 'bandpass', f: 1900, q: 5, at: 0.72, d: 0.02, peak: 0.25 });          // mandal
  },
  twinkle(o) { // kayan yıldız
    const v = voice({ pan: 0.6, wet: 0.45, echo: 0.2, dur: 1.4 });
    noise(v, { type: 'highpass', f: 9000, f2: 3500, a: 0.04, d: 0.45, peak: 0.035, panTo: -0.6 });
    grains(6, 0.45, (i, at) => bell(v, { f: note(9 + ((Math.random() * 6) | 0), 1046.5), at, d: 0.5, peak: 0.045, ratio: 3.5, index: 4, pan: 0.6 - at * 2.4 }));
  },
  ufo(o) { // theremin, soldan sağa uçar
    const v = voice({ pan: -0.8, wet: 0.35, echo: 0.15, dur: 1.8 });
    osc(v, { type: 'sine', f: 440, a: 0.25, hold: 0.8, d: 1.5, peak: 0.12, vib: { rate: 6, depth: 120 }, panTo: 0.8, wob: false });
    osc(v, { type: 'triangle', f: 660, a: 0.25, hold: 0.8, d: 1.5, peak: 0.035, vib: { rate: 6.3, depth: 180 }, panTo: 0.8, wob: false });
    noise(v, { type: 'highpass', f: 8000, a: 0.2, d: 1.4, peak: 0.02 });
  },
  bye(o) {
    const v = voice({ pan: o.pan, wet: 0.22, dur: 0.8 });
    [7, 4, 0].forEach((dg, i) => pluck(v, { f: note(dg), at: i * 0.09, d: 0.3, peak: 0.09, bright: 4200 }));
  },

  // ===== DRUG sırları =====
  secret(o) {
    const v = voice({ pan: o.pan, wet: 0.5, echo: 0.3, dur: 2 });
    for (let i = 0; i < 9; i++) bell(v, { f: note(5 + i), at: i * 0.045, d: 0.6, peak: 0.065, ratio: 3.5, index: 5, pan: rnd(-0.7, 0.7) });
    noise(v, { type: 'highpass', f: 9000, a: 0.1, d: 0.95, peak: 0.035 });
    [0, 2, 4].forEach((dg) => osc(v, { type: 'triangle', f: note(dg + 10), at: 0.3, a: 0.15, d: 1.3, peak: 0.025 }));
  },
  bigSecret(o) {
    SOUNDS.secret(o);
    const v = voice({ pan: 0, wet: 0.45, echo: 0.2, dur: 3 });
    // pirinç benzeri fanfar: kısa-kısa-uzun
    [[0, [392, 523.25, 659.25]], [0.16, [392, 523.25, 659.25]], [0.32, [523.25, 659.25, 784, 1046.5]]].forEach(([at, chord], i) => chord.forEach((f) => osc(v, { type: 'sawtooth', f, at: 0.45 + at, a: 0.02, hold: i === 2 ? 0.5 : 0.05, d: i === 2 ? 1.4 : 0.15, peak: 0.045, uni: 2, spread: 10, lp: { f: 900, pts: [[0.05, 3200], [i === 2 ? 1.2 : 0.14, 900]], q: 1.5 } })));
    osc(v, { type: 'sine', f: 130.8, at: 0.77, d: 1.3, peak: 0.25, wob: false });
    noise(v, { type: 'highpass', f: 5000, at: 0.45, a: 0.3, d: 1.6, peak: 0.05 });
  },
  splat(o) {
    const v = voice({ pan: o.pan, wet: 0.14, dur: 0.5 });
    noise(v, { color: 'brown', type: 'lowpass', f: 2400, f2: 260, q: 4, d: 0.24, peak: 0.6 });
    osc(v, { type: 'sine', f: 380, f2: 70, d: 0.17, peak: 0.2, wob: false });                      // blup
    grains(4, 0.16, (i, at) => osc(v, { type: 'sine', f: rnd(1200, 2400), f2: rnd(500, 800), at: 0.05 + at, d: 0.035, peak: 0.045, wob: false })); // damlacıklar
  },
  thud(o) {
    const v = voice({ pan: o.pan, wet: 0.32, dur: 0.9 });
    kick(v, { f: 125, f2: 32, d: 0.5, peak: 0.75, click: 0.3, drive: 0.5 });
    noise(v, { color: 'brown', type: 'lowpass', f: 320, d: 0.28, peak: 0.5 });
    noise(v, { type: 'bandpass', f: 1800, q: 1, d: 0.05, peak: 0.16 });
    grains(5, 0.3, (i, at) => noise(v, { type: 'bandpass', f: rnd(1500, 4000), q: 6, at: 0.06 + at, d: 0.02, peak: 0.08 }));
  },
  glitch(o) { // kekeleyen bitcrush
    const v = voice({ pan: o.pan, wet: 0.1, dur: 0.5 });
    for (let i = 0; i < 9; i++) {
      noise(v, { color: 'crush', type: 'none', rate: pick([0.5, 1, 1.5, 2]), at: i * 0.032, a: 0.001, d: 0.024, peak: 0.16 });
      if (i % 2) osc(v, { duty: 0.125, f: rnd(200, 1700), at: i * 0.032, d: 0.022, peak: 0.05, wob: false });
    }
  },
  rain(o) { // dijital yağmur: karakterler düşüyor
    const v = voice({ pan: 0, wet: 0.38, echo: 0.12, dur: 1.6 });
    osc(v, { type: 'sine', f: 110, a: 0.2, d: 1.3, peak: 0.03 });
    grains(20, 1.2, (i, at) => bell(v, { f: note(4 + ((Math.random() * 12) | 0)), at, d: 0.14, peak: 0.035, ratio: 2, index: 1.5, idxD: 0.05, pan: rnd(-0.85, 0.85) }));
  },
  melt(o) {
    const v = voice({ pan: 0, wet: 0.45, echo: 0.2, dur: 3.4 });
    osc(v, { type: 'sawtooth', f: 220, f2: 55, glide: 3, a: 0.3, d: 3.2, peak: 0.05, uni: 3, spread: 25, lp: { f: 1800, f2: 200, q: 6 }, vib: { rate: 2, depth: 4 } });
    osc(v, { type: 'sine', f: 110, f2: 35, glide: 3, a: 0.2, d: 3, peak: 0.12, wob: false });
    grains(8, 2.5, (i, at) => osc(v, { type: 'sine', f: rnd(700, 1000), f2: rnd(220, 300), at: 0.3 + at, d: 0.08, peak: 0.07, wob: false })); // boya damlaları
  },
  reform(o) {
    const v = voice({ pan: 0, wet: 0.3, dur: 0.9 });
    noise(v, { color: 'pink', type: 'bandpass', f: 300, f2: 4200, q: 1, a: 0.34, d: 0.4, peak: 0.3, curve: 'lin' }); // ters kabarma
    osc(v, { type: 'sine', f: 80, f2: 620, d: 0.45, peak: 0.1 });
    noise(v, { type: 'highpass', f: 3000, at: 0.41, d: 0.02, peak: 0.3 });
    bell(v, { f: note(9, 1046.5), at: 0.41, d: 0.45, peak: 0.05, ratio: 3.5, index: 3 });
  },
  eyes(o) {
    const v = voice({ pan: o.pan, wet: 0.5, dur: 1.9 });
    osc(v, { type: 'sine', f: 82, a: 0.3, d: 1.7, peak: 0.1, wob: false });                       // vuruşan alçak uğultu
    osc(v, { type: 'sine', f: 87, a: 0.3, d: 1.7, peak: 0.1, wob: false });
    osc(v, { type: 'sine', f: 1318, a: 0.4, d: 1.5, peak: 0.014, vib: { rate: 5, depth: 8 } });  // ürpertici tiz
    osc(v, { type: 'sine', f: 1396, a: 0.4, d: 1.5, peak: 0.012 });
    noise(v, { color: 'brown', type: 'lowpass', f: 950, at: 0.05, d: 0.13, peak: 0.25 });       // göz kapağı (ıslak)
    osc(v, { type: 'sine', f: 310, f2: 170, at: 0.05, d: 0.11, peak: 0.08, wob: false });
  },
  invert(o) {
    const v = voice({ pan: o.pan, wet: 0.15, dur: 0.4 });
    osc(v, { duty: 0.25, f: 1600, f2: 200, d: 0.12, peak: 0.1, lp: { f: 5000 } });
    osc(v, { duty: 0.25, f: 200, f2: 1600, at: 0.11, d: 0.12, peak: 0.1, lp: { f: 5000 } });
  },
  acid(o) { // asit: TB-303 tarzı vıcık bas çizgisi + davul
    const v = voice({ pan: 0, wet: 0.15, echo: 0.1, dur: 2.4 });
    const step = 0.111; // 135 BPM, onaltılık
    const pat = [0, 0, 12, 0, 10, 0, 7, 12, 0, 3, 0, 12, 15, 12, 10, 7];
    const acc = [1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0];
    pat.forEach((n, i) => {
      const f = semi(110, n);
      osc(v, { type: 'sawtooth', f, at: i * step, a: 0.003, d: step * 0.95, peak: acc[i] ? 0.085 : 0.06, drive: 0.6,
        lp: { f: acc[i] ? 2600 : 1400, f2: 240, t: step * 0.8, q: 16 }, wob: false });
    });
    [0, 4, 8, 12].forEach((i) => kick(v, { f: 140, f2: 45, at: i * step, d: 0.2, peak: 0.3, click: 0.1 }));
    [2, 6, 10, 14].forEach((i) => noise(v, { type: 'highpass', f: 7000, at: i * step, d: 0.04, peak: 0.08 }));
  },

  // ===== sayfayı yok et =====
  shoot(o) { // sprey püskürtmesi
    const v = voice({ pan: o.pan, wet: 0.06, dur: 0.15 });
    noise(v, { type: 'bandpass', f: 3600, f2: 1700, q: 1.2, a: 0.004, d: 0.09, peak: 0.28 });
    noise(v, { type: 'highpass', f: 6500, d: 0.05, peak: 0.08 });
    osc(v, { type: 'triangle', f: rnd(400, 450), f2: 250, d: 0.05, peak: 0.03, wob: false });
  },
  lob(o) { // glitch bombası fırlatma + düşerken ıslık
    const v = voice({ pan: o.pan, wet: 0.12, dur: 0.5 });
    kick(v, { f: 210, f2: 120, d: 0.07, peak: 0.2, click: 0.1 });
    osc(v, { type: 'sine', f: 1250, f2: 680, glide: 0.35, at: 0.04, d: 0.36, peak: 0.04 });
  },
  boom(o) {
    const v = voice({ pan: o.pan, wet: 0.38, dur: 1.5 });
    noise(v, { color: 'brown', type: 'lowpass', f: 3800, f2: 90, ft: 0.9, q: 0.7, a: 0.002, d: 1.15, peak: 0.72, drive: 0.6 });
    kick(v, { f: 110, f2: 28, d: 0.85, peak: 0.66, click: 0.3, drive: 0.7 });
    noise(v, { type: 'bandpass', f: 1300, f2: 220, q: 1, d: 0.35, peak: 0.35 });                  // çatlama
    grains(9, 0.6, (i, at) => noise(v, { type: 'bandpass', f: rnd(2000, 5200), q: 6, at: 0.12 + at, d: 0.022, peak: 0.1 })); // enkaz
  },
  swing(o) {
    const v = voice({ pan: o.pan, wet: 0.08, dur: 0.25 });
    noise(v, { color: 'pink', type: 'bandpass', f: 420, f2: 1900, q: 1.5, a: 0.03, d: 0.16, peak: 0.75, panTo: (o.pan || 0) + 0.3 });
  },
  hit(o) {
    const v = voice({ pan: o.pan, wet: 0.12, dur: 0.3 });
    noise(v, { type: 'highpass', f: 2600, d: 0.008, peak: 0.42 });
    noise(v, { color: 'brown', type: 'lowpass', f: 950, d: 0.1, peak: 0.38 });
    kick(v, { f: 185, f2: 60, d: 0.13, peak: 0.34, click: 0, drive: 0.6 });
    osc(v, { duty: 0.5, f: 140, f2: 70, d: 0.06, peak: 0.05, wob: false });
  },
  break(o) { // cam / plastik kırılması
    const v = voice({ pan: o.pan, wet: 0.18, dur: 0.45 });
    grains(11, 0.18, (i, at) => noise(v, { type: 'bandpass', f: rnd(2500, 7200), q: 8, at, d: rnd(0.018, 0.05), peak: rnd(0.08, 0.2), panTo: (o.pan || 0) + rnd(-0.35, 0.35) }));
    kick(v, { f: 155, f2: 60, d: 0.1, peak: 0.24, click: 0.15 });
    bell(v, { f: rnd(2400, 2900), d: 0.22, peak: 0.03, ratio: 2.7, index: 3 });
  },
  dash(o) {
    const v = voice({ pan: o.pan, wet: 0.08, dur: 0.25 });
    noise(v, { color: 'pink', type: 'bandpass', f: 700, f2: 4600, q: 1, a: 0.01, d: 0.16, peak: 0.5 });
    osc(v, { type: 'sine', f: 300, f2: 950, d: 0.12, peak: 0.05 });
  },
  hurt(o) {
    const v = voice({ pan: o.pan, wet: 0.12, dur: 0.4 });
    osc(v, { type: 'sawtooth', f: 330, f2: 80, d: 0.26, peak: 0.12, uni: 2, spread: 20, lp: { f: 2300 }, drive: 0.5 });
    noise(v, { color: 'brown', type: 'lowpass', f: 1200, d: 0.13, peak: 0.35 });
  },
  rankUp(o) {
    const v = voice({ pan: o.pan, wet: 0.3, echo: 0.15, dur: 1 });
    const b = clamp(o.k ?? 0, 0, 8);
    [0, 1, 2, 3].forEach((i) => pluck(v, { f: note(b + i * 2), at: i * 0.05, d: 0.3, peak: 0.09 }));
    bell(v, { f: note(b + 8), at: 0.2, d: 0.6, peak: 0.05, ratio: 3.5, index: 4 });
  },
  achievement(o) {
    const v = voice({ pan: o.pan, wet: 0.45, echo: 0.25, dur: 2 });
    [0, 2, 4, 5].forEach((dg, i) => bell(v, { f: note(dg + 5), at: i * 0.07, d: 1, peak: 0.08, ratio: 3.5, index: 4.5 }));
    [0, 2, 4].forEach((dg) => osc(v, { type: 'triangle', f: note(dg + 5), at: 0.28, a: 0.1, d: 1.2, peak: 0.03 }));
    grains(6, 0.6, (i, at) => bell(v, { f: note(12 + ((Math.random() * 5) | 0)), at: 0.3 + at, d: 0.3, peak: 0.02, ratio: 5, index: 2, pan: rnd(-0.7, 0.7) }));
  },
  bossDown(o) {
    SOUNDS.boom(o);
    const v = voice({ pan: 0, wet: 0.45, echo: 0.2, dur: 3 });
    osc(v, { type: 'sawtooth', f: 110, f2: 30, glide: 1.4, a: 0.1, d: 1.5, peak: 0.08, uni: 3, spread: 30, lp: { f: 1500, f2: 150 } });
    [0, 2, 4, 5, 7, 9].forEach((dg, i) => pluck(v, { f: note(dg, 392), at: 0.7 + i * 0.085, d: 0.4, peak: 0.1 }));
    [0, 2, 4].forEach((dg) => bell(v, { f: note(dg + 5, 392), at: 1.25, d: 1.6, peak: 0.07, ratio: 3.5, index: 4 }));
  },
  rewind(o) { // VHS geri sarma
    const v = voice({ pan: 0, wet: 0.15, dur: 1.4 });
    osc(v, { type: 'sawtooth', f: 220, f2: 1700, glide: 0.95, d: 1, peak: 0.06, lp: { f: 3200 }, vib: { rate: 10, depth: 40 } }); // motor
    osc(v, { type: 'sine', f: 3200, f2: 800, glide: 0.95, d: 1, peak: 0.018 });                                                    // bant cıyaklaması
    noise(v, { type: 'highpass', f: 4200, a: 0.05, d: 1, peak: 0.09 });                                                            // bant hışırtısı
    kick(v, { f: 140, f2: 60, at: 0.98, d: 0.12, peak: 0.2, click: 0.2 });                                                         // klonk
  },
};

// sık tekrarlananlar fazla çoğalmasın
const GAP = { hover: 40, type: 22, hit: 35, break: 30, shoot: 45, click: 30, splat: 30, select: 40 };
const LOW = new Set(['hover', 'type', 'shoot', 'hit', 'break', 'splat']);
const lastAt = new Map();
const panOf = (x) => (x == null ? 0 : clamp((x / window.innerWidth) * 2 - 1, -1, 1) * 0.7);

function play(name, opts = {}) {
  if (!enabled || !level || document.hidden) return;
  const fn = SOUNDS[name];
  if (!fn || !ensure()) return;
  const now = performance.now();
  if (now - (lastAt.get(name) || 0) < (GAP[name] ?? 18)) return;
  if (active > 40 && LOW.has(name)) return;
  lastAt.set(name, now);
  let { x } = opts;
  if (x == null && opts.el) { const r = opts.el.getBoundingClientRect(); x = r.left + r.width / 2; }
  try { fn({ ...opts, pan: opts.pan ?? panOf(x) }); } catch (err) { console.warn('[sfx]', name, err); }
}

// sürekli ses: sprey (basınçlı fısıltı + titreşim), hız ve konumla değişir
function loop(name) {
  const none = { stop() {}, set() {} };
  if (name !== 'spray' || !enabled || !level || document.hidden || !ensure()) return none;
  const v = voice({ wet: 0.08, dur: 60 });
  const t0 = v.t;
  // başlangıç "pss" + valf tıkı
  noise(v, { type: 'highpass', f: 2200, a: 0.004, d: 0.08, peak: 0.22 });
  noise(v, { type: 'bandpass', f: 2600, q: 5, d: 0.012, peak: 0.25 });
  const s = ctx.createBufferSource(); s.buffer = buf.white; s.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 6200; bp.Q.value = 0.55;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1700;
  const flut = ctx.createGain(); flut.gain.value = 0.85;
  const fl = ctx.createOscillator(); fl.frequency.value = 13; const fg = ctx.createGain(); fg.gain.value = 0.12;
  fl.connect(fg).connect(flut.gain); fl.start(t0);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.13, t0 + 0.06);
  s.connect(bp).connect(hp).connect(flut).connect(g).connect(v.in);
  s.start(t0);
  let done = false;
  return {
    set(speed = 0, x) {
      if (done) return;
      const k = clamp(speed, 0, 1); const t = ctx.currentTime;
      g.gain.setTargetAtTime(0.09 + k * 0.11, t, 0.05);
      bp.frequency.setTargetAtTime(4800 + k * 3200, t, 0.05);
      if (x != null) v.pan.pan.setTargetAtTime(panOf(x), t, 0.08);
    },
    stop() {
      if (done) return; done = true;
      const t = ctx.currentTime;
      g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(0.0001, t, 0.035);
      s.stop(t + 0.3); fl.stop(t + 0.3);
      noise(v, { type: 'bandpass', f: 3000, q: 4, at: 0.03, d: 0.012, peak: 0.12 }); // "tsk"
    },
  };
}

// ---------- aç / kapa, ses düzeyi ----------
const listeners = new Set();
function setEnabled(on) {
  on = Boolean(on);
  if (!on && enabled) play('toggleOff'); // kapanırken son bir ses
  enabled = on;
  store.set(KEY, enabled);
  if (enabled) play('toggleOn');
  listeners.forEach((fn) => fn(enabled));
}
function setVolume(n) {
  level = clamp(Math.round(Number(n) || 0), 0, 10);
  store.set(VKEY, level);
  if (ctx) bus.master.gain.setTargetAtTime(volFor(level), ctx.currentTime, 0.05);
  if (level && !enabled) setEnabled(true); else play('select', { deg: level });
  listeners.forEach((fn) => fn(enabled));
}

// hoparlör simgesi (piksel)
const ICON = `<svg viewBox="0 0 14 12" width="21" height="18" shape-rendering="crispEdges" aria-hidden="true">
  <path d="M1 4h3v4H1zM4 3h1v6H4zM5 2h1v8H5zM6 1h1v10H6z" fill="currentColor"/>
  <g class="sfx-w"><path d="M9 4h1v4H9zM11 2h1v8h-1zM10 3h1v1h-1zM10 8h1v1h-1zM12 1h1v1h-1zM12 10h1v1h-1z" fill="currentColor"/></g>
  <g class="sfx-x"><path d="M9 3h1v1H9zM10 4h1v1h-1zM11 5h1v2h-1zM12 4h1v1h-1zM13 3h1v1h-1zM10 7h1v1h-1zM9 8h1v1H9zM12 7h1v1h-1zM13 8h1v1h-1z" fill="currentColor"/></g>
</svg>`;

// üzerine gelme: bir grubun içindeki sırası gamda bir nota olur (menüde gezince küçük bir melodi)
const HOVER_SEL = '.nav a, .btn, .pill, .lang button, .sfx-btn, .contact, .case, .item, .foot-nav a, .mm-ctrl button, .mm-grip, .lib-play, .chip, .inv2-sort button, .sec-link, .mobile-nav a';
function degreeOf(el, x) {
  const parent = el.parentElement;
  const sibs = parent ? [...parent.children].filter((c) => c.matches?.(HOVER_SEL)) : [];
  if (sibs.length > 1) return sibs.indexOf(el) % 10;
  return Math.round((x / window.innerWidth) * 7);
}

export function initSfx({ label = () => '' } = {}) {
  // genel tıklama: düğme ve bağlantılar (özel sesi olanlar data-sfx ile kendi sesini seçer, "none" = sessiz)
  document.addEventListener('click', (e) => {
    const el = e.target.closest?.('[data-sfx], button, a[href], [role="tab"], [role="button"], summary, input[type="checkbox"], input[type="radio"]');
    if (!el || el.disabled) return;
    const name = el.dataset.sfx || 'click';
    if (name === 'none') return;
    const r = el.getBoundingClientRect();
    play(name, { x: e.clientX || r.left + r.width / 2, deg: degreeOf(el, r.left + r.width / 2) });
  }, true);
  // üzerine gelince gamda bir nota (sadece fareyle)
  let lastHover = null;
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse') return;
    const el = e.target.closest?.(HOVER_SEL);
    if (!el || el === lastHover) return;
    lastHover = el;
    const r = el.getBoundingClientRect();
    play('hover', { x: r.left + r.width / 2, deg: degreeOf(el, r.left + r.width / 2) });
  });
  document.addEventListener('pointerout', (e) => { if (lastHover && !lastHover.contains(e.relatedTarget)) lastHover = null; });

  // üst bardaki düğme
  const btn = document.getElementById('sfxToggle');
  if (btn) {
    btn.innerHTML = ICON;
    const paint = () => {
      btn.setAttribute('aria-pressed', String(enabled && level > 0));
      btn.setAttribute('aria-label', label(enabled && level > 0));
      btn.title = label(enabled && level > 0);
    };
    paint();
    listeners.add(paint);
    btn.addEventListener('click', () => setEnabled(!(enabled && level > 0)));
    API.sfxPaint = paint;
  }

  API.sfx = {
    play,
    loop,
    enabled: () => enabled && level > 0,
    set: setEnabled,
    toggle: () => setEnabled(!enabled),
    volume: (n) => (n == null ? level : setVolume(n)),
    list: () => Object.keys(SOUNDS),
  };
  // geliştirirken: her sesin seviyesini ölçmek için (sadece yerelde)
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) API.sfx._debug = () => ({ ctx, bus, active });
}
