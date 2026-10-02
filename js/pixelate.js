// Kapakları ve albüm görsellerini DB32 paletine indirip 8-bit'e çevirir.
export const DB32 = [
  '#000000', '#222034', '#45283C', '#663931', '#8F563B', '#DF7126', '#D9A066', '#EEC39A',
  '#FBF236', '#99E550', '#6ABE30', '#37946E', '#4B692F', '#524B24', '#323C39', '#3F3F74',
  '#306082', '#5B6EE1', '#639BFF', '#5FCDE4', '#CBDBFC', '#FFFFFF', '#9BADB7', '#847E87',
  '#696A6A', '#595652', '#76428A', '#AC3232', '#D95763', '#D77BBA', '#8F974A', '#8A6F30',
];
const RGB = DB32.map((hx) => [1, 3, 5].map((i) => parseInt(hx.slice(i, i + 2), 16)));
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

function nearest(r, g, b) {
  let best = 0; let bd = Infinity;
  for (let i = 0; i < RGB.length; i++) {
    const [R, G, B] = RGB[i];
    const d = (r - R) ** 2 * 0.3 + (g - G) ** 2 * 0.59 + (b - B) ** 2 * 0.11;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

// CORS'suz önbellek kopyasına takılırsa bir kez önbelleği atlayarak dener
function loadImage(url) {
  return loadOnce(url).catch(() => loadOnce(`${url}${url.includes('?') ? '&' : '?'}px=1`));
}

function loadOnce(url) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = url;
  });
}

function draw(img, w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true });
  const ir = img.naturalWidth / img.naturalHeight; const tr = w / h;
  let sx = 0; let sy = 0; let sw = img.naturalWidth; let sh = img.naturalHeight;
  if (ir > tr) { sw = sh * tr; sx = (img.naturalWidth - sw) / 2; } else { sh = sw / tr; sy = (img.naturalHeight - sh) / 2; }
  x.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  return { c, x };
}

const mem = new Map();

export function pixelate(url, w = 32, h = w) {
  if (!url) return Promise.resolve(null);
  const key = `px:${w}x${h}:${url}`;
  if (mem.has(key)) return mem.get(key);
  let cached = null;
  try { cached = sessionStorage.getItem(key); } catch { /* yok */ }
  const p = cached ? Promise.resolve(cached) : loadImage(url).then((img) => {
    const { c, x } = draw(img, w, h);
    const d = x.getImageData(0, 0, w, h);
    for (let i = 0; i < d.data.length; i += 4) {
      const px = (i / 4) % w; const py = Math.floor(i / 4 / w);
      const t = (BAYER[(py % 4) * 4 + (px % 4)] / 16 - 0.5) * 28;
      const n = nearest(d.data[i] + t, d.data[i + 1] + t, d.data[i + 2] + t);
      [d.data[i], d.data[i + 1], d.data[i + 2]] = RGB[n];
      d.data[i + 3] = 255;
    }
    x.putImageData(d, 0, 0);
    const out = c.toDataURL('image/png');
    try { sessionStorage.setItem(key, out); } catch { /* kota */ }
    return out;
  }).catch(() => url);
  mem.set(key, p);
  return p;
}

// Kartuş rengi için baskın palet rengi (siyah/beyaz/griler hariç)
const SKIP = new Set([0, 1, 14, 20, 21, 22, 23, 24, 25]);
export async function dominantColor(url, fallback = '#AC3232') {
  if (!url) return fallback;
  try {
    const img = await loadImage(url);
    const { x } = draw(img, 24, 24);
    const d = x.getImageData(0, 0, 24, 24).data;
    const count = new Array(DB32.length).fill(0);
    for (let i = 0; i < d.length; i += 4) count[nearest(d[i], d[i + 1], d[i + 2])]++;
    let best = -1; let bc = 0;
    count.forEach((n, i) => { if (!SKIP.has(i) && n > bc) { bc = n; best = i; } });
    return best >= 0 ? DB32[best] : fallback;
  } catch { return fallback; }
}

export function isDark(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return (r * 299 + g * 587 + b * 114) / 1000 < 110;
}
