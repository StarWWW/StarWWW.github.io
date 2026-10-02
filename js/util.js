// Modüllerin birbirine (ve terminale) açtığı küçük kayıt defteri
export const API = {};

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const store = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : JSON.parse(v);
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* gizli sekme vb. */ }
  },
};

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(kid));
  return el;
}

export function toast(msg, ms = 2600) {
  const root = document.getElementById('toasts');
  if (!root) return;
  const t = h('div', { class: 'toast' }, msg);
  root.append(t);
  setTimeout(() => t.remove(), ms);
}

export const fmtDur = (ms) => {
  const s = Math.max(0, Math.round((ms || 0) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Deterministik rastgele (duvar çizimleri her tarayıcıda aynı görünsün diye)
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashStr(s) {
  let h1 = 2166136261;
  for (let i = 0; i < s.length; i++) { h1 ^= s.charCodeAt(i); h1 = Math.imul(h1, 16777619); }
  return h1 >>> 0;
}

export const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
  const r = (Math.random() * 16) | 0;
  return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
}));

export function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const ta = h('textarea', { style: { position: 'fixed', opacity: '0' } }, text);
  document.body.append(ta); ta.select();
  try { document.execCommand('copy'); } finally { ta.remove(); }
  return Promise.resolve();
}

// Basit küfür filtresi; asıl koruma admin silmesi.
const BAD = ['amk', 'aq', 'orospu', 'piç', 'sik', 'yarrak', 'göt', 'ananı', 'fuck', 'shit', 'nigger', 'faggot', 'cunt'];
export function cleanText(s) {
  let out = String(s || '').replace(/\s+/g, ' ').trim();
  for (const w of BAD) out = out.replace(new RegExp(`(^|[^\\p{L}])(${w})(?=[^\\p{L}]|$)`, 'giu'), (m, a, b) => a + '*'.repeat(b.length));
  return out;
}
