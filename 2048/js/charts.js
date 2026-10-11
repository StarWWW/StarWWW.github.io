/*
 * Bağımlılıksız, DPR uyumlu canvas çizgi grafiği (hover ile değer okuma).
 */
'use strict';

function niceStep(range, targetTicks) {
  const raw = range / Math.max(1, targetTicks);
  const mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const norm = raw / mag;
  const step = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  return step * mag;
}

function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

class LineChart {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{yFormat?:Function, xFormat?:Function, yMin?:number, yMax?:number, height?:number}} opts
   */
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.opts = opts;
    this.series = [];
    this.markers = [];
    this.hoverX = null;
    this.pad = { l: 56, r: 14, t: 12, b: 26 };
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'chart-tooltip';
    this.tooltip.hidden = true;
    canvas.parentElement.style.position = 'relative';
    canvas.parentElement.appendChild(this.tooltip);

    this._ro = new ResizeObserver(() => this.draw());
    this._ro.observe(canvas.parentElement);
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.hoverX = e.clientX - rect.left;
      this.draw();
    });
    canvas.addEventListener('mouseleave', () => {
      this.hoverX = null;
      this.tooltip.hidden = true;
      this.draw();
    });
  }

  /** series: [{name, color, data:[[x,y],...], fill?:boolean, dashed?:boolean}] markers: [{x, label}] */
  setData(series, markers = []) {
    this.series = series;
    this.markers = markers;
    this.draw();
  }

  draw() {
    const canvas = this.canvas;
    const parent = canvas.parentElement;
    const w = parent.clientWidth;
    const h = this.opts.height || 180;
    if (w <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
    }
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const grid = cssVar('--chart-grid', 'rgba(255,255,255,0.06)');
    const axis = cssVar('--text-muted', '#9BADB7');
    const font = '11px ' + cssVar('--font-ui', 'system-ui');
    const { l, r, t, b } = this.pad;
    const pw = w - l - r, ph = h - t - b;

    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity, any = false;
    for (const s of this.series) {
      for (const [x, y] of s.data) {
        if (!Number.isFinite(y)) continue;
        any = true;
        if (x < xMin) xMin = x;
        if (x > xMax) xMax = x;
        if (y < yMin) yMin = y;
        if (y > yMax) yMax = y;
      }
    }
    ctx.font = font;
    if (!any) {
      ctx.fillStyle = axis;
      ctx.textAlign = 'center';
      ctx.fillText(this.opts.emptyText || 'Henüz veri yok', w / 2, h / 2);
      return;
    }
    if (this.opts.yMin !== undefined) yMin = Math.min(yMin, this.opts.yMin);
    if (this.opts.yMax !== undefined) yMax = Math.max(yMax, this.opts.yMax);
    if (this.opts.yMinFixed !== undefined) yMin = this.opts.yMinFixed;
    if (this.opts.yMaxFixed !== undefined) yMax = this.opts.yMaxFixed;
    if (yMax === yMin) { yMax += 1; yMin -= this.opts.yMinFixed !== undefined ? 0 : 1; }
    if (xMax === xMin) xMax = xMin + 1;
    const yStep = niceStep(yMax - yMin, Math.max(2, Math.floor(ph / 36)));
    yMin = Math.floor(yMin / yStep) * yStep;
    yMax = Math.ceil(yMax / yStep) * yStep;

    const X = (x) => l + ((x - xMin) / (xMax - xMin)) * pw;
    const Y = (y) => t + ph - ((y - yMin) / (yMax - yMin)) * ph;
    const yFmt = this.opts.yFormat || formatCompact;
    const xFmt = this.opts.xFormat || formatCompact;

    // Izgara ve eksenler
    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;
    ctx.fillStyle = axis;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let y = yMin; y <= yMax + yStep * 0.5; y += yStep) {
      const py = Math.round(Y(y)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(l, py);
      ctx.lineTo(w - r, py);
      ctx.stroke();
      ctx.fillText(yFmt(y), l - 8, py);
    }
    const xStep = niceStep(xMax - xMin, Math.max(2, Math.floor(pw / 90)));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let x = Math.ceil(xMin / xStep) * xStep; x <= xMax; x += xStep) {
      ctx.fillText(xFmt(x), X(x), h - b + 8);
    }

    // İşaretler (ör. 2048'e ulaşılan hamle)
    for (const m of this.markers) {
      if (m.x < xMin || m.x > xMax) continue;
      const px = Math.round(X(m.x)) + 0.5;
      ctx.strokeStyle = m.color || 'rgba(237,194,46,0.45)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(px, t);
      ctx.lineTo(px, t + ph);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = m.color || '#FBF236';
      ctx.textAlign = 'left';
      ctx.fillText(m.label, px + 4, t + 2);
    }

    // Seriler (piksel başına en fazla ~2 nokta olacak şekilde seyreltilir)
    for (const s of this.series) {
      const data = s.data;
      if (!data.length) continue;
      const stride = Math.max(1, Math.floor(data.length / (pw * 2)));
      ctx.beginPath();
      let started = false, lastX = 0;
      for (let i = 0; i < data.length; i += stride) {
        const [x, y] = data[i];
        if (!Number.isFinite(y)) continue;
        const px = X(x), py = Y(y);
        if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
        lastX = px;
      }
      const last = data[data.length - 1];
      if (Number.isFinite(last[1])) { ctx.lineTo(X(last[0]), Y(last[1])); lastX = X(last[0]); }
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width || 2;
      ctx.lineJoin = 'round';
      if (s.dashed) ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      if (s.fill && started) {
        ctx.lineTo(lastX, t + ph);
        ctx.lineTo(X(data[0][0]), t + ph);
        ctx.closePath();
        const grad = ctx.createLinearGradient(0, t, 0, t + ph);
        grad.addColorStop(0, s.color + '33');
        grad.addColorStop(1, s.color + '00');
        ctx.fillStyle = grad;
        ctx.fill();
      }
    }

    // Hover: en yakın x değerini göster
    if (this.hoverX !== null && this.hoverX >= l && this.hoverX <= w - r) {
      const xv = xMin + ((this.hoverX - l) / pw) * (xMax - xMin);
      const px = Math.round(this.hoverX) + 0.5;
      ctx.strokeStyle = axis;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(px, t);
      ctx.lineTo(px, t + ph);
      ctx.stroke();
      ctx.globalAlpha = 1;
      const rows = [];
      let xShown = null;
      for (const s of this.series) {
        const d = nearest(s.data, xv);
        if (!d || !Number.isFinite(d[1])) continue;
        xShown = d[0];
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(X(d[0]), Y(d[1]), 3.5, 0, Math.PI * 2);
        ctx.fill();
        rows.push(`<div><i style="background:${s.color}"></i>${s.name}: <b>${(s.format || yFmt)(d[1])}</b></div>`);
      }
      if (rows.length) {
        this.tooltip.innerHTML = `<div class="tt-x">${this.opts.xLabel || 'x'}: ${xFmt(xShown)}</div>${rows.join('')}`;
        this.tooltip.hidden = false;
        const tw = this.tooltip.offsetWidth;
        const left = this.hoverX + 12 + tw > w ? this.hoverX - tw - 12 : this.hoverX + 12;
        this.tooltip.style.left = left + 'px';
        this.tooltip.style.top = t + 'px';
      }
    }
  }
}

function nearest(data, x) {
  if (!data.length) return null;
  let lo = 0, hi = data.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (data[mid][0] < x) lo = mid; else hi = mid;
  }
  return Math.abs(data[lo][0] - x) <= Math.abs(data[hi][0] - x) ? data[lo] : data[hi];
}
