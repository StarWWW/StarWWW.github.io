// KONTROL ODASI — sadece star. Pano, müzik, oyunlar, yetenekler, duvar, defter, skorlar.
// Yazma yetkisini Supabase RLS korur (admins tablosu); bu dosyalar sadece arayüz.
// Sayfalar js/admin/ altında; her biri { key, icon, label, sub, mount(el, ctx) } dışa aktarır.
import { getSupabase } from './supabase.js';
import { esc, toast, store, API } from './util.js';
import { onLang, getLang, setLang } from './i18n.js';
import { L, sfx, setHost, note, ask, trapTab, dialogOpen, hasPending, flushDeletes, num, icon } from './admin/ui.js';
import { summary } from './admin/data.js';
import dash from './admin/dash.js';
import music from './admin/music.js';
import games from './admin/games.js';
import skills from './admin/skills.js';
import wall from './admin/wall.js';
import book from './admin/book.js';
import scores from './admin/scores.js';

const PAGES = [dash, music, games, skills, wall, book, scores];
const TAB_KEY = 'star.admin.tab';

let root = null;
let sb = null;
let user = null;
let cur = null;
let inst = null;
let live = null;
let liveOn = false;
let lastFocus = null;
let sum = null;
let badgeTimer = 0;
let opening = null;

// ---------- teşhis ----------
// Panel beklenmedik şekilde kaybolursa (söküldü, gizlendi, kaydı, üstü örtüldü…) ne olduğunu ekranda gösterir.
// Son olaylar API.adminTrace() ile de okunabilir.
const TRACE = [];
const T0 = performance.now();
function trace(msg) {
  TRACE.push(`${String(Math.round(performance.now() - T0)).padStart(7)} ms  ${msg}`);
  if (TRACE.length > 80) TRACE.shift();
}
API.adminTrace = () => TRACE.join('\n');
const describe = (el) => (el ? `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/).slice(0, 3).join('.')}` : ''}` : '—');
const onWinErr = (e) => trace(`HATA: ${e.message || e.error || e} @ ${String(e.filename || '').split('/').pop()}:${e.lineno || ''}`);
const onWinRej = (e) => trace(`HATA (promise): ${e.reason?.message || e.reason}`);
const onFocusIn = (e) => { if (root && !root.contains(e.target)) trace(`odak panelin dışına gitti: ${describe(e.target)}`); };
const onVis = () => trace(`sekme ${document.visibilityState}`);
let watchTimer = 0;
let watchSince = 0;
let diagShown = false;
const seen = new Set();
function watch() {
  if (!root) { clearInterval(watchTimer); return; }
  if (document.visibilityState !== 'visible') return;
  const problems = [];
  if (!document.body.contains(root)) {
    problems.push('panel sayfadan söküldü — geri takıldı');
    document.body.append(root);
  }
  const cs = getComputedStyle(root);
  if (cs.display === 'none' || cs.visibility !== 'visible') problems.push(`panel gizlendi (display: ${cs.display}, visibility: ${cs.visibility})`);
  if (performance.now() - watchSince > 2000 && Number(cs.opacity) < 0.05) problems.push(`panel saydam kaldı (opacity ${cs.opacity})`);
  if (root.scrollTop || root.scrollLeft) {
    problems.push(`panel kaydı (${root.scrollLeft}, ${root.scrollTop}) — sıfırlandı`);
    root.scrollTop = 0; root.scrollLeft = 0;
  }
  const shell = root.querySelector('.ko-shell, .ko-gate, .ko-boot');
  if (!shell) problems.push(`panelin içi boşaldı (${root.children.length} öğe: ${[...root.children].map(describe).join(', ') || 'yok'})`);
  else {
    const b = shell.getBoundingClientRect();
    if (b.width < 40 || b.height < 40 || b.bottom < 0 || b.right < 0 || b.top > innerHeight || b.left > innerWidth) problems.push(`panel ekranın dışında (${Math.round(b.left)}, ${Math.round(b.top)}, ${Math.round(b.width)}×${Math.round(b.height)})`);
    if (performance.now() - watchSince > 2000 && Number(getComputedStyle(shell).opacity) < 0.05) problems.push('panel içeriği saydam kaldı');
  }
  const hit = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
  if (hit && !root.contains(hit) && !hit.closest('.boot, .pxswap')) problems.push(`panelin üstünde başka bir şey var: ${describe(hit)} (z-index ${getComputedStyle(hit).zIndex})`);
  if (!problems.length) return;
  // aynı sorun her yarım saniyede bir yazılmasın
  const fresh = problems.filter((x) => { const k = x.replace(/[\d.,-]+/g, '#'); if (seen.has(k)) return false; seen.add(k); return true; });
  if (!fresh.length) return;
  fresh.forEach((x) => trace(`SORUN: ${x}`));
  console.warn('[kontrol odası] teşhis', problems, `\n${TRACE.join('\n')}`);
  // kendiliğinden düzeltilenler (söküldü → geri takıldı, kaydı → sıfırlandı) sadece günlüğe yazılır
  const serious = problems.filter((x) => !/geri takıldı|sıfırlandı/.test(x));
  if (serious.length) showDiag(serious);
}
function startWatch() {
  clearInterval(watchTimer);
  watchSince = performance.now();
  diagShown = false;
  seen.clear();
  watchTimer = setInterval(watch, 500);
}
function showDiag(problems) {
  if (diagShown || !root) return;
  diagShown = true;
  const box = document.createElement('div');
  box.className = 'ko-diag';
  box.innerHTML = `<b>${esc(L('TEŞHİS — panelde beklenmedik bir şey oldu', 'DIAGNOSIS — something unexpected happened to the panel'))}</b>
    <p>${esc(L('Bunun ekran görüntüsünü Claude\'a gönder:', 'Send a screenshot of this to Claude:'))}</p>
    <ul>${problems.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    <pre>${esc(TRACE.slice(-30).join('\n'))}</pre>
    <span><button type="button" data-copy>${esc(L('KOPYALA', 'COPY'))}</button><button type="button" data-x>${esc(L('KAPAT', 'CLOSE'))}</button></span>`;
  box.querySelector('[data-copy]').addEventListener('click', () => navigator.clipboard?.writeText(`${problems.join('\n')}\n\n${TRACE.join('\n')}`));
  box.querySelector('[data-x]').addEventListener('click', () => box.remove());
  root.append(box);
}

// kırık görseller (CSP satır içi onerror'a izin vermez)
document.addEventListener('error', (e) => {
  const im = e.target;
  if (im?.tagName !== 'IMG' || !im.closest?.('.ko')) return;
  if (im.dataset.fb === 'remove') im.remove(); else im.removeAttribute('src');
}, true);

function loadCSS() {
  if (document.querySelector('link[href="css/admin.css"]')) return Promise.resolve();
  return new Promise((res) => {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = 'css/admin.css';
    l.onload = res; l.onerror = res;
    document.head.append(l);
  });
}

function makeRoot() {
  if (root) return;
  lastFocus = document.activeElement;
  root = document.createElement('div');
  root.className = 'ko';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', L('Kontrol odası', 'Control room'));
  root.setAttribute('data-lenis-prevent', '');
  document.body.append(root);
  setHost(root);
  trace('panel açıldı');
  window.addEventListener('error', onWinErr);
  window.addEventListener('unhandledrejection', onWinRej);
  document.addEventListener('focusin', onFocusIn);
  document.addEventListener('visibilitychange', onVis);
  startWatch();
  API.fx?.stopScroll();
  document.documentElement.style.overflow = 'hidden';
  root.addEventListener('keydown', onKey);
  window.addEventListener('keydown', onStrayKey, true);
  window.addEventListener('beforeunload', guardUnload);
  sfx('open');
}

export function openAdmin() {
  // aynı anda iki kez çağrılırsa (ör. adres + terminal) tek açılış olsun; açık panel silinip baştan çizilmesin
  if (opening) { trace('ikinci açma çağrısı — bekleyen açılış kullanıldı'); return opening; }
  if (root?.querySelector('.ko-shell')) { trace('panel zaten açık'); return Promise.resolve(); }
  opening = doOpen().finally(() => { opening = null; });
  return opening;
}
async function doOpen() {
  trace('açılıyor');
  sb = await getSupabase();
  if (!sb) { toast(L('Supabase ayarlanmamış — js/config.js', 'Supabase is not configured — js/config.js')); return; }
  await loadCSS();
  makeRoot();
  root.innerHTML = `<div class="ko-boot"><span class="ko-spin" aria-hidden="true"></span>${esc(L('KİMLİK KONTROL EDİLİYOR…', 'CHECKING WHO YOU ARE…'))}</div>`;
  try {
    const authError = readAuthError();
    const { data: { session } } = await sb.auth.getSession();
    cleanAuthUrl();
    user = session?.user || null;
    trace(`oturum: ${user ? 'var' : 'yok'}`);
    if (!root) return;
    if (!user) { renderLogin(authError); return; }
    const { data: adm, error: admErr } = await sb.from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
    trace(`yönetici kontrolü: ${adm ? 'evet' : 'hayır'}${admErr ? ` (${admErr.message})` : ''}`);
    if (!root) return;
    if (!adm) { renderNotAdmin(); return; }
    renderShell();
  } catch (err) { renderCrash(err); }
}

// Yerel test için: sahte bir istemciyle paneli açar
export async function __mount(client, fakeUser, startTab = 'dash') {
  // test kancası: sadece yerel geliştirmede
  if (!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) throw new Error('__mount sadece yerelde');
  sb = client; user = fakeUser; cur = null;
  store.set(TAB_KEY, startTab);
  await loadCSS();
  makeRoot();
  try { renderShell(); } catch (err) { renderCrash(err); }
}

export async function closeAdmin(force = false) {
  if (!root) return true;
  trace(`kapatma istendi${force ? ' (zorla)' : ''} ← ${(new Error().stack || '').split('\n').slice(2, 5).map((x) => x.trim().replace(/^at /, '').replace(location.origin, '')).join(' ← ')}`);
  if (!force && inst?.dirty?.() && !(await ask({ title: L('KAYDEDİLMEMİŞ DEĞİŞİKLİK', 'UNSAVED CHANGES'), text: L('Kaydetmediğin değişiklikler var. Yine de kapatılsın mı?', 'You have unsaved changes. Close anyway?'), ok: L('KAPAT', 'CLOSE'), danger: true }))) return false;
  await flushDeletes();
  inst?.unmount?.();
  inst = null; cur = null;
  if (live) { sb?.removeChannel?.(live); live = null; liveOn = false; }
  clearTimeout(badgeTimer);
  window.removeEventListener('keydown', onStrayKey, true);
  window.removeEventListener('beforeunload', guardUnload);
  window.removeEventListener('error', onWinErr);
  window.removeEventListener('unhandledrejection', onWinRej);
  document.removeEventListener('focusin', onFocusIn);
  document.removeEventListener('visibilitychange', onVis);
  clearInterval(watchTimer);
  trace('panel kapandı');
  sfx('close');
  root.remove();
  root = null;
  setHost(null);
  API.fx?.startScroll();
  document.documentElement.style.overflow = '';
  cleanAuthUrl();
  lastFocus?.focus?.();
  return true;
}

export async function logout() {
  sb = sb || await getSupabase();
  if (root && !(await closeAdmin())) return;
  await sb?.auth.signOut();
}

function guardUnload(e) {
  if (hasPending() || inst?.dirty?.()) { e.preventDefault(); e.returnValue = ''; }
}

// GitHub/Supabase dönüşündeki hata (?error_description=... ya da #error_description=...)
function readAuthError() {
  const params = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  const msg = params.get('error_description') || hash.get('error_description');
  return msg ? msg.replace(/\+/g, ' ') : null;
}

// Giriş dönüşünden kalan ?admin, ?code, #error... parçalarını adres çubuğundan temizler
function cleanAuthUrl() {
  const params = new URLSearchParams(location.search);
  ['admin', 'code', 'error', 'error_code', 'error_description', 'state'].forEach((k) => params.delete(k));
  const q = params.toString();
  history.replaceState(null, '', `${location.pathname}${q ? `?${q}` : ''}`);
}

// ---------- giriş ekranları ----------
function gate(inner) {
  root.innerHTML = `<div class="ko-gate">
    <button type="button" class="ko-gate-x" data-close data-sfx="none" aria-label="${esc(L('Kapat', 'Close'))}">✕</button>
    <div class="ko-gate-box">
      <div class="ko-gate-top"><span>${icon('lock', 4)}</span><b>${esc(L('KONTROL ODASI', 'CONTROL ROOM'))}</b><small>// ${esc(L('SADECE STAR', 'STAR ONLY'))}</small></div>
      ${inner}
    </div>
  </div><div class="ko-notes" aria-live="polite"></div>`;
  root.querySelector('[data-close]').addEventListener('click', () => closeAdmin(true));
}

function renderLogin(authError) {
  const back = `${location.origin}${location.pathname}`;
  gate(`<h2>${esc(L('KİMSİN?', 'WHO ARE YOU?'))}</h2>
    <p>${esc(L('Bu oda sadece star\'a açık. GitHub hesabınla giriş yap.', 'This room is star-only. Sign in with your GitHub account.'))}</p>
    ${authError ? `<p class="ko-gate-err">${esc(L('Giriş tamamlanamadı', 'Sign-in failed'))}: ${esc(authError)}</p>` : ''}
    <button type="button" class="ko-b acc big" data-gh>${esc(L('GITHUB İLE GİR', 'SIGN IN WITH GITHUB'))} ↗</button>
    <details class="ko-gate-help"><summary>${esc(L('GitHub\'dan sonra yanlış adrese mi düşüyorsun?', 'Landing on the wrong address after GitHub?'))}</summary>
      <p>${esc(L('Supabase → Authentication → URL Configuration → Redirect URLs listesine şunu ekle:', 'Add this to Supabase → Authentication → URL Configuration → Redirect URLs:'))}</p><code>${esc(back)}**</code></details>`);
  const gh = root.querySelector('[data-gh]');
  gh.addEventListener('click', async () => {
    gh.disabled = true;
    const { error } = await sb.auth.signInWithOAuth({ provider: 'github', options: { redirectTo: `${back}?admin` } });
    if (error) { gh.disabled = false; note(error.message, { type: 'err' }); }
  });
  gh.focus();
}

// Panel çizilemezse boş ekran kalmasın: ne olduğunu ve çaresini göster
function renderCrash(err) {
  console.error('[kontrol odası]', err);
  trace(`ÇÖKTÜ: ${err?.message || err}`);
  if (!root) return;
  inst = null; cur = null;
  gate(`<h2>${esc(L('BİR ŞEY TERS GİTTİ', 'SOMETHING BROKE'))}</h2>
    <p>${esc(L('Panel çizilemedi. Yeni bir yayından hemen sonra tarayıcı bazı eski dosyaları önbellekte tutuyor olabilir (GitHub Pages 10 dakika saklar): sayfayı Ctrl+F5 ile yenile.', 'The panel could not be drawn. Right after a new deploy the browser may still hold some old files in its cache (GitHub Pages keeps them for 10 minutes): reload with Ctrl+F5.'))}</p>
    <code>${esc(err?.message || err)}</code>
    <button type="button" class="ko-b acc big" data-reload>${esc(L('SAYFAYI YENİLE', 'RELOAD THE PAGE'))} ↻</button>`);
  root.querySelector('[data-reload]').addEventListener('click', () => location.reload());
}

function renderNotAdmin() {
  gate(`<h2>${esc(L('YETKİN YOK', 'NO ACCESS'))}</h2>
    <p>${esc(L('Giriş yaptın ama bu hesap yönetici listesinde değil. Sen star isen aşağıdaki satırı Supabase SQL Editor\'da çalıştır, sonra sayfayı yenile:', 'You are signed in, but this account is not an admin. If you are star, run the line below in the Supabase SQL Editor, then reload:'))}</p>
    <code>insert into public.admins (user_id) values ('${esc(user.id)}');</code>
    <button type="button" class="ko-b" data-out>${esc(L('ÇIKIŞ YAP', 'LOG OUT'))}</button>`);
  root.querySelector('[data-out]').addEventListener('click', logout);
}

// ---------- kabuk ----------
function renderShell() {
  trace('panel çiziliyor');
  const meta = user?.user_metadata || {};
  const name = meta.user_name || meta.preferred_username || user?.email || 'star';
  root.innerHTML = `<div class="ko-shell">
    <aside class="ko-side">
      <div class="ko-brand"><span class="ko-brand-ico">${icon('star', 3)}</span><span><b>${esc(L('KONTROL ODASI', 'CONTROL ROOM'))}</b><small>// ${esc(L('SADECE STAR', 'STAR ONLY'))}</small></span></div>
      <nav class="ko-nav" aria-label="${esc(L('Bölümler', 'Sections'))}">
        ${PAGES.map((p, i) => `<button type="button" data-go="${p.key}" data-sfx="none" aria-current="false">
          <span class="ko-nav-ico">${icon(p.icon, 2)}</span><span class="ko-nav-n">0${i}</span><span class="ko-nav-l">${esc(p.label())}</span>
          <em class="ko-badge" data-badge="${p.key}" hidden></em><kbd aria-hidden="true">${i}</kbd></button>`).join('')}
      </nav>
      <div class="ko-me">
        ${meta.avatar_url ? `<img src="${esc(meta.avatar_url)}" alt="" data-fb="remove">` : `<span class="ko-me-ph">${icon('cursor', 2)}</span>`}
        <span class="ko-me-t"><small>${esc(L('GİRİLDİ', 'SIGNED IN'))} · GITHUB</small><b>@${esc(name)}</b></span>
        <span class="ko-me-a"><button type="button" class="ko-me-b" data-adlang data-sfx="select" title="${esc(L('Switch to English', 'Türkçeye geç'))}">${getLang() === 'en' ? 'TR' : 'EN'}</button><button type="button" class="ko-me-b" data-logout data-sfx="none" title="${esc(L('Çıkış yap', 'Log out'))}">${esc(L('ÇIKIŞ', 'LOG OUT'))}</button></span>
      </div>
    </aside>
    <main class="ko-main">
      <header class="ko-head">
        <div class="ko-head-t"><span class="ko-head-n" id="koNum"></span><div><h2 id="koTitle"></h2><p id="koSub"></p></div></div>
        <div class="ko-head-a">
          <button type="button" class="ko-b ghost" data-keys data-sfx="none" title="${esc(L('Klavye kısayolları', 'Keyboard shortcuts'))}">?</button>
          <button type="button" class="ko-b ghost" data-close data-sfx="none">${esc(L('SİTEYE DÖN', 'BACK TO SITE'))} ✕</button>
        </div>
      </header>
      <div class="ko-page" id="koPage"></div>
    </main>
    <footer class="ko-status" aria-live="off">
      <span data-live><i></i>${esc(L('BAĞLANIYOR', 'CONNECTING'))}</span>
      <span data-ping></span>
      <span class="ko-status-r">${esc(L('KISAYOLLAR', 'SHORTCUTS'))}: <kbd>0</kbd>–<kbd>6</kbd> ${esc(L('SAYFA', 'PAGE'))} · <kbd>/</kbd> ${esc(L('ARA', 'SEARCH'))} · <kbd>?</kbd> ${esc(L('YARDIM', 'HELP'))} · <kbd>ESC</kbd> ${esc(L('KAPAT', 'CLOSE'))}</span>
    </footer>
  </div>
  <div class="ko-notes" aria-live="polite"></div>`;
  root.querySelector('.ko-nav').addEventListener('click', (e) => { const b = e.target.closest('[data-go]'); if (b) go(b.dataset.go); });
  root.querySelector('[data-logout]').addEventListener('click', logout);
  root.querySelector('[data-adlang]').addEventListener('click', () => setLang(getLang() === 'en' ? 'tr' : 'en'));
  root.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => closeAdmin()));
  root.querySelector('[data-keys]').addEventListener('click', showKeys);
  const start = store.get(TAB_KEY, 'dash');
  go(PAGES.some((p) => p.key === start) ? start : 'dash', true);
  connectLive();
  refreshBadges();
  ping();
}

const ctx = () => ({ sb, user, go, refreshBadges, summary: () => sum, isLive: () => liveOn });

async function go(key, force = false) {
  if (!root || (key === cur && !force)) return;
  if (inst?.dirty?.() && !(await ask({ title: L('KAYDEDİLMEMİŞ DEĞİŞİKLİK', 'UNSAVED CHANGES'), text: L('Bu sayfada kaydetmediğin değişiklikler var. Kaydetmeden geçilsin mi?', 'This page has unsaved changes. Leave without saving?'), ok: L('KAYDETMEDEN GEÇ', 'LEAVE'), danger: true }))) return;
  const page = PAGES.find((p) => p.key === key);
  if (!page) return;
  inst?.unmount?.();
  inst = null;
  cur = key;
  store.set(TAB_KEY, key);
  const i = PAGES.indexOf(page);
  root.querySelectorAll('[data-go]').forEach((b) => b.setAttribute('aria-current', b.dataset.go === key ? 'page' : 'false'));
  root.querySelector('#koNum').textContent = `0${i}`;
  root.querySelector('#koTitle').textContent = page.label();
  root.querySelector('#koSub').textContent = page.sub();
  // her sayfa yeni bir kutuda açılır: eski sayfanın dinleyicileri onunla birlikte gider
  const holder = root.querySelector('#koPage');
  holder.className = `ko-page ko-p-${key}`;
  holder.scrollTop = 0;
  const el = document.createElement('div');
  el.className = 'ko-pagein';
  holder.replaceChildren(el);
  if (!force) sfx('slide');
  trace(`sayfa: ${key}`);
  try {
    const made = await page.mount(el, ctx());
    if (cur === key) inst = made || null; else made?.unmount?.();
    trace(`sayfa hazır: ${key}`);
  } catch (err) {
    trace(`sayfa hatası (${key}): ${err?.message || err}`);
    el.innerHTML = `<div class="ko-err">${esc(L('Sayfa yüklenemedi', 'Could not load the page'))}: ${esc(err?.message || err)}</div>`;
  }
}

// ---------- canlı bağlantı + rozetler ----------
function connectLive() {
  if (live || !sb?.channel) return;
  const onChange = (table) => (p) => {
    inst?.live?.(table, p.eventType, p.eventType === 'DELETE' ? p.old : p.new);
    clearTimeout(badgeTimer);
    badgeTimer = setTimeout(refreshBadges, 4000);
  };
  live = sb.channel('admin-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'guestbook' }, onChange('guestbook'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'wall_strokes' }, onChange('wall_strokes'))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'wall_buffs' }, onChange('wall_buffs'))
    .subscribe((status) => {
      trace(`canlı bağlantı: ${status}`);
      liveOn = status === 'SUBSCRIBED';
      const el = root?.querySelector('[data-live]');
      if (!el) return;
      el.classList.toggle('on', liveOn);
      el.lastChild.textContent = liveOn ? L('CANLI', 'LIVE') : L('CANLI BAĞLANTI YOK', 'NOT LIVE');
    });
}

async function refreshBadges() {
  if (!root || !sb) return;
  try { sum = await summary(sb); } catch { return; }
  const set = (key, n, tone = '') => {
    const b = root?.querySelector(`[data-badge="${key}"]`);
    if (!b) return;
    b.hidden = !n;
    b.textContent = n > 99 ? '99+' : String(n);
    b.className = `ko-badge ${tone}`;
  };
  set('music', sum.previewTodo, 'warn');
  set('skills', sum.skills - sum.rated);
  set('wall', sum.wallDay);
  set('book', sum.notesDay, 'new');
  set('scores', sum.suspicious, 'warn');
  inst?.summary?.(sum);
}

async function ping() {
  const el = root?.querySelector('[data-ping]');
  if (!el) return;
  const t0 = performance.now();
  const { error } = await sb.from('skills').select('id', { count: 'exact', head: true });
  const ms = Math.round(performance.now() - t0);
  if (!root) return;
  el.textContent = error ? `SUPABASE: ${L('HATA', 'ERROR')}` : `SUPABASE ${num(ms)} MS`;
  el.classList.toggle('bad', Boolean(error));
}

// ---------- klavye ----------
function showKeys() {
  ask({
    title: L('KLAVYE KISAYOLLARI', 'KEYBOARD SHORTCUTS'),
    text: L(
      '0–6: sayfalar arasında geç · /: sayfadaki aramaya git · Ctrl+S: kaydet (yetenekler) · ⠿ tutamağında ↑/↓: sırayı değiştir · Esc: pencereyi / paneli kapat · Duvarda Shift+tık: seçime ekle',
      '0–6: switch pages · /: jump to the page search · Ctrl+S: save (skills) · ↑/↓ on a ⠿ handle: reorder · Esc: close the dialog / panel · Shift+click on the wall: add to selection',
    ),
    ok: L('ANLADIM', 'GOT IT'),
    cancel: L('KAPAT', 'CLOSE'),
  });
}

// Panel açıkken tuşlar arkadaki siteye gitmesin (terminal, DRUG şifreleri…).
// Odak panelin dışına düştüyse (boş yere tıklandı) tuş yine panelin kısayolu sayılır.
function onStrayKey(e) {
  if (!root || root.contains(e.target)) return;
  e.stopPropagation();
  if (e.key === 'Tab') { e.preventDefault(); root.querySelector('button, input, [tabindex]')?.focus(); return; }
  onKey(e);
}

function onKey(e) {
  e.stopPropagation();
  if (dialogOpen()) return; // pencere kendi tuşlarını yönetir
  if (e.key === 'Tab') { trapTab(e, root); return; }
  const typing = e.target.closest?.('input, textarea, select, [contenteditable="true"]');
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    if (inst?.save) { e.preventDefault(); inst.save(); }
    return;
  }
  if (e.key === 'Escape') {
    trace(`Esc (${describe(e.target)})`);
    if (inst?.escape?.()) return; // sayfa önce kendi açık parçasını kapatır (çekmece vb.)
    if (typing && e.target.value) { e.target.value = ''; e.target.dispatchEvent(new Event('input', { bubbles: true })); return; }
    closeAdmin();
    return;
  }
  if (typing || e.ctrlKey || e.metaKey || e.altKey || !user || !root.querySelector('.ko-shell')) return;
  if (/^[0-6]$/.test(e.key)) { e.preventDefault(); go(PAGES[Number(e.key)].key); return; }
  if (e.key === '/') { e.preventDefault(); inst?.focusSearch?.(); return; }
  if (e.key === '?') { e.preventDefault(); showKeys(); }
}

// dil değişince açık sayfa yeni dille baştan çizilir
onLang(() => {
  if (!root || !root.querySelector('.ko-shell') || inst?.dirty?.()) return;
  inst?.unmount?.();
  inst = null;
  if (live) { sb?.removeChannel?.(live); live = null; liveOn = false; }
  store.set(TAB_KEY, cur);
  cur = null;
  renderShell();
});
