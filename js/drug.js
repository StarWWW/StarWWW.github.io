// DRUG MODU EASTER EGG'LERİ — sadece hap yutulduğunda (html[data-mode="drug"]) çalışır.
//
// Her zaman açık (DRUG'dayken): gökkuşağı imleç izi, hızlı kaydırınca eriyen sayfa, kayan şeritte gizli mesajlar,
// müzik çalarken sayfanın basla nefes alması.
// Bulunabilir sırlar (14): ekranda gezen halüsinasyon böcekleri, klavyeden gizli kelimeler (uyan / dans / ters / asit —
// terminalde de çalışır), avatara 3 tık, Shift'i basılı tutmak, logoya 7 tık, hiçbir şey yapmamak, başlığa çift tık,
// footer odasındaki pencere ve kedi, müzik + hap… Hepsi bulununca final. Terminalde `trip` bulunanları listeler.
import { API, store, esc, reducedMotion } from './util.js';
import { getLang } from './i18n.js';
import { spriteSVG } from './sprites.js';

const L = (tr, en) => (getLang() === 'en' ? en : tr);
const isDrug = () => document.documentElement.dataset.mode === 'drug';
const finePointer = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

// [ad TR, ad EN, açıklama TR, açıklama EN, ipucu TR, ipucu EN]
const EGGS = {
  bug: ['BÖCEK AVCISI', 'BUG HUNTER', 'bir halüsinasyon böceği yakaladın', 'you caught a hallucination bug', 'ekranda bir şey geziniyor…', 'something is crawling on the screen…'],
  bugKing: ['BÖCEK KRALI', 'BUG KING', '5 böcek. artık onlar senden korkuyor', '5 bugs. now they fear you', 'bir tane yetmez. beş.', 'one is not enough. five.'],
  wake: ['UYANDIN', 'AWAKE', 'kod yağmuru başladı', 'the code rain begins', 'klavyeyle uyanmayı dene.', 'try waking up with your keyboard.'],
  eye: ['ÜÇÜNCÜ GÖZ', 'THIRD EYE', 'avatar seni izliyor', 'the avatar is watching you', 'kendine üç kez bak.', 'look at yourself three times.'],
  dance: ['DANS', 'DANCE', 'oda dans ediyor', 'the room is dancing', 'müzik olmasa da d…', 'even without music, d…'],
  negative: ['NEGATİF', 'NEGATIVE', 'renkler ters döndü', 'the colours flipped', 'büyük harf tuşunu uzun tut.', 'hold the capital key down.'],
  flip: ['TERS DÜNYA', 'UPSIDE DOWN', 'yerçekimi tatile çıktı', 'gravity took a day off', 'dünyayı t… çevir.', 'f… the world.'],
  acid: ['ASİT', 'ACID', 'duvarlar eriyor', 'the walls are melting', 'kimyasal bir kelime.', 'a chemical word.'],
  logo: ['ADINI SÖYLE', 'SAY MY NAME', 'logo sarhoş oldu', 'the logo got drunk', 'adını yedi kez çağır.', 'call its name seven times.'],
  melt: ['ERİME', 'MELTDOWN', 'hiçbir şey yapmayınca ekran eridi', 'you did nothing, the screen melted', 'hiçbir şey yapma.', 'do nothing.'],
  boom: ['PATLAMA', 'KABOOM', 'başlık parçalandı', 'a title exploded', 'bir başlığa iki kez dokun.', 'touch a title twice.'],
  ufo: ['UFO', 'UFO', 'odanın penceresinden bir şey geçti', 'something flew past the room window', 'gece penceresinden bak.', 'look out of the night window.'],
  cat: ['UÇAN KEDİ', 'FLYING CAT', 'kedi yerçekimini reddetti', 'the cat refused gravity', 'odadaki kediyi rahatsız et.', 'bother the cat in the room.'],
  sync: ['SENKRON', 'IN SYNC', 'sayfa müzikle nefes alıyor', 'the page breathes with the music', 'müzik + hap.', 'music + pill.'],
};
const IDS = Object.keys(EGGS);
const TICKER = {
  tr: ['UYAN', 'BU BİR SİMÜLASYON', 'C.O.W. = ?', 'DUVARLAR NEFES ALIYOR', '14 SIR VAR', 'BÖCEKLERİ YAKALA', 'TERMİNALE TRIP YAZ', 'GERÇEK NE Kİ'],
  en: ['WAKE UP', 'THIS IS A SIMULATION', 'C.O.W. = ?', 'THE WALLS ARE BREATHING', '14 SECRETS', 'CATCH THE BUGS', 'TYPE TRIP IN THE TERMINAL', 'WHAT IS REAL ANYWAY'],
};

export function initDrug() {
  const html = document.documentElement;
  const found = new Set((store.get('star.trip', []) || []).filter((id) => EGGS[id]));
  let bugsCaught = Number(store.get('star.bugs', 0)) || 0;
  if (found.size === IDS.length) html.classList.add('trip-master');

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
    eggToast(`${L('SIR', 'SECRET')} ${found.size}/${IDS.length} · ${L(e[0], e[1])}`, L(e[2], e[3]));
    if (found.size === IDS.length) setTimeout(finale, 1600);
  }
  function finale() {
    html.classList.add('trip-master');
    matrixRain(9000);
    eggToast(L('TAM TRİP · 14/14', 'FULL TRIP · 14/14'), L('her şeyi gördün. başlık artık hep gökkuşağı.', 'you have seen everything. the title is rainbow forever now.'), true);
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

  // dönme / eğilme o an görünen ekranın ortası etrafında olsun (sayfanın başı değil)
  const mainEl = document.querySelector('.frame') || document.querySelector('main');
  function setOrigin() {
    if (!mainEl) return;
    // sayfa çerçevesine göre ekranın ortası (scrollY'ye güvenmeden, doğrudan kutunun ekrandaki yerinden)
    html.style.setProperty('--oy', `${Math.round(window.innerHeight / 2 - mainEl.getBoundingClientRect().top)}px`);
  }

  // ---------- 2) eriyen kaydırma ----------
  let lastY = window.scrollY; let lastT = performance.now(); let meltTimer = 0;
  window.addEventListener('scroll', () => {
    poke();
    const now = performance.now();
    const v = (window.scrollY - lastY) / Math.max(1, now - lastT);
    lastY = window.scrollY; lastT = now;
    if (!isDrug() || reducedMotion()) return;
    const sk = Math.max(-5, Math.min(5, v * 2.2));
    if (Math.abs(sk) < 0.4 && !html.classList.contains('trip-scroll')) return;
    if (!html.classList.contains('trip-flip')) setOrigin();
    html.classList.add('trip-scroll');
    html.style.setProperty('--melt', `${sk.toFixed(2)}deg`);
    clearTimeout(meltTimer);
    meltTimer = setTimeout(() => {
      html.style.setProperty('--melt', '0deg');
      meltTimer = setTimeout(() => html.classList.remove('trip-scroll'), 450);
    }, 140);
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
    const step = (now) => {
      const age = now - t0;
      g.fillStyle = 'rgba(0,0,0,.12)';
      g.fillRect(0, 0, c.width, c.height);
      g.font = `${fs}px 'VCR OSD Mono TR', VT323, monospace`;
      drops.forEach((d, i) => {
        const ch = chars[(Math.random() * chars.length) | 0];
        g.fillStyle = Math.random() < 0.06 ? '#F2EEE3' : (i % 7 === 0 ? '#D77BBA' : '#99E550');
        g.fillText(ch, i * fs, d * fs);
        drops[i] = d * fs > c.height && Math.random() > 0.975 ? 0 : d + 1;
      });
      c.style.opacity = age > ms - 900 ? String(Math.max(0, (ms - age) / 900)) : '1';
      if (age < ms) requestAnimationFrame(step); else { c.remove(); rainOn = false; }
    };
    requestAnimationFrame(step);
  }

  // ---------- 5) geçici sınıf efektleri ----------
  const timers = {};
  function flash(cls, ms) {
    html.classList.add(cls);
    clearTimeout(timers[cls]);
    timers[cls] = setTimeout(() => html.classList.remove(cls), ms);
  }
  const CODES = {
    uyan: 'wake', wake: 'wake', dans: 'dance', dance: 'dance', ters: 'flip', flip: 'flip', asit: 'acid', acid: 'acid',
  };
  function trigger(code) {
    const id = CODES[code];
    if (!id || !isDrug()) return false;
    if (id === 'wake') matrixRain(7000);
    if (id === 'dance') flash('trip-dance', 8000);
    if (id === 'flip') { setOrigin(); flash('trip-flip', 4500); }
    if (id === 'acid') flash('trip-acid', 10000);
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

  // Shift'i 2 saniye basılı tut → negatif
  let shiftTimer = 0;
  function startShift() {
    if (!isDrug() || shiftTimer) return;
    shiftTimer = setTimeout(() => { html.classList.add('trip-neg'); unlock('negative'); }, 1800);
  }
  document.addEventListener('keyup', (e) => {
    if (e.key !== 'Shift') return;
    clearTimeout(shiftTimer); shiftTimer = 0;
    html.classList.remove('trip-neg');
  });
  window.addEventListener('blur', () => { clearTimeout(shiftTimer); shiftTimer = 0; html.classList.remove('trip-neg'); });

  // ---------- 6) üçüncü göz: DRUG avatarına 3 tık → göz imleci takip eder ----------
  const avWin = document.querySelector('.avatar-win');
  let avClicks = [];
  let eye = null;
  avWin?.addEventListener('click', () => {
    if (!isDrug()) return;
    const now = Date.now();
    avClicks = avClicks.filter((x) => now - x < 1500).concat(now);
    if (avClicks.length < 3) return;
    avClicks = [];
    if (!eye) {
      eye = document.createElement('div');
      eye.className = 'trip-eye';
      eye.setAttribute('aria-hidden', 'true');
      eye.innerHTML = '<i class="ball"><i class="pupil"></i></i>';
      avWin.append(eye);
    }
    flash('trip-eye-on', 9000);
    unlock('eye');
  });
  window.addEventListener('pointermove', (e) => {
    if (!eye || !html.classList.contains('trip-eye-on')) return;
    const r = eye.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2); const dy = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy) || 1; const k = Math.min(1, d / 300);
    eye.style.setProperty('--px', `${(dx / d) * 22 * k}px`);
    eye.style.setProperty('--py', `${(dy / d) * 14 * k}px`);
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

  // ---------- 8) hiçbir şey yapma → erime ----------
  let idleTimer = 0;
  function poke() {
    if (html.classList.contains('trip-melt')) html.classList.remove('trip-melt');
    clearTimeout(idleTimer);
    if (!isDrug()) return;
    idleTimer = setTimeout(() => {
      if (!isDrug() || document.hidden) return;
      html.classList.add('trip-melt');
      unlock('melt');
    }, 25000);
  }

  // ---------- 9) başlığa çift tık → patlama ----------
  document.addEventListener('dblclick', (e) => {
    const h = e.target.closest('.sec-title');
    if (!h || !isDrug() || h.dataset.boom) return;
    h.dataset.boom = '1';
    const text = h.textContent;
    h.innerHTML = [...text].map((ch) => `<span class="boom-ch" style="--dx:${(Math.random() - 0.5) * 520}px;--dy:${(Math.random() - 0.7) * 320}px;--r:${(Math.random() - 0.5) * 720}deg">${ch === ' ' ? '&nbsp;' : esc(ch)}</span>`).join('');
    requestAnimationFrame(() => h.classList.add('booming'));
    setTimeout(() => h.classList.remove('booming'), 900);
    setTimeout(() => { h.textContent = text; delete h.dataset.boom; }, 1900);
    unlock('boom');
  });

  // ---------- 10) müzik + hap → sayfa basla nefes alır ----------
  let syncSince = 0; let beatRaf = 0;
  function beatLoop() {
    beatRaf = 0;
    if (!isDrug() || !API.music?.isPlaying?.() || document.hidden) { html.style.setProperty('--beat', '0'); syncSince = 0; return; }
    const lv = API.music.level?.() || 0;
    html.style.setProperty('--beat', lv.toFixed(3));
    if (!syncSince) syncSince = performance.now();
    if (performance.now() - syncSince > 5000) unlock('sync');
    beatRaf = requestAnimationFrame(beatLoop);
  }
  setInterval(() => { if (!beatRaf && isDrug() && API.music?.isPlaying?.()) beatRaf = requestAnimationFrame(beatLoop); }, 700);

  // ---------- mod değişimi ----------
  function onMode() {
    const on = isDrug();
    if (on) {
      scheduleBug(); poke();
      if (!store.get('star.trip.hint', false)) {
        store.set('star.trip.hint', true);
        setTimeout(() => eggToast(L('BU MODDA 14 SIR VAR', '14 SECRETS IN THIS MODE'), L('bazıları ekranda geziniyor. terminale "trip" yaz.', 'some of them crawl around. type "trip" in the terminal.')), 1800);
      }
    } else {
      clearTimeout(bugTimer); clearTimeout(idleTimer);
      document.querySelectorAll('.trip-bug').forEach((b) => b.remove());
      ['trip-melt', 'trip-neg', 'trip-dance', 'trip-flip', 'trip-acid', 'trip-eye-on', 'trip-logo', 'trip-scroll'].forEach((c) => html.classList.remove(c));
      html.style.setProperty('--melt', '0deg');
      html.style.setProperty('--beat', '0');
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
    isDrug,
    tickerWords: () => TICKER[getLang() === 'en' ? 'en' : 'tr'],
    list: () => IDS.map((id) => {
      const e = EGGS[id];
      return { id, found: found.has(id), name: L(e[0], e[1]), hint: L(e[4], e[5]) };
    }),
    count: () => [found.size, IDS.length],
  };
}
