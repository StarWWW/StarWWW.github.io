// EKRAN GÖRÜNTÜSÜ — o an görünen ekranın birebir resmi (DRUG modundaki erime shader'ı bunu eritir).
// Kütüphane yok: görünen kısım klonlanır, sitenin kendi CSS'iyle bir SVG <foreignObject> içine konur ve
// tarayıcı onu kendisi çizer (gölgeler, degradeler, pseudo öğeler birebir). SVG resmi dışarıdan bir şey
// yükleyemediği için yazı tipleri, resimler ve canvas'lar data: adresine çevrilir. Ekran dışındaki büyük
// bloklar aynı boyda boş kutulara dönüşür, böylece yerleşim değişmez ama iş azalır.
const SKIP = '.trip-trail, .trip-rain, .egg-toasts, .cur, .toasts, .terminal, .modal, .ck-banner, .ck-modal, .fx-scan, .fx-line, script, noscript, #boot, .melt-gl, .trip-bug, .trip-star, .pxswap, .room-fx, audio';
const FONT_RE = /url\((['"]?)([^'")]+\.woff2)\1\)/g;
// klonda animasyon/geçiş yok: her şey son hâlinde dursun
const FREEZE = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}';

let cssJob = null;
const readAs = (blob) => new Promise((ok, bad) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = bad; fr.readAsDataURL(blob); });

// sitenin CSS'i, yazı tipleri gömülü (bir kez hazırlanır)
function siteCSS() {
  if (cssJob) return cssJob;
  cssJob = (async () => {
    const link = document.querySelector('link[rel="stylesheet"][href*="style.css"]');
    const base = new URL(link?.href || 'css/style.css', location.href);
    let css = await (await fetch(base, { cache: 'force-cache' })).text();
    const urls = [...new Set([...css.matchAll(FONT_RE)].map((m) => m[2]))];
    const map = {};
    await Promise.all(urls.map(async (u) => {
      try { map[u] = await readAs(await (await fetch(new URL(u, base), { cache: 'force-cache' })).blob()); } catch { map[u] = ''; }
    }));
    return css.replace(FONT_RE, (all, q, u) => (map[u] ? `url(${map[u]})` : 'local("none")'));
  })().catch((err) => { cssJob = null; throw err; });
  return cssJob;
}

// resimler: aynı siteden olanlar dosyadan okunur; başka sitelerden gelenler (CSP fetch'e izin vermez) zaten yüklenmiş
// hâlleriyle canvas'a çizilir — izinsizse boş kalır (yerleşim yine bozulmaz)
const imgCache = new Map();
function imgData(o) {
  const src = o.currentSrc || o.src;
  if (!src || src.startsWith('data:')) return Promise.resolve(src || '');
  if (imgCache.has(src)) return imgCache.get(src);
  let job;
  if (new URL(src, location.href).origin === location.origin) {
    job = fetch(src, { cache: 'force-cache' }).then((r) => (r.ok ? r.blob() : Promise.reject(r.status))).then(readAs).catch(() => '');
  } else {
    let out = '';
    try {
      if (o.complete && o.naturalWidth) {
        const c = document.createElement('canvas');
        c.width = o.naturalWidth; c.height = o.naturalHeight;
        c.getContext('2d').drawImage(o, 0, 0);
        out = c.toDataURL('image/png');
      }
    } catch { out = ''; }
    job = Promise.resolve(out);
  }
  imgCache.set(src, job);
  return job;
}

const inView = (r, vh, vw) => r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw && (r.width || r.height);
// yerleşimdeki (döndürme/ölçek hariç) boyut
const boxOf = (el) => { const cs = getComputedStyle(el); return [parseFloat(cs.width) || el.offsetWidth || 0, parseFloat(cs.height) || el.offsetHeight || 0, cs.display]; };
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

// orijinal ve klon ağaçlarında birlikte yürü
function prune(orig, copy, vw, vh, jobs) {
  const oc = orig.children; const cc = copy.children;
  for (let i = oc.length - 1; i >= 0; i--) {
    const o = oc[i]; const c = cc[i];
    if (!c) continue;
    if (o.matches(SKIP) || o.hidden) { c.remove(); continue; }
    const r = o.getBoundingClientRect();
    const tag = o.tagName;
    if (tag === 'CANVAS' || tag === 'IFRAME' || tag === 'VIDEO') {
      const [w, h, display] = boxOf(o);
      const im = document.createElement(tag === 'CANVAS' && inView(r, vh, vw) ? 'img' : 'div');
      if (im.tagName === 'IMG') { try { im.src = o.toDataURL('image/png'); } catch { im.src = BLANK; } }
      im.className = o.className;
      im.setAttribute('style', o.getAttribute('style') || '');
      Object.assign(im.style, { width: `${w}px`, height: `${h}px`, display: display === 'inline' ? 'inline-block' : display });
      c.replaceWith(im);
      continue;
    }
    if (tag === 'IMG') {
      const [w, h] = boxOf(o);
      c.removeAttribute('srcset'); c.removeAttribute('loading'); c.removeAttribute('data-src');
      c.setAttribute('alt', '');
      c.style.width = `${w}px`; c.style.height = `${h}px`;
      c.setAttribute('src', BLANK);
      const src = o.currentSrc || o.src;
      if (inView(r, vh, vw) && src) jobs.push(imgData(o).then((d) => { if (d) c.setAttribute('src', d); }));
      continue;
    }
    if (tag === 'INPUT' || tag === 'TEXTAREA') {
      if (o.type === 'checkbox' || o.type === 'radio') { if (o.checked) c.setAttribute('checked', ''); } else if (tag === 'TEXTAREA') c.textContent = o.value; else c.setAttribute('value', o.value);
      continue;
    }
    if (!inView(r, vh, vw) && o.children.length && o instanceof HTMLElement && (r.height > 40 || r.width > 40)) {
      // ekran dışı: aynı boyda boş kutu (yerleşim bozulmasın)
      const [, h] = boxOf(o);
      c.replaceChildren();
      c.style.height = `${h}px`;
      c.style.minHeight = `${h}px`;
      c.style.maxHeight = `${h}px`;
      c.style.overflow = 'hidden';
      continue;
    }
    // içi kaydırılmış kutular (kitaplık tablosu, raf…)
    if ((o.scrollTop || o.scrollLeft) && o.children.length) {
      [...c.children].forEach((k) => { k.style.translate = `${-o.scrollLeft}px ${-o.scrollTop}px`; });
    }
    if (o.children.length) prune(o, c, vw, vh, jobs);
  }
}

// yapışkan başlık klonda sayfanın başında kalır → ekrandaki yerine kaydır
function fixSticky(copyBody, vh) {
  document.querySelectorAll('.topbar, .mobile-nav').forEach((o) => {
    if (o.hidden || getComputedStyle(o).position !== 'sticky') return;
    const r = o.getBoundingClientRect();
    const prev = o.style.position;
    o.style.position = 'static';
    const s = o.getBoundingClientRect();
    o.style.position = prev;
    const path = [];
    for (let n = o; n && n !== document.body; n = n.parentElement) path.unshift([...n.parentElement.children].indexOf(n));
    let c = copyBody;
    path.forEach((i) => { c = c?.children[i]; });
    if (!c || !inView(r, vh, innerWidth)) return;
    c.style.position = 'relative';
    c.style.top = `${r.top - s.top}px`;
    c.style.zIndex = '40';
  });
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// görünen ekranın resmi (HTMLImageElement); scale = netlik (1 = CSS pikseli)
export async function snapshotViewport({ scale = 1 } = {}) {
  const vw = document.documentElement.clientWidth; const vh = window.innerHeight;
  const css = await siteCSS();
  const body = document.body;
  const copy = body.cloneNode(true);
  // sabit öğeler (mini çalar, yukarı düğmesi…) klonda ekrandaki yerlerine sabitlenir
  [...body.children].forEach((o, i) => {
    if (o.matches(SKIP) || o.hidden || getComputedStyle(o).position !== 'fixed') return;
    const r = o.getBoundingClientRect();
    Object.assign(copy.children[i].style, { position: 'absolute', top: `${r.top + window.scrollY}px`, left: `${r.left + window.scrollX}px`, right: 'auto', bottom: 'auto', width: `${r.width}px`, height: `${r.height}px`, margin: '0', transform: 'none', translate: 'none', rotate: 'none' });
  });
  const jobs = [];
  prune(body, copy, vw, vh, jobs);
  fixSticky(copy, vh);
  const bs = getComputedStyle(body);
  copy.style.margin = '0';
  copy.style.width = `${vw}px`;
  copy.style.transform = `translate(${-window.scrollX}px, ${-window.scrollY}px)`;
  copy.style.backgroundPosition = bs.backgroundPosition;
  await Promise.all(jobs);
  const rootAttrs = [...document.documentElement.attributes].filter((a) => a.name !== 'style').map((a) => ` ${a.name}="${esc(a.value)}"`).join('');
  const rootStyle = `${document.documentElement.getAttribute('style') || ''};width:${vw}px;overflow:hidden`;
  const xhtml = new XMLSerializer().serializeToString(copy);
  // SVG'nin genişliği = pencere genişliği (vw birimleri ve medya sorguları birebir aynı çıksın, kaydırma çubuğu dahil);
  // sayfa ise kaydırma çubuğu hariç genişlikte dizilir
  const fw = window.innerWidth;
  const W = Math.round(fw * scale); const H = Math.round(vh * scale);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${fw} ${vh}"><foreignObject x="0" y="0" width="${fw}" height="${vh}"><html xmlns="http://www.w3.org/1999/xhtml"${rootAttrs} style="${esc(rootStyle)}"><head><style><![CDATA[${css}${FREEZE}]]></style></head>${xhtml}</html></foreignObject></svg>`;
  const img = new Image();
  img.decoding = 'async';
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  return { img, width: vw, fullWidth: fw, height: vh };
}
