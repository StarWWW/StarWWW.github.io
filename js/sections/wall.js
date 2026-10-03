import { getSupabase, selectAll } from '../supabase.js';
import { $, esc, store, toast, uuid, API } from '../util.js';
import { t, onLang } from '../i18n.js';
import { spriteSVG } from '../sprites.js';
import { COLORS, MAX_POINTS, WALL_W, WALL_H, drawStroke, drawDrip, drawFull, weekStart, nextBuff, isoWeek } from '../spray.js';

const COLOR_NAMES = {
  '#99E550': ['Asit yeşil', 'Acid green'], '#DF7126': ['Turuncu', 'Orange'], '#D77BBA': ['Pembe', 'Pink'], '#5FCDE4': ['Camgöbeği', 'Cyan'],
  '#FBF236': ['Sarı', 'Yellow'], '#AC3232': ['Kırmızı', 'Red'], '#FFFFFF': ['Beyaz', 'White'], '#222034': ['Siyah', 'Black'],
};
const LOCAL_KEY = 'star.wall.local';

export async function initWall() {
  const wall = $('#wall');
  const canvas = $('#wallCanvas');
  if (!wall || !canvas) return;
  const ctx = canvas.getContext('2d');
  const cursors = $('#wallCursors');

  const clientId = store.get('star.cid') || (() => { const id = uuid(); store.set('star.cid', id); return id; })();
  const visitorNo = store.get('star.vno') || (() => { const n = 1 + Math.floor(Math.random() * 999); store.set('star.vno', n); return n; })();

  let color = store.get('star.sprayColor', COLORS[0]);
  let size = store.get('star.spraySize', 22);
  let spraying = false;
  let sb = null;
  let channel = null;
  let since = weekStart();
  let strokes = [];
  const known = new Set();
  const live = new Map();
  const recent = [];

  // ---------- araç kutusu ----------
  const sw = $('#swatches');
  const lang = () => (document.documentElement.lang === 'en' ? 1 : 0);
  function renderSwatches() {
    sw.innerHTML = COLORS.map((c) => `<button type="button" role="radio" aria-checked="${c === color}" aria-label="${esc(COLOR_NAMES[c][lang()])}" data-c="${c}" style="--sw:${c}"></button>`).join('');
  }
  sw.addEventListener('click', (e) => {
    const b = e.target.closest('[data-c]');
    if (!b) return;
    color = b.dataset.c;
    store.set('star.sprayColor', color);
    renderSwatches();
    sw.querySelector(`[data-c="${color}"]`)?.focus();
  });
  const noz = $('#nozzles');
  const syncNoz = () => noz.querySelectorAll('[data-size]').forEach((b) => b.setAttribute('aria-checked', String(Number(b.dataset.size) === size)));
  noz.addEventListener('click', (e) => {
    const b = e.target.closest('[data-size]');
    if (!b) return;
    size = Number(b.dataset.size);
    store.set('star.spraySize', size);
    syncNoz();
  });

  function setSpray(on) {
    spraying = on;
    wall.classList.toggle('spraying', on);
    const btn = $('#sprayToggle');
    btn.setAttribute('aria-pressed', String(on));
    $('#sprayState').textContent = on ? t('wl.on') : t('wl.off2');
    if (on) toast(t('wl.sprayHint'));
  }
  $('#sprayToggle').addEventListener('click', () => setSpray(!spraying));

  // ---------- çizim ----------
  let cur = null;
  let lastMove = 0;
  let lastDrip = 0;
  let sentIdx = 0;
  let bcastTimer = 0;

  const toNorm = (e) => {
    const r = canvas.getBoundingClientRect();
    return [
      Math.round(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * 10000) / 10000,
      Math.round(Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) * 10000) / 10000,
    ];
  };

  function rateOk() {
    const now = Date.now();
    while (recent.length && now - recent[0] > 60000) recent.shift();
    if (recent.length >= 45) { toast(t('wl.slow')); return false; }
    recent.push(now);
    return true;
  }

  function begin(p) {
    if (!rateOk()) return false;
    cur = { id: uuid(), client_id: clientId, color, size, points: [p], drips: [] };
    known.add(cur.id);
    sentIdx = 0;
    lastMove = performance.now();
    drawStroke(ctx, cur, 0);
    return true;
  }

  function addPoint(p) {
    const last = cur.points[cur.points.length - 1];
    if (Math.hypot(p[0] - last[0], (p[1] - last[1]) / 2) < 0.0016) return;
    cur.points.push(p);
    drawStroke(ctx, cur, cur.points.length - 1);
    lastMove = performance.now();
    if (cur.points.length >= MAX_POINTS) {
      const tail = cur.points[cur.points.length - 1];
      finish();
      begin(tail);
    }
  }

  function dripTick() {
    if (!cur) return;
    const now = performance.now();
    if (now - lastMove > 380 && now - lastDrip > 700 && cur.drips.length < 12) {
      const [x, y] = cur.points[cur.points.length - 1];
      const d = [x, y, Math.round((0.025 + Math.random() * 0.06) * 10000) / 10000];
      cur.drips.push(d);
      drawDrip(ctx, cur, d);
      lastDrip = now;
    }
    requestAnimationFrame(dripTick);
  }

  function broadcastPartial(force) {
    if (!channel || !cur) return;
    const now = performance.now();
    if (!force && now - bcastTimer < 90) return;
    bcastTimer = now;
    const pts = cur.points.slice(sentIdx);
    if (!pts.length) return;
    channel.send({ type: 'broadcast', event: 'paint', payload: { id: cur.id, color: cur.color, size: cur.size, from: sentIdx, pts } });
    sentIdx = cur.points.length;
  }

  async function finish() {
    if (!cur) return;
    broadcastPartial(true);
    const st = cur;
    cur = null;
    strokes.push(st);
    if (sb) {
      const { error } = await sb.from('wall_strokes').insert({ id: st.id, client_id: st.client_id, color: st.color, size: st.size, points: st.points, drips: st.drips });
      if (error) { console.warn('[wall] kaydedilemedi', error); toast(t('wl.slow')); }
    } else {
      const local = store.get(LOCAL_KEY, []);
      local.push({ ...st, created_at: new Date().toISOString() });
      store.set(LOCAL_KEY, local.slice(-300));
    }
  }

  wall.addEventListener('pointerdown', (e) => {
    if (!spraying || e.button > 0) return;
    e.preventDefault();
    try { wall.setPointerCapture(e.pointerId); } catch { /* sentetik olay */ }
    if (begin(toNorm(e))) requestAnimationFrame(dripTick);
  });
  wall.addEventListener('pointermove', (e) => {
    sendCursor(e);
    if (!cur) return;
    const co = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
    (co && co.length ? co : [e]).forEach((ev) => cur && addPoint(toNorm(ev)));
    broadcastPartial(false);
  });
  const end = () => finish();
  wall.addEventListener('pointerup', end);
  wall.addEventListener('pointercancel', end);
  window.addEventListener('pointerup', end);
  window.addEventListener('blur', end);

  // ---------- canlı imleçler ----------
  let curT = 0;
  function sendCursor(e) {
    if (!channel) return;
    const now = performance.now();
    if (now - curT < 70) return;
    curT = now;
    const [x, y] = toNorm(e);
    channel.send({ type: 'broadcast', event: 'cur', payload: { cid: clientId, n: visitorNo, x, y, s: spraying } });
  }
  const remote = new Map();
  function showCursor({ cid, n, x, y, s }) {
    if (cid === clientId) return;
    let r = remote.get(cid);
    if (!r) {
      const el = document.createElement('div');
      el.className = 'rcur';
      el.innerHTML = `<span class="ico"></span><b>${esc(t('wl.visitor', { n }))}</b>`;
      cursors.append(el);
      r = { el, t: 0, s: null };
      remote.set(cid, r);
    }
    if (r.s !== s) { r.el.querySelector('.ico').innerHTML = spriteSVG(s ? 'spray' : 'cursor', 2); r.s = s; }
    r.el.style.transform = `translate(${x * wall.clientWidth}px, ${y * wall.clientHeight}px)`;
    r.t = Date.now();
  }
  setInterval(() => {
    const now = Date.now();
    remote.forEach((r, cid) => { if (now - r.t > 5000) { r.el.remove(); remote.delete(cid); } });
  }, 2000);

  // ---------- yükleme / yeniden çizim ----------
  let drawToken = 0;
  function redraw() {
    ctx.clearRect(0, 0, WALL_W, WALL_H);
    const token = ++drawToken;
    const list = strokes.slice();
    let i = 0;
    const step = () => {
      if (token !== drawToken) return;
      const end2 = Math.min(list.length, i + 25);
      for (; i < end2; i++) drawFull(ctx, list[i]);
      if (i < list.length) requestAnimationFrame(step);
    };
    step();
  }

  async function loadStrokes() {
    since = weekStart();
    if (sb) {
      const { data: buff } = await sb.from('wall_buffs').select('at').order('at', { ascending: false }).limit(1);
      const lastBuff = buff?.[0]?.at ? Date.parse(buff[0].at) : 0;
      const from = new Date(Math.max(since, lastBuff)).toISOString();
      try {
        strokes = await selectAll(() => sb.from('wall_strokes').select('id,color,size,points,drips,created_at').gte('created_at', from).order('created_at', { ascending: true }));
      } catch (err) { console.warn('[wall] okunamadı', err); strokes = []; }
    } else {
      strokes = store.get(LOCAL_KEY, []).filter((s) => Date.parse(s.created_at) >= since);
    }
    known.clear();
    strokes.forEach((s) => known.add(s.id));
    redraw();
  }

  // ---------- haftalık sayaç ----------
  function tick() {
    const left = nextBuff() - Date.now();
    if (left <= 0) { loadStrokes(); return; }
    const d = Math.floor(left / 86400000);
    const hh = Math.floor((left % 86400000) / 3600000);
    const mm = Math.floor((left % 3600000) / 60000);
    $('#buffTimer').textContent = t('wl.timer', { d, h: hh, m: mm });
    const { week, year } = isoWeek();
    $('#wallWeek').textContent = t('wl.week', { w: week, y: year });
  }
  setInterval(tick, 20000);

  // ---------- arşiv ----------
  const modal = $('#archive');
  async function openArchive() {
    modal.hidden = false;
    const grid = $('#archiveGrid');
    grid.innerHTML = `<p class="px" style="padding:20px">${esc(t('pr.loadingD'))}</p>`;
    const end2 = weekStart();
    const start = end2 - 8 * 7 * 86400000;
    let rows = [];
    if (sb) {
      const { data } = await sb.from('wall_strokes').select('id,color,size,points,drips,created_at').gte('created_at', new Date(start).toISOString()).lt('created_at', new Date(end2).toISOString()).order('created_at', { ascending: true }).limit(4000);
      rows = data || [];
    } else {
      rows = store.get(LOCAL_KEY, []).filter((s) => { const ts = Date.parse(s.created_at); return ts >= start && ts < end2; });
    }
    const weeks = new Map();
    rows.forEach((s) => {
      const ws = weekStart(Date.parse(s.created_at));
      if (!weeks.has(ws)) weeks.set(ws, []);
      weeks.get(ws).push(s);
    });
    if (!weeks.size) { grid.innerHTML = `<p class="px" style="padding:20px">${esc(t('wl.noArchive'))}</p>`; return; }
    grid.innerHTML = '';
    [...weeks.entries()].sort((a, b) => b[0] - a[0]).forEach(([ws, list]) => {
      const item = document.createElement('figure');
      item.className = 'archive-item';
      item.style.margin = '0';
      const c = document.createElement('canvas');
      c.width = WALL_W / 2; c.height = WALL_H / 2;
      const cx = c.getContext('2d');
      list.forEach((s) => drawFull(cx, s, 0.5));
      const cap = document.createElement('p');
      cap.textContent = t('wl.archWeek', { w: isoWeek(ws + 3600000).week, n: list.length });
      item.append(c, cap);
      grid.append(item);
    });
  }
  $('#archiveBtn').addEventListener('click', openArchive);
  modal.addEventListener('click', (e) => { if (e.target === modal || e.target.closest('[data-close]')) modal.hidden = true; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) modal.hidden = true; });

  // ---------- gerçek zamanlı ----------
  function liveLabel(n) {
    $('#wallLive').textContent = sb ? t('wl.live', { n }) : t('wl.offline');
  }

  async function connect() {
    sb = await getSupabase();
    const notice = $('#wallNotice');
    if (!sb) {
      notice.hidden = false;
      notice.textContent = t('wl.localNote');
      liveLabel(0);
      return;
    }
    notice.hidden = true;
    channel = sb.channel('wall', { config: { presence: { key: clientId }, broadcast: { self: false } } });
    channel
      .on('broadcast', { event: 'cur' }, ({ payload }) => showCursor(payload))
      .on('broadcast', { event: 'paint' }, ({ payload: p }) => {
        if (known.has(p.id) && !live.has(p.id)) return;
        let s = live.get(p.id);
        if (!s) { s = { id: p.id, color: p.color, size: p.size, points: [], drips: [] }; live.set(p.id, s); known.add(p.id); }
        if (p.from !== s.points.length) return;
        const start = s.points.length;
        s.points.push(...p.pts);
        drawStroke(ctx, s, start);
      })
      .on('presence', { event: 'sync' }, () => liveLabel(Object.keys(channel.presenceState()).length))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'wall_strokes' }, ({ new: row }) => {
        const partial = live.get(row.id);
        if (partial) {
          drawStroke(ctx, row, partial.points.length);
          (row.drips || []).forEach((d) => drawDrip(ctx, row, d));
          live.delete(row.id);
          strokes.push(row);
          return;
        }
        if (known.has(row.id)) return;
        known.add(row.id);
        strokes.push(row);
        drawFull(ctx, row);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'wall_strokes' }, ({ old }) => {
        strokes = strokes.filter((s) => s.id !== old.id);
        redraw();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'wall_buffs' }, () => loadStrokes())
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') channel.track({ n: visitorNo });
      });
  }

  renderSwatches();
  syncNoz();
  tick();
  onLang(() => { renderSwatches(); tick(); $('#sprayState').textContent = spraying ? t('wl.on') : t('wl.off2'); liveLabel(channel ? Object.keys(channel.presenceState()).length : 0); if (!sb) $('#wallNotice').textContent = t('wl.localNote'); });

  // Duvar görünür olunca bağlan (ilk yükü hafif tutmak için)
  const io = new IntersectionObserver(async ([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    await connect();
    await loadStrokes();
  }, { rootMargin: '600px' });
  io.observe(wall);

  API.wall = {
    setSpray,
    isSpraying: () => spraying,
    focus: () => {
      if (API.fx?.scrollTo) API.fx.scrollTo('#duvar'); else document.getElementById('duvar').scrollIntoView({ behavior: 'smooth' });
      setSpray(true);
    },
    reload: loadStrokes,
  };
}
