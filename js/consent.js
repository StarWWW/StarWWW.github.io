// ÇEREZ / DEPOLAMA İZNİ — KVKK ve GDPR'a uygun onay yönetimi.
//
// Kategoriler: zorunlu (her zaman açık) · fonksiyonel · analitik · pazarlama.
// Zorunlu olmayan hiçbir şey izin verilmeden tarayıcıya yazılmaz ya da çalışmaz (util.store izni kontrol eder).
// Seçim star.consent anahtarında saklanır, 12 ayda bir ya da politika sürümü değişince yeniden sorulur.
//
// İleride analitik / pazarlama betiği eklemek istersen izinsiz çalışmasın diye şöyle ekle:
//   <script type="text/plain" data-consent="analytics" data-src="https://..."></script>
// ya da JS'ten: API.consent.load('analytics', 'https://...'). İzin verildiği anda yüklenir, verilmezse hiç yüklenmez.
import { esc, toast, API, CONSENT_KEY, CONSENT_VERSION, consentState, allowed, flushStore, purgeStore } from './util.js';
import { getLang, onLang } from './i18n.js';
import { spriteSVG } from './sprites.js';

const CATS = ['necessary', 'functional', 'analytics', 'marketing'];
const tx = (pair) => pair[getLang() === 'en' ? 1 : 0];

const TXT = {
  title: ['ÇEREZ & DEPOLAMA', 'COOKIES & STORAGE'],
  body: [
    'Bu oda iz sürmez: analitik, reklam ya da takip çerezi yok. Siteyi çalıştırmak için gereken birkaç zorunlu kayıt dışında, tercihlerini (dil, ses seviyesi, sprey rengi, oyun skorların) tarayıcında saklamak için iznini istiyoruz.',
    'This room does not track you: no analytics, ad or tracking cookies. Apart from a few strictly necessary entries, we ask your permission to remember your preferences (language, volume, spray colour, game scores) in your browser.',
  ],
  all: ['TÜMÜNÜ KABUL ET', 'ACCEPT ALL'],
  necessary: ['SADECE ZORUNLU', 'NECESSARY ONLY'],
  reject: ['TÜMÜNÜ REDDET', 'REJECT ALL'],
  prefs: ['TERCİHLERİ YÖNET', 'MANAGE PREFERENCES'],
  save: ['SEÇİMİMİ KAYDET', 'SAVE MY CHOICES'],
  policy: ['GİZLİLİK POLİTİKASI', 'PRIVACY POLICY'],
  modalTitle: ['ÇEREZ TERCİHLERİ', 'COOKIE PREFERENCES'],
  intro: [
    'Hangi kategorilere izin verdiğini seç. Zorunlu olanlar kapatılamaz çünkü site onlarsız çalışmaz. Tercihini istediğin zaman sayfanın altındaki "Çerez Tercihleri" bağlantısından değiştirebilirsin.',
    'Choose which categories you allow. Necessary ones cannot be turned off because the site does not work without them. You can change your choice any time from the "Cookie Settings" link at the bottom of the page.',
  ],
  always: ['HER ZAMAN AÇIK', 'ALWAYS ON'],
  unused: ['ŞU AN KULLANILMIYOR', 'NOT IN USE'],
  what: ['NE SAKLANIYOR?', 'WHAT IS STORED?'],
  saved: ['Tercihlerin kaydedildi.', 'Your preferences were saved.'],
  close: ['Kapat', 'Close'],
  key: ['KAYIT', 'ENTRY'], purpose: ['AMAÇ', 'PURPOSE'], dur: ['SÜRE', 'DURATION'],
  status: ['Şu anki seçimin', 'Your current choice'],
  none: ['henüz seçim yapılmadı', 'no choice made yet'],
};

const CAT_TXT = {
  necessary: {
    name: ['ZORUNLU', 'NECESSARY'],
    desc: ['Sitenin çalışması ve kötüye kullanımın önlenmesi için gerekli. İzin gerektirmez, kapatılamaz.', 'Required for the site to work and to prevent abuse. No consent needed; cannot be turned off.'],
    items: [
      ['star.consent', ['Bu çerez tercihin', 'Your cookie choice'], ['12 ay', '12 months']],
      ['star.motion', ['Animasyon tercihin (erişilebilirlik)', 'Your animation setting (accessibility)'], ['sen silene kadar', 'until you clear it']],
      ['star.cid', ['Rastgele cihaz kimliği: duvar ve defterde hız sınırı / spam önleme', 'Random device id: rate limiting / spam protection on the wall and guestbook'], ['sen silene kadar', 'until you clear it']],
      ['star.gb.last', ['Deftere son not attığın zaman (spam önleme)', 'Time of your last guestbook note (spam protection)'], ['sen silene kadar', 'until you clear it']],
      ['sessionStorage', ['Açılış ekranı ve teknik önbellekler (repo listesi, 8-bit kapaklar)', 'Boot screen and technical caches (repo list, 8-bit covers)'], ['sekme kapanınca', 'until the tab closes']],
      ['sb-…-auth-token', ['Sadece site sahibi Kontrol Odası\'na GitHub ile giriş yaptığında oturum', 'Session, only when the site owner signs in to the Control Room with GitHub'], ['çıkış yapılana kadar', 'until sign-out']],
    ],
  },
  functional: {
    name: ['FONKSİYONEL', 'FUNCTIONAL'],
    desc: ['Tercihlerini bir sonraki ziyarette hatırlar. Kapalıysa her şey çalışır ama sekmeyi kapatınca unutulur.', 'Remembers your preferences for your next visit. If off, everything still works but is forgotten when you close the tab.'],
    items: [
      ['star.lang · star.mode', ['Dil (TR/EN) ve REAL/DRUG modu', 'Language (TR/EN) and REAL/DRUG mode'], ['sen silene kadar', 'until you clear it']],
      ['star.vol · star.muted', ['MP3 çaların ses seviyesi', 'MP3 player volume'], ['sen silene kadar', 'until you clear it']],
      ['star.sprayColor · star.spraySize', ['Sprey rengi ve uç kalınlığı', 'Spray colour and nozzle size'], ['sen silene kadar', 'until you clear it']],
      ['star.pv', ['Spotify önizleme adreslerinin önbelleği', 'Cache of Spotify preview addresses'], ['sen silene kadar', 'until you clear it']],
      ['star.visits · star.vno', ['"Selam tekrar!" karşılaması ve duvardaki ziyaretçi numaran', '"Welcome back!" greeting and your visitor number on the wall'], ['sen silene kadar', 'until you clear it']],
      ['star.scores · star.ach · star.arcade', ['Gizli oyundaki skorların, başarımların ve arcade adın', 'Your scores, achievements and arcade name in the hidden game'], ['sen silene kadar', 'until you clear it']],
      ['star.wall.local · star.gb.local', ['Çevrimdışı modda duvar ve defterin yerel kopyası', 'Local copy of the wall and guestbook in offline mode'], ['sen silene kadar', 'until you clear it']],
    ],
  },
  analytics: {
    name: ['ANALİTİK', 'ANALYTICS'],
    desc: ['Ziyaret istatistikleri. Bu sitede şu an analitik aracı yok; ileride eklenirse yalnızca bu izni verdiysen çalışır.', 'Visit statistics. There is no analytics tool on this site right now; if one is added later it only runs if you allow this.'],
    items: [],
  },
  marketing: {
    name: ['PAZARLAMA', 'MARKETING'],
    desc: ['Reklam ve yeniden hedefleme. Bu sitede reklam yok; bu kategori yalnızca ileride ihtiyaç olursa diye burada.', 'Advertising and retargeting. There are no ads on this site; this category only exists in case it is ever needed.'],
    items: [],
  },
};
const IN_USE = { necessary: true, functional: true, analytics: false, marketing: false };

// gizlilik sayfası çerez tablolarını buradan üretir (tek kaynak)
export function cookieTablesHTML(lang) {
  const pick = (pair) => pair[lang === 'en' ? 1 : 0];
  return CATS.map((cat) => {
    const c = CAT_TXT[cat];
    const rows = c.items.length
      ? c.items.map(([k, p, d]) => `<tr><td><code>${esc(k)}</code></td><td>${esc(pick(p))}</td><td>${esc(pick(d))}</td></tr>`).join('')
      : `<tr><td colspan="3">${esc(pick(TXT.unused))}</td></tr>`;
    return `<div class="ck-tbl"><h3 class="px">${esc(pick(c.name))}${cat === 'necessary' ? ` · ${esc(pick(TXT.always))}` : ''}</h3><p>${esc(pick(c.desc))}</p>
      <div class="legal-table-wrap"><table class="legal-table"><thead><tr><th>${esc(pick(TXT.key))}</th><th>${esc(pick(TXT.purpose))}</th><th>${esc(pick(TXT.dur))}</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
  }).join('');
}

let banner = null;
let modal = null;
let lastFocus = null;
const listeners = new Set();

function save(choice) {
  const rec = { v: CONSENT_VERSION, ts: new Date().toISOString(), necessary: true, functional: Boolean(choice.functional), analytics: Boolean(choice.analytics), marketing: Boolean(choice.marketing) };
  try { localStorage.setItem(CONSENT_KEY, JSON.stringify(rec)); } catch { /* gizli sekme: tercih bu sekmede geçerli */ }
  purgeStore();
  flushStore();
  activateScripts();
  hideBanner();
  closeModal();
  toast(tx(TXT.saved));
  listeners.forEach((fn) => fn(rec));
  document.dispatchEvent(new CustomEvent('consentchange', { detail: rec }));
}
const acceptAll = () => save({ functional: true, analytics: true, marketing: true });
const rejectAll = () => save({ functional: false, analytics: false, marketing: false });

// izin verilen kategorilerin bekleyen betiklerini yükle
function activateScripts() {
  document.querySelectorAll('script[type="text/plain"][data-consent]').forEach((el) => {
    if (!allowed(el.dataset.consent) || el.dataset.done) return;
    const s = document.createElement('script');
    if (el.dataset.src) { s.src = el.dataset.src; s.async = true; } else s.textContent = el.textContent;
    el.dataset.done = '1';
    el.after(s);
  });
}
function load(category, src) {
  return new Promise((res, rej) => {
    const run = () => {
      if (!allowed(category)) return false;
      const s = document.createElement('script');
      s.src = src; s.async = true; s.onload = res; s.onerror = rej;
      document.head.append(s);
      return true;
    };
    if (!run()) {
      const fn = () => { if (run()) listeners.delete(fn); };
      listeners.add(fn);
    }
  });
}

// ---------- banner ----------
function bannerHTML() {
  return `<div class="ck-in">
    <div class="ck-head"><span class="ck-ico" aria-hidden="true">${spriteSVG('cookie', 3)}</span><b class="px" id="ckTitle">${esc(tx(TXT.title))}</b></div>
    <p class="ck-txt">${esc(tx(TXT.body))}</p>
    <div class="ck-acts">
      <button type="button" class="btn btn-acc" data-ck="all">${esc(tx(TXT.all))}</button>
      <button type="button" class="btn btn-ink" data-ck="necessary" title="${esc(tx(TXT.reject))}">${esc(tx(TXT.necessary))}</button>
      <button type="button" class="btn btn-dash" data-ck="prefs">${esc(tx(TXT.prefs))}</button>
    </div>
    <a class="px ck-link" href="gizlilik.html">${esc(tx(TXT.policy))} ↗</a>
  </div>`;
}
function showBanner() {
  if (!banner) {
    banner = document.createElement('section');
    banner.className = 'ck-banner';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-labelledby', 'ckTitle');
    document.body.append(banner);
  }
  banner.innerHTML = bannerHTML();
  banner.hidden = false;
  requestAnimationFrame(() => banner.classList.add('in'));
}
function hideBanner() {
  if (!banner) return;
  banner.classList.remove('in');
  setTimeout(() => { if (banner) banner.hidden = true; }, 350);
}

// ---------- tercih penceresi ----------
function modalHTML() {
  const st = consentState();
  const on = (cat) => cat === 'necessary' || (st ? st[cat] : false);
  return `<div class="ck-card">
    <div class="ck-bar px"><span id="ckMTitle">${esc(tx(TXT.modalTitle))}</span><button type="button" class="modal-x px" data-ck="close" aria-label="${esc(tx(TXT.close))}">✕</button></div>
    <div class="ck-body" data-lenis-prevent>
      <p class="ck-intro">${esc(tx(TXT.intro))}</p>
      ${CATS.map((cat) => {
        const c = CAT_TXT[cat];
        return `<section class="ck-cat${IN_USE[cat] ? '' : ' unused'}">
          <div class="ck-cat-h">
            <div class="ck-cat-t"><b class="px" id="ck-${cat}">${esc(tx(c.name))}</b>${cat === 'necessary' ? `<span class="ck-tag px">${esc(tx(TXT.always))}</span>` : IN_USE[cat] ? '' : `<span class="ck-tag ck-tag-dim px">${esc(tx(TXT.unused))}</span>`}</div>
            <label class="ck-sw"><input type="checkbox" data-cat="${cat}" aria-labelledby="ck-${cat}" ${on(cat) ? 'checked' : ''} ${cat === 'necessary' ? 'disabled' : ''}><span class="ck-sw-ui" aria-hidden="true"></span></label>
          </div>
          <p class="ck-desc">${esc(tx(c.desc))}</p>
          ${c.items.length ? `<details class="ck-det"><summary class="px">${esc(tx(TXT.what))}</summary>
            <table class="ck-table"><thead><tr><th>${esc(tx(TXT.key))}</th><th>${esc(tx(TXT.purpose))}</th><th>${esc(tx(TXT.dur))}</th></tr></thead>
            <tbody>${c.items.map(([k, p, d]) => `<tr><td><code>${esc(k)}</code></td><td>${esc(tx(p))}</td><td>${esc(tx(d))}</td></tr>`).join('')}</tbody></table></details>` : ''}
        </section>`;
      }).join('')}
      <a class="px ck-link" href="gizlilik.html">${esc(tx(TXT.policy))} ↗</a>
    </div>
    <div class="ck-foot">
      <button type="button" class="btn btn-ink" data-ck="reject">${esc(tx(TXT.reject))}</button>
      <button type="button" class="btn" data-ck="save">${esc(tx(TXT.save))}</button>
      <button type="button" class="btn btn-acc" data-ck="all">${esc(tx(TXT.all))}</button>
    </div>
  </div>`;
}
function openModal() {
  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'ck-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'ckMTitle');
    modal.hidden = true;
    document.body.append(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); closeModal(); return; }
      if (e.key !== 'Tab') return;
      const f = [...modal.querySelectorAll('button, input:not([disabled]), summary, a[href]')];
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    });
  }
  lastFocus = document.activeElement;
  modal.innerHTML = modalHTML();
  modal.hidden = false;
  API.fx?.stopScroll?.();
  requestAnimationFrame(() => modal.classList.add('in'));
  modal.querySelector('[data-ck="close"]').focus();
}
function closeModal() {
  if (!modal || modal.hidden) return;
  modal.classList.remove('in');
  modal.hidden = true;
  API.fx?.startScroll?.();
  if (lastFocus?.isConnected) lastFocus.focus({ preventScroll: true });
}

export function initConsent() {
  document.addEventListener('click', (e) => {
    const open = e.target.closest('[data-consent-open]');
    if (open) { e.preventDefault(); openModal(); return; }
    const b = e.target.closest('[data-ck]');
    if (!b) return;
    const act = b.dataset.ck;
    if (act === 'all') acceptAll();
    else if (act === 'necessary' || act === 'reject') rejectAll();
    else if (act === 'prefs') openModal();
    else if (act === 'close') closeModal();
    else if (act === 'save') {
      const pick = (cat) => Boolean(modal?.querySelector(`input[data-cat="${cat}"]`)?.checked);
      save({ functional: pick('functional'), analytics: pick('analytics'), marketing: pick('marketing') });
    }
  });
  onLang(() => {
    if (banner && !banner.hidden) banner.innerHTML = bannerHTML();
    if (modal && !modal.hidden) { modal.innerHTML = modalHTML(); modal.querySelector('[data-ck="close"]').focus(); }
  });
  activateScripts();
  if (!consentState()) {
    // açılış ekranı bitince göster
    const wait = () => (document.documentElement.classList.contains('booting') ? setTimeout(wait, 300) : setTimeout(showBanner, 600));
    wait();
  }
  API.consent = {
    open: openModal,
    state: consentState,
    has: allowed,
    load,
    onChange: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    summary: () => {
      const st = consentState();
      if (!st) return tx(TXT.none);
      return CATS.filter((c) => c === 'necessary' || st[c]).map((c) => tx(CAT_TXT[c].name)).join(' · ');
    },
  };
}
