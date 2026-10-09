// KONTROL ODASI — 06 SKORLAR: "Sayfayı Yok Et" skor tablosu. Şüpheli skorlar işaretlenir; tek tek ya da topluca silinir.
import { esc } from '../util.js';
import { L, sfx, softDelete, when, num } from './ui.js';
import { flagScores } from './data.js';

const dur = (s) => (s > 0 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '—');

export default {
  key: 'scores',
  icon: 'trophy',
  label: () => L('SKORLAR', 'SCORES'),
  sub: () => L('"Sayfayı Yok Et" skor tablosunun ilk 100\'ü. ⚠ işaretliler hile gibi duruyor (çok kısa süre ya da saniyede anormal puan).', 'The top 100 of the "Destroy the Page" leaderboard. ⚠ marks look like cheats (very short runs or abnormal points per second).'),
  async mount(el, ctx) {
    const { sb } = ctx;
    el.innerHTML = `<section class="ko-card">
      <div class="ko-tools wrap">
        <label class="ko-check"><input type="checkbox" id="cAll"><span>${esc(L('TÜMÜNÜ SEÇ', 'SELECT ALL'))}</span></label>
        <label class="ko-check warn"><input type="checkbox" id="cSus"><span id="cSusL"></span></label>
        <span class="ko-sp"></span>
        <button type="button" class="ko-b sm" id="cPickSus">${esc(L('ŞÜPHELİLERİ SEÇ', 'SELECT SUSPICIOUS'))}</button>
        <button type="button" class="ko-b sm red" id="cDel" disabled data-sfx="none">${esc(L('SEÇİLİLERİ SİL', 'DELETE SELECTED'))}</button>
      </div>
      <div class="ko-tablewrap"><table class="ko-table">
        <thead><tr><th></th><th>#</th><th>${esc(L('AD', 'NAME'))}</th><th class="r">${esc(L('SKOR', 'SCORE'))}</th><th>${esc(L('RÜTBE', 'RANK'))}</th><th class="r">${esc(L('YIKIM', 'DESTR.'))}</th><th class="r">${esc(L('KOMBO', 'COMBO'))}</th><th class="r">${esc(L('SÜRE', 'TIME'))}</th><th class="r">${esc(L('PUAN/SN', 'PTS/S'))}</th><th>${esc(L('TARİH', 'DATE'))}</th><th></th></tr></thead>
        <tbody id="cBody"><tr><td colspan="11" class="ko-empty">…</td></tr></tbody>
      </table></div>
    </section>`;
    const $ = (s) => el.querySelector(s);
    let rows = [];
    let flags = new Map();
    const sel = new Set();

    function render() {
      const only = $('#cSus').checked;
      $('#cSusL').textContent = L(`SADECE ŞÜPHELİLER (${flags.size})`, `SUSPICIOUS ONLY (${flags.size})`);
      $('#cPickSus').disabled = !flags.size;
      const list = only ? rows.filter((r) => flags.has(r.id)) : rows;
      $('#cBody').innerHTML = list.map((r) => {
        const i = rows.indexOf(r);
        const f = flags.get(r.id);
        return `<tr data-id="${r.id}" class="${sel.has(r.id) ? 'sel' : ''}${f ? ' sus' : ''}">
          <td><input type="checkbox" data-pick ${sel.has(r.id) ? 'checked' : ''} aria-label="${esc(L('Seç', 'Select'))}: ${esc(r.name)}"></td>
          <td class="ko-n">${i < 3 ? ['①', '②', '③'][i] : i + 1}</td>
          <td><b class="ko-arc">${esc(r.name)}</b>${f ? ` <span class="ko-flag" title="${esc(f)}">⚠ ${esc(f)}</span>` : ''}</td>
          <td class="r"><b>${num(r.score)}</b></td>
          <td><span class="ko-rank r-${esc(String(r.rank).replace(/\W/g, ''))}">${esc(r.rank)}</span></td>
          <td class="r">${r.destruction != null ? `${r.destruction}%` : '—'}</td>
          <td class="r">${r.best_combo != null ? `×${r.best_combo}` : '—'}</td>
          <td class="r">${dur(r.duration_s)}</td>
          <td class="r">${r.duration_s > 0 ? num(Math.round(r.score / r.duration_s)) : '—'}</td>
          <td>${esc(when(r.created_at))}</td>
          <td><button type="button" class="ko-x" data-del data-sfx="none" aria-label="${esc(L('Sil', 'Delete'))}: ${esc(r.name)}">✕</button></td>
        </tr>`;
      }).join('') || `<tr><td colspan="11" class="ko-empty">${esc(rows.length ? L('Şüpheli skor yok ✓', 'No suspicious scores ✓') : L('Henüz skor yok.', 'No scores yet.'))}</td></tr>`;
      tools();
    }
    function tools() {
      $('#cDel').disabled = !sel.size;
      $('#cDel').textContent = sel.size ? L(`SEÇİLİ ${sel.size} SKORU SİL`, `DELETE ${sel.size} SELECTED`) : L('SEÇİLİLERİ SİL', 'DELETE SELECTED');
      $('#cAll').checked = Boolean(rows.length) && sel.size === rows.length;
      $('#cAll').indeterminate = sel.size > 0 && sel.size < rows.length;
    }
    async function load() {
      const { data, error } = await sb.from('scores').select('id,name,score,rank,destruction,best_combo,duration_s,created_at').order('score', { ascending: false }).limit(100);
      if (error) { $('#cBody').innerHTML = `<tr><td colspan="11" class="ko-err">${esc(error.message)}</td></tr>`; return; }
      rows = data || [];
      flags = flagScores(rows);
      render();
    }
    function remove(ids) {
      const before = rows.slice();
      softDelete({
        label: ids.length === 1 ? L('Skor', 'Score') : L(`${ids.length} skor`, `${ids.length} scores`),
        hide: () => { rows = rows.filter((r) => !ids.includes(r.id)); ids.forEach((id) => sel.delete(id)); flags = flagScores(rows); render(); },
        restore: () => { rows = before; flags = flagScores(rows); render(); },
        commit: () => sb.from('scores').delete().in('id', ids).then((r) => { ctx.refreshBadges(); return r; }),
      });
    }

    el.addEventListener('click', (e) => {
      const tr = e.target.closest('tr[data-id]');
      if (tr && e.target.closest('[data-del]')) { remove([Number(tr.dataset.id)]); return; }
      if (e.target.closest('#cPickSus')) { flags.forEach((_, id) => sel.add(id)); sfx('select'); render(); return; }
      if (e.target.closest('#cDel') && sel.size) remove([...sel]);
    });
    el.addEventListener('change', (e) => {
      if (e.target.id === 'cAll') { if (e.target.checked) rows.forEach((r) => sel.add(r.id)); else sel.clear(); render(); return; }
      if (e.target.id === 'cSus') { render(); return; }
      const tr = e.target.closest('tr[data-id]');
      if (tr && e.target.matches('[data-pick]')) {
        const id = Number(tr.dataset.id);
        if (e.target.checked) sel.add(id); else sel.delete(id);
        tr.classList.toggle('sel', e.target.checked);
        tools();
      }
    });

    await load();
    return {
      escape: () => { if (sel.size) { sel.clear(); render(); return true; } return false; },
    };
  },
};
