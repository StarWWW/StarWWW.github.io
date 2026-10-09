// KONTROL ODASI — 01 MÜZİK: Spotify'dan ekle (arama ya da link), kitaplığı sürükleyerek sırala, bilgileri düzelt,
// 30 sn önizlemeleri dinle / eksikleri getir.
import { esc, fmtDur } from '../util.js';
import { L, sfx, note, fail, ask, softDelete, dragSort, saveOrder, artImg, hydrateArt, isSpPreview } from './ui.js';
import { callFn } from './data.js';

const SP_ID = /(?:open\.spotify\.com\/(?:intl-[a-z]{2}\/)?track\/|spotify:track:)([A-Za-z0-9]{22})/;
const pad = (n) => String(n).padStart(2, '0');

export default {
  key: 'music',
  icon: 'note',
  label: () => L('MÜZİK', 'MUSIC'),
  sub: () => L('Spotify\'dan şarkı ekle, sürükleyerek sırala, bilgileri düzelt; 30 sn önizlemeleri yönet.', 'Add songs from Spotify, drag to reorder, fix details, manage the 30-sec previews.'),
  async mount(el, ctx) {
    const { sb } = ctx;
    el.innerHTML = `<div class="ad-cols2">
      <section class="ad-card">
        <div class="ad-card-h"><b>${esc(L('ŞARKI EKLE', 'ADD SONGS'))}</b><span class="ad-chip sp">SPOTIFY</span></div>
        <form class="ad-searchbar" id="mForm">
          <label class="sr" for="mQ">${esc(L('Şarkı adı ya da Spotify linki', 'Song name or Spotify link'))}</label>
          <input id="mQ" placeholder="${esc(L('şarkı adı ya da Spotify linki…', 'song name or Spotify link…'))}" autocomplete="off" spellcheck="false">
          <button class="ad-b acc">${esc(L('BUL', 'FIND'))} ↵</button>
        </form>
        <p class="ad-hint" id="mHint">${esc(L('İpucu: Spotify\'da şarkı → Paylaş → Şarkı bağlantısını kopyala, buraya yapıştır. Albüm, yıl, tür, kapak ve önizleme kendiliğinden gelir.', 'Tip: in Spotify, song → Share → Copy song link, paste it here. Album, year, genre, cover and preview come automatically.'))}</p>
        <div id="mEmbed"></div>
        <ul class="ad-list" id="mRes"></ul>
      </section>
      <section class="ad-card">
        <div class="ad-card-h"><b>${esc(L('KİTAPLIK', 'LIBRARY'))}</b><span id="mCount"></span></div>
        <div class="ad-tools">
          <input class="ad-filter" id="mFilter" type="search" placeholder="${esc(L('kitaplıkta süz…', 'filter the library…'))}" aria-label="${esc(L('Kitaplıkta süz', 'Filter the library'))}">
          <span class="ad-meter" id="mMeter"><i></i><span></span></span>
          <button type="button" class="ad-b sm" id="mPvAll">${esc(L('EKSİK ÖNİZLEMELERİ GETİR', 'FETCH MISSING PREVIEWS'))}</button>
        </div>
        <ul class="ad-list tall" id="mLib"><li class="ad-empty">…</li></ul>
        <div class="ad-foot">${esc(L('⠿ tutamağından sürükle (ya da tutamağa odaklanıp ↑/↓) — sitedeki sıra budur. ▶ önizlemeyi dinle, ✎ bilgileri düzelt.', 'Drag the ⠿ handle (or focus it and press ↑/↓) — this is the order on the site. ▶ plays the preview, ✎ edits details.'))}</div>
      </section>
    </div>`;
    const $ = (s) => el.querySelector(s);
    const libEl = $('#mLib');
    const resEl = $('#mRes');
    let lib = [];
    let results = [];
    let lastQ = '';
    let total = 0;
    const audio = new Audio();
    audio.preload = 'none';
    audio.volume = 0.6;
    let playing = null;

    const fn = async (body) => {
      const r = await callFn(sb, 'spotify', body);
      if (r.data?.error === 'no_credentials') return r.data;
      if (!r.ok) throw new Error(r.msg || L('Spotify fonksiyonu cevap vermedi', 'The Spotify function did not answer'));
      return r.data;
    };

    // ---------- kitaplık ----------
    const pvState = (x) => (isSpPreview(x.preview_url) ? 'has' : x.preview_url === '' ? 'none' : 'todo');
    const pvTitle = (st) => ({
      has: L('30 sn önizlemeyi dinle', 'Play the 30-sec preview'),
      none: L('Spotify bu şarkıya önizleme vermiyor — tekrar denemek için tıkla', 'Spotify has no preview for this song — click to retry'),
      todo: L('Önizleme henüz alınmadı — getirmek için tıkla', 'Preview not fetched yet — click to fetch'),
    })[st];
    const rowHTML = (x, i) => {
      const st = pvState(x);
      return `<li class="ad-row" data-id="${x.id}">
        <button type="button" class="ad-grip" data-drag data-sfx="none" aria-label="${esc(L('Sırayı değiştir', 'Reorder'))}: ${esc(x.title)}">⠿</button>
        <span class="ad-n">${pad(i + 1)}</span>
        ${artImg(x.artwork_url)}
        <span class="ad-tt"><b>${esc(x.title)}${x.explicit ? ' <i class="ad-e" title="explicit">E</i>' : ''}</b><small>${esc([x.artist, x.album, x.year].filter(Boolean).join(' · '))}</small></span>
        <span class="ad-d">${fmtDur(x.duration_ms)}</span>
        <span class="ad-acts">
          <button type="button" class="ad-pv ${st}" data-pv data-sfx="none" title="${esc(pvTitle(st))}" aria-label="${esc(pvTitle(st))}">${st === 'has' ? '▶' : st === 'none' ? '✕' : '?'}</button>
          <button type="button" data-edit title="${esc(L('Bilgileri düzelt', 'Edit details'))}" aria-label="${esc(L('Düzenle', 'Edit'))}: ${esc(x.title)}">✎</button>
          <button type="button" class="del" data-del data-sfx="none" title="${esc(L('Sil', 'Delete'))}" aria-label="${esc(L('Sil', 'Delete'))}: ${esc(x.title)}">✕</button>
        </span>
      </li>`;
    };
    function renderLib() {
      $('#mCount').textContent = `${lib.length} ${L('PARÇA', 'TRACKS')}`;
      const has = lib.filter((x) => isSpPreview(x.preview_url)).length;
      const todo = lib.filter((x) => x.spotify_id && pvState(x) === 'todo').length;
      const meter = $('#mMeter');
      meter.style.setProperty('--v', lib.length ? has / lib.length : 0);
      meter.querySelector('span').textContent = `${L('ÖNİZLEME', 'PREVIEW')} ${has}/${lib.length}`;
      meter.title = todo ? L(`${todo} şarkının önizlemesi bekliyor`, `${todo} previews pending`) : '';
      $('#mPvAll').disabled = !todo;
      libEl.innerHTML = lib.length ? lib.map(rowHTML).join('') : `<li class="ad-empty">${esc(L('Kitaplık boş. Soldan şarkı bul ve ekle.', 'The library is empty. Find songs on the left and add them.'))}</li>`;
      hydrateArt(libEl);
      applyFilter();
      if (playing) markPlaying();
    }
    async function loadLib() {
      const { data, error } = await sb.from('tracks').select('*').order('sort', { ascending: true }).order('created_at', { ascending: true });
      if (error) { libEl.innerHTML = `<li class="ad-err">${esc(error.message)}</li>`; return; }
      lib = data || [];
      renderLib();
    }
    function applyFilter() {
      const q = $('#mFilter').value.trim().toLocaleLowerCase('tr');
      libEl.dataset.locked = q ? '1' : '';
      libEl.querySelectorAll('[data-id]').forEach((li) => {
        const x = lib.find((t) => String(t.id) === li.dataset.id);
        li.hidden = Boolean(q) && !`${x.title} ${x.artist} ${x.album || ''}`.toLocaleLowerCase('tr').includes(q);
      });
    }
    $('#mFilter').addEventListener('input', applyFilter);

    dragSort(libEl, async (ids, prev) => {
      lib = ids.map((id) => lib.find((x) => String(x.id) === id));
      libEl.querySelectorAll('.ad-n').forEach((n, i) => { n.textContent = pad(i + 1); });
      try {
        const n = await saveOrder(sb, 'tracks', ids.map(Number), prev.map(Number));
        note(L(`Sıra kaydedildi (${n} şarkı yer değiştirdi)`, `Order saved (${n} songs moved)`), { type: 'ok' });
      } catch (err) { fail(err); loadLib(); }
    });

    // önizleme çalar
    function markPlaying() {
      libEl.querySelectorAll('.ad-pv.playing').forEach((b) => { b.classList.remove('playing'); b.textContent = '▶'; b.style.removeProperty('--p'); });
      const b = playing && libEl.querySelector(`[data-id="${playing}"] .ad-pv`);
      if (b && !audio.paused) { b.classList.add('playing'); b.textContent = '❚❚'; }
    }
    audio.addEventListener('timeupdate', () => {
      const b = playing && libEl.querySelector(`[data-id="${playing}"] .ad-pv`);
      if (b && audio.duration) b.style.setProperty('--p', audio.currentTime / audio.duration);
    });
    audio.addEventListener('ended', () => { playing = null; markPlaying(); });
    audio.addEventListener('pause', markPlaying);
    audio.addEventListener('play', markPlaying);

    async function fetchPreview(x, quiet = false) {
      if (x.preview_url === '') await sb.from('tracks').update({ preview_url: null }).eq('id', x.id);
      const d = await fn({ preview: x.id });
      x.preview_url = d?.preview_url || '';
      if (!quiet) note(d?.preview_url ? L(`Önizleme bulundu: ${x.title}`, `Preview found: ${x.title}`) : L(`Spotify bu şarkıya önizleme vermiyor: ${x.title}`, `Spotify has no preview for: ${x.title}`), { type: d?.preview_url ? 'ok' : 'info' });
      return Boolean(d?.preview_url);
    }

    libEl.addEventListener('click', async (e) => {
      const li = e.target.closest('[data-id]');
      if (!li) return;
      const x = lib.find((t) => String(t.id) === li.dataset.id);
      if (e.target.closest('[data-pv]')) {
        if (isSpPreview(x.preview_url)) {
          if (playing === String(x.id) && !audio.paused) { audio.pause(); return; }
          playing = String(x.id);
          audio.src = x.preview_url;
          audio.play().catch(() => note(L('Önizleme çalınamadı', 'Could not play the preview'), { type: 'err' }));
          return;
        }
        const b = e.target.closest('[data-pv]');
        b.disabled = true; b.textContent = '…';
        try { await fetchPreview(x); } catch (err) { fail(err, L('Önizleme alınamadı: ', 'Could not fetch the preview: ')); }
        renderLib();
        return;
      }
      if (e.target.closest('[data-edit]')) { edit(x); return; }
      if (e.target.closest('[data-del]')) {
        const at = lib.indexOf(x);
        if (playing === String(x.id)) audio.pause();
        softDelete({
          label: `"${x.title}"`,
          hide: () => { lib.splice(at, 1); renderLib(); },
          restore: () => { lib.splice(at, 0, x); renderLib(); },
          commit: () => sb.from('tracks').delete().eq('id', x.id).then((r) => { ctx.refreshBadges(); return r; }),
        });
      }
    });

    async function edit(x) {
      const v = await ask({
        title: L('ŞARKIYI DÜZENLE', 'EDIT SONG'),
        ok: L('KAYDET', 'SAVE'),
        wide: true,
        fields: [
          { key: 'title', label: L('ŞARKI', 'TITLE'), value: x.title, required: true, max: 200, full: true },
          { key: 'artist', label: L('SANATÇI', 'ARTIST'), value: x.artist, required: true, max: 200, full: true },
          { key: 'album', label: L('ALBÜM', 'ALBUM'), value: x.album || '', max: 200, full: true },
          { key: 'year', label: L('YIL', 'YEAR'), value: x.year || '', type: 'number', min: 1900, maxv: 2100 },
          { key: 'genre', label: L('TÜR', 'GENRE'), value: x.genre || '', max: 80 },
          { key: 'track_number', label: L('PARÇA NO', 'TRACK NO'), value: x.track_number || '', type: 'number', min: 1 },
          { key: 'track_count', label: L('ALBÜMDEKİ PARÇA', 'TRACKS ON ALBUM'), value: x.track_count || '', type: 'number', min: 1 },
          { key: 'explicit', label: L('AÇIK İÇERİK (E)', 'EXPLICIT (E)'), value: x.explicit ? '1' : '0', type: 'select', options: [['0', L('HAYIR', 'NO')], ['1', L('EVET', 'YES')]] },
          { key: 'artwork_url', label: L('KAPAK RESMİ', 'COVER IMAGE'), value: x.artwork_url || '', type: 'url', full: true },
          { key: 'spotify_url', label: L('SPOTIFY LİNKİ', 'SPOTIFY LINK'), value: x.spotify_url || '', type: 'url', full: true },
        ],
      });
      if (!v) return;
      const int = (s) => (s === '' ? null : Math.round(Number(s)) || null);
      const patch = {
        title: v.title, artist: v.artist, album: v.album || null, year: int(v.year), genre: v.genre || null,
        track_number: int(v.track_number), track_count: int(v.track_count), explicit: v.explicit === '1',
        artwork_url: v.artwork_url || null, spotify_url: v.spotify_url || null,
      };
      const { error } = await sb.from('tracks').update(patch).eq('id', x.id);
      if (error) { fail(error); return; }
      Object.assign(x, patch);
      renderLib();
      libEl.querySelector(`[data-id="${x.id}"]`)?.classList.add('flash');
      note(L(`Kaydedildi: ${x.title}`, `Saved: ${x.title}`), { type: 'ok' });
    }

    $('#mPvAll').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const todo = lib.filter((x) => x.spotify_id && pvState(x) === 'todo');
      if (!todo.length) return;
      btn.disabled = true;
      let ok = 0;
      for (const [k, x] of todo.entries()) {
        btn.textContent = `${k + 1}/${todo.length} · ${x.title}`;
        try { if (await fetchPreview(x, true)) ok++; } catch (err) { // eslint-disable-line no-await-in-loop
          fail(err, L('Önizleme alınamadı: ', 'Could not fetch previews: '));
          break;
        }
        renderLib();
      }
      btn.textContent = L('EKSİK ÖNİZLEMELERİ GETİR', 'FETCH MISSING PREVIEWS');
      note(L(`${ok}/${todo.length} önizleme bulundu`, `${ok}/${todo.length} previews found`), { type: ok ? 'ok' : 'info' });
      renderLib();
      ctx.refreshBadges();
    });

    // ---------- ekle ----------
    const have = () => new Set(lib.map((x) => x.spotify_id).filter(Boolean));
    function renderResults() {
      const ids = have();
      resEl.innerHTML = (results.map((r, i) => `<li class="ad-row res" data-i="${i}">
        ${artImg(r.artwork_url)}
        <span class="ad-tt"><b>${esc(r.title)}${r.explicit ? ' <i class="ad-e">E</i>' : ''}</b><small>${esc([r.artist, r.album, r.year].filter(Boolean).join(' · '))}</small></span>
        <span class="ad-d">${fmtDur(r.duration_ms)}</span>
        <span class="ad-acts"><button type="button" data-listen title="${esc(L('Dinle', 'Listen'))}" aria-label="${esc(L('Dinle', 'Listen'))}: ${esc(r.title)}">▶</button>${ids.has(r.spotify_id) ? `<button type="button" class="ok" disabled>✓ ${esc(L('EKLİ', 'ADDED'))}</button>` : `<button type="button" class="add" data-add data-sfx="none">+ ${esc(L('EKLE', 'ADD'))}</button>`}</span>
      </li>`).join('') || (lastQ ? `<li class="ad-empty">${esc(L('Sonuç yok.', 'No results.'))}</li>` : ''))
        + (lastQ && results.length < total ? `<li class="ad-more"><button type="button" class="ad-b" data-more>${esc(L('DAHA FAZLA', 'MORE'))} (${results.length}/${total})</button></li>` : '');
      hydrateArt(resEl);
    }
    function embed(r) {
      if (isSpPreview(r.preview_url)) { playing = null; audio.src = r.preview_url; audio.play().catch(() => {}); return; }
      $('#mEmbed').innerHTML = `<div class="ad-embed"><iframe title="Spotify: ${esc(r.title)}" src="https://open.spotify.com/embed/track/${esc(r.spotify_id)}?utm_source=star" width="100%" height="80" allow="autoplay; clipboard-write; encrypted-media" loading="lazy"></iframe><button type="button" class="ad-embed-x" data-sfx="close" aria-label="${esc(L('Kapat', 'Close'))}">✕</button></div>`;
    }
    $('#mEmbed').addEventListener('click', (e) => { if (e.target.closest('.ad-embed-x')) $('#mEmbed').innerHTML = ''; });

    async function find(more = false) {
      const q = $('#mQ').value.trim();
      if (!q) return;
      const hint = $('#mHint');
      const id = q.match(SP_ID)?.[1] || (/^[A-Za-z0-9]{22}$/.test(q) ? q : null);
      hint.className = 'ad-hint busy';
      try {
        if (id) {
          hint.textContent = L('Spotify\'dan bilgiler çekiliyor…', 'Fetching from Spotify…');
          const d = await fn({ track: id });
          results = [d]; total = 1; lastQ = '';
          hint.textContent = L('Bulundu — eklemek için + EKLE.', 'Found — press + ADD.');
          renderResults();
          embed(d);
        } else {
          if (!more) { results = []; lastQ = q; }
          hint.textContent = L('aranıyor…', 'searching…');
          const d = await fn({ q: lastQ, offset: results.length });
          if (d?.error === 'no_credentials') {
            results = []; lastQ = '';
            hint.textContent = L('Spotify araması kapalı (SPOTIFY_CLIENT_ID / SECRET yok — README → Adım 7). Şarkı linkini yapıştırarak ekleyebilirsin.', 'Spotify search is off (no SPOTIFY_CLIENT_ID / SECRET — README → Step 7). You can still add songs by pasting a link.');
            renderResults();
            return;
          }
          results = results.concat(d.results || []);
          total = d.total || results.length;
          hint.textContent = L(`${total} sonuç`, `${total} results`);
          renderResults();
          if (more) resEl.scrollTop = resEl.scrollHeight;
        }
        hint.className = 'ad-hint';
      } catch (err) {
        hint.className = 'ad-hint err';
        hint.textContent = `${L('Spotify fonksiyonu çalışmadı (README → Adım 7)', 'The Spotify function failed (README → Step 7)')}: ${err.message || err}`;
        sfx('error');
      }
    }
    $('#mForm').addEventListener('submit', (e) => { e.preventDefault(); find(false); });

    resEl.addEventListener('click', async (e) => {
      if (e.target.closest('[data-more]')) { find(true); return; }
      const li = e.target.closest('[data-i]');
      if (!li) return;
      const r = results[Number(li.dataset.i)];
      if (e.target.closest('[data-listen]')) { embed(r); return; }
      const btn = e.target.closest('[data-add]');
      if (!btn) return;
      btn.disabled = true; btn.textContent = '…';
      let full = r;
      try { full = { ...r, ...(await fn({ track: r.spotify_id })) }; } catch { /* arama sonucu da yeterli */ }
      const { data: added, error } = await sb.from('tracks').insert({
        spotify_id: full.spotify_id, spotify_url: full.spotify_url, explicit: Boolean(full.explicit),
        title: full.title, artist: full.artist, album: full.album, track_number: full.track_number, track_count: full.track_count,
        year: full.year, genre: full.genre, duration_ms: full.duration_ms, artwork_url: full.artwork_url, sort: lib.length,
        preview_url: isSpPreview(full.preview_url) ? full.preview_url : null,
      }).select('*').single();
      if (error) { fail(error); btn.disabled = false; btn.textContent = `+ ${L('EKLE', 'ADD')}`; return; }
      lib.push(added);
      renderLib();
      renderResults();
      const row = libEl.querySelector(`[data-id="${added.id}"]`);
      row?.classList.add('flash');
      row?.scrollIntoView({ block: 'nearest' });
      note(L(`Eklendi: ${full.title}`, `Added: ${full.title}`), { type: 'ok' });
      // önizleme gelmediyse arka planda getir
      if (!isSpPreview(added.preview_url) && added.spotify_id) fetchPreview(added, true).then(renderLib).catch(() => {});
      ctx.refreshBadges();
    });

    await loadLib();
    $('#mQ').focus();
    return {
      focusSearch: () => $('#mQ').focus(),
      escape: () => { if ($('#mEmbed').innerHTML) { $('#mEmbed').innerHTML = ''; return true; } return false; },
      unmount: () => { audio.pause(); audio.src = ''; },
    };
  },
};
