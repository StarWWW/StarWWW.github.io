// DRUG MODU EASTER EGG'LERİ — sadece hap yutulduğunda (html[data-mode="drug"]) çalışır.
//
// Her zaman açık (DRUG'dayken): gökkuşağı imleç izi, hızlı kaydırınca jöle gibi esneyen bölüm başlıkları,
// kayan şeritte gizli mesajlar, müzik çalarken başlıkların basla nefes alması.
// Bulunabilir sırlar: ekranda gezen halüsinasyon böcekleri, klavyeden gizli kelimeler (uyan / ters / asit —
// terminalde de çalışır), avatara 3 tık, Shift'i basılı tutmak, logoya 7 tık, hiçbir şey yapmamak, başlığa çift tık,
// footer odasındaki pencere ve kedi, müzik + hap… Hepsi bulununca final. Terminalde `trip` bulunanları listeler.
//
// Performans: sayfanın köküne (html) her karede CSS değişkeni yazmak 4-5 bin öğenin stilini yeniden hesaplatıyordu
// (kare başına ~20 ms). Artık efektler sadece ekrandaki birkaç öğeye doğrudan yazılır.
import { API, store, esc, reducedMotion } from './util.js';
import { getLang, onLang } from './i18n.js';
import { spriteSVG } from './sprites.js';
import { createMelt } from './melt.js';

const L = (tr, en) => (getLang() === 'en' ? en : tr);
const isDrug = () => document.documentElement.dataset.mode === 'drug';
const finePointer = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

// [ad TR, ad EN, açıklama TR, açıklama EN, ipucu TR, ipucu EN]
const EGGS = {
  bug: ['BÖCEK AVCISI', 'BUG HUNTER', 'bir halüsinasyon böceği yakaladın', 'you caught a hallucination bug', 'ekranda bir şey geziniyor…', 'something is crawling on the screen…'],
  bugKing: ['BÖCEK KRALI', 'BUG KING', '5 böcek. artık onlar senden korkuyor', '5 bugs. now they fear you', 'bir tane yetmez. beş.', 'one is not enough. five.'],
  wake: ['UYANDIN', 'AWAKE', 'kod yağmuru başladı', 'the code rain begins', 'klavyeyle uyanmayı dene.', 'try waking up with your keyboard.'],
  eye: ['ÜÇÜNCÜ GÖZ', 'THIRD EYE', 'avatar gözlerini açtı', 'the avatar opened its eyes', 'kendine üç kez bak.', 'look at yourself three times.'],
  negative: ['NEGATİF', 'NEGATIVE', 'renkler ters döndü', 'the colours flipped', 'büyük harf tuşunu uzun tut.', 'hold the capital key down.'],
  flip: ['TERS DÜNYA', 'UPSIDE DOWN', 'yerçekimi tersine döndü', 'gravity turned upside down', 'dünyayı t… çevir.', 'f… the world.'],
  acid: ['ASİT', 'ACID', 'duvarlar eriyor', 'the walls are melting', 'kimyasal bir kelime.', 'a chemical word.'],
  logo: ['ADINI SÖYLE', 'SAY MY NAME', 'logo sarhoş oldu', 'the logo got drunk', 'adını yedi kez çağır.', 'call its name seven times.'],
  melt: ['ERİME', 'MELTDOWN', 'hiçbir şey yapmayınca ekran eridi', 'you did nothing, the screen melted', 'hiçbir şey yapma.', 'do nothing.'],
  boom: ['PATLAMA', 'KABOOM', 'başlık parçalandı', 'a title exploded', 'bir başlığa iki kez dokun.', 'touch a title twice.'],
  ufo: ['UFO', 'UFO', 'odanın penceresinden bir şey geçti', 'something flew past the room window', 'gece penceresinden bak.', 'look out of the night window.'],
  cat: ['UÇAN KEDİ', 'FLYING CAT', 'kedi yerçekimini reddetti', 'the cat refused gravity', 'odadaki kediyi rahatsız et.', 'bother the cat in the room.'],
  sync: ['SENKRON', 'IN SYNC', 'sayfa müzikle nefes alıyor', 'the page breathes with the music', 'müzik + hap.', 'music + pill.'],
};
const IDS = Object.keys(EGGS);
const N = IDS.length;
const TICKER = {
  tr: ['UYAN', 'BU BİR SİMÜLASYON', 'C.O.W. = ?', 'DUVARLAR NEFES ALIYOR', `${N} SIR VAR`, 'BÖCEKLERİ YAKALA', 'TERMİNALE TRIP YAZ', 'GERÇEK NE Kİ'],
  en: ['WAKE UP', 'THIS IS A SIMULATION', 'C.O.W. = ?', 'THE WALLS ARE BREATHING', `${N} SECRETS`, 'CATCH THE BUGS', 'TYPE TRIP IN THE TERMINAL', 'WHAT IS REAL ANYWAY'],
};

// Avatarın açık gözleri — 48×48'lik avatar ızgarasında, kapalı göz çizgilerinin tam üstüne oturur.
// # = çizgi, W = göz beyazı. Açılma kareleri: yarık → yarı açık → tam açık.
const EYE_FULL = ['..######..', '.#WWWWWW#.', '#WWWWWWWW#', '#WWWWWWWW#', '#WWWWWWWW#', '.#WWWWWW#.', '..######..'];
const EYE_FRAMES = [
  null,
  [[3, '##########']],
  [[2, '.########.'], [3, '#WWWWWWWW#'], [4, '.########.']],
  EYE_FULL.map((row, y) => [y, row]),
];
const EYE_POS = [[10, 23], [27, 22]]; // sol / sağ gözün sol üst köşesi
const IRIS = ['.II.', 'IBBI', 'IBBI', '.II.'];

function eyeSVG() {
  const rects = (rows, ox, oy, map) => rows.map(([y, row]) => [...row].map((ch, x) => (map[ch] ? `<rect x="${ox + x}" y="${oy + y}" width="1" height="1" fill="${map[ch]}"/>` : '')).join('')).join('');
  const frames = EYE_FRAMES.map((rows, f) => {
    if (!rows) return '';
    const body = EYE_POS.map(([ox, oy]) => rects(rows, ox - 1, oy, { '#': '#D77BBA' }) + rects(rows, ox + 1, oy, { '#': '#5FCDE4' }) + rects(rows, ox, oy, { '#': '#222034', W: '#F2EEE3' })).join('');
    return `<g class="ae-f" data-f="${f}">${body}</g>`;
  }).join('');
  const iris = EYE_POS.map(([ox, oy]) => `<g class="ae-iris" data-ox="${ox}" data-oy="${oy}" transform="translate(${ox + 3} ${oy + 2})">${rects(IRIS.map((r, y) => [y, r]), 0, 0, { I: '#D77BBA', B: '#0b0a12' })}<rect x="1" y="1" width="1" height="1" fill="#FFFFFF"/></g>`).join('');
  return `<svg viewBox="0 0 48 48" shape-rendering="crispEdges" aria-hidden="true">${frames}<g class="ae-pupils">${iris}</g></svg>`;
}

export function initDrug() {
  const html = document.documentElement;
  const found = new Set((store.get('star.trip', []) || []).filter((id) => EGGS[id]));
  let bugsCaught = Number(store.get('star.bugs', 0)) || 0;

  // ---------- sır kazanma ----------
  const eggBox = document.createElement('div');
  eggBox.className = 'egg-toasts';
  eggBox.setAttribute('aria-live', 'polite');
  document.body.append(eggBox);
  function eggToast(title, sub, big = false) {
    const el = document.createElement('div');
    el.className = `egg-toast${big ? ' big' : ''}`;
    el.innerHTML = `<span class="egg-ico">${spriteSVG(big ? 'trophy' : 'sparkle', 3)}</span><span class="egg-txt"><b class="px">${esc(title)}</b><i>${esc(sub)}</i></span>`;
    eggBox.append(el);
    setTimeout(() => el.classList.add('out'), big ? 6500 : 4200);
    setTimeout(() => el.remove(), big ? 7000 : 4700);
  }
  function unlock(id) {
    if (!EGGS[id] || found.has(id)) return;
    found.add(id);
    store.set('star.trip', [...found]);
    const e = EGGS[id];
    API.sfx?.play('secret');
    eggToast(`${L('SIR', 'SECRET')} ${found.size}/${N} · ${L(e[0], e[1])}`, L(e[2], e[3]));
    if (found.size === N) setTimeout(finale, 1600);
  }
  function finale() {
    API.sfx?.play('bigSecret');
    matrixRain(9000);
    eggToast(L(`TAM TRİP · ${N}/${N}`, `FULL TRIP · ${N}/${N}`), L('her şeyi gördün. gerçeklik bir daha asla aynı olmayacak.', 'you have seen everything. reality will never be the same.'), true);
  }

  // ---------- 1) gökkuşağı imleç izi ----------
  const trail = document.createElement('canvas');
  trail.className = 'trip-trail';
  trail.setAttribute('aria-hidden', 'true');
  document.body.append(trail);
  const tg = trail.getContext('2d');
  const pts = [];
  let trailRaf = 0;
  const sizeTrail = () => { trail.width = window.innerWidth; trail.height = window.innerHeight; };
  sizeTrail();
  window.addEventListener('resize', sizeTrail);
  function drawTrail() {
    trailRaf = 0;
    tg.clearRect(0, 0, trail.width, trail.height);
    const now = performance.now();
    for (let i = pts.length - 1; i >= 0; i--) {
      const p = pts[i];
      const age = (now - p.t) / 650;
      if (age >= 1) { pts.splice(i, 1); continue; }
      const s = Math.round(10 * (1 - age)) || 1;
      tg.fillStyle = `hsla(${(p.h + age * 120) % 360},95%,60%,${1 - age})`;
      tg.fillRect(Math.round(p.x / 4) * 4 - s / 2, Math.round(p.y / 4) * 4 - s / 2 + age * 18, s, s);
    }
    if (pts.length) trailRaf = requestAnimationFrame(drawTrail);
  }
  let hue = 0;
  window.addEventListener('pointermove', (e) => {
    poke();
    if (!isDrug() || reducedMotion() || !finePointer() || e.pointerType !== 'mouse') return;
    hue = (hue + 7) % 360;
    pts.push({ x: e.clientX, y: e.clientY, t: performance.now(), h: hue });
    if (pts.length > 80) pts.shift();
    if (!trailRaf) trailRaf = requestAnimationFrame(drawTrail);
  }, { passive: true });

  // ekrandaki öğeleri izle (efektler sadece görünenlere yazılır)
  const visible = new Set();
  const visIO = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) visible.add(e.target);
    else { visible.delete(e.target); e.target.style.scale = ''; e.target.style.transform = ''; }
  }));
  const heads = [...document.querySelectorAll('.sec-head')];
  const beaters = [...document.querySelectorAll('.star-h1, .bye, .sec-num')];
  [...heads, ...beaters].forEach((el) => visIO.observe(el));

  // ---------- 2) hızlı kaydırınca bölüm başlıkları jöle gibi esner ----------
  let lastY = window.scrollY; let lastT = performance.now(); let jellyTimer = 0; let jellyRaf = 0; let jelly = 0;
  const paintJelly = () => {
    jellyRaf = 0;
    const v = jelly ? `skewY(${jelly.toFixed(2)}deg)` : '';
    heads.forEach((h) => { if (visible.has(h)) h.style.transform = v; });
  };
  window.addEventListener('scroll', () => {
    poke();
    const now = performance.now();
    const v = (window.scrollY - lastY) / Math.max(1, now - lastT);
    lastY = window.scrollY; lastT = now;
    if (!isDrug() || reducedMotion() || flipping) return;
    const sk = Math.max(-6, Math.min(6, v * 2.4));
    if (Math.abs(sk) < 0.4 && !jelly) return;
    jelly = sk;
    if (!jellyRaf) jellyRaf = requestAnimationFrame(paintJelly);
    clearTimeout(jellyTimer);
    jellyTimer = setTimeout(() => { jelly = 0; if (!jellyRaf) jellyRaf = requestAnimationFrame(paintJelly); }, 140);
  }, { passive: true });

  // ---------- 3) halüsinasyon böcekleri ----------
  let bugTimer = 0;
  function scheduleBug() {
    clearTimeout(bugTimer);
    if (!isDrug()) return;
    bugTimer = setTimeout(() => { spawnBug(); scheduleBug(); }, 14000 + Math.random() * 16000);
  }
  function spawnBug() {
    if (!isDrug() || document.hidden || document.querySelector('.trip-bug')) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'trip-bug';
    b.setAttribute('aria-label', L('Halüsinasyon böceği — yakala!', 'Hallucination bug — catch it!'));
    b.innerHTML = `<span class="f1">${spriteSVG('bug', 4)}</span><span class="f2">${spriteSVG('bug2', 4)}</span>`;
    const W = window.innerWidth; const H = window.innerHeight;
    const side = Math.random() < 0.5;
    const y0 = 120 + Math.random() * (H - 240);
    const y1 = 120 + Math.random() * (H - 240);
    const from = side ? -60 : W + 20; const to = side ? W + 20 : -60;
    b.style.setProperty('--x0', `${from}px`); b.style.setProperty('--x1', `${to}px`);
    b.style.setProperty('--y0', `${y0}px`); b.style.setProperty('--y1', `${y1}px`);
    b.style.setProperty('--dur', `${8 + Math.random() * 5}s`);
    b.style.setProperty('--rot', side ? '90deg' : '-90deg');
    b.addEventListener('animationend', () => b.remove());
    b.addEventListener('click', () => {
      b.classList.add('splat');
      API.sfx?.play('splat');
      b.disabled = true;
      bugsCaught += 1;
      store.set('star.bugs', bugsCaught);
      unlock('bug');
      if (bugsCaught >= 5) { if (!found.has('bugKing')) matrixRain(5000); unlock('bugKing'); }
      else eggToast(`${L('BÖCEK', 'BUG')} ${bugsCaught}/5`, L('devam et…', 'keep going…'));
      setTimeout(() => b.remove(), 700);
    });
    document.body.append(b);
  }

  // ---------- 4) kod yağmuru ----------
  let rainOn = false;
  function matrixRain(ms = 7000) {
    if (rainOn) return;
    rainOn = true;
    API.sfx?.play('rain');
    const c = document.createElement('canvas');
    c.className = 'trip-rain';
    c.setAttribute('aria-hidden', 'true');
    document.body.append(c);
    const g = c.getContext('2d');
    const fs = 18;
    c.width = window.innerWidth; c.height = window.innerHeight;
    const cols = Math.ceil(c.width / fs);
    const drops = Array.from({ length: cols }, () => Math.random() * -40);
    const chars = 'ĞÜŞİÖÇ01STAR★▓▒░ODA21UYAN';
    const t0 = performance.now();
    let lastStep = 0;
    const step = (now) => {
      const age = now - t0;
      if (now - lastStep > 33) { // ~30 kare yeter, yarı iş
        lastStep = now;
        g.fillStyle = 'rgba(0,0,0,.18)';
        g.fillRect(0, 0, c.width, c.height);
        g.font = `${fs}px 'VCR OSD Mono TR', VT323, monospace`;
        drops.forEach((d, i) => {
          const ch = chars[(Math.random() * chars.length) | 0];
          g.fillStyle = Math.random() < 0.06 ? '#F2EEE3' : (i % 7 === 0 ? '#D77BBA' : '#99E550');
          g.fillText(ch, i * fs, d * fs);
          drops[i] = d * fs > c.height && Math.random() > 0.975 ? 0 : d + 1;
        });
        c.style.opacity = age > ms - 900 ? String(Math.max(0, (ms - age) / 900)) : '1';
      }
      if (age < ms) requestAnimationFrame(step); else { c.remove(); rainOn = false; }
    };
    requestAnimationFrame(step);
  }

  // ---------- 5) geçici sınıf efektleri + gizli kelimeler ----------
  const timers = {};
  function flash(cls, ms) {
    html.classList.add(cls);
    clearTimeout(timers[cls]);
    timers[cls] = setTimeout(() => html.classList.remove(cls), ms);
  }
  const CODES = { uyan: 'wake', wake: 'wake', ters: 'flip', flip: 'flip', asit: 'acid', acid: 'acid' };
  function trigger(code) {
    const id = CODES[code];
    if (!id || !isDrug()) return false;
    if (id === 'wake') matrixRain(7000);
    if (id === 'flip') flipWorld();
    if (id === 'acid') { API.sfx?.play('acid'); flash('trip-acid', 10000); }
    unlock(id);
    return true;
  }
  let typed = '';
  document.addEventListener('keydown', (e) => {
    poke();
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Shift') { startShift(); return; }
    if (e.key.length !== 1) return;
    typed = (typed + e.key.toLocaleLowerCase('tr')).slice(-8);
    Object.keys(CODES).forEach((code) => { if (typed.endsWith(code) && trigger(code)) typed = ''; });
  });

  // ---------- ters dünya: ekran ters döner, yerçekimi tersine işler ----------
  // Ekran baş aşağıyken sayfa kendi kendine "yukarı" kayar (ters dünyada aşağısı yukarısıdır), hızlanarak
  // sayfanın sonuna çarpar, sarsılır ve düzelir. Dönme her karede ekranın ortası etrafında olur.
  const frameEl = document.querySelector('.frame');
  let flipping = false;
  function flipWorld() {
    if (flipping || !frameEl) return;
    if (reducedMotion()) return; // hareket azaltılmışsa sadece sır açılır
    flipping = true;
    heads.forEach((h) => { h.style.transform = ''; });
    let raf = 0;
    const docTop = frameEl.getBoundingClientRect().top + window.scrollY;
    const track = () => { frameEl.style.transformOrigin = `50% ${Math.round(window.scrollY + window.innerHeight / 2 - docTop)}px`; raf = requestAnimationFrame(track); };
    const maxY = () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const fall = () => {
      const from = window.scrollY; const to = maxY();
      const dur = Math.max(1.2, Math.min(3.6, Math.sqrt(Math.max(1, to - from) / 1100)));
      API.fx?.glide(to, {
        duration: dur,
        easing: (p) => p * p, // yerçekimi: gittikçe hızlanır
        onComplete: () => {
          html.classList.add('trip-thud');
          API.sfx?.play('thud');
          setTimeout(() => {
            html.classList.remove('trip-thud', 'trip-flip');
            // dönüş animasyonu gerçekten bitince dönme noktasını bırak (erken bırakırsa sayfa sıçrar)
            let done = false;
            const finish = () => {
              if (done) return;
              done = true;
              frameEl.removeEventListener('transitionend', onEnd);
              cancelAnimationFrame(raf); frameEl.style.transformOrigin = ''; flipping = false;
            };
            const onEnd = (ev) => { if (ev.target === frameEl && ev.propertyName === 'rotate') finish(); };
            frameEl.addEventListener('transitionend', onEnd);
            setTimeout(() => { if (getComputedStyle(frameEl).rotate === 'none' || getComputedStyle(frameEl).rotate === '0deg') finish(); }, 1400);
          }, 520);
        },
      });
    };
    const begin = () => {
      track();
      html.classList.add('trip-flip');
      API.sfx?.play('whoosh');
      setTimeout(fall, 850);
    };
    // sona yakınsa düşecek yer yok: bir flaşın arkasında başa ışınlan
    if (maxY() - window.scrollY < window.innerHeight * 1.5) {
      html.classList.add('trip-blink');
      setTimeout(() => { API.fx?.jump(0); html.classList.remove('trip-blink'); begin(); }, 160);
    } else begin();
  }

  // Shift'i 2 saniye basılı tut → negatif
  let shiftTimer = 0;
  function startShift() {
    if (!isDrug() || shiftTimer) return;
    shiftTimer = setTimeout(() => { html.classList.add('trip-neg'); API.sfx?.play('invert'); unlock('negative'); }, 1800);
  }
  document.addEventListener('keyup', (e) => {
    if (e.key !== 'Shift') return;
    clearTimeout(shiftTimer); shiftTimer = 0;
    html.classList.remove('trip-neg');
  });
  window.addEventListener('blur', () => { clearTimeout(shiftTimer); shiftTimer = 0; html.classList.remove('trip-neg'); });

  // ---------- 6) üçüncü göz: DRUG avatarına 3 tık → avatar gözlerini açar, imleci izler, göz kırpar ----------
  const avWin = document.querySelector('.avatar-win');
  let avClicks = [];
  let eyes = null; let eyeFrame = 0; let eyeTimers = []; let blinkTimer = 0; let closeTimer = 0;
  const later = (fn, ms) => { eyeTimers.push(setTimeout(fn, ms)); };
  function placeEyes() {
    const img = avWin?.querySelector('.av-drug');
    if (!eyes || !img) return;
    Object.assign(eyes.style, { left: `${img.offsetLeft}px`, top: `${img.offsetTop}px`, width: `${img.offsetWidth}px`, height: `${img.offsetHeight}px` });
  }
  function setEyeFrame(f) {
    eyeFrame = f;
    if (eyes) eyes.dataset.f = String(f);
  }
  function animateEyes(seq, step) { seq.forEach((f, i) => later(() => setEyeFrame(f), i * step)); }
  function scheduleBlink() {
    clearTimeout(blinkTimer);
    blinkTimer = setTimeout(() => {
      if (eyeFrame !== 3) return;
      animateEyes([2, 1, 0, 1, 2, 3], 45);
      scheduleBlink();
    }, 2200 + Math.random() * 3200);
  }
  function openEyes() {
    API.sfx?.play('eyes');
    if (!eyes) {
      eyes = document.createElement('div');
      eyes.className = 'av-eyes';
      eyes.innerHTML = eyeSVG();
      avWin.append(eyes);
      window.addEventListener('resize', placeEyes);
    }
    placeEyes();
    eyeTimers.forEach(clearTimeout); eyeTimers = [];
    if (reducedMotion()) setEyeFrame(3); else animateEyes([1, 2, 1, 2, 3], 90);
    scheduleBlink();
    clearTimeout(closeTimer);
    closeTimer = setTimeout(closeEyes, 16000);
  }
  function closeEyes(now = false) {
    clearTimeout(blinkTimer); clearTimeout(closeTimer);
    eyeTimers.forEach(clearTimeout); eyeTimers = [];
    if (now || reducedMotion()) setEyeFrame(0); else animateEyes([2, 1, 0], 140);
  }
  avWin?.addEventListener('click', () => {
    if (!isDrug()) return;
    const now = Date.now();
    avClicks = avClicks.filter((x) => now - x < 1500).concat(now);
    if (avClicks.length < 3) return;
    avClicks = [];
    openEyes();
    unlock('eye');
  });
  // gözbebekleri imleci izler (tam piksellik adımlarla)
  let eyeRaf = 0; let lookX = 0; let lookY = 0;
  window.addEventListener('pointermove', (e) => {
    if (!eyes || eyeFrame !== 3) return;
    lookX = e.clientX; lookY = e.clientY;
    if (eyeRaf) return;
    eyeRaf = requestAnimationFrame(() => {
      eyeRaf = 0;
      const r = eyes.getBoundingClientRect();
      const u = r.width / 48;
      eyes.querySelectorAll('.ae-iris').forEach((g) => {
        const ox = Number(g.dataset.ox); const oy = Number(g.dataset.oy);
        const cx = r.left + (ox + 5) * u; const cy = r.top + (oy + 3.5) * u;
        const dx = lookX - cx; const dy = lookY - cy;
        const ix = ox + 3 + Math.max(-1, Math.min(1, Math.round(dx / 160)));
        const iy = oy + (dy > 30 ? 2 : 1);
        g.setAttribute('transform', `translate(${ix} ${iy})`);
      });
    });
  }, { passive: true });

  // ---------- 7) logoya 7 tık ----------
  const logo = document.querySelector('.topbar .logo');
  let logoClicks = [];
  logo?.addEventListener('click', () => {
    if (!isDrug()) return;
    const now = Date.now();
    logoClicks = logoClicks.filter((x) => now - x < 2500).concat(now);
    if (logoClicks.length < 7) return;
    logoClicks = [];
    flash('trip-logo', 6000);
    API.sfx?.play('glitch');
    burst(logo.getBoundingClientRect());
    unlock('logo');
  });
  function burst(r) {
    for (let i = 0; i < 18; i++) {
      const s = document.createElement('span');
      s.className = 'trip-star';
      s.innerHTML = spriteSVG('star', 2);
      const a = Math.random() * Math.PI * 2; const d = 60 + Math.random() * 140;
      s.style.left = `${r.left + r.width / 2}px`; s.style.top = `${r.top + r.height / 2}px`;
      s.style.setProperty('--dx', `${Math.cos(a) * d}px`); s.style.setProperty('--dy', `${Math.sin(a) * d + 60}px`);
      s.style.setProperty('--hue', `${(Math.random() * 360) | 0}deg`);
      document.body.append(s);
      setTimeout(() => s.remove(), 1300);
    }
  }

  // ---------- 8) hiçbir şey yapma → ekran gerçekten erir (WebGL shader) ----------
  const melt = createMelt();
  let idleTimer = 0; let melting = false;
  const busy = () => html.classList.contains('fx-frozen') || html.classList.contains('cv-open') || flipping
    || Boolean(document.querySelector('.terminal:not([hidden]), .modal:not([hidden]), .ck-modal'));
  function beginMelt() {
    if (!isDrug() || document.hidden || busy()) { poke(); return; }
    melting = true;
    unlock('melt');
    if (reducedMotion()) return;
    melt.start({ cancelled: () => !melting }).then((ok) => { if (melting) API.sfx?.play('melt'); if (!ok && melting) html.classList.add('trip-melt'); });
  }
  function poke() {
    if (melting) { melting = false; html.classList.remove('trip-melt'); if (melt.active()) API.sfx?.play('reform'); melt.stop(); }
    clearTimeout(idleTimer);
    if (!isDrug()) return;
    idleTimer = setTimeout(beginMelt, 25000);
  }
  ['pointerdown', 'wheel', 'touchstart', 'resize'].forEach((ev) => window.addEventListener(ev, () => { if (melting) poke(); }, { passive: true }));

  // ---------- 9) başlığa çift tık → patlama (harfler seçilmez) ----------
  document.addEventListener('mousedown', (e) => { if (e.detail > 1 && e.target.closest?.('.sec-title')) e.preventDefault(); });
  document.addEventListener('dblclick', (e) => {
    const h = e.target.closest('.sec-title');
    if (!h) return;
    window.getSelection()?.removeAllRanges();
    if (!isDrug() || h.dataset.boom) return;
    h.dataset.boom = '1';
    API.sfx?.play('break');
    const text = h.textContent;
    h.innerHTML = [...text].map((ch) => `<span class="boom-ch" style="--dx:${(Math.random() - 0.5) * 520}px;--dy:${(Math.random() - 0.7) * 320}px;--r:${(Math.random() - 0.5) * 720}deg">${ch === ' ' ? '&nbsp;' : esc(ch)}</span>`).join('');
    requestAnimationFrame(() => h.classList.add('booming'));
    setTimeout(() => h.classList.remove('booming'), 900);
    setTimeout(() => { h.textContent = text; delete h.dataset.boom; }, 1900);
    unlock('boom');
  });

  // ---------- 10) müzik + hap → ekrandaki başlıklar basla nefes alır ----------
  let syncSince = 0; let beatRaf = 0;
  const clearBeat = () => beaters.forEach((el) => { el.style.scale = ''; });
  function beatLoop() {
    beatRaf = 0;
    if (!isDrug() || !API.music?.isPlaying?.() || document.hidden || reducedMotion()) { clearBeat(); syncSince = 0; return; }
    const s = (1 + (API.music.level?.() || 0) * 0.09).toFixed(3);
    beaters.forEach((el) => { if (visible.has(el)) el.style.scale = s; });
    if (!syncSince) syncSince = performance.now();
    if (performance.now() - syncSince > 5000) unlock('sync');
    beatRaf = requestAnimationFrame(beatLoop);
  }
  setInterval(() => { if (!beatRaf && isDrug() && API.music?.isPlaying?.()) beatRaf = requestAnimationFrame(beatLoop); }, 700);

  // ---------- yazı tipi değişince sayfa kaymasın ----------
  // DRUG'daki glitch/terminal fontları REAL'dekilerden dar; dar ekranda satır sayısı azalıp sayfa kaymasın diye bu yazılar
  // DRUG'dayken REAL'deki yüksekliklerine sabitlenir (ölçüm bir an REAL fontuyla yapılır, ekrana o hâli çizilmez).
  const fontLocked = [...document.querySelectorAll('.manifesto, .sec-title, .bye')];
  function lockHeights() {
    fontLocked.forEach((el) => { el.style.minHeight = ''; });
    if (!isDrug()) return;
    fontLocked.forEach((el) => el.classList.add('font-real'));
    const hs = fontLocked.map((el) => parseFloat(getComputedStyle(el).height) || el.offsetHeight); // kesirli, dönüşümsüz
    fontLocked.forEach((el, i) => { el.classList.remove('font-real'); el.style.minHeight = `${hs[i]}px`; });
  }
  let lockTm = 0;
  window.addEventListener('resize', () => { clearTimeout(lockTm); lockTm = setTimeout(lockHeights, 150); });
  onLang(() => requestAnimationFrame(lockHeights));
  document.fonts?.ready.then(lockHeights);

  // ---------- mod değişimi ----------
  function onMode() {
    const on = isDrug();
    lockHeights();
    if (on) {
      scheduleBug(); poke();
      if (!store.get('star.trip.hint', false)) {
        store.set('star.trip.hint', true);
        setTimeout(() => eggToast(L(`BU MODDA ${N} SIR VAR`, `${N} SECRETS IN THIS MODE`), L('bazıları ekranda geziniyor. terminale "trip" yaz.', 'some of them crawl around. type "trip" in the terminal.')), 1800);
      }
    } else {
      clearTimeout(bugTimer); clearTimeout(idleTimer);
      if (melting) { melting = false; melt.stop(); }
      document.querySelectorAll('.trip-bug').forEach((b) => b.remove());
      ['trip-melt', 'trip-neg', 'trip-acid', 'trip-logo'].forEach((c) => html.classList.remove(c));
      heads.forEach((h) => { h.style.transform = ''; });
      clearBeat();
      if (eyes) closeEyes(true);
    }
    API.buildTicker?.();
  }
  new MutationObserver(onMode).observe(html, { attributes: true, attributeFilter: ['data-mode'] });
  onMode();
  document.addEventListener('visibilitychange', () => { if (!document.hidden && isDrug()) scheduleBug(); });

  API.drug = {
    unlock,
    trigger,
    rain: matrixRain,
    bug: spawnBug,
    melt: () => { clearTimeout(idleTimer); beginMelt(); },
    isDrug,
    tickerWords: () => TICKER[getLang() === 'en' ? 'en' : 'tr'],
    list: () => IDS.map((id) => {
      const e = EGGS[id];
      return { id, found: found.has(id), name: L(e[0], e[1]), hint: L(e[4], e[5]) };
    }),
    count: () => [found.size, N],
  };
}
