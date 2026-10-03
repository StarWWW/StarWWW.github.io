// MP3 çalar — üç motor:
//  1) YouTube (IFrame API): şarkının tamamı herkese çalar, ses ayarı çalışır.
//  2) Spotify embed: YouTube kimliği yoksa ya da video gömülemiyorsa. Ses Spotify'ın kendi çubuğundan.
//  3) iTunes önizlemesi (30 sn): ikisi de yoksa.
import { getTracks } from '../data.js';
import { esc, fmtDur, toast, store, API, nameLang } from '../util.js';
import { t, onLang } from '../i18n.js';
import { pixelate } from '../pixelate.js';
import { getSupabase } from '../supabase.js';

function loadScript(src) {
  const s = document.createElement('script');
  s.src = src;
  s.async = true;
  document.head.append(s);
  return s;
}

let spApiP = null;
function spotifyApi() {
  if (!spApiP) {
    spApiP = new Promise((res, rej) => {
      if (window.__spotifyIframeApi) { res(window.__spotifyIframeApi); return; }
      window.onSpotifyIframeApiReady = (api) => { window.__spotifyIframeApi = api; res(api); };
      loadScript('https://open.spotify.com/embed/iframe-api/v1').onerror = () => { spApiP = null; rej(new Error('spotify api')); };
    });
  }
  return spApiP;
}

let ytApiP = null;
function youtubeApi() {
  if (!ytApiP) {
    ytApiP = new Promise((res, rej) => {
      if (window.YT?.Player) { res(window.YT); return; }
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev?.(); res(window.YT); };
      loadScript('https://www.youtube.com/iframe_api').onerror = () => { ytApiP = null; rej(new Error('youtube api')); };
      setTimeout(() => { if (!window.YT?.Player) { ytApiP = null; rej(new Error('youtube timeout')); } }, 15000);
    });
  }
  return ytApiP;
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
  let touched = false;      // ziyaretçi bir şey çaldı ya da çalar hazırlandı → bant dolsun
  let flashUntil = 0;       // LCD'de ses seviyesi gösterilirken durum yazısı beklesin

  // ---------- ses ----------
  let vol = Math.max(0, Math.min(10, Number(store.get('star.vol', 8)) || 0));
  let muted = Boolean(store.get('star.muted', false));
  let spVolWarned = false;

  const cur = () => tracks[idx];

  // ---------- YouTube eşleştirme ----------
  // youtube_id'si boş (null) şarkılar için youtube-match fonksiyonu YouTube karşılığını bulup kaydeder.
  // '' = arandı, uygun video yok → Spotify. Sonuç tarayıcıda da saklanır.
  const ytCache = store.get('star.ytm', {}) || {};
  const pending = new Map();
  // fonksiyon yoksa / çalışmıyorsa bir saat boyunca tekrar deneme (her ziyaretçi için gereksiz istek olmasın)
  let matchDown = Date.now() - (Number(store.get('star.ytmDown', 0)) || 0) < 3600e3;
  const needsYt = (tr) => !matchDown && tr && tr.id != null && tr.youtube_id == null && !tr._ytTried;
  function resolveYt(tr) {
    if (!needsYt(tr)) return Promise.resolve(tr?.youtube_id || null);
    const key = String(tr.id);
    if (key in ytCache) { tr.youtube_id = ytCache[key] || ''; return Promise.resolve(tr.youtube_id || null); }
    if (pending.has(key)) return pending.get(key);
    const job = (async () => {
      const sb = await getSupabase();
      if (!sb) { tr._ytTried = true; return null; }
      const { data, error } = await sb.functions.invoke('youtube-match', { body: { id: tr.id } });
      if (error || !data || data.error) throw error || new Error(data?.error || 'boş cevap');
      tr.youtube_id = data.youtube_id || '';
      ytCache[key] = tr.youtube_id;
      store.set('star.ytm', ytCache);
      return tr.youtube_id || null;
    })().catch((err) => {
      console.warn('[youtube-match]', err?.message || err);
      tr._ytTried = true;
      matchDown = true;
      store.set('star.ytmDown', Date.now());
      return null;
    })
      .finally(() => pending.delete(key));
    pending.set(key, job);
    return job;
  }
  const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]);

  let ytFails = 0;           // üst üste iki YouTube hatası → bu oturumda YouTube'u bırak (ortam engelliyor demektir)
  const engineOf = (tr) => (!tr ? null : (tr.youtube_id && !tr._ytBad && ytFails < 2) ? 'yt' : tr.spotify_id ? 'sp' : 'pv');
  let engine = null;

  // ---------- YouTube ----------
  let yt = null; let ytP = null; let ytLoaded = null; let ytState = -1; let ytWant = false; let ytPoll = 0;
  const ytS = { pos: 0, dur: 0 };
  const ytPlaying = () => ytState === 1 || ytState === 3;

  function ytEnsure(videoId) {
    if (ytP) return ytP;
    ytP = youtubeApi().then((YT) => new Promise((res, rej) => {
      $('ytWrap').hidden = engine !== 'yt';
      const vars = { playsinline: 1, rel: 0, iv_load_policy: 3, modestbranding: 1, autoplay: ytWant ? 1 : 0 };
      if (location.origin && location.origin !== 'null') vars.origin = location.origin;
      const p = new YT.Player('ytEmbed', {
        videoId, width: '100%', height: '100%', host: 'https://www.youtube-nocookie.com', playerVars: vars,
        events: {
          onReady: () => {
            yt = p; ytLoaded = videoId;
            p.getIframe?.()?.setAttribute('title', 'YouTube');
            applyVolume();
            if (ytWant && engine === 'yt') p.playVideo();
            res(p);
          },
          onStateChange: (e) => {
            ytState = e.data;
            if (ytPlaying()) { ytWant = false; ytFails = 0; startPoll(); } else stopPoll();
            if (e.data === 0 && engine === 'yt') { load(idx + 1, true); return; }
            readYt(); render();
          },
          onError: (e) => ytFail(e.data),
        },
      });
      setTimeout(() => { if (!yt) rej(new Error('yt ready timeout')); }, 15000);
    }));
    ytP.catch(() => { ytP = null; });
    return ytP;
  }
  function readYt() {
    if (!yt?.getCurrentTime) return;
    ytS.pos = (Number(yt.getCurrentTime()) || 0) * 1000;
    ytS.dur = (Number(yt.getDuration()) || 0) * 1000;
  }
  function startPoll() { if (!ytPoll) ytPoll = setInterval(() => { readYt(); render(); }, 250); }
  function stopPoll() { clearInterval(ytPoll); ytPoll = 0; }

  async function ytLoad(tr, autoplay) {
    ytWant = autoplay;
    try {
      const p = await ytEnsure(tr.youtube_id);
      if (cur() !== tr || engine !== 'yt') return;
      if (ytLoaded !== tr.youtube_id) {
        ytLoaded = tr.youtube_id;
        if (autoplay) p.loadVideoById(tr.youtube_id); else p.cueVideoById(tr.youtube_id);
      } else if (autoplay) p.playVideo();
    } catch (err) {
      console.warn('[youtube]', err);
      ytFail('load');
    }
  }
  function ytFail(code) {
    const tr = cur();
    if (engine !== 'yt' || !tr) return;
    console.warn('[youtube] hata', code, tr.youtube_id);
    tr._ytBad = true;
    ytFails++;
    stopPoll();
    try { yt?.stopVideo?.(); } catch { /* yok */ }
    if (ytFails === 1) toast(t(tr.spotify_id ? 'mu.ytErr' : 'mu.ytErr2'));
    load(idx, ytWant || touched);
  }

  // ---------- Spotify ----------
  let ctrl = null; let ctrlP = null; let spLoaded = null; let spWant = false; let lastPos = 0;
  const sp = { paused: true, pos: 0, dur: 0 };
  function controller(uri) {
    if (ctrl) return Promise.resolve(ctrl);
    if (!ctrlP) {
      ctrlP = spotifyApi().then((api) => new Promise((res) => {
        api.createController($('spEmbed'), { uri, width: '100%', height: 80 }, (c) => {
          ctrl = c;
          spLoaded = uri;
          c.addListener('ready', () => { if (spWant && engine === 'sp') c.play(); });
          c.addListener('playback_update', (e) => {
            const d = e.data || {};
            const was = !sp.paused;
            sp.paused = Boolean(d.isPaused);
            sp.pos = Number(d.position) || 0;
            sp.dur = Number(d.duration) || sp.dur;
            if (!sp.paused) spWant = false;
            if (engine === 'sp' && was && sp.paused && sp.dur && sp.pos >= sp.dur - 900 && lastPos > 1000) { lastPos = 0; load(idx + 1, true); return; }
            lastPos = sp.pos;
            render();
          });
          res(c);
        });
      }));
      ctrlP.catch(() => { ctrlP = null; });
    }
    return ctrlP;
  }
  async function spLoad(tr, autoplay) {
    const uri = `spotify:track:${tr.spotify_id}`;
    spWant = autoplay;
    try {
      const c = await controller(uri);
      if (cur() !== tr || engine !== 'sp') return;
      if (spLoaded !== uri) { spLoaded = uri; c.loadUri(uri); }
      if (autoplay) { c.play(); setTimeout(() => { if (spWant && engine === 'sp') c.play(); }, 900); }
    } catch (err) {
      console.warn('[spotify]', err);
      toast(t('mu.spErr'));
    }
  }

  // ---------- ortak arayüz ----------
  const playing = () => (engine === 'yt' ? ytPlaying() : engine === 'sp' ? !sp.paused : !audio.paused && !audio.ended);
  const position = () => (engine === 'yt' ? ytS.pos : engine === 'sp' ? sp.pos : audio.currentTime * 1000);
  const duration = () => {
    const tr = cur();
    if (engine === 'yt') return ytS.dur || tr?.duration_ms || 0;
    if (engine === 'sp') return sp.dur || tr?.duration_ms || 0;
    return audio.duration ? audio.duration * 1000 : 30000;
  };
  const spPreview = () => engine === 'sp' && sp.dur > 0 && cur()?.duration_ms && sp.dur < cur().duration_ms - 5000;
  const srcLabel = () => (engine === 'yt' ? t('mu.srcYt') : engine === 'sp' ? (spPreview() ? t('mu.srcPreview') : t('mu.srcSp')) : t('mu.srcPreview'));

  function pauseOthers(keep) {
    if (keep !== 'yt' && yt) { try { yt.pauseVideo(); } catch { /* hazır değil */ } stopPoll(); }
    if (keep !== 'sp' && ctrl) ctrl.pause();
    if (keep !== 'pv') audio.pause();
  }

  // ---------- ekran ----------
  function render() {
    const tr = cur();
    const n = tracks.length;
    const st = $('mpState');
    if (!tr) { st.textContent = t('mu.stopped2'); return; }
    const on = playing();
    if (Date.now() > flashUntil) st.textContent = on ? t('mu.playing', { i: idx + 1, n }) : (position() > 0 ? t('mu.paused', { i: idx + 1, n }) : t('mu.stopped2'));
    mp3?.classList.toggle('is-playing', on);
    document.querySelector('.dock')?.classList.toggle('is-playing', on);
    const play = $('mpPlay');
    play.textContent = on ? '❚❚' : '▶';
    play.setAttribute('aria-label', on ? t('mu.pause') : t('mu.playT'));
    const pos = position();
    const dur = duration();
    const p = dur ? Math.min(100, (pos / dur) * 100) : 0;
    $('mpFill').style.width = `${p}%`;
    $('mpKnob').style.left = `${p}%`;
    $('mpCur').textContent = fmtDur(pos);
    $('mpDur').textContent = fmtDur(engine === 'pv' ? (audio.duration ? audio.duration * 1000 : 30000) : dur);
    const bar = $('mpBar');
    bar.setAttribute('aria-valuemax', String(Math.round(dur / 1000)));
    bar.setAttribute('aria-valuenow', String(Math.round(pos / 1000)));
    bar.setAttribute('aria-valuetext', `${fmtDur(pos)} / ${fmtDur(dur)}`);
    const src = $('mpSrc');
    src.textContent = srcLabel();
    src.classList.toggle('pv', engine === 'pv' || spPreview());
    $('spHint').hidden = !spPreview();
    if (touched) $('dockSrc').textContent = t('mu.nowFrom', { src: engine === 'yt' ? 'YOUTUBE' : engine === 'sp' ? 'SPOTIFY' : 'ITUNES' });
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
    $('ytWrap').hidden = !(touched && engine === 'yt' && ytP);
    $('spWrap').hidden = !(touched && engine === 'sp');
    if (!touched || !tr) {
      info.innerHTML = `<p class="px dock-wait" id="dockWait">${esc(t('mu.dockWaitD'))}</p>`;
      $('dockSrc').textContent = t('mu.dockD');
      return;
    }
    const links = [
      tr.spotify_url || tr.spotify_id ? `<a class="px di-sp" href="${esc(tr.spotify_url || `https://open.spotify.com/track/${tr.spotify_id}`)}" target="_blank" rel="noopener">${esc(t('mu.openSp'))} ↗</a>` : '',
      tr.youtube_id ? `<a class="px di-yt" href="https://www.youtube.com/watch?v=${esc(tr.youtube_id)}" target="_blank" rel="noopener">${esc(t('mu.openYt'))} ↗</a>` : '',
      !tr.spotify_id && tr.store_url ? `<a class="px" href="${esc(tr.store_url)}" target="_blank" rel="noopener">${esc(t('mu.open'))} ↗</a>` : '',
    ].join('');
    info.innerHTML = `<div class="di-art">${tr.artwork_url ? `<img src="${esc(tr.artwork_url)}" alt="" decoding="async">` : ''}</div>
      <div class="di-main">
        <span class="px di-idx">${String(idx + 1).padStart(2, '0')} / ${String(tracks.length).padStart(2, '0')}</span>
        <b class="brut di-t" lang="${nameLang(tr.title)}">${esc(tr.title)}</b>
        <span class="di-a">${esc(tr.artist || '')}</span>
        <span class="di-al">${esc([tr.album, tr.year].filter(Boolean).join(' · '))}</span>
        <div class="di-links">${links}</div>
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
    sp.pos = 0; sp.dur = 0; lastPos = 0; ytS.pos = 0; ytS.dur = 0;
    renderDock();
    render();
  }

  async function load(i, autoplay) {
    if (!tracks.length) return;
    i = (i + tracks.length) % tracks.length;
    idx = i;
    const tr = tracks[i];
    if (needsYt(tr)) {
      if (autoplay) touched = true;
      show(i);
      $('mpState').textContent = t('mu.finding');
      flashUntil = Date.now() + 8000;
      await withTimeout(resolveYt(tr), 7000);
      flashUntil = 0;
      if (cur() !== tr) return;
    }
    engine = engineOf(tr);
    if (autoplay) touched = true;
    pauseOthers(engine);
    show(i);
    if (engine === 'yt') await ytLoad(tr, autoplay);
    else if (engine === 'sp') await spLoad(tr, autoplay);
    else {
      if (audio.dataset.src !== (tr.preview_url || '')) { audio.src = tr.preview_url || ''; audio.dataset.src = tr.preview_url || ''; }
      if (autoplay) playPreview();
    }
    renderDock();
    render();
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
    if (engine !== engineOf(tr)) { load(idx, true); return; }
    if (engine === 'yt') {
      if (!yt || ytLoaded !== tr.youtube_id) { load(idx, true); return; }
      touched = true;
      if (ytPlaying()) yt.pauseVideo(); else { ytWant = true; yt.playVideo(); }
      renderDock();
    } else if (engine === 'sp') {
      if (!ctrl || spLoaded !== `spotify:track:${tr.spotify_id}`) { load(idx, true); return; }
      spWant = sp.paused;
      ctrl.togglePlay();
    } else if (audio.paused) { touched = true; renderDock(); playPreview(); } else audio.pause();
  }

  function seekBy(sec) {
    if (engine === 'yt') { if (yt) { readYt(); yt.seekTo(Math.max(0, ytS.pos / 1000 + sec), true); setTimeout(() => { readYt(); render(); }, 120); } } else if (engine === 'sp') { if (ctrl) ctrl.seek(Math.max(0, (sp.pos / 1000) + sec)); } else if (audio.duration) audio.currentTime = Math.min(audio.duration - 0.2, Math.max(0, audio.currentTime + sec));
  }
  function seekTo(ratio) {
    const dur = duration();
    if (!dur) return;
    const sec = Math.max(0, Math.min(dur - 500, ratio * dur)) / 1000;
    if (engine === 'yt') { if (yt) { yt.seekTo(sec, true); ytS.pos = sec * 1000; render(); } } else if (engine === 'sp') { if (ctrl) ctrl.seek(sec); } else audio.currentTime = sec;
  }

  // ---------- ses kontrolü ----------
  const volEl = $('mpVol');
  const volWrap = document.querySelector('.mp3-vol');
  if (volEl) volEl.innerHTML = Array.from({ length: 10 }, (_, i) => `<i data-v="${i + 1}" style="--j:${i}"></i>`).join('');

  function applyVolume() {
    const lv = muted ? 0 : vol;
    audio.volume = lv / 10;
    if (yt?.setVolume) {
      try { yt.setVolume(vol * 10); if (lv === 0) yt.mute(); else yt.unMute(); } catch { /* hazır değil */ }
    }
  }
  function renderVol() {
    if (!volEl) return;
    volEl.querySelectorAll('i').forEach((s, i) => s.classList.toggle('on', i < vol));
    volEl.setAttribute('aria-valuenow', String(vol));
    volEl.setAttribute('aria-valuetext', muted ? t('mu.muted') : `${vol * 10}%`);
    volWrap?.classList.toggle('is-muted', muted || vol === 0);
    $('mpMute')?.setAttribute('aria-pressed', String(muted));
  }
  function flash() {
    const st = $('mpState');
    st.textContent = muted || vol === 0 ? `× ${t('mu.muted')}` : t('mu.vol', { v: `${'▮'.repeat(vol)}${'▯'.repeat(10 - vol)}` });
    flashUntil = Date.now() + 1300;
    clearTimeout(flash.tm);
    flash.tm = setTimeout(render, 1350);
  }
  function setVol(n, opts = {}) {
    vol = Math.max(0, Math.min(10, Math.round(n)));
    if (vol > 0 && !opts.keepMute) muted = false;
    store.set('star.vol', vol);
    store.set('star.muted', muted);
    applyVolume(); renderVol(); flash();
    if (engine === 'sp' && !spVolWarned) { spVolWarned = true; toast(t('mu.volSp'), 4200); }
  }
  function toggleMute() {
    muted = !muted;
    if (!muted && vol === 0) vol = 5;
    store.set('star.muted', muted);
    store.set('star.vol', vol);
    applyVolume(); renderVol(); flash();
    if (engine === 'sp' && !spVolWarned) { spVolWarned = true; toast(t('mu.volSp'), 4200); }
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
      const link = tr.spotify_url || (tr.spotify_id ? `https://open.spotify.com/track/${tr.spotify_id}` : tr.store_url);
      return `<tr data-i="${i}" data-d class="rv" style="--i:${k}">
      <td class="lib-n">${String(i + 1).padStart(2, '0')}</td>
      <td><div class="lib-art"><img class="pixelated" alt="" width="40" height="40" data-art="${esc(tr.artwork_url || '')}"></div></td>
      <td><div class="lib-t">${esc(tr.title)}${tr.explicit ? ' <span class="lib-e" title="explicit">E</span>' : ''}</div><div class="lib-a">${esc(tr.artist)}</div></td>
      <td class="lib-al hide-s">${esc(tr.album || '')}${tr.track_number ? `<small>${esc(t('mu.track', { a: tr.track_number, b: tr.track_count || '?' }))}</small>` : ''}</td>
      <td class="lib-y hide-s">${esc(tr.year || '')}</td>
      <td class="hide-m">${tr.genre ? `<span class="lib-g">${esc(tr.genre)}</span>` : ''}</td>
      <td class="lib-d">${fmtDur(tr.duration_ms)}</td>
      <td class="lib-act"><button type="button" class="lib-play" aria-label="${esc(t('mu.playRow', { t: tr.title }))}">▶</button> ${link ? `<a href="${esc(link)}" target="_blank" rel="noopener" aria-label="${esc(tr.spotify_id ? t('mu.openSp') : t('mu.open'))}" title="${esc(tr.spotify_id ? t('mu.openSp') : t('mu.open'))}">↗</a>` : ''}</td>
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
    if (i === idx && touched && engine === engineOf(cur())) toggle(); else load(i, true);
  });

  $('mpPlay').addEventListener('click', toggle);
  $('mpPrev').addEventListener('click', () => load(idx - 1, playing() || touched));
  $('mpNext').addEventListener('click', () => load(idx + 1, playing() || touched));
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
  ['play', 'pause', 'loadedmetadata'].forEach((ev) => audio.addEventListener(ev, render));
  audio.addEventListener('ended', () => load(idx + 1, true));

  applyVolume();
  renderVol();
  renderLib();
  if (tracks.length) { engine = engineOf(tracks[0]); show(0); }
  onLang(() => { renderLib(); show(idx); renderVol(); });

  // Bölüm yaklaşınca çaları hazırla: ilk tıklamada beklemesin, bant boş kalmasın
  const muzik = document.getElementById('muzik');
  if (muzik && tracks.length) {
    new IntersectionObserver(([e], io) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const tr = cur();
      // önce şu anki, sonra diğer şarkıların YouTube karşılıklarını sırayla bul
      (async () => {
        await resolveYt(tr);
        if (!touched && cur() === tr) { engine = engineOf(tr); prepare(); }
        for (const x of tracks) if (needsYt(x)) await resolveYt(x); // eslint-disable-line no-await-in-loop
      })();
    }, { rootMargin: '400px' }).observe(muzik);
  }
  function prepare() {
    const tr = cur();
    if (!tr) return;
    if (engine === 'yt') {
      ytEnsure(tr.youtube_id).then(() => { if (!touched && engine === 'yt') { touched = true; renderDock(); render(); } }).catch(() => {});
    } else if (engine === 'sp') {
      controller(`spotify:track:${tr.spotify_id}`).then(() => { if (!touched && engine === 'sp') { touched = true; renderDock(); render(); } }).catch(() => {});
    }
  }

  API.music = {
    list: () => tracks,
    current: () => cur(),
    isPlaying: playing,
    play: (n) => (n == null ? (playing() ? null : toggle()) : load(n - 1, true)),
    pause: () => { if (engine === 'yt') yt?.pauseVideo(); else if (engine === 'sp') ctrl?.pause(); else audio.pause(); },
    next: () => load(idx + 1, true),
    prev: () => load(idx - 1, true),
    toggle,
    volume: (n) => (n == null ? vol : setVol(n)),
    mute: toggleMute,
  };
}
