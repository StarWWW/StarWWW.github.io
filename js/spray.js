// Sprey boya çizimi: her çizgi aynı tohumla çizildiği için her tarayıcıda aynı görünür.
import { mulberry32, hashStr } from './util.js';

export const WALL_W = 1600;
export const WALL_H = 800;
export const COLORS = ['#99E550', '#DF7126', '#D77BBA', '#5FCDE4', '#FBF236', '#AC3232', '#FFFFFF', '#222034'];
export const SIZES = [10, 22, 40];
export const MAX_POINTS = 600;
export const MAX_DRIPS = 12;
const MAX_DRIP_LEN = 0.2;

// Dışarıdan gelen (veritabanı, canlı yayın, eski yerel kayıt) her çizgi buradan geçer: renk/boyut listede olmalı,
// noktalar 0–1 aralığında sayı çifti olmalı. Bozuk ya da kötü niyetli bir kayıt duvarı dondurmasın diye.
const unit = (v) => typeof v === 'number' && v >= 0 && v <= 1;
export function cleanPoints(list, max = MAX_POINTS) {
  if (!Array.isArray(list)) return null;
  const out = [];
  for (let i = 0; i < list.length && out.length < max; i++) {
    const p = list[i];
    if (Array.isArray(p) && p.length === 2 && unit(p[0]) && unit(p[1])) out.push([p[0], p[1]]);
  }
  return out;
}
export function cleanStroke(st) {
  if (!st || typeof st !== 'object' || !COLORS.includes(st.color) || !SIZES.includes(st.size)) return null;
  if (typeof st.id !== 'string' || st.id.length > 64) return null;
  const points = cleanPoints(st.points);
  if (!points?.length) return null;
  const drips = (Array.isArray(st.drips) ? st.drips : []).slice(0, MAX_DRIPS)
    .filter((d) => Array.isArray(d) && d.length === 3 && unit(d[0]) && unit(d[1]) && typeof d[2] === 'number' && d[2] >= 0 && d[2] <= MAX_DRIP_LEN)
    .map((d) => [d[0], d[1], d[2]]);
  return { ...st, points, drips };
}

const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

const stamps = new Map();
function stamp(color, size, variant) {
  const key = `${color}|${size}|${variant}`;
  if (stamps.has(key)) return stamps.get(key);
  const r = size;
  const c = document.createElement('canvas');
  c.width = c.height = Math.ceil(r * 2.6);
  const ctx = c.getContext('2d');
  const cx = c.width / 2;
  const rnd = mulberry32(hashStr(key));
  const g = ctx.createRadialGradient(cx, cx, 0, cx, cx, r);
  g.addColorStop(0, rgba(color, 0.42));
  g.addColorStop(0.55, rgba(color, 0.2));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cx, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = color;
  const n = Math.round(r * 5);
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    const d = Math.min(1.25, Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * 0.42) * r;
    const s = rnd() < 0.85 ? 1.3 : 2.4;
    ctx.globalAlpha = 0.25 + rnd() * 0.55;
    ctx.fillRect(cx + Math.cos(a) * d, cx + Math.sin(a) * d, s, s);
  }
  ctx.globalAlpha = 1;
  stamps.set(key, c);
  return c;
}

export function drawStroke(ctx, st, fromIdx = 0, scale = 1) {
  const pts = st.points || [];
  if (!pts.length) return;
  const size = Number(st.size) || 22;
  const rnd = mulberry32(hashStr(String(st.id)) + fromIdx * 7919);
  const spacing = Math.max(2, size * 0.3);
  const W = WALL_W * scale; const H = WALL_H * scale;
  const put = (x, y) => {
    const img = stamp(st.color, size, Math.floor(rnd() * 4));
    const w = img.width * scale;
    ctx.drawImage(img, x - w / 2, y - w / 2, w, w);
  };
  let prev = fromIdx > 0 ? pts[fromIdx - 1] : null;
  for (let i = fromIdx; i < pts.length; i++) {
    const [px, py] = pts[i];
    if (!prev) { put(px * W, py * H); prev = pts[i]; continue; }
    const qx = prev[0] * W; const qy = prev[1] * H;
    const dx = px * W - qx; const dy = py * H - qy;
    // üst sınır: duvarın köşegeni bile ~600 adımda biter
    const steps = Math.min(1200, Math.max(1, Math.floor(Math.hypot(dx, dy) / (spacing * scale))));
    for (let s = 1; s <= steps; s++) put(qx + (dx * s) / steps, qy + (dy * s) / steps);
    prev = pts[i];
  }
}

export function drawDrip(ctx, st, drip, scale = 1) {
  const [x, y, len] = drip;
  const size = Number(st.size) || 22;
  const X = x * WALL_W * scale; const Y = y * WALL_H * scale; const L = len * WALL_H * scale;
  const w = Math.max(2, size * 0.2) * scale;
  ctx.fillStyle = rgba(st.color, 0.85);
  ctx.fillRect(X - w / 2, Y, w, L);
  ctx.beginPath(); ctx.arc(X, Y + L, w * 0.9, 0, Math.PI * 2); ctx.fill();
}

export function drawFull(ctx, st, scale = 1) {
  drawStroke(ctx, st, 0, scale);
  (st.drips || []).forEach((d) => drawDrip(ctx, st, d, scale));
}

// Türkiye saati (UTC+3, yaz saati yok) ile hafta hesapları
const TZ = 3 * 3600 * 1000;
export function weekStart(ts = Date.now()) {
  const d = new Date(ts + TZ);
  const day = (d.getUTCDay() + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day) - TZ;
}
export const nextBuff = (ts = Date.now()) => weekStart(ts) + 7 * 86400000;
export function isoWeek(ts = Date.now()) {
  const d = new Date(ts + TZ);
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dayNum + 3);
  const firstThu = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((t - firstThu) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return { week, year: t.getUTCFullYear() };
}
