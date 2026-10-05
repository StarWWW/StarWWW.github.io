// FOOTER — veda ekranı: kayan şerit, imlece tepki veren dev BYE,
// piksel oda sahnesi (gece) ve canlı oda durumu.
import { $, $$, esc, API, reducedMotion } from '../util.js';
import { t, onLang } from '../i18n.js';
import { initRoom } from './room.js';

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

  // ---------- piksel oda sahnesi ----------
  const room = initRoom($('#roomCanvas'));

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

  // ---------- görünürken çalışanlar ----------
  let statTimer = 0;
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    foot.classList.toggle('is-in', visible);
    if (visible) {
      paintStat();
      statTimer = setInterval(paintStat, 1000);
      room?.start();
    } else {
      clearInterval(statTimer); statTimer = 0;
      room?.stop();
    }
  }, { threshold: 0.15 }).observe(foot);

  // ---------- imlece tepki veren BYE + sahne paralaksı ----------
  const letters = $$('.bye-l', foot);
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches && letters.length) {
    let px = -1e4; let py = -1e4; let raf = 0;
    const frame = () => {
      raf = 0;
      if (reducedMotion()) { letters.forEach((l) => l.style.removeProperty('--k')); return; }
      // önce hepsini ölç, sonra yaz (okuma-yazma karışınca her harfte yerleşim yeniden hesaplanıyordu)
      const rects = letters.map((l) => l.getBoundingClientRect());
      letters.forEach((l, i) => {
        const r = rects[i];
        const d = Math.hypot(px - (r.left + r.width / 2), py - (r.top + r.height / 2));
        const k = Math.max(0, 1 - d / 420);
        l.style.setProperty('--k', k.toFixed(3));
        l.style.setProperty('--r', `${(i % 2 ? 1 : -1) * 7}deg`);
      });
    };
    // bütün pencereyi dinler (sayfanın yanındaki boşlukta da), sadece footer ekrandayken
    window.addEventListener('pointermove', (e) => { if (!visible || e.pointerType !== 'mouse') return; px = e.clientX; py = e.clientY; if (!raf) raf = requestAnimationFrame(frame); }, { passive: true });
    document.addEventListener('mouseout', (e) => { if (e.relatedTarget) return; px = -1e4; py = -1e4; if (!raf) raf = requestAnimationFrame(frame); });
  }
}
