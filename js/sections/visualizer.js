// MÜZİK GÖRSELLEŞTİRİCİSİ — gerçek sesten (Web Audio analyser) çizilir:
// ortada albüm kapağıyla dönen plak, etrafında aynalı frekans halkası, iki yana uzanan parlak osiloskop dalgası,
// bas vuruşlarında şok dalgası + piksel parçacık patlaması + flaş, sağda VU metre, solda tahmini BPM.
// Renkler albüm kapağından çıkarılır. DRUG modunda renkler döner, iz bırakır, görüntü kayar.
import { reducedMotion } from '../util.js';

const TAU = Math.PI * 2;
const DEFAULT = [[153, 229, 80], [95, 205, 228], [215, 123, 186]];

function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b); const min = Math.min(r, g, b);
  let h = 0; let s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}
function hslToRgb([h, s, l]) {
  const f = (n) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
}
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const mix = (a, b, t) => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t));

export function createVisualizer(canvas, opts) {
  if (!canvas) return null;
  const g = canvas.getContext('2d');
  let W = 0; let H = 0; let dpr = 1;
  let raf = 0; let last = 0; let lastDraw = 0;
  let rot = 0;
  let freq = null; let time = null;
  let art = null; let artUrl = '';
  let pal = DEFAULT;
  const smooth = new Float32Array(72);
  const peak = new Float32Array(72);
  const bassHist = [];
  let lastBeat = 0; const beatGaps = [];
  let flash = 0; let shake = 0; let bpm = 0;
  const rings = []; const parts = []; const dust = [];
  const drug = () => document.documentElement.dataset.mode === 'drug';

  // tarama çizgileri deseni
  const scan = document.createElement('canvas');
  scan.width = 1; scan.height = 3;
  const sg = scan.getContext('2d');
  sg.fillStyle = 'rgba(255,255,255,.035)'; sg.fillRect(0, 0, 1, 1);
  const scanPat = g.createPattern(scan, 'repeat');

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.clientWidth || 300; H = canvas.clientHeight || 200;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!dust.length) for (let i = 0; i < 40; i++) dust.push({ x: Math.random() * W, y: Math.random() * H, s: Math.random() * 0.6 + 0.2 });
    draw(performance.now());
  }

  // albüm kapağı + ondan renk paleti
  function setArt(url) {
    if (!url || url === artUrl) return;
    artUrl = url;
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.decoding = 'async';
    im.onload = () => {
      if (artUrl !== url) return;
      art = im;
      try {
        const c = document.createElement('canvas'); c.width = 24; c.height = 24;
        const cx = c.getContext('2d'); cx.drawImage(im, 0, 0, 24, 24);
        const d = cx.getImageData(0, 0, 24, 24).data;
        let best = null; let bestScore = -1; let sum = [0, 0, 0]; let n = 0;
        for (let i = 0; i < d.length; i += 4) {
          const c3 = [d[i], d[i + 1], d[i + 2]];
          const [, s, l] = rgbToHsl(c3);
          const score = s * (1 - Math.abs(l - 0.55) * 1.6);
          if (score > bestScore) { bestScore = score; best = c3; }
          sum = sum.map((v, k) => v + c3[k]); n++;
        }
        let [h, s] = rgbToHsl(bestScore > 0.15 ? best : sum.map((v) => v / n));
        s = Math.max(0.55, s);
        pal = [hslToRgb([h, s, 0.58]), hslToRgb([(h + 0.08) % 1, s, 0.72]), hslToRgb([(h + 0.45) % 1, Math.min(1, s + 0.1), 0.62])];
      } catch { pal = DEFAULT; }
      if (!raf) draw(performance.now());
    };
    im.onerror = () => { art = null; pal = DEFAULT; };
    im.src = url;
  }

  function analyse(an, live) {
    if (!an) return { bass: 0, mid: 0, high: 0, rms: 0, pk: 0 };
    if (!freq || freq.length !== an.frequencyBinCount) { freq = new Uint8Array(an.frequencyBinCount); time = new Uint8Array(an.fftSize); }
    if (!live) return { bass: 0, mid: 0, high: 0, rms: 0, pk: 0 };
    an.getByteFrequencyData(freq);
    an.getByteTimeDomainData(time);
    const avg = (a, b) => { let s = 0; for (let i = a; i < b; i++) s += freq[i]; return s / ((b - a) * 255); };
    const n = freq.length;
    let rms = 0; let pk = 0;
    for (let i = 0; i < time.length; i++) { const v = (time[i] - 128) / 128; rms += v * v; pk = Math.max(pk, Math.abs(v)); }
    return { bass: avg(1, Math.max(3, n * 0.04 | 0)), mid: avg(n * 0.04 | 0, n * 0.25 | 0), high: avg(n * 0.25 | 0, n * 0.7 | 0), rms: Math.sqrt(rms / time.length), pk };
  }

  function beat(now, bass) {
    bassHist.push(bass);
    if (bassHist.length > 45) bassHist.shift();
    const mean = bassHist.reduce((a, b) => a + b, 0) / bassHist.length;
    if (bass > mean * 1.28 && bass > 0.32 && now - lastBeat > 230) {
      if (lastBeat) {
        beatGaps.push(now - lastBeat);
        if (beatGaps.length > 12) beatGaps.shift();
        const sorted = [...beatGaps].sort((a, b) => a - b);
        const med = sorted[sorted.length >> 1];
        if (med > 250 && med < 1500) bpm = Math.round(60000 / med);
      }
      lastBeat = now;
      return true;
    }
    return false;
  }

  function draw(now) {
    if (!W) return;
    const an = opts.analyser();
    const live = Boolean(an) && opts.playing();
    const rm = reducedMotion();
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    const e = analyse(an, live);
    const d = drug();
    const t = now / 1000;
    let c1 = pal[0]; let c2 = pal[1]; let c3 = pal[2];
    if (d) { // DRUG: renkler döner
      const hh = (t * 0.12) % 1;
      c1 = hslToRgb([hh, 0.9, 0.6]); c2 = hslToRgb([(hh + 0.33) % 1, 0.9, 0.65]); c3 = hslToRgb([(hh + 0.66) % 1, 0.9, 0.6]);
    }
    const cx = W / 2; const cy = H / 2;
    const R = Math.min(H * 0.3, W * 0.16);
    const hit = live && beat(now, e.bass);
    if (hit && !rm) {
      rings.push({ r: R * 1.05, a: 0.9, w: 3 });
      flash = 0.16; shake = 4;
      const nP = d ? 26 : 16;
      for (let i = 0; i < nP; i++) {
        const a = Math.random() * TAU; const sp = 60 + Math.random() * 160;
        parts.push({ x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, c: [c1, c2, c3][i % 3], s: 2 + (Math.random() * 3 | 0) });
      }
    }
    if (live) rot += dt * (0.9 + e.bass * 2.2) * (d ? 1.8 : 1);

    // --- arka plan ---
    if (d && !rm) { g.fillStyle = 'rgba(5,4,9,.24)'; g.fillRect(0, 0, W, H); } else { g.fillStyle = '#0b0a12'; g.fillRect(0, 0, W, H); }
    const glow = g.createRadialGradient(cx, cy, R * 0.6, cx, cy, Math.max(W, H) * 0.7);
    glow.addColorStop(0, rgba(c1, 0.16 + e.bass * 0.35));
    glow.addColorStop(1, 'rgba(11,10,18,0)');
    g.fillStyle = glow; g.fillRect(0, 0, W, H);
    // süzülen toz
    dust.forEach((p) => {
      p.y -= (8 + e.mid * 60) * p.s * dt; p.x += Math.sin(t + p.y * 0.05) * 0.2;
      if (p.y < -2) { p.y = H + 2; p.x = Math.random() * W; }
      g.fillStyle = rgba(c2, 0.15 + p.s * 0.35);
      g.fillRect(p.x | 0, p.y | 0, 2, 2);
    });

    const sx = shake && !rm ? (Math.random() - 0.5) * shake : 0;
    const sy = shake && !rm ? (Math.random() - 0.5) * shake : 0;
    shake *= 0.82;
    g.save();
    g.translate(sx, sy);

    // --- osiloskop dalgası (sol + sağ, aynalı) ---
    const amp = H * 0.32;
    const gapL = cx - R - 26; const gapR = cx + R + 26; const endR = W - 44;
    // parlama: shadowBlur yerine kalın-yarı saydam + ince-parlak iki çizgi (shadowBlur her karede çok pahalı)
    g.lineJoin = 'round';
    g.beginPath();
    [[16, gapL, 1], [gapR, endR, -1]].forEach(([x0, x1, dir]) => {
      if (x1 - x0 < 20) return;
      const steps = Math.max(24, (x1 - x0) / 3 | 0);
      for (let i = 0; i <= steps; i++) {
        const f = i / steps;
        const x = x0 + (x1 - x0) * f;
        let v;
        if (live && time) {
          const idx = Math.floor((dir > 0 ? f : 1 - f) * (time.length - 1));
          v = (time[idx] - 128) / 128;
        } else v = Math.sin(f * 14 + t * 2) * 0.02;
        const taper = Math.sin(f * Math.PI); // uçlarda sönsün
        const y = cy + v * amp * (0.35 + taper * 0.65);
        if (i) g.lineTo(x, y); else g.moveTo(x, y);
      }
    });
    if (!rm) { g.lineWidth = 7; g.strokeStyle = rgba(c2, 0.14); g.stroke(); }
    g.lineWidth = 2; g.strokeStyle = rgba(c2, 0.95); g.stroke();

    // --- frekans halkası ---
    const N = smooth.length;
    const scale = 1 + e.bass * (rm ? 0.03 : 0.08);
    const r0 = R * scale + 7;
    const bw = Math.max(1.5, (Math.PI * r0 / N) * 0.62);
    g.lineCap = 'butt';
    for (let i = 0; i < N; i++) {
      let v = 0;
      if (live && freq) {
        const a = Math.floor((i / N) ** 1.6 * freq.length * 0.72) + 1;
        const b = Math.max(a + 1, Math.floor(((i + 1) / N) ** 1.6 * freq.length * 0.72) + 1);
        for (let k = a; k < b; k++) v = Math.max(v, freq[k]);
        v = (v / 255) ** 1.4;
      } else v = 0.04 + 0.03 * Math.sin(t * 1.5 + i * 0.35);
      smooth[i] += (v - smooth[i]) * (v > smooth[i] ? 0.55 : 0.12);
      peak[i] = Math.max(smooth[i], peak[i] - dt * 0.35);
      const len = 3 + smooth[i] * H * 0.34;
      const col = mix(c1, c3, Math.min(1, smooth[i] * 1.4));
      g.strokeStyle = rgba(col, 0.92);
      g.lineWidth = bw;
      const spin = d && !rm ? t * 0.6 : 0; // DRUG: halka döner
      [1, -1].forEach((s) => {
        const ang = -Math.PI / 2 + s * (i + 0.5) / N * Math.PI + spin;
        const ca = Math.cos(ang); const sa = Math.sin(ang);
        g.beginPath();
        g.moveTo(cx + ca * r0, cy + sa * r0);
        g.lineTo(cx + ca * (r0 + len), cy + sa * (r0 + len));
        g.stroke();
        const pl = r0 + 3 + peak[i] * H * 0.34;
        g.fillStyle = rgba([242, 238, 227], 0.85);
        g.fillRect(cx + ca * pl - 1, cy + sa * pl - 1, 2, 2);
      });
    }

    // --- şok dalgaları ---
    for (let i = rings.length - 1; i >= 0; i--) {
      const rg = rings[i];
      rg.r += (180 + e.bass * 220) * dt; rg.a -= dt * 1.3;
      if (rg.a <= 0) { rings.splice(i, 1); continue; }
      g.strokeStyle = rgba(c3, rg.a); g.lineWidth = rg.w;
      g.beginPath(); g.arc(cx, cy, rg.r, 0, TAU); g.stroke();
    }

    // --- plak ---
    g.save();
    g.translate(cx, cy);
    g.scale(scale, scale);
    g.fillStyle = '#08070d';
    g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
    g.lineWidth = 1;
    for (let k = 0; k < 9; k++) { g.strokeStyle = `rgba(255,255,255,${k % 2 ? 0.035 : 0.07})`; g.beginPath(); g.arc(0, 0, R * (0.5 + k * 0.055), 0, TAU); g.stroke(); }
    g.save();
    g.rotate(rot);
    const lr = R * 0.44;
    g.beginPath(); g.arc(0, 0, lr, 0, TAU); g.clip();
    if (art) g.drawImage(art, -lr, -lr, lr * 2, lr * 2);
    else { g.fillStyle = rgba(c1, 1); g.fillRect(-lr, -lr, lr * 2, lr * 2); g.fillStyle = '#0b0a12'; g.font = `${lr * 0.9 | 0}px Silkscreen, monospace`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('♪', 0, 2); }
    g.restore();
    // dönen etiket işareti (dönüş görünsün)
    g.save(); g.rotate(rot);
    g.fillStyle = rgba([242, 238, 227], 0.8); g.fillRect(lr + 3, -1.5, R * 0.12, 3);
    g.restore();
    // parlama (sabit)
    const sh = g.createLinearGradient(-R, -R, R, R);
    sh.addColorStop(0.35, 'rgba(255,255,255,0)'); sh.addColorStop(0.5, 'rgba(255,255,255,.09)'); sh.addColorStop(0.65, 'rgba(255,255,255,0)');
    g.fillStyle = sh; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
    g.strokeStyle = rgba(c1, 0.9); g.lineWidth = 2;
    g.beginPath(); g.arc(0, 0, R, 0, TAU); g.stroke();
    g.fillStyle = '#0b0a12'; g.beginPath(); g.arc(0, 0, R * 0.06, 0, TAU); g.fill();
    g.restore();

    // --- parçacıklar ---
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.97; p.vy *= 0.97; p.life -= dt * 1.4;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      g.fillStyle = rgba(p.c, p.life);
      g.fillRect(p.x | 0, p.y | 0, p.s, p.s);
    }
    g.restore();

    // --- DRUG: vuruşta görüntü kayması ---
    if (d && hit && !rm) {
      for (let k = 0; k < 4; k++) {
        const y = Math.random() * H | 0; const h = 4 + Math.random() * 18 | 0; const off = (Math.random() - 0.5) * 30;
        g.drawImage(canvas, 0, y * dpr, canvas.width, h * dpr, off, y, W, h);
      }
    }

    // --- VU metre (sağ) ---
    const segs = 12; const vx = W - 30; const vh = H - 40; const sgH = vh / segs;
    [[e.rms * 2.6, vx], [e.pk, vx + 12]].forEach(([lv, x]) => {
      for (let s = 0; s < segs; s++) {
        const on = s < Math.round(Math.min(1, lv) * segs);
        const col = s > segs * 0.82 ? [255, 42, 42] : s > segs * 0.6 ? [251, 242, 54] : [153, 229, 80];
        g.fillStyle = on ? rgba(col, 0.95) : 'rgba(255,255,255,.07)';
        g.fillRect(x, H - 20 - (s + 1) * sgH + 1, 8, sgH - 2);
      }
    });

    // --- yazılar ---
    g.font = '10px Silkscreen, monospace'; g.textBaseline = 'top'; g.textAlign = 'left';
    g.fillStyle = 'rgba(242,238,227,.55)';
    g.fillText(live ? `~${bpm || '---'} BPM` : 'BPM ---', 12, 10);
    g.textAlign = 'right';
    g.fillText(live ? (Math.floor(t * 2) % 2 ? '● LIVE' : '  LIVE') : '❚❚', W - 12, 10);
    if (!live) {
      g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      g.fillStyle = 'rgba(242,238,227,.75)';
      g.fillText(opts.hint(), cx, H - 12);
    }

    // --- flaş + tarama çizgileri ---
    if (flash > 0.01) { g.fillStyle = rgba(c2, flash); g.fillRect(0, 0, W, H); flash *= 0.8; }
    g.fillStyle = scanPat; g.fillRect(0, 0, W, H);

    if (live && opts.onFrame) opts.onFrame(freq);
  }

  // sadece ekrandayken çiz (müzik bölümü görünmüyorsa iş yok)
  let onScreen = true;
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; if (onScreen && opts.playing()) start(); }).observe(canvas);

  function loop(now) {
    raf = 0;
    if (document.hidden || !onScreen) return;
    const busy = opts.playing() || rings.length || parts.length;
    const fpsCap = reducedMotion() ? 33 : 0;
    if (!fpsCap || now - lastDraw > fpsCap) { draw(now); lastDraw = now; }
    if (busy) raf = requestAnimationFrame(loop);
  }
  function start() { if (!raf && onScreen) raf = requestAnimationFrame(loop); }

  canvas.addEventListener('click', () => opts.toggle());
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && opts.playing()) start(); });
  new MutationObserver(() => { if (!raf) draw(performance.now()); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-mode'] });
  resize();
  return { start, setArt, resize, redraw: () => draw(performance.now()) };
}
