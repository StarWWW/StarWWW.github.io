// MP3 çalar: Spotify iFrame API ile tam şarkı (dinleyici Spotify'a giriş yaptıysa),
// Spotify kimliği olmayan eski kayıtlarda iTunes önizlemesi.
import { getTracks } from '../data.js';
import { esc, fmtDur, toast, API } from '../util.js';
import { t, onLang } from '../i18n.js';
import { pixelate } from '../pixelate.js';

let apiPromise = null;
function spotifyApi() {
  if (!apiPromise) {
    apiPromise = new Promise((res, rej) => {
      if (window.__spotifyIframeApi) { res(window.__spotifyIframeApi); return; }
      window.onSpotifyIframeApiReady = (api) => { window.__spotifyIframeApi = api; res(api); };
      const s = document.createElement('script');
      s.src = 'https://open.spotify.com/embed/iframe-api/v1';
      s.async = true;
      s.onerror = () => rej(new Error('Spotify yüklenemedi'));
      document.head.append(s);
    });
  }
  return apiPromise;
}

export async function initMusic() {
  const $ = (id) => document.getElementById(id);
  const audio = $('mpAudio');
  const body = $('libBody');
  if (!audio || !body) return;
  const mp3 = document.querySelector('.mp3');

  let tracks = [];
  try { tracks = await getTracks(); } catch (err) { console.warn('[music]', err); }
  let idx = 0;
  let filter = '';
  audio.volume = 0.8;

  // ---------- kaynak durumu ----------
  let ctrl = null;              // Spotify EmbedController
  let ctrlPromise = null;
  let loadedUri = null;
  let wantPlay = false;
  const sp = { paused: true, pos: 0, dur: 0, started: false };
  let lastPos = 0;

  const cur = () => tracks[idx];
  const isSp = (tr = cur()) => Boolean(tr?.spotify_id);
  const playing = () => (isSp() ? !sp.paused : !audio.paused && !audio.ended);
  const position = () => (isSp() ? sp.pos : audio.currentTime * 1000);
  const duration = () => (isSp() ? (sp.dur || cur()?.duration_ms || 0) : (audio.duration ? audio.duration * 1000 : 30000));

  function controller(uri) {
    if (ctrl) return Promise.resolve(ctrl);
    if (!ctrlPromise) {
      ctrlPromise = spotifyApi().then((api) => new Promise((res) => {
        const host = $('spEmbed');
        api.createController(host, { uri, width: '100%', height: 80 }, (c) => {
          ctrl = c;
          loadedUri = uri;
          $('spWait').hidden = true;
          c.addListener('ready', () => { if (wantPlay) { c.play(); } });
          c.addListener('playback_update', (e) => {
            const d = e.data || {};
            const wasPlaying = !sp.paused;
            sp.paused = Boolean(d.isPaused);
            sp.pos = Number(d.position) || 0;
            sp.dur = Number(d.duration) || sp.dur;
            if (!sp.paused) { sp.started = true; wantPlay = false; }
            // parça bitti → sıradaki
            if (wasPlaying && sp.paused && sp.dur && sp.pos >= sp.dur - 900 && lastPos > 1000) { lastPos = 0; load(idx + 1, true); return; }
            lastPos = sp.pos;
            render();
          });
          res(c);
        });
      }));
    }
    return ctrlPromise;
  }

  // ---------- ekran ----------
  function render() {
    const tr = cur();
    const n = tracks.length;
    const st = $('mpState');
    if (!tr) { st.textContent = t('mu.stopped2'); return; }
    const on = playing();
    st.textContent = on ? t('mu.playing', { i: idx + 1, n }) : (position() > 0 ? t('mu.paused', { i: idx + 1, n }) : t('mu.stopped2'));
    mp3?.classList.toggle('is-playing', on);
    const play = $('mpPlay');
    play.textContent = on ? '❚❚' : '▶';
    play.setAttribute('aria-label', on ? t('mu.pause') : t('mu.playT'));
    const pos = position();
    const dur = duration();
    const p = dur ? Math.min(100, (pos / dur) * 100) : 0;
    $('mpFill').style.width = `${p}%`;
    $('mpKnob').style.left = `${p}%`;
    $('mpCur').textContent = fmtDur(pos);
    $('mpDur').textContent = fmtDur(isSp() ? (sp.dur || tr.duration_ms) : tr.duration_ms);
    const bar = $('mpBar');
    bar.setAttribute('aria-valuemax', String(Math.round(dur / 1000)));
    bar.setAttribute('aria-valuenow', String(Math.round(pos / 1000)));
    // Spotify girişsiz dinleyiciye 30 sn önizleme verir: süreden anla
    const preview = isSp() ? (sp.dur > 0 && tr.duration_ms && sp.dur < tr.duration_ms - 5000) : true;
    $('mpSrc').textContent = isSp() ? (preview ? t('mu.srcPreview') : 'SPOTIFY') : t('mu.srcPreview');
    $('spHint').hidden = !(isSp() && preview);
    body.querySelectorAll('tr[data-i]').forEach((row) => {
      const mine = Number(row.dataset.i) === idx;
      row.classList.toggle('on', mine);
      row.setAttribute('aria-current', mine ? 'true' : 'false');
      const b = row.querySelector('button');
      if (b) b.textContent = mine && on ? '❚❚' : '▶';
    });
    const stEl = $('stTrack');
    if (stEl) stEl.textContent = `${tr.title} — ${tr.artist}`;
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
    sp.pos = 0; sp.dur = 0; lastPos = 0;
    render();
  }

  async function load(i, autoplay) {
    if (!tracks.length) return;
    i = (i + tracks.length) % tracks.length;
    const prevSp = isSp();
    show(i);
    const tr = tracks[i];
    if (tr.spotify_id) {
      audio.pause();
      const uri = `spotify:track:${tr.spotify_id}`;
      wantPlay = Boolean(autoplay);
      try {
        const c = await controller(uri);
        if (loadedUri !== uri) { loadedUri = uri; c.loadUri(uri); }
        if (autoplay) { c.play(); setTimeout(() => { if (wantPlay) c.play(); }, 900); }
      } catch (err) {
        console.warn('[spotify]', err);
        toast(t('mu.spErr'));
      }
    } else {
      if (prevSp && ctrl) ctrl.pause();
      audio.src = tr.preview_url || '';
      if (autoplay) playPreview();
    }
  }

  function playPreview() {
    const tr = cur();
    if (!tr?.preview_url) { toast(t('mu.noPreview')); return; }
    if (!audio.src) audio.src = tr.preview_url;
    audio.play().catch(() => {});
  }

  function toggle() {
    const tr = cur();
    if (!tr) return;
    if (isSp()) {
      if (!ctrl || loadedUri !== `spotify:track:${tr.spotify_id}`) { load(idx, true); return; }
      wantPlay = sp.paused;
      ctrl.togglePlay();
    } else if (audio.paused) playPreview(); else audio.pause();
  }

  function seekBy(sec) {
    if (isSp()) { if (ctrl) ctrl.seek(Math.max(0, (sp.pos / 1000) + sec)); }
    else if (audio.duration) audio.currentTime = Math.min(audio.duration - 0.2, Math.max(0, audio.currentTime + sec));
  }
  function seekTo(ratio) {
    const dur = duration();
    if (!dur) return;
    const sec = Math.max(0, Math.min(dur - 500, ratio * dur)) / 1000;
    if (isSp()) { if (ctrl) ctrl.seek(sec); } else audio.currentTime = sec;
  }

  // ---------- kitaplık ----------
  function renderLib() {
    const total = tracks.reduce((a, b) => a + (Number(b.duration_ms) || 0), 0);
    $('libCount').textContent = t('mu.lib', { n: tracks.length, t: fmtDur(total) });
    if (!tracks.length) { body.innerHTML = `<tr><td colspan="8" class="px" style="padding:20px 16px;font-size:12px">${esc(t('mu.empty'))}</td></tr>`; return; }
    const q = filter.toLocaleLowerCase('tr');
    const rows = tracks.map((tr, i) => ({ tr, i })).filter(({ tr }) => !q || [tr.title, tr.artist, tr.album, tr.genre].join(' ').toLocaleLowerCase('tr').includes(q));
    body.innerHTML = rows.map(({ tr, i }, k) => {
      const link = tr.spotify_url || tr.store_url;
      return `<tr data-i="${i}" data-d class="rv" style="--i:${k}">
      <td class="lib-n">${String(i + 1).padStart(2, '0')}</td>
      <td><div class="lib-art"><img class="pixelated" alt="" width="40" height="40" data-art="${esc(tr.artwork_url || '')}"></div></td>
      <td><div class="lib-t">${esc(tr.title)}${tr.explicit ? ' <span class="lib-e" title="explicit">E</span>' : ''}</div><div class="lib-a">${esc(tr.artist)}</div></td>
      <td class="lib-al hide-s">${esc(tr.album || '')}${tr.track_number ? `<small>${esc(t('mu.track', { a: tr.track_number, b: tr.track_count || '?' }))}</small>` : ''}</td>
      <td class="lib-y hide-s">${esc(tr.year || '')}</td>
      <td class="hide-m">${tr.genre ? `<span class="lib-g">${esc(tr.genre)}</span>` : ''}</td>
      <td class="lib-d">${fmtDur(tr.duration_ms)}</td>
      <td class="lib-act"><button type="button" aria-label="${esc(t('mu.playRow', { t: tr.title }))}">▶</button> ${link ? `<a href="${esc(link)}" target="_blank" rel="noopener" aria-label="${esc(tr.spotify_url ? t('mu.openSp') : t('mu.open'))}">↗</a>` : ''}</td>
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
    if (i === idx && (ctrl || audio.src)) toggle(); else load(i, true);
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
  ['play', 'pause'].forEach((ev) => audio.addEventListener(ev, render));
  audio.addEventListener('ended', () => load(idx + 1, true));

  renderLib();
  if (tracks.length) show(0);
  onLang(() => { renderLib(); show(idx); });

  // Spotify embed'i bölüm yaklaşınca hazırla (ilk tıklamada beklemesin)
  const firstSp = tracks.find((x) => x.spotify_id);
  if (firstSp) {
    new IntersectionObserver(([e], io) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      if (!ctrl && isSp()) controller(`spotify:track:${cur().spotify_id}`).catch(() => {});
    }, { rootMargin: '400px' }).observe(document.getElementById('muzik'));
  }

  API.music = {
    list: () => tracks,
    current: () => cur(),
    isPlaying: playing,
    play: (n) => (n == null ? (playing() ? null : toggle()) : load(n - 1, true)),
    pause: () => { if (isSp()) ctrl?.pause(); else audio.pause(); },
    next: () => load(idx + 1, true),
    prev: () => load(idx - 1, true),
    toggle,
  };
}
