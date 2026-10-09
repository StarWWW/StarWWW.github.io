// KONTROL ODASI — ortak parçalar: pencereler (onay/form), bildirimler, geri alınabilir silme,
// sürükle-bırak sıralama, seviye blokları, küçük biçimlendiriciler.
import { esc, API } from '../util.js';
import { getLang } from '../i18n.js';
import { pixelate } from '../pixelate.js';

export const L = (tr, en) => (getLang() === 'en' ? en : tr);
export const sfx = (name, o) => API.sfx?.play(name, o);
const locale = () => (getLang() === 'en' ? 'en-GB' : 'tr-TR');

// ---------- biçimlendiriciler ----------
export const num = (n) => Number(n || 0).toLocaleString(locale());
export const when = (iso) => (iso ? new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' }).format(new Date(iso)) : '—');
export function ago(iso) {
  const s = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (!Number.isFinite(s)) return '—';
  if (s < 60) return L(`${s} sn önce`, `${s}s ago`);
  if (s < 3600) return L(`${Math.floor(s / 60)} dk önce`, `${Math.floor(s / 60)}m ago`);
  if (s < 86400) return L(`${Math.floor(s / 3600)} sa önce`, `${Math.floor(s / 3600)}h ago`);
  return L(`${Math.floor(s / 86400)} gün önce`, `${Math.floor(s / 86400)}d ago`);
}
export const isSpPreview = (u) => /^https:\/\/p\.scdn\.co\//.test(String(u || ''));
export const isUrl = (u) => !u || /^https?:\/\/\S+$/i.test(String(u).trim());

// ---------- kapak küçük resimleri (piksel) ----------
export const artImg = (url, wide = false) => `<span class="ad-art${wide ? ' wide' : ''}"><img alt="" data-px="${esc(url || '')}"${wide ? ' data-wide="1"' : ''}></span>`;
export function hydrateArt(scope) {
  scope.querySelectorAll('img[data-px]').forEach((im) => {
    const url = im.dataset.px;
    im.removeAttribute('data-px');
    if (!url) return;
    (im.dataset.wide ? pixelate(url, 48, 22) : pixelate(url, 32)).then((src) => { if (src) im.src = src; });
  });
}

// ---------- katman ----------
let host = null;
export const setHost = (el) => { host = el; };
export const dialogOpen = () => Boolean(host?.querySelector('.ad-dlg'));

// ---------- bildirimler (sağ alt) ----------
export function note(msg, { type = 'info', action = null, ms = 3400, onTimeout = null, sound = true } = {}) {
  const box = host?.querySelector('.ad-notes');
  if (!box) return { close() {} };
  const el = document.createElement('div');
  el.className = `ad-note ${type}`;
  el.setAttribute('role', type === 'err' ? 'alert' : 'status');
  el.innerHTML = `<span class="ad-note-ico" aria-hidden="true">${type === 'ok' ? '✓' : type === 'err' ? '!' : '›'}</span>
    <span class="ad-note-msg"></span>
    ${action ? '<button type="button" class="ad-note-act" data-sfx="none"></button>' : ''}
    <button type="button" class="ad-note-x" data-sfx="none" aria-label="${esc(L('Kapat', 'Dismiss'))}">✕</button>
    <i class="ad-note-bar" style="animation-duration:${ms}ms" aria-hidden="true"></i>`;
  el.querySelector('.ad-note-msg').textContent = msg;
  let timer = 0;
  const close = () => { clearTimeout(timer); el.classList.add('out'); setTimeout(() => el.remove(), 220); };
  if (action) {
    const b = el.querySelector('.ad-note-act');
    b.textContent = action.label;
    b.addEventListener('click', () => { clearTimeout(timer); action.fn(); close(); });
  }
  el.querySelector('.ad-note-x').addEventListener('click', () => { if (onTimeout) onTimeout(); close(); });
  timer = setTimeout(() => { if (onTimeout) onTimeout(); close(); }, ms);
  box.append(el);
  while (box.children.length > 4) box.firstElementChild.remove();
  if (sound) sfx(type === 'ok' ? 'success' : type === 'err' ? 'error' : 'toast');
  return { close };
}
export const fail = (err, prefix = '') => note(`${prefix}${err?.message || err}`, { type: 'err', ms: 7000 });

// ---------- pencere: onay ya da form ----------
// fields: [{ key, label, value, type: text|textarea|number|url|select, options: [[value, label]], max, hint, placeholder, required }]
export function ask({ title, text = '', ok = L('TAMAM', 'OK'), cancel = L('VAZGEÇ', 'CANCEL'), danger = false, fields = null, wide = false }) {
  return new Promise((resolve) => {
    if (!host) { resolve(fields ? null : false); return; }
    const prevFocus = document.activeElement;
    const wrap = document.createElement('div');
    wrap.className = 'ad-dlg';
    const id = `dlg${Date.now()}`;
    const field = (f) => {
      const common = `id="${id}-${f.key}" name="${esc(f.key)}"${f.max ? ` maxlength="${f.max}"` : ''}${f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : ''}${f.required ? ' required' : ''}`;
      let input;
      if (f.type === 'textarea') input = `<textarea ${common} rows="${f.rows || 3}">${esc(f.value ?? '')}</textarea>`;
      else if (f.type === 'select') input = `<select ${common}>${f.options.map(([v, lb]) => `<option value="${esc(v)}"${String(v) === String(f.value) ? ' selected' : ''}>${esc(lb)}</option>`).join('')}</select>`;
      else input = `<input ${common} type="${f.type === 'number' ? 'number' : f.type === 'url' ? 'url' : 'text'}" value="${esc(f.value ?? '')}"${f.type === 'number' ? ` step="${f.step || 1}"${f.min != null ? ` min="${f.min}"` : ''}${f.maxv != null ? ` max="${f.maxv}"` : ''}` : ''} autocomplete="off" spellcheck="false">`;
      return `<label class="ad-fld${f.full ? ' full' : ''}" for="${id}-${f.key}"><span>${esc(f.label)}${f.max ? ` <em data-cnt="${esc(f.key)}"></em>` : ''}</span>${input}${f.hint ? `<small>${esc(f.hint)}</small>` : ''}</label>`;
    };
    wrap.innerHTML = `<form class="ad-dlg-box${danger ? ' danger' : ''}${wide ? ' wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="${id}-t" novalidate>
      <div class="ad-dlg-h"><b id="${id}-t">${esc(title)}</b><button type="button" class="ad-dlg-x" data-cancel data-sfx="close" aria-label="${esc(L('Kapat', 'Close'))}">✕</button></div>
      ${text ? `<p class="ad-dlg-p">${esc(text)}</p>` : ''}
      ${fields ? `<div class="ad-dlg-f">${fields.map(field).join('')}</div>` : ''}
      <p class="ad-dlg-err" hidden></p>
      <div class="ad-dlg-a"><button type="button" class="ad-b" data-cancel data-sfx="close">${esc(cancel)}</button><button type="submit" class="ad-b ${danger ? 'red' : 'acc'}" data-sfx="none">${esc(ok)}</button></div>
    </form>`;
    host.append(wrap);
    const form = wrap.querySelector('form');
    const counters = () => form.querySelectorAll('[data-cnt]').forEach((em) => {
      const inp = form.elements[em.dataset.cnt];
      em.textContent = `${inp.value.length}/${inp.maxLength}`;
    });
    counters();
    form.addEventListener('input', counters);
    const done = (v) => {
      wrap.classList.add('out');
      setTimeout(() => wrap.remove(), 160);
      prevFocus?.focus?.({ preventScroll: true });
      resolve(v);
    };
    form.addEventListener('click', (e) => { if (e.target.closest('[data-cancel]')) done(fields ? null : false); });
    wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) done(fields ? null : false); });
    form.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(fields ? null : false); return; }
      if (e.key === 'Tab') trapTab(e, form);
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!fields) { sfx(danger ? 'break' : 'enter'); done(true); return; }
      const out = {};
      for (const f of fields) {
        const v = String(form.elements[f.key].value ?? '').trim();
        const bad = (f.required && !v) ? L('Bu alan boş olamaz', 'This field is required')
          : (f.type === 'url' && !isUrl(v)) ? L('Geçerli bir https:// adresi yaz', 'Enter a valid https:// address')
            : (f.validate ? f.validate(v) : '');
        if (bad) {
          const err = form.querySelector('.ad-dlg-err');
          err.hidden = false; err.textContent = `${f.label}: ${bad}`;
          form.elements[f.key].focus();
          sfx('error');
          return;
        }
        out[f.key] = v;
      }
      sfx('enter');
      done(out);
    });
    sfx('open');
    requestAnimationFrame(() => (form.querySelector('input, textarea, select') || form.querySelector('[type="submit"]')).focus());
  });
}

// odak pencerenin içinde dönsün
export function trapTab(e, scope) {
  const items = [...scope.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled && x.offsetParent !== null);
  if (!items.length) return;
  const first = items[0]; const last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

// ---------- geri alınabilir silme ----------
// Satır hemen kaybolur; 8 sn içinde GERİ AL'a basılmazsa (ya da panel kapanırsa) veritabanından silinir.
const pending = new Set();
export function softDelete({ label, hide, restore, commit, ms = 8000 }) {
  hide();
  sfx('close');
  let done = false;
  const job = {
    async flush() {
      if (done) return;
      done = true; pending.delete(job); n.close();
      try {
        const r = await commit();
        if (r?.error) throw r.error;
      } catch (err) { restore(); fail(err, L('Silinemedi: ', 'Could not delete: ')); }
    },
  };
  pending.add(job);
  const n = note(`${label} — ${L('silindi', 'deleted')}`, {
    ms, sound: false, onTimeout: () => job.flush(),
    action: { label: L('GERİ AL', 'UNDO'), fn: () => { if (done) return; done = true; pending.delete(job); restore(); note(L('Geri alındı', 'Restored'), { type: 'ok' }); } },
  });
}
export const hasPending = () => pending.size > 0;
export const flushDeletes = () => Promise.all([...pending].map((j) => j.flush()));

// ---------- sürükle-bırak sıralama ----------
// list içindeki [data-id] satırlar [data-drag] tutamağından sürüklenir; klavyede tutamak + ↑/↓.
export function dragSort(list, onDrop) {
  let drag = null;
  const rows = () => [...list.querySelectorAll(':scope > [data-id]')];
  const order = () => rows().map((r) => r.dataset.id);
  list.addEventListener('pointerdown', (e) => {
    const handle = e.target.closest('[data-drag]');
    if (!handle || e.button > 0 || list.dataset.locked) return;
    const row = handle.closest('[data-id]');
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    drag = { row, handle, before: order(), y: e.clientY, raf: 0, vy: 0 };
    row.classList.add('dragging');
    list.classList.add('sorting');
    sfx('select');
  });
  list.addEventListener('pointermove', (e) => {
    if (!drag) return;
    drag.y = e.clientY;
    const over = rows().find((r) => {
      if (r === drag.row) return false;
      const b = r.getBoundingClientRect();
      return e.clientY > b.top && e.clientY < b.bottom;
    });
    if (over) {
      const b = over.getBoundingClientRect();
      const after = e.clientY > b.top + b.height / 2;
      const ref = after ? over.nextElementSibling : over;
      if (ref !== drag.row && drag.row.nextElementSibling !== ref) { list.insertBefore(drag.row, ref); sfx('hover', { k: rows().indexOf(drag.row) % 7 }); }
    }
    // kenara yaklaşınca liste kendiliğinden kaysın
    const lb = list.getBoundingClientRect();
    drag.vy = e.clientY < lb.top + 40 ? -10 : e.clientY > lb.bottom - 40 ? 10 : 0;
    if (drag.vy && !drag.raf) {
      const tick = () => { if (!drag || !drag.vy) { if (drag) drag.raf = 0; return; } list.scrollTop += drag.vy; drag.raf = requestAnimationFrame(tick); };
      drag.raf = requestAnimationFrame(tick);
    }
  });
  const end = () => {
    if (!drag) return;
    const { row, before } = drag;
    cancelAnimationFrame(drag.raf);
    drag = null;
    row.classList.remove('dragging');
    list.classList.remove('sorting');
    const after = order();
    if (after.join() !== before.join()) { sfx('thud'); onDrop(after, before); }
  };
  list.addEventListener('pointerup', end);
  list.addEventListener('pointercancel', end);
  list.addEventListener('keydown', (e) => {
    const handle = e.target.closest('[data-drag]');
    if (!handle || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') || list.dataset.locked) return;
    e.preventDefault();
    const row = handle.closest('[data-id]');
    const before = order();
    const sib = e.key === 'ArrowUp' ? row.previousElementSibling : row.nextElementSibling;
    if (!sib?.dataset.id) return;
    if (e.key === 'ArrowUp') list.insertBefore(row, sib); else list.insertBefore(sib, row);
    handle.focus();
    sfx('select');
    onDrop(order(), before);
  });
}

// sadece yeri değişen satırların sort'unu yazar
export async function saveOrder(sb, table, ids, prev) {
  const jobs = ids.map((id, k) => (prev[k] === id ? null : sb.from(table).update({ sort: k }).eq('id', id))).filter(Boolean);
  const res = await Promise.all(jobs);
  const err = res.find((r) => r.error)?.error;
  if (err) throw err;
  return jobs.length;
}

// ---------- seviye blokları (0–10) ----------
export const levelHTML = (v, label) => `<span class="ad-lv" role="slider" tabindex="0" aria-valuemin="0" aria-valuemax="10" aria-valuenow="${v}" aria-label="${esc(label)}" data-lv="${v}">${Array.from({ length: 10 }, (_, i) => `<i data-k="${i + 1}"${i < v ? ' class="on"' : ''}></i>`).join('')}</span>`;
export function setLevel(el, v) {
  el.dataset.lv = v;
  el.setAttribute('aria-valuenow', v);
  el.querySelectorAll('i').forEach((c, i) => c.classList.toggle('on', i < v));
}
