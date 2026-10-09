// KONTROL ODASI — 02 OYUNLAR: RAWG + Steam'den ekle, rafı sürükleyerek sırala, her şeyi (renk, kapak, durum, not)
// canlı kutu önizlemeli çekmecede düzenle.
import { esc } from '../util.js';
import { t } from '../i18n.js';
import { CONFIG } from '../config.js';
import { dominantColor, DB32 } from '../pixelate.js';
import { casePreviewHTML } from '../sections/shelf.js';
import { L, sfx, note, fail, ask, softDelete, dragSort, saveOrder, artImg, hydrateArt, trapTab, isUrl } from './ui.js';
import { callFn } from './data.js';

const STATUSES = ['oynuyorum', 'oynadım', 'bitirdim', 'bıraktım', 'favori'];
const CART_COLORS = ['#AC3232', '#DF7126', '#FBF236', '#99E550', '#6ABE30', '#5FCDE4', '#639BFF', '#3F3F74', '#D77BBA', '#76428A', '#222034', '#9BADB7'];
const pad = (n) => String(n).padStart(2, '0');
const steamId = (g) => g.steam_appid || String(g.store_url || '').match(/\/app\/(\d+)/)?.[1] || String(g.cover_url || '').match(/\/apps\/(\d+)\//)?.[1] || null;
const steamBox = (g) => (steamId(g) ? `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${steamId(g)}/library_600x900.jpg` : '');
const boxOf = (g) => g.box_url || steamBox(g);
const list = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);
const migNote = (msg) => (/box_url/.test(String(msg)) ? L(' — önce supabase/migrations/003_kutu_kapak.sql dosyasını SQL Editor\'de çalıştır.', ' — run supabase/migrations/003_kutu_kapak.sql in the SQL Editor first.') : '');

export default {
  key: 'games',
  icon: 'pad',
  label: () => L('OYUNLAR', 'GAMES'),
  sub: () => L('Oyun ara ve rafa koy; kutunun rengini, kapağını, durumunu ve notunu canlı önizlemeyle düzenle.', 'Search games and shelve them; edit the case color, cover, status and note with a live preview.'),
  async mount(el, ctx) {
    const { sb } = ctx;
    el.innerHTML = `<div class="ad-cols2">
      <section class="ad-card">
        <div class="ad-card-h"><b>${esc(L('OYUN EKLE', 'ADD GAMES'))}</b><span class="ad-chip">RAWG + STEAM</span></div>
        <form class="ad-searchbar" id="gForm">
          <label class="sr" for="gQ">${esc(L('Oyun ara', 'Search games'))}</label>
          <input id="gQ" placeholder="ultrakill, outer wilds…" autocomplete="off" spellcheck="false">
          <button class="ad-b acc">${esc(L('ARA', 'SEARCH'))} ↵</button>
        </form>
        <p class="ad-hint" id="gHint">${esc(L('Bir sonuca tıkla: geliştirici, yayıncı, tür, platform, kapak ve DVD kutu kapağı kendiliğinden dolar, rafa koymadan önce hepsini düzeltebilirsin.', 'Click a result: developer, publisher, genre, platform, cover and DVD case art fill in automatically; you can fix everything before shelving it.'))}</p>
        <ul class="ad-list" id="gRes"></ul>
      </section>
      <section class="ad-card">
        <div class="ad-card-h"><b>${esc(L('RAF', 'SHELF'))}</b><span id="gCount"></span></div>
        <div class="ad-tools"><input class="ad-filter" id="gFilter" type="search" placeholder="${esc(L('rafta süz…', 'filter the shelf…'))}" aria-label="${esc(L('Rafta süz', 'Filter the shelf'))}"></div>
        <ul class="ad-list tall" id="gLib"><li class="ad-empty">…</li></ul>
        <div class="ad-foot">${esc(L('⠿ sürükle = raftaki sıra · ★ = "şu an oynuyorum" rozeti (tek oyunda olur) · ✎ = her şeyi düzenle', '⠿ drag = order on the shelf · ★ = "now playing" badge (one game at a time) · ✎ = edit everything'))}</div>
      </section>
    </div>`;
    const $ = (s) => el.querySelector(s);
    const libEl = $('#gLib');
    const resEl = $('#gRes');
    let shelf = [];
    let results = [];
    let drawer = null;

    // ---------- raf ----------
    const rowHTML = (g, i) => `<li class="ad-row gm" data-id="${g.id}">
      <button type="button" class="ad-grip" data-drag data-sfx="none" aria-label="${esc(L('Sırayı değiştir', 'Reorder'))}: ${esc(g.name)}">⠿</button>
      <span class="ad-n">${pad(i + 1)}</span>
      <span class="ad-box" style="--c:${esc(g.color || '#AC3232')}">${boxOf(g) ? `<img src="${esc(boxOf(g))}" alt="" loading="lazy" data-fb="remove">` : `<b>${esc(g.name.charAt(0))}</b>`}</span>
      <span class="ad-tt"><b>${esc(g.name)}</b><small><span class="ad-st" data-st="${esc(g.status)}">${esc(t(`st.${g.status}`))}</span>${g.now_playing ? ` <span class="ad-now">★ ${esc(L('ŞU AN', 'NOW'))}</span>` : ''}${g.note ? ` <span class="ad-has-note" title="${esc(g.note)}">✎ ${esc(L('not', 'note'))}</span>` : ''} ${esc(String(g.released || '').slice(0, 4))}</small></span>
      <span class="ad-acts">
        <button type="button" class="${g.now_playing ? 'on' : ''}" data-now aria-pressed="${g.now_playing}" title="${esc(L('"Şu an oynuyorum" rozeti', '"Now playing" badge'))}" aria-label="${esc(L('Şu an oynuyorum', 'Now playing'))}: ${esc(g.name)}">★</button>
        <button type="button" data-edit title="${esc(L('Düzenle', 'Edit'))}" aria-label="${esc(L('Düzenle', 'Edit'))}: ${esc(g.name)}">✎</button>
        <button type="button" class="del" data-del data-sfx="none" title="${esc(L('Raftan kaldır', 'Remove'))}" aria-label="${esc(L('Raftan kaldır', 'Remove'))}: ${esc(g.name)}">✕</button>
      </span>
    </li>`;
    function renderShelf() {
      $('#gCount').textContent = `${shelf.length} ${L('OYUN', 'GAMES')}`;
      libEl.innerHTML = shelf.length ? shelf.map(rowHTML).join('') : `<li class="ad-empty">${esc(L('Raf boş. Soldan oyun ara ve ekle.', 'The shelf is empty. Search and add games on the left.'))}</li>`;
      applyFilter();
    }
    async function loadShelf() {
      const { data, error } = await sb.from('games').select('*').order('sort', { ascending: true }).order('created_at', { ascending: true });
      if (error) { libEl.innerHTML = `<li class="ad-err">${esc(error.message)}</li>`; return; }
      shelf = data || [];
      renderShelf();
    }
    function applyFilter() {
      const q = $('#gFilter').value.trim().toLocaleLowerCase('tr');
      libEl.dataset.locked = q ? '1' : '';
      libEl.querySelectorAll('[data-id]').forEach((li) => {
        const g = shelf.find((x) => String(x.id) === li.dataset.id);
        li.hidden = Boolean(q) && !`${g.name} ${(g.developers || []).join(' ')} ${(g.genres || []).join(' ')}`.toLocaleLowerCase('tr').includes(q);
      });
    }
    $('#gFilter').addEventListener('input', applyFilter);

    dragSort(libEl, async (ids, prev) => {
      shelf = ids.map((id) => shelf.find((g) => String(g.id) === id));
      libEl.querySelectorAll('.ad-n').forEach((n, i) => { n.textContent = pad(i + 1); });
      try {
        await saveOrder(sb, 'games', ids.map(Number), prev.map(Number));
        note(L('Raf sırası kaydedildi', 'Shelf order saved'), { type: 'ok' });
      } catch (err) { fail(err); loadShelf(); }
    });

    async function setNow(g, on) {
      if (on) {
        const r = await sb.from('games').update({ now_playing: false }).eq('now_playing', true);
        if (r.error) throw r.error;
      }
      const r = await sb.from('games').update({ now_playing: on }).eq('id', g.id);
      if (r.error) throw r.error;
      shelf.forEach((x) => { x.now_playing = on && x.id === g.id ? true : (on ? false : x.now_playing); });
      g.now_playing = on;
    }

    libEl.addEventListener('click', async (e) => {
      const li = e.target.closest('[data-id]');
      if (!li) return;
      const g = shelf.find((x) => String(x.id) === li.dataset.id);
      if (e.target.closest('[data-now]')) {
        try {
          await setNow(g, !g.now_playing);
          sfx(g.now_playing ? 'toggleOn' : 'toggleOff');
          note(g.now_playing ? L(`★ Şu an: ${g.name}`, `★ Now playing: ${g.name}`) : L('Rozet kaldırıldı', 'Badge removed'), { type: 'ok', sound: false });
          renderShelf();
        } catch (err) { fail(err); }
        return;
      }
      if (e.target.closest('[data-edit]')) { openDrawer(g, 'edit'); return; }
      if (e.target.closest('[data-del]')) {
        const at = shelf.indexOf(g);
        softDelete({
          label: `"${g.name}"`,
          hide: () => { shelf.splice(at, 1); renderShelf(); },
          restore: () => { shelf.splice(at, 0, g); renderShelf(); },
          commit: () => sb.from('games').delete().eq('id', g.id),
        });
      }
    });

    // ---------- arama ----------
    $('#gForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const q = $('#gQ').value.trim();
      if (!q) return;
      const hint = $('#gHint');
      hint.className = 'ad-hint busy'; hint.textContent = L('aranıyor…', 'searching…');
      const r = await callFn(sb, CONFIG.gameSearchFn, { q });
      if (!r.ok) {
        hint.className = 'ad-hint err';
        hint.textContent = `${L('Oyun araması çalışmadı ("game-search" + RAWG_KEY — README → Adım 6)', 'Game search failed ("game-search" + RAWG_KEY — README → Step 6)')}: ${r.msg}`;
        sfx('error');
        return;
      }
      results = r.data.results || [];
      hint.className = 'ad-hint';
      hint.textContent = L(`${results.length} sonuç — birine tıkla`, `${results.length} results — click one`);
      const owned = new Set(shelf.map((g) => g.rawg_id).filter(Boolean));
      resEl.innerHTML = results.map((x, i) => `<li class="ad-row res" data-i="${i}">
        ${artImg(x.cover, true)}
        <span class="ad-tt"><b>${esc(x.name)}</b><small>${esc([String(x.released || '').slice(0, 4), (x.platforms || []).slice(0, 3).join(', ')].filter(Boolean).join(' · '))}</small></span>
        <span class="ad-acts">${owned.has(x.id) ? `<button type="button" class="ok" disabled>✓ ${esc(L('RAFTA', 'SHELVED'))}</button>` : `<button type="button" class="add" data-pick>${esc(L('SEÇ', 'PICK'))} →</button>`}</span>
      </li>`).join('') || `<li class="ad-empty">${esc(L('Sonuç yok.', 'No results.'))}</li>`;
      hydrateArt(resEl);
    });
    resEl.addEventListener('click', async (e) => {
      const li = e.target.closest('[data-i]');
      if (!li || li.querySelector('.ok')) return;
      const x = results[Number(li.dataset.i)];
      resEl.querySelectorAll('.ad-row').forEach((r) => r.classList.toggle('sel', r === li));
      const hint = $('#gHint');
      hint.className = 'ad-hint busy'; hint.textContent = L(`${x.name}: detaylar çekiliyor…`, `${x.name}: fetching details…`);
      const r = await callFn(sb, CONFIG.gameSearchFn, { id: x.id });
      if (!r.ok) { hint.className = 'ad-hint err'; hint.textContent = r.msg; sfx('error'); return; }
      const d = r.data;
      hint.className = 'ad-hint'; hint.textContent = L('Çekmecede düzelt, sonra RAFA KOY.', 'Fix it in the drawer, then PUT ON SHELF.');
      const auto = await dominantColor(d.cover_url, '#AC3232');
      openDrawer({
        ...d, id: null, color: CART_COLORS.includes(auto) || DB32.includes(auto) ? auto : '#AC3232',
        status: 'oynadım', now_playing: false, note: '', box_url: d.box_url || steamBox(d),
      }, 'new');
    });

    // ---------- düzenleme çekmecesi ----------
    function openDrawer(g, mode) {
      closeDrawer(true);
      const draft = { ...g };
      const initial = JSON.stringify(draft);
      const wrap = document.createElement('div');
      wrap.className = 'ad-drawer';
      const field = (k, label, val, o = {}) => `<label class="ad-fld${o.full ? ' full' : ''}"><span>${esc(label)}</span><input data-f="${k}" value="${esc(val ?? '')}" ${o.type ? `type="${o.type}"` : ''} ${o.ph ? `placeholder="${esc(o.ph)}"` : ''} autocomplete="off" spellcheck="false"></label>`;
      wrap.innerHTML = `<div class="ad-drawer-box" role="dialog" aria-modal="true" aria-labelledby="gdT">
        <div class="ad-drawer-h"><b id="gdT">${esc(mode === 'new' ? L('RAFA YENİ OYUN', 'NEW GAME') : L('OYUNU DÜZENLE', 'EDIT GAME'))}</b><button type="button" class="ad-dlg-x" data-x data-sfx="close" aria-label="${esc(L('Kapat', 'Close'))}">✕</button></div>
        <div class="ad-drawer-b">
          <div class="ad-stage"><div class="ad-stage-case" id="gdCase"></div><small>${esc(L('RAFTA BÖYLE GÖRÜNECEK · ÜSTÜNE GEL', 'THIS IS HOW IT LOOKS ON THE SHELF · HOVER IT'))}</small></div>
          <div class="ad-form">
            ${field('name', L('AD', 'NAME'), draft.name, { full: true })}
            ${field('developers', L('GELİŞTİRİCİ', 'DEVELOPER'), (draft.developers || []).join(', '), { ph: L('virgülle ayır', 'comma separated') })}
            ${field('publishers', L('YAYINCI', 'PUBLISHER'), (draft.publishers || []).join(', '), { ph: L('virgülle ayır', 'comma separated') })}
            ${field('released', L('ÇIKIŞ TARİHİ', 'RELEASED'), draft.released || '', { type: 'date' })}
            ${field('metacritic', 'METACRITIC', draft.metacritic ?? '', { type: 'number' })}
            ${field('genres', L('TÜR', 'GENRE'), (draft.genres || []).join(', '), { full: true, ph: L('virgülle ayır', 'comma separated') })}
            ${field('platforms', 'PLATFORM', (draft.platforms || []).join(', '), { full: true, ph: 'PC, PlayStation…' })}
            <label class="ad-fld full"><span>${esc(L('KUTU KAPAĞI (DİKEY RESİM)', 'CASE COVER (PORTRAIT IMAGE)'))}</span>
              <span class="ad-inline"><input data-f="box_url" value="${esc(draft.box_url || '')}" placeholder="https://…" autocomplete="off" spellcheck="false">
              ${steamBox(draft) ? `<button type="button" class="ad-b sm" data-steam>STEAM</button>` : ''}<button type="button" class="ad-b sm" data-nobox title="${esc(L('Boş bırakır: Steam kapağı varsa o, yoksa tasarlanmış kapak görünür', 'Clears it: the Steam cover if there is one, otherwise a designed cover'))}">${esc(L('VARSAYILAN', 'DEFAULT'))}</button></span></label>
            ${field('cover_url', L('GENİŞ KAPAK (KUTUNUN ARKASI)', 'WIDE COVER (BACK OF THE CASE)'), draft.cover_url || '', { full: true, ph: 'https://…' })}
            ${field('store_url', L('MAĞAZA LİNKİ', 'STORE LINK'), draft.store_url || '', { full: true, ph: 'https://store.steampowered.com/app/…' })}
            <div class="ad-fld full"><span>${esc(L('DURUM', 'STATUS'))}</span><div class="ad-seg" role="radiogroup" aria-label="${esc(L('Durum', 'Status'))}">${STATUSES.map((s) => `<button type="button" role="radio" aria-checked="${s === draft.status}" data-st="${s}">${esc(t(`st.${s}`))}</button>`).join('')}</div></div>
            <div class="ad-fld full"><span>${esc(L('KUTU RENGİ', 'CASE COLOR'))}</span><div class="ad-sw" role="radiogroup" aria-label="${esc(L('Kutu rengi', 'Case color'))}">${[...new Set([...CART_COLORS, draft.color])].map((c) => `<button type="button" role="radio" aria-checked="${c === draft.color}" data-c="${c}" style="--sw:${c}" aria-label="${c}"></button>`).join('')}<button type="button" class="ad-b sm" data-auto title="${esc(L('Kapak resminden renk seç', 'Pick the color from the cover'))}">${esc(L('KAPAKTAN', 'FROM COVER'))}</button></div></div>
            <label class="ad-check full"><input type="checkbox" data-f="now_playing" ${draft.now_playing ? 'checked' : ''}><span>★ ${esc(L('"ŞU AN OYNUYORUM" ROZETİ (diğer oyundan kalkar)', '"NOW PLAYING" BADGE (removed from the other game)'))}</span></label>
            <label class="ad-fld full"><span>${esc(L('NOTUN (KUTUNUN ARKASINDA)', 'YOUR NOTE (BACK OF THE CASE)'))} <em data-cnt></em></span><textarea data-f="note" rows="3" maxlength="160" placeholder="${esc(L('isteğe bağlı', 'optional'))}">${esc(draft.note || '')}</textarea></label>
          </div>
        </div>
        <div class="ad-drawer-f"><span class="ad-hint err" id="gdErr"></span><button type="button" class="ad-b" data-x data-sfx="close">${esc(L('VAZGEÇ', 'CANCEL'))}</button><button type="button" class="ad-b acc" data-save data-sfx="none">${esc(mode === 'new' ? L('RAFA KOY', 'PUT ON SHELF') : L('KAYDET', 'SAVE'))} ↘</button></div>
      </div>`;
      // panelin köküne: sayfanın giriş animasyonu sabit konumlu çekmeceyi içine hapsetmesin
      (el.closest('.ad') || el).append(wrap);
      const box = wrap.querySelector('.ad-drawer-box');
      const read = () => {
        const f = (k) => wrap.querySelector(`[data-f="${k}"]`);
        Object.assign(draft, {
          name: f('name').value.trim(), developers: list(f('developers').value), publishers: list(f('publishers').value),
          released: f('released').value || null, metacritic: f('metacritic').value === '' ? null : Number(f('metacritic').value),
          genres: list(f('genres').value), platforms: list(f('platforms').value), box_url: f('box_url').value.trim(),
          cover_url: f('cover_url').value.trim(), store_url: f('store_url').value.trim(), now_playing: f('now_playing').checked,
          note: f('note').value.trim(),
        });
        wrap.querySelector('[data-cnt]').textContent = `${f('note').value.length}/160`;
      };
      let rt = 0;
      const paint = () => {
        clearTimeout(rt);
        rt = setTimeout(() => {
          read();
          wrap.querySelector('#gdCase').innerHTML = casePreviewHTML({ ...draft, name: draft.name || '?' });
        }, 90);
      };
      wrap.addEventListener('input', paint);
      wrap.addEventListener('change', paint);
      wrap.addEventListener('click', async (e) => {
        if (e.target === wrap || e.target.closest('[data-x]')) { closeDrawer(); return; }
        const st = e.target.closest('[data-st]');
        if (st) {
          draft.status = st.dataset.st;
          wrap.querySelectorAll('[data-st]').forEach((b) => b.setAttribute('aria-checked', String(b === st)));
          if (draft.status === 'oynuyorum') wrap.querySelector('[data-f="now_playing"]').checked = true;
          paint(); return;
        }
        const c = e.target.closest('[data-c]');
        if (c) { draft.color = c.dataset.c; wrap.querySelectorAll('[data-c]').forEach((b) => b.setAttribute('aria-checked', String(b === c))); paint(); return; }
        if (e.target.closest('[data-steam]')) { wrap.querySelector('[data-f="box_url"]').value = steamBox(draft); paint(); return; }
        if (e.target.closest('[data-nobox]')) { wrap.querySelector('[data-f="box_url"]').value = ''; paint(); return; }
        if (e.target.closest('[data-auto]')) {
          const src = wrap.querySelector('[data-f="box_url"]').value.trim() || wrap.querySelector('[data-f="cover_url"]').value.trim();
          const col = await dominantColor(src, draft.color);
          const pick = wrap.querySelector(`[data-c="${col}"]`);
          if (pick) pick.click(); else note(L('Kapaktan renk okunamadı', 'Could not read a color from the cover'));
          return;
        }
        if (e.target.closest('[data-save]')) save(e.target.closest('[data-save]'));
      });
      box.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') trapTab(e, box);
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(wrap.querySelector('[data-save]')); }
      });

      async function save(btn) {
        read();
        const err = wrap.querySelector('#gdErr');
        const bad = !draft.name ? L('Ad boş olamaz', 'Name is required')
          : ['box_url', 'cover_url', 'store_url'].find((k) => !isUrl(draft[k])) ? L('Linkler https:// ile başlamalı', 'Links must start with https://')
            : (draft.metacritic != null && !(draft.metacritic >= 0 && draft.metacritic <= 100)) ? L('Metacritic 0–100 arası olmalı', 'Metacritic must be 0–100')
              : '';
        if (bad) { err.textContent = bad; sfx('error'); return; }
        err.textContent = '';
        btn.disabled = true;
        const row = {
          name: draft.name, developers: draft.developers, publishers: draft.publishers, released: draft.released || null,
          genres: draft.genres, platforms: draft.platforms, metacritic: draft.metacritic != null ? Math.round(draft.metacritic) : null,
          cover_url: draft.cover_url, store_url: draft.store_url, box_url: draft.box_url, color: draft.color,
          status: draft.status, note: draft.note || null,
        };
        try {
          if (draft.now_playing && !g.now_playing) { const r = await sb.from('games').update({ now_playing: false }).eq('now_playing', true); if (r.error) throw r.error; }
          if (mode === 'new') {
            const { data, error } = await sb.from('games').insert({ ...row, steam_appid: draft.steam_appid || null, rawg_id: draft.rawg_id || null, now_playing: draft.now_playing, sort: shelf.length }).select('*').single();
            if (error) throw error;
            shelf.forEach((x) => { if (draft.now_playing) x.now_playing = false; });
            shelf.push(data);
            note(L(`Rafa kondu: ${draft.name}`, `On the shelf: ${draft.name}`), { type: 'ok' });
            resEl.querySelector('.sel .ad-acts')?.replaceChildren(Object.assign(document.createElement('button'), { className: 'ok', disabled: true, textContent: `✓ ${L('RAFTA', 'SHELVED')}` }));
          } else {
            const { error } = await sb.from('games').update({ ...row, now_playing: draft.now_playing }).eq('id', g.id);
            if (error) throw error;
            shelf.forEach((x) => { if (draft.now_playing && x.id !== g.id) x.now_playing = false; });
            Object.assign(g, row, { now_playing: draft.now_playing });
            note(L(`Kaydedildi: ${draft.name}`, `Saved: ${draft.name}`), { type: 'ok' });
          }
          drawer = null;
          wrap.remove();
          renderShelf();
          const id = mode === 'new' ? shelf[shelf.length - 1].id : g.id;
          const li = libEl.querySelector(`[data-id="${id}"]`);
          li?.classList.add('flash');
          li?.scrollIntoView({ block: 'nearest' });
          ctx.refreshBadges();
        } catch (e2) {
          btn.disabled = false;
          err.textContent = (e2.message || String(e2)) + migNote(e2.message);
          sfx('error');
        }
      }

      drawer = { wrap, dirty: () => { read(); return JSON.stringify(draft) !== initial; } };
      wrap.querySelector('#gdCase').innerHTML = casePreviewHTML(draft);
      wrap.querySelector('[data-cnt]').textContent = `${(draft.note || '').length}/160`;
      sfx('slide');
      requestAnimationFrame(() => wrap.querySelector('[data-f="name"]').focus());
    }

    async function closeDrawer(force = false) {
      if (!drawer) return;
      if (!force && drawer.dirty() && !(await ask({ title: L('DEĞİŞİKLİKLER KAYBOLACAK', 'DISCARD CHANGES?'), text: L('Çekmecedeki değişiklikler kaydedilmedi. Kapatılsın mı?', 'The changes in the drawer are not saved. Close it?'), ok: L('KAPAT', 'CLOSE'), danger: true }))) return;
      drawer.wrap.remove();
      drawer = null;
    }

    await loadShelf();
    $('#gQ').focus();
    return {
      focusSearch: () => $('#gQ').focus(),
      escape: () => { if (drawer) { closeDrawer(); return true; } return false; },
      dirty: () => Boolean(drawer?.dirty()),
      unmount: () => { drawer?.wrap.remove(); drawer = null; },
    };
  },
};
