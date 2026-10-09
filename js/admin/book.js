// KONTROL ODASI — 05 DEFTER: notları oku, ara, tek tek ya da topluca sil. Yeni notlar canlı düşer.
import { esc, hashStr } from '../util.js';
import { L, sfx, softDelete, when, ago, num } from './ui.js';

const PAGE = 60;
const PAPER = ['#FBF236', '#5FCDE4', '#FFFFFF', '#D77BBA', '#99E550', '#DF7126'];

export default {
  key: 'book',
  icon: 'chat',
  label: () => L('DEFTER', 'GUESTBOOK'),
  sub: () => L('Ziyaretçi notları. Kart seç → topluca sil; ✕ tek notu siler (8 sn içinde geri alınabilir).', 'Visitor notes. Select cards → delete in bulk; ✕ removes one (undo within 8 s).'),
  async mount(el, ctx) {
    const { sb } = ctx;
    el.innerHTML = `<section class="ad-card">
      <div class="ad-tools wrap">
        <label class="ad-check"><input type="checkbox" id="bAll"><span>${esc(L('TÜMÜNÜ SEÇ', 'SELECT ALL'))}</span></label>
        <input class="ad-filter" id="bFilter" type="search" placeholder="${esc(L('notlarda ya da adlarda ara…', 'search notes or names…'))}" aria-label="${esc(L('Notlarda ara', 'Search notes'))}">
        <span class="ad-hint" id="bInfo"></span>
        <span class="ad-sp"></span>
        <button type="button" class="ad-b sm red" id="bDel" disabled data-sfx="none">${esc(L('SEÇİLİLERİ SİL', 'DELETE SELECTED'))}</button>
      </div>
      <ul class="ad-notegrid" id="bList"><li class="ad-empty">…</li></ul>
      <div class="ad-more" id="bMoreW" hidden><button type="button" class="ad-b" id="bMore">${esc(L('DAHA FAZLA', 'MORE'))}</button></div>
    </section>`;
    const $ = (s) => el.querySelector(s);
    let notes = [];
    let total = 0;
    const sel = new Set();
    const fresh = new Set();

    const card = (n) => {
      const h = hashStr(String(n.id));
      return `<li class="ad-gb${sel.has(n.id) ? ' sel' : ''}${fresh.has(n.id) ? ' fresh' : ''}" data-id="${esc(n.id)}" style="--note:${PAPER[h % PAPER.length]};--rot:${((h >> 4) % 5) - 2}deg">
        <label class="ad-gb-pick"><input type="checkbox" data-pick ${sel.has(n.id) ? 'checked' : ''} aria-label="${esc(L('Seç', 'Select'))}: ${esc(n.message.slice(0, 40))}"></label>
        ${fresh.has(n.id) ? `<em class="ad-gb-new">${esc(L('YENİ', 'NEW'))}</em>` : ''}
        <p class="ad-gb-msg">${esc(n.message)}</p>
        <p class="ad-gb-by">— ${esc(n.name)} · <span title="${esc(when(n.created_at))}">${esc(ago(n.created_at))}</span></p>
        <button type="button" class="ad-gb-x" data-del data-sfx="none" aria-label="${esc(L('Sil', 'Delete'))}">✕</button>
      </li>`;
    };
    function render() {
      const q = $('#bFilter').value.trim().toLocaleLowerCase('tr');
      const list = q ? notes.filter((n) => `${n.message} ${n.name}`.toLocaleLowerCase('tr').includes(q)) : notes;
      $('#bList').innerHTML = list.map(card).join('') || `<li class="ad-empty">${esc(notes.length ? L('Eşleşen not yok.', 'No matching notes.') : L('Defter boş.', 'The guestbook is empty.'))}</li>`;
      $('#bInfo').textContent = `${num(total)} ${L('NOT', 'NOTES')}${q ? ` · ${list.length} ${L('EŞLEŞME', 'MATCHES')}${notes.length < total ? L(' (yüklenenler içinde)', ' (among loaded)') : ''}` : ''}`;
      $('#bMoreW').hidden = notes.length >= total;
      tools();
    }
    function tools() {
      $('#bDel').disabled = !sel.size;
      $('#bDel').textContent = sel.size ? L(`SEÇİLİ ${sel.size} NOTU SİL`, `DELETE ${sel.size} SELECTED`) : L('SEÇİLİLERİ SİL', 'DELETE SELECTED');
      $('#bAll').checked = Boolean(notes.length) && sel.size === notes.length;
      $('#bAll').indeterminate = sel.size > 0 && sel.size < notes.length;
    }
    async function load(more = false) {
      const from = more ? notes.length : 0;
      const { data, count, error } = await sb.from('guestbook').select('id,name,message,created_at', { count: 'exact' }).order('created_at', { ascending: false }).range(from, from + PAGE - 1);
      if (error) { $('#bList').innerHTML = `<li class="ad-err">${esc(error.message)}</li>`; return; }
      notes = more ? notes.concat(data || []) : (data || []);
      total = count ?? notes.length;
      render();
    }
    function remove(ids) {
      const gone = notes.filter((n) => ids.includes(n.id));
      const before = notes.slice();
      softDelete({
        label: ids.length === 1 ? L('Not', 'Note') : L(`${ids.length} not`, `${ids.length} notes`),
        hide: () => { notes = notes.filter((n) => !ids.includes(n.id)); total -= gone.length; ids.forEach((id) => sel.delete(id)); render(); },
        restore: () => { notes = before; total += gone.length; render(); },
        commit: async () => {
          for (let i = 0; i < ids.length; i += 100) {
            const r = await sb.from('guestbook').delete().in('id', ids.slice(i, i + 100)); // eslint-disable-line no-await-in-loop
            if (r.error) return r;
          }
          ctx.refreshBadges();
          return { error: null };
        },
      });
    }

    el.addEventListener('click', (e) => {
      const li = e.target.closest('[data-id]');
      if (li && e.target.closest('[data-del]')) { remove([li.dataset.id]); return; }
      if (e.target.closest('#bMore')) { load(true); return; }
      if (e.target.closest('#bDel') && sel.size) remove([...sel]);
    });
    el.addEventListener('change', (e) => {
      if (e.target.id === 'bAll') {
        if (e.target.checked) notes.forEach((n) => sel.add(n.id)); else sel.clear();
        sfx('select');
        render();
        return;
      }
      const li = e.target.closest('[data-id]');
      if (li && e.target.matches('[data-pick]')) {
        if (e.target.checked) sel.add(li.dataset.id); else sel.delete(li.dataset.id);
        li.classList.toggle('sel', e.target.checked);
        tools();
      }
    });
    $('#bFilter').addEventListener('input', render);

    await load();
    return {
      focusSearch: () => $('#bFilter').focus(),
      escape: () => { if (sel.size) { sel.clear(); render(); return true; } return false; },
      live(table, type, row) {
        if (table !== 'guestbook') return;
        if (type === 'INSERT' && row?.id && !notes.some((n) => n.id === row.id)) {
          notes.unshift(row); total++; fresh.add(row.id);
          render();
          sfx('twinkle');
        }
        if (type === 'DELETE' && row?.id && notes.some((n) => n.id === row.id)) {
          notes = notes.filter((n) => n.id !== row.id); total--; sel.delete(row.id);
          render();
        }
      },
    };
  },
};
