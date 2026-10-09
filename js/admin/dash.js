// KONTROL ODASI — 00 PANO: sayılar, yapılacaklar, son hareketler, sistem durumu.
import { esc } from '../util.js';
import { spriteSVG } from '../sprites.js';
import { L, sfx, num, ago, ask, note, fail } from './ui.js';
import { summary, callFn, DAY, OLD_WEEKS } from './data.js';

export default {
  key: 'dash',
  icon: 'term',
  label: () => L('PANO', 'DASHBOARD'),
  sub: () => L('Odanın genel durumu: sayılar, yapılacaklar, son hareketler.', 'The state of the room: numbers, to-dos, latest activity.'),
  async mount(el, ctx) {
    const { sb } = ctx;
    el.innerHTML = `<div class="ad-dash">
      <section class="ad-tiles" id="dTiles">${Array.from({ length: 6 }, () => '<div class="ad-tile sk"></div>').join('')}</section>
      <div class="ad-dash-cols">
        <section class="ad-card"><div class="ad-card-h"><b>${esc(L('YAPILACAKLAR', 'TO-DO'))}</b><span id="dTodoN"></span></div><ul class="ad-todo" id="dTodo"><li class="ad-empty">…</li></ul></section>
        <section class="ad-card"><div class="ad-card-h"><b>${esc(L('SON HAREKETLER', 'LATEST ACTIVITY'))}</b><span>${esc(L('SON 7 GÜN', 'LAST 7 DAYS'))}</span></div><ul class="ad-feed" id="dFeed"><li class="ad-empty">…</li></ul></section>
        <section class="ad-card"><div class="ad-card-h"><b>${esc(L('SİSTEM', 'SYSTEM'))}</b><button type="button" class="ad-b sm" id="dRecheck">${esc(L('YENİDEN KONTROL', 'RECHECK'))} ↻</button></div><ul class="ad-sys" id="dSys"></ul></section>
      </div>
    </div>`;
    let alive = true;

    function tiles(s) {
      const t = (go, icon, n, label, sub, tone = '') => `<button type="button" class="ad-tile ${tone}" data-go="${go}" data-sfx="none">
        <span class="ad-tile-ico">${spriteSVG(icon, 3)}</span><b${String(n).length > 6 ? ' class="long"' : ''}>${esc(n)}</b><span class="ad-tile-l">${esc(label)}</span><small>${esc(sub)}</small></button>`;
      el.querySelector('#dTiles').innerHTML = [
        t('music', 'note', num(s.tracks), L('ŞARKI', 'SONGS'), `${L('ÖNİZLEME', 'PREVIEW')} ${s.previews}/${s.tracks}`, s.previewTodo ? 'warn' : ''),
        t('games', 'pad', num(s.games), L('OYUN', 'GAMES'), s.nowPlaying ? `${L('ŞU AN', 'NOW')}: ${s.nowPlaying}` : L('şu an oynanan yok', 'nothing playing')),
        t('skills', 'sparkle', `${s.rated}/${s.skills}`, L('YETENEK', 'SKILLS'), L(`${s.skills - s.rated} puansız (gizli)`, `${s.skills - s.rated} unrated (hidden)`)),
        t('wall', 'spray', num(s.wall), L('DUVAR ÇİZGİSİ', 'WALL STROKES'), L(`son 24 sa: ${s.wallDay}`, `last 24h: ${s.wallDay}`)),
        t('book', 'chat', num(s.notes), L('DEFTER NOTU', 'GUESTBOOK NOTES'), L(`son 24 sa: ${s.notesDay}`, `last 24h: ${s.notesDay}`), s.notesDay ? 'new' : ''),
        t('scores', 'trophy', s.top ? num(s.top.score) : '—', L('REKOR', 'HIGH SCORE'), s.top ? `${s.top.name} · ${s.top.rank}${s.suspicious ? ` · ⚠ ${s.suspicious}` : ''}` : L('henüz skor yok', 'no scores yet'), s.suspicious ? 'warn' : ''),
      ].join('');
    }

    function todos(s) {
      const items = [];
      if (s.previewTodo) items.push({ tone: 'warn', go: 'music', text: L(`${s.previewTodo} şarkının 30 sn önizlemesi alınmamış`, `${s.previewTodo} songs have no 30-sec preview yet`), act: L('GETİR', 'FETCH') });
      if (s.wallOld) items.push({ tone: 'bad', id: 'old', text: L(`${s.wallOld} duvar çizgisi ${OLD_WEEKS} haftadan eski — gizlilik politikası bunların silineceğini söylüyor`, `${s.wallOld} wall strokes are older than ${OLD_WEEKS} weeks — the privacy policy promises to delete them`), act: L('ŞİMDİ SİL', 'DELETE NOW') });
      if (s.suspicious) items.push({ tone: 'warn', go: 'scores', text: L(`${s.suspicious} skor şüpheli görünüyor`, `${s.suspicious} scores look suspicious`), act: L('BAK', 'REVIEW') });
      if (s.noBox) items.push({ go: 'games', text: L(`${s.noBox} oyunun kutu kapağı yok (tasarlanmış kapak kullanılıyor)`, `${s.noBox} games have no case cover (using a designed one)`), act: L('KAPAK SEÇ', 'PICK COVERS') });
      if (s.skills - s.rated) items.push({ go: 'skills', text: L(`${s.skills - s.rated} yetenek puansız, sitede görünmüyor`, `${s.skills - s.rated} skills are unrated and hidden on the site`), act: L('PUANLA', 'RATE') });
      if (!s.nowPlaying && s.games) items.push({ go: 'games', text: L('"Şu an oynuyorum" rozeti hiçbir oyunda yok', 'No game has the "now playing" badge'), act: L('SEÇ', 'PICK') });
      el.querySelector('#dTodoN').textContent = items.length ? String(items.length) : '✓';
      el.querySelector('#dTodo').innerHTML = items.length
        ? items.map((x) => `<li class="${x.tone || ''}"><span>${esc(x.text)}</span><button type="button" class="ad-b sm" ${x.go ? `data-go="${x.go}"` : `data-act="${x.id}"`}>${esc(x.act)} →</button></li>`).join('')
        : `<li class="ad-ok">${spriteSVG('sparkle', 2)} ${esc(L('Her şey yolunda. Yapılacak bir şey yok.', 'All good. Nothing to do.'))}</li>`;
    }

    async function feed() {
      const weekAgo = new Date(Date.now() - 7 * DAY).toISOString();
      const [gb, sc, wl] = await Promise.all([
        sb.from('guestbook').select('id,name,message,created_at').gte('created_at', weekAgo).order('created_at', { ascending: false }).limit(8),
        sb.from('scores').select('id,name,score,rank,created_at').gte('created_at', weekAgo).order('created_at', { ascending: false }).limit(8),
        sb.from('wall_strokes').select('id,client_id,created_at').gte('created_at', weekAgo).order('created_at', { ascending: false }).limit(400),
      ]);
      // duvar: aynı kişinin bir saat içindeki çizgileri tek satır
      const sessions = [];
      (wl.data || []).forEach((w) => {
        const last = sessions.find((x) => x.cid === w.client_id && Date.parse(x.from) - Date.parse(w.created_at) < 3600e3);
        if (last) { last.n++; last.from = w.created_at; } else sessions.push({ cid: w.client_id, n: 1, at: w.created_at, from: w.created_at });
      });
      const items = [
        ...(gb.data || []).map((n) => ({ at: n.created_at, icon: 'chat', go: 'book', html: `<b>${esc(n.name)}</b> ${esc(L('deftere yazdı', 'signed the guestbook'))}: <q>${esc(n.message)}</q>` })),
        ...(sc.data || []).map((s) => ({ at: s.created_at, icon: 'trophy', go: 'scores', html: `<b>${esc(s.name)}</b> ${esc(L('skor yaptı', 'scored'))}: ${esc(num(s.score))} · ${esc(s.rank)}` })),
        ...sessions.map((w) => ({ at: w.at, icon: 'spray', go: 'wall', html: `${esc(L('Ziyaretçi', 'Visitor'))} <code>${esc(String(w.cid || '?').slice(0, 4))}</code> ${esc(L(`duvara ${w.n} çizgi çekti`, `drew ${w.n} strokes on the wall`))}` })),
      ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 12);
      if (!alive) return;
      el.querySelector('#dFeed').innerHTML = items.length
        ? items.map((x) => `<li><span class="ad-feed-ico">${spriteSVG(x.icon, 2)}</span><span class="ad-feed-t">${x.html}</span><button type="button" class="ad-feed-at" data-go="${x.go}" title="${esc(new Date(x.at).toLocaleString())}">${esc(ago(x.at))}</button></li>`).join('')
        : `<li class="ad-empty">${esc(L('Bu hafta sessiz geçti.', 'A quiet week.'))}</li>`;
    }

    // Sağlık: veritabanı, canlı bağlantı, Edge Function'lar (boş istek: yayındaysa "eksik parametre" der)
    async function system() {
      const box = el.querySelector('#dSys');
      const row = (state, title, detail) => `<li class="${state}"><i aria-hidden="true"></i><b>${esc(title)}</b><span>${esc(detail)}</span></li>`;
      box.innerHTML = row('wait', 'SUPABASE', '…') + row('wait', L('CANLI BAĞLANTI', 'REALTIME'), '…') + row('wait', 'spotify', '…') + row('wait', 'game-search', '…');
      const t0 = performance.now();
      const db = await sb.from('tracks').select('id', { count: 'exact', head: true });
      const dbMs = Math.round(performance.now() - t0);
      const [sp, gs] = await Promise.all([callFn(sb, 'spotify', {}), callFn(sb, 'game-search', {})]);
      if (!alive) return;
      const fnState = (r) => {
        if (r.status === 400) return ['ok', `${L('yayında', 'deployed')} · ${r.ms} ms`];
        if (r.status === 401 || r.status === 403) return ['bad', L('yetki reddedildi — oturumu yenile', 'access denied — sign in again')];
        if (/RAWG_KEY/.test(r.msg)) return ['warn', L('RAWG_KEY tanımlı değil (README → Adım 6)', 'RAWG_KEY is not set (README → Step 6)')];
        if (r.status === 404 || !r.status) return ['bad', L('yayında değil ya da ulaşılamıyor (README)', 'not deployed or unreachable (README)')];
        return ['warn', `${r.status}: ${r.msg}`.slice(0, 90)];
      };
      const fnRow = (r, name) => { const [st, msg] = fnState(r); return row(st, name, msg); };
      box.innerHTML = [
        row(db.error ? 'bad' : 'ok', 'SUPABASE', db.error ? db.error.message : `${L('veritabanı', 'database')} · ${dbMs} ms`),
        row(ctx.isLive() ? 'ok' : 'warn', L('CANLI BAĞLANTI', 'REALTIME'), ctx.isLive() ? L('yeni notlar ve çizgiler anında düşer', 'new notes and strokes arrive instantly') : L('bağlı değil — sayfalar elle yenilenir', 'not connected — pages refresh manually')),
        fnRow(sp, 'spotify'),
        fnRow(gs, 'game-search'),
      ].join('')
        + `<li class="ad-sys-x"><button type="button" class="ad-b sm" id="dSpTest">${esc(L('SPOTIFY ARAMASINI DENE', 'TEST SPOTIFY SEARCH'))}</button><span id="dSpRes"></span></li>`;
    }

    function fill(s) {
      if (!alive || !s) return;
      tiles(s);
      todos(s);
    }

    el.addEventListener('click', async (e) => {
      const g = e.target.closest('[data-go]');
      if (g) { ctx.go(g.dataset.go); return; }
      if (e.target.closest('#dRecheck')) { sfx('select'); system(); return; }
      if (e.target.closest('#dSpTest')) {
        const out = el.querySelector('#dSpRes');
        out.textContent = '…';
        const r = await callFn(sb, 'spotify', { q: 'star' });
        out.textContent = r.data?.error === 'no_credentials'
          ? L('anahtar yok: arama kapalı, link yapıştırma çalışır', 'no keys: search is off, pasting links works')
          : r.ok ? L(`çalışıyor ✓ (${r.data?.results?.length || 0} sonuç)`, `works ✓ (${r.data?.results?.length || 0} results)`) : `✕ ${r.msg}`;
        return;
      }
      if (e.target.closest('[data-act="old"]')) {
        const old = new Date(Date.now() - OLD_WEEKS * 7 * DAY).toISOString();
        if (!(await ask({ title: L('ESKİ ÇİZGİLERİ SİL', 'DELETE OLD STROKES'), text: L(`${OLD_WEEKS} haftadan eski tüm duvar çizgileri kalıcı olarak silinecek. Arşivde de görünmezler.`, `All wall strokes older than ${OLD_WEEKS} weeks will be permanently deleted, including from the archive.`), ok: L('SİL', 'DELETE'), danger: true }))) return;
        const { error } = await sb.from('wall_strokes').delete().lt('created_at', old);
        if (error) { fail(error); return; }
        note(L('Eski çizgiler silindi', 'Old strokes deleted'), { type: 'ok' });
        ctx.refreshBadges();
      }
    });

    fill(ctx.summary() || await summary(sb).catch((err) => { el.querySelector('#dTiles').innerHTML = `<div class="ad-err">${esc(err.message || err)}</div>`; return null; }));
    feed();
    system();
    return {
      summary: fill,
      live: () => feed(),
      unmount() { alive = false; },
    };
  },
};
