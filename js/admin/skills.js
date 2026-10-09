// KONTROL ODASI — 03 YETENEKLER: 0–10 piksel bloklarla puanla, ad/kategori düzelt, ekle/sil.
// Değişiklikler birikir; alttaki çubuktan (ya da Ctrl+S) tek seferde kaydedilir.
import { esc, nameLang } from '../util.js';
import { t } from '../i18n.js';
import { CATS, rarity } from '../sections/skills.js';
import { icon, L, sfx, note, fail, ask, softDelete, levelHTML, setLevel } from './ui.js';

const ICON = { diller: 'term', web: 'globe', veri: 'db', arac: 'wrench', oyun: 'brush' };
const catName = (k) => t(CATS.find(([c]) => c === k)?.[1] || k);

export default {
  key: 'skills',
  icon: 'sparkle',
  label: () => L('YETENEKLER', 'SKILLS'),
  sub: () => L('Bloklara tıkla ya da ok tuşlarıyla puanla. Puanı 0 olan sitede görünmez.', 'Click the blocks or use the arrow keys to rate. Items rated 0 are hidden on the site.'),
  async mount(el, ctx) {
    const { sb } = ctx;
    el.innerHTML = `<section class="ad-card">
      <div class="ad-tools wrap">
        <div class="ad-chips" id="sCats" role="tablist" aria-label="${esc(L('Kategori', 'Category'))}"></div>
        <input class="ad-filter" id="sFilter" type="search" placeholder="${esc(L('yetenek ara…', 'find a skill…'))}" aria-label="${esc(L('Yetenek ara', 'Find a skill'))}">
      </div>
      <div class="ad-dist" id="sDist" aria-hidden="true"></div>
      <div class="ad-sk" id="sList"><p class="ad-empty">…</p></div>
      <form class="ad-sk-add" id="sAdd">
        <label class="sr" for="sName">${esc(L('Yeni yetenek', 'New skill'))}</label><input id="sName" placeholder="${esc(L('yeni yetenek adı', 'new skill name'))}" maxlength="40" autocomplete="off">
        <label class="sr" for="sCat">${esc(L('Kategori', 'Category'))}</label><select id="sCat">${CATS.map(([k]) => `<option value="${k}">${esc(catName(k))}</option>`).join('')}</select>
        <button class="ad-b">+ ${esc(L('EKLE', 'ADD'))}</button>
      </form>
    </section>
    <div class="ad-savebar" id="sBar" hidden>
      <span id="sBarT"></span>
      <button type="button" class="ad-b" id="sUndo">${esc(L('VAZGEÇ', 'DISCARD'))}</button>
      <button type="button" class="ad-b acc" id="sSave" data-sfx="none">${esc(L('KAYDET', 'SAVE'))} <kbd>CTRL+S</kbd></button>
    </div>`;
    const $ = (s) => el.querySelector(s);
    let skills = [];
    let cat = 'all';
    const dirty = new Map(); // id → { level?, name?, category? }
    const val = (s, k) => (dirty.get(s.id)?.[k] ?? s[k]);

    function chips() {
      const n = (k) => skills.filter((s) => k === 'all' || val(s, 'category') === k).length;
      $('#sCats').innerHTML = [['all', L('TÜMÜ', 'ALL')], ...CATS.map(([k]) => [k, catName(k)])].map(([k, label]) => `<button type="button" role="tab" aria-selected="${k === cat}" data-cat="${k}">${k === 'all' ? '' : icon(ICON[k], 2)}${esc(label)} <em>${n(k)}</em></button>`).join('');
    }
    function dist() {
      const counts = [0, 0, 0, 0, 0, 0];
      skills.forEach((s) => { counts[rarity(val(s, 'level'))]++; });
      const max = Math.max(1, ...counts);
      const names = [L('GİZLİ', 'HIDDEN'), L('SIRADAN', 'COMMON'), L('NADİR', 'UNCOMMON'), L('ENDER', 'RARE'), L('EPİK', 'EPIC'), L('EFSANE', 'LEGEND')];
      $('#sDist').innerHTML = counts.map((c, r) => `<span class="r${r}" style="--h:${c / max}"><i></i><b>${c}</b><small>${names[r]}</small></span>`).join('');
    }
    function bar() {
      const n = dirty.size;
      $('#sBar').hidden = !n;
      $('#sBarT').textContent = L(`${n} yetenekte kaydedilmemiş değişiklik`, `${n} skills have unsaved changes`);
    }
    function render() {
      chips(); dist(); bar();
      const q = $('#sFilter').value.trim().toLocaleLowerCase('tr');
      const groups = CATS.filter(([k]) => cat === 'all' || k === cat).map(([k]) => {
        const items = skills.filter((s) => val(s, 'category') === k && (!q || val(s, 'name').toLocaleLowerCase('tr').includes(q)));
        if (!items.length) return '';
        return `<h4>${icon(ICON[k], 2)} ${esc(catName(k))} <small>${items.filter((s) => val(s, 'level') > 0).length}/${items.length}</small></h4>
          ${items.map((s) => {
            const v = val(s, 'level');
            return `<div class="ad-sk-row r${rarity(v)}${dirty.has(s.id) ? ' dirty' : ''}" data-id="${s.id}">
              <button type="button" class="ad-sk-name" lang="${nameLang(val(s, 'name'))}" data-rename title="${esc(L('Adını değiştir', 'Rename'))}">${esc(val(s, 'name'))}</button>
              ${levelHTML(v, val(s, 'name'))}
              <output>${v ? `LV ${v}` : L('GİZLİ', 'HIDDEN')}</output>
              <select data-move aria-label="${esc(L('Kategori', 'Category'))}: ${esc(val(s, 'name'))}">${CATS.map(([c]) => `<option value="${c}"${c === val(s, 'category') ? ' selected' : ''}>${esc(catName(c))}</option>`).join('')}</select>
              <button type="button" class="ad-sk-del" data-del data-sfx="none" aria-label="${esc(L('Sil', 'Delete'))}: ${esc(val(s, 'name'))}">✕</button>
            </div>`;
          }).join('')}`;
      }).join('');
      $('#sList').innerHTML = groups || `<p class="ad-empty">${esc(skills.length ? L('Eşleşen yetenek yok.', 'No matching skills.') : L('Tablo boş.', 'The table is empty.'))}${skills.length ? '' : ` <button type="button" class="ad-b sm" id="sSeed">${esc(L('HAZIR LİSTEYİ YÜKLE', 'LOAD THE STARTER LIST'))}</button>`}</p>`;
    }
    async function load() {
      const { data, error } = await sb.from('skills').select('*').order('sort', { ascending: true }).order('name', { ascending: true });
      if (error) { $('#sList').innerHTML = `<div class="ad-err">${esc(error.message)}</div>`; return; }
      skills = data || [];
      render();
    }
    function change(s, patch) {
      const d = { ...(dirty.get(s.id) || {}), ...patch };
      Object.keys(d).forEach((k) => { if (d[k] === s[k]) delete d[k]; });
      if (Object.keys(d).length) dirty.set(s.id, d); else dirty.delete(s.id);
    }
    function rate(row, v) {
      const s = skills.find((x) => String(x.id) === row.dataset.id);
      v = Math.max(0, Math.min(10, v));
      if (v === val(s, 'level')) return;
      change(s, { level: v });
      setLevel(row.querySelector('.ad-lv'), v);
      row.querySelector('output').textContent = v ? `LV ${v}` : L('GİZLİ', 'HIDDEN');
      row.className = `ad-sk-row r${rarity(v)}${dirty.has(s.id) ? ' dirty' : ''}`;
      sfx('hover', { k: v });
      dist(); bar();
    }

    el.addEventListener('click', async (e) => {
      const c = e.target.closest('[data-cat]');
      if (c) { cat = c.dataset.cat; render(); return; }
      const row = e.target.closest('.ad-sk-row');
      const cell = e.target.closest('.ad-lv i');
      if (row && cell) {
        const k = Number(cell.dataset.k);
        const s = skills.find((x) => String(x.id) === row.dataset.id);
        rate(row, val(s, 'level') === k ? k - 1 : k); // aynı bloğa tekrar tıklayınca bir azalır
        return;
      }
      if (row && e.target.closest('[data-rename]')) {
        const s = skills.find((x) => String(x.id) === row.dataset.id);
        const v = await ask({ title: L('ADINI DEĞİŞTİR', 'RENAME'), ok: L('TAMAM', 'OK'), fields: [{ key: 'name', label: L('AD', 'NAME'), value: val(s, 'name'), max: 40, required: true }] });
        if (v) { change(s, { name: v.name }); render(); }
        return;
      }
      if (row && e.target.closest('[data-del]')) {
        const s = skills.find((x) => String(x.id) === row.dataset.id);
        const at = skills.indexOf(s);
        const pend = dirty.get(s.id);
        softDelete({
          label: `"${val(s, 'name')}"`,
          hide: () => { skills.splice(at, 1); dirty.delete(s.id); render(); },
          restore: () => { skills.splice(at, 0, s); if (pend) dirty.set(s.id, pend); render(); },
          commit: () => sb.from('skills').delete().eq('id', s.id).then((r) => { ctx.refreshBadges(); return r; }),
        });
        return;
      }
      if (e.target.closest('#sSeed')) {
        const seed = await (await fetch('data/skills.json')).json();
        const { error } = await sb.from('skills').insert(seed.map((s, i) => ({ name: s.name, category: s.category, level: s.level || 0, sort: i })));
        if (error) fail(error); else { note(L('Hazır liste yüklendi', 'Starter list loaded'), { type: 'ok' }); load(); }
        return;
      }
      if (e.target.closest('#sUndo')) {
        if (!(await ask({ title: L('DEĞİŞİKLİKLERDEN VAZGEÇ', 'DISCARD CHANGES'), text: L(`${dirty.size} yetenekteki kaydedilmemiş değişiklikler geri alınacak.`, `Unsaved changes on ${dirty.size} skills will be thrown away.`), ok: L('VAZGEÇ', 'DISCARD'), danger: true }))) return;
        dirty.clear(); render(); return;
      }
      if (e.target.closest('#sSave')) save();
    });
    el.addEventListener('change', (e) => {
      const sel = e.target.closest('[data-move]');
      if (!sel) return;
      const s = skills.find((x) => String(x.id) === sel.closest('.ad-sk-row').dataset.id);
      change(s, { category: sel.value });
      render();
    });
    el.addEventListener('keydown', (e) => {
      const lv = e.target.closest('.ad-lv');
      if (!lv) return;
      const row = lv.closest('.ad-sk-row');
      const v = Number(lv.dataset.lv);
      const next = { ArrowRight: v + 1, ArrowUp: v + 1, ArrowLeft: v - 1, ArrowDown: v - 1, Home: 0, End: 10, PageUp: v + 3, PageDown: v - 3 }[e.key]
        ?? (/^[0-9]$/.test(e.key) ? Number(e.key) : null);
      if (next == null) return;
      e.preventDefault();
      rate(row, next);
    });
    $('#sFilter').addEventListener('input', render);
    $('#sAdd').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = $('#sName').value.trim();
      if (!name) return;
      if (skills.some((s) => val(s, 'name').toLocaleLowerCase('tr') === name.toLocaleLowerCase('tr'))) { note(L('Bu yetenek zaten var', 'This skill already exists'), { type: 'err' }); return; }
      const { data, error } = await sb.from('skills').insert({ name, category: $('#sCat').value, level: 0, sort: skills.length }).select('*').single();
      if (error) { fail(error); return; }
      skills.push(data);
      $('#sName').value = '';
      cat = data.category;
      render();
      const row = el.querySelector(`.ad-sk-row[data-id="${data.id}"]`);
      row?.classList.add('flash');
      row?.scrollIntoView({ block: 'nearest' });
      row?.querySelector('.ad-lv')?.focus();
      note(L(`Eklendi: ${name} — şimdi puanla`, `Added: ${name} — now rate it`), { type: 'ok' });
      ctx.refreshBadges();
    });

    async function save() {
      if (!dirty.size) { note(L('Kaydedilecek değişiklik yok', 'Nothing to save')); return; }
      const btn = $('#sSave');
      btn.disabled = true;
      const jobs = [...dirty].map(([id, patch]) => sb.from('skills').update(patch).eq('id', id).then((r) => ({ id, patch, error: r.error })));
      const res = await Promise.all(jobs);
      btn.disabled = false;
      const bad = res.filter((r) => r.error);
      res.filter((r) => !r.error).forEach(({ id, patch }) => { Object.assign(skills.find((s) => s.id === id) || {}, patch); dirty.delete(id); });
      render();
      if (bad.length) fail(bad[0].error, L(`${bad.length} kayıt başarısız: `, `${bad.length} failed: `));
      else note(L(`${res.length} yetenek kaydedildi`, `${res.length} skills saved`), { type: 'ok' });
      ctx.refreshBadges();
    }

    await load();
    return {
      dirty: () => dirty.size > 0,
      save,
      focusSearch: () => $('#sFilter').focus(),
    };
  },
};
