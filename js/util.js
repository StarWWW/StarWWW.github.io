// Modüllerin birbirine (ve terminale) açtığı küçük kayıt defteri
export const API = {};

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// ---------- çerez / depolama izni (KVKK + GDPR) ----------
// Zorunlu anahtarlar her zaman yazılır. Diğerleri (fonksiyonel) ancak ziyaretçi izin verdiyse tarayıcıya yazılır;
// izin yoksa sadece bu sekmenin hafızasında tutulur ve sayfa kapanınca kaybolur.
export const CONSENT_KEY = 'star.consent';
export const CONSENT_VERSION = 1;
export const CONSENT_MAX_AGE = 365 * 86400000; // 12 ayda bir yeniden sorulur
const NECESSARY_KEYS = new Set([CONSENT_KEY, 'star.motion', 'star.motion.asked', 'star.cid', 'star.gb.last', 'star.booted']);
const RAW_KEYS = new Set(['star.lang', 'star.mode', 'star.motion']); // <head>'deki betik bunları ham metin olarak okur
export const keyCategory = (key) => (NECESSARY_KEYS.has(key) ? 'necessary' : 'functional');
export function consentState() {
  try {
    const c = JSON.parse(localStorage.getItem(CONSENT_KEY) || 'null');
    if (!c || c.v !== CONSENT_VERSION || !(Date.now() - Date.parse(c.ts) < CONSENT_MAX_AGE)) return null;
    return c;
  } catch { return null; }
}
export const allowed = (cat) => cat === 'necessary' || Boolean(consentState()?.[cat]);
const memory = new Map();
const encode = (key, value) => (RAW_KEYS.has(key) ? String(value) : JSON.stringify(value));
const decode = (key, raw) => (RAW_KEYS.has(key) ? raw : JSON.parse(raw));

export const store = {
  get(key, fallback = null) {
    if (!allowed(keyCategory(key))) return memory.has(key) ? memory.get(key) : fallback;
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : decode(key, v);
    } catch { return fallback; }
  },
  set(key, value) {
    if (!allowed(keyCategory(key))) { memory.set(key, value); return; }
    try { localStorage.setItem(key, encode(key, value)); } catch { /* gizli sekme vb. */ }
  },
};

// izin verilince bu sekmede biriken tercihleri kalıcı hale getir
export function flushStore() {
  memory.forEach((value, key) => {
    if (!allowed(keyCategory(key))) return;
    try { localStorage.setItem(key, encode(key, value)); } catch { /* yok */ }
    memory.delete(key);
  });
}
// izin geri çekilince izinsiz kalan anahtarları sil (değerleri bu sekmede kalmaya devam eder)
export function purgeStore() {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith('star.') && !allowed(keyCategory(k))).forEach((k) => {
      try { memory.set(k, decode(k, localStorage.getItem(k))); } catch { /* bozuk değer */ }
      localStorage.removeItem(k);
    });
  } catch { /* yok */ }
}

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

export function toast(msg, ms = 2600, { sound = true } = {}) {
  const root = document.getElementById('toasts');
  if (!root) return;
  if (sound) API.sfx?.play('toast');
  const t = h('div', { class: 'toast' }, msg);
  root.append(t);
  setTimeout(() => t.remove(), ms);
}

// İsim büyük harfe çevrilirken doğru dil: Türkçe harf varsa tr, yoksa en (JavaScript → JAVASCRİPT olmasın)
export const nameLang = (s) => (/[çğıöşüÇĞİÖŞÜ]/.test(String(s || '')) ? 'tr' : 'en');

export const fmtDur = (ms) => {
  const s = Math.max(0, Math.round((ms || 0) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// Ziyaretçinin FX seçimi (html[data-motion]) — işletim sistemi tercihini de içerir
export const reducedMotion = () => document.documentElement.dataset.motion === 'reduce';

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
  // görünmez / yön değiştiren karakterler atılır (veritabanı da kabul etmez: supabase/migrations/004_guvenlik.sql)
  let out = String(s || '').replace(/\s+/g, ' ').replace(/[\u0000-\u001F\u007F-\u009F­​-‏‪-‮⁠-⁩﻿]/g, '').trim();
  for (const w of BAD) out = out.replace(new RegExp(`(^|[^\\p{L}])(${w})(?=[^\\p{L}]|$)`, 'giu'), (m, a, b) => a + '*'.repeat(b.length));
  return out;
}
