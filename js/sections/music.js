import { getTracks } from '../data.js';
import { esc, fmtDur, store, toast, API } from '../util.js';
import { t, onLang } from '../i18n.js';
import { pixelate } from '../pixelate.js';

export async function initMusic() {
  const $ = (id) => document.getElementById(id);
  const audio = $('mpAudio');
  const body = $('libBody');
  if (!audio || !body) return;

  let tracks = [];
  try { tracks = await getTracks(); } catch (err) { console.warn('[music]', err); }
  let idx = 0;
  let filter = '';
  let vol = Number(store.get('star.vol', 0.6));
  audio.volume = vol;

  const playing = () => !audio.paused && !audio.ended;
  const cur = () => tracks[idx];

  function setStatus() {
    const tr = cur();
    const n = tracks.length;
    if (!tr) { $('mpState').textContent = t('mu.stopped2'); return; }
    $('mpState').textContent = playing() ? t('mu.playing', { i: idx + 1, n }) : (audio.currentTime > 0 ? t('mu.paused', { i: idx + 1, n }) : t('mu.stopped2'));
    const play = $('mpPlay');
    play.textContent = playing() ? '❚❚' : '▶';
    play.setAttribute('aria-label', playing() ? t('mu.pause') : t('mu.playT'));
    body.querySelectorAll('tr[data-i]').forEach((row) => {
      const on = Number(row.dataset.i) === idx;
      row.classList.toggle('on', on);
      const b = row.querySelector('button');
      if (b) b.textContent = on && playing() ? '❚❚' : '▶';
    });
    const st = $('stTrack');
    if (st) st.textContent = `${tr.title} — ${tr.artist}`;
  }

  function show(i) {
    const tr = tracks[i];
    if (!tr) return;
    idx = i;
    const titleEl = $('mpTitle');
    titleEl.textContent = tr.title;
    const wrap = titleEl.parentElement;
    wrap.classList.remove('long');
    requestAnimationFrame(() => {
      if (titleEl.scrollWidth > wrap.clientWidth + 2) { wrap.classList.add('long'); titleEl.textContent = `${tr.title}   ★   ${tr.title}`; }
    });
    $('mpArtist').textContent = tr.artist || '';
    $('mpAlbum').textContent = tr.album || '';
    $('mpInfo').textContent = [tr.year, tr.genre, tr.track_number ? `#${tr.track_number}` : ''].filter(Boolean).join(' · ');
    $('mpDur').textContent = fmtDur(tr.duration_ms);
    $('mpCur').textContent = '0:00';
    $('mpFill').style.width = '0%';
    $('mpKnob').style.left = '0%';
    const art = $('mpArt');
    art.removeAttribute('src');
    if (tr.artwork_url) pixelate(tr.artwork_url, 32).then((src) => { if (src && idx === i) art.src = src; });
    setStatus();
  }

  function load(i, autoplay) {
    if (!tracks.length) return;
    i = (i + tracks.length) % tracks.length;
    show(i);
    const tr = tracks[i];
    audio.src = tr.preview_url || '';
    if (autoplay) play();
  }

  function play() {
    const tr = cur();
    if (!tr) return;
    if (!tr.preview_url) { toast(t('mu.noPreview')); return; }
    if (!audio.src) audio.src = tr.preview_url;
    audio.play().catch(() => {});
  }
  const toggle = () => (playing() ? audio.pause() : play());

  function renderLib() {
    const total = tracks.reduce((a, b) => a + (Number(b.duration_ms) || 0), 0);
    $('libCount').textContent = t('mu.lib', { n: tracks.length, t: fmtDur(total) });
    const q = filter.toLocaleLowerCase('tr');
    const rows = tracks.map((tr, i) => ({ tr, i })).filter(({ tr }) => !q || [tr.title, tr.artist, tr.album, tr.genre].join(' ').toLocaleLowerCase('tr').includes(q));
    if (!tracks.length) { body.innerHTML = `<tr><td colspan="8" class="px" style="padding:20px 16px;font-size:12px">${esc(t('mu.empty'))}</td></tr>`; return; }
    body.innerHTML = rows.map(({ tr, i }) => `<tr data-i="${i}" data-d>
      <td class="lib-n">${String(i + 1).padStart(2, '0')}</td>
      <td><div class="lib-art"><img class="pixelated" alt="" width="40" height="40" data-art="${esc(tr.artwork_url || '')}"></div></td>
      <td><div class="lib-t">${esc(tr.title)}</div><div class="lib-a">${esc(tr.artist)}</div></td>
      <td class="lib-al hide-s">${esc(tr.album || '')}${tr.track_number ? `<small>${esc(t('mu.track', { a: tr.track_number, b: tr.track_count || '?' }))}</small>` : ''}</td>
      <td class="lib-y hide-s">${esc(tr.year || '')}</td>
      <td class="hide-m">${tr.genre ? `<span class="lib-g">${esc(tr.genre)}</span>` : ''}</td>
      <td class="lib-d">${fmtDur(tr.duration_ms)}</td>
      <td class="lib-act"><button type="button" aria-label="${esc(t('mu.playRow', { t: tr.title }))}">▶</button> ${tr.store_url ? `<a href="${esc(tr.store_url)}" target="_blank" rel="noopener" aria-label="${esc(t('mu.open'))}">↗</a>` : ''}</td>
    </tr>`).join('');
    body.querySelectorAll('img[data-art]').forEach((im) => {
      if (im.dataset.art) pixelate(im.dataset.art, 32).then((src) => { if (src) im.src = src; });
    });
    setStatus();
  }

  body.addEventListener('click', (e) => {
    if (e.target.closest('a')) return;
    const row = e.target.closest('tr[data-i]');
    if (!row) return;
    const i = Number(row.dataset.i);
    if (i === idx && audio.src) toggle(); else load(i, true);
  });

  $('mpPlay').addEventListener('click', toggle);
  $('mpPrev').addEventListener('click', () => load(idx - 1, playing()));
  $('mpNext').addEventListener('click', () => load(idx + 1, playing()));
  const setVol = (v) => {
    vol = Math.round(Math.min(1, Math.max(0, v)) * 10) / 10;
    audio.volume = vol;
    store.set('star.vol', vol);
    toast(t('mu.vol', { v: Math.round(vol * 10) }), 900);
  };
  $('mpVolUp').addEventListener('click', () => setVol(vol + 0.1));
  $('mpVolDown').addEventListener('click', () => setVol(vol - 0.1));
  $('libFilter').addEventListener('input', (e) => { filter = e.target.value.trim(); renderLib(); });

  const bar = $('mpBar');
  const seek = (ratio) => { if (audio.duration) audio.currentTime = Math.min(audio.duration - 0.1, Math.max(0, ratio * audio.duration)); };
  bar.addEventListener('click', (e) => { const r = bar.getBoundingClientRect(); seek((e.clientX - r.left) / r.width); });
  bar.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); audio.currentTime += 3; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); audio.currentTime -= 3; }
  });

  audio.addEventListener('timeupdate', () => {
    const d = audio.duration || 30;
    const p = Math.min(100, (audio.currentTime / d) * 100);
    $('mpFill').style.width = `${p}%`;
    $('mpKnob').style.left = `${p}%`;
    $('mpCur').textContent = fmtDur(audio.currentTime * 1000);
    bar.setAttribute('aria-valuenow', String(Math.round(audio.currentTime)));
  });
  ['play', 'pause'].forEach((ev) => audio.addEventListener(ev, setStatus));
  audio.addEventListener('ended', () => load(idx + 1, true));

  renderLib();
  if (tracks.length) show(0);
  onLang(() => { renderLib(); show(idx); });

  API.music = {
    list: () => tracks,
    current: () => cur(),
    isPlaying: playing,
    play: (n) => (n == null ? play() : load(n - 1, true)),
    pause: () => audio.pause(),
    next: () => load(idx + 1, true),
    prev: () => load(idx - 1, true),
    toggle,
  };
}
