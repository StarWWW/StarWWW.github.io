// KONTROL ODASI — şarkı/oyun ekleme, yetenek puanlama, duvar ve defter moderasyonu.
// Yazma yetkisini Supabase RLS korur (admins tablosu); bu sayfa sadece arayüz.
import { CONFIG } from './config.js';
import { getSupabase } from './supabase.js';
import { esc, fmtDur, toast, API } from './util.js';
import { getLang } from './i18n.js';
import { pixelate, dominantColor, DB32 } from './pixelate.js';
import { CATS } from './sections/skills.js';
import { drawFull, weekStart, WALL_W, WALL_H } from './spray.js';

const L = (tr, en) => (getLang() === 'en' ? en : tr);
const STATUSES = ['oynuyorum', 'oynadım', 'bitirdim', 'bıraktım', 'favori'];
const STATUS_EN = { oynuyorum: 'PLAYING', oynadım: 'PLAYED', bitirdim: 'FINISHED', bıraktım: 'DROPPED', favori: 'FAVORITE' };
// YouTube linki / kimliği → 11 karakterlik video kimliği
const ytIdOf = (v) => {
  const x = String(v || '').trim();
  const m = x.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : (/^[A-Za-z0-9_-]{11}$/.test(x) ? x : null);
};
const steamBox = (g) => {
  const id = g.steam_appid || String(g.store_url || '').match(/\/app\/(\d+)/)?.[1] || String(g.cover_url || '').match(/\/apps\/(\d+)\//)?.[1];
  return id ? `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/library_600x900.jpg` : '';
};
const migNote = (msg) => (/youtube_id|box_url/.test(String(msg)) ? L(' — önce supabase/migrations/003_youtube_kapak.sql dosyasını SQL Editor\'de çalıştır.', ' — run supabase/migrations/003_youtube_kapak.sql in the SQL Editor first.') : '');

const CART_COLORS = ['#AC3232', '#DF7126', '#FBF236', '#99E550', '#6ABE30', '#5FCDE4', '#639BFF', '#3F3F74', '#D77BBA', '#76428A', '#222034', '#9BADB7'];

let root = null;
let sb = null;
let user = null;
let tab = 'music';
let lastFocus = null;

function loadCSS() {
  if (document.querySelector('link[href="css/admin.css"]')) return Promise.resolve();
  return new Promise((res) => {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = 'css/admin.css';
    l.onload = res; l.onerror = res;
    document.head.append(l);
  });
}

export async function openAdmin() {
  sb = await getSupabase();
  if (!sb) { toast(L('Supabase ayarlanmamış — js/config.js', 'Supabase is not configured — js/config.js')); return; }
  await loadCSS();
  if (!root) {
    lastFocus = document.activeElement;
    root = document.createElement('div');
    root.className = 'ad';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', L('Kontrol odası', 'Control room'));
    document.body.append(root);
    root.setAttribute('data-lenis-prevent', '');
    API.fx?.stopScroll();
    document.documentElement.style.overflow = 'hidden';
    root.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAdmin(); });
  }
  const authError = readAuthError();
  const { data: { session } } = await sb.auth.getSession();
  cleanAuthUrl();
  user = session?.user || null;
  if (!user) return renderLogin(authError);
  const { data: adm } = await sb.from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
  if (!adm) return renderNotAdmin();
  renderShell();
}

// Yerel test için: sahte bir istemciyle paneli açar (?debug adresinde kullanılır)
export async function __mount(client, fakeUser, startTab = 'music') {
  sb = client; user = fakeUser; tab = startTab;
  await loadCSS();
  if (!root) {
    root = document.createElement('div');
    root.className = 'ad';
    document.body.append(root);
  }
  renderShell();
}

export function closeAdmin() {
  if (!root) return;
  root.remove();
  root = null;
  API.fx?.startScroll();
  document.documentElement.style.overflow = '';
  cleanAuthUrl();
  lastFocus?.focus?.();
}

export async function logout() {
  sb = sb || await getSupabase();
  await sb?.auth.signOut();
  closeAdmin();
}

function topBar(withTabs) {
  const meta = user?.user_metadata || {};
  const tabs = [['music', L('01 MÜZİK EKLE', '01 ADD MUSIC')], ['games', L('02 OYUN EKLE', '02 ADD GAMES')], ['skills', L('03 YETENEKLER', '03 SKILLS')], ['mod', L('04 DUVAR + DEFTER', '04 WALL + BOOK')]];
  return `<header class="ad-top">
    <div class="ad-brand"><b>${L('KONTROL ODASI', 'CONTROL ROOM')}</b><span>// ${L('SADECE STAR', 'STAR ONLY')}</span></div>
    ${withTabs ? `<nav class="ad-tabs" role="tablist">${tabs.map(([k, n]) => `<button type="button" role="tab" aria-selected="${k === tab}" data-tab="${k}">${n}</button>`).join('')}</nav>` : ''}
    <div class="ad-user">${user ? `${meta.avatar_url ? `<img src="${esc(meta.avatar_url)}" alt="">` : ''}<span>${L('GİRİLDİ', 'SIGNED IN')}<br><b>${esc(meta.user_name || meta.preferred_username || user.email || '')}</b></span><button type="button" class="ad-x" data-logout>${L('ÇIKIŞ', 'LOG OUT')}</button>` : ''}<button type="button" class="ad-x" data-close aria-label="${L('Kapat', 'Close')}">✕</button></div>
  </header>`;
}

function wireTop() {
  root.querySelector('[data-close]')?.addEventListener('click', closeAdmin);
  root.querySelector('[data-logout]')?.addEventListener('click', logout);
  root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; renderShell(); }));
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

function renderLogin(authError) {
  const back = `${location.origin}${location.pathname}`;
  root.innerHTML = `${topBar(false)}<div class="ad-login">
    <h2>${L('KİMSİN?', 'WHO ARE YOU?')}</h2>
    <p>${L('Bu oda sadece star\'a açık. GitHub hesabınla giriş yap.', 'This room is star-only. Sign in with your GitHub account.')}</p>
    ${authError ? `<p class="ad-err" style="margin:0">${L('Giriş tamamlanamadı', 'Sign-in failed')}: ${esc(authError)}</p>` : ''}
    <button type="button" class="btn btn-acc" data-gh>${L('GITHUB İLE GİR', 'SIGN IN WITH GITHUB')} ↗</button>
    <p class="px" style="font-size:10px;line-height:1.7;color:var(--grey)">${L('GitHub\'dan sonra localhost\'a ya da başka bir adrese düşüyorsan: Supabase → Authentication → URL Configuration → Redirect URLs listesine şunu ekle:', 'If GitHub sends you to localhost or another address: add this to Supabase → Authentication → URL Configuration → Redirect URLs:')}</p>
    <code>${esc(back)}**</code>
  </div>`;
  wireTop();
  root.querySelector('[data-gh]').addEventListener('click', async () => {
    const { error } = await sb.auth.signInWithOAuth({ provider: 'github', options: { redirectTo: `${back}?admin` } });
    if (error) toast(error.message);
  });
  root.querySelector('[data-gh]').focus();
}

function renderNotAdmin() {
  root.innerHTML = `${topBar(false)}<div class="ad-login">
    <h2>${L('YETKİN YOK', 'NO ACCESS')}</h2>
    <p>${L('Giriş yaptın ama bu hesap yönetici listesinde değil. Sen star isen, aşağıdaki kimliği README\'deki SQL komutuyla admins tablosuna ekle:', 'You are signed in, but this account is not an admin. If you are star, add the id below to the admins table with the SQL command from the README:')}</p>
    <code>insert into public.admins (user_id) values ('${esc(user.id)}');</code>
  </div>`;
  wireTop();
}

function renderShell() {
  root.innerHTML = `${topBar(true)}<div class="ad-body" id="adBody"></div>`;
  wireTop();
  const body = root.querySelector('#adBody');
  ({ music: musicTab, games: gamesTab, skills: skillsTab, mod: modTab })[tab](body);
  root.querySelector(`[data-tab="${tab}"]`)?.focus();
}

const artImg = (url, wide = false) => `<div class="ad-art${wide ? ' wide' : ''}"><img alt="" data-px="${esc(url || '')}" data-wide="${wide ? 1 : ''}"></div>`;
function hydrateArt(scope) {
  scope.querySelectorAll('img[data-px]').forEach((im) => {
    if (!im.dataset.px) return;
    const p = im.dataset.wide ? pixelate(im.dataset.px, 48, 22) : pixelate(im.dataset.px, 32);
    p.then((src) => { if (src) im.src = src; });
  });
}

// ---------------- MÜZİK (Spotify) ----------------
async function musicTab(body) {
  body.innerHTML = `<div class="ad-grid">
    <section class="ad-card">
      <div class="ad-card-h"><b>01 — ${L('SPOTIFY\'DA ARA', 'SEARCH SPOTIFY')}</b><span>SPOTIFY</span></div>
      <form class="ad-search" id="mSearch"><label class="sr" for="mQ">${L('Şarkı ara', 'Search songs')}</label><input id="mQ" placeholder="megalovania, travelers..." autocomplete="off"><button class="btn btn-acc">${L('ARA', 'SEARCH')} ↵</button></form>
      <form class="ad-search" id="mLink" style="border-bottom:4px solid var(--ink)"><label class="sr" for="mUrl">${L('Spotify şarkı linki', 'Spotify track link')}</label><input id="mUrl" placeholder="${L('ya da Spotify linkini yapıştır: open.spotify.com/track/...', 'or paste a Spotify link: open.spotify.com/track/...')}" autocomplete="off" style="font-size:20px"><button class="btn">${L('GETİR', 'FETCH')}</button></form>
      <div class="ad-meta" id="mMeta"></div>
      <div id="mPrev"></div>
      <ul class="ad-list" id="mRes"></ul>
      <div class="ad-foot">${L('KAYDEDİLENLER: ŞARKI · SANATÇI · ALBÜM · PARÇA NO · YIL · TÜR · SÜRE · KAPAK · SPOTIFY LİNKİ. YOUTUBE KARŞILIĞI OTOMATİK BULUNUR: ÇALAR ŞARKININ TAMAMINI HERKESE ÇALAR VE SES AYARLANIR. BULUNAMAZSA SPOTIFY ÇALAR.', 'SAVED: TITLE · ARTIST · ALBUM · TRACK NO · YEAR · GENRE · DURATION · COVER · SPOTIFY LINK. THE YOUTUBE MATCH IS FOUND AUTOMATICALLY: THE FULL SONG PLAYS FOR EVERYONE WITH VOLUME CONTROL. IF NONE, SPOTIFY PLAYS.')}</div>
    </section>
    <section class="ad-card">
      <div class="ad-card-h"><b>${L('KİTAPLIK', 'LIBRARY')}</b><span id="mCount"></span></div>
      <div class="ad-meta" style="display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap"><span id="mYtInfo"></span><button type="button" class="btn" id="mYtAll" style="min-height:40px;font-size:11px">${L('YOUTUBE\'U EŞLEŞTİR', 'MATCH YOUTUBE')} ▶</button></div>
      <ul class="ad-list" id="mLib"></ul>
    </section>
  </div>`;
  let lib = [];
  let results = [];
  let lastQ = '';
  let offset = 0;
  let total = 0;
  const have = () => new Set(lib.map((x) => x.spotify_id).filter(Boolean));

  async function invoke(payload) {
    const { data, error } = await sb.functions.invoke('spotify', { body: payload });
    if (error) {
      let msg = error.message;
      try { msg = (await error.context?.json())?.error || msg; } catch { /* yok */ }
      throw new Error(msg);
    }
    if (data?.error && data.error !== 'no_credentials') throw new Error(data.error);
    return data;
  }

  async function loadLib() {
    const { data, error } = await sb.from('tracks').select('*').order('sort', { ascending: true }).order('created_at', { ascending: true });
    if (error) { body.querySelector('#mLib').innerHTML = `<li class="ad-err">${esc(error.message)}</li>`; return; }
    lib = data;
    body.querySelector('#mCount').textContent = `${lib.length} ${L('PARÇA', 'TRACKS')}`;
    const yes = lib.filter((x) => x.youtube_id).length;
    const todo = lib.filter((x) => x.youtube_id == null).length;
    body.querySelector('#mYtInfo').textContent = `YOUTUBE: ${yes}/${lib.length}${todo ? ` · ${todo} ${L('BEKLİYOR', 'PENDING')}` : ''}`;
    body.querySelector('#mLib').innerHTML = lib.length ? lib.map((x, i) => `<li class="ad-row" data-id="${x.id}">
      ${artImg(x.artwork_url)}<div><div class="ad-t">${esc(x.title)} ${x.spotify_id ? '<span class="px" style="font-size:8px;background:#1ED760;color:#000;padding:1px 4px">SPOTIFY</span>' : `<span class="px" style="font-size:8px;background:var(--orange);padding:1px 4px">${L('ÖNİZLEME', 'PREVIEW')}</span>`}</div><div class="ad-s">${esc(x.artist)} · ${esc(x.album || '')}</div></div>
      <span class="ad-d">${fmtDur(x.duration_ms)}</span>
      <div class="ad-acts"><button type="button" data-yt title="${x.youtube_id ? `youtube.com/watch?v=${esc(x.youtube_id)}` : L('YouTube karşılığı yok — tıkla, link yapıştır', 'No YouTube match — click to paste a link')}" style="${x.youtube_id ? 'background:#FF0033;color:#fff;border-color:#FF0033' : x.youtube_id === '' ? 'opacity:.55' : 'border-style:dashed'}">YT${x.youtube_id ? ' ✓' : x.youtube_id === '' ? ' ✕' : ' ?'}</button><button type="button" data-up ${i === 0 ? 'disabled' : ''} aria-label="${L('Yukarı', 'Up')}">↑</button><button type="button" data-down ${i === lib.length - 1 ? 'disabled' : ''} aria-label="${L('Aşağı', 'Down')}">↓</button><button type="button" class="del" data-del>${L('SİL', 'DEL')}</button></div></li>`).join('')
      : `<li class="ad-empty">${L('Kitaplık boş. Soldan şarkı ara ve ekle.', 'Library is empty. Search and add songs on the left.')}</li>`;
    hydrateArt(body.querySelector('#mLib'));
  }

  body.querySelector('#mLib').addEventListener('click', async (e) => {
    const row = e.target.closest('[data-id]'); if (!row) return;
    const i = lib.findIndex((x) => String(x.id) === row.dataset.id);
    if (e.target.closest('[data-del]')) {
      if (!confirm(L(`"${lib[i].title}" silinsin mi?`, `Delete "${lib[i].title}"?`))) return;
      await sb.from('tracks').delete().eq('id', lib[i].id);
      return loadLib();
    }
    if (e.target.closest('[data-yt]')) {
      const x = lib[i];
      const v = prompt(L(`"${x.title}" için YouTube linki ya da video kimliği.\nBoş bırakırsan otomatik yeniden aranır. "-" yazarsan YouTube kullanılmaz (Spotify çalar).`, `YouTube link or video id for "${x.title}".\nLeave empty to search again automatically. Type "-" to never use YouTube (Spotify plays).`), x.youtube_id ? `https://www.youtube.com/watch?v=${x.youtube_id}` : '');
      if (v === null) return;
      const val = v.trim() === '-' ? '' : v.trim() ? ytIdOf(v) : null;
      if (v.trim() && v.trim() !== '-' && !val) { toast(L('Geçerli bir YouTube linki değil.', 'Not a valid YouTube link.')); return; }
      const { error } = await sb.from('tracks').update({ youtube_id: val }).eq('id', x.id);
      if (error) { toast(error.message + migNote(error.message), 6000); return; }
      if (val === null) await matchYt(x.id);
      toast(L('Kaydedildi', 'Saved'));
      return loadLib();
    }
    const j = e.target.closest('[data-up]') ? i - 1 : e.target.closest('[data-down]') ? i + 1 : -1;
    if (j < 0 || j >= lib.length) return;
    const order = lib.map((x) => x.id);
    [order[i], order[j]] = [order[j], order[i]];
    await Promise.all(order.map((id, k) => sb.from('tracks').update({ sort: k }).eq('id', id)));
    loadLib();
  });

  // youtube-match fonksiyonu: şarkının YouTube karşılığını bulur ve tracks tablosuna yazar
  async function matchYt(id) {
    const { data, error } = await sb.functions.invoke('youtube-match', { body: { id } });
    if (error) {
      let msg = error.message;
      try { msg = (await error.context?.json())?.error || msg; } catch { /* yok */ }
      throw new Error(msg);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  }
  body.querySelector('#mYtAll').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const todo = lib.filter((x) => x.youtube_id == null);
    if (!todo.length) { toast(L('Hepsi eşleşmiş ✓', 'All matched ✓')); return; }
    btn.disabled = true;
    let ok = 0;
    for (const [k, x] of todo.entries()) {
      body.querySelector('#mYtInfo').textContent = `YOUTUBE: ${k + 1}/${todo.length} · ${x.title}`;
      try { if ((await matchYt(x.id))?.youtube_id) ok++; } catch (err) { // eslint-disable-line no-await-in-loop
        toast(L('Eşleştirme çalışmadı: ', 'Matching failed: ') + (err.message || err) + migNote(err.message) + L(' — "youtube-match" fonksiyonu yayında mı? (README → Adım 8)', ' — is the "youtube-match" function deployed? (README → Step 8)'), 8000);
        break;
      }
    }
    btn.disabled = false;
    toast(L(`${ok} şarkı YouTube ile eşleşti`, `${ok} songs matched on YouTube`));
    loadLib();
  });

  function renderResults(append) {
    const ids = have();
    const ul = body.querySelector('#mRes');
    const html = results.map((r, i) => `<li class="ad-row" data-i="${i}">
      ${artImg(r.artwork_url)}<div><div class="ad-t">${esc(r.title)}${r.explicit ? ' <span class="px" style="font-size:8px;border:1px solid;padding:0 3px">E</span>' : ''}</div><div class="ad-s">${esc(r.artist)} · ${esc(r.album || '')} · ${esc(r.year || '')}</div></div>
      <span class="ad-d">${fmtDur(r.duration_ms)}</span>
      <div class="ad-acts"><button type="button" data-pv aria-label="${L('Önizle', 'Preview')}">▶</button>${ids.has(r.spotify_id) ? `<button type="button" class="ok" disabled>✓ ${L('EKLİ', 'ADDED')}</button>` : `<button type="button" class="add" data-add>+ ${L('EKLE', 'ADD')}</button>`}</div></li>`).join('');
    ul.innerHTML = (html || `<li class="ad-empty">${L('Sonuç yok.', 'No results.')}</li>`)
      + (lastQ && results.length < total ? `<li class="ad-row" style="grid-template-columns:1fr"><button type="button" class="btn" data-more>${L('DAHA FAZLA', 'MORE')} (${results.length}/${total})</button></li>` : '');
    hydrateArt(ul);
    if (append) ul.scrollTop = ul.scrollHeight;
  }

  async function search(append) {
    const meta = body.querySelector('#mMeta');
    meta.textContent = L('aranıyor...', 'searching...');
    try {
      const d = await invoke({ q: lastQ, offset });
      if (d.error === 'no_credentials') {
        meta.textContent = '';
        body.querySelector('#mRes').innerHTML = `<li class="ad-err">${L('Spotify araması için SPOTIFY_CLIENT_ID ve SPOTIFY_CLIENT_SECRET tanımlı değil (README → Adım 8). O zamana kadar yukarıya Spotify şarkı linkini yapıştırarak ekleyebilirsin.', 'SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET are not set (README → Step 8). Until then, paste a Spotify track link above to add songs.')}</li>`;
        return;
      }
      results = append ? results.concat(d.results || []) : (d.results || []);
      total = d.total || results.length;
      meta.textContent = `${total} ${L('SONUÇ', 'RESULTS')}`;
      renderResults(append);
    } catch (err) {
      meta.textContent = '';
      body.querySelector('#mRes').innerHTML = `<li class="ad-err">${L('Spotify araması çalışmadı. "spotify" Edge Function\'ı yayında mı? (README → Adım 8)', 'Spotify search failed. Is the "spotify" Edge Function deployed? (README → Step 8)')}<br>${esc(err.message || err)}</li>`;
    }
  }

  body.querySelector('#mSearch').addEventListener('submit', (e) => {
    e.preventDefault();
    lastQ = body.querySelector('#mQ').value.trim();
    if (!lastQ) return;
    offset = 0;
    search(false);
  });

  body.querySelector('#mLink').addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = body.querySelector('#mUrl').value.trim();
    if (!url) return;
    const meta = body.querySelector('#mMeta');
    meta.textContent = L('Spotify\'dan bilgiler çekiliyor...', 'fetching from Spotify...');
    try {
      const d = await invoke({ track: url });
      results = [d]; total = 1; lastQ = '';
      meta.textContent = L('1 ŞARKI — EKLEMEK İÇİN + EKLE', '1 SONG — PRESS + ADD');
      renderResults(false);
      showPreview(d);
    } catch (err) {
      meta.textContent = '';
      body.querySelector('#mRes').innerHTML = `<li class="ad-err">${esc(err.message || err)}</li>`;
    }
  });

  function showPreview(r) {
    body.querySelector('#mPrev').innerHTML = `<div style="padding:10px 16px;border-bottom:3px dashed rgba(34,32,52,.3)"><iframe title="Spotify: ${esc(r.title)}" src="https://open.spotify.com/embed/track/${esc(r.spotify_id)}?utm_source=star" width="100%" height="80" frameborder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" style="border-radius:12px;display:block"></iframe></div>`;
  }

  body.querySelector('#mRes').addEventListener('click', async (e) => {
    if (e.target.closest('[data-more]')) { offset = results.length; search(true); return; }
    const row = e.target.closest('[data-i]'); if (!row) return;
    const r = results[Number(row.dataset.i)];
    if (e.target.closest('[data-pv]')) { showPreview(r); return; }
    const btn = e.target.closest('[data-add]'); if (!btn) return;
    btn.disabled = true;
    btn.textContent = '…';
    let full = r;
    try { full = { ...r, ...(await invoke({ track: r.spotify_id })) }; } catch { /* arama sonucu da yeterli */ }
    const { data: added, error } = await sb.from('tracks').insert({
      spotify_id: full.spotify_id, spotify_url: full.spotify_url, explicit: Boolean(full.explicit),
      title: full.title, artist: full.artist, album: full.album, track_number: full.track_number, track_count: full.track_count,
      year: full.year, genre: full.genre, duration_ms: full.duration_ms, artwork_url: full.artwork_url, sort: lib.length,
    }).select('id').single();
    if (error) { toast(error.message); btn.disabled = false; btn.textContent = `+ ${L('EKLE', 'ADD')}`; return; }
    toast(L(`Eklendi: ${full.title}`, `Added: ${full.title}`));
    await loadLib();
    renderResults(false);
    // YouTube karşılığını arka planda bul
    if (added?.id != null) matchYt(added.id).then((d) => { if (d?.youtube_id) toast(L(`YouTube bulundu: ${full.title} ✓`, `YouTube found: ${full.title} ✓`)); loadLib(); }).catch(() => {});
  });

  await loadLib();
  body.querySelector('#mQ').focus();
}

// ---------------- OYUNLAR ----------------
async function gamesTab(body) {
  body.innerHTML = `<div class="ad-grid">
    <section class="ad-card">
      <div class="ad-card-h"><b>02 — ${L('OYUN ARA', 'SEARCH GAMES')}</b><span>${L('KAYNAK: RAWG + STEAM', 'SOURCE: RAWG + STEAM')}</span></div>
      <form class="ad-search" id="gSearch"><label class="sr" for="gQ">${L('Oyun ara', 'Search games')}</label><input id="gQ" placeholder="ultrakill, outer wilds..." autocomplete="off"><button class="btn btn-acc">${L('ARA', 'SEARCH')} ↵</button></form>
      <div class="ad-meta" id="gMeta"></div>
      <ul class="ad-list" id="gRes" style="max-height:320px"></ul>
      <div id="gPrev"></div>
    </section>
    <section class="ad-card">
      <div class="ad-card-h"><b>${L('RAF', 'SHELF')}</b><span id="gCount"></span></div>
      <ul class="ad-list" id="gLib"></ul>
    </section>
  </div>`;
  let shelf = [];
  let results = [];

  async function loadShelf() {
    const { data, error } = await sb.from('games').select('*').order('sort', { ascending: true }).order('created_at', { ascending: true });
    if (error) { body.querySelector('#gLib').innerHTML = `<li class="ad-err">${esc(error.message)}</li>`; return; }
    shelf = data;
    body.querySelector('#gCount').textContent = `${shelf.length} ${L('OYUN', 'GAMES')}`;
    body.querySelector('#gLib').innerHTML = shelf.length ? shelf.map((g, i) => `<li class="ad-row" data-id="${g.id}" style="grid-template-columns:44px minmax(0,1fr) auto">
      <img alt="" src="${esc(g.box_url || steamBox(g) || '')}" style="width:44px;height:62px;object-fit:cover;border:3px solid var(--ink);background:${esc(g.color || '#AC3232')}" onerror="this.removeAttribute('src')">
      <div><div class="ad-t">${esc(g.name)} ${g.now_playing ? `<span class="px" style="font-size:9px;background:var(--acid);padding:2px 5px">${L('ŞU AN', 'NOW')}</span>` : ''}</div>
      <div class="ad-s"><select data-status style="font-family:var(--f-px);font-size:10px;border:2px solid var(--ink);padding:2px">${STATUSES.map((s) => `<option value="${s}" ${s === g.status ? 'selected' : ''}>${getLang() === 'en' ? STATUS_EN[s] : s.toUpperCase()}</option>`).join('')}</select>
      <label style="font-family:var(--f-px);font-size:9px;margin-left:8px"><input type="checkbox" data-now ${g.now_playing ? 'checked' : ''}> ${L('ŞU AN', 'NOW')}</label></div></div>
      <div class="ad-acts"><button type="button" data-note title="${esc(g.note || '')}">${L('NOT', 'NOTE')}${g.note ? ' ✓' : ''}</button><button type="button" data-box>${L('KAPAK', 'COVER')}</button><button type="button" data-up ${i === 0 ? 'disabled' : ''} aria-label="${L('Yukarı', 'Up')}">↑</button><button type="button" data-down ${i === shelf.length - 1 ? 'disabled' : ''} aria-label="${L('Aşağı', 'Down')}">↓</button><button type="button" class="del" data-del>${L('SİL', 'DEL')}</button></div></li>`).join('')
      : `<li class="ad-empty">${L('Raf boş. Soldan oyun ara ve ekle.', 'Shelf is empty. Search and add games on the left.')}</li>`;
    hydrateArt(body.querySelector('#gLib'));
  }

  const lib = body.querySelector('#gLib');
  lib.addEventListener('click', async (e) => {
    const row = e.target.closest('[data-id]'); if (!row) return;
    const i = shelf.findIndex((g) => String(g.id) === row.dataset.id);
    if (e.target.closest('[data-note]')) {
      const v = prompt(L(`"${shelf[i].name}" için notun (kutunun arkasında görünür, en fazla 160 harf):`, `Your note for "${shelf[i].name}" (shown on the back of the case, max 160 chars):`), shelf[i].note || '');
      if (v === null) return;
      const { error } = await sb.from('games').update({ note: v.trim().slice(0, 160) }).eq('id', shelf[i].id);
      if (error) { toast(error.message); return; }
      toast(L('Kaydedildi', 'Saved'));
      return loadShelf();
    }
    if (e.target.closest('[data-box]')) {
      const v = prompt(L(`"${shelf[i].name}" kutu kapağı (dikey resim linki). Boş bırakırsan Steam kapağı ya da tasarlanmış kapak kullanılır.`, `Case cover for "${shelf[i].name}" (portrait image link). Leave empty to use the Steam cover or a designed one.`), shelf[i].box_url || steamBox(shelf[i]));
      if (v === null) return;
      const { error } = await sb.from('games').update({ box_url: v.trim() }).eq('id', shelf[i].id);
      if (error) { toast(error.message + migNote(error.message), 6000); return; }
      toast(L('Kaydedildi', 'Saved'));
      return loadShelf();
    }
    if (e.target.closest('[data-del]')) {
      if (!confirm(L(`"${shelf[i].name}" raftan kaldırılsın mı?`, `Remove "${shelf[i].name}" from the shelf?`))) return;
      await sb.from('games').delete().eq('id', shelf[i].id);
      return loadShelf();
    }
    const j = e.target.closest('[data-up]') ? i - 1 : e.target.closest('[data-down]') ? i + 1 : -1;
    if (j < 0 || j >= shelf.length) return;
    const order = shelf.map((g) => g.id);
    [order[i], order[j]] = [order[j], order[i]];
    await Promise.all(order.map((id, k) => sb.from('games').update({ sort: k }).eq('id', id)));
    loadShelf();
  });
  lib.addEventListener('change', async (e) => {
    const row = e.target.closest('[data-id]'); if (!row) return;
    const id = Number(row.dataset.id) || row.dataset.id;
    if (e.target.matches('[data-status]')) await sb.from('games').update({ status: e.target.value }).eq('id', id);
    if (e.target.matches('[data-now]')) {
      if (e.target.checked) await sb.from('games').update({ now_playing: false }).neq('id', id);
      await sb.from('games').update({ now_playing: e.target.checked }).eq('id', id);
    }
    toast(L('Kaydedildi', 'Saved'));
    loadShelf();
  });

  async function invoke(payload) {
    const { data, error } = await sb.functions.invoke(CONFIG.gameSearchFn, { body: payload });
    if (error) throw error;
    return data;
  }

  body.querySelector('#gSearch').addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = body.querySelector('#gQ').value.trim();
    if (!q) return;
    const meta = body.querySelector('#gMeta');
    meta.textContent = L('aranıyor...', 'searching...');
    try {
      results = (await invoke({ q })).results || [];
    } catch (err) {
      meta.textContent = '';
      body.querySelector('#gRes').innerHTML = `<li class="ad-err">${L('Oyun araması çalışmadı. "game-search" Edge Function\'ı kurulu mu ve RAWG_KEY tanımlı mı? (README → Adım 6)', 'Game search failed. Is the "game-search" Edge Function deployed with RAWG_KEY set? (README → Step 6)')}<br>${esc(err.message || err)}</li>`;
      return;
    }
    meta.textContent = `${results.length} ${L('SONUÇ', 'RESULTS')}`;
    body.querySelector('#gRes').innerHTML = results.map((r, i) => `<li class="ad-row" data-i="${i}" style="grid-template-columns:44px minmax(0,1fr) auto">
      ${artImg(r.cover, true)}<div><div class="ad-t">${esc(r.name)}</div><div class="ad-s">${esc((r.released || '').slice(0, 4))} · ${esc((r.platforms || []).slice(0, 3).join(', '))}</div></div>
      <div class="ad-acts"><button type="button" class="add" data-pick>${L('SEÇ', 'PICK')}</button></div></li>`).join('') || `<li class="ad-empty">${L('Sonuç yok.', 'No results.')}</li>`;
    hydrateArt(body.querySelector('#gRes'));
  });

  body.querySelector('#gRes').addEventListener('click', async (e) => {
    const row = e.target.closest('[data-i]'); if (!row) return;
    body.querySelectorAll('#gRes .ad-row').forEach((r) => r.classList.toggle('sel', r === row));
    const r = results[Number(row.dataset.i)];
    const prev = body.querySelector('#gPrev');
    prev.innerHTML = `<div class="ad-meta">${L('detaylar çekiliyor...', 'fetching details...')}</div>`;
    let d;
    try { d = await invoke({ id: r.id }); } catch (err) { prev.innerHTML = `<div class="ad-err">${esc(err.message || err)}</div>`; return; }
    const color = await dominantColor(d.cover_url, '#AC3232');
    renderPreview(d, color);
  });

  function renderPreview(d, color) {
    const prev = body.querySelector('#gPrev');
    let status = 'oynadım';
    let col = CART_COLORS.includes(color) ? color : (DB32.includes(color) ? color : '#AC3232');
    const field = (k, label, val) => `<label for="gf-${k}">${label}</label><input id="gf-${k}" data-f="${k}" value="${esc(val ?? '')}">`;
    prev.innerHTML = `<div class="ad-prev">
      <div class="px" style="font-size:11px;color:var(--grey)">${L('RAFA BÖYLE GİRECEK — ALANLARI DÜZELTEBİLİRSİN', 'THIS GOES ON THE SHELF — YOU CAN EDIT THE FIELDS')}</div>
      <div class="ad-prev-top">
        <div class="ad-prev-cover"><img alt="" id="gpCover"><img alt="" id="gpBox" style="display:block;width:100%;margin-top:8px;border:3px solid var(--ink)" onerror="this.remove()"></div>
        <div class="ad-fields">
          ${field('name', L('AD', 'NAME'), d.name)}
          ${field('developers', L('GELİŞTİRİCİ', 'DEVELOPER'), (d.developers || []).join(', '))}
          ${field('publishers', L('YAYINCI', 'PUBLISHER'), (d.publishers || []).join(', '))}
          ${field('released', L('ÇIKIŞ', 'RELEASED'), d.released)}
          ${field('genres', L('TÜR', 'GENRE'), (d.genres || []).join(', '))}
          ${field('platforms', 'PLATFORM', (d.platforms || []).join(', '))}
          ${field('metacritic', 'METACRITIC', d.metacritic)}
          ${field('box_url', L('KUTU KAPAĞI', 'CASE COVER'), d.box_url || steamBox(d))}
        </div>
      </div>
      <div class="ad-seg" role="radiogroup" aria-label="${L('Durum', 'Status')}">${STATUSES.map((s) => `<button type="button" role="radio" aria-checked="${s === status}" data-st="${s}">${getLang() === 'en' ? STATUS_EN[s] : s.toUpperCase()}</button>`).join('')}</div>
      <div class="ad-line"><span>${L('KUTU RENGİ', 'CASE COLOR')}</span><div class="ad-sw" role="radiogroup">${CART_COLORS.map((c) => `<button type="button" role="radio" aria-checked="${c === col}" data-c="${c}" style="--sw:${c}" aria-label="${c}"></button>`).join('')}</div>
        <label><input type="checkbox" id="gNow"> ${L('"ŞU AN" ROZETİ', '"NOW" BADGE')}</label></div>
      <div class="ad-line"><textarea id="gNote" rows="2" maxlength="160" placeholder="${L('notun (isteğe bağlı)', 'your note (optional)')}"></textarea></div>
      <button type="button" class="btn btn-or" id="gAdd">${L('RAFA KOY', 'PUT ON SHELF')} ↘</button>
    </div>`;
    if (d.cover_url) pixelate(d.cover_url, 64, 30).then((src) => { const im = prev.querySelector('#gpCover'); if (im && src) im.src = src; });
    const boxIn = prev.querySelector('[data-f="box_url"]');
    const showBox = () => { const im = prev.querySelector('#gpBox'); if (im && boxIn.value.trim()) im.src = boxIn.value.trim(); };
    boxIn.addEventListener('change', showBox);
    showBox();
    prev.querySelector('.ad-seg').addEventListener('click', (e) => {
      const b = e.target.closest('[data-st]'); if (!b) return;
      status = b.dataset.st;
      prev.querySelectorAll('[data-st]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      if (status === 'oynuyorum') prev.querySelector('#gNow').checked = true;
    });
    prev.querySelector('.ad-sw').addEventListener('click', (e) => {
      const b = e.target.closest('[data-c]'); if (!b) return;
      col = b.dataset.c;
      prev.querySelectorAll('[data-c]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    });
    prev.querySelector('#gAdd').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      const f = (k) => prev.querySelector(`[data-f="${k}"]`).value.trim();
      const arr = (k) => f(k).split(',').map((s) => s.trim()).filter(Boolean);
      const now = prev.querySelector('#gNow').checked;
      if (now) await sb.from('games').update({ now_playing: false }).eq('now_playing', true);
      const { error } = await sb.from('games').insert({
        name: f('name'), developers: arr('developers'), publishers: arr('publishers'), released: f('released') || null,
        genres: arr('genres'), platforms: arr('platforms'), metacritic: Number(f('metacritic')) || null,
        cover_url: d.cover_url || '', store_url: d.store_url || '', steam_appid: d.steam_appid || null, rawg_id: d.rawg_id || null, box_url: f('box_url'),
        color: col, status, now_playing: now, note: prev.querySelector('#gNote').value.trim(), sort: shelf.length,
      });
      if (error) { toast(error.message + migNote(error.message), 6000); btn.disabled = false; return; }
      toast(L(`Rafa kondu: ${f('name')}`, `On the shelf: ${f('name')}`));
      prev.innerHTML = '';
      loadShelf();
    });
  }

  await loadShelf();
  body.querySelector('#gQ').focus();
}

// ---------------- YETENEKLER ----------------
async function skillsTab(body) {
  body.innerHTML = `<section class="ad-card">
    <div class="ad-card-h"><b>03 — ${L('YETENEKLER', 'SKILLS')}</b><span id="sCount"></span></div>
    <div class="ad-sk" id="sList"></div>
    <form class="ad-sk-add" id="sAdd">
      <label class="sr" for="sName">${L('Yeni öğe', 'New item')}</label><input id="sName" placeholder="${L('yeni öğe adı', 'new item name')}" maxlength="40">
      <label class="sr" for="sCat">${L('Kategori', 'Category')}</label><select id="sCat">${CATS.map(([k]) => `<option value="${k}">${k.toUpperCase()}</option>`).join('')}</select>
      <button class="btn">+ ${L('EKLE', 'ADD')}</button>
      <button type="button" class="btn btn-acc" id="sSave" style="margin-left:auto">${L('KAYDET', 'SAVE')}</button>
    </form>
    <div class="ad-foot">${L('PUANI 0 OLAN ÖĞE SİTEDE GÖRÜNMEZ. TURUNCU = KAYDEDİLMEMİŞ.', 'ITEMS RATED 0 ARE HIDDEN ON THE SITE. ORANGE = UNSAVED.')}</div>
  </section>`;
  let skills = [];
  const dirty = new Map();

  async function load() {
    const { data, error } = await sb.from('skills').select('*').order('sort', { ascending: true }).order('name', { ascending: true });
    if (error) { body.querySelector('#sList').innerHTML = `<div class="ad-err">${esc(error.message)}</div>`; return; }
    skills = data;
    if (!skills.length) {
      body.querySelector('#sList').innerHTML = `<div class="ad-empty">${L('Tablo boş.', 'Table is empty.')} <button type="button" class="btn" id="sSeed">${L('HAZIR LİSTEYİ YÜKLE (43 ÖĞE)', 'LOAD THE STARTER LIST (43 ITEMS)')}</button></div>`;
      body.querySelector('#sSeed').addEventListener('click', async () => {
        const seed = await (await fetch('data/skills.json')).json();
        const { error: e2 } = await sb.from('skills').insert(seed.map((s, i) => ({ ...s, sort: i })));
        if (e2) toast(e2.message); else load();
      });
      return;
    }
    render();
  }

  function render() {
    const rated = skills.filter((s) => (dirty.get(s.id) ?? s.level) > 0).length;
    body.querySelector('#sCount').textContent = `${skills.length} ${L('ÖĞE', 'ITEMS')} · ${rated} ${L('PUANLANDI', 'RATED')}`;
    body.querySelector('#sList').innerHTML = CATS.map(([k]) => {
      const items = skills.filter((s) => s.category === k);
      if (!items.length) return '';
      return `<h4>${k.toUpperCase()}</h4>${items.map((s) => {
        const v = dirty.get(s.id) ?? s.level;
        return `<div class="ad-sk-row${dirty.has(s.id) ? ' dirty' : ''}" data-id="${s.id}"><span id="skn-${s.id}">${esc(s.name)}</span><input type="range" min="0" max="10" value="${v}" aria-labelledby="skn-${s.id}"><output>${v ? `LV ${v}` : '—'}</output><button type="button" data-del aria-label="${L('Sil', 'Delete')}: ${esc(s.name)}">✕</button></div>`;
      }).join('')}`;
    }).join('');
  }

  body.querySelector('#sList').addEventListener('input', (e) => {
    if (!e.target.matches('input[type="range"]')) return;
    const row = e.target.closest('[data-id]');
    const id = Number(row.dataset.id);
    const v = Number(e.target.value);
    dirty.set(id, v);
    row.classList.add('dirty');
    row.querySelector('output').textContent = v ? `LV ${v}` : '—';
  });
  body.querySelector('#sList').addEventListener('click', async (e) => {
    if (!e.target.closest('[data-del]')) return;
    const id = Number(e.target.closest('[data-id]').dataset.id);
    const s = skills.find((x) => x.id === id);
    if (!confirm(L(`"${s.name}" silinsin mi?`, `Delete "${s.name}"?`))) return;
    await sb.from('skills').delete().eq('id', id);
    dirty.delete(id);
    load();
  });
  body.querySelector('#sAdd').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = body.querySelector('#sName').value.trim();
    if (!name) return;
    const { error } = await sb.from('skills').insert({ name, category: body.querySelector('#sCat').value, level: 0, sort: skills.length });
    if (error) { toast(error.message); return; }
    body.querySelector('#sName').value = '';
    load();
  });
  body.querySelector('#sSave').addEventListener('click', async () => {
    if (!dirty.size) { toast(L('Değişiklik yok', 'No changes')); return; }
    const results = await Promise.all([...dirty].map(([id, level]) => sb.from('skills').update({ level }).eq('id', id)));
    const err = results.find((r) => r.error);
    if (err) { toast(err.error.message); return; }
    toast(L(`${dirty.size} öğe kaydedildi`, `${dirty.size} items saved`));
    dirty.clear();
    load();
  });

  await load();
}

// ---------------- MODERASYON ----------------
async function modTab(body) {
  body.innerHTML = `<div class="ad-grid">
    <section class="ad-card">
      <div class="ad-card-h"><b>04 — ${L('DUVAR', 'WALL')}</b><span id="wCount"></span></div>
      <div class="ad-wall"><canvas id="wCv" width="${WALL_W / 2}" height="${WALL_H / 2}" aria-label="${L('Duvar önizlemesi — silmek için bir çizgiye tıkla', 'Wall preview — click a stroke to select it')}"></canvas></div>
      <div class="ad-btns">
        <button type="button" class="btn danger" id="wDelSel" disabled>${L('SEÇİLİYİ SİL', 'DELETE SELECTED')}</button>
        <button type="button" class="btn" id="wUndo">${L('SON 10 ÇİZGİYİ SİL', 'DELETE LAST 10')}</button>
        <button type="button" class="btn buff" id="wBuff">${L('ŞİMDİ BUFF\'LA', 'BUFF NOW')}</button>
      </div>
    </section>
    <section class="ad-card">
      <div class="ad-card-h"><b>${L('DEFTER', 'GUESTBOOK')}</b><span id="bCount"></span></div>
      <ul class="ad-list" id="bList"></ul>
      <div class="ad-card-h" style="border-top:4px solid var(--ink)"><b>${L('SKOR TABLOSU', 'LEADERBOARD')}</b><span>TOP 20</span></div>
      <ul class="ad-list" id="scList"></ul>
    </section>
  </div>`;
  const cv = body.querySelector('#wCv');
  const ctx = cv.getContext('2d');
  let strokes = [];
  let sel = null;

  async function loadWall() {
    const { data: buff } = await sb.from('wall_buffs').select('at').order('at', { ascending: false }).limit(1);
    const from = new Date(Math.max(weekStart(), buff?.[0]?.at ? Date.parse(buff[0].at) : 0)).toISOString();
    const { data, error } = await sb.from('wall_strokes').select('id,color,size,points,drips,created_at').gte('created_at', from).order('created_at', { ascending: true }).limit(5000);
    if (error) { toast(error.message); return; }
    strokes = data;
    sel = null;
    body.querySelector('#wDelSel').disabled = true;
    body.querySelector('#wCount').textContent = `${strokes.length} ${L('ÇİZGİ', 'STROKES')}`;
    draw();
  }
  function draw() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    strokes.forEach((s) => drawFull(ctx, s, 0.5));
    if (sel) {
      ctx.strokeStyle = '#AC3232'; ctx.lineWidth = 3; ctx.setLineDash([6, 4]);
      const xs = sel.points.map((p) => p[0] * cv.width); const ys = sel.points.map((p) => p[1] * cv.height);
      const pad = sel.size / 2 + 6;
      ctx.strokeRect(Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) - Math.min(...xs) + pad * 2, Math.max(...ys) - Math.min(...ys) + pad * 2);
      ctx.setLineDash([]);
    }
  }
  cv.addEventListener('click', (e) => {
    const r = cv.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width; const y = (e.clientY - r.top) / r.height;
    let best = null; let bd = 0.03;
    for (let i = strokes.length - 1; i >= 0; i--) {
      for (const p of strokes[i].points) {
        const d = Math.hypot(p[0] - x, (p[1] - y) / 2);
        if (d < bd) { bd = d; best = strokes[i]; }
      }
    }
    sel = best;
    body.querySelector('#wDelSel').disabled = !sel;
    draw();
  });
  body.querySelector('#wDelSel').addEventListener('click', async () => {
    if (!sel) return;
    await sb.from('wall_strokes').delete().eq('id', sel.id);
    loadWall();
  });
  body.querySelector('#wUndo').addEventListener('click', async () => {
    const ids = strokes.slice(-10).map((s) => s.id);
    if (!ids.length || !confirm(L(`Son ${ids.length} çizgi silinsin mi?`, `Delete the last ${ids.length} strokes?`))) return;
    await sb.from('wall_strokes').delete().in('id', ids);
    loadWall();
  });
  body.querySelector('#wBuff').addEventListener('click', async () => {
    if (!confirm(L('Duvar şimdi temizlensin mi? (çizgiler arşivde kalır)', 'Wipe the wall now? (strokes stay in the archive)'))) return;
    const { error } = await sb.from('wall_buffs').insert({});
    if (error) toast(error.message); else { toast(L('Duvar buff\'landı', 'Wall buffed')); loadWall(); }
  });

  async function loadBook() {
    const { data, count } = await sb.from('guestbook').select('id,name,message,created_at', { count: 'exact' }).order('created_at', { ascending: false }).limit(40);
    body.querySelector('#bCount').textContent = `${count ?? 0} ${L('NOT', 'NOTES')}`;
    body.querySelector('#bList').innerHTML = (data || []).map((n) => `<li class="ad-row" data-id="${esc(n.id)}" style="grid-template-columns:minmax(0,1fr) auto"><div><div class="ad-t" style="font-family:var(--f-hand);font-size:22px;font-weight:700">${esc(n.message)}</div><div class="ad-s">${esc(n.name)} · ${new Date(n.created_at).toLocaleString(getLang() === 'en' ? 'en-GB' : 'tr-TR')}</div></div><div class="ad-acts"><button type="button" class="del" data-del>${L('SİL', 'DEL')}</button></div></li>`).join('') || `<li class="ad-empty">${L('Defter boş.', 'Guestbook is empty.')}</li>`;
  }
  body.querySelector('#bList').addEventListener('click', async (e) => {
    if (!e.target.closest('[data-del]')) return;
    await sb.from('guestbook').delete().eq('id', e.target.closest('[data-id]').dataset.id);
    loadBook();
  });

  async function loadScores() {
    const { data } = await sb.from('scores').select('id,name,score,rank,created_at').order('score', { ascending: false }).limit(20);
    body.querySelector('#scList').innerHTML = (data || []).map((s, i) => `<li class="ad-row" data-id="${s.id}" style="grid-template-columns:40px minmax(0,1fr) auto"><span class="ad-d">${i + 1}</span><div><div class="ad-t">${esc(s.name)} · ${esc(s.rank)}</div><div class="ad-s">${Number(s.score).toLocaleString('tr-TR')}</div></div><div class="ad-acts"><button type="button" class="del" data-del>${L('SİL', 'DEL')}</button></div></li>`).join('') || `<li class="ad-empty">${L('Henüz skor yok.', 'No scores yet.')}</li>`;
  }
  body.querySelector('#scList').addEventListener('click', async (e) => {
    if (!e.target.closest('[data-del]')) return;
    await sb.from('scores').delete().eq('id', e.target.closest('[data-id]').dataset.id);
    loadScores();
  });

  await Promise.all([loadWall(), loadBook(), loadScores()]);
}
