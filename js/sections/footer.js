// FOOTER — veda ekranı: kayan şerit, imlece tepki veren dev BYE, arcade "DEVAM?" geri sayımı,
// piksel gün batımı (ufka yürüyen karakter) ve canlı oda durumu.
import { $, $$, esc, API, mulberry32, reducedMotion } from '../util.js';
import { t, onLang } from '../i18n.js';

export function initFooter() {
  const foot = $('#iletisim');
  if (!foot) return;
  let visible = false;

  // ---------- kayan şerit ----------
  const mq = $('#footMq');
  const buildMq = () => {
    const words = t('ft.mq').split('|');
    const one = words.map((w, i) => `<span class="${i % 2 ? 'o' : ''}">${esc(w)}</span><i>✶</i>`).join('');
    mq.innerHTML = `<div>${one}</div><div>${one}</div>`;
  };
  buildMq();
  onLang(buildMq);

  // ---------- piksel şehir silüeti ----------
  const city = $('#fsCity');
  if (city) {
    const rnd = mulberry32(2026);
    let x = 0; let rects = ''; let wins = '';
    while (x < 1600) {
      const w = 34 + Math.floor(rnd() * 70);
      const hgt = 26 + Math.floor(rnd() * 70);
      rects += `<rect x="${x}" y="${100 - hgt}" width="${w}" height="${hgt}"/>`;
      if (rnd() > 0.55) rects += `<rect x="${x + Math.floor(w / 2) - 2}" y="${100 - hgt - 10}" width="4" height="10"/>`;
      for (let wy = 100 - hgt + 6; wy < 96; wy += 9) {
        for (let wx = x + 5; wx < x + w - 6; wx += 9) if (rnd() > 0.72) wins += `<rect x="${wx}" y="${wy}" width="4" height="4" class="${rnd() > 0.8 ? 'p' : ''}"/>`;
      }
      x += w + Math.floor(rnd() * 6);
    }
    city.innerHTML = `<svg viewBox="0 0 1600 100" preserveAspectRatio="none" shape-rendering="crispEdges"><g class="b">${rects}</g><g class="w">${wins}</g></svg>`;
  }

  // ---------- canlı oda durumu ----------
  const stat = $('#footStat');
  const clockFmt = () => new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Istanbul' });
  let fmt = clockFmt();
  function paintStat() {
    if (!stat) return;
    const tr = API.music?.current?.();
    const game = API.games?.now?.();
    const wallN = API.wall?.count?.();
    const notesN = API.guestbook?.count?.();
    const rows = [
      [t('ft.clock'), fmt.format(new Date()), 'clk'],
      [t('ft.playing'), tr ? `${tr.title} — ${tr.artist}${API.music.isPlaying() ? '' : ` ${t('ft.paused')}`}` : t('ft.silence'), API.music?.isPlaying?.() ? 'on' : ''],
      [t('ft.gaming'), game ? game.name : t('gm.break'), ''],
      ...(wallN != null ? [[t('ft.wall'), t('ft.wallN', { n: wallN }), '']] : []),
      ...(notesN != null ? [[t('ft.notes'), t('ft.notesN', { n: notesN }), '']] : []),
    ];
    stat.innerHTML = rows.map(([k, v, c]) => `<div class="${c}"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
  }
  onLang(() => { fmt = clockFmt(); paintStat(); });

  // ---------- DEVAM? geri sayımı ----------
  const cont = $('#footCont');
  const n = $('#contN');
  const q = $('#contQ');
  const btnT = $('#contBtnT');
  let count = 9; let timer = 0; let over = false;
  const setLabel = () => {
    q.textContent = over ? t('ft.over') : (cont.dataset.credit ? t('ft.credit') : (document.documentElement.lang === 'en' ? 'CONTINUE?' : 'DEVAM?'));
    btnT.textContent = over ? t('ft.coin') : (document.documentElement.lang === 'en' ? 'YES ↑ BACK TO TOP' : 'EVET ↑ BAŞA DÖN');
  };
  function tickCount() {
    count -= 1;
    n.textContent = String(Math.max(0, count));
    n.classList.remove('flip'); void n.offsetWidth; n.classList.add('flip');
    if (count <= 0) { stopCount(); over = true; cont.classList.add('over'); setLabel(); }
  }
  function startCount() {
    if (timer || over) return;
    timer = setInterval(tickCount, 1000);
  }
  function stopCount() { clearInterval(timer); timer = 0; }
  function resetCount(credit) {
    stopCount();
    over = false; count = 9;
    cont.classList.remove('over');
    if (credit) cont.dataset.credit = '1'; else delete cont.dataset.credit;
    n.textContent = '9';
    setLabel();
    if (visible) startCount();
  }
  $('#contBtn').addEventListener('click', () => {
    if (over) { resetCount(true); return; }
    if (API.fx?.scrollTo) API.fx.scrollTo('#top'); else window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
    setTimeout(() => resetCount(false), 600);
  });
  onLang(setLabel);

  // ---------- görünürken çalışanlar ----------
  let statTimer = 0;
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    foot.classList.toggle('is-in', visible);
    if (visible) {
      paintStat();
      statTimer = setInterval(paintStat, 1000);
      startCount();
    } else {
      clearInterval(statTimer); statTimer = 0;
      stopCount();
      if (!over) { count = 9; n.textContent = '9'; }
    }
  }, { threshold: 0.15 }).observe(foot);

  // ---------- imlece tepki veren BYE + sahne paralaksı ----------
  const letters = $$('.bye-l', foot);
  const scene = $('#footScene');
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches && letters.length) {
    let px = -1e4; let py = -1e4; let raf = 0;
    const frame = () => {
      raf = 0;
      if (reducedMotion()) { letters.forEach((l) => l.style.removeProperty('--k')); return; }
      letters.forEach((l, i) => {
        const r = l.getBoundingClientRect();
        const d = Math.hypot(px - (r.left + r.width / 2), py - (r.top + r.height / 2));
        const k = Math.max(0, 1 - d / 420);
        l.style.setProperty('--k', k.toFixed(3));
        l.style.setProperty('--r', `${(i % 2 ? 1 : -1) * 7}deg`);
      });
      if (scene) scene.style.setProperty('--sx', ((px / window.innerWidth) - 0.5).toFixed(3));
    };
    foot.addEventListener('pointermove', (e) => { px = e.clientX; py = e.clientY; if (!raf) raf = requestAnimationFrame(frame); });
    foot.addEventListener('pointerleave', () => { px = -1e4; py = -1e4; if (!raf) raf = requestAnimationFrame(frame); });
  }
  setLabel();
}
