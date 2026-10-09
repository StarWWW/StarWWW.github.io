// KONTROL ODASI — 04 DUVAR: çizgileri tıklayarak ya da kutuyla seç, kimin çizdiğine göre topluca sil,
// zaman çubuğuyla duvarın nasıl çizildiğini izle, buff'la. Yeni çizgiler canlı düşer.
import { esc } from '../util.js';
import { selectAll } from '../supabase.js';
import { drawFull, cleanStroke, WALL_W, WALL_H } from '../spray.js';
import { L, sfx, note, fail, ask, softDelete, when, ago, num } from './ui.js';
import { wallSince } from './data.js';

const S = 0.5; // önizleme ölçeği (800×400)
const W = WALL_W * S; const H = WALL_H * S;
const short = (cid) => String(cid || '????').slice(0, 4).toUpperCase();

export default {
  key: 'wall',
  icon: 'spray',
  label: () => L('DUVAR', 'WALL'),
  sub: () => L('Bu dönemin çizgileri. Tıkla ya da kutu çiz → seç → sil. Bir kişinin tüm çizgilerini "çizenler"den seç.', 'Strokes of the current period. Click or drag a box → select → delete. Select everything one person drew from "artists".'),
  async mount(el, ctx) {
    const { sb } = ctx;
    el.innerHTML = `<section class="ko-card ko-wallcard">
      <div class="ko-tools wrap">
        <div class="ko-seg tools" role="radiogroup" aria-label="${esc(L('Araç', 'Tool'))}">
          <button type="button" role="radio" aria-checked="true" data-tool="pick">☝ ${esc(L('TIKLA', 'CLICK'))}</button>
          <button type="button" role="radio" aria-checked="false" data-tool="box">⬚ ${esc(L('KUTU', 'BOX'))}</button>
        </div>
        <span class="ko-hint" id="wSince"></span>
        <span class="ko-sp"></span>
        <button type="button" class="ko-b sm" data-last>${esc(L('SON 10\'U SEÇ', 'SELECT LAST 10'))}</button>
        <button type="button" class="ko-b sm" data-clear disabled>${esc(L('SEÇİMİ BIRAK', 'CLEAR'))}</button>
        <button type="button" class="ko-b sm red" data-del disabled data-sfx="none">${esc(L('SEÇİLİLERİ SİL', 'DELETE SELECTED'))}</button>
        <button type="button" class="ko-b sm stripe" data-buff>${esc(L('ŞİMDİ BUFF\'LA', 'BUFF NOW'))}</button>
      </div>
      <div class="ko-wallcv" id="wStage">
        <canvas id="wBase" width="${W}" height="${H}"></canvas>
        <canvas id="wTop" width="${W}" height="${H}" tabindex="0" aria-label="${esc(L('Duvar — çizgi seçmek için tıkla, Delete ile sil', 'Wall — click to select strokes, Delete to remove'))}"></canvas>
      </div>
      <div class="ko-time">
        <button type="button" class="ko-b sm" data-play>▶ ${esc(L('OYNAT', 'PLAY'))}</button>
        <input type="range" id="wTime" min="0" max="1000" value="1000" aria-label="${esc(L('Zaman', 'Time'))}">
        <output id="wTimeL"></output>
      </div>
    </section>
    <div class="ko-cols2">
      <section class="ko-card"><div class="ko-card-h"><b>${esc(L('SEÇİM', 'SELECTION'))}</b><span id="wSelN">0</span></div><div class="ko-winfo" id="wInfo"></div></section>
      <section class="ko-card"><div class="ko-card-h"><b>${esc(L('ÇİZENLER', 'ARTISTS'))}</b><span id="wPeopleN"></span></div><ul class="ko-list" id="wPeople"></ul></section>
    </div>`;
    const $ = (s) => el.querySelector(s);
    const base = $('#wBase').getContext('2d');
    const topCv = $('#wTop');
    const top = topCv.getContext('2d');
    let since = null;
    let strokes = [];
    let sel = new Set();
    let tool = 'pick';
    let tMax = 1000;
    let hover = null;
    let box = null;
    let playRaf = 0;

    // ---------- veri ----------
    const prep = (row) => {
      const s = cleanStroke(row) || { ...row, points: [], drips: [] };
      const xs = s.points.map((p) => p[0] * W); const ys = s.points.map((p) => p[1] * H);
      const r = (s.size || 22) * S * 0.75;
      s.bb = xs.length ? [Math.min(...xs) - r, Math.min(...ys) - r, Math.max(...xs) + r, Math.max(...ys) + r] : [0, 0, 0, 0];
      s.t = Date.parse(s.created_at);
      return s;
    };
    async function load() {
      since = await wallSince(sb);
      try {
        const rows = await selectAll(() => sb.from('wall_strokes').select('id,client_id,color,size,points,drips,created_at').gte('created_at', since).order('created_at', { ascending: true }));
        strokes = rows.map(prep);
      } catch (err) { fail(err); strokes = []; }
      sel = new Set([...sel].filter((id) => strokes.some((s) => s.id === id)));
      $('#wSince').textContent = L(`dönem başı: ${when(since)}`, `period start: ${when(since)}`);
      drawBase(); info(); people();
    }

    // ---------- çizim ----------
    const tCut = () => {
      if (!strokes.length) return Infinity;
      const a = Date.parse(since); const b = Math.max(Date.now(), strokes[strokes.length - 1].t);
      return Number($('#wTime').value) >= tMax ? Infinity : a + ((b - a) * Number($('#wTime').value)) / tMax;
    };
    const visible = () => { const c = tCut(); return strokes.filter((s) => s.t <= c); };
    function drawBase() {
      base.clearRect(0, 0, W, H);
      const vis = visible();
      if (sel.size) {
        base.globalAlpha = 0.22;
        vis.forEach((s) => { if (!sel.has(s.id)) drawFull(base, s, S); });
        base.globalAlpha = 1;
        vis.forEach((s) => { if (sel.has(s.id)) drawFull(base, s, S); });
      } else vis.forEach((s) => drawFull(base, s, S));
      const c = tCut();
      $('#wTimeL').textContent = c === Infinity ? L(`ŞİMDİ · ${vis.length} çizgi`, `NOW · ${vis.length} strokes`) : `${when(new Date(c).toISOString())} · ${vis.length}`;
      drawTop();
    }
    function drawTop() {
      top.clearRect(0, 0, W, H);
      top.lineWidth = 2;
      top.setLineDash([5, 4]);
      top.strokeStyle = '#AC3232';
      strokes.forEach((s) => { if (sel.has(s.id) && s.t <= tCut()) { const [a, b, c, d] = s.bb; top.strokeRect(a, b, c - a, d - b); } });
      if (hover && !sel.has(hover.id)) { top.strokeStyle = '#5FCDE4'; const [a, b, c, d] = hover.bb; top.strokeRect(a, b, c - a, d - b); }
      top.setLineDash([]);
      if (box) {
        top.fillStyle = 'rgba(251, 242, 54, .18)'; top.strokeStyle = '#222034';
        const x = Math.min(box.x0, box.x1); const y = Math.min(box.y0, box.y1);
        top.fillRect(x, y, Math.abs(box.x1 - box.x0), Math.abs(box.y1 - box.y0));
        top.strokeRect(x, y, Math.abs(box.x1 - box.x0), Math.abs(box.y1 - box.y0));
      }
    }

    // ---------- seçim ----------
    const toCv = (e) => { const r = topCv.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H]; };
    function nearest(x, y) {
      let best = null; let bd = 14;
      const vis = visible();
      for (let i = vis.length - 1; i >= 0; i--) {
        const s = vis[i];
        if (x < s.bb[0] - bd || x > s.bb[2] + bd || y < s.bb[1] - bd || y > s.bb[3] + bd) continue;
        for (const p of s.points) {
          const d = Math.hypot(p[0] * W - x, p[1] * H - y);
          if (d < bd) { bd = d; best = s; }
        }
      }
      return best;
    }
    function setSel(ids, add = false) {
      sel = add ? new Set([...sel, ...ids]) : new Set(ids);
      drawBase(); info();
      sfx(ids.length ? 'select' : 'toggleOff');
    }
    topCv.addEventListener('pointermove', (e) => {
      const [x, y] = toCv(e);
      if (box) { box.x1 = x; box.y1 = y; drawTop(); return; }
      if (tool !== 'pick') return;
      const h = nearest(x, y);
      if (h !== hover) { hover = h; drawTop(); topCv.style.cursor = h ? 'pointer' : 'crosshair'; }
    });
    topCv.addEventListener('pointerleave', () => { if (hover) { hover = null; drawTop(); } });
    topCv.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      const [x, y] = toCv(e);
      if (tool === 'box') { topCv.setPointerCapture(e.pointerId); box = { x0: x, y0: y, x1: x, y1: y, add: e.shiftKey }; return; }
      const s = nearest(x, y);
      if (!s) { if (!e.shiftKey) setSel([]); return; }
      if (e.shiftKey) { if (sel.has(s.id)) { sel.delete(s.id); setSel([...sel]); } else setSel([s.id], true); } else setSel([s.id]);
    });
    topCv.addEventListener('pointerup', () => {
      if (!box) return;
      const x0 = Math.min(box.x0, box.x1); const x1 = Math.max(box.x0, box.x1);
      const y0 = Math.min(box.y0, box.y1); const y1 = Math.max(box.y0, box.y1);
      const hits = visible().filter((s) => s.points.some((p) => p[0] * W >= x0 && p[0] * W <= x1 && p[1] * H >= y0 && p[1] * H <= y1)).map((s) => s.id);
      const add = box.add;
      box = null;
      setSel(hits, add);
    });
    topCv.addEventListener('keydown', (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel.size) { e.preventDefault(); removeSel(); }
    });

    function info() {
      const n = sel.size;
      $('#wSelN').textContent = String(n);
      $('[data-del]').disabled = !n;
      $('[data-del]').textContent = n ? L(`SEÇİLİ ${n} ÇİZGİYİ SİL`, `DELETE ${n} SELECTED`) : L('SEÇİLİLERİ SİL', 'DELETE SELECTED');
      $('[data-clear]').disabled = !n;
      const box2 = $('#wInfo');
      if (!n) {
        box2.innerHTML = `<p class="ko-empty">${esc(L('Duvarda bir çizgiye tıkla ya da KUTU aracıyla alan seç. Shift basılıyken seçime ekler. Seçiliyken Delete tuşu siler.', 'Click a stroke on the wall or drag an area with the BOX tool. Hold Shift to add. Press Delete to remove the selection.'))}</p>`;
        return;
      }
      const list = strokes.filter((s) => sel.has(s.id));
      if (n === 1) {
        const s = list[0];
        const mine = strokes.filter((x) => x.client_id === s.client_id).length;
        box2.innerHTML = `<dl class="ko-dl">
          <dt>${esc(L('RENK', 'COLOR'))}</dt><dd><i class="ko-dot" style="--c:${esc(s.color)}"></i> ${esc(s.color)} · ${esc(L('nozul', 'nozzle'))} ${esc(s.size)}</dd>
          <dt>${esc(L('NOKTA', 'POINTS'))}</dt><dd>${s.points.length}${s.drips.length ? ` · ${s.drips.length} ${esc(L('damla', 'drips'))}` : ''}</dd>
          <dt>${esc(L('ZAMAN', 'TIME'))}</dt><dd>${esc(when(s.created_at))} · ${esc(ago(s.created_at))}</dd>
          <dt>${esc(L('ÇİZEN', 'ARTIST'))}</dt><dd><code>${esc(short(s.client_id))}</code> · ${esc(L(`bu dönem ${mine} çizgi`, `${mine} strokes this period`))}</dd>
        </dl>${mine > 1 ? `<button type="button" class="ko-b sm" data-cid="${esc(s.client_id)}">${esc(L(`${short(s.client_id)}'NIN TÜM ÇİZGİLERİNİ SEÇ (${mine})`, `SELECT ALL ${mine} BY ${short(s.client_id)}`))}</button>` : ''}`;
        return;
      }
      const who = new Set(list.map((s) => s.client_id));
      const ts = list.map((s) => s.t);
      box2.innerHTML = `<dl class="ko-dl">
        <dt>${esc(L('ÇİZGİ', 'STROKES'))}</dt><dd>${num(n)}</dd>
        <dt>${esc(L('KİŞİ', 'PEOPLE'))}</dt><dd>${who.size}</dd>
        <dt>${esc(L('ARALIK', 'RANGE'))}</dt><dd>${esc(when(new Date(Math.min(...ts)).toISOString()))} → ${esc(when(new Date(Math.max(...ts)).toISOString()))}</dd>
      </dl>`;
    }
    function people() {
      const m = new Map();
      strokes.forEach((s) => {
        const p = m.get(s.client_id) || { cid: s.client_id, n: 0, colors: new Set(), last: 0 };
        p.n++; p.colors.add(s.color); p.last = Math.max(p.last, s.t);
        m.set(s.client_id, p);
      });
      const ps = [...m.values()].sort((a, b) => b.n - a.n);
      $('#wPeopleN').textContent = L(`${ps.length} kişi · ${num(strokes.length)} çizgi`, `${ps.length} people · ${num(strokes.length)} strokes`);
      $('#wPeople').innerHTML = ps.map((p) => `<li class="ko-row person">
        <code>${esc(short(p.cid))}</code>
        <span class="ko-tt"><b>${num(p.n)} ${esc(L('çizgi', 'strokes'))}</b><small>${[...p.colors].map((c) => `<i class="ko-dot" style="--c:${esc(c)}"></i>`).join('')} ${esc(ago(new Date(p.last).toISOString()))}</small></span>
        <span class="ko-bar" style="--v:${p.n / (ps[0]?.n || 1)}"><i></i></span>
        <span class="ko-acts"><button type="button" data-cid="${esc(p.cid)}">${esc(L('SEÇ', 'SELECT'))}</button></span>
      </li>`).join('') || `<li class="ko-empty">${esc(L('Bu dönem duvar boş.', 'The wall is empty this period.'))}</li>`;
    }

    function removeSel() {
      const ids = [...sel];
      const gone = strokes.filter((s) => sel.has(s.id));
      softDelete({
        label: L(`${ids.length} çizgi`, `${ids.length} strokes`),
        hide: () => { strokes = strokes.filter((s) => !sel.has(s.id)); sel = new Set(); drawBase(); info(); people(); },
        restore: () => { strokes = strokes.concat(gone).sort((a, b) => a.t - b.t); sel = new Set(ids); drawBase(); info(); people(); },
        commit: async () => {
          // uzun adres olmasın diye 100'erli gruplar
          for (let i = 0; i < ids.length; i += 100) {
            const r = await sb.from('wall_strokes').delete().in('id', ids.slice(i, i + 100)); // eslint-disable-line no-await-in-loop
            if (r.error) return r;
          }
          ctx.refreshBadges();
          return { error: null };
        },
      });
    }

    el.addEventListener('click', async (e) => {
      const tb = e.target.closest('[data-tool]');
      if (tb) {
        tool = tb.dataset.tool;
        el.querySelectorAll('[data-tool]').forEach((b) => b.setAttribute('aria-checked', String(b === tb)));
        topCv.style.cursor = 'crosshair';
        hover = null; drawTop();
        return;
      }
      const c = e.target.closest('[data-cid]');
      if (c) { setSel(strokes.filter((s) => s.client_id === c.dataset.cid).map((s) => s.id)); return; }
      if (e.target.closest('[data-last]')) { setSel(strokes.slice(-10).map((s) => s.id)); return; }
      if (e.target.closest('[data-clear]')) { setSel([]); return; }
      if (e.target.closest('[data-del]')) { removeSel(); return; }
      if (e.target.closest('[data-play]')) { play(); return; }
      if (e.target.closest('[data-buff]')) {
        if (!(await ask({ title: L('DUVARI BUFF\'LA', 'BUFF THE WALL'), text: L('Duvar şimdi herkes için temizlenir. Çizgiler silinmez, arşive yeni bir duvar olarak düşer.', 'The wall is wiped for everyone now. Strokes are not deleted; they go to the archive as a separate wall.'), ok: L('BUFF\'LA', 'BUFF'), danger: true }))) return;
        const { error } = await sb.from('wall_buffs').insert({});
        if (error) { fail(error); return; }
        note(L('Duvar buff\'landı — yeni dönem başladı', 'Wall buffed — a new period started'), { type: 'ok' });
        sel = new Set();
        load();
        ctx.refreshBadges();
      }
    });
    function stopPlay() {
      cancelAnimationFrame(playRaf); playRaf = 0;
      const btn = el.querySelector('[data-play]');
      btn.dataset.on = '';
      btn.textContent = `▶ ${L('OYNAT', 'PLAY')}`;
    }
    $('#wTime').addEventListener('input', () => { stopPlay(); drawBase(); });
    // zaman çubuğunu baştan sona 6 sn'de oynatır: duvar nasıl çizildi
    function play() {
      const btn = el.querySelector('[data-play]');
      if (btn.dataset.on === '1') { stopPlay(); $('#wTime').value = '1000'; drawBase(); return; }
      btn.dataset.on = '1';
      btn.textContent = `❚❚ ${L('DURDUR', 'STOP')}`;
      const t0 = performance.now();
      const step = (now) => {
        const k = Math.min(1, (now - t0) / 6000);
        $('#wTime').value = String(Math.round(k * 999));
        drawBase();
        if (k < 1 && btn.dataset.on === '1') playRaf = requestAnimationFrame(step);
        else { stopPlay(); $('#wTime').value = '1000'; drawBase(); }
      };
      playRaf = requestAnimationFrame(step);
    }

    await load();
    return {
      live(table, type, row) {
        if (table === 'wall_buffs') { load(); return; }
        if (table !== 'wall_strokes') return;
        if (type === 'INSERT' && row?.id && Date.parse(row.created_at) >= Date.parse(since) && !strokes.some((s) => s.id === row.id)) {
          strokes.push(prep(row));
          drawBase(); people();
          $('#wStage').classList.remove('ping'); void $('#wStage').offsetWidth; $('#wStage').classList.add('ping');
        }
        if (type === 'DELETE' && row?.id) {
          const before = strokes.length;
          strokes = strokes.filter((s) => s.id !== row.id);
          sel.delete(row.id);
          if (strokes.length !== before) { drawBase(); info(); people(); }
        }
      },
      escape: () => { if (sel.size) { setSel([]); return true; } return false; },
      unmount: () => { cancelAnimationFrame(playRaf); playRaf = 0; },
    };
  },
};
