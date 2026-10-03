import { getSupabase } from '../supabase.js';
import { $, esc, store, cleanText, hashStr, uuid, toast, API } from '../util.js';
import { t, onLang } from '../i18n.js';

const COLORS = ['#FBF236', '#5FCDE4', '#FFFFFF', '#D77BBA', '#99E550', '#DF7126'];
const PAGE = 9;
const LOCAL_KEY = 'star.gb.local';

function ago(iso) {
  const s = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return t('gb.ago.s', { n: s });
  if (s < 3600) return t('gb.ago.m', { n: Math.floor(s / 60) });
  if (s < 86400) return t('gb.ago.h', { n: Math.floor(s / 3600) });
  return t('gb.ago.d', { n: Math.floor(s / 86400) });
}

export async function initGuestbook() {
  const form = $('#gbForm');
  const box = $('#gbNotes');
  const status = $('#gbStatus');
  if (!form) return;

  // bot tuzağı: gerçek kullanıcı görmez
  const trap = document.createElement('input');
  trap.name = 'website'; trap.tabIndex = -1; trap.autocomplete = 'off'; trap.setAttribute('aria-hidden', 'true');
  trap.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px';
  form.append(trap);

  let sb = null;
  let notes = [];
  let total = 0;

  function noteHTML(n, k = 0) {
    const hsh = hashStr(String(n.id));
    const bg = COLORS[hsh % COLORS.length];
    const rot = ((hsh >> 4) % 9) - 4;
    const isTerm = n.message.startsWith('>');
    return `<div class="note rv" data-rv="slap" data-d data-id="${esc(n.id)}" style="--i:${k};background:${bg};transform:rotate(${rot}deg)">
      <p class="${isTerm ? 'term' : 'hand'}" style="${isTerm ? 'font-size:24px;line-height:1.1' : ''}">${esc(n.message)}</p>
      <p class="px">— ${esc(n.name.toUpperCase())} · <span data-ts="${esc(n.created_at)}">${esc(ago(n.created_at))}</span></p></div>`;
  }

  function render() {
    if (!notes.length) { box.innerHTML = `<p class="empty-note" style="grid-column:1/-1">${esc(t('gb.empty'))}</p>`; return; }
    const more = total - notes.length;
    box.innerHTML = notes.map((n, k) => noteHTML(n, k)).join('') + (more > 0 ? `<button type="button" class="note-more" id="gbMore">${t('gb.more', { n: more })}</button>` : '');
  }

  async function load(append = false) {
    if (sb) {
      const from = append ? notes.length : 0;
      const { data, count, error } = await sb.from('guestbook').select('id,name,message,created_at', { count: 'exact' }).order('created_at', { ascending: false }).range(from, from + PAGE - 1);
      if (error) { console.warn('[guestbook]', error); return; }
      notes = append ? notes.concat(data) : data;
      total = count ?? notes.length;
    } else {
      const all = store.get(LOCAL_KEY, []).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
      const n = append ? notes.length + PAGE : PAGE;
      notes = all.slice(0, n);
      total = all.length;
    }
    render();
  }

  box.addEventListener('click', (e) => { if (e.target.closest('#gbMore')) load(true); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (trap.value) return;
    const last = store.get('star.gb.last', 0);
    if (Date.now() - last < 30000) { status.textContent = t('wl.slow'); return; }
    const name = cleanText($('#gbName').value).slice(0, 24) || 'anon';
    const message = cleanText($('#gbMsg').value).slice(0, 140);
    if (!message) return;
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      if (sb) {
        const row = { id: uuid(), name, message };
        const { error } = await sb.from('guestbook').insert(row);
        if (error) throw error;
        if (!notes.some((n) => n.id === row.id)) { notes.unshift({ ...row, created_at: new Date().toISOString() }); total++; }
      } else {
        const row = { id: uuid(), name, message, created_at: new Date().toISOString() };
        const all = store.get(LOCAL_KEY, []);
        all.push(row);
        store.set(LOCAL_KEY, all.slice(-100));
        notes.unshift(row); total++;
        toast(t('gb.local'));
      }
      store.set('star.gb.last', Date.now());
      $('#gbMsg').value = '';
      status.textContent = t('gb.sent');
      render();
    } catch (err) {
      console.warn('[guestbook]', err);
      status.textContent = t('gb.err');
    } finally {
      btn.disabled = false;
    }
  });

  sb = await getSupabase();
  await load();
  if (sb) {
    sb.channel('guestbook')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'guestbook' }, ({ new: row }) => {
        if (notes.some((n) => n.id === row.id)) return;
        notes.unshift(row); total++;
        render();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'guestbook' }, ({ old }) => {
        notes = notes.filter((n) => n.id !== old.id); total = Math.max(0, total - 1);
        render();
      })
      .subscribe();
  }
  onLang(render);
  // zaman etiketlerini yenile (notları yeniden çizmeden, animasyonlar baştan oynamasın)
  setInterval(() => box.querySelectorAll('[data-ts]').forEach((el) => { el.textContent = ago(el.dataset.ts); }), 60000);
  API.guestbook = { count: () => total };
}
