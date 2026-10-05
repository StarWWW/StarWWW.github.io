// FX — sitenin hareket sistemi.
// GSAP + ScrollTrigger + SplitText + Lenis (CDN, defer). Herhangi biri yüklenemezse
// ilgili efekt sessizce atlanır; içerik her durumda görünür kalır.
import { API, $, $$, store } from './util.js';
import { getLang, onLang } from './i18n.js';

const html = document.documentElement;
export const motionFull = () => html.dataset.motion !== 'reduce';
const finePointer = () => matchMedia('(hover: hover) and (pointer: fine)').matches;
const L = (tr, en) => (getLang() === 'en' ? en : tr);

let gsap = null;
let ST = null;
let Split = null;
let lenis = null;
let revealIO = null;
const scrollSubs = new Set();
const onScroll = (fn) => scrollSubs.add(fn);
const scrollY = () => window.scrollY;
// Ekrana giren (ya da geçilmiş) öğelerin bir kez oynayan animasyonları — kaydırma yönünden bağımsız
const onceQueue = [];
function whenSeen(el, play, ratio = 0.9) { onceQueue.push({ el, play, ratio, done: false }); }
function checkSeen() {
  for (const q of onceQueue) {
    if (q.done) continue;
    if (q.el.getBoundingClientRect().top < innerHeight * q.ratio) { q.done = true; q.play(); }
  }
}
const splits = [];
onLang(() => splits.forEach((sp) => { sp.stale = true; }));

// ---------------------------------------------------------------- yardımcılar
const GLYPHS = '▓▒░█<>/\\_-=+*#%&?!';
// Karıştırırken kutunun boyu sabit kalsın (harf genişlikleri farklı → kutular titremesin)
function lockBox(el) {
  if (el._lock || !el.offsetWidth) return;
  const cs = getComputedStyle(el);
  // kesirli genişlik (offsetWidth yuvarlar → komşular yarım piksel kayardı)
  let w = cs.display === 'inline' ? NaN : parseFloat(cs.width);
  if (!w) {
    w = el.getBoundingClientRect().width;
    if (cs.boxSizing !== 'border-box') w -= ['paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth'].reduce((a, k) => a + (parseFloat(cs[k]) || 0), 0);
  }
  el._lock = { width: el.style.width, minWidth: el.style.minWidth, maxWidth: el.style.maxWidth, whiteSpace: el.style.whiteSpace, display: el.style.display };
  if (cs.display === 'inline') el.style.display = 'inline-block';
  Object.assign(el.style, { width: `${w}px`, minWidth: `${w}px`, maxWidth: `${w}px`, whiteSpace: 'nowrap' });
}
function unlockBox(el) {
  if (!el._lock) return;
  Object.assign(el.style, el._lock);
  el._lock = null;
}
export function scramble(el, finalText = el.textContent, dur = 420) {
  if (!el || !motionFull()) return;
  if (el._scr) cancelAnimationFrame(el._scr);
  if (el.textContent === finalText) lockBox(el);
  const start = performance.now();
  const len = finalText.length;
  const step = (now) => {
    const p = Math.min(1, (now - start) / dur);
    const shown = Math.floor(p * len);
    let out = '';
    for (let i = 0; i < len; i++) {
      const ch = finalText[i];
      out += i < shown || ch === ' ' ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
    }
    el.textContent = out;
    if (p < 1) el._scr = requestAnimationFrame(step);
    else { el.textContent = finalText; el._scr = null; unlockBox(el); }
  };
  el._scr = requestAnimationFrame(step);
}
function cancelScrambles() {
  $$('[data-scramble], .sec-num').forEach((el) => { if (el._scr) { cancelAnimationFrame(el._scr); el._scr = null; if (el._scrFinal) el.textContent = el._scrFinal; } el._scrFinal = null; unlockBox(el); });
}

// ---------------------------------------------------------------- hareket anahtarı
function initMotionToggle() {
  const btns = [$('#motionToggle'), $('#motionToggle2')].filter(Boolean);
  const label = () => (motionFull() ? L('FX: TAM', 'FX: FULL') : L('FX: AZ', 'FX: LOW'));
  const paint = () => btns.forEach((b) => {
    b.setAttribute('aria-pressed', String(motionFull()));
    b.setAttribute('aria-label', motionFull() ? L('Animasyonları azalt', 'Reduce animations') : L('Animasyonları tam aç', 'Turn on full animations'));
    const lbl = b.querySelector('.fx-lbl');
    if (lbl) lbl.textContent = label(); else b.textContent = label();
  });
  btns.forEach((b) => b.addEventListener('click', () => setMotion(motionFull() ? 'reduce' : 'full')));
  paint();
  onLang(paint);

  // İşletim sistemi "hareketi azalt" diyorsa ve ziyaretçi henüz seçim yapmadıysa bir kez söyle
  if (!motionFull() && !store.get('star.motion.asked') && !localStorageHas('star.motion')) {
    store.set('star.motion.asked', true);
    setTimeout(() => actionToast(
      L('Sisteminde "hareketi azalt" açık, animasyonlar sade.', 'Your system asks for reduced motion, animations are minimal.'),
      L('TAM HAREKET', 'FULL MOTION'),
      () => setMotion('full'),
    ), 1200);
  }
}
function localStorageHas(k) { try { return localStorage.getItem(k) !== null; } catch { return false; } }
export function setMotion(mode) {
  try { localStorage.setItem('star.motion', mode); } catch { /* yok */ }
  try { sessionStorage.setItem('star.booted', '1'); } catch { /* yok */ }
  location.reload();
}
function actionToast(msg, act, fn) {
  const root = $('#toasts');
  if (!root) return;
  const el = document.createElement('div');
  el.className = 'toast toast-act';
  el.innerHTML = `<span></span><button type="button" class="px"></button><button type="button" class="px toast-x" aria-label="${L('Kapat', 'Close')}">✕</button>`;
  el.querySelector('span').textContent = msg;
  const b = el.querySelector('button');
  b.textContent = act;
  b.addEventListener('click', () => { el.remove(); fn(); });
  el.querySelector('.toast-x').addEventListener('click', () => el.remove());
  root.append(el);
  setTimeout(() => el.remove(), 12000);
}

// ---------------------------------------------------------------- açılış ekranı
function runBoot() {
  return new Promise((resolve) => {
    const boot = $('#boot');
    const log = $('#bootLog');
    const bar = $('#bootBar');
    if (!boot || !html.classList.contains('booting')) { resolve(); return; }
    $('#bootSkip').textContent = L('TIKLA YA DA BİR TUŞA BAS — ATLA', 'CLICK OR PRESS ANY KEY — SKIP');
    const lines = getLang() === 'en'
      ? [['STAR-OS v26.10 · (c) 2026 star', ''], ['BIOS', 'OK'], ['pixel memory', '32 COLORS'], ['spray can', 'FULL'], ['reality.exe', 'UNSTABLE'], ['music box', 'SPOTIFY'], ['> connecting to the room', '']]
      : [['STAR-OS v26.10 · (c) 2026 star', ''], ['BIOS', 'OK'], ['piksel belleği', '32 RENK'], ['sprey kutusu', 'DOLU'], ['gerçeklik.exe', 'KARARSIZ'], ['müzik kutusu', 'SPOTIFY'], ['> odaya bağlanılıyor', '']];
    let i = 0;
    let done = false;
    const timers = [];
    const finish = () => {
      if (done) return;
      done = true;
      timers.forEach(clearTimeout);
      window.removeEventListener('keydown', finish);
      boot.removeEventListener('pointerdown', finish);
      bar.style.width = '100%';
      try { sessionStorage.setItem('star.booted', '1'); } catch { /* yok */ }
      const out = () => { html.classList.remove('booting'); boot.remove(); };
      if (gsap) {
        gsap.timeline({ onComplete: out })
          .to(boot.querySelector('.boot-in'), { opacity: 0, y: -20, duration: 0.25, ease: 'power2.in' })
          .to(boot, { clipPath: 'inset(0 0 100% 0)', duration: 0.8, ease: 'expo.inOut' }, '-=.05');
        setTimeout(resolve, 380);
      } else { out(); resolve(); }
    };
    window.addEventListener('keydown', finish);
    boot.addEventListener('pointerdown', finish);
    const next = () => {
      if (done) return;
      if (i >= lines.length) {
        bar.style.width = '100%';
        timers.push(setTimeout(finish, 380));
        return;
      }
      const [k, v] = lines[i];
      const row = document.createElement('div');
      row.className = 'boot-row';
      if (v) row.innerHTML = `<span>${k}</span><i></i><b>${v}</b>`; else row.innerHTML = `<span>${k}</span>`;
      log.append(row);
      i++;
      bar.style.width = `${Math.round((i / lines.length) * 85)}%`;
      timers.push(setTimeout(next, i === 1 ? 260 : 150));
    };
    timers.push(setTimeout(next, 120));
  });
}

// ---------------------------------------------------------------- hero girişi
function heroIntro() {
  const done = () => html.classList.remove('fx-pending');
  if (!gsap) { done(); return; }
  const h1 = $('.star-h1-txt');
  let chars = [];
  if (Split && h1) chars = new Split(h1, { type: 'chars', charsClass: 'ch' }).chars;
  const q = (s) => $$(s);
  const ctas = q('.cta-row .btn');
  const lines = q('.status > div');
  gsap.set(chars, { yPercent: 70, opacity: 0, rotate: () => gsap.utils.random(-18, 18), scale: 0.7 });
  gsap.set(['.box-label', '.hero-meta-r'], { opacity: 0, y: -12 });
  gsap.set('.hero-tag', { clipPath: 'inset(0 100% 0 0)' });
  gsap.set('.hero-note', { clipPath: 'inset(0 100% 0 0)' });
  gsap.set('.manifesto > span', { opacity: 0, yPercent: 60 });
  gsap.set('.hero-sub', { opacity: 0, y: 24 });
  gsap.set(ctas, { opacity: 0, y: 28 });
  gsap.set('.avatar-win', { scaleY: 0, transformOrigin: '50% 0%' });
  gsap.set('.avatar-win .av, .avatar-win figcaption', { opacity: 0 });
  gsap.set('.lvl-sticker', { scale: 2.6, rotate: -60, opacity: 0 });
  gsap.set('.pill-note', { clipPath: 'inset(0 100% 0 0)' });
  gsap.set(lines, { opacity: 0, x: -12 });
  gsap.set('.status', { opacity: 0 });
  done();

  const tl = gsap.timeline({ defaults: { ease: 'expo.out' }, delay: 0.05 });
  tl.to(['.box-label', '.hero-meta-r'], { opacity: 1, y: 0, duration: 0.6, stagger: 0.08, clearProps: 'transform,opacity' })
    .to(chars, { yPercent: 0, opacity: 1, rotate: 0, scale: 1, duration: 1.1, stagger: 0.07, ease: 'back.out(1.6)' }, 0.05)
    .to('.hero-tag', { clipPath: 'inset(0 0% 0 0)', duration: 0.55, ease: 'steps(9)' }, 0.55)
    .to('.hero-note', { clipPath: 'inset(0 0% 0 0)', duration: 0.9, ease: 'power2.inOut' }, 0.8)
    .to('.manifesto > span', { opacity: 1, yPercent: 0, duration: 0.9, stagger: 0.12, clearProps: 'transform,opacity' }, 0.5)
    .to('.hero-sub', { opacity: 1, y: 0, duration: 0.9, clearProps: 'transform,opacity' }, 0.7)
    .to(ctas, { opacity: 1, y: 0, duration: 0.8, stagger: 0.08, ease: 'back.out(1.8)', clearProps: 'transform,opacity' }, 0.8)
    .to('.avatar-win', { scaleY: 1, duration: 0.7, ease: 'expo.inOut', clearProps: 'transform' }, 0.3)
    .to('.avatar-win .av, .avatar-win figcaption', { opacity: 1, duration: 0.25, ease: 'steps(4)', clearProps: 'opacity' }, 0.85)
    .to('.lvl-sticker', { scale: 1, rotate: -14, opacity: 1, duration: 0.6, ease: 'back.out(2.2)', clearProps: 'transform,opacity' }, 1.05)
    .to('.pill-note', { clipPath: 'inset(0 0% 0 0)', duration: 0.8, ease: 'power2.inOut', clearProps: 'clipPath' }, 1.2)
    .to('.status', { opacity: 1, duration: 0.2, clearProps: 'opacity' }, 0.9)
    .to(lines, { opacity: 1, x: 0, duration: 0.3, stagger: 0.12, ease: 'steps(3)', clearProps: 'transform,opacity' }, 1.0)
    .add(() => { gsap.set(['.hero-tag', '.hero-note'], { clearProps: 'clipPath' }); });
}

// ---------------------------------------------------------------- yumuşak kaydırma
function initLenis() {
  const Lenis = window.Lenis;
  if (!Lenis || !finePointer()) return;
  lenis = new Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 1, anchors: { offset: -72 }, autoRaf: !gsap });
  if (gsap) {
    gsap.ticker.add((time) => lenis && lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  lenis.on('scroll', () => { if (ST) ST.update(); });
}

// ---------------------------------------------------------------- görünce beliren öğeler
function initReveals() {
  revealIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('rv-in');
      revealIO.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -6% 0px', threshold: 0.08 });
  const scan = (root) => root.querySelectorAll?.('.rv:not(.rv-in)').forEach((el) => revealIO.observe(el));
  scan(document);
  new MutationObserver((muts) => muts.forEach((m) => m.addedNodes.forEach((n) => {
    if (n.nodeType !== 1) return;
    if (n.matches('.rv:not(.rv-in)')) revealIO.observe(n);
    scan(n);
  }))).observe(document.body, { childList: true, subtree: true });
}
function revealAllNow() { $$('.rv').forEach((el) => el.classList.add('rv-in')); }

// ---------------------------------------------------------------- bölüm başlıkları
function initSectionHeads() {
  $$('.sec-head').forEach((head) => {
    const num = head.querySelector('.sec-num');
    const title = head.querySelector('.sec-title');
    const note = head.querySelector('.sec-note, .sec-link');
    let split = null;
    if (Split && title) { split = new Split(title, { type: 'chars', mask: 'chars' }); splits.push(split); }
    const targets = split ? split.chars : [title];
    gsap.set(num, { clipPath: 'inset(0 100% 0 0)' });
    gsap.set(targets, { yPercent: 110 });
    if (note) gsap.set(note, { clipPath: 'inset(0 100% 0 0)' });
    const tl = gsap.timeline({
      paused: true,
      onComplete: () => { if (split && !split.stale) split.revert(); gsap.set([num, note], { clearProps: 'clipPath' }); },
    });
    tl.to(num, { clipPath: 'inset(0 0% 0 0)', duration: 0.6, ease: 'steps(6)', onStart: () => { num._scrFinal = num.textContent; scramble(num, num.textContent, 520); } })
      .to(targets, { yPercent: 0, duration: 0.9, stagger: 0.028, ease: 'expo.out' }, 0.12);
    if (note) tl.to(note, { clipPath: 'inset(0 0% 0 0)', duration: 0.9, ease: 'power3.inOut' }, 0.35);
    whenSeen(head, () => tl.play(), 0.9);
  });
}

// ---------------------------------------------------------------- kayan şerit (hıza duyarlı)
function initTicker() {
  const track = $('#ticker');
  if (!track) return;
  track.classList.add('js-mq');
  const tween = gsap.to(track, { xPercent: -50, duration: 32, ease: 'none', repeat: -1 });
  // Kaydırınca hızlanır, sonra yavaşça normale döner. Yön değiştirmez → hız asla sıfırdan geçmez, şerit durmaz.
  const settle = () => gsap.to(tween, { timeScale: 1, duration: 1.4, ease: 'power2.out', overwrite: true });
  ST.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => {
      const v = Math.min(6, 1 + Math.abs(self.getVelocity()) / 400);
      if (v > tween.timeScale() + 0.15) gsap.to(tween, { timeScale: v, duration: 0.2, ease: 'power1.out', overwrite: true, onComplete: settle });
    },
  });
  // güvenlik: bir şey hızı bozarsa düzelt
  setInterval(() => { if (!document.hidden && !document.documentElement.classList.contains('fx-frozen') && (tween.paused() || tween.timeScale() < 0.5)) { tween.paused(false); settle(); } }, 3000);
}

// ---------------------------------------------------------------- paralaks
function initParallax() {
  gsap.to('.hero-title', { yPercent: -16, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.hero-copy', { yPercent: 8, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.hero-side .status', { y: -40, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
}

// ---------------------------------------------------------------- footer
function initFooter() {
  const bye = $('.bye');
  if (!bye) return;
  // harfler HTML'de hazır (.bye-l > i); maske .bye-l'nin overflow'u
  let chars = $$('.bye-l > i', bye);
  if (!chars.length) chars = Split ? new Split(bye, { type: 'chars', mask: 'chars' }).chars : [bye];
  gsap.set(chars, { yPercent: 105 });
  gsap.set('.bye-tag', { clipPath: 'inset(0 100% 0 0)' });
  whenSeen(bye, () => gsap.timeline()
    .to(chars, { yPercent: 0, duration: 1.1, stagger: 0.09, ease: 'expo.out' })
    .to('.bye-tag', { clipPath: 'inset(0 0% 0 0)', duration: 1.1, ease: 'power2.inOut', clearProps: 'clipPath' }, 0.4), 0.88);
}

// ---------------------------------------------------------------- hero fare paralaksı
function initHeroMouse() {
  if (!gsap) return;
  const hero = $('.hero');
  const layers = [['.hero-title', 14], ['.avatar-win', -16], ['.pill-note', 10], ['.hero-note', 8], ['.halftone', -24]]
    .map(([s, d]) => [$(s), d]).filter(([el]) => el)
    .map(([el, d]) => ({ x: gsap.quickTo(el, 'x', { duration: 0.9, ease: 'power3.out' }), y: gsap.quickTo(el, 'y', { duration: 0.9, ease: 'power3.out' }), d }));
  // Bütün pencereyi dinler: fare sayfanın yanındaki boşluğa geçse de efekt kesilmez, sıfırlanmaz.
  // Sadece bölüm ekrandayken çalışır; fare pencereden çıkınca ya da bölüm ekrandan çıkınca yerine döner.
  const reset = () => layers.forEach((l) => { l.x(0); l.y(0); });
  let heroOn = true;
  new IntersectionObserver(([e]) => { heroOn = e.isIntersecting; if (!heroOn) reset(); }).observe(hero);
  window.addEventListener('pointermove', (e) => {
    if (!heroOn || e.pointerType !== 'mouse') return;
    const nx = e.clientX / window.innerWidth - 0.5;
    const ny = e.clientY / window.innerHeight - 0.5;
    layers.forEach((l) => { l.x(nx * l.d); l.y(ny * l.d); });
  }, { passive: true });
  document.addEventListener('mouseout', (e) => { if (!e.relatedTarget) reset(); });
}

// ---------------------------------------------------------------- imleç köşeleri
const CUR_SEL = 'a, button, [role="tab"], .cart, tr[data-i], input, textarea, select, label[for], .wall, [data-cursor]';
function initCursor() {
  if (!gsap) return;
  const c = document.createElement('div');
  c.className = 'cur';
  c.setAttribute('aria-hidden', 'true');
  c.innerHTML = '<i></i><i></i><i></i><i></i><b class="cur-l"></b>';
  document.body.append(c);
  html.classList.add('has-cur');
  const lbl = c.querySelector('.cur-l');
  const qt = (prop) => gsap.quickTo(c, prop, { duration: 0.32, ease: 'power3.out' });
  const X = qt('x'); const Y = qt('y'); const W = qt('width'); const H = qt('height');
  let mx = -100; let my = -100; let target = null;

  const labelFor = (el) => {
    if (!el) return '';
    if (el.dataset.cursor) return el.dataset.cursor;
    if (el.classList.contains('wall')) return API.wall?.isSpraying() ? '' : L('SPREY?', 'SPRAY?');
    if (el.classList.contains('cart')) return L('İNCELE', 'INSPECT');
    if (el.matches('tr[data-i]')) return L('ÇAL', 'PLAY');
    if (el.matches('input, textarea, select')) return L('YAZ', 'TYPE');
    if (el.tagName === 'A') return el.target === '_blank' ? L('AÇ ↗', 'OPEN ↗') : L('GİT', 'GO');
    return L('TIKLA', 'CLICK');
  };
  const place = () => {
    if (target && document.contains(target) && !target.classList.contains('wall')) {
      const r = target.getBoundingClientRect();
      X(r.left - 7); Y(r.top - 7); W(r.width + 14); H(r.height + 14);
    } else {
      X(mx - 13); Y(my - 13); W(26); H(26);
    }
  };
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    mx = e.clientX; my = e.clientY;
    const off = Boolean(e.target.closest?.('.g-root, .ad, .terminal, .boot')) || (API.wall?.isSpraying() && e.target.closest?.('.wall'));
    c.classList.toggle('off', off);
    const el = off ? null : e.target.closest?.(CUR_SEL);
    if (el !== target) {
      target = el;
      const text = labelFor(el);
      lbl.textContent = text;
      c.classList.toggle('on', Boolean(el) && !el.classList.contains('wall'));
      c.classList.toggle('lbl', Boolean(text));
    }
    place();
  }, { passive: true });
  document.addEventListener('pointerdown', () => c.classList.add('down'));
  document.addEventListener('pointerup', () => c.classList.remove('down'));
  document.addEventListener('mouseleave', () => c.classList.add('off'));
  onScroll(place);
}

// ---------------------------------------------------------------- mıknatıs
function initMagnetic() {
  $$('[data-magnetic]').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${((e.clientX - r.left - r.width / 2) * 0.22).toFixed(1)}px`);
      el.style.setProperty('--my', `${((e.clientY - r.top - r.height / 2) * 0.32).toFixed(1)}px`);
    });
    el.addEventListener('pointerleave', () => { el.style.setProperty('--mx', '0px'); el.style.setProperty('--my', '0px'); });
  });
}

// ---------------------------------------------------------------- 3B eğilen kartlar
function initTilt() {
  $$('[data-tilt]').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      el.style.setProperty('--ry', `${((px - 0.5) * 9).toFixed(2)}deg`);
      el.style.setProperty('--rx', `${((0.5 - py) * 7).toFixed(2)}deg`);
      el.style.setProperty('--gx', `${(px * 100).toFixed(1)}%`);
      el.style.setProperty('--gy', `${(py * 100).toFixed(1)}%`);
      el.classList.add('tilting');
    });
    el.addEventListener('pointerleave', () => {
      el.classList.remove('tilting');
      ['--rx', '--ry'].forEach((p) => el.style.setProperty(p, '0deg'));
    });
  });
}

// ---------------------------------------------------------------- yazı karıştırma
function initScramble() {
  document.addEventListener('pointerover', (e) => {
    const el = e.target.closest?.('[data-scramble]');
    if (!el || el.contains(e.relatedTarget)) return;
    if (el.children.length) return;
    const final = el._scr ? el._scrFinal : el.textContent;
    el._scrFinal = final;
    scramble(el, final, 380);
  });
  onLang(cancelScrambles);
}

// ---------------------------------------------------------------- sayaçlar
function initCounters() {
  const fmt = (n) => new Intl.NumberFormat(getLang() === 'en' ? 'en-US' : 'tr-TR').format(n);
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    io.unobserve(e.target);
    const el = e.target;
    const end = Number(el.dataset.count) || 0;
    if (!motionFull()) { el.textContent = fmt(end); return; }
    const t0 = performance.now();
    const dur = 1400;
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const v = Math.round(end * (1 - (1 - p) ** 4));
      el.textContent = fmt(v);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }), { threshold: 0.6 });
  $$('[data-count]').forEach((el) => { if (motionFull()) el.textContent = fmt(0); io.observe(el); });
  onLang(() => $$('[data-count]').forEach((el) => { el.textContent = fmt(Number(el.dataset.count) || 0); }));
}

// ---------------------------------------------------------------- kaydırma çubuğu, başlık, yukarı
function initScrollUi() {
  const prog = $('#scrollProg');
  const top = $('#toTop');
  let last = 0;
  const tick = () => {
    const y = scrollY();
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    if (prog) prog.style.transform = `scaleX(${Math.min(1, y / max).toFixed(4)})`;
    const dy = y - last;
    const menuOpen = !$('#mobileNav')?.hidden;
    if (motionFull() && y > 320 && dy > 6 && !menuOpen) html.classList.add('hdr-hide');
    else if (dy < -6 || y <= 320) html.classList.remove('hdr-hide');
    last = y;
    top?.classList.toggle('show', y > innerHeight * 1.1);
    checkSeen();
    scrollSubs.forEach((fn) => fn(y));
  };
  window.addEventListener('scroll', tick, { passive: true });
  tick();
  top?.addEventListener('click', () => {
    if (lenis) lenis.scrollTo(0, { duration: 1.6, easing: (x) => 1 - (1 - x) ** 4 });
    else window.scrollTo({ top: 0, behavior: motionFull() ? 'smooth' : 'auto' });
  });
}

// ---------------------------------------------------------------- piksel geçişi (mod değişimi)
export function pixelSwap(fn) {
  if (!motionFull()) { fn(); return Promise.resolve(); }
  return new Promise((res) => {
    const cv = document.createElement('canvas');
    cv.className = 'pxswap';
    cv.width = innerWidth; cv.height = innerHeight;
    document.body.append(cv);
    const ctx = cv.getContext('2d');
    const S = innerWidth < 640 ? 32 : 48;
    const cols = Math.ceil(innerWidth / S); const rows = Math.ceil(innerHeight / S);
    const order = (bias) => {
      const cells = [];
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) cells.push([x, y, Math.random() * 0.6 + (bias(x, y))]);
      return cells.sort((a, b) => a[2] - b[2]);
    };
    const inCells = order((x) => x / cols);
    const outCells = order((x, y) => 1 - y / rows);
    const colors = ['#99E550', '#D77BBA', '#5FCDE4', '#222034', '#000000', '#FBF236', '#DF7126', '#222034'];
    let phase = 0; let drawn = 0; let t0 = performance.now();
    const step = (now) => {
      const dur = phase === 0 ? 300 : 360;
      const p = Math.min(1, (now - t0) / dur);
      const cells = phase === 0 ? inCells : outCells;
      const n = Math.floor(p * cells.length);
      for (; drawn < n; drawn++) {
        const [x, y] = cells[drawn];
        if (phase === 0) { ctx.fillStyle = colors[(x * 7 + y * 3) % colors.length]; ctx.fillRect(x * S, y * S, S, S); }
        else ctx.clearRect(x * S, y * S, S, S);
      }
      if (p >= 1) {
        if (phase === 0) { fn(); phase = 1; drawn = 0; t0 = now; }
        else { cv.remove(); res(); return; }
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

// ---------------------------------------------------------------- sekme başlığı + konsol
function initTabTitle() {
  const base = document.title;
  let timer = null;
  document.addEventListener('visibilitychange', () => {
    clearTimeout(timer);
    if (document.hidden) document.title = L('gitme... ;( — STAR', 'don\'t go... ;( — STAR');
    else { document.title = L('selam tekrar! — STAR', 'hello again! — STAR'); timer = setTimeout(() => { document.title = base; }, 1800); }
  });
}
function consoleSig() {
  const css = 'font-family:monospace;font-size:12px;line-height:1.1;color:#99E550;background:#222034;padding:8px 12px';
  console.log('%c ███ ███ ███ ███ \n █    █  █ █ █ █ \n ███  █  ███ ██  \n   █  █  █ █ █ █ \n ███  █  █ █ █ █ \n\n every hello comes with a goodbye.\n psst: ` tuşu.', css);
}

// ---------------------------------------------------------------- oyun / panel sırasında
const api = {
  scramble,
  pixelSwap,
  freeze() {
    html.classList.add('fx-frozen');
    revealAllNow();
    onceQueue.forEach((q) => { if (!q.done) { q.done = true; q.play(); } });
    // oyun hedefleri toplamadan önce yarım kalmış girişleri bitir (sonsuz şerit hariç)
    gsap?.globalTimeline.getChildren(false, true, true).forEach((a) => { if (a.repeat() !== -1 && !a.scrollTrigger) a.progress(1); });
    if (lenis) { lenis.destroy(); lenis = null; }
    ST?.getAll().forEach((s) => s.disable(true));
    html.classList.remove('hdr-hide');
  },
  thaw() {
    html.classList.remove('fx-frozen');
    if (motionFull()) initLenis();
    ST?.getAll().forEach((s) => s.enable());
    ST?.refresh();
  },
  stopScroll() { lenis?.stop(); },
  startScroll() { lenis?.start(); },
  scrollTo(target) {
    if (lenis) lenis.scrollTo(target, { offset: -72, duration: 1.2 });
    else (typeof target === 'string' ? $(target) : target)?.scrollIntoView({ behavior: motionFull() ? 'smooth' : 'auto' });
  },
  // verilen y'ye, verilen eğriyle kay (kaydırma sırasında kullanıcı girdisi kilitli)
  glide(y, { duration = 1, easing = (p) => p, onComplete } = {}) {
    if (lenis) { lenis.scrollTo(y, { duration, easing, lock: true, force: true, onComplete }); return; }
    const from = window.scrollY; const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / (duration * 1000));
      window.scrollTo({ top: from + (y - from) * easing(p), behavior: 'instant' });
      if (p < 1) requestAnimationFrame(step); else onComplete?.();
    };
    requestAnimationFrame(step);
  },
  jump(y) {
    if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
    else window.scrollTo({ top: y, behavior: 'instant' });
  },
};

// ---------------------------------------------------------------- başlat
export function initFx() {
  gsap = window.gsap || null;
  ST = window.ScrollTrigger || null;
  Split = window.SplitText || null;
  if (gsap && ST) gsap.registerPlugin(ST);
  if (gsap && Split) gsap.registerPlugin(Split);
  API.fx = api;

  initMotionToggle();
  initTabTitle();
  consoleSig();

  if (!motionFull()) {
    html.classList.remove('fx-pending', 'booting');
    $('#boot')?.remove();
    initScrollUi();
    initCounters();
    return;
  }

  html.classList.add('fx');
  initLenis();
  initScrollUi();
  initReveals();
  initScramble();
  initCounters();
  if (finePointer()) { initCursor(); initMagnetic(); initTilt(); initHeroMouse(); }
  if (gsap && ST) { initSectionHeads(); initTicker(); initParallax(); initFooter(); }

  const go = () => { heroIntro(); ST?.refresh(); checkSeen(); setTimeout(checkSeen, 400); };
  if (html.classList.contains('booting')) runBoot().then(go); else go();
  if (!gsap) { $('#boot')?.remove(); html.classList.remove('booting'); }
}
