// MP3 çalar — Spotify'ın 30 saniyelik önizlemelerini kendi <audio> çalarımızla çalar.
// Spotify'ın gömülü çalarında ses ayarı yok; kendi çalarımızda ses Web Audio kazancıyla ayarlanır
// (iPhone dahil her cihazda) ve spektrum gerçek sesten çizilir. Şarkının tamamı için "Spotify'da dinle" linki.
import { getTracks } from '../data.js';
import { esc, fmtDur, toast, store, API, nameLang, reducedMotion } from '../util.js';
import { t, onLang } from '../i18n.js';
import { pixelate } from '../pixelate.js';
import { getSupabase } from '../supabase.js';

const isSpPreview = (u) => /^https:\/\/p\.scdn\.co\//.test(String(u || ''));
const spLink = (tr) => tr?.spotify_url || (tr?.spotify_id ? `https://open.spotify.com/track/${tr.spotify_id}` : '');
const VIZ_COLORS = ['#4B692F', '#6ABE30', '#99E550', '#99E550', '#FBF236', '#FBF236', '#DF7126', '#AC3232'];

export async function initMusic() {
  const $ = (id) => document.getElementById(id);
  const audio = $('mpAudio');
  const body = $('libBody');
  if (!audio || !body) return;
  const mp3 = document.querySelector('.mp3');
  const dock = document.querySelector('.dock');
  audio.crossOrigin = 'anonymous';

  let tracks = [];
  try { tracks = await getTracks(); } catch (err) { console.warn('[music]', err); }
  let idx = 0;
  let filter = '';
  let flashUntil = 0;

  const cur = () => tracks[idx];
  const playing = () => Boolean(audio.src) && !audio.paused && !audio.ended;
  const previewOf = (tr) => (isSpPreview(tr?.preview_url) ? tr.preview_url : '');

  // ---------- önizleme adresi ----------
  // preview_url boşsa "spotify" fonksiyonu Spotify'ın önizlemesini bulup veritabanına yazar ('' = önizleme yok).
  // Fonksiyon yoksa / çalışmıyorsa bir saat tekrar denenmez.
  const pvCache = store.get('star.pv', {}) || {};
  const pending = new Map();
  let pvDown = Date.now() - (Number(store.get('star.pvDown', 0)) || 0) < 3600e3;
  tracks.forEach((tr) => { if (!previewOf(tr) && tr.spotify_id && tr.spotify_id in pvCache) tr.preview_url = pvCache[tr.spotify_id]; });
  const needsPv = (tr) => !pvDown && tr && tr.id != null && tr.spotify_id && !previewOf(tr) && tr.preview_url !== '' && !tr._pvTried;
  function resolvePv(tr) {
    if (!needsPv(tr)) return Promise.resolve(previewOf(tr) || null);
    const key = String(tr.id);
    if (pending.has(key)) return pending.get(key);
    const job = (async () => {
      const sb = await getSupabase();
      if (!sb) throw new Error('supabase yok');
      const { data, error } = await sb.functions.invoke('spotify', { body: { preview: tr.id } });
      if (error || !data || data.error) throw error || new Error(data?.error || 'boş cevap');
      tr.preview_url = data.preview_url || '';
      pvCache[tr.spotify_id] = tr.preview_url;
      store.set('star.pv', pvCache);
      return tr.preview_url || null;
    })().catch((err) => {
      console.warn('[spotify önizleme]', err?.message || err);
      tr._pvTried = true;
      pvDown = true;
      store.set('star.pvDown', Date.now());
      return null;
    }).finally(() => pending.delete(key));
    pending.set(key, job);
    return job;
  }
  const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]);

  // ---------- ses motoru (Web Audio) ----------
  let vol = Math.max(0, Math.min(10, Number(store.get('star.vol', 8)) || 0));
  let muted = Boolean(store.get('star.muted', false));
  let ctx = null; let gain = null; let analyser = null; let bins = null;
  function ensureGraph() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      ctx = new AC();
      const src = ctx.createMediaElementSource(audio);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.75;
      gain = ctx.createGain();
      src.connect(analyser);
      analyser.connect(gain);
      gain.connect(ctx.destination);
      bins = new Uint8Array(analyser.frequencyBinCount);
      applyVolume();
    } catch (err) {
      console.warn('[ses]', err);
      ctx = null; gain = null; analyser = null;
    }
  }
  function applyVolume() {
    const lv = muted ? 0 : vol / 10;
    if (gain) {
      audio.volume = 1;
      gain.gain.setTargetAtTime(lv * lv, ctx.currentTime, 0.03); // kulağa doğrusal gelsin
    } else {
      audio.volume = lv * lv;
    }
  }

  // ---------- spektrum ----------
  const canvas = $('mpViz');
  const g2 = canvas?.getContext('2d');
  const eqBars = [...document.querySelectorAll('.mp3-eq i')];
  const peaks = new Float32Array(64);
  let raf = 0; let lastDraw = 0;
  function sizeViz() {
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
    drawViz(true);
  }
  function drawViz(idle) {
    if (!g2) return;
    const W = canvas.width; const H = canvas.height;
    const dpr = W / Math.max(1, canvas.clientWidth);
    const block = Math.max(3, Math.round(5 * dpr)); const gap = Math.max(1, Math.round(dpr));
    const cols = Math.max(8, Math.min(64, Math.floor(W / (block * 2 + gap))));
    const bw = Math.floor((W - gap * (cols - 1)) / cols);
    const rows = Math.floor(H / (block + gap));
    g2.clearRect(0, 0, W, H);
    const live = !idle && analyser && playing();
    if (live) analyser.getByteFrequencyData(bins);
    for (let c = 0; c < cols; c++) {
      let v = 0;
      if (live) {
        // düşük frekanslara daha çok sütun (logaritmik dağılım)
        const a = Math.floor((c / cols) ** 1.7 * (bins.length * 0.8));
        const b = Math.max(a + 1, Math.floor(((c + 1) / cols) ** 1.7 * (bins.length * 0.8)));
        for (let k = a; k < b; k++) v = Math.max(v, bins[k]);
        v /= 255;
      }
      const lit = Math.round(v * rows);
      peaks[c] = live ? Math.max(lit, (peaks[c] || 0) - 0.35) : 0;
      const x = c * (bw + gap);
      for (let r = 0; r < rows; r++) {
        const y = H - (r + 1) * (block + gap) + gap;
        if (r < lit) {
          g2.fillStyle = VIZ_COLORS[Math.min(VIZ_COLORS.length - 1, Math.floor((r / rows) * VIZ_COLORS.length))];
          g2.fillRect(x, y, bw, block);
        } else if (r === 0) {
          g2.fillStyle = 'rgba(155,173,183,.25)';
          g2.fillRect(x, y, bw, block);
        }
      }
      if (live && peaks[c] >= 1) {
        const py = H - (Math.ceil(peaks[c]) + 1) * (block + gap) + gap;
        if (py > 0) { g2.fillStyle = '#F2EEE3'; g2.fillRect(x, py, bw, Math.max(2, Math.round(block / 2))); }
      }
    }
    // LCD'deki küçük ekolayzer de gerçek sesle oynasın
    if (live && eqBars.length) {
      eqBars.forEach((el, i) => {
        const a = Math.floor((i / eqBars.length) ** 1.6 * bins.length * 0.7);
        el.style.height = `${Math.max(15, (bins[a] / 255) * 100)}%`;
      });
    }
  }
  function loop(now) {
    raf = 0;
    if (!playing() || document.hidden) { drawViz(true); return; }
    if (!reducedMotion() || now - lastDraw > 66) { drawViz(false); lastDraw = now; }
    raf = requestAnimationFrame(loop);
  }
  const startViz = () => {
    document.querySelector('.mp3-eq')?.classList.toggle('live', Boolean(analyser));
    if (!raf) raf = requestAnimationFrame(loop);
  };
  window.addEventListener('resize', sizeViz);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && playing()) startViz(); });

  // ---------- ekran ----------
  function render() {
    const tr = cur();
    const n = tracks.length;
    const st = $('mpState');
    if (!tr) { st.textContent = t('mu.stopped2'); return; }
    const on = playing();
    if (Date.now() > flashUntil) st.textContent = on ? t('mu.playing', { i: idx + 1, n }) : (audio.currentTime > 0 ? t('mu.paused', { i: idx + 1, n }) : t('mu.stopped2'));
    mp3?.classList.toggle('is-playing', on);
    dock?.classList.toggle('is-playing', on);
    const play = $('mpPlay');
    play.textContent = on ? '❚❚' : '▶';
    play.setAttribute('aria-label', on ? t('mu.pause') : t('mu.playT'));
    const pos = audio.currentTime * 1000;
    const dur = audio.duration && Number.isFinite(audio.duration) ? audio.duration * 1000 : 30000;
    const p = Math.min(100, (pos / dur) * 100);
    $('mpFill').style.width = `${p}%`;
    $('mpKnob').style.left = `${p}%`;
    $('mpCur').textContent = fmtDur(pos);
    $('mpDur').textContent = fmtDur(dur);
    const bar = $('mpBar');
    bar.setAttribute('aria-valuemax', String(Math.round(dur / 1000)));
    bar.setAttribute('aria-valuenow', String(Math.round(pos / 1000)));
    bar.setAttribute('aria-valuetext', `${fmtDur(pos)} / ${fmtDur(dur)}`);
    $('mpSrc').textContent = tr.preview_url === '' ? t('mu.srcNone') : t('mu.src30');
    $('dockSrc').textContent = on ? t('mu.dockD') : t('mu.dockReady');
    body.querySelectorAll('tr[data-i]').forEach((row) => {
      const mine = Number(row.dataset.i) === idx;
      row.classList.toggle('on', mine);
      row.setAttribute('aria-current', mine ? 'true' : 'false');
      const b = row.querySelector('.lib-play');
      if (b) b.textContent = mine && on ? '❚❚' : '▶';
    });
    const stEl = $('stTrack');
    if (stEl) stEl.textContent = `${tr.title} — ${tr.artist}`;
  }

  function renderDock() {
    const tr = cur();
    const info = $('dockInfo');
    if (!info) return;
    if (!tr) { info.innerHTML = `<p class="px dock-wait">${esc(t('mu.empty'))}</p>`; return; }
    const link = spLink(tr);
    info.innerHTML = `<div class="di-art">${tr.artwork_url ? `<img src="${esc(tr.artwork_url)}" alt="" decoding="async">` : ''}</div>
      <div class="di-main">
        <span class="px di-idx">${String(idx + 1).padStart(2, '0')} / ${String(tracks.length).padStart(2, '0')}${tr.duration_ms ? ` · ${esc(t('mu.full', { d: fmtDur(tr.duration_ms) }))}` : ''}</span>
        <b class="brut di-t" lang="${nameLang(tr.title)}">${esc(tr.title)}</b>
        <span class="di-a">${esc(tr.artist || '')}</span>
        <span class="di-al">${esc([tr.album, tr.year].filter(Boolean).join(' · '))}</span>
        ${tr.preview_url === '' ? `<span class="px di-none">${esc(t('mu.noPv'))}</span>` : ''}
        <div class="di-links">${link ? `<a class="px di-sp" href="${esc(link)}" target="_blank" rel="noopener">${esc(t('mu.openFull'))}</a>` : ''}</div>
      </div>`;
  }

  function show(i) {
    const tr = tracks[i];
    if (!tr) return;
    idx = i;
    const titleEl = $('mpTitle');
    const wrap = titleEl.parentElement;
    wrap.classList.remove('long');
    titleEl.innerHTML = `<span>${esc(tr.title)}</span>`;
    requestAnimationFrame(() => {
      if (titleEl.scrollWidth > wrap.clientWidth + 2) {
        wrap.classList.add('long');
        titleEl.innerHTML = `<span>${esc(tr.title)}</span><span aria-hidden="true">${esc(tr.title)}</span>`;
      }
    });
    $('mpArtist').textContent = tr.artist || '';
    $('mpAlbum').textContent = tr.album || '';
    $('mpInfo').textContent = [tr.year, tr.genre, tr.track_number ? `#${tr.track_number}` : ''].filter(Boolean).join(' · ');
    const art = $('mpArt');
    art.removeAttribute('src');
    art.parentElement.classList.remove('lit');
    if (tr.artwork_url) pixelate(tr.artwork_url, 32).then((src) => { if (src && idx === i) { art.src = src; art.parentElement.classList.add('lit'); } });
    renderDock();
    render();
  }

  function play() {
    ensureGraph();
    ctx?.resume?.();
    audio.play().then(startViz).catch((err) => { if (err?.name !== 'AbortError') console.warn('[çal]', err); });
  }

  // auto: şarkı bitince sıradakine geçerken önizlemesi olmayanları atla
  async function load(i, autoplay, auto = false, hops = 0) {
    if (!tracks.length) return;
    i = (i + tracks.length) % tracks.length;
    const tr = tracks[i];
    audio.pause();
    show(i);
    if (needsPv(tr)) {
      $('mpState').textContent = t('mu.preparing');
      flashUntil = Date.now() + 8000;
      await withTimeout(resolvePv(tr), 7000);
      flashUntil = 0;
      if (cur() !== tr) return;
      renderDock();
    }
    const url = previewOf(tr);
    if (!url) {
      audio.removeAttribute('src');
      audio.dataset.src = '';
      audio.load();
      render();
      if (autoplay && auto && hops < tracks.length - 1) { load(i + 1, true, true, hops + 1); return; }
      if (autoplay) toast(t(tr.preview_url === '' ? 'mu.noPv' : 'mu.pvFail'), 3600);
      return;
    }
    if (audio.dataset.src !== url) { audio.src = url; audio.dataset.src = url; }
    if (autoplay) play(); else render();
  }

  function toggle() {
    const tr = cur();
    if (!tr) return;
    if (!audio.dataset.src || audio.dataset.src !== previewOf(tr)) { load(idx, true); return; }
    if (audio.paused) play(); else audio.pause();
  }
  function seekBy(sec) {
    if (audio.duration) audio.currentTime = Math.min(audio.duration - 0.2, Math.max(0, audio.currentTime + sec));
  }
  function seekTo(ratio) {
    if (audio.duration) audio.currentTime = Math.max(0, Math.min(audio.duration - 0.2, ratio * audio.duration));
  }

  // ---------- ses kontrolü ----------
  const volEl = $('mpVol');
  const volWrap = document.querySelector('.mp3-vol');
  if (volEl) volEl.innerHTML = Array.from({ length: 10 }, (_, i) => `<i data-v="${i + 1}" style="--j:${i}"></i>`).join('');
  function renderVol() {
    if (!volEl) return;
    volEl.querySelectorAll('i').forEach((s, i) => s.classList.toggle('on', i < vol));
    volEl.setAttribute('aria-valuenow', String(vol));
    volEl.setAttribute('aria-valuetext', muted ? t('mu.muted') : `${vol * 10}%`);
    volWrap?.classList.toggle('is-muted', muted || vol === 0);
    $('mpMute')?.setAttribute('aria-pressed', String(muted));
  }
  function flash() {
    $('mpState').textContent = muted || vol === 0 ? `× ${t('mu.muted')}` : t('mu.vol', { v: `${'▮'.repeat(vol)}${'▯'.repeat(10 - vol)}` });
    flashUntil = Date.now() + 1300;
    clearTimeout(flash.tm);
    flash.tm = setTimeout(render, 1350);
  }
  function setVol(n) {
    vol = Math.max(0, Math.min(10, Math.round(n)));
    if (vol > 0) muted = false;
    store.set('star.vol', vol);
    store.set('star.muted', muted);
    applyVolume(); renderVol(); flash();
  }
  function toggleMute() {
    muted = !muted;
    if (!muted && vol === 0) vol = 5;
    store.set('star.muted', muted);
    store.set('star.vol', vol);
    applyVolume(); renderVol(); flash();
  }
  $('mpVolUp')?.addEventListener('click', () => setVol(vol + 1));
  $('mpVolDown')?.addEventListener('click', () => setVol(vol - 1));
  $('mpMute')?.addEventListener('click', toggleMute);
  if (volEl) {
    let dragging = false;
    const fromX = (x) => {
      const r = volEl.getBoundingClientRect();
      return Math.ceil(Math.max(0, Math.min(1, (x - r.left) / r.width)) * 10);
    };
    volEl.addEventListener('pointerdown', (e) => {
      dragging = true;
      try { volEl.setPointerCapture(e.pointerId); } catch { /* sentetik olay */ }
      setVol(fromX(e.clientX));
    });
    volEl.addEventListener('pointermove', (e) => { if (dragging) { const v = fromX(e.clientX); if (v !== vol) setVol(v); } });
    const end = () => { dragging = false; };
    volEl.addEventListener('pointerup', end);
    volEl.addEventListener('pointercancel', end);
    volEl.addEventListener('keydown', (e) => {
      const map = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 3, PageDown: -3 };
      if (e.key in map) { e.preventDefault(); setVol(vol + map[e.key]); } else if (e.key === 'Home') { e.preventDefault(); setVol(0); } else if (e.key === 'End') { e.preventDefault(); setVol(10); } else if (e.key === 'm' || e.key === 'M') { e.preventDefault(); toggleMute(); }
    });
  }

  // ---------- kitaplık ----------
  function renderLib() {
    const total = tracks.reduce((a, b) => a + (Number(b.duration_ms) || 0), 0);
    $('libCount').textContent = t('mu.lib', { n: tracks.length, t: fmtDur(total) });
    if (!tracks.length) { body.innerHTML = `<tr><td colspan="8" class="px" style="padding:20px 16px;font-size:12px">${esc(t('mu.empty'))}</td></tr>`; return; }
    const q = filter.toLocaleLowerCase('tr');
    const rows = tracks.map((tr, i) => ({ tr, i })).filter(({ tr }) => !q || [tr.title, tr.artist, tr.album, tr.genre].join(' ').toLocaleLowerCase('tr').includes(q));
    if (!rows.length) { body.innerHTML = `<tr><td colspan="8" class="px" style="padding:20px 16px;font-size:12px">—</td></tr>`; return; }
    body.innerHTML = rows.map(({ tr, i }, k) => {
      const link = spLink(tr) || tr.store_url;
      return `<tr data-i="${i}" data-d class="rv" style="--i:${k}">
      <td class="lib-n">${String(i + 1).padStart(2, '0')}</td>
      <td><div class="lib-art"><img class="pixelated" alt="" width="40" height="40" data-art="${esc(tr.artwork_url || '')}"></div></td>
      <td><div class="lib-t">${esc(tr.title)}${tr.explicit ? ' <span class="lib-e" title="explicit">E</span>' : ''}</div><div class="lib-a">${esc(tr.artist)}</div></td>
      <td class="lib-al hide-s">${esc(tr.album || '')}${tr.track_number ? `<small>${esc(t('mu.track', { a: tr.track_number, b: tr.track_count || '?' }))}</small>` : ''}</td>
      <td class="lib-y hide-s">${esc(tr.year || '')}</td>
      <td class="hide-m">${tr.genre ? `<span class="lib-g">${esc(tr.genre)}</span>` : ''}</td>
      <td class="lib-d">${fmtDur(tr.duration_ms)}</td>
      <td class="lib-act"><button type="button" class="lib-play" aria-label="${esc(t('mu.playRow', { t: tr.title }))}">▶</button> ${link ? `<a href="${esc(link)}" target="_blank" rel="noopener" aria-label="${esc(t('mu.openSp'))}" title="${esc(t('mu.openSp'))}">↗</a>` : ''}</td>
    </tr>`;
    }).join('');
    body.querySelectorAll('img[data-art]').forEach((im) => {
      if (im.dataset.art) pixelate(im.dataset.art, 32).then((src) => { if (src) im.src = src; });
    });
    render();
  }

  body.addEventListener('click', (e) => {
    if (e.target.closest('a')) return;
    const row = e.target.closest('tr[data-i]');
    if (!row) return;
    const i = Number(row.dataset.i);
    if (i === idx && audio.dataset.src) toggle(); else load(i, true);
  });

  $('mpPlay').addEventListener('click', toggle);
  $('mpPrev').addEventListener('click', () => load(idx - 1, playing()));
  $('mpNext').addEventListener('click', () => load(idx + 1, playing()));
  $('mpFwd').addEventListener('click', () => seekBy(10));
  $('mpBack').addEventListener('click', () => seekBy(-10));
  $('libFilter').addEventListener('input', (e) => { filter = e.target.value.trim(); renderLib(); });

  const bar = $('mpBar');
  bar.addEventListener('click', (e) => { const r = bar.getBoundingClientRect(); seekTo((e.clientX - r.left) / r.width); });
  bar.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); seekBy(5); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); seekBy(-5); }
  });

  audio.addEventListener('timeupdate', render);
  ['play', 'pause', 'loadedmetadata', 'emptied'].forEach((ev) => audio.addEventListener(ev, render));
  audio.addEventListener('play', startViz);
  audio.addEventListener('ended', () => load(idx + 1, true, true));
  audio.addEventListener('error', () => { if (audio.dataset.src) { console.warn('[çal] önizleme yüklenemedi', audio.dataset.src); toast(t('mu.noPv'), 3600); } });

  applyVolume();
  renderVol();
  renderLib();
  if (tracks.length) show(0);
  sizeViz();
  onLang(() => { renderLib(); show(idx); renderVol(); });

  // Bölüm yaklaşınca önizleme adreslerini sırayla hazırla (ilk tıklamada beklemesin)
  const muzik = document.getElementById('muzik');
  if (muzik && tracks.length) {
    new IntersectionObserver(([e], io) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      sizeViz();
      (async () => {
        for (const tr of [cur(), ...tracks]) {
          if (needsPv(tr)) await resolvePv(tr); // eslint-disable-line no-await-in-loop
          if (tr === cur()) renderDock();
        }
        render();
      })();
    }, { rootMargin: '400px' }).observe(muzik);
  }

  API.music = {
    list: () => tracks,
    current: () => cur(),
    isPlaying: playing,
    play: (n) => (n == null ? (playing() ? null : toggle()) : load(n - 1, true)),
    pause: () => audio.pause(),
    next: () => load(idx + 1, true),
    prev: () => load(idx - 1, true),
    toggle,
    volume: (n) => (n == null ? vol : setVol(n)),
    mute: toggleMute,
  };
}
